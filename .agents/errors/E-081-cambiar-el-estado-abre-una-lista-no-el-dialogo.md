# E-081: «Cambiar el estado» abre una lista de estados, no el diálogo — y el script de QA lo lee como pantalla rota

**Área:** ui
**Apariciones:** 1 — F-038

## Síntoma

Un script de verificación de la bandeja de pedidos hace clic en `Cambiar el estado`, busca el
diálogo inmediatamente después, y obtiene:

```
{ "dialogFound": false }
```

La lectura natural es que la pantalla está rota, o que el diálogo no monta, o que el clic no llegó.
Ninguna de las tres es cierta: el diálogo **no se abre en ese clic**.

## Causa raíz

Entregar un pedido son **dos pasos de UI, no uno**. `Cambiar el estado` abre primero un `Drawer`
con la lista de estados de destino —`Listo`, `En camino`, `Entregado`, `Cancelado`,
`Rechazado por la tienda`—, y solo **elegir `Entregado`** monta `PedidoEntregaDialog`, que es el
que pide la forma de pago.

Ese paso intermedio existe desde F-011/F-012 y por eso **ningún contrato de diseño posterior lo
menciona**: un contrato describe lo que su feature cambia, no lo que ya estaba. Así que quien
escribe la verificación desde el contrato de diseño de F-038 —que habla del diálogo de entrega y
de sus tres métodos— no tiene en ese documento ninguna pista de que hay una pantalla por medio.

Es el mismo género que E-039 por el otro lado: el contrato **no repite** lo que ya está definido en
otro sitio, y eso es correcto; el error es esperar que el contrato sea el mapa completo de la
pantalla en vez de el diff sobre ella.

## Solución

Encadenar los dos clics reales en el script de verificación, esperando a que la transición del
diálogo termine antes de medir:

```
click "Cambiar el estado"  →  click "Entregado"  →  esperar getComputedStyle(DIALOG).transform === "none"  →  medir
```

Lo tercero no es cosmético: medir un componente con transición de entrada antes de que acabe da
cifras falsas, que es E-027.

## Cómo evitarlo

Antes de escribir el guion de verificación de una pantalla, **recorre el camino a mano una vez** y
cuenta los pasos. Un contrato de diseño describe el **diff** sobre una pantalla, no la pantalla
entera: los pasos que ya existían no van a estar escritos ahí, y su ausencia no significa que no
existan. Y si una sonda da «no encontrado» en el primer intento, la primera hipótesis no es que el
código esté roto: es que el camino tiene un paso más del que se supuso.
