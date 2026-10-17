import type { ToolManifest } from './types';

/** Localize presentation only. Identity, digests, permissions and URLs never translate. */
export function localizedTool(tool: ToolManifest, locale: string): ToolManifest {
  const translation = tool.translations?.[locale === 'id' ? 'id' : 'en'];
  if (!translation) return tool;
  return { ...tool, name: translation.name ?? tool.name, description: translation.description ?? tool.description, guide: translation.guide ?? tool.guide, seo: translation.seo ?? tool.seo };
}
