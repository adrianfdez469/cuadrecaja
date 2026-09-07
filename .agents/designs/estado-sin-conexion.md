# estado-sin-conexion: diseño de «El estado de sin conexión tiene que verse»

> Escrito por el agente `ui-designer`. **Mobile-first: primero 320 px.**
> Sin código, sin `sx`, sin JSX: el `implementer` ejecuta este contrato.
> **Todo color que este contrato especifica se nombra con su ruta `semantic.*`, y ningún
> `#RRGGBB` puede acabar en `src/`.** Los valores literales que sí aparecen más abajo están en
> dos sitios y solo en esos dos: en las tablas de contraste, donde el número medido no se
> entiende sin el valor que se midió, y en los criterios verificables, donde el `qa` compara
> contra un `color` computado y el navegador solo devuelve `rgb(...)`. Ninguno de los dos es una
> especificación de color.
>
> **Ajuste transversal.** No tiene entrada en `.agents/features.json` y por eso no tiene `F-###`:
> nace de una decisión directa del humano — «el estado de sin conexión debería ser un poco más
> visible, por ejemplo ponerlo de otro color; dejar elegir el color correcto al designer». Se usa
> la plantilla `.agents/designs/TEMPLATE.md` igualmente.

---

## Fuentes

- **El encargo del humano**, literal: el indicador **persistente** es el que no se ve. El banner
  transitorio no es el problema.
- `src/hooks/useStoreStatus.ts` entero, **incluido su docstring**, que fija la premisa que este
  contrato no toca: *«la línea se queda vacía mientras todo va bien, y por eso se puede confiar en
  ella cuando no lo está»*.
- `src/components/nav/StoreStatus.tsx` — hoy `fontSize: "0.6875rem"`, `color: "text.secondary"`,
  sin glifo, sin peso propio.
- `src/app/pos/components/CartAccountTabs.tsx` — `STATUS_SX` (líneas 105-113) y el
  `storeStatus?.split(" · ")` de la línea 215, que reconstruye por texto lo que el hook acababa de
  unir por texto.
- `src/components/OfflineBanner.tsx` — el canal transitorio, `severity="warning"` / `"success"`.
- `src/components/Layout.tsx:923-975` — la `AppBar`, su `Toolbar` de 56/64 px, y quién comparte
  fila con `StoreStatus`.
- `src/components/nav/PeriodBadge.tsx` — **oculto por debajo de `md`**, dato que cambia el
  presupuesto de ancho a 320 px (ver «El ancho contado de la barra»).
- `src/store/salesStore.ts` — `Sale.synced` y `Sale.syncState` (`"synced" | "syncing" |
  "not_synced" | "sync_err"`). El hook cuenta hoy `!sale.synced`, que agrupa las tres últimas.
- `src/theme/tokens.ts` y `src/theme/index.ts` **enteros, con sus comentarios**. De ahí salen:
  el mapa `syncRoles` (línea 169), el comentario del `MuiAppBar` sobre por qué su hairline es un
  `boxShadow: inset` y no un `border`, y `touch.min = 44`.
- `src/components/StatusPill.tsx` — sus props reales (`label`, `hue`, `caps`, `icon`, `sx`) y su
  altura fija de 22 px.
- `src/components/qab/QabRowSummary.tsx` y `src/components/qab/QabNegocioPanel.tsx` — **los únicos
  consumidores de `semantic.sync.*` que hay hoy en el repositorio**. Son el precedente de uso.
- `AGENTS.md`, `.agents/designs/TEMPLATE.md`, `.agents/designs/recalculo-cierres.md` (formato).
- `.agents/COMMON_ERRORS.md` — índice, y las fichas **E-005** (los tres anchos se miden en un
  iframe del mismo origen con `flex: 0 0 auto`; `resize_window` no cambia el viewport),
  **E-011** (medir el elemento que **es** lo que se busca, no el primero que aparece),
  **E-016** (una subcadena exigida puede existir ya en otro copy de la misma ruta) y **E-010**
  (nada de bloques de código con comentarios en español en un contrato: **por eso aquí no hay
  ninguno; toda la especificación va en tablas y prosa**).

**Este ajuste no declara `requires_docs`** y no depende de documentación externa.

---

## El diagnóstico, antes de la decisión

La línea de estado no se ve **y no es un problema de contraste**. Medido:

| Lo que hay hoy | Contraste sobre `surface.raised` |
|---|---|
| `text.secondary` claro (`#5F5E68`) a 11 px | **6,39:1** — clava AA de sobra |
| `text.secondary` oscuro (`#A6A5AE`) a 11 px | **6,86:1** |

O sea: **el gris se lee perfectamente; lo que no hace es distinguirse**. En esa misma barra, el
`PeriodBadge`, la píldora de moneda y media aplicación usan exactamente `text.secondary`. «Sin
conexión» está escrito con la misma tinta con la que la interfaz dice cosas que no importan, en el
tamaño más pequeño de la pantalla, y sin ninguna forma propia. No se pasa por alto por tenue: se
pasa por alto porque **parece un rótulo más**.

Eso decide la forma del arreglo. Subir el contraste no serviría de nada —ya está en 6,4:1—. Lo que
hace falta es **sacar la línea del vocabulario de «rótulo secundario»**: tinta propia, peso propio,
glifo propio, y una señal ambiental que no dependa de que alguien esté mirando esas 11 px.

---

## La decisión de color

### El color es `semantic.sync.offline` — el rol que ya existía y nadie enchufó

