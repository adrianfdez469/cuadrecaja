# E-007: Una página pública que llama a una API cerrada expulsa al visitante

**Área:** auth
**Apariciones:** 1 — F-018

## Síntoma

Tras hacer logout, `/` redirige inmediatamente a `/login`. En realidad afecta a **cualquier
visitante anónimo de la landing**, no solo a quien acaba de salir: la página pública del producto
es inusable para quien no tiene sesión.

Lo desconcertante es que el servidor está bien:

```
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}' http://localhost:3000/
200 ->            # sin cookie, con cookie vacía y con cookie inválida: siempre 200
```

La redirección es de cliente y ocurre tres pasos después de la petición que la causa.

## Causa raíz

Cadena de cuatro eslabones, ninguno defectuoso por separado:

1. La página pública monta un componente que en su `useEffect` pide datos a la API
   (`PricingSection` → `getPlanes()` → `GET /api/planes`).
2. Esa ruta no está en la allowlist de la puerta de autenticación → responde **401**.
3. `src/lib/axiosClient.ts` traduce **cualquier** 401 a `signOut({ callbackUrl: "/login" })`.
4. El navegador acaba en `/login`.

Un `.catch(() => {})` en el componente **no protege**: el interceptor actúa antes que el catch.

El fallo de clasificación que lo permitió: `/api/planes` se contó como "ya protegida" porque su
`POST` llama a `hasSuperAdminPrivileges()`. Pero **la protección es por verbo, no por archivo**:
su `GET` era público a propósito.

## Solución

**No se allowlistó la ruta.** La página pasó a Server Component con ISR
(`export const revalidate = 3600`), leyendo los datos por una función de `src/lib/` en vez de
pedirlos al navegador. Así el acoplamiento desaparece en vez de parchearse y la ruta se queda
correctamente cerrada como el endpoint de administración que es.

Dos trampas al aplicarlo:

- Un Server Component **no puede hacer `fetch` a su propia API**: viaja sin cookie, la puerta le
  devuelve el mismo 401 y el fallo solo cambia de sitio. Tiene que leer por `src/lib/`.
- `revalidate` **no admite una constante importada**: Next lo lee estáticamente y el build falla.
  Va como literal, con su porqué en un comentario.

## Cómo evitarlo

**Antes de cerrar una ruta de `/api/`, buscar quién la llama desde una página que un anónimo puede
abrir.** El inventario tiene que ser por **verbo**, no por archivo: un `route.ts` puede tener el
`POST` protegido y el `GET` deliberadamente público.

Y la regla general que este error hace concreta: mientras `axiosClient` convierta 401 en
`signOut()`, **un 401 de más no muestra un error, echa al usuario de la aplicación**. Por eso
401 significa solo "no hay sesión" y un fallo de autorización es **403**.

La red que lo cazó no fue ningún test ni ninguna auditoría —el servidor responde 200 y el
middleware hace lo correcto—: fue el recorrido manual de un humano. Los fallos que viven en la
composición de piezas correctas solo aparecen usando el producto.
