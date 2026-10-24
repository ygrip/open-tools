import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raw = locale => readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8');
const read = locale => JSON.parse(raw(locale));
const source = read('en');
const keys = Object.keys(source).filter(key => key !== '$schema').sort();
const placeholders = value => [...value.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map(match => match[1]).sort();
for (const locale of ['en', 'hi', 'th', 'ja', 'zh', 'vi', 'ms', 'fil', 'my', 'km', 'lo']) {
  test(`${locale}: platform pack is complete and preserves formatting placeholders`, () => {
    const pack = read(locale);
    const declaredKeys = [...raw(locale).matchAll(/^\s*"([^"]+)":/gm)].map(match => match[1]);
    assert.equal(new Set(declaredKeys).size, declaredKeys.length, `${locale}: duplicate JSON key`);
    assert.deepEqual(Object.keys(pack).filter(key => key !== '$schema').sort(), keys);
    for (const key of keys) {
      assert.equal(typeof pack[key], 'string', `${locale}.${key}`);
      assert.ok(pack[key].trim(), `${locale}.${key}`);
      assert.deepEqual(placeholders(pack[key]), placeholders(source[key]), `${locale}.${key}`);
      if (locale !== 'en' && /^(privacy|terms|policy).*_(text|intro|summary)$/.test(key)) {
        assert.notEqual(pack[key], source[key], `${locale}.${key}: untranslated policy copy`);
      }
    }
  });
}
