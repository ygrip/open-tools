export type ToolCategory = 'media' | 'developer' | 'data' | 'productivity' | 'other';

export type ToolManifest = {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  path: `/${string}`;
  category: ToolCategory;
  repository: string;
  version: string;
  capabilities: string[];
  status: 'stable' | 'beta' | 'experimental';
  bundle: { format: 'html'; file: string; sha256: string };
};

export { validateManifest } from './contract.js';
