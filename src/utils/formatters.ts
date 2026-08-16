/**
 * Utilidades para formatear fechas y monedas de manera consistente
 */

import { LOCALE, formatAmount, formatNumberWith } from "@/utils/numberFormat";

// Configuración de localización para España/Cuba: LOCALE vive en
// numberFormat.ts, que es donde se cachean los Intl.NumberFormat.
const CURRENCY_SYMBOL = "$";
const SECONDARY_CURRENCY = "CUP";

/** Whole units, no decimals — reused so the cache key is always the same. */
const INTEGER_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

/**
 * Formatea una fecha en formato corto (dd/mm/aaaa)
 */
export const formatDate = (date: number | Date): string => {
  return new Date(date).toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/**
 * Formatea una fecha en formato largo (día de mes de año)
 */
export const formatDateLong = (date: string | Date): string => {
  return new Date(date).toLocaleDateString(LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Formatea una hora en formato completo (HH:mm:ss)
 */
export const formatTime = (date: number | Date): string => {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/**
 * Formatea una hora en formato corto (HH:mm)
 */
export const formatTimeShort = (date: number | Date): string => {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Formatea fecha y hora juntas (dd/mm/aaaa • HH:mm)
 */
export const formatDateTime = (date: number | Date): string => {
  const dateStr = formatDate(date);
  const timeStr = formatTime(date);
  return `${dateStr} • ${timeStr}`;
};

/**
 * Verifica si una fecha es hoy
 */
export const isToday = (date: string | Date): boolean => {
  const today = new Date();
  const checkDate = new Date(date);
  return today.toDateString() === checkDate.toDateString();
};

/**
 * Obtiene una fecha relativa (ayer, hoy, mañana, etc.)
 */
export const getRelativeDate = (date: number | Date): string => {
  const today = new Date();
  const checkDate = new Date(date);
  const diffTime = checkDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays === -1) return "Ayer";
  if (diffDays > 1 && diffDays <= 7) return `En ${diffDays} días`;
  if (diffDays < -1 && diffDays >= -7) return `Hace ${Math.abs(diffDays)} días`;

  return formatDate(date);
};

/**
 * Formatea días restantes con texto descriptivo
 */
export const formatDaysRemaining = (days: number): string => {
  if (days <= 0) return "Expirado";
  if (days === 1) return "1 día restante";
  if (days <= 7) return `${days} días restantes`;
  if (days <= 30) return `${days} días restantes`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 semana restante";
  if (weeks <= 4) return `${weeks} semanas restantes`;

  const months = Math.floor(days / 30);
  if (months === 1) return "1 mes restante";
  return `${months} meses restantes`;
};

/**
 * Obtiene el color para mostrar días restantes
 */
export const getDaysRemainingColor = (
  days: number,
): "error" | "warning" | "success" => {
  if (days <= 0) return "error";
  if (days <= 7) return "error";
  if (days <= 30) return "warning";
  return "success";
};

/**
 * Formatea una moneda con símbolo $ (formato principal)
 */
export const formatCurrency = (amount: number): string => {
  if (amount) {
    return `${CURRENCY_SYMBOL}${formatAmount(amount, LOCALE)}`;
  } else {
    return `${CURRENCY_SYMBOL}0.00`;
  }
};

/**
 * Formatea un monto en una moneda explícita (posiblemente distinta de la
 * moneda base del negocio): SIN símbolo "$" — el "$" de formatCurrency()
 * implica monedaBase y mezclarlo con un código de moneda distinto (ej.
 * "$45.00 CUP" mostrando en realidad un monto en USD) confunde en los
 * flujos de caja. Usar esta función siempre que el monto venga acompañado
 * de su propio monedaCode (desgloses multi-moneda, deducciones por moneda).
 */
export const formatMontoEnMoneda = (
  amount: number,
  monedaCode: string,
): string => `${formatAmount(amount || 0, LOCALE)} ${monedaCode}`;

/**
 * Formatea un reparto de vuelto por moneda: "63,00 USD + 225,00 CUP".
 * Respeta el orden de inserción del objeto — quien construye el reparto pone
 * primero la moneda principal, y ese es el orden en que el cajero cuenta el
 * dinero.
 */
export const formatChangeSplit = (
  distribution: Record<string, number>,
): string =>
  Object.entries(distribution)
    .filter(([, amount]) => amount > 0)
    .map(([monedaCode, amount]) => formatMontoEnMoneda(amount, monedaCode))
    .join(" + ");

/**
 * Formatea una moneda con CUP (formato secundario)
 */
export const formatCurrencyCUP = (amount: number): string => {
  return `${formatAmount(amount, LOCALE)} ${SECONDARY_CURRENCY}`;
};

/**
 * Formatea una moneda sin decimales
 */
export const formatCurrencyInteger = (amount: number): string => {
  return `${CURRENCY_SYMBOL}${formatNumberWith(amount, INTEGER_OPTIONS, LOCALE)}`;
};

/**
 * Formatea un número sin símbolo de moneda
 */
export const formatNumber = (amount: number): string => {
  return formatNumberWith(amount, INTEGER_OPTIONS, LOCALE);
};

/**
 * Formatea un número con decimales
 */
export const formatDecimal = (amount: number, decimals: number = 2): string => {
  return formatNumberWith(
    amount,
    { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
    LOCALE,
  );
};

/**
 * Formatea una cantidad de producto: como mucho 2 decimales, sin ceros de
 * relleno — "3", "2.5", "12.6".
 *
 * `existencia` y `cantidad` son Float y el stock se acumula sumando y
 * restando, así que arrastran ruido de coma flotante: en producción hay
 * existencias como 8.69999999999999 y 12.6000000000001, que se pintaban con
 * toda la cola. Redondear con la misma expresión que `clampQuantity` mantiene
 * lo que se muestra alineado con lo que se puede teclear.
 *
 * A diferencia de `formatDecimal`, no rellena con ceros ni agrupa millares:
 * las existencias enteras (lo normal) deben seguir leyéndose "1111".
 */
export const formatQuantity = (value: number): string =>
  // El `+ 0` evita que un residuo negativo minúsculo (los hay en producción,
  // del orden de -1e-16) se imprima como "-0".
  String(Math.round((value || 0) * 100) / 100 + 0);

/**
 * Formatea un porcentaje
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1,
): string => {
  return `${formatNumberWith(
    value,
    { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
    LOCALE,
  )}%`;
};

/**
 * Normaliza un texto para búsquedas: elimina tildes, convierte a minúsculas y colapsa espacios
 */
export const normalizeSearch = (str: string): string =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const sanitizeNumber = (number: number) => {
  // Eliminar 0 del inicio
  if (number) {
    const numberString = number.toString();
    const numberSinCeros = numberString.replace(/^0+/, "");
    return Number(numberSinCeros);
  } else {
    return 0;
  }
};

/**
 * Mensaje de advertencia cuando una compra en EFECTIVO_CAJA superó el
 * efectivo disponible y el backend la dividió en caja + fondeo externo.
 */
export const formatAdvertenciasCaja = (
  advertencias: { moneda: string; disponible: number; fondeoExterno: number }[],
): string =>
  advertencias
    .map(
      (a) =>
        `La compra en ${a.moneda} superó el efectivo en caja (disponible: ${formatMontoEnMoneda(a.disponible, a.moneda)}) — se tomaron ${formatMontoEnMoneda(a.fondeoExterno, a.moneda)} de fondeo externo`,
    )
    .join(". ");

/**
 * Matches a v4-shaped UUID anywhere in a string.
 * Kept loose on the version nibble so older seeded ids still match.
 */
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Makes a stock movement's reason readable.
 *
 * The backend stores the originating sale inside the text — `Venta
 * 587664ec-63a7-436a-adb3-36c1b7f2d2b4` — and the table printed it verbatim,
 * so a 36-character identifier nobody can read pushed every other column
 * sideways. Shortening rather than stripping keeps the row traceable: the
 * first block is enough to match against a sale, and the full id is still on
 * the record.
 *
 * Applied at render time on purpose — the reasons already stored in the
 * database carry the full id, so fixing only the writers would leave every
 * historical row untouched.
 */
export const formatMovimientoMotivo = (motivo: string | null | undefined): string => {
  if (!motivo) return "";
  return motivo.replace(UUID_PATTERN, (id) => `#${id.slice(0, 8)}`).trim();
};
