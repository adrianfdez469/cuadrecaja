# E-063: Una `key` reutilizada mientras el nodo anterior todavía está saliendo

**Área:** ui
**Apariciones:** 2 — F-031 (detectado y **diferido**), F-032 (bloqueó un criterio)

## Síntoma

Al repetir el **mismo** aviso de error dos o tres veces seguidas, el segundo **no llega a
mostrarse** y el tercero reaparece **sin su contador**:

```
Warning: Encountered two children with the same key, `error:El nombre contiene caracteres...`.
Keys should be unique so that components maintain their identity across updates.
```

Medido en el DOM tras cada clic:

```
clic 1 → 1 aviso, texto base          ✅
clic 2 → 0 avisos  (desaparece)       ❌
clic 3 → 1 aviso, SIN el sufijo «×3»  ❌
```

No hay excepción, no hay red en rojo y la funcionalidad de debajo **funciona**: solo desaparece la
explicación que el usuario necesitaba.

## Causa raíz

`MessageContext.showMessage` deduplicaba reutilizando la misma `key` de `notistack`:

```ts
const key = existing?.key ?? (dedupeKey as SnackbarKey);
if (existing) closeSnackbar(existing.key);
enqueueSnackbar(displayText, { key, onExited: () => activeRef.current.delete(dedupeKey) });
```

Son **dos fallos encadenados**, y arreglar solo uno deja el síntoma a medias:

1. `closeSnackbar` **no desmonta en el acto**: el nodo viejo entra en su transición de salida. El
   `enqueueSnackbar` siguiente monta otro con **la misma `key`**, así que React ve dos hijos con la
   misma `key` en el mismo commit y el resultado es indeterminado.
2. El `onExited` **del viejo** se dispara *después*, y borra de `activeRef` la entrada que ya había
   escrito **el nuevo**. El contador vuelve a 1, y de ahí el `×3` perdido.

## Solución

En `src/context/MessageContext.tsx`, dentro de `MessageProviderInner`, y sin tocar ninguna de las
dos firmas públicas (55 archivos llaman a `showMessage`, 6 sitios a `removeMessage`):

1. **`key` distinta en cada `enqueueSnackbar`**, de un contador monótono en un `useRef`. El
   `dedupeKey` sigue siendo la identidad de deduplicación y la clave del `Map`; **deja de ser** la
   `key` del snackbar.
2. **`onExited` borra solo si la entrada del `Map` sigue siendo suya**, comparando la `key` que
   recibe con la que el `Map` guarda ahora.
3. **`removeMessage(id)` cierra la `key` que el `Map` guarda, no `id`.** No es opcional: con `key`
   única, sin esto el aviso «Procesando venta…» **no se cerraría nunca en cada cobro**.

Por qué el contador monótono y no `` `${dedupeKey}#${count}` ``: ver
[E-066](E-066-el-arreglo-del-bug-a-abre-el-camino-que-reabre-el-bug-b.md).

## Cómo evitarlo

**Una `key` de React es un identificador de instancia, no de contenido.** Si dos elementos pueden
coexistir un instante —y con cualquier componente que tenga transición de salida, pueden—, no
comparten `key`. La deduplicación es *contenido*: va en una estructura aparte.

Y la lección de proceso, que costó la segunda aparición: **el `qa` de F-031 encontró este mismo
defecto**, fuera de sus criterios, y lo dejó anotado en las `notes` de aquel feature diciendo
«conviene una ficha de error **para quien lo posea**». La ficha no se abrió, porque **nadie era
«quien lo posea»**: `MessageContext.tsx` no aparece en el mapa de propiedad de ningún feature del
epic. Volvió siete días después bloqueando un criterio, en un camino peor —el aviso que se pierde
es la única explicación de un rechazo de seguridad—. La regla operativa está en el
**[ADR 0114](../../docs/adr/0114-un-defecto-de-infraestructura-sin-dueno-lo-arregla-el-feature-al-que-bloquea.md)**:
un defecto de infraestructura sin dueño lo arregla el feature al que bloquea, y «anotarlo para
quien lo posea» no es una decisión cuando no hay quien lo posea.

Detalle que confirma que aquí **leer no basta**: el `ui-designer` de F-032 leyó este mismo archivo
al escribir su contrato y concluyó que «el hallazgo de F-031 ya no se reproduce en el archivo
actual». El `qa` lo ejecutó y sí se reproducía.
