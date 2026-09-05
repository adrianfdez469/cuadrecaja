import type { PillHue } from "@/components/StatusPill";
import type {
  QAB_ORDER_CANCELLED_BY,
  QAB_ORDER_STATUSES,
} from "@/constants/qab";
import {
  TIENDA_ONLINE_DELIVERY_PRESENTATION,
  TIENDA_ONLINE_ORDER_AMOUNT_KIND,
  TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH,
} from "@/constants/tiendaOnline";
import type {
  ITiendaOnlineOrderAmounts,
  ITiendaOnlineRateSnapshotInfo,
} from "@/schemas/tiendaOnline";
import { LOCALE, getNumberFormat } from "@/utils/numberFormat";

/**
 * What the merchant reads on the two screens of the orders inbox.
 *
 * A `.ts` and not a `.tsx`, and that is the whole point: no symbol living in a
 * `.tsx` can be imported from a test (E-015), and the logic that decides the
 * words is exactly the logic worth pinning. `PillHue` comes in with
 * `import type` for the same reason — `StatusPill.tsx` carries `"use client"`,
 * and a value import would drag it into the test graph and take the file down
 * during collection (E-015 and E-019 at once).
 *
 * The Spanish copy lives HERE, next to the branch that returns it, exactly as
 * `publicationPresentation.ts` does with «Publicado» and «Despublicado».
 */

/* ---- the delivery label -------------------------------------------------- */

export type ITiendaOnlineDeliveryPresentation =
  (typeof TIENDA_ONLINE_DELIVERY_PRESENTATION)[keyof typeof TIENDA_ONLINE_DELIVERY_PRESENTATION];

/** PURE. True when a fixed-scale amount string is zero, sign included. */
export function isZeroAmount(value: string): boolean {
  return /^-?0+(\.0+)?$/.test(value);
}

/**
 * PURE. Which of the three delivery labels this order gets.
 *
 * PENDING_QUOTE when `amounts.kind` says the delivery has not been quoted;
 * otherwise FREE when `deliveryFee` is zero, and CHARGED when it is not.
 *
 * The zero comparison lives INSIDE the quoted branch on purpose: that is the one
 * place where comparing with zero means what it looks like. Outside it, the same
 * comparison is the shortcut acceptance criterion 4 exists to break (ADR 0059).
 */
export function presentTiendaOnlineDelivery(
  amounts: ITiendaOnlineOrderAmounts,
): ITiendaOnlineDeliveryPresentation {
  if (amounts.kind === TIENDA_ONLINE_ORDER_AMOUNT_KIND.pendingQuote) {
    return TIENDA_ONLINE_DELIVERY_PRESENTATION.pendingQuote;
  }
  return isZeroAmount(amounts.deliveryFee)
    ? TIENDA_ONLINE_DELIVERY_PRESENTATION.free
    : TIENDA_ONLINE_DELIVERY_PRESENTATION.charged;
}

/* ---- `status` and `cancelledBy`, which are FREE TEXT (ADR 0004) ---------- */

/** U+2026, appended to a code this module had to cut. */
const ELLIPSIS = "…";

/**
 * PURE. Normalised form of a code this module has no translation for:
 * underscores to spaces, lower-cased, first letter upper-cased, and TRUNCATED to
 * TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH with an ellipsis (U+2026) when longer.
 * `READY_FOR_PICKUP` -> `Ready for pickup`.
 *
 * ONE definition, called by both `orderStatusPresentation` and
 * `cancelledByLabel`: the same rule written twice drifts the first time somebody
 * tunes the truncation (E-014).
 *
 * The cap is not cosmetic. `status` is free text in our own table, so nothing
 * stops a 500-character value from arriving, and an untruncated one takes the
 * whole row with it at 296 px.
 */
export function normalizeUnknownCode(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  const capitalised =
    spaced.length === 0 ? spaced : spaced[0].toUpperCase() + spaced.slice(1);

  if (capitalised.length <= TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH) {
    return capitalised;
  }
  // The cap counts the ellipsis: what comes out is never longer than
  // TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH, mark included.
  return (
    capitalised.slice(0, TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH - ELLIPSIS.length) +
    ELLIPSIS
  );
}

export interface IOrderStatusPresentation {
  label: string;
  hue: PillHue;
  /**
   * The status is one this module translates. `false` means `label` came from
   * `normalizeUnknownCode`, and it is what lets the DETAIL add its «this status
   * is new» line without re-deriving the question — which is the paraphrase
   * E-014 is about. The listing ignores it.
   */
  known: boolean;
}

