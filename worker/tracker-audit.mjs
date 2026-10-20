// Privacy-preserving URL audit. The user only supplies a public URL; the tool never receives
// or executes page HTML. Lighthouse renders remotely at Google; the Worker fetches the
// public document with SSRF/redirect guards and only returns bounded/redacted evidence.
import { validateTarget, AuditFailure } from './url-target.mjs';
import { fetchPublic, PAGE_LIMITS } from './page-inspect.mjs';
import { parseAttributes } from './page-extract.mjs';
import { readJson, json } from './seo-audit.mjs';

const PAGE_SPEED = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const vendors = [
  ['googletagmanager.com','Google Tag Manager','Tag manager','medium'],
  ['google-analytics.com','Google Analytics','Analytics','medium'],
  ['doubleclick.net','Google DoubleClick','Advertising','high'],
  ['googleadservices.com','Google Ads','Advertising','high'],
  ['connect.facebook.net','Meta Pixel','Advertising','high'],
  ['clarity.ms','Microsoft Clarity','Session replay','high'],
  ['hotjar.com','Hotjar','Session replay','high'],
  ['segment.com','Segment','Analytics','medium'],
  ['segment.io','Segment','Analytics','medium'],
  ['mixpanel.com','Mixpanel','Analytics','medium'],
  ['amplitude.com','Amplitude','Analytics','medium'],
  ['analytics.tiktok.com','TikTok Pixel','Advertising','high'],
  ['criteo.com','Criteo','Advertising','high'],
  ['adsrvr.org','The Trade Desk','Advertising','high'],
  ['bat.bing.com','Microsoft Ads','Advertising','high'],
  ['sentry.io','Sentry','Diagnostics','low'],
  ['newrelic.com','New Relic','Diagnostics','low']
];
const cookieTypes = [
  [/^_ga(?:_|$)|^_gid$|^_gcl_/i,'Google Analytics / Ads','medium'],
  [/^_fbp$|^_fbc$/i,'Meta Pixel','high'],
  [/^_hj|^_hjid$/i,'Hotjar','high'],
  [/^_clck$|^_clsk$/i,'Microsoft Clarity','high'],
  [/^IDE$|^MUID$|^_ttp$/i,'Advertising identifier','high']
];
const cut = (v,n=140) => String(v??'').slice(0,n);
const comparable = host => host.toLowerCase().replace(/^www\./,'');
function sanitizedUrl(value, base) {
  try {
    const u = new URL(value,base);
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password) return '';
    // Query, fragment, credentials, and incidental PII must never leave Worker.
    return u.origin + u.pathname.slice(0,240);
  } catch { return ''; }
}
function domain(host) {
  const p=comparable(host).split('.');
  const tail=p.slice(-2).join('.');
  return p.length>2 && /^(?:co|com|net|org|ac|gov)\.(?:uk|id|au|jp|nz|in)$/.test(tail) ? p.slice(-3).join('.') : tail;
}
function classify(url,page) {
  const u=new URL(url), site=new URL(page);
  let known=vendors.find(v=>u.hostname===v[0]||u.hostname.endsWith('.'+v[0]));
  if (!known && /(^|\.)facebook\.com$/.test(u.hostname) && /^\/tr(?:\/|$)/.test(u.pathname)) known=['facebook.com','Meta Pixel','Advertising','high'];
  return { url:u.origin+u.pathname,host:u.hostname,external:domain(u.hostname)!==domain(site.hostname),
    name:known?.[1]??u.hostname,kind:known?.[2]??'Other resource',risk:known?.[3]??'unknown',known:!!known };
}
export function staticSignals(html, base) {
  const urls=[];
  for(const tag of html.matchAll(/<(?:script|iframe|img|link|source)\b[^>]*>/gi)){
    const a=parseAttributes(tag[0]);
    const src=a.src??a.href;
    if(src && urls.length<300){const url=sanitizedUrl(src,base);if(url)urls.push(url);}
  }
  const gtm=[...new Set([...html.matchAll(/\bGTM-[A-Z0-9]{4,20}\b/g)].slice(0,40).map(x=>x[0]))];
  const flags=[];
  const test=[
    [/dataLayer\s*(?:\.push|\[)|window\.dataLayer/i,'dataLayer referenced'],
    [/\bgtag\s*\(/i,'gtag referenced'],
    [/\bfbq\s*\(/i,'Meta Pixel code referenced'],
    [/\bclarity\s*\(/i,'Clarity code referenced'],
    [/\b_paq\b/i,'Matomo code referenced'],
    [/cookiebot|onetrust|cookieyes/i,'Consent manager referenced']
  ];
  for(const [regex,label] of test) if(regex.test(html)) flags.push(label);
  return {urls,gtm,flags};
}
export function cookieSignals(headers) {
  const values=headers?.getSetCookie?.() ?? [];
  // Some runtimes coalesce Set-Cookie. Do not split a combined header: Expires contains commas.
  return values.slice(0,100).map(raw=>{
    const name=/^\s*([^=;\s]{1,120})=/.exec(raw)?.[1];if(!name) return null;
    const match=cookieTypes.find(c=>c[0].test(name));
    return {name,type:match?.[1]??'Unclassified',risk:match?.[2]??'unknown',
      httpOnly:/(?:^|;)\s*httponly\s*(?:;|$)/i.test(raw),secure:/(?:^|;)\s*secure\s*(?:;|$)/i.test(raw),
      sameSite:cut(/(?:^|;)\s*samesite\s*=\s*(strict|lax|none)/i.exec(raw)?.[1]??'Unspecified',12)};
  }).filter(Boolean);
}
export function summarizeSignals({page,html='',headers=null,lighthouse=null,providerError=''}) {
  const source=staticSignals(html,page);
  const requestItems=Array.isArray(lighthouse?.audits?.['network-requests']?.details?.items) ? lighthouse.audits['network-requests'].details.items : null;
  const signals=new Map();
  function add(value,mode){
    const url=sanitizedUrl(value,page);
    if(!url)return;
    let classified;try{classified=classify(url,page);}catch{return;}
    const key=classified.url+'|'+mode;
    if(signals.size>=350&&!signals.has(key))return;
    signals.set(key,{...classified,source:mode});
  }
  for(const u of source.urls) add(u,'HTML reference');
  if(requestItems) for(const item of requestItems.slice(0,400)) add(item?.url,'Lighthouse request');
  const resources=[...signals.values()];
  const cookies=cookieSignals(headers);
  const hasDocument=html.length>0;
  const hasNetwork=!!requestItems;
  if(!hasDocument && !hasNetwork) throw new AuditFailure('audit-failed',502);
  return {
    source:'automatic',page:sanitizedUrl(lighthouse?.finalUrl||page,page),at:cut(lighthouse?.fetchTime,50)||new Date().toISOString(),
    scripts:source.urls.slice(0,120),resources:resources.map(r=>({url:r.url,initiator:r.source})),
    cookies,events:[],gtm:source.gtm,flags:source.flags,
    storage:{local:[],session:[]},
    coverage:{html:hasDocument,network:hasNetwork,cookies:!!headers, dataLayer:'source-references-only',storage:'not-accessible',
      providerError:providerError||null,rendered:hasNetwork},
    notes:[
      hasNetwork?'Network requests are from a Google Lighthouse test browser, not your own browser session.':'Only HTML references were inspected; dynamic network requests were unavailable.',
      'GTM IDs and dataLayer references in static code do not prove events were fired.',
      'Cookies are initial response Set-Cookie names only, not the browser cookie jar or third-party cookies.',
      'No page scripts are executed by the Worker. Google may execute the public page as part of Lighthouse.'
    ],
    evidence:resources.slice(0,300),cookieCount:cookies.length,requestCount:requestItems?.length??null
  };
}
export async function handleTrackerAudit(input,env,fetcher=fetch) {
  const target=validateTarget(input.url);
  const pagePromise=fetchPublic(target,fetcher,{maximum:PAGE_LIMITS.documentBytes,accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'}).catch(()=>null);
  const url=new URL(PAGE_SPEED);
  url.searchParams.set('url',target);
  url.searchParams.append('category','PERFORMANCE');
  url.searchParams.append('category','BEST_PRACTICES');
  url.searchParams.set('strategy',input.strategy);
  url.searchParams.set('locale',input.locale);
  if(env.PAGESPEED_API_KEY)url.searchParams.set('key',env.PAGESPEED_API_KEY);
  let lighthouse=null, providerError='';
  try {
    const response=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(85_000),headers:{accept:'application/json'}});
    if(!response.ok){providerError=response.status===429?'provider-quota':'provider-unavailable';await response.body?.cancel();}
    else {const payload=await readJson(response,4*1024*1024);lighthouse=payload?.lighthouseResult?.runtimeError?null:payload?.lighthouseResult; if(!lighthouse)providerError='provider-unavailable';}
  } catch {providerError='provider-unavailable';}
  const page=await pagePromise;
  if(!lighthouse&&!page)throw new AuditFailure(providerError||'page-unreachable',502);
  const html=page&&page.status>=200&&page.status<400&&/html|xml/i.test(page.headers.get('content-type')||'text/html')?page.text:'';
  return json(summarizeSignals({page:page?.url??target,html,headers:html?page.headers:null,lighthouse,providerError}));
}