`src/theme/tokens.ts:167-174` ya define `SyncRole` y ya mapea **`offline → caution`**. El mapa es
correcto y este contrato **no lo deroga**: lo enchufa donde debía haber estado desde el principio.

**Se nombra por su rol derivado, nunca por la tinta cruda.** En este contrato no aparece
`semantic.hue.caution.main` ni una sola vez: aparece `semantic.sync.offline.main`. Es la regla del
sistema —«usa el rol derivado, no la tinta cruda»— y aquí además evita un error concreto: si mañana
se decide que el offline debe leerse distinto, se cambia una línea del mapa y no se persigue una
tinta por cinco archivos.

**Por qué `caution` es correcto y no hay que rehacer el mapa:**

| Alternativa | Por qué se descarta |
|---|---|
| `negative` (rojo) | **Sin conexión no es un fallo.** `AGENTS.md` lo dice literalmente («offline es un estado normal, no un fallo: esta app vende sin conexión») y el sistema ya lo codifica: `ErrorState` tiene `kind="offline"` **separado** de `kind="error"` justo porque dan consejos opuestos. Pintar de rojo la barra de un POS que está funcionando exactamente como fue diseñado le dice al comerciante que pare de vender |
| `neutral` | Es, en la práctica, lo que hay hoy: `neutral.main` (`#5B5A63`) y `text.secondary` (`#5F5E68`) son el mismo gris a efectos de lectura. Sería no cambiar nada |
| `info` (azul) | Ya está tomado por `syncing`. Y el azul se lee como «para tu información», que es exactamente el registro en el que la línea lleva perdiéndose todo este tiempo |
| `accent` (violeta) | **Prohibido.** El acento está reservado a acción y selección. Un estado violeta rompe la única regla que permite a la pantalla decir qué es pulsable |
| `positive` | No procede |

`caution` es la única de las seis que dice «esto merece tu atención y no está roto». Es la misma
lectura que el sistema ya le da a `stock.low`, a `subscription.grace` y a `flow.correction`.

### Contraste medido, en los dos esquemas

Calculado sobre la superficie real en la que se dibuja cada cosa. La `AppBar` usa
`surface.raised` (`Layout.tsx:929` pone `background.paper`, que el theme resuelve a
`surface.raised`); **el panel del carrito también es `surface.raised`** — `desktopPanelSx` de
`src/app/pos/page.tsx:123-128` pone `backgroundColor: "background.paper"`, y la variante `drawer`
se monta sobre el `paper` del `MuiDrawer`, que el theme pinta con el mismo token. Las dos
superficies son la misma, así que hay un solo número por esquema.

| Elemento | Sobre | Claro | Oscuro | Umbral | Veredicto |
|---|---|---|---|---|---|
| Texto de estado a **12 px**, `sync.offline.main` | `surface.raised` | **5,91:1** | **7,10:1** | 4,5:1 (texto normal) | **Pasa** |
| Regla de 2 px bajo la `AppBar`, `sync.offline.main` | `surface.raised` (arriba) | 5,91:1 | 7,10:1 | 3:1 (no textual) | **Pasa** |
| La misma regla | `surface.page` (abajo) | 5,53:1 | 7,76:1 | 3:1 | **Pasa** |
| Glifo de 14 px, `sync.offline.main` | `surface.raised` | 5,91:1 | 7,10:1 | 3:1 | **Pasa** |

**A 12 px el texto es «normal», no «grande»** (grande son 18,66 px en negrita o 24 px), así que el
umbral aplicable es 4,5:1 y no 3:1. Se cumple con margen en los dos esquemas y **no hace falta
ajustar ni el token ni el tamaño**.

**El esquema oscuro está verificado aunque no esté montado.** `src/theme/index.ts:445` construye
`darkTheme` y no lo monta. `caution` es, con 7,10:1, **el mejor contrastado de los seis** en
oscuro: cuando se monte, esta decisión ya está tomada y no hay que revisarla.

### Lo que NO sirve, y está medido: la píldora sola

Se evaluó sustituir la línea por un `StatusPill`. **El lavado de una píldora es invisible sobre
esta barra:**

| Fondo de píldora sobre `surface.raised` | Claro | Oscuro |
|---|---|---|
| `hue.caution.surface` | **1,10:1** | **1,06:1** |

Un fondo a 1,10:1 no es un elemento perceptible: quien haga el trabajo de visibilidad es la tinta,
no la píldora. Así que la píldora **costaría ancho de barra sin comprar visibilidad**. Se descarta
como pieza principal (ver «El ancho contado de la barra»).

---

## Lo que este ajuste NO diseña

- **`OfflineBanner`.** Es el canal transitorio y ya está en el vocabulario correcto: su
  `severity="warning"` lo resuelve el theme a `hue.caution.surface` + `hue.caution.main`, que es la
  misma tinta que este contrato elige, y su `severity="success"` de reconexión coincide con
  `sync.online`. **No se toca ni una línea**, ni su auto-ocultado de 3 s, ni su copy.
- **`useNetworkStatus`.** Su retardo de 1 s antes de declarar offline, sus 5 s de gracia y su
  sondeo de 30 s se quedan exactamente como están. Este contrato no cambia **cuándo** se está
  offline, solo **cómo se ve** que lo estás.
- **La lógica de sincronización**, `salesStore`, los reintentos de Axios y el tratamiento de
  `syncState: "sync_err"`. Ver «Preguntas abiertas», punto 1.
- **La primera línea de `StoreStatus`** — el nombre del local, 14 px, peso 600, con elipsis. Igual
  en los tres anchos.