/**
 * The nine states of today, typed against `QAB_ORDER_STATUSES` so a value that
 * is not one of them does not compile.
 *
 * `CANCELLED` is `neutral` and not `negative`: an order the buyer cancelled, or
 * one that expired, is an ordinary outcome of the flow. `negative` is reserved
 * for `REJECTED_BY_STORE`, which is a decision somebody will have to answer for.
 * `accent` never appears: violet is reserved for action and selection.
 */
const KNOWN_STATUS_PRESENTATION: Record<
  (typeof QAB_ORDER_STATUSES)[number],
  { label: string; hue: PillHue }
> = {
  PENDING: { label: "Sin confirmar", hue: "neutral" },
  PULLED: { label: "Sin atender", hue: "caution" },
  CONFIRMED: { label: "Confirmado", hue: "info" },
  AWAITING_CUSTOMER: { label: "Esperando al comprador", hue: "caution" },
  READY: { label: "Listo", hue: "info" },
  IN_TRANSIT: { label: "En camino", hue: "info" },
  DELIVERED: { label: "Entregado", hue: "positive" },
  CANCELLED: { label: "Cancelado", hue: "neutral" },
  REJECTED_BY_STORE: { label: "Rechazado por la tienda", hue: "negative" },
};

/**
 * PURE. The pill of one order status.
 *
 * A value this module does not know is NOT collapsed into a generic label: it
 * comes back as `normalizeUnknownCode(status)` with `hue: "neutral"` and
 * `known: false`. That is a deliberate exception to what F-006 does with an
 * untranslated code: an error code says nothing to the merchant, but a status is
 * the NAME OF A SITUATION, and three new ones all painted «Estado nuevo» make
 * three different orders indistinguishable.
 *
 * A lookup, not an exhaustive `switch`: there is nothing to forget a `default`
 * on (ADR 0004).
 */
export function orderStatusPresentation(
  status: string,
): IOrderStatusPresentation {
  const known = Object.prototype.hasOwnProperty.call(
    KNOWN_STATUS_PRESENTATION,
    status,
  )
    ? KNOWN_STATUS_PRESENTATION[status as (typeof QAB_ORDER_STATUSES)[number]]
    : undefined;

  if (known) return { ...known, known: true };
  return { label: normalizeUnknownCode(status), hue: "neutral", known: false };
}

/** The three values of today. Same typing guard as the statuses. */
const KNOWN_CANCELLED_BY: Record<
  (typeof QAB_ORDER_CANCELLED_BY)[number],
  string
> = {
  CUSTOMER: "El comprador",
  EXPIRY: "Vencimiento",
  STORE: "La tienda",
};

/**
 * PURE. The label of a `cancelledBy` value. Same treatment as the status: three
 * known values, and anything else through `normalizeUnknownCode`.
 *
 * Takes a NON-NULL string. The row only exists when `cancelledBy !== null`, and
 * that guard belongs to the component, not here: a function that returns a label
 * for «no cancellation» invites printing one.
 */
export function cancelledByLabel(cancelledBy: string): string {
  const known = Object.prototype.hasOwnProperty.call(
    KNOWN_CANCELLED_BY,
    cancelledBy,
  )
    ? KNOWN_CANCELLED_BY[cancelledBy as (typeof QAB_ORDER_CANCELLED_BY)[number]]
    : undefined;

  return known ?? normalizeUnknownCode(cancelledBy);
}

/* ---- money and quantities, which arrive as STRINGS ----------------------- */

/**
 * The locale's decimal separator, read once and never written as a literal
 * comma. `formatToParts` is what exposes it without guessing.
 */
const DECIMAL_SEPARATOR =
  getNumberFormat(LOCALE)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value ?? ".";

/**
 * Groups thousands and nothing else: the decimals never pass through here.
 *
 * `useGrouping: "always"` and not the default. Spanish sets
 * `minimumGroupingDigits: 2`, so `1250` would come back ungrouped as `1250` and
 * the worked example of the contract — `1.250,00 CUP` — would not hold. The
 * separator of an amount must not depend on how many digits it happens to have.
 */
function groupIntegerPart(digits: string): string {
  return getNumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: "always",
  }).format(Number(digits));
}

/** Sign, integer digits and decimal digits of a fixed-scale amount string. */
function splitFixedScale(value: string): {
  sign: string;
  whole: string;
  fraction: string;
} {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  return { sign: negative ? "-" : "", whole, fraction };
}

/**
 * PURE. A fixed-scale amount string plus its currency code, formatted for
 * reading: `("1250.00", "CUP")` -> `1.250,00 CUP`.
 *
 * It does NOT reuse `formatMontoEnMoneda`, and that is the whole point: that one
 * takes a `number`, and calling `Number()` on the way in would put a double in
 * the ONE path where the cent is the subject of the entire feature (ADR 0060).
 *
 * The sign is split off first, ONLY the integer part is grouped, and the two
 * decimals are appended VERBATIM from the input string behind the locale's
 * decimal separator, so `"-0.50"` does not come out as `0,50`.
 *
 * The currency code is appended ALWAYS, on every amount. A line may be priced in
 * a different currency than its order, and a bare number in the wrong currency is
 * the kind of noise that costs money.
 */
