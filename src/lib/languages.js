/**
 * Canonical, locale-independent names and search aliases.
 * Keep these codes aligned with project.inlang/settings.json.
 * A national flag indicates the commonly associated writing locale, not a claim
 * that every speaker of the language lives in that country.
 */
export const languages = [
  { code: 'en', native: 'English', english: 'English', flag: '🇬🇧', aliases: 'uk british' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian', flag: '🇮🇩', aliases: 'indonesia' },
  { code: 'ms', native: 'Bahasa Melayu', english: 'Malay', flag: '🇲🇾', aliases: 'malaysia melayu' },
  { code: 'fil', native: 'Filipino', english: 'Filipino', flag: '🇵🇭', aliases: 'tagalog philippines pilipino' },
  { code: 'th', native: 'ไทย', english: 'Thai', flag: '🇹🇭', aliases: 'thailand ภาษาไทย' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese', flag: '🇻🇳', aliases: 'viet nam vietnam' },
  { code: 'zh', native: '简体中文', english: 'Chinese (Simplified)', flag: '🇨🇳', aliases: 'mandarin china 中文 汉语' },
  { code: 'my', native: 'မြန်မာဘာသာ', english: 'Burmese', flag: '🇲🇲', aliases: 'myanmar burma' },
  { code: 'km', native: 'ភាសាខ្មែរ', english: 'Khmer', flag: '🇰🇭', aliases: 'cambodia cambodian' },
  { code: 'lo', native: 'ພາສາລາວ', english: 'Lao', flag: '🇱🇦', aliases: 'laos laotian' },
  { code: 'ja', native: '日本語', english: 'Japanese', flag: '🇯🇵', aliases: 'japan nihongo' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', flag: '🇮🇳', aliases: 'india hindustani हिंदी' }
];

export const languageCodes = languages.map(({ code }) => code);
const prefix = new RegExp(`^/(${languageCodes.filter((code) => code !== 'en').join('|')})(?=/|$)`);

export function stripLanguagePrefix(pathname) {
  return pathname.replace(prefix, '') || '/';
}
export function isSupportedLanguage(locale) {
  return languageCodes.includes(locale);
}
