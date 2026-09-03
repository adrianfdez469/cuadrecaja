-- Partial index covering the outbox drain query (QAB contract, § ①).
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block: Postgres wraps
-- a multi-statement query string in an implicit transaction, so this migration
-- holds exactly ONE statement, on purpose. Do not add a second one. See ADR 0002.
-- The predicate deliberately leaves out `intentos < 6`: see ADR 0012 for the
-- measurements. It is not declared in schema.prisma — Prisma cannot express a
-- partial index, and its diff does not drop what it cannot represent (ADR 0002).
-- Recovery if the concurrent build fails halfway (leaves an INVALID index):
--   DROP INDEX CONCURRENTLY IF EXISTS "idx_outbox_pendiente";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_outbox_pendiente"
  ON "OutboxEvento" (id) WHERE "procesadoAt" IS NULL;
