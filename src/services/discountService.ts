import axiosClient from "@/lib/axiosClient";
import type { DiscountRuleInput } from "@/lib/discounts/engine";

const API_URL = `/api/discounts`;

/**
 * Active discount rules for a store, fetched once per catalog load.
 *
 * The POS prices the basket from these locally, so building a cart never
 * touches the network. Returns an empty list on failure: no rules simply means
 * no discount, which is the right answer far more often than blocking the sale.
 */
export const getActiveDiscountRules = async (
  tiendaId: string,
): Promise<DiscountRuleInput[]> => {
  try {
    const response = await axiosClient.get(`${API_URL}/active`, {
      params: { tiendaId },
    });
    return Array.isArray(response.data?.rules) ? response.data.rules : [];
  } catch {
    return [];
  }
};
