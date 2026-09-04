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
| [E-002](errors/E-002-servidor-dev-con-cliente-prisma-viejo.md) | Un `npm run dev` levantado antes de la migración sirve un cliente de Prisma viejo: la columna nueva "no aparece" y la verificación da un falso aprobado | prisma | 2 |
| [E-003](errors/E-003-literales-bigint-con-target-es2017.md) | `TS2737: BigInt literals are not available when targeting lower than ES2020` al escribir `880n` | tests | 1 |
| [E-004](errors/E-004-prisma-migrate-create-only-no-interactivo.md) | `prisma migrate dev --create-only` aborta con "environment is non-interactive" cuando el diff traería una confirmación | prisma | 1 |
| [E-005](errors/E-005-resize-window-no-cambia-el-viewport.md) | El viewport no es el que se cree y la verificación responsive da un falso aprobado: por `resize_window`, o por un iframe comprimido en un flex sin `flex: 0 0 auto` | ui | 2 |
| [E-006](errors/E-006-comillas-sin-escapar-en-el-description-de-un-agente.md) | Una comilla sin escapar en el `description` de un agente rompe el frontmatter y lo borra del registro, sin ningún mensaje | build | 1 |
| [E-007](errors/E-007-pagina-publica-que-llama-a-una-api-cerrada.md) | Una página pública llama a una API que se acaba de cerrar: el 401 pasa por el interceptor de `axiosClient`, que hace `signOut()`, y el visitante anónimo acaba expulsado a `/login` | auth | 1 |
| [E-008](errors/E-008-datos-de-prueba-que-no-discriminan.md) | El criterio pasa, pero habría pasado igual con el código roto: los datos locales no distinguen las dos ramas que se comparan | tests | 1 |
| [E-009](errors/E-009-el-interceptor-destruye-el-cuerpo-de-cualquier-403.md) | `axiosClient` sustituye el cuerpo de **cualquier** 403 por un error genérico de permisos: el frontend no puede distinguir su propio 403, y el mensaje manda a arreglar lo que no está roto. Hermano de E-007 | auth | 1 |
| [E-010](errors/E-010-comentarios-de-ejemplo-en-espanol-en-un-contrato.md) | Un comentario en español dentro de un bloque de código de un contrato acaba copiado en `src/`: los bloques de un contrato se leen como plantilla, no como prosa | build | 1 |
| [E-011](errors/E-011-medir-el-contenedor-equivocado-de-mui.md) | `querySelector('.MuiContainer-root')` encuentra el `Container` del `Layout`, no el de la página: la medida es plausible y lleva a rechazar una implementación correcta | ui | 1 |
| [E-012](errors/E-012-un-subagente-devolvio-un-resultado-fabricado.md) | Un subagente devuelve un informe convincente sin haber usado ninguna herramienta: parafrasea el encargo con los verbos en pasado | build | 1 |
| [E-013](errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md) | Una columna que **nadie escribe** usada como señal de estado: no da error, da siempre el mismo valor, y la condición nunca toma la otra rama | ui | 1 |
| [E-014](errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) | El nombre de una señal derivada dice una cosa y su consulta calcula otra; la definición parafraseada en ocho sitios hace que una corrección deje alguna atrás | api | 1 |
| [E-015](errors/E-015-un-simbolo-en-un-tsx-no-es-importable-desde-un-test.md) | Ningún símbolo que viva en un `.tsx` es importable desde un test (`jsx: preserve` sin override en `vitest.config.ts`), aunque sea una función pura sin React | tests | 1 |
| [E-016](errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md) | Un criterio de diseño exige una subcadena literal que el copy dictado por el mismo documento no contiene: el rechazo señala a código correcto | ui | 1 |

---

## Cómo registrar un error

1. Crear `.agents/errors/E-###-<slug>.md` con la plantilla de `.agents/errors/TEMPLATE.md`.
2. Añadir una fila a **Registrados** con `Veces: 1`.
3. Si el error ya existe, **no crear archivo nuevo**: incrementar `Veces` y añadir el feature
   donde reapareció a la ficha existente.
4. Al llegar a **3 apariciones**, subirlo a **Frecuentes** con su fix resumido en una línea.

**Qué registrar:** todo error que costó más de un intento resolver, o cuya causa no era evidente
desde el mensaje. Un typo que se arregló a la primera no va aquí.
