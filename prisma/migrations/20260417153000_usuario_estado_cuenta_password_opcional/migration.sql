-- CreateEnum
CREATE TYPE "UsuarioEstadoCuenta" AS ENUM ('ACTIVO', 'PENDIENTE_VERIFICACION');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "estadoCuenta" "UsuarioEstadoCuenta" NOT NULL DEFAULT 'ACTIVO';

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "password" DROP NOT NULL;
