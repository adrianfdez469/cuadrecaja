# E-066 — `git checkout --` sobre un archivo modificado y sin commitear

**Área:** build · **Veces:** 1 · **Aparecido en:** F-033 (paso 6, agente `qa`)

## Síntoma

Un agente edita `.agents/features.json`, ve un diff mucho mayor del que esperaba —238 líneas donde
esperaba 2—, deduce que ha corrompido el formato y ejecuta `git checkout -- .agents/features.json`
para «deshacer su cambio».

El archivo no vuelve a como estaba un segundo antes. Vuelve a **su último commit**. Y como llevaba
horas o días modificado en el árbol de trabajo sin commitear, ese checkout se lleva por delante
**todo el trabajo sin commitear de todo el mundo**, no solo la edición propia.

En F-033 el backlog pasó de **37 features a 28**: desaparecieron las nueve entradas del epic de
cuentas por cobrar, incluidos dos features ya cerrados con `passes: true`.

## Causa raíz

`git checkout -- <archivo>` **no es un deshacer**. Es «tráeme la versión del índice», y el índice,
para un archivo nunca añadido, es la del último commit. No hay confirmación, no hay aviso, no
imprime nada, y el contenido descartado **no queda en ningún objeto de git**: no está en
`git fsck --unreachable`, no está en el reflog y no está en el stash. Es la única operación
cotidiana de git que destruye datos sin dejar copia.

El diff inesperado que disparó todo tampoco era un error: reescribir un JSON con `json.dump()`
reformatea el archivo entero —comillas, sangrías, orden de claves—, así que un cambio de dos
líneas se ve como un cambio de doscientas. La reacción correcta a ese diff era leerlo, no revertirlo.

## Solución

Lo que se perdió se recuperó **parcialmente**, y solo porque los agentes de sesiones anteriores
habían leído el archivo y ese contenido vivía en sus transcripciones:

### Primera pasada — recuperación parcial

| Recuperado verbatim | Parcial | Dado por irrecuperable |
|---|---|---|
| F-031, F-032 (descripción y notas), F-034, F-039 | F-035 (descripción + 11 de sus criterios) | F-036, F-037, F-038 |

Ni git, ni los backups de scratchpad, ni el historial local de VS Code y Cursor, ni Time Machine
tenían nada. **La única copia de un archivo sin commitear son las transcripciones de quien lo leyó.**

### Segunda pasada — recuperación COMPLETA, y por qué la primera se quedó corta

**El backlog está entero: 37 features otra vez.** F-036, F-037 y F-038 se recuperaron **verbatim**,
y también los dos criterios que le faltaban a F-035 —eran **trece**, no once—.

La primera pasada buscó **lecturas** del archivo: transcripciones de agentes que lo habían abierto.
Con ese método, tres entradas que nadie había vuelto a leer entre su escritura y su borrado
resultaban invisibles. La segunda buscó otra cosa:

> **La llamada que ESCRIBIÓ el archivo.**

Las nueve entradas se insertaron con un único comando Bash —un heredoc que escribía un script de
Python con los nueve textos literales—, y ese comando quedó capturado **íntegro** como el campo
`command` de la llamada, en la transcripción de la sesión que lo ejecutó. No es una copia leída del
archivo: es **el texto de entrada** con el que se escribió, que es mejor fuente que cualquier
lectura posterior.

La ventana también quedó cerrada por ejecución: entre la inserción y el borrado hubo **tres**
escrituras sobre `features.json`, y las tres tocaban solo F-031 y F-032. Las tres entradas
perdidas murieron exactamente como se habían escrito.

**Cuatro comprobaciones**, ejecutadas y no leídas, antes de devolverlas al backlog:

1. Re-ejecutar el script recuperado reproduce **los recuentos exactos** que la verificación original
   imprimió ocho segundos después de insertar, en la misma sesión.
2. Los 11 criterios que F-035 ya tenía —recuperados en la primera pasada, **desde otra fuente**—
   coinciden verbatim con los 11 primeros de esta recuperación.
3. Los 13 criterios de F-035 aparecen literalmente en un volcado del archivo **anterior** al borrado.
4. El `notes` de F-038 aparece carácter a carácter, en su forma escapada, en otro volcado
   independiente previo al borrado.

Y el recuento final cuadra solo: **37**, el mismo número que antes del incidente.

## Cómo evitarlo

0. **Antes de dar por perdido un artefacto, busca el comando que lo ESCRIBIÓ, no las lecturas que lo
   citan.** «Irrecuperable» significaba aquí «no está en git», y esa es la pregunta equivocada: un
   archivo que un agente escribió por comando vive en la transcripción de la sesión que lo escribió,
   aunque git no sepa nada de él. El barrido que funciona es sobre `.claude/projects/**/*.jsonl`
   buscando el `command` de la llamada que lo creó. Detalle práctico: en macOS, `grep -o` **falla en
   silencio** sobre las líneas larguísimas de esos `.jsonl` —devuelve cero coincidencias donde
   `grep -c` sí encuentra—, así que hay que usar `grep -a` y, mejor, decodificar el JSON con Python.
1. **Nunca `git checkout --`, `git restore` ni `git reset --hard` sobre un archivo que `git status`
   marca como `M`.** Si hay que deshacer una edición propia sobre un archivo modificado por otros,
   se deshace **la edición**, no el archivo: se reescribe el valor concreto que se cambió.
2. **Antes de tocar un archivo de estado compartido, copiarlo.** `cp .agents/features.json
   /ruta/al/scratchpad/features.json.antes` cuesta un comando y es la diferencia entre un susto y
   una pérdida.
3. **Un diff enorme tras un `json.dump()` es lo normal, no una alarma.** Para cambiar un campo de un
   JSON grande, edítalo con una sustitución acotada o vuelca con el mismo formato del original
   (`indent=2`, `ensure_ascii=False`) y **compara con `git diff` antes de decidir nada**.
4. **Un agente no revierte un archivo que no es suyo.** El `qa` verifica y reporta; `features.json`
   es del coordinador. Si el estado del árbol parece roto, se para y se pregunta.

## Corolario, y es el que más duele

Nadie se equivocó al implementar, ni al verificar: F-033 quedó **correctamente aprobado**, con sus
diez criterios ejecutados. La pérdida vino del gesto de limpieza posterior. El daño de un feature no
lo suele hacer el trabajo; lo hace la operación de mantenimiento que se ejecuta con prisa al final,
sobre un archivo compartido, sin haberlo copiado antes.

Hermano de [E-052](E-052-prisma-format-no-es-idempotente.md), cuya adenda es exactamente esto: el
`git checkout <archivo>` que «arregla» un formateo se lleva el cambio sin commitear de otro feature
en el mismo archivo, y `tsc`, `lint` y la suite dan **todos exit 0** mientras tanto.
