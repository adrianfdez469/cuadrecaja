# ADR 0070: El SSO reutiliza `tiendaonline.configuracion.acceder` y no añade un quinto permiso al módulo, ni exige el de inventario

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-009
**Se apoya en:** [ADR 0028](0028-gate-del-interruptor-de-tienda-online.md)

## Contexto

El spec de F-009 dejó la pregunta abierta: ¿el botón del SSO necesita un permiso propio, o basta con
el que ya exige la pantalla donde vive?

El módulo cerró en F-004 con **cuatro** permisos, y `src/constants/tiendaOnline.ts` lo dice de forma
explícita: «There is NO fifth `tiendaonline.*` permission». Pero el módulo ya usa **dos gates
distintos**, y la diferencia entre ellos es justo la que hay que decidir aquí:

- `assertTiendaOnlineAccess(session, "tiendaonline.configuracion.acceder")` — la pestaña de Locales,
  los datos públicos del local, publicar y despublicar la vitrina.
- `assertTiendaOnlineAccessAll(session, ["tiendaonline.configuracion.acceder",
  "operaciones.inventario.acceder"])` — los dos `PATCH` de F-006, los que mueven la publicación de
  un producto.

Y el panel de QAB, al otro lado del enlace, edita cosas de las dos familias
(`$QAB_DOCS_PATH/flujos-cc-qab.html`, «Fase 1 · B», paso 3): descripción, `imageUrls`,
`priceOverride`, `visible` y `featured` de un producto; promociones; los `themeTokens` de la marca;
y el interruptor de abrir o cerrar la vitrina. Leído de corrido, parece que el enlace debería exigir
los dos permisos.

## Decisión

**Un solo permiso, `tiendaonline.configuracion.acceder`, por el gate de un solo permiso
(`assertTiendaOnlineAccess`). No se añade ningún permiso a `permisos.json` y no se exige
`operaciones.inventario.acceder`.**

La línea que separa los dos gates del módulo **no es «tocar productos sí o no»**: es **de qué
sistema es la fila que se escribe**.

`operaciones.inventario.acceder` existe en los `PATCH` de F-006 porque esos endpoints escriben en
`Producto` y `ProductoTienda` —las filas de inventario de cuadrecaja, que ese permiso gobierna en
todo el resto de la aplicación—. El panel de QAB **no escribe ninguna fila de cuadrecaja**: su
propio documento lo declara como frontera dura («El panel nunca comparte columna con el sync»,
paso 4 del mismo bloque), con una lista blanca tipada que convierte en error de compilación intentar
escribir `syncedPrice`, `localName` o `availability` desde una escritura del panel. La única columna
compartida es `Store.status`, y es de QAB.

Es decir: el enlace SSO no puede alcanzar nada de lo que `operaciones.inventario.acceder` protege.
Exigirlo protegería una frontera que este enlace no cruza, y dejaría fuera del panel al perfil que
F-009 tiene por destinatario —quien edita fotos, textos y el color de marca, que no tiene por qué
poder tocar el inventario—.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un quinto permiso, `tiendaonline.panel.acceder` | Un permiso nuevo hay que concedérselo a mano a todos los roles de todos los negocios que ya existen: el día del despliegue, nadie puede abrir el panel y nada dice por qué. Y no separa nada real: quien tiene `configuracion.acceder` ya decide si la vitrina está abierta y qué datos públicos muestra, que es más poder sobre la tienda del que da editar una foto. |
| Exigir los dos permisos con `assertTiendaOnlineAccessAll` | Protege una frontera que el enlace no cruza —el panel no escribe filas de cuadrecaja— y deja fuera al perfil de marketing que es el destinatario del feature. Además pone un botón dentro de una pantalla que el usuario **sí** puede abrir y que responde `403` al pulsarlo: el peor de los desenlaces para quien lo usa. |
| Gobernar el SSO por rol (`ADMIN` o superior) en vez de por permiso | El sistema de autorización de este repositorio son permisos por usuario y por tienda; el rol solo aparece como bypass de `SUPER_ADMIN`. Introducir una regla por rol aquí crea un mecanismo que solo existe en un sitio. |
| Que el permiso lo decida la lista de `storeIds` (por ejemplo, exigir al menos un local publicado) | Mezcla autorización con estado de datos. Un negocio recién configurado, sin ningún local publicado todavía, es exactamente quien más necesita entrar al panel. |

