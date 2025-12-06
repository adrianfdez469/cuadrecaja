-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED', 'PROMO_CODE');

-- CreateEnum
CREATE TYPE "DiscountAppliesTo" AS ENUM ('TICKET', 'PRODUCT', 'CATEGORY', 'CUSTOMER');

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "appliesTo" "DiscountAppliesTo" NOT NULL,
    "conditions" JSONB,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "negocioId" TEXT,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppliedDiscount" (
    "id" TEXT NOT NULL,
    "discountRuleId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "productsAffected" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppliedDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountRule_isActive_idx" ON "DiscountRule"("isActive");

-- CreateIndex
CREATE INDEX "DiscountRule_startDate_idx" ON "DiscountRule"("startDate");

-- CreateIndex
CREATE INDEX "DiscountRule_endDate_idx" ON "DiscountRule"("endDate");

-- CreateIndex
CREATE INDEX "AppliedDiscount_ventaId_idx" ON "AppliedDiscount"("ventaId");

-- CreateIndex
CREATE INDEX "AppliedDiscount_discountRuleId_idx" ON "AppliedDiscount"("discountRuleId");

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedDiscount" ADD CONSTRAINT "AppliedDiscount_discountRuleId_fkey" FOREIGN KEY ("discountRuleId") REFERENCES "DiscountRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedDiscount" ADD CONSTRAINT "AppliedDiscount_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
