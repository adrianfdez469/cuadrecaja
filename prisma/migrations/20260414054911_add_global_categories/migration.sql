-- DropForeignKey
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_negocioId_fkey";

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "esGlobal" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "negocioId" DROP NOT NULL,
ALTER COLUMN "negocioId" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: nombres de categorías globales únicos a nivel sistema
CREATE UNIQUE INDEX "Categoria_nombre_global_key"
ON "Categoria"("nombre")
WHERE "negocioId" IS NULL;
