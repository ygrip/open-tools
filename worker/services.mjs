import { handleAudit, validateTarget, readJson, json, AuditFailure } from './seo-audit.mjs';
import { handleTrackerAudit } from './tracker-audit.mjs';
const route = /^\/api\/tools\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(config))?$/;
function policyFor(request, policies) {
  const match = new URL(request.url).pathname.match(route);
  return match && policies[`${match[1]}/${match[2]}`];
}
export function serviceConfig(request, env, policies) {
  const url = new URL(request.url); const policy = policyFor(request, policies);
  if (!policy) return json({error:'unknown-feature'},404);
  if (request.method !== 'GET') return json({error:'method'},405);
  if (url.searchParams.get('version') !== policy.version || url.searchParams.get('sha256') !== policy.sha256) return json({error:'stale-release'},409);
  if (policy.turnstile && (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET || !env.TURNSTILE_HOSTNAMES)) return json({error:'unavailable'},503);
  return json({sitekey:policy.turnstile ? env.TURNSTILE_SITE_KEY : null,action:policy.action,turnstile:policy.turnstile,rateLimit:policy.rateLimit});
}
async function verifyTurnstile(token, request, env, policy, fetcher) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const allowed = new Set((env.TURNSTILE_HOSTNAMES ?? '').split(',').map(x=>x.trim()).filter(Boolean));
  if (!allowed.size) return false;
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      // Workers' fetch throws on redirect:'error'; 'manual' surfaces a 3xx as !ok instead.
      method:'POST',redirect:'manual',signal:AbortSignal.timeout(10_000),headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token,remoteip:request.headers.get('cf-connecting-ip')})
    });
    if (!response.ok) { await response.body?.cancel();return false; }
    const result = await readJson(response,16*1024);
    return result.success === true && result.action === policy.action && allowed.has(result.hostname);
  } catch { return false; }
}
export async function handleService(request, env, policies, fetcher = fetch) {
  if (request.method !== 'POST') return json({error:'method'},405);
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({error:'origin'},403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return json({error:'content-type'},415);
  const policy = policyFor(request,policies);
  if (!policy) return json({error:'unknown-feature'},404);
  try {
    const body = await readJson(request,8*1024);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key=>!['version','sha256','input','turnstileToken'].includes(key))) return json({error:'invalid-request'},400);
    if (body.version !== policy.version || body.sha256 !== policy.sha256) return json({error:'stale-release'},409);
    // Input is handler-specific, and validation happens before any network call.
    if (!['pagespeed-seo','tracker-audit'].includes(policy.handler) || !body.input || typeof body.input !== 'object' || Array.isArray(body.input) || Object.keys(body.input).some(key=>!['url','strategy','locale'].includes(key)) || !['mobile','desktop'].includes(body.input.strategy) || !['en','id'].includes(body.input.locale)) return json({error:'invalid-request'},400);
    validateTarget(body.input.url);
    const ip = request.headers.get('cf-connecting-ip');
    if (!ip || !env.SERVICE_ATTEMPT_LIMITER || !env[policy.binding] || (policy.turnstile && (!env.TURNSTILE_SECRET || !env.TURNSTILE_HOSTNAMES))) return json({error:'unavailable'},503);
    if (!(await env.SERVICE_ATTEMPT_LIMITER.limit({key:`services:${ip}`})).success) return json({error:'rate-limit'},429);
    if (policy.turnstile && !(await verifyTurnstile(body.turnstileToken,request,env,policy,fetcher))) return json({error:'verification'},403);
    const key = `${policy.toolId}/${policy.feature}:${ip}`;
    if (!(await env[policy.binding].limit({key})).success) return json({error:'rate-limit'},429);
    if (policy.handler === 'tracker-audit') return handleTrackerAudit(body.input,env,fetcher);
    return handleAudit(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body.input)}),env,fetcher);
  } catch (error) {
    return json({error:error instanceof AuditFailure ? error.message : 'unavailable'},error instanceof AuditFailure ? error.status : 503);
  }
}
