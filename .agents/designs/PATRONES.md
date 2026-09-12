# Patrones de pantalla vigentes

> Lectura obligatoria del agente `ui-designer`. **Sustituye a leer el árbol entero de
> `src/components/GestionInventario/` y `src/app/ventas/page.tsx`** (~300 KB) para aprender el
> estándar: lo que había que deducir de ahí está escrito aquí, con la referencia exacta por si
> hace falta abrir el archivo. **Los números de línea envejecen** —un feature ajeno reescribió
> `ventas/page.tsx` entero y movió dos—, así que cada cita lleva también el símbolo por el que
> grepear: si el número no cuadra, busca el símbolo, y de paso corrige la cita aquí.
>
> Qué componente usar para cada necesidad está en la tabla de reutilización del prompt del
> `ui-designer`, no aquí. Esto es lo otro: **cómo se componen entre ellos en una pantalla real.**

## 1. La composición canónica de una pantalla

`GestionInventarioPage.tsx` es el estándar. El orden vertical no es decorativo:

```
PageContainer (título, subtítulo, breadcrumbs, tabs, headerActions)
  └─ Alertas de la pantalla         ← lo que exige acción inmediata, arriba de todo
  └─ StatStrip / StatsRow           ← las cifras de cabecera
  └─ ContentCard
       └─ FiltersBar                ← dentro de la tarjeta, con mb={2}
       └─ isMobile ? <MobileList/> : <Table/>
  └─ Diálogos                       ← montados al final, fuera del ContentCard
```

Referencia: `GestionInventario/GestionInventarioPage.tsx:200-260`.

## 2. Una tabla no se comprime: se bifurca

Dos componentes de verdad, con **el mismo juego de props de acción**, no una tabla apretada con
columnas ocultas (`GestionInventarioPage.tsx:239-260`):

```tsx
{isMobile ? (
  <InventarioMobileList productos={filtered} loading={loading} onEdit={...} showDetails={...} />
) : (
  <InventarioTable      productos={filtered} loading={loading} onEdit={...} />
)}
```

El móvil puede tener **una prop de más** (`showDetails`) que el escritorio no necesita: en un
teléfono se decide qué desaparece, y eso es una decisión de diseño con su propio control.

## 3. Anatomía de la tarjeta móvil

`InventarioMobileList.tsx:74-214`, un `ProductCard` por fila de la tabla:

- `<Card variant="outlined">` + `<CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>`.
- **Identidad primero**: `Typography variant="subtitle2" fontWeight={700}` con el nombre.
- Debajo, una fila de contexto: `variant="caption" color="text.secondary"` para la categoría, y
  las insignias de excepción (`StatusPill`, `getStockPill(...)`) solo cuando aplican.
- Los detalles van en pares **etiqueta `caption` / valor `body2 fontWeight={600}`**, no en una
  rejilla de columnas.
- Las acciones **no se despliegan en la tarjeta**: van a un `ActionSheet` (`:103`).
- La lista envuelve en `<Stack spacing={1} minHeight="100dvh">` (`:257`) — `100dvh`, no `100vh`,
  por la barra de direcciones del móvil.

## 4. La acción primaria se reubica en móvil, no se encoge

`GestionInventarioPage.tsx:185-199`: `headerActions` entrega el botón "Nuevo producto" **solo en
escritorio** (`!isMobile ? <Button/> : undefined`). En teléfono la misma acción vive como un `+`
junto al buscador, dentro de la barra de filtros. Un botón de texto no cabe junto al título a
390 px, así que **cambia de sitio y de forma**; no se queda ahí en `size="small"`.

Tu contrato dice, por cada acción de cabecera, **dónde aparece en cada uno de los tres anchos.**

## 5. Los diálogos se montan siempre y se abren por su objetivo

`open={Boolean(editTarget)}` con el objetivo como estado (`:265` y siguientes), no un booleano
suelto por diálogo. Así el diálogo siempre tiene el dato que va a mostrar.

## 6. Lo pesado entra por `dynamic`

`GestionInventarioPage.tsx:33-41`: `PrintLabelsModal` e `ImportarExcelDialog` se cargan con
`next/dynamic` y `ssr: false`, porque arrastran `xlsx`, `jspdf`, `bwip-js` y `qrcode`. Si tu
pantalla propone una acción que solo usa una minoría y trae una librería propia, **el contrato
dice que va diferida.**

## 7. Estados de carga que respetan la bifurcación

`src/app/ventas/page.tsx` (busca `LoadingState variant`, hoy en `:323`):
`<LoadingState variant={isMobile ? "cards" : "table"} />`. El esqueleto imita **la forma que va a
aparecer en ese ancho**, no siempre la tabla.

## 8. El anti-patrón, para reconocerlo

`src/app/resumen_cierre/page.tsx` resuelve el responsive como **decoración condicional**: 18
ternarios `isMobile ? ...` que solo cambian tamaños y paddings (`:548`, `:643`, `:660`, `:673`),
y una fila de 40 px que rompe el piso de 44.

Cambiar tamaños no es diseñar para móvil. Diseñar para móvil es decidir **qué se ve, en qué orden
y qué desaparece.**

## 9. Dos avisos sobre las propias pantallas de referencia

**No las copies en el umbral.** El umbral canónico es
`useMediaQuery(theme.breakpoints.down("sm"))` (< 600 px), y así lo hace `ventas/page.tsx` (busca
`breakpoints.down`, hoy en `:86`).
Pero `GestionInventarioPage.tsx:45` usa `down("md")` (< 900 px) **sin justificarlo**: es una de las
6 pantallas con esa deuda. Cópiale la estructura, no el breakpoint.

**La excepción bien hecha existe y tiene esta forma:** `src/app/pos/page.tsx:286` declara
`showCartPanel = useMediaQuery(theme.breakpoints.up(700))` como un umbral **propio y aparte** de su
`isMobile`, porque el panel del carrito tiene una necesidad distinta a la de la pantalla. Si tu
contrato necesita otro umbral, se hace así: una consulta con nombre propio y el porqué escrito.
