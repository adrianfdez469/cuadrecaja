-- Normalizar el tipo de local al valor canónico en mayúsculas usado por la app
UPDATE "Tienda" SET "tipo" = 'TIENDA' WHERE lower("tipo") = 'tienda';
UPDATE "Tienda" SET "tipo" = 'ALMACEN' WHERE lower("tipo") = 'almacen';

-- Alinear el valor por defecto de la columna con el valor canónico
ALTER TABLE "Tienda" ALTER COLUMN "tipo" SET DEFAULT 'TIENDA';
