import { RuntimeFailure } from './core';

export type StreamStart = { filename: string; mime: string; size: number };
export type StreamPiece = { streamId: string; bytes: ArrayBuffer };
const MEMORY_LIMIT = 128 * 1024 * 1024;
type SavePicker = (options: { suggestedName: string }) => Promise<FileSystemFileHandle>;
type Active = {
  id: string; metadata: StreamStart; received: number;
  writable?: FileSystemWritableFileStream; chunks?: ArrayBuffer[];
};

/**
 * One active export per tool session. Browsers with showSaveFilePicker stream
 * directly to disk; others accumulate bounded chunks into a Blob.
 * begin() must be invoked directly by the host's approval button.
 */
export class DownloadSessionManager {
  private active: Active | null = null;
  private starting = false;
  private epoch = 0;
  constructor(private readonly objectUrls: Set<string>, private readonly picker?: SavePicker) {}

  async begin(metadata: StreamStart): Promise<{ streamId: string; mode: 'stream' | 'buffered' }> {
    if (this.active || this.starting) throw new RuntimeFailure('busy');
    // Save pickers can outlive tool navigation. Never attach a handle opened
    // for an iframe session that has since been cancelled.
    const epoch = this.epoch;
    this.starting = true;
    let writable: FileSystemWritableFileStream | undefined;
    try {
      const id = crypto.randomUUID();
      const pick = this.picker ?? (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
      if (pick) {
        try { writable = await pick.call(window, { suggestedName: metadata.filename }).then(file => file.createWritable()); }
        catch (error) {
          if (epoch !== this.epoch) throw new RuntimeFailure('aborted');
          throw new RuntimeFailure((error as Error)?.name === 'AbortError' ? 'denied' : 'unsupported');
        }
      } else if (metadata.size > MEMORY_LIMIT) {
        throw new RuntimeFailure('unsupported');
      }
      if (epoch !== this.epoch) {
        try { await writable?.abort(); } catch { /* Picker already closed */ }
        throw new RuntimeFailure('aborted');
      }
      this.active = { id, metadata, received: 0, ...(writable ? { writable } : { chunks: [] }) };
      return { streamId: id, mode: writable ? 'stream' : 'buffered' };
    } finally {
      this.starting = false;
    }
  }

  async append({ streamId, bytes }: StreamPiece): Promise<void> {
    const active = this.active;
    if (!active || active.id !== streamId) throw new RuntimeFailure('invalid-request');
    if (active.received + bytes.byteLength > active.metadata.size) {
      await this.cancel();
      throw new RuntimeFailure('size');
    }
    if (active.writable) {
      try { await active.writable.write(new Uint8Array(bytes)); }
      catch { await this.cancel(); throw new RuntimeFailure('request'); }
    } else active.chunks!.push(bytes);
    active.received += bytes.byteLength;
  }

  async finish(streamId: string): Promise<void> {
    const active = this.active;
    if (!active || active.id !== streamId) throw new RuntimeFailure('invalid-request');
    if (active.received !== active.metadata.size) {
      await this.cancel();
      throw new RuntimeFailure('size');
    }
    this.active = null;
    if (active.writable) {
      try { await active.writable.close(); }
      catch { throw new RuntimeFailure('request'); }
      return;
    }
    const url = URL.createObjectURL(new Blob(active.chunks, { type: active.metadata.mime }));
    this.objectUrls.add(url);
    const link = document.createElement('a');
    link.href = url; link.download = active.metadata.filename; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => { URL.revokeObjectURL(url); this.objectUrls.delete(url); }, 60_000);
  }

  async cancel(streamId?: string): Promise<void> {
    const active = this.active;
    if (streamId && (!active || active.id !== streamId)) return;
    // Invalidate an in-progress save picker even before it yields a handle.
    this.epoch++;
    if (!active) return;
    this.active = null;
    try { await active.writable?.abort(); } catch { /* Tab closing */ }
  }
}
