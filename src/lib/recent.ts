/** Recently opened tools and the catalog sort, stored only in this browser (never sent anywhere). */
const recentKey = 'trick-it:recent-tools';
const sortKey = 'trick-it:tool-sort';
const maximum = 6;
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function readRecentTools(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && safeId.test(id)).slice(0, maximum) : [];
  } catch {
    return [];
  }
}

export function recordRecentTool(id: string) {
  if (!safeId.test(id)) return;
  try { localStorage.setItem(recentKey, JSON.stringify([id, ...readRecentTools().filter((entry) => entry !== id)].slice(0, maximum))); }
  catch { /* Storage can be disabled or full; recents are a convenience only. */ }
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
