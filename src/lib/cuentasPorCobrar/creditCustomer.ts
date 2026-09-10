import { decideClienteUpsert } from "@/lib/clientes/clienteUpsert";
import { normalizeClienteNombre } from "@/lib/clientes/clienteNombre";

/**
 * PURE: no Prisma, no network, no clock (E-015). It is the decidable half of the first hard
 * rule; the half that queries the database is the route's, which hands the rows in.
 */

/**
 * What the sale has to do with the customer of a credit sale.
 *
 *   NONE       - no credit, or no customer could be resolved. Venta.clienteId stays null.
 *   EXISTING   - a live row already answers for it; nothing is written to Cliente.
 *   REACTIVATE - a soft deleted row carries that name; deletedAt goes back to null.
 *   CREATE     - no row carries that name; one is written with the reserved id.
 */
export const CREDIT_CUSTOMER_ACTIONS = [
  "NONE",
  "EXISTING",
  "REACTIVATE",
  "CREATE",
] as const;

export type ICreditCustomerAction = (typeof CREDIT_CUSTOMER_ACTIONS)[number];

/** The minimum the decision needs to read from a row the route looked up. */
export interface ICreditCustomerRow {
  id: string;
  deletedAt: Date | null;
}

/**
 * A FLAT shape, not a discriminated union: `strict` is off in this project and a union
 * discriminated by `action` narrows unreliably (E-036). Same shape and same reason as
 * IClienteUpsertResult.
 */
export interface ICreditCustomerResolution {
  action: ICreditCustomerAction;
  /** The id the debt will hang from. null ONLY when `action` is "NONE". */
  clienteId: string | null;
  /** The normalized name to write. null unless `action` is "CREATE" or "REACTIVATE". */
  nombre: string | null;
}

export interface ICreditCustomerInput {
  /** Already coerced by the caller. Zero or less means this is not a credit sale. */
  creditoBase: number;
  clienteId?: string | null;
  clienteNombre?: string | null;
  /** The row `clienteId` resolved to INSIDE the tenant, or null. */
  byId: ICreditCustomerRow | null;
  /** The row the normalized `clienteNombre` resolved to INSIDE the tenant, or null. */
  byNombre: ICreditCustomerRow | null;
  /** The id a brand new row would be created with, minted by the caller. */
  nuevoClienteId: string;
}

const NONE: ICreditCustomerResolution = {
  action: "NONE",
  clienteId: null,
  nombre: null,
};

/**
 * Which customer a credit sale's debt belongs to, and what has to be written for that to
 * be true.
 *
 * THE ORDER IS THE CONTRACT and the first branch to fire wins — same shape as
 * CREDIT_INVARIANT_VIOLATIONS. It never queries anything: the two lookups are the
 * caller's, and passing null for a lookup that was not performed is how "not found" and
 * "not asked" say the same thing here.
 *
 * `clienteId` comes back non-null in every case a customer exists or is about to, which
 * is what lets checkCreditInvariant keep its two-value contract: it asks whether a
 * customer is present, and after this function ran, it is (ADR 0110).
 *
 * It never throws.
 */
export function resolveCreditCustomer(
  input: ICreditCustomerInput,
): ICreditCustomerResolution {
  const { creditoBase, clienteId, clienteNombre, byId, byNombre, nuevoClienteId } =
    input;

  // 1. No credit: no debt, and no customer on the sale either. This is the net of the
  // Venta.clienteId NULL <=> creditoBase = 0 invariant for any future caller that invokes
  // this without the route's own guard.
  if (!(Number(creditoBase) > 0)) return { ...NONE };

  // `clienteId` wins over `clienteNombre`: the checkout always sends the name so the ticket
  // can print it, and the id is the exact datum.
  if (typeof clienteId === "string" && clienteId !== "") {
    // 2. Present inside the tenant. A soft deleted row still resolves EXISTING: a late sale
    // against a customer deleted meanwhile leaves its debt visible rather than losing it
    // (F-029 § 2.1). 3. Absent — including an id belonging to ANOTHER business, which the
    // caller's withTenantScope turned into null — resolves NONE, which is what makes
    // checkCreditInvariant answer CREDIT_WITHOUT_CUSTOMER and the route answer 409.
    return byId
      ? { action: "EXISTING", clienteId: byId.id, nombre: null }
      : { ...NONE };
  }

  const nombre = normalizeClienteNombre(clienteNombre ?? "");
  // 7. A name that normalizes to nothing counts as absent.
  if (nombre === "") return { ...NONE };

  // 4, 5 and 6 are decided by decideClienteUpsert, the ONE definition of what an existing
  // row with that name implies (E-014, E-039). Its "DUPLICATE" — which for F-031 means "do
  // not create, it is already there" — reads here as EXISTING, which means "use it". Two
  // callers read the same decision and act differently; that is not a contradiction.
  const action = decideClienteUpsert(byNombre);
  if (action === "DUPLICATE") {
    return { action: "EXISTING", clienteId: byNombre.id, nombre: null };
  }
  if (action === "REACTIVATE") {
    return { action: "REACTIVATE", clienteId: byNombre.id, nombre };
  }
  return { action: "CREATE", clienteId: nuevoClienteId, nombre };
}
