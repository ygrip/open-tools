import { runtimeCopies as catalog } from '../i18n/generated-copies';

// All translations come from the Paraglide message catalogs. This adapter only
// exposes the nested API the host runtime already uses.
type WidenStrings<T> = T extends string ? string : { [K in keyof T]: WidenStrings<T[K]> };
export type RuntimeStrings = WidenStrings<typeof catalog.en>;
export const runtimeCopies: Record<string, RuntimeStrings> = catalog;

export function runtimeStrings(locale: string): RuntimeStrings {
  return Object.hasOwn(runtimeCopies, locale) ? runtimeCopies[locale] : runtimeCopies.en;
}
