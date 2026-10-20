import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';

// Exercise the exact browser modules without relying on Node's optional TS loader.
async function loadModule(path) {
  const { outputFiles } = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
}
const theme = await loadModule('../src/lib/theme.ts');
const { sandboxDocument, bundlePolicy } = await loadModule('../src/lib/registry/sandbox.ts');

test('sandbox theme is an enum and host policy precedes untrusted markup', () => {
  const content = '<!doctype html><html><body>Bundle contents</body></html>';
  const html = sandboxDocument(content, 'dark');
  assert.match(html, /<html lang="en" data-theme="dark"/);
  assert.ok(html.indexOf(bundlePolicy) < html.indexOf(content));
  assert.match(html, /--ot-bg:/);
  assert.match(sandboxDocument(content, '"><script>bad()</script>'), /data-theme="light"/);
  assert.ok(!sandboxDocument(content, '"><script>bad()</script>').includes('bad()'));
});

test('sandbox receiver accepts only its parent and the exact theme message shape', () => {
  const html = sandboxDocument('<!doctype html><p>Tool</p>', 'light');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const parent = {};
  const root = { dataset: { theme: 'light' }, style: { colorScheme: 'light' } };
  const receivers = [];
  const receive = (event) => { for (const listener of receivers) listener(event); };
  vm.runInNewContext(script, {
    parent,
    HTMLElement: class { focus() { assert.fail('Theme messages must not move focus'); } },
    window: {},
    document: { documentElement: root },
    addEventListener(type, listener) { assert.equal(type, 'message'); receivers.push(listener); }
  });
  const valid = { type: 'open-tools:theme', version: 1, theme: 'dark' };
  for (const event of [
    { source: {}, data: valid },
    { source: parent, data: null },
    { source: parent, data: { ...valid, version: 2 } },
    { source: parent, data: { ...valid, type: 'arbitrary' } },
    { source: parent, data: { ...valid, theme: 'other' } }
  ]) {
    receive(event);
    assert.equal(root.dataset.theme, 'light');
  }
  receive({ source: parent, data: valid });
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.style.colorScheme, 'dark');
  receive({ source: parent, data: { ...valid, theme: 'light' } });
  assert.equal(root.dataset.theme, 'light');
});

test('theme still changes when preference storage is denied', () => {
  const root = { dataset: { theme: 'light' }, style: {} };
  const document = {
    documentElement: root,
    defaultView: { localStorage: { setItem() { throw new Error('Storage denied'); } } }
  };
  assert.equal(theme.applyTheme(document, 'dark'), false);
  assert.equal(theme.documentTheme(document), 'dark');
  assert.equal(root.style.colorScheme, 'dark');
});
