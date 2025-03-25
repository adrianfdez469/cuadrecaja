/*
  Warnings:

  - Added the required column `descripcion` to the `Producto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "descripcion" TEXT NOT NULL;
