import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const MARKER = 'scripts/.verified-registry.json';
const CATALOG = 'src/lib/registry/generated.json';

/** Fingerprint all inputs that determine the pinned registry, not timestamps. */
export async function registryInputFingerprint(directory, configPath = 'config/registry.json') {
  const configBytes = await readFile(resolve(directory, configPath));
  const config = JSON.parse(configBytes.toString('utf8'));
  if (typeof config.toolDirectory !== 'string' || !/^config\/[a-z0-9/-]+$/.test(config.toolDirectory)) {
    throw new Error('Snapshot requires a validated per-tool registry');
  }
  const dir = resolve(directory, config.toolDirectory);
  const files = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
  const entries = await Promise.all(files.map(async name => [name, digest(await readFile(join(dir, name)))]));
  return digest(JSON.stringify({ configPath, config: digest(configBytes), entries }));
}

export async function writeRegistrySnapshot(directory = root, configPath = 'config/registry.json') {
  const fingerprint = await registryInputFingerprint(directory, configPath);
  const catalog = await readFile(resolve(directory, CATALOG));
  const snapshot = { schema: 1, fingerprint, catalog: digest(catalog) };
  await writeFile(resolve(directory, MARKER), JSON.stringify(snapshot) + '\n');
  return snapshot;
}

export async function verifyRegistrySnapshot(directory = root, configPath = 'config/registry.json') {
  let snapshot;
  try { snapshot = JSON.parse(await readFile(resolve(directory, MARKER), 'utf8')); }
  catch { throw new Error('Verified registry snapshot is missing; run npm run registry:sync first'); }
  const fingerprint = await registryInputFingerprint(directory, configPath);
  const catalog = digest(await readFile(resolve(directory, CATALOG)));
  if (snapshot.schema !== 1 || snapshot.fingerprint !== fingerprint || snapshot.catalog !== catalog) {
    throw new Error('Registry inputs or generated catalog changed after verification; rerun registry:sync');
  }
  return snapshot;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyRegistrySnapshot(root, process.env.TOOLS_REGISTRY_CONFIG || 'config/registry.json')
    .then(() => console.log('Using previously verified immutable registry snapshot.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
