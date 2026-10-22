/** The platform's own viewport never changes; only an active sandbox is scaled. */
export const TOOL_ZOOM = Object.freeze({
  min: 75,
  max: 200,
  step: 25,
  default: 100
});

export function stepToolZoom(current: number, direction: -1 | 1): number {
  return Math.max(TOOL_ZOOM.min, Math.min(TOOL_ZOOM.max, current + direction * TOOL_ZOOM.step));
}
