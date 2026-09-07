# ADR 0094: La reconciliación es un cron propio cada diez minutos, y no una fase más del de F-002

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-008

## Contexto

F-008 tiene que hacer dos cosas con dos ritmos distintos:

- **Comparar el hash de cada tienda** contra `GET /api/internal/reconciliation`. El backlog la
  describe como una comparación **diaria**, y cada comparación es una petición HTTP a un tercero
  más una lectura del catálogo completo de esa tienda.
- **Evaluar si un negocio lleva más de 30 minutos sin una corrida exitosa** (criterio 5), lo que
  solo tiene sentido si algo se revisa **más a menudo** que una vez al día. La pregunta abierta 3
  del `spec` la dejó explícitamente sin resolver.

El cron existente `sync-tienda` (`vercel.json`, `*/2 * * * *`) ya lleva **cuatro fases** —drenaje
del outbox, aprendizaje de slugs, disponibilidad y pull de pedidos— con presupuestos de 10 s, 10 s
y 20 s recortados todos por `QAB_SYNC_RUN_DEADLINE_MS` (35 s) dentro de un `maxDuration` de 60 s.
La fase de pull toma además un advisory lock por negocio y puede mantener una transacción larga.

Y hay un detalle del terreno que condiciona la cadencia: **la marca de «corrida exitosa» tiene que
poder escribirse por algo que hable con QAB.** Ni el drenaje ni la disponibilidad emiten ninguna
petición para un negocio que no tiene nada pendiente, así que «hubo una petición correcta» no es un
latido que esas fases puedan dar de forma fiable.

## Decisión

**Un cron propio, `/api/crons/qab-reconciliation`, con cadencia `3-53/10 * * * *` —cada diez
minutos—, y no una quinta fase de `sync-tienda`.** La comparación de hash sigue siendo
aproximadamente diaria por tienda porque cada corrida compara **como máximo las 4 tiendas más
rancias de cada negocio**, no todas.

### Por qué diez minutos y no treinta

El umbral de la alerta es de 30 minutos (`QAB_SYNC_STALE_THRESHOLD_MS`). **La cadencia tiene que
ser estrictamente menor que el umbral**, o una sola corrida perdida lo cruza y la alerta parpadea:
con cadencia 30 y umbral 30, un hipo cualquiera —una latencia alta, un despliegue— produce una
alerta, y una alerta que se dispara por nada deja de leerse, que es exactamente el fallo que las
notas de este feature avisan de no cometer.

Con diez minutos hacen falta **tres corridas fallidas consecutivas** antes de que se active. Y el
criterio 5 dice literalmente «detener el cron 31 minutos dispara la alerta»: 31 minutos son
cuatro huecos de diez, así que el criterio se cumple con margen y no por milímetros.

### Por qué la marca de «corrida exitosa» la escribe este cron

Cada corrida compara al menos una tienda por negocio elegible, así que **cada corrida emite al
menos una petición a QAB por negocio**. Eso convierte la reconciliación en una sonda de extremo a
extremo del mismo camino que usa la sincronización: el mismo `Negocio.qabToken`, la misma
`QAB_API_BASE_URL`, la misma red y el mismo servidor. Si el token está mal, si la red está caída o
si QAB no responde, la sonda falla y a los 31 minutos la alerta se activa.

Un `404 UNKNOWN_STORE` **cuenta como contacto correcto**, y no es una excepción cómoda: significa
que el token autenticó y que el otro lado contestó. Que esa tienda no se pudiera comparar es otra
cosa, y el criterio 4 exige justamente que no se confunda con una divergencia.

### Por qué no una quinta fase de `sync-tienda`

Cinco razones, y la primera basta:

1. **El presupuesto ya no cabe.** Las fases actuales piden 40 s de presupuesto sobre un tope de
   35 s. Meter una fase que hace una petición HTTP por tienda dentro de esa ventana significa que
   la fase nueva se come el presupuesto de la disponibilidad o del pull, o al revés — y las dos
   existentes son las que de verdad mueven datos.
2. **Las cadencias son incompatibles.** `sync-tienda` corre cada 2 minutos. Una comparación de hash
   por tienda a ese ritmo son 720 peticiones diarias por tienda contra un tercero, para un dato que
   el backlog describe como diario. Habría que meter una compuerta de tiempo dentro de la fase, es
   decir: reimplementar una cadencia dentro de un cron cuya cadencia es otra.
3. **Los modos de fallo se contagian.** Hoy un fallo de base de datos en el drenaje tumba la
   corrida entera (está documentado y es deliberado). Añadir la reconciliación ahí significa que un
   fallo del drenaje se lleva por delante **la única pieza que avisa de que el drenaje falla**. Es
   exactamente el sitio donde no se quiere acoplamiento.
4. **La alerta perdería independencia.** Si la sonda vive dentro del proceso cuya salud mide, un
   `maxDuration` agotado deja de escribir la marca **y** de escribir la alerta.
5. **El `spec` lo puso fuera de alcance.** «No incluye: cambiar el drenaje del outbox (F-002)…
   este feature los **usa**, no los modifica.» Una fase nueva en `runQabSyncTiendaCron` es
   modificarlo.

### El hueco horario no es arbitrario

