-- Add operaciones.gestion-inventario.acceder to the global Administrador role.
-- Idempotent: does nothing if already present.
UPDATE "Rol"
SET "permisos" = "permisos" || '|operaciones.gestion-inventario.acceder'
WHERE nombre = 'Administrador'
  AND "isGlobal" = true
  AND "permisos" NOT LIKE '%operaciones.gestion-inventario.acceder%';
