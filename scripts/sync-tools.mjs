import { readFile, writeFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../config/registry.json', import.meta.url), 'utf8'));
const outputUrl = new URL('../src/lib/registry/generated.json', import.meta.url);
const token = process.env.GITHUB_TOKEN;

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'open-tools-registry'
};

if (token) headers.Authorization = `Bearer ${token}`;

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}: ${path}`);
  }
  return response.json();
}

function validateManifest(manifest, repository, seenIds, seenPaths) {
  const allowedCategories = new Set(['media', 'developer', 'data', 'productivity', 'other']);
  const allowedStatuses = new Set(['stable', 'beta', 'experimental']);

  if (!manifest || typeof manifest !== 'object') throw new Error('manifest must be an object');
  if (!/^[a-z0-9-]+$/.test(manifest.id ?? '')) throw new Error('invalid id');
  if (manifest.path !== `/${manifest.id}`) throw new Error('path must exactly match /<id>');
  if (!manifest.name || typeof manifest.name !== 'string') throw new Error('name is required');
  if (!manifest.description || typeof manifest.description !== 'string') throw new Error('description is required');
  if (!allowedCategories.has(manifest.category)) throw new Error('invalid category');
  if (manifest.status && !allowedStatuses.has(manifest.status)) throw new Error('invalid status');

  const expectedRepository = `https://github.com/${repository.full_name}`;
  if ((manifest.repository ?? '').replace(/\/$/, '') !== expectedRepository) {
    throw new Error(`repository must be ${expectedRepository}`);
  }

  if (!config.trustedOwners.includes(repository.owner.login)) throw new Error('repository owner is not trusted');
  if (seenIds.has(manifest.id)) throw new Error(`duplicate id: ${manifest.id}`);
  if (seenPaths.has(manifest.path)) throw new Error(`duplicate path: ${manifest.path}`);

  seenIds.add(manifest.id);
  seenPaths.add(manifest.path);

  return {
    id: manifest.id,
    name: manifest.name.trim().slice(0, 80),
    description: manifest.description.trim().slice(0, 240),
    path: manifest.path,
    category: manifest.category,
    repository: expectedRepository,
    ...(typeof manifest.icon === 'string' ? { icon: manifest.icon.slice(0, 160) } : {}),
    ...(Array.isArray(manifest.capabilities)
      ? { capabilities: manifest.capabilities.filter((item) => typeof item === 'string').slice(0, 20) }
      : {}),
    ...(manifest.status ? { status: manifest.status } : {})
  };
}

async function discoverRepositories() {
  const repositories = [];

  for (const owner of config.trustedOwners) {
    const q = encodeURIComponent(`user:${owner} topic:${config.topic} fork:false archived:false`);
    const result = await github(`/search/repositories?q=${q}&per_page=100`);
    repositories.push(...result.items);
  }

  return repositories;
}

async function loadManifest(repository) {
  const path = encodeURIComponent(config.manifestPath);
  const file = await github(`/repos/${repository.full_name}/contents/${path}`);

  if (file.type !== 'file' || file.encoding !== 'base64') {
    throw new Error('manifest is not a regular base64 GitHub content file');
  }

  return JSON.parse(Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8'));
}

const repositories = await discoverRepositories();
const seenIds = new Set();
const seenPaths = new Set();
const tools = [];

for (const repository of repositories) {
  try {
    const manifest = await loadManifest(repository);
    tools.push(validateManifest(manifest, repository, seenIds, seenPaths));
    console.log(`✓ ${repository.full_name}`);
  } catch (error) {
    console.warn(`- skipped ${repository.full_name}: ${error.message}`);
  }
}

tools.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(outputUrl, `${JSON.stringify(tools, null, 2)}\n`);
console.log(`Registered ${tools.length} tool(s).`);