export function formatOrderAmount(amount: string, currencyCode: string): string {
  const { sign, whole, fraction } = splitFixedScale(amount);
  const grouped = groupIntegerPart(whole);
  const decimals = fraction.length === 0 ? "" : `${DECIMAL_SEPARATOR}${fraction}`;
  return `${sign}${grouped}${decimals} ${currencyCode}`;
}

/**
 * PURE. Same treatment for a fixed-scale quantity string, with no currency code
 * and with TRAILING ZEROS REMOVED: `"2.000"` -> `2`, `"1.500"` -> `1,5`,
 * `"0.125"` -> `0,125`. A quantity that ends up with no decimals loses the
 * separator too.
 */
export function formatOrderQuantity(quantity: string): string {
  const { sign, whole, fraction } = splitFixedScale(quantity);
  const trimmed = fraction.replace(/0+$/, "");
  const grouped = groupIntegerPart(whole);
  const decimals = trimmed.length === 0 ? "" : `${DECIMAL_SEPARATOR}${trimmed}`;
  return `${sign}${grouped}${decimals}`;
}

/* ---- the five counted texts, each with TWO written forms ----------------- */

/**
 * The five texts of these screens that count something. Each one has two written
 * forms — one for `1` and one for the rest — and NOT one template with a single
 * form: `{n} líneas` with `n = 1` prints «1 líneas», which is the failure F-020
 * found when it applied the E-016 review.
 *
 * The count is rendered as a plain integer, with no grouping: the design's
 * criteria cite these strings literally, and a `1.000` from a thousands
 * separator would not match what they cite.
 */
export function unattendedCountLabel(count: number): string {
  if (count === 1) return "1 sin atender";
  return `${count} sin atender`;
}

export function unassignedTitle(count: number): string {
  if (count === 1) return "1 pedido no se puede mostrar";
  return `${count} pedidos no se pueden mostrar`;
}

export function conversionMismatchTitle(count: number): string {
  if (count === 1) return "1 línea no cuadra con la tasa guardada";
  return `${count} líneas no cuadran con la tasa guardada`;
}

export function lineCountLabel(count: number): string {
  if (count === 1) return "1 línea";
  return `${count} líneas`;
}

/**
 * The label of the lines block, ALREADY UPPER-CASED.
 *
 * `SectionLabel` paints with `text-transform: uppercase`, and CSS does not touch
 * `textContent`: a criterion copied from the design table would look for
 * `PRODUCTOS (4)` in a DOM that says `Productos (4)`. Zero falls in the plural
 * branch, which is what Spanish does with «0 productos».
 */
export function productsSectionLabel(count: number): string {
  if (count === 1) return "PRODUCTO (1)";
  return `PRODUCTOS (${count})`;
}

/* ---- dates and provenance ------------------------------------------------ */

/** What is printed in place of a date that is absent or unreadable. */
export const ORDER_DATE_MISSING = "Sin dato";

/**
 * The three date shapes of these screens, each backed by ONE
 * `Intl.DateTimeFormat` built at module level — building one per call is roughly
 * fifty times the cost of using one that exists, which is the whole reason
 * `getNumberFormat` caches.
 */
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const LONG_DATE_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const TIME_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
});

