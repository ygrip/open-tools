export type ToolCategory = 'media' | 'developer' | 'data' | 'productivity' | 'other';

export type ToolManifest = {
  id: string;
  name: string;
  description: string;
  path: `/${string}`;
  category: ToolCategory;
  repository: string;
  icon?: string;
  capabilities?: string[];
  status?: 'stable' | 'beta' | 'experimental';
};

export function validateManifest(manifest: ToolManifest): ToolManifest {
  if (!/^[a-z0-9-]+$/.test(manifest.id)) {
    throw new Error(`Invalid tool id: ${manifest.id}`);
  }

  if (manifest.path !== `/${manifest.id}`) {
    throw new Error(`Tool path must be /${manifest.id}`);
  }

  if (!/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/.test(manifest.repository)) {
    throw new Error(`Invalid GitHub repository URL for ${manifest.id}`);
  }

  return manifest;
}
