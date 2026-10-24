import { base } from '$app/paths';
import { getLocale, type Locale } from '$lib/paraglide/runtime.js';
import { stripLanguagePrefix } from '$lib/languages.js';

/**
 * Site-local, absolute navigation URLs for prerendered pages.
 * Keep Paraglide in charge of the current locale and translations, but never
 * concatenate the absolute URLs returned by Paraglide's URL strategy with base.
 * Bundles/assets must continue to use the unlocalized $app/paths base.
 */
export function localizedPath(pathname: string, locale: Locale = getLocale()): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const unprefixed = stripLanguagePrefix(path);
  return `${base}${locale === 'en' ? unprefixed : `/${locale}${unprefixed}`}`;
}
