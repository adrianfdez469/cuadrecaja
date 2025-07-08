/*
  Warnings:

  - You are about to drop the `ProveedorConsignadorLiquidaciónCierre` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProveedorConsignadorLiquidaciónCierre" DROP CONSTRAINT "ProveedorConsignadorLiquidaciónCierre_cierreId_fkey";

-- DropForeignKey
ALTER TABLE "ProveedorConsignadorLiquidaciónCierre" DROP CONSTRAINT "ProveedorConsignadorLiquidaciónCierre_proveedorId_fkey";

-- DropTable
DROP TABLE "ProveedorConsignadorLiquidaciónCierre";

-- CreateTable
CREATE TABLE "ProductoProveedorConsignadorLiquidaciónCierre" (
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

    CONSTRAINT "ProductoProveedorConsignadorLiquidaciónCierre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoProveedorConsignadorLiquidaciónCierre_cierreId_pro_key" ON "ProductoProveedorConsignadorLiquidaciónCierre"("cierreId", "proveedorId");

-- AddForeignKey
ALTER TABLE "ProductoProveedorConsignadorLiquidaciónCierre" ADD CONSTRAINT "ProductoProveedorConsignadorLiquidaciónCierre_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "CierrePeriodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoProveedorConsignadorLiquidaciónCierre" ADD CONSTRAINT "ProductoProveedorConsignadorLiquidaciónCierre_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoProveedorConsignadorLiquidaciónCierre" ADD CONSTRAINT "ProductoProveedorConsignadorLiquidaciónCierre_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
