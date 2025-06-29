const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Crear el directorio public si no existe
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Tamaños de iconos necesarios
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG base para el icono - un diseño simple de POS
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Fondo con gradiente -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1976d2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1565c0;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="screenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4fc3f7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#29b6f6;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Fondo redondeado -->
  <rect width="512" height="512" rx="80" ry="80" fill="url(#bgGradient)"/>
  
  <!-- Terminal POS -->
  <rect x="80" y="120" width="352" height="280" rx="20" ry="20" fill="#ffffff" stroke="#e0e0e0" stroke-width="4"/>
  
  <!-- Pantalla -->
  <rect x="120" y="160" width="272" height="160" rx="12" ry="12" fill="url(#screenGradient)"/>
  
  <!-- Líneas de la pantalla (simulando interfaz) -->
  <rect x="140" y="180" width="232" height="8" rx="4" fill="#ffffff" opacity="0.9"/>
  <rect x="140" y="200" width="180" height="6" rx="3" fill="#ffffff" opacity="0.7"/>
  <rect x="140" y="220" width="200" height="6" rx="3" fill="#ffffff" opacity="0.7"/>
  <rect x="140" y="240" width="150" height="6" rx="3" fill="#ffffff" opacity="0.7"/>
  
  <!-- Precio grande -->
  <text x="256" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">$99.99</text>
  
  <!-- Teclado/Botones -->
  <rect x="120" y="340" width="60" height="40" rx="8" fill="#f5f5f5" stroke="#ddd" stroke-width="2"/>
  <rect x="200" y="340" width="60" height="40" rx="8" fill="#f5f5f5" stroke="#ddd" stroke-width="2"/>
  <rect x="280" y="340" width="112" height="40" rx="8" fill="#4caf50" stroke="#388e3c" stroke-width="2"/>
  
  <!-- Texto en botón verde -->
  <text x="336" y="365" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ffffff">PAGAR</text>
  
  <!-- Icono de dinero -->
  <circle cx="400" cy="180" r="40" fill="#ffc107" stroke="#ff8f00" stroke-width="4"/>
  <text x="400" y="190" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">$</text>
</svg>
`;

async function generateIcons() {
  console.log('🎨 Generando iconos para PWA...');
  
  // Guardar el SVG base
  const svgPath = path.join(publicDir, 'icon-base.svg');
  fs.writeFileSync(svgPath, svgIcon);
  
  // Generar cada tamaño
  for (const size of sizes) {
    const outputPath = path.join(publicDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(Buffer.from(svgIcon))
        .resize(size, size)
        .png({
          quality: 90,
          compressionLevel: 9
        })
        .toFile(outputPath);
      
      console.log(`✅ Generado: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Error generando icon-${size}x${size}.png:`, error);
    }
  }
  
  // Generar favicon.ico
  try {
    await sharp(Buffer.from(svgIcon))
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon.png'));
    
    console.log('✅ Generado: favicon.png');
  } catch (error) {
    console.error('❌ Error generando favicon:', error);
  }
  
  console.log('🎉 ¡Todos los iconos generados exitosamente!');
}

generateIcons().catch(console.error); 