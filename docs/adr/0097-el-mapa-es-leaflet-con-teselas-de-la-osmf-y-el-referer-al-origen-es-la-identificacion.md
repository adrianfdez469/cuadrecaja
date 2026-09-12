# ADR 0097: El mapa es Leaflet con teselas de la OSMF, y el `Referer` recortado al origen es la identificación que su política exige

**Estado:** aceptado
**Fecha:** 2026-09-07
**Feature:** F-025

## Contexto

F-025 añade un mapa donde el encargado marca el punto de su local, en sustitución de teclear la
latitud y la longitud a mano. Hay que elegir librería y proveedor de teselas, y la elección está
atada por restricciones que no son solo técnicas:

- **Los datos móviles en Cuba son caros y lentos.** De ahí el criterio 4: un mapa de teselas **no
  puede ser obligatorio** para completar el formulario. Y de ahí que el peso de la librería importe
  más aquí que en cualquier otra pantalla.
- **Los teléfonos del público son baratos.** Una librería que exija WebGL 2 introduce una clase de
  fallo **total**, no degradado, en dispositivos que no lo tienen.
- **Google Maps queda descartado** por cobertura pobre del país y por las restricciones de embargo
  de su API. **Mapbox arrastra lo segundo**, y además su librería hace ping a su propia telemetría
  por omisión incluso sirviendo teselas ajenas, lo que incumpliría el criterio 6 sin que nadie
  escribiera una línea para ello.
- **El embargo no es solo un problema legal, es un problema de alcance.** Un proveedor
  estadounidense puede geo-bloquear direcciones IP cubanas, y entonces el mapa no está «en riesgo
  legal»: simplemente no funciona para exactamente el público de este feature.
- **El criterio 6** prohíbe que la pantalla envíe al proveedor «nada del negocio más allá de lo que
  exige pedir una tesela».
- **No existe hoy ninguna `Referrer-Policy` ni ninguna CSP en el repositorio.** Comprobado sobre
  `next.config.ts`, `src/middleware.ts` y `vercel.json`.
- La pantalla es `/tienda-online/configuracion`, y el `tiendaId` del local que se edita **vive en
  `useState`, nunca en la URL**: el único parámetro es `?tab=`. Así que ni el peor caso de un
  `Referer` completo llevaría `negocioId` ni `tiendaId`.

La propuesta de partida era OpenStreetMap con teselas de un proveedor no estadounidense, o
servidas propias.

### El falso negativo que casi descartó al proveedor correcto, y su causa

**Esto está escrito aquí para que nadie repita la prueba mal ni lea este ADR como que la capa
estándar de la OSMF estaba descartada.**

En la primera investigación se probó `https://tile.openstreetmap.org` con `curl`, sin `Referer` y
con un `User-Agent` propio. La respuesta fue **HTTP 200 con un PNG de ~7 KB que dice «403 / Access
blocked»**, y una cabecera `x-blocked` apuntando a la política. De ahí se concluyó, mal, que el
proveedor bloquea y que su modo de fallo es indetectable.

La comprobación correcta, ejecutada después sobre la **misma** tesela de La Habana
(`12/1110/1777`):

```
curl desnudo                                      -> http 200,  6.987 bytes -> el cartel de bloqueo
+ User-Agent de navegador + Referer
+ Accept + Sec-Fetch-{Dest,Mode,Site}             -> http 200, 32.697 bytes -> LA TESELA REAL
```

La imagen de 32.697 bytes es El Vedado, Miramar, Almendares y Casino Deportivo, correcta y a nivel
de calle. Se comprobó además que una tesela de 103 bytes y azul liso (`12/1197/1723`) **no** es un
fallo: cae en el Atlántico al norte de las Bahamas y es una tesela legítima de agua.

**La causa del falso negativo tiene dos mitades, y las dos son instructivas:**

