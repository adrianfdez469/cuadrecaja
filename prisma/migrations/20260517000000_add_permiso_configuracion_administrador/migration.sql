-- Agrega el permiso configuracion.administrador a todos los roles que ya tienen
-- configuracion.roles.acceder (indicador de rol administrador).
-- Solo actualiza los que aún no lo tengan para ser idempotente.

UPDATE "Rol"
SET "permisos" = "permisos" || '|configuracion.administrador'
WHERE "permisos" LIKE '%configuracion.roles.acceder%'
  AND "permisos" NOT LIKE '%configuracion.administrador%';
