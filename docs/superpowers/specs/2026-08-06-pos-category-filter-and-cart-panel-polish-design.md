# Categorías como filtro de píldoras + pulido del panel del carrito

**Fecha:** 2026-08-06
**Branch:** `337-mejorar-el-pos-de-venta`

---

## Parte A — Categorías como filtro de píldoras

### 1. Problema

Hoy navegar el catálogo del POS exige dos pasos con dos overlays distintos:

1. Tocar un mosaico de categoría → se abre `ProductModal`, una grilla filtrada en un modal/overlay aparte.
2. Escribir en el buscador → aparece un panel flotante con hasta 10 resultados.

Son dos caminos con dos contenedores, dos animaciones de apertura/cierre, y ninguno se combina con el otro: buscar dentro de una categoría no es posible, y cerrar el modal para buscar (o viceversa) es fricción innecesaria en un flujo que debería ser rápido.

### 2. Decisión

La categoría y la búsqueda pasan a ser **dos filtros de un solo listado siempre visible**, no dos overlays:

- Los mosaicos de categoría se reemplazan por una **fila fija de píldoras** (`Chip`), una al lado de la otra, con scroll horizontal si no entran todas.
- Existe una píldora **"Todas"**, siempre primera, marcada por defecto.
- La grilla de productos (la misma `PosProductItemLayout` que ya existe) se muestra **siempre**, filtrada por `(categoría marcada) AND (texto de búsqueda)`.
- `ProductModal` y el panel flotante de resultados de búsqueda **desaparecen por completo**.

### 3. Layout

```
Panel izquierdo (flex column)
├─ Header (barra superior — sin cambios)
├─ Fila de píldoras de categorías (flex-shrink: 0, fija, no scrollea con la grilla)
├─ Contenido scrolleable
│   └─ Grilla de productos (PosProductItemLayout), filtrada
└─ Footer (píldoras de cuentas + buscador — sin cambios de posición)
```

La fila de píldoras es una nueva franja `flex-shrink: 0` entre el header y el contenido scrolleable — mismo patrón estructural que ya separa el footer del contenido.

### 4. Estado y filtrado

Reemplaza:
```ts
const [selectedCategory, setSelectedCategory] = useState<ICategory>(null);
const [showProducts, setShowProducts] = useState(false);
```
con:
```ts
const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null); // null = "Todas"
```

Un único derivado combina ambos filtros:
```ts
const filteredProducts = useMemo(() => {
  return productosTienda
    .filter((p) => selectedCategoryId === null || p.producto.categoria.id === selectedCategoryId)
    .filter((p) => normalizeSearch(p.producto.nombre).includes(normalizeSearch(searchQuery)));
}, [productosTienda, selectedCategoryId, searchQuery]);
```
(`normalizeSearch` ya existe y es lo que usa hoy el popup de búsqueda.)

`searchQuery` y su `SelectableTextField` en el footer no cambian de lugar ni de comportamiento de tipeo — lo único que cambia es que ya no dispara un panel flotante (`showSearchResults`), sino que alimenta este filtro combinado.

### 5. Qué se borra

- `src/app/pos/components/ProductModal.tsx` — archivo completo (solo lo importaba `page.tsx`).
- Estado y efectos del panel flotante de búsqueda: `showSearchResults`, `searchResultsRef`, `searchPanelLayout`, `updateSearchPanelLayout`, el `useLayoutEffect` que lo mantiene sincronizado, y el bloque `<Portal>` que lo renderiza.
- `selectedCategory`/`showProducts`/`handleOpenProducts` (reemplazados por `selectedCategoryId`).
- En `handleProductScan`, la llamada a `setShowProducts(false)` (ya no hay modal que cerrar).

### 6. Qué no cambia

- El escaneo de cámara/hardware sigue abriendo `QuantityDialog` directamente vía `selectedProduct`, sin pasar por ningún filtro.
- `intentToSearch` se mantiene: sigue evitando que el escáner de hardware robe foco mientras el cajero escribe en el buscador — no tiene relación con el popup que se borra.
- `PosProductItemLayout`/`ProductQuickActions` (la tarjeta de producto y sus controles de cantidad) se reutilizan tal cual, sin cambios.

### 7. Diseño visual de las píldoras

Mismo lenguaje visual que la fila de cuentas del footer (`Chip`, `outlined` ↔ `filled`), con una diferencia: cada categoría trae su propio `category.color`.

| Estado | Tratamiento |
|---|---|
| No marcada | `variant="outlined"`, punto de color (8px) del `category.color` a la izquierda del label |
| Marcada | `variant="filled"`, `bgcolor: category.color`, color de texto con contraste calculado (`theme.palette.getContrastText`) |
| "Todas" | Sin punto de color; se comporta como una cuenta activa hoy (`filled`/`color="primary"` al estar marcada) |

Fila horizontal sin wrap, `overflowX: auto`, altura de chip ~36-40px (más fina que los mosaicos actuales) con padding/gap generoso alrededor de cada chip para mantener una zona táctil cómoda sin agrandar el chip visualmente.

### 8. Onboarding

