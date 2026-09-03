# E-004: `prisma migrate dev --create-only` falla en un entorno no interactivo

**Área:** prisma
**Apariciones:** 1 — F-001

## Síntoma

```
Prisma Migrate has detected that the environment is non-interactive.
```

Al intentar generar el `migration.sql` sin aplicarlo, estando un agente al mando de la terminal.

## Causa raíz

`migrate dev --create-only` es interactivo **en cuanto el diff contiene algo que exigiría una
confirmación**. En F-001 lo exigía un `@@unique` nuevo sobre una tabla con datos: Prisma quiere
preguntar si se acepta el riesgo de que la restricción falle. Sin TTY no puede preguntar, y aborta.

No es que el flag no funcione sin terminal: funciona mientras el diff sea trivial. Falla justo
cuando el cambio es delicado, que es cuando más falta hace.

## Solución

Generar el SQL con `migrate diff`, que es puramente declarativo y nunca pregunta, y aplicarlo
después con el `migrate dev` normal (que sí es no interactivo cuando solo hay migraciones
pendientes por aplicar):

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel  prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_<nombre>/migration.sql
npx prisma migrate dev
```

El resultado es byte a byte el que habría producido `--create-only`.

## Cómo evitarlo

Cuando una migración necesite escribirse a mano —el caso típico en este repo es el
`CREATE INDEX CONCURRENTLY`, que va en su propia migración de una sola sentencia (ver
[ADR 0002](../../docs/adr/0002-create-index-concurrently-en-migracion-aislada.md))— **no pases por
`--create-only`: usa `migrate diff --script`.** Y no leas el mensaje de "entorno no interactivo"
como que hace falta un humano: hace falta otro comando.
