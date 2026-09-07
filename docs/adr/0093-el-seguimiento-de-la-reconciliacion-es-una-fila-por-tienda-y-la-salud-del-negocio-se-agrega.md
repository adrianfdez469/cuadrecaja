# ADR 0093: El seguimiento de la reconciliación es una fila por tienda y la salud del negocio se agrega desde ellas

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-008

## Contexto

El § ⑤ del contrato de QAB pide alertar «también si no hubo una corrida exitosa en 30 minutos», y
el criterio 5 de F-008 lo verifica envejeciendo «el registro persistente de última corrida
exitosa».

Ese registro **no existe**. `runQabSyncTiendaCron` (`src/lib/qab/syncTiendaCron.ts`) construye un
`IQabSyncRunReport` por corrida y lo devuelve en el cuerpo de la respuesta HTTP del cron
(`src/app/api/crons/sync-tienda/route.ts`); no lo escribe en ninguna tabla. Cuando la función
retorna, la única huella de la corrida son los logs de la función serverless. No es una
reutilización que se nos escapara: es terreno nuevo.

Las restricciones que acotan la forma de ese registro:

- **El criterio 8** (añadido por el `spec`) exige que el éxito de un negocio **no enmascare** el
  corte de otro. Un único registro global —«hubo alguna corrida exitosa en algún sitio»— esconde
  para siempre el corte de un negocio mientras los demás sincronicen bien, y eso es la clase de
  fuga de aislamiento que este proyecto no tolera en ningún dato de negocio.
- **Los criterios 2 y 7** necesitan un segundo estado, de grano distinto: «esta tienda tiene el
  hash divergente» tiene que poder activarse (criterio 2c) y **desactivarse** (criterio 7) por
  tienda, no por negocio.
- **La ronda de comparación tiene que rotar.** La comparación es por tienda y contra un tercero,
  así que una corrida no puede comparar todas las tiendas de todos los negocios; hace falta saber
  cuál es la más rancia.

Y una que no es del criterio sino del terreno: un negocio recién habilitado, o un negocio que
apaga la tienda online, no puede quedarse alertando para siempre por no haber contactado nunca.

## Decisión

**Una tabla nueva, `QabReconciliacionTienda`, con una fila por `Tienda` y tres marcas de tiempo; y
la salud del negocio se AGREGA desde esas filas, sin que exista ninguna fila por negocio ni
ninguna global.**

```prisma
model QabReconciliacionTienda {
  id       String @id @default(uuid())
  tienda   Tienda @relation(fields: [tiendaId], references: [id], onDelete: Cascade)
  tiendaId String @unique

  ultimaComparacionAt DateTime?
  ultimoContactoOkAt  DateTime?
  hashDivergenteAt    DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ultimaComparacionAt])
}
```

Las tres columnas contestan tres preguntas distintas, y **por eso son tres y no una**:

- `ultimaComparacionAt` — **cuándo se intentó** comparar. Ordena la rotación (`NULLS FIRST`, luego
  ascendente). Se escribe en **todo intento**, incluido el que falló: si no, una tienda que falla se
  queda eternamente como la más rancia y bloquea a las demás. Una tienda que **no llegó a
  intentarse** —la corrida se quedó sin presupuesto— no la actualiza, y por eso sigue siendo la más
  rancia: la coge la corrida siguiente, que es lo que se quiere.
- `ultimoContactoOkAt` — **cuándo QAB contestó de verdad** para esta tienda: un `200`, o el `404`
  con el cuerpo documentado. Es lo único que mide la alerta de 30 minutos.
- `hashDivergenteAt` — **cuándo se vio la divergencia por primera vez**, y `NULL` cuando los dos
  lados coinciden. Conserva su primer valor mientras la divergencia dura, así que se lee como «desde
  cuándo» y no como «visto otra vez hace un instante».

La salud de un negocio es entonces una agregación pura sobre sus filas, en
`aggregateQabBusinessAlertState`:

```
ultimoContactoAt = max( ultimoContactoOkAt ?? createdAt )   sobre las filas del negocio
stale            = now - ultimoContactoAt > QAB_SYNC_STALE_THRESHOLD_MS
```

El `?? createdAt` es lo que resuelve el negocio recién habilitado: su fila es nueva, así que
todavía no está rancio. Y **un negocio sin filas no produce entrada, y por tanto no produce
alerta**: así queda fuera un negocio elegible que no tiene ninguna tienda publicada, que no puede
contactar y al que no tiene sentido alertar.

Que el negocio deje de ser elegible se resuelve **en el filtro de la lectura**, no borrando nada:
`readQabSyncStalenessRows` hace join a `Tienda` y a `Negocio` y exige
`qabToken IS NOT NULL AND tiendaOnlineHabilitada = true AND Tienda.publicarEnTienda = true`. Quien
apaga la tienda online deja de alertar en el chequeo siguiente, sin ninguna limpieza.

