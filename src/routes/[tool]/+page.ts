import { error } from '@sveltejs/kit';
import { tools } from '$lib/registry/tools';

export const prerender = true;
export const entries = () => tools.map((tool) => ({ tool: tool.id }));

export function load({ params }: { params: { tool: string } }) {
  const tool = tools.find((candidate) => candidate.id === params.tool);
  if (!tool) error(404, 'Tool not found');
  return { tool };
}
