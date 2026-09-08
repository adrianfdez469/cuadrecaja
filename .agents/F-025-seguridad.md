# F-025 — Auditoría de seguridad y privacidad (previa a código)

> Escrito por el agente `security-guardian`. No toca `.agents/specs/F-025.md` ni `docs/adr/`.
> Ejecutado, no leído-y-supuesto: cada afirmación de "está protegido" cita archivo y línea del
> código real en la rama `docs-qab-contract-v12` al 2026-09-07.

## Cómo leer este informe

Dos bloques. El primero es **lo que debería mover la elección de proveedor/librería** del
`arch-guardian` — antes de que se fije en el contrato. El segundo es **deuda que ya existe o
restricciones de implementación** que no cambian esa elección, solo hay que cumplirlas o no
empeorarlas.

---

## Bloque 1 — Para la elección de proveedor y librería

### 1.1 Referer — el riesgo real es menor de lo que el criterio 6 hace temer, y hay que decir por qué

La pantalla es `src/app/tienda-online/configuracion/page.tsx`. Verificado en el propio archivo:

- El `tiendaId`/`selectedId` que elige qué local se edita **vive en `useState`** (línea 121:
  `const [selectedId, setSelectedId] = useState("")`), **nunca en la URL**. `handleSelect`
  (línea 223) solo hace `setSelectedId(tiendaId)`, sin `router.push` ni parámetro de ruta.
- El único parámetro de la URL es `?tab=locales|productos` (`TIENDA_ONLINE_TAB_QUERY_KEY`,
  líneas 88-89), que no identifica nada del negocio.
- La ruta en sí (`/tienda-online/configuracion`) no lleva `negocioId` ni `tiendaId` como
  segmento — a diferencia de, por ejemplo, `PATCH /api/tienda-online/configuracion/[tiendaId]`,
  que si lo lleva pero es una llamada de servidor a servidor vía Axios, no una petición de imagen
  del navegador.

**Conclusión:** aunque el navegador mandara el `Referer` completo (peor caso), lo que viajaría es
`https://<dominio>/tienda-online/configuracion?tab=locales` — sin identificador de tienda ni de
negocio. El riesgo del `Referer` en esta pantalla concreta es "confirma que este dominio es un
cliente de Cuadre de Caja", no una fuga de `tiendaId`/`negocioId`.

**Pero esto no exime de la cabecera.** Ahora mismo **no existe ninguna `Referrer-Policy` en todo
el repo** — comprobado:

```
next.config.ts        → sin headers()
src/middleware.ts      → sin cabecera de seguridad, solo CORS y auth (líneas 1-99)
vercel.json            → solo `crons`, sin `headers`
```

grep completo (`Content-Security-Policy|Referrer-Policy`) sobre `src/`, `next.config.ts`,
`vercel.json` no encuentra ninguna coincidencia. El repo depende hoy del default del user agent.
Ese default (`strict-origin-when-cross-origin` en navegadores modernos) ya limita lo que se manda
cross-origin al *origin* solo — pero:

- **Es un default del cliente, no una garantía del servidor.** Un WebView embebido más viejo (el
  propio middleware menciona un "APK" con Bearer aparte — `src/middleware.ts` línea 42) puede no
  compartir ese default.
- El criterio 6 dice "verificado revisando el tráfico de red", y verificar un default de
  navegador no es lo mismo que verificar una cabecera que el servidor garantiza.

**Recomendación concreta, no opcional:** fijar `Referrer-Policy: strict-origin-when-cross-origin`
(mínimo) o `no-referrer` (más estricto, y perfectamente compatible con pedir teselas — las
teselas no necesitan saber de dónde vienen) como cabecera de respuesta, al menos en la ruta
`/tienda-online/configuracion`, idealmente global. Es una línea en `next.config.ts` (`headers()`)
o en `src/middleware.ts` junto a `addCorsHeaders`. **Esto es lo que convierte el criterio 6 en algo
verificable de forma determinista, no dependiente del navegador de quien pruebe.**

### 1.2 La URL de la tesela — no hay hoy ningún vector de API key/cliente porque no hay librería aún

