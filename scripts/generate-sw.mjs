import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, 'out');
const templatePath = path.join(projectRoot, 'scripts', 'sw-template.js');
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'sw.js' || entry.name.endsWith('.map') || entry.name.endsWith('.txt') || entry.name === '.nojekyll') {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath);
      continue;
    }
    files.push(absolutePath);
  }
}

walk(outDir);

const manifest = files
  .map((file) => {
    const relative = path.relative(outDir, file).split(path.sep).join('/');
    const normalized = relative === 'index.html' ? `${basePath}/` : `${basePath}/${relative}`;
    return normalized.replace(/\/+/g, '/');
  })
  .sort();

const contents = fs.readFileSync(templatePath, 'utf8');
const hash = createHash('sha256').update(JSON.stringify(manifest.sort())).digest('hex').slice(0, 12);
const precache = JSON.stringify(manifest, null, 2);
const rendered = contents
  .replace('__VERSION__', hash)
  .replace('__PRECACHE__', precache)
  .replace('__BASE__', basePath || '/');

fs.writeFileSync(path.join(outDir, 'sw.js'), rendered);
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
