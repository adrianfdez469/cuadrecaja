import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ITenantScope } from "@/lib/tenantScope";
import { withTenantScope } from "@/lib/tenantScope";
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

/**
 * PURE. The `where` that selects the active discount rules of ONE business.
 *
 * Strict equality on purpose: a `DiscountRule` with a null `negocioId` belongs to no business and
 * is applied to none (ADR 0082). Never widen this with an OR on `negocioId: null`.
 */
export function discountRulesWhere(params: { negocioId: string }): {
  isActive: true;
  negocioId: string;
} {
  return { isActive: true, negocioId: params.negocioId };
}

/**
 * PURE. The `where` that resolves product metadata for the engine, tied to the business.
 * Returns `withTenantScope("productoTienda", { id: { in: productoTiendaIds } }, negocioId)`,
 * i.e. `{ id: { in: [...] }, tienda: { negocioId } }` (ADR 0085).
 */
export function discountProductMetaWhere(params: {
  negocioId: string;
  productoTiendaIds: string[];
}) {
  return withTenantScope(
    "productoTienda",
    { id: { in: params.productoTiendaIds } },
    params.negocioId,
  );
}

/**
 * Active rules of `negocioId`, ready for the engine.
 *
 * `tiendaId` is accepted and DELIBERATELY NOT used in the query: discount rules hang off the
 * business, not the store, and this function no longer reads `Tienda` to derive the tenant
 * (ADR 0083). Do not remove the field, and do not reintroduce the lookup.
 */
export async function fetchDiscountRulesForTienda(
  params: ITenantScope,
): Promise<DiscountRuleInput[]> {
  const rules = await prisma.discountRule.findMany({
    where: discountRulesWhere({ negocioId: params.negocioId }),
    select: DISCOUNT_RULE_SELECT,
  });
  return rules.map(toDiscountRuleInput);
}

export async function applyDiscountsForSale(
  params: ITenantScope & {
    products: DiscountApplicationInputProduct[];
    discountCodes?: string[];
  },
): Promise<DiscountApplicationResult> {
  const { negocioId, tiendaId, products, discountCodes } = params;

  const rules = await fetchDiscountRulesForTienda({ negocioId, tiendaId });

  // Mapear productoTiendaId -> { productoId, categoriaId }
  const ids = Array.from(
    new Set(products.map((p) => p.productoTiendaId)),
  ).filter(Boolean);
  const productMeta: Record<string, ProductMeta> = {};
  if (ids.length > 0) {
    const pts = await prisma.productoTienda.findMany({
      where: discountProductMetaWhere({ negocioId, productoTiendaIds: ids }),
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
