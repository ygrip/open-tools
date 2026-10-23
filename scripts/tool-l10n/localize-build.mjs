import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [original, script, phrases, rawManifest] = await Promise.all([
  read('dist/index.html'),
  read('src/multilingual-ui.js'),
  read('src/ui-phrases.json'),
  read('tool.manifest.json')
]);
const pack = JSON.parse(phrases);
const languages = ['ms','fil','th','vi','zh','my','km','lo','ja','hi'];
if (new Set(pack.keys).size !== pack.keys.length) throw new Error('Duplicate source language phrase');
for (const code of languages) {
  if (!Array.isArray(pack[code]) || pack[code].length !== pack.keys.length || pack[code].some(v => typeof v !== 'string' || !v.trim()))
    throw new Error('Missing translated UI phrase for '+code);
}
if (!/<\/body\s*>/i.test(original) || /<\/script/i.test(script)) throw new Error('Cannot safely attach language pack');
const json = JSON.stringify(pack).replaceAll('<','\\u003c');
const html = original.replace(/<\/body\s*>/i, () => '<script type="application/json" id="__tool_ui_phrase_pack">'+json+'</script><script>'+script+'</script></body>');
const manifest = JSON.parse(rawManifest);
manifest.locales = ['en','id',...languages];
manifest.bundle.sha256 = createHash('sha256').update(Buffer.from(html)).digest('hex');
await writeFile(new URL('dist/index.html',root),html);
await writeFile(new URL('tool.manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log('Attached ten additional UI phrase packs: '+pack.keys.length+' common controls, with EN fallback for tool-specific copy.');
