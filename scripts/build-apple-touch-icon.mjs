#!/usr/bin/env node
/**
 * Build static Apple touch icons + optional animated preview GIF
 * from the LeadPages circle + arrow mark.
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assets = join(__dirname, '..', 'assets');
const BG = '#f6f4ef';
const ACCENT = '#2ecc8f';
const INK = '#13161b';

const OUTER = 'M168.33,229.3c-2.46.17-4.99.23-7.89.23-25.42,0-49.32-9.9-67.3-27.88s-27.88-41.88-27.88-67.3,9.9-49.32,27.88-67.3c17.98-17.98,41.88-27.88,67.3-27.88s49.32,9.9,67.3,27.88c17.98,17.98,27.88,41.88,27.88,67.3,0,3.18,0,5.49-.18,7.85l27.3,8.23c.7-5.33,1.05-10.71,1.05-16.07,0-16.65-3.26-32.8-9.7-48.02-6.21-14.69-15.11-27.88-26.43-39.21-11.32-11.32-24.52-20.22-39.21-26.43-15.22-6.44-31.37-9.7-48.02-9.7s-32.8,3.26-48.02,9.7c-14.69,6.21-27.88,15.11-39.21,26.43s-20.22,24.51-26.43,39.21c-6.44,15.22-9.7,31.37-9.7,48.02s3.26,32.8,9.7,48.02c6.21,14.69,15.11,27.88,26.43,39.21,11.32,11.32,24.51,20.22,39.21,26.43,15.22,6.44,31.37,9.7,48.02,9.7,5.39,0,10.79-.36,16.13-1.06l-8.24-27.34Z';
const INNER = 'M153.23,179.17c-21.62-3.46-38.19-22.25-38.19-44.83,0-25.03,20.37-45.4,45.4-45.4,22.56,0,41.33,16.54,44.82,38.13l25.93,7.81c0-.18,0-.36,0-.54,0-18.9-7.36-36.67-20.72-50.03-13.36-13.36-31.13-20.72-50.03-20.72s-36.67,7.36-50.03,20.72c-13.36,13.36-20.72,31.13-20.72,50.03s7.36,36.67,20.72,50.03c13.36,13.36,31.13,20.72,50.03,20.72.2,0,.4,0,.6,0l-7.81-25.92Z';
const ARROW = 'M331.86,266.49l-53.89-53.89,39.47-17.97c3.07-1.4,4.5-4.84,3.57-8.55-.49-1.94-1.57-3.74-3.02-5.19-1.33-1.33-2.97-2.36-4.75-2.89l-142.93-43.06c-2.95-.89-5.82-.31-7.68,1.55-1.86,1.86-2.44,4.73-1.55,7.68l43.06,142.93c1.12,3.7,4.36,6.82,8.08,7.76,3.72.94,7.16-.49,8.55-3.57l17.97-39.47,53.89,53.89c3.8,3.8,9.38,4.4,12.44,1.34l28.13-28.13c3.06-3.06,2.46-8.64-1.34-12.44Z';

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + [r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('');
}

function frameSvg(innerT, outerT, glow = 0) {
  const innerFill = mix(BG, ACCENT, innerT);
  const outerFill = mix(BG, ACCENT, outerT);
  const glowFilter = glow > 0
    ? `<defs><filter id="g"><feGaussianBlur stdDeviation="${(glow * 6).toFixed(1)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    : '';
  const glowAttr = glow > 0 ? ' filter="url(#g)"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${glowFilter}
  <rect width="1024" height="1024" fill="${BG}"/>
  <g transform="translate(512 502) scale(2.75) translate(-170 -155)">
    <path fill="${outerFill}" d="${OUTER}"${glowAttr}/>
    <path fill="${INK}" d="${ARROW}"/>
    <path fill="${innerFill}" d="${INNER}"${glowAttr}/>
  </g>
</svg>`;
}

async function renderPng(svg, size, outPath) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
}

async function main() {
  const staticSvg = readFileSync(join(assets, 'apple-touch-icon.svg'), 'utf8');
  await renderPng(staticSvg, 1024, join(assets, 'apple-touch-icon.png'));
  await renderPng(staticSvg, 180, join(assets, 'apple-touch-icon-180.png'));
  await renderPng(staticSvg, 192, join(assets, 'apple-touch-icon-192.png'));
  await renderPng(staticSvg, 512, join(assets, 'apple-touch-icon-512.png'));

  // Animated preview (not usable as iOS home-screen icon — static PNG only)
  const frames = 24;
  const frameBuffers = [];
  for (let i = 0; i < frames; i++) {
    const phase = i / frames;
    let innerT = 0;
    let outerT = 0;
    let glow = 0;
    if (phase < 0.2) {
      innerT = 0;
      outerT = 0;
    } else if (phase < 0.45) {
      const t = (phase - 0.2) / 0.25;
      innerT = t;
      outerT = 0;
      glow = t * 0.35;
    } else if (phase < 0.65) {
      const t = (phase - 0.45) / 0.2;
      innerT = 1;
      outerT = t;
      glow = 0.35 + t * 0.25;
    } else if (phase < 0.85) {
      innerT = 1;
      outerT = 1;
      glow = 0.6 - ((phase - 0.65) / 0.2) * 0.6;
    } else {
      const t = (phase - 0.85) / 0.15;
      innerT = 1 - t;
      outerT = 1 - t;
      glow = 0;
    }
    const svg = frameSvg(innerT, outerT, glow);
    const buf = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
    frameBuffers.push(buf);
  }

  try {
    await sharp(frameBuffers, { animated: true }).gif({ delay: 90, loop: 0 }).toFile(join(assets, 'apple-touch-icon-animated.gif'));
    console.log('Wrote apple-touch-icon-animated.gif (preview only — iOS home screen uses static PNG)');
  } catch (gifErr) {
    console.warn('Skipped animated GIF:', gifErr.message);
  }

  console.log('Wrote apple-touch-icon.png (1024), 180/192/512 variants');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
