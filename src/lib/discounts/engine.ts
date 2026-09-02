/**
 * The discount engine, with no database behind it.
 *
 * Everything the rules need is either in the basket or in the rule itself, so
 * the arithmetic is the same whether it runs on the server while confirming a
 * sale or in the browser while the cashier builds the basket. Extracting it
 * lets the POS price a cart without a round-trip: adding a product used to
 * POST to /api/discounts/preview on every single tap, in the middle of a sale.
 *
 * The server remains the authority — it recomputes on confirm. This is what
 * the cashier sees while deciding.
 */

/** A basket line, priced per unit. */
export interface DiscountApplicationInputProduct {
  productoTiendaId: string;
  cantidad: number;
  precio: number;
}

export interface DiscountApplicationResultItem {
  discountRuleId: string;
  amount: number;
  productsAffected?: { productoTiendaId: string; cantidad: number }[];
  ruleName?: string;
}

export interface DiscountApplicationResult {
  discountTotal: number;
  applied: DiscountApplicationResultItem[];
  baseTotal: number;
  finalTotal: number;
}

/** Conditions supported by the MVP. */
export type DiscountConditions = {
  code?: string;
  minTotal?: number;
  productIds?: string[];
  categoryIds?: string[];
  customerIds?: string[];
};

/**
 * A rule as the engine sees it: plain data, safe to serialize over the wire.
 * The Prisma model maps onto this, dates included.
 */
