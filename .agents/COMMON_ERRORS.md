# Errores Conocidos

> **Índice.** El detalle de cada error vive en `.agents/errors/`. Este archivo lo leen todos los
> agentes del pipeline en cada corrida, así que se mantiene corto a propósito: **consúltalo antes
> de depurar** y abre solo la ficha que necesites.
>
> **Una fila es UNA línea.** Ni adendas, ni variantes, ni relato del incidente: eso va a la ficha,
> que es donde el lector ya ha decidido entrar. Este documento creció de 1,2 KB a 42 KB en once
> días por acumular aquí lo que ya estaba allí, y lo pagaban cinco agentes en cada feature.
> `npm run harness:check` comprueba que toda ficha esté indexada y que ninguna fila quede fuera de
> las tablas — las tres últimas registradas se habían colado al final del archivo, invisibles.

## Frecuentes (≥3 apariciones)

Errores que ya se repitieron lo suficiente como para tener su resumen aquí mismo. Si vas a tocar
el área correspondiente, léelos antes de escribir código.

| ID | Fix en una línea |
|----|------------------|
| [E-010](errors/E-010-comentarios-de-ejemplo-en-espanol-en-un-contrato.md) | Los bloques de código de un contrato se leen como **plantilla** y acaban en `src/`: no escribas dentro de ellos comentarios en español, ni menciones el nombre de lo que el propio contrato prohíbe… |
| [E-001](errors/E-001-rutas-de-maquina-en-archivos-compartidos.md) | Corre el `grep` de rutas de máquina sobre **TODO** lo que el feature añadió a `.agents/`, **incluido el informe de QA** — la tercera aparición entró como metadato de cabecera («verificado en |
| [E-008](errors/E-008-datos-de-prueba-que-no-discriminan.md) | Pregúntate **con qué datos habría fallado esto**: si la respuesta es «con ninguno», el criterio no prueba nada |
| [E-011](errors/E-011-medir-el-contenedor-equivocado-de-mui.md) | Mide el elemento que **es** lo que buscas (el que lleva el `bgcolor`, el que está DENTRO del del `Layout`), nunca el primero que encuentras desde un icono o una clase |
| [E-017](errors/E-017-un-absoluto-en-un-contrato-que-el-codigo-no-sostiene.md) | Un absoluto de contrato se comprueba **contra el código, no contra su propia prosa**: abre el componente compartido que mandas reutilizar y mira qué renderiza antes de escribir «ningún X en el DOM» |
| [E-016](errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md) | Busca la subcadena en el copy fijo y en los **valores formateados** (`1.400,00` contiene `0,00`); acota el criterio a su región, nunca a `document.body`. Para afirmar que algo **se pinta**, grepea el **consumo del campo**, no el *call site* de quien lo produce |
| [E-065](errors/E-065-una-enmienda-del-contrato-posterior-al-paso-5.md) | Agrupar las enmiendas **reduce la ventana, no la cierra**: el paso 5 es el primero que ejecuta algo, así que puede destapar un hueco del contrato en cualquier momento |
| [E-031](errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) | `JSON.parse`, `BigInt`, `Number` y los drivers **citan el dato que los rompió** en el mensaje |
| [E-026](errors/E-026-la-suite-en-verde-no-implica-tsc-limpio.md) | La suite en verde **no** implica `tsc` limpio: Vitest no comprueba tipos, así que una llamada que la implementación acepta y la **interfaz** no pasa en verde y cae en `npx tsc --noEmit` |
| [E-053](errors/E-053-un-script-suelto-no-es-el-entorno-de-modulos-del-repo.md) | **Si el script lleva un `import`, su sitio es el repositorio, no el scratchpad** — aunque sea de usar y tirar, y aunque el import sea de un paquete y no de `src/` |
| [E-052](errors/E-052-prisma-format-no-es-idempotente.md) | `git checkout <archivo>` no deshace tu último cambio: deshace **todo lo no commiteado de ese archivo** |
| [E-035](errors/E-035-la-lista-de-testabilidad-cierra-antes-que-el-diseno.md) | El `ui-designer` añade símbolos puros **después** de que el contrato cerrara su lista de testabilidad: al volver del paso 4b, comprueba el cruce antes del paso 5 y devuelve al arquitecto si el diseño nombra funciones que el contrato no enumera |
| [E-059](errors/E-059-la-tabla-de-monedas-no-contiene-la-moneda-base.md) | `monedasNegocio` **no incluye la moneda base**: usa `useMonedaOptions` en componentes y `buildMonedaOptions` en lógica pura, nunca la tabla en crudo. Un gate como `lista.length > 1` merece comprobar qué contiene la lista para el negocio más simple |

## Registrados

| ID | Síntoma | Área | Veces |
|----|---------|------|-------|
| [E-001](errors/E-001-rutas-de-maquina-en-archivos-compartidos.md) | Una ruta de la máquina de un dev horneada en un archivo que se comparte por git; falla en silencio para todos los demás | build | **3** |
| [E-002](errors/E-002-servidor-dev-con-cliente-prisma-viejo.md) | Un `npm run dev` levantado antes de la migración sirve un cliente de Prisma viejo: la columna nueva "no aparece" y la verificación da un falso aprobado | prisma | 2 |
| [E-003](errors/E-003-literales-bigint-con-target-es2017.md) | `TS2737: BigInt literals are not available when targeting lower than ES2020` al escribir `880n` | tests | 1 |
| [E-004](errors/E-004-prisma-migrate-create-only-no-interactivo.md) | `prisma migrate dev --create-only` aborta con "environment is non-interactive" cuando el diff traería una confirmación | prisma | 1 |
| [E-005](errors/E-005-resize-window-no-cambia-el-viewport.md) | El viewport no es el que se cree y la verificación responsive da un falso aprobado: por `resize_window`, o por un iframe comprimido en un flex sin `flex: 0 0 auto` | ui | 2 |
| [E-006](errors/E-006-comillas-sin-escapar-en-el-description-de-un-agente.md) | Una comilla sin escapar en el `description` de un agente rompe el frontmatter y lo borra del registro, sin ningún mensaje | build | 1 |
| [E-007](errors/E-007-pagina-publica-que-llama-a-una-api-cerrada.md) | Una página pública llama a una API que se acaba de cerrar: el 401 pasa por el interceptor de `axiosClient`, que hace `signOut()`, y el visitante anónimo acaba expulsado… | auth | 1 |
| [E-008](errors/E-008-datos-de-prueba-que-no-discriminan.md) | El criterio pasa, pero habría pasado igual con el código roto: los datos locales no distinguen las dos ramas que se comparan | tests | **4** |
| [E-009](errors/E-009-el-interceptor-destruye-el-cuerpo-de-cualquier-403.md) | `axiosClient` sustituye el cuerpo de **cualquier** 403 por un error genérico de permisos | auth | 1 |
| [E-010](errors/E-010-comentarios-de-ejemplo-en-espanol-en-un-contrato.md) | Un comentario dentro de un bloque de código de un contrato acaba copiado en `src/`: los bloques de un contrato se leen como plantilla, no como prosa | build | **4** |
| [E-011](errors/E-011-medir-el-contenedor-equivocado-de-mui.md) | `querySelector('.MuiContainer-root')` encuentra el `Container` del `Layout`, no el de la página: la medida es plausible y lleva a rechazar una implementación correcta | ui | **5** |
| [E-012](errors/E-012-un-subagente-devolvio-un-resultado-fabricado.md) | Un subagente devuelve un informe convincente sin haber usado ninguna herramienta: parafrasea el encargo con los verbos en pasado | build | 1 |
| [E-013](errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md) | Una columna que **nadie escribe** usada como señal de estado: no da error, da siempre el mismo valor, y la condición nunca toma la otra rama | ui | 1 |
| [E-014](errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) | El nombre de una señal derivada dice una cosa y su consulta calcula otra; la definición parafraseada en ocho sitios hace que una corrección deje alguna atrás | api | 1 |
| [E-015](errors/E-015-un-simbolo-en-un-tsx-no-es-importable-desde-un-test.md) | Ningún símbolo que viva en un `.tsx` es importable desde un test (`jsx: preserve` sin override en `vitest.config.ts`), aunque sea una función pura sin React | tests | 1 |
| [E-016](errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md) | Un criterio de diseño exige una subcadena literal que el copy dictado por el mismo documento no contiene: el rechazo señala a código correcto | ui | **9** |
| [E-017](errors/E-017-un-absoluto-en-un-contrato-que-el-codigo-no-sostiene.md) | Un absoluto («NEVER THROWS», «sin N+1», «ningún X en el DOM») escrito en un contrato o un ADR que el código no sostiene | build | **4** |
| [E-018](errors/E-018-la-redaccion-congelada-de-un-criterio-diferido.md) | Un criterio diferido se ejecuta con su redacción congelada, ya contradicha por un ADR posterior | tests | 1 |
| [E-019](errors/E-019-it-each-con-un-simbolo-que-aun-no-existe.md) | `it.each` con un símbolo del contrato aún inexistente falla en la fase de colección y tumba **todos** los tests del archivo, incluidos los que estaban en verde | tests | 2 |
| [E-020](errors/E-020-estimar-lineas-o-alto-con-un-contenedor-acotado.md) | Un criterio de diseño estima líneas o alto sin medir, y con un `maxWidth` acotado dos anchos distintos son el mismo ancho de texto: falla contra código correcto | ui | 1 |
| [E-021](errors/E-021-el-local-actual-vive-en-el-jwt-y-no-en-la-base.md) | Se cambia `Usuario.localActualId` en la base y el navegador sigue viendo el local viejo: el dato viaja en el JWT de la sesión, no se lee en vivo | auth | 1 |
| [E-022](errors/E-022-clicks-por-coordenada-sobre-una-captura-reescalada.md) | Un click por coordenada no hace nada: la captura viene reescalada y sus coordenadas no son las del viewport | ui | 1 |
| [E-023](errors/E-023-medir-un-plan-sobre-una-tabla-que-no-tiene-las-filas.md) | Un `EXPLAIN` leido sobre una tabla sin las filas del caso —nunca sembradas, o borradas por la propia operacion medida— | prisma | 2 |
| [E-024](errors/E-024-createmany-skipduplicates-conserva-la-primera-escritura.md) | `createMany({ skipDuplicates })` sobre filas derivadas: la segunda escritura no falla **y no escribe**; los totales quedan nuevos y el desglose viejo | prisma | 1 |
| [E-025](errors/E-025-un-subagente-se-desvia-de-su-mandato-y-contamina-el-entorno.md) | Un subagente lanzado con un mandato acotado hereda el contexto del padre, lee sus planes como propios y ejecuta contra la misma base de datos | build | 2 |
| [E-026](errors/E-026-la-suite-en-verde-no-implica-tsc-limpio.md) | `npm test` en verde con `npx tsc --noEmit` en rojo: Vitest no comprueba tipos. Y una comprobación **caduca** cuando el árbol cambia | tests | **3** |
| [E-027](errors/E-027-medir-un-componente-de-mui-a-media-transicion.md) | Medir un componente con transición de entrada (`Grow`, `Zoom`, `Fade`) antes de que termine | ui | 1 |
| [E-028](errors/E-028-un-ciclo-de-valor-entre-dos-modulos-de-schemas.md) | Un ciclo de **valor** entre dos módulos que evalúan schemas en el tope: `tsc --noEmit` da exit 0 y la carga revienta con un `TypeError` de Zod que tumba suites ajenas | build | 1 |
| [E-029](errors/E-029-un-tope-heredado-que-no-cabe-el-lote-propio.md) | Un tope de respuesta heredado de otro cliente en el que no cabe la confirmación de la página propia: no da error recuperable, da **estancamiento permanente** | api | 1 |
| [E-030](errors/E-030-un-contrato-que-se-contradice-entre-su-docstring-y-su-adr.md) | El docstring de una firma y el criterio ejecutable de su ADR afirman cosas incompatibles | build | 1 |
| [E-031](errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) | El mensaje que fabrica el runtime (`JSON.parse`, `BigInt`, un driver) **cita el dato que lo causó** | auth | **3** |
| [E-032](errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) | Una guarda implementada más ancha que la del contrato: pasa todas sus propias pruebas, porque la rama que sobra no está en el contrato y nadie recuerda probarla | api | 1 |
| [E-033](errors/E-033-es-es-no-agrupa-los-millares-de-cuatro-digitos.md) | `Intl.NumberFormat("es-ES")` no agrupa los millares hasta las cinco cifras (`minimumGroupingDigits: 2`) | ui | 2 |
| [E-034](errors/E-034-el-cache-de-turbopack-sobrevive-al-reinicio.md) | El caché de Turbopack dev vive en `.next/cache/turbopack/*.sst` y **sobrevive al reinicio del proceso** | build | 1 |
| [E-035](errors/E-035-la-lista-de-testabilidad-cierra-antes-que-el-diseno.md) | La lista de testabilidad del contrato se cierra en el paso 4 y el `ui-designer` añade símbolos puros en el 4b: la lista nace incompleta y nadie la actualiza | build | 4 |
| [E-036](errors/E-036-strict-false-rompe-el-estrechamiento-por-booleano.md) | Con `strict: false`, `if (!x.flag)` **no estrecha** una unión discriminada por booleano y `tsc` da `TS2339` señalando la propiedad, como si la unión estuviera mal declarada | build | 2 |
| [E-037](errors/E-037-un-criterio-de-diseno-con-una-premisa-fisica-falsa.md) | Un criterio de diseño con el número **bien medido** y la **premisa falsa** sobre un componente compartido (`Container maxWidth` solo topa desde su propio breakpoint… | ui | 2 |
| [E-038](errors/E-038-el-p2002-no-se-recupera-dentro-de-la-transaccion.md) | Un `P2002` **no se puede recuperar dentro** de un `$transaction`: en Postgres la violación aborta la transacción entera y el `catch` no la revierte | prisma | 1 |
| [E-039](errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md) | El contrato **describe con sus palabras** lo que el motor o una función de `src/lib/` ya definen: la paráfrasis no hereda los casos borde y se convierte en especificación | build | 1 |
| [E-040](errors/E-040-colision-de-fixtures-entre-verificaciones-concurrentes.md) | Dos verificaciones concurrentes sobre la **misma base de desarrollo**: la limpieza de una barre los fixtures de la otra. Ambas dentro de su mandato, a diferencia de E-025 | tests | 1 |
| [E-041](errors/E-041-roving-tabindex-derivado-de-la-seleccion.md) | Un roving `tabIndex` derivado de «qué está elegido» y no de «dónde está el recorrido» | ui | 1 |
| [E-042](errors/E-042-un-barrido-cuenta-una-mencion-como-si-fuera-un-filtro.md) | Un barrido de seguridad marca una ruta **protegida** porque encontró la palabra `negocioId`… en una **guarda de nulidad**. Y su hermana | build | 1 |
| [E-043](errors/E-043-una-columna-unique-global-usada-para-idempotencia-es-un-eje-de-tenant.md) | Una columna `@unique` **global** usada para idempotencia (`syncId`) es un eje de tenant más | prisma | 1 |
| [E-044](errors/E-044-type-text-duplica-en-inputs-controlados.md) | `type-text` de `orca computer` **duplica el texto** en los inputs controlados de React/MUI de esta app; `paste-text` no. El síntoma parece un problema de foco | ui | 1 |
| [E-045](errors/E-045-el-exit-code-de-un-pipe-no-es-el-del-comando.md) | `$?` tras un pipe es el de `tail`/`head`/`grep`, no el del comando: `npm run lint` con exit 1 se reportó "en verde" por tres agentes seguidos, y el único `Error:` real… | build | 1 |
| [E-046](errors/E-046-ruta-de-salida-compartida-entre-agentes-paralelos.md) | Dos agentes del paso 5 con la MISMA ruta de salida de verificación se pisan el archivo, y un `lint` de árbol completo durante el paso 5 sale en rojo por trabajo ajeno en… | build | 1 |
| [E-047](errors/E-047-un-replace-sobre-la-linea-ancla-borra-el-import-vecino.md) | Un `replace` que **sustituye** la línea-ancla en vez de insertar antes de ella borra el import vecino | build | 2 |
| [E-048](errors/E-048-el-item-flex-atrapa-el-margen-de-su-hijo.md) | Envolver en un contenedor "sin estilos" un elemento que hoy es ítem flex directo de su padre **atrapa el margen propio de ese elemento** | ui | 1 |
| [E-049](errors/E-049-deducir-una-clasificacion-de-la-forma-del-identificador.md) | Deducir una clasificación de la **forma** del identificador (longitud, prefijo) en vez de pedirla como dato | api | 1 |
| [E-050](errors/E-050-una-cadena-de-fallback-oculta-que-rama-respondio.md) | `ls A || ls B` imprime la salida de la rama que triunfó pero **no cuál fue**, y con `2>/dev/null` la evidencia de que A falló desaparece | build | 1 |
| [E-051](errors/E-051-probar-la-puerta-de-un-cron-ejecuta-el-cron.md) | Probar la puerta de autenticación de un cron **ejecuta el cron**: la llamada de control, la que SÍ pasa, corrió la orquestación completa **sin acotar** y puso 42 filas… | tests | 1 |
| [E-052](errors/E-052-prisma-format-no-es-idempotente.md) | `prisma format` reformatea modelos ajenos y ensucia un PR atómico; y `git checkout <archivo>` no deshace tu último cambio, deshace todo lo no commiteado de ese archivo | prisma | **3 — ver Frecuentes** |
| [E-053](errors/E-053-un-script-suelto-no-es-el-entorno-de-modulos-del-repo.md) | Un script desechable fuera del árbol del proyecto **no hereda su entorno de módulos** | tests | **3 — ver Frecuentes** |
| [E-054](errors/E-054-una-recarga-completa-no-es-volver-en-la-misma-sesion.md) | `page.goto`/`reload` prueban **el arranque en frío, no la vuelta**: en una pantalla que navega con `router.replace`, medir el caché con una recarga da… | tests | 2 |
| [E-055](errors/E-055-medir-un-hijo-al-100-contra-la-cifra-del-contenedor-con-borde.md) | Un criterio da la cifra del **contenedor** y la medición es del **contenido** | ui | 1 |
| [E-056](errors/E-056-forzar-un-error-de-runtime-con-un-timeout-es-una-carrera.md) | Forzar la excepción de un criterio de ausencia con un `statement_timeout` corto es una **carrera**, y en la base local se pierde | tests | 1 |
| [E-057](errors/E-057-el-bearer-solo-vale-en-api-app-y-el-resto-quiere-cookie.md) | Un `Authorization: Bearer` correctamente firmado es rechazado por cualquier ruta gateada que no sea `/api/app` | auth | 1 |
| [E-058](errors/E-058-un-proxy-ignora-la-reasignacion-del-binding-exportado.md) | El cliente de Prisma se exporta detrás de un **`Proxy`** que atiende lecturas y **descarta escrituras** | tests | 1 |
| [E-059](errors/E-059-la-tabla-de-monedas-no-contiene-la-moneda-base.md) | `NegocioMoneda` **no contiene la moneda base** (vive en `Negocio.monedaBase`): un gate `monedasNegocio.length > 1` da 1 con base+una extra y el selector de moneda no se renderiza nunca | ui | **3** |
| [E-060](errors/E-060-una-identidad-de-referencia-usada-como-si-fuera-un-valor.md) | Una identidad de referencia nueva en cada render usada donde se esperaba un valor | ui | 2 |
| [E-061](errors/E-061-una-guarda-de-denegacion-antes-de-quien-concede-las-exenciones.md) | Una guarda de denegación colocada **antes** de la función que concede las exenciones las elimina todas | auth | 1 |
| [E-062](errors/E-062-una-desigualdad-estricta-entre-bottom-y-top-de-dos-hermanos.md) | Un criterio de diseño exige que el `top` de un elemento sea **mayor** que el `bottom` del anterior | ui | 1 |
| [E-063](errors/E-063-varios-agentes-mutando-el-mismo-arbol-a-la-vez.md) | Varios agentes verificando en paralelo sobre **el mismo árbol**: la auditoría por mutación rompe el código a propósito, así que todo lo que otro mida a la vez mide… | build | 1 |
| [E-064](errors/E-064-el-antes-de-un-criterio-lo-destruye-el-paso-que-lo-verifica.md) | Un criterio redactado como comparación («las mismas cifras que **antes de migrar**») tiene la mitad de su evidencia situada antes del cambio, y el paso 5 la destruye… | tests | 1 |
| [E-065](errors/E-065-una-enmienda-del-contrato-posterior-al-paso-5.md) | El contrato se enmienda **después** de que una mitad del paso 5 haya entregado | build | 3 |
| [E-066](errors/E-066-git-checkout-sobre-un-archivo-modificado-y-sin-commitear.md) | `git checkout -- <archivo>` **no es un deshacer**: devuelve el archivo a su último commit y destruye el trabajo sin commitear de todo el mundo, sin aviso y **sin dejar… | ui | 2 |
| [E-067](errors/E-067-una-key-reutilizada-mientras-el-nodo-anterior-aun-sale.md) | Una `key` de React reutilizada mientras el nodo anterior todavía está saliendo: la transición de salida y la de entrada se pisan | ui | 2 |
| [E-068](errors/E-068-un-valor-concreto-que-contradice-el-rango-que-el-mismo-documento-declara.md) | Un contrato declara un rango en una sección y escribe a mano, en otra, un valor de ejemplo que **no se sigue de él** | build | 1 |
| [E-069](errors/E-069-un-criterio-verificado-en-el-nivel-equivocado-de-la-pila.md) | Un criterio de navegador cita el `message` de un `.refine()` de Zod **como si fuera el mensaje HTTP**; la ruta lo colapsa a propósito para no citar el valor que falló (E-031) | ui | 1 |
| [E-070](errors/E-070-el-arreglo-del-bug-a-abre-el-camino-que-reabre-el-bug-b.md) | El arreglo del bug A introduce el camino que reabre el bug B, **en la línea que se añadió para proteger una tercera cosa** | ui | 1 |
| [E-071](errors/E-071-bytes-de-control-literales-en-un-documento.md) | Bytes de control **literales** en un documento o un test: `grep` deja de comportarse y una edición por herramienta no los quita | build | 1 |
| [E-072](errors/E-072-zod-4-endurece-uuid-y-un-placeholder-deja-de-parsear.md) | **zod 4 valida `.uuid()` contra RFC 4122**: exige los nibbles de versión y variante, así que el placeholder de todo unos que usa medio repositorio **falla al parsear**… | tests | 1 |
| [E-073](errors/E-073-un-campo-outlined-de-mui-pinta-su-etiqueta-dos-veces.md) | Todo campo `outlined` de MUI escribe su etiqueta **dos veces** (`<label>` + el `<span>` del `<legend>` del `NotchedOutline`), así que un criterio que cuenta texto sobre… | ui | 1 |
| [E-074](errors/E-074-un-tipo-que-promete-date-y-una-respuesta-que-entrega-string.md) | Un tipo que declara `Date` sobre datos que llegan por HTTP es una **promesa que nadie cumple** si la respuesta no pasa por su schema: `tsc` no lo ve | api | 1 |
| [E-075](errors/E-075-un-if-loading-que-devuelve-un-esqueleto-es-un-unmount.md) | `if (loading) return <Skeleton/>` **es un `unmount`** de todo lo que hay debajo | ui | 1 |
| [E-076](errors/E-076-una-validacion-de-caracteres-de-control-sin-mirar-el-control-de-ui.md) | Una regla de validación y el control de UI que la alimenta son **la misma decisión** | build | 1 |
| [E-077](errors/E-077-keepnames-de-esbuild-rompe-page-evaluate.md) | `ReferenceError: __name is not defined` **dentro del navegador**: `page.evaluate` serializa la función con `toString()` y el `keepNames` de esbuild —que `tsx` aplica… | tests | 1 |
| [E-078](errors/E-078-cerrar-el-navegador-cancela-el-debounce-que-persistia.md) | Cerrar el contexto de Playwright a los 400 ms cancela el debounce de 800 ms que iba a persistir el dato | tests | 1 |
| [E-079](errors/E-079-strict-false-colapsa-el-null-de-zod-y-la-clave-sale-opcional.md) | Con `strict: false`, un `z.coerce.date().nullable()` dentro de un objeto se infiere como **clave opcional y sin el `\| null`** | build | 1 |
| [E-080](errors/E-080-el-notes-de-un-feature-contradice-sus-propios-criterios.md) | El `notes` de un feature de `features.json` prescribe una solución que hace **inalcanzables** dos de sus propios `acceptance_criteria` | build | 1 |
| [E-081](errors/E-081-cambiar-el-estado-abre-una-lista-no-el-dialogo.md) | «Cambiar el estado» abre una **lista de estados**, no el diálogo de entrega: el script de QA busca el diálogo en el clic equivocado, obtiene `dialogFound | ui | 1 |
| [E-082](errors/E-082-dos-periodos-cerrados-el-mismo-dia-caen-juntos-en-el-reporte.md) | Dos períodos cerrados el mismo día calendario caen **siempre juntos** en el reporte —`resolveDateRange` redondea `fechaFin` a la medianoche siguiente—, así que los… | tests | 1 |
| [E-083](errors/E-083-leer-la-base-de-qab-desde-un-script-desechable.md) | Leer la base de datos de queandabuscando con un script propio falla **cuatro veces con cuatro errores distintos** (cliente generado fuera de `@prisma/client`, Prisma 7… | tests | 1 |
| [E-084](errors/E-084-el-tsc-de-arbol-completo-no-es-senal-limpia-en-el-paso-5.md) | `npx tsc --noEmit` en rojo a mitad del paso 5 **sin que tu código esté mal** | build | 1 |
| [E-085](errors/E-085-un-simbolo-nombrado-dentro-de-page-evaluate-bajo-tsx.md) | Un símbolo **con nombre** dentro de un `page.evaluate()` lanzado con `tsx` revienta con `ReferenceError: __name is not defined`: se pasa el cuerpo como **cadena** | tests | 1 |
| [E-086](errors/E-086-cambiar-de-tienda-por-el-endpoint-muta-el-usuario.md) | `POST /api/auth/cambiar-tienda` escribe el `localActualId` en la base y el efecto **sobrevive a la sesión**: para verificar varias tiendas, un usuario por tienda | auth | 1 |
| [E-087](errors/E-087-simular-un-fallo-de-red-lo-reintenta-el-interceptor.md) | Inyectar un `ERR_NETWORK` no prueba el manejo de fallos: el interceptor lo reintenta antes de que llegue al `catch`. Se fabrica un **500**, que nadie reintenta | tests | 1 |

---

## Cómo registrar un error

1. Crear `.agents/errors/E-###-<slug>.md` con la plantilla de `.agents/errors/TEMPLATE.md`.
2. Añadir una fila a **Registrados** con `Veces: 1`.
3. Si el error ya existe, **no crear archivo nuevo**: incrementar `Veces` y añadir el feature
   donde reapareció a la ficha existente.
4. Al llegar a **3 apariciones**, subirlo a **Frecuentes** con su fix resumido en una línea.

**Qué registrar:** todo error que costó más de un intento resolver, o cuya causa no era evidente
desde el mensaje. Un typo que se arregló a la primera no va aquí.
