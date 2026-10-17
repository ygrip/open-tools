import { transform } from './process.js';

const get = (id) => document.getElementById(id);
const operation = get('operation');
const input = get('input');
const output = get('output');
const status = get('status');
const run = get('run');

function message(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

operation.addEventListener('change', () => {
  const isQuery = operation.value === 'query';
  get('query-field').hidden = !isQuery;
  get('query-help').hidden = !isQuery;
  input.placeholder = operation.value === 'xml-to-json' ? 'Paste XML here' : 'Paste JSON here';
  output.value = '';
  message('New task selected. Press Run when you are ready.');
});

run.addEventListener('click', async () => {
  run.disabled = true;
  run.setAttribute('aria-busy', 'true');
  output.value = '';
  message('Processing…');
  // Yield one paint so processing feedback appears before the synchronous parser runs.
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    output.value = transform(input.value, operation.value, get('query').value);
    message(`All set. ${output.value.length.toLocaleString()} characters, ready to use.`);
  } catch (error) {
    message(error instanceof Error ? error.message : 'Processing failed.', true);
  } finally {
    run.disabled = false;
    run.removeAttribute('aria-busy');
  }
});

get('example').addEventListener('click', () => {
  input.value = operation.value === 'xml-to-json'
    ? '<catalog><item id="1"><name>Notebook</name><price>12.5</price></item><item id="2"><name>Pen</name><price>2</price></item></catalog>'
    : JSON.stringify({ items: [{ name: 'Notebook', price: 12.5 }, { name: 'Pen', price: 2 }], available: true });
  output.value = '';
  message('Example loaded. Press Run to try it out.');
  input.focus();
});

get('clear').addEventListener('click', () => {
  input.value = '';
  output.value = '';
  message('Fresh start. Paste something new when you are ready.');
  input.focus();
});

get('select-output').addEventListener('click', () => {
  if (!output.value) {
    message('First, run a task so there is something to copy.');
    return;
  }
  output.focus();
  output.select();
  message('Output selected. Press Ctrl+C or Command+C to copy.');
});
