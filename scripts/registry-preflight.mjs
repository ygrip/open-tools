import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createGithubClient } from './lib/bundles.mjs';
import { createCredentialResolver } from './lib/credentials.mjs';
import { readToolRegistrations } from './lib/registrations.mjs';
import { verifySourceAccess } from './lib/registry-preflight.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(resolve(root, 'config/registry.json'), 'utf8'));
try {
  // Resolve each repository through the same owner/repository credential policy as registry sync.
  // Public repositories work anonymously; private ones require their own authorization.
  const sources = await readToolRegistrations(config, root);
  const count = await verifySourceAccess(sources, createGithubClient(createCredentialResolver(config)));
  console.log(`Authenticated access verified for ${count} tool source(s).`);
} catch (error) {
  const escaped = String(error instanceof Error ? error.message : error)
    .replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.error(`::error title=Private tool registry access::${escaped}`);
  process.exitCode = 1;
}
