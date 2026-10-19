import { RuntimeFailure } from './core';

export type WikiReadRequest = { site: string; title: string; endpoint: string };
const SITE = /^[a-z0-9.-]{3,200}$/i;
const ENDPOINT = /^\/(?:[a-z0-9_-]+\/){0,3}(?:w\/)?api\.php$/i;
const LIMIT = 2 * 1024 * 1024;

/**
 * A dedicated, narrow cross-origin MediaWiki read broker.
 * The opaque iframe never fetches and never controls an arbitrary target URL.
 * No credentials, redirects, wiki writes or third-party proxy are involved.
 */
export function wikiOrigin(request: WikiReadRequest): string {
  let url: URL;
  try { url = new URL(request.site); } catch { throw new RuntimeFailure('invalid-request'); }
  const host=url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.origin !== request.site || url.username || url.password ||
      url.port || !SITE.test(host) || !host.includes('.') ||
      /(^|\.)(localhost|local|internal|test|invalid)(\.|$)/.test(host) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes('..') ||
      host.startsWith('-') || host.endsWith('-')) throw new RuntimeFailure('invalid-request');
  return url.origin;
}

export function wikiRequestUrl(request: WikiReadRequest): string {
  const origin=wikiOrigin(request);
  if (!ENDPOINT.test(request.endpoint) || request.endpoint.includes('//') ||
      request.title.length < 1 || request.title.length > 180 ||
      /[\u0000-\u001f\u007f]/.test(request.title)) throw new RuntimeFailure('invalid-request');
  const url = new URL(request.endpoint, origin);
  url.searchParams.set('action','parse');
  url.searchParams.set('page',request.title);
  url.searchParams.set('prop','text|revid');
  url.searchParams.set('format','json');
  url.searchParams.set('formatversion','2');
  url.searchParams.set('origin','*');
  return url.href;
}

export async function fetchWikiArticle(request: WikiReadRequest, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const url=wikiRequestUrl(request);
  const controller=new AbortController();
  const cancel=()=>controller.abort();
  signal.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,30000);
  try {
    let response: Response;
    try { response=await fetcher(url,{signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'}); }
    catch { throw new RuntimeFailure(controller.signal.aborted ? 'timeout' : 'request'); }
    if (!response.ok || response.type==='opaque') throw new RuntimeFailure('request',response.status);
    const length=Number(response.headers.get('content-length')||0);
    if(length>LIMIT) throw new RuntimeFailure('size');
    if(!response.body)throw new RuntimeFailure('request');
    const reader=response.body.getReader();
    const chunks:Uint8Array[]=[];let total=0;
    try {
      while(true) {
        const {value,done}=await reader.read();
        if(done)break;
        total+=value!.byteLength;
        if(total>LIMIT)throw new RuntimeFailure('size');
        chunks.push(value!);
      }
    } finally { await reader.cancel().catch(()=>undefined);reader.releaseLock(); }
    const bytes=new Uint8Array(total);let at=0;
    for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    let parsed:any;
    try { parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
    catch { throw new RuntimeFailure('request'); }
    const page=parsed?.parse;
    const html=typeof page?.text==='string'?page.text:typeof page?.text?.['*']==='string'?page.text['*']:null;
    if(!html || html.length>LIMIT || typeof page?.title!=='string' || page.title.length>240) throw new RuntimeFailure('request');
    return {title:page.title,html,revision:Number.isSafeInteger(page.revid)?page.revid:null};
  } finally {clearTimeout(timer);signal.removeEventListener('abort',cancel);}
}
