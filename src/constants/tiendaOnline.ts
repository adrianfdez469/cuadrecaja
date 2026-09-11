/**
 * Single source of the online-store module's strings (F-004).
 *
 * Nobody writes one of these literals anywhere else: the permission keys, the
 * page routes, the API base and the error codes all live here, so a rename can
 * never drift between the Drawer, the pages, the services and the handlers.
 *
 * It imports from `@/constants/qab`, which imports nothing: no cycle is possible
 * (E-028).
 */

import type { QAB_ORDER_STATUSES } from "@/constants/qab";

/** The four permissions of the online-store module. Keys of permisos.json, verbatim. */
export const TIENDA_ONLINE_PERMISOS = {
  configuracionAcceder: "tiendaonline.configuracion.acceder",
  pedidosAcceder: "tiendaonline.pedidos.acceder",
  pedidosGestionar: "tiendaonline.pedidos.gestionar",
  pedidosProponer: "tiendaonline.pedidos.proponer",
} as const;

/**
 * Permissions this tab needs that do NOT belong to the module. There is NO fifth
 * `tiendaonline.*` permission: F-004 closed with four, and acting on a `Producto`
 * is already governed by `operaciones.inventario.acceder` everywhere else.
 */
export const TIENDA_ONLINE_EXTRA_PERMISOS = {
  inventarioAcceder: "operaciones.inventario.acceder",
} as const;

/** Page routes of the module. Used by the Drawer and by any redirect. */
export const TIENDA_ONLINE_ROUTES = {
  configuracion: "/tienda-online/configuracion",
  pedidos: "/tienda-online/pedidos",
} as const;

/** API paths. The base is shared so a rename never drifts between files. */
export const TIENDA_ONLINE_API_BASE = "/api/tienda-online";

/**
 * cuadrecaja's own error codes. Never mirrors a QAB status (ADR 0022).
 * `forbidden` is the ONLY body of every 403 of the module: it does not say which
 * of the two gates refused, on purpose.
 */
export const TIENDA_ONLINE_API_ERRORS = {
  forbidden: "FORBIDDEN",
  invalidBody: "INVALID_BODY",
  pedidoNotFound: "PEDIDO_NOT_FOUND",
  internal: "TIENDA_ONLINE_UNAVAILABLE", // the ONLY body of every 500 of the module
  // F-005
  tiendaNotFound: "TIENDA_NOT_FOUND",
  almacenNotPublishable: "ALMACEN_NOT_PUBLISHABLE",
  openingHoursInvalid: "OPENING_HOURS_INVALID",
  slugUpstream: "QAB_SLUG_UPSTREAM",
  // F-006. `forbidden` stays the ONLY body of every 403 of the module.
  productoNotFound: "PRODUCTO_NOT_FOUND",
  categoriaNotFound: "CATEGORIA_NOT_FOUND",
  bulkTooLarge: "BULK_TOO_LARGE",
  payloadInvalid: "QAB_PAYLOAD_INVALID",
  // F-012. Every QAB-side outcome of the status report leaves under this ONE
  // code, with the specific reason in `qabError` (ADR 0022, ADR 0064).
  // `forbidden` stays the ONLY body of every 403 of the module.
  qabStatusUpstream: "QAB_STATUS_UPSTREAM",
  // F-009. A 503, and NEITHER of the two codes above: a deployment that has not
  // been wired yet is not a server fault, and collapsing it into the generic 500
  // erases the only signal that says what is missing. See ADR 0068.
  ssoNotConfigured: "TIENDA_ONLINE_SSO_NOT_CONFIGURED",
  // F-014. The 409 of a DELIVERED this POS cannot land. `forbidden` stays the
  // ONLY body of every 403 of the module, and `internal` the only one of every 500.
  pedidoNotLandable: "PEDIDO_NOT_LANDABLE",
  // F-023. A 409 and NOT a 403: `axiosClient` replaces the body of every 403
  // with a generic permissions error, so a code that names this cause would
  // never reach the screen (E-009, ADR 0086). `forbidden` stays the ONLY body of
  // every 403 of the module, and `internal` the only one of every 500. This code
  // is ours and mirrors nothing of QAB's (ADR 0022).
  ssoUserNotEmail: "TIENDA_ONLINE_SSO_USER_NOT_EMAIL",
} as const;

/**
 * Prefix of the audit line written once per applied PATCH.
 *
 * It exists because the four `tiendaonline.*` permissions are granted PER STORE
 * while the module and its switch are PER BUSINESS: today a user holding the
 * permission on store A can rewrite store B of the same business. Closing that
 * is F-011's decision (see § 8.2 of the F-005 contract); until then, every write
 * leaves a trace of who did it, on which local, in which business.
 */
