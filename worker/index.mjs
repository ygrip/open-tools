import policies from './generated-services.json' with { type: 'json' };
import { handleService, serviceConfig } from './services.mjs';
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/tools/')) return path.endsWith('/config') ? serviceConfig(request,env,policies) : handleService(request,env,policies);
    if (path.startsWith('/api/')) return Response.json({error:'unknown-service'},{status:404,headers:{'cache-control':'no-store'}});
    return env.ASSETS.fetch(request);
  }
};
