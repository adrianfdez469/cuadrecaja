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
