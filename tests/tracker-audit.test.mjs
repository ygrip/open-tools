import test from 'node:test';
import assert from 'node:assert/strict';
import {staticSignals,cookieSignals,summarizeSignals,handleTrackerAudit} from '../worker/tracker-audit.mjs';

const url='https://site.test-domain.com/page?foo=private';
test('static HTML extracts GTM and tags, never executes or returns cookie values',()=>{
 const result=staticSignals('<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABCDE1"></script><script>window.dataLayer=[];dataLayer.push({event:"purchase",email:"secret@example.com"});</script>',url);
 assert.deepEqual(result.gtm,['GTM-ABCDE1']);
 assert.ok(result.flags.includes('dataLayer referenced'));
 assert.ok(result.urls.every(x=>!x.includes('GTM-ABCDE1')));
});
test('Set-Cookie values are stripped and attributes retained without guessing third-party cookies',()=>{
 const headers=new Headers();
 headers.getSetCookie=()=>['_ga=SECRET_PERSONAL_ID; Path=/; SameSite=None; Secure; HttpOnly','session=supersecret; Path=/; SameSite=Lax'];
 const values=cookieSignals(headers);
 assert.deepEqual(values.map(x=>x.name),['_ga','session']);
 assert.equal(values[0].httpOnly,true);
 assert.equal(values[0].sameSite,'None');
 assert.ok(!JSON.stringify(values).includes('SECRET_PERSONAL_ID'));
});
test('aggregates bounded Lighthouse network evidence and flags coverage gaps',()=>{
 const report=summarizeSignals({page:url,html:'<script src="https://www.googletagmanager.com/gtm.js"></script>',lighthouse:{finalUrl:url,audits:{'network-requests':{details:{items:[{url:'https://connect.facebook.net/en_US/fbevents.js?token=sensitive'}, {url:'https://site.test-domain.com/app.js'}]}}}}});
 assert.ok(report.evidence.some(x=>x.name==='Meta Pixel'&&x.risk==='high'));
 assert.ok(report.evidence.every(x=>!x.url.includes('token=')));
 assert.equal(report.coverage.network,true);
 assert.equal(report.events.length,0);
 assert.equal(report.coverage.storage,'not-accessible');
});
test('automatic handler uses only fixed PSI and SSRF-validated public page requests',async()=>{
 const called=[];
 const fetcher=async(target,options)=>{called.push(String(target));if(target instanceof URL){assert.equal(target.origin,'https://www.googleapis.com');return Response.json({lighthouseResult:{finalUrl:'https://public.example.org/',audits:{'network-requests':{details:{items:[{url:'https://www.google-analytics.com/collect?user=SECRET'}]}}}}});}
 return new Response('<html><script src="https://www.googletagmanager.com/gtm.js?id=GTM-HELLO1"></script></html>',{headers:{'content-type':'text/html'}})};
 const res=await handleTrackerAudit({url:'https://public.example.org/',strategy:'mobile',locale:'en'}, {},fetcher);
 assert.equal(res.status,200);const body=await res.json();
 assert.ok(body.gtm.includes('GTM-HELLO1'));assert.equal(body.coverage.network,true);assert.ok(!JSON.stringify(body).includes('user=SECRET'));
 assert.equal(called.length,2);
});
test('provider failures produce labelled static-only partial reports, not a fake complete scan',async()=>{
 const report=await handleTrackerAudit({url:'https://public.example.org/',strategy:'mobile',locale:'en'}, {},async target=>target instanceof URL?new Response('quota',{status:429}):new Response('<html>dataLayer.push({event:"purchase"})</html>',{headers:{'content-type':'text/html'}}));
 assert.equal(report.status,200);const body=await report.json();assert.equal(body.coverage.network,false);assert.equal(body.coverage.providerError,'provider-quota');assert.equal(body.coverage.html,true);
});
