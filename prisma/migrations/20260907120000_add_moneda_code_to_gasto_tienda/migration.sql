-- Currency of a store-level expense. NULL means the business base currency,
-- which is what every existing row is: amounts were stored in base until now,
-- so backfilling NULL is the identity migration.
-- Only meaningful for tipoCalculo = 'MONTO_FIJO'; percentage-based expenses
-- derive from base-currency totals and have no currency of their own.
ALTER TABLE "GastoTienda" ADD COLUMN "monedaCode" TEXT;