1. Un `curl` sin `Referer` y con un `User-Agent` desconocido es **exactamente** el tráfico que su
   § 3.4 dice que bloquea: «Traffic using generic defaults, referer-stripping, or spoofed
   identities may be blocked without notice». La prueba reprodujo la configuración prohibida y midió
   su castigo, no el comportamiento del proveedor.
2. Una restricción de alcance derivada del informe de seguridad —«descartar cualquier proveedor que
   exija `Referer`»— empujaba en la misma dirección. Entre las dos, el proveedor correcto quedó
   descartado por una configuración que **nunca vamos a usar**.

**Las teselas las pide el navegador, no `curl`, y ese es el único contexto que cuenta.** La regla
que sale de esto: cuando se evalúa un servicio cuya política de admisión depende de la **forma** de
la petición, la prueba tiene que tener la forma real del cliente.

## Decisión

**Librería: `leaflet@1.9.4` + `react-leaflet@5.0.0`.** Raster, sin WebGL, 42.438 bytes gzip
medidos.

**Proveedor: la capa estándar de la OpenStreetMap Foundation**,
`https://tile.openstreetmap.org/{z}/{x}/{y}.png`. **Sin clave, sin registro y sin coste.**

**Política de referrer: `referrerPolicy: "strict-origin"` en la propia capa de teselas.** Manda
**solo el origen**. No es «lo más restrictivo posible»: es lo que su política exige, y no más.

**El proveedor vive en un solo objeto de constantes, con un hueco de configuración por si hay que
cambiarlo con prisa.**

**Geocoding fuera. `navigator.geolocation` fuera. CSP y `Referrer-Policy` de repositorio, fuera.**

### Por qué Leaflet y no MapLibre GL JS

Medido, no supuesto: `leaflet.js` son 42.438 bytes gzip; `maplibre-gl` v6.7.0 son 282.462 bytes
gzip entre su módulo principal y su módulo compartido. Son ~234 KB de diferencia **antes de la
primera tesela**, en la pantalla cuyo público es el que no puede pagarlos. Y MapLibre v6 **exige
WebGL 2 de forma obligatoria** —lo declara su propio CHANGELOG al retirar el soporte de WebGL 1—,
así que en un teléfono sin WebGL 2 el mapa no degrada: lanza en el constructor.

Además, la aritmética de coordenadas de Leaflet es local: con las teselas bloqueadas, el marcador,
el clic y el arrastre siguen funcionando. Eso es lo que hace que el criterio 4 no sea una concesión,
sino una propiedad.

Se añade `react-leaflet` y no se usa Leaflet a pelo por una razón de arquitectura, no de comodidad:
su `<Marker position>` es **declarativo**, así que la posición del marcador es una proyección del
draft en cada render y la dirección campo → mapa del criterio 3 no puede «no existir» por olvido
(ver ADR 0098 y E-013). Y su `<MapContainer>` trata `center`/`zoom` como props **solo de montaje**,
que es exactamente la separación que el criterio 5 necesita.

### Por qué la capa estándar de la OSMF

Verificado leyendo su política completa, no la creencia popular sobre ella:

- **No prohíbe el uso comercial ni el uso como capa de teselas de una aplicación de terceros.** La
  creencia contraria es falsa. Dice, verbatim: «We welcome creative uses and do not require you to
  use a specific API», y su lista de uso permitido incluye «Normal interactive viewing by a human
  where the client requests only the tiles needed for the current viewport».
- **Sirve Cuba a nivel de calle**, comprobado abriendo teselas reales: calles con nombre, huellas
  de edificio, números de portal y POIs en La Habana; y trama de calles con nombre también en
  Santiago de Cuba y en Jatibonico, un pueblo de ~25.000 habitantes. (La página del wiki de OSM
  sobre Cuba tiene una sección titulada «Not Covered» que lista casi todo el país: está sin tocar
  desde mayo de 2023, la contradicen las teselas en vivo, y **no es autoritativa**.)
- **Es la única opción sin clave, sin cuota y sin coste** que sirve teselas raster. Las alternativas
  raster no estadounidenses exigen todas una clave, y dos de ellas exigen además un plan de pago.
