import { readDecisions, saveDecisions, clearDecisions, type Decisions } from '../permissions';
import type { RuntimePermission, PermissionName, RuntimeRequest } from './core';

export const STARTUP_PERMISSIONS: PermissionName[] = ['wasm', 'workers', 'external-assets'];

export function startupPermissions(permissions: readonly RuntimePermission[]) {
  return permissions.filter(permission => STARTUP_PERMISSIONS.includes(permission.name));
}

/** Startup grants alter iframe sandbox capabilities and must be fixed before launch. */
export function loadStartupPermissions(toolId: string, startup: readonly RuntimePermission[]) {
  const decisions = readDecisions(toolId);
  return {
    decisions,
    selected: startup.filter(permission => decisions[permission.name] === 'granted').map(permission => permission.name),
    consent: startup.some(permission => !decisions[permission.name])
  };
}

export function saveStartupPermissions(toolId: string, startup: readonly RuntimePermission[], selected: readonly PermissionName[]) {
  saveDecisions(toolId, Object.fromEntries(startup.map(permission => [permission.name, selected.includes(permission.name) ? 'granted' : 'denied'])));
  return readDecisions(toolId);
}

export function runtimeGrants(permissions: readonly RuntimePermission[], selected: PermissionName[], decisions: Decisions) {
  return [...selected, ...permissions.filter(permission => !STARTUP_PERMISSIONS.includes(permission.name) && decisions[permission.name] !== 'denied').map(permission => permission.name)];
}

export function rememberPermission(toolId: string, operation: string, decision: 'granted' | 'denied') {
  saveDecisions(toolId, { [operation]: decision });
  return readDecisions(toolId);
}
export { clearDecisions };

export function needsPermissionPrompt(request: RuntimeRequest, decisions: Decisions, approvedWikiOrigins: ReadonlySet<string>, getWikiOrigin: (request: RuntimeRequest) => string) {
  if (request.operation === 'services') return false;
  if (request.operation === 'wiki-read') return !approvedWikiOrigins.has(getWikiOrigin(request));
  return decisions[request.operation === 'download-begin' ? 'downloads' : request.operation] !== 'granted';
}
