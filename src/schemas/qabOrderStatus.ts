import { z } from "zod";

/**
 * The 200 of `POST /api/internal/orders/status`, contract v10.1 § ③④.
 *
 * NOT `.strict()`: a key the other side adds tomorrow must not turn an accepted
 * report into a failure. `ok` is `z.literal(true)` and not `z.boolean()` — a
 * `200 { ok: false }` is not something the contract describes, and treating it
 * as success would let a mispointed base URL make cuadrecaja believe the buyer
 * already saw the change.
 *
 * This module imports only `zod`: no cycle is possible (E-028).
 */
export const qabOrderStatusResponseSchema = z.object({ ok: z.literal(true) });
export type IQabOrderStatusResponse = z.infer<typeof qabOrderStatusResponseSchema>;
