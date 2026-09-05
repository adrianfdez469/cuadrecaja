import type { PillHue } from "@/components/StatusPill";
import type { PedidoNoticeHue } from "@/components/tiendaOnline/PedidoNotice";
import type {
  QAB_ORDER_CANCELLED_BY,
  QAB_ORDER_STATUS_FAILURE_CODES,
  QAB_ORDER_STATUSES,
} from "@/constants/qab";
import {
  TIENDA_ONLINE_DELIVERY_PRESENTATION,
  TIENDA_ONLINE_ORDER_AMOUNT_KIND,
  TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH,
} from "@/constants/tiendaOnline";
// Only their SHAPE is needed here, so they come in as types: the vocabularies
// they close are still what the maps below are checked against.
import type {
  TIENDA_ONLINE_ORDER_LANDING_BLOCKERS,
  TIENDA_ONLINE_ORDER_LANDING_EFFECTS,
  TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS,
  TIENDA_ONLINE_PAYMENT_METHODS,
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

  /* F-012 — the actions block of the detail */
  /** `aria-label` of the region every outcome of the PATCH is painted inside. */
  actionsRegionLabel: "Acciones del pedido",
  cambiarEstado: "Cambiar el estado",
  cambiarEstadoTitulo: "Cambiar el estado del pedido",
  /** NOT the dialog's default «Cancelar»: one of the destinations is «Cancelado». */
  volver: "Volver",
  confirmSubtitle: "El comprador lo va a ver en la página de su pedido.",
  confirmBody:
    "Después de esto no vas a poder cambiar el estado de este pedido desde aquí.",
  /* The three reasons there is no control at all, one sentence each. */
  blockedTerminal:
    "Este pedido ya está cerrado: su estado no se puede cambiar desde aquí.",
  blockedAwaitingCustomer:
    "Este pedido está esperando una respuesta del comprador. Hasta que responda, su estado no se cambia desde aquí.",
  /**
   * It does NOT say the status is new: `PENDING` falls in this branch and IS
   * translated, and a sentence starting like `statusUnknownNote` would make a
   * check on either one find the other (E-016).
   */
  blockedUnknownStatus:
    "Este pedido todavía no admite ningún cambio de estado desde aquí.",
  /* The link to the buyer */
  whatsappAction: "Escribirle por WhatsApp",
  /**
   * Written from what the SCREEN observes — there is no link — and never from a
   * cause that lives on the other side: the field arrives null by more than one
   * road (ADR 0066).
   */
  whatsappSinEnlace:
    "La tienda online no dejó un enlace de WhatsApp para este comprador. El teléfono, si lo dejó, está en los datos de contacto.",
  /* While the request is in flight, and the one control that says why it is off */
  reportando: "Avisando a tu tienda online…",
  sinConexionRazon: "Sin conexión.",
  volverAIntentarlo: "Volver a intentarlo",
  /* The three grouped failures. No code, no id, no HTTP number: ADR 0034, E-009. */
  statusNotQuoted:
    "Falta cotizar el envío de este pedido, así que la tienda online no aceptó el cambio. Volver a intentarlo no lo arregla: mientras falta cotizar el envío, el cambio se rechaza igual. Cotizar todavía no se hace desde esta pantalla.",
  statusNotLinked:
    "Tu tienda online todavía no está enlazada con este negocio, así que el pedido sigue como estaba. Revisa la configuración de la tienda online, o pídeselo a quien administra el negocio.",
  statusUpstreamFailed:
    "No se pudo avisar a tu tienda online, así que el pedido sigue como estaba. El comprador no vio ningún cambio.",
  statusOffline:
    "Sin conexión. El cambio no salió de este dispositivo y el pedido sigue como estaba. Vuelve a intentarlo cuando tengas señal.",
  statusFailed:
    "No se pudo cambiar el estado y el pedido sigue como estaba. Vuelve a intentarlo en un momento.",

  /* F-014 — the delivery dialog */
  /** `aria-label` of the group of the two payment methods. */
  pagoGrupo: "Forma de pago",
  /** A question, not a section label: it is NOT painted in small caps. */
  pagoPregunta: "¿Cómo se cobró este pedido?",
  /** The SAME word the POS gives this field. Two names for one field is two vocabularies. */
  pagoDestinoLabel: "Destino",
  /**
   * Written from what the SCREEN observes: there is no destination to declare,
   * and `pedidoEntrantePagoSchema` requires one for a transfer. It names the
   * place instead of linking to it — navigating out of a dialog loses a
   * half-made declaration.
   */
  pagoSinDestinos:
    "Este local no tiene destinos de transferencia configurados, así que un cobro por transferencia no se puede registrar todavía. Créalos en Destinos de Transferencia, o registra el cobro en efectivo.",
  /* Why `Cambiar el estado` is still off, and it disappears when it stops explaining. */
  pagoFaltaMetodo: "Elige cómo se cobró este pedido para poder registrarlo.",
  pagoFaltaDestino: "Elige a qué destino entró la transferencia.",
  /** Header of the second notice. The lines themselves are `orderLandingSkipLines`. */
  landingSkipTitle:
    "Hay líneas de este pedido que no se pudieron descontar del inventario. Revísalo y ajústalo a mano si hace falta:",
} as const;

