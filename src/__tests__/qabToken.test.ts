import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F-005 — `src/lib/qab/qabToken.ts` (contract §5.3, ADR 0013). This is the second of the
 * exactly-two places in the whole repository allowed to name `qabToken` (the other is
 * `loadQabTokens` in `outboxDrain.ts`). The invariant worth a test: it reads with an explicit
 * `select`, NEVER combined with `omit` — the global Prisma client already omits `qabToken` by
 * default (`src/lib/prisma.ts`), so the only way to read it back is `select`, alone.
 */

const findUniqueMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { negocio: { findUnique: findUniqueMock } },
}));

const { loadQabToken } = await import("@/lib/qab/qabToken");

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("loadQabToken", () => {
  it("should return the token when the business has one configured", async () => {
    findUniqueMock.mockResolvedValueOnce({ qabToken: "secret-token" });

    await expect(loadQabToken("negocio-1")).resolves.toBe("secret-token");
  });

  it("should return null when the business has no token configured", async () => {
    findUniqueMock.mockResolvedValueOnce({ qabToken: null });

    await expect(loadQabToken("negocio-1")).resolves.toBeNull();
  });

  it("should return null when the business does not exist, rather than throwing", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(loadQabToken("negocio-inexistente")).resolves.toBeNull();
  });

  it("should query by the given negocioId", async () => {
    findUniqueMock.mockResolvedValueOnce({ qabToken: null });

    await loadQabToken("negocio-1");

    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "negocio-1" } })
    );
  });

  it("should read with an explicit select, and NEVER combine it with omit (ADR 0013)", async () => {
    findUniqueMock.mockResolvedValueOnce({ qabToken: null });

    await loadQabToken("negocio-1");

    const args = findUniqueMock.mock.calls[0][0] as { select?: unknown; omit?: unknown };
    expect(args.select).toBeDefined();
    expect(args.omit).toBeUndefined();
  });

  it("should select ONLY qabToken, not the whole row", async () => {
    findUniqueMock.mockResolvedValueOnce({ qabToken: null });

    await loadQabToken("negocio-1");

    const args = findUniqueMock.mock.calls[0][0] as { select?: Record<string, unknown> };
    expect(args.select).toEqual({ qabToken: true });
  });
});
