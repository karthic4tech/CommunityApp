import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const assets = [
  'Home Services Professionals Banner.png',
  'Annamalai University Clock Tower Campus.png',
  'Welcome to Nam Chidambaram.png',
  'pichavaram-image-1.png',
  'hotel-image-lakshmi-villas.png',
  'chidambaram-hero.png',
  'chidambaram-hero1.png',
  'chidambaram-hero2.png',
  'samiyarpettai-beach-1.png',
];

let sourceBytes = 0;
let outputBytes = 0;
let converted = 0;
for (const filename of assets) {
  const source = resolve('public/assets/images', filename);
  const output = source.replace(/\.png$/i, '.webp');
  const sourceStat = await stat(source);
  sourceBytes += sourceStat.size;
  let outputStat;
  try {
    outputStat = await stat(output);
  } catch {
    outputStat = undefined;
  }
  if (!outputStat || outputStat.mtimeMs < sourceStat.mtimeMs) {
    await sharp(source).webp({ quality: 82, effort: 5 }).toFile(output);
    outputStat = await stat(output);
    converted += 1;
  }
  outputBytes += outputStat.size;
}

const reduction = sourceBytes ? Math.round((1 - outputBytes / sourceBytes) * 100) : 0;
console.log(`Optimized ${converted} images: ${(sourceBytes / 1_048_576).toFixed(2)} MiB PNG source set -> ${(outputBytes / 1_048_576).toFixed(2)} MiB WebP (${reduction}% smaller).`);
