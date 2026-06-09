# Memory Index

- [Multi-currency display](project_multicurrency_display.md) — base currency vs per-product monedaPrecioCode + tasaSnapshot; use MultiCurrencyAmount / convertToBase / formatMoneda, never formatCurrency for non-CUP.
- [Gastos moneda invariant](project_gastos_moneda.md) — GastoCierre.monedaCode only for MONTO_FIJO; deduct per-currency via lib/gastos.applyGastosToResumenMap in both close + GET routes.
