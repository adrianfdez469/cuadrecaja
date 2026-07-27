// Integración con la API pública de tasas de elTOQUE (TRMI — Tasa Representativa
// del Mercado Informal). Docs: https://tasas.eltoque.com/docs/
//
// Términos de uso relevantes:
//  - Hay que referenciar a elTOQUE como fuente de los datos (por eso la UI lleva
//    atribución visible con enlace).
//  - El token no se comparte con terceros → solo se lee server-side.
//  - Los valores son referenciales: aplicarlos es siempre una acción del usuario.

export const ELTOQUE_TRMI_URL = "https://tasas.eltoque.com/v1/trmi";
export const ELTOQUE_SOURCE_URL = "https://eltoque.com/tasas-de-cambio-cuba";

// Isotipo de elTOQUE, servido desde /public. Se usa el isotipo (los dos bocadillos) y
// no el logotipo completo porque el wordmark oficial es blanco sobre transparente:
// resultaría invisible sobre el fondo claro del panel.
export const ELTOQUE_LOGO_SRC = "/eltoque-logo.png";
export const ELTOQUE_FUENTE = "ELTOQUE";

// Vida de la caché en BD. La cuota del token es de ~5.000 peticiones/mes para toda la
// plataforma, así que la caché es global (no por negocio): el primer negocio que
// consulta tras vencer el TTL trae el dato y el resto lo lee de BD.
// 360 min = 4 llamadas/día como máximo entre todos los negocios.
export const ELTOQUE_TTL_MINUTES = 360;

export const ELTOQUE_TIMEOUT_MS = 8000;

// Códigos de elTOQUE → códigos ISO 4217 del catálogo `Moneda`.
// Las monedas ausentes de este mapa (BTC, TRX, USDT_TRC20, BNB…) se descartan:
// no forman parte del catálogo del sistema.
export const ELTOQUE_CURRENCY_MAP: Record<string, string> = {
  USD: "USD",
  ECU: "EUR", // elTOQUE nombra "ECU" al euro
  EUR: "EUR", // por si lo renombran a ISO
  MLC: "MLC",
};