/* ---- F-012: the texts that interpolate, and the grouping of the failures -- */

/**
 * PURE. The title of the confirmation asked for a destination the order cannot
 * come back from. Takes the STATUS and reads its label from
 * `orderStatusPresentation`, so the words are the ones F-011 already chose.
 */
export function orderStatusConfirmTitle(target: string): string {
  return `¿Marcar este pedido como «${orderStatusPresentation(target).label}»?`;
}

/**
 * PURE. QAB accepted and the local row was written. It talks about EL COMPRADOR
 * from its first word; the divergence notice below talks about LA TIENDA ONLINE,
 * so a check on one never matches the other (E-016).
 */
export function orderStatusAppliedNotice(label: string): string {
  return `El comprador ya ve este pedido como «${label}».`;
}

/**
 * PURE. QAB accepted and this POS did not write it (ADR 0063). It names both
 * states with their own labels, calls neither of them a failure, and says how to
 * recover: pressing again is safe because the contract allows reporting the same
 * status twice.
 */
export function orderStatusDivergedNotice(
  reportedLabel: string,
  currentLabel: string,
): string {
  return `La tienda online ya tiene este pedido como «${reportedLabel}», pero este POS todavía lo tiene como «${currentLabel}». Vuelve a intentarlo cuando puedas: repetir el cambio es seguro y deja las dos partes iguales.`;
}

/**
 * PURE. The sentence F-011 dictated for a control this session may not use. It
 * is OURS and not the server's: `axiosClient` destroys the body of any 403, so
 * the real reason never reaches the browser (E-009).
 */
export function orderManageDeniedNotice(tiendaNombre: string): string {
  return `No puedes gestionar los pedidos de este local: hace falta el permiso de gestión en ${tiendaNombre}. Pídeselo a quien administra el negocio.`;
}

type IQabOrderStatusFailureCodeValue =
  (typeof QAB_ORDER_STATUS_FAILURE_CODES)[number];

/**
 * The three groups the ten failure codes collapse into. Ten sentences would be
 * ten diagnoses the person at the counter cannot act on; these three are the two
 * the ADR 0064 asks to keep apart, plus everything else.
 */
type IOrderStatusFailureGroup = "NOT_QUOTED" | "NOT_LINKED" | "GENERIC";

const NOT_QUOTED_CODE =
  "ORDER_DELIVERY_NOT_QUOTED" satisfies IQabOrderStatusFailureCodeValue;
const NOT_LINKED_CODES = [
  "NOT_CONFIGURED",
  "SYNC_NOT_CONFIGURED",
] as const satisfies ReadonlyArray<IQabOrderStatusFailureCodeValue>;

/**
 * PURE. Which group a `qabError` belongs to. TOTAL over any string: a code the
 * vocabulary grows tomorrow falls into GENERIC instead of breaking the screen,
 * exactly as `orderStatusPresentation` does with an unknown status.
 */
