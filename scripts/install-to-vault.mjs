#!/usr/bin/env node
/**
 * Install the built plugin into an Obsidian vault's plugin folder and VERIFY
 * the copy landed byte-for-byte (md5). Guards against silent build/install
 * drift — e.g. a Google Drive shared-drive resync reverting a copied file,
 * which once left a stale pre-feature bundle running while source looked fine.
 *
 * Usage:
 *   node scripts/install-to-vault.mjs                 # uses default vault below
 *   CLAUDIAN_VAULT_PLUGIN_DIR="/path/to/vault/.obsidian/plugins/realclaudian" \
 *     node scripts/install-to-vault.mjs               # override target
 *
 * Exits non-zero (loud) on any mismatch or missing artifact.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_DEST =
  '/Users/ayo/Library/CloudStorage/GoogleDrive-ayothomas@trajectoryvisual.com/Shared drives/Trajectory/.obsidian/plugins/realclaudian';

const dest = process.env.CLAUDIAN_VAULT_PLUGIN_DIR || DEFAULT_DEST;
const ARTIFACTS = ['main.js', 'manifest.json', 'styles.css'];

const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');

function fail(msg) {
  console.error(`\n❌ install-to-vault: ${msg}`);
  process.exit(1);
}

if (!existsSync(dest)) fail(`target plugin folder not found:\n   ${dest}`);

// Pre-flight: every artifact must exist in the build output.
for (const f of ARTIFACTS) {
  const src = join(repoRoot, f);
  if (!existsSync(src)) fail(`build artifact missing: ${f} — run "npm run build" first`);
}

console.log(`Installing → ${dest}\n`);
let ok = true;
for (const f of ARTIFACTS) {
  const src = join(repoRoot, f);
  const dst = join(dest, f);
  copyFileSync(src, dst);
  const sh = md5(src);
  const dh = md5(dst);
  if (sh === dh) {
    console.log(`✅ ${f}  ${dh}`);
  } else {
    console.log(`❌ ${f}  built=${sh} installed=${dh}`);
    ok = false;
  }
}

if (!ok) fail('installed bytes do not match build — copy was reverted (Drive sync?) or blocked.');

const version = JSON.parse(readFileSync(join(dest, 'manifest.json'), 'utf8')).version;
const featureHits = (readFileSync(join(dest, 'main.js'), 'utf8').match(/getWorkingFolder/g) || []).length;
console.log(`\n✅ Installed v${version} · working-folder feature present (${featureHits} refs)`);
console.log('   Reload Obsidian (Cmd+P → "Reload app without saving") to load it.');
