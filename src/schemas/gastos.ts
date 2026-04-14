import { z } from 'zod';

export const TipoCalculoEnum = z.enum(['MONTO_FIJO', 'PORCENTAJE_VENTAS', 'PORCENTAJE_GANANCIAS']);
export const RecurrenciaGastoEnum = z.enum(['UNICO', 'DIARIO', 'MENSUAL', 'ANUAL']);

const recurrenciaRefinement = (data: {
  recurrencia: string;
  diaMes?: number | null;
  mesAnio?: number | null;
  diaAnio?: number | null;
}, ctx: z.RefinementCtx) => {
  if (data.recurrencia === 'MENSUAL' && !data.diaMes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['diaMes'], message: 'Requerido para recurrencia mensual' });
  }
  if (data.recurrencia === 'ANUAL' && !data.mesAnio) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mesAnio'], message: 'Requerido para recurrencia anual' });
  }
  if (data.recurrencia === 'ANUAL' && !data.diaAnio) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['diaAnio'], message: 'Requerido para recurrencia anual' });
  }
};

// ─── Plantilla (nivel negocio) ───────────────────────────────────────────────

export const gastoPlantillaSchema = z.object({
  id: z.string().uuid(),
  negocioId: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  categoria: z.string().min(1, 'La categoría es requerida').max(60, 'Máximo 60 caracteres'),
  tipoCalculo: TipoCalculoEnum,
  recurrencia: RecurrenciaGastoEnum,
  diaMes: z.number().int().min(1).max(31).nullable().optional(),
  mesAnio: z.number().int().min(1).max(12).nullable().optional(),
  diaAnio: z.number().int().min(1).max(31).nullable().optional(),
  activo: z.boolean().default(true),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

// Base sin refinements para poder usar .partial() en updates
const gastoPlantillaInputBase = gastoPlantillaSchema.omit({
  id: true, negocioId: true, createdAt: true, updatedAt: true,
});

export const createGastoPlantillaSchema = gastoPlantillaInputBase.superRefine(recurrenciaRefinement);
export const updateGastoPlantillaSchema = gastoPlantillaInputBase.partial();

// ─── GastoTienda (gasto activo en una tienda) ────────────────────────────────

export const gastoTiendaSchema = gastoPlantillaSchema.extend({
  tiendaId: z.string().uuid(),
  negocioId: z.string().uuid(),
  plantillaId: z.string().uuid().nullable().optional(),
  monto: z.number().positive('El monto debe ser mayor a 0').nullable().optional(),
  porcentaje: z.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').nullable().optional(),
});

// Base sin refinements para poder usar .partial() en updates
const gastoTiendaInputBase = gastoTiendaSchema.omit({
  id: true, negocioId: true, tiendaId: true, createdAt: true, updatedAt: true,
});

export const createGastoTiendaSchema = gastoTiendaInputBase.superRefine((data, ctx) => {
  recurrenciaRefinement(data, ctx);
  if (data.tipoCalculo === 'MONTO_FIJO' && (data.monto == null || data.monto <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['monto'], message: 'El monto es requerido y debe ser mayor a 0' });
  }
  if (data.tipoCalculo !== 'MONTO_FIJO' && (data.porcentaje == null || data.porcentaje <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['porcentaje'], message: 'El porcentaje es requerido y debe ser mayor a 0' });
  }
});
export const updateGastoTiendaSchema = gastoTiendaInputBase.partial();

// ─── Asignación de plantilla a tienda ───────────────────────────────────────

export const assignPlantillaSchema = z.object({
  plantillaId: z.string().uuid(),
  monto: z.number().positive().nullable().optional(),
  porcentaje: z.number().min(0).max(100).nullable().optional(),
  diaMes: z.number().int().min(1).max(31).nullable().optional(),
  mesAnio: z.number().int().min(1).max(12).nullable().optional(),
  diaAnio: z.number().int().min(1).max(31).nullable().optional(),
});

// ─── GastoCierre (registro inmutable por cierre) ────────────────────────────

export const gastoCierreSchema = z.object({
  id: z.string().uuid(),
  cierreId: z.string().uuid(),
  gastoTiendaId: z.string().uuid().nullable().optional(),
  nombre: z.string(),
  categoria: z.string(),
  tipoCalculo: TipoCalculoEnum,
  montoCalculado: z.number(),
  monto: z.number().nullable().optional(),
  porcentaje: z.number().nullable().optional(),
  esAdHoc: z.boolean().default(false),
  createdAt: z.union([z.string(), z.date()]),
});

// ─── Preview (antes del cierre) ─────────────────────────────────────────────

export const gastoPreviewSchema = z.object({
  gastoTiendaId: z.string().uuid().nullable().optional(),
  nombre: z.string(),
  categoria: z.string(),
  tipoCalculo: TipoCalculoEnum,
  montoCalculado: z.number(),
  monto: z.number().nullable().optional(),
  porcentaje: z.number().nullable().optional(),
  recurrencia: RecurrenciaGastoEnum,
  esAdHoc: z.boolean().default(false),
  motivoAplica: z.string().optional(),
});

export const applyGastosSchema = z.object({
  gastosToApply: z.array(gastoPreviewSchema),
});

// ─── Gasto Ad-hoc ────────────────────────────────────────────────────────────

export const gastoAdHocCreateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  categoria: z.string().min(1, 'La categoría es requerida'),
  tipoCalculo: TipoCalculoEnum,
  montoCalculado: z.number().positive('El monto debe ser mayor a 0'),
  monto: z.number().positive().nullable().optional(),
  porcentaje: z.number().min(0).max(100).nullable().optional(),
});

// ─── Respuestas de API ───────────────────────────────────────────────────────

export const gastosCierreResponseSchema = z.object({
  gastos: z.array(gastoCierreSchema),
  totalGastos: z.number(),
  agrupados: z.record(z.string(), z.array(gastoCierreSchema)),
});

export const gastosPreviewResponseSchema = z.object({
  gastosRecurrentes: z.array(gastoPreviewSchema),
  gastosNoAplican: z.array(gastoPreviewSchema),
  gastosAdHoc: z.array(gastoCierreSchema),
  totalGastos: z.number(),
  totalVentas: z.number(),
  totalGanancia: z.number(),
  totalGananciaFinal: z.number(),
});

// ─── Tipos derivados (nunca interfaces manuales) ─────────────────────────────

export type IGastoPlantilla = z.infer<typeof gastoPlantillaSchema>;
export type ICreateGastoPlantilla = z.infer<typeof createGastoPlantillaSchema>;
export type IUpdateGastoPlantilla = z.infer<typeof updateGastoPlantillaSchema>;

export type IGastoTienda = z.infer<typeof gastoTiendaSchema>;
export type ICreateGastoTienda = z.infer<typeof createGastoTiendaSchema>;
export type IUpdateGastoTienda = z.infer<typeof updateGastoTiendaSchema>;

export type IAssignPlantilla = z.infer<typeof assignPlantillaSchema>;
export type IGastoCierre = z.infer<typeof gastoCierreSchema>;
export type IGastoPreview = z.infer<typeof gastoPreviewSchema>;
export type IApplyGastos = z.infer<typeof applyGastosSchema>;
export type IGastoAdHocCreate = z.infer<typeof gastoAdHocCreateSchema>;

export type ITipoCalculo = z.infer<typeof TipoCalculoEnum>;
export type IRecurrenciaGasto = z.infer<typeof RecurrenciaGastoEnum>;
export type IGastosCierreResponse = z.infer<typeof gastosCierreResponseSchema>;
export type IGastosPreviewResponse = z.infer<typeof gastosPreviewResponseSchema>;
