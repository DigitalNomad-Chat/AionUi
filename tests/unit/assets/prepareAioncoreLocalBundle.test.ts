import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { prepareAioncore } = require('../../../packages/shared-scripts/src/prepare-aioncore');

describe('prepare-aioncore local bundle input', () => {
  it('hard fails local bundle input that lacks managed-resources manifest', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'aionui-local-bundle-'));
    const projectRoot = join(tmp, 'project');
    const localBundle = join(tmp, 'bundle');
    mkdirSync(join(localBundle, 'managed-resources'), { recursive: true });
    writeFileSync(join(localBundle, 'aioncore.exe'), '');

    const previous = process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR;
    process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR = localBundle;
    try {
      expect(() =>
        prepareAioncore({
          projectRoot,
          platform: 'win32',
          arch: 'x64',
          version: 'v0.1.46',
        })
      ).toThrow(/managed-resources\/manifest\.json/);
    } finally {
      if (previous === undefined) delete process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR;
      else process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR = previous;
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  const posixSymlinkIt = process.platform === 'win32' ? it.skip : it;

  posixSymlinkIt('preserves portable relative symlinks when copying a local bundle', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'aionui-local-bundle-links-'));
    const projectRoot = join(tmp, 'project');
    const localBundle = join(tmp, 'bundle');
    const managedResources = join(localBundle, 'managed-resources');
    const nodeRoot = join(managedResources, 'node');
    mkdirSync(join(nodeRoot, 'bin'), { recursive: true });
    mkdirSync(join(nodeRoot, 'lib'), { recursive: true });
    mkdirSync(join(managedResources, 'cli', 'claude'), { recursive: true });
    mkdirSync(join(managedResources, 'cli', 'codex', 'vendor'), { recursive: true });
    writeFileSync(join(localBundle, 'aioncore'), 'team-presets from-conversation team_presets');
    writeFileSync(join(nodeRoot, 'bin', 'node'), '');
    writeFileSync(join(nodeRoot, 'lib', 'npm-cli.js'), '');
    writeFileSync(join(managedResources, 'cli', 'claude', 'claude'), '');
    writeFileSync(join(managedResources, 'cli', 'codex', 'vendor', 'codex'), '');
    writeFileSync(
      join(managedResources, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 2,
        runtimeKey: 'darwin-arm64',
        node: { version: 'test', root: 'node', executable: 'bin/node' },
        clis: [
          {
            name: 'claude',
            version: 'test',
            root: 'cli/claude',
            platformDirectory: 'darwin-arm64',
            executable: 'claude',
          },
          {
            name: 'codex',
            version: 'test',
            root: 'cli/codex',
            platformDirectory: 'darwin-arm64',
            executable: 'vendor/codex',
            requiredDirectories: ['vendor'],
          },
        ],
      })
    );
    symlinkSync('../lib/npm-cli.js', join(nodeRoot, 'bin', 'npm'));
    writeFileSync(
      join(localBundle, 'manifest.json'),
      JSON.stringify({
        platform: 'darwin',
        arch: 'arm64',
        version: 'v0.1.62+adhoc.561d217b',
        sourceType: 'local-bundle',
        source: { commit: '561d217b', sha256: 'test-only' },
      })
    );

    const previous = process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR;
    process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR = localBundle;
    try {
      prepareAioncore({
        projectRoot,
        platform: 'darwin',
        arch: 'arm64',
        version: 'v0.1.62',
      });
      expect(
        readlinkSync(
          join(projectRoot, 'resources', 'bundled-aioncore', 'darwin-arm64', 'managed-resources', 'node', 'bin', 'npm')
        )
      ).toBe('../lib/npm-cli.js');
    } finally {
      if (previous === undefined) delete process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR;
      else process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR = previous;
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
