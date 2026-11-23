/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ensurePrivacyGateway, getPrivacyGatewayStatus } from '@process/services/privacyGatewayHost';

/**
 * Privacy gateway bridge. Lazily starts the loopback gateway on the first
 * status pull (opt-in via env, see privacyGatewayHost) so renderer code can
 * discover the per-launch admin coordinates without any manual setup.
 */
export function initPrivacyGatewayBridge(): void {
  ipcBridge.privacyGateway.getStatus.provider(async () => {
    const status = await ensurePrivacyGateway();
    return status;
  });
}
