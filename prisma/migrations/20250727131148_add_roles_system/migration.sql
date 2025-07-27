-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "permisos" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "negocioId" TEXT NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rol_negocioId_idx" ON "Rol"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_negocioId_key" ON "Rol"("nombre", "negocioId");

-- AddForeignKey
ALTER TABLE "Rol" ADD CONSTRAINT "Rol_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
