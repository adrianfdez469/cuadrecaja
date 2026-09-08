# E-058: El cliente de Prisma se exporta detrás de un `Proxy`, y reasignar el binding no parchea nada

**Área:** tests
**Apariciones:** 1 — F-028 (parte B)

## Síntoma

Para verificar el criterio 11 de la parte B había que **forzar un fallo de runtime real** dentro del
camino del acuse: interceptar la transacción para que el `updateMany` abortara y comprobar que el
mensaje de la excepción no citaba el cuerpo de error de QAB.

La forma evidente es sustituir el método sobre el cliente importado:

```ts
import { qabPrisma } from "@/lib/qab/qabPrisma";
qabPrisma.$transaction = miVersionQueFalla;   // no hace nada
```

Y **no falla**. No hay excepción, no hay aviso, `tsc` está en verde. Simplemente el código bajo
prueba sigue llamando a la implementación original, así que el fallo que se quería provocar nunca
ocurre — y una verificación de ausencia que no provoca nada **se lee igual que un feature
correcto**, que es la trampa de [[E-056]].

## Causa raíz

Ese cliente no se exporta como un objeto: se exporta detrás de un **`Proxy`** que resuelve el
cliente real de forma perezosa en su trampa `get`. Un `Proxy` así **atiende las lecturas y descarta
las escrituras**: la asignación no llega al objeto que hay detrás, y el `get` posterior sigue
devolviendo el método original. No hay error porque, desde el punto de vista del lenguaje, no ha
pasado nada ilegal.

Es la misma familia que [[E-013]] —una señal que nadie escribe usada como si dijera algo— pero al
revés: aquí es una **escritura que nadie recibe**.

## Solución

Operar sobre el cliente real memoizado, no sobre el binding exportado. En este repositorio vive en
`globalThis`, y hay que **forzar antes su inicialización perezosa** con una consulta trivial, porque
hasta la primera lectura no existe:

```ts
await qabPrisma.$queryRaw`SELECT 1`;        // fuerza la inicializacion perezosa
const real = (globalThis as { qabPrisma?: unknown }).qabPrisma;
// y se parchea `real`, que es el objeto que el Proxy resuelve
```

Con eso la intervención sí llega al código bajo prueba, y el aborto de la transacción se produjo de
forma determinista (una sola vez, sin carrera).

## Cómo evitarlo

**Antes de dar por bueno un parche sobre un módulo importado, comprueba que el parche se aplicó** —
no que el comando terminó. Lee el método de vuelta y verifica que es el tuyo, o mete un efecto
observable en la versión parcheada. Un `Proxy`, un getter, un `Object.freeze` o un re-export
`export { x } from …` hacen que la asignación se descarte **en silencio**, y el síntoma aparece
lejos: la prueba pasa porque no probó nada.

Y la regla de fondo, que es la de [[E-056]]: en una verificación de ausencia, el instrumento se
valida **antes** de confiar en lo que no encuentra.
