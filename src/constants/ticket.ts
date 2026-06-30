/** URL fija al pie de todo ticket — no configurable por el negocio */
export const TICKET_FOOTER_URL = "https://cuadrecaja.ventario.cloud";

/** Caracteres por línea según ancho de papel térmico (fuente monospace) */
export const TICKET_CHARS_PER_LINE: Record<58 | 80, number> = {
  58: 32,
  80: 48,
};

/** Stop words omitidas al compactar nombres de productos */
export const TICKET_STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "con",
  "para",
  "en",
]);

/** Máximo de reintentos por job en la cola de impresión */
export const PRINT_QUEUE_MAX_ATTEMPTS = 3;

/** Claves de persistencia local */
export const PRINT_DEVICE_STORAGE_KEY = "print-device:v1";
export const PRINT_TEMPLATE_CACHE_KEY = "print-template-cache:v1";
export const PRINT_QUEUE_STORAGE_KEY = "print-queue:v1";
