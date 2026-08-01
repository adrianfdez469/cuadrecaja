-- CreateTable
CREATE TABLE "InitialCashFund" (
    "id" TEXT NOT NULL,
    "cierrePeriodoId" TEXT NOT NULL,
    "amounts" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitialCashFund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InitialCashFund_cierrePeriodoId_createdAt_idx" ON "InitialCashFund"("cierrePeriodoId", "createdAt");

-- AddForeignKey
ALTER TABLE "InitialCashFund" ADD CONSTRAINT "InitialCashFund_cierrePeriodoId_fkey" FOREIGN KEY ("cierrePeriodoId") REFERENCES "CierrePeriodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialCashFund" ADD CONSTRAINT "InitialCashFund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
