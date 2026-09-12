# ADR 0096: La alerta es una proyección del estado persistente sobre `Notificacion`, escrita por el camino automático que ya existe

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-008

## Contexto

Los criterios 2, 5 y 7 de F-008 exigen que una alerta sea **observable**: que quede «activa»
cuando el hash diverge o cuando la sincronización lleva 30 minutos parada, y que deje de estarlo
cuando el ciclo cierra. Ni el backlog ni el contrato de QAB dicen a quién le llega.

El proyecto **no tiene** ningún canal de correo, push o mensajería para alertas de operación: los
webhooks de n8n que existen son de cuentas de usuario (invitación, reset de contraseña, cambio de
correo). Lo que sí existe:

- **`Notificacion`** (`prisma/schema.prisma`), dirigida a negocios o a usuarios, con
  `nivelImportancia`, `tipo` (`ALERTA` entre sus valores), `negociosDestino`, `usuariosDestino` y
  `accionUrl`. `NotificationBell` y `NotificationPanel` ya la renderizan.
- **`NotificationService.runAutomaticChecks(negocioId?)`** (`src/services/notificationService.ts`),
  expuesto en `POST /api/notificaciones/auto-check`, con cinco chequeos automáticos que ya crean,
  actualizan y borran filas de `Notificacion`. **Ya está acotado por tenant**: F-021 le quitó el
  bypass, así que una sesión que no es `SUPER_ADMIN` corre solo sobre su propio negocio y el
  `negocioId` del cuerpo se ignora.
- **`StoreSyncStateRow.tsx`**, que muestra por producto si **nuestro envío** salió, derivado del
  outbox. Su propio comentario dice que «dice si NUESTRO envío salió, nunca lo que la tienda online
  está mostrando»: no es lo mismo que la divergencia de esta reconciliación.

El `spec` afirmó que `Notificacion` «no tiene ningún escritor automático». **Es falso**, y el
coordinador lo corrigió comprobándolo: `runAutomaticChecks` existe y lleva cinco.

## Decisión

**La alerta se escribe en `Notificacion`, por el camino automático que ya existe, y es una
PROYECCIÓN del estado persistente de `QabReconciliacionTienda`. Ninguna pantalla se toca.**

El canal lo decidió el coordinador (registrado en `.agents/progress/F-008.md`); este ADR fija la
forma, que es lo que evita que la alerta se convierta en ruido.

### El estado autoritativo no es la notificación

Lo que los criterios llaman «la alerta activa» vive en las columnas de `QabReconciliacionTienda`
([ADR 0093](0093-el-seguimiento-de-la-reconciliacion-es-una-fila-por-tienda-y-la-salud-del-negocio-se-agrega.md)):
`hashDivergenteAt` para la divergencia, `ultimoContactoOkAt` para la rancidez. La fila de
`Notificacion` es su **render**, reconstruido en cada chequeo. Esto es lo que hace que los
criterios no dependan de las particularidades del modelo de notificaciones, y que el ciclo del
criterio 7 —«el estado deja de estar activo»— sea comprobable en la base y no en una campana.

### Dos notificaciones por negocio, con título constante

- `QAB_ALERT_TITLES.syncStalled` — «Tienda online: sincronización detenida» (criterios 5 y 8).
- `QAB_ALERT_TITLES.hashDiverged` — «Tienda online: catálogo desincronizado» (criterios 2 y 7), con
  los nombres de las tiendas afectadas **en la descripción**, no en el título.

Los títulos son **constantes**: sin nombre de tienda, sin id y sin tiempo transcurrido. La razón es
concreta y no estética: `NotificationService.findExistingNotification` busca con
`titulo: { contains: titulo }` y `negociosDestino = negocioId`, así que un título que llevara el
nombre de una tienda **encontraría** la notificación de otra tienda cuyo nombre lo contenga como
prefijo —«Centro» dentro de «Centro 2»— y las dos alertas se pisarían.

Por eso la divergencia es **una notificación por negocio y no una por tienda**: el grano por tienda
ya lo tiene el estado persistente, que es el autoritativo.

### La descripción es una función del estado, y de nada que se mueva

`planQabAlertNotifications` es **pura** y devuelve `null` para «esta notificación no debe existir».
Sus dos descripciones no llevan reloj: ni minutos transcurridos, ni marca de tiempo. Y el escritor
solo llama a `updateNotification` cuando la `descripcion` cambió.

No es una optimización. `NotificationService.updateNotification` pone `leidoPor: ""`, es decir
**vuelve a marcar la notificación como no leída para todos**. Una descripción que dijera «hace 43
minutos» cambiaría en cada corrida y la alerta reaparecería como nueva cada diez minutos, hasta que
alguien dejara de mirarla — que es la forma más rápida de que una alerta deje de leerse, y
exactamente lo que las notas de este feature avisan de no hacer.

