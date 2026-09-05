# ADR 0056: `.acceder` se evalúa por sesión y `.gestionar` por la tienda dueña del pedido

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-011

## Contexto

Los cuatro permisos `tiendaonline.*` se conceden **por tienda**: `getPermisosUsuario(usuarioId,
tiendaId)` resuelve `session.user.permisos` contra el rol del usuario en su **local actual**, y esa
cadena cambia al cambiar de local. El interruptor `Negocio.tiendaOnlineHabilitada` y el módulo
entero, en cambio, son **por negocio**. Son dos ejes distintos y el guardián de F-004
(`decideTiendaOnlineAccess` / `assertTiendaOnlineAccess`) solo mira la cadena de la sesión: no sabe
a qué tienda pertenece el pedido sobre el que se actúa.

F-004 planteó la deuda en su spec §7.1 y **no la resolvió a propósito**: sus dos `GET` devolvían un
literal fijo y su `PATCH` respondía `501` sin tocar la base (ADR 0030), así que la pregunta no era
observable. F-011 construye la bandeja real sobre ese mismo guardián y sí la vuelve observable.

Tres lecturas posibles, y los criterios 14, 15 y 16 del spec las distinguen ejecutándolas:

1. **La activa manda siempre.** `.gestionar` se resuelve contra `session.user.permisos`. Falla el
   criterio 15: gestionar un pedido de una tienda no activa exigiría cambiar de local a mitad de
   una tarea, y la bandeja es por definición una vista unificada de varias tiendas (criterio 2).
2. **Cualquier tienda asignada manda.** Tenerlo en alguna basta para actuar en todas. Falla el
   criterio 16: un vendedor con `.gestionar` en su tienda podría cambiar el estado de un pedido de
   otra donde su rol explícitamente no se lo concede.
3. **La tienda dueña del pedido manda.** Es la que pasa los tres criterios.

Se suma un caso que existe en la base y que ninguna de las tres lecturas cubre por sí sola:
`PedidoEntrante.tiendaId` es **nullable**, y F-010 lo deja en `NULL` cuando el `storeExternalId`
del cable no resuelve a ninguna `Tienda` de ese negocio. Ese pedido no tiene tienda dueña, así que
no tiene rol contra el que evaluar nada.

Y una restricción de la que no se puede prescindir: `src/lib/tiendaOnline/tiendaOnlineAccess.ts`
lo consumen **F-005 y F-006**, los dos con `passes: true`. Cualquier cambio ahí tiene que dejar su
comportamiento intacto.

## Decisión

**Respuesta asimétrica, y en un módulo nuevo.**

- **`.acceder` es la puerta del módulo y se evalúa UNA sola vez, contra la tienda activa en
  sesión.** Es exactamente lo que hace hoy `assertTiendaOnlineAccess`, sin tocarlo. Se aplica a las
  **tres** rutas de pedidos, el `PATCH` incluido.
- **`.gestionar` se evalúa contra el rol de la `UsuarioTienda` del usuario en la tienda propietaria
  del pedido**, esté o no activa en sesión. Ninguna ruta lo evalúa ya contra `session.user.permisos`.
- **Qué pedidos se ven no lo decide ningún permiso**, lo decide la pertenencia: el conjunto de
  `Tienda.id` con los que el usuario tiene fila en `UsuarioTienda` dentro de ese negocio.

La lógica nueva vive en **`src/lib/tiendaOnline/tiendaOnlineOrderAccess.ts`**, un archivo nuevo, y
`tiendaOnlineAccess.ts` no se modifica.

### Las piezas

`resolveTiendaOnlineOrderScope({ usuarioId, negocioId, rol })` lee de la **base de datos**, no de
`session.user.locales`: esa lista se cuece en el JWT al iniciar sesión y no sigue a una asignación
hecha después (E-021). Devuelve `tiendaIds` (el conjunto que filtra el listado) y `permisos`
(`Tienda.id` → la cadena de permisos del rol de esa `UsuarioTienda`). La consulta filtra por
`tienda: { negocioId }`: una fila que apunte a una tienda de otro negocio no entra nunca.

`decideTiendaOnlineOrderManage({ session, scope, tiendaId })` es **pura** y devuelve uno de tres
valores, en este orden de evaluación:

| Situación | Resultado | HTTP |
|---|---|---|
| `session === null` | `FORBIDDEN` | 403 |
| `tiendaId === null` (el pedido no resolvió a ninguna tienda) | `OUT_OF_SCOPE` | 404 |
| `tiendaId` no está en `scope.tiendaIds` | `OUT_OF_SCOPE` | 404 |
| Está, y `verificarPermisoUsuario` dice que no hay `.gestionar` ahí | `FORBIDDEN` | 403 |
| Está, y lo hay | `ALLOWED` | sigue la ruta |

