import {test,expect} from './fixtures';
import {readFileSync} from 'node:fs';
import {languageCodes} from '../../src/lib/languages.js';
const tools=JSON.parse(readFileSync(new URL('../../src/lib/registry/generated.json',import.meta.url),'utf8'));
const tool=tools.find((entry:{id:string})=>entry.id==='json-tools');
for(const locale of languageCodes)test(locale+' catalog metadata matches SSR and hydration',async({browser,page})=>{
 let path='/'+tool.id+'/';
 if(locale!=='en')path='/'+locale+path;
 const translation=tool.translations?.[locale];
 const name=translation?.name??tool.name;
 const description=translation?.description??tool.description;
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:test.info().project.use.baseURL});
 try{
  const serverPage=await context.newPage();await serverPage.goto(path);
  await expect(serverPage.locator('#tool-name')).toHaveText(name);
  await expect(serverPage.locator('.tool-intro p').last()).toHaveText(description);
 }finally{await context.close();}
 await page.goto(path);
 await expect(page.locator('#tool-name')).toHaveText(name);
 await expect(page.locator('.tool-intro p').last()).toHaveText(description);
 await expect(page.locator('html')).toHaveAttribute('lang',locale);
});
