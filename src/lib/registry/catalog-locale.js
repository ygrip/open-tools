/** Keep identity/capabilities intact while sending only the selected copy.
 * @param {import('./types').ToolManifest} tool
 * @param {string} locale
 * @returns {import('./types').ToolManifest}
 */
export function catalogToolForLocale(tool, locale) {
  const { translations, ...base } = tool;
  const translation = translations?.[/** @type {import('./types').ToolLocale} */ (locale)];
  if (!translation) return { ...base, translations: {} };
  return { ...base, translations: { [locale]: translation } };
}
