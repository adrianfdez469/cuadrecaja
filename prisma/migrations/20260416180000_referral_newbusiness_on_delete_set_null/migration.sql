-- Permitir eliminar el negocio referido: la fila Referral permanece (historial / dashboard)
-- y newBusinessId pasa a NULL (PostgreSQL: varios NULL no violan UNIQUE).

ALTER TABLE "Referral" DROP CONSTRAINT IF EXISTS "Referral_newBusinessId_fkey";

ALTER TABLE "Referral" ALTER COLUMN "newBusinessId" DROP NOT NULL;

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_newBusinessId_fkey"
  FOREIGN KEY ("newBusinessId") REFERENCES "Negocio"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
