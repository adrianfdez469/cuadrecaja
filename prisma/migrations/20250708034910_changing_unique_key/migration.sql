/*
  Warnings:

  - A unique constraint covering the columns `[cierreId,proveedorId,productoId]` on the table `ProductoProveedorConsignadorLiquidaciónCierre` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProductoProveedorConsignadorLiquidaciónCierre_cierreId_pro_key";

-- CreateIndex
CREATE UNIQUE INDEX "ProductoProveedorConsignadorLiquidaciónCierre_cierreId_pro_key" ON "ProductoProveedorConsignadorLiquidaciónCierre"("cierreId", "proveedorId", "productoId");
