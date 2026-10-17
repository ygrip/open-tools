import type { PermissionName, RuntimeErrorCode } from './core';

const en = {
  languageFallback: 'This tool uses its supported interface language. Platform navigation keeps your selected language.',
  guide: 'Tool guide', permissions: 'Choose this session’s permissions', permissionHelp: 'Nothing is granted automatically. Required permissions must be selected to start. Optional permissions can remain off. Grants expire when you leave, revoke access, or load another release.',
  required: 'Required', optional: 'Optional', start: 'Start with selected permissions', revoke: 'Revoke access and restart', retry: 'Retry loading',
  retryAsset: 'Retry asset download', assetReady: 'Asset ready. Try the tool action again.',
  loading: 'Loading', ready: 'Tool ready', timeout: 'Loading timed out. Try again.', failed: 'This tool needs another moment.',
  assets: 'Additional assets', assetHelp: 'These public assets are fetched only with your consent, verified against their SHA-256, and may be cached on this device. Scripts and workers execute only in the isolated tool, never in the platform. The remote provider can see your IP address.',
  automatic: 'Before launch', deferred: 'On demand', progress: 'Downloading verified asset', cachedWarning: 'Offline storage is unavailable. Verified downloads still work, but may download again.', corruptWarning: 'An invalid cached asset was discarded and is being downloaded again.',
  confirm: 'Allow this tool action?', confirmHelp: 'This approval applies to this one action. Your browser may ask for a separate permission.', allow: 'Allow once', deny: 'Deny', optionalOff: 'Unselected optional features remain unavailable.',
  labels: { 'clipboard-read': 'Read your clipboard', 'clipboard-write': 'Write to your clipboard', geolocation: 'Get your current location once', downloads: 'Download a file', 'external-assets': 'Download declared external assets', wasm: 'Run WebAssembly in the isolated tool', workers: 'Run isolated background workers' } satisfies Record<PermissionName, string>,
  errors: { request: 'The request failed.', 'invalid-bundle': 'The installed tool version does not match the catalog. Reload the platform or retry.', integrity: 'The downloaded content failed its integrity check and was not used.', size: 'The downloaded content has an unexpected size.', 'invalid-asset': 'This asset is not valid.', aborted: 'The action was cancelled.', denied: 'Permission was not granted.', 'invalid-request': 'The tool sent an invalid request.', busy: 'Another action needs your attention.', unsupported: 'This action is unavailable in this browser.', timeout: 'The download timed out. Try the tool action again.' } satisfies Record<RuntimeErrorCode, string>
};
const id: typeof en = {
  languageFallback: 'Alat ini memakai bahasa antarmuka yang didukungnya. Navigasi platform tetap memakai bahasa pilihan Anda.',
  guide: 'Panduan alat', permissions: 'Pilih izin untuk sesi ini', permissionHelp: 'Tidak ada izin otomatis. Izin wajib harus dipilih sebelum mulai. Izin opsional boleh dimatikan. Izin berakhir saat Anda pergi, mencabut akses, atau memuat rilis lain.',
  required: 'Wajib', optional: 'Opsional', start: 'Mulai dengan izin terpilih', revoke: 'Cabut akses dan mulai ulang', retry: 'Coba muat lagi',
  retryAsset: 'Coba unduh aset lagi', assetReady: 'Aset siap. Coba tindakan alat lagi.',
  loading: 'Memuat', ready: 'Alat siap', timeout: 'Waktu pemuatan habis. Coba lagi.', failed: 'Alat ini perlu sedikit waktu lagi.',
  assets: 'Aset tambahan', assetHelp: 'Aset publik ini hanya diunduh dengan persetujuan Anda, diperiksa SHA-256-nya, dan dapat disimpan di perangkat ini. Skrip dan worker hanya berjalan dalam alat terisolasi, bukan platform. Penyedia aset dapat melihat alamat IP Anda.',
  automatic: 'Sebelum mulai', deferred: 'Saat dibutuhkan', progress: 'Mengunduh aset terverifikasi', cachedWarning: 'Penyimpanan luring tidak tersedia. Unduhan terverifikasi tetap dapat dipakai, tetapi mungkin perlu diunduh kembali.', corruptWarning: 'Aset tersimpan yang tidak valid dibuang dan diunduh ulang.',
  confirm: 'Izinkan tindakan alat ini?', confirmHelp: 'Persetujuan ini hanya berlaku untuk satu tindakan. Peramban Anda mungkin meminta izin terpisah.', allow: 'Izinkan sekali', deny: 'Tolak', optionalOff: 'Fitur opsional yang tidak dipilih tetap tidak tersedia.',
  labels: { 'clipboard-read': 'Baca papan klip', 'clipboard-write': 'Tulis ke papan klip', geolocation: 'Ambil lokasi Anda sekali', downloads: 'Unduh berkas', 'external-assets': 'Unduh aset eksternal yang terdaftar', wasm: 'Jalankan WebAssembly dalam alat terisolasi', workers: 'Jalankan worker latar yang terisolasi' },
  errors: { request: 'Permintaan gagal.', 'invalid-bundle': 'Versi alat tidak cocok dengan katalog. Muat ulang platform atau coba lagi.', integrity: 'Konten gagal pemeriksaan integritas dan tidak dipakai.', size: 'Ukuran konten tidak sesuai.', 'invalid-asset': 'Aset ini tidak valid.', aborted: 'Tindakan dibatalkan.', denied: 'Izin belum diberikan.', 'invalid-request': 'Alat mengirim permintaan yang tidak valid.', busy: 'Ada tindakan lain yang menunggu perhatian Anda.', unsupported: 'Tindakan ini tidak tersedia di peramban Anda.', timeout: 'Waktu unduhan habis. Coba tindakan alat lagi.' }
};
export function runtimeStrings(locale: string) { return locale === 'id' ? id : en; }
