# ADR 0098: La coordenada la posee el draft, y la vista del mapa no es un punto

**Estado:** aceptado
**Fecha:** 2026-09-07
**Feature:** F-025

## Contexto

Con el mapa hay **dos** vías de entrada para las mismas dos columnas, y el criterio 3 exige que
funcionen las dos y en las dos direcciones: marcar en el mapa escribe los campos, y escribir en
los campos mueve el punto. Dos vías sobre un mismo dato es la receta clásica de dos fuentes de
verdad peleándose.

Y hay una trampa que el agente `spec` cazó y que hay que cerrar. El criterio 5 dice que un local
con latitud y longitud nulas «abre el mapa en una vista por defecto y **NO escribe ninguna
coordenada** hasta que alguien marque un punto», y tiene **dos superficies**:

- **La base de datos**: abrir la pantalla y cerrarla deja las dos columnas en `NULL`.
- **El borrador en memoria, antes incluso de guardar**: la vista por defecto **no** puede poblar
  los dos campos con sus coordenadas de centro, ni con `0, 0`.

Un mapa «que se centra en algún sitio» produce ese fallo sin que nadie lo note: el centro de la
vista es un par de números perfectamente válido, y pasarlo al draft es una línea que parece
correcta.

Al mismo tiempo hay que evitar el fallo contrario, el de E-013: si una de las dos direcciones
**nunca escribe de verdad**, el criterio pasa y la función no existe. Si el marcador guarda su
posición en estado interno y solo lee el draft al montar, teclear una coordenada no lo mueve — y
nadie se da cuenta si se prueba con un valor que ya era el del marcador.

Y hay un contexto de datos que hay que tener presente:

- El draft (`ITiendaOnlineDraft`) guarda `latitud` y `longitud` como **`string`**, y eso es
  correcto y está razonado en su docstring: mientras alguien teclea `-23.1`, el valor pasa por `-`
  y por `-23.`, y ninguno es un número todavía.
- `dirty` en la página es `JSON.stringify(draft) !== JSON.stringify(draftFromLocal(selected))`, y
  es lo que decide si aparece la barra de guardado.
- Los cuatro límites de rango están escritos **tres veces**, cada una en un archivo distinto y
  cada una privada: `src/schemas/tiendaOnline.ts:64-67`, `src/schemas/qabStore.ts:18-21` y
  `src/components/tiendaOnline/PublicDataCard.tsx:36-39`.
- El contrato de QAB, en la v12.1, **no declara tipo, ni rango, ni precisión** para `latitude` y
  `longitude`. El `Decimal(9,6)` que circula en las notas es una propuesta de schema del lado de
  cuadrecaja que cuadrecaja no adoptó: nuestras columnas son `Float?`.
- Un clic en un widget de mapa produce típicamente 15-17 cifras significativas.

## Decisión

**El draft de la página es la única fuente de verdad de la coordenada, y el mapa es una proyección
suya. La vista del mapa se expresa en un tipo que no puede convertirse en un punto.**

Cinco piezas, y cada una cierra algo:

### 1. Dos tipos que no se pueden confundir

```
IMapPoint = { lat: number; lon: number }              // algo que alguien eligió
IMapView  = { centerLat: number; centerLon: number; zoom: number }   // donde mira el visor
```

`IMapView` **no es asignable** a `IMapPoint`: le faltan las dos claves. Y `applyMapPointToDraft`,
que es el único escritor de las coordenadas desde el mapa, acepta **solo** `IMapPoint`. Así que
`applyMapPointToDraft(draft, MAP_DEFAULT_VIEW)` **no compila**, y `initialMapView()` devuelve
`IMapView`, no un punto.

Eso es lo que hace el criterio 5 imposible **por construcción y no por disciplina**: no hay que
recordar no pasar el centro al draft; no hay forma de pasarlo. Y `tsc` lo comprueba aunque
`strict` esté desactivado, porque es una incompatibilidad de forma, no un problema de nulabilidad.

### 2. El flujo va en un solo sentido en cada dirección

- **Draft → mapa**: `draftToMapPoint(draft)` es el **único** lector, y el marcador **se dibuja
  desde su resultado en cada render**, sin estado interno de posición. No hay un camino en el que
  esa dirección pueda dejar de funcionar sin que el marcador desaparezca por completo, que es un
  fallo visible en el primer intento (cierra E-013).
- **Mapa → draft**: solo dos gestos escriben, el `click` del mapa y el `dragend` del marcador, y
  los dos pasan por `applyMapPointToDraft`. **No se escucha `moveend`, ni `zoomend`, ni
  `viewreset`** para escribir nada: son la puerta por la que la vista se colaría en el draft.
- **La vista es interna del mapa y nunca sube.** Se lee una sola vez al montar
  (`MapContainer` trata `center`/`zoom` como props de montaje en react-leaflet) y luego solo la
  mueve el re-centrado, que **lee** el mapa y **no escribe** el draft.

### 3. `null` es un estado de primera clase, y el mapa no puede producirlo

