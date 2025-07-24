/*
  Warnings:

  - You are about to drop the `ProductoProveedorConsignadorLiquidaciónCierre` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductoProveedorConsignadorLiquidaciónCierre" DROP CONSTRAINT "ProductoProveedorConsignadorLiquidaciónCierre_cierreId_fkey";

-- DropForeignKey
ALTER TABLE "ProductoProveedorConsignadorLiquidaciónCierre" DROP CONSTRAINT "ProductoProveedorConsignadorLiquidaciónCierre_productoId_fkey";

-- DropForeignKey
ALTER TABLE "ProductoProveedorConsignadorLiquidaciónCierre" DROP CONSTRAINT "ProductoProveedorConsignadorLiquidaciónCierre_proveedorId_fkey";

-- DropTable
DROP TABLE "ProductoProveedorConsignadorLiquidaciónCierre";

-- CreateTable
CREATE TABLE "ProductoProveedorLiquidacion" (
    "id" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendidos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "existencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liquidatedAt" TIMESTAMP(3),
    "cierreId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,

    CONSTRAINT "ProductoProveedorLiquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoProveedorLiquidacion_cierreId_proveedorId_productoI_key" ON "ProductoProveedorLiquidacion"("cierreId", "proveedorId", "productoId");

-- AddForeignKey
ALTER TABLE "ProductoProveedorLiquidacion" ADD CONSTRAINT "ProductoProveedorLiquidacion_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "CierrePeriodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoProveedorLiquidacion" ADD CONSTRAINT "ProductoProveedorLiquidacion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoProveedorLiquidacion" ADD CONSTRAINT "ProductoProveedorLiquidacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
