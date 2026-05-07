-- CreateTable
CREATE TABLE "CashBreakdownCierre" (
    "id" TEXT NOT NULL,
    "cierrePeriodoId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CUP',
    "items" JSONB NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBreakdownCierre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashBreakdownCierre_cierrePeriodoId_key" ON "CashBreakdownCierre"("cierrePeriodoId");

-- AddForeignKey
ALTER TABLE "CashBreakdownCierre" ADD CONSTRAINT "CashBreakdownCierre_cierrePeriodoId_fkey" FOREIGN KEY ("cierrePeriodoId") REFERENCES "CierrePeriodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
