# tarjeta-movimiento-unificada: diseño de «una sola tarjeta de movimiento de stock»

> Escrito por el agente `ui-designer`. **Mobile-first: primero 320 px.**
> Sin código, sin `sx`, sin JSX: quien implemente ejecuta este contrato.
> **Todo color que este contrato especifica se nombra con su ruta `semantic.*`, y ningún
> `#RRGGBB` puede acabar en `src/`.** Los valores literales que aparecen más abajo están en dos
> sitios y solo en esos dos: en la tabla de contraste, donde el número medido no se entiende sin
> el valor que se midió, y en los criterios verificables, donde el navegador solo devuelve
> `rgb(...)`. Ninguno de los dos es una especificación de color.
>
> **Ajuste transversal.** No tiene entrada en `.agents/features.json` y por eso no lleva `F-###`:
> nace de un encargo directo del humano — unificar la tarjeta de movimiento de stock de las dos
> vistas que hoy la pintan distinta, y que el modal de inventario deje de perder información en
> móvil. Se usa la plantilla `.agents/designs/TEMPLATE.md` igualmente.

---

## Fuentes

- **No hay spec `F-###`.** El encargo llega del humano en la conversación, con tres exigencias
  literales: *mismo patrón y mismo componente en las dos vistas*, *coherencia total*, y *que en el
  modal de inventario en móvil deje de perderse información*. Todo lo que este contrato decide y
  que no sale de esas tres frases está marcado como decisión propia o como pregunta abierta.
- **Segunda ronda del humano**, sobre las preguntas abiertas de la primera versión de este
  contrato: *«cerrar las incoherencias de diseño»*. Dice sí a las dos primeras — la tinta de la
  cantidad de la tabla de escritorio de `/movimientos` pasa a `semantic.flow`, y su columna
  «Usuario» deja de ocultarse. Las dos quedan escritas abajo como especificación, marcadas
  **Decisión del humano**, y ya no como preguntas. La tercera incoherencia (esa tabla tampoco
  mostraba la existencia) la decide este contrato: ver «La cantidad y su existencia».
- `src/components/GestionInventario/movimientos/MovimientosView.tsx` entero:
  - línea 135-136 — `isMobile = down("sm")` y `isTablet = down("md")`, los dos umbrales vigentes
    en esa pantalla;
  - líneas 516-533 — `getMovimientoChip`, el chip de tipo correcto (etiqueta de
    `TIPO_MOVIMIENTO_LABELS`, tintas de `semantic.flow`), hoy encerrado dentro del componente;
  - líneas 855-941 — la tarjeta móvil vigente, que es la base de este diseño;
  - líneas 942-1007 — la tabla de escritorio, que **no se toca**.
- `src/app/inventario/components/ProductMovementsModal.tsx` entero:
  - línea 74 — `isMobile = down("md")`, el umbral divergente;
  - líneas 138-144 — `getRowColor`, los dos hex crudos;
  - líneas 151-162 — `calcularExistenciaDespues`, **duplicado privado** de una función que ya vive
    en `src/utils/tipoMovimiento.ts`;
  - líneas 332-341 — `CircularProgress` y el `Alert severity="info"` que hace de vacío;
  - líneas 353-444 — la tabla, sus dos columnas ocultas y los ternarios de densidad.
- `src/schemas/movimiento.ts` — `movimientoSchema` y `IMovimiento`. **`cantidad` es siempre
  positiva** (la dirección la da el tipo) y `existenciaAnterior` es opcional.
- `src/app/api/movimiento/route.ts:144-162` — lo que el endpoint incluye de verdad: `proveedor`
  **a nivel de movimiento**, `productoTienda.producto.nombre`, `productoTienda.proveedor` y
  `usuario.nombre`. El `proveedor` de primer nivel es el que pinta hoy la tarjeta y **no está
  declarado en `movimientoSchema`**: ver «Piezas nuevas».
- `src/utils/tipoMovimiento.ts` — `isMovimientoBaja` y `getStockAfterMovement`, con su docstring:
  *«Returns null when the count before is unknown, so the caller prints its fallback instead of a
  number it made up»*. Ese docstring es la definición de la existencia posterior; este contrato no
  la parafrasea (E-039).
- `src/constants/movimientos.ts` — `TIPO_MOVIMIENTO_LABELS` (14 tipos, incluidos los dos de pedido
  online) y `TIPO_MOVIMIENTO_FLOW`, el mapa tipo → rol de `flow`.
- `src/utils/formatters.ts` — `formatQuantity` (2 decimales, sin ceros de relleno, pensado para
  Floats con ruido: en producción hay existencias como `8.69999999999999`), `formatDateTime` y
  `formatMovimientoMotivo`.
- `src/theme/tokens.ts` y `src/theme/index.ts` **enteros, con sus comentarios**. De ahí sale la
  decisión de tinta de la cantidad: *«DESAGREGACION_ALTA y DESAGREGACION_BAJA son las dos mitades
  de una misma operación… pintar una verde y la otra roja se lee como un éxito y un fracaso cuando
  nada tuvo éxito ni falló»*. También `touch.min = 44`, `shape.radius.md`, `productNameSx` y el
  comentario de `MuiTableContainer` que autoriza a un diálogo a fijar su propia caja de scroll.
- `src/components/StatusPill.tsx`, `src/components/EmptyState.tsx`, `src/components/LoadingState.tsx`,
  `src/components/ContentCard.tsx` — sus props reales.
- `src/components/GestionInventario/table/InventarioMobileList.tsx` — el estándar vigente de
  tarjeta móvil de este repo (Card `variant="outlined"`, `CardContent` compacto, `StatusPill`,
  `LoadingState variant="cards"`, `EmptyState`).
