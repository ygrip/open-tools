# Private repositories across multiple owners

Open Tools resolves GitHub credentials **during registry sync/build**, separately for every repository. Registering a repository does not expose a token to that tool or its browser bundle. Public catalog metadata still includes the repository URL, even if its source is private.


## Fixing CI failures on the trick-it production registry

The current production registry pins **four private sibling repositories**:
`ygrip/encoder-decoder`, `ygrip/id-generator`, `ygrip/json-tools`, and
`ygrip/text-manipulation`. The standard workflow `GITHUB_TOKEN` is
repository-scoped and **cannot** read them. GitHub returns HTTP 404 for
unauthorized private repository requests even when the pinned commit exists.

1. Under GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**, create a token owned by `ygrip` selecting those four repositories (or use a GitHub App installed on them). Grant **Contents: Read-only**, with no write permissions.
2. In **ygrip/trick-it → Settings → Secrets and variables → Actions**, add a **repository secret** called `TOOLS_GITHUB_TOKEN` containing that token. Do not put it in git, tool registrations, or this chat.
3. Re-run **Verify registry and bundles** from Actions. Its `Verify private tool repository access` step probes each pinned manifest and identifies missing access explicitly before installing npm dependencies.
4. If tool repos are added later, extend the token's **selected repositories**. A GitHub token selected for only the host repository will still fail, as will the default `GITHUB_TOKEN`.

The workflow no longer injects its default `GITHUB_TOKEN` as a misleading
fallback for private-source sync or build. The production credential never
reaches deployed JavaScript. Registry synchronization still fails closed if a
private source cannot be verified, rather than silently dropping tools.

## Credential precedence

1. `auth.repositories["owner/repository"]`
2. `auth.owners["owner"]`
3. `TOOLS_GITHUB_TOKEN`
4. `GITHUB_TOKEN`
5. Anonymous access for public repositories

Owner/repository matching is case-insensitive. An explicit mapping with a missing or invalid secret **fails closed**; it never falls back to a broader token. Unknown descriptor fields, literal credentials, invalid environment names, duplicate case-insensitive keys and invalid installation IDs are rejected. Each owner/repository map is limited to 256 entries.

`trustedOwners` remains the separate publication approval boundary. Credentials grant API access; they do not approve registration, bypass manifest checks or skip checksum verification.

## Separate fine-grained tokens

Create a fine-grained PAT for each resource owner, select the repositories it may read and grant **Repository permissions → Contents: read**. A single owner's PAT can read multiple selected repositories. Supply each PAT as an environment/CI secret; put only its environment variable name in registry configuration:

```json
{
  "trustedOwners": ["ygrip", "acme"],
  "discovery": false,
  "sources": [
    { "repository": "ygrip/json-tools", "ref": "<40-character commit SHA>" },
    { "repository": "acme/image-tools", "ref": "<40-character commit SHA>" },
    { "repository": "acme/special-tool", "ref": "<40-character commit SHA>" }
  ],
  "auth": {
    "owners": {
      "ygrip": { "tokenEnv": "TOOLS_YGRIP_TOKEN" },
      "acme": { "tokenEnv": "TOOLS_ACME_TOKEN" }
    },
    "repositories": {
      "acme/special-tool": { "tokenEnv": "TOOLS_SPECIAL_TOKEN" }
    }
  }
}
```

Here `ygrip/json-tools` uses `TOOLS_YGRIP_TOKEN`, ordinary Acme repositories use `TOOLS_ACME_TOKEN`, and only `acme/special-tool` uses `TOOLS_SPECIAL_TOKEN`. Tokens are selected from the actual `/repos/<owner>/<repository>/...` API endpoint, including immutable Git blob fetches, rather than from caller-provided owner hints.

A repository override controls where the loader uses a credential; it does not narrow the permissions already granted to that PAT by GitHub. Prefer a token limited to that repository when using a repository-specific override.

## GitHub App installations

For multiple owners, install a GitHub App on each owner/org with access only to its approved tool repositories. Grant the app **Contents: read**. Each installation has its own numeric installation ID; the app's numeric App ID and RSA private key can be shared between installation descriptors:

