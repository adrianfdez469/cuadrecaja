# E-026: `npm test` en verde no implica `npx tsc --noEmit` limpio

**Área:** tests
**Apariciones:** 2 — F-006, F-008

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

---

## Adenda F-008: la dirección contraria — `tsc` y `lint` en verde con la suite en rojo

En F-006 el hueco fue «suite verde, tipos rotos». En F-008 fue **el espejo exacto**: el
`implementer` dejó `npx tsc --noEmit` **exit 0** y `npm run lint` **exit 0**, y la suite en
**rojo**.

Lo que la tumbó: añadió `src/app/api/crons/qab-reconciliation/route.ts` y no registró la entrada en
el censo de rutas (`src/constants/routeGuards/routeGuards.json`, ADR 0079). El test
`routeGuardInventory.test.ts` compara **pareja por pareja (ruta, verbo)** contra lo que el disco
exporta, y falla igual por una entrada que falte, que sobre, o que declare otro verbo.

**Por qué ninguna de las dos herramientas lo ve:** con la entrada ausente no hay nada mal tipado ni
mal escrito. `tsc` y `lint` dan exit 0 **correctamente**. Un censo por `(ruta, verbo)` es
precisamente el test que **solo** puede fallar por trabajo de otro, y por tanto el que menos se
deduce de una comprobación local.

**El agravante, y es de proceso:** al `implementer` se le dice «no corras la suite completa, la está
escribiendo el `dev-tester` en paralelo». Esa instrucción existe para que no se juzgue con tests
ajenos a medio escribir — **no** para eximirlo de un test **preexistente y estable** que su cambio
rompe desde fuera. Aquí `routeGuardInventory.test.ts` llevaba en verde desde F-021.

Y un segundo agravante: la lista de testabilidad del contrato de F-008 era exhaustiva sobre lo que
el feature **añade** y no mencionaba el censo, así que programar contra ella al pie de la letra deja
el agujero abierto. Es la forma de E-035 un escalón más arriba.

**La regla:** cuando un feature **añade un archivo que un censo del repositorio enumera** —una
`route.ts`, y probablemente también un permiso o una migración— hay que ejecutar **ese test
concreto** antes de cerrar, aunque la suite completa sea territorio ajeno:

```bash
npx vitest run src/__tests__/routeGuardInventory.test.ts
```
