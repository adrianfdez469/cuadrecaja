-- Agregar flag para permitir decimales por producto
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "permiteDecimal" BOOLEAN NOT NULL DEFAULT false;

-- Cambiar existencia en ProductoTienda a double precision
ALTER TABLE "ProductoTienda"
  ALTER COLUMN "existencia" TYPE DOUBLE PRECISION USING "existencia"::double precision;

-- Cambiar cantidad en VentaProducto a double precision
ALTER TABLE "VentaProducto"
  ALTER COLUMN "cantidad" TYPE DOUBLE PRECISION USING "cantidad"::double precision;

-- Cambiar campos en MovimientoStock a double precision
ALTER TABLE "MovimientoStock"
  ALTER COLUMN "cantidad" TYPE DOUBLE PRECISION USING "cantidad"::double precision,
  ALTER COLUMN "existenciaAnterior" TYPE DOUBLE PRECISION USING "existenciaAnterior"::double precision;
