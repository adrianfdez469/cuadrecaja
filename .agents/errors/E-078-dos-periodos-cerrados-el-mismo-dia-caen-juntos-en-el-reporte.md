# E-078: dos períodos cerrados el mismo día calendario caen siempre juntos en el reporte

**Área:** tests
**Apariciones:** 1 — F-037 (paso 6, verificación de los criterios 1, 2 y 4)

## Síntoma

Se siembran dos escenarios en períodos distintos —uno con crédito y otro sin él— para poder
comparar las cifras de `/reportes/operacion` entre ambos. Los dos períodos se cierran durante la
misma sesión de verificación, que es lo natural. El reporte devuelve **los dos juntos** sea cual
sea el rango que se pida, así que las cifras de un escenario contaminan las del otro y ningún
criterio que compare «con crédito» contra «sin crédito» significa nada.

No hay error, no hay excepción, y las cifras son plausibles: solo son la suma de dos escenarios
que se creían aislados.

## Causa raíz

`resolveDateRange` (`src/lib/reports/period.ts`), con `periodo=personalizado`, redondea `fechaFin`
a la **medianoche local siguiente**. Un rango de un día cubre por tanto el día calendario entero,
y `streamNormalizedSales` selecciona los `CierrePeriodo` por su `fechaFin`. Dos períodos cerrados
con minutos de diferencia comparten día calendario, así que **ningún rango expresable por la UI
los separa**.

No es un defecto: es lo que un usuario espera de un filtro por fechas. Solo es una trampa para
quien siembra escenarios que quiere comparar.

## Solución

Después de cerrar los períodos, **reprogramar sus `fechaInicio` y `fechaFin` por Prisma** a días
calendario distintos. El cierre tiene que ocurrir por la operación real —para que los totales los
calcule la lógica del producto y no un número inventado a mano— pero las fechas se pueden mover
después sin tocar ninguna cifra.

Cerrar los dos períodos en días reales distintos también funciona y no hace falta tocar la base,
pero obliga a partir la verificación en dos sesiones.

## Cómo evitarlo

Cuando una verificación compare **dos períodos**, pregúntate antes de sembrar si el filtro que
los va a separar tiene la resolución suficiente. La respuesta depende del redondeo del filtro, no
de las marcas de tiempo que escribiste: una `fechaFin` con hora y minuto puede quedar redondeada
al día por quien la lee.

Es hermano de [E-023](E-023-medir-un-plan-sobre-una-tabla-que-no-tiene-las-filas.md): allí el plan
se medía sobre una tabla sin las filas del caso, aquí la cifra se mide sobre un rango que no
contiene lo que se cree. En los dos, la medición es válida y la conclusión falsa.