- **El resto de la `AppBar`**: `PeriodBadge`, la píldora de moneda, `NotificationBell`, el avatar,
  el botón de menú y el `zIndex` condicional. Ninguno cambia de tamaño, de sitio ni de color.
- **El `boxShadow` por defecto del `MuiAppBar` en el theme** (`inset 0 -1px 0 surface.border`). Se
  queda tal cual; lo que este contrato pide es una **sobrescritura condicional en `Layout.tsx`**,
  que solo existe mientras se está sin conexión. El theme no puede conocer el estado de la red.
- **`StatusPill`, `ErrorState`, `EmptyState`, `LoadingState`, `AppDialog`.** Ninguno se toca.
- **La deuda de `useNetworkStatus` de los otros seis consumidores** (`PosProductGrid`,
  `SaleDoneView`, `pos/page.tsx`, `PedidoStatusActions`, `useTiendaOnlineOrders`). Este contrato
  cubre **el indicador persistente de estado del local**, no todos los sitios que consultan la red.
- **Montar el tema oscuro.** Verificado, no montado. Sigue siendo trabajo de la fase 4 de la
  migración de color.

---

## Superficies afectadas

| Superficie | Dónde | Nueva o existente |
|---|---|---|
| Línea de estado de la barra superior | `StoreStatus`, dentro de la `AppBar` del `Layout` | **cambia** — tinta, peso, tamaño, glifo, y dos unidades en vez de una cadena |
| Hairline inferior de la barra superior | `AppBar` del `Layout` | **cambia** — se tiñe mientras se está sin conexión |
| Estado en la cabecera del panel del carrito | `CartAccountTabs`, en el POS | **cambia** — mismo tratamiento; deja de partir una cadena por « · » |
| Contrato del hook | `useStoreStatus` | **cambia** — devuelve estado, no una frase ya montada |

---

## El contrato del hook — de una frase a un estado

Es la pieza que hace posible todo lo demás, y es un cambio de forma, no de comportamiento.

Hoy `useStoreStatus` devuelve `string | undefined` con las dos ideas **ya pegadas por « · »**, y
`CartAccountTabs` las vuelve a separar partiendo por ese mismo separador. Mientras el estado sea
una frase, **es imposible dar a cada mitad su glifo, su etiqueta accesible y su comportamiento a
320 px**: no hay nada que consultar, solo texto que volver a trocear.

**Pasa a devolver un objeto, o `undefined` cuando todo va bien:**

| Campo | Tipo | Significado |
|---|---|---|
| `offline` | booleano | No se alcanza el servidor |
| `pendingSales` | número | Ventas registradas que aún no están en el servidor. `0` si no hay ninguna |

**Se devuelve `undefined` —y no un objeto con los dos campos en falso— cuando no pasa nada.** Es
literalmente la premisa que el docstring del hook defiende y de la que depende que la línea sea
creíble: quien consume el hook pregunta «¿hay algo que decir?» y la respuesta sigue siendo un
`if`, no una comparación de dos campos. **Esa premisa no se toca, se preserva.**

**Consecuencias que el `implementer` hereda:**

- `CartAccountTabs` **pierde el `split(" · ")`** de su línea 215. Deja de existir el acoplamiento
  por separador entre el hook y sus dos consumidores.
- La cadena `« · »` **desaparece del producto**. Ningún consumidor la vuelve a componer: la
  separación entre las dos unidades pasa a ser un hueco de maquetación, no un carácter.
- El copy visible de cada unidad se especifica más abajo y **no cambia respecto de hoy** en su
  forma larga.

---

## La decisión sobre las dos ideas: sí se distinguen, y no se gradúan

Son dos hechos distintos y hoy se dicen como si fueran uno:

| Estado | Qué afirma | Puede darse solo |
|---|---|---|
| **Sin conexión** | No se alcanza el servidor. Es una **condición** del entorno, y la app está diseñada para trabajar así | Sí — sin conexión y sin nada pendiente, nada más entrar |
| **N sin subir** | Hay ventas registradas que solo existen en este dispositivo. Es una **deuda**, y sobrevive a la reconexión hasta que se drena | **Sí, y este es el caso que hoy se pierde**: con conexión, «3 sin subir» significa que la sincronización no está avanzando |

Se separan así:

- **En dos unidades independientes**, cada una con su glifo, no una cadena con un punto medio.
- **Con la misma tinta.** Ninguna de las dos es peor que la otra: una cola de ventas no es un
  fallo, es el diseño funcionando. Darle rojo a «N sin subir» diría que algo se rompió cuando lo
  que pasa es que el POS hizo su trabajo. La distinción la carga el **glifo y la palabra**, que es
  el criterio de accesibilidad correcto (no depender solo del color) y además el criterio del
  propio sistema: *«un estado nuevo pide un significado, no un color nuevo»*.
- **Con roles distintos, aunque compartan tinta.** `Sin conexión` usa `semantic.sync.offline`;
  `N sin subir` usa **`semantic.sync.pending`**, que hay que añadir (ver «Piezas nuevas»). Pintar
  una cola de ventas con un rol que se llama literalmente `offline` sería mentira en el caso que
  más importa: **la cola con conexión**.
- **Con jerarquía de refuerzo, no de color.** El **offline** es una condición de todo el aparato y
  por eso además tiñe la regla de la barra; el **pendiente** es un contador y se queda en su línea.
  Esa es la distinción visible más fuerte entre las dos, y no gasta ni un color más.

---

## La barra superior — `StoreStatus`

### Qué resuelve

Que quien está cobrando **se entere de que la caja no está hablando con el servidor sin tener que
ir a buscarlo**, mirando la única zona de la pantalla que ya mira todo el rato: el nombre de su
local.