`3-53/10` dispara en los minutos **3, 13, 23, 33, 43 y 53**. Los seis son **impares**, y
`sync-tienda` (`*/2`) solo dispara en minutos **pares**: por construcción no coinciden nunca.
Ninguno es el minuto **17**, que ocupa `purge-outbox-events` (`17 3 * * *`), ni el **0**, que
ocupan los dos crones de purga diaria. La comprobación está escrita así en el contrato de
interfaces para que no haya que rehacerla la próxima vez que alguien añada un cron.

### Lo forzable, y por qué existe

La ruta acepta `?tiendaId=` repetible, que salta los topes por corrida. Sin eso los criterios 1, 2,
3 y 7 **no son ejecutables**: todos exigen reconciliar una tienda concreta, dos veces seguidas en
el caso del 7, y la rotación por rancidez no la elegiría. Va detrás de `isValidCronAuth` como todo
lo demás, y un `tiendaId` ajeno o inexistente simplemente no aparece entre los candidatos —lo
rechaza la construcción, no una comprobación.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Una quinta fase de `sync-tienda` | Las cinco razones de arriba; la decisiva es que la sonda no puede vivir dentro del proceso cuya salud mide |
| Un cron propio **diario** (`"3 5 * * *"`) más lo que dice el backlog | La alerta de 30 minutos no se puede evaluar una vez al día: con una corrida diaria, un corte de la sincronización se descubre hasta 24 horas después. El criterio 5 sería inverificable |
| Un cron propio **cada 30 minutos** | Cadencia igual al umbral: una sola corrida perdida activa la alerta. Una alerta que parpadea deja de leerse |
| Un cron propio **cada 2 minutos**, igual que `sync-tienda` | 720 comparaciones diarias por tienda contra un tercero para un dato diario, y una función serverless despertándose 720 veces sin nada que hacer. La sensibilidad extra no compra nada: el umbral sigue siendo de 30 minutos |
| Dos crones, uno diario para el hash y otro de 10 minutos para la rancidez | Dos rutas, dos gates, dos informes y dos entradas en `vercel.json` para dos mitades del mismo trabajo — y el de rancidez necesitaría igualmente hablar con QAB para tener algo que medir, con lo cual sería el mismo cron otra vez |
| Escribir la marca desde `runQabSyncTiendaCron` sin tocar nada más | Es tocar F-002, que el `spec` puso fuera de alcance, y sobre todo: ni el drenaje ni la disponibilidad emiten petición alguna para un negocio sin nada pendiente, así que no hay ningún latido fiable que leer de ahí |
| Un `setInterval` o un job en proceso | No hay proceso: el despliegue es Vercel, funciones serverless. Los crones de la plataforma son el único mecanismo |

## Consecuencias

**A favor:**

- La pieza que avisa de que la sincronización se rompió **no comparte destino** con la
  sincronización: un fallo de F-002 no puede silenciar su propia alerta.
- La marca de «corrida exitosa» mide algo comprobable —una respuesta real de QAB— y no la ausencia
  de errores en un informe.
- El presupuesto de `sync-tienda`, que ya está apretado, no se toca.
- La cadencia de la comparación de hash y la de la evaluación de rancidez se ajustan por separado,
  con dos constantes que no se estorban.
- El hueco horario está elegido y explicado, no encontrado por casualidad.

**En contra / coste asumido:**

- **Una quinta entrada en `vercel.json`** y una ruta de cron más que mantener, con su gate y su
  informe.
- Seis despertares por hora de una función serverless que, si nada ha cambiado, hace unas pocas
  consultas y unas pocas peticiones. Es barato, pero no es gratis.
- **La comparación de hash no es exactamente diaria**: es «las 4 más rancias por negocio, cada diez
  minutos». Un negocio con una sola tienda la compara cada diez minutos —más a menudo que a diario,
  y eso es mejor, no peor—, y un negocio con más de 576 tiendas la compararía menos a menudo que a
  diario. Ese suelo se sube subiendo `QAB_RECONCILIATION_MAX_STORES_PER_BUSINESS_PER_RUN`, y la
  cifra está en una constante precisamente para eso.
- La sonda de salud y la comparación de hash van en el mismo camino, así que **no se puede
  distinguir** «QAB está caído» de «QAB responde pero esta tienda no existe allí» con una sola
  llamada. Se distinguen por el código: `UNKNOWN_STORE` cuenta como contacto; el resto, no.

**Impacto en seguridad y escalabilidad:**

- **Autenticación:** la ruta reutiliza `isValidCronAuth` (`src/lib/cronAuth.ts`), la misma que
  `sync-tienda` y `purge-outbox-events`. Fail-closed, [ADR 0014](0014-qab-api-base-url-ausente.md):
  con `CRON_SECRET` sin definir responde 401, **nunca** 200. No se reinventa ni se relaja.
- **Aislamiento:** la corrida enumera negocios con la misma selección que F-002 y las tiendas por
  `Tienda.negocioId`; el `tiendaId` forzado no crea un camino nuevo, solo filtra un conjunto que ya
  estaba acotado por tenant.
- **Escalabilidad:** el trabajo de una corrida está acotado por tres constantes
  (`..._MAX_STORES_PER_BUSINESS_PER_RUN`, `..._MAX_STORES_PER_RUN`, `..._RUN_DEADLINE_MS`), así que
  no crece con el número de negocios: lo que no cabe lo coge la corrida siguiente, y la rotación
  por rancidez garantiza que a ninguna tienda le toque la cola para siempre.
- **Reversión:** barata. Quitar la entrada de `vercel.json` desactiva el feature entero sin dejar
  datos a medias — lo único que queda es la tabla de estado, que no la lee nadie más.
