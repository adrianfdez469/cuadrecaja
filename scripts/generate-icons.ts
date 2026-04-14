import sharp from 'sharp';
import path from 'path';

const mainColor = '#1976d2';
const accentColor = '#10b981';
const bg = '#ffffff';

// SVG based on Logo.tsx, scaled to 512x512 with padding and background
function buildSvg(size: number) {
  const padding = size * 0.1;
  const inner = size - padding * 2;
  const scale = inner / 24;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${bg}"/>

  <g transform="translate(${padding}, ${padding}) scale(${scale})">
    <!-- Base -->
    <path d="M3 18H21V21H3V18Z" fill="${mainColor}" fill-opacity="0.3"/>
    <path d="M5 18L7 8H17L19 18H5Z" stroke="${mainColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

    <!-- Screen -->
    <rect x="10" y="10" width="4" height="3" rx="0.5" fill="${mainColor}" fill-opacity="0.2" stroke="${mainColor}" stroke-width="1"/>

    <!-- Check -->
    <path d="M8 12L10 14L14 10" stroke="${accentColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Coins -->
    <circle cx="18" cy="6" r="1.2" fill="${accentColor}"/>
    <circle cx="6" cy="5" r="1" fill="${mainColor}" fill-opacity="0.5"/>
  </g>
</svg>`;
}

async function generate() {
  const publicDir = path.join(process.cwd(), 'public');

  for (const size of [192, 512]) {
    const svg = Buffer.from(buildSvg(size));
    await sharp(svg)
      .png()
      .toFile(path.join(publicDir, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }
}

generate().catch(console.error);
