/** Export limits shared by the host parser, writer and injected tool SDK. */
export const DOWNLOAD_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024 * 1024,
  bufferedMaxBytes: 256 * 1024 * 1024,
  chunkBytes: 1024 * 1024,
  inlineBytes: 16 * 1024 * 1024
});
