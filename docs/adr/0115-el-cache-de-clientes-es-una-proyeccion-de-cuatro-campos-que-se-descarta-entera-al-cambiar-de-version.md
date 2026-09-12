# ADR 0115: El caché de clientes es una proyección de cuatro campos, acotada, que se descarta entera al cambiar de versión

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-033

## Contexto

La decisión de producto 6 del dosier (`.agents/cuentas-por-cobrar.md`, § 1) dice que se puede
vender a crédito **sin conexión**. Para eso el selector tiene que poder mostrar deudores sin
servidor, y eso obliga a guardar algo en el navegador.

Las restricciones son cuatro, y las cuatro estaban ya escritas antes de este ADR:

- Las `notes` de F-033 en `.agents/features.json`: «un negocio con 5.000 clientes no debe mandarlos
  a `localStorage`».
- Los criterios 8 y 9 de F-033: lo guardado no supera `CLIENTES_CACHE_SIZE`, contiene `id`,
  `nombre`, `telefono` y `saldo`, y al cambiar el número de versión la entrada vieja se descarta
  **sin romper la pantalla**.
- La regla `client-localstorage-schema` de la skill `vercel-react-best-practices`
  (`.agents/skills/vercel-react-best-practices/rules/client-localstorage-schema.md`).
- El precedente del repo: `src/store/cartStore.ts` ya es un store Zustand con `persist`, `version`,
  `partialize` y `migrate`, hoy en `version: 5`.

## Decisión

**El caché es una lista MRU de `IClienteOption` —exactamente `id`, `nombre`, `telefono` y `saldo`—,
acotada a `CLIENTES_CACHE_SIZE`, versionada con `CLIENTES_CACHE_VERSION`, y que al no coincidir la
versión se descarta entera en vez de migrarse campo a campo.**

Cuatro puntos que son contrato:

1. **Un solo tipo para las dos cosas.** `IClienteOption` es a la vez la opción que pinta el
   selector y la entrada que se persiste. No hay una proyección «de caché» distinta de la
   proyección «de selector» que puedan desincronizarse. El schema Zod
   (`clienteOptionSchema`) es el que fija que son esos cuatro campos y no cinco.
2. **`CLIENTES_CACHE_SIZE` vive en `src/constants/clientes.ts`**, no en el store ni en el hook. Es
   la regla de `AGENTS.md` sobre números mágicos, y además hace que el número sea importable desde
   un test y desde la consola del navegador cuando el `qa` verifique el criterio 8.
3. **`CLIENTES_LIST_LIMIT` > `CLIENTES_CACHE_SIZE`, a propósito.** Si el `GET /api/clientes`
   devolviera como mucho tantas filas como caben en el caché, el tope del caché **nunca se
   ejercitaría** y el criterio 8 pasaría igual con el recorte roto: es
   [E-008](../../.agents/errors/E-008-datos-de-prueba-que-no-discriminan.md), un dato de prueba que
   no discrimina. Con `CLIENTES_LIST_LIMIT = 500` y `CLIENTES_CACHE_SIZE = 200`, sembrar 500
   clientes obliga al recorte a ocurrir.
4. **El cambio de versión descarta, no migra.** `migrate` devuelve el estado vacío para cualquier
   versión distinta de la actual, en las dos direcciones. Un caché es un espejo reconstruible de
   algo que vive en el servidor: migrarlo dato a dato es escribir código de conversión para
   recuperar información que la siguiente petición trae gratis.

Además, al rehidratar se filtra lo leído con `clienteOptionSchema`: una entrada escrita a mano con
la versión **actual** y forma inválida se descarta sola en vez de llegar al render. El criterio 9
exige «sin romper la pantalla», y ese es el otro camino por el que se rompería.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Persistir el `ICliente` completo | Manda `descripcion` y `direccion` —datos personales de terceros— al disco del navegador sin que ninguna pantalla los necesite ahí, y multiplica el tamaño de cada entrada. Es lo que `client-localstorage-schema` desaconseja |
| Guardar todos los clientes del negocio | 5.000 filas en `localStorage` es una escritura síncrona en el hilo principal en cada refresco. `localStorage` es además un almacén acotado por origen: pasarse no da un error recuperable, tira una excepción en mitad del guardado |
| IndexedDB en vez de `localStorage` | Resolvería el tamaño, pero el repo no tiene ningún precedente de IndexedDB y sí tiene uno de `persist` de Zustand bien rodado. Introducir un segundo mecanismo de persistencia de cliente por un caché de 200 filas no se paga |
| Migrar la entrada vieja campo a campo al subir de versión | Código de conversión para reconstruir lo que la siguiente petición al servidor trae completo. Y una migración mal escrita rompe la pantalla, que es justo lo que el criterio 9 quiere impedir |
| Dejar `CLIENTES_CACHE_SIZE` dentro de `clientesStore.ts` | Prohibido por `AGENTS.md` (números mágicos) y deja el tope fuera del alcance de un test |
| Guardar también `fechaUltimoUso` para ordenar la MRU | El orden **es** la lista: la entrada más reciente va delante. Una segunda representación del mismo hecho es un sitio más donde desincronizarse, y añade un quinto campo que el criterio 8 no admite |

