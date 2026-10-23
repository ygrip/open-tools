import type { SharedCopy } from '../ui-copy';
export default {
  close: 'Tutup', note: 'Catatan', continueQuestion: 'Lanjutkan?', gotIt: 'Mengerti', continue: 'Lanjutkan', cancel: 'Batal',
  file: { label: 'Letakkan berkas di sini', labelMany: 'Letakkan berkas di sini', choose: 'Pilih berkas', chooseMany: 'Pilih berkas', upTo: 'maks.', any: 'Semua berkas', type: 'Jenis berkas ini tidak didukung.', size: 'Berkas ini lebih besar dari', count: 'Terlalu banyak berkas. Maksimal:', remove: 'Hapus' },
  loader: { waiting: 'Siap memuat', loading: 'Memuat aset…', verifying: 'Memeriksa integritas aset…', initializing: 'Menyiapkan mesin…', done: 'Aset siap', error: 'Gagal memuat aset', failed: 'Periksa koneksi dan izin akses, lalu coba lagi. Input Anda tetap tersimpan.' },
  table: { search: 'Cari data', columns: 'Kolom', rows: 'Baris', density: 'Kerapatan', comfortable: 'Normal', compact: 'Ringkas', copy: 'Salin', page: 'Halaman', of: 'dari', showing: 'Menampilkan', noResults: 'Tidak ada baris yang cocok.', previous: 'Halaman sebelumnya', next: 'Halaman berikutnya', sortAsc: 'Urut naik', sortDesc: 'Urut turun' },
  code: { copy: 'Salin kode', copied: 'Tersalin', error: 'Tidak dapat menyalin', unavailable: 'Izin menyalin belum tersedia', title: 'Kode' }
} satisfies SharedCopy;