export const TIENDA_ONLINE_SAVE_AUDIT_LOG = "TIENDA_ONLINE_LOCAL_SAVED" as const;

/**
 * Numbers the configuration screen needs and that are not design tokens.
 *
 * They live here for the same reason as everything else in this file: a debounce
 * retyped in two components drifts the day one of them is tuned.
 */
export const TIENDA_ONLINE_UI = {
  /** Delay from the last keystroke before the slug forecast is requested. */
  slugForecastDebounceMs: 600,
  /**
   * Delay from the last keystroke before the product listing is requested.
   * NOT `slugForecastDebounceMs`: that one is another query with another cost,
   * and tying them would move both the day one of them is tuned.
   */
  productSearchDebounceMs: 400,
  /** From this length on, the unpublish-reason counter turns to `caution`. */
  unpublishReasonWarnAt: 140,
  /** Default window created when a day is switched from closed to open. */
  defaultWindowFrom: "09:00",
  defaultWindowTo: "18:00",
  /** Start of day, the other end of the "open 24 hours" window. */
  startOfDay: "00:00",
  /**
   * How often the orders inbox asks for its FIRST page again (F-011).
   *
   * 60 s and not 15: the source data does not move faster than the F-010 sync
   * cron, which runs every two minutes, so a shorter cadence is seven identical
   * answers out of eight. And not 120 s: that leaves the worst case at almost
   * four minutes of lag. It lives here because it is a number with a reason,
   * and it is tuned from one place.
   */
  ordersRefreshMs: 60_000,
} as const;

/**
 * Labels shown to the user, in Spanish because they are UI copy.
 *
 * They live here and not inline because of the continuity rule of the design
 * contract: the Drawer row and the `h1` of the page it leads to are THE SAME
 * string. Two literals in two files drift the moment one of them is reworded.
 *
 * `section` doubles as the middle breadcrumb of both pages, which carries no
 * href on purpose: `/tienda-online` is not a route.
 */
export const TIENDA_ONLINE_LABELS = {
  section: "Tienda Online",
  configuracion: "Configuración de la tienda",
  pedidos: "Pedidos",
  /** The two tabs of the configuration screen (F-006). */
  tabLocales: "Locales",
  tabProductos: "Productos",
  /**
   * The two delivery pills of the orders inbox (F-011). The VALUES they answer
   * to are `TIENDA_ONLINE_DELIVERY_PRESENTATION`, fixed by ADR 0059; these are
   * the words, and each one is shown in the listing and in the detail — the same
   * string in two places, which is exactly what this object is for.
   *
   * `CHARGED` has no pill on purpose: a charged delivery is the ordinary case
   * and it already shows its amount in the detail's amount block.
   */
  envioPorCotizar: "Envío por cotizar",
  envioGratis: "Envío gratis",
} as const;

/**
 * The description of the offline state, shared by the two tabs of the
 * configuration screen. It was a literal inside the page until F-006 gave that
 * page a second body: two copies of one sentence drift the first time one of
 * them is reworded.
 */
export const TIENDA_ONLINE_OFFLINE_DESCRIPTION =
  "Esta pantalla necesita conexión para consultar y publicar. Lo que vendas mientras tanto se sigue registrando igual.";

/** Query-string key that selects the active tab, and its two values. */
export const TIENDA_ONLINE_TAB_QUERY_KEY = "tab";
export const TIENDA_ONLINE_TABS = {
  locales: "locales",
  productos: "productos",
} as const;

/* -------------------------------------------------------------------------- */
/* F-011 — the orders inbox                                                    */
/* -------------------------------------------------------------------------- */

/**
 * THE status that means "unattended", and the ONLY place it is written.
 *
 * Typed against QAB_ORDER_STATUSES so a typo does not compile. `status` itself
 * stays free text in the database and in the response: a tenth value QAB adds
 * tomorrow must not break the render (ADR 0004).
 */
export const TIENDA_ONLINE_UNATTENDED_STATUS: (typeof QAB_ORDER_STATUSES)[number] =
  "PULLED";

/**
 * Page size of the orders inbox. It lives here and not in `qab.ts` because this
 * listing never crosses the wire: it is a cuadrecaja-side read of a cuadrecaja
 * table.
 */
export const TIENDA_ONLINE_ORDER_PAGE_SIZE_DEFAULT = 25;
export const TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX = 100;

