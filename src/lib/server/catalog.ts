import generated from '../registry/generated.json';
import type { ToolManifest } from '../registry/types';
import { validateManifest } from '../registry/types';

// Full native metadata stays server/build-only. Never import this catalog into
// client code: route data projects just the current locale before serialization.
export const tools = (generated as ToolManifest[]).map((tool) => {
  const addedAt = tool.addedAt;
  if (typeof addedAt === 'string' && !Number.isNaN(Date.parse(addedAt))) {
    return { ...validateManifest(tool), addedAt };
  }
  return validateManifest(tool);
});

export const categories = Array.from(new Set(tools.map((tool) => tool.category))).sort();