**Una sola regla une el listado y las dos rutas por `pedidoId`:** un pedido fuera de tu alcance de
tiendas responde `404`, sea porque es de otro negocio, porque es de una tienda a la que no estás
asignado o porque no tiene tienda. Lo que no puedes listar tampoco lo puedes tocar.

### Y el `404` tiene que costar lo mismo por los cuatro caminos

Dos rutas idénticas en su respuesta y distintas en el trabajo que cuesta producirla vuelven a
distinguir lo que la regla acaba de unir. Dos mecanismos, los dos obligatorios:

- **`readTiendaOnlineOrderTiendaId` devuelve `string | null`**, y ese `null` cubre a la vez «no hay
  tal pedido en este negocio» y «el pedido existe y no tiene tienda dueña». Los dos se colapsan en
  la consulta más baja, donde ya no queda ninguna rama que pueda separarlos.
- **El `PATCH` resuelve el alcance y la tienda dueña SIEMPRE, en un `Promise.all`.**
  `resolveTiendaOnlineOrderScope` no depende del `pedidoId`, así que puede ir en paralelo, y no hay
  salida temprana entre las dos. Sin esto, «de otro negocio o inexistente» costaría una consulta y
  «de una tienda fuera de mi alcance» costaría dos: mismo cuerpo, distinto coste.

La propiedad que esto sostiene, dicha de forma contrastable: para los cuatro desenlaces del `404`
coinciden el código, el cuerpo, las cabeceras —los tres porque salen de **una** función,
`tiendaOnlineOrderNotFoundResponse()`— y el número y la forma de las consultas ejecutadas antes de
contestar. Lo que **no** promete es nada sobre el tiempo que tarde Postgres en resolverlas, que no
es algo que un contrato pueda fijar; lo que se verifica es que el camino de código no ramifica.

El `GET` de detalle no necesita ningún arreglo: resuelve las tres causas de su `404` en una sola
consulta, con los tres filtros en el mismo `where`.

### `SUPER_ADMIN`

No tiene filas en `UsuarioTienda`, así que una lectura literal de la pertenencia lo dejaría con la
bandeja vacía. `resolveTiendaOnlineOrderScope` le devuelve **todas** las `Tienda` del negocio, que
es el mismo conjunto que `authOptions` le construye hoy en `locales`, con la cadena de permisos
vacía en cada una: el `.gestionar` se lo concede su `rol` a través de `verificarPermisoUsuario`, no
la fila que no tiene.

El interruptor sigue ganándole, primero y antes que nada (ADR 0028): el gate de `.acceder` corre
antes de resolver el alcance, y con el módulo apagado un `SUPER_ADMIN` recibe el mismo 403 que
cualquiera.

Un pedido con `tiendaId: null` le responde `404` también a él. No es un olvido: es la misma regla
única de arriba, y F-011 no construye ninguna vía para actuar sobre un pedido que nadie puede
listar.

### Cambio de comportamiento deliberado respecto a F-004

El `PATCH /api/tienda-online/pedidos/[pedidoId]/status` **cambia el permiso de su puerta**, de
`tiendaonline.pedidos.gestionar` a `tiendaonline.pedidos.acceder`, y gana el chequeo de
`.gestionar` contra la tienda dueña. El `501` sin escribir se queda exactamente como lo dejó el
ADR 0030.

Efecto sobre el criterio 5 de F-004 («un usuario con `.acceder` pero sin `.gestionar` recibe 403 al
intentar cambiar un estado»), que está cerrado con `passes: true`:

- Sobre un pedido cuya tienda dueña está asignada al usuario, la respuesta sigue siendo `403`. El
  criterio se sigue cumpliendo, solo que el `403` lo emite ahora el chequeo de la tienda dueña.
- Sobre un pedido con `tiendaId: null` —el caso que sale de sembrar una fila de `PedidoEntrante` a
  mano sin resolver la tienda— la respuesta pasa de `403` a `404`.

