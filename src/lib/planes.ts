import { prisma } from "@/lib/prisma";
import type { IPlan } from "@/schemas/plan";

/**
 * Plans are shown in the order they were created, which is the order they were
 * designed in: free first, then up. It is the only ordering the UI relies on,
 * so it lives here instead of being repeated by every caller.
 */
const PLAN_ORDER = { createdAt: "asc" } as const;

/**
 * Every plan, active or not.
 *
 * The administration screens need the inactive ones too — that is the whole
 * point of the `activo` flag — so this is what `GET /api/planes` returns.
 */
export async function listPlans(): Promise<IPlan[]> {
  return prisma.plan.findMany({ orderBy: PLAN_ORDER });
}

/**
 * The plans a visitor may buy.
 *
 * The public landing renders these on the server, so it must never reach for
 * the API route: that request would travel without a session cookie and the
 * authentication gate would answer 401. Reading straight from the database is
 * also what the layered architecture asks for.
 */
export async function listActivePlans(): Promise<IPlan[]> {
  return prisma.plan.findMany({
    where: { activo: true },
    orderBy: PLAN_ORDER,
  });
}