- **Sus datos son los de OpenStreetMap**, que es lo que la propuesta del feature pedía.
- **Nuestra carga es la que su política describe como permitida**: unos cientos de comerciantes que
  abren una pantalla de configuración de vez en cuando y piden las teselas de la vista actual. Su
  política no declara ningún umbral numérico de peticiones — comprobado: el único número que da es
  la referencia a `z>=14` para los barridos automatizados y el mínimo de caché de 7 días.

### El `Referer`: se arbitra contra el informe de seguridad, y el sentido es el contrario

`.agents/security/F-025.md` § 1.1 recomienda `no-referrer`, y lo argumenta así: «perfectamente
compatible con pedir teselas — las teselas no necesitan saber de dónde vienen». **Esa premisa es
falsa**, y arbitrar la discrepancia es del arquitecto, no del implementador (E-030). Con este
proveedor no es una preferencia: es la diferencia entre que el mapa funcione y que no.

Su § 3.1 dice, verbatim: «**Do not set a restrictive Referrer-Policy that prevents the Referer
header being sent** on requests to tile.openstreetmap.org», y «Referer (web only): Browsers are
expected to send a valid Referer header». Su § 3.4 remata: «For websites, ensure the Referer header
is present and accurate end-to-end. If you proxy tile requests through your servers or a CDN, do
not strip or blank the Referer», y «Traffic using generic defaults, **referer-stripping**, or
spoofed identities may be blocked without notice».

Y hay una asimetría que explica **por qué** el `Referer` pesa tanto en el camino web: su § 3.1 pide
«a clear, unique User-Agent string that names your app», pero añade «Browsers will use the
browser's default User-Agent». **En una página no se puede fijar el `User-Agent`.** Así que en el
camino web **el `Referer` ES la identificación de la aplicación** que su política exige. Quitarlo
no es endurecer la privacidad: es volverse anónimo justo para el único mecanismo con el que ese
proveedor puede identificar y contactar a quien usa su servicio, que es lo que su § 3.4 castiga.

**Se fija `strict-origin`, y es suficiente**, por tres razones que se pueden contrastar:

1. **No previene el envío del `Referer`**, que es lo único que su § 3.1 prohíbe. Manda uno: el
   origen.
2. **Es exactamente lo que ellos mismos bendicen.** Su política dice «Note: Modern browsers, with
   default settings, already satisfy these technical requirements», y el valor por omisión de los
   navegadores modernos es `strict-origin-when-cross-origin`, que en una petición **cross-origin**
   sobre HTTPS manda **solo el origen**. Es decir: `strict-origin` pone en el cable el mismo valor
   que el ajuste por omisión que su propia política declara conforme.
3. **Nunca manda más.** `strict-origin` y `strict-origin-when-cross-origin` solo se diferencian en
   las peticiones del mismo origen, y una petición de tesela nunca lo es. Se elige el primero
   porque es un subconjunto estricto: no puede filtrar la ruta ni la query en ninguna rama.

**La query nunca sale**, y con este proveedor eso es literal y no una promesa: la URL de la tesela
**no tiene query en absoluto**. No hay clave, no hay identificador de cliente, no hay
cache-buster.

Y el peor caso queda acotado y escrito: un WebView antiguo que ignore el atributo caería en su
propio valor por omisión y podría mandar la URL completa, que sería
`…/tienda-online/configuracion?tab=locales`. El `security-guardian` verificó en el archivo que esa
URL **no lleva `negocioId` ni `tiendaId`**, porque el local seleccionado vive en `useState`
(línea 121). No es una fuga de tenant en ninguna rama.

### El hueco de configuración del proveedor, que su propia política recomienda

`src/constants/map.ts` expone **un solo objeto**:

```
MAP_TILE_PROVIDER: { urlTemplate: string; attributionHtml: string }
```

