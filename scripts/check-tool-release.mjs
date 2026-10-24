import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { parseArgs, promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { languageCodes } from '../src/lib/languages.js';
import { validateManifest } from '../src/lib/registry/contract.js';
import { readToolArtifact } from '../tests/tool-harness/index.mjs';
import { MAX_TOOL_ENTRY_GZIP } from './lib/performance-budgets.mjs';

const execute = promisify(execFile);
const sortedKeys = value => Object.keys(value).sort().join('\n');
const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join('\n');

async function readJson(root, name) {
  const file = await realpath(resolve(root, name));
  const location = relative(root, file);
  if (location === '..' || location.startsWith('..' + sep) || isAbsolute(location)) throw new Error('Source file escapes tool root: ' + name);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readFile(file)));
}

async function readCatalog(root, locale) {
  const catalog = await readJson(root, 'messages/' + locale + '.json');
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Invalid authored catalog: ' + locale);
  delete catalog.$schema; // Optional inlang editor metadata is not a message.
  return catalog;
}

function checkLocaleSet(actual, label) {
  if (!Array.isArray(actual) || JSON.stringify([...actual].sort()) !== JSON.stringify([...languageCodes].sort())) {
    throw new Error(label + ' must match the current host languageCodes; do not advertise unfinished locales');
  }
}

function checkCatalog(catalog, english, locale) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog) || !Object.keys(catalog).length || sortedKeys(catalog) !== sortedKeys(english)) {
    throw new Error('Missing/extra authored message keys: ' + locale);
  }
  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Blank authored message: ' + locale + '.' + key);
    if (placeholders(value) !== placeholders(english[key])) throw new Error('Placeholder mismatch: ' + locale + '.' + key);
  }
}

/**
 * The host falls back to the canonical English guide if locale metadata omits it.
 * Check future releases here, not legacy registry ingestion, so pinned tools
 * remain usable while their owning repositories migrate.
 */
function checkGuideTranslations(manifest) {
  const english = manifest.guide;
  for (const locale of languageCodes.filter(code => code !== 'en')) {
    const guide = manifest.translations?.[locale]?.guide;
    if (!guide) throw new Error('Missing native guide: ' + locale);
    if (guide.steps.length !== english.steps.length) {
      throw new Error('Native guide step count mismatch: ' + locale + ' (' + guide.steps.length + ' versus ' + english.steps.length + ')');
    }
    if (guide.summary.trim() === english.summary.trim()) {
      throw new Error('Untranslated native guide summary: ' + locale);
    }
    guide.steps.forEach((step, index) => {
      const englishStep = english.steps[index];
      // A terse identifier/example may legitimately remain unchanged (e.g. an
      // input format). Reject copied English instructional sentences instead.
      const hasNaturalLanguage = (englishStep.match(/[A-Za-z]{2,}/g) ?? []).length >= 3;
      if (hasNaturalLanguage && step.trim() === englishStep.trim()) {
        throw new Error('Untranslated native guide step: ' + locale + ' #' + (index + 1));
      }
    });
  }
}

function checkStableVersionAdvance(current, previous) {
  if (!/^\d+\.\d+\.\d+$/.test(current) || !/^\d+\.\d+\.\d+$/.test(previous)) {
    throw new Error('Baseline comparison requires stable x.y.z versions; review prerelease ordering explicitly');
  }
  const next = current.split('.').map(Number);
  const old = previous.split('.').map(Number);
  for (let index = 0; index < next.length; index++) {
    if (next[index] > old[index]) return;
    if (next[index] < old[index]) break;
  }
  throw new Error('Release version must advance beyond baseline ' + previous);
}

