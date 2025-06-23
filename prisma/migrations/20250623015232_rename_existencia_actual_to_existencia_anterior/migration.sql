/*
  Warnings:

  - You are about to drop the column `existenciaActual` on the `MovimientoStock` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MovimientoStock" DROP COLUMN "existenciaActual",
ADD COLUMN     "existenciaAnterior" INTEGER;
