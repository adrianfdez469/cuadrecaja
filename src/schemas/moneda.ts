import { z } from 'zod';

export const monedaSchema = z.object({
  code: z.string().min(1).max(10),
  nombre: z.string().min(1),
  simbolo: z.string().min(1),
  activo: z.boolean(),
  createdAt: z.coerce.date().optional(),
});

export const monedaCreateSchema = z.object({
  code: z.string().min(1).max(10),
  nombre: z.string().min(1),
  simbolo: z.string().min(1),
});

export const denominacionBilleteSchema = z.object({
  id: z.string().uuid(),
  monedaCode: z.string(),
  valor: z.number().positive(),
  activo: z.boolean(),
  orden: z.number().int(),
});

export const denominacionBilleteCreateSchema = z.object({
  valor: z.number().positive(),
  orden: z.number().int().optional(),
});

export const negocioMonedaSchema = z.object({
  id: z.string().uuid(),
  negocioId: z.string().uuid(),
  monedaCode: z.string(),
  admiteEfectivo: z.boolean(),
  admiteTransferencia: z.boolean(),
  activo: z.boolean(),
  moneda: monedaSchema.extend({
    denominaciones: z.array(denominacionBilleteSchema).optional(),
  }).optional(),
});

export const negocioMonedaCreateSchema = z.object({
  monedaCode: z.string().min(1),
  admiteEfectivo: z.boolean().default(true),
  admiteTransferencia: z.boolean().default(false),
});

export const negocioMonedaUpdateSchema = z.object({
  admiteEfectivo: z.boolean(),
  admiteTransferencia: z.boolean(),
  activo: z.boolean().optional(),
});

export const monedaConDenominacionesSchema = monedaSchema.extend({
  denominaciones: z.array(denominacionBilleteSchema),
});

export type IMoneda = z.infer<typeof monedaSchema>;
export type IMonedaCreate = z.infer<typeof monedaCreateSchema>;
export type IDenominacionBillete = z.infer<typeof denominacionBilleteSchema>;
export type IDenominacionBilleteCreate = z.infer<typeof denominacionBilleteCreateSchema>;
export type INegocioMoneda = z.infer<typeof negocioMonedaSchema>;
export type INegocioMonedaCreate = z.infer<typeof negocioMonedaCreateSchema>;
export type INegocioMonedaUpdate = z.infer<typeof negocioMonedaUpdateSchema>;
export type IMonedaConDenominaciones = z.infer<typeof monedaConDenominacionesSchema>;