/** The instant behind a string, or `null` when there is none to be had. */
function parseInstant(value: string | null): Date | null {
  if (value === null) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatInstant(
  value: string | null,
  format: Intl.DateTimeFormat,
): string {
  const instant = parseInstant(value);
  return instant === null ? ORDER_DATE_MISSING : format.format(instant);
}

/**
 * PURE. The three date shapes. All three take `string | null` and return
 * `Sin dato` for `null` AND for a value that does not parse as an instant. Only
 * `qabCreatedAt` is actually nullable, but a single behaviour for the three
 * removes the question of which one is allowed to be given a null.
 *
 * A value that does not parse is NEVER printed raw.
 */
export function formatOrderDateShort(value: string | null): string {
  return formatInstant(value, SHORT_DATE_FORMAT);
}

export function formatOrderDateLong(value: string | null): string {
  return formatInstant(value, LONG_DATE_FORMAT);
}

export function formatOrderTime(value: string | null): string {
  return formatInstant(value, TIME_FORMAT);
}

/**
 * PURE. Where the conversion came from, as a sentence, in its two forms: one for
 * a `capturedAt` that parses as an instant and one for a `capturedAt` that is
 * null or unparseable — which is NOT printed raw either.
 *
 * It names the base currency and the date, and NO RATE: not the `rates` map,
 * which does not travel in the response, and not an «effective rate» computed
 * from two of them. ADR 0060 has the reasoning — a rounded rate does not
 * reproduce the conversion, and publishing one invites asserting
 * `unitPrice = original × rate`, an equality that does not hold in general.
 *
 * WHEN it is shown — `rateSnapshot !== null` and at least one line with
 * `original !== null` — is the component's guard, not this function's.
 */
export function rateSnapshotProvenance(
  info: ITiendaOnlineRateSnapshotInfo,
): string {
  const instant = parseInstant(info.capturedAt);
  if (instant === null) {
    return `Convertido con las tasas que la tienda online guardó al recibir el pedido (base ${info.base}).`;
  }
  return `Convertido con las tasas que la tienda online guardó el ${LONG_DATE_FORMAT.format(instant)} (base ${info.base}).`;
}

/* ---- the fixed copy of the two screens ----------------------------------- */

/**
 * Every remaining sentence, label and column heading of the two screens, in one
 * place and next to the functions above — the same module the design contract
 * makes responsible for the words the merchant reads.
 *
 * The two delivery pills are NOT here: they are the same string in the listing
 * and in the detail, and `TIENDA_ONLINE_LABELS` is where a string shared by two
 * screens of this module lives.
 */
export const TIENDA_ONLINE_ORDER_COPY = {
  /* The listing */
  subtitle: "Los pedidos que entran desde tu tienda online.",
  columnRecibido: "Recibido",
  columnPedido: "Pedido",
  columnLocal: "Local",
  columnEstado: "Estado",
  columnImporte: "Importe",
  sinNombre: "Sin nombre",
  parcial: "Parcial",
  updatedAtPrefix: "Actualizado a las ",
  sinConexion: "Sin conexión",
  autoRefreshPaused: "Actualización automática en pausa",
  actualizar: "Actualizar",
  cargarMas: "Cargar más pedidos",
  noHayMas: "No hay más pedidos.",
  emptyTitle: "Todavía no entró ningún pedido.",
  emptyDescription:
    "Cuando alguien compre en tu tienda online, el pedido entra solo y aparece en esta lista. No hace falta que hagas nada.",
  emptyAction: "Ir a la configuración",
  errorTitle: "No se pudieron cargar los pedidos",
  errorDescription: "Vuelve a intentarlo en un momento.",
  unassignedBody:
    "Alguno de tus locales todavía no está enlazado con tu tienda online. Revisa la configuración de la tienda online, o pídeselo a quien administra el negocio.",

  /* The detail */
  detailTitlePrefix: "Pedido ",
  /** The `h1` while the order is still being fetched: the name, without a code. */
  detailTitleFallback: "Pedido",
  detailReceivedPrefix: "Recibido el ",
  sectionResumen: "RESUMEN",
  sectionContacto: "CONTACTO",
  sectionNotas: "NOTAS DEL COMPRADOR",
  sectionDatos: "DATOS DEL PEDIDO",
  labelSubtotal: "Subtotal",
  labelDescuento: "Descuento aplicado",
  labelEnvio: "Envío",
  envioGratisValue: "Gratis",
  envioPorCotizarValue: "Por cotizar",
  labelTotal: "Total",
  labelTotalParcial: "Total parcial",
  pendingQuoteNote:
    "Todavía falta cotizar el envío, así que este importe puede subir.",
  labelNombre: "Nombre",
  labelTelefono: "Teléfono",
  labelCorreo: "Correo",
  labelDireccion: "Dirección",
  contactoVacio: "—",
  sinContacto: "Sin datos de contacto.",
  labelLocal: "Local",
  labelFechaPedido: "Fecha del pedido",
  labelRecibidoPos: "Recibido en el POS",
  labelEstado: "Estado",
  labelCanceladoPor: "Cancelado por",
  statusUnknownNote:
    "Este estado es nuevo en la tienda online y todavía no tiene traducción.",
  lineColumnProducto: "Producto",
  lineColumnCantidad: "Cant.",
  lineColumnPrecioUnitario: "Precio unit.",
  lineColumnImporte: "Importe",
  precioOriginalPrefix: "Precio original: ",
  conversionMismatchPrefix: "Con la tasa guardada del pedido daría ",
  conversionMismatchBody:
    "El importe que se cobra es el que el comprador aceptó y no cambia. Lo que no coincide es la cuenta que sale de recalcularlo con la tasa que la tienda online guardó al recibir el pedido.",
  detailErrorTitle: "No se pudo cargar el pedido",
  notFoundTitle: "Este pedido ya no está disponible.",
  notFoundDescription:
    "Puede que lo hayan quitado, o que sea de un local al que no tienes acceso.",
  notFoundAction: "Volver a Pedidos",
} as const;
