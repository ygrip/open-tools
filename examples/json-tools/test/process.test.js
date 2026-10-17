import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_INPUT_LENGTH, transform } from '../src/process.js';

test('pretty-prints objects and scalar JSON values', () => {
  assert.equal(transform('{"hello":[1,true,null]}', 'pretty'), '{\n  "hello": [\n    1,\n    true,\n    null\n  ]\n}');
  assert.equal(transform('false', 'pretty'), 'false');
  assert.equal(transform('null', 'pretty'), 'null');
});

test('reports invalid and empty JSON', () => {
  assert.throws(() => transform('{broken}', 'pretty'), /Invalid JSON/);
  assert.throws(() => transform('  ', 'pretty'), /Paste some input/);
});

test('limits input size', () => {
  assert.throws(() => transform(' '.repeat(MAX_INPUT_LENGTH + 1), 'pretty'), /limit/);
});

test('queries nested arrays and returns an array for zero or one match', () => {
  const input = '{"items":[{"name":"Notebook"},{"name":"Pen"}]}';
  assert.deepEqual(JSON.parse(transform(input, 'query', '$.items[*].name')), ['Notebook', 'Pen']);
  assert.deepEqual(JSON.parse(transform(input, 'query', '$.items[0].name')), ['Notebook']);
  assert.deepEqual(JSON.parse(transform(input, 'query', '$.missing')), []);
});

test('queries preserve falsy scalar roots and normalize no matches', () => {
  for (const input of ['false', '0', 'null', '""']) {
    assert.deepEqual(JSON.parse(transform(input, 'query', '$')), [JSON.parse(input)]);
    assert.deepEqual(JSON.parse(transform(input, 'query', '$.missing')), []);
  }
});

test('rejects script evaluation in JSONPath expressions', () => {
  assert.throws(() => transform('{"items":[1,2]}', 'query', '$.items[?(@ > 1)]'), /Invalid or unsupported JSONPath/);
  assert.throws(() => transform('{}', 'query', ''), /Enter a JSONPath/);
  assert.throws(() => transform('{}', 'query', '$'.repeat(2049)), /limit/);
});

test('converts JSON to XML with a deterministic root and escapes text', () => {
  const xml = transform('{"name":"a & <b>","count":2}', 'json-to-xml');
  assert.match(xml, /<root>/);
  assert.match(xml, /<name>a &amp; &lt;b&gt;<\/name>/);
  assert.match(xml, /<count>2<\/count>/);
});

test('converts XML to JSON while preserving text, attributes and repeated nodes', () => {
  const result = JSON.parse(transform('<items><item id="01">3</item><item id="02">false</item></items>', 'xml-to-json'));
  assert.deepEqual(result, { items: { item: [{ '#text': '3', '@_id': '01' }, { '#text': 'false', '@_id': '02' }] } });
});

test('rejects malformed XML and declaration-based entities', () => {
  assert.throws(() => transform('<root><x></root>', 'xml-to-json'), /Invalid XML/);
  assert.throws(() => transform('<!DOCTYPE root [<!ENTITY x "hello">]><root>&x;</root>', 'xml-to-json'), /DOCTYPE and ENTITY/);
  assert.throws(() => transform('<!ENTITY x SYSTEM "file:///etc/passwd"><root/>', 'xml-to-json'), /DOCTYPE and ENTITY/);
});

test('rejects unsafe object keys before query and XML construction', () => {
  for (const operation of ['query', 'json-to-xml']) {
    assert.throws(() => transform('{"__proto__":{"polluted":true}}', operation), /Unsupported object key/);
  }
  assert.throws(() => transform('{"not a tag":true}', 'json-to-xml'), /XML name/);
});

test('decodes standard XML entities without allowing custom declarations', () => {
  const result = JSON.parse(transform('<root label="A &amp; B">&lt;x&gt; &#65; &#x42;</root>', 'xml-to-json'));
  assert.deepEqual(result, { root: { '#text': '<x> A B', '@_label': 'A & B' } });
});

test('rejects unsafe integers and non-finite numbers instead of silently changing them', () => {
  for (const input of ['9007199254740993', '{"id":9007199254740993}', '1e400']) {
    assert.throws(() => transform(input, 'pretty'), /safe JavaScript precision/);
  }
  assert.equal(transform('9007199254740991', 'pretty'), '9007199254740991');
});

test('rejects unknown operations', () => {
  assert.throws(() => transform('{}', 'other'), /Unknown operation/);
});
