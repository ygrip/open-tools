import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const pack = JSON.parse(readFileSync(new URL('../src/ui-phrases.json',import.meta.url),'utf8'));
const codes = ['ms','fil','th','vi','zh','my','km','lo','ja','hi'];
test('common UI translations are available in all ten additional locales', () => {
 assert.ok(pack.keys.length >= 40);
 assert.equal(new Set(pack.keys).size,pack.keys.length);
 for (const code of codes) {
  assert.equal(pack[code]?.length,pack.keys.length,code);
  assert.ok(pack[code].every(v=>typeof v==='string'&&v.trim()),code);
 }
});
