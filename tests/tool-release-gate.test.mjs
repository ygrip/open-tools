import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { languageCodes } from '../src/lib/languages.js';
import { checkToolRelease } from '../scripts/check-tool-release.mjs';
import { scaffoldFiles } from './scaffold-recipe.mjs';

const execute = promisify(execFile);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (root, path) => readFile(join(root, path), 'utf8').then(JSON.parse);
const save = (root, path, value) => writeFile(join(root, path), JSON.stringify(value, null, 2) + '\n');

async function replacePack(root, locale, pack) {
  const manifest = await json(root, 'tool.manifest.json');
  const bytes = Buffer.from(JSON.stringify(pack));
  const file = 'dist/locales/' + locale + '.json';
  await writeFile(join(root, file), bytes);
  manifest.localePacks[locale] = { file, sha256: digest(bytes), bytes: bytes.length };
  await save(root, 'tool.manifest.json', manifest);
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'tool-release-gate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist/locales'), { recursive: true });
  await mkdir(join(root, 'messages'));
  await mkdir(join(root, 'project.inlang'));
  const manifest = JSON.parse((await scaffoldFiles()).get('tool.manifest.json'));
  manifest.locales = [...languageCodes];
  manifest.localePacks = {};
  const html = Buffer.from('<!doctype html><html lang="en"><body>Fixture</body></html>');
  manifest.bundle.sha256 = digest(html);
  await writeFile(join(root, 'dist/index.html'), html);
  for (const locale of languageCodes) {
    const catalog = { action: locale + ' action {count}', error: locale + ' error' };
    await save(root, 'messages/' + locale + '.json', catalog);
    if (locale === 'en') continue;
    const bytes = Buffer.from(JSON.stringify(catalog));
    await writeFile(join(root, 'dist/locales/' + locale + '.json'), bytes);
    manifest.localePacks[locale] = { file: 'dist/locales/' + locale + '.json', sha256: digest(bytes), bytes: bytes.length };
    manifest.translations[locale] = { name: 'Fixture ' + locale, description: 'Structural fixture ' + locale };
  }
  await save(root, 'tool.manifest.json', manifest);
  await save(root, 'package.json', { name: manifest.id, version: manifest.version, devDependencies: { '@inlang/paraglide-js': '2.29.0' } });
  await save(root, 'package-lock.json', { version: manifest.version, lockfileVersion: 3, packages: { '': { version: manifest.version }, 'node_modules/@inlang/paraglide-js': { version: '2.29.0' } } });
  await save(root, 'project.inlang/settings.json', { locales: [...languageCodes], modules: ['https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4.5.0/dist/index.js'] });
  return root;
}

test('structural gate derives its complete locale set from the host', async t => {
  const result = await checkToolRelease(await fixture(t));
  assert.equal(result.locales, languageCodes.length);
});

test('inlang editor schema references are not treated as UI messages', async t => {
  const root = await fixture(t);
  for (const locale of languageCodes) {
    const data = await json(root, 'messages/' + locale + '.json');
    data.$schema = 'https://inlang.com/schema/inlang-message-format';
    await save(root, 'messages/' + locale + '.json', data);
  }
  assert.equal((await checkToolRelease(root)).locales, languageCodes.length);
});

const invalid = [
  ['duplicated oversized multilingual catalog guides', async root => {
    const data = await json(root, 'tool.manifest.json');
    for (const locale of languageCodes.filter(code => code !== 'en')) {
      const steps = Array.from({ length: 5 }, (_, step) =>
        Array.from({ length: 5 }, (_, part) => digest(Buffer.from(locale + ':' + step + ':' + part))).join(''));
      data.translations[locale].guide = { summary: 'Synthetic guide.', steps };
    }
    await save(root, 'tool.manifest.json', data);
  }, /fixed per-tool gzip budget/],
  ['missing native consent reason', async root => {
    const data = await json(root, 'tool.manifest.json');
    data.permissions = [{ name: 'downloads', reason: 'Save the result.', required: false }];
    await save(root, 'tool.manifest.json', data);
  }, /Missing native consent reason/],
  ['published English fallback instead of authored copy', async root => {
    await replacePack(root, 'ms', await json(root, 'messages/en.json'));
  }, /Published pack differs from authored copy/],
  ['missing authored message hidden by compiler fallback', async root => {
    const data = await json(root, 'messages/ms.json');
    delete data.error;
    await save(root, 'messages/ms.json', data);
  }, /authored message keys/],
  ['blank authored message', async root => {
    const data = await json(root, 'messages/ms.json');
    data.error = ' ';
    await save(root, 'messages/ms.json', data);
  }, /Blank authored message/],
  ['changed placeholder', async root => {
    const data = await json(root, 'messages/ms.json');
    data.action = '{different}';
    await save(root, 'messages/ms.json', data);
  }, /Placeholder mismatch/],
  ['missing native metadata', async root => {
    const data = await json(root, 'tool.manifest.json');
    delete data.translations.ms;
    await save(root, 'tool.manifest.json', data);
  }, /Missing native metadata/],
  ['inline-only dictionaries', async root => {
    const data = await json(root, 'tool.manifest.json');
    delete data.localePacks;
    await save(root, 'tool.manifest.json', data);
  }, /separate repository-file locale pack/],
  ['floating compiler', async root => {
    const data = await json(root, 'package.json');
    data.devDependencies['@inlang/paraglide-js'] = '^2.29.0';
    await save(root, 'package.json', data);
  }, /Pin the Paraglide compiler/],
  ['floating plugin', async root => {
    const data = await json(root, 'project.inlang/settings.json');
    data.modules = ['https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4/dist/index.js'];
    await save(root, 'project.inlang/settings.json', data);
  }, /Pin the message-format plugin/],
  ['package and manifest version drift', async root => {
    const data = await json(root, 'package.json');
    data.version = '0.2.0';
    await save(root, 'package.json', data);
  }, /release versions must match/],
  ['missing lockfile', root => rm(join(root, 'package-lock.json')), /package-lock.json/],
  ['nested pack with correct digest', async root => {
    await replacePack(root, 'ms', { action: 'message', errors: { invalid: 'message' } });
  }, /nonblank string messages/]
];
for (const [name, mutate, expected] of invalid) test('structural gate rejects ' + name, async t => {
  const root = await fixture(t);
  await mutate(root);
  await assert.rejects(checkToolRelease(root), expected);
});

test('baseline check rejects an unchanged version and accepts a stable bump', async t => {
  const root = await fixture(t);
  await execute('git', ['init', '-q', root]);
  await execute('git', ['-C', root, 'add', '.']);
  await execute('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'baseline']);
  await assert.rejects(checkToolRelease(root, { baseline: 'HEAD' }), /must advance/);
  for (const path of ['tool.manifest.json', 'package.json', 'package-lock.json']) {
    const data = await json(root, path); data.version = '0.2.0';
    if (path === 'package-lock.json') data.packages[''].version = data.version;
    await save(root, path, data);
  }
  assert.equal((await checkToolRelease(root, { baseline: 'HEAD' })).version, '0.2.0');
});
