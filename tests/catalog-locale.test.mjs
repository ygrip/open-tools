import test from 'node:test';
import assert from 'node:assert/strict';
import { languageCodes } from '../src/lib/languages.js';
import { catalogToolForLocale } from '../src/lib/registry/catalog-locale.js';

test('each host locale receives its exact native metadata and no other locale dictionaries', () => {
  const translations = Object.fromEntries(languageCodes.map(locale => [locale, {
    name: locale + ' name', description: locale + ' description',
    guide: { summary: locale + ' guide', steps: [locale + ' step'] },
    permissionReasons: { downloads: locale + ' reason' },
    seo: { title: locale + ' title', description: locale + ' SEO', keywords: [], robots: 'noindex' }
  }]));
  const tool = { id: 'fixture', version: '1.0.0', name: 'Base name', translations,
    bundle: { sha256: 'a'.repeat(64) }, permissions: [], assets: [], locales: [...languageCodes] };
  for (const locale of languageCodes) {
    const projected = catalogToolForLocale(tool, locale);
    assert.deepEqual(Object.keys(projected.translations), [locale]);
    assert.deepEqual(projected.translations[locale], translations[locale]);
    assert.equal(projected.id, tool.id);
    assert.equal(projected.version, tool.version);
    for (const field of ['bundle', 'permissions', 'assets', 'locales']) assert.equal(projected[field], tool[field], field);
  }
  assert.deepEqual(Object.keys(tool.translations), languageCodes, 'projection never mutates shared SSR state');
});

test('missing translated metadata retains English fallback without leaking inactive dictionaries', () => {
  const tool = { id: 'fixture', name: 'English', description: 'Base copy', translations: { id: { name: 'ID' } } };
  assert.deepEqual(catalogToolForLocale(tool, 'ja'), { id: 'fixture', name: 'English', description: 'Base copy', translations: {} });
  assert.equal(tool.translations.id.name, 'ID');
});
