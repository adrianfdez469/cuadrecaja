# E-034: El caché de Turbopack en dev sobrevive al reinicio del proceso

**Área:** build
**Apariciones:** 1 — F-012 (paso 6, verificando contra queandabuscando real)

## Síntoma

Para recorrer un checkout real contra queandabuscando hubo que reabrir su tienda demo, y se hizo
**editando su Postgres directamente** (`Store.status`, `StoreProduct.availability`). La página
pública siguió sirviendo el estado **viejo** —«Cerrado…», «Agotado»— pese a:

- reiniciar el proceso de `next dev`,
- borrar `.next/cache/fetch-cache`.

Costó unos 30 minutos, y durante ese rato la hipótesis natural —«la escritura no se aplicó»— era
falsa: la fila en Postgres era correcta desde el primer momento.

## Causa raíz

Dos cosas que se combinan:

1. **Turbopack dev persiste su Data Cache y su Full Route Cache en `.next/cache/turbopack/*.sst`**
   (un formato tipo LSM-tree). Eso **sobrevive al reinicio del proceso**: matar y relanzar
   `next dev` no lo invalida, y borrar `fetch-cache` tampoco, porque no es donde vive. Solo un
   `rm -rf .next` completo lo tira.
2. **La escritura evitó el camino normal de la aplicación.** El panel de administración de
   queandabuscando, al cambiar esos mismos campos, llama a sus `revalidateStores` /
   `revalidateProducts`. Un `UPDATE` a mano en la base **no llama a nadie**, así que el caché se
   queda con lo anterior y no hay ningún error que lo delate.

## Solución

`rm -rf .next` en el proyecto afectado y volver a levantar el servidor.

## Cómo evitarlo

- **Preferir la UI o la API del sistema al que perteneces los datos**, en vez de escribir en su
  base: ese camino dispara sus revalidaciones. El `UPDATE` directo es más rápido de teclear y más
  caro de depurar.
- Si hay que escribir a mano en la base de un Next con Turbopack, **borrar `.next` entero** antes
  de dar por buena cualquier lectura de una página. Reiniciar el proceso **no basta** y produce
  justo el falso negativo más convincente: «ya reinicié, luego el dato está mal».
- Es la contraparte, del lado de queandabuscando, de lo que cuadrecaja ya sabe de su propia
  revalidación por `revalidateTag`. Aplica a cualquier verificación futura que manipule datos de
  queandabuscando fuera de su propia aplicación.
