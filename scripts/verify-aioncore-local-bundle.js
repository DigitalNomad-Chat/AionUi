#!/usr/bin/env node

/**
 * Verify the pinned AionCore local bundle used for a production package.
 *
 * A release build must never fall back to the official download when the
 * bundled binary contains the ad-hoc team API. Keep this check small and
 * deterministic so it can run both before prepare-aioncore and from the
 * electron-builder afterPack hook.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_SOURCE_COMMIT = '561d217b';
const EXPECTED_BINARY_SHA256 = '58e7207247f7aa1ce670995b55dd3cf3d1d69fc37013e71905707d5c7d13b5ee';
const REQUIRED_SIGNATURES = ['team-presets', 'from-conversation', 'team_presets'];

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readManifest(bundleDir) {
  const manifestPath = path.join(bundleDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`AionCore local bundle manifest is missing: ${manifestPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`AionCore local bundle manifest is invalid JSON: ${error.message}`);
  }
}

function verifyAioncoreLocalBundle({
  bundleDir,
  platform = process.platform,
  arch = process.arch,
  expectedSourceCommit = EXPECTED_SOURCE_COMMIT,
  expectedBinarySha256 = EXPECTED_BINARY_SHA256,
} = {}) {
  if (!bundleDir) {
    throw new Error('AIONUI_BACKEND_LOCAL_BUNDLE_DIR is required for production packaging');
  }

  const resolvedBundleDir = path.resolve(bundleDir);
  if (!fs.existsSync(resolvedBundleDir) || !fs.statSync(resolvedBundleDir).isDirectory()) {
    throw new Error(`AionCore local bundle directory is missing: ${resolvedBundleDir}`);
  }

  const binaryName = platform === 'win32' ? 'aioncore.exe' : 'aioncore';
  const binaryPath = path.join(resolvedBundleDir, binaryName);
  if (!fs.existsSync(binaryPath) || !fs.statSync(binaryPath).isFile()) {
    throw new Error(`AionCore local bundle binary is missing: ${binaryPath}`);
  }
  const managedResourcesPath = path.join(resolvedBundleDir, 'managed-resources');
  if (!fs.existsSync(managedResourcesPath) || !fs.statSync(managedResourcesPath).isDirectory()) {
    throw new Error(`AionCore local bundle managed resources are missing: ${managedResourcesPath}`);
  }

  const manifest = readManifest(resolvedBundleDir);
  const runtimeKey = `${platform}-${arch}`;
  if (manifest.platform !== platform || manifest.arch !== arch) {
    throw new Error(
      `AionCore local bundle runtime mismatch: expected ${runtimeKey}, got ${manifest.platform || 'unknown'}-${manifest.arch || 'unknown'}`
    );
  }
  if (manifest.sourceType !== 'local-bundle') {
    throw new Error(
      `AionCore production packaging requires sourceType=local-bundle (got ${String(manifest.sourceType || 'missing')})`
    );
  }

  const source = manifest.source && typeof manifest.source === 'object' ? manifest.source : {};
  const sourceCommit = source.commit || manifest.sourceCommit;
  if (typeof sourceCommit !== 'string' || !sourceCommit.startsWith(expectedSourceCommit)) {
    throw new Error(
      `AionCore source commit mismatch: expected ${expectedSourceCommit} (or full hash), got ${String(sourceCommit || 'missing')}`
    );
  }
  const actualSha256 = sha256(binaryPath);
  const declaredSha256 = source.sha256 || manifest.sha256;
  if (actualSha256 !== expectedBinarySha256) {
    throw new Error(`AionCore binary SHA-256 mismatch: expected ${expectedBinarySha256}, got ${actualSha256}`);
  }
  if (declaredSha256 !== expectedBinarySha256) {
    throw new Error(
      `AionCore manifest SHA-256 mismatch: expected ${expectedBinarySha256}, got ${String(declaredSha256 || 'missing')}`
    );
  }

  const binaryText = fs.readFileSync(binaryPath).toString('latin1');
  const missingSignatures = REQUIRED_SIGNATURES.filter((signature) => !binaryText.includes(signature));
  if (missingSignatures.length > 0) {
    throw new Error(`AionCore binary is missing team API fingerprints: ${missingSignatures.join(', ')}`);
  }

  return {
    bundleDir: resolvedBundleDir,
    runtimeKey,
    binaryPath,
    sourceCommit,
    sha256: actualSha256,
    signatures: REQUIRED_SIGNATURES,
  };
}

function parseCliArgs(argv) {
  const args = [...argv];
  let bundleDir = process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR || '';
  let platform = process.platform;
  let arch = process.arch;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--bundle-dir') bundleDir = args[++index] || '';
    else if (arg === '--platform') platform = args[++index] || platform;
    else if (arg === '--arch') arch = args[++index] || arch;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/verify-aioncore-local-bundle.js [--bundle-dir DIR] [--platform PLATFORM] [--arch ARCH]'
      );
      process.exit(0);
    }
  }
  return { bundleDir, platform, arch };
}

if (require.main === module) {
  try {
    const result = verifyAioncoreLocalBundle(parseCliArgs(process.argv.slice(2)));
    console.log(
      `AionCore local bundle verified: ${result.runtimeKey}; commit ${result.sourceCommit}; SHA-256 ${result.sha256}`
    );
  } catch (error) {
    console.error(`AionCore local bundle verification failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED_BINARY_SHA256,
  EXPECTED_SOURCE_COMMIT,
  REQUIRED_SIGNATURES,
  verifyAioncoreLocalBundle,
};
