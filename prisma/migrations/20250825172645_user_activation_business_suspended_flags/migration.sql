-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
