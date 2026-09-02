import { z } from "zod";

/**
 * The QAB block of a Negocio, as it may be shown. The token is NOT here and
 * never will be: `qabTokenConfigurado` is derived server-side from
 * `qabToken !== null`. See ADR 0006.
 *
 * Invariant checkable with a grep: no schema in src/schemas/ contains the key
 * `qabToken`.
 */
export const negocioQabSettingsSchema = z.object({
  tiendaOnlineHabilitada: z.boolean(),
  qabTokenConfigurado: z.boolean(),
  qabTokenActualizadoAt: z.date().nullable(),
});
export type INegocioQabSettings = z.infer<typeof negocioQabSettingsSchema>;