**La tabla no lleva columna `negocioId`.** El `negocioId` de una tienda ya vive en `Tienda`, y
duplicarlo aquí crearía una segunda fuente de verdad del eje de tenant, capaz de desincronizarse
sin dar ningún error — el defecto que describe
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md). Todas las
lecturas y escrituras entran por la relación `tienda`, y las dos escrituras van por `updateMany`
con `tienda: { negocioId }`, que es además la forma que fijó
[ADR 0085](0085-el-where-de-f-022-reutiliza-withtenantscope-y-la-unica-escritura-pasa-por-updatemany.md).

**Hace falta migración**, generada con `npx prisma migrate dev --name qab_reconciliacion_tienda`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Una columna `qabUltimaCorridaExitosaAt` en `Negocio` | Resuelve el criterio 8 y **no** los criterios 2 y 7: la divergencia es por tienda y no cabe en una columna por negocio. Haría falta además una segunda columna en `Tienda`, y quedarían dos sitios donde vive el mismo estado |
| Un único registro global (una fila de configuración, una tabla de una fila) | Lo que el criterio 8 prohíbe explícitamente: el éxito de un negocio enmascara el corte de otro **para siempre**, y la alerta deja de significar nada justo cuando importa |
| Una tabla de historial de corridas, append-only | Contesta más preguntas de las que hacen falta y trae su propio problema: crece sin límite y necesitaría su cron de purga, como el outbox necesitó F-019. Aquí solo se pregunta «¿cuándo fue la última?», y para eso una fila mutable basta |
| Guardar el hash local y el remoto en la fila | Tentador para depurar, y es estado derivado que caduca en cuanto cambia un precio. Un valor viejo guardado se lee como actual; se publica `hashMatch` en el informe de la corrida y nada más |
| Dos tablas, una por negocio y otra por tienda | La de negocio sería enteramente derivable de la de tienda por un `max`. Dos fuentes para el mismo hecho, que es la forma de que una corrección deje una atrás |
| Deducir la última corrida exitosa de los logs de la función | No es consultable desde el producto, caduca con la retención del proveedor, y el criterio 5 pide envejecer un registro, no leer un log |

## Consecuencias

**A favor:**

- El grano más fino que cualquier criterio pide, así que los criterios 2, 5, 7 y 8 se satisfacen
  con **un** mecanismo y no con tres.
- El aislamiento no es una propiedad que haya que recordar: el estado ya nace por tienda, cada fila
  cuelga de su `Tienda` y la agregación agrupa por el `negocioId` de esa tienda. Para que el éxito
  de A entrara en la cifra de B haría falta que una fila colgara de la tienda equivocada, que es una
  restricción de clave ajena y no una regla que alguien tenga que aplicar.
- La rotación sale gratis del mismo dato que ya hace falta guardar.
- La agregación es una **función pura** (`aggregateQabBusinessAlertState`), así que el criterio 8 se
  puede probar con dos negocios en un array, sin base de datos.
- Un negocio que apaga la tienda online deja de alertar sin ninguna limpieza, porque la
  elegibilidad es un filtro de la lectura y no un borrado.

**En contra / coste asumido:**

- **Una migración**, con lo que arrastra: regenerar el cliente de Prisma, y el aviso de que un
  servidor de desarrollo levantado antes de aplicarla sirve un cliente viejo y la columna «no
  aparece» ([E-002](../../.agents/errors/E-002-servidor-dev-con-cliente-prisma-viejo.md)).
- Una fila por tienda publicada: se crean bajo demanda con `createMany({ skipDuplicates: true })`,
  y **conservar la primera escritura es aquí lo correcto**, porque `createdAt` es el suelo de la
  ventana de rancidez. Es la misma mecánica que
  [E-024](../../.agents/errors/E-024-createmany-skipduplicates-conserva-la-primera-escritura.md) describe como
  defecto, usada a propósito para un «crear si no existe».
- La salud del negocio hay que agregarla en cada chequeo en vez de leerla de una columna. Son las
  filas de las tiendas publicadas de los negocios elegibles: un conjunto pequeño, y la lectura ya
  se necesitaba para la alerta de divergencia.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento:** la tabla no tiene su propio eje de tenant que pueda desincronizarse; lo hereda
  de `Tienda` por la relación, y las dos escrituras lo repiten en el `where`. Esto último no es
  redundancia decorativa: es la regla de [ADR 0050](0050-confirmed-decide-la-escritura-y-el-valor-lo-pone-el-lote-enviado.md), que mantiene el filtro en la escritura aunque
  el id venga de una lectura ya acotada.
- **Escalabilidad:** sin N+1 en la lectura —una consulta trae las filas de todos los negocios
  elegibles—, y sin crecimiento no acotado, porque la tabla tiene exactamente una fila por tienda y
  se actualiza en el sitio. `@@index([ultimaComparacionAt])` cubre la ordenación de la rotación.
- El único crecimiento sin tope de este feature sería un historial de corridas, y es precisamente
  la alternativa que se descartó.
