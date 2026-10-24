import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

async function loadModule(path) {
  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent'
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
}
const [{ runtimeCopies, runtimeStrings }, { sharedCopies, serializeCopies }, { uiKitScript }, { tableScript }, { codeBlockScript }] = await Promise.all([
  loadModule('../src/lib/runtime/strings.ts'), loadModule('../src/lib/registry/ui-copy.ts'),
  loadModule('../src/lib/registry/ui-kit.ts'), loadModule('../src/lib/registry/ui-table.ts'), loadModule('../src/lib/registry/ui-code-block.ts')
]);
const codes = ['en', 'id', 'ms', 'fil', 'th', 'vi', 'zh', 'my', 'km', 'lo', 'ja', 'hi'];

function leaves(value, prefix = '') {
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix + key;
    if (typeof item === 'string') return [[path, item]];
    return leaves(item, path + '.');
  });
}
for (const [name, copies] of [['runtime', runtimeCopies], ['shared UI', sharedCopies]]) {
  test(`${name}: exactly twelve complete native dictionaries`, () => {
    assert.deepEqual(Object.keys(copies).sort(), [...codes].sort());
    const expected = leaves(copies.en).map(([key]) => key).sort();
    for (const code of codes) {
      const translated = leaves(copies[code]);
      assert.deepEqual(translated.map(([key]) => key).sort(), expected, code);
      for (const [key, value] of translated) assert.ok(value.trim(), `${code}.${key}`);
      if (code !== 'en') assert.notDeepEqual(copies[code], copies.en, code);
    }
  });
}
for (const code of codes) {
  test(`${code}: native permission and integrity messages are selected`, () => {
    assert.strictEqual(runtimeStrings(code), runtimeCopies[code]);
    assert.ok(runtimeStrings(code).assetHelp.includes('SHA-256'));
    assert.ok(runtimeStrings(code).trackerHelp.includes('Google'));
    assert.ok(runtimeStrings(code).dnsHelp.includes('Cloudflare'));
    assert.ok(runtimeStrings(code).location.precisionHelp.includes('1'));
  });
}
for (const code of ['fr', '', 'constructor', 'toString']) {
  test(`${code || 'empty'}: unknown host locale falls back to English`, () => {
    assert.strictEqual(runtimeStrings(code), runtimeCopies.en);
  });
}
test('shared dictionaries are safely embedded and every generated script parses', () => {
  const hostile = { en: { text: '</script><img onerror=alert(1)>' } };
  const encoded = serializeCopies(hostile);
  assert.ok(!encoded.includes('<'));
  assert.deepEqual(JSON.parse(encoded), hostile);
  for (const script of [uiKitScript, tableScript, codeBlockScript]) {
    assert.doesNotThrow(() => new vm.Script(script));
    assert.doesNotMatch(script, /documentElement\.lang === 'id'/);
  }
});

test('generated host and shared UI strings match the Paraglide JSON source exactly', () => {
  for (const locale of codes) {
    const catalog = JSON.parse(readFileSync(new URL('../messages/' + locale + '.json', import.meta.url), 'utf8'));
    for (const [namespace, dictionary] of [['runtime', runtimeCopies[locale]], ['ui', sharedCopies[locale]]]) {
      for (const [path, value] of leaves(dictionary)) {
        const key = namespace + '__' + path.replaceAll('.', '__').replaceAll('-', '_');
        assert.equal(catalog[key], value, locale + ':' + key);
      }
    }
  }
});
