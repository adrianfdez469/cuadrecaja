import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeSqlWhitespace } from "@/lib/qab/qabAvailabilityPlan";
import {
  QAB_RECONCILIATION_MIRROR_SQL,
  QAB_RECONCILIATION_MIRROR_FROM_JOIN_SQL,
  QAB_RECONCILIATION_MIRROR_WHERE_TAIL_SQL,
} from "@/constants/qab";

/**
 * F-008 — the static drift checks of contract § 3, which tie the copied SQL mirror to
 * its origin without ever executing it.
 *
 * There are THREE checks in the contract; only TWO belong in this suite:
 *
 *   1. Our two copies against each other (below, ALWAYS runs).
 *   2. Our hash against the contract's own vector — that is
 *      `src/__tests__/qabReconciliationHash.test.ts`, criterion 6.
 *   3. Our copy against the EXTERNAL document at $QAB_DOCS_PATH — this file's second
 *      `describe` block, `it.skipIf`-guarded, because vitest does not load `.env` and
 *      the variable is a local path nobody commits (E-001). It is a step of the gate
 *      with its own command, not a background check:
 *
 *        QAB_DOCS_PATH="$QAB_DOCS_PATH" npx vitest run src/__tests__/qabReconciliationMirrorSql.test.ts
 *
 *      The case's own name says it is skipped without the variable, on purpose — so a
 *      clean `npx vitest run` never LOOKS like it verified this check when it did not.
 */

describe("QAB_RECONCILIATION_MIRROR_SQL vs its own split halves — static drift check (§ 3, check 1)", () => {
  it('should contain, whitespace-insensitive, FROM_JOIN + "$1" + WHERE_TAIL reassembled', () => {
    const reassembled =
      QAB_RECONCILIATION_MIRROR_FROM_JOIN_SQL + "$1" + QAB_RECONCILIATION_MIRROR_WHERE_TAIL_SQL;

    expect(normalizeSqlWhitespace(QAB_RECONCILIATION_MIRROR_SQL)).toContain(
      normalizeSqlWhitespace(reassembled)
    );
  });

  it("should not be an empty string — a vacuous substring check would pass against anything", () => {
    expect(normalizeSqlWhitespace(QAB_RECONCILIATION_MIRROR_SQL).length).toBeGreaterThan(20);
    expect(normalizeSqlWhitespace(QAB_RECONCILIATION_MIRROR_FROM_JOIN_SQL).length).toBeGreaterThan(5);
    expect(normalizeSqlWhitespace(QAB_RECONCILIATION_MIRROR_WHERE_TAIL_SQL).length).toBeGreaterThan(5);
  });

  it("keeps the v11 exclusions of § 5's fifth decision — deletedAt IS NULL on both Producto and ProductoTienda — in the WHERE tail", () => {
    const normalized = normalizeSqlWhitespace(QAB_RECONCILIATION_MIRROR_WHERE_TAIL_SQL);
    expect(normalized).toContain('p."deletedAt" IS NULL');
    expect(normalized).toContain('pt."deletedAt" IS NULL');
  });
});

describe("QAB_RECONCILIATION_MIRROR_SQL vs the external sync-contract.md — static drift check (§ 3, check 3)", () => {
  const docsPath = process.env.QAB_DOCS_PATH;

  it.skipIf(!docsPath)(
    "should be a whitespace-insensitive substring of sync-contract.md at $QAB_DOCS_PATH — SKIPPED without QAB_DOCS_PATH (run explicitly, see this file's header comment)",
    () => {
      const contractPath = path.join(docsPath as string, "sync-contract.md");
      const contractText = readFileSync(contractPath, "utf8");

      expect(normalizeSqlWhitespace(contractText)).toContain(
        normalizeSqlWhitespace(QAB_RECONCILIATION_MIRROR_SQL)
      );
    }
  );
});
