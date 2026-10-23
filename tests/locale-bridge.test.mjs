import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { languageCodes } from '../src/lib/languages.js';

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/registry/sandbox.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022'
});
const { sandboxDocument } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

for (const locale of languageCodes) {
  test(`${locale}: sandbox initializes the declared interface language`, () => {
    const html = sandboxDocument('<p>Fixture</p>', 'light', { locale });
    assert.ok(html.startsWith(`<!doctype html><html lang="${locale}"`));
  });
}

test('live locale bridge accepts all supported parent messages, rejects forged/invalid messages', () => {
  const html = sandboxDocument('<p>Fixture</p>', 'light');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const parent = {};
  const root = { lang: 'en', dataset: {}, style: {} };
  const listeners = [];
  const changes = [];
  const window = {};
  vm.runInNewContext(script, {
    parent, window, document: { documentElement: root },
    HTMLElement: class { focus() { assert.fail('Locale messages must not move focus'); } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    addEventListener(type, listener) { listeners.push(listener); },
    dispatchEvent(event) { changes.push(event.detail.locale); }
  });
  const send = event => listeners.forEach(listener => listener(event));
  const message = { type: 'trick-it:locale', version: 1, locale: 'ja' };
  for (const event of [
    { source: {}, data: message },
    { source: parent, data: { ...message, version: 2 } },
    { source: parent, data: { ...message, locale: 'fr' } },
    { source: parent, data: { ...message, locale: '<script>' } },
    { source: parent, data: { ...message, type: 'other' } }
  ]) send(event);
  assert.equal(root.lang, 'en');
  assert.deepEqual(changes, []);
  for (const locale of languageCodes.filter(code => code !== 'en')) {
    send({ source: parent, data: { ...message, locale } });
    assert.equal(root.lang, locale);
    assert.equal(window.trickIt.locale, locale);
  }
  assert.deepEqual(changes, languageCodes.filter(code => code !== 'en'));
  send({ source: parent, data: { ...message, locale: 'hi' } });
  assert.equal(changes.length, languageCodes.length - 1);
});