```json
{
  "auth": {
    "owners": {
      "acme": {
        "appIdEnv": "TOOLS_APP_ID",
        "privateKeyEnv": "TOOLS_APP_PRIVATE_KEY",
        "installationId": 123456
      },
      "another-owner": {
        "appIdEnv": "TOOLS_APP_ID",
        "privateKeyEnv": "TOOLS_APP_PRIVATE_KEY",
        "installationId": 789012
      }
    }
  }
}
```

Set `TOOLS_APP_ID` to the numeric App ID, not its OAuth client secret. Set `TOOLS_APP_PRIVATE_KEY` to its PEM RSA private key (at least 2048 bits). Real newlines and escaped `\n` sequences are supported. Never commit the key or an installation access token. An App descriptor can also be used for a repository override.

The build signs an RS256 JWT with 60 seconds of clock-skew allowance and at most ten minutes between `iat` and `exp`, then exchanges it at `POST /app/installations/<id>/access_tokens`. The exchange requests only `contents: read`. A repository-level App override also sends `repositories: ["repository-name"]`, so GitHub narrows that installation token to the mapped repository; owner-level descriptors can read the repositories selected for that installation. GitHub still enforces the repositories selected for that installation; an installation on one owner cannot read another owner's private repositories.

Installation tokens are kept only in memory, shared by concurrent requests using the same descriptor, refreshed 60 seconds before expiry, and never retained beyond one hour. Failed exchanges are not cached, so retrying the sync can recover. The build does not retry with a different/broader credential after a denial. Requests have a 30-second timeout and refuse redirects; response bodies and private-key parsing details are omitted from authentication errors.

This supports GitHub.com App installations. GitHub Enterprise Server base URLs, OAuth flows, interactive login and automatic installation-ID discovery are not implemented.

## Discovery credentials

With `discovery: true`, each trusted owner's repository search uses that owner's credential (or the existing global fallback). Repository-only overrides are not used to search an entire owner's repositories. If a private owner needs discovery, configure its owner credential; otherwise use explicit pinned `sources` with repository-specific credentials.

Discovered repository commit/content requests resolve credentials again by their actual repository identity, so a per-repository override still wins. Searches are restricted to their credential's `user:<owner>` query and results outside that owner or incomplete search responses fail the sync. Explicit sources remain the recommended production approval mechanism.

## CI and local use

Add the required secrets to the Open Tools build repository and explicitly expose the corresponding environment variables to **both registry-sync and build steps**. A secret existing in GitHub Actions does not automatically become a process environment variable.

```yaml
- name: Build registered tools
  env:
    TOOLS_YGRIP_TOKEN: ${{ secrets.TOOLS_YGRIP_TOKEN }}
    TOOLS_ACME_TOKEN: ${{ secrets.TOOLS_ACME_TOKEN }}
    TOOLS_SPECIAL_TOKEN: ${{ secrets.TOOLS_SPECIAL_TOKEN }}
    TOOLS_APP_ID: ${{ secrets.TOOLS_APP_ID }}
    TOOLS_APP_PRIVATE_KEY: ${{ secrets.TOOLS_APP_PRIVATE_KEY }}
  run: npm run build
```

Keep only the variables your registry uses. The old `TOOLS_GITHUB_TOKEN`/`GITHUB_TOKEN` setup remains sufficient when one token legitimately covers every source. Default `GITHUB_TOKEN` normally cannot read other private repositories. Fork pull requests do not receive repository secrets; do not expose these credentials through `pull_request_target` running untrusted code.

For local builds, inject secrets with your secret manager. Registry sync does not load `.env` files itself. An alternate configuration can be selected with `TOOLS_REGISTRY_CONFIG=config/registry.auth.example.json`; replace that file's placeholder owners, source refs and installation IDs before use. The default local scaffold remains credential-free.

Credential configuration is read only by Node scripts. Generated catalog JSON contains only validated tool manifest fields; credentials, App IDs, installation IDs, environment-variable mappings and private keys are not added to browser data or bundles. Distributed browser bundles themselves are public and must never contain secrets.
