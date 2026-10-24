/**
 * Generated sandbox/host dictionaries from the same messages/{locale}.json inputs
 * compiled by Paraglide JS. Do not add hand-written per-language dictionaries.
 *
 * Paraglide owns translation sources and the reactive Svelte UI. The isolated
 * srcdoc iframe cannot import host modules, so its shared controls consume a
 * small, build-generated serializable projection of those messages.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const { locales } = await readJson('project.inlang/settings.json');
const catalogs = Object.fromEntries(await Promise.all(locales.map(async locale =>
  [locale, await readJson('messages/' + locale + '.json')]
)));
const source = catalogs.en;

function dictionary(namespace, catalog) {
  const result = Object.create(null);
  const prefix = namespace + '__';
  for (const [key, english] of Object.entries(source)) {
    if (!key.startsWith(prefix)) continue;
    if (typeof english !== 'string') throw Error('Invalid source message: ' + key);
    const translated = catalog[key];
    if (typeof translated !== 'string' || !translated.trim())
      throw Error('Missing Paraglide message: ' + key);
    const chunks = key.slice(prefix.length).split('__');
    let current = result;
    for (let i = 0; i < chunks.length; i++) {
      const segment = i > 0 && ['labels', 'errors'].includes(chunks[0])
        ? chunks[i].replaceAll('_', '-')
        : chunks[i];
      if (!segment || segment === '__proto__' || segment === 'constructor' || segment === 'prototype')
        throw Error('Unsafe message key: ' + key);
      if (i === chunks.length - 1) {
        if (Object.hasOwn(current, segment)) throw Error('Duplicate message key: ' + key);
        current[segment] = translated;
      } else {
        current = current[segment] ??= Object.create(null);
      }
    }
  }
  return result;
}

const make = namespace => Object.fromEntries(
  locales.map(locale => [locale, dictionary(namespace, catalogs[locale])])
);
const runtimeCopies = make('runtime');
const sharedCopies = make('ui');
if (!Object.keys(runtimeCopies.en).length || !Object.keys(sharedCopies.en).length)
  throw Error('Missing host localization namespaces');

const out = [
  '/* AUTO-GENERATED from Paraglide messages. DO NOT EDIT. */',
  'export const runtimeCopies = ' + JSON.stringify(runtimeCopies).replaceAll('<', '\\u003c') + ' as const;',
  'export const sharedCopies = ' + JSON.stringify(sharedCopies).replaceAll('<', '\\u003c') + ' as const;',
  ''
].join('\n');
await mkdir(new URL('src/lib/i18n/', root), { recursive: true });
await writeFile(new URL('src/lib/i18n/generated-copies.ts', root), out);
console.log('Generated ' + locales.length + ' locale packs from Paraglide message JSON.');
