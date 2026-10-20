import { RuntimeFailure, runService, type RuntimeRequest, type RuntimeTool } from './core';
import { fetchDns, type DnsQueryRequest } from './dns';
import { fetchWikiArticle, fetchWikiImage, type WikiReadRequest, type WikiImageRequest } from './wiki';

type CapabilityContext = {
  tool: RuntimeTool;
  signal: AbortSignal;
  serviceEndpoint: (feature: string) => string;
  verificationToken: string;
  downloadUrls: Set<string>;
};
type CapabilityResult = { value?: unknown; transfer?: Transferable[] };

/** Browser operations shared across the isolated iframe's capability broker. */
export async function executeCapability(request: RuntimeRequest, ctx: CapabilityContext): Promise<CapabilityResult> {
  switch (request.operation) {
    case 'clipboard-read': {
      if (!navigator.clipboard?.readText) throw new RuntimeFailure('unsupported');
      const value = await navigator.clipboard.readText();
      if (typeof value !== 'string' || value.length > 1024 * 1024) throw new RuntimeFailure('size');
      return { value };
    }
    case 'clipboard-write':
      if (!navigator.clipboard?.writeText) throw new RuntimeFailure('unsupported');
      await navigator.clipboard.writeText(request.payload as string);
      return {};
    case 'dns-query':
      return { value: await fetchDns(request.payload as DnsQueryRequest, ctx.signal) };
    case 'wiki-read': {
      if ('image' in (request.payload as object)) {
        const value = await fetchWikiImage(request.payload as WikiImageRequest, ctx.signal);
        return { value, transfer: [value.bytes] };
      }
      return { value: await fetchWikiArticle(request.payload as WikiReadRequest, ctx.signal) };
    }
    case 'services': {
      const payload = request.payload as { feature: string; input: unknown };
      const service = ctx.tool.services?.find(item => item.id === payload.feature);
      if (!service) throw new RuntimeFailure('invalid-request');
      return { value: await runService(ctx.serviceEndpoint(service.id), {
        version: ctx.tool.version, sha256: ctx.tool.bundle.sha256, input: payload.input,
        ...(service.turnstile ? { turnstileToken: ctx.verificationToken } : {})
      }, ctx.signal) };
    }
    case 'share-image': {
      const data = request.payload as { bytes: ArrayBuffer; filename: string; mime: 'image/png' };
      if (!navigator.share || !navigator.canShare) throw new RuntimeFailure('unsupported');
      const file = new File([data.bytes], data.filename, { type: data.mime });
      if (!navigator.canShare({ files: [file] })) throw new RuntimeFailure('unsupported');
      await navigator.share({ files: [file], title: ctx.tool.name });
      return {};
    }
    case 'downloads': {
      const data = request.payload as { bytes: ArrayBuffer; filename: string; mime: string };
      const url = URL.createObjectURL(new Blob([data.bytes], { type: data.mime }));
      ctx.downloadUrls.add(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); ctx.downloadUrls.delete(url); }, 1000);
      return {};
    }
    default:
      throw new RuntimeFailure('unsupported');
  }
}
