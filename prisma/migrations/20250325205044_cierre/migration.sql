/*
  Warnings:

  - Added the required column `usuarioId` to the `Venta` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "cierrePeriodoId" TEXT,
ADD COLUMN     "usuarioId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CierrePeriodo" (
    "id" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "tiendaId" TEXT NOT NULL,

    CONSTRAINT "CierrePeriodo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_cierrePeriodoId_fkey" FOREIGN KEY ("cierrePeriodoId") REFERENCES "CierrePeriodo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierrePeriodo" ADD CONSTRAINT "CierrePeriodo_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
