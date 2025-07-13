// Utilidad para generar un código EAN-13 único
// Prefijo GS1 privado (ejemplo: 779 para Argentina, puedes cambiarlo por uno propio)
// products: array de productos existentes para verificar unicidad

function generateEAN13(existingCodes: Set<string>, prefix = '779', maxAttempts = 1000): string {
  for (let i = 0; i < maxAttempts; i++) {
    // Genera los primeros 12 dígitos (prefijo + random)
    let base = prefix + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
    // Calcula el dígito de control
    let sum = 0;
    for (let j = 0; j < 12; j++) {
      let n = parseInt(base[j], 10);
      sum += (j % 2 === 0) ? n : n * 3;
    }
    let checkDigit = (10 - (sum % 10)) % 10;
    let code = base + checkDigit;
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  throw new Error('No se pudo generar un código único');
}

export default generateEAN13;
