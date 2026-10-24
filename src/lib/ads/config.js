/** @typedef {{enabled:boolean,client:string,testMode:boolean,placements:{home:string,tool:string},frameOrigins:string[]}} AdsConfig */

/** @param {unknown} value @param {string} label */
function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @param {boolean} fallback @param {string} label */
function booleanOption(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

/** @param {unknown} value @param {RegExp} pattern @param {string} label */
function identifier(value, pattern, label) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || (value !== '' && !pattern.test(value))) throw new Error(`Invalid ${label}`);
  return value;
}

/** @param {unknown} value @returns {string[]} */
function frameOrigins(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 16) throw new Error('ads.frameOrigins must contain at most 16 HTTPS origins');
  for (const origin of value) {
    // Only an exact HTTPS DNS origin or a scoped subdomain wildcard: no ports,
    // paths, credentials, CSP directives, or unrestricted scheme wildcards.
    if (typeof origin !== 'string' || origin.length > 200 || !/^https:\/\/(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(origin)) {
      throw new Error('ads.frameOrigins entries must be HTTPS DNS origins without paths or credentials');
    }
  }
  return [...new Set(/** @type {string[]} */ (value))];
}

/** Enabling ads must be an explicit, complete deployment choice.
 * @param {unknown} input
 * @returns {AdsConfig}
 */
export function validateAdsConfig(input) {
  const value = record(input, 'ads');
  const placements = record(value.placements ?? {}, 'ads.placements');
  const config = {
    enabled: booleanOption(value.enabled, false, 'ads.enabled'),
    client: identifier(value.client, /^ca-pub-\d{16}$/, 'ads.client'),
    testMode: booleanOption(value.testMode, true, 'ads.testMode'),
    placements: {
      home: identifier(placements.home, /^\d{1,20}$/, 'ads.placements.home'),
      tool: identifier(placements.tool, /^\d{1,20}$/, 'ads.placements.tool')
    },
    frameOrigins: frameOrigins(value.frameOrigins)
  };
  if (!config.enabled) return config;
  if (!config.client) throw new Error('Enabled ads require ads.client');
  if (!config.placements.home && !config.placements.tool) throw new Error('Enabled ads require at least one placement slot');
  if (!config.frameOrigins.length) throw new Error('Enabled ads require an explicit ads.frameOrigins allowlist');
  return config;
}

/** Ad origins are allowed in the host only, never in the tool sandbox.
 * @param {AdsConfig} config
 */
export function hostFramePolicy(config) {
  const origins = ['about:', 'https://challenges.cloudflare.com'];
  if (config.enabled) origins.push(...config.frameOrigins);
  return `frame-src ${origins.join(' ')}`;
}
