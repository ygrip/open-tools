import { parseRuntimeRequest, type ParsedRequest, type RuntimeErrorCode, type RuntimeRequest, type RuntimeTool } from './core';
import type { RuntimeSession } from './session';

type Incoming =
  | { kind: 'ignore' }
  | { kind: 'resize'; height: number }
  | { kind: 'reject'; request: RuntimeRequest; error: RuntimeErrorCode }
  | { kind: 'dispatch'; parsed: ParsedRequest };

/** Authenticate and account for iframe messages before any sensitive handler runs. */
export function classifyRuntimeMessage(event: MessageEvent, options: {
  frameWindow: Window | null;
  frameReady: boolean;
  session: RuntimeSession;
  tool: RuntimeTool;
  grants: readonly string[];
}): Incoming {
  const { frameWindow, frameReady, session, tool, grants } = options;
  if (!session.controller || session.controller.signal.aborted) return { kind: 'ignore' };
  if (event.data?.type === 'trick-it:resize') {
    const size = event.data;
    if (event.source !== frameWindow || !frameReady || size.version !== 1 || size.token !== session.token ||
        !Number.isSafeInteger(size.height) || size.height < 0 || size.height > 100000) return { kind: 'ignore' };
    return { kind: 'resize', height: Math.max(200, size.height + 2) };
  }
  const parsed = parseRuntimeRequest(event, frameWindow, session.token, tool, grants);
  if (!parsed) return { kind: 'ignore' };
  const { request } = parsed;
  // A retransmission must never reject the in-progress prompt or overwrite its request.
  if (session.inFlight.has(request.id)) return { kind: 'ignore' };
  if (session.seen.has(request.id)) return { kind: 'reject', request, error: 'invalid-request' };
  if (session.seen.size >= 1024) session.seen.delete(session.seen.values().next().value!);
  session.seen.add(request.id);
  if (parsed.error) return { kind: 'reject', request, error: parsed.error };
  if (session.inFlight.size >= 16 && request.operation !== 'download-cancel') return { kind: 'reject', request, error: 'busy' };
  return { kind: 'dispatch', parsed };
}