Su valor por omisión es el par de la OSMF, horneado en el código. Y admite una sustitución completa
por dos variables de entorno **opcionales**,
`NEXT_PUBLIC_MAP_TILE_URL_TEMPLATE` y `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION_HTML`, resueltas por la
función pura `resolveTileProvider`.

Tres decisiones dentro de esta:

- **Existe porque su propia política lo recomienda.** En su lista de «You should (recommended)»:
  «Avoid hard-coding the tile URL; allow switching without needing a software update». Y porque su
  § 7 avisa de que el acceso puede retirarse sin previo aviso: el día que pase, cambiar de proveedor
  no debería requerir un desarrollo.
- **La URL y la atribución viajan en el MISMO objeto, y la sustitución es de las dos o de
  ninguna.** Si solo se define una de las dos variables, `resolveTileProvider` **ignora la
  sustitución** y devuelve el par de la OSMF completo. Motivo: servir teselas de un tercero bajo el
  crédito de OpenStreetMap —o al revés— es un incumplimiento de licencia, y una variable de entorno
  suelta lo produce con un despiste de despliegue. Así es imposible por construcción: no hay
  ninguna forma de tener una URL de un proveedor con la atribución de otro. El respaldo al par
  correcto y licenciado es deliberado, y su síntoma —siguen viéndose las teselas de OSM— es visible
  para quien puso la variable.
- **La atribución sigue sin ser configurable por sí sola**, que era la objeción a meterla en una
  variable de entorno. Solo se puede cambiar acompañada de la URL a la que corresponde.

### El resto de su política de uso, que ahora sí nos aplica

Todas estas pasan al contrato como obligaciones o prohibiciones concretas:

- **Atribución visible sin interacción, con enlace.** Su § 2: «Show OpenStreetMap licence
  attribution clearly on the map (typically bottom-right)», «Do not hide attribution beneath UI,
  behind toggles, or off-screen». Y las guías de atribución de la OSMF: «Attribution must be
  presented to anyone who uses, views, accesses… the map… The attribution format should not require
  individuals to interact with the map to see the attribution». Las guías permiten colapsarla
  después (tras un descarte, al interactuar, o a los cinco segundos) dejando un botón «(i)», pero
  **un icono de información como única vía nunca visible no entra en su puerto seguro**. Se pinta
  con el control de atribución de Leaflet, y es límite duro para el `ui-designer`: si el alto del
  mapa no le deja sitio, cede el alto.
- **Un solo host, HTTPS, sin `{s}`.** Su resumen: «Use the correct URL:
  `https://tile.openstreetmap.org/{z}/{x}/{y}.png`» y «Do not… Use the HTTP URL». Su § 1: «Other
  subdomains or hostnames may be slower or withdrawn without notice». Su § 3.3 recomienda HTTP/2 o
  HTTP/3, que es justo lo que hace innecesarios los subdominios. **Prohibido el patrón `{s}` y la
  opción `subdomains` de Leaflet.**
- **`detectRetina: false`.** A `true`, Leaflet pide cuatro teselas de la mitad de tamaño para la
  misma vista: cuadruplica los bytes justo para el público que no puede pagarlos **y** cuadruplica
  las peticiones a un servidor financiado con donaciones.
- **Nada de precarga ni de sembrado.** Su § 4 define el «bulk downloading» como «any pre-emptive
  fetching of tiles other than those a user is actively viewing», e incluye «"Pre-seeding" large
  areas or multiple zoom levels in advance». Los valores por omisión de Leaflet piden las teselas de
  la vista actual y entran en lo que su política llama «modest, short-range look-ahead typical of
  browsers». **Prohibido cualquier plugin de precarga y cualquier recorrido programático de vistas
  para calentar el caché.**
- **Nada de caché de teselas fuera del caché HTTP del navegador.** Su § 4: «Offline use is not
  permitted on tile.openstreetmap.org. Features such as "Download city/country for offline use" or
  "Save area for later" rely on prefetch/bulk downloading and are therefore prohibited». **Esto hay
  que escribirlo porque es la «mejora obvia» que las restricciones de Cuba invitan a proponer**:
  guardar teselas en IndexedDB o en un service worker para que el mapa funcione sin datos está
  **prohibido por este proveedor**. Si algún día se quiere, es otro proveedor —Thunderforest lo
  permite explícitamente— o teselas propias.