- `AGENTS.md`, `.agents/designs/TEMPLATE.md` y `.agents/designs/estado-sin-conexion.md` (formato de
  un ajuste transversal sin `F-###`).
- `.agents/COMMON_ERRORS.md` — índice, y en particular **E-010** (nada de bloques de código en un
  contrato: **por eso aquí no hay ninguno**), **E-005** (los tres anchos se miden con un viewport
  real), **E-011** (medir el elemento que *es* lo que se busca), **E-016** (una subcadena exigida
  puede existir ya en otro copy de la misma ruta) y **E-039** (no parafrasear una definición que ya
  existe en el código).

**Este ajuste no declara `requires_docs`** y no depende de documentación externa.

---

## Lo que este contrato NO diseña

- **Los filtros** de ninguna de las dos vistas: ni el panel colapsable de `/movimientos`, ni el
  bloque de fechas/tipo del modal, ni el chip de «N registros», ni el botón «Limpiar».
- **La paginación** de `/movimientos`.
- **La forma de la tabla de escritorio de `/movimientos`** (líneas 942-1007): su lista de
  columnas, su orden, su densidad y su alineación no cambian. Lo que sí cambia ahí, y está
  especificado abajo en «La tabla de escritorio de `/movimientos`», es el contenido de tres
  celdas: la tinta de la cantidad, la existencia bajo esa misma cantidad, y la columna «Usuario»,
  que deja de ocultarse. **No se añade ninguna columna nueva.**
- **La cabecera y el marco del modal**: título, botón de cerrar, `maxWidth`, `PaperProps`. Se
  conservan. Convertirlo a `AppDialog` sería lo correcto a futuro y queda en «Preguntas abiertas»,
  fuera de este encargo.
- **Cuántos movimientos se traen**: el modal pide `take = 1000` de una sola vez. No se toca; queda
  anotado en «Preguntas abiertas».
- **La virtualización** de las listas de tarjetas. Ver «Decisiones que conviene mirar».

---

## Pantallas afectadas

| Pantalla | Ruta | Nueva o existente |
|---|---|---|
| Movimientos de stock (pestaña Movimientos) | `/movimientos` | cambia — solo la rama móvil |
| Modal «Movimientos de: `<producto>`» | se abre desde `/inventario` | cambia — rama móvil nueva + limpieza de la tabla |

---

## La tarjeta: una sola pieza, dos variantes

Es el centro del encargo, así que se especifica una vez y las dos pantallas la consumen tal cual.

### Qué resuelve

Quien abre cualquiera de las dos listas está reconstruyendo una historia: *qué le pasó a esta
existencia, cuándo, por qué y quién lo hizo*. Hoy ninguna de las dos tarjetas cuenta la historia
entera: a la de `/movimientos` le falta el efecto sobre la existencia, y el modal directamente no
tiene tarjeta — comprime una tabla y tira dos columnas por el camino. La tarjeta unificada muestra
**siempre los siete datos** y no depende de a qué pantalla pertenece.

### Anatomía a 320 px

El ancho contado: viewport 320 − 12 de padding del contenedor a cada lado = **296 px de tarjeta**;
menos 1 px de borde a cada lado y 14 px de `CardContent` a cada lado = **266 px de contenido**.

De arriba abajo:

**1. Fila de cabeza** — dos columnas, `alignItems: flex-start`, separación 12 px.

| Columna | Contenido | Especificación |
|---|---|---|
| Izquierda (flexible, `minWidth: 0`) | Nombre del producto | 1 rem, peso 700, `lineHeight` 1.35, color `semantic.text.primary`. **Envuelve, nunca se recorta**: aplica `productNameSx` (la mitad del catálogo se distingue por el formato final del nombre, y una elipsis se come justo eso). Se omite entero en la variante «producto fijo». |
| Izquierda | Proveedor, si el movimiento trae uno | `caption`, `semantic.text.secondary`, **línea propia** bajo el nombre, `mt` 2 px. |
| Izquierda | Chip de tipo | `MovimientoTipoChip`, `mt` 6 px. |
| Derecha (`flexShrink: 0`, alineada a la derecha) | Cantidad con signo | 1.375 rem, peso 700, `letterSpacing` −0.02em. Tinta: ver «Tokens por estado». Texto: `-` o `+` según `isMovimientoBaja(tipo)`, seguido de `formatQuantity(Math.abs(cantidad))`. |
| Derecha | Existencia antes → después | `caption`, `semantic.text.secondary`, `mt` 2 px, alineada a la derecha. Ver «La cantidad y su existencia». |

El nombre y el proveedor **nunca se concatenan** en una sola cadena. Hoy la tarjeta de
`/movimientos` los pega con « - »; eso impide la variante del modal (donde el nombre sobra y el
proveedor no) y convierte dos datos en uno solo que no se puede ocultar por separado.

**2. Motivo** — solo si `formatMovimientoMotivo(motivo)` devuelve algo no vacío. `body2`,
`semantic.text.secondary`, `mt` 10 px. Sin etiqueta «Motivo:» delante: el texto ya se explica solo,
y así se decidió cuando se rediseñó esta tarjeta.

**3. Pie** — `mt` 12 px, `pt` 10 px, borde superior de 1 px en `semantic.surface.border`. Una fila:
fecha (`formatDateTime(fecha)`) pegada a la izquierda y autor pegado a la derecha, las dos en
`caption` y `semantic.text.secondary`. El autor es `usuario?.nombre` **o «Sistema»** cuando viene
vacío: hoy la tabla del modal ya lo resuelve así y la tarjeta de `/movimientos` simplemente no lo
pinta, que es peor — un movimiento sin autor visible parece un movimiento sin autor.

La tarjeta **no es pulsable** en ninguna de las dos vistas y no lleva menú de acciones. No hay
ninguna acción por movimiento en el alcance de este encargo.

