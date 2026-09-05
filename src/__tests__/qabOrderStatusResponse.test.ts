import { describe, it, expect } from "vitest";
import { qabOrderStatusResponseSchema } from "@/schemas/qabOrderStatus";

/**
 * F-012 — `src/schemas/qabOrderStatus.ts` (contract § 2.1). The 200 of
 * `POST /api/internal/orders/status`: a single documented field, `ok: true`.
 *
 * NOT `.strict()`: a key QAB adds tomorrow must not turn an accepted report into a
 * failure. `ok` is `z.literal(true)` and not `z.boolean()`: a 200 `{ ok: false }` is
 * not something the contract describes, and treating it as success would let a
 * mispointed base URL make cuadrecaja believe the buyer already saw the change.
 */

describe("qabOrderStatusResponseSchema", () => {
  it("should accept { ok: true }", () => {
    expect(qabOrderStatusResponseSchema.safeParse({ ok: true }).success).toBe(
      true,
    );
  });

  it("should reject { ok: false } — not something the contract documents, and NOT treated as success", () => {
    expect(qabOrderStatusResponseSchema.safeParse({ ok: false }).success).toBe(
      false,
    );
  });

  it("should reject a missing ok", () => {
    expect(qabOrderStatusResponseSchema.safeParse({}).success).toBe(false);
  });

  it("should NOT reject an extra key — not .strict(), a field QAB adds tomorrow must not fail an accepted report", () => {
    expect(
      qabOrderStatusResponseSchema.safeParse({ ok: true, somethingNew: "x" })
        .success,
    ).toBe(true);
  });

  it('should reject a truthy non-boolean ok (e.g. the string "true")', () => {
    expect(qabOrderStatusResponseSchema.safeParse({ ok: "true" }).success).toBe(
      false,
    );
  });
});
