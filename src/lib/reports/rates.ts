import { prisma } from "@/lib/prisma";
import { buildTasaSnapshot } from "@/lib/currency";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/**
 * Current exchange rates for a business.
 *
 * Used to value *present-day* stock (inventory reports), never to convert past
 * sales — those carry their own `tasaSnapshot`.
 */
export async function loadCurrentRates(
  negocioId: string | null,
): Promise<ITasaSnapshot> {
  if (!negocioId) return {};

  const history = await prisma.tasaCambio.findMany({
    where: { negocioId },
    orderBy: { createdAt: "asc" },
    select: { monedaCode: true, tasa: true, createdAt: true },
  });

  return buildTasaSnapshot(history);
}
