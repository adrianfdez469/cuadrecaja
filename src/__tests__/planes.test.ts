import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F-018 — `src/lib/planes.ts`.
 *
 * The public landing (`src/app/page.tsx`) was moved to read plans on the server through
 * `listActivePlans()` instead of calling `GET /api/planes` from the browser (see
 * `landingClientSideApi.test.ts` for the regression that fix protects against).
 * `GET /api/planes`, consumed by the authenticated administration screens, kept using
 * `listPlans()` and must keep seeing inactive plans too — that split is the only thing
 * standing between "the landing stopped calling the API" and "the admin GET quietly
 * changed behaviour". These two Prisma queries are pure enough to test with a mocked
 * client: no schema validation, no HTTP, no route handler in between.
 */

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: {
      findMany: findManyMock,
    },
  },
}));

const { listActivePlans, listPlans } = await import("@/lib/planes");

describe("src/lib/planes", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
  });

  describe("listPlans", () => {
    it("should query prisma.plan.findMany without an activo filter", async () => {
      await listPlans();

      expect(findManyMock).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
      });
    });

    it("should return inactive plans too, unfiltered — the admin GET relies on this", async () => {
      const rows = [
        { id: "active-plan", activo: true },
        { id: "retired-plan", activo: false },
      ];
      findManyMock.mockResolvedValueOnce(rows);

      const result = await listPlans();

      expect(result).toEqual(rows);
    });
  });

  describe("listActivePlans", () => {
    it("should query prisma.plan.findMany filtering where activo is true", async () => {
      await listActivePlans();

      expect(findManyMock).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenCalledWith({
        where: { activo: true },
        orderBy: { createdAt: "asc" },
      });
    });

    it("should surface only what prisma resolves for the active filter (no client-side filtering)", async () => {
      const activeOnly = [{ id: "active-plan", activo: true }];
      findManyMock.mockResolvedValueOnce(activeOnly);

      const result = await listActivePlans();

      expect(result).toEqual(activeOnly);
    });
  });

  describe("listPlans vs. listActivePlans", () => {
    it("should share the exact same ordering (createdAt asc) and differ only by the activo filter", async () => {
      await listPlans();
      const listPlansArgs = findManyMock.mock.calls[0][0];

      findManyMock.mockClear();

      await listActivePlans();
      const listActivePlansArgs = findManyMock.mock.calls[0][0];

      expect(listPlansArgs).toEqual({ orderBy: { createdAt: "asc" } });
      expect(listActivePlansArgs).toEqual({
        where: { activo: true },
        orderBy: { createdAt: "asc" },
      });
      expect(listPlansArgs.orderBy).toEqual(listActivePlansArgs.orderBy);
    });
  });
});
