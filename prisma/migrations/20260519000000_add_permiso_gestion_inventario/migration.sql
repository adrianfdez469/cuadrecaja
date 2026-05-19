-- Add configuracion.gestion-inventario.acceder to the global Administrador role.
-- Idempotent: does nothing if already present.
UPDATE "Rol"
SET "permisos" = "permisos" || '|configuracion.gestion-inventario.acceder'
WHERE nombre = 'Administrador'
  AND "isGlobal" = true
  AND "permisos" NOT LIKE '%configuracion.gestion-inventario.acceder%';
