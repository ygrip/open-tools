import type { ToolManifest } from './types';
import { validateManifest } from './types';

/**
 * Generated/registered tool manifests live here for now.
 *
 * The next step is to have CI populate this list from trusted repository
 * manifests. Keeping this boundary explicit means discovery can be automatic
 * without making arbitrary repositories trusted by default.
 */
const manifests: ToolManifest[] = [];

export const tools = manifests.map(validateManifest);

export const categories = Array.from(new Set(tools.map((tool) => tool.category))).sort();