### El ancho contado de la barra

El humano avisa —con razón— de que la fila está apretada. Medido a **320 px**, y sabiendo que
`PeriodBadge` está oculto por debajo de `md` y la píldora de moneda por debajo de `sm`:

| Ocupante | Ancho |
|---|---|
| Padding del `Toolbar` | ~32 px (2 × 16) |
| Botón de menú | 44 px |
| Campana de avisos | 44 px |
| Avatar de usuario | 44 px |
| **Queda para el bloque del local** | **~156 px** |

Ese bloque tiene que caber el nombre del local **y** la línea de estado. Por eso:

- **Nada de píldora en la barra.** Ya está descartada por invisible (1,10:1 de lavado), y además
  cuesta 22 px de alto y su padding horizontal. Aquí se paga dos veces por nada.
- **El glifo va delante del texto, siempre.** El texto de la línea recorta por la derecha
  (`textOverflow: "ellipsis"`), así que un glifo a la izquierda **sobrevive a cualquier recorte**.
  Un glifo detrás sería lo primero en desaparecer, justo en el ancho donde más falta hace.
- **La segunda línea no compite en horizontal con nada**: cuelga bajo el nombre, dentro del mismo
  bloque. Lo único que se gasta en vertical es 1,3 px, y el `Toolbar` de 56 px tiene sitio (nombre
  17,5 px + estado 15,6 px ≈ 33 px de contenido).

### La línea de estado, en detalle

| Propiedad | Hoy | Pasa a ser |
|---|---|---|
| Tamaño | `0.6875rem` (11 px) | **`0.75rem` (12 px)** |
| Peso | heredado (400) | **600** |
| Color | `text.secondary` | **`semantic.sync.offline.main`** en la unidad de conexión, **`semantic.sync.pending.main`** en la de cola |
| Glifo | ninguno | **sí**, delante de cada unidad, 14 px (`fontSize: "0.875rem"`), tinta heredada de su unidad, `flexShrink: 0`, decorativo para lectores de pantalla |
| Estructura | una cadena | **fila de hasta dos unidades**, hueco de 8 px entre ellas |
| Recorte | `nowrap` + elipsis | igual, sobre la fila entera, con `minWidth: 0` |
| Semántica accesible | ninguna | la línea es una **región de estado que se anuncia con cortesía** al cambiar |

**El glifo de cada unidad:**

| Unidad | Glifo | Por qué |
|---|---|---|
| Sin conexión | `CloudOff` | Es el que la aplicación ya asocia a «no llega al servidor» |
| N sin subir | `CloudUpload` | Nombra exactamente lo que falta: subir. `Sync` diría que está pasando algo ahora mismo, y puede que no |

**Ninguno de los dos glifos parpadea, gira ni se anima.** Un indicador con movimiento en la barra
de un POS se convierte en ruido en el primer minuto de turno, y hay que respetar
`prefers-reduced-motion`. El estado es estático porque el estado es estable.

**El bloque entero (`StoreStatus`) sigue siendo un solo destino táctil que navega a `/home`.** La
línea de estado no es pulsable por su cuenta: no hay ninguna acción que ofrecer —la
sincronización es automática— y un segundo destino de 44 px dentro de un `Toolbar` de 56 px no
cabe. Ver «Preguntas abiertas», punto 2.

### 320 px

Las dos unidades a texto completo no caben en 156 px (≈188 px medidos). **Y no se comprimen: la de
la cola pierde sus palabras y se queda en glifo + número.**

| Estado | Qué se ve a 320 px |
|---|---|
| Solo sin conexión | `CloudOff` + `Sin conexión` |
| Solo cola | `CloudUpload` + `3 sin subir` — a texto completo: es la única unidad de la fila y cabe |
| **Las dos** | `CloudOff` + `Sin conexión` · hueco de 8 px · `CloudUpload` + `3` |
| Nada | **La segunda línea no se dibuja.** Ni un glifo, ni un guion, ni «En línea» |

**Por qué se abrevia la cola y no la conexión.** «Sin conexión» es la frase que **explica**;
«3 sin subir» es un **número con una etiqueta**. Cuando hay que soltar lastre se suelta la
etiqueta, nunca la explicación. Un `3` suelto junto a una nube con flecha se entiende; un `Sin`
recortado no.

**El número abreviado no se queda mudo:** la unidad lleva su etiqueta accesible completa,
`3 ventas sin subir`, para lector de pantalla y para el `title` del puntero. Un número sin unidad
solo es ambiguo si no hay forma de resolverlo.

### 768 px

Las dos unidades **a texto completo**: `CloudOff Sin conexión` · `CloudUpload 3 sin subir`. Desde
`sm` el bloque del local recupera ancho (aparece la píldora de moneda pero desaparece la presión de
los 320 px), y las dos frases caben sin recortar.

### 1440 px

Idéntico a 768. La única diferencia de la barra a este ancho es que `PeriodBadge` ya se dibuja, y
está **después** del bloque del local: no le quita ancho, porque el bloque es `flex: 0 1 auto` y
solo cede cuando la fila se queda sin sitio, cosa que a 1440 px no pasa.

### El refuerzo ambiental: la regla inferior de la barra

**Mientras se está sin conexión**, el hairline inferior de la `AppBar` deja de ser
`surface.border` y pasa a **`semantic.sync.offline.main`, con 2 px de grosor**.

