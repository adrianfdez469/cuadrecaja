# recalculo-cierres: diseño de «Desfase de cifras y recálculo de un cierre»

> Escrito por el agente `ui-designer`. **Mobile-first: primero 320 px.**
> Sin código, sin `sx`, sin JSX: el `implementer` ejecuta este contrato.
> Todo color se nombra con su ruta `semantic.*`; ningún `#RRGGBB` entra aquí.
>
> **Feature transversal.** No tiene entrada en `.agents/features.json` y por eso no tiene `F-###`:
> nace del [ADR 0036](../../docs/adr/0036-las-cifras-guardadas-de-un-cierre-son-la-fuente-de-verdad.md).
> Se usa la plantilla `.agents/designs/TEMPLATE.md` igualmente.

---

## Fuentes

- **[ADR 0036](../../docs/adr/0036-las-cifras-guardadas-de-un-cierre-son-la-fuente-de-verdad.md)
  entero.** Es el spec de esta pantalla: de ahí salen las cuatro decisiones que este contrato
  convierte en pantalla — «lo guardado manda» (punto 2), «recálculo explícito, solo `SUPER_ADMIN`,
  con `dryRun`» (punto 3), «desfase visible: una edición manual deja de ser silenciosa» (punto 4) y
  el agravante del desglose por moneda que «imprimía un único ≈ base que incluía fondo inicial y
  propinas sin decirlo, y se leía como el total de ventas» (Contexto).
- El código vigente, entero: `src/app/resumen_cierre/page.tsx` y sus tres componentes nuevos
  (`components/CierreDesactualizadoChip.tsx`, `components/RecalcularCierreDialog.tsx`,
  `components/CajaPorMonedaHistorico.tsx`), más `src/app/cierre/components/MonedaBreakdownRow.tsx`.
- `src/schemas/cierre.ts`: `totalesDesactualizados` y `totalsComputedAt` en la fila del listado y en
  el detalle; `recalculateCierreResultSchema` (`applied`, `drifted`, `totalsComputedAt`, `before`,
  `after`, `resumenBefore`, `resumenAfter`, `liquidacionesConservadas`) y `ICierreStoredTotals`.
  **Este contrato no pide ni un campo nuevo:** todo lo que se dibuja ya viene en esas respuestas.
- `src/theme/tokens.ts` y `src/theme/index.ts` **completos**, incluidos sus comentarios: de ahí
  salen `touch.min = 44`, `shape.radius`, el hecho de que `MuiIconButton` solo mide 44×44 en
  `sizeMedium`, y que `MuiAlert` ya resuelve `severity` a `hue.*.surface` + `hue.*.main`.
- `AGENTS.md`, `.agents/designs/F-005.md` (vocabulario y nivel de detalle), `.agents/designs/TEMPLATE.md`.
- `.agents/COMMON_ERRORS.md` — índice, y las fichas **E-005** (`resize_window` no cambia el
  viewport: los tres anchos se miden en un iframe del mismo origen con `flex: 0 0 auto`) y **E-011**
  (`.MuiContainer-root` encuentra el `Container` del `Layout`, no el de la página).
- Componentes reutilizados, leídos y verificados en sus props: `PageContainer`, `ContentCard`,
  `SectionLabel`, `StatStrip`, `StatusPill` (`label`, `hue`, `caps`, `icon`), `AppDialog`
  (`confirm`, `cancelLabel`, `footerStart`, `busy`, `maxWidth`; ya hace `fullScreen` en `down("sm")`),
  `LoadingState` (`variant`, `count`, `columns`), `ErrorState` (`kind`, `title`, `description`,
  `onRetry`), `EmptyState` (`variant`, `title`, `description`, `action`, `size`).
- El estándar de bifurcación de tabla: `GestionInventarioPage.tsx:235-254`
  (`isMobile ? <InventarioMobileList/> : <InventarioTable/>`).

### El rediseño aprobado — lo que se pudo contrastar y lo que no

**`DesignSync` no está disponible en esta sesión.** No aparece en la lista de herramientas
diferidas ni en los servidores MCP conectados, así que **no se pudieron abrir
`rediseno/resumen-cierres.html` ni `rediseno/resumen-cierres-movil.html`** de primera mano. Se
buscó una copia local en el repositorio y en el disco: no existe, y **no se debe versionar una**.

Lo que sí hay es una **nota de sesión de primera mano fechada el 2026-08-31**, escrita por quien
entonces sí abrió el artboard y migró esta pantalla contra él. De ella salen tres hechos que este
contrato trata como decisión del rediseño, no como invención propia:

