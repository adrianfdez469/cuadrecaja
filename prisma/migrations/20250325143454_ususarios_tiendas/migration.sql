/*
  Warnings:

  - You are about to drop the column `tiendaId` on the `Usuario` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_tiendaId_fkey";

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "tiendaId";

-- CreateTable
CREATE TABLE "UsuarioTienda" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tiendaId" TEXT NOT NULL,

    CONSTRAINT "UsuarioTienda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioTienda_usuarioId_tiendaId_key" ON "UsuarioTienda"("usuarioId", "tiendaId");

-- AddForeignKey
ALTER TABLE "UsuarioTienda" ADD CONSTRAINT "UsuarioTienda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioTienda" ADD CONSTRAINT "UsuarioTienda_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
