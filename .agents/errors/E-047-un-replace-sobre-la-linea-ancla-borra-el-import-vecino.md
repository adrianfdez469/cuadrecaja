# E-047: un `replace` sobre la línea-ancla borra el import vecino

**Área:** build
**Apariciones:** 2 — F-023, F-027

## Síntoma

Al extraer una constante duplicada en siete archivos, tres imports ajenos desaparecieron sin que
nadie los tocara a propósito:

- `AuthSplitLayout` en `src/app/olvide-contrasena/page.tsx`
- `DeleteUsuarioDialog` en `src/app/configuracion/usuarios/page.tsx`
- `LANDING_ACTIVATION_TTL_LABEL` en `src/app/landing-components/TrialForm.tsx`

El tercero está en la **landing pública**.

## Causa raíz

El script de edición **sustituía** la línea-ancla por la línea nueva, en vez de **insertar antes**
de ella:

```
# mal: la ancla desaparece
sed -i '' "s|^import { AuthSplitLayout }.*|import { EMAIL_REGEX } from \"@/constants/validation\";|" archivo.tsx
```

Sobre un archivo el error salta a la vista. Sobre siete, con el foco puesto en que el conteo de
sustituciones cuadre, no. El conteo cuadra: **cada sustitución ocurrió**. Lo que no cuadra es lo
que había en el sitio donde ocurrió.

Y falla lejos: el símbolo borrado no revienta en la línea editada, sino donde se usa —a veces
cientos de líneas más abajo, a veces en el render de una página pública.

## Solución

Se detectó inspeccionando el diff de cada archivo uno a uno, y se restauraron los tres imports
antes de compilar, así que `tsc` nunca llegó a verlo. De haber pasado, el fallo habría llegado a
producción como un símbolo indefinido en la landing.

## Cómo evitarlo

**En una edición mecánica sobre N archivos, lee el diff de cada uno.** Que el conteo de
sustituciones cuadre no dice nada: dice que el patrón casó, no que casara donde debía.

Para insertar un import, inserta —`i\` de `sed`, o una edición que conserve la línea-ancla— nunca
sustituyas la línea que usas como referencia. Y si el árbol compila después de una edición masiva,
eso tampoco basta: un símbolo borrado de un `.tsx` de una ruta que nadie compila en ese momento
puede pasar `tsc` y romper en el navegador. Corre `npm run build`, no solo `npx tsc --noEmit`.

---

## Adenda F-027: la misma forma con un ancla que tiene docstring — y `tsc` no la ve

Reapareció al **insertar una función nueva** (`logQabWithheldOutbox`) en `src/lib/qab/qabOutboxLog.ts`,
usando como ancla la línea de la firma vecina:

```
export function logQabOutboxPurgeRun(...)
```

La inserción quedó **entre el docstring de `logQabOutboxPurgeRun` y su propia firma**. Resultado:
la función del purgado descrita por un comentario que hablaba de otra cosa, y la función nueva con
dos docstrings encima.

**Por qué es peor que la variante de F-023, no mejor:** no borra nada, así que **no hay ningún
símbolo indefinido**. El árbol compila perfecto — `npx tsc --noEmit` exit 0 y `npm run lint` exit 0
— y `npm run build`, que la ficha original recomienda como red, **tampoco lo detectaría**. El daño
es documentación que miente, y la documentación no la compila nadie. Se vio releyendo el archivo.

**La regla que faltaba:** cuando la línea-ancla es una firma que **tiene docstring**, el ancla
correcta es el **docstring completo**, no la firma. Una firma exportada de este repo casi siempre
lleva docstring, así que anclar en la línea `export function ...` es anclar dentro del bloque de
otra cosa.