export interface DiscountRuleInput {
  id: string;
  name?: string | null;
  type: string;
  value: number;
  appliesTo: string;
  isActive: boolean;
  conditions?: unknown;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

/** What a product belongs to, for PRODUCT- and CATEGORY-scoped rules. */
export interface ProductMeta {
  productoId: string;
  categoriaId: string | null;
}

function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function isWithin(
  date: Date,
  start?: Date | string | null,
  end?: Date | string | null,
) {
  const from = toDate(start);
  const to = toDate(end);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function parseConditions(json: unknown): DiscountConditions {
  const c = (json ?? {}) as Record<string, unknown>;
  const out: DiscountConditions = {};
  if (typeof c.code === "string") out.code = c.code;
  if (typeof c.minTotal === "number") out.minTotal = c.minTotal;
  if (Array.isArray(c.productIds))
    out.productIds = (c.productIds as unknown[]).map(String);
  if (Array.isArray(c.categoryIds))
    out.categoryIds = (c.categoryIds as unknown[]).map(String);
  if (Array.isArray(c.customerIds))
    out.customerIds = (c.customerIds as unknown[]).map(String);
  return out;
}

/**
 * Rules in force right now: active, within their dates, and — for the ones
 * gated behind a promo code — only when that code was actually entered.
 */
export function selectApplicableRules<T extends DiscountRuleInput>(
  rules: T[],
  codes: string[] | undefined,
  now: Date,
): T[] {
  return rules
    .filter((r) => r.isActive)
    .filter((r) => isWithin(now, r.startDate, r.endDate))
    .filter((r) => {
      const c = parseConditions(r.conditions);
      if (c.code) {
        // Si la regla exige código, solo aplica si el código está en la lista
        return (
          Array.isArray(codes) &&
          codes.some(
            (code) =>
              String(code).toLowerCase() === String(c.code).toLowerCase(),
          )
        );
      }
      // Sin código: aplica automáticamente si está activa
      return true;
    });
}

const lineTotal = (p: DiscountApplicationInputProduct) =>
  (Number(p.precio) || 0) * (Number(p.cantidad) || 0);

/**
 * Prices a basket against a set of rules.
 *
 * `rules` may be the full set for the business — the ones out of force are
 * filtered here — and `productMeta` only matters for PRODUCT/CATEGORY scopes;
 * a TICKET-only rule set works with an empty map.
 */
export function applyDiscounts(params: {
  rules: DiscountRuleInput[];
  products: DiscountApplicationInputProduct[];
  productMeta?: Record<string, ProductMeta>;
  discountCodes?: string[];
  now?: Date;
}): DiscountApplicationResult {
  const {
    rules,
    products,
    productMeta = {},
    discountCodes,
    now = new Date(),
  } = params;

  const baseTotal = products.reduce((acc, p) => acc + lineTotal(p), 0);
  const applicable = selectApplicableRules(rules, discountCodes, now);

  let discountTotal = 0;
  const applied: DiscountApplicationResultItem[] = [];

  // Helpers de subtotal por ámbito
  const computeSubtotal = (rule: DiscountRuleInput) => {
    const conditions = parseConditions(rule.conditions);
    if (rule.appliesTo === "TICKET") {
      return {
        subtotal: baseTotal,
        affectedItems: products.map((p) => ({ ...p })),
      };
    }
    if (rule.appliesTo === "PRODUCT") {
      const productIds = conditions.productIds ?? [];
      if (productIds.length === 0)
        return {
          subtotal: 0,
          affectedItems: [] as DiscountApplicationInputProduct[],
        };
      const affected = products.filter((p) => {
        const meta = productMeta[p.productoTiendaId];
        return Boolean(meta) && productIds.includes(meta.productoId);
      });
      return {
        subtotal: affected.reduce((acc, p) => acc + lineTotal(p), 0),
        affectedItems: affected,
      };
    }
    if (rule.appliesTo === "CATEGORY") {
      const categoryIds = conditions.categoryIds ?? [];
      if (categoryIds.length === 0)
        return {
          subtotal: 0,
          affectedItems: [] as DiscountApplicationInputProduct[],
        };
      const affected = products.filter((p) => {
        const meta = productMeta[p.productoTiendaId];
        return (
          Boolean(meta?.categoriaId) && categoryIds.includes(meta.categoriaId)
        );
      });
      return {
        subtotal: affected.reduce((acc, p) => acc + lineTotal(p), 0),
        affectedItems: affected,
      };
    }
    // Otros ámbitos no implementados
    return {
      subtotal: 0,
      affectedItems: [] as DiscountApplicationInputProduct[],
    };
  };

  for (const rule of applicable) {
    const conditions = parseConditions(rule.conditions);
    // mínimo aplicado sobre el ámbito correspondiente
    const { subtotal, affectedItems } = computeSubtotal(rule);
    if (
      typeof conditions.minTotal === "number" &&
      subtotal < conditions.minTotal
    ) {
      continue;
    }

    let amount = 0;
    if (rule.type === "PERCENTAGE") {
      const pct = Math.max(0, Math.min(100, Number(rule.value) || 0));
      amount = (subtotal * pct) / 100;
    } else if (rule.type === "FIXED") {
      amount = Math.max(0, Number(rule.value) || 0);
      // El descuento fijo no puede exceder el subtotal afectado
      amount = Math.min(amount, subtotal);
    } else {
      // Otros tipos no implementados en MVP
      continue;
    }

    // No permitir exceder el total
    const remaining = Math.max(0, baseTotal - discountTotal);
    amount = Math.min(amount, remaining);

    if (amount <= 0) continue;

    discountTotal += amount;
    applied.push({
      discountRuleId: rule.id,
      amount,
      productsAffected: affectedItems.map((ai) => ({
        productoTiendaId: ai.productoTiendaId,
        cantidad: ai.cantidad,
      })),
      ruleName: rule.name ?? undefined,
    });
  }

  const finalTotal = Math.max(0, baseTotal - discountTotal);
  return { baseTotal, discountTotal, finalTotal, applied };
}

/** An `AppliedDiscount` row as persisted, with the rule fields the arithmetic needs. */
export interface AppliedDiscountRecord {
  id: string;
  amount: number;
  productsAffected?: { productoTiendaId: string; cantidad: number }[] | null;
  rule: Pick<DiscountRuleInput, "type" | "value" | "appliesTo" | "conditions">;
}

export interface RecomputeAfterRemovalResult {
  discountTotal: number;
  /** Still applicable, re-priced against what's left of the basket. */
  updates: {
    id: string;
    amount: number;
    productsAffected: { productoTiendaId: string; cantidad: number }[];
  }[];
  /** No longer applicable — scope emptied out, or fell under its `minTotal`. */
  deletes: string[];
}

/**
 * Re-prices a sale's already-applied discounts after one of its lines is
 * removed — a ticket-scoped rule's subtotal shrinks, a product/category rule
 * can lose the line it was scoped to entirely, and a `minTotal` gate that used
 * to be met may no longer be.
 *
 * Deliberately does not re-run `selectApplicableRules`: a discount gated
 * behind a promo code was validated once, at sale time, and the code itself
 * is never persisted, so re-selecting rules here would silently drop every
 * code-gated discount instead of just the one that stopped applying. Only
 * what was actually recorded gets re-priced.
 */
export function recomputeAppliedDiscountsAfterRemoval(params: {
  appliedDiscounts: AppliedDiscountRecord[];
  remainingProducts: DiscountApplicationInputProduct[];
  removedProductoTiendaId: string;
}): RecomputeAfterRemovalResult {
  const { appliedDiscounts, remainingProducts, removedProductoTiendaId } =
    params;

  const remainingByProductoTiendaId = new Map(
    remainingProducts.map((p) => [p.productoTiendaId, p]),
  );
  const baseTotal = remainingProducts.reduce((acc, p) => acc + lineTotal(p), 0);

  let discountTotal = 0;
  const updates: RecomputeAfterRemovalResult["updates"] = [];
  const deletes: string[] = [];

  for (const ad of appliedDiscounts) {
    const conditions = parseConditions(ad.rule.conditions);

    const affectedItems: DiscountApplicationInputProduct[] =
      ad.rule.appliesTo === "TICKET"
        ? remainingProducts
        : (ad.productsAffected ?? [])
            .filter((item) => item.productoTiendaId !== removedProductoTiendaId)
            .map((item) =>
              remainingByProductoTiendaId.get(item.productoTiendaId),
            )
            .filter((p): p is DiscountApplicationInputProduct => Boolean(p));

    const subtotal = affectedItems.reduce((acc, p) => acc + lineTotal(p), 0);

    if (
      affectedItems.length === 0 ||
      (typeof conditions.minTotal === "number" &&
        subtotal < conditions.minTotal)
    ) {
      deletes.push(ad.id);
      continue;
    }

    let amount = 0;
    if (ad.rule.type === "PERCENTAGE") {
      const pct = Math.max(0, Math.min(100, Number(ad.rule.value) || 0));
      amount = (subtotal * pct) / 100;
    } else if (ad.rule.type === "FIXED") {
      amount = Math.min(Math.max(0, Number(ad.rule.value) || 0), subtotal);
    } else {
      deletes.push(ad.id);
      continue;
    }

    const remainingBudget = Math.max(0, baseTotal - discountTotal);
    amount = Math.min(amount, remainingBudget);

    if (amount <= 0) {
      deletes.push(ad.id);
      continue;
    }

    discountTotal += amount;
    updates.push({
      id: ad.id,
      amount,
      productsAffected: affectedItems.map((p) => ({
        productoTiendaId: p.productoTiendaId,
        cantidad: p.cantidad,
      })),
    });
  }

  return { discountTotal, updates, deletes };
}
