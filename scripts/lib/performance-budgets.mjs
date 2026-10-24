import { languageCodes } from '../../src/lib/languages.js';

// Preserve the English/Indonesian baseline and add bounded metadata space for
// every other host-supported locale. This allowance does not affect bundle or
// shared-JavaScript limits.
export const MAX_TOOL_ENTRY_GZIP = 8_192;
export const ADDITIONAL_TOOL_LOCALE_GZIP = 1_024;

export function toolEntryGzipBudget(locales) {
  const supportedLocales = new Set(locales.filter(locale => languageCodes.includes(locale)));
  const additionalLocales = Math.max(0, supportedLocales.size - 2);
  return MAX_TOOL_ENTRY_GZIP + additionalLocales * ADDITIONAL_TOOL_LOCALE_GZIP;
}
