# Movimientos — permisos (lenguaje sencillo)

## Ver la pantalla

- Hace falta permiso de **acceder a movimientos de stock**. Sin eso, no verás la opción en el menú de operaciones.

## Crear cada tipo de movimiento

El administrador puede darte solo algunas acciones:

| Lo que hace el usuario | Permiso que lo habilita (nombre interno del producto) |
|------------------------|---------------------------------------------------------|
| Entrar a la pantalla | Acceder a movimientos de stock |
| Registrar **compras** | Crear movimientos de compra |
| **Ajustes** que suman stock | Crear ajustes de inventario (entradas) |
| **Ajustes** que restan stock | Crear ajustes de inventario (salidas) |
| **Enviar** mercancía a otra tienda | Crear transferencias entre tiendas |
| **Recibir** mercancía (recepciones) | Crear recepciones de productos |
| **Consignación** que entra mercancía | Crear entradas de productos en consignación |
| **Consignación** que devuelve mercancía | Crear devoluciones de productos en consignación |

**Liquidar dinero** a proveedores por consignación no es lo mismo que estos movimientos de stock: eso está en la pantalla de **proveedores / liquidaciones** (otro bloque de guía).

## Cómo detectar un problema de permisos

- Ves la lista de movimientos pero **no** el botón Crear, o Crear abre pero **solo ves un tipo** de movimiento en la lista.
- Te deja armar todo pero al guardar sale **no autorizado** (mensaje genérico o de acceso).

**Solución:** Pedir al administrador el permiso concreto de la tabla y **cerrar sesión y volver a entrar**.

## Superadministrador

Tiene acceso completo a todas las funciones del sistema.