/**
 * Discriminator of the order amounts. It encodes the delivery state and nothing
 * else, and it is derived from `deliveryFeePending` in ONE place
 * (`toTiendaOnlineOrderAmounts`). See ADR 0059.
 */
export const TIENDA_ONLINE_ORDER_AMOUNT_KIND = {
  quoted: "QUOTED",
  pendingQuote: "PENDING_QUOTE",
} as const;

/**
 * The three delivery labels the screen can show. These are the VALUES; the
 * Spanish copy each one maps to is written in `orderPresentation.ts`, next to
 * the branch that picks it, and its wording belongs to the design contract.
 */
export const TIENDA_ONLINE_DELIVERY_PRESENTATION = {
  pendingQuote: "PENDING_QUOTE",
  free: "FREE",
  charged: "CHARGED",
} as const;

/**
 * Cap on a `status` or a `cancelledBy` this module has no translation for,
 * before an ellipsis is appended (`normalizeUnknownCode`).
 *
 * Both columns are free text in our own table (ADR 0004), so nothing stops a
 * 500-character value from arriving; without a cap it takes the whole row with
 * it on a narrow screen.
 */
export const TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH = 24;

/**
 * The ONLY thing written to the server output when a response fails its own
 * schema. A fixed literal with NO interpolation: a ZodError serialises its
 * issues into `message`, and those issues can carry values of the row being
 * validated — `Order.code` among them (ADR 0061, E-031).
 */
export const TIENDA_ONLINE_ORDER_RESPONSE_INVALID_LOG =
  "TIENDA_ONLINE_ORDER_RESPONSE_INVALID" as const;

/**
 * The description of the offline state of the orders inbox.
 *
 * NOT `TIENDA_ONLINE_OFFLINE_DESCRIPTION`: that one says «para consultar y
 * publicar», and nothing is published on this screen. The second sentence is
 * kept word for word because it is still true and it is the promise the whole
 * application rests on.
 */
export const TIENDA_ONLINE_PEDIDOS_OFFLINE_DESCRIPTION =
  "Esta pantalla necesita conexión para traer los pedidos. Lo que vendas mientras tanto se sigue registrando igual.";

/* -------------------------------------------------------------------------- */
/* F-012 — Reporting an order's progress                                       */
/* -------------------------------------------------------------------------- */

/**
 * Prefix of the ONE line written when QAB accepted and the local write did not
 * land — acceptance criterion 9.
 *
 * The line names the order by its internal `pedidoId` and NEVER by the public
 * code or the third party's id; the function that builds it does not take them
 * as arguments, so it is not a promise (ADR 0063, E-031).
 */
export const TIENDA_ONLINE_ORDER_STATUS_DIVERGED_LOG =
  "TIENDA_ONLINE_ORDER_STATUS_DIVERGED" as const;

/** `cause` of the line above when the update ran and matched no row (E-024). */
export const TIENDA_ONLINE_ORDER_STATUS_NOT_WRITTEN_CAUSE = "NOT_WRITTEN" as const;

/** `cause` when the thrown value carries no usable code. Never its message. */
export const TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE = "UNKNOWN" as const;

/**
 * Upper bound and shape of a `cause` taken from a thrown value's `code`. A log
 * line must not carry an unbounded or free-form string: that is E-031's shape by
 * another route.
 */
export const TIENDA_ONLINE_ORDER_STATUS_CAUSE_PATTERN = /^[A-Z0-9_]{1,16}$/;

/** The three reasons a screen offers no status control at all. See ADR 0065. */
export const TIENDA_ONLINE_ORDER_TRANSITION_BLOCKS = [
  "TERMINAL", // DELIVERED, CANCELLED or REJECTED_BY_STORE
  "AWAITING_CUSTOMER", // a live proposal is waiting on the buyer; F-013's ground
  "UNKNOWN_STATUS", // any value outside the sequence, PENDING included
] as const;

/* -------------------------------------------------------------------------- */
/* F-014 — landing the online order in this POS                                */
/* -------------------------------------------------------------------------- */

/** What a reported destination does to inventory and to the books. */
export const TIENDA_ONLINE_ORDER_LANDING_EFFECTS = [
  "RESERVE", // CONFIRMED
  "RELEASE", // CANCELLED, REJECTED_BY_STORE
  "SELL", // DELIVERED
  "NONE", // READY, IN_TRANSIT
] as const;

/**
 * Why one order line could not be reserved. THREE causes, ONE branch: the line
 * is skipped, counted and reported, and the status change still lands.
 */