| Propiedad | Valor |
|---|---|
| Cuándo | **Solo cuando `offline` es cierto.** No con cola pendiente y conexión |
| Color | `semantic.sync.offline.main` |
| Grosor | 2 px |
| Mecánica | **Una sombra interior de la propia barra, nunca un `border`** |
| Dónde se declara | En la sobrescritura `sx` de la `AppBar` en `Layout.tsx`, no en el theme |
| Animación | **Ninguna** |

**Que sea sombra interior y no borde no es un detalle de implementación: es el error que el propio
theme documenta.** El comentario del `MuiAppBar` (`src/theme/index.ts:204-209`) explica que un
borde hacía la barra de 57/65 px «mientras cada pantalla que llena el viewport (el POS) resta
56/64, y ese píxel bastaba para que la página entera se desplazara». **Un borde de 2 px repetiría
ese fallo por partida doble, y solo mientras se está sin conexión** — es decir, un desplazamiento
fantasma que aparece y desaparece con la red y que nadie sabría reproducir.

**Por qué esta pieza existe.** Es la única señal de este contrato que **no depende de que alguien
esté leyendo 12 píxeles de texto**: cruza los 320 px de ancho de la pantalla, está en el borde
donde la vista entra a la aplicación, y no cuesta ni un píxel de la fila apretada. Es exactamente
lo que el humano pidió —que se vea— resuelto donde había presupuesto.

**Por qué no se dibuja con la cola pendiente.** La regla es una afirmación sobre **el aparato**:
«esta caja no está hablando con el servidor». Una cola de ventas es una afirmación sobre **unos
datos**, y ya tiene su sitio en la línea. Encender la regla con la cola haría que se quedara
encendida después de reconectar, hasta drenar, y una señal que sobrevive a su causa deja de
significar lo que dice.

---

## El panel del carrito — `CartAccountTabs`

### Qué resuelve

Lo que el docstring del propio componente ya dice: *«el extremo derecho declara lo mismo que la
barra superior, porque el carrito es donde el cajero decide si sigue vendiendo con el servidor
inalcanzable»*. Esa decisión se toma mirando ese rincón: tiene que decirlo con la misma voz que la
barra.

### Layout

**Se conserva la forma apilada que ya tiene**: las dos unidades una encima de la otra, alineadas a
la derecha, `flex: "0 0 auto"`, al final de la fila de pestañas. Lo que cambia es la tinta, el
peso, el tamaño y el glifo, exactamente como en la barra.

| Propiedad | Hoy | Pasa a ser |
|---|---|---|
| Tamaño | `0.6875rem` | **`0.75rem`** |
| Peso | 400 | **600** |
| Color | `text.secondary` | `semantic.sync.offline.main` / `semantic.sync.pending.main`, por unidad |
| Glifo | ninguno | los mismos dos, delante de cada unidad, 14 px |
| Composición | `split(" · ")` sobre la cadena | **las dos unidades del estado**, sin partir texto |

**320 px, 768 px y 1440 px: las dos unidades a texto completo, siempre.** Aquí **no** se abrevia el
contador, y la diferencia con la barra tiene una razón física: estas dos unidades van **apiladas en
vertical**, así que cada una dispone del ancho entero del bloque (~84 px) en vez de repartirlo. La
regla de la barra —abreviar cuando dos frases comparten una sola línea— no aplica donde no
comparten línea.

**A 320 px este panel se monta como cajón a pantalla completa** (la variante `drawer` de
`cartContent`), y su fila es: pestañas desplazables (`flex: 1`) · estado (`0 0 auto`) · cerrar
(44 px). El estado le quita ancho a las pestañas, que **ya se desplazan en horizontal** y por
diseño no tienen que caber todas. Es el reparto correcto: una cuenta que no se ve se alcanza
deslizando; un «Sin conexión» que no se ve no se alcanza de ninguna forma.

### La regla teñida no se repite aquí

**El panel del carrito no dibuja ninguna regla de color.** Su borde inferior (`ROOT_SX`,
`borderColor: "divider"`) se queda como está. La regla de la barra es una señal única y global; dos
reglas ámbar en la misma pantalla del POS —una arriba, otra a media altura— dejarían de leerse como
«el estado del aparato» y pasarían a leerse como decoración.

---

## Umbral responsive

`useMediaQuery(theme.breakpoints.down("sm"))` — el canónico.

**Solo lo usa `StoreStatus`, y solo para una cosa: abreviar la unidad de cola cuando las dos
unidades comparten línea.** Ninguna otra decisión de este contrato cuelga de un umbral: la tinta,
el peso, el tamaño, los glifos y la regla teñida son idénticos en los tres anchos.

**`CartAccountTabs` no necesita umbral y no se le añade ninguno.** Su forma apilada es la misma en
los tres anchos; el `up(700)` que `src/app/pos/page.tsx` usa para decidir panel contra cajón ya
existe, está justificado por escrito en su sitio, y **este contrato no lo toca ni cuelga nada de
él**.

---

## Shell y componentes reutilizados

| Pieza | Se usa para |
|---|---|
| `StoreStatus` | La línea de la barra. Se reescribe por dentro; **no cambia su sitio ni su prop `nombre`** |
| `CartAccountTabs` | El estado del panel. Se reescribe solo su bloque de estado |
| `useStoreStatus` | Sigue siendo la única fuente del estado para los dos consumidores. Cambia lo que devuelve |
| `semantic.sync.*` | El vocabulario de color. Ya lo consumen `QabRowSummary` y `QabNegocioPanel` |
| Iconos `CloudOff` y `CloudUpload` de MUI | Los dos glifos |
| `AppBar` del `Layout` | La regla teñida, como sobrescritura `sx` de su sombra interior |

