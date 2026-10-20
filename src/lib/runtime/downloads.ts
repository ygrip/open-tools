import { RuntimeFailure } from './core';
import { DOWNLOAD_LIMITS } from './download-policy';

export type StreamStart = { filename: string; mime: string; size: number };
export type StreamPiece = { streamId: string; bytes: ArrayBuffer };
export type DownloadProgress = StreamStart & { streamId: string; loaded: number; total: number; phase: 'saving' | 'finishing' | 'complete' };
type SavePicker = (options: { suggestedName: string }) => Promise<FileSystemFileHandle>;
type Active = {
  id: string; metadata: StreamStart; received: number;
  writable?: FileSystemWritableFileStream; chunks?: ArrayBuffer[];
  writing: boolean; finishing: boolean;
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
  private cancelled = new Set<string>();
  constructor(private readonly objectUrls: Set<string>, private readonly picker?: SavePicker,
    private readonly onProgress?: (value: DownloadProgress | null) => void) {}

  private report(active: Active, phase: DownloadProgress['phase'] = 'saving') {
    this.onProgress?.({ ...active.metadata, streamId: active.id, loaded: active.received, total: active.metadata.size, phase });
  }

  async begin(metadata: StreamStart): Promise<{ streamId: string; mode: 'stream' | 'buffered' }> {
    if (this.active || this.starting) throw new RuntimeFailure('busy');
    if (!Number.isSafeInteger(metadata.size) || metadata.size < 1 || metadata.size > DOWNLOAD_LIMITS.maxBytes) throw new RuntimeFailure('size');
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
      } else if (metadata.size > DOWNLOAD_LIMITS.bufferedMaxBytes) {
        throw new RuntimeFailure('size');
      }
      if (epoch !== this.epoch) {
        try { await writable?.abort(); } catch { /* Picker already closed */ }
        throw new RuntimeFailure('aborted');
      }
      this.active = { id, metadata: { ...metadata }, received: 0, writing: false, finishing: false, ...(writable ? { writable } : { chunks: [] }) };
      this.report(this.active);
      return { streamId: id, mode: writable ? 'stream' : 'buffered' };
    } finally {
      this.starting = false;
    }
  }

  async append({ streamId, bytes }: StreamPiece): Promise<void> {
    const active = this.active;
    if (!active || active.id !== streamId) throw new RuntimeFailure(this.cancelled.has(streamId) ? 'aborted' : 'invalid-request');
    // The iframe is untrusted: enforce sequential acknowledgements here too.
    if (active.writing || active.finishing) throw new RuntimeFailure('busy');
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 1 || bytes.byteLength > DOWNLOAD_LIMITS.chunkBytes) throw new RuntimeFailure('invalid-request');
    if (active.received + bytes.byteLength > active.metadata.size) {
      await this.cancel(streamId);
      throw new RuntimeFailure('size');
    }
    active.writing = true;
    try {
      if (active.writable) await active.writable.write(new Uint8Array(bytes));
      else active.chunks!.push(bytes);
      if (this.active !== active) throw new RuntimeFailure('aborted');
      active.received += bytes.byteLength;
      this.report(active);
    } catch (error) {
      if (this.active !== active) throw new RuntimeFailure('aborted');
      await this.cancel(streamId);
      throw error instanceof RuntimeFailure ? error : new RuntimeFailure('request');
    } finally { active.writing = false; }
  }

  async finish(streamId: string): Promise<void> {
    const active = this.active;
    if (!active || active.id !== streamId) throw new RuntimeFailure(this.cancelled.has(streamId) ? 'aborted' : 'invalid-request');
    if (active.writing || active.finishing) throw new RuntimeFailure('busy');
    if (active.received !== active.metadata.size) {
      await this.cancel(streamId);
      throw new RuntimeFailure('size');
    }
    active.finishing = true;
    this.report(active, 'finishing');
    try {
      if (active.writable) await active.writable.close();
      else {
        const url = URL.createObjectURL(new Blob(active.chunks, { type: active.metadata.mime }));
        this.objectUrls.add(url);
        const link = document.createElement('a');
        link.href = url; link.download = active.metadata.filename; link.hidden = true;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => { URL.revokeObjectURL(url); this.objectUrls.delete(url); }, 60_000);
      }
      if (this.active !== active) throw new RuntimeFailure('aborted');
      this.active = null;
      this.report(active, 'complete');
    } catch (error) {
      if (this.active !== active) throw new RuntimeFailure('aborted');
      await this.cancel(streamId);
      throw error instanceof RuntimeFailure ? error : new RuntimeFailure('request');
    }
  }

  async cancel(streamId?: string): Promise<void> {
    const active = this.active;
    if (streamId && (!active || active.id !== streamId)) return;
    // Invalidate an in-progress save picker even before it yields a handle.
    this.epoch++;
    this.onProgress?.(null);
    if (!active) return;
    if (this.cancelled.size >= 16) this.cancelled.delete(this.cancelled.values().next().value!);
    this.cancelled.add(active.id);
    this.active = null;
    try { await active.writable?.abort(); } catch { /* Tab closing */ }
  }
}
