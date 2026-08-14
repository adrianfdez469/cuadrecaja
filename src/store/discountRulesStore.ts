import { create } from "zustand";
import type { DiscountRuleInput, ProductMeta } from "@/lib/discounts/engine";
import { getActiveDiscountRules } from "@/services/discountService";

interface DiscountRulesState {
  rules: DiscountRuleInput[];
  /** productoTiendaId → what it is, for PRODUCT- and CATEGORY-scoped rules. */
  productMeta: Record<string, ProductMeta>;
  /** Rules have been fetched at least once for the current store. */
  loaded: boolean;
  loadRules: (tiendaId: string) => Promise<void>;
  setProductMeta: (productMeta: Record<string, ProductMeta>) => void;
  reset: () => void;
}

/**
 * The discount rules the POS prices its basket with.
 *
 * Loaded once per catalog load rather than consulted per cart change: the old
 * flow POSTed to /api/discounts/preview on every `+`, putting the network in
 * the middle of a sale. Deliberately not persisted — a stale rule is worse
 * than no rule, and the fetch rides along with the catalog anyway.
 *
 * The server recomputes discounts when the sale is confirmed, so anything
 * shown from here is provisional by design.
 */
export const useDiscountRulesStore = create<DiscountRulesState>()((set) => ({
  rules: [],
  productMeta: {},
  loaded: false,

  loadRules: async (tiendaId) => {
    if (!tiendaId) return;
    const rules = await getActiveDiscountRules(tiendaId);
    set({ rules, loaded: true });
  },

  setProductMeta: (productMeta) => set({ productMeta }),

  reset: () => set({ rules: [], productMeta: {}, loaded: false }),
}));

/** True when the business has at least one rule gated behind a promo code. */
export const useHasPromoCodeRules = (): boolean =>
  useDiscountRulesStore((state) =>
    state.rules.some(
      (rule) =>
        typeof (rule.conditions as { code?: unknown } | null)?.code ===
        "string",
    ),
  );
