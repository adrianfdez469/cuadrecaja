import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  applyDiscounts,
  recomputeAppliedDiscountsAfterRemoval,
  type AppliedDiscountRecord,
  type DiscountApplicationInputProduct,
  type DiscountApplicationResult,
  type DiscountApplicationResultItem,
  type DiscountRuleInput,
  type ProductMeta,
  type RecomputeAfterRemovalResult,
} from "./engine";

// Re-exported so existing imports from "@/lib/discounts" keep working; the
// arithmetic itself now lives in ./engine, which the POS also runs in the
// browser to price a basket without touching the network.
export type {
  AppliedDiscountRecord,
  DiscountApplicationInputProduct,
  DiscountApplicationResult,
  DiscountApplicationResultItem,
  DiscountRuleInput,
  ProductMeta,
  RecomputeAfterRemovalResult,
};
export { applyDiscounts, recomputeAppliedDiscountsAfterRemoval };

/** Prisma row → the plain shape the engine and the client both understand. */
export function toDiscountRuleInput(rule: {
  id: string;
  name: string | null;
  type: string;
  value: number;
  appliesTo: string;
  isActive: boolean;
  conditions: Prisma.JsonValue | null;
  startDate: Date | null;
  endDate: Date | null;
}): DiscountRuleInput {
  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    value: Number(rule.value),
    appliesTo: rule.appliesTo,
    isActive: rule.isActive,
    conditions: rule.conditions,
    startDate: rule.startDate,
    endDate: rule.endDate,
  };
}

/** Columns the engine reads. Kept minimal so the payload is safe to ship. */
export const DISCOUNT_RULE_SELECT = {
  id: true,
  name: true,
  type: true,
  value: true,
  appliesTo: true,
  isActive: true,
  conditions: true,
  startDate: true,
  endDate: true,
} as const;

/** Active rules of the business owning `tiendaId`, ready for the engine. */
export async function fetchDiscountRulesForTienda(
  tiendaId: string,
): Promise<DiscountRuleInput[]> {
  const tienda = await prisma.tienda.findUnique({
    where: { id: tiendaId },
    select: { negocioId: true },
  });
  const negocioId = tienda?.negocioId;
  const rules = await prisma.discountRule.findMany({
    where: { isActive: true, ...(negocioId ? { negocioId } : {}) },
    select: DISCOUNT_RULE_SELECT,
  });
  return rules.map(toDiscountRuleInput);
}

export async function applyDiscountsForSale(params: {
  tiendaId: string;
  products: DiscountApplicationInputProduct[];
  discountCodes?: string[];
}): Promise<DiscountApplicationResult> {
  const { tiendaId, products, discountCodes } = params;

  const rules = await fetchDiscountRulesForTienda(tiendaId);

  // Mapear productoTiendaId -> { productoId, categoriaId }
  const ids = Array.from(
    new Set(products.map((p) => p.productoTiendaId)),
  ).filter(Boolean);
  const productMeta: Record<string, ProductMeta> = {};
  if (ids.length > 0) {
    const pts = await prisma.productoTienda.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        producto: { select: { id: true, categoriaId: true } },
      },
    });
    for (const pt of pts) {
      productMeta[pt.id] = {
        productoId: pt.producto.id,
        categoriaId: pt.producto.categoriaId,
      };
    }
  }

  return applyDiscounts({ rules, products, productMeta, discountCodes });
}
