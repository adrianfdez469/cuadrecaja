# Errores Conocidos

> **Índice.** El detalle de cada error vive en `.agents/errors/`. Este archivo se carga en
> contexto global, así que se mantiene corto a propósito: **consúltalo antes de depurar** y abre
> solo la ficha que necesites.

## Frecuentes (≥3 apariciones)

Errores que ya se repitieron lo suficiente como para tener su resumen aquí mismo. Si vas a tocar
el área correspondiente, léelos antes de escribir código.

| ID | Fix en una línea |
|----|------------------|
| [E-010](errors/E-010-comentarios-de-ejemplo-en-espanol-en-un-contrato.md) | Los bloques de código de un contrato se leen como **plantilla** y acaban en `src/`: no escribas dentro de ellos comentarios en español, ni menciones el nombre de lo que el propio contrato prohíbe nombrar. |
| [E-016](errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md) | Antes de exigir una subcadena, búscala en el copy fijo, en los **valores formateados** (`1.400,00` contiene `0,00`) y en el copy que los **features anteriores** ya pintan en esa ruta; acota el criterio a su región, nunca a `document.body`; si lees `textContent`, compara con lo que el DOM guarda (`text-transform` no lo toca); y un criterio de **ausencia** por `grep` cae con tus propios comentarios explicativos. |
| [E-031](errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) | `JSON.parse`, `BigInt`, `Number` y los drivers **citan el dato que los rompió** en el mensaje: nunca loguees el error, loguea una constante fija — y antes de quitar una guarda «defensiva», mira qué diría la excepción que evita. |

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
| [E-010](errors/E-010-comentarios-de-ejemplo-en-espanol-en-un-contrato.md) | Un comentario dentro de un bloque de código de un contrato acaba copiado en `src/`: los bloques de un contrato se leen como plantilla, no como prosa. En F-010 y en F-011, el mismo comentario nombraba las columnas que el propio contrato prohibía exponer | build | **3** |
| [E-011](errors/E-011-medir-el-contenedor-equivocado-de-mui.md) | `querySelector('.MuiContainer-root')` encuentra el `Container` del `Layout`, no el de la página: la medida es plausible y lleva a rechazar una implementación correcta. También con búsquedas por texto. Adenda F-011: filtrar por clase puede acertar **hoy** y por accidente | ui | 2 |
| [E-012](errors/E-012-un-subagente-devolvio-un-resultado-fabricado.md) | Un subagente devuelve un informe convincente sin haber usado ninguna herramienta: parafrasea el encargo con los verbos en pasado | build | 1 |
| [E-013](errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md) | Una columna que **nadie escribe** usada como señal de estado: no da error, da siempre el mismo valor, y la condición nunca toma la otra rama | ui | 1 |
| [E-014](errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) | El nombre de una señal derivada dice una cosa y su consulta calcula otra; la definición parafraseada en ocho sitios hace que una corrección deje alguna atrás | api | 1 |
| [E-015](errors/E-015-un-simbolo-en-un-tsx-no-es-importable-desde-un-test.md) | Ningún símbolo que viva en un `.tsx` es importable desde un test (`jsx: preserve` sin override en `vitest.config.ts`), aunque sea una función pura sin React | tests | 1 |
| [E-016](errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md) | Un criterio de diseño exige una subcadena literal que el copy dictado por el mismo documento no contiene: el rechazo señala a código correcto. F-011 y F-012 añaden cuatro variantes, incluida la subcadena que ya pintaba **otro feature** en la misma ruta, y la prohibida que aparece en **tus propios comentarios** | ui | **4** |
| [E-017](errors/E-017-un-absoluto-en-un-contrato-que-el-codigo-no-sostiene.md) | Un absoluto («NEVER THROWS», «sin N+1», «ningún X en el DOM») escrito en un contrato o un ADR que el código no sostiene; el `qa` lo lee como especificación y rechaza código correcto | build | 2 |
| [E-018](errors/E-018-la-redaccion-congelada-de-un-criterio-diferido.md) | Un criterio diferido se ejecuta con su redacción congelada, ya contradicha por un ADR posterior | tests | 1 |
| [E-019](errors/E-019-it-each-con-un-simbolo-que-aun-no-existe.md) | `it.each` con un símbolo del contrato aún inexistente falla en la fase de colección y tumba **todos** los tests del archivo, incluidos los que estaban en verde | tests | 1 |
| [E-020](errors/E-020-estimar-lineas-o-alto-con-un-contenedor-acotado.md) | Un criterio de diseño estima líneas o alto sin medir, y con un `maxWidth` acotado dos anchos distintos son el mismo ancho de texto: falla contra código correcto | ui | 1 |
| [E-021](errors/E-021-el-local-actual-vive-en-el-jwt-y-no-en-la-base.md) | Se cambia `Usuario.localActualId` en la base y el navegador sigue viendo el local viejo: el dato viaja en el JWT de la sesión, no se lee en vivo | auth | 1 |
| [E-022](errors/E-022-clicks-por-coordenada-sobre-una-captura-reescalada.md) | Un click por coordenada no hace nada: la captura viene reescalada y sus coordenadas no son las del viewport | ui | 1 |
| [E-023](errors/E-023-medir-un-plan-sobre-una-tabla-que-no-tiene-las-filas.md) | Un `EXPLAIN` leido sobre una tabla sin las filas del caso —nunca sembradas, o borradas por la propia operacion medida—: el plan es valido y la conclusion falsa, en las dos direcciones | prisma | 2 |
| [E-024](errors/E-024-createmany-skipduplicates-conserva-la-primera-escritura.md) | `createMany({ skipDuplicates })` sobre filas derivadas: la segunda escritura no falla **y no escribe**; los totales quedan nuevos y el desglose viejo | prisma | 1 |
| [E-025](errors/E-025-un-subagente-se-desvia-de-su-mandato-y-contamina-el-entorno.md) | Un subagente lanzado con un mandato acotado hereda el contexto del padre, lee sus planes como propios y ejecuta contra la misma base de datos: los conteos de la verificación dejan de significar nada | build | 2 |
| [E-026](errors/E-026-la-suite-en-verde-no-implica-tsc-limpio.md) | `npm test` en verde con `npx tsc --noEmit` en rojo: Vitest no comprueba tipos. Y una comprobación **caduca** cuando el árbol cambia | tests | 1 |
| [E-027](errors/E-027-medir-un-componente-de-mui-a-media-transicion.md) | Medir un componente con transición de entrada (`Grow`, `Zoom`, `Fade`) antes de que termine: `getBoundingClientRect` devuelve la caja **escalada** y la cifra intermedia es plausible | ui | 1 |
| [E-028](errors/E-028-un-ciclo-de-valor-entre-dos-modulos-de-schemas.md) | Un ciclo de **valor** entre dos módulos que evalúan schemas en el tope: `tsc --noEmit` da exit 0 y la carga revienta con un `TypeError` de Zod que tumba suites ajenas | build | 1 |
| [E-029](errors/E-029-un-tope-heredado-que-no-cabe-el-lote-propio.md) | Un tope de respuesta heredado de otro cliente en el que no cabe la confirmación de la página propia: no da error recuperable, da **estancamiento permanente** | api | 1 |
| [E-030](errors/E-030-un-contrato-que-se-contradice-entre-su-docstring-y-su-adr.md) | El docstring de una firma y el criterio ejecutable de su ADR afirman cosas incompatibles: implementación y tests, escritos sin verse, divergen y ninguno de los dos se equivocó | build | 1 |
| [E-031](errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) | El mensaje que fabrica el runtime (`JSON.parse`, `BigInt`, un driver) **cita el dato que lo causó**: la regla «esa credencial nunca va a un log» se incumple por una vía que nadie escribe | auth | **3** |
| [E-032](errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) | Una guarda implementada más ancha que la del contrato: pasa todas sus propias pruebas, porque la rama que sobra no está en el contrato y nadie recuerda probarla | api | 1 |
| [E-033](errors/E-033-es-es-no-agrupa-los-millares-de-cuatro-digitos.md) | `Intl.NumberFormat("es-ES")` no agrupa los millares hasta las cinco cifras (`minimumGroupingDigits: 2`): `1250` sale `1250,00` y el ejemplo trabajado del propio contrato no se cumple | ui | 1 |
| [E-034](errors/E-034-el-cache-de-turbopack-sobrevive-al-reinicio.md) | El caché de Turbopack dev vive en `.next/cache/turbopack/*.sst` y **sobrevive al reinicio del proceso**: una escritura directa en la base que se salta las revalidaciones de la app sirve el estado viejo hasta un `rm -rf .next` | build | 1 |
| [E-035](errors/E-035-la-lista-de-testabilidad-cierra-antes-que-el-diseno.md) | La lista de testabilidad del contrato se cierra en el paso 4 y el `ui-designer` añade símbolos puros en el 4b: la lista nace incompleta y nadie la actualiza | build | 2 |

---

## Cómo registrar un error

1. Crear `.agents/errors/E-###-<slug>.md` con la plantilla de `.agents/errors/TEMPLATE.md`.
2. Añadir una fila a **Registrados** con `Veces: 1`.
3. Si el error ya existe, **no crear archivo nuevo**: incrementar `Veces` y añadir el feature
   donde reapareció a la ficha existente.
4. Al llegar a **3 apariciones**, subirlo a **Frecuentes** con su fix resumido en una línea.

**Qué registrar:** todo error que costó más de un intento resolver, o cuya causa no era evidente
desde el mensaje. Un typo que se arregló a la primera no va aquí.
