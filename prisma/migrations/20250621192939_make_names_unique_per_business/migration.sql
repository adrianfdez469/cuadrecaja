/*
  Warnings:

  - A unique constraint covering the columns `[nombre,negocioId]` on the table `Categoria` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nombre,negocioId]` on the table `Producto` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nombre,negocioId]` on the table `Tienda` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Categoria_nombre_key";

-- DropIndex
DROP INDEX "Producto_nombre_key";

-- DropIndex
DROP INDEX "Tienda_nombre_key";

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "tiendaActualId" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_negocioId_key" ON "Categoria"("nombre", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_nombre_negocioId_key" ON "Producto"("nombre", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Tienda_nombre_negocioId_key" ON "Tienda"("nombre", "negocioId");
