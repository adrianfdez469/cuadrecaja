/**
 * Single source of the online-store module's strings (F-004).
 *
 * Nobody writes one of these literals anywhere else: the permission keys, the
 * page routes, the API base and the error codes all live here, so a rename can
 * never drift between the Drawer, the pages, the services and the handlers.
 */

/** The four permissions of the online-store module. Keys of permisos.json, verbatim. */
export const TIENDA_ONLINE_PERMISOS = {
  configuracionAcceder: "tiendaonline.configuracion.acceder",
  pedidosAcceder: "tiendaonline.pedidos.acceder",
  pedidosGestionar: "tiendaonline.pedidos.gestionar",
  pedidosProponer: "tiendaonline.pedidos.proponer",
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
  notImplemented: "NOT_IMPLEMENTED",
  internal: "TIENDA_ONLINE_UNAVAILABLE", // the ONLY body of every 500 of the module
  // F-005
  tiendaNotFound: "TIENDA_NOT_FOUND",
  almacenNotPublishable: "ALMACEN_NOT_PUBLISHABLE",
  openingHoursInvalid: "OPENING_HOURS_INVALID",
  slugUpstream: "QAB_SLUG_UPSTREAM",
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
  /** From this length on, the unpublish-reason counter turns to `caution`. */
  unpublishReasonWarnAt: 140,
  /** Default window created when a day is switched from closed to open. */
  defaultWindowFrom: "09:00",
  defaultWindowTo: "18:00",
  /** Start of day, the other end of the "open 24 hours" window. */
  startOfDay: "00:00",
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
} as const;
