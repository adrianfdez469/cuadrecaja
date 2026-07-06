/** Texto fijo al pie de todo ticket — no configurable por el negocio */
export const TICKET_FOOTER_URL = "cuadrecaja.ventario.cloud";

/** URL completa para QR de marketing al pie del ticket */
export const TICKET_MARKETING_URL = "https://cuadrecaja.ventario.cloud";

/** Leyenda bajo el QR de marketing */
export const TICKET_MARKETING_QR_LABEL = "Sistema de ventas e inventario";

/** Caracteres por línea según ancho de papel térmico (fuente monospace) */
export const TICKET_CHARS_PER_LINE: Record<58 | 80, number> = {
  58: 32,
  80: 48,
};

/**
 * Renglones de avance al inicio del ticket.
 * Se imprimen como puntos: el driver Windows ignora filas vacías y no avanza papel.
 */
export const TICKET_FEED_LEADING_LINES = 2;

/**
 * Renglones de avance al final del ticket (pie fuera de la impresora).
 * Se imprimen como puntos para forzar altura de página en el spooler.
 */
export const TICKET_FEED_BLANK_LINES = 7;

/** Altura fija por renglón de feed en impresión HTML (mm). */
export const TICKET_FEED_LINE_HEIGHT_MM = 4;

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
export const PRINT_DEVICE_STORAGE_KEY = "print-device:v2";
export const PRINT_TEMPLATE_CACHE_KEY = "print-template-cache:v1";
export const PRINT_QUEUE_STORAGE_KEY = "print-queue:v1";

/** Velocidades serie a probar en el asistente de detección (baud) */
export const SERIAL_BAUD_RATES = [9600, 19200, 38400, 115200] as const;

export const DEFAULT_SERIAL_BAUD_RATE = 9600;
