import { mapBounded } from './concurrency.mjs';
export async function verifySourceAccess(registrations, github) {
  const failures = [];
  let verified = 0;
  await mapBounded(registrations.filter(({ source }) => !source.local), 4, async ({ source }) => {
    const path = `/repos/${source.repository}/contents/tool.manifest.json?ref=${source.ref}`;
    try {
      const result = await github(path);
      if (result?.type !== 'file' || typeof result.content !== 'string') {
        throw new Error('invalid manifest file response');
      }
      verified++;
    } catch (error) {
      // A 404 from GitHub deliberately hides whether a private repository exists.
      // Do not assume the pinned commit or source file is wrong.
      const detail = /GitHub 404/.test(String(error))
        ? 'GitHub returned 404 (private repository inaccessible, wrong ref, or missing file)'
        : /missing credential environment variable: ([A-Z0-9_]+)/.test(String(error))
          ? 'Missing configured credential: ' + String(error).match(/missing credential environment variable: ([A-Z0-9_]+)/)[1]
          : 'GitHub request failed or credential could not be resolved';
      failures.push(`${source.repository}@${source.ref}: ${detail}`);
    }
  });
  if (failures.length) {
    throw new Error(`Private tool registry access check failed for ${failures.length} source(s): ${failures.join('; ')}. Check auth.repositories / auth.owners credentials or TOOLS_GITHUB_TOKEN fallback; public repositories need no token. Grant approved owners read-only access. The default Actions GITHUB_TOKEN cannot read sibling private repositories.`);
  }
  return verified;
}
