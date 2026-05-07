import { z } from 'zod'

export const billCountSchema = z.object({
  denomination: z.number().positive(),
  count: z.number().int().min(0),
})

export const billBreakdownSchema = z.object({
  currency: z.string(),
  items: z.array(billCountSchema),
  total: z.number().min(0),
})

export const cashBreakdownCierreSchema = z.object({
  id: z.string().uuid(),
  cierrePeriodoId: z.string().uuid(),
  currency: z.string(),
  items: z.array(billCountSchema),
  total: z.number(),
  updatedAt: z.coerce.date(),
})

export type IBillCount = z.infer<typeof billCountSchema>
export type IBillBreakdown = z.infer<typeof billBreakdownSchema>
export type ICashBreakdownCierre = z.infer<typeof cashBreakdownCierreSchema>
