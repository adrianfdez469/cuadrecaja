/*
  Warnings:

  - You are about to drop the column `detinationId` on the `MovimientoStock` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "MovimientoStock" DROP CONSTRAINT "MovimientoStock_detinationId_fkey";

-- AlterTable
ALTER TABLE "MovimientoStock" DROP COLUMN "detinationId",
ADD COLUMN     "destinationId" TEXT;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
