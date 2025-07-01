/*
  Warnings:

  - You are about to drop the column `tiendaActualId` on the `Usuario` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_tiendaActualId_fkey";

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "tiendaActualId",
ADD COLUMN     "localActualId" TEXT;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_localActualId_fkey" FOREIGN KEY ("localActualId") REFERENCES "Tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
