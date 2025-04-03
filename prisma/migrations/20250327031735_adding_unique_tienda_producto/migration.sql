/*
  Warnings:

  - A unique constraint covering the columns `[tiendaId,productoId]` on the table `ProductoTienda` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProductoTienda_tiendaId_productoId_key" ON "ProductoTienda"("tiendaId", "productoId");