Quien re-verifique el criterio 5 de F-004 tiene que sembrar el pedido **con un `tiendaId` real** de
una tienda asignada al usuario. Queda escrito aquí y no solo en el progreso, porque el progreso se
borra al cerrar el feature.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Ampliar `tiendaOnlineAccess.ts` con la función nueva | Es el guardián del eje **negocio**: sus dos deciders puros contestan «¿puede esta sesión usar el módulo en este negocio?». La pregunta nueva es del eje **tienda**, necesita leer `UsuarioTienda` y devuelve tres desenlaces, no dos. Mezclarlas difumina justo el contrato que F-005 y F-006 ya verificaron; un archivo nuevo deja ese comportamiento intacto por construcción, sin depender de una revisión |
| Dejar `.gestionar` contra `session.user.permisos` (lectura 1) | Falla el criterio 15, y ata la capacidad de escribir a un estado —cuál es el local activo— que no se ve en la propia pantalla. Un cambio de local hecho en otra pestaña desalinearía el gate sin que nadie lo note |
| «Lo tengo en alguna tienda asignada, puedo en todas» (lectura 2) | Falla el criterio 16. Convierte cuatro permisos concedidos por tienda en cuatro permisos por negocio, que es exactamente la confusión de ejes que esta deuda pedía deshacer |
| Exigir `.gestionar` en la activa **y** en la dueña | Pasa los criterios 15 y 16 —ninguno de los dos lo distingue— pero contradice la frase del spec «tener el permiso en el rol de la tienda dueña **basta**». Añade una segunda condición invisible que produce un 403 que el usuario no puede explicarse |
| Mantener `.gestionar` como puerta del `PATCH` y añadir la dueña detrás | Es la opción anterior con otro nombre. Además deja `.gestionar` significando dos cosas distintas en la misma petición |
| Que un pedido con `tiendaId: null` responda `403` o `501` | `403` filtra que el pedido existe, contra el criterio 9. `501` dejaría actuar sobre un pedido que ninguna pantalla puede listar: una escritura sin lectura correspondiente |
| Resolver el alcance solo cuando el pedido aparece, para ahorrar una consulta | Es la optimización obvia y es justo la que abre el hueco: haría que el `404` de «otro negocio» costara una consulta y el de «tienda fuera de alcance» costara dos. La consulta que ahorra va sobre `@@unique([usuarioId, tiendaId])` y devuelve tantas filas como locales tenga el usuario |
| Que un pedido con `tiendaId: null` lo vea el `SUPER_ADMIN` | Es una segunda regla para un solo rol, y el listado tendría que ramificar. El coste de no hacerlo está acotado y contado abajo |
| Resolver el alcance desde `session.user.locales` | Ese array viaja en el JWT desde el login. Una asignación o una revocación posterior no llega hasta el siguiente inicio de sesión, que es E-021 con otra ropa. Para una decisión de autorización eso no vale |

## Consecuencias

**A favor:**

- Las tres rutas de pedidos comparten **un** conjunto de tiendas, resuelto por **una** función. Lo
  que se lista y lo que se puede tocar no pueden desalinearse: el `404` de un pedido fuera de
  alcance sale de la misma estructura que lo excluyó del listado.
- El eje de cada permiso queda dicho en una frase: `.acceder` es la puerta del módulo (por sesión),
  `.gestionar` es el derecho a actuar sobre el pedido de una tienda concreta (por esa tienda).
- El comportamiento que F-005 y F-006 verificaron no se toca: `tiendaOnlineAccess.ts` no cambia ni
  una línea.
- F-012, que sí escribe, hereda el gate ya construido y verificado por los criterios 15 y 16, en
  vez de tener que inventarlo cuando ya haya escrituras reales de por medio.

**En contra / coste asumido:**

- **Una consulta más por petición** en las tres rutas: la de `UsuarioTienda` (o la de `Tienda` para
  `SUPER_ADMIN`), y en el `PATCH` se paga también cuando el pedido no existe, que es el precio de
  que los cuatro `404` cuesten lo mismo. Va sobre `@@unique([usuarioId, tiendaId])` y devuelve como mucho tantas filas
  como locales tenga el usuario en ese negocio. No se cachea: una autorización leída de un caché es
  una autorización que sobrevive a su revocación.
- **Un pedido con `tiendaId: null` no lo ve ni lo toca nadie desde la bandeja.** Es un pedido real
  del negocio, invisible en la pantalla. El contrato de F-011 lo compensa devolviendo su número en
  la respuesta del listado (`unassignedCount`), para que el hecho sea visible aunque las filas no lo
  sean; resolver el `storeExternalId` a posteriori no es de este feature.
- El `PATCH` cambia el permiso de su puerta respecto a F-004, con el efecto enumerado arriba. Es
  una regresión aparente para quien re-ejecute el criterio 5 de F-004 sin leer esta sección.

**Impacto en seguridad y escalabilidad:**

- El alcance se resuelve **siempre** con `negocioId` en el `where`, vía `tienda: { negocioId }`.
  Una fila de `UsuarioTienda` que apunte a una tienda de otro negocio no entra en el conjunto,
  aunque el `storeExternalId` coincida entre negocios (criterio 9).
- El orden **interruptor → permisos** se conserva sin excepción: `decideTiendaOnlineOrderManage`
  **no** vuelve a mirar el interruptor porque la puerta ya corrió antes, y por eso esta función no
  sirve como gate de entrada de ninguna ruta. Usarla sola sería una guarda más estrecha que la del
  módulo, que es E-032 al revés.
- La autorización de escritura queda atada a un dato de la base (`UsuarioTienda.rolId` →
  `Rol.permisos`) leído en cada petición, no a una cadena cocida en el JWT en el login.
- Los cuatro caminos del `404` ejecutan el mismo trabajo, así que la indistinguibilidad no depende
  de que nadie mida: está en la estructura del handler. Su verificación ejecutable está en el
  § 9.5 del contrato, caso 6.
