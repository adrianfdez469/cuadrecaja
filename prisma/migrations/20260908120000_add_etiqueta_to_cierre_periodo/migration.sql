-- Free-text, operator-editable label for a closing period.
--
-- Additive and nullable on purpose: NULL means "unnamed", and every reader
-- falls back to the fechaInicio-fechaFin range, which is exactly what the
-- history showed before this column existed. No backfill is needed, and a
-- period that is still open has no fechaFin to bake into a default anyway.
ALTER TABLE "CierrePeriodo" ADD COLUMN "etiqueta" TEXT;
