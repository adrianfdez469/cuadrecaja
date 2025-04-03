/*
  Warnings:

  - Added the required column `costo` to the `ProductoTienda` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductoTienda" ADD COLUMN     "costo" DOUBLE PRECISION NOT NULL;