function orderStatusFailureGroup(qabError: string): IOrderStatusFailureGroup {
  if (qabError === NOT_QUOTED_CODE) return "NOT_QUOTED";
  if ((NOT_LINKED_CODES as readonly string[]).includes(qabError)) {
    return "NOT_LINKED";
  }
  return "GENERIC";
}

const FAILURE_COPY: Record<IOrderStatusFailureGroup, string> = {
  NOT_QUOTED: TIENDA_ONLINE_ORDER_COPY.statusNotQuoted,
  NOT_LINKED: TIENDA_ONLINE_ORDER_COPY.statusNotLinked,
  GENERIC: TIENDA_ONLINE_ORDER_COPY.statusUpstreamFailed,
};

const FAILURE_HUE: Record<IOrderStatusFailureGroup, PedidoNoticeHue> = {
  // Nothing is broken and nothing was lost: a datum is missing.
  NOT_QUOTED: "caution",
  NOT_LINKED: "caution",
  GENERIC: "negative",
};

/**
 * Whether the screen may offer the button again AT ALL for this group.
 *
 * It is NOT `retryable`, which comes in the body of the 502 and is never
 * recomputed here (E-014): it is the coarser question of whether repeating makes
 * sense for this kind of failure. Only GENERIC defers to `retryable`; the other
 * two never offer it, and for NOT_QUOTED that is acceptance criterion 4 in its
 * visible form.
 */
const FAILURE_OFFERS_RETRY: Record<IOrderStatusFailureGroup, boolean> = {
  NOT_QUOTED: false,
  NOT_LINKED: false,
  GENERIC: true,
};

/** PURE. The sentence a `qabError` is shown as. Total over any string. */
export function orderStatusFailureCopy(qabError: string): string {
  return FAILURE_COPY[orderStatusFailureGroup(qabError)];
}

/** PURE. The hue that sentence is painted in. Total over any string. */
export function orderStatusFailureHue(qabError: string): PedidoNoticeHue {
  return FAILURE_HUE[orderStatusFailureGroup(qabError)];
}

/** PURE. Whether this kind of failure may show a retry control at all. */
export function orderStatusFailureOffersRetry(qabError: string): boolean {
  return FAILURE_OFFERS_RETRY[orderStatusFailureGroup(qabError)];
}

/* -------------------------------------------------------------------------- */
/* F-014 — declaring the collection, and saying what landed                    */
/* -------------------------------------------------------------------------- */

/**
 * The two payment methods, as words. Typed against the constant of the
 * interface contract, so a value too many or too few does NOT compile.
 *
 * These are literally the two strings the POS already prints — in
 * `AddPaymentSheet`, `PaymentCard`, `SaleDoneView`, `VentaDetailDialog` and
 * `SaleExtrasSummary`, always as the same inline ternary. This feature does not
 * invent vocabulary: it reuses what is already in five places and puts it, for
 * the first time, in a named map instead of a sixth ternary.
 */
export const TIENDA_ONLINE_PAYMENT_METHOD_LABELS: Record<
  (typeof TIENDA_ONLINE_PAYMENT_METHODS)[number],
  string
> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
};

/**
 * PURE. The line above the choice, in its two written forms.
 *
 * A `null` amount is the order whose delivery nobody has quoted yet: that
 * branch of the DTO has no `total`, and printing a zero, a dash or the partial
 * dressed up as final is the shortcut F-011 §14 exists to break. NOT saying a
 * number that does not exist is not a guard — it is not lying. The destination
 * is still offered, the dialog still opens and the request still leaves.
 */
export function orderDeliverySaleNotice(formattedAmount: string | null): string {
  if (formattedAmount === null) {
    return "Se va a registrar la venta de este pedido en el cierre de caja de este local.";
  }
  return `Se va a registrar un cobro de ${formattedAmount} en el cierre de caja de este local.`;
}

/**
 * The tail the four blocked sentences share, and it is deliberate: the guard of
 * ADR 0073 exists precisely so that nothing is called and nothing is written,
 * and that is the fact that takes the fright out of the message.
 */
