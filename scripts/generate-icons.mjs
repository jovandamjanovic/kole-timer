import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const iconsDir = path.join(projectRoot, 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const svgPath = path.join(projectRoot, 'scripts', 'icon.svg');
const sourceSvg = fs.readFileSync(svgPath, 'utf8');

const pngSizes = [192, 512];

for (const size of pngSizes) {
  await sharp(Buffer.from(sourceSvg)).resize(size, size).png().toFile(path.join(iconsDir, `icon-${size}.png`));
}

await sharp(Buffer.from(sourceSvg))
  .resize(512, 512)
  .flatten({ background: { r: 0, g: 0, b: 0, alpha: 1 } })
  .png()
  .toFile(path.join(iconsDir, 'maskable-512.png'));

await sharp(Buffer.from(sourceSvg))
  .resize(180, 180)
  .flatten({ background: { r: 0, g: 0, b: 0, alpha: 1 } })
  .png()
  .toFile(path.join(iconsDir, 'apple-touch-icon.png'));

await sharp(Buffer.from(sourceSvg))
  .resize(32, 32)
  .png()
  .toFile(path.join(iconsDir, 'favicon-32.png'));
