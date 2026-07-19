import { z } from "zod";

export const healthResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(["ok", "error"]),
  timestamp: z.string().datetime(),
  version: z.string(),
  services: z.object({
    database: z.enum(["up", "down"]),
  }),
});

export type IHealthResponse = z.infer<typeof healthResponseSchema>;
