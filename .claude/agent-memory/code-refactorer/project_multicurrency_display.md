---
name: multicurrency-display
description: How monetary values are displayed under the multi-currency system (base currency + per-product price currency + tasaSnapshot)
metadata:
  type: project
---

The business moved from single-currency to multi-currency. Display rules:

- DB prices (`VentaProducto.precio`, product price) are stored in that product's `monedaPrecioCode` (USD, MLC, CUP, ...).
- IMPORTANT: there is NO per-`VentaProducto` `equivalenteBase` column. `equivalenteBase` only exists in `ResumenMonedaCierre` (per-moneda cierre aggregate) and inside the `Venta.pagosDetalle` JSON (per payment line). To show a product price in base currency you MUST convert `precio` via `convertToBase(precio, monedaPrecioCode ?? monedaBase, tasas, monedaBase)` — there is no stored base value to read. (If a prompt claims a per-product equivalenteBase exists, it is wrong — verify against schema.prisma VentaProducto first.)
- `venta.total`, `totalcash`, `totaltransfer` are stored in the business **base currency** (`monedaBase` from `useAppContext()`).
- `venta.tasaSnapshot` (Json `{ USD: 120, MLC: 75 }`, CUP implicit = 1) freezes exchange rates at sale time.
- `venta.pagosDetalle` (IPagoLinea[]) / `venta.vueltoDetalle` (IVueltoLinea[]) hold per-line payment/change breakdowns.

**Why:** each product can be priced in a currency different from the base; everything ultimately reconciles to base.

**How to apply:**
- To show a base-currency amount with alternative-currency equivalents, use `<MultiCurrencyAmount amount={...} />` from `@/components/MultiCurrencyAmount` — it reads `monedaBase`/`tasasVigentes`/`monedasNegocio` from AppContext itself (no props needed) via the `useMonedasAlternativas` hook. Variants: "default" | "compact" | "emphasized". It renders `<amount> <monedaBase>` plus `≈` equivalents in alternative currencies using *current* tasas.
- To convert a non-base amount to base: `convertToBase(monto, moneda, tasas, monedaBase)` from `@/lib/currency`. Only convert when the product's `monedaPrecioCode` differs from base; otherwise treat the value as already-base. Reference impl: `src/app/pos/components/UserSalesDrawer.tsx` (resolves `producto.monedaPrecioCode ?? productosTienda lookup ?? monedaBase`, then `convertToBase`).
- `formatMoneda(monto, simbolo, decimales=2)` DOES exist in `@/lib/currency` (returns `<simbolo><monto>`). It does NOT exist in `@/utils/formatters` — there the only symbol-explicit helper is `formatCurrency` (hardcodes CUP `CURRENCY_SYMBOL`). For multi-currency labels, `MultiCurrencyAmount` formats internally as `<amount> <code>` / `<simbolo><amount>`.
- `MultiCurrencyAmount` uses *current* tasas (tasasVigentes) for alternatives, while historical per-line/per-product conversions should use the venta's `tasaSnapshot` when available (frozen at sale time).

**Ventas view (RESOLVED 2026-06-08):** `ventaProductoSchema` now carries `monedaPrecioCode` and `ventaSchema` now carries `tasaSnapshot` (reusing `tasaSnapshotSchema` from `@/schemas/tasaCambio`). The GET `/api/venta/[tiendaId]/[cierreId]` projects `monedaPrecioCode` per product (`productos.select`) and maps `venta.tasaSnapshot` (cast `as ITasaSnapshot | null`) into the DTO. `VentaDetailDialog` converts each product price to base via `convertToBase(price, monedaPrecioCode ?? monedaBase, venta.tasaSnapshot ?? tasasVigentes, monedaBase)` (prefers frozen snapshot, falls back to current for pre-multicurrency ventas), shows base amount + an "Orig: <price> <code>" trace when the product currency differs from base. Venta-level totals (`total`/`totalcash`/`totaltransfer`) are already base → rendered with `<MultiCurrencyAmount>`. `/ventas/page.tsx` totals + per-row totals also use `<MultiCurrencyAmount>` (removed `formatCurrency` + `Chip` for amounts). Local helper `formatBase(monto)` in the dialog = `formatMoneda(monto, "", 2)` + ` <monedaBase>` for inline base labels. (`UserSalesDrawer` was always fine because it reads the Zustand `salesStore.Sale` shape whose `SaleProduct extends IProductoVenta` already carries `monedaPrecioCode`.)

See [[interfaces-zod]]: the venta multi-currency fields live in `ventaSchema`/`ventaProductoSchema` (`@/schemas/venta`) and payment lines in `@/schemas/pago` (pagoLineaSchema/vueltoLineaSchema).