const NOTHING_LEFT_THIS_POS =
  "El cambio no llegó a salir de este POS y el pedido no cambió de estado en ninguna de las dos partes.";

/** `Cambiar el estado`, interpolated from the SAME constant that paints the button. */
const CAMBIAR_ESTADO_QUOTED = `«${TIENDA_ONLINE_ORDER_COPY.cambiarEstado}»`;

type IOrderLandingBlockerValue =
  (typeof TIENDA_ONLINE_ORDER_LANDING_BLOCKERS)[number];

const BLOCKED_COPY: Record<IOrderLandingBlockerValue, string> = {
  NO_OPEN_PERIOD: `Este local no tiene un período de caja abierto, así que la venta de este pedido no tendría dónde entrar. Ábrelo —o pídeselo a quien lo hace— y vuelve a pulsar ${CAMBIAR_ESTADO_QUOTED}. ${NOTHING_LEFT_THIS_POS}`,
  UNKNOWN_TRANSFER_DESTINATION: `El destino de transferencia que elegiste no es de este local. Vuelve a pulsar ${CAMBIAR_ESTADO_QUOTED} y elige uno de la lista. ${NOTHING_LEFT_THIS_POS}`,
  MISSING_EXCHANGE_RATE: `Este negocio no tiene registrada una tasa de cambio para la moneda de este pedido, así que su importe no se puede convertir sin inventarlo. Regístrala en Tasas de cambio y vuelve a pulsar ${CAMBIAR_ESTADO_QUOTED}. ${NOTHING_LEFT_THIS_POS}`,
};

const BLOCKED_FALLBACK = `Este pedido todavía no se puede registrar como entregado en este POS. ${NOTHING_LEFT_THIS_POS}`;

/**
 * PURE. The sentence one blocked delivery is shown as. TOTAL over any string: a
 * fourth reason added tomorrow falls into the reserve sentence instead of
 * leaving the screen blank. No code, no HTTP number: those are internal
 * vocabulary (ADR 0034, E-009).
 */
export function orderLandingBlockedCopy(reason: string): string {
  const known = Object.prototype.hasOwnProperty.call(BLOCKED_COPY, reason)
    ? BLOCKED_COPY[reason as IOrderLandingBlockerValue]
    : undefined;
  return known ?? BLOCKED_FALLBACK;
}

/** The four effects, typed against the constant so a typo does not compile. */
type IOrderLandingEffectValue =
  (typeof TIENDA_ONLINE_ORDER_LANDING_EFFECTS)[number];

const EFFECT_RESERVE = "RESERVE" satisfies IOrderLandingEffectValue;
const EFFECT_RELEASE = "RELEASE" satisfies IOrderLandingEffectValue;
const EFFECT_SELL = "SELL" satisfies IOrderLandingEffectValue;

/**
 * PURE. The second sentence of the success notice, when there is one.
 *
 * The four rules that shape it:
 *
 * 1. A COUNT OF ZERO IS NEVER PRINTED. «0 productos» reads as a failure and is
 *    not one. And the same zero has two causes — already reserved, or every
 *    line skipped — that only `alreadyLanded` tells apart: asserting one of
 *    them from the count alone is E-013.
 * 2. Singular and plural, always: «1 productos» is E-016 in its cheapest form.
 *    The number goes in as a plain string, NOT through `Intl.NumberFormat`,
 *    which does not group until five digits anyway (E-033).
 * 3. RELEASE with `alreadyLanded` says NOTHING. There the flag covers two
 *    indistinguishable causes — already released, or never reserved — and
 *    naming either would be claiming what is not observed.
 * 4. SELL with `alreadyLanded` names the loss without softening it: the payment
 *    just declared was dropped, and the notice is painted in `caution` for it
 *    (`orderLandingAppliedHue`).
 *
 * TOTAL over any `effect`: an unknown one adds no sentence.
 */
export function orderLandingAppliedNotice(args: {
  label: string;
  effect: string;
  reservedProducts: number;
  saleRegistered: boolean;
  alreadyLanded: boolean;
}): string {
  const first = orderStatusAppliedNotice(args.label);
  const second = landingSecondSentence(args);
  return second === null ? first : `${first} ${second}`;
}

