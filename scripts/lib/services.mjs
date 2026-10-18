import { createHash } from 'node:crypto';
export function compileServices(manifests) {
  const policies = {}; const bindings = [];
  for (const tool of [...manifests].sort((a,b) => a.id.localeCompare(b.id))) {
    for (const feature of [...(tool.services ?? [])].sort((a,b) => a.id.localeCompare(b.id))) {
      const key = `${tool.id}/${feature.id}`;
      const hash = createHash('sha256').update(`trick-it/service/${key}`).digest('hex');
      const binding = `SERVICE_${hash.slice(0,16).toUpperCase()}`;
      policies[key] = { toolId: tool.id, feature: feature.id, version: tool.version, sha256: tool.bundle.sha256, ...feature, binding, action: `svc_${hash.slice(0,24)}` };
      bindings.push({ name: binding, namespace_id: String(parseInt(hash.slice(0,8),16) || 1), simple: { limit: feature.rateLimit.limit, period: feature.rateLimit.periodSeconds } });
    }
  }
  return { policies, bindings };
}
