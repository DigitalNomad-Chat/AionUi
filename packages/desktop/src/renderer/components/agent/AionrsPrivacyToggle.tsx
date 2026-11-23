/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { parseError } from '@/common/utils';
import { iconColors } from '@/renderer/styles/colors';
import { Button, InputTag, Message, Popover, Switch, Tooltip } from '@arco-design/web-react';
import { Lock, Unlock } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAcpRuntimeRestart } from './AcpRuntimeRestartButton';

/**
 * Loopback privacy gateway coordinates. Primary source is the main-process
 * supervisor (ipcBridge.privacyGateway.getStatus lazily starts the gateway
 * and returns the per-launch coordinates); the result is cached in
 * localStorage so later mounts do not re-query. Without coordinates the
 * panel stays disabled so a conversation can never be half-bound.
 */
const GATEWAY_URL_KEY = 'yinye.gateway.adminUrl';
const GATEWAY_TOKEN_KEY = 'yinye.gateway.adminToken';

const readCachedGatewayConfig = (): { adminUrl: string | null; adminToken: string | null } => ({
  adminUrl: window.localStorage.getItem(GATEWAY_URL_KEY),
  adminToken: window.localStorage.getItem(GATEWAY_TOKEN_KEY),
});

const useGatewayConfig = (): { adminUrl: string | null; adminToken: string | null } => {
  const [config, setConfig] = useState(readCachedGatewayConfig);
  useEffect(() => {
    if (config.adminUrl && config.adminToken) return;
    let cancelled = false;
    ipcBridge.privacyGateway.getStatus
      .invoke()
      .then((status) => {
        if (cancelled || !status.running || !status.adminUrl || !status.adminToken) return;
        window.localStorage.setItem(GATEWAY_URL_KEY, status.adminUrl);
        window.localStorage.setItem(GATEWAY_TOKEN_KEY, status.adminToken);
        setConfig({ adminUrl: status.adminUrl, adminToken: status.adminToken });
      })
      .catch((): undefined => undefined);
    return () => {
      cancelled = true;
    };
  }, [config.adminUrl, config.adminToken]);
  return config;
};

type PrivacyExtra = {
  enabled?: boolean;
  gateway_url?: string;
  admin_token?: string;
  policy?: { words?: string[] };
};

const readPrivacyExtra = (extra: Record<string, unknown> | undefined): PrivacyExtra | undefined =>
  (extra?.privacy ?? undefined) as PrivacyExtra | undefined;

/**
 * Header control for aionrs conversations: a lock icon opening a small panel
 * with the privacy switch and the protected-words editor. All writes go to
 * `conversation.extra.privacy` (backend factory binds on the next runtime
 * build) and restart the runtime so changes take effect immediately. Words
 * edits only change detection policy — existing label mappings survive.
 */
const AionrsPrivacyToggle: React.FC<{
  conversation_id: string;
  extra: Record<string, unknown> | undefined;
}> = ({ conversation_id, extra }) => {
  const { t } = useTranslation();
  const [switching, setSwitching] = useState(false);
  const [savingWords, setSavingWords] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const { restart, restarting } = useAcpRuntimeRestart({ conversation_id });
  const gateway = useGatewayConfig();

  const privacy = readPrivacyExtra(extra);
  const enabled = privacy?.enabled === true;
  const configurable = Boolean(gateway.adminUrl && gateway.adminToken);
  const busy = switching || restarting;

  useEffect(() => {
    setWords(privacy?.policy?.words ?? []);
  }, [privacy?.policy?.words]);

  const persistPrivacy = async (next: PrivacyExtra): Promise<void> => {
    await ipcBridge.conversation.update.invoke({
      id: conversation_id,
      updates: { extra: { privacy: next } } as Partial<TChatConversation>,
      merge_extra: true,
    });
  };

  const toggle = async (nextEnabled: boolean): Promise<void> => {
    if (!configurable || busy) return;
    setSwitching(true);
    try {
      await persistPrivacy({
        enabled: nextEnabled,
        gateway_url: gateway.adminUrl ?? '',
        admin_token: gateway.adminToken ?? '',
        ...(privacy?.policy ? { policy: privacy.policy } : {}),
      });
      Message.success(t(nextEnabled ? 'agent.privacyToggle.enabledTip' : 'agent.privacyToggle.disabledTip'));
      await restart();
    } catch (error) {
      Message.error(parseError(error) || t('agent.privacyToggle.failed'));
    } finally {
      setSwitching(false);
    }
  };

  const saveWords = async (): Promise<void> => {
    if (!configurable || savingWords) return;
    const trimmed = Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)));
    setSavingWords(true);
    try {
      await persistPrivacy({
        enabled,
        gateway_url: privacy?.gateway_url || gateway.adminUrl || '',
        admin_token: privacy?.admin_token || gateway.adminToken || '',
        policy: { words: trimmed },
      });
      Message.success(t('agent.privacyToggle.wordsSaved'));
      await restart();
    } catch (error) {
      Message.error(parseError(error) || t('agent.privacyToggle.failed'));
    } finally {
      setSavingWords(false);
    }
  };

  const tooltip = !configurable
    ? t('agent.privacyToggle.noGateway')
    : enabled
      ? t('agent.privacyToggle.enabledTooltip')
      : t('agent.privacyToggle.disabledTooltip');

  const panel = (
    <div className='w-260px flex flex-col gap-8px'>
      <div className='flex items-center justify-between'>
        <span className='text-13px font-medium'>{t('agent.privacyToggle.panelTitle')}</span>
        <Switch
          size='small'
          checked={enabled}
          disabled={!configurable || busy}
          loading={switching}
          onChange={(checked) => {
            void toggle(Boolean(checked)).catch((): void => undefined);
          }}
        />
      </div>
      <div className='text-12px text-secondary'>
        {t(enabled ? 'agent.privacyToggle.statusEnabled' : 'agent.privacyToggle.statusDisabled')}
      </div>
      <div className='flex flex-col gap-4px'>
        <span className='text-12px'>{t('agent.privacyToggle.wordsLabel')}</span>
        <InputTag
          value={words}
          disabled={!configurable || busy}
          placeholder={t('agent.privacyToggle.wordsPlaceholder')}
          onChange={(next) => {
            setWords(next as string[]);
          }}
        />
        <Button
          size='mini'
          type='outline'
          loading={savingWords}
          disabled={!configurable || busy || savingWords}
          onClick={() => {
            void saveWords().catch((): void => undefined);
          }}
        >
          {t('agent.privacyToggle.wordsSave')}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover trigger='click' content={panel} disabled={!configurable}>
      <span className='inline-flex'>
        <Tooltip content={tooltip}>
          <Button
            type='text'
            size='mini'
            className='h-28px w-28px'
            disabled={!configurable}
            icon={
              enabled ? (
                <Lock theme='filled' size='14' fill={iconColors.primary} />
              ) : (
                <Unlock theme='outline' size='14' fill={iconColors.secondary} />
              )
            }
            aria-label={tooltip}
          />
        </Tooltip>
      </span>
    </Popover>
  );
};

export default AionrsPrivacyToggle;
