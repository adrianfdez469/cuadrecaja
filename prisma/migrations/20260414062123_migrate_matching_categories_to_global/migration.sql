-- Migración de datos: reasignar productos a categorías globales cuando el nombre coincide
-- y eliminar las categorías por negocio redundantes.

-- Paso 1: Actualizar productos para que apunten a la categoría global
--         cuando existe una global con el mismo nombre que la categoría por negocio del producto.
UPDATE "Producto" p
SET "categoriaId" = gc.id
FROM "Categoria" nc
JOIN "Categoria" gc ON gc.nombre = nc.nombre AND gc."negocioId" IS NULL
WHERE p."categoriaId" = nc.id
  AND nc."negocioId" IS NOT NULL;

-- Paso 2: Eliminar categorías por negocio que ya tienen su equivalente global.
--         Solo se eliminan si no quedan productos apuntando a ellas (por seguridad).
DELETE FROM "Categoria" nc
WHERE nc."negocioId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Categoria" gc
    WHERE gc.nombre = nc.nombre
      AND gc."negocioId" IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Producto" p
    WHERE p."categoriaId" = nc.id
  );