const GS = 0x1d;

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Imprime código QR (modelo 2) vía comandos ESC/POS estándar */
export function encodeQrEscPos(data: string, moduleSize = 5): Uint8Array {
  const dataBytes = new TextEncoder().encode(data);
  const storeLen = dataBytes.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;

  const model = new Uint8Array([
    GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
  ]);
  const size = new Uint8Array([
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize,
  ]);
  const errorCorrection = new Uint8Array([
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
  ]);
  const store = new Uint8Array([
    GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes,
  ]);
  const print = new Uint8Array([
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
  ]);

  return concat(model, size, errorCorrection, store, print);
}