El texto de los minutos se deriva de `QAB_SYNC_STALE_THRESHOLD_MS / 60_000`, para que el umbral
tenga **una** definición y no dos.

### `negociosDestino` vacío significa «todos», así que es obligatorio

`Notificacion.negociosDestino` tiene `@default("")` y el comentario del schema lo dice: **vacío =
todos**. `verificarAccesoUsuario` lo confirma: con el campo vacío devuelve `true` sin más
comprobación, y la fila la ve cualquier usuario de cualquier negocio. Es el fail-open más peligroso
de este modelo, y aquí es peor de lo normal porque la descripción de la alerta de divergencia
**nombra las tiendas afectadas**: un olvido no oculta la alerta, se la cuenta a todos los negocios.

Por eso `qabAlertDescriptorSchema.negociosDestino` es `z.string().min(1)` —así el tipo derivado es
`string` y no `string | undefined`, y un olvido no compila— y `checkQabSyncAlerts` lo pasa
explícitamente en cada escritura, sin apoyarse nunca en el `data.negociosDestino || ""` del helper
genérico de la clase, que es el camino por el que un campo ausente se vuelve «todos».

Lo levantó `security-guardian` en el paso 4 (C2 de `.agents/security/F-008.md`) y se adopta tal
cual.

### `usuariosDestino` queda vacío, y es deliberado

`verificarAccesoUsuario` (`src/app/api/notificaciones/activas/route.ts`) comprueba
`usuariosDestino` **primero** y, si trae algo, **no llega a mirar `negociosDestino`**. Rellenar los
dos haría que el aislamiento del criterio 8 dependiera de una lista de usuarios en vez del negocio.
Se deja vacío, con `negociosDestino` igual al `negocioId` exacto, y así el filtro efectivo es el eje
que el criterio 8 exige.

El coste es que un `VENDEDOR` del negocio también ve la alerta. Es una alerta de operación de su
propia tienda; acotarla por permiso queda **fuera de alcance**.

### Quién dispara el chequeo, y por qué son dos sitios

`NotificationService.checkQabSyncAlerts(negocioId?)` se llama desde dos lugares:

1. **El cron de reconciliación**, sin acotar, al final de cada corrida. Es lo que hace el criterio 5
   observable sin que nadie abra la aplicación: la alerta aparece por sí sola.
2. **`runAutomaticChecks`**, una entrada más de su `Promise.all` ya existente. Es el camino que el
   coordinador eligió, y refresca la alerta cuando la sesión del comerciante pasa por ahí.

Las dos llamadas son idempotentes porque la función es una proyección: reconstruye lo que debe
existir y borra lo que no. Y el chequeo **no hace ninguna petición HTTP** —lee estado persistido y
nada más—, que es lo que lo hace seguro en el camino interactivo de `POST
/api/notificaciones/auto-check`.

### La lógica vive en `src/lib/`, el método es un adaptador

`AGENTS.md` manda la lógica de servidor a `src/lib/`, y `NotificationService` está en
`src/services/` con Prisma dentro por herencia histórica. Se resuelve sin mover nada y sin
duplicar nada: las funciones puras (`aggregateQabBusinessAlertState`, `planQabAlertNotifications`)
y las lecturas (`readQabSyncStalenessRows`) viven en `src/lib/qab/`, y
`NotificationService.checkQabSyncAlerts` es un método delgado que las llama y aplica el resultado
con los cuatro helpers que ya tiene la clase.

La dirección de importación es **services → lib**, nunca al revés. Poner el escritor en `src/lib/`
y hacerle importar `NotificationService` invertiría las capas y crearía una arista de valor de
vuelta, que es el mecanismo de
[E-028](../../.agents/errors/E-028-un-ciclo-de-valor-entre-dos-modulos-de-schemas.md).

### Una alerta de divergencia por negocio, y no una por tienda: el arbitraje de C8

`security-guardian` pidió (C8) que el título de la alerta de divergencia llevara un identificador de
tienda, para que el `contains` de `findExistingNotification` no cruzara dos tiendas del mismo
negocio. **Se rechaza, y el contrato de interfaces manda.**

El riesgo que describe es real, y este diseño **ya lo elimina por otra vía**: hay **una sola**
notificación de divergencia por negocio, con las tiendas afectadas en la descripción. Con una fila
por negocio no hay dos notificaciones que puedan cruzarse, y el grano por tienda que el criterio 7
necesita vive en `QabReconciliacionTienda.hashDivergenteAt`, que es el estado autoritativo.

El remedio propuesto, además, reintroduciría el defecto en su forma más difícil de ver: un título
con el **nombre** de la tienda hace que el `contains` de «… — Centro» encuentre la notificación de
«… — Centro 2». Con el **`tiendaId`** sí sería único, y le pone un uuid delante de los ojos al
comerciante para resolver un problema que este diseño no tiene.

### Lo que queda fuera, y es una decisión