El paso del tour `data-tour="pos-category-first"` pasa de la primera tarjeta-mosaico a la primera píldora (después de "Todas"). Su copy actual ("Cada tarjeta es una categoría... Al tocarla verás sus productos para añadirlos al carrito sin usar el buscador") describe el modal que desaparece — se actualiza a algo como "Cada píldora es una categoría. Tócala para filtrar los productos de esa categoría; volvé a tocarla (o toca 'Todas') para quitar el filtro." El resto de los pasos del tour (`pos-toolbar-scanner`, `pos-search`) no cambian de anchor ni de copy.

### 9. Casos borde

| Caso | Comportamiento |
|---|---|
| Categoría marcada + búsqueda sin resultados | Grilla vacía con el mismo mensaje "No se encontraron productos para «…»" que ya existe. |
| Categoría con 0 productos | La píldora se sigue mostrando (no se oculta por resultado vacío); la grilla queda vacía con el mismo mensaje. |
| "Todas" + catálogo grande | Se renderizan todos sin paginar ni virtualizar — mismo enfoque que ya usa `ProductModal` hoy para una categoría completa. Fuera de alcance: virtualización, si en la práctica hiciera falta. |
| Cambiar de categoría con texto ya escrito en el buscador | El texto se conserva; el filtro combinado se recalcula. |

### 10. Fuera de alcance

- El backend/servicio de productos y categorías.
- `PosProductItemLayout`, `ProductQuickActions`, `QuantityDialog` — sin cambios.
- Virtualización de listas largas.

---

## Parte B — Pulido del panel del carrito

Cuatro hallazgos que quedaron aparcados en la revisión final del rediseño del layout anclado, ahora resueltos:

### B.1 Ancho angosto en 600-780px

**Causa:** `getCartWidth()` da `48vw` en tablet, pero el panel tiene `minWidth: 360px`. Ese piso domina por debajo de ~750px (`360 / 0.48 = 750`), y a los 600px exactos dejaba solo ~240px para todo el panel izquierdo (píldoras + buscador + escáner + grilla de 2 columnas).

**Decisión:** el panel del carrito no se hace más angosto que 360px (ese valor protege el layout del cobro, ya afinado en el rediseño del checkout — no se toca). En cambio, se sube el umbral en el que el panel pasa a ser fijo: de `sm` (600px) a un breakpoint propio de **700px**. Por debajo de 700px, el carrito sigue siendo el `Drawer` overlay (igual que en mobile); desde 700px el panel fijo tiene sitio real para convivir con `minWidth: 360px` sin ahogar el panel izquierdo.

Esto es un ajuste al mismo criterio que ya se había definido (mostrar el panel fijo desde "pantallas medianas hacia arriba"), no un cambio de dirección: tablets reales (≥768px en vertical) siguen mostrando el panel fijo; solo el rango angosto 600-700px pasa a comportarse como mobile.

`showCartPanel` deja de derivarse de `!isMobile` (down `sm`, 600px) y pasa a su propia media query: `useMediaQuery(theme.breakpoints.up(700))`. El `isMobile` general (600px) sigue existiendo tal cual para todo lo demás que ya lo usa (tamaño de texto, escáner, etc.) — son dos preguntas distintas ("¿es un teléfono?" vs. "¿hay sitio para el panel fijo?") que ya no comparten el mismo corte.

### B.2 Separación de componentes: extraer el footer

El footer (píldoras de cuentas + edición inline de nombre + buscador + escáner, ~200 líneas inline en `page.tsx`) se extrae a un componente propio, `src/app/pos/components/PosBottomBar.tsx`, siguiendo la convención del proyecto de no dejar bloques de UI inline. Recibe como props el estado y los handlers que ya existen en `page.tsx` (carts, activeCartId, edición de nombre, searchQuery, refs del escáner, etc.) — sin cambio de comportamiento, es una extracción pura.

### B.3 `onClose` innecesario en modo panel

`CartContent` pasa de:
```ts
interface IProps {
  // ...
  variant: "panel" | "drawer";
}
```
a una unión discriminada:
```ts
type IProps =
  | { variant: "drawer"; onClose: () => void; /* ...resto de props comunes */ }
  | { variant: "panel"; /* ...resto de props comunes, sin onClose */ };
```
`CartDrawer` (que siempre monta `variant="drawer"`) sigue pasando `onClose` como hoy. El panel fijo en `page.tsx` (`variant="panel"`) deja de pasarlo — hoy pasaba `() => setOpenCart(false)`, una función que nunca se invoca porque el panel no tiene botón de cerrar. El estado inválido ("panel fijo con una función de cierre que nadie llama") deja de ser representable en el tipo.

### B.4 Borde delimitador entre paneles

El panel del carrito hoy solo se distingue del panel izquierdo por una `box-shadow` sutil (`-8px 0px 24px rgba(0,0,0,0.12)`), y ambos comparten el mismo fondo blanco/paper — la separación no se lee con claridad. Se agrega un borde real: `borderLeft: "1px solid"`, `borderColor: "divider"` (color del tema, se adapta a claro/oscuro) en el `Box` del panel del carrito, además de la sombra existente (la sombra da profundidad, el borde da el límite exacto).

### B.5 Fuera de alcance

- Cualquier lógica de negocio del carrito o del cobro.
- El contenido interno del footer (edición de nombre, buscador) — solo se mueve de archivo, no cambia.
