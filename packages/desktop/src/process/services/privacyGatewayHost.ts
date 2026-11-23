/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import * as path from 'node:path';
import { startPrivacyGateway, type PrivacyGatewayHandle } from './privacyGatewaySupervisor';

/**
 * Host-side lifecycle for the loopback privacy gateway (Yinye integration).
 * Opt-in and development-oriented: the gateway starts only when
 * `YINYE_PRIVACY_ENABLED=1` is present and `YINYE_PRIVACY_MODULE_ROOT` points
 * at a checkout of the privacy workbench (the directory that contains the
 * `privacy_workbench` package). Missing or invalid configuration leaves the
 * gateway stopped and reports why via `error` — the supervisor never blocks
 * app startup and never retries in a loop.
 *
 * Upstream note: per-session upstreams are bound by the backend factory via
 * the gateway admin API, so the child process here starts without a default
 * upstream.
 */

export type PrivacyGatewayStatus = {
  running: boolean;
  adminUrl: string | null;
  adminToken: string | null;
  error: string | null;
};

let handle: PrivacyGatewayHandle | null = null;
let startPromise: Promise<PrivacyGatewayHandle> | null = null;
let lastError: string | null = null;

const resolveVaultDir = (): string => path.join(app.getPath('userData'), 'yinye-privacy-vault');

const resolveConfig = ():
  | { ok: true; pythonPath: string; moduleRoot: string; vaultDir: string }
  | { ok: false; reason: string } => {
  if (process.env.YINYE_PRIVACY_ENABLED !== '1') {
    return { ok: false, reason: 'disabled' };
  }
  const moduleRoot = process.env.YINYE_PRIVACY_MODULE_ROOT;
  if (!moduleRoot) {
    return { ok: false, reason: 'YINYE_PRIVACY_MODULE_ROOT is not set' };
  }
  return {
    ok: true,
    pythonPath: process.env.YINYE_PRIVACY_PYTHON || 'python3',
    moduleRoot,
    vaultDir: process.env.YINYE_PRIVACY_VAULT_DIR || resolveVaultDir(),
  };
};

export const getPrivacyGatewayStatus = (): PrivacyGatewayStatus => ({
  running: handle !== null,
  adminUrl: handle?.adminUrl ?? null,
  adminToken: handle?.adminToken ?? null,
  error: lastError,
});

export const ensurePrivacyGateway = async (): Promise<PrivacyGatewayStatus> => {
  if (handle) return getPrivacyGatewayStatus();
  if (startPromise) {
    await startPromise.catch((): undefined => undefined);
    return getPrivacyGatewayStatus();
  }
  const config = resolveConfig();
  if (!config.ok) {
    lastError = (config as { ok: false; reason: string }).reason;
    return getPrivacyGatewayStatus();
  }
  lastError = null;
  startPromise = startPrivacyGateway({
    pythonPath: config.pythonPath,
    moduleRoot: config.moduleRoot,
    // Per-session upstreams arrive via the admin API; the child has no default.
    upstreamUrl: 'http://127.0.0.1:9/v1',
    vaultDir: config.vaultDir,
  });
  try {
    handle = await startPromise;
    lastError = null;
  } catch (error) {
    handle = null;
    lastError = error instanceof Error ? error.message : String(error);
  } finally {
    startPromise = null;
  }
  return getPrivacyGatewayStatus();
};

export const stopPrivacyGateway = async (): Promise<void> => {
  const current = handle;
  handle = null;
  startPromise = null;
  if (current) {
    await current.stop();
  }
};