### La cantidad y su existencia: una sola pieza en las tres superficies

Es el dato nuevo en `/movimientos`, el que había que salvar en el modal, y **el que faltaba en la
tabla de escritorio de `/movimientos`** — a 1440 px el dato desaparecía justo en la pantalla que
más sitio tiene.

**Decisión: la existencia no es una columna; va debajo de la cantidad, dentro de su misma celda,
en las dos tablas, exactamente como ya va debajo de la cantidad en la tarjeta.** Tres razones, en
orden de peso:

1. **El «antes → después» es la aritmética del número que tiene encima.** `12 → 7` no significa
   nada separado del `-5` que lo produjo; a media tabla de distancia, el lector tiene que volver
   a emparejarlos con el dedo. En la tarjeta ya se decidió que van juntos, y una tabla que los
   separa es otra vez la misma incoherencia que este encargo viene a cerrar, girada 90 grados.
2. **Cierra la incoherencia sin abrir otra.** Una séptima columna existiría en `/movimientos` y
   no en el modal (que tiene seis, y ninguna de producto), así que las dos tablas volverían a
   tener el dato en sitios distintos. Con la celda apilada, las tres superficies dicen lo mismo
   en la misma forma, y **el modal pierde una columna**: su «Anterior → Posterior» desaparece
   como columna y se apila bajo «Cantidad», que es precisamente la banda de 600-900 px donde sus
   seis columnas iban más justas.
3. **Es lo único que cabe sin quitarle sitio a nadie.** Medido, no estimado: `PageContainer` usa
   `Container maxWidth="xl"` (tope 1536, que a 1440 no recorta) con `px: 3`, y el `ContentCard`
   va con `noPadding`, así que la tabla dispone de ~1392 px a 1440 y de ~720 px a 768. A 1440
   sobra sitio para una séptima columna; **a 768 no**: seis columnas ya gastan 192 px solo en el
   padding de celda de MUI, el chip de tipo no encoge («Consignación - Devolución» es la etiqueta
   más larga y `MuiChip` no parte su etiqueta), y lo que queda para «Producto» y «Motivo» —las
   dos columnas que envuelven— es lo primero que se estrangula. Apilar no gasta ancho: gasta una
   línea de alto en la columna más estrecha de la tabla.

Ninguna columna cede espacio, porque no hay columna nueva. La única columna que se ensancha es
«Cantidad», lo justo para que quepa el par en `caption` (del orden de un par de docenas de píxeles
más); si el navegador no se lo puede dar, **quien se desplaza en horizontal es la caja de la
tabla, nunca la página** — es lo que ya hace `TableContainer`.

**Cómo se dibuja el par, en las tres superficies:**

| Superficie | Cantidad | Existencia |
|---|---|---|
| Tarjeta (320 px) | 1.375 rem, peso 700, alineada a la derecha | `caption`, debajo, alineada a la derecha |
| Celda «Cantidad» de las dos tablas | `body2`, peso 700, centrada (como hoy) | `caption`, debajo, centrada |

En las dos, la tinta de la cantidad sale de `semantic.flow` y la de la existencia es
`semantic.text.secondary`. Para que las tres superficies no puedan divergir a la primera edición,
el par lo dibuja **una sola pieza compartida** con dos tamaños (ver «Piezas nuevas»).

**Las reglas del dato, comunes a las tres superficies:**

- Antes: `existenciaAnterior`. Después: `getStockAfterMovement(existenciaAnterior, cantidad, tipo)`
  — **la función que ya existe en `src/utils/tipoMovimiento.ts`**, con su test en
  `src/__tests__/stockAfterMovement.test.ts`. No se reimplementa ni se parafrasea su regla.
- Los dos números se pintan con `formatQuantity`. Sin eso salen las colas de coma flotante que hoy
  imprime el modal.
- Separador: el glifo `→` con un espacio a cada lado.
- **Fallback cuando `existenciaAnterior` es nulo** (los movimientos históricos, escritos antes de
  que existiera la columna): **la línea no se dibuja, en ninguna de las tres superficies**. Ni
  «0», ni «— → 7», ni «-». Es la única presentación que no afirma nada falso: un guion en el sitio
  donde debería haber un número se lee como «no se movió», y un cero se lee como «no había nada».
  La ausencia de la línea es la señal.
  Con el par apilado, en la tabla **tampoco hace falta la raya larga** que la primera versión de
  este contrato dictaba para la columna suelta del modal: aquella raya existía para que una celda
  no quedara vacía, y ahora esa celda nunca está vacía — siempre tiene su cantidad encima.
- **Nombre accesible**: en las tres superficies, ese elemento lleva un `aria-label` que dice, en
  texto, la existencia antes y la existencia después (por ejemplo: «Existencia: 12 antes, 7
  después»). La flecha sola no se lee bien en voz alta, y así el dato no depende de un glifo. En
  la tabla es además lo que sustituye a la cabecera de columna que este diseño no crea.

### Las dos variantes

Una sola pieza con una prop, no dos componentes.

| Variante | Dónde | Qué cambia |
|---|---|---|
| **Producto visible** (por defecto) | `/movimientos` | Nombre del producto arriba, proveedor debajo, chip debajo. |
| **Producto fijo** | Modal «Movimientos de: `<producto>`» | **Se omite el nombre del producto**, porque el título del diálogo ya lo dice a dos centímetros de distancia y repetirlo en cada una de las tarjetas empuja hacia abajo el único dato que cambia entre filas. **El proveedor sí se conserva**: en un producto de consignación el proveedor varía de un movimiento a otro, así que ahí no es redundante. Sin el nombre, la columna izquierda arranca por el proveedor (si lo hay) y el chip, y la fila de cabeza se alinea a `center` en vez de a `flex-start`, para que el chip quede a la altura de la cantidad. |

