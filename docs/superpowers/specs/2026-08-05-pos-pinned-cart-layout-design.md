# Panel del carrito fijo en el POS, sin toggle de pin

**Fecha:** 2026-08-05
**Branch:** `337-mejorar-el-pos-de-venta`

---

## 1. Problema

El panel del carrito en el POS hoy es opcional: un botón de "pin" (`isCartPinned`, estado local en `page.tsx`) decide si el carrito se muestra como panel fijo a la derecha o como `Drawer` superpuesto. Dos problemas confirmados:

1. **El pin no aporta nada en pantallas grandes.** Nunca tiene sentido usar el carrito como overlay cuando sobra espacio horizontal — el panel fijo debería ser el único comportamiento desde que la pantalla es lo bastante ancha.
2. **Las barras flotantes se superponen con el panel del carrito.** La barra de píldoras de cuentas, el buscador y el panel de resultados de búsqueda son `position: fixed` respecto al *viewport completo*. Para no quedar debajo del panel anclado, calculan a mano `right: cartPanelWidth` (medido con un `ResizeObserver` sobre el panel). Es un patrón fundamentalmente frágil — dos valores que tienen que coincidir "por construcción manual" en vez de por diseño — y es la causa de los últimos 5 commits de parches puntuales sobre este mismo síntoma.

De fondo, el pin no es solo una preferencia de UI de más: es la causa raíz de que las barras necesiten `position: fixed` con offset calculado, en vez de vivir en flujo normal dentro de un contenedor que el navegador ya sabe dimensionar correctamente.

## 2. Decisiones tomadas

| Decisión | Elegido |
|---|---|
| Pin | Se elimina por completo: botón, ícono, estado, prop, lógica de medición de ancho. |
| Panel del carrito | Fijo (real flex sibling) siempre que el ancho de pantalla sea `sm+` (≥600px). Por debajo, sigue siendo `Drawer` abrible/cerrable, igual que hoy. |
| Barras flotantes (píldoras, buscador, resultados) | Dejan de ser `position: fixed` al viewport. Pasan a vivir en flujo normal dentro de un contenedor flex propio del panel izquierdo — el navegador les da el ancho correcto sin cálculos manuales. |
| Ancho del panel del carrito | Se conserva `getCartWidth()` tal cual: `48vw` en tablet (`sm`-`md`), `42vw` en desktop (`md+`), `minWidth: 360px`. |

## 3. Arquitectura

**Antes:**

```
Box (flex row, height fija, overflow hidden)
├─ Box posScrollRef (flex:1, overflow:auto)         ← host de TODO: header sticky,
│    grilla, ProductModal, y 3 barras position:fixed con right:cartPanelWidth
└─ Box panel carrito (solo si isCartPinned)          ← width medido con ResizeObserver
```

**Después:**

```
Box raíz (flex row, height fija, overflow hidden)
├─ Box panel izquierdo (flex column, height:100%, overflow hidden)
│    ├─ Box header (flex-shrink:0)                   ← barra superior, ya no necesita sticky
│    ├─ Box contenido (flex:1, overflow:auto, position:relative)
│    │    ├─ grilla de categorías
│    │    ├─ ProductModal (overlay in-flow o modal centrado, según !isMobile)
│    │    └─ Portal: panel de resultados de búsqueda (position derivada del
│    │         propio rect del buscador, ya no de cartPanelWidth)
│    └─ Box footer (flex-shrink:0)                   ← píldoras de cuentas + buscador,
│         en flujo normal, sin position:fixed
└─ Box panel del carrito (montado siempre que !isMobile)
     └─ CartContent variant="panel"
```

`posScrollRef` se reasigna al Box de **contenido** (el que scrollea), no al panel izquierdo completo — es lo que necesita `scrollPosTourTargetIntoView` para el tour de onboarding. Como consecuencia, los targets de la barra superior (`pos-toolbar-*`) quedan fuera del contenedor scrolleable y son visibles siempre: la rama de `scrollPosTourTargetIntoView` que hace `scrollTo({top:0})` para esos targets deja de ser necesaria para la visibilidad (se puede dejar así, es inofensiva) pero ya no es la que garantiza que el target se vea.

## 4. Cambios por archivo