**`StatusPill` se consideró y se descarta como pieza principal**, con la medida delante: su lavado
da 1,10:1 sobre esta barra, así que aporta forma pero no visibilidad, y cuesta alto y padding en la
fila más apretada de la aplicación. Lo que hace visible el estado es la tinta, el glifo y la regla.

**`OfflineBanner` se queda intacto** y sigue siendo el canal transitorio. Los dos canales conviven
sin contradecirse porque ya hablan el mismo idioma de color: el banner usa `severity="warning"`,
que el theme resuelve a la misma tinta que este contrato elige.

---

## Piezas nuevas

| Pieza | Qué es | Por qué no basta lo que hay |
|---|---|---|
| `semantic.sync.pending` | Un **rol** nuevo en `SyncRole`, mapeado a la tinta `caution` — **la misma que `offline`** | El repertorio de `SyncRole` es `online / offline / syncing / failed` y ninguno describe «ventas registradas que aún no están en el servidor». `offline` es falso en el caso que más importa (**cola con conexión**); `syncing` afirma que hay una subida en curso, y puede no haberla; `failed` afirma un fallo que solo es cierto para las ventas en `sync_err` |

**Es la única pieza nueva, y no es un color nuevo: es un nombre.** Se resuelve a la misma tinta que
`offline`, así que la paleta no crece ni un valor. Lo que gana es que el contrato puede nombrar lo
que pinta sin mentir, y que si algún día la cola merece un tratamiento propio se cambia una línea
del mapa en vez de perseguir una tinta cruda por tres archivos.

**Yo no toco `src/theme/`.** El cambio es de una línea en el tipo `SyncRole` y una entrada en
`syncRoles`, y **lo aplica el humano o el `implementer`**, no este agente. Todo lo demás
—`resolve`, `buildScheme`, la exposición como `semantic.sync.pending`— ya funciona solo: el mapa se
resuelve genéricamente y no hay nada más que escribir.

---

## Tokens por estado

| Elemento o estado | Token |
|---|---|
| Texto «Sin conexión», barra y panel | `semantic.sync.offline.main` |
| Glifo `CloudOff`, barra y panel | `semantic.sync.offline.main` (heredado de su unidad) |
| Regla inferior de la `AppBar` mientras se está sin conexión | `semantic.sync.offline.main` |
| Texto «N sin subir» / «N», barra y panel | `semantic.sync.pending.main` |
| Glifo `CloudUpload`, barra y panel | `semantic.sync.pending.main` (heredado de su unidad) |
| Regla inferior de la `AppBar` con conexión | `semantic.surface.border` — **el valor del theme, sin sobrescribir** |
| Nombre del local (primera línea) | Sin cambios: color heredado, `text.primary` |
| Borde inferior de la fila de pestañas del carrito | `divider` — **sin cambios** |
| `OfflineBanner` | `severity="warning"` / `"success"` — **sin cambios**; el theme los resuelve |

**Ni un `#RRGGBB` ni un `rgba()` en ninguna de las piezas de este contrato.** El sitio donde más
tienta escribir un hex es la sombra interior de la regla, porque `boxShadow` se suele escribir a
mano: **ahí también va el token**, resuelto desde la paleta. `eslint.config.mjs` vigila esas tres
reglas dentro de `sx`.

**El violeta no aparece en ninguna pieza de este ajuste.** Ni en el glifo, ni en la regla, ni en el
texto. El estado de conexión no es pulsable y no debe parecerlo.

---

## Estados

| Estado | Qué se muestra |
|---|---|
| **Todo bien** (con conexión, sin cola) | **Nada.** El hook devuelve `undefined`, la segunda línea no se dibuja, la regla de la barra es la del theme. Sin «En línea», sin punto verde, sin píldora |
| **Sin conexión, sin cola** | Barra: `CloudOff` + `Sin conexión` en `sync.offline.main`. Regla de la barra **teñida**. Panel: la misma unidad |
| **Con conexión, con cola** | Barra: `CloudUpload` + `N sin subir` en `sync.pending.main`. Regla de la barra **normal**. Panel: la misma unidad |
| **Sin conexión y con cola** | Las dos unidades, en ese orden. Regla **teñida**. A 320 px la segunda se abrevia a glifo + número |
| **Al reconectar** | La regla vuelve a `surface.border` y la unidad de conexión desaparece **en el mismo render**; la de cola se queda hasta drenar. El `OfflineBanner` hace su aparición transitoria de «Conexión restaurada», como hoy |
| **Cargando / error de pantalla** | No aplica: este indicador no carga nada ni puede fallar. Se deriva de estado que ya está en memoria |

**Nunca hay un estado «todo bien» dibujado.** Es la premisa del docstring de `useStoreStatus` y la
razón por la que este indicador puede permitirse ser llamativo: si estuviera siempre encendido,
subirle el color solo lo convertiría en ruido más brillante. Este es el punto en el que el ajuste
se sostiene o se cae.

---

## Destinos táctiles

| Control | Tamaño |
|---|---|
| Bloque `StoreStatus` completo (nombre + estado), que navega a `/home` | **≥ 44 px de alto** en los tres anchos, con y sin la segunda línea |
| Botón de menú, campana y avatar de la barra | **44 × 44**, sin cambios |
| Botón de cerrar del cajón del carrito | **44 × 44**, sin cambios |
| Pestañas de cuenta y «+» del carrito | **44 px** (`touch.min`), sin cambios |
| Línea de estado, glifos y regla teñida | **No son destinos táctiles.** No se les añade `onClick` |

