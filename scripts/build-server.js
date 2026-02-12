/**
 * Build script for compiling the StreamForge Node.js server into
 * standalone binaries using @yao-pkg/pkg, then renaming them to
 * match Tauri's expected sidecar naming convention.
 *
 * Tauri v2 expects sidecar binaries named:
 *   <name>-<rust-target-triple>[.exe]
 *
 * Usage:
 *   node scripts/build-server.js          # Build all platforms
 *   node scripts/build-server.js --current # Build for current platform only
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const BINARIES_DIR = join(ROOT, 'src-tauri', 'binaries');
const SERVER_DIR = join(ROOT, 'server');

// Mapping from pkg output names to Tauri target triples.
// pkg uses the multi-target suffix names when building all targets,
// but uses just "streamforge-server[.exe]" for single-target builds.
const RENAME_MAP = {
  // Multi-target names (pkg adds platform suffix)
  'streamforge-server-win-x64.exe': 'streamforge-server-x86_64-pc-windows-msvc.exe',
  'streamforge-server-macos-x64':   'streamforge-server-x86_64-apple-darwin',
  'streamforge-server-macos-arm64': 'streamforge-server-aarch64-apple-darwin',
  'streamforge-server-linux-x64':   'streamforge-server-x86_64-unknown-linux-gnu',
};

// Single-target fallback names (pkg omits platform suffix for single target)
const SINGLE_TARGET_MAP = {
  'node20-win-x64':     { from: 'streamforge-server.exe', to: 'streamforge-server-x86_64-pc-windows-msvc.exe' },
  'node20-macos-x64':   { from: 'streamforge-server',     to: 'streamforge-server-x86_64-apple-darwin' },
  'node20-macos-arm64': { from: 'streamforge-server',     to: 'streamforge-server-aarch64-apple-darwin' },
  'node20-linux-x64':   { from: 'streamforge-server',     to: 'streamforge-server-x86_64-unknown-linux-gnu' },
};

// Determine which targets to build
const currentOnly = process.argv.includes('--current');
let pkgTargets;

if (currentOnly) {
  const platform = process.platform;  // win32, darwin, linux
  const arch = process.arch;          // x64, arm64
  const targetMap = {
    'win32-x64':   'node20-win-x64',
    'darwin-x64':  'node20-macos-x64',
    'darwin-arm64': 'node20-macos-arm64',
    'linux-x64':   'node20-linux-x64',
  };
  const key = `${platform}-${arch}`;
  pkgTargets = targetMap[key];
  if (!pkgTargets) {
    console.error(`Unsupported platform/arch: ${key}`);
    process.exit(1);
  }
  console.log(`Building for current platform only: ${pkgTargets}`);
} else {
  console.log('Building for all platforms...');
}

// Ensure output directory exists
if (!existsSync(BINARIES_DIR)) {
  mkdirSync(BINARIES_DIR, { recursive: true });
}

// Run pkg
const targetFlag = pkgTargets ? `--target ${pkgTargets}` : '';
const cmd = `npx pkg . ${targetFlag} --out-path "${BINARIES_DIR}"`;
console.log(`\n> ${cmd}\n`);

try {
  execSync(cmd, {
    cwd: SERVER_DIR,
    stdio: 'inherit',
    env: { ...process.env },
  });
} catch (err) {
  console.error('pkg build failed');
  process.exit(1);
}

// Rename outputs to Tauri target-triple convention
console.log('\nRenaming binaries to Tauri sidecar format...');
let renamed = 0;

function doRename(fromName, toName) {
  const src = join(BINARIES_DIR, fromName);
  const dest = join(BINARIES_DIR, toName);
  if (existsSync(src)) {
    if (existsSync(dest)) unlinkSync(dest);
    renameSync(src, dest);
    console.log(`  ${fromName} -> ${toName}`);
    renamed++;
    return true;
  }
  return false;
}

// Try multi-target names first (used when building all platforms)
for (const [pkgName, tauriName] of Object.entries(RENAME_MAP)) {
  doRename(pkgName, tauriName);
}

// If nothing was renamed, try single-target fallback names
if (renamed === 0 && pkgTargets) {
  // pkgTargets may be a single target string
  const targets = pkgTargets.split(',');
  for (const target of targets) {
    const mapping = SINGLE_TARGET_MAP[target.trim()];
    if (mapping) {
      doRename(mapping.from, mapping.to);
    }
  }
}

if (renamed === 0) {
  console.warn('\nWarning: No binaries were renamed. Check pkg output names.');
  const { readdirSync } = await import('fs');
  const files = readdirSync(BINARIES_DIR);
  console.log('Files in binaries directory:', files);
} else {
  console.log(`\nDone! ${renamed} binary(ies) built and renamed.`);
}
