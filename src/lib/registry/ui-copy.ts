import { sharedCopies as catalog } from '../i18n/generated-copies';

type WidenStrings<T> = T extends string ? string : { [K in keyof T]: WidenStrings<T[K]> };
export type SharedCopy = WidenStrings<typeof catalog.en>;
export const sharedCopies: Record<string, SharedCopy> = catalog;
export const kitCopies = Object.fromEntries(Object.entries(sharedCopies).map(([locale, { table, code, ...kit }]) => [locale, kit]));
export const tableCopies = Object.fromEntries(Object.entries(sharedCopies).map(([locale, copy]) => [locale, copy.table]));
export const codeCopies = Object.fromEntries(Object.entries(sharedCopies).map(([locale, copy]) => [locale, copy.code]));

export function serializeCopies(copies: object): string {
  return JSON.stringify(copies).replaceAll('<', '\\u003c');
}