export const TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS = [
  "NO_PRODUCT_REFERENCE", // storeProductExternalId is NULL (criterion 12)
  "PRODUCT_NOT_RESOLVED", // it does not resolve to a live ProductoTienda of this store (criterion 13)
  "INSUFFICIENT_STOCK", // the store does not have the units
] as const;

/** Local conditions that make DELIVERED impossible. Checked BEFORE calling QAB. */
export const TIENDA_ONLINE_ORDER_LANDING_BLOCKERS = [
  "NO_OPEN_PERIOD",
  "UNKNOWN_TRANSFER_DESTINATION",
  "MISSING_EXCHANGE_RATE",
  // F-038. The declared debtor does not resolve to a Cliente OF THIS BUSINESS.
  // Cliente hangs from negocioId, NOT from tiendaId: this is the one blocker of
  // the four whose scope is the business and not the store (ADR 0137).
  "UNKNOWN_CLIENTE",
] as const;

/** How the order was collected. ONE method for the whole amount (ADR 0073, ADR 0137). */
export const TIENDA_ONLINE_PAYMENT_METHODS = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CREDITO",
] as const;

/**
 * Prefix of `MovimientoStock.motivo` for both landing movements. It is followed
 * by the ORDER ID and NEVER by `PedidoEntrante.code`, which is the buyer page's
 * public credential (ADR 0061) and `motivo` is shown in the movements list.
 */
export const TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX = "Pedido tienda online";

/* -------------------------------------------------------------------------- */
/* F-038 — CREDITO, the third method of a DELIVERED                            */
/* -------------------------------------------------------------------------- */

/** What an extra field of `pago` can be for a method. */
export const TIENDA_ONLINE_PAYMENT_FIELD_RULES = ["REQUIRED", "FORBIDDEN"] as const;

/** The extra fields of `pago`, in the order they are validated. */
export const TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS = [
  "transferDestinationId",
  "clienteId",
] as const;

/**
 * Which extra field each payment method REQUIRES and which it FORBIDS. THE ONE
 * definition of the nine combinations: the schema loops over it, and nothing
 * else states the rule in its own words (E-014, E-039).
 *
 * `Record<…>` over both constants on purpose: a FOURTH method, or a THIRD extra
 * field, does not compile until its rule is decided here. That is the hole the
 * two-branch xor of ADR 0073 left open and this table closes — with three
 * methods that xor kept accepting the third one by accident, and knew nothing
 * at all about `clienteId`.
 */
export const TIENDA_ONLINE_PAYMENT_METHOD_FIELDS = {
  EFECTIVO: {
    transferDestinationId: "FORBIDDEN",
    clienteId: "FORBIDDEN",
  },
  TRANSFERENCIA: {
    transferDestinationId: "REQUIRED",
    clienteId: "FORBIDDEN",
  },
  CREDITO: {
    transferDestinationId: "FORBIDDEN",
    clienteId: "REQUIRED",
  },
} as const satisfies Record<
  (typeof TIENDA_ONLINE_PAYMENT_METHODS)[number],
  Record<
    (typeof TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS)[number],
    (typeof TIENDA_ONLINE_PAYMENT_FIELD_RULES)[number]
  >
>;

/**
 * The Zod issue message of each extra field. NOT an HTTP body: the PATCH answers
 * `400 { error: "INVALID_BODY" }` and never returns `parsed.error.issues`, so
 * these strings only ever reach a caller of `.safeParse` (E-069). English, like
 * every other message in this schema module.
 */
export const TIENDA_ONLINE_PAYMENT_FIELD_MESSAGES = {
  transferDestinationId:
    "transferDestinationId is required for TRANSFERENCIA and forbidden for EFECTIVO and CREDITO",
  clienteId:
    "clienteId is required for CREDITO and forbidden for EFECTIVO and TRANSFERENCIA",
} as const satisfies Record<
  (typeof TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS)[number],
  string
>;

/**
 * The `code` of the throw that aborts a credit landing whose debtor did not come
 * back from the tenant-scoped query. Sixteen characters at most and `[A-Z0-9_]`
 * only, so TIENDA_ONLINE_ORDER_STATUS_CAUSE_PATTERN accepts it and
 * `orderStatusWriteFailureCause` names it in the divergence line instead of
 * collapsing it into the unknown cause.
 *
 * FROZEN LITERAL. It measures EXACTLY the 16 characters the pattern allows, with
 * no margin left: any rename one character longer stops matching and the cause
 * silently degrades to the unknown one. Renaming it is a decision, not an edit.
 */
export const TIENDA_ONLINE_CREDIT_TENANT_ERROR = "CREDIT_NO_TENANT" as const;
