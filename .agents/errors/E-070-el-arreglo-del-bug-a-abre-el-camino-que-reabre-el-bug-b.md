# E-070: El arreglo del bug A abre el camino que reabre el bug B

**Área:** ui
**Apariciones:** 1 — F-034

## Síntoma

Ninguno visible, y ahí está la gracia: **el arreglo pasó su propia verificación en verde** antes de
que apareciera el problema.

Al cerrar [E-067](E-067-una-key-reutilizada-mientras-el-nodo-anterior-aun-sale.md), el contrato
ofrecía dos formas de generar una `key` única: derivarla del contador de deduplicación
(`` `${dedupeKey}#${count}` ``) o de un contador monótono. La primera **funciona** para el caso que
el criterio ejercita —la ráfaga de tres clics sobre el mismo aviso— y se verificó así.

La ventana residual aparece por **otro** camino: `removeMessage`.

```
showMessage(..., id)   → count = 1 → key "pos-refresh-msg#1"
removeMessage(id)      → borra la entrada del Map AHORA
                         (el nodo sigue montado, en su transición de salida)
showMessage(..., id)   → no encuentra entrada → count = 1 otra vez
                       → key "pos-refresh-msg#1"  ← la misma, y el anterior sigue ahí
```

En la práctica: un doble-toque en «Actualizar catálogo», o dos cobros seguidos.

## Causa raíz

El arreglo derivaba la `key` de un estado que **dos caminos distintos borran con dos tiempos
distintos**:

- `onExited` borra **después** de la transición de salida. Correcto para derivar de él.
- `removeMessage` borra **inmediatamente**, mientras el nodo aún sale. Reinicia el contador con el
  nodo viejo todavía montado.

Y lo que lo vuelve digno de ficha: **`removeMessage` solo cierra la `key` del `Map` porque el propio
contrato añadió ese tercer cambio**, y lo añadió para proteger otra cosa —que el aviso «Procesando
venta…» siguiera cerrándose en cada cobro, que era el riesgo real de la `key` única—. La línea que
existe para no romper el camino principal es exactamente la que abre la ventana.

La forma general: *el arreglo del bug A introduce el camino que reabre el bug B, y lo hace en la
línea que se añadió para proteger una tercera cosa.* Es de la familia de
[E-064](E-064-el-antes-de-un-criterio-lo-destruye-el-paso-que-lo-verifica.md): dos partes correctas
por separado, con un orden temporal entre ellas que nadie es dueño de comprobar.

## Solución

Un **contador monótono** del proveedor (`useRef`), independiente por completo del estado de
deduplicación. La `key` deja de derivarse de nada que alguien pueda reiniciar.

## Cómo evitarlo

Cuando arregles una colisión de identidad derivando el identificador de un contador o de un estado,
**recorre todos los caminos que escriben o borran ese estado y pregúntate cuándo lo hacen respecto
al ciclo de vida del nodo.** No basta con que el camino que provocó el bug quede bien.

La pregunta operativa: *¿hay alguna vía por la que este contador vuelva atrás mientras el elemento
anterior sigue vivo?* Si la hay, el contador no sirve como identidad — usa uno que solo suba.

Y el dato que confirma el diagnóstico del
[ADR 0121](../../docs/adr/0121-un-defecto-de-infraestructura-sin-dueno-lo-arregla-el-feature-al-que-bloquea.md):
esta ventana **no se ve leyendo el emisor**. Solo aparece al recorrer los seis consumidores de
`removeMessage` y preguntarse por el orden. La encontró el `implementer` después de tener su
primera versión **ya en verde**.