- **Honrar el caché HTTP y no romperlo.** Su resumen: «Cache tiles locally according to HTTP
  caching headers (or at least 7 days)» y «Do not send `Cache-Control: no-cache`, `Pragma:
  no-cache`, or similar no-cache headers by default». El caché del navegador ya lo hace; lo único
  que hay que no hacer es añadir un parámetro variable a la URL de la tesela.
- **Aviso al `qa`, y no es un detalle.** Su § 4 nombra entre lo prohibido los «Automated scans
  across wide bounding boxes, especially at high zoom (z>=14)» y los «Headless bots that pan/zoom
  the map to force rendering». La verificación del criterio 3 se hace con **un puñado de
  interacciones a ritmo humano**, no con un barrido automatizado de paneo y zoom.
- **Zoom.** Su política **no declara ningún límite de zoom** — comprobado. `MAP_MAX_ZOOM = 19` es
  nuestra elección, basada en hasta dónde sirve esa capa, no un requisito suyo; y `MAP_MIN_ZOOM = 3`
  evita pedir el mundo entero.
- **Recomendaciones suyas que NO se convierten en requisito**, para que el `qa` no las exija como
  tales: «Add a "Report a map issue" link to https://www.openstreetmap.org/fixthemap» y «Publish a
  contact email on your website or app store listing» están en su lista de «You should», no de «You
  must». El enlace de «reportar un problema del mapa» se le sugiere al `ui-designer` junto a la
  atribución; queda a su criterio.

### Geocoding: fuera, y por qué no es una «mejora obvia» pendiente

Ningún criterio de aceptación lo pide, y un buscador de direcciones mandaría **lo que el
comerciante escribe** a un tercero: previsiblemente el nombre y la dirección de su negocio, que es
justo lo que el criterio 6 prohíbe, por una puerta que el criterio no cubre literalmente. Y no
tiene mitigación completa: un proxy en nuestro servidor esconde el origen y el `negocioId`, pero
**el texto de búsqueda sigue viajando íntegro** al geocoder. La política de Nominatim, además,
prohíbe las consultas por pulsación de tecla.

Si algún día se quiere, necesita su propio criterio de aceptación, su propia revisión de seguridad
y probablemente un Nominatim propio. No entra por la puerta de atrás de este feature.

### `navigator.geolocation`: fuera

La ubicación del dispositivo de quien configura la pantalla **no es necesariamente la del local**
—se configura desde casa, desde otra ciudad, desde el teléfono—, contradice el criterio 5, que
exige que nada se escriba hasta que alguien marque un punto **explícitamente**, y abre un permiso de
navegador que ni el spec ni el diseño contemplan.

### CSP y `Referrer-Policy` de repositorio: fuera de F-025, y recomendadas como feature propio

Hoy **no existe ninguna de las dos** en todo el repositorio: ni en `next.config.ts`, ni en
`src/middleware.ts`, ni en `vercel.json`. F-025 es la primera pantalla que habla con un origen de
imagen de un tercero desde el navegador de un comerciante autenticado, así que hace visible esa
deuda — pero no la introduce.

La mitigación de F-025 se acota al widget: la política de referrer va **en la capa de teselas**, que
es verificable revisando el tráfico de la pantalla como el criterio 6 exige y no puede romper nada
fuera. Una cabecera global o una CSP son un cambio de repositorio que ningún criterio de este
feature pide, y **una CSP mal acotada rompe pantallas ajenas en silencio**.