---

## `/movimientos`

### Layout

**320 px** — `PageContainer` con su título y sus pestañas, `PendingReceptionBanner`, `StatStrip`
(rejilla 2×2), la barra de búsqueda y el panel de filtros colapsable, todo como hoy. Debajo,
dentro del `ContentCard`, **la lista de tarjetas**: contenedor con 12 px de padding y las tarjetas
separadas 10 px entre sí. Al final, la paginación. Nada de esto cambia salvo el interior de la
tarjeta, que pasa a ser la pieza compartida y gana la línea de existencia y el autor con fallback.

**768 px** — a partir de 600 px se renderiza la tabla de escritorio, con la misma forma de hoy y
**seis columnas siempre**: Fecha · Tipo · Producto · Motivo · Cantidad · Usuario. Cambian tres
celdas (ver abajo). Es el ancho más apretado de esta pantalla: ~720 px de tabla, de los que 192
se van en el padding de celda de MUI y unos 165 se los queda el chip de tipo, que no encoge. Si en
esa banda no cabe todo, **quien se desplaza en horizontal es la caja de la tabla, nunca la
página**.

**1440 px** — la misma tabla con ~1392 px de ancho disponible; nada va justo.

### Umbral responsive

`useMediaQuery(theme.breakpoints.down("sm"))`. Es el que ya usa esta pantalla; no cambia.

**Desaparece el segundo flag, `isTablet` (`down("md")`).** Era el que ocultaba «Usuario» por
debajo de 900 px, y ya no oculta nada: ver la tabla siguiente.

### La tabla de escritorio de `/movimientos`, en concreto

No cambia su lista de columnas, ni su orden, ni su densidad. Cambia el contenido de tres celdas.

| Hoy | Queda | Origen de la decisión |
|---|---|---|
| Cantidad en `error.main` / `success.main` | Tinta de `semantic.flow` del tipo, la misma que su chip y la misma que la tarjeta | **Decisión del humano**, segunda ronda: cerrar la incoherencia con la tarjeta y con la tabla del modal. |
| La existencia no se muestra | El par «antes → después» **bajo la cantidad, en su misma celda**, centrado, en `caption` y `semantic.text.secondary`; sin línea cuando `existenciaAnterior` es nulo | Decisión de este contrato — ver «La cantidad y su existencia». Es el dato que el humano pidió desde el primer mensaje y el único sitio donde seguía faltando. |
| Columna «Usuario» oculta por debajo de 900 px | **Siempre visible**, con su fallback «Sistema», que esa celda ya aplica | **Decisión del humano**, segunda ronda: es la misma pérdida de información que este encargo elimina en el modal. |
| El chip lo fabrica `getMovimientoChip`, declarado dentro del componente | `MovimientoTipoChip`, la pieza compartida. **Su salida visual es idéntica a la de hoy**: misma etiqueta, mismo lavado, misma tinta, mismo tamaño | Consecuencia de extraer el chip para que el modal pueda usarlo. |

La celda de cantidad y la celda de cantidad del modal dibujan **la misma pieza compartida**, en su
tamaño de tabla.

---

## Modal «Movimientos de: `<producto>`»

### Qué resuelve

Es la misma historia que `/movimientos`, filtrada a un producto. Hoy en el teléfono cuenta menos
que la lista general: comprime la tabla, tira «Observaciones» y «Usuario», y pinta cada fila de
verde o rojo entero.

### Layout

**320 px** — diálogo a pantalla completa. Título («Movimientos de: `<nombre>`») y botón de cerrar;
la cabecera de filtros colapsada, como hoy. Debajo, **la lista de tarjetas en variante «producto
fijo»**, con el mismo ritmo que en `/movimientos`: 12 px de padding, 10 px entre tarjetas. La
lista **no lleva caja de scroll propia**: quien desplaza es el `DialogContent`. Hoy el contenedor
de la tabla se fija a `calc(100vh - 280px)` en móvil, lo que mete un scroll dentro de otro y ata
la vista a `100vh`, que en un navegador móvil no es lo que se ve.

**768 px** — el diálogo sigue a pantalla completa (ver «Umbral responsive») y se renderiza la
tabla, **con cinco columnas**: Fecha · Tipo · Cantidad · Observaciones · Usuario. Ya no se oculta
ninguna, y la que había de «Anterior → Posterior» desaparece **como columna**: su dato se apila
bajo «Cantidad», igual que en la tarjeta y que en la tabla de `/movimientos`. Son dos columnas
menos de presión en la banda donde esta tabla iba más justa. «Observaciones» es la columna
flexible y su texto envuelve; si en algún ancho no cabe, quien hace scroll horizontal es la caja
de la tabla, nunca la página. La caja mantiene su `maxHeight` de 500 px (un diálogo puede fijar la
suya: lo dice el comentario de `MuiTableContainer` en el theme).

**1440 px** — diálogo en ventana `maxWidth="lg"`, la misma tabla de cinco columnas, sin tinte de
fila.

### Umbral responsive

**Dos flags con nombre, y cada uno con su razón por escrito.**

