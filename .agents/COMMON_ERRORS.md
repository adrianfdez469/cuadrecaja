# Errores Conocidos

> **Índice.** El detalle de cada error vive en `.agents/errors/`. Este archivo se carga en
> contexto global, así que se mantiene corto a propósito: **consúltalo antes de depurar** y abre
> solo la ficha que necesites.

## Frecuentes (≥3 apariciones)

Errores que ya se repitieron lo suficiente como para tener su resumen aquí mismo. Si vas a tocar
el área correspondiente, léelos antes de escribir código.

_(vacío — ningún error ha llegado todavía a 3 apariciones)_

## Registrados

| ID | Síntoma | Área | Veces |
|----|---------|------|-------|
| [E-001](errors/E-001-rutas-de-maquina-en-archivos-compartidos.md) | Una ruta de la máquina de un dev horneada en un archivo que se comparte por git; falla en silencio para todos los demás | build | 2 |
| [E-002](errors/E-002-servidor-dev-con-cliente-prisma-viejo.md) | Un `npm run dev` levantado antes de la migración sirve un cliente de Prisma viejo: la columna nueva "no aparece" y la verificación da un falso aprobado | prisma | 1 |
| [E-003](errors/E-003-literales-bigint-con-target-es2017.md) | `TS2737: BigInt literals are not available when targeting lower than ES2020` al escribir `880n` | tests | 1 |
| [E-004](errors/E-004-prisma-migrate-create-only-no-interactivo.md) | `prisma migrate dev --create-only` aborta con "environment is non-interactive" cuando el diff traería una confirmación | prisma | 1 |
| [E-005](errors/E-005-resize-window-no-cambia-el-viewport.md) | `resize_window` informa de éxito pero el viewport no cambia: la media query móvil sigue en `false` y la verificación responsive da un falso aprobado | ui | 1 |
| [E-006](errors/E-006-comillas-sin-escapar-en-el-description-de-un-agente.md) | Una comilla sin escapar en el `description` de un agente rompe el frontmatter y lo borra del registro, sin ningún mensaje | build | 1 |

---

## Cómo registrar un error

1. Crear `.agents/errors/E-###-<slug>.md` con la plantilla de `.agents/errors/TEMPLATE.md`.
2. Añadir una fila a **Registrados** con `Veces: 1`.
3. Si el error ya existe, **no crear archivo nuevo**: incrementar `Veces` y añadir el feature
   donde reapareció a la ficha existente.
4. Al llegar a **3 apariciones**, subirlo a **Frecuentes** con su fix resumido en una línea.

**Qué registrar:** todo error que costó más de un intento resolver, o cuya causa no era evidente
desde el mensaje. Un typo que se arregló a la primera no va aquí.