Se recomienda abrirlo como feature propio, con este alcance de partida: `Referrer-Policy:
strict-origin-when-cross-origin` global —**nunca `no-referrer`**, por todo lo de arriba— y una CSP
que abra `img-src` **solo** a `tile.openstreetmap.org`, nunca `img-src *`. Efecto colateral útil:
una CSP así convierte la revisión manual del criterio 6 en una red de seguridad permanente, y un
`Refused to connect` en consola es la forma más barata de detectar que alguien añadió un tercero sin
darse cuenta.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Google Maps | Cobertura pobre de Cuba y restricciones de embargo de su API. Descartado antes de este ADR, en las `notes` del feature |
| Mapbox GL JS + teselas de Mapbox | Arrastra el embargo, y su librería hace ping a su telemetría por omisión **incluso con teselas ajenas**: incumpliría el criterio 6 sin que nadie lo programara |
| **Descartar la OSMF por la prueba con `curl`** | Es el falso negativo documentado arriba: se midió el castigo de una configuración prohibida —sin `Referer`, con `User-Agent` desconocido— en vez del comportamiento del proveedor ante el cliente real. Con la forma de petición de un navegador, la misma tesela vuelve completa |
| MapLibre GL JS + OpenFreeMap | Licencia y precio ideales —sin clave, sin cuota, uso comercial explícito, autoalojable—, pero **~276 KB gzip contra 42 KB** y **WebGL 2 obligatorio**: son las dos restricciones que más pesan en este feature. Además lo mantiene una persona, sin SLA y sin ubicación de servidores declarada |
| **MapTiler AG** (Suiza) — la primera salida si la OSMF nos retira el acceso | Buena opción y sin régimen de exportación de EEUU para el mapa de calles (su cláusula de embargo está acotada al contenido de satélite). Pero su plan gratuito **excluye** el uso comercial —«Suitable for testing, personal or non-commercial use», y un ✗ en «Commercial use» en su tabla—, así que cuesta **30 USD/mes** en el plan Flex, y exige una **clave en la query** de cada tesela. Con la OSMF sirviendo bien, es coste y superficie a cambio de nada |
| **Thunderforest** (Reino Unido) — la otra salida | Sin cláusula de exportación, 150.000 teselas/mes gratis, y **permite explícitamente el caché en dispositivo** («Tiles may be cached in-browser and on-device for offline use»), que es lo único que la OSMF prohíbe y que aquí interesaría. Pero **el uso comercial de su plan gratuito no está afirmado de forma inequívoca**: dice «Commercial use is permitted and encouraged» sin acotarlo a un plan, y a la vez presenta el gratuito como «to test out our product» y discrecional. Un permiso ambiguo no lo detecta ningún test |
| CARTO basemaps | Empresa estadounidense (Nueva York) con cláusula de exportación de EEUU; sin clave devuelve teselas **con marca de agua**; su raster «is being retired»; y prohíbe el proxy/caché en servidor |
| Stadia Maps | Empresa estadounidense (Delaware) y la cláusula de exportación más explícita de todas («agree not to transfer … to any export-prohibited country»). Su plan gratuito es «non-commercial or evaluation purposes» |
| Geoapify (Chipre) | El único plan gratuito con uso comercial explícito, pero **5 peticiones por segundo** rompe la carga inicial de 6-9 teselas simultáneas, y 3.000 créditos al día no dan para unos cientos de comerciantes |
| Servir teselas propias | Es la respuesta correcta a largo plazo y la que la propia OSMF sugiere («or run your own»), pero es una infraestructura entera —planeta OSM, renderizado, almacenamiento, CDN— y no cabe en un feature cuyo alcance es cambiar cómo se capturan dos campos. El objeto de proveedor y su sustitución por entorno dejan la puerta abierta |
| `referrerPolicy: "no-referrer"`, como pide el informe de seguridad | Su § 3.1 lo **prohíbe** expresamente y su § 3.4 lo castiga con bloqueo. Y en un navegador el `User-Agent` no es fijable, así que el `Referer` **es** la identificación de la aplicación que su política exige: quitarlo no endurece la privacidad, nos convierte en el tráfico anónimo que bloquean |
| `referrerPolicy: "unsafe-url"` o dejarlo sin fijar | Mandaría la ruta y la query. No hacen falta para nada, y «no fijarlo» deja el valor a merced del navegador: un WebView antiguo mandaría la URL completa |
| Guardar teselas en IndexedDB o un service worker para funcionar sin datos | Su § 4 lo **prohíbe** explícitamente («Offline use is not permitted on tile.openstreetmap.org»). Es la mejora que las restricciones de Cuba invitan a proponer, y con este proveedor no es una opción |
| Detectar el bloqueo por el tamaño o el hash de la imagen de la tesela | Frágil por construcción: se rompe el día que cambien el cartel, y un falso positivo esconde el mapa cuando funciona. Ya hubo un candidato a falso positivo en la propia investigación: una tesela legítima de agua de 103 bytes |
| Poner la URL del proveedor en una variable de entorno **sin** la atribución | Permitiría servir teselas de un tercero bajo el crédito de OpenStreetMap con un despiste de despliegue, que es un incumplimiento de licencia. Por eso las dos viajan en el mismo objeto y la sustitución es de las dos o de ninguna |
| Geocoding con proxy en nuestro backend | El proxy esconde el origen, pero **el texto de búsqueda sigue viajando íntegro** al tercero. Mitigación parcial, superficie nueva, y ningún criterio lo pide |

