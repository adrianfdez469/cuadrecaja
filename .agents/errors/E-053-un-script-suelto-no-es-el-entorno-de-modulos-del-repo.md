# E-053: un script de verificación suelto no es el entorno de módulos del repositorio

**Área:** tests
**Apariciones:** 3 — F-008 (dos veces, por dos mecanismos distintos) · F-028 parte B · F-038

## Síntoma

Dos agentes de F-008 intentaron verificar código de producción con un script desechable, y los dos
perdieron una iteración por la **resolución de módulos**, no por su código:

1. **`implementer`** — `npx tsx <scratchpad>/routecheck.ts` falló con `MODULE_NOT_FOUND` sobre
   `next/server`. Lo desconcertante: el **mismo** script resolvía `@/`, `zod` y `@prisma/client`
   sin problema.
2. **`qa`** — `tsx` con imports relativos de `.ts` **de este repo** (no de paquetes npm) **no
   exponía los exports nombrados**: `cjs-module-lexer` falla la detección estática incluso en un
   archivo trivial como `cronAuth.ts`. Con `node --import tsx` y con `vitest`, los mismos archivos
   cargan bien.

## Causa raíz

Son dos mecanismos distintos con la misma raíz: **un script fuera del árbol del proyecto no hereda
el entorno de módulos del proyecto.**

- El primero, por **ubicación**: la resolución de `node_modules` sube desde el directorio del
  script, y `/private/tmp/...` no tiene ninguno. Lo que confunde es que los imports que sí
  funcionaban resolvían por otra vía (el `tsconfig` con el alias, y paquetes ya cargados), así que
  el fallo parecía específico de `next/server` cuando era del directorio.
- El segundo, por **cargador**: `tsx` a secas y `vitest` no analizan los módulos igual. Un export
  nombrado que `vitest` ve, `tsx` puede no verlo.

En los dos casos el mensaje señala al import, no a la causa.

## Solución

- El primero: mover el script temporal a la **raíz del repositorio** y borrarlo después.
- El segundo: escribir la verificación como un **`.test.ts` temporal** y ejecutarlo con
  `vitest run`, borrándolo al terminar.

## Adenda F-028 (parte B): el falso positivo apunta a la conclusión CONTRARIA

Tercer mecanismo, y el más peligroso de los tres, porque aquí el cargador **no falla en silencio: da
una respuesta convincente y equivocada**.

El `implementer` de la parte B tenía que descartar un ciclo de **valor** entre módulos de
`src/schemas/` (E-028) antes de dar su cambio por bueno. Intentó cargar el módulo por su cuenta:

```
node --import tsx/esm -e "await import('<ruta>/src/schemas/qabSync.ts')"
```

y obtuvo:

```
Error [ERR_REQUIRE_CYCLE_MODULE]: Cannot require() ES Module … in a cycle
```

Que es, literalmente, el nombre del problema que estaba buscando. Cualquiera lo habría leído como
la confirmación de que el ciclo existía — y habría rehecho un diseño correcto para arreglar un
ciclo inexistente.

**No era el ciclo.** Lo destapó ejecutar el mismo comando contra `src/constants/qab.ts`, un módulo
que **no tiene ni un solo `import`** y en el que un ciclo es imposible por construcción: falla
igual. Es el interop CJS/ESM del cargador de `tsx` en Node 24, o sea la misma causa raíz de esta
ficha, con la diferencia de que el mensaje **nombra el fallo que se estaba investigando**.

La comprobación válida fue cargar los módulos con **`vitest`**, que es el entorno de módulos real
del repositorio: se eligieron seis archivos de test que hacen import **de valor** de las piezas
tocadas y que no estaban en manos del otro agente. Un ciclo de valor habría reventado en la fase de
colección con el `TypeError` de Zod, que es el instrumento que E-019 y E-028 describen. Dos corridas,
exit 0 las dos.

## Cómo evitarlo

**Para verificar código de producción de este repo, usa el cargador del repo.** Un `.test.ts`
temporal ejecutado con `vitest run` —y borrado después— resuelve los alias, los paquetes y los
exports nombrados exactamente como lo hará la suite, que es justamente lo que se quiere comprobar.

Un script en el scratchpad sigue siendo la herramienta correcta para lo que **no** importa código
del repo (calcular un hash a mano, comparar dos algoritmos de orden, verificar un valor del
contrato). En cuanto haya un `import` de `src/`, deja de serlo.

**Y ojo con la frontera de escritura:** si el `.test.ts` temporal vive en `src/__tests__/`, es la
frontera del `dev-tester`. Durante el paso 5, con los dos agentes en paralelo, eso es E-046 —
créalo fuera de esa carpeta, o espera a que el paso cierre.

**Y la regla que añade la adenda de F-028:** cuando el mensaje de un cargador ajeno **nombra justo el fallo que estabas buscando**, desconfía antes de celebrarlo: reprodúcelo contra un caso donde ese fallo sea **imposible por construcción** (un módulo sin imports, un fixture vacío). Si también falla ahí, el mensaje habla del cargador y no de tu código. Un control negativo cuesta un comando y evita rehacer un diseño correcto.

## Adenda F-038: el mismo mecanismo de ubicación, tres features después

El coordinador quiso tomar las líneas base del outbox con un script de Prisma en el **scratchpad de
la sesión**:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@prisma/client' imported from <scratchpad>/baseline.mjs
```

Es **exactamente** el primer mecanismo de esta ficha —la resolución de `node_modules` sube desde el
directorio del script y el scratchpad no tiene ninguno— y aun así se volvió a caer en él. Nota lo
que lo hace fácil de repetir: el enunciado del entorno recomienda el scratchpad para los archivos
temporales, y **esa recomendación es correcta para todo salvo para un script que importe del
repositorio**. La solución fue la de esta ficha: copiarlo a la raíz del repositorio, ejecutarlo y
borrarlo en el mismo comando, dejando `git status --porcelain` sin rastro.

La regla operativa, ya en una línea: **si el script lleva un `import`, su sitio es el repositorio,
no el scratchpad** — aunque sea de usar y tirar, y aunque el import sea de un paquete de
`node_modules` y no de `src/`.
