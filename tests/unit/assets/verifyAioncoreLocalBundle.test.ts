import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { findUnsafeSymlinks } = require('../../../scripts/verify-aioncore-local-bundle');

const posixSymlinkIt = process.platform === 'win32' ? it.skip : it;

describe('AionCore managed resource portability', () => {
  posixSymlinkIt('accepts relative symlinks whose targets stay inside the bundle', () => {
    const root = mkdtempSync(join(tmpdir(), 'aionui-portable-links-'));
    try {
      mkdirSync(join(root, 'bin'), { recursive: true });
      mkdirSync(join(root, 'lib'), { recursive: true });
      writeFileSync(join(root, 'lib', 'npm-cli.js'), '');
      symlinkSync('../lib/npm-cli.js', join(root, 'bin', 'npm'));

      expect(findUnsafeSymlinks(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  posixSymlinkIt('rejects absolute symlinks that capture a build-machine path', () => {
    const root = mkdtempSync(join(tmpdir(), 'aionui-absolute-links-'));
    try {
      mkdirSync(join(root, 'bin'), { recursive: true });
      symlinkSync('/private/tmp/build-only/npm-cli.js', join(root, 'bin', 'npm'));

      expect(findUnsafeSymlinks(root)).toEqual([
        {
          path: 'bin/npm',
          target: '/private/tmp/build-only/npm-cli.js',
          reason: 'absolute target',
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  posixSymlinkIt('rejects relative symlinks that escape the managed resource bundle', () => {
    const root = mkdtempSync(join(tmpdir(), 'aionui-escaping-links-'));
    try {
      mkdirSync(join(root, 'bin'), { recursive: true });
      symlinkSync('../../outside/npm-cli.js', join(root, 'bin', 'npm'));

      expect(findUnsafeSymlinks(root)[0]).toMatchObject({
        path: 'bin/npm',
        target: '../../outside/npm-cli.js',
        reason: 'target escapes bundle',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
