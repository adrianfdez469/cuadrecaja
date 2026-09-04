# ADR 0029: El interruptor de tienda online llega al cliente por un endpoint propio cacheado en `AppContext`, no por la sesión

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-004
**Se apoya en:** [ADR 0028](0028-gate-del-interruptor-de-tienda-online.md) ·
[ADR 0019](0019-select-explicito-y-403-en-las-rutas-de-negocio.md)

## Contexto

El menú necesita saber si el negocio tiene la tienda online encendida para decidir si pinta la
sección. Hoy **no lo sabe**: ni `ISessionUser` (`src/context/AppContext.tsx`) ni `INegocio`
(`src/schemas/negocio.ts`) exponen `tiendaOnlineHabilitada`, y ni `usePermisos` ni `verificarPermiso`
lo conocen.

Tres restricciones acotan la respuesta:

1. **El menú se pinta en toda la aplicación.** Una llamada de red por render es inaceptable; en el
   POS el `Layout` convive con cientos de tarjetas de producto.
2. **El `negocio` de la sesión se cuece en el login.** `authOptions.ts` lo construye en `authorize`
   y el callback `jwt` solo lo reescribe al volver a entrar o cuando `session.update()` cambia de
   negocio. El `expCustom` del token es el día siguiente a las 6:00.
3. **Quien enciende el interruptor no es el usuario que lo padece.** Lo enciende un `SUPER_ADMIN`
   desde `/configuracion/negocios` (F-003, `PATCH /api/negocio/[id]/qab`). Los usuarios del negocio
   ya están dentro cuando eso ocurre.

De 2 + 3 sale el escenario que decide este ADR: si el valor viaja en el JWT, un `SUPER_ADMIN`
enciende la tienda online de un cliente, el cliente recarga la página, y **no ve nada** hasta que
cierre sesión y vuelva a entrar. La conversación resultante —«ya te lo activé» / «no me aparece»— es
un fallo de producto que no deja rastro en ningún log.

Hay además un motivo estructural, y es el más importante de los dos. El [ADR 0028](0028-gate-del-interruptor-de-tienda-online.md)
exige que el servidor lea el interruptor de la base de datos en cada petición. Si el campo estuviera
también en la sesión y en las cabeceras `x-user-negocio`, estaría **a mano de cualquier handler
futuro**, con la forma exacta de algo en lo que se puede confiar. Nada impediría que F-011 escribiera
`if (!user.negocio.tiendaOnlineHabilitada) return 403` leyendo una copia de hasta veinticuatro horas
de antigüedad — y funcionaría en todas las pruebas.

## Decisión

**Un endpoint propio, `GET /api/tienda-online/estado`, leído una vez por sesión desde `AppContext` y
expuesto como `tiendaOnlineHabilitada: boolean | null` en el valor del contexto. El campo NO se
añade a `INegocio` ni al JWT.**

- **Respuesta:** `200 { tiendaOnlineHabilitada: boolean }`, validada con `tiendaOnlineEstadoSchema`
  (`.strict()`).
- **`negocioId`** sale de `session.user.negocio.id`. La ruta no acepta parámetros.
- **Es la única ruta del módulo que no aplica el gate del interruptor, y tampoco exige ningún
  permiso de tienda online.** Solo sesión. Tiene que ser así: la llama el `AppContext` de *todos*
  los usuarios autenticados. Exigir un permiso dejaría al vendedor sin saber si la sección existe;
  aplicar el gate del interruptor devolvería 403 a todo negocio apagado en cada arranque, y por
  E-009 el frontend no podría distinguir ese 403 de uno real. Con el interruptor apagado responde
  `200 { tiendaOnlineHabilitada: false }`.
- **No filtra nada:** un booleano sobre el propio negocio del llamante, cuyo `id` ya está en su
  sesión.

**Tres estados en el cliente, y los tres importan.** `null` significa «todavía no se sabe»: el menú
no pinta la sección y las páginas pintan *cargando*, no *sin acceso*. Sin ese tercer estado, cada
navegación directa a `/tienda-online/pedidos` daría un parpadeo de «sin acceso» antes de resolver.

