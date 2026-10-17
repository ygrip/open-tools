import { readFile } from 'node:fs/promises';

/** Extract only the explicitly named scaffold artifacts, never the publishing commands. */
export async function scaffoldFiles() {
  const guide = await readFile(new URL('../docs/scaffold-tool.md', import.meta.url), 'utf8');
  const files = new Map();
  for (const path of ['package.json', '.gitignore', 'tool.manifest.json', 'src/index.html', 'scripts/build.mjs', 'test/bundle.test.mjs']) {
    const marker = `Create \`examples/text-counter/${path}\`:`;
    const start = guide.indexOf(marker);
    const block = start < 0 ? null : guide.slice(start + marker.length).match(/```[^\n]*\n([\s\S]*?)\n```/);
    if (!block) throw new Error(`Missing copyable scaffold artifact: ${path}`);
    files.set(path, `${block[1]}\n`);
  }
  return files;
}
