import { z } from "zod";

// Respuesta cruda de elTOQUE. La spec OpenAPI no documenta el cuerpo del 200, así que
// el parseo es deliberadamente tolerante: no exigimos claves concretas dentro de
// `tasas` ni que vengan los campos de fecha. La normalización a ISO 4217 y el descarte
// de monedas fuera del catálogo ocurren en `src/lib/eltoque.ts`.
export const eltoqueRawSchema = z
  .object({
    tasas: z.record(z.string(), z.number()),
    date: z.string().optional(),
    hour: z.number().optional(),
    minutes: z.number().optional(),
    seconds: z.number().optional(),
  })
  .loose();

export const tasaReferenciaSchema = z.object({
  monedaCode: z.string(), // ya normalizado a ISO 4217
  tasa: z.number().positive(), // CUP por 1 unidad de esa moneda
});

export const tasasReferenciaMotivoSchema = z.enum([
  "NO_CONFIGURADO",
  "ERROR_UPSTREAM",
]);

export const tasasReferenciaResponseSchema = z.object({
  // false ⇒ no hay ningún dato que mostrar (ver `motivo`)
  disponible: z.boolean(),
  motivo: tasasReferenciaMotivoSchema.optional(),
  tasas: z.array(tasaReferenciaSchema),
  actualizadoEn: z.string().nullable(), // ISO — momento del dato según la fuente
  // true ⇒ se sirve un snapshot viejo porque la fuente no respondió
  stale: z.boolean(),
  fuente: z.literal("elTOQUE"),
});

export type IEltoqueRaw = z.infer<typeof eltoqueRawSchema>;
export type ITasaReferencia = z.infer<typeof tasaReferenciaSchema>;
export type ITasasReferenciaMotivo = z.infer<
  typeof tasasReferenciaMotivoSchema
>;
export type ITasasReferenciaResponse = z.infer<
  typeof tasasReferenciaResponseSchema
>;
