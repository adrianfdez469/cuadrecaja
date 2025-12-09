-- DropForeignKey
ALTER TABLE "AppliedDiscount" DROP CONSTRAINT "AppliedDiscount_ventaId_fkey";

-- AddForeignKey
ALTER TABLE "AppliedDiscount" ADD CONSTRAINT "AppliedDiscount_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
