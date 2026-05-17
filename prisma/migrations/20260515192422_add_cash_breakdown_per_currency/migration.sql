-- CreateTable
CREATE TABLE "CashBreakdownMoneda" (
    "id" TEXT NOT NULL,
    "cierrePeriodoId" TEXT NOT NULL,
    "monedaCode" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBreakdownMoneda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashBreakdownMoneda_cierrePeriodoId_idx" ON "CashBreakdownMoneda"("cierrePeriodoId");

-- CreateIndex
CREATE UNIQUE INDEX "CashBreakdownMoneda_cierrePeriodoId_monedaCode_key" ON "CashBreakdownMoneda"("cierrePeriodoId", "monedaCode");

-- AddForeignKey
ALTER TABLE "CashBreakdownMoneda" ADD CONSTRAINT "CashBreakdownMoneda_cierrePeriodoId_fkey" FOREIGN KEY ("cierrePeriodoId") REFERENCES "CierrePeriodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
