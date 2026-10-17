import { readFile, writeFile, mkdir, rm, rename, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createGithubClient, loadSource } from './lib/bundles.mjs';
import { createCredentialResolver } from './lib/credentials.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = process.env.TOOLS_REGISTRY_CONFIG || 'config/registry.json';
const config = JSON.parse(await readFile(resolve(root, configPath), 'utf8'));
const github = createGithubClient(createCredentialResolver(config));
const sources = [...(config.sources ?? [])];

// Explicit sources are authoritative and work for private repositories.
if (config.discovery) {
  for (const owner of config.trustedOwners) {
    for (let page = 1; ; page++) {
      const q = encodeURIComponent(`user:${owner} topic:${config.topic} fork:false archived:false`);
      const result = await github(`/search/repositories?q=${q}&per_page=100&page=${page}`, { owner });
      if (result.incomplete_results || !Array.isArray(result.items) || !Number.isSafeInteger(result.total_count) || result.total_count < 0) throw new Error('GitHub discovery returned incomplete or invalid results');
      for (const repo of result.items) {
        if (typeof repo.full_name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]+$/.test(repo.full_name) || repo.full_name.split('/')[0].toLowerCase() !== owner.toLowerCase()) throw new Error('GitHub discovery returned a repository outside its owner scope');
        if (sources.some((source) => source.repository.toLowerCase() === repo.full_name.toLowerCase())) continue;
        const commit = await github(`/repos/${repo.full_name}/commits/${encodeURIComponent(repo.default_branch)}`);
        sources.push({ repository: repo.full_name, ref: commit.sha });
      }
      if (page * 100 >= result.total_count) break;
      if (page === 10) throw new Error('GitHub discovery search exceeds 1000 results; use explicit sources');
    }
  }
}

const loaded = [];
const ids = new Set();
for (const source of sources) {
  // Fail closed: never silently publish a partial registry on a source failure.
  const tool = await loadSource(source, config, root, github);
  if (ids.has(tool.manifest.id)) throw new Error(`duplicate tool id/path: ${tool.manifest.id}`);
  ids.add(tool.manifest.id);
  loaded.push(tool);
}
loaded.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
await mkdir(resolve(root, 'static'), { recursive: true });
const stage = await mkdtemp(resolve(root, 'static/.bundles-'));
try {
  for (const { manifest, html } of loaded) {
    await mkdir(resolve(stage, manifest.id));
    await writeFile(resolve(stage, manifest.id, `${manifest.bundle.sha256}.json`), JSON.stringify({ id: manifest.id, version: manifest.version, sha256: manifest.bundle.sha256, html }).replaceAll('<', '\\u003c'));
  }
  await rm(resolve(root, 'static/bundles'), { recursive: true, force: true });
  await rename(stage, resolve(root, 'static/bundles'));
  await writeFile(resolve(root, 'src/lib/registry/generated.json'), `${JSON.stringify(loaded.map(({ manifest }) => manifest), null, 2)}\n`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
console.log(`Registered and verified ${loaded.length} bundle(s).`);