**La carga vive dentro del efecto de sesión que ya existe** en `AppContext` —el que llama a
`loadMonedas`— y por tanto **detrás de `if (status !== "authenticated") return;`**. Esto es E-007,
no cosmética: la ruta está cerrada por la puerta de la API, así que llamarla desde un visitante
anónimo de la landing devolvería 401 y `axiosClient` lo sacaría de la aplicación con un `signOut()`.
Se serializa con un contador en un `useRef`, igual que `monedasRequestRef`, porque el efecto vuelve a
correr cada vez que cambia la identidad de la sesión. **Ante un error se fija `false`, no `null`**:
fallo cerrado, la sección se esconde en vez de quedarse parpadeando.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Añadir `tiendaOnlineHabilitada` a `INegocio` y al JWT | El valor se congela en el login: encender el interruptor no llega a los usuarios ya dentro hasta el día siguiente a las 6:00. Y deja el campo a mano de cualquier handler futuro con aspecto de fuente fiable, que es lo que el ADR 0028 prohíbe |
| Igual, pero forzando `session.update()` cuando cambie | El que cambia el interruptor es un `SUPER_ADMIN` en **otra** sesión y en otro navegador. No hay forma de empujar una actualización a las sesiones ajenas sin un canal en vivo que el sistema no tiene |
| Reutilizar `GET /api/negocio/qab` (F-003), que ya devuelve el interruptor | Exige `SUPER_ADMIN` y devuelve **todos** los negocios de la plataforma. Abrirlo al usuario de un negocio reabriría la enumeración de tenants que el ADR 0019 cerró |
| Extender la respuesta de `GET /api/negocio/[id]/monedas`, que el contexto ya llama | Acopla dos cosas sin relación: un cambio en multimoneda pasaría a poder romper el menú. Y su guarda de lectura (`assertNegocioConfigReadAccess`) tiene otro criterio de audiencia |
| Que el `layout.tsx` de servidor lea el interruptor y lo baje como prop | Obliga al layout raíz a consultar la base en cada navegación y a ser dinámico siempre; y `Layout.tsx` es un componente de cliente al final de una cadena de proveedores, así que la prop acabaría siendo *prop drilling* de los que `AGENTS.md` prohíbe |
| Una llamada desde `Layout.tsx` en vez de desde el contexto | El `Layout` se monta en toda la aplicación y su ciclo de vida es el de la navegación: sería una petición por montaje en vez de una por sesión. Y F-005 y F-011 necesitan el mismo dato en sus páginas |
| Un store de Zustand en vez del contexto | El dato es de sesión y se carga junto a la sesión; `AppContext` ya es el dueño de eso y ya carga monedas y tasas con este mismo patrón. Un store nuevo para un booleano añade una fuente de verdad más sin comprar nada |
| No cachear: pedirlo en cada pantalla que lo necesite | Tres consumidores hoy (menú y dos páginas) y más con F-005 y F-011, todos montados a la vez. Serían varias peticiones por navegación para un valor que cambia una vez cada meses |

## Consecuencias

**A favor:**

- Encender el interruptor se ve en la siguiente carga de la aplicación, no en la siguiente sesión.
- **Una** petición por sesión, cero por render. Mismo coste que la carga de monedas que ya existe.
- `tiendaOnlineHabilitada` sigue **sin existir** en la sesión ni en las cabeceras `x-user-*`, así
  que ningún handler puede confundirse de fuente: no hay copia local que leer.
- El estado `null` elimina el parpadeo de «sin acceso» en la navegación directa por URL, que es como
  se prueban los criterios 3 y 4.

**En contra / coste asumido:**

- **Una petición más en el arranque de la aplicación**, para todos los usuarios, incluidos los de
  los negocios que nunca usarán el módulo. Es el precio de que el dato esté fresco.
- El valor cacheado **puede quedarse viejo dentro de una misma sesión**: si el interruptor se apaga
  mientras alguien navega, seguirá viendo la sección hasta que recargue. No es un problema de
  seguridad —al pulsar recibe 403 del servidor— pero sí una entrada de menú que lleva a una pantalla
  de «sin acceso» durante un rato.
- `AppContext` gana un campo y un efecto. Es el tercer dato de sesión que carga; si llega un cuarto,
  toca extraer el patrón a un hook en vez de seguir alargando el proveedor.
- `GET /api/tienda-online/estado` es una excepción deliberada al gate del módulo. Sin este ADR, la
  próxima auditoría la leerá como un olvido y la cerrará, rompiendo el menú de todos los negocios
  apagados con un 403 ilegible.

**Impacto en seguridad y escalabilidad:**

- **La copia del cliente no es una frontera de seguridad y este ADR lo deja escrito.** El servidor
  relee el interruptor de la base en cada petición (ADR 0028). Lo peor que puede hacer una copia
  vieja es enseñar o esconder una entrada de menú.
- **Aislamiento:** la ruta no acepta `negocioId` de ningún sitio; lo toma de la sesión. No hay forma
  de preguntar por otro negocio.
- **Superficie expuesta:** un booleano del propio negocio. No revela existencia de otros tenants, ni
  el token de QAB, ni ninguna otra columna: el `select` nombra una sola (ADR 0019, ADR 0024).
- **Escalabilidad:** un `findUnique` por clave primaria por sesión de usuario. Irrelevante frente a
  las dos consultas de monedas y tasas que el mismo efecto ya dispara.
