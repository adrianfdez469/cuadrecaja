-- DropForeignKey
ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_tiendaActualId_fkey";

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "tiendaActualId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tiendaActualId_fkey" FOREIGN KEY ("tiendaActualId") REFERENCES "Tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