## Consecuencias

**A favor:**

- **Coste cero y cero credenciales.** Ni cuenta, ni clave, ni cuota, ni variable de entorno
  obligatoria. Nada que rotar, nada que se filtre, nada que caduque.
- **La URL de la tesela no tiene query.** El criterio 6 pasa de «solo viaja lo que hace falta» a
  algo literal: ruta `{z}/{x}/{y}.png`, query vacía, `Referer` igual al origen, y sin cookies
  nuestras, porque una petición cross-site de `<img>` no las lleva.
- 42 KB gzip de librería, sin WebGL, con teselas raster que son las más baratas de las dos familias
  en la primera vista — la métrica que más pesa dado el público.
- Datos de OpenStreetMap, que es lo que pedía la propuesta, con cobertura de Cuba **verificada
  abriendo teselas reales** y no supuesta.
- La configuración del proveedor cabe en un objeto y se puede sustituir por entorno, que es
  exactamente lo que su propia política recomienda.
- Es imposible, por construcción, servir teselas de un proveedor con la atribución de otro.

**En contra / coste asumido:**

- **Riesgo 1, que sobrevive y no se puede disfrazar: si la OSMF nos bloquea, el fallo llega como
  HTTP 200 con una imagen de cartel, así que `tileerror` NO se dispara y el estado degradado del
  criterio 4 no puede detectar ese caso.** No se intenta resolver con heurísticas de tamaño o de
  hash de imagen: son frágiles y se rompen cuando cambien el cartel.

  **Lo que hace que sea aceptable no es una mitigación técnica, es el diseño del formulario**, y
  conviene decirlo con precisión: el formulario **nunca depende del mapa**, y las coordenadas siguen
  siendo tecleables a mano (criterio 3), con su rango validado en el backend. Así que el peor caso
  de este riesgo es **una rejilla de carteles y un encargado que teclea las coordenadas**: es una
  degradación de la experiencia, no una pérdida de función. Y la cualificación al revés, para que
  nadie lea el absoluto contrario: `tileerror` **sí** se dispara ante un error de red o un error
  HTTP real —el dominio bloqueado del criterio 4, por ejemplo—, así que el estado degradado sirve
  para el caso que el criterio verifica, y no para este otro.