| Flag | Consulta | Qué decide | Por qué |
|---|---|---|---|
| `isMobile` | `theme.breakpoints.down("sm")` | Tarjetas o tabla; colapso inicial de los filtros; los paddings del contenido | **Es el cambio de umbral que pide el encargo.** Hoy vale `down("md")` y por eso una tablet de 700 px recibe la versión pobre de la pantalla mientras `/movimientos`, a ese mismo ancho, muestra la tabla completa. Con `sm`, las dos vistas se bifurcan en el mismo punto y «móvil» quiere decir lo mismo en los dos archivos. |
| `isFullScreen` | `theme.breakpoints.down("md")` | Solo el marco del `Dialog`: `fullScreen`, `maxWidth` y los márgenes del `Paper` | Se conserva el comportamiento de hoy, y ahora además está justificado: entre 600 y 900 px es donde esta tabla va más justa —incluso con una columna menos que hoy—, y renunciar a los márgenes del diálogo es exactamente lo que le devuelve ancho. Un umbral distinto **para el marco** no es la incoherencia que había que arreglar; la que había que arreglar es la del contenido. |

Nada más en ese archivo puede depender de un `useMediaQuery`: los ternarios de densidad
(`size="small"`, `fontSize`, `padding: 8px`, `variant`) desaparecen con la bifurcación. Cambiar
tamaños no es diseñar para móvil.

### La tabla del modal, en concreto

| Hoy | Queda |
|---|---|
| `getRowColor` pinta cada fila con uno de dos hex crudos | **Las filas no se tiñen.** Ni con hex ni con tokens. Un lavado a todo lo ancho en todas las filas convierte la tabla en un muro de alertas, y volvería a decir «éxito» y «fracaso» sobre las dos mitades de una desagregación. El significado lo llevan el chip y la tinta de la cantidad. Se borra la función. |
| Chip con `color="error" \| "success"` y `variant="outlined"` | `MovimientoTipoChip`, el mismo que `/movimientos`. El anillo duro de `outlined` es justo lo que `StatusPill` documenta como error. |
| Cantidad en `error.main` / `success.main` | Tinta de `semantic.flow` del tipo (ver «Tokens por estado»), con la existencia apilada debajo: la misma pieza compartida que dibuja la celda de `/movimientos` y la tarjeta. |
| Columna propia `Anterior → Posterior`, con los Floats crudos | **La columna desaparece.** El par se apila bajo «Cantidad», con los dos números por `formatQuantity`, y no se dibuja cuando no hay existencia anterior. |
| Columnas «Observaciones» y «Usuario» ocultas por debajo de 900 px | Siempre visibles. El motivo pasa por `formatMovimientoMotivo` (hoy imprime el UUID entero) y el autor cae en «Sistema». |
| `CircularProgress` centrado | `LoadingState`: `variant="cards"` con 4 tarjetas por debajo de 600 px, `variant="table"` con **5** columnas y 6 filas a partir de ahí — el esqueleto se cuenta contra las columnas reales, o vuelve a ser un spinner con otra forma. |
| `Alert severity="info"` para los dos vacíos | `EmptyState`, y **son dos vacíos distintos** (ver «Estados»). |

---

## Shell y componentes reutilizados

| Pieza | Se usa para |
|---|---|
| `PageContainer` | El marco de `/movimientos`. Sin cambios. |
| `ContentCard` | El bloque que contiene la lista/tabla en `/movimientos`. Sin cambios. |
| `StatStrip` | Las cifras de cabecera de `/movimientos`. Sin cambios. |
| `EmptyState` | Los dos vacíos del modal, y los dos que `/movimientos` ya tiene. |
| `LoadingState` | La carga del modal, en las dos formas. |
| `Card` / `CardContent` (`variant="outlined"`) | El contenedor de la tarjeta, igual que `InventarioMobileList`. El radio sale del theme (`shape.radius.md`), no se especifica en la tarjeta. |
| `formatQuantity`, `formatDateTime`, `formatMovimientoMotivo` | Todo lo que la tarjeta imprime. |
| `isMovimientoBaja`, `getStockAfterMovement` | El signo y la existencia posterior. |
| `TIPO_MOVIMIENTO_LABELS`, `TIPO_MOVIMIENTO_FLOW` | La etiqueta y el rol del chip. |
| `productNameSx` | El nombre del producto en la tarjeta. |

**No se usan:** `StatusPill` (su prop es una de las seis tintas, y aquí lo que se tiene es un rol
de `flow`, que es un nivel por encima), `ActionSheet` (la tarjeta no tiene acciones) ni
`CircularProgress` (prohibido).

---

## Piezas nuevas

