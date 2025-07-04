/*
  Warnings:

  - A unique constraint covering the columns `[tiendaId,productoId,proveedorId]` on the table `ProductoTienda` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProductoTienda_tiendaId_productoId_key";

-- AlterTable
ALTER TABLE "ProductoTienda" ADD COLUMN     "proveedorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductoTienda_tiendaId_productoId_proveedorId_key" ON "ProductoTienda"("tiendaId", "productoId", "proveedorId");

-- AddForeignKey
ALTER TABLE "ProductoTienda" ADD CONSTRAINT "ProductoTienda_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
