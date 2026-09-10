# E-060: El «antes» de un criterio lo destruye el propio paso que va a verificarlo

**Área:** tests
**Apariciones:** 1 — F-029 (detectado antes de ocurrir, no después)

## Síntoma

No hay mensaje de error, y esta vez tampoco hay un falso aprobado: hay un criterio que **ya no se
puede verificar nunca**, porque el dato contra el que había que comparar dejó de existir.

Dos de los criterios de F-029 están redactados como comparaciones entre dos instantes:

```
«... sin reescribir ninguna tabla. Verificado con \d sobre las tres tablas en psql
   ANTES Y DESPUES.»

«... el GET del cierre que la contiene devuelve EXACTAMENTE las mismas cifras que
   ANTES DE MIGRAR. Verificado guardando la respuesta del endpoint antes de migrar
   y comparandola despues.»
```

El pipeline los verifica en el paso 6 (`qa`). Pero quien aplica la migración es el `implementer`,
en el paso 5. Cuando `qa` arranca, **el «antes» lleva un paso entero sin existir**.

## Causa raíz

El orden del pipeline y el orden de la evidencia no son el mismo orden. El pipeline asume que
verificar es una actividad *posterior* a construir, y para casi todo lo es. Pero un criterio
comparativo tiene **la mitad de su evidencia situada antes del cambio**, y ninguna fase del
pipeline es dueña de capturarla: el `spec` la redacta, el `implementer` la destruye sin saberlo, y
el `qa` la necesita cuando ya no está.

No es un descuido de ningún agente. Cada uno hizo exactamente su trabajo.

Se distingue de [E-008](E-008-datos-de-prueba-que-no-discriminan.md) en la dirección del fallo: allí
la verificación se ejecuta y no significa nada; aquí no se puede ejecutar en absoluto. Y de
[E-054](E-054-una-recarga-completa-no-es-volver-en-la-misma-sesion.md) en que allí se medía el
instante equivocado, y aquí el instante correcto ya pasó.

## Solución

El coordinador captura el baseline **antes de lanzar el paso 5**, y escalona el paso 5: el
`dev-tester` puede arrancar de inmediato (no toca la base), el `implementer` espera a que el
baseline esté guardado.

Lo que se capturó en F-029, y que conviene copiar como lista:

- `\d` de cada tabla afectada, vía el contenedor: no hay `psql` en el PATH del host.
- Un volcado JSON de las filas que el criterio nombra.
- **Un `pg_dump -Fc` completo.** Es lo que convierte el «antes» de una fotografía en un estado
  restaurable: si la comparación hay que rehacerla, se restaura en vez de reconstruirla de memoria.
- Las respuestas HTTP crudas de los endpoints que el criterio cita, **con su URL exacta, su método
  y el usuario con que se obtuvieron**, más el script que las capturó, para que el «después» use
  literalmente la misma llamada. Una comparación con otra URL u otro usuario no significa nada.

Y una comprobación que no es opcional: **capturar el baseline dos veces y comprobar que sale byte a
byte idéntico.** Sin eso, un `diff` limpio después puede ser suerte, y un `diff` sucio puede ser
ruido del propio endpoint. En F-029 los diez GET salieron idénticos y por eso la comparación
posterior significó algo.

## Cómo evitarlo

Al leer los `acceptance_criteria` en el paso 1, buscar las palabras **«antes»**, «previo», «sin
cambios respecto a», «las mismas cifras que». Cada una marca un criterio cuya evidencia hay que
capturar **antes de lanzar el paso 5**, no cuando le toque a `qa`.

La pregunta operativa para el coordinador: *¿qué destruye el paso 5 que el paso 6 va a necesitar?*
Si la respuesta no es «nada», hay una captura que hacer primero.

Corolario que se cumplió en F-029: cuando el «después» difiera del «antes», leer el criterio
literalmente antes de rechazar. Dos de los diez endpoints ganaron las columnas nuevas con valor
`0` porque serializan el modelo completo sin `select`; el criterio pedía «las mismas **cifras**»,
no «el mismo JSON». Un `diff` ciego lo habría marcado como regresión.
