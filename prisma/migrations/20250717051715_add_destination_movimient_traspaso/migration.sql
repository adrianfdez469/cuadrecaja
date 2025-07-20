-- AlterTable
ALTER TABLE "MovimientoStock" ADD COLUMN     "detinationId" TEXT;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_detinationId_fkey" FOREIGN KEY ("detinationId") REFERENCES "Tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