**La segunda línea hace crecer el bloque, nunca lo hace encoger.** Cuando el estado desaparece, el
bloque vuelve a su alto de una línea y **sigue midiendo ≥ 44 px**: es el mismo destino táctil que
hoy, y no puede caer por debajo del piso cuando la línea se vacía.

---

## Prohibiciones de copy

| Nunca | Porque |
|---|---|
| `Error de conexión`, `Fallo de conexión`, `Sin señal` | Afirman un fallo. Esta aplicación **vende sin conexión por diseño**: `AGENTS.md` lo dice y `ErrorState` lo codifica separando `offline` de `error`. Mandar a buscar una avería es mandar a parar de vender |
| `Desconectado` | En un sistema con sesión y multi-tenant se lee como «se cerró tu sesión». La frase es sobre la red, no sobre el usuario |
| `Modo Offline` en el indicador persistente | Es el copy del **banner transitorio**, que se queda como está. Repetirlo aquí haría que los dos canales se leyeran como el mismo aviso duplicado |
| `En línea`, `Conectado`, `Todo sincronizado`, un punto verde permanente | Es exactamente el defecto que `StoreStatus` vino a corregir, y su docstring lo cuenta: la píldora verde `●ON` permanente del POS «dejó de leerse». Un indicador siempre encendido convierte el aviso real en fondo |
| `Sincronizando…` cuando solo hay ventas en cola | Afirma que hay una subida en curso. La cola puede estar quieta —esperando red, o atascada— y esa es justo la situación que interesa señalar |
| Un número sin unidad ni etiqueta accesible | A 320 px la unidad de cola se abrevia a glifo + número: **el `aria-label` y el `title` completos (`{N} ventas sin subir`) son obligatorios**, no un extra. Sin ellos el número es un adorno |
| `N sin subir` en rojo, o con glifo de error | Una venta en cola **no se ha perdido ni ha fallado**: está guardada localmente y va a subir. Pintarla de fallo miente sobre lo que pasó y sobre lo que hay que hacer |
| El separador « · » entre las dos unidades | Las une visualmente en una sola frase, que es el problema que este contrato viene a resolver. La separación es un hueco de maquetación |

---

## Preguntas abiertas

1. **Las ventas en `sync_err` no se distinguen de las que solo esperan.** `Sale.syncState` ya
   guarda `"synced" | "syncing" | "not_synced" | "sync_err"`, pero `useStoreStatus` cuenta
   `!sale.synced`, que agrupa las tres últimas. La distinción que sí existe en los datos es la más
   accionable de todas: **una venta en `sync_err` con conexión** es el único caso de este indicador
   en el que algo está realmente roto, y `semantic.sync.failed` (→ `negative`) existe exactamente
   para eso. **Este contrato no la diseña** porque no sabe con qué frecuencia se da en producción
   ni qué debería poder hacer el comerciante al verla —y un tercer estado sin acción detrás es solo
   una alarma más. ¿Se abre como ajuste propio?
2. **El estado no es pulsable y no ofrece ninguna acción.** Hoy tampoco, y este contrato lo
   mantiene: la sincronización es automática y no hay ancho en la barra para un segundo destino de
   44 px. Pero un comerciante con «12 sin subir» durante media hora no tiene ninguna forma de
   preguntar qué pasa ni de forzar un reintento. ¿Hace falta un camino —tocar el estado abre un
   detalle, un reintento manual—, y si lo hace, dónde vive sin invadir la barra?
3. **La regla teñida convive con el `OfflineBanner` durante 3 s.** Al caer la red aparecen las dos
   señales a la vez y el banner se retira solo; la regla se queda. Es la relación que este contrato
   quiere —el banner anuncia el **cambio**, la regla afirma la **condición**— pero **no se ha visto
   en pantalla**. Si al verlo resulta redundante, lo que sobra es el banner, no la regla: el banner
   es el canal que ya se sabía que no bastaba.
4. **No hay artboard para esta decisión.** El indicador nació de un rediseño aprobado
   (`StoreStatus` y `CartAccountTabs` citan ese origen en sus docstrings), pero **ninguna sesión
   contrastó cómo dibuja ese rediseño un estado de conexión encendido**, si es que lo dibuja. Todo
   lo de este contrato —la tinta, los glifos, la regla de 2 px— se decide contra el sistema de
   diseño del repositorio, no contra un artboard. Si aparece uno, la regla teñida es la pieza que
   hay que contrastar primero: es la única invención de forma.

---

## Criterios de diseño verificables en navegador

> Los ejecuta el agente `qa` a **320, 768 y 1440 px**, en `/pos` (que tiene los dos consumidores a
> la vez) y en cualquier otra ruta con `Layout` para la barra. Los tres anchos se miden en un
> iframe del mismo origen con `flex: 0 0 auto` (**E-005**). El estado sin conexión se provoca con
> el modo *Offline* de las herramientas de desarrollo, **esperando más de 1 s**, que es el retardo
> que `useNetworkStatus` aplica antes de declararlo. La cola pendiente se provoca registrando
> ventas sin conexión.
>
> **Todas las búsquedas de texto se acotan al elemento medido** —el bloque de `StoreStatus`, o la
> fila de pestañas del carrito—, nunca a `document.body`: `Sin conexión` es una subcadena que otras
> piezas de la aplicación ya pintan (**E-016**), y localizar por clase de MUI encuentra el
> ascendiente equivocado (**E-011**).

1. **Con conexión y sin ventas en cola**, dentro del bloque de `StoreStatus` **existe exactamente
   un nodo de texto visible** —el nombre del local— y **ningún glifo**. No hay ninguna subcadena
   `Sin conexión`, `sin subir`, `En línea` ni `Conectado` dentro de ese bloque, en los tres anchos.
