import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readToolRegistrations } from './lib/registrations.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const MARKER = 'scripts/.verified-registry.json';
const OUTPUTS = ['src/lib/registry/generated.json', 'static/bundles', 'static/icons/tools', 'scripts/.generated-tool-cards'];

/** Fingerprint all inputs that determine the pinned registry, not timestamps. */
export async function registryInputFingerprint(directory, configPath = 'config/registry.json') {
  const configBytes = await readFile(resolve(directory, configPath));
  const config = JSON.parse(configBytes.toString('utf8'));
  // Reuse sync's registration validation, including alternate legacy sources.
  const registrations = await readToolRegistrations(config, directory);
  const entries = config.toolDirectory === undefined ? [] : await Promise.all(registrations.map(async ({ id }) =>
    [id, digest(await readFile(resolve(directory, config.toolDirectory, `${id}.json`)))]));
  return digest(JSON.stringify({ configPath, config: digest(configBytes), entries }));
}

/** Include paths and empty directories so additions/removals also invalidate verification. */
async function generatedOutputs(directory) {
  const entries = [];
  async function visit(path) {
    const info = await lstat(resolve(directory, path));
    if (info.isDirectory()) {
      entries.push([path, 'directory']);
      for (const name of (await readdir(resolve(directory, path))).sort()) await visit(`${path}/${name}`);
    } else if (info.isFile()) {
      entries.push([path, digest(await readFile(resolve(directory, path)))]);
    } else throw new Error(`Unsupported registry output path: ${path}`);
  }
  for (const path of OUTPUTS) await visit(path);
  return entries;
}

export async function writeRegistrySnapshot(directory = root, configPath = 'config/registry.json') {
  const fingerprint = await registryInputFingerprint(directory, configPath);
  const outputs = await generatedOutputs(directory);
  const snapshot = { schema: 2, fingerprint, outputs };
  await writeFile(resolve(directory, MARKER), JSON.stringify(snapshot) + '\n');
  return snapshot;
}

export async function verifyRegistrySnapshot(directory = root, configPath = 'config/registry.json') {
  let snapshot;
  try { snapshot = JSON.parse(await readFile(resolve(directory, MARKER), 'utf8')); }
  catch { throw new Error('Verified registry snapshot is missing; run npm run registry:sync first'); }
  const fingerprint = await registryInputFingerprint(directory, configPath);
  let outputs;
  try { outputs = await generatedOutputs(directory); }
  catch { throw new Error('Generated registry outputs changed after verification; rerun registry:sync'); }
  if (snapshot.schema !== 2 || snapshot.fingerprint !== fingerprint || JSON.stringify(snapshot.outputs) !== JSON.stringify(outputs)) {
    throw new Error('Registry inputs or generated outputs changed after verification; rerun registry:sync');
  }
  return snapshot;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyRegistrySnapshot(root, process.env.TOOLS_REGISTRY_CONFIG || 'config/registry.json')
    .then(() => console.log('Using previously verified immutable registry snapshot.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