`package.json` no tiene ninguna dependencia de mapas instalada (grep de `leaflet|mapbox|maplibre|
openlayers|react-map` sin resultados). Esto es una decisión abierta, así que el criterio que debe
atar la elección es: **preferir un proveedor de teselas que NO requiera clave ni identificador de
cliente en la URL ni en cabecera** (los mosaicos raster clásicos `{z}/{x}/{y}.png` de OSM y
compatibles no lo requieren; algunos proveedores "premium" gratuitos sí piden una clave o un
`Referer` en su allowlist — **este segundo caso es contradictorio con 1.1**: un proveedor que
exige recibir el `Referer` real para funcionar convierte la política `no-referrer` en un fallo de
carga, no en una mejora de privacidad. Si el proveedor elegido pide eso, hay que saberlo ANTES de
fijar la cabecera, no después.

### 1.3 Telemetría de la librería — cómo comprobarlo, ejecutando, no razonando

No es una decisión que se pueda tomar leyendo la documentación de la librería: hay que
levantarla aislada y mirar la pestaña de red mientras se interactúa (arrastrar, hacer zoom, hacer
clic). El patrón conocido en este ecosistema, y la razón de mencionarlo explícito aquí: **Mapbox
GL JS hace ping a los endpoints de telemetría de Mapbox por defecto incluso usando un proveedor
de teselas que no es Mapbox**, salvo que se desactive explícitamente (y desactivarlo no siempre es
trivial ni estable entre versiones). Leaflet (núcleo) y MapLibre GL JS (el fork de Mapbox GL JS
anterior a la telemetría, mantenido sin ella) no tienen ese problema conocido — pero
"no tener el problema conocido" no es lo mismo que haberlo comprobado en la versión exacta que se
vaya a fijar. **Antes de cerrar la librería en el contrato, ejecutar una carga real y confirmar
que las únicas peticiones salientes van al dominio de teselas elegido — cero peticiones a
cualquier otro host.**

### 1.4 Geocoding — qué implica incluirlo, para que la decisión se tome con el coste delante

El spec lo deja fuera y dice que el `arch-guardian` está decidiendo si lo mete. El coste concreto,
para que la decisión se tome con la cifra delante:

- Un campo de búsqueda por texto envía **lo que el comerciante escribe** a un tercero. Si escribe
  el nombre y la dirección de su negocio para encontrarlo en el mapa —el caso de uso obvio de la
  función— **eso es exactamente lo que el criterio 6 prohíbe para las peticiones de tesela**,
  pero por una puerta distinta que el criterio no cubre literalmente (el criterio 6 habla de
  teselas, no de geocoding). Si se incluye, el criterio 6 necesita una cláusula propia para el
  geocoding, y probablemente uno nuevo de aceptación.
- No hay forma de proxear esto sin que igual el tercero vea el texto: proxear por el backend de
  cuadrecaja oculta el `Referer`/negocioId, pero el texto de búsqueda sigue viajando íntegro al
  geocoder. Es una mitigación parcial, no una solución.
- Dado que el spec ya excluye explícitamente el flujo de búsqueda por cercanía del comprador y que
  las restricciones de Cuba (datos caros/lentos, ya recogidas en `features.json`) empujan hacia
  "el mínimo mecanismo que funcione sin conexión estable", la recomendación de este agente es
  **no incluirlo en F-025**: added complexity, superficie de fuga nueva, y ningún criterio de
  aceptación lo pide. Si se incluye de todos modos, que sea con proxy server-side y con su propio
  criterio de aceptación y su propia revisión de seguridad — no colado dentro del criterio 6.

### 1.5 CSP — no existe hoy, y hay que decidir cuánto abrir

Confirmado: no hay CSP en `next.config.ts`, `src/middleware.ts` ni `vercel.json` (mismo grep de
1.1, sin resultados para `Content-Security-Policy`). Esto es **deuda preexistente**, no algo que
F-025 introduce, pero F-025 es la primera pantalla que necesita hablar con un origen de imagen de
un tercero desde el navegador del comerciante autenticado, así que es un buen punto para
empezar a cerrarla, aunque sea de forma acotada:

- Si se añade una CSP (aunque sea solo para esta pantalla, vía `headers()` con `source` acotado a
  `/tienda-online/configuracion`), lo que hay que abrir es exactamente **`img-src` (o
  `connect-src` si el widget pide teselas vectoriales por `fetch`) apuntando al dominio exacto del
  proveedor elegido**, nada más amplio (nunca `img-src *`).
- Lo que **no** hay que abrir: cualquier `connect-src`/`script-src` hacia dominios de telemetría
  de la librería (ver 1.3) — si la librería insiste en llamar a un host de telemetría y no se
  puede desactivar, una CSP que no lo permita es la última red de seguridad, y su aparición en la
  consola del navegador (`Refused to connect...`) es además una forma barata de verificar 1.3 en
  producción.
- Sin CSP alguna, este control depende enteramente de que el código nunca pida nada más — que es
  exactamente lo que el criterio 6 pide verificar a mano. Con CSP, un error de implementación
  futuro (alguien añade sin querer un tercero) se bloquea solo. Vale la pena para esta pantalla
  aunque el resto del repo no la tenga todavía.

---

## Bloque 2 — Deuda preexistente y restricciones de implementación (no cambian la elección de proveedor)

### 2.1 Aislamiento multi-tenant (criterio 8) — VERIFICADO, ya está bien, no hace falta código nuevo

Trazado el valor, no solo la mención (E-042):

- `src/lib/tiendaOnline/tiendaOnlineAccess.ts:99-117` (`assertTiendaOnlineAccess`) — el
  `negocioId` sale de `session?.user?.negocio?.id` (línea 103), nunca de la ruta ni del body.
- `src/app/api/tienda-online/configuracion/[tiendaId]/route.ts:85` —
  `const negocioId = session.user.negocio.id; // the ONLY source of negocioId` — el comentario
  coincide con el uso real: esa variable, no el `tiendaId` de la ruta, es la que se pasa a
  `saveTiendaOnlineLocal`.
- `src/lib/tiendaOnline/tiendaOnlineStore.ts:286-294` — la LECTURA usa
  `tx.tienda.findFirst({ where: { id: tiendaId, negocioId } })`, con `negocioId` **como valor de
  la comparación**, no en una guarda de nulidad.
- `src/lib/tiendaOnline/tiendaOnlineStore.ts:309-313` — la ESCRITURA usa
  `tx.tienda.update({ where: { id: tiendaId, negocioId }, ... })`. El comentario de la línea 310-312
  explica por qué: `Tienda` no tiene `@@unique([id, negocioId])`, así que un `findUnique({ where:
  { id } })` seguido de una comparación *sería* el patrón prohibido — y no es lo que hay. El
  `where` compuesto de Prisma pone `negocioId` en el SQL `WHERE` real.

**Un `tiendaId` de otro negocio produce `TiendaOnlineNotFoundError` (línea 295), nunca escribe ni
lee la fila ajena.** El criterio 8 no necesita código nuevo, como ya decía el spec — este agente
lo confirma con el código, no con la nota. Sí conviene que QA lo ejecute (dos negocios, un
guardado, leer Postgres), porque es la primera vía de escritura de estas columnas que no es texto
plano y el spec tiene razón en pedir la confirmación explícita.

### 2.2 Validación de latitud/longitud — dos vías de entrada, una asimetría a cerrar

- **Rango:** `src/schemas/tiendaOnline.ts:188-189` —
  `latitud: z.number().min(LATITUDE_MIN).max(LATITUDE_MAX).nullable()` /
  `longitud: z.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX).nullable()` (con
  `LATITUDE_MIN/MAX = -90/90` y `LONGITUDE_MIN/MAX = -180/180`, definidas en las líneas 64-67 del
  mismo archivo), dentro de
  `tiendaOnlineLocalUpdateSchema`, que es lo que valida el body del `PATCH`
  (`route.ts:97`, `parsed = tiendaOnlineLocalUpdateSchema.safeParse(rawBody)`). Coincide con los
  límites HTML ya puestos en `src/components/tiendaOnline/PublicDataCard.tsx:172-183`
  (`LATITUDE_MIN/MAX`, `LONGITUDE_MIN/MAX`, `type: "number"`, `min`/`max`, `step: "any"`).
- **`NaN`/`Infinity`/cadena:** `Infinity`/`-Infinity` fallan el propio `.max()`/`.min()` (son
  mayores/menores que el límite), `NaN` falla la comprobación de tipo interna de `z.number()`, y
  una cadena falla el tipo. Los tres casos devuelven `parsed.success === false` →
  `invalidBody()` → 400, **antes de tocar la base de datos o el outbox** (`route.ts:97-105`, el
  `safeParse` corre antes de `saveTiendaOnlineLocal`). No hay forma de que un valor así llegue a
  persistirse ni a emitirse a medias.
- **¿Puede un lat/lng inválido tumbar el evento `STORE` ENTERO, como pasa con `openingHours` desde
  la v9?** No, por una razón estructural distinta: `horarios` tiene su propio camino de error
  (`onlyOpeningHoursFailed`, `openingHoursInvalid`, `TiendaOnlineOpeningHoursError`,
  `QabStorePayloadError` — route.ts:37-58, 131-136; tiendaOnlineStore.ts:304-307;
  qabStorePayload.ts:38-44) porque es una estructura anidada que necesita reportar qué regla
  concreta rompió. Latitud y longitud son escalares planos: un valor fuera de rango simplemente
  hace fallar el `safeParse` del body entero con un 400 genérico, **antes** de que exista
  transacción, fila actualizada o evento encolado que "tumbar". No hay equivalente al escenario
  v9 aquí porque no hay escritura parcial que abortar — no llega a empezar.
- **Asimetría real, de bajo riesgo hoy pero que conviene cerrar:** `src/schemas/qabStore.ts:51-52`
  (`tiendaOnlineSchema`, un schema distinto) sí repite el rango (`LATITUDE_MIN/MAX` definidos en
  líneas 18-21 de ese mismo archivo), pero **`qabStorePayloadSchema.latitude`/`.longitude`
  (líneas 88-89 de `src/schemas/qabStore.ts`) es `z.number().nullable()` sin rango**. Y
  `buildQabStorePayload` (`src/lib/qab/qabStorePayload.ts:52-77`) termina con
  `qabStorePayloadSchema.parse(...)` — un `.parse()` que **lanza**, no un `.safeParse()`. Hoy es
  inalcanzable con datos inválidos porque `updated.latitud`/`updated.longitud` (línea 357-358 de
  `tiendaOnlineStore.ts`) salen de la fila que Prisma acaba de escribir con datos ya validados por
  `tiendaOnlineLocalUpdateSchema`. Pero si algún día otro caller escribe `Tienda.latitud`/
  `longitud` sin pasar por esa ruta (una migración de datos, un script, un endpoint nuevo), un
  valor fuera de rango llegaría hasta este `.parse()` y lanzaría un `ZodError` **sin capturar
  específicamente** — cae al `catch` genérico del route handler (`route.ts:118-142`), que no
  reconoce `ZodError` como ninguno de sus tipos nombrados y termina en
  `logRouteError(error)` (`qabRouteHttp.ts:19-25`), que hace `console.error(`${error.name}:
  ${error.message}`)`. **Un mensaje de Zod cita el campo y a veces fragmentos del valor recibido
  (E-031)** — aquí el dato es una coordenada pública del propio negocio, no una credencial, así
  que la gravedad es baja, pero es exactamente la forma del error que E-031 pide vigilar. **No es
  un bloqueo para F-025** (el camino real está cerrado), pero recomiendo al `implementer`: si toca
  este archivo por cualquier motivo, añadir el mismo rango a `qabStorePayloadSchema.latitude`/
  `.longitude` por simetría, y no dejar que ese `.parse()` final sea el único punto sin una rama de
  error nombrada — igual que `horarios` la tiene.
- **Precisión (`Decimal(9,6)` del lado de QAB):** nada en esta capa redondea a 6 decimales antes
  de emitir. Un clic/arrastre en un widget de mapa produce típicamente 15-17 cifras
  significativas de punto flotante. No es una vulnerabilidad de cuadrecaja — la columna `Decimal`
  es de QAB y truncar/redondear es su responsabilidad — pero sugiero al `implementer`: redondear a
  6 decimales al escribir `latitud`/`longitud` en el draft desde el mapa (mismo lugar,
  `toNullableNumber` en `src/utils/tiendaOnlineDraft.ts:93-98`, o donde el widget entregue el
  valor), para no mandar ruido de precisión innecesario y evitar que dos fuentes (mapa vs. campo
  tecleado a mano) produzcan representaciones textuales distintas del mismo punto.

### 2.3 Degradación segura del mapa (criterio 4) — sin ruta hacia `signOut()` ni cuerpo corrompido

- Las peticiones de tesela son `<img>`/`fetch` directos del navegador al dominio del proveedor,
  **fuera de `axiosClient`** (`src/lib/axiosClient.ts`), que solo intercepta las respuestas de las
  llamadas hechas con esa instancia de axios hacia la propia API de cuadrecaja. Un dominio de
  teselas bloqueado no puede disparar el `signOut()` de E-007 ni el borrado de cuerpo de un 403 de
  E-009, porque esos interceptores nunca ven esa petición.
- **La única forma de reintroducir ese riesgo sería que el widget, o un ayudante alrededor de él,
  llame a una ruta PROPIA de cuadrecaja** (por ejemplo, un endpoint de reverse-geocoding o de
  "resolver dirección desde coordenadas" servido por nuestro backend). El spec no pide nada así y
  no debería añadirse sin pasar otra vez por esta revisión: si existiera, una sesión que caduca
  mientras se interactúa con el mapa dispararía el mismo 401→`signOut()` de E-007, esta vez en
  mitad de una edición no guardada.
- **Mensajes de error del propio widget:** si el proveedor/librería elegidos exponen la URL de la
  tesela fallida en el evento de error (algunos lo hacen, y esa URL puede llevar una clave si el
  proveedor la requiere — ver 1.2), cualquier copy de "el mapa no cargó" debe ser una constante
  fija, nunca interpolar `error.message` ni la URL — mismo patrón que E-031 documenta para
  `JSON.parse`/`BigInt`. Esto es responsabilidad del `ui-designer`/`implementer` al fijar el
  estado de fallo del criterio 4, y lo señalo aquí porque el vector es el mismo mecanismo que las
  tres fichas ya conocen, aplicado a un componente nuevo.

### 2.4 Trampa a evitar explícitamente: `navigator.geolocation`

Ninguna criterio lo pide, pero es la tentación obvia de un implementer que quiera ahorrarle un
clic al comerciante ("usar mi ubicación actual"). No debe añadirse: la ubicación del dispositivo
de quien configura la pantalla no es necesariamente la del local (puede estar configurando desde
casa, desde el teléfono, desde otra ciudad), contradice el criterio 5 (nada se escribe hasta que
alguien marque un punto **explícitamente** sobre el mapa, no por inferencia del dispositivo), y
abre un permiso de navegador que ninguna parte del spec ni del diseño contempla.

### 2.5 Chunk-splitting (criterio 7)

Fuera del alcance de esta auditoría de seguridad — es una decisión de bundling del
`arch-guardian` y se verifica con build output/Network, no con una lente de seguridad. Sin
comentario adicional.

---

## Resumen para quien decide

**Lo que debería influir en la elección de proveedor/librería, en orden de peso:**
1. Preferir un proveedor de teselas **sin clave ni Referer-allowlisting** (1.2) — un proveedor que
   exige Referer choca de frente con la cabecera que 1.1 pide fijar.
2. Preferir una librería **sin telemetría propia**, y comprobarlo ejecutando, no leyendo su
   documentación (1.3) — MapLibre GL JS o Leaflet tienen mejor historial que Mapbox GL JS en este
   punto concreto.
3. **No** incluir geocoding por texto en este feature (1.4): el coste de fuga es real, ningún
   criterio de aceptación lo pide, y las restricciones de Cuba ya empujan hacia el mecanismo
   mínimo.
4. Fijar `Referrer-Policy` (idealmente `no-referrer`, mínimo `strict-origin-when-cross-origin`) y
   valorar una CSP acotada a esta pantalla (1.1, 1.5) — deuda preexistente que F-025 hace visible
   y que es barato cerrar ahora, no después.

**Restricciones para el `implementer`, una vez elegido el proveedor:**
- El mapa debe alimentar el draft existente (`latitud`/`longitud` como `string`) vía
  `onFieldChange`, nunca un estado paralelo — así hereda gratis la validación de rango ya presente
  en `tiendaOnlineLocalUpdateSchema` y el aislamiento por `negocioId` ya presente en
  `saveTiendaOnlineLocal`. No hay que tocar ninguno de los dos.
- No añadir ningún endpoint propio que el mapa llame durante la edición (reverse-geocoding u
  otro) sin pasar otra vez por revisión de seguridad — ver 2.3.
- No usar `navigator.geolocation` — ver 2.4.
- Cualquier copy de error del widget es una constante fija, nunca interpola el error o la URL de
  la tesela fallida — ver 2.3.
- Redondear a 6 decimales al escribir la coordenada del mapa en el draft — ver 2.2 (precisión).
- Si se toca `src/schemas/qabStore.ts` por cualquier motivo, alinear el rango de
  `qabStorePayloadSchema.latitude`/`.longitude` con el de `tiendaOnlineSchema` — ver 2.2
  (asimetría), sin que esto bloquee el feature: es un cierre de simetría, no una vulnerabilidad
  alcanzable hoy.

**Lo que ya está bien y no requiere cambios:** el aislamiento multi-tenant del criterio 8 (2.1),
la validación de rango de las dos vías de entrada (2.2, salvo la asimetría de baja severidad), y
la imposibilidad estructural de que un fallo de teselas dispare `signOut()` o corrompa un cuerpo
de error (2.3).
