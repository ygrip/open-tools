/**
 * Remembered per-tool permission decisions (browser-only, never sent anywhere).
 * A tool asks for each declared permission at most once; "Reset access" clears it.
 */
export type Decision = 'granted' | 'denied';
export type Decisions = Partial<Record<string, Decision>>;

const KEY = 'trick-it:permissions:v1';
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readAll(): Record<string, Decisions> {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, Decisions>) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); }
  catch { /* Storage can be full or disabled: the choice then lasts for this page only. */ }
}

export function readDecisions(toolId: string): Decisions {
  if (!ID.test(toolId)) return {};
  const stored = readAll()[toolId];
  const result: Decisions = {};
  if (stored && typeof stored === 'object') {
    for (const [name, decision] of Object.entries(stored)) if (decision === 'granted' || decision === 'denied') result[name] = decision;
  }
  return result;
}

export function saveDecisions(toolId: string, changes: Decisions) {
  if (!ID.test(toolId)) return;
  const all = readAll();
  all[toolId] = { ...readDecisions(toolId), ...changes };
  writeAll(all);
}

export function clearDecisions(toolId: string) {
  const all = readAll();
  delete all[toolId];
  writeAll(all);
}
