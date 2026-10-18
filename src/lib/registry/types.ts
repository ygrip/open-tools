export type ToolCategory = 'media' | 'developer' | 'data' | 'productivity' | 'other';
export type ToolIcon = 'braces' | 'toolbox' | 'grid' | 'sparkles' | 'bolt' | 'heart' | 'filter' | 'lock' | 'shield' | 'search';
export type ToolPermissionName = 'clipboard-read' | 'clipboard-write' | 'geolocation' | 'downloads' | 'camera-capture' | 'share-image' | 'external-assets' | 'wasm' | 'workers' | 'services';
export type ToolPermission = { name: ToolPermissionName; reason: string; required: boolean };
export type ToolAsset = { id: string; url: string; sha256: string; bytes: number; type: 'wasm' | 'script' | 'worker' | 'data'; defer: boolean };
export type ToolService = { id: string; handler: 'pagespeed-seo'; rateLimit: { limit: number; periodSeconds: 10 | 60 }; turnstile: boolean };
export type ToolSeo = { title: string; description: string; keywords: string[]; robots: 'index' | 'noindex' };
export type ToolGuide = { summary: string; steps: string[] };
export type ToolTranslation = { name: string; description: string; guide?: ToolGuide; seo?: ToolSeo };

/** Public normalized metadata. Legacy v2 inputs receive safe, nonprivileged defaults. */
export type ToolManifest = {
  schemaVersion: 2 | 3;
  runtimeVersion: 1;
  locales: ('en' | 'id')[];
  appearance: { theme: 'host'; protocolVersion: 1 };
  id: string;
  name: string;
  description: string;
  path: `/${string}`;
  category: ToolCategory;
  repository: string;
  version: string;
  capabilities: string[];
  status: 'stable' | 'beta' | 'experimental';
  icon: ToolIcon;
  seo: ToolSeo;
  guide: ToolGuide;
  permissions: ToolPermission[];
  assets: ToolAsset[];
  services: ToolService[];
  translations: Partial<Record<'en' | 'id', ToolTranslation>>;
  bundle: { format: 'html'; file: string; sha256: string };
  /** Host registration date (UTC ISO), used for "newest first" sorting. */
  addedAt?: string;
};

export { validateManifest } from './contract.js';
