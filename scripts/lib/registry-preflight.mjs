/**
 * The production registry contains private tool repositories. GitHub's standard
 * GITHUB_TOKEN is limited to this workflow's repository and cannot read them.
 */
export function requireRegistryToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Missing TOOLS_GITHUB_TOKEN. Add a read-only fine-grained PAT as a GitHub Actions repository secret in ygrip/trick-it, with Contents: read access to ygrip/encoder-decoder, ygrip/id-generator, ygrip/json-tools, and ygrip/text-manipulation. The default GITHUB_TOKEN cannot read other private repositories. See docs/registry-auth.md.');
  }
}

export async function verifySourceAccess(registrations, github) {
  const failures = [];
  let verified = 0;
  for (const { source } of registrations) {
    if (source.local) continue;
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
      const detail = /GitHub 404/.test(String(error)) ? 'GitHub returned 404 (often missing private repository permission)' : 'GitHub request failed';
      failures.push(`${source.repository}@${source.ref}: ${detail}`);
    }
  }
  if (failures.length) {
    throw new Error(`Private tool registry access check failed for ${failures.length} source(s): ${failures.join('; ')}. Verify the TOOLS_GITHUB_TOKEN secret has Contents: read access to every registered private repository. Do not replace missing credentials with the default GITHUB_TOKEN.`);
  }
  return verified;
}
