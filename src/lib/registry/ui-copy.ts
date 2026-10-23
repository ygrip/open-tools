import en from './ui-locales/en';
import id from './ui-locales/id';
import ja from './ui-locales/ja';
import zh from './ui-locales/zh';
import vi from './ui-locales/vi';
import ms from './ui-locales/ms';
import fil from './ui-locales/fil';
import hi from './ui-locales/hi';
import th from './ui-locales/th';
import my from './ui-locales/my';
import km from './ui-locales/km';
import lo from './ui-locales/lo';

export type SharedCopy = typeof en;
export const sharedCopies: Record<string, SharedCopy> = { en, id, ja, zh, vi, ms, fil, hi, th, my, km, lo };
export const kitCopies = Object.fromEntries(Object.entries(sharedCopies).map(([locale, { table, code, ...kit }]) => [locale, kit]));
export const tableCopies = Object.fromEntries(Object.entries(sharedCopies).map(([locale, copy]) => [locale, copy.table]));
export const codeCopies = Object.fromEntries(Object.entries(sharedCopies).map(([locale, copy]) => [locale, copy.code]));

export function serializeCopies(copies: object): string {
  return JSON.stringify(copies).replaceAll('<', '\\u003c');
}