async function checkToolchain(root, manifest) {
  const pkg = await readJson(root, 'package.json');
  const lock = await readJson(root, 'package-lock.json');
  const compiler = pkg.devDependencies?.['@inlang/paraglide-js'] ?? pkg.dependencies?.['@inlang/paraglide-js'];
  if (!/^\d+\.\d+\.\d+$/.test(compiler ?? '') || lock.packages?.['node_modules/@inlang/paraglide-js']?.version !== compiler) {
    throw new Error('Pin the Paraglide compiler exactly and commit its matching dependency lockfile');
  }
  if (pkg.version !== manifest.version || lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('Package, lockfile and manifest release versions must match');
  }
  const settings = await readJson(root, 'project.inlang/settings.json');
  checkLocaleSet(settings.locales, 'Paraglide locales');
  if (!settings.modules?.some(module => /@inlang\/plugin-message-format@\d+\.\d+\.\d+\//.test(module))) {
    throw new Error('Pin the message-format plugin to an exact version in project.inlang/settings.json');
  }
}

/** Structural release gate, not a translation-quality or browser-behavior certification. */
export async function checkToolRelease(toolRoot, { baseline } = {}) {
  const root = await realpath(toolRoot);
  const manifest = validateManifest(await readJson(root, 'tool.manifest.json'));
  checkLocaleSet(manifest.locales, 'Manifest locales');
  checkGuideTranslations(manifest);
  // Registry output removes artwork and adds its registration timestamp.
  // Final registry performance checks remain authoritative for the actual entry.
  const { artwork, ...entry } = manifest;
  entry.addedAt = new Date().toISOString();
  if (gzipSync(JSON.stringify(entry)).length > MAX_TOOL_ENTRY_GZIP) throw new Error('Catalog metadata exceeds the fixed per-tool gzip budget; keep full native help in locale packs');
  await checkToolchain(root, manifest);
  const english = await readCatalog(root, 'en');
  const catalogs = new Map();
  for (const locale of languageCodes) {
    const catalog = await readCatalog(root, locale);
    checkCatalog(catalog, english, locale);
    catalogs.set(locale, catalog);
    if (locale === 'en') continue;
    const metadata = manifest.translations?.[locale];
    if (!metadata?.name?.trim() || !metadata.description?.trim()) throw new Error('Missing native metadata: ' + locale);
    for (const permission of manifest.permissions ?? []) {
      if (!metadata.permissionReasons?.[permission.name]?.trim()) throw new Error('Missing native consent reason: ' + locale + '.' + permission.name);
    }
    if (!manifest.localePacks?.[locale]?.file) throw new Error('Publish a separate repository-file locale pack: ' + locale);
  }
  // Uses the same UTF-8, flat-string, path, byte-length and SHA-256 checks as real host tests.
  await readToolArtifact(root);
  for (const locale of languageCodes.filter(locale => locale !== 'en')) {
    const published = await readJson(root, manifest.localePacks[locale].file);
    checkCatalog(published, english, 'published ' + locale);
    const authored = catalogs.get(locale);
    if (Object.keys(authored).some(key => published[key] !== authored[key])) throw new Error('Published pack differs from authored copy: ' + locale);
  }
  if (baseline) {
    const { stdout } = await execute('git', ['-C', root, 'rev-parse', '--verify', '--end-of-options', baseline + '^{commit}']);
    const commit = stdout.trim();
    const previous = await execute('git', ['-C', root, 'show', commit + ':tool.manifest.json']);
    checkStableVersionAdvance(manifest.version, JSON.parse(previous.stdout).version);
  }
  return { id: manifest.id, version: manifest.version, locales: languageCodes.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { 'tool-root': { type: 'string' }, baseline: { type: 'string' } } });
    if (!values['tool-root']) throw new Error('Usage: node scripts/check-tool-release.mjs --tool-root /path/to/tool [--baseline origin/main]');
    const result = await checkToolRelease(values['tool-root'], { baseline: values.baseline });
    console.log(`Structural release gate passed: ${result.id} v${result.version}, ${result.locales} host locales. Run tool-owned browser tests and review visible/accessibility copy separately.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