2. **Con conexión y sin cola**, el `boxShadow` computado de la `AppBar` **no contiene**
   `rgb(138, 90, 18)`, y su `getBoundingClientRect().height` es exactamente **56 px a 320 px** y
   **64 px a 768 y 1440 px**.
3. **Sin conexión**, dentro del bloque de `StoreStatus` aparece la subcadena `Sin conexión` y el
   `color` computado de ese texto es **`rgb(138, 90, 18)`** en los tres anchos.
4. **Sin conexión**, el `fontSize` computado de esa línea es **`12px`** y su `fontWeight` computado
   es **`600`**, en los tres anchos.
5. **Sin conexión**, delante de ese texto existe un elemento `svg` **dentro de la misma unidad**, y
   su `color` computado es también `rgb(138, 90, 18)`. Su `getBoundingClientRect().left` es
   **menor** que el del texto (el glifo va delante, no detrás).
6. **Sin conexión**, el `boxShadow` computado de la `AppBar` **contiene `rgb(138, 90, 18)`** y el
   valor **`2px`**, y **no contiene `border`**: el `borderBottomWidth` computado de la `AppBar` es
   `0px`.
7. **Sin conexión**, la altura de la `AppBar` **sigue siendo 56 px a 320 px y 64 px a 768 y
   1440 px** — idéntica a la medida del criterio 2, con tolerancia de 0 px. La regla no puede
   engordar la barra.
8. **Sin conexión**, `document.documentElement.scrollWidth ≤ clientWidth` a 320 px en `/pos` y en
   `/home`. Encender el estado no puede provocar desplazamiento horizontal.
9. **Sin conexión**, el bloque de `StoreStatus` mide **≥ 44 px de alto**; y con conexión, sin la
   segunda línea, **también ≥ 44 px**. En los tres anchos.
10. **Con conexión y con ventas en cola**, dentro del bloque aparece la subcadena `sin subir`, el
    `color` computado de ese texto es **`rgb(138, 90, 18)`** y el `boxShadow` de la `AppBar`
    **no contiene** ese color (la regla no se enciende por la cola).
11. **Con conexión y con cola**, dentro del bloque **no** aparece la subcadena `Sin conexión`.
12. **Sin conexión y con cola simultáneamente**, a **768 y 1440 px** el bloque contiene las dos
    subcadenas completas, `Sin conexión` y `sin subir`, **dos elementos `svg` distintos**, y
    **ninguna subcadena ` · `** dentro del bloque.
13. **Sin conexión y con cola simultáneamente**, a **320 px**: el bloque contiene `Sin conexión`,
    contiene el número de ventas en cola, y **no contiene la subcadena `sin subir`**. Sigue
    habiendo dos elementos `svg`.
14. En ese mismo caso a **320 px**, el elemento de la unidad de cola tiene un `aria-label` **o** un
    `title` cuyo texto contiene `ventas sin subir` **y** el número. Y su `scrollWidth ≤ clientWidth`
    (no se recorta lo que ya se abrevió).
15. **Sin conexión**, la línea de estado (o su contenedor inmediato) declara un `role` de estado con
    anuncio cortés, y **con conexión y sin cola ese contenedor no existe o está vacío**.
16. **Sin conexión**, en `/pos` a **1440 px** (panel del carrito visible): dentro de la fila de
    pestañas del carrito aparece `Sin conexión` con `color` computado `rgb(138, 90, 18)`,
    `fontSize` `12px`, `fontWeight` `600` y un `svg` delante.
17. **Sin conexión y con cola**, en el panel del carrito **a los tres anchos** (a 320 px abriendo el
    cajón del carrito) aparecen **las dos subcadenas completas**, `Sin conexión` y `sin subir`, en
    **dos líneas apiladas**: el `getBoundingClientRect().top` de la segunda es mayor que el de la
    primera, y sus `left` coinciden dentro de ±1 px. Aquí el contador **no** se abrevia a 320 px.
18. El borde inferior de la fila de pestañas del carrito **no cambia de color** entre estar con y
    sin conexión: su `borderBottomColor` computado es el mismo en los dos casos.
19. Reconectando desde el estado sin conexión y **sin ventas en cola**: en menos de 2 s el bloque de
    `StoreStatus` vuelve a no tener segunda línea y el `boxShadow` de la `AppBar` deja de contener
    `rgb(138, 90, 18)`.
20. Reconectando desde el estado sin conexión **con ventas todavía en cola**: el `boxShadow` de la
    `AppBar` deja de contener `rgb(138, 90, 18)`, y la unidad de cola **sigue visible** con su
    texto y su glifo.
21. En ningún estado el bloque de `StoreStatus` contiene un elemento con `animation-name` distinto
    de `none` ni con `transition` sobre `color`, `opacity` o `background-color`. El indicador no
    parpadea ni pulsa.
22. `npx eslint` sobre los archivos tocados **no reporta ninguna de las tres reglas
    `no-restricted-syntax` de color**: ni un `#RRGGBB` ni un `rgba()` dentro de `sx`, incluido el
    `boxShadow` de la `AppBar`.
23. `grep` sobre `src/app/pos/components/CartAccountTabs.tsx` **no encuentra `split(" · ")`** ni
    ninguna otra partición del estado por texto.
24. `npx tsc --noEmit` termina limpio, y `semantic.sync.pending.main` resuelve a un color (no a
    `undefined`) en los dos esquemas: el rol nuevo está en el mapa y no solo en el tipo.
