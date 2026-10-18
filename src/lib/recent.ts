/** Recently opened tools and the catalog sort, stored only in this browser (never sent anywhere). */
const recentKey = 'trick-it:recent-tools';
const sortKey = 'trick-it:tool-sort';
const maximum = 6;
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type RecentEntry = { id: string; at?: number };

/** Entries newest first. Older builds stored bare IDs, which stay readable (without a time). */
export function readRecentEntries(): RecentEntry[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]');
    if (!Array.isArray(value)) return [];
    const entries: RecentEntry[] = [];
    for (const item of value) {
      const entry = typeof item === 'string' ? { id: item } : item && typeof item === 'object' ? { id: (item as RecentEntry).id, at: (item as RecentEntry).at } : null;
      if (!entry || typeof entry.id !== 'string' || !safeId.test(entry.id) || entries.some((seen) => seen.id === entry.id)) continue;
      entries.push(Number.isSafeInteger(entry.at) && entry.at! > 0 ? { id: entry.id, at: entry.at } : { id: entry.id });
    }
    return entries.slice(0, maximum);
  } catch {
    return [];
  }
}

export function readRecentTools(): string[] {
  return readRecentEntries().map((entry) => entry.id);
}

export function recordRecentTool(id: string, at = Date.now()) {
  if (!safeId.test(id)) return;
  try { localStorage.setItem(recentKey, JSON.stringify([{ id, at }, ...readRecentEntries().filter((entry) => entry.id !== id)].slice(0, maximum))); }
  catch { /* Storage can be disabled or full; recents are a convenience only. */ }
}

/** Compact relative time ("just now", "5 min ago", "yesterday") in the page language. */
export function relativeTime(at: number | undefined, locale: string, now = Date.now()): string {
  if (!at) return '';
  const seconds = Math.round((at - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 7], ['week', 4.35], ['month', 12], ['year', Infinity]];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return unit === 'second' && Math.abs(value) < 45 ? format.format(0, 'second') : format.format(Math.round(value), unit);
    value /= size;
  }
  return '';
}

export function clearRecentTools() {
  try { localStorage.removeItem(recentKey); } catch { /* See recordRecentTool. */ }
}

export const toolSorts = ['az', 'za', 'newest', 'oldest'] as const;
export type ToolSort = (typeof toolSorts)[number];

export function readToolSort(): ToolSort {
  try {
    const value = localStorage.getItem(sortKey);
    return toolSorts.find((sort) => sort === value) ?? 'az';
  } catch {
    return 'az';
  }
}

export function saveToolSort(value: ToolSort) {
  try { localStorage.setItem(sortKey, value); } catch { /* Convenience only. */ }
}

/** Stable sort; tools without a registration date sort as oldest, ties fall back to name. */
export function sortTools<T extends { name: string; addedAt?: string }>(list: T[], order: ToolSort, locale: string): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' });
  const time = (tool: T) => (tool.addedAt ? Date.parse(tool.addedAt) : 0) || 0;
  return [...list].sort((a, b) =>
    order === 'za' ? byName(b, a)
    : order === 'newest' ? time(b) - time(a) || byName(a, b)
    : order === 'oldest' ? time(a) - time(b) || byName(a, b)
    : byName(a, b));
}
