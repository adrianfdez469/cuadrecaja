import { z } from "zod";

export const initialCashFundInputSchema = z.object({
  amounts: z.record(z.string(), z.coerce.number().min(0)),
});

export const initialCashFundEntrySchema = z.object({
  id: z.string().uuid(),
  cierrePeriodoId: z.string().uuid(),
  amounts: z.record(z.string(), z.number()),
  createdById: z.string().uuid(),
  createdByName: z.string().optional(),
  createdAt: z.coerce.date(),
});

export type IInitialCashFundInput = z.infer<typeof initialCashFundInputSchema>;
export type IInitialCashFundEntry = z.infer<typeof initialCashFundEntrySchema>;
