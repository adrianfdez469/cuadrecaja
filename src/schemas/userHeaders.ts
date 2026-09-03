import { z } from "zod";

const headerClaimSchema = z
  .union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(z.string(), z.unknown()),
    z.array(z.unknown()),
  ])
  .nullish();

/** Shape of the session claims the middleware turns into x-user-* headers. */
export const userHeaderClaimsSchema = z.object({
  id: headerClaimSchema,
  rol: headerClaimSchema,
  nombre: headerClaimSchema,
  usuario: headerClaimSchema,
  negocio: headerClaimSchema,
  localActual: headerClaimSchema,
  locales: headerClaimSchema,
  permisos: headerClaimSchema,
});

export type IUserHeaderClaims = z.infer<typeof userHeaderClaimsSchema>;
