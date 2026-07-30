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
// plataforma (~166/día), así que la caché es global (no por negocio): el primer negocio
// que consulta tras vencer el TTL trae el dato y el resto lo lee de BD.
//
// 60 min = 24 llamadas/día como máximo por el camino automático. Antes eran 360 min,
// pero la TRMI es una mediana móvil que se mueve en minutos: con 6 h de caché el panel
// mostraba números que ya no coincidían con eltoque.com y el botón "Actualizar" no
// podía hacer nada al respecto.
export const ELTOQUE_TTL_MINUTES = 60;

// Piso para el refresco manual (botón "Actualizar"): permite traer un dato más nuevo
// que el TTL normal sin que aporrear el botón queme la cuota.
// 4 llamadas/hora como techo teórico ⇒ 96/día ⇒ ~2.900/mes, dentro de la cuota.
export const ELTOQUE_FORCE_MIN_MINUTES = 15;

export const ELTOQUE_TIMEOUT_MS = 8000;

// elTOQUE limita a 1 petición por segundo (responde 429 con un HTML de Cloudflare).
// Cuando vence el TTL y varias peticiones coinciden, la que pierde reintenta una vez.
export const ELTOQUE_RATE_LIMIT_RETRY_MS = 1500;

// Zona horaria en la que elTOQUE reporta `date`/`hour`/`minutes`/`seconds`. Sin fijarla
// el servidor interpretaría esa hora de pared en SU zona (UTC en Vercel) y el dato
// quedaría corrido 4-5 h.
export const ELTOQUE_TIMEZONE = "America/Havana";

// Códigos de elTOQUE → códigos ISO 4217 del catálogo `Moneda`.
// Las monedas ausentes de este mapa (BTC, TRX, USDT_TRC20, BNB…) se descartan:
// no forman parte del catálogo del sistema.
export const ELTOQUE_CURRENCY_MAP: Record<string, string> = {
  USD: "USD",
  ECU: "EUR", // elTOQUE nombra "ECU" al euro
  EUR: "EUR", // por si lo renombran a ISO
  MLC: "MLC",
};
