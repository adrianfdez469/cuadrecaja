# E-071: Un `if (loading) return <Skeleton/>` es un `unmount`

**Área:** ui
**Apariciones:** 1 — F-033

## Síntoma

El servidor rechaza un cobro con 400 y **la pantalla no dice nada**. El aviso de error no aparece,
el campo del monto vuelve solo a su valor inicial, y el botón de confirmar se rehabilita como si
no hubiera pasado nada. El cajero se va creyendo que cobró.

No es intermitente: el aviso aparecía **cero** veces, no «a veces».

## Causa raíz

En `src/app/cuentas-por-cobrar/[clienteId]/page.tsx` había un `if (loading) return <Skeleton/>` en
la línea 214, y los tres diálogos se renderizaban **por debajo**, en las 329-356.

El `catch` del 400 hacía dos cosas: pintar el error (`setErrorSaldo`) y pedir un refresco de la
tarjeta (`onSaldoDesactualizado` → `cargar()` → `setLoading(true)`). Ese `setLoading` devolvía el
esqueleto y **React desmontaba el subárbol entero**, con todo el `useState` y el `useRef` de los
diálogos dentro. Al terminar la carga se remontaban en blanco y su efecto de precarga volvía a
correr. En React 18 los dos `set*` se agrupan en un solo render, así que el `Alert` **no llegaba a
pintarse ni un fotograma**.

**La huella que descarta cualquier otra explicación:** el campo volvía a `300` — el saldo de
cuando se abrió el diálogo. Ni el real (`120`) ni lo tecleado (`180`). Ese número solo existe en el
snapshot que lee el efecto de precarga: ni el interceptor, ni el servicio, ni ningún `catch`
podían producirlo. Solo un remontaje.

**El quinto síntoma, que nadie había visto y es el peor:** el remontaje regeneraba también
`idempotencyKeyRef`. El reintento del cajero dejaba de ser el replay de `src/lib/idempotency.ts` y
pasaba a ser **un cobro nuevo**. El camino de la idempotencia estaba roto justo donde más falta
hace.

**Lo que costó tiempo fue descartar la sospecha equivocada.** Todo apuntaba al interceptor de
`axiosClient`, que ya tiene dos fichas por manipular respuestas de error ([E-007] hace `signOut()`
con un 401, [E-009] sustituye el cuerpo de cualquier 403). Se descartó **comprobándolo**: un 400
cae en el `return Promise.reject(error)` final, intacto, y el `catch` del diálogo sí llamaba a
`setErrorSaldo`. El error se mostraba — y el componente dejaba de existir en el mismo render.

## Solución

```
- if (loading) return <Skeleton/>
+ if (loading && !detalle) return <Skeleton/>
```

El esqueleto es solo para la **primera** carga; con datos ya en pantalla, el refresco ocurre en su
sitio. La rama de error pasa a `if (!detalle)`, así que un refresco fallido ya no tira los datos:
avisa con un toast.

Dos cambios que el arreglo obliga a hacer juntos: los diálogos se direccionan **por id** y su fila
se **deriva** del detalle recargado, para que vean el saldo real tras la carrera; y su efecto de
reinicio lleva una **guarda de sesión** para correr una vez por apertura. Sin esa guarda, derivar
la fila reintroduce el mismo bug por la puerta de al lado.

## Cómo evitarlo

**`if (loading) return <otra cosa>` no es «mostrar un cargando»: es desmontar todo lo que hay
debajo.** El patrón es inofensivo en una pantalla de solo lectura y deja de serlo en cuanto hay
**un diálogo con estado** por debajo en el árbol: cualquier recarga en segundo plano borra en
silencio un monto tecleado, un error del servidor y una clave de idempotencia.

Antes de escribirlo, pregunta **qué hay renderizado por debajo de esa línea** y si algo de eso
tiene estado que el usuario haya escrito o que garantice una invariante.

Y lo que lo hace difícil de diagnosticar, que es lo que conviene recordar: **el síntoma no se
parece a la causa.** Parece que «el error no se muestra», y en realidad se mostró y el componente
dejó de existir en el mismo render. Este bug no admite test automatizado en este repo
(`@testing-library/react` no está instalado): su única red es la verificación ejecutando.
