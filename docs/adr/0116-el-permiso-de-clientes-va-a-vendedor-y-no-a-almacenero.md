# ADR 0116: El permiso de clientes va a la plantilla `vendedor`, no a `almacenero`

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-033

## Contexto

F-033 añade dos permisos a `src/constants/permisos/permisos.json`:

- `configuracion.clientes.acceder` — escribir en el catálogo de clientes (POST, PUT, DELETE de
  `api/clientes/**`) y ver su pantalla de configuración.
- `recuperaciones.cuentasporcobrar.acceder` — ver la entrada de menú «Cuentas por Cobrar» y, cuando
  F-035 la construya, el panel al que apunta.

`src/constants/permisos/permisos.templates.ts` reparte permisos por plantilla de rol (`vendedor`,
`almacenero`, `administrador`). El spec de F-033 dejó esto explícitamente abierto para el
arquitecto, y anotó el precedente del espejo: `configuracion.proveedores.acceder` está hoy en
`almacenero` y en `administrador`; `recuperaciones.proveedoresconsignación.acceder`, solo en
`administrador`.

Copiar el precedente al pie de la letra choca con el epic. El deudor se elige —y a veces se crea—
**en mitad de una venta a crédito en el POS** (F-034, y el criterio 10 de F-033 diseña el caso de
hacerlo sin conexión). Quien está en el POS es la plantilla `vendedor`. Si `vendedor` no lleva
`configuracion.clientes.acceder`, el alta rápida del selector responde 403 justo para el rol que la
necesita.

## Decisión

**`configuracion.clientes.acceder` se añade a `vendedor` y a `administrador`. No a `almacenero`.
`recuperaciones.cuentasporcobrar.acceder` se añade solo a `administrador`.**

El razonamiento, en dos mitades:

- **Un cliente es una contraparte de la venta, no del almacén.** `Proveedor` está en `almacenero`
  porque el almacenero recibe la mercancía en consignación y liquida contra ella. Un deudor no
  entra en ninguno de sus flujos. Copiar el reparto de `Proveedor` habría metido un permiso en un
  rol que no lo usa y lo habría dejado fuera del que sí.
- **Quién debe dinero es una vista de dueño de negocio.** `recuperaciones.cuentasporcobrar.acceder`
  es el gemelo exacto del permiso de «Proveedores Consignación» —el mismo array de menú, el mismo
  tipo de pantalla, el mismo problema al otro lado del libro— y ese está solo en `administrador`.
  Aquí el precedente sí encaja y se sigue.

**Las plantillas son valores por defecto al crear un usuario, no una frontera de seguridad.** La
frontera es `verificarPermisoUsuario` en el backend, y los permisos efectivos se editan por usuario
y por tienda. Esta decisión fija con qué permisos **nace** un usuario nuevo creado desde una
plantilla; no cambia los de ningún usuario existente y se revierte editando dos líneas.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Copiar el reparto de `configuracion.proveedores.acceder` (`almacenero` + `administrador`) | Deja sin permiso al rol que crea clientes durante la venta y se lo da a uno que no los usa |
| Añadirlo a los tres roles | `almacenero` sigue sin necesitarlo, y un permiso concedido «por si acaso» es el que nadie retira después |
| Solo `administrador`, y que el alta rápida del POS no exija permiso | Convertiría el POST de `api/clientes` en una escritura sin permiso. El dosier justifica que **el GET** vaya sin permiso —el selector necesita leer la lista— y dice expresamente «escribir sí exige permiso» |
| Un tercer permiso propio para el alta rápida (`operaciones.clientes.crear`) | El spec y las `notes` de F-033 fijan **dos** permisos nuevos. Un tercero multiplica el cableado de E-047 y parte la regla «quien puede crear un cliente puede corregirlo» en dos configuraciones que se desincronizan |
| Dar a `vendedor` solo POST y no PUT/DELETE, con dos permisos | Mismo problema que la anterior, y el borrado ya es **reversible**: es un `deletedAt`, y ADR 0114 hace que volver a dar de alta el mismo nombre restaure la misma fila |

## Consecuencias

**A favor:**
- El alta rápida de cliente que F-034 necesita en el POS funciona con la plantilla que se usa en el
  POS, sin un permiso extra que configurar a mano en cada negocio.
- El reparto queda explicado, no heredado por parecido con `Proveedor`.

**En contra / coste asumido:**
- Un usuario creado desde la plantilla `vendedor` ve la entrada «Clientes» del menú de
  configuración y puede editar y desactivar clientes. Se acepta por tres razones: el borrado es en
  blando y reversible (ADR 0114), la puerta de 409 impide desactivar a un cliente con deuda viva
  (`.agents/specs/F-031.md`, § 2.1), y un administrador puede quitarle el permiso a ese usuario en
  cualquier momento.
- Se desvía del precedente de `Proveedor` sin cambiarlo. Quien lea las dos plantillas verá dos
  repartos distintos para dos permisos que parecen simétricos; este ADR es la explicación.

**Impacto en seguridad y escalabilidad:**
- Ninguna ruta cambia de gate: las tres de escritura siguen exigiendo
  `configuracion.clientes.acceder` en el backend, y los dos GET siguen sin permiso con
  `permisoAusenteMotivo: "justificado"`.
- No hay impacto de escalabilidad: es un cambio de datos de configuración por defecto.

---

## Adenda del 2026-09-09 — el alcance exacto de «una vista de dueño de negocio»

Levantado por `.agents/F-033-seguridad.md`, hallazgo 🔴-1. La frase de la sección **Decisión**

> «Quién debe dinero es una vista de dueño de negocio.»

justifica por qué `recuperaciones.cuentasporcobrar.acceder` se reserva a `administrador`, y leída
sin más se puede entender como que el saldo de un cliente es un dato protegido. **No lo es, y hay
que decirlo aquí para que ningún feature del epic asuma lo contrario.**

`GET /api/clientes` y `GET /api/clientes/[id]` van **sin permiso** —decisión cerrada del humano,
espejo del GET de `Proveedor`— y devuelven el campo `saldo` de cada cliente. Eso significa que
cualquier sesión válida del negocio, aunque no tenga ningún permiso, puede leer cuánto debe cada
cliente **de su propio negocio**. Es deliberado: quien va a fiar necesita saber cuánto debe ya esa
persona antes de fiarle más (ADR 0115), y el criterio 8 del backlog ya exige que ese campo llegue al
caché del selector.

**La frontera, entonces:** la frase de arriba se aplica al **panel agregado** de F-035 —quién debe,
cuánto, desde cuándo, el histórico de abonos—, que sí va detrás de
`recuperaciones.cuentasporcobrar.acceder`. **No** se aplica al saldo por cliente que F-033 expone
sin permiso. F-034, F-035, F-037 y F-039 no deben tratar el saldo de un cliente como un dato
protegido detrás de ese permiso: no lo está, y no lo estuvo desde que F-033 se entregó.

Esto **no toca el aislamiento entre negocios**, que sigue garantizado por
`withTenantScope("cliente", …)` y `withTenantScope("cuentaPorCobrar", …)` en las cinco rutas. Lo que
se acepta por escrito es la sensibilidad del dato **dentro** del propio negocio.

Si algún día se revisara, la corrección **no** sería exigir permiso al GET —cerraría también el
nombre y el teléfono, que el selector necesita—, sino omitir `saldo` de la respuesta cuando la
sesión no lleve `recuperaciones.cuentasporcobrar.acceder`: un cambio de forma del schema, no de
puerta de la ruta.
