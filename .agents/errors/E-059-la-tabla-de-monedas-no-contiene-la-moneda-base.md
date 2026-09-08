# E-059: la tabla de monedas del negocio no contiene la moneda base

**Área:** ui
**Apariciones:** 3 — gastos ad-hoc del cierre, fondo inicial (frontend), fondo inicial (backend)

## Síntoma

No hay mensaje de error. El campo de moneda **simplemente no aparece**, o el backend rechaza
la moneda propia del negocio:

```
Moneda(s) no válida(s) para este negocio: CUP
```

Un negocio con `monedaBase = "CUP"` y USD habilitado no podía elegir moneda al registrar un
gasto ad-hoc en el cierre, ni fijar el fondo inicial en CUP. La moneda base del negocio se
comportaba como si no existiera.

## Causa raíz

`NegocioMoneda` guarda **solo las monedas extra** habilitadas. La moneda base vive en
`Negocio.monedaBase` y **no tiene fila** en esa tabla.

Con base CUP y USD habilitado, `AppContext.monedasNegocio` tiene **un** elemento. Todo el
código que decidía «¿hay más de una moneda?» con `monedasNegocio.length > 1` concluía que no
había nada que elegir, y todo el que construía la lista de opciones con `monedasNegocio.map()`
dejaba fuera precisamente la moneda en la que se cuenta casi todo el dinero.

El fallo es silencioso en las dos direcciones: el `<Select>` no se renderiza —no hay hueco
donde se note que falta—, y cuando sí se renderizaba, su `value` por defecto (`monedaBase`) era
un valor que no estaba entre sus `<MenuItem>`.

`useDisplayCurrency` era el único sitio que lo hacía bien, y lo hacía a mano:
`[monedaBase, ...monedasNegocio.filter((m) => m.monedaCode !== monedaBase)]`.

## Solución

Una sola función pura, `buildMonedaOptions(monedasNegocio, monedaBase)` en
`src/utils/monedas.ts`, y el hook `useMonedaOptions` que la alimenta desde `AppContext`. Los
tres sitios pasan a usarla; el gate deja de ser un `.length` sobre la lista cruda y pasa a ser
`hasMultipleCurrencies` sobre la lista ya completa.

En el backend, `POST /api/cierre/[tiendaId]/[cierreId]/initial-cash-fund` añade
`negocio.monedaBase` al conjunto de monedas aceptadas.

## Cómo evitarlo

**Nunca leas `monedasNegocio` en crudo para construir una lista de monedas seleccionables ni
para contar cuántas monedas hay**: no incluye la moneda base. Usa `useMonedaOptions` en
componentes y `buildMonedaOptions` en lógica pura. En el backend, la moneda base se valida
contra `Negocio.monedaBase`, no contra `NegocioMoneda`.

Y la regla general: cuando la ausencia de un dato hace que un control **desaparezca** en vez de
fallar, no hay síntoma que seguir. Un gate del tipo `lista.length > 1` merece una comprobación
de qué contiene la lista de verdad para el negocio más simple posible.
