---
name: gastos-moneda-invariant
description: GastoCierre.monedaCode only applies to MONTO_FIJO ad-hoc expenses; PORCENTAJE_* always base currency.
metadata:
  type: project
---

`GastoCierre.monedaCode` (nullable; null = monedaBase) carries the currency a MONTO_FIJO ad-hoc expense was paid in. PORCENTAJE_VENTAS / PORCENTAJE_GANANCIAS expenses are always computed in base currency and must never carry a currency — enforced by a `.superRefine` on `gastoAdHocCreateSchema` and by forcing `monedaCode: null` for non-MONTO_FIJO in the adhoc POST route.

**Why:** Cash reconciliation in the cierre summary is per-currency. A fixed expense paid in USD must be deducted from the USD `totalEfectivo`/`equivalenteBase` column, not from base. Percentage expenses are derived from already-base-converted sales totals, so they have no native currency.

**How to apply:** Both the close route (writes ResumenMonedaCierre) and the GET route (recomputes summary live) deduct expenses via the shared `applyGastosToResumenMap` in [[../../../src/lib/gastos.ts]] — keep them in sync. Expense totals (`totalGastos`) convert each gasto to base via `convertToBase` using a tasa snapshot built from the negocio's latest TasaCambio per moneda. See [[multicurrency-display]] for the broader convertToBase/tasaSnapshot pattern.
