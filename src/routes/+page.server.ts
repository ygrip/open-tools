import type { PageServerLoad } from './$types';
import { getLocale } from '$lib/paraglide/runtime.js';
import { tools, categories } from '$lib/server/catalog';
import { catalogToolForLocale } from '$lib/registry/catalog-locale.js';

export const load: PageServerLoad = ({ url, depends }) => {
  // Paraglide canonicalizes request URLs; use its request-scoped locale while
  // tracking URL navigation so a prefix-only change reloads this static data.
  depends(url.href);
  const locale = getLocale();
  return { categories, tools: tools.map((tool) => catalogToolForLocale(tool, locale)) };
};
