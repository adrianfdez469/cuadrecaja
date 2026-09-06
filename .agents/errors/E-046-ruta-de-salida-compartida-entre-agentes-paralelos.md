# E-046: ruta de salida de verificación compartida entre agentes paralelos

**Área:** build
**Apariciones:** 1 — F-023

## Síntoma

El `implementer` ejecutó `npm run lint`, leyó su salida y encontró un error que no era suyo:

```
./src/__tests__/qabSsoConstants.test.ts
  Error: '<símbolo>' is defined but never used.
```

Un archivo de `src/__tests__/`, al otro lado de su frontera de escritura, en un estado intermedio
del trabajo del `dev-tester`. Además, el archivo de salida **cambió bajo sus pies** entre la
escritura y la lectura. Diagnosticarlo costó dos pasadas.

## Causa raíz

El coordinador fijó **la misma ruta** en los encargos de los dos agentes que lanzó en paralelo:

```
npm run lint > /tmp/lint.txt 2>&1; echo "EXIT=$?"
```

`implementer` y `dev-tester` corren concurrentes por diseño —sus fronteras de escritura son
disjuntas justo para eso— pero `/tmp/lint.txt` no está en ninguna de las dos fronteras. Los dos lo
escriben, los dos lo leen, y ninguno lo sabe.

Y hay un segundo efecto, más engañoso que el primero: `npm run lint` recorre **todo el árbol**, no
solo los archivos del agente que lo invoca. Así que un lint lanzado por el `implementer` mientras
el `dev-tester` tiene sus tests a medias sale en rojo por trabajo ajeno en curso, sin que nada
señale que el error no es del que lo ejecutó.

## Solución

Ruta de salida **privada por agente**. En el encargo, o no fijar ruta y dejar que cada agente elija
la suya, o dar una distinta a cada uno:

```
npm run lint > "$SCRATCH/lint-implementer.txt" 2>&1; echo "EXIT=$?"
```

Y al leer un error de lint durante el paso 5, comprobar de quién es el archivo antes de intentar
arreglarlo: si cae al otro lado de la frontera de escritura, no es tuyo.

## Cómo evitarlo

**Ningún artefacto compartido entre agentes que corren en paralelo, ni siquiera un archivo
temporal.** Al escribir los encargos del paso 5, revisa que no haya una sola ruta escrita en los
dos.

Hermano de [E-040](E-040-colision-de-fixtures-entre-verificaciones-concurrentes.md): allí el
artefacto compartido era la base de datos de desarrollo, aquí es el archivo de salida. La forma es
la misma —dos agentes dentro de su mandato, un recurso que nadie declaró como compartido— y la
lección se generaliza: la frontera de escritura solo cubre lo que está bajo `src/`.

Y el corolario: **una verificación de árbol completo (`lint`, `build`, `tsc`) durante el paso 5 no
mide solo tu trabajo.** El veredicto que cuenta es el de después de que los dos agentes terminen.
