import { isSupportedLanguage, languageCodes, stripLanguagePrefix } from '../languages.js';

export const SEO_LOCALES = [...languageCodes];
// Bundled social-card fonts currently cover the reviewed English/Indonesian art.
export const SOCIAL_CARD_LOCALES = ['en', 'id'];

/** @param {string | undefined} value */
export function siteOrigin(value = '') {
  if (!value.trim()) return '';
  let url;
  try { url = new URL(value); } catch { throw new Error('PUBLIC_SITE_URL must be an HTTPS origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('PUBLIC_SITE_URL must be an HTTPS origin without credentials, path, query or fragment');
  }
  return url.origin;
}

/** Configured mount prefix, never a render-relative $app/paths.base. @param {string} value */
export function deploymentBase(value = '') {
  if (value && (!value.startsWith('/') || value.startsWith('//') || value.endsWith('/') || /[?#\\]/.test(value) || value.split('/').some((part) => part === '.' || part === '..'))) throw new Error('SEO base must be an absolute configured mount prefix');
  return value;
}

/** @param {string} path @param {string} locale @param {string} base */
export function localePath(path, locale = 'en', base = '') {
  base = deploymentBase(base);
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error('SEO path must be site-local');
  let pathname = path.split(/[?#]/, 1)[0] || '/';
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) pathname = pathname.slice(base.length) || '/';
  pathname = stripLanguagePrefix(pathname);
  if (pathname.split('/').some((part) => part === '.' || part === '..')) throw new Error('SEO path cannot contain dot segments');
  pathname = pathname === '/' ? '/' : `${pathname.replace(/\/+$/, '')}/`;
  return `${base}${locale === 'en' ? pathname : `/${locale}${pathname}`}`;
}

/** JSON embedded in a script element must never contain an HTML closing tag.
 * @param {unknown} value
 */
export function safeJsonLd(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** @typedef {{id:string,name:string,version:string,category:string,description?:string,locales?:string[],capabilities?:string[],addedAt?:string}} SeoTool */

const applicationCategories = /** @type {Record<string, string>} */ ({ developer: 'DeveloperApplication', media: 'MultimediaApplication', data: 'BusinessApplication', productivity: 'UtilitiesApplication' });
/** @param {{title:string,description:string,path:string,locale?:string,origin?:string,base?:string,image?:string,keywords?:string[],robots?:string,tool?:SeoTool}} options */
export function seoMetadata(options) {
  const locale = options.locale && isSupportedLanguage(options.locale) ? options.locale : 'en';
  const origin = siteOrigin(options.origin);
  const base = options.base || '';
  const path = localePath(options.path, locale, base);
  const title = /trick-it/i.test(options.title) ? options.title : `${options.title} · trick-it`;
  const imagePath = options.image || `${base}/og/${options.tool ? `tools/${options.tool.id}` : 'home'}-${SOCIAL_CARD_LOCALES.includes(locale) ? locale : 'en'}.png`;
  if (!imagePath.startsWith('/') || imagePath.startsWith('//') || /[\\?#]/.test(imagePath)) throw new Error('SEO image must be a site-local asset path');
  const canonical = origin ? `${origin}${path}` : '';
  const image = origin ? `${origin}${imagePath}` : imagePath;
  const alternates = origin ? SEO_LOCALES.map((language) => ({ locale: language, href: `${origin}${localePath(options.path, language, base)}` })) : [];
  // Every supported host locale has a canonical route and a safe social card.
  // Explicit tool exclusions and nonproduction previews must remain nonindexable.
  const indexable = Boolean(origin) && options.robots !== 'noindex';
  const schema = options.tool ? {
    '@context': 'https://schema.org', '@type': 'WebApplication',
    ...(canonical ? { '@id': `${canonical}#application`, url: canonical } : {}),
    name: options.tool.name, description: options.description, softwareVersion: options.tool.version,
    applicationCategory: applicationCategories[options.tool.category] ?? 'UtilitiesApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', inLanguage: options.tool.locales?.includes(locale) ? locale : options.tool.locales?.[0] ?? 'en',
    image, isAccessibleForFree: true,
    ...(options.tool.capabilities?.length ? { featureList: options.tool.capabilities.map((capability) => capability.replaceAll('-', ' ')).join(', ') } : {}),
    ...(options.tool.addedAt ? { datePublished: options.tool.addedAt.slice(0, 10) } : {}),
    publisher: { '@type': 'Organization', name: 'trick-it', ...(origin ? { url: `${origin}${base}/` } : {}) }
  } : localePath(options.path, 'en', base) === `${base}/` ? {
    '@context': 'https://schema.org', '@type': 'WebSite', name: 'trick-it', description: options.description,
    ...(canonical ? { '@id': `${canonical}#website`, url: canonical } : {}), inLanguage: locale
  } : null;
  return { title, description: options.description, path, canonical, image,
    imageAlt: `${options.tool?.name || 'trick-it'} — ${options.description}`,
    keywords: (options.keywords || []).join(', '), robots: indexable ? 'index,follow' : 'noindex,nofollow',
    locale: /** @type {Record<string, string>} */ ({ en: 'en_US', id: 'id_ID', ms: 'ms_MY', fil: 'fil_PH', th: 'th_TH', vi: 'vi_VN', zh: 'zh_CN', my: 'my_MM', km: 'km_KH', lo: 'lo_LA', ja: 'ja_JP', hi: 'hi_IN' })[locale] ?? 'en_US', alternateLocale: locale === 'id' ? 'en_US' : 'id_ID',
    alternates, defaultHref: origin ? `${origin}${localePath(options.path, 'en', base)}` : '', schema };
}