| Hecho verificado en la nota | Qué fija |
|---|---|
| «la tabla desktop de 13 columnas ya coincide casi exactamente con el mockup (Inicio/Fin/Inversión/Venta/Bruto/Descuentos/Gastos/Merma+Dev./Transf/Gan.Final/V.Propias/V.Consignación/**Acciones**)» | **La columna `Acciones`, última, es del rediseño.** Este contrato no la inventa: la ensancha para que quepa una segunda acción y la fija |
| «la banda de 3 secciones con eyebrow (Resultado del rango / Composición de las ventas / Costos y pérdidas)» y la celda «Transferencias» dentro de su banda | La mitad superior de la pantalla **ya está migrada y no se toca** |
| «**No tocado deliberadamente**: el contenido del Drawer "Detalle del Cierre" — el mockup provisto solo cubre la pantalla de lista, no el detalle expandido, así que no hay contra qué compararlo; no inventar su diseño» | **El drawer no tiene artboard.** Sus decisiones son de este contrato, y van marcadas |

> **Contrastado el 2026-09-05 desde la sesión principal**, que sí tenía `DesignSync`, contra
> `rediseno/resumen-cierres.html` y `rediseno/resumen-cierres-movil.html`:
> - El artboard de escritorio dibuja `Acciones` como 13.ª columna, de 80 px, centrada, con un solo
>   destino de 44 × 44 (`ZoomIn` en acento) y celdas con 8 px de padding horizontal. **No dibuja
>   fijado ni borde**: el fijado lo pide el humano y la costura queda como decide este contrato. Los
>   112 px son los 80 del artboard más el segundo destino.
> - El artboard móvil dibuja la card con cabecera de fechas + `ZoomIn` de 44 × 44 y **no dibuja
>   ningún aviso ni acción secundaria**: la banda es decisión de este contrato. (La rejilla de cifras
>   del artboard móvil es distinta a la implementada —«Ganancia Final» grande + cuatro líneas— y
>   sigue fuera de este alcance.)
> - Ni el drawer ni el diálogo aparecen en ningún artboard: confirmado.
> - Pregunta abierta 3 resuelta en la implementación: el banner y el tooltip distinguen «ventas que
>   cambiaron» de «cerrado con una versión anterior» (y un caso mixto) a partir de
>   `totalsComputedAt`, con copy propio para cada uno.

**Todo lo que el rediseño no llegó a decidir va marcado con `⚠ SIN CONTRASTAR`**, y está repetido
entero en «Preguntas abiertas». Son cuatro puntos: el tratamiento de la columna fija, el tratamiento
de las acciones en la card móvil, la ubicación del aviso dentro del drawer, y el layout del diálogo
de recálculo. **No se debe lanzar al `implementer` sobre esos cuatro sin contrastarlos primero
contra `rediseno/resumen-cierres.html` y `rediseno/resumen-cierres-movil.html`.** El resto del
contrato no depende del artboard: lo fija el encargo del humano, el ADR 0036 o el sistema de diseño.

---

## Lo que este feature NO diseña

- **La mitad superior de `/resumen_cierre`**: el `TasasBanner`, la tarjeta de filtros de fecha, las
  tres bandas de `StatStrip` con sus `SectionLabel` y el desglose de transferencias. Ya se migraron
  contra el artboard el 2026-08-31 y **no se toca ni una línea de ellas**. Lo único que ocurre ahí
  es que **se inserta un hermano nuevo** —el banner de página— entre el `TasasBanner` y la tarjeta
  de filtros; ninguna de esas piezas cambia por dentro ni de orden entre sí.
- **Las 12 columnas de datos de la tabla desktop**, sus permisos (`operaciones.cierre.gananciascostos`)
  y la fila de Totales. Solo cambia la 13.ª, `Acciones`, y **la última celda de la fila de Totales**
  porque queda debajo de la columna fija y tiene que dejar de ser transparente.
- **La rejilla de cifras de la card móvil** (Ventas, Bruto, Descuentos, Gastos, Compras, Merma,
  Devoluciones, Ganancia Final, Inversión, Transferencias, V. Propias, V. Consignación). Este
  contrato añade una banda encima; no reordena ni retoca ninguna de esas celdas.
- **`MonedaBreakdownRow`**, por dentro. Es compartido con `/cierre`, que tiene su propio artboard
  aprobado (`rediseno/cierre-caja.html` / `-movil.html`) que **tampoco se pudo abrir en esta sesión**.
  Este contrato decide **dónde va el bloque «Caja por moneda» dentro del drawer y qué rótulos tiene
  su contenedor**; lo que pasa dentro de cada fila de moneda se queda exactamente como está. Ver
  «Preguntas abiertas».
- **El estado «no hay tienda seleccionada»** (`noLocalActual`), que ya existe y funciona.
- **La deuda de estados de la pantalla completa**: el `CircularProgress` de la carga inicial de la
  lista, el `Alert severity="info"` que hace de vacío (`EmptyData`), y la ausencia de estado de
  error cuando `getResumenCierres` falla. Son anteriores a este feature y valen un contrato propio.
  **La única excepción son los estados del diálogo de recálculo**, que sí es una pieza de aquí y por
  tanto sí trae sus tres estados completos.
- **El endpoint, el `dryRun`, el permiso y el motor de cálculo.** Están cerrados por el ADR 0036 y
  ya implementados. Este contrato no cambia ni una regla de negocio: solo decide dónde se ven.
- **El recálculo en lote** (`scripts/recalculate-cierres.ts`). No tiene pantalla y no la va a tener.

---

## Pantallas afectadas

| Pantalla | Ruta | Nueva o existente |
|---|---|---|
| Resumen de Cierres — lista | `/resumen_cierre` | **cambia** — columna de acciones fija en desktop, banda de aviso en la card móvil, banner de página |
| Detalle del Cierre — drawer | dentro de `/resumen_cierre` | **cambia** — el aviso sube al primer lugar; se rotula el bloque «Caja por moneda» |
| Diálogo «Recalcular cierre» | dentro de `/resumen_cierre` | **cambia** — pasa a `AppDialog`, bifurca a 320 px y gana sus tres estados |

---

## Umbral responsive

`useMediaQuery(theme.breakpoints.down("sm"))` — el canónico, y el que la pantalla ya usa como
`isMobile`. **Se declara una sola vez en `page.tsx`** y baja por props.

**`isTablet` (`down("md")`) se queda como está y no se le añade ningún uso.** Hoy solo decide
`Table size`, y este contrato no cuelga de él ninguna decisión nueva: un segundo umbral que además
gobernara qué se ve es exactamente la deuda que `AGENTS.md` señala («en 6 pantallas es `down("md")`
sin criterio»). Lo que sí hace este contrato es **impedir que `isTablet` baje los destinos táctiles**
— ver «Destinos táctiles».

---

## 1. La lista — la columna de acciones

### Qué resuelve

Que quien mira el historial pueda (a) abrir el detalle de cualquier cierre y (b) ver, sin buscar y
sin desplazar horizontalmente, **cuáles de esas filas tienen cifras que ya no cuadran con sus
ventas** — y, si es superadministrador, arreglarlo desde ahí mismo.

### Por qué el diseño anterior se rechazó, dicho para que no se repita

El aviso vivía **dentro de una celda de datos**: bajo la fecha en la card móvil, y dentro de la
celda `Fin` en la tabla. Los dos sitios fallan por la misma razón, no por dos:

- **En la tabla**, `Fin` es la **segunda de trece columnas**. La tabla desborda en horizontal en
  cualquier portátil, así que en cuanto el usuario desplaza para leer «Gan. Final» o
  «V. Consignación» —que es lo que va a hacer— el aviso y su botón **salen del viewport**. Un aviso
  que desaparece cuando miras el dato al que se refiere no es un aviso.
- **En la card móvil**, un `Chip` y un `Button` en una fila sin envolver, dentro de 280 px útiles,
  se recortan o se comen el ancho de la fecha; y aunque no se recortaran, quedan como un adorno
  entre la fecha y una rejilla de doce cifras.

La corrección es la que pidió el humano: **el estado y su acción salen de las celdas de datos y se
van a un sitio que no depende del desplazamiento** — la columna fija en escritorio, una banda a
ancho completo en el teléfono.

### 320 px — la card

La rama móvil (`isMobile`) sigue siendo `Card` por cierre. Cambia esto, y solo esto:

```
┌───────────────────────────────────────┐
│ 01/09/2025 - 07/09/2025          [🔍] │  ← cabecera (tappable, abre el detalle)
├───────────────────────────────────────┤
│ ⚠ Totales desactualizados             │  ← BANDA, ancho completo, solo si desactualizado
│ Las cifras de abajo son las guardadas │
│ y no coinciden con las ventas.        │
│ ┌───────────────────────────────────┐ │
│ │           Recalcular              │ │  ← solo SUPER_ADMIN, alto 44, ancho completo
│ └───────────────────────────────────┘ │
├───────────────────────────────────────┤
│ Ventas          Bruto                 │  ← la rejilla de cifras, INTACTA
│ …                                     │
└───────────────────────────────────────┘
```

**La banda, en detalle:**

| Propiedad | Valor |
|---|---|
| Posición | Inmediatamente **debajo de la cabecera de fechas y encima de la rejilla de cifras** |
| Fondo | `semantic.hue.caution.surface` |
| Radio | `shape.radius.sm` |
| Padding | `1.25` vertical, `1.5` horizontal (10 / 12 px) |
| Ancho | **Completo dentro de la card**, sin `flexWrap` que la pueda recortar |
| Línea 1 | `StatusPill` `hue="caution"`, `icon={<WarningAmber/>}`, label `Totales desactualizados` |
| Línea 2 | `body2` en `semantic.hue.caution.main`: `Las cifras de abajo son las guardadas y no coinciden con las ventas actuales del período.` |
| Línea 3 | Solo `SUPER_ADMIN`: `Button` `variant="outlined"` `color="warning"`, **`fullWidth`**, alto ≥ 44, label `Recalcular` |

**Por qué la banda va antes de las cifras y no al final de la card.** Lo que declara es que **las
doce cifras de debajo están en duda**. Debajo de ellas sería una nota al pie de algo que el lector
ya se creyó; encima, es una advertencia de lectura. Es el mismo criterio por el que el aviso sube al
principio del drawer.

**Por qué el botón es `fullWidth` y no comparte fila con el pill.** A 280 px útiles, un
`Chip` + `Button` en la misma fila es justo lo que se recortaba antes. Apilados, ninguno de los dos
depende del ancho del otro.

**La card entera sigue abriendo el detalle al tocarla —cabecera y rejilla de cifras—, exactamente
como hoy. La banda es el único hueco.** La banda llama `stopPropagation`: es una zona informativa
dentro de una superficie tappable, y tocar «Recalcular» no puede abrir además el drawer detrás del
diálogo. **No se le quita el `onClick` a la card**: perder «toca donde sea para ver el detalle»
sería una regresión que ni el humano ni el rediseño pidieron.

**El `IconButton` de la cabecera (`ZoomIn`) pasa de `size="small"` a 44×44.** Hoy mide 30 px: está
por debajo del piso y es el destino más tocado de la card.

### 768 px — la tabla, primera aparición

A partir de `sm` se renderiza la tabla (13 columnas). La columna `Acciones` se comporta ya como en
1440: **fija a la derecha**. A 768 px la tabla desborda con seguridad, así que es el ancho donde el
fijado se nota más y donde el `qa` debe medirlo.

### 1440 px — la forma completa

La misma tabla, con más aire y, según los permisos del usuario, con las columnas `Gastos` y
`Merma+Dev.` presentes. **La columna `Acciones` sigue fija**: incluso a 1440 px, trece columnas de
importes desbordan en cuanto el navegador no está maximizado, y el fijado no es un remedio de
pantalla pequeña, es la garantía de que el estado y su acción no dependen del desplazamiento.

### La columna `Acciones` — especificación exacta ⚠ SIN CONTRASTAR

> El artboard **sí** dibuja la columna `Acciones` como última columna (verificado en la nota del
> 2026-08-31). Lo que no consta es **cómo dibuja su fijado ni su borde**. Todo lo de esta subsección
> marcado `⚠` es decisión de este contrato.

**Contenido de la celda, siempre en este orden, de izquierda a derecha:**

| Ranura | Cuándo aparece | Qué es |
|---|---|---|
| 1 — Estado y acción | Solo si `row.totalesDesactualizados` | Ver la tabla de abajo. **La ranura existe para todos los roles** |
| 2 — Ver detalles | Siempre | `IconButton` 44×44, glifo `ZoomIn`, `color="primary"`, tooltip y `aria-label` `Ver detalles del cierre` |

**La ranura 1 es un solo glifo que cambia de naturaleza, no dos controles distintos:**

| Rol | Qué se dibuja | Semántica |
|---|---|---|
| `SUPER_ADMIN` | `IconButton` 44×44, glifo `WarningAmber`, ink `semantic.hue.caution.main`, tooltip `Totales desactualizados — recalcular`, `aria-label` `Recalcular las cifras de este cierre` | **Pulsable.** Abre el diálogo |
| Cualquier otro rol | Una caja de 44×44 con el **mismo glifo, el mismo ink y la misma posición**, sin ripple, `cursor: "default"`, envuelta en el mismo `Tooltip` con el texto explicativo largo, y con `role="img"` + `aria-label` `Totales desactualizados` | **No pulsable.** Solo declara el estado |

**Por qué el mismo glifo en el mismo sitio para todos los roles.** El encargo pide dos cosas a la
vez: que el aviso sea perceptible para cualquiera, y que la acción sea solo del superadministrador.
Resolverlo con dos elementos distintos —un pill para unos, un botón para otros— haría que la columna
midiera distinto según quién mire y que la fila se leyera distinta. Una sola ranura, un solo ancho,
y la única diferencia es si se puede pulsar. Y el `Tooltip` del rol sin permiso **dice por qué no
hay acción**, en vez de dejar un control apagado sin explicación:

> `Las ventas de este período cambiaron después del cierre, o el cierre se hizo con una versión
> anterior. Sus cifras guardadas no reflejan las ventas actuales. Solo un superadministrador puede
> recalcularlas.`

La segunda frase se añade **solo** para los roles sin permiso. Para el superadministrador el tooltip
es el corto (`Totales desactualizados — recalcular`), porque el botón ya dice qué hacer.

**El fijado — mecánica, y es la parte que se rompe si se hace a medias:**

| Elemento | Requisito |
|---|---|
| Ancho de la columna | **112 px fijos** (`width` y `minWidth`), en los tres anchos y para todos los roles. Dos destinos de 44 + 8 de separación + 8 de padding a cada lado |
| Padding horizontal de la celda | **8 px**, en cabecera, cuerpo y Totales. `MuiTableCell` trae 16 px por defecto en `medium` **y en `small`**: con ese valor la columna mediría 128 px, no 112, y el criterio 5 fallaría contra una implementación por lo demás correcta |
| Posición | `position: "sticky"`, `right: 0` — en la celda de cabecera, en **todas** las celdas de cuerpo y en **la última celda de la fila de Totales** |
| `zIndex` de la cabecera | Por encima del que `stickyHeader` da al resto de cabeceras (esa celda es fija en los dos ejes: arriba y a la derecha) |
| `zIndex` del cuerpo | Por encima de las celdas de datos, por debajo de la cabecera |
| Fondo de la celda de cuerpo | `semantic.surface.raised`, **opaco**. Sin fondo, las columnas de importes se leen por debajo de los iconos |
| Fondo con el ratón encima | `semantic.surface.sunken`, para que la celda fija **siga a su fila**. `MuiTableRow` pinta el hover en la fila; una celda con fondo propio se quedaría blanca y partiría la fila en dos |
| Fondo de la celda de cabecera | `semantic.surface.raised` (el mismo que `MuiTableCell.head` ya usa) |
| Fondo de la celda de Totales | `semantic.surface.sunken`, el de su propia fila. **Hoy esa celda está vacía y es transparente**: fijada y sin fondo, los importes de la fila de Totales pasarían por debajo |
| Borde | `borderLeft` de 1 px en `semantic.surface.border`, en las tres celdas. Es lo que hace que la costura se lea como un borde y no como un solape |

**Ancho fijo para todos los roles, aunque un `VENDEDOR` nunca vea la ranura 1.** Un ancho que
cambia con el rol es un número que el `qa` no puede medir una sola vez, y 48 px de aire en una
columna fija cuestan menos que una medida que depende de con qué sesión se mira.

**Sin `Badge`, sin puntos de color, sin fondo de fila teñido.** Teñir la fila entera de
`caution.surface` haría que las trece cifras se leyeran como erróneas, cuando lo que pasa es que
están **desactualizadas**, que no es lo mismo: son las cifras guardadas, correctas para el momento
en que se guardaron. El ADR 0036 llama a eso «la fuente de verdad», no «un error».

### El banner de página ⚠ SIN CONTRASTAR

**Inmediatamente después del `TasasBanner` y antes de la tarjeta de filtros**, cuando **al menos
una** de las filas de la página tiene `totalesDesactualizados`:

- Un `Alert severity="warning"` (el theme ya lo resuelve a `caution.surface` + `caution.main`).
- Copy, con singular y plural reales:
  - 1 fila → `Un cierre de esta página tiene cifras desactualizadas: sus ventas cambiaron después de cerrarlo.`
  - N filas → `{N} cierres de esta página tienen cifras desactualizadas: sus ventas cambiaron después de cerrarlos.`
- **Sin acción.** El recálculo es por cierre y no existe un «recalcular todos» en la interfaz (el
  lote es un script). Un botón aquí prometería algo que no hay.
- **Se dibuja para todos los roles.** Es la mitad de la respuesta al encargo «el aviso debe seguir
  siendo perceptible para cualquier rol»: la otra mitad es la ranura 1 de cada fila.

**Por qué además del aviso por fila.** El aviso por fila responde *cuál*; el banner responde
*hay algo que mirar*. En un teléfono, doce cifras por card y veinte cards significan que el aviso
por fila solo se ve si ya estabas mirando esa fila.

**Y por qué va arriba del todo y no pegado a la lista.** Encima del `ContentCard` «Historial de
Cierres» quedaría por debajo de la tarjeta de filtros y de las tres bandas de `StatStrip` — a 320 px,
más de una pantalla de desplazamiento. Es el mismo criterio que el aviso del drawer: **las tres
bandas de cifras agregadas suman las columnas guardadas de esos mismos cierres**, así que también
están en duda, y todo lo que se dibuje antes del aviso se lee como confiable. El banner es lo único
de esta pantalla que se ve sin desplazar nada, y ahí es donde tiene que estar.

Es la única pieza de este contrato que se inserta en la mitad superior de la pantalla; **no toca ni
reordena nada de lo que ya había ahí**, se mete entre dos hermanos existentes.

**El recuento es de la página, no del rango**, y el copy lo dice literalmente («de esta página»).
La respuesta del listado solo trae los cierres de la página actual; decir «hay 3 cierres
desactualizados» a secas afirmaría algo sobre todo el historial que la pantalla no sabe.

---

## 2. El drawer de detalle

> **El artboard no cubre el drawer.** Consta por escrito en la nota del 2026-08-31: «el mockup
> provisto solo cubre la pantalla de lista, no el detalle expandido». Todo lo de esta sección es
> decisión de este contrato y va marcado `⚠ SIN CONTRASTAR`.

### El aviso ⚠ SIN CONTRASTAR

**Sube al primer lugar del cuerpo desplazable.** Orden fijo, en los tres anchos:

```
[ AVISO DE DESFASE ]                 ← si totalesDesactualizados
[ selector de moneda + Actual/Al cierre ]
[ TasasBanner ]
[ GananciaCard ]                     ← si tiene el permiso
[ StatStrip ]
[ Caja por moneda ]
[ Productos Vendidos ]
```

Hoy va **después** del selector de moneda y del `TasasBanner`. **Está mal, y no es cosmético:** el
aviso invalida la lectura de todo lo que hay debajo, y todo lo que se dibuje antes que él se lee
como confiable. Un `TasasBanner` encima del aviso dice «estas son las tasas con las que están
calculadas estas cifras» sobre unas cifras de las que aún no se ha dicho que no cuadran.

| Propiedad | Valor |
|---|---|
| Componente | `Alert severity="warning"` |
| Título | `AlertTitle`: `Totales desactualizados` |
| Cuerpo | `Las cifras de este cierre son las que se guardaron al cerrarlo, y no coinciden con las ventas actuales del período.` |
| Acción, `SUPER_ADMIN`, ≥ `sm` | En la ranura `action` del `Alert`: `Button` `variant="outlined"` `color="warning"`, alto ≥ 44, label `Recalcular` |
| Acción, `SUPER_ADMIN`, 320 px | **Fuera de la ranura `action`**: el mismo botón, `fullWidth`, debajo del cuerpo. La ranura `action` del `Alert` de MUI le roba el ancho al texto, y a 280 px útiles el cuerpo quedaría en columna de dos palabras |
| Sin permiso, cualquier ancho | Sin botón, y una tercera línea en `body2`: `Solo un superadministrador puede recalcularlas.` |

**Tras un recálculo aplicado desde el drawer, el drawer se cierra y la lista se recarga.** Es lo que
ya hace hoy y es correcto: los datos que el drawer tiene en memoria acaban de dejar de ser válidos,
y dejarlo abierto mostrando las cifras viejas contradice el aviso que se acaba de resolver.

### El bloque «Caja por moneda» ⚠ SIN CONTRASTAR

Va **entre el `StatStrip` y «Productos Vendidos»**, que es donde ya está. Se confirma esa posición y
se razona, porque el ADR 0036 la hace deliberada:

- **No puede ir antes del `StatStrip`.** El agravante que el ADR nombra en su Contexto es
  exactamente que el `≈ base` de este bloque «se leía como el total de ventas». Puesto encima de las
  cifras de ventas, un lector que baja lo toma por el titular de la sección. Puesto debajo, llega
  después de haber leído «Total Ventas» y solo puede leerse como otra cosa.
- **No puede ir después de «Productos Vendidos».** Esa tabla es larga y con desplazamiento propio
  (`maxHeight: 60vh / 70vh`): cualquier cosa detrás de ella queda fuera del alcance práctico en un
  teléfono.

**El rótulo del contenedor es lo que impide la confusión, y por eso deja de ser condicional.**
`ContentCard` con `title="Caja por moneda"` y
`subtitle="Fondo inicial + cobros − deducciones. No es el total de ventas."` — **y ese subtítulo se
dibuja en los tres anchos**, no solo desde `sm`. Hoy la pantalla lo esconde en móvil como hace con
todos los subtítulos. Aquí no vale: el teléfono es donde más pesa la confusión que el ADR describe,
porque es donde el bloque se lee sin nada alrededor que lo contextualice. **Esconder la única frase
que dice qué NO es este número es esconder el arreglo.**

**No hace falta tocar `ContentCard`.** Ese componente ya dibuja el subtítulo en los tres anchos
(solo lo achica a `0.75rem` en móvil): quien lo esconde es **quien lo llama**, con el
`!isMobile ? "…" : undefined` que esta pantalla repite en todas sus tarjetas. Aquí cambia un solo
argumento, y solo en esta tarjeta — las demás se quedan como están.

**Lo que hay dentro de cada fila de moneda no se toca.** `MonedaBreakdownRow` es compartido con
`/cierre`, cuya versión aprobada no se pudo contrastar en esta sesión. Ver «Preguntas abiertas».

---

## 3. El diálogo «Recalcular cierre» ⚠ SIN CONTRASTAR

### Qué resuelve

Que el superadministrador vea **exactamente qué cifra guardada cambia y en cuánto** antes de
sobrescribir datos contables — y que, si no cambia ninguna, entienda por qué recalcular sigue
teniendo sentido.

### El contenedor

Pasa de `Dialog` a **`AppDialog`**. No es un cambio de librería: `AppDialog` ya resuelve
`fullScreen` en `down("sm")`, la salida garantizada por icono y por Escape, el orden de las acciones
(confirmar última y enfatizada), el `busy` que bloquea el cierre mientras se escribe, y el
`confirm.loading`. Reimplementar eso a mano es la razón por la que hoy el diálogo no tiene salida
clara en un teléfono.

| Prop | Valor |
|---|---|
| `title` | `Recalcular cierre` |
| `subtitle` | `Las cifras guardadas se vuelven a derivar de las ventas, gastos y movimientos actuales del período.` |
| `maxWidth` | `"sm"` |
| `confirm.label` | `Recalcular` |
| `confirm.tone` | **`"primary"`, no `"danger"`** |
| `confirm.disabled` | Mientras carga la previsualización, y en estado de error |
| `confirm.loading` / `busy` | Mientras se aplica |
| `cancelLabel` | `Cancelar` |

**Por qué `tone: "primary"` y no `"danger"`.** `danger` es para lo que destruye datos. El recálculo
**re-deriva** las cifras desde los datos primarios (ventas, gastos, movimientos), que siguen ahí; y
lo único que podría perderse —una liquidación a proveedor ya pagada— el motor lo **conserva** por
diseño (ADR 0036, punto 5). Pintarlo de rojo lo equipararía a un borrado y haría que el
superadministrador dudara del paso que el propio ADR llama «obligatorio después de cualquier
corrección manual de ventas».

### La comparación — 320 px: **lista, no tabla**

Tres columnas de importes en 280 px útiles dan ~93 px por columna, y un importe formateado no cabe.
La tabla **no se comprime: se bifurca**, igual que la lista de la pantalla.

Nueve filas, **siempre las nueve y siempre en el mismo orden** (Ventas bruto, Descuentos, Ventas
neto, Inversión, Ganancia, Gastos, Ganancia final, Transferencias, Propinas). Cada fila:

```
Ventas (neto)
1 368,35   →   1 488,23      +119,88
```

| Elemento | Token / tratamiento |
|---|---|
| Rótulo | `caption`, `semantic.text.secondary` |
| Valor guardado, **si la fila cambia** | Tachado, `semantic.text.disabled` |
| Valor recalculado, **si la fila cambia** | `body2`, peso 700, `semantic.text.primary` |
| Diferencia, **si la fila cambia** | `caption`, `semantic.hue.caution.main`, con signo explícito |
| Fila **sin cambio** | Un solo valor, `body2`, `semantic.text.secondary`. Sin flecha, sin tachado, sin diferencia |

**El idioma «tachado → final» es prestado a propósito**, no inventado: es exactamente el que
`MonedaBreakdownRow` ya usa en esta misma pantalla para «bruto → final». Quien haya visto el drawer
ya lo sabe leer.

**Se muestran las nueve, no solo las que cambian.** La pregunta que trae aquí al superadministrador
es «¿qué va a cambiar?», y la respuesta completa incluye **qué no cambia**. Ocultar las filas
iguales dejaría un diálogo que a veces tiene tres filas y a veces nueve, y no habría forma de
distinguir «esta cifra no cambia» de «esta cifra no se está mostrando».

### La comparación — 768 y 1440 px: tabla de cuatro columnas

| Cifra | Guardado | Recalculado | Diferencia |
|---|---|---|---|

- Mismo orden, mismas nueve filas.
- Fila que cambia: rótulo en peso 700 y `semantic.text.primary`; `Guardado` **tachado** en
  `semantic.text.disabled`; `Recalculado` en peso 700; `Diferencia` con signo en
  `semantic.hue.caution.main`.
- Fila que no cambia: los tres valores en `semantic.text.secondary`, `Diferencia` como `—`.
- Los tres importes alineados a la derecha; el rótulo a la izquierda.

**La columna `Diferencia` es la que faltaba.** Hoy la única señal de cambio es que el valor
recalculado va en negrita, lo cual dice *que* cambió y obliga a restar mentalmente dos importes de
seis dígitos para saber *cuánto*. Se deriva de `before` y `after`, que ya vienen en la respuesta:
**no hace falta ni un campo nuevo en la API**.

### Los estados del diálogo

| Estado | Qué se muestra |
|---|---|
| **Cargando la previsualización** | `LoadingState variant="table" count={9} columns={4}` a ≥ `sm`; `LoadingState variant="list" count={9}` a 320 px. **Nunca `CircularProgress`**: el esqueleto dice que van a aparecer nueve cifras comparadas; el spinner solo dice «espera». `confirm.disabled` |
| **Con cambios** | La comparación, en su forma de cada ancho |
| **El desglose por moneda también cambia** (`resumenBefore` ≠ `resumenAfter`) | Debajo de la comparación, en `body2` y `semantic.hue.caution.main`: `El desglose por moneda de este cierre también se vuelve a escribir.` Ver la nota de abajo — **es el caso que hace que «ninguna cifra cambia» pueda ser mentira** |
| **Sin cambios** | La comparación entera (nueve filas, todas «sin cambio») **más** un `Alert severity="info"` encima: `Ninguna cifra cambia. Recalcular vuelve a sellar la fecha de cálculo, que es lo que retira el aviso.` **El botón de confirmar sigue habilitado**. Este estado exige que **las nueve cifras coincidan Y que `resumenBefore` sea igual a `resumenAfter`** |
| **Error al previsualizar** | `ErrorState kind="error"`, título `No se pudo previsualizar el recálculo`, descripción `No se pudieron leer las ventas del período. Vuelve a intentarlo.`, `onRetry` que repite el `dryRun`. `confirm.disabled`. **El diálogo NO se cierra** |
| **Sin conexión** | `ErrorState kind="offline"`, título `Sin conexión`, descripción `El recálculo se hace en el servidor: hay que estar conectado. Las cifras guardadas se siguen viendo.`, `onRetry`. `confirm.disabled` |
| **Aplicando** | `busy` + `confirm.loading`; el diálogo no se puede cerrar; la comparación sigue visible detrás |
| **Liquidaciones conservadas** (`liquidacionesConservadas > 0`) | Un `Alert severity="warning"` **debajo** de la comparación: `{N} liquidación(es) a proveedores ya pagadas se conservan tal cual.` Es la excepción del punto 5 del ADR y se dice antes de confirmar |

**El estado «sin cambios» no es un vacío y no lleva `EmptyState`.** Hay contenido: las nueve cifras
están ahí y son la prueba de que no cambia nada.

**Y «sin cambios» no puede mirar solo las nueve cifras: sería una mentira, y hay un caso real.** La
respuesta trae también `resumenBefore` y `resumenAfter`, el desglose por moneda. El agravante
**E-017** que el propio ADR 0036 nombra en su Contexto es exactamente ese: un segundo cierre del
mismo período «sobreescribía los totales pero **conservaba el desglose por moneda del primero**».
Es decir, existe el caso en que las nueve cifras coinciden al céntimo **y el desglose por moneda
está viejo** — y recalcular sí lo reescribe. Si el diálogo dijera «ninguna cifra cambia» ahí,
estaría afirmando algo falso justo antes de una escritura. Por eso:

- El `Alert` de «sin cambios» **solo aparece si además el desglose coincide**.
- Si el desglose difiere, se muestra la línea de aviso de la tabla de estados, **aunque las nueve
  cifras sean idénticas**.

**Lo que este contrato no diseña es la comparación por moneda en detalle** (qué moneda, qué
importe): eso es una segunda tabla y necesita decidir su forma a 320 px. Queda en «Preguntas
abiertas». Lo que no puede faltar es la frase que dice que va a pasar.

**Cómo se elige entre `kind="error"` y `kind="offline"`.** No se deja a criterio del `implementer`:
`offline` cuando `navigator.onLine === false`, o cuando el fallo de la petición es de red (sin
respuesta del servidor: el error de Axios no trae `response`). `error` en cualquier otro caso —es
decir, cuando el servidor **sí** respondió y respondió mal. La distinción importa porque las dos
dan consejos opuestos: una dice «conéctate», la otra dice «reintenta».

**El error deja de cerrar el diálogo, y eso es un cambio de comportamiento deliberado.** Hoy un
fallo de previsualización lanza un toast y cierra: el usuario se queda sin diálogo, sin explicación
persistente y teniendo que volver a encontrar la fila. Con `ErrorState` y su reintento, el error se
arregla donde ocurrió.

**Sin conexión no es un fallo, pero aquí sí es un impedimento, y hay que decir las dos cosas.** Esta
aplicación vende sin conexión; el recálculo, en cambio, es una escritura en el servidor. Por eso el
copy dice a la vez que hace falta conexión **y** que lo ya guardado se sigue viendo: sin esa segunda
frase, el mensaje se lee como «el historial no está disponible».

---

## Shell y componentes reutilizados

| Pieza | Se usa para |
|---|---|
| `PageContainer` | El marco de `/resumen_cierre`. **Sin cambios**: mismo título, subtítulo, migas y `headerActions` |
| `ContentCard` | «Historial de Cierres» (sin cambios) y «Caja por moneda» (cambia su subtítulo a no condicional) |
| `StatusPill` | El estado `Totales desactualizados` en la banda de la card móvil — `hue="caution"`, con `icon` |
| `AppDialog` | Sustituye el `Dialog` a pelo del diálogo de recálculo |
| `LoadingState` | Los dos estados de carga del diálogo (`table` y `list`) |
| `ErrorState` | Los dos estados de fallo del diálogo (`error` y `offline`) |
| `MonedaBreakdownRow` | Dentro de `CajaPorMonedaHistorico`, **tal cual, sin tocar** |
| `Alert` de MUI | El banner de página, el aviso del drawer, el «sin cambios» y el de liquidaciones. El theme ya los pinta con `hue.*.surface` + `hue.*.main`: no se les pone color a mano |
| `Tooltip` de MUI | Los dos textos de la ranura 1 de la columna fija |

**`ActionSheet` se consideró y se descartó para la card móvil.** Es la hoja correcta para *un menú
de varias acciones* sobre un elemento. Aquí hay como mucho una acción, y meterla detrás de un menú
la escondería **un toque más adentro** — que es literalmente el defecto que el humano rechazó
(«en mobile tiene que verse»).

---

## Piezas nuevas

| Pieza | Qué es | Por qué no basta lo que hay |
|---|---|---|
| — | — | — |

**Ninguna.** Los tres componentes de este feature ya existen y se reescriben por dentro contra este
contrato:

- `CierreDesactualizadoChip` — **deja de ser un componente y desaparece.** Hoy empaqueta «chip +
  botón + diálogo» en una sola pieza, y es justamente ese empaquetado el que obligaba a meter el
  estado y la acción **en el mismo sitio**, que es la raíz del rechazo. El estado y la acción tienen
  ahora sitios distintos según el ancho, así que la pieza compartida ya no sirve para nada. Lo que
  queda en su lugar son dos piezas nuevas **dentro de la carpeta de la pantalla**, y ninguna es un
  componente compartido del repositorio:
  - la **banda** de la card móvil,
  - la **celda** de la columna fija.
  El estado del diálogo (`open`) sube a la página, que es quien sabe qué fila lo abrió.
- `RecalcularCierreDialog` — se queda, con el contenedor y los estados de §3.
- `CajaPorMonedaHistorico` — se queda; solo cambia el subtítulo condicional.

---

## Tokens por estado

| Elemento o estado | Token |
|---|---|
| Banda de aviso de la card móvil — fondo | `semantic.hue.caution.surface` |
| Banda de aviso de la card móvil — texto | `semantic.hue.caution.main` |
| `StatusPill` «Totales desactualizados» | `hue="caution"` |
| Glifo `WarningAmber` de la columna fija (pulsable o no) | `semantic.hue.caution.main` |
| Banner de página, aviso del drawer, liquidaciones conservadas | `severity="warning"` → `semantic.hue.caution.surface` + `semantic.hue.caution.main` |
| «Sin cambios» del diálogo | `severity="info"` → `semantic.hue.info.surface` + `semantic.hue.info.main` |
| Columna fija — fondo de cuerpo | `semantic.surface.raised` |
| Columna fija — fondo con el ratón encima | `semantic.surface.sunken` |
| Columna fija — fondo de la celda de Totales | `semantic.surface.sunken` |
| Columna fija — borde izquierdo | `semantic.surface.border` |
| Valor guardado tachado (diálogo) | `semantic.text.disabled` |
| Valor recalculado que cambia | `semantic.text.primary`, peso 700 |
| Diferencia | `semantic.hue.caution.main` |
| Fila que no cambia | `semantic.text.secondary` |
| Rótulos de cifra | `semantic.text.secondary` |
| `IconButton` «Ver detalles» | `color="primary"` → el acento; es lo pulsable |

**Ni un `#RRGGBB` ni un `rgba()` en ninguna de las piezas de este contrato**, incluidos los fondos
de las celdas fijas, que es donde más tienta escribir un blanco a mano para tapar lo de debajo.

**El violeta no aparece en nada de este feature salvo en «Ver detalles».** El desfase es `caution`,
no acento: el acento está reservado a acción y selección, y teñir de violeta un estado haría que la
pantalla dejara de poder decir qué es pulsable.

---

## Estados

Los estados de la **pantalla** (carga, vacío, error del listado) son deuda anterior y están
declarados fuera de alcance. Esta tabla cubre las piezas de este contrato:

| Estado | Qué se muestra |
|---|---|
| Diálogo — cargando | `LoadingState variant="table" count={9} columns={4}` (≥ `sm`) / `variant="list" count={9}` (320 px) |
| Diálogo — sin cambios | La comparación completa + `Alert severity="info"`. **No es un vacío** |
| Diálogo — error | `ErrorState kind="error"` con `onRetry`, dentro del diálogo, que no se cierra |
| Diálogo — sin conexión | `ErrorState kind="offline"` con `onRetry` |
| Diálogo — aplicando | `busy` + `confirm.loading`; sin salida hasta que termine |
| Lista — ninguna fila desactualizada | **Nada.** Sin banner, sin ranura 1, sin banda. Un aviso que dice «todo bien» convierte el aviso real en ruido |
| Drawer — cierre al día | Sin `Alert` de desfase. El resto del drawer, igual |
| Columna fija — sin permiso de recálculo | La ranura 1 se dibuja igual, no pulsable, con el tooltip que dice quién puede |

---

## Destinos táctiles

| Control | Tamaño |
|---|---|
| `IconButton` «Ver detalles» de la tabla | **44 × 44** en los tres anchos. Hoy es `size="small"` (~30 px) |
| `IconButton` «Ver detalles» de la card móvil | **44 × 44**. Hoy es `size="small"` |
| Ranura 1 de la columna fija (pulsable o no) | **44 × 44**, para que la fila mida igual con y sin acción |
| Botón `Recalcular` de la card móvil | Alto ≥ **44**, `fullWidth` |
| Botón `Recalcular` del drawer | Alto ≥ **44**; `fullWidth` a 320 px |
| Botones `Recalcular` / `Cancelar` del diálogo | Los de `AppDialog`, ya ≥ 44 |
| Fila de fechas de la card móvil | Alto ≥ **56** (`touch.row`). La superficie tappable es la card entera menos la banda |

**`Table size="small"` entre 600 y 900 px no baja ningún destino.** `isTablet` puede seguir
comprimiendo el interlineado de las celdas de datos; **los controles de la columna `Acciones` se
quedan en 44 × 44 en los tres anchos**. Es la trampa exacta que `AGENTS.md` señala en
`/resumen_cierre` («una fila de 40 px que rompe el piso de 44»), y esta vez la fila la fija el
contenido de la columna de acciones, no el `size` de la tabla.

---

## Prohibiciones de copy

| Nunca | Porque |
|---|---|
| `Error en los totales`, `Cifras incorrectas`, `Datos corruptos` | Las cifras guardadas **no están mal**: son correctas para el momento en que se guardaron, y el ADR 0036 las llama «la fuente de verdad». Lo que pasa es que las ventas cambiaron después. Decir «error» manda a buscar un fallo que no existe |
| `Recalcular` sin más, como única palabra del aviso a un rol sin permiso | Nombra una acción que ese usuario no puede hacer y no dice quién sí. El tooltip **tiene** que terminar en `Solo un superadministrador puede recalcularlas.` |
| Un recuento sin «de esta página» en el banner | La respuesta solo trae los cierres de la página actual. Un `3 cierres desactualizados` a secas afirma algo sobre todo el historial que la pantalla no sabe |
| `≈ Base`, `Total`, `Equivalente` como **único** rótulo del bloque de caja | Es el agravante literal del ADR 0036: ese número incluye fondo inicial y propinas, y sin la frase `No es el total de ventas.` se lee como el total de ventas |
| `Se van a borrar`, `Se pierden los datos` en el diálogo | El recálculo re-deriva desde datos primarios y **conserva** las liquidaciones ya pagadas. Prometer una pérdida que no ocurre frena el paso que el ADR llama obligatorio |
| `Sin cambios` como **sustituto** de la comparación | Si el diálogo se queda sin la tabla, no hay forma de distinguir «no cambia nada» de «no se pudo calcular nada» |
| `Todo al día`, `Cifras verificadas` cuando no hay desfase | Un aviso permanente que dice que todo va bien convierte el aviso real en ruido de fondo, y el ADR 0036 existe para que el desfase **destaque** |

---

## Preguntas abiertas

1. **`DesignSync` no estaba disponible en esta sesión, así que cuatro decisiones no se contrastaron
   contra el artboard aprobado.** Antes de lanzar al `implementer` sobre ellas hay que abrir
   `rediseno/resumen-cierres.html` y `rediseno/resumen-cierres-movil.html` y comprobar:
   - **El tratamiento de la columna fija**: si el artboard la dibuja fijada, y con qué borde o
     sombra en la costura. Este contrato eligió `borderLeft` de 1 px en `semantic.surface.border`,
     sin sombra, y 112 px de ancho.
   - **El tratamiento de las acciones en la card móvil**: si el artboard dibuja una banda, una fila
     de acciones al pie, o un menú. Este contrato eligió la banda a ancho completo entre la
     cabecera y la rejilla.
   - **La ubicación del aviso dentro del drawer** y la posición del bloque «Caja por moneda». Se
     dejó constancia de que **el artboard no cubre el drawer**, así que probablemente no haya nada
     que contrastar — pero conviene confirmarlo antes de darlo por decidido.
   - **El layout del diálogo de recálculo**, que tampoco aparece en la nota de la sesión que sí leyó
     el artboard.
2. **`MonedaBreakdownRow` a 320 px.** Sus cuatro figuras (Fondo inicial / Efectivo / Transferencia /
   ≈ Base) van hoy en una fila con `flexWrap` y `gap={3}`: en 280 px útiles envuelven en un bloque
   desalineado que se lee peor que una rejilla de dos columnas. **Este contrato no lo cambia** porque
   la pieza es compartida con `/cierre`, que tiene su propio artboard aprobado
   (`rediseno/cierre-caja-movil.html`) y **tampoco se pudo abrir**. ¿Se arregla aquí, asumiendo que
   el cambio cae también sobre `/cierre`, o se abre un feature propio para esa pieza?
3. **Los cierres cerrados por el motor anterior** (`totalsComputedAt = NULL`) se marcan como
   desactualizados aunque sus cifras coincidan al céntimo. El ADR 0036 asume ese coste hasta que se
   ejecute `scripts/recalculate-cierres.ts --apply`. Si ese script todavía no se corrió en
   producción, **el aviso va a salir en casi todas las filas del historial**, y este diseño —pensado
   para señalar la excepción— señalaría la norma. ¿Se corrió ya? Si no, ¿el banner de página debería
   distinguir «desfase real» de «cerrado con el motor anterior»? La respuesta trae los dos datos
   (`drifted` y `totalsComputedAt`), así que la distinción es posible; **este contrato no la diseña
   porque no sabe cuál de los dos casos es el frecuente.**
4. **La comparación del desglose por moneda.** La respuesta trae `resumenBefore` y `resumenAfter` y
   este contrato solo diseña **la frase** que avisa de que el desglose también se reescribe, no la
   comparación en sí. Mostrarla entera son dos importes por moneda por fila y necesita decidir su
   forma a 320 px, donde la comparación de las nueve cifras ya ocupa la pantalla. ¿Hace falta, o
   basta con la frase? Lo que **no** puede quedarse es que el diálogo diga «ninguna cifra cambia»
   con el desglose desactualizado (**E-017**), y eso este contrato ya lo cierra.
5. **Recálculo desde un rol distinto.** Un `ADMIN` que ve el aviso y no puede hacer nada se queda
   con «pídeselo a un superadministrador» y ninguna forma de pedirlo desde la pantalla. ¿Es
   aceptable, o hace falta un camino (una vía de contacto, una nota)? Este contrato asume que sí es
   aceptable, porque el ADR 0036 restringe la acción por seguridad y no menciona ninguna solicitud.

---

## Criterios de diseño verificables en navegador

> Los ejecuta el agente `qa` a **320, 768 y 1440 px**, con un cierre que tenga
> `totalesDesactualizados: true` y otro que no. Cada línea se comprueba **midiendo**, no opinando.
> Los tres anchos se miden en un iframe del mismo origen con `flex: 0 0 auto` (**E-005**), y el
> contenedor de la página se localiza sin `.MuiContainer-root` a secas (**E-011**).

1. A **320 px** no hay desplazamiento horizontal en `/resumen_cierre`: `document.documentElement.scrollWidth ≤ clientWidth`.
2. A **320 px** se renderizan `Card` por cierre y **no existe ningún `<table>`** en el «Historial de Cierres». A **768** y **1440 px** existe el `<table>` y no hay `Card` por cierre.
3. A **768 px**, con el `TableContainer` desplazado a su extremo derecho (`scrollLeft = scrollWidth - clientWidth`), **la celda de cabecera `ACCIONES` y todos los `IconButton` de esa columna siguen dentro del rectángulo visible del contenedor**. Se repite a **1440 px** con la ventana estrechada hasta forzar el desbordamiento.
4. A **768 px**, con el `TableContainer` desplazado a la izquierda del todo (`scrollLeft = 0`), la columna `Acciones` **sigue en el mismo sitio** que en el paso 3: su `getBoundingClientRect().right` no varía más de 1 px entre los dos desplazamientos.
5. La celda de la columna `Acciones` mide **112 px de ancho** en `768` y `1440 px`, con y sin el permiso `operaciones.cierre.gananciascostos`.
6. Con el `TableContainer` desplazado a la derecha, **ningún importe de las columnas de datos se ve por debajo de la columna `Acciones`**: el `backgroundColor` computado de una celda de cuerpo de esa columna no es `transparent` ni `rgba(0,0,0,0)`, y lo mismo para su celda de cabecera y para la **última celda de la fila de Totales**.
7. Pasando el ratón por encima de una fila a **1440 px**, el `backgroundColor` computado de su celda de `Acciones` **es el mismo que el del `<tr>`** de esa fila. (Se compara contra la fila, no contra las celdas de datos: esas no tienen fondo propio y su valor computado es siempre transparente, así que compararlas nunca podría dar igual — **E-016**.)
8. Cada `IconButton` de la columna `Acciones` mide **≥ 44 × 44 px** en `768` y `1440 px`, incluido el rango 600–900 px donde la tabla usa `size="small"`.
9. En una fila con `totalesDesactualizados`, sesión **`SUPER_ADMIN`**: la celda `Acciones` contiene **dos** destinos de ≥ 44 × 44 y el primero abre el diálogo `Recalcular cierre` al pulsarlo.
10. La misma fila, sesión **sin `SUPER_ADMIN`**: la celda `Acciones` sigue mostrando el glifo de aviso en la misma posición y del mismo color, **no responde al clic**, y su tooltip contiene la subcadena `Solo un superadministrador`.
11. En una fila **sin** `totalesDesactualizados`, la celda `Acciones` contiene **un solo** destino táctil y ningún glifo de aviso.
12. A **320 px**, en una card con `totalesDesactualizados`, la banda de aviso está **entre la fila de fechas y la primera cifra** de la rejilla (su `getBoundingClientRect().top` es mayor que el de la fila de fechas y menor que el de la celda «Ventas»).
13. A **320 px**, esa banda ocupa **todo el ancho interior de la card** (± 2 px) y su texto no se recorta: `scrollWidth ≤ clientWidth` en el elemento de la banda.
14. A **320 px**, sesión `SUPER_ADMIN`: el botón `Recalcular` de la banda mide **≥ 44 px de alto** y ocupa el ancho completo de la banda.
15. A **320 px**, sesión sin `SUPER_ADMIN`: la banda existe y **no contiene ningún `<button>`**.
16. Cuando al menos una fila de la página tiene `totalesDesactualizados`, existe un `Alert` de severidad `warning` cuyo texto contiene la subcadena `de esta página`, situado **entre el `TasasBanner` y la tarjeta de filtros** (comparación de `top`), en los tres anchos. Cuando ninguna la tiene, ese `Alert` **no existe en el DOM**.
16b. A **320 px**, con la página sin desplazar (`scrollY = 0`), ese `Alert` está **completamente dentro del viewport**.
17. En el drawer de un cierre desactualizado, el `Alert` de desfase es **el primer** elemento del cuerpo desplazable: su `top` es menor que el del `TasasBanner` y que el del selector de moneda, en los tres anchos.
18. A **320 px**, en ese drawer y con sesión `SUPER_ADMIN`, el botón `Recalcular` del aviso ocupa el ancho completo del `Alert` y mide **≥ 44 px de alto**.
19. El `ContentCard` «Caja por moneda» muestra el subtítulo `Fondo inicial + cobros − deducciones. No es el total de ventas.` **en los tres anchos, incluido 320 px**.
20. En el drawer, el bloque «Caja por moneda» está **después** del `StatStrip` y **antes** de «Productos Vendidos» (comparación de `top`), en los tres anchos.
21. El diálogo de recálculo es **`fullScreen` a 320 px** (su `Paper` ocupa el 100 % del viewport) y flotante a `768` y `1440 px`.
22. Mientras carga la previsualización, el diálogo muestra **esqueletos** (`MuiSkeleton` presente) y **ningún `MuiCircularProgress`** en el árbol del diálogo.
23. Con la previsualización cargada, el diálogo muestra **nueve** filas de cifras en los tres anchos. A `768` y `1440 px` la tabla tiene **cuatro** columnas (`Cifra`, `Guardado`, `Recalculado`, `Diferencia`); a **320 px no existe ningún `<table>`** dentro del diálogo.
24. En una fila que cambia, el valor de `Guardado` tiene `text-decoration: line-through` computado, y la celda `Diferencia` muestra un importe con signo. En una fila que no cambia, `Diferencia` muestra `—` y no hay tachado.
25. Con una previsualización en la que ninguna cifra cambia **y `resumenBefore` es igual a `resumenAfter`**, el diálogo muestra un `Alert` de severidad `info` cuyo texto contiene `vuelve a sellar la fecha de cálculo`, y el botón `Recalcular` **está habilitado**.
25b. Con una previsualización en la que las nueve cifras coinciden pero `resumenBefore` **difiere** de `resumenAfter`, ese `Alert` de `info` **no aparece**, y sí aparece la línea que contiene `El desglose por moneda`.
26. Cortando la red en las herramientas de desarrollo y abriendo el diálogo, **sigue abierto**, muestra el estado **`offline`** (título `Sin conexión`) con su botón de reintento, y `Recalcular` está deshabilitado. Forzando en cambio una respuesta `500` del servidor, muestra el estado **`error`** (título `No se pudo previsualizar el recálculo`). **Los dos casos son distinguibles en pantalla.**
27. Mientras se aplica el recálculo, el diálogo no se puede cerrar: `Escape` y el clic en el fondo no lo cierran, y el botón de confirmar muestra su estado de carga.
28. Tras aplicar un recálculo desde el drawer, el drawer se cierra y la fila correspondiente de la lista **ya no muestra** el glifo de aviso ni la banda.
29. `npx eslint` sobre los archivos tocados **no reporta ninguna de las tres reglas `no-restricted-syntax` de color**: ni un `#RRGGBB` ni un `rgba()` dentro de `sx`.
30. A **320 px**, ningún elemento de la pantalla ni del drawer tiene `scrollWidth > clientWidth` en horizontal, incluidos la banda de aviso, el `Alert` del drawer y el cuerpo del diálogo.
