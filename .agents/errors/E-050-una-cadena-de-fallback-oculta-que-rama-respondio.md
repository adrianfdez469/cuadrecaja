# E-050: Una cadena de fallback oculta qué rama respondió

**Área:** build
**Apariciones:** 1 — F-026

## Síntoma

Se comprobó en qué directorio del repositorio vecino vivía un documento, para anotar la referencia
en `.agents/solicitudes-qab.md`:

```bash
R=".../queandabuscando"; ls "$R/.agents/specs/propuestas/" 2>/dev/null \
  || ls "$R/.agent/specs/propuestas/" 2>/dev/null \
  || find "$R" -name "zonas-de-envio.md" ...
```

El comando **listó los ficheros correctamente**. Se concluyó que la ruta era `.agents/` —la primera
del encadenado— y se escribió así en dos documentos compartidos. Además se le envió al otro equipo
como *corrección* de una ruta que ellos habían escrito bien.

La ruta real es `.agent/`, en singular. La primera `ls` había fallado en silencio (`2>/dev/null`) y
lo que se vio en pantalla era la salida de la **segunda**.

## Causa raíz

Un encadenado `A || B || C` imprime la salida de la rama que triunfó, pero **no imprime cuál fue**.
Con los errores redirigidos a `/dev/null` —que es justo lo que se hace para que el intento fallido no
ensucie— la evidencia de que A falló desaparece, y queda una salida plausible sin procedencia.

El refuerzo que lo vuelve peligroso: el encadenado se escribe precisamente cuando **no se sabe** cuál
es la respuesta. Es decir, se usa en el único caso en que su resultado no se puede contrastar contra
lo que uno esperaba. Y aquí había una hipótesis previa —`.agents/`, que es la convención de **este**
repositorio— así que la salida se leyó como la confirmación de lo que ya se creía.

Los dos repositorios usando `.agent/` y `.agents/` es el terreno que lo hace repetible: la ruta de la
otra parte se parece lo bastante a la propia como para escribirla de memoria sin notarlo.

## Solución

Comprobar cada rama por separado y **decir cuál respondió**, en vez de encadenar:

```bash
for d in .agent .agents; do
  if [ -d "$R/$d" ]; then echo "EXISTE  $R/$d"; else echo "no existe: $R/$d"; fi
done
```

Corregida la ruta en `.agents/solicitudes-qab.md` y en `features.json`, añadiendo en los dos sitios
que el directorio de QAB es `.agent/` **en singular** y que el `.agents/` es la convención de este
repositorio y no la suya.

## Cómo evitarlo

**Si el resultado de un comando va a acabar escrito en un documento o enviado a alguien, no lo
obtengas de un encadenado `||`.** El encadenado sirve para *conseguir* un resultado; no sirve para
*saber de dónde salió*, que es lo que hace falta para afirmarlo.

Dos reglas concretas:

- Cuando pruebes varias posibilidades, **imprime la que acertó**. Un bucle con su `echo` cuesta lo
  mismo y responde la pregunta que de verdad se hizo.
- **Una ruta de otro repositorio se copia de un mensaje, no se escribe de memoria.** Proyectar la
  convención propia sobre la ajena es especialmente fácil cuando las dos se parecen — y aquí la
  corrección equivocada se le mandó al equipo que la tenía bien.

Hermano de [E-045](E-045-el-exit-code-de-un-pipe-no-es-el-del-comando.md): en los dos casos una
construcción del shell puesta para **acotar la salida** se llevó por delante la información que
decidía si la verificación valía. Allí el exit code, aquí la procedencia.