- **Riesgo 2, que también sobrevive: no hay SLA, y a un servicio comercial le pueden retirar el
  acceso en cualquier momento.** Su intro dice «Availability is best-effort: there is no SLA or
  guarantee», su § 7 «Access may be blocked without prior notice», y el párrafo que está escrito
  para nosotros: «Commercial services, or those that seek donations, should be especially aware that
  access may be withdrawn at any point: you may no longer be able to serve your paying customers if
  access is withdrawn». Cuadre de Caja es un producto de suscripción.

  **Mitigación real, no aspiracional:** el proveedor vive en un objeto de constantes y su
  sustitución son dos variables de entorno, sin desarrollo. Y las **dos salidas quedan nombradas
  aquí para que quien las necesite ese día no tenga que rehacer esta investigación**:

  1. **MapTiler AG (Suiza), plan Flex, 30 USD/mes.** Raster PNG 256 px, uso comercial permitido
     **sin ambigüedad** en ese plan, jurisdicción suiza, cláusula de embargo acotada al contenido de
     satélite que no usamos, 500.000 peticiones/mes. Exige una clave en la query de cada tesela;
     protégela con la restricción de origen que MapTiler ofrece, que es compatible con
     `strict-origin` porque necesita justamente el origen. URL:
     `https://api.maptiler.com/maps/{styleId}/256/{z}/{x}/{y}.png?key=…` — hay que confirmar que el
     identificador de estilo resuelve en la cuenta.
  2. **Servir teselas propias.** Es lo que su propia política sugiere («or run your own») y la única
     salida que no depende de nadie. Es un proyecto de infraestructura, no un cambio de constante.

  (Y si algún día el caché de teselas en dispositivo se vuelve un requisito por el coste de los
  datos, la salida no es ninguna de las dos: es **Thunderforest**, que lo permite explícitamente,
  con la condición de aclarar antes por escrito el uso comercial de su plan gratuito.)

- Depender de un tercero gratuito y financiado con donaciones para una pantalla de configuración.
  Acotado por los dos puntos anteriores.
- **El caché de teselas fuera del navegador está prohibido** por este proveedor, y es justo la
  optimización que las restricciones de Cuba invitan a proponer. Queda escrito en el contrato como
  prohibición para que no se implemente sin cambiar antes de proveedor.
- `react-leaflet` v5 se distribuye como ESM. **No está verificado** que Next 15.2.6 necesite
  `transpilePackages` para él; si hace falta, es una línea en `next.config.ts` que hay que añadir
  con el mensaje de error real delante, no preventivamente.
- La verificación del criterio 3 no puede hacerse con un barrido automatizado de paneo y zoom: su
  § 4 lo nombra entre el tráfico prohibido. Es una restricción sobre el `qa`, no sobre el código.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant: sin cambios y verificado.** Este feature no abre ninguna vía de acceso
  a datos. `route.ts:85` toma el `negocioId` solo de la sesión, y `tiendaOnlineStore.ts:286-294` y
  `:309-313` lo usan como filtro real de Prisma en la lectura y en la escritura. **El widget del
  mapa no conoce ningún identificador de tenant**: sus props son un punto y una función.
- **Validación en backend: sin cambios.** El rango de las coordenadas ya lo aplica
  `tiendaOnlineLocalUpdateSchema` en el `safeParse` del body, antes de tocar la base de datos o el
  outbox. El mapa alimenta el mismo draft que ese schema valida, así que hereda la validación gratis
  y no la duplica.
- **Superficie de fuga: la más pequeña de todas las opciones evaluadas.** Sin clave y sin query, lo
  único que sale de la pantalla hacia un tercero es la ruta de la tesela, las cabeceras genéricas
  del navegador y el origen. No hay ningún campo configurable donde alguien pueda meter un
  identificador por descuido.
- **Escalabilidad: cero consultas nuevas.** No hay N+1 que evitar porque no hay consulta que añadir;
  el coste de este feature es tráfico del navegador hacia un tercero, y va a un chunk que solo la
  pantalla de configuración descarga (ADR 0099).
- **Coste de reversión: bajo, y deliberadamente.** Cambiar de proveedor son dos variables de
  entorno, o un objeto de constantes. Cambiar de librería es reescribir un solo archivo, porque
  `StoreLocationMap.tsx` es el único que la importa. Quitar el mapa entero es borrar dos componentes
  y una prop: los dos campos numéricos siguen siendo la vía primaria y no se tocan.
