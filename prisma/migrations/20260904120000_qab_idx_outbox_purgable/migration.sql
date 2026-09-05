-- Covers the "processed" phase of the outbox purge (F-019). Partial, like
-- idx_outbox_pendiente (ADR 0012), and like it NOT declared in schema.prisma:
-- Prisma cannot express a partial index. One single statement per ADR 0002 —
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block and Prisma
-- wraps any multi-statement file in an implicit one. Do not add a second one.
-- Unlike idx_outbox_pendiente this index DOES grow with the history; its bound
-- is QAB_OUTBOX_PROCESSED_TTL_DAYS, i.e. that this very purge keeps running
-- (ADR 0041).
-- Recovery if the concurrent build fails halfway (leaves an INVALID index that
-- IF NOT EXISTS would then skip forever):
--   SELECT indisvalid FROM pg_index WHERE indexrelid = 'idx_outbox_purgable'::regclass;
--   DROP INDEX CONCURRENTLY IF EXISTS "idx_outbox_purgable";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_outbox_purgable"
  ON "OutboxEvento" ("procesadoAt") WHERE "procesadoAt" IS NOT NULL;