| Pieza | Qué es | Por qué no basta lo que hay |
|---|---|---|
| `src/components/movimientos/MovimientoCard.tsx` | La tarjeta especificada arriba. Props: el movimiento (`IMovimiento`) y un booleano de variante para el producto fijo, que por defecto muestra el nombre. | Hoy la tarjeta existe **incrustada** en 86 líneas de `MovimientosView.tsx` y el modal no tiene ninguna. El encargo es literalmente que sea el mismo componente. Va en `src/components/movimientos/` y no bajo `GestionInventario/`, porque uno de los dos consumidores vive en `src/app/inventario/` y colgarla de la carpeta de la otra pantalla ata dos features por la ruta del import. |
| `src/components/movimientos/MovimientosMobileList.tsx` | La pila de tarjetas: `Stack` con 10 px de separación y 12 px de padding horizontal. Props: la lista y la variante. No decide carga ni vacío — esos los pone cada pantalla, con su copy. | Es donde vive el ritmo vertical compartido. Si cada pantalla monta su propio `Stack`, la separación entre tarjetas vuelve a divergir a la primera edición, que es exactamente el problema que este encargo viene a cerrar. |
| `src/components/movimientos/MovimientoCantidad.tsx` | El par cantidad + existencia. Props: el movimiento y un tamaño (`"card"` → 1.375 rem alineado a la derecha; `"table"` → `body2` centrado). Pinta el signo, `formatQuantity`, la tinta de `semantic.flow` del tipo, y debajo el «antes → después» con su `aria-label`, o nada si no hay existencia anterior. | Es el mismo dato en **tres** superficies: la tarjeta, la celda de `/movimientos` y la celda del modal. Sin una pieza única, la regla del fallback nulo y la tinta del rol quedan escritas tres veces y divergen a la primera edición — que es exactamente la historia que este encargo viene a cerrar. Es también lo que hace que la decisión del humano sobre la tinta de la tabla de escritorio se implemente cambiando el contenido de una celda, no repitiendo una condición. |
| `src/components/movimientos/MovimientoTipoChip.tsx` | El chip de tipo: etiqueta de `TIPO_MOVIMIENTO_LABELS`, fondo `semantic.flow.<rol>.surface`, tinta `semantic.flow.<rol>.main`, `size="small"`, peso 500. Resuelve los tokens **por ruta de string dentro de `sx`**, sin `useTheme()`. | Hoy es `getMovimientoChip`, una función declarada dentro de `MovimientosView` y por tanto inalcanzable desde el modal, que se ha construido el suyo con `color="error"/"success"`. Su salida visual debe ser **idéntica** a la de hoy en `/movimientos`: de esa tabla cambian tres celdas, y el chip no es ninguna de ellas. |
| Campo `proveedor` en `movimientoSchema` (`src/schemas/movimiento.ts`) | Añadir `proveedor` opcional, con `proveedorSchema`, al **primer nivel** del schema. | La API ya lo devuelve ahí (`src/app/api/movimiento/route.ts:145`) y la tarjeta de `/movimientos` ya lo pinta, pero el schema solo declara `productoTienda.proveedor`. En `MovimientosView` eso no da error porque su estado es un `useState([])` sin tipo; en el modal la lista **sí** es `IMovimiento[]`, así que en cuanto la tarjeta tipada reciba ese objeto, `tsc` la para. Es el único cambio fuera de la capa de vista. |

**Ningún token nuevo, ningún rol nuevo, ninguna función pura nueva.** `getStockAfterMovement` ya
existe y ya tiene test; lo que hay que borrar es su duplicado privado dentro del modal.

---

## Tokens por estado

| Elemento o estado | Token |
|---|---|
| Fondo de la tarjeta | `semantic.surface.raised` (lo pone `MuiCard`) |
| Borde de la tarjeta y línea del pie | `semantic.surface.border` |
| Nombre del producto | `semantic.text.primary` |
| Proveedor, motivo, fecha, autor, línea de existencia | `semantic.text.secondary` |
| Chip de tipo, fondo | `semantic.flow.<rol>.surface` |
| Chip de tipo, tinta | `semantic.flow.<rol>.main` |
| **Cantidad con signo** (tarjeta **y las dos tablas**) | `semantic.flow.<rol>.main` — **la misma tinta que su chip** |
| Existencia «antes → después», en las tres superficies | `semantic.text.secondary` |
| Fondo de fila en la tabla del modal | ninguno: transparente |

`<rol>` sale siempre de `TIPO_MOVIMIENTO_FLOW[tipo]`, nunca de una condición escrita a mano.

**Dónde aplica.** En las **tres** superficies que dibujan un movimiento: la tarjeta móvil, la
celda «Cantidad» de la tabla de escritorio de `/movimientos` y la del modal. Ya no queda ninguna
superficie con `error.main` / `success.main`; ese par desaparece de los dos archivos. Es la
**decisión del humano** de la segunda ronda, y sin ella la justificación de abajo solo valía para
el teléfono.

**Por qué la cantidad lleva la tinta del tipo y no verde/rojo.** Hoy las tres superficies la
pintan con `error.main` o `success.main` según `isMovimientoBaja`. Eso es exactamente lo que `tokens.ts`
señala como error, con nombre y apellido: las dos mitades de una desagregación acaban una verde y
otra roja, «se lee como un éxito y un fracaso cuando nada tuvo éxito ni falló». Con la tinta del
rol, el chip y el número son un solo objeto: una compra es verde, una venta roja, un traspaso azul,
un ajuste ámbar, una merma roja, una consignación violeta y **las dos mitades de una desagregación,
gris las dos** — la dirección la sigue diciendo el signo, que es donde debe estar.

Sobre el violeta: `flow.external` resuelve a `accent`, y el acento está reservado a acción y
selección. Aquí no se rompe esa reserva — la prohibición es sobre el **relleno sólido** que promete
que algo se pulsa, y esto es tinta sobre fondo elevado, junto a un chip que ya es violeta lavado
desde hace meses en esta misma pantalla, dentro de una tarjeta y de unas filas que no responden al
toque.

### Contraste (AA)

Todas las parejas son las que el theme ya usa; no se inventa ninguna combinación nueva.