El componente del mapa recibe `point: IMapPoint | null` y expone
`onPointPicked: (point: IMapPoint) => void`. **Nunca `null`.** El mapa no tiene canal para borrar
una coordenada ni para inventarla de su propio visor: solo puede reportar un punto que alguien
señaló.

Borrar es del envoltorio, con una acción explícita («quitar el punto»), visible solo cuando hay
punto, que llama a `clearMapPointFromDraft`. Existe porque el estado «sin punto» del criterio 5 no
es solo un estado inicial: si no se puede volver a él, un clic equivocado es permanente.

### 4. Se redondea a seis decimales, en el único punto de escritura

`applyMapPointToDraft` redondea con `MAP_COORDINATE_DECIMALS = 6`. Tres razones, y la segunda es
la que menos se ve:

- Seis decimales son ~11 cm, más fino de lo que necesita cualquier fachada, y evita mandar ruido
  de coma flotante.
- **Hace que la cadena que escribe el mapa sea idéntica a la que `draftFromLocal` reconstruye tras
  guardar.** Las dos son `String(number)`: si el mapa metiera `"23.12345678901234"` y la fila
  volviera como `23.123456789012`, `JSON.stringify` daría distinto y **la barra de guardado se
  quedaría puesta sobre un draft que solo *parece* diferente del guardado**. Con el redondeo, el
  ida y vuelta cierra.
- Alinea las dos vías de entrada: un valor tecleado a mano y uno marcado en el mapa producen la
  misma representación textual del mismo punto.

**No es un requisito del contrato de QAB**, y conviene decirlo para que nadie lo cite como tal: la
v12.1 no declara precisión alguna para esos dos campos. Es nuestra decisión, por nuestras razones.

Y una cualificación, porque el redondeo tiene un borde: `Number(v.toFixed(6))` no puede producir
una magnitud distinta de cero por debajo de 1e-6, y JavaScript solo pasa `String` a notación
exponencial por debajo de 1e-6. Por eso, para cualquier valor de `[-180, 180]`, el texto que entra
en el draft es decimal plano. No es un absoluto: es una enumeración cerrada, y el test la fija.

### 5. Los cuatro rangos tienen una sola definición

Pasan a `src/constants/map.ts` y los tres archivos que tenían su copia privada los importan de
ahí. Sin eso, el `mapPointSchema` nuevo sería la **cuarta** copia de los mismos literales, y una
corrección en uno dejaría a los otros tres atrás (E-039).

`draftToMapPoint` usa esos mismos rangos: un valor fuera de rango tecleado a mano no dibuja
marcador, que es la respuesta honesta, porque `tiendaOnlineLocalUpdateSchema` lo rechazaría con un
400 al guardar de todas formas.

### 6. Lo que NO se ata: el rango de `qabStorePayloadSchema`

`qabStorePayloadSchema.latitude` y `.longitude` (`src/schemas/qabStore.ts:88-89`) son
`z.number().nullable()` sin rango, mientras que `tiendaOnlineSchema`, en el mismo archivo, sí lo
repite. El `security-guardian` lo señaló como asimetría de baja severidad y pidió que se decidiera
en vez de dejarlo abierto. **Se decide: no se ata en F-025.**

El rango ya se aplica en el único punto de entrada alcanzable —el `safeParse` del body del `PATCH`,
antes de cualquier escritura y antes de cualquier emisión—, así que añadirlo en el schema del
**payload** no impide ningún valor que hoy pueda llegar. Lo que sí haría es esto: si en la base de
datos ya hay una fila con una coordenada fuera de rango, metida por un script o por una migración,
hoy se emite y el guardado funciona; con el rango puesto, ese `.parse()` **lanza** un `ZodError`
que ninguna rama nombrada recoge y el guardado se convierte en un 500. Es decir, la guarda
convertiría en un fallo algo que hoy funciona, sin prevenir ningún ataque ni ningún defecto
alcanzable.

Y sería una rama que **nadie puede ejercitar**: exactamente la forma que E-013 documenta, con el
signo cambiado, y la guarda más ancha que la del contrato que E-032 pide no escribir.

