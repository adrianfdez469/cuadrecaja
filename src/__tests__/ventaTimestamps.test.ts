import { describe, expect, it } from "vitest";
import {
  toSaleTimestamps,
  type VentaTimestampSource,
} from "@/lib/venta/ventaTimestamps";
import { saleReportedAt } from "@/lib/venta/saleTime";

/**
 * F-031 — contract § "Lista de testabilidad" (`.agents/specs/F-031.md`).
 *
 * `toSaleTimestamps` is the ONLY new pure symbol F-031 adds. It is a boundary
 * adapter: `IVenta.createdAt` and `IVenta.frontendCreatedAt` are typed `Date`
 * by the Zod schema, but the client never parses the GET response through
 * that schema (`getSells` hands it through unparsed) — at runtime both fields
 * are still ISO strings, or absent/null.
 *
 * `saleReportedAt` itself is NOT re-tested here: its own cases live in
 * `saleTime.test.ts` since F-030, including the uncapped-future case. This
 * file lives on its own, never merged into `saleTime.test.ts` — a broken
 * import against a symbol that does not exist yet fails at COLLECTION time
 * and would turn every already-green F-030 test in that file red too
 * (E-019).
 */

// getSells hands the response through unparsed, so both timestamps are ISO
// strings at runtime: exactly the shape this adapter exists to absorb.
const fromNetwork = (
  createdAt: string,
  frontendCreatedAt?: string | null,
): VentaTimestampSource =>
  ({
    createdAt,
    frontendCreatedAt,
  }) as unknown as VentaTimestampSource;

describe("toSaleTimestamps", () => {
  it("coerces a createdAt ISO string into a Date of the same instant", () => {
    const iso = "2026-09-09T07:00:00.000Z";
    const result = toSaleTimestamps(fromNetwork(iso, null));
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.getTime()).toBe(new Date(iso).getTime());
  });

  it("coerces a frontendCreatedAt ISO string into a Date of the same instant", () => {
    const iso = "2026-09-08T22:00:00.000Z";
    const result = toSaleTimestamps(
      fromNetwork("2026-09-09T07:00:00.000Z", iso),
    );
    expect(result.frontendCreatedAt).toBeInstanceOf(Date);
    expect(result.frontendCreatedAt?.getTime()).toBe(new Date(iso).getTime());
  });

  it("maps a missing frontendCreatedAt key to null (JSON.stringify drops undefined keys)", () => {
    const source = {
      createdAt: "2026-09-09T07:00:00.000Z",
    } as unknown as VentaTimestampSource;
    const result = toSaleTimestamps(source);
    expect(result.frontendCreatedAt).toBeNull();
  });

  it("maps an explicit null frontendCreatedAt to null", () => {
    const result = toSaleTimestamps(
      fromNetwork("2026-09-09T07:00:00.000Z", null),
    );
    expect(result.frontendCreatedAt).toBeNull();
  });

  it("is idempotent in value when both fields already arrive as real Date instances", () => {
    const createdAt = new Date("2026-09-09T07:00:00.000Z");
    const frontendCreatedAt = new Date("2026-09-08T22:00:00.000Z");
    const source = {
      createdAt,
      frontendCreatedAt,
    } as unknown as VentaTimestampSource;

    const result = toSaleTimestamps(source);

    expect(result.createdAt.getTime()).toBe(createdAt.getTime());
    expect(result.frontendCreatedAt?.getTime()).toBe(
      frontendCreatedAt.getTime(),
    );
  });

  it("maps a frontendCreatedAt key present with value undefined to null too, satisfying saleTime.ts's required Date|null contract (E-013)", () => {
    // Different runtime shape from the "missing key" case above: here the key
    // IS present on the object, just holding `undefined`. Both must resolve
    // to null because SaleTimestamps declares the field required.
    const result = toSaleTimestamps(
      fromNetwork("2026-09-09T07:00:00.000Z", undefined),
    );
    expect(result.frontendCreatedAt).toBe(null);
  });
});

describe("toSaleTimestamps composed with saleReportedAt", () => {
  it("acceptance criterion 1 — an offline sale (frontendCreatedAt yesterday 22:00, createdAt today 07:00) reports YESTERDAY 22:00, not the sync time", () => {
    const source = fromNetwork(
      "2026-09-09T07:00:00.000Z",
      "2026-09-08T22:00:00.000Z",
    );
    const reported = saleReportedAt(toSaleTimestamps(source));
    expect(reported.getTime()).toBe(
      new Date("2026-09-08T22:00:00.000Z").getTime(),
    );
    // Discriminating check (E-008): returning createdAt instead of
    // frontendCreatedAt here would give a DIFFERENT instant — this is not a
    // case where both readings coincide.
    expect(reported.getTime()).not.toBe(
      new Date("2026-09-09T07:00:00.000Z").getTime(),
    );
  });

  it("acceptance criterion 5 — a sale with no frontendCreatedAt (older than the column) reports createdAt unchanged", () => {
    const source = fromNetwork("2026-09-09T07:00:00.000Z");
    const reported = saleReportedAt(toSaleTimestamps(source));
    expect(reported.getTime()).toBe(
      new Date("2026-09-09T07:00:00.000Z").getTime(),
    );
  });

  it("acceptance criterion 6 — a frontendCreatedAt in the future is reported as-is, uncapped (this is saleReportedAt, never saleEffectiveAt)", () => {
    const source = fromNetwork(
      "2026-09-09T07:00:00.000Z",
      "2099-01-01T00:00:00.000Z",
    );
    const reported = saleReportedAt(toSaleTimestamps(source));
    expect(reported.getTime()).toBe(
      new Date("2099-01-01T00:00:00.000Z").getTime(),
    );
  });
});