**Reflejar el estado del hash en `StoreSyncStateRow.tsx`** queda fuera de alcance. Es una mejora
razonable, pero es una pantalla que nadie pidió cambiar y arrastraría el gate del `ui-designer`.
Queda anotado como posible feature propio.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un canal nuevo: correo, push, Slack, un webhook de n8n más | El `spec` lo puso fuera de alcance, y con razón: inventar un canal cuando ya hay uno que el comerciante mira es duplicar un concepto que existe, lo que `AGENTS.md` prohíbe y lo que E-014 y E-039 castigan |
| Una pantalla nueva de estado de reconciliación | Arrastra el gate del `ui-designer` y un feature que nadie pidió. La campana ya es el sitio donde el comerciante mira |
| Ampliar `StoreSyncStateRow.tsx` con el estado del hash | Mismo gate, y además mezcla dos cosas distintas en una columna: «nuestro envío salió» y «los dos catálogos coinciden». Su propio comentario ya avisa de que no son lo mismo |
| Solo el registro interno, sin notificación (una fila que consulte el equipo) | Satisface la letra de «observable» y no su propósito: el criterio 5 existe para que **alguien mire**, y nadie mira una tabla |
| Una notificación por tienda | El título tendría que distinguir la tienda, y `findExistingNotification` busca por `contains`: dos tiendas cuyos nombres sean prefijo una de otra se pisarían la alerta. El grano por tienda ya lo tiene el estado persistente |
| Que la notificación sea el estado autoritativo, sin tabla | Los criterios 2c y 7 dependerían del modelo de notificaciones y de su búsqueda por `contains`; y no habría dónde guardar «desde cuándo» ni la clave de rotación |
| Escribirla desde `src/lib/qab/` importando `NotificationService` | Invierte las capas y mete una arista de valor de `lib` a `services` |
| Meter la reconciliación entera dentro de `runAutomaticChecks` | Convertiría un endpoint interactivo del comerciante en un abanico de peticiones HTTP a un tercero. El chequeo solo lee estado; quien habla con QAB es el cron |
| Poner el tiempo transcurrido en la descripción | Cambia en cada corrida, y `updateNotification` resetea `leidoPor`: la alerta reaparecería como nueva cada diez minutos |

## Consecuencias

**A favor:**

- **El criterio 5 queda observable sin cambiar una línea de UI**: `NotificationBell` y
  `NotificationPanel` ya renderizan estas filas.
- El aislamiento del criterio 8 lo da `negociosDestino`, un campo que el modelo ya tenía, con el
  filtro que `verificarAccesoUsuario` ya aplica.
- El escritor es idempotente por construcción —es una proyección—, así que llamarlo desde dos sitios
  y muchas veces no produce duplicados ni ruido.
- Los criterios 2c y 7 se verifican contra el estado persistente, que es un dato, y no contra la
  presencia de una fila en una tabla de notificaciones con búsqueda por `contains`.
- `accionUrl` lleva al encargado a `/tienda-online/configuracion`, la pantalla que ya existe.

**En contra / coste asumido:**

- **`Notificacion` no tiene índice por `negociosDestino`** y la ruta de notificaciones activas
  filtra en memoria, con una consulta a `Usuario` por notificación. Este feature añade como máximo
  dos filas por negocio y **no** empeora el patrón, pero tampoco lo arregla: queda escrito aquí como
  deuda conocida, no como algo que este feature resuelva.
- La alerta la ven todos los usuarios del negocio, incluidos los que no gestionan la tienda online.
- La búsqueda por `titulo: { contains }` obliga a que los títulos sean constantes y a que la
  divergencia sea una notificación por negocio. Es una restricción heredada, y está documentada en
  el sitio donde muerde (las constantes de los títulos).
- Dos disparadores para el mismo chequeo: uno de más si alguien lo lee sin este ADR. Están los dos
  porque cubren casos distintos —que la alerta aparezca sola, y que se refresque cuando el
  comerciante entra— y la función es idempotente.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento:** `negociosDestino` exacto y `usuariosDestino` vacío, elegido **contra** el
  cortocircuito de `verificarAccesoUsuario`. Y el chequeo llamado desde `runAutomaticChecks` hereda
  el alcance por tenant que F-021 le puso: un no-`SUPER_ADMIN` solo puede correrlo sobre su propio
  negocio.
- **Superficie:** el chequeo no hace ninguna petición HTTP, así que exponerlo en el camino
  interactivo no le da a un usuario autenticado ninguna forma de provocar tráfico hacia un tercero.
- **Escalabilidad:** una lectura de estado por chequeo, sin N+1: `readQabSyncStalenessRows` trae de
  una vez las filas de todos los negocios elegibles, y la agregación es en memoria sobre un
  conjunto acotado por el número de tiendas publicadas.
- **Reversión:** barata. Quitar la línea de `runAutomaticChecks` y la llamada del cron desactiva la
  alerta; las filas vivas caducan por su `fechaFin`, y el estado persistente sigue ahí para volver a
  proyectarlo.