### `src/app/pos/page.tsx`
- Se borra: `isCartPinned` (state), `cartPanelRef`, `cartPanelWidth`, su `useEffect` con `ResizeObserver`.
- Root: pasa de un solo hijo `flex:1 overflow:auto` a la estructura de 3 franjas descrita arriba. El header (barra superior con `PeriodoBadge`, `RefreshButton`, etc.) deja de ser `position: sticky` — ya es un hijo flex normal que no scrollea.
- Grilla de categorías: `gridTemplateColumns` y el `fontSize` de las etiquetas dejan de depender de `isCartPinned` y pasan a depender del breakpoint directamente. Se adoptan los valores que hoy corresponden a "pinned" para `sm/md/lg` (el panel está fijo ahí siempre); `xs` conserva el tamaño de fuente más grande que hoy tiene la variante "unpinned" en mobile, porque ahí no compite con ningún panel.
- `ProductModal`: el prop pasa de `isCartPinned` a `!isMobile` (mismo comportamiento — overlay in-flow en `sm+`, modal centrado en mobile).
- `CartDrawer` se monta solo si `isMobile` (antes `!isCartPinned && openCart`).
- El panel fijo del carrito se monta siempre que `!isMobile` (antes `isCartPinned &&`).
- `ShoppingCartComponent` (FAB flotante) se oculta en `!isMobile` — ya no hace falta abrir nada, el carrito siempre está visible.
- Píldoras de cuentas: pasan del `Box position:fixed` con `right: cartPanelWidth` a un hijo normal del footer del panel izquierdo. Se borra el cálculo de `right`.
- Buscador: mismo tratamiento — hijo normal del footer, sin `position:fixed`, sin `right` calculado.
- Panel de resultados de búsqueda: se mantiene en `Portal` (para escapar del `overflow:auto` del contenido y controlar su `z-index`), pero su posición horizontal (`right`) se deriva del `getBoundingClientRect()` del propio contenedor del buscador — que al estar ahora en flujo normal dentro del panel izquierdo, ya refleja el borde real sin depender de `cartPanelWidth`. Se extiende `updateSearchPanelLayout` (que ya mide `top` para `bottom`/`maxHeight`) para calcular también `right = window.innerWidth - rect.right`.
- Se borra el `pb: "120px"` reservado en la grilla para no quedar tapada por las barras fijas — ya no hace falta, el footer ocupa su propio espacio en el flex layout.
- `posScrollRef` se reasigna al Box de contenido (el scrolleable), no al panel izquierdo completo.

### `src/components/cartDrawer/CartDrawer.tsx`
- Deja de recibir/reenviar `isCartPinned`/`setIsCartPinned` (ya no existen). Pasa `variant="drawer"` a `CartContent`.

### `src/components/cartDrawer/components/cartContent.tsx`
- Se borra el botón de pin completo: import de `PushPinIcon`/`PushPinOutlinedIcon`, `handlePinCart`, el `Tooltip`+`IconButton` asociado.
- El prop `isCartPinned: boolean` + `setIsCartPinned: (v: boolean) => void` se reemplaza por `variant: "panel" | "drawer"`.
- `getContainerWidth()` y el `maxWidth`/`isMobile`/`isTablet` duplicados internamente se eliminan: en `variant="panel"` el componente ocupa `100%` de su contenedor (el ancho real lo define `page.tsx`, única fuente de verdad); en `variant="drawer"` sigue siendo `100vw`/`100dvh` como hoy en mobile.
- El botón "Cerrar" (ícono `Close`) solo se renderiza en `variant="drawer"` — en `variant="panel"` no hay nada que cerrar, así que no se muestra (en vez de mostrarse deshabilitado como hoy).

### `src/app/pos/components/ProductModal.tsx`
- El prop se renombra de `isCartPinned` a `inPanel` (incluso podría conservar el nombre, pero deja de representar un estado de pin — ahora es un booleano derivado del breakpoint que decide el llamador).

## 5. Casos borde

| Caso | Comportamiento |
|---|---|
| Carrito vacío, pantalla `sm+` | El panel se sigue mostrando vacío — igual que hoy con `isCartPinned`, nunca dependió de si había productos. |
| Resize cruzando los 600px con el `Drawer` abierto | Al entrar a `sm+`, el `Drawer` deja de montarse (`open` depende de `isMobile`) y aparece el panel fijo; `openCart` deja de tener efecto en desktop, igual que hoy. |
| Tablet (`sm`-`md`, 600-900px) | Panel fijo, ancho `48vw`, `minWidth: 360px` — sin cambios respecto a hoy. |
| Tour de onboarding, targets de la barra superior | Quedan fuera del contenedor scrolleable, siempre visibles; `scrollPosTourTargetIntoView` sigue funcionando para el target de categorías (que sigue dentro del contenido scrolleable). |
| Teclado virtual en mobile (búsqueda) | Sin cambio de comportamiento: sigue siendo exclusivo de `<600px`, donde el footer sigue existiendo igual que hoy (solo deja de ser `position:fixed` en desktop). |

## 6. Fuera de alcance

- Todo lo del cobro/checkout (`CheckoutView` y afines) — no se toca.
- El contenido interno de `CartItemCard`, `CartSummaryFooter`, `DiscountField`.
- La lógica de negocio del carrito (`cartStore.ts`), ventas, sincronización.
- El diseño visual del panel (colores, sombras) — solo se toca la mecánica de layout/posicionamiento.
