import { createHash } from "node:crypto";
import {
  QAB_RECONCILIATION_DEFAULT_AVAILABILITY,
  QAB_RECONCILIATION_FIELD_SEPARATOR,
  QAB_RECONCILIATION_HASH_ALGORITHM,
  QAB_RECONCILIATION_ROW_SEPARATOR,
} from "@/constants/qab";
import { toQabPrice } from "@/schemas/qabDecimals";
import type { IQabCatalogHash, IQabMirrorRow } from "@/schemas/qabReconciliation";

const UTF8: BufferEncoding = "utf8";

/**
 * PURE. The price as the mirror serialises it.
 *
 * It does NOT restate the rounding rule: it applies `toQabPrice`
 * (`src/schemas/qabDecimals.ts`, ADR 0047), the one definition of the contract's
 * price rule in this repository, and takes the number's own decimal form —
 * which never carries trailing zeros, so it lands where the mirror's two
 * `trim(trailing ...)` land.
 *
 * Pinned by the vector of § ⑤ and identical to
 * `trim(trailing '.' from trim(trailing '0' from round(pt."precio"::numeric, 2)::text))`
 * for every price with at most QAB_AMOUNT_DECIMALS decimals, which the contract
 * declares a precondition of § ①. Above that scale it differs the way
 * `toQabPrice` already differs from Postgres — the divergence the contract
 * documents and places outside both sides. This function introduces no new one.
 */
export function qabMirrorPriceToken(precio: number): string {
  return String(toQabPrice(precio));
}

/**
 * PURE. Byte order of the two ids, as `ORDER BY pt."id" COLLATE "C"` orders
 * them: `Buffer.compare` over their UTF-8 encodings.
 *
 * NOT `a < b` and not `localeCompare`: the first compares UTF-16 code units,
 * which is a different order from UTF-8 bytes above the BMP, and the second is
 * a collation — which is exactly what the contract says not to use.
 *
 * Negative when `a` sorts first, positive when `b` does, 0 when equal.
 */
export function compareQabMirrorIds(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, UTF8), Buffer.from(b, UTF8));
}

/**
 * PURE. One row's contribution, separator included:
 * `id`, `qabMirrorPriceToken(precio)`, `monedaPrecioCode` and
 * `dispPublicada ?? QAB_RECONCILIATION_DEFAULT_AVAILABILITY`, joined by
 * QAB_RECONCILIATION_FIELD_SEPARATOR and closed by
 * QAB_RECONCILIATION_ROW_SEPARATOR.
 */
export function qabMirrorRowToken(row: IQabMirrorRow): string {
  const fields = [
    row.id,
    qabMirrorPriceToken(row.precio),
    row.monedaPrecioCode,
    row.dispPublicada ?? QAB_RECONCILIATION_DEFAULT_AVAILABILITY,
  ];
  return `${fields.join(QAB_RECONCILIATION_FIELD_SEPARATOR)}${QAB_RECONCILIATION_ROW_SEPARATOR}`;
}

/**
 * PURE. `{ products, hash }` of a store's mirrored catalog.
 *
 * Takes the rows ALREADY READ — never a database client and never a `tiendaId`.
 * That is what lets the vector of § ⑤ be fed in as four literal rows with no
 * database, which acceptance criterion 6 requires.
 *
 * `products` is `rows.length`: the caller passes the whole selection, and
 * `readQabMirrorRows` returns an empty array rather than a truncated one.
 * `rows: []` gives `products: 0` and the md5 of the empty string, which is the
 * value § ⑤ publishes for a published store with no products.
 *
 * Does not mutate its argument: it sorts a copy.
 */
export function computeQabCatalogHash(rows: IQabMirrorRow[]): IQabCatalogHash {
  const ordered = [...rows].sort((a, b) => compareQabMirrorIds(a.id, b.id));
  const serialised = ordered.map((row) => qabMirrorRowToken(row)).join("");

  return {
    products: rows.length,
    hash: createHash(QAB_RECONCILIATION_HASH_ALGORITHM).update(serialised, UTF8).digest("hex"),
  };
}
