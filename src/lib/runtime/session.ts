/** Per-iframe lifecycle state. Never shared between tool instances or releases. */
export class RuntimeSession {
  controller?: AbortController;
  generation = 0;
  token = '';
  brokerBusy = false;
  seen = new Set<string>();
  inFlight = new Set<string>();
  loadedAssets = new Map<string, Promise<Uint8Array>>();
  assetRequests = new Map<string, string>();

  start(): { signal: AbortSignal; generation: number } {
    this.stop();
    this.controller = new AbortController();
    const crypto = globalThis.crypto;
    this.token = crypto?.randomUUID?.() ??
      (crypto ? [...crypto.getRandomValues(new Uint8Array(24))].map(value => value.toString(16).padStart(2, '0')).join('') : '');
    return { signal: this.controller.signal, generation: this.generation };
  }

  stop() {
    this.controller?.abort();
    this.controller = undefined;
    this.generation++;
    this.token = '';
    this.brokerBusy = false;
    this.seen.clear();
    this.inFlight.clear();
    this.loadedAssets.clear();
    this.assetRequests.clear();
  }
}
