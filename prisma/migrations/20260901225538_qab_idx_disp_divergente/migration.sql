-- Partial divergence index for availability (QAB contract, § ②).
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block: Postgres wraps
-- a multi-statement query string in an implicit transaction, so this migration
-- holds exactly ONE statement, on purpose. Do not add a second one. See ADR 0002.
-- Recovery if the concurrent build fails halfway (leaves an INVALID index):
--   DROP INDEX CONCURRENTLY IF EXISTS "idx_disp_divergente";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_disp_divergente" ON "ProductoTienda" (id)
WHERE (CASE WHEN existencia <= 0             THEN 'OUT_OF_STOCK'
            WHEN existencia <= "umbralBajo"  THEN 'LOW_STOCK'
            ELSE                                  'AVAILABLE' END)
      IS DISTINCT FROM "dispPublicada";