Lo que sí se arregla, con coste cero, es la causa de fondo de la asimetría: los rangos pasan a
tener **una** definición, así que las copias no pueden divergir. Si algún día se abre una segunda
vía de escritura de esas columnas, el arreglo correcto es una rama de error nombrada en el camino
de emisión —como la que ya tiene `horarios`— y eso es su propio feature.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| El mapa guarda su propio estado de posición y lo sincroniza con el draft | Dos fuentes de verdad. Y es exactamente el camino por el que la dirección campo → mapa del criterio 3 «existe» en el código pero no funciona: el marcador lee el draft al montar y nunca más (E-013) |
| Expresar la vista por defecto como un `IMapPoint` y confiar en no pasarla al draft | Es la trampa del criterio 5 tal cual. Un `{ lat, lon }` de centro es asignable a donde va un punto elegido, así que el error se comete con una línea que parece correcta y nada lo detecta. La separación de tipos cuesta tres claves distintas |
| Que el mapa exponga `onPointChange(point \| null)` | Le da al mapa un canal para borrar la coordenada. No lo necesita —borrar es un gesto del formulario, no del mapa— y cada canal que se le da es una vía más por la que la vista podría acabar en el draft |
| Escuchar `moveend` para «recordar dónde se quedó mirando» | Es literalmente el evento que incumple el criterio 5. Y no hace falta: la vista no se persiste |
| Que el mapa reciba el draft entero y llame a `onFieldChange` dos veces | Dos estados intermedios: `hasLonelyCoordinate` parpadea y `dirty` ve un draft con media coordenada. Un solo `setDraft` con las dos coordenadas a la vez lo evita |
| Poner `draftToMapPoint` dentro del módulo del mapa, junto a lo que la usa | Importarla desde la tarjeta arrastraría Leaflet al bundle de la pantalla y el criterio 7 caería sin que nadie escribiera nada raro (ver ADR 0099) |
| No redondear, y mandar los 15-17 dígitos del clic | La cadena del mapa y la que vuelve de la fila no coincidirían, así que la barra de guardado se quedaría puesta tras guardar. Y las dos vías de entrada producirían textos distintos del mismo punto |
| Redondear en `draftToUpdate`, en la salida | Entonces lo que se guarda no es lo que el encargado vio en el campo. El redondeo va donde nace el valor, no donde se envía |
| Añadir el rango a `qabStorePayloadSchema` por defensa en profundidad | Crea una rama inalcanzable que nadie puede probar y cuyo único efecto posible hoy es convertir el guardado de una fila ya fuera de rango en un 500 sin rama nombrada (E-013 al revés, E-032) |
| Dejar los cuatro rangos donde están y añadir una cuarta copia en `src/schemas/map.ts` | Cuatro definiciones del mismo literal: una corrección dejaría tres atrás (E-039) |

## Consecuencias

**A favor:**

- El criterio 5 lo comprueba el compilador, no la disciplina de quien escriba el componente.
- El criterio 3 no puede «existir a medias»: la dirección campo → mapa es el mismo código que
  dibuja el marcador, así que si falla, no hay marcador — y eso se ve en el primer intento.
- El draft sigue siendo el único dueño del formulario. `persist`, `dirty`, `draftToUpdate`,
  `setField` y el diálogo de cambios sin guardar **no se tocan**, así que el mapa no puede romper
  ninguno de los siete criterios de F-005 que ya pasaron.
- Cuatro funciones puras, en `.ts` plano, cubren toda la lógica de coordenadas: la suite puede
  fijar el ida y vuelta, los cuatro límites y el redondeo **sin navegador**.
- Los rangos pasan de tres copias a una.
- El estado «sin punto» es alcanzable en las dos direcciones, no solo al principio.

**En contra / coste asumido:**

- **`PublicDataCard` gana una prop** (`onPointChange`) y la página un manejador. Es la mínima
  ampliación posible de una interfaz que ya existía, pero es una ampliación.
- **Dos tipos donde parecería que basta uno.** Un lector que no haya leído este ADR verá `IMapView`
  como duplicación de `IMapPoint`. Está documentado en el docstring de los dos, y hay un test que
  falla si alguien los unifica.
- El marcador **desaparece** mientras el campo contiene solo un signo (`-`), porque en ese momento
  el draft no describe un punto. Es coherente y honesto, pero es un parpadeo. Solo ocurre con el
  signo suelto: `Number("-23.")` ya es `-23`.
- Un valor **fuera de rango** tecleado a mano no dibuja marcador. Es lo correcto —se rechazaría al
  guardar— pero el `qa` tiene que saberlo para no leerlo como un fallo de la dirección
  campo → mapa.
- La asimetría de `qabStorePayloadSchema` **queda abierta a propósito**, con este ADR como
  respuesta a por qué. Si alguien abre una segunda vía de escritura de esas dos columnas, hay que
  volver aquí.
- El redondeo a seis decimales es una decisión nuestra sin respaldo en el contrato de QAB: si algún
  día el contrato declara una precisión distinta, esta constante es el sitio donde se cambia.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant: intacto y sin código nuevo.** El mapa alimenta el mismo draft que ya
  viajaba, por el mismo `PATCH`, y `saveTiendaOnlineLocal` sigue filtrando por el `negocioId` de la
  sesión en la lectura y en la escritura. **El widget no conoce ningún identificador de tenant.**
- **Validación en backend: se hereda, no se duplica.** Al alimentar el draft existente en vez de un
  estado paralelo, el punto pasa por `tiendaOnlineLocalUpdateSchema` como cualquier valor tecleado.
  `draftToMapPoint` valida el rango **también** en el cliente, pero solo para decidir si dibuja el
  marcador: no es la guarda, es la proyección.
- **Escalabilidad: ninguna consulta nueva.** Cuatro funciones puras sobre un objeto de trece
  campos, en el hilo del navegador.
- **Coste de reversión: bajo.** Quitar el mapa es borrar dos componentes y una prop; las cuatro
  funciones puras quedarían sin uso y se borran con ellas. Los dos campos numéricos, que son la vía
  primaria, no se han tocado en ningún momento.
