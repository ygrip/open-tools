import { createPrivateKey, sign } from 'node:crypto';

const OWNER = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/;
const REPOSITORY = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]+$/;
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]{0,127}$/;
const REFRESH_MARGIN_MS = 60_000;
const MAX_MAPPINGS = 256;

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function environmentName(value) {
  if (typeof value !== 'string' || !ENVIRONMENT_NAME.test(value)) throw new Error('credential environment names must use uppercase letters, numbers and underscores');
  return value;
}

function descriptor(value) {
  record(value, 'credential descriptor');
  const keys = Object.keys(value).sort();
  if (keys.join(',') === 'tokenEnv') return Object.freeze({ tokenEnv: environmentName(value.tokenEnv) });
  if (keys.join(',') !== 'appIdEnv,installationId,privateKeyEnv') throw new Error('credential descriptor must contain only tokenEnv or appIdEnv/privateKeyEnv/installationId');
  if (!Number.isSafeInteger(value.installationId) || value.installationId < 1) throw new Error('GitHub App installationId must be a positive integer');
  return Object.freeze({ appIdEnv: environmentName(value.appIdEnv), privateKeyEnv: environmentName(value.privateKeyEnv), installationId: value.installationId });
}

function mapping(value, pattern, label) {
  if (value === undefined) return new Map();
  record(value, label);
  const entries = Object.entries(value);
  if (entries.length > MAX_MAPPINGS) throw new Error(`${label} exceeds ${MAX_MAPPINGS} credential mappings`);
  const output = new Map();
  for (const [name, credential] of entries) {
    if (!pattern.test(name)) throw new Error(`invalid ${label} key`);
    const key = name.toLowerCase();
    if (output.has(key)) throw new Error(`duplicate case-insensitive ${label} key`);
    output.set(key, descriptor(credential));
  }
  return output;
}

function secret(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`missing credential environment variable: ${name}`);
  return value.trim();
}

function tokenValue(value) {
  if (typeof value !== 'string' || !value || /[\s\x00-\x1f\x7f]/.test(value)) throw new Error('invalid GitHub token value');
  return value;
}

async function tokenResponse(response) {
  if (!response.body) throw new Error('GitHub App token response is invalid');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) {
        await reader.cancel();
        throw new Error('GitHub App token response is too large');
      }
      chunks.push(value);
    }
  } catch {
    throw new Error('GitHub App token response could not be read');
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('GitHub App token response is invalid'); }
}

/**
 * Build-only credentials. Values never enter registry metadata or browser modules.
 * The cache is bounded by validated configuration descriptors (at most 512).
 */
export function createCredentialResolver(config = {}, { env = process.env, fetcher = fetch, now = Date.now } = {}) {
  const auth = config.auth === undefined ? {} : record(config.auth, 'auth');
  if (Object.keys(auth).some((key) => !['owners', 'repositories'].includes(key))) throw new Error('auth supports only owners and repositories');
  const owners = mapping(auth.owners, OWNER, 'auth.owners');
  const repositories = mapping(auth.repositories, REPOSITORY, 'auth.repositories');
  const cache = new Map();

  function fallback() {
    const token = env.TOOLS_GITHUB_TOKEN || env.GITHUB_TOKEN;
    return token ? tokenValue(typeof token === 'string' ? token.trim() : token) : undefined;
  }

  async function installationToken(credential, repositoryName) {
    const existing = cache.get(credential);
    if (existing?.pending) return existing.pending;
    if (existing && existing.expiresAt - REFRESH_MARGIN_MS > now()) return existing.token;
    const pending = (async () => {
      const appId = secret(env, credential.appIdEnv);
      if (!/^[1-9][0-9]*$/.test(appId)) throw new Error('GitHub App ID must be a positive numeric app ID');
      const privateKey = secret(env, credential.privateKeyEnv).replace(/\\n/g, '\n');
      let jwt;
      try {
        const key = createPrivateKey(privateKey);
        if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error('invalid key');
        const issuedAt = Math.floor(now() / 1000) - 60;
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ iss: appId, iat: issuedAt, exp: issuedAt + 600 })).toString('base64url');
        const unsigned = `${header}.${payload}`;
        jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
      } catch {
        throw new Error('GitHub App private key must be a valid RSA private key of at least 2048 bits');
      }
      let response;
      try {
        response = await fetcher(`https://api.github.com/app/installations/${credential.installationId}/access_tokens`, {
          method: 'POST',
          headers: { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'open-tools-registry', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ permissions: { contents: 'read' }, ...(repositoryName ? { repositories: [repositoryName] } : {}) }),
          redirect: 'error', signal: AbortSignal.timeout(30_000)
        });
      } catch { throw new Error('GitHub App token request failed'); }
      if (!response.ok) throw new Error(`GitHub App token request failed (${response.status})`);
      const result = await tokenResponse(response);
      let token;
      try { token = tokenValue(result.token); }
      catch { throw new Error('GitHub App token response is invalid'); }
      const expiresAt = typeof result.expires_at === 'string' ? Date.parse(result.expires_at) : NaN;
      if (!Number.isFinite(expiresAt) || expiresAt <= now() + REFRESH_MARGIN_MS) throw new Error('GitHub App token expiry is invalid or too close');
      // Installation tokens normally last one hour. Do not retain an unexpectedly
      // long-lived response beyond that horizon, even if its expiry says otherwise.
      cache.set(credential, { token, expiresAt: Math.min(expiresAt, now() + 3_600_000) });
      return token;
    })();
    cache.set(credential, { pending });
    try { return await pending; }
    catch (error) { cache.delete(credential); throw error; }
  }

  async function resolve(credential, repositoryName) {
    if (!credential) return fallback();
    if (credential.tokenEnv) return tokenValue(secret(env, credential.tokenEnv));
    return installationToken(credential, repositoryName);
  }

  return Object.freeze({
    async forRepository(repository) {
      if (typeof repository !== 'string' || !REPOSITORY.test(repository)) throw new Error('invalid credential repository context');
      const key = repository.toLowerCase();
      const override = repositories.get(key);
      return override ? resolve(override, key.split('/')[1]) : resolve(owners.get(key.split('/')[0]));
    },
    async forOwner(owner) {
      if (typeof owner !== 'string' || !OWNER.test(owner)) throw new Error('invalid credential owner context');
      // Repository overrides cannot authorize discovery across an entire owner.
      return resolve(owners.get(owner.toLowerCase()));
    }
  });
}
