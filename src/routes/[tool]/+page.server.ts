import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLocale } from '$lib/paraglide/runtime.js';
import { tools } from '$lib/server/catalog';
import { catalogToolForLocale } from '$lib/registry/catalog-locale.js';

export const prerender = true;
export const entries = () => tools.map((tool) => ({ tool: tool.id }));

export const load: PageServerLoad = ({ params, url, depends }) => {
  depends(url.href);
  const tool = tools.find((candidate) => candidate.id === params.tool);
  if (!tool) error(404, 'Tool not found');
  return { tool: catalogToolForLocale(tool, getLocale()) };
};
