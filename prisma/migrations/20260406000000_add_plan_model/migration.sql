-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "limiteLocales" INTEGER NOT NULL,
    "limiteUsuarios" INTEGER NOT NULL,
    "limiteProductos" INTEGER NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "duracion" INTEGER NOT NULL,
    "recomendado" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_nombre_key" ON "Plan"("nombre");

-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN "planId" TEXT;

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
