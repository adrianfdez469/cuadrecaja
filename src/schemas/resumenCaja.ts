import { z } from "zod";

export const resumenCajaMonedaSchema = z.object({
  monedaCode: z.string(),
  fondoInicial: z.number(),
  ventasEfectivo: z.number(),
  totalEsperado: z.number(),
  equivalenteBase: z.number(),
  // Propina en efectivo ya incluida en ventasEfectivo/totalEsperado. Se
  // reporta aparte para que el cajero sepa cuánto de la gaveta no es suyo.
  tipCash: z.number(),
});

export const resumenCajaResponseSchema = z.object({
  monedaBase: z.string(),
  resumen: z.array(resumenCajaMonedaSchema),
});

export type IResumenCajaMoneda = z.infer<typeof resumenCajaMonedaSchema>;
export type IResumenCajaResponse = z.infer<typeof resumenCajaResponseSchema>;
