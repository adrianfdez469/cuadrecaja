# E-045: el exit code de un pipe no es el del comando

**Área:** build
**Apariciones:** 1 — F-022

## Síntoma

Tres agentes distintos del mismo feature —`implementer`, `dev-tester` y el propio `qa`— reportaron
`npm run lint` "en verde". No lo estaba:

```
./src/__tests__/cppReportTenant.test.ts
2:21  Error: 'NEGOCIO_B' is defined but never used. Allowed unused vars must match /^_/u.  @typescript-eslint/no-unused-vars
```

`npm run lint` salía con **exit 1** y `npm run build` con `Failed to compile.`. El error llevaba
horas en el árbol y ningún paso del pipeline lo vio, incluido el paso cuya función es verlo.

## Causa raíz

El comando se ejecutó canalizado para acotar la salida:

```bash
npm run lint 2>&1 | grep -E "Error" | head -5; echo "EXIT=$?"
```

`$?` devuelve el exit code del **último** proceso de la tubería —`head`, o `tail`, o `grep`— que
casi siempre es 0. El del comando que importa se pierde. Y el fallo se refuerza solo: la salida de
`npm run lint` en este repo son cientos de líneas de *warnings* preexistentes, así que leer la cola
"a ojo" tampoco delata el único `Error:` real, que aparece mucho antes del final.

Es decir: dos capas de falso verde a la vez. Se lee un exit code que no es el del comando, sobre
una salida en la que el error verdadero está enterrado entre ruido legítimo.

## Solución

Redirigir a archivo y leer el exit code del comando real, nunca el de un pipe:

```bash
npm run lint > /tmp/lint.txt 2>&1; echo "EXIT=$?"
grep -c "Error:" /tmp/lint.txt
```

En F-022 esto destapó el import huérfano al primer intento. El arreglo del test en sí fue trivial;
lo caro fue que nadie lo viera.

## Cómo evitarlo

**Nunca leas `$?` después de un pipe.** Redirige a archivo y comprueba el exit code del comando, o
usa `set -o pipefail` si necesitas la tubería. Aplica a `npm run lint`, `npm run build`,
`npx tsc --noEmit`, `npx vitest run` y a cualquier verificación cuyo veredicto sea el exit code.

Y un corolario: en un repo con *warnings* preexistentes, "leí la salida y se ve bien" no es una
verificación. Cuenta los `Error:`, no mires la cola.

Pariente de [E-026](E-026-la-suite-en-verde-no-implica-tsc-limpio.md) —una comprobación en verde
que no lo está— pero el mecanismo es otro: allí faltaba correr una herramienta, aquí se corrió y se
leyó mal su resultado.
