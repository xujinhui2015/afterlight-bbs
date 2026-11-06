// 用途：构建静态应用并生成离线资源清单与缓存版本。
// 用法：npm run build。依赖：Node.js 22.12+、Vite。输出：dist/。
import { build } from 'vite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

await build();
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (!['sw.js', 'precache.json'].includes(entry.name)) files.push(path);
  }
}
await walk('dist');
files.sort();
const hash = createHash('sha256');
for (const path of files) { hash.update(path); hash.update(await readFile(path)); }
const version = hash.digest('hex').slice(0, 16);
await writeFile('dist/precache.json', JSON.stringify(['./', ...files.map(path => './' + relative('dist', path).split(sep).join('/'))], null, 2));
const worker = await readFile('dist/sw.js', 'utf8');
await writeFile('dist/sw.js', worker.replaceAll('__BUILD_ID__', version));
console.log(`离线资源清单已生成，共 ${files.length} 个文件，版本 ${version}`);