function landingSecondSentence(args: {
  effect: string;
  reservedProducts: number;
  saleRegistered: boolean;
  alreadyLanded: boolean;
}): string | null {
  const { effect, reservedProducts, saleRegistered, alreadyLanded } = args;

  if (effect === EFFECT_RESERVE) {
    if (alreadyLanded) {
      return "El inventario de este pedido ya estaba reservado, así que ahora no se reservó nada más.";
    }
    if (reservedProducts === 1) return "Se reservó el inventario de 1 producto.";
    if (reservedProducts > 1) {
      return `Se reservó el inventario de ${reservedProducts} productos.`;
    }
    return null;
  }

  if (effect === EFFECT_RELEASE) {
    if (alreadyLanded) return null;
    if (reservedProducts === 1) {
      return "Se devolvió al inventario 1 producto que este pedido tenía reservado.";
    }
    if (reservedProducts > 1) {
      return `Se devolvieron al inventario ${reservedProducts} productos que este pedido tenía reservados.`;
    }
    return null;
  }

  if (effect === EFFECT_SELL) {
    if (alreadyLanded) {
      return "Este pedido ya estaba registrado como una venta, así que esta entrega no creó ninguna. La forma de pago que acabas de declarar no se guardó: la que vale es la que declaró quien lo entregó primero.";
    }
    return saleRegistered
      ? "La venta de este pedido quedó registrada en el cierre de caja de este local."
      : null;
  }

  return null;
}

/**
 * PURE. The ink of the success notice. TOTAL over any string.
 *
 * The ONE landing outcome that cannot be green is a delivery that arrived
 * second: the sale already existed, and the payment the person in front of the
 * screen just declared was dropped. That is the only point of these two screens
 * where somebody loses a datum they believed they had saved, and calling it a
 * product decision rather than a component `if` is what makes it provable
 * without a browser. Exact precedent: `orderStatusFailureHue`, same module.
 *
 * It is NOT `negative`: nothing is broken and the order IS delivered.
 */
export function orderLandingAppliedHue(
  effect: string,
  alreadyLanded: boolean,
): PedidoNoticeHue {
  return effect === EFFECT_SELL && alreadyLanded ? "caution" : "positive";
}

type IOrderLandingSkipReasonValue =
  (typeof TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS)[number];

const SKIP_FRAGMENT: Record<IOrderLandingSkipReasonValue, string> = {
  NO_PRODUCT_REFERENCE: "no viene de un producto de tu catálogo",
  PRODUCT_NOT_RESOLVED: "ya no está en el catálogo de este local",
  INSUFFICIENT_STOCK: "no había existencia suficiente en este local",
};

const SKIP_FRAGMENT_FALLBACK = "no se pudo descontar del inventario";

/** What a line is called when its id does not match any loaded line. */
const SKIP_UNNAMED_LINE = "Una línea de este pedido";

/**
 * PURE. One line per order line that did not reach inventory, already composed.
 *
 * TOTAL twice over: an unknown `reason` gets the reserve fragment, and a
 * `lineaId` that matches no loaded line gets a name instead of an exception.
 * The name comes from the order already on screen — the PATCH's body carries
 * only the id — and the two are the same column, `PedidoEntranteLinea.id`.
 *
 * The order is the one the server sent, which is ascending `lineaId`.
 */
export function orderLandingSkipLines(
  skipped: readonly { lineaId: string; reason: string }[],
  nameByLineaId: ReadonlyMap<string, string>,
): string[] {
  return skipped.map((line) => {
    const name = nameByLineaId.get(line.lineaId) ?? SKIP_UNNAMED_LINE;
    const fragment = Object.prototype.hasOwnProperty.call(
      SKIP_FRAGMENT,
      line.reason,
    )
      ? SKIP_FRAGMENT[line.reason as IOrderLandingSkipReasonValue]
      : SKIP_FRAGMENT_FALLBACK;
    return `${name} — ${fragment}.`;
  });
}
