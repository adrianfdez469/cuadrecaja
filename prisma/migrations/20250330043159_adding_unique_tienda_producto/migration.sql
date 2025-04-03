/*
  Warnings:

  - Added the required column `totalcash` to the `Venta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totaltransfer` to the `Venta` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "totalcash" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totaltransfer" DOUBLE PRECISION NOT NULL;
