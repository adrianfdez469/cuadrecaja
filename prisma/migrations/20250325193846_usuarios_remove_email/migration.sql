/*
  Warnings:

  - You are about to drop the column `email` on the `Usuario` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[usuario]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `usuario` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Usuario_email_key";

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "email",
ADD COLUMN     "usuario" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_usuario_key" ON "Usuario"("usuario");
