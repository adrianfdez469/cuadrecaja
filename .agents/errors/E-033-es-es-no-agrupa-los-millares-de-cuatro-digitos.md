# E-033: `Intl.NumberFormat("es-ES")` no agrupa los millares de un número de cuatro dígitos

**Área:** ui
**Apariciones:** 1 — F-011

## Síntoma

El ejemplo trabajado del propio contrato de interfaces decía que `formatOrderAmount("1250.00", "CUP")`
devuelve `1.250,00 CUP`. La implementación, escrita con `Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`,
devolvía `1250,00 CUP`: **sin el punto de millar**.

Con cinco dígitos (`12500`) sí agrupaba. Con cuatro, no.

## Causa raíz

El español tiene **`minimumGroupingDigits: 2`** en CLDR. Significa que el separador de millares no
se aplica hasta que la parte entera tiene **al menos dos dígitos antes del primer grupo** — es
decir, a partir de cinco cifras. Es la convención tipográfica correcta del idioma, no un bug de
`Intl`, y otros locales (`en-US`) no la tienen.

El defecto no estuvo en el formateador sino en la suposición: leyendo el contrato se dio por hecho
que `Intl` agrupa siempre, y el ejemplo trabajado del contrato asumía lo mismo. Dos documentos y
una implementación coincidiendo en la misma suposición falsa.

## Solución

`useGrouping: "always"` en las opciones del formateador. En este proyecto el helper compartido
`getNumberFormat` ya llevaba esa clave en su clave de caché, así que no hizo falta tocar nada más.

## Cómo evitarlo

- **Un ejemplo trabajado dentro de un contrato es una afirmación verificable: ejecútalo.** Este se
  escribió a mano, se copió a la implementación como referencia, y nadie lo corrió hasta que un
  test lo comparó con la salida real.
- Lo cazó un test del `dev-tester`, escrito **contra el contrato y sin ver la implementación** —
  exactamente el escenario para el que existe esa frontera. Ni el arquitecto que escribió el
  ejemplo ni el implementer que lo leyó lo detectaron: los dos compartían la suposición.
- Si un importe formateado aparece en un criterio de aceptación o de diseño, **el valor de prueba
  importa**: `1250` y `12500` toman ramas distintas de `Intl`. Elegir solo uno de los dos deja la
  otra sin probar (hermano de E-008).
