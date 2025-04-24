-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "negocioId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "negocioId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Tienda" ADD COLUMN     "negocioId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "negocioId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Negocio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limitTime" TIMESTAMP(3) NOT NULL,
    "userlimit" INTEGER NOT NULL,
    "locallimit" INTEGER NOT NULL,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_nombre_key" ON "Negocio"("nombre");
