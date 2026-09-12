# ADRIAN-E-088: un `500` de QAB que no es un bug de QAB ni nuestro, sino su instalación

**Área:** qa / integración QAB
**Apariciones:** 1 — F-016 (criterio 9, costó un ciclo entero de QA)

## Síntoma

QA no puede firmar un criterio que necesita un pedido real porque el endpoint público de creación
de pedidos de QAB responde siempre lo mismo:

```
POST http://localhost:3001/api/orders
→ 500 {"error":"ORDER_CREATE_FAILED"}
```

Para **cualquier** pedido, no solo el del feature que se está verificando: un `PICKUP` liso contra
el mismo local falla igual. El endpoint hermano de solo lectura (`/api/orders/quote`), que resuelve
el mismo slug por el mismo camino, responde `200` — así que no es la resolución de slug, ni la
tienda, ni el catálogo.

## Causa raíz

**Al checkout de QAB de esa máquina le faltaban dependencias por instalar.** No era un defecto del
contrato, ni de QAB, ni del feature en verificación: era su `node_modules`. El endpoint es el único
`POST` público del sistema y el único camino que carga esas dependencias, de ahí que todo lo demás
—incluida la vitrina entera y el `quote`— funcionara con normalidad y el fallo pareciera lógico.

El coste no es el `500`: es que un QA disciplinado **hace lo correcto** al no firmar el criterio, y
el feature se queda a un criterio de cerrarse por algo que se arregla con un `npm install`.

## Solución

1. **Antes de culpar al código, lee la traza.** `console.error("[orders] create failed", error)`
   vive en el `route.ts` de QAB y su salida no se pierde: un `next dev` la escribe **a fichero**,
   en `.next/dev/logs/next-development.log` dentro del repo de QAB. No hace falta la terminal donde
   se levantó el servidor, ni levantar una segunda instancia para capturar stdout.
2. Si la traza apunta a un módulo que no resuelve, es esto: `npm install` en el repo de QAB.

## Cómo evitarlo

> Un `500` que afecta a **todos** los casos de un endpoint y a **ninguno** de sus vecinos no es un
> bug de lógica: la lógica discrimina, la instalación no. Antes de escribir un informe de bloqueo,
> lee `.next/dev/logs/next-development.log` del servicio que falla.

Y el corolario para el QA: **descartar que el fallo sea del feature en verificación no es lo mismo
que diagnosticarlo.** En F-016 se descartó bien —probando un `PICKUP` que no toca nada del
feature— y aun así el informe se cerró sin la traza, que era lo único que separaba «QAB está roto»
de «a QAB le falta un `npm install`».
