-- Migración para corregir valores inconsistentes en tiendaActualId
-- Establecer a NULL todos los valores de tiendaActualId que sean string vacío
UPDATE "Usuario" SET "tiendaActualId" = NULL WHERE "tiendaActualId" = '';

-- Alternativamente, si existen valores que no corresponden a IDs válidos:
-- UPDATE "Usuario" SET "tiendaActualId" = NULL 
-- WHERE "tiendaActualId" IS NOT NULL 
-- AND "tiendaActualId" NOT IN (SELECT id FROM "Tienda"); 