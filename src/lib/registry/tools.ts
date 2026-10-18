import generated from './generated.json';
import type { ToolManifest } from './types';
import { validateManifest } from './types';

// addedAt comes from the host registration, not the tool manifest, so re-attach it after validation.
export const tools = (generated as ToolManifest[]).map((tool) => {
  const addedAt = typeof tool.addedAt === 'string' && !Number.isNaN(Date.parse(tool.addedAt)) ? tool.addedAt : undefined;
  return addedAt ? { ...validateManifest(tool), addedAt } : validateManifest(tool);
});

export const categories = Array.from(new Set(tools.map((tool) => tool.category))).sort();
