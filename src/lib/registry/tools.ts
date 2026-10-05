import generated from './generated.json';
import type { ToolManifest } from './types';
import { validateManifest } from './types';

export const tools = (generated as ToolManifest[]).map(validateManifest);

export const categories = Array.from(new Set(tools.map((tool) => tool.category))).sort();