| Pareja | Medida | Umbral |
|---|---|---|
| `text.secondary` (#5F5E68) sobre `surface.raised` (#FFFFFF) | ≈ 6,6:1 | 4,5:1 ✓ |
| `flow.in.main` (#1F6B3F) sobre `surface.raised` | ≈ 6,3:1 | 4,5:1 ✓ (y 3:1 para el texto grande de la cantidad) |
| `flow.out.main` / `flow.loss.main` (#A5382A) sobre `surface.raised` | ≈ 6,5:1 | 4,5:1 ✓ |
| `flow.correction.main` (#8A5A12) sobre `surface.raised` | ≈ 5,5:1 | 4,5:1 ✓ |
| `flow.transfer.main` (#1C5E80) sobre `surface.raised` | ≈ 6,2:1 | 4,5:1 ✓ |
| `flow.split.main` (#5B5A63) sobre `surface.raised` | ≈ 6,9:1 | 4,5:1 ✓ |
| `flow.external.main` (#5B4CA8) sobre `surface.raised` | ≈ 7,3:1 | 4,5:1 ✓ |
| Cada `flow.<rol>.main` sobre su propio `surface` (el chip) | pareja definida por el propio sistema de tokens | ✓ |

---

## Estados

### `/movimientos` — sin cambios

Conserva sus dos `EmptyState` de hoy (`no-results` con «Limpiar filtros» cuando hay filtros
activos, `empty` cuando no) y su `LinearProgress` en los refetch.

### Modal

| Estado | Qué se muestra |
|---|---|
| Cargando, < 600 px | `LoadingState variant="cards" count={4}` |
| Cargando, ≥ 600 px | `LoadingState variant="table" columns={5} count={6}` |
| Vacío (el producto no tiene ningún movimiento) | `EmptyState variant="empty"`, título «Este producto no tiene movimientos registrados», descripción «Se registran solos con cada venta, ajuste, compra o traspaso de este producto.» Sin acción. |
| Sin resultados (hay filtros y ninguno coincide) | `EmptyState variant="no-results"`, título «Ningún movimiento coincide con los filtros», descripción «Probá con otro rango de fechas o quitá el filtro de tipo.», acción «Limpiar filtros», que ejecuta el `clearFilters` que ya existe. |
| Error de carga | Lo que ya hace: el `showMessage` de error del `MessageContext`. No se añade `ErrorState`: el diálogo se abre sobre una pantalla que sigue viva y un panel de error a pantalla completa dentro de un modal es más ruido que información. |
| Sin conexión | No es un estado propio de esta pantalla: el historial se sirve de la API y el diálogo se comporta como el error de carga. |

Los dos vacíos hoy son el mismo `Alert`. Son cosas distintas y piden acciones opuestas: uno se
resuelve registrando movimientos, el otro quitando un filtro.

---

## Destinos táctiles

| Control | Tamaño |
|---|---|
| Botón de cerrar del diálogo | 44 × 44 (lo da `MuiIconButton` en tamaño `medium`; no se le pone `size="small"`) |
| Acción «Limpiar filtros» del `EmptyState` | ≥ 44 de alto (`MuiButton` en `medium`) |
| Tarjeta de movimiento | **No es un destino táctil**: no lleva `onClick`, ni `CardActionArea`, ni cursor de mano |

No hay ningún control nuevo en este contrato. La tarjeta es lectura.

---

## Prohibiciones de copy

| Nunca | Porque |
|---|---|
| Un número inventado en la línea de existencia cuando `existenciaAnterior` es nulo — ni «0 → 5», ni «— → 5», ni «-», ni la raya larga, **tampoco en las tablas** | Afirma un stock que la base no guardó. `getStockAfterMovement` devuelve nulo justo para que quien la llama imprima su fallback en vez de un número que se acaba de inventar. Y con el par apilado la celda nunca queda vacía: siempre tiene su cantidad encima. |
| Una columna propia para el «antes → después» en ninguna de las dos tablas, ni una cabecera «Anterior → Posterior» | Separa el dato del número que lo produce, y volvería a dejarlo en un sitio distinto en cada tabla: la incoherencia que este encargo cierra, girada 90 grados. |
| Ocultar una columna por ancho en ninguna de las dos tablas | Es la forma exacta de la pérdida de información que motivó el encargo. Si no cabe, se desplaza la caja de la tabla; no se tira el dato. |
| El identificador crudo del tipo en la interfaz (`COMPRA`, `TRASPASO_SALIDA`…) | `TIPO_MOVIMIENTO_LABELS` existe y traduce los 14; un enum en pantalla es una fuga de la base de datos. |
| Etiquetas «Motivo:» y «Por:» delante del motivo y del autor | Son redundantes: el texto ya se explica solo, y se quitaron a propósito en el rediseño de esta tarjeta. |
| Un número de existencia o de cantidad sin pasar por `formatQuantity` | Son Floats acumulados: en producción hay valores como `8.69999999999999`, que hoy el modal imprime enteros. |
| Nombre y proveedor concatenados en una sola cadena en la tarjeta | Convierte dos datos en uno y hace imposible la variante de producto fijo. |
| «Sin usuario», «—» o el hueco vacío en el autor | Un movimiento siempre lo hizo alguien o lo hizo el sistema; «Sistema» es la respuesta, y ya es la que da la tabla. |

---

## Preguntas abiertas

> Las dos primeras preguntas de la versión anterior de este contrato —la tinta de la cantidad y la
> columna «Usuario» de la tabla de escritorio de `/movimientos`— **están resueltas y ya no son
> preguntas**: el humano dijo que sí a las dos, y viven ahora como especificación en «La tabla de
> escritorio de `/movimientos`, en concreto» y en «Tokens por estado». La tercera incoherencia
> (esa tabla tampoco mostraba la existencia) la resuelve «La cantidad y su existencia».

- **El modal pide 1000 movimientos de golpe** y los filtra en el cliente. Con la tarjeta el DOM
  pesa aproximadamente lo mismo que con la tabla de hoy, así que no hay regresión, pero el problema
  ya existe. ¿Se le pone la paginación que `/movimientos` ya tiene?
- **El modal no usa `AppDialog`**, que ya resuelve el `fullScreen` en teléfono, el orden de las
  acciones y la salida garantizada. Migrarlo dejaría un solo flag de umbral en el archivo. Queda
  fuera de este encargo por riesgo, no por criterio.

---

## Criterios de diseño verificables en navegador

> Los ejecuta el agente `qa` a 320, 768 y 1440 px, **con un viewport real** (E-005: `resize_window`
> no lo cambia; hace falta un contexto de navegador creado con ese tamaño). Cada línea se comprueba
> midiendo. Al localizar elementos, medir el que **es** lo que se busca, no el primero que aparece
> desde un icono o una clase (E-011).

1. A 320 px, en `/movimientos` (pestaña Movimientos), `document.documentElement.scrollWidth` es
   menor o igual que `clientWidth`.
2. A 320 px, en `/movimientos`, el `ContentCard` que contiene la lista no tiene ningún `table`
   entre sus descendientes, y hay tantos `.MuiCard-root` dentro de la lista como movimientos
   muestra el texto de la paginación.
3. A 320 px, con el modal «Movimientos de:» abierto, el `.MuiDialog-root` no contiene ningún
   `table`, y sí contiene una tarjeta por movimiento.
4. A 768 px y a 1440 px, el `thead` de la tabla del modal tiene **cinco** celdas y su
   `textContent` contiene `Observaciones` y `Usuario`. Comparar contra el `textContent`, no contra
   lo que se ve: la cabecera va en versalitas por `text-transform`, que no toca el texto que
   guarda el DOM (E-016). Buscar dentro de ese `thead`, no en todo el documento (E-011).
5. En el modal, ninguna fila del `tbody` tiene fondo propio: el `backgroundColor` computado de cada
   `tr` es `rgba(0, 0, 0, 0)` (medido sin el puntero encima: el theme tiñe la fila en hover).
   Además, dentro del diálogo no aparece ni `rgb(255, 235, 238)` ni `rgb(232, 245, 232)` como
   `backgroundColor` computado de ningún elemento.
6. En una tarjeta de un movimiento con `existenciaAnterior` conocida, existe **un** elemento cuyo
   texto casa con «número → número», y el segundo número es el primero más o menos la cantidad de
   la tarjeta, según el signo que muestra. Ese elemento tiene `aria-label`.
7. En una tarjeta de un movimiento con `existenciaAnterior` nula, el texto de la tarjeta no
   contiene el carácter `→`.
8. La cantidad de una tarjeta mide 22 px de `fontSize` computado y 700 de `fontWeight`, **y la
   misma medida se obtiene en las dos pantallas**: la tarjeta de `/movimientos` a 320 px y la del
   modal a 320 px devuelven los mismos valores computados de `fontSize`, `fontWeight` y `color`
   para un movimiento del mismo tipo.
9. En una tarjeta de un movimiento de tipo `COMPRA`, el `color` computado de la cantidad es
   `rgb(31, 107, 63)`, el `color` del chip es el mismo `rgb(31, 107, 63)` y su `backgroundColor` es
   `rgb(241, 247, 243)`.
10. En una tarjeta de un movimiento de tipo `DESAGREGACION_BAJA` y en una de `DESAGREGACION_ALTA`,
    el `color` computado de la cantidad es el mismo en las dos, y es `rgb(91, 90, 99)`.
11. Mientras el modal carga, existe dentro del diálogo un elemento con `role="status"` y
    `aria-busy="true"`, y `document.querySelectorAll(".MuiCircularProgress-root")` dentro del
    diálogo devuelve 0.
12. A 320 px, en el modal, la tarjeta más ancha mide como mucho 296 px de ancho de caja, y ningún
    contenedor de la lista de tarjetas tiene un `maxHeight` computado distinto de `none`.
13. El botón de cerrar del modal mide al menos 44 px de alto y 44 px de ancho en los tres anchos.
14. A 320 px, en la variante del modal, ninguna tarjeta contiene el nombre del producto que aparece
    en el título del diálogo (buscar la cadena exacta del título dentro del cuerpo de las
    tarjetas, no dentro de la cabecera del diálogo).
15. A 320 px, en `/movimientos`, cada tarjeta contiene la fecha formateada y un autor no vacío: en
    un movimiento sin `usuario`, el texto del pie de la tarjeta contiene «Sistema».
16. Un movimiento cuya cantidad tenga decimales (por ejemplo 12,6 unidades de una merma) se
    imprime en la tarjeta como el signo seguido de `12.6`, y no como `13`.

**De la segunda ronda — las tres incoherencias cerradas:**

17. A 768 px y a 1440 px, el `thead` de la tabla de `/movimientos` tiene **seis** celdas y su
    `textContent` contiene `Usuario`. Se comprueba en los dos anchos: a 768 es donde antes
    desaparecía.
18. **Elegir una fila que discrimine** (E-008): `error.main` y `success.main` resuelven hoy a los
    mismos `rgb` que `flow.out` y `flow.in`, así que una `COMPRA` o una `VENTA` dan el mismo color
    con la tinta vieja y con la nueva y **no prueban nada**. La fila que discrimina es la de una
    desagregación, un ajuste, un traspaso o una consignación. Criterio: en la tabla de escritorio
    de `/movimientos`, en una fila de `DESAGREGACION_BAJA` y en otra de `DESAGREGACION_ALTA`, el
    `color` computado de la cantidad es el mismo en las dos y vale `rgb(91, 90, 99)`; con la tinta
    vieja una sería roja y la otra verde.
19. En cualquier fila de las dos tablas, el `color` computado de la cantidad es **idéntico** al
    `color` computado del chip de esa misma fila.
20. En las dos tablas, el elemento que contiene el `→` es descendiente de **la misma celda** que
    la cantidad de su fila (`elemento.closest("td")` devuelve el mismo nodo para los dos), y esa
    celda es la de la columna «Cantidad». Ninguna de las dos tablas tiene una celda de cabecera
    cuyo `textContent` contenga `Anterior` o `Posterior`.
21. En una fila cuyo movimiento tiene `existenciaAnterior` nula, el `textContent` de la celda de
    cantidad no contiene `→` ni `—` ni `-` sueltos: contiene solo la cantidad con su signo.
22. A 768 px, en `/movimientos`, `document.documentElement.scrollWidth` es menor o igual que
    `clientWidth` — la página no se desplaza en horizontal. Que la caja de la tabla sí lo haga es
    aceptable y no se penaliza; se mide la página, no el `TableContainer`.
