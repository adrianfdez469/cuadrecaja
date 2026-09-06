/** The only two error bodies of the module. No route writes one by hand (E-014). */
export const TENANT_SCOPE_API_ERRORS = {
  forbidden: "Acceso no autorizado",
  notFound: "Recurso no encontrado",
} as const;

/**
 * The models this feature isolates, and the relation path that leads from each one up to
 * `negocioId`. Derived from `prisma/schema.prisma`, and the ONLY definition of that path in the
 * project: no corrected route writes `tienda: { negocioId }` by hand.
 *
 * `[]` means the model carries the `negocioId` column itself.
 */
export const TENANT_RELATION_PATH = {
  tienda: [],
  producto: [],
  usuario: [],
  proveedor: [],
  tasaCambio: [],
  transferDestinations: ["tienda"],
  cierrePeriodo: ["tienda"],
  productoTienda: ["tienda"],
  venta: ["tienda"],
  movimientoStock: ["tienda"],
  cashBreakdownCierre: ["cierrePeriodo", "tienda"],
  cashBreakdownMoneda: ["cierrePeriodo", "tienda"],
  productoProveedorLiquidacion: ["cierre", "tienda"],
} as const satisfies Record<string, readonly string[]>;

export type ITenantScopedModel = keyof typeof TENANT_RELATION_PATH;

/**
 * How many verbs are still classified `desprotegida`. It drops batch by batch:
 * 37 -> 35 -> 20 -> 0 (ADR 0081).
 */
export const DESPROTEGIDAS_ABIERTAS = 0;
