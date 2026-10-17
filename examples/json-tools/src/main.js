import { transform } from './process.js';

const get = (id) => document.getElementById(id);
const operation = get('operation');
const input = get('input');
const output = get('output');
const status = get('status');
const run = get('run');
const idLabels = {
  '.intro-copy .eyebrow': 'Ruang kerja JSON', '.intro-copy h1': 'Alat JSON',
  '.intro-copy > p:last-child': 'Rapikan, cari, dan ubah datamu langsung di sini.',
  '.local-badge > span': 'Pemrosesan di browser', 'label[for="operation"]': 'Operasi',
  'option[value="pretty"]': 'Rapikan JSON', 'option[value="query"]': 'Kueri JSONPath',
  'option[value="json-to-xml"]': 'JSON ke XML', 'option[value="xml-to-json"]': 'XML ke JSON',
  'label[for="query"]': 'Ekspresi JSONPath', '#run': 'Jalankan', '#example': 'Muat contoh',
  '#clear': 'Bersihkan', '#select-output': 'Pilih hasil', '#input-label': 'Masukan', '#output-label': 'Hasil',
  '.editor:not(.output-editor) .editor-hint': 'Mulai dari sini', '.output-editor .editor-hint': 'Siap untuk langkah berikutnya',
  '#query-help': 'Coba $.items[*].name untuk mengambil semua nama item. Selektor properti, indeks, irisan, wildcard, dan rekursif didukung; evaluasi skrip dan filter dinonaktifkan.',
  '#limits': 'Datamu tetap di dalam ruang ini. Batas masukan 1.000.000 karakter. JSON ke XML menambahkan elemen <root>; nilai teks dan atribut XML tetap berupa string. Bilangan memakai presisi JavaScript; bilangan bulat di luar rentang aman ditolak. Gunakan string untuk desimal presisi dan bilangan bulat besar.'
};
const originals = new Map(Object.keys(idLabels).map((selector) => [selector, document.querySelector(selector)?.textContent]));
const copy = {
  en: { pasteJSON: 'Paste JSON here', pasteXML: 'Paste XML here', result: 'Your result will appear here. No mystery, just data.', welcome: 'Paste your data, choose a task, and press Run. Just exploring? Load an example.', selected: 'New task selected. Press Run when you are ready.', processing: 'Processing…', complete: 'All set. {count} characters, ready to use.', failed: 'Processing failed. Check your input and try again.', example: 'Example loaded. Press Run to try it out.', cleared: 'Fresh start. Paste something new when you are ready.', first: 'First, run a task so there is something to copy.', copied: 'Output selected. Press Ctrl+C or Command+C to copy.' },
  id: { pasteJSON: 'Tempel JSON di sini', pasteXML: 'Tempel XML di sini', result: 'Hasilmu akan tampil di sini.', welcome: 'Tempel data, pilih operasi, lalu tekan Jalankan. Kamu juga bisa memuat contoh.', selected: 'Operasi dipilih. Tekan Jalankan setelah siap.', processing: 'Memproses…', complete: 'Selesai. {count} karakter siap digunakan.', failed: 'Data belum dapat diproses. Periksa masukan dan coba lagi.', example: 'Contoh dimuat. Tekan Jalankan untuk mencobanya.', cleared: 'Sudah bersih. Tempel data baru setelah siap.', first: 'Jalankan operasi terlebih dahulu agar ada hasil yang bisa disalin.', copied: 'Hasil dipilih. Tekan Ctrl+C atau Command+C untuk menyalin.' }
};
const locale = () => document.documentElement.lang === 'id' ? 'id' : 'en';
let lastMessage = 'welcome';
let characterCount = 0;
function message(key, error = false) {
  lastMessage = key;
  status.textContent = copy[locale()][key].replace('{count}', characterCount.toLocaleString(locale()));
  status.classList.toggle('error', error);
}
function localize() {
  const id = locale() === 'id';
  for (const [selector, translated] of Object.entries(idLabels)) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const text = id ? translated : originals.get(selector);
    const node = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (element.querySelector('svg') && node) node.textContent = text;
    else element.textContent = text;
  }
  document.title = id ? 'Alat JSON' : 'JSON Tools';
  document.querySelector('.toolbar-card').setAttribute('aria-label', id ? 'Pilih operasi' : 'Choose an operation');
  document.querySelector('.local-badge').title = id ? 'Datamu tetap di dalam ruang browser ini' : 'Your data stays in this browser frame';
  input.placeholder = copy[locale()][operation.value === 'xml-to-json' ? 'pasteXML' : 'pasteJSON'];
  output.placeholder = copy[locale()].result;
  message(lastMessage, status.classList.contains('error'));
}
localize();
addEventListener('trick-it:localechange', localize);

operation.addEventListener('change', () => {
  const isQuery = operation.value === 'query';
  get('query-field').hidden = !isQuery;
  get('query-help').hidden = !isQuery;
  input.placeholder = copy[locale()][operation.value === 'xml-to-json' ? 'pasteXML' : 'pasteJSON'];
  output.value = '';
  message('selected');
});
run.addEventListener('click', async () => {
  run.disabled = true;
  run.setAttribute('aria-busy', 'true');
  output.value = '';
  message('processing');
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    output.value = transform(input.value, operation.value, get('query').value);
    characterCount = output.value.length;
    message('complete');
  } catch (error) {
    message('failed', true);
    // Parser diagnostics stay local to this opaque frame; never expose stacks.
    if (locale() === 'en' && error instanceof Error) status.textContent = error.message;
  }
  finally { run.disabled = false; run.removeAttribute('aria-busy'); }
});
get('example').addEventListener('click', () => {
  input.value = operation.value === 'xml-to-json'
    ? '<catalog><item id="1"><name>Notebook</name><price>12.5</price></item><item id="2"><name>Pen</name><price>2</price></item></catalog>'
    : JSON.stringify({ items: [{ name: 'Notebook', price: 12.5 }, { name: 'Pen', price: 2 }], available: true });
  output.value = ''; message('example'); input.focus();
});
get('clear').addEventListener('click', () => { input.value = ''; output.value = ''; message('cleared'); input.focus(); });
get('select-output').addEventListener('click', () => {
  if (!output.value) { message('first'); return; }
  output.focus(); output.select(); message('copied');
});
