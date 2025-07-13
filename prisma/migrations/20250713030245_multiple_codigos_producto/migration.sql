/*
  Warnings:

  - You are about to drop the column `codigoProducto` on the `Producto` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Producto_codigoProducto_key";

-- AlterTable
ALTER TABLE "Producto" DROP COLUMN "codigoProducto";

-- CreateTable
CREATE TABLE "CodigoProducto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,

    CONSTRAINT "CodigoProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodigoProducto_codigo_key" ON "CodigoProducto"("codigo");

-- AddForeignKey
ALTER TABLE "CodigoProducto" ADD CONSTRAINT "CodigoProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