## Consecuencias

**A favor:**
- Lo que llega al disco del navegador es lo mínimo que el selector pinta, y está declarado por un
  schema en vez de por una costumbre.
- Subir la versión es una edición de una línea en `src/constants/clientes.ts` y limpia todos los
  navegadores en su siguiente carga.
- El tope y el límite de la lista están relacionados por una desigualdad escrita, no por
  casualidad.

**En contra / coste asumido:**
- El `saldo` del caché es una foto del último refresco. Sin conexión, el selector puede mostrar un
  saldo que ya no es el del servidor. Es información de apoyo para elegir a quién se le fía; la
  cifra que manda es la de `CuentaPorCobrar.saldoPendiente` en el servidor.
- Un negocio con más de `CLIENTES_LIST_LIMIT` clientes no los ve todos en una sola respuesta.
  Sin conexión, un deudor que nunca entró al caché no es seleccionable, y el alta rápida —la salida
  natural— está deshabilitada por el criterio 10. Es deuda anotada: la paginación de
  `GET /api/clientes` se abre cuando un negocio real llegue a ese tamaño.
- El caché es por navegador y por origen: no viaja entre dispositivos.

**Impacto en seguridad y escalabilidad:**
- Reduce la superficie de datos personales persistidos en el dispositivo a nombre, teléfono y una
  cifra.
- El caché **no** es una frontera de tenant: se llena solo con lo que devuelve
  `GET /api/clientes`, que ya está acotado por el `negocioId` de la sesión, así que nunca contiene
  nada que la sesión que lo escribió no pudiera leer.
- El caso que sí hay que acotar es **cambiar de negocio** con el mismo usuario. Se acota con dos
  reglas del contrato, no con una tercera copia del `negocioId` en el disco (que sería un quinto
  campo persistido y chocaría con el criterio 8): el selector solo lee del caché **cuando no hay
  conexión**, y `refreshClientesCache` **reemplaza la lista entera** en vez de fusionarla, así que
  un solo refresco con éxito basta para que no quede ninguna entrada del negocio anterior. La
  ventana que queda —cambiar de negocio y quedarse sin conexión antes de un refresco con éxito—
  la cierra el servidor: la regla dura de F-034 rechaza con 409 una venta a crédito cuyo
  `clienteId` no sea del negocio (dosier § 2, «Reglas duras»).

---

## Adenda del 2026-09-09 — el caché tampoco sobrevive a un cambio de usuario

Levantado por `.agents/security/F-033.md`, hallazgo 🔴-2, y aceptado. La versión original de este
ADR razonó sobre **el mismo usuario cambiando de negocio** y cerró esa ventana **del lado de la
escritura**. Faltaba el escenario real del producto: una tableta de mostrador por la que pasan
varios empleados, con cuentas distintas y a veces de locales distintos. Ahí el que llega no es el
mismo usuario, y lo que queda expuesto no es la escritura sino la **lectura** —nombre, teléfono y
deuda de hasta `CLIENTES_CACHE_SIZE` terceros del turno anterior—, sobre la que este ADR no había
escrito ninguna regla.

**Se amplía la decisión:** el caché pertenece al par **usuario + negocio** que lo escribió, y se
descarta entero en cuanto ese par cambia. La identidad se guarda **en su propia clave de
`localStorage`** (`CLIENTES_CACHE_OWNER_KEY`), nunca como un quinto campo dentro de la entrada, que
volvería ambigua la comprobación del criterio 8. La regla de descarte es una función pura,
`shouldDiscardClienteCache`, y conserva el caché en un solo caso: dueño registrado, presente e igual
al actual. Un caché sin dueño registrado —escrito por una versión anterior a esta adenda— se tira,
porque no hay forma de saber de quién era.

El enganche es **uno**: un `useEffect` en `src/components/Layout.tsx` que vigila la identidad de la
sesión, no una llamada colgada de cada `signOut()`. Hay más de un `signOut()` en el árbol —el manual
del menú, el de la expiración y el del interceptor de `src/lib/axiosClient.ts`— y perseguirlos uno a
uno dejaría fuera justo el caso que no pasa por ninguno: otro usuario entrando en el mismo
navegador. Como los efectos corren después del primer pintado, el store lleva además una bandera no
persistida, `ownerChecked`, y ninguna superficie usa el caché como fuente mientras valga `false`.

Es el primer store de este repositorio que se limpia al cambiar de sesión: no había precedente que
copiar, `cartStore.ts` incluido. La limpieza de `cartStore` queda **fuera del alcance de F-033**,
anotada como deuda.

**Coste asumido:** un usuario que cierra sesión y vuelve a entrar en el mismo dispositivo pierde su
caché y arranca sin conexión con el selector vacío hasta el primer refresco con éxito. Se prefiere
eso a que el turno siguiente lea la deuda de los clientes del anterior.
