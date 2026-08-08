/**
 * Discount proration, extracted from the two-pass algorithm that was duplicated
 * across the dashboard and the two closing endpoints.
 *
 * Pure by design — no Prisma, no currency lookups. Callers hand in gross amounts
 * already converted to base currency.
 */

/** Floating-point noise floor: below this a residual is treated as zero. */
const EPS = 1e-4;

export type ProratableLine = {
  storeProductId: string;
  /** Line gross in base currency (price * quantity). */
  grossAmount: number;
};

export type ProratableDiscount = {
  amount: number;
  /** Raw `AppliedDiscount.productsAffected` JSON; empty/absent means whole ticket. */
  productsAffected: unknown;
};

export type DiscountRuleTotals = {
  /** Discount attributed to this rule, in base currency. */
  amount: number;
  /** Gross of the lines the rule touched — the base its margin erosion is measured against. */
  affectedGross: number;
};

/**
 * Reads the store-product ids a discount applied to. An empty result means the
 * discount was not tied to specific products and should hit the whole ticket.
 */
function readAffectedIds(productsAffected: unknown): string[] {
  if (!Array.isArray(productsAffected) || productsAffected.length === 0) {
    return [];
  }
  return (productsAffected as unknown[])
    .map((entry) =>
      String((entry as { productoTiendaId?: string })?.productoTiendaId ?? ""),
    )
    .filter(Boolean);
}

/** Groups line indexes by store product, since a ticket can repeat a product. */
function indexLinesByProduct(
  lines: readonly ProratableLine[],
): Map<string, number[]> {
  const byProduct = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const existing = byProduct.get(line.storeProductId);
    if (existing) existing.push(index);
    else byProduct.set(line.storeProductId, [index]);
  });
  return byProduct;
}

/**
 * Distributes a sale's discounts across its lines.
 *
 * Each AppliedDiscount is spread only over the lines it affected, proportional
 * to gross amount. Any residual not backed by an AppliedDiscount row — legacy
 * sales recorded before the discount engine existed — is spread over every
 * line, so the net always reconciles with `Venta.discountTotal`.
 *
 * @returns per-line discount, index-aligned with `lines`.
 */
export function prorateSaleDiscounts(
  lines: readonly ProratableLine[],
  discountTotal: number,
  appliedDiscounts: readonly ProratableDiscount[],
): number[] {
  return prorateSaleDiscountsByRule(
    lines,
    discountTotal,
    appliedDiscounts.map((discount) => ({ ...discount, discountRuleId: "" })),
  ).perLine;
}

/**
 * Same distribution as {@link prorateSaleDiscounts}, but also reports how much
 * each discount rule accounted for — the input to the discount-effectiveness
 * report.
 */
export function prorateSaleDiscountsByRule(
  lines: readonly ProratableLine[],
  discountTotal: number,
  appliedDiscounts: readonly (ProratableDiscount & {
    discountRuleId: string;
  })[],
): { perLine: number[]; perRule: Map<string, DiscountRuleTotals> } {
  const perLine = new Array<number>(lines.length).fill(0);
  const perRule = new Map<string, DiscountRuleTotals>();

  const saleGross = lines.reduce((acc, line) => acc + line.grossAmount, 0);
  const linesByProduct = indexLinesByProduct(lines);

  let attributed = 0;

  for (const discount of appliedDiscounts) {
    const amount = Number(discount.amount || 0);
    if (amount <= 0) continue;

    const affectedIds = readAffectedIds(discount.productsAffected);
    const targetIndexes =
      affectedIds.length > 0
        ? affectedIds.flatMap((id) => linesByProduct.get(id) ?? [])
        : lines.map((_, index) => index);

    const affectedGross = targetIndexes.reduce(
      (acc, index) => acc + lines[index].grossAmount,
      0,
    );
    if (affectedGross <= 0) continue;

    for (const index of targetIndexes) {
      perLine[index] += amount * (lines[index].grossAmount / affectedGross);
    }

    const existing = perRule.get(discount.discountRuleId);
    if (existing) {
      existing.amount += amount;
      existing.affectedGross += affectedGross;
    } else {
      perRule.set(discount.discountRuleId, { amount, affectedGross });
    }

    attributed += amount;
  }

  // Legacy sales: discountTotal exists but no AppliedDiscount rows back it.
  const residual = discountTotal - attributed;
  if (residual > EPS && saleGross > 0) {
    lines.forEach((line, index) => {
      perLine[index] += residual * (line.grossAmount / saleGross);
    });
  }

  return { perLine, perRule };
}
