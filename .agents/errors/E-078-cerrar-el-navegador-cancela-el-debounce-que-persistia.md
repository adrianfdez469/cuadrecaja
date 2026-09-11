# E-078: cerrar el navegador cancela el debounce que iba a persistir el dato

**Área:** tests
**Apariciones:** 1 — F-036

## Síntoma

Un script de QA teclea un conteo de billetes, **lee el resultado correcto en la misma página**
—«Cuadre perfecto», el total, el veredicto— cierra el contexto de Playwright, y un segundo script
que recarga la página encuentra el conteo **vacío**. Sin ningún error, en ninguno de los dos.

El primer script no miente: lo que leyó era cierto cuando lo leyó.

## Causa raíz

Dos relojes distintos, confundidos en uno:

- El **estado de React es inmediato**: el total, el veredicto y el descuadre se recomputan en el
  mismo tick de la interacción. Todo lo que el criterio pide leer ya está en el DOM.
- La **persistencia va por un debounce de 800 ms** (`saveMonedaBreakdown` en
  `MonedaBreakdownRow`). Cerrar el contexto a los 400 ms de la última pulsación cancela el
  `setTimeout` con la llamada dentro.

No es un fallo de la aplicación: el debounce está para no escribir una vez por dígito. El fallo es
del script, que trata «lo veo en pantalla» como «está guardado».

## Solución

Esperar más que la ventana del debounce antes de cerrar el contexto —o, mejor, **no repartir un
criterio entre dos cargas de página**: verificar el conteo y su veredicto en la misma sesión, que
es además donde el criterio tiene sentido (el cajero cuenta y ve el resultado, no recarga).

Costó dos vueltas, porque la primera conclusión razonable —«el guardado está roto»— es falsa y
apunta a código correcto.

## Cómo evitarlo

**Antes de cruzar una recarga con un dato, pregúntate quién lo escribió y cuándo.** Si el camino
de escritura lleva un debounce, un `setTimeout`, una cola o un `requestIdleCallback`, el cierre del
navegador lo cancela y el síntoma aparece **en el paso siguiente**, lejos de la causa. Lo que se
lee en la misma página no prueba nada sobre lo que sobrevive a un `reload`.

Y su reverso, que es el que muerde: si un script de verificación necesita **dos** cargas de página
para un solo criterio, casi siempre el criterio se puede comprobar en una — y si de verdad
necesita dos, la espera explícita es parte del criterio, no un detalle del script.

Pariente de [E-054](E-054-una-recarga-completa-no-es-volver-en-la-misma-sesion.md): allí la recarga
mide el arranque en frío en vez de la vuelta; aquí **destruye** lo que iba a medir.
