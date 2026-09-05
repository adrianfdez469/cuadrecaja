# E-026: `npm test` en verde no implica `npx tsc --noEmit` limpio

**Área:** tests
**Apariciones:** 1 — F-006

## Síntoma

Un archivo de tests llega al `qa` con dos errores de tipos, después de que el coordinador diera el
paso 5 por verificado:

```
src/__tests__/productoPublicacionPresentation.test.ts(74,49): error TS2322:
  Type '"X"' is not assignable to type '"STORE_OPENING_HOURS_INVALID" | ... | "UNKNOWN"'
src/__tests__/productoPublicacionPresentation.test.ts(87,48): error TS2322: (idéntico)
```

Mientras tanto, `npm test` daba **2030/2030 en 85 archivos**. Los dos casos que llevaban el valor
mal tipado **pasaban**.

## Causa raíz

Dos capas del mismo descuido:

1. **Vitest no comprueba tipos.** Transpila y ejecuta; un valor que viola un `z.enum` cerrado corre
   igual si en tiempo de ejecución el código no lo mira. `"X"` era un relleno que nunca se leía,
   así que la aserción pasaba.
2. **El coordinador re-ejecutó solo `npm test`** tras la última pasada del `dev-tester`, y dio por
   bueno un `npx tsc --noEmit` que había ejecutado **antes** de esa pasada. La comprobación era
   real, pero de un árbol anterior.

La segunda es la que dejó pasar la primera. Un tipo mal puesto en un test es barato; un informe de
verificación que afirma algo que ya no es cierto, no.

## Solución

Sustituir el relleno por valores reales del vocabulario cerrado, elegidos además para que la
aserción siga significando algo: `"STORE_OPENING_HOURS_INVALID"` para el estado `BLOCKED` (error
permanente, coherente con «se agotaron los intentos») y `"TRANSPORT"` para `FAILED` (transitorio,
coherente con «se sigue reintentando»). **Nunca** `as any` ni `@ts-expect-error`: el enum cerrado es
justamente la garantía que se quiere probar.

## Cómo evitarlo

**Tras cualquier pasada que toque un `.ts`, re-ejecutar las dos cosas, no una:**

```bash
npx tsc --noEmit && npm test
```

Y la regla de verificación, que es la que de verdad falló aquí: **una comprobación caduca cuando el
árbol cambia**. Si un agente ha escrito desde que se ejecutó el comando, el resultado anterior no
vale como evidencia — hay que volver a ejecutarlo, no citarlo.

Vale para `lint` igual que para `tsc`.
