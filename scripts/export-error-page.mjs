import { readFile, writeFile } from 'node:fs/promises';

// Static hosts need a standalone fallback as well as SvelteKit's runtime template.
const template = await readFile(new URL('../src/error.html', import.meta.url), 'utf8');
for (const status of [500, 503]) {
  const html = template.replaceAll('%sveltekit.status%', String(status));
  await Promise.all([
    writeFile(new URL(`../build/${status}.html`, import.meta.url), html),
    // Keep Vite's production preview identical to the deployed static output.
    writeFile(new URL(`../.svelte-kit/output/client/${status}.html`, import.meta.url), html)
  ]);
}
console.log('Exported independent 500.html and 503.html fallbacks. Configure matching HTTP status codes on your host.');
