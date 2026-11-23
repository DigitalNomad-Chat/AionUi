/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Supervises the loopback privacy gateway child process (a local Python
 * service from the Yinye integration). The supervisor only owns process
 * lifecycle; all wire semantics (session binding, redaction, restore) live in
 * the gateway itself, which listens on 127.0.0.1 with a random port and
 * announces it via a `GATEWAY_READY <json>` line on stdout.
 *
 * Packaging note: development setups point `pythonPath`/`moduleRoot` at a
 * local checkout of the privacy workbench. Shipping this inside the AionUi
 * installer needs a bundled Python runtime + engine binary and is tracked as
 * follow-up packaging work.
 */

export interface PrivacyGatewayStartOptions {
  pythonPath: string;
  /** Directory that contains the `privacy_workbench` package. */
  moduleRoot: string;
  /** Default upstream; omit when every session binds its own via the admin API. */
  upstreamUrl?: string;
  upstreamKey?: string;
  models?: string[];
  vaultDir?: string;
  adminTokenFile?: string;
  /** Abort startup when the ready line has not appeared (default 15s). */
  readyTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface PrivacyGatewayHandle {
  adminUrl: string;
  adminToken: string;
  pid: number;
  stop: (timeoutMs?: number) => Promise<void>;
}

const READY_PREFIX = 'GATEWAY_READY ';
const STOP_TIMEOUT_DEFAULT_MS = 8_000;

export const startPrivacyGateway = (options: PrivacyGatewayStartOptions): Promise<PrivacyGatewayHandle> =>
  new Promise((resolve, reject) => {
    const args = ['-m', 'privacy_workbench.gateway_service'];
    if (options.upstreamUrl) args.push('--upstream-url', options.upstreamUrl);
    if (options.upstreamKey) args.push('--upstream-key', options.upstreamKey);
    if (options.models?.length) args.push('--models', options.models.join(','));
    if (options.vaultDir) args.push('--vault-dir', options.vaultDir);
    if (options.adminTokenFile) args.push('--admin-token-file', options.adminTokenFile);

    const child: ChildProcess = spawn(options.pythonPath, args, {
      cwd: options.moduleRoot,
      env: { ...process.env, PYTHONPATH: options.moduleRoot, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const readyTimeoutMs = options.readyTimeoutMs ?? 15_000;
    let settled = false;
    let stdoutBuffer = '';
    let stderrBuffer = '';

    const timer = setTimeout(() => {
      fail(new Error(`privacy gateway did not become ready within ${readyTimeoutMs}ms`));
    }, readyTimeoutMs);

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      reject(error);
    };

    const onLine = (line: string) => {
      if (settled || !line.startsWith(READY_PREFIX)) return;
      settled = true;
      clearTimeout(timer);
      try {
        const info = JSON.parse(line.slice(READY_PREFIX.length)) as {
          admin_url?: string;
          admin_token?: string;
        };
        if (!info.admin_url?.startsWith('http://127.0.0.1:') || !info.admin_token) {
          fail(new Error('privacy gateway announced malformed ready payload'));
          return;
        }
        resolve({
          adminUrl: info.admin_url,
          adminToken: info.admin_token,
          pid: child.pid ?? 0,
          stop: (timeoutMs = STOP_TIMEOUT_DEFAULT_MS) =>
            new Promise<void>((resolveStop) => {
              if (child.exitCode !== null || child.signalCode !== null) {
                resolveStop();
                return;
              }
              const killTimer = setTimeout(() => {
                child.kill('SIGKILL');
              }, timeoutMs);
              child.once('exit', () => {
                clearTimeout(killTimer);
                resolveStop();
              });
              child.kill('SIGTERM');
            }),
        });
      } catch {
        fail(new Error('privacy gateway ready payload is not valid JSON'));
      }
    };

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      let newline = stdoutBuffer.indexOf('\n');
      while (newline >= 0) {
        onLine(stdoutBuffer.slice(0, newline).trim());
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        newline = stdoutBuffer.indexOf('\n');
      }
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderrBuffer = (stderrBuffer + chunk).slice(-4_096);
    });
    child.once('error', (error) => fail(error));
    child.once('exit', (code, signal) => {
      if (!settled) {
        fail(new Error(`privacy gateway exited before ready (code=${code}, signal=${signal}): ${stderrBuffer}`));
      }
    });
  });
