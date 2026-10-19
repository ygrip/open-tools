import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
let source=await readFile(new URL('../src/lib/runtime/wiki.ts',import.meta.url),'utf8');
source=source.replace("import { RuntimeFailure } from './core';","class RuntimeFailure extends Error { constructor(code,status){super(code);this.code=code;this.status=status;} }");
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {wikiOrigin,wikiRequestUrl,fetchWikiArticle}=await import('data:text/javascript;base64,'+Buffer.from(transpiled).toString('base64'));
const input={site:'https://en.wikipedia.org',title:'Ada Lovelace',endpoint:'/w/api.php'};
test('URL builder accepts only HTTPS public wiki origins and bounded API path',()=>{
 const url=new URL(wikiRequestUrl(input));
 assert.equal(url.searchParams.get('page'),'Ada Lovelace');
 assert.equal(url.searchParams.get('origin'),'*');
 assert.equal(url.searchParams.get('action'),'parse');
 assert.equal(wikiOrigin(input),'https://en.wikipedia.org');
 for(const site of ['http://wiki.example.org','https://localhost','https://127.0.0.1','https://internal.example.org:8443','https://wikipedia.org@localhost','https://abc.internal'])assert.throws(()=>wikiOrigin({...input,site}));
 for(const endpoint of ['//evil.org/api.php','/wiki/page','/../../api.php','/w/api.php?callback=alert','https://evil.org/api.php'])assert.throws(()=>wikiRequestUrl({...input,endpoint}));
});
test('only the expected public article content is returned, with no credential or redirects',async()=>{
 let received;
 const result=await fetchWikiArticle(input,new AbortController().signal,async (url,options)=>{
  received={url,options};
  return new Response(JSON.stringify({parse:{title:'Ada Lovelace',text:'<h2>History</h2><p>Unicode 測試</p>',revid:17}}));
 });
 assert.equal(received.options.credentials,'omit');
 assert.equal(received.options.redirect,'error');
 assert.equal(result.revision,17);
 assert.match(result.html,/Unicode 測試/);
});
test('rejects malformed, oversize and invalid responses',async()=>{
 const mocks=[new Response('not json'),new Response(JSON.stringify({error:{code:'missingtitle'}})),new Response('x'.repeat(2*1024*1024+1))];
 for(const response of mocks)await assert.rejects(fetchWikiArticle(input,new AbortController().signal,async()=>response));
});
