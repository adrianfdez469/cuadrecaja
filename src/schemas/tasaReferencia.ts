import { z } from "zod";

// Respuesta cruda de elTOQUE. La spec OpenAPI no documenta el cuerpo del 200, así que
// el parseo es deliberadamente tolerante: no exigimos claves concretas dentro de
// `tasas` ni que vengan los campos de fecha. Los valores se declaran `unknown` a
// propósito — la respuesta trae monedas que no usamos (BTC, TRX, USDT_TRC20…) y basta
// que UNA venga en null o como string para que un `z.number()` tumbe todo el payload y
// deje la integración caída. El filtrado por valor ocurre en `src/lib/eltoque.ts`.
export const eltoqueRawSchema = z
  .object({
    tasas: z.record(z.string(), z.unknown()),
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
  // ISO — momento en que se consultó a elTOQUE, que es la única medida real de frescura:
  // su `date`/`hour` no es la fecha de publicación de la tasa, es la hora a la que se le
  // preguntó (la TRMI es una mediana móvil, siempre responde "el valor de ahora").
  actualizadoEn: z.string().nullable(),
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