## Consecuencias

**A favor:**

- Cero cambios en `permisos.json` y cero migración de permisos por negocio: el feature funciona el
  día que se despliega, con los roles que ya existen.
- El botón vive en una pantalla que exige el mismo permiso que él: no hay ninguna combinación en la
  que se vea el botón y pulsarlo dé `403` por permisos.
- El gate es el del módulo, con el orden de ADR 0028 intacto —interruptor primero, permiso
  después—, de modo que con `tiendaOnlineHabilitada = false` el `403` alcanza también a un
  `SUPER_ADMIN`.

**En contra / coste asumido:**

- **El coste real no es técnico, es de producto, y hay que decirlo con todas las letras:
  `tiendaonline.configuracion.acceder` deja de ser «puede configurar la tienda» y pasa a ser
  «puede configurar la tienda **y entrar al panel de QAB**».** Desde ahí, un usuario sin
  `operaciones.inventario.acceder` puede cambiar `visible` y `priceOverride` de los productos: **lo
  que un cliente real ve y lo que paga en la vitrina pública.**

  Que no sea una escalada de privilegio —lo es: el panel no escribe ninguna fila de `Producto` ni de
  `ProductoTienda` de cuadrecaja, y se verificó contra el código— **no lo hace inocuo**. Quien
  conceda ese permiso a un rol de marketing le está dando poder sobre el precio y la visibilidad de
  cara al comprador, y el nombre del permiso no lo sugiere.

  Esta decisión se toma **al repartir permisos**, no al escribir el código, así que tiene que llegar
  a quien los reparte: § 10.1 del contrato de interfaces obliga al `qa` a repetir el aviso en el
  informe de cierre del feature, aunque todo esté en verde. El humano está al tanto y puede pedir
  que se endurezca; mientras no lo pida, se queda así.
- **Esta decisión depende de lo que el panel de QAB pueda hacer, que no lo decide este repositorio.**
  Si en alguna versión futura el panel escribiera de vuelta en cuadrecaja, o expusiera algo que aquí
  gobierne otro permiso, el fundamento de este ADR deja de sostenerse y hay que revisarlo. La señal
  a vigilar es cualquier cambio en el paso 4 del bloque «Fase 1 · B» de `flujos-cc-qab.html`.
- Endurecerlo, si el humano lo prefiere, cuesta una línea: cambiar `assertTiendaOnlineAccess` por
  `assertTiendaOnlineAccessAll` con los dos permisos. La decisión es barata de revertir, y esa es
  parte de por qué se toma la menos restrictiva primero.

**Impacto en seguridad y escalabilidad:**

- El enlace no concede nada que la sesión de cuadrecaja no conceda ya (ADR 0067): quien puede
  emitirlo puede, dentro del POS, configurar y publicar esos mismos locales.
- **Aislamiento multi-tenant:** el permiso decide **si** se emite; qué locales entran lo decide el
  filtro por `negocioId` de ADR 0067. Son dos guardas independientes, y ninguna de las dos depende
  de nada que aporte el llamador.
- Hay un hueco conocido y anterior a este feature, que este ADR no cierra: los cuatro permisos
  `tiendaonline.*` se conceden **por tienda**, mientras el módulo y su interruptor son **por
  negocio**, de modo que quien tiene el permiso en el local A lo tiene para todo el negocio. Está
  documentado en `TIENDA_ONLINE_SAVE_AUDIT_LOG` desde F-005. El SSO hereda ese hueco tal cual —no lo
  agranda: `storeIds` sigue acotado a los locales de la sesión de ese usuario—.
