-- ADR 0036: the stored totals of a closed period are its source of truth.
-- Gross sales and discounts join the denormalized columns so the history list
-- can read them instead of re-walking every sale of the range, and the
-- per-currency summary keeps its gross figures and initial fund so the
-- history can show the same breakdown as the open-period screen.
-- `totalsComputedAt` stays NULL for periods closed by the previous engine;
-- `scripts/recalculate-cierres.ts --apply` backfills every closed period.
ALTER TABLE "CierrePeriodo"
  ADD COLUMN "totalVentasBrutas" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "totalDescuentos" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "totalsComputedAt" TIMESTAMP(3);

ALTER TABLE "ResumenMonedaCierre"
  ADD COLUMN "totalEfectivoBruto" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "equivalenteBaseBruto" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "initialFund" DOUBLE PRECISION NOT NULL DEFAULT 0;
