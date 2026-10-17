import { readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const repoPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]+$/;
const shaPattern = /^[a-f0-9]{40}$/;

/**
 * Load independent, explicitly reviewed tool registrations.
 * The global config owns trust policy and authentication, not each tool's entry.
 * Legacy `sources` remains supported for alternate registry configurations.
 */
export async function readToolRegistrations(config, root) {
  if (config.toolDirectory === undefined) {
    if (!Array.isArray(config.sources)) throw new Error('registry requires toolDirectory or sources');
    return config.sources.map((source) => ({ id: null, source }));
  }
  if (Object.hasOwn(config, 'sources')) throw new Error('toolDirectory and sources must not be combined');
  if (typeof config.toolDirectory !== 'string' || !/^config\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(config.toolDirectory)) {
    throw new Error('toolDirectory must be a safe path beneath config/');
  }
  const rootPath = await realpath(root);
  const dir = await realpath(resolve(rootPath, config.toolDirectory));
  if (!dir.startsWith(rootPath + sep)) throw new Error('tool directory escapes repository');
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  if (files.length === 0 || files.length > 256) throw new Error('tool directory must contain 1 to 256 JSON registrations');
  const seenRepositories = new Set();
  const registrations = [];
  for (const file of files) {
    const id = file.name.slice(0, -5);
    if (!idPattern.test(id) || id.length > 64 || !file.isFile()) throw new Error('invalid tool registration filename');
    const bytes = await readFile(resolve(dir, file.name));
    if (bytes.length > 8192) throw new Error('tool registration exceeds 8 KiB');
    let source;
    try { source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new Error(`invalid tool registration JSON: ${file.name}`); }
    if (!source || typeof source !== 'object' || Array.isArray(source) ||
        Object.keys(source).some((key) => !['repository', 'ref', 'local'].includes(key)) ||
        typeof source.repository !== 'string' || !repoPattern.test(source.repository) ||
        (Object.hasOwn(source, 'ref') === Object.hasOwn(source, 'local'))) {
      throw new Error(`invalid tool registration: ${file.name}`);
    }
    if (source.ref !== undefined && !shaPattern.test(source.ref)) throw new Error(`invalid pinned commit SHA: ${file.name}`);
    if (source.local !== undefined && (typeof source.local !== 'string' || !source.local.startsWith('examples/'))) {
      throw new Error(`invalid local development source: ${file.name}`);
    }
    const key = source.repository.toLowerCase();
    if (seenRepositories.has(key)) throw new Error(`duplicate tool repository: ${source.repository}`);
    seenRepositories.add(key);
    registrations.push({ id, source });
  }
  return registrations;
}
