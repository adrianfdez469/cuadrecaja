# Funcionalidades implementadas del sistema

Documento generado a partir del análisis del código fuente. Sirve como fuente de verdad para actualizar la sección de funcionalidades de la landing u otros usos.

---

## 1. Autenticación y sesión

### 1.1 user-login-web
- **ID:** `user-login-web`
- **Nombre:** Inicio de sesión (web)
- **Categoría:** Autenticación
- **Descripción funcional:** Permite al usuario identificarse con nombre de usuario y contraseña desde la interfaz web. Tras validar credenciales se crea una sesión. Si el negocio del usuario tiene suscripción vencida o suspendida, el acceso se bloquea (salvo que el usuario sea superadministrador).
- **Acciones que permite:** Iniciar sesión, cerrar sesión, mantener sesión por cookies.
- **Condiciones o limitaciones:** El usuario debe tener al menos un local asignado y un rol en alguna tienda. No existe registro público de nuevos usuarios.
- **Dependencias:** Ninguna funcional explícita.
- **Estado:** Completa.

### 1.2 user-login-app
- **ID:** `user-login-app`
- **Nombre:** Inicio de sesión (aplicación móvil)
- **Categoría:** Autenticación
- **Descripción funcional:** Permite a la aplicación móvil autenticar al usuario y obtener un token que se usa en las peticiones posteriores. Incluye renovación del token (refresh).
- **Acciones que permite:** Login con usuario y contraseña, refrescar token, cambiar tienda activa desde la app.
- **Condiciones o limitaciones:** Mismas restricciones de suscripción que en web. El token se envía en cabeceras para las APIs bajo `/api/app/`.
- **Dependencias:** Ninguna.
- **Estado:** Completa.

### 1.3 change-password
- **ID:** `change-password`
- **Nombre:** Cambio de contraseña
- **Categoría:** Autenticación
- **Descripción funcional:** Permite al usuario autenticado cambiar su contraseña indicando la contraseña actual y la nueva.
- **Acciones que permite:** Cambiar la contraseña del usuario en sesión.
- **Condiciones o limitaciones:** Requiere contraseña actual correcta. Sujeto a permisos (configuración de usuarios).
- **Dependencias:** Usuario autenticado.
- **Estado:** Completa.

### 1.4 change-context-tienda-negocio
- **ID:** `change-context-tienda-negocio`
- **Nombre:** Cambio de tienda y negocio en sesión
- **Categoría:** Autenticación
- **Descripción funcional:** Permite al usuario cambiar el local (tienda) o el negocio con el que está trabajando sin cerrar sesión. La sesión actualiza el contexto activo.
- **Acciones que permite:** Cambiar tienda actual, cambiar negocio actual, listar locales disponibles para el usuario.
- **Condiciones o limitaciones:** Solo se pueden elegir tiendas/negocios a los que el usuario tiene acceso.
- **Dependencias:** Usuario autenticado con múltiples tiendas o negocios.
- **Estado:** Completa.

### 1.5 init-superadmin
- **ID:** `init-superadmin`
- **Nombre:** Inicialización del usuario superadministrador
- **Categoría:** Autenticación / Sistema
- **Descripción funcional:** Endpoint de uso interno que, al invocarse con un secreto correcto, crea el primer usuario superadministrador y un negocio asociado si aún no existe. No crea el usuario si ya hay uno con ese nombre.
- **Acciones que permite:** Crear usuario superadmin y negocio vinculado una sola vez.
- **Condiciones o limitaciones:** Requiere parámetro secreto en la URL que coincida con la variable de entorno configurada. Solo debe usarse en despliegue o mantenimiento.
- **Dependencias:** Variables de entorno para secreto y contraseña del superadmin.
- **Estado:** Completa.

---

## 2. Usuarios, roles y permisos

### 2.1 user-management
- **ID:** `user-management`
- **Nombre:** Gestión de usuarios
- **Categoría:** Configuración
- **Descripción funcional:** Permite listar, crear, editar y eliminar o desactivar usuarios del negocio. Los usuarios se asocian a tiendas y se les asigna un rol por tienda.
- **Acciones que permite:** Crear usuario, editar usuario, eliminar o desactivar usuario, listar usuarios. Asignar usuario a tiendas y rol por tienda.
- **Condiciones o limitaciones:** Sujeto a permisos de configuración de usuarios. No hay registro público; los usuarios son creados por un administrador.
- **Dependencias:** Negocio, tiendas y roles existentes.
- **Estado:** Completa.

### 2.2 role-management
- **ID:** `role-management`
- **Nombre:** Gestión de roles
- **Categoría:** Configuración
- **Descripción funcional:** Permite definir roles por negocio (por ejemplo Vendedor, Almacenero, Administrador) y asignar a cada rol un conjunto de permisos. Los permisos controlan qué acciones puede realizar el usuario en cada tienda.
- **Acciones que permite:** Crear rol, editar rol, eliminar rol, listar roles. Asignar permisos al rol mediante lista predefinida.
- **Condiciones o limitaciones:** Los roles son por negocio. Los permisos se seleccionan de una lista fija definida en el sistema.
- **Dependencias:** Ninguna.
- **Estado:** Completa.

### 2.3 permission-templates
- **ID:** `permission-templates`
- **Nombre:** Plantillas de permisos
- **Categoría:** Configuración
- **Descripción funcional:** Expone la lista de permisos del sistema y plantillas predefinidas (por ejemplo vendedor, almacenero, administrador) para asignar rápidamente conjuntos de permisos a un rol.
- **Acciones que permite:** Consultar lista de permisos, consultar plantillas de permisos por tipo de rol.
- **Condiciones o limitaciones:** Solo lectura. Las plantillas son fijas en código.
- **Dependencias:** Ninguna.
- **Estado:** Completa.

### 2.4 permission-check
- **ID:** `permission-check`
- **Nombre:** Comprobación de permisos en operaciones
- **Categoría:** Seguridad
- **Descripción funcional:** Las operaciones del sistema (APIs y, donde aplica, interfaz) comprueban que el usuario tenga el permiso necesario. El superadministrador omite estas comprobaciones.
- **Acciones que permite:** Bloquear o permitir acceso a cada acción según el rol y permisos del usuario en la tienda actual.
- **Condiciones o limitaciones:** Los permisos se resuelven por usuario, tienda y rol asignado en esa tienda. Si la comprobación está desactivada por configuración, no se aplica (en el código actual está activa).
- **Dependencias:** Roles y asignación usuario-tienda-rol.
- **Estado:** Completa.

---

## 3. Negocios y locales

### 3.1 business-management
- **ID:** `business-management`
- **Nombre:** Gestión de negocios
- **Categoría:** Configuración
- **Descripción funcional:** Permite listar, crear, editar y eliminar negocios. Cada negocio tiene límites de suscripción (locales, usuarios, productos) y fecha de vencimiento.
- **Acciones que permite:** Crear negocio, editar negocio, eliminar negocio, listar negocios, consultar estadísticas por negocio.
- **Condiciones o limitaciones:** Acceso restringido según rol (superadministrador puede gestionar todos). Los límites del negocio afectan al uso del sistema.
- **Dependencias:** Ninguna.
- **Estado:** Completa.

### 3.2 locale-management
- **ID:** `locale-management`
- **Nombre:** Gestión de locales (tiendas)
- **Categoría:** Configuración
- **Descripción funcional:** Permite crear, editar, eliminar y listar los locales (tiendas o almacenes) de un negocio. Cada local puede ser tipo tienda o almacén y pertenece a un solo negocio.
- **Acciones que permite:** Crear local, editar local, eliminar local, listar locales, listar locales disponibles para el usuario actual.
- **Condiciones o limitaciones:** El número de locales puede estar limitado por el plan del negocio. El nombre del local es único dentro del negocio.
- **Dependencias:** Negocio existente.
- **Estado:** Completa.

---

## 4. Productos y categorías

### 4.1 product-catalog
- **ID:** `product-catalog`
- **Nombre:** Catálogo de productos
- **Categoría:** Configuración / Inventario
- **Descripción funcional:** Gestiona los productos a nivel de negocio: nombre, descripción, categoría, si permite decimales y relación de fracción (producto que es fracción de otro). Los productos se asocian luego a cada tienda con precio, costo y existencia.
- **Acciones que permite:** Crear producto, editar producto, eliminar producto, listar productos del negocio.
- **Condiciones o limitaciones:** Productos únicos por nombre dentro del negocio. El número de productos puede estar limitado por el plan.
- **Dependencias:** Categorías existentes.
- **Estado:** Completa.

### 4.2 product-codes
- **ID:** `product-codes`
- **Nombre:** Códigos de producto
- **Categoría:** Configuración
- **Descripción funcional:** Asigna códigos (por ejemplo de barras) a productos. Permite generar un código para un producto o generar códigos en lote para varios productos que aún no lo tienen.
- **Acciones que permite:** Generar código para un producto, generar códigos en lote para múltiples productos.
- **Condiciones o limitaciones:** Sujeto a permiso de generación de códigos. Los códigos deben ser únicos.
- **Dependencias:** Productos existentes.
- **Estado:** Completa.

### 4.3 product-per-store
- **ID:** `product-per-store`
- **Nombre:** Productos por tienda (precio, costo, existencia)
- **Categoría:** Operaciones / Inventario
- **Descripción funcional:** Gestiona por cada tienda el precio de venta, costo y existencia de cada producto, y la asignación de proveedor en caso de productos en consignación. Permite consultar productos con sus códigos para venta.
- **Acciones que permite:** Listar y actualizar precios, costos y existencias por tienda; listar productos disponibles para venta en la tienda; listar productos con códigos.
- **Condiciones o limitaciones:** Los productos deben estar dados de alta en el negocio y asociados a la tienda.
- **Dependencias:** Catálogo de productos, tienda.
- **Estado:** Completa.

### 4.4 category-management
- **ID:** `category-management`
- **Nombre:** Gestión de categorías
- **Categoría:** Configuración
- **Descripción funcional:** Permite crear, editar, eliminar y listar categorías de productos. Cada categoría tiene nombre y color y es por negocio.
- **Acciones que permite:** Crear categoría, editar categoría, eliminar categoría, listar categorías.
- **Condiciones o limitaciones:** Nombre único por negocio. Las categorías se usan en productos y en reglas de descuento.
- **Dependencias:** Negocio.
- **Estado:** Completa.

---

## 5. Ventas y punto de venta

### 5.1 pos-sales
- **ID:** `pos-sales`
- **Nombre:** Punto de venta (POS)
- **Categoría:** Operaciones
- **Descripción funcional:** Permite registrar ventas desde la interfaz web: agregar productos al carrito, aplicar descuentos, indicar pago en efectivo y/o transferencia (con destino de transferencia opcional) y cerrar la venta. Las ventas se asocian al cierre de caja (período) abierto en la tienda.
- **Acciones que permite:** Añadir y quitar productos del carrito, aplicar descuentos (con vista previa), registrar pago efectivo y transferencia, guardar venta, sincronizar ventas cuando hay recuperación de conexión.
- **Condiciones o limitaciones:** Debe haber un período de caja abierto. Sujeto a permisos de acceso al POS y, para cancelar venta, a permiso específico. Puede operar con soporte offline limitado (reintentos al sincronizar).
- **Dependencias:** Productos por tienda, cierre de período abierto, descuentos (opcional), destinos de transferencia (si se usa transferencia).
- **Estado:** Completa.

### 5.2 app-pos-sales
- **ID:** `app-pos-sales`
- **Nombre:** Ventas desde aplicación móvil
- **Categoría:** Operaciones
- **Descripción funcional:** Permite registrar ventas desde la aplicación móvil: consultar período actual, abrir período si corresponde, crear ventas con productos, descuentos y pagos (efectivo/transferencia), y anular ventas. Los productos y destinos de transferencia se obtienen de la API.
- **Acciones que permite:** Obtener período actual de la tienda, abrir período, crear venta, eliminar (anular) venta, consultar productos de la tienda, consultar destinos de transferencia, obtener vista previa de descuentos.
- **Condiciones o limitaciones:** Autenticación por token. Misma lógica de cierre y permisos que en web donde aplique.
- **Dependencias:** Autenticación app, productos por tienda, períodos, descuentos.
- **Estado:** Completa.

### 5.3 sales-list-detail
- **ID:** `sales-list-detail`
- **Nombre:** Listado y detalle de ventas
- **Categoría:** Operaciones
- **Descripción funcional:** Permite consultar las ventas realizadas en una tienda dentro de un cierre y ver el detalle de cada venta (productos, cantidades, totales, descuentos, forma de pago). Permite eliminar (anular) una venta si se tiene permiso.
- **Acciones que permite:** Listar ventas por tienda y cierre, ver detalle de una venta, eliminar venta (anulación).
- **Condiciones o limitaciones:** Sujeto a permisos de acceso a ventas y de eliminación de ventas. Las ventas están asociadas a un cierre; al anular se revierten existencias con movimientos de ajuste.
- **Dependencias:** Cierre de período, ventas registradas.
- **Estado:** Completa.

### 5.4 transfer-destinations
- **ID:** `transfer-destinations`
- **Nombre:** Destinos de transferencia
- **Categoría:** Configuración
- **Descripción funcional:** Permite definir por tienda los destinos de transferencia (por ejemplo nombres de bancos o cuentas) que el usuario puede elegir al registrar un pago por transferencia en una venta. Se puede marcar un destino como predeterminado.
- **Acciones que permite:** Crear, editar, eliminar y listar destinos de transferencia por tienda.
- **Condiciones o limitaciones:** Nombre único por tienda. Usado en POS y en app al registrar pagos por transferencia.
- **Dependencias:** Tienda.
- **Estado:** Completa.

---

## 6. Descuentos

### 6.1 discount-rules
- **ID:** `discount-rules`
- **Nombre:** Reglas de descuento
- **Categoría:** Configuración
- **Descripción funcional:** Permite crear, editar, eliminar y listar reglas de descuento por negocio. Cada regla tiene tipo (porcentaje, monto fijo o código promocional), valor, ámbito de aplicación (ticket, producto, categoría o cliente) y condiciones opcionales (mínimo de compra, productos o categorías concretas, código). Pueden tener fechas de vigencia.
- **Acciones que permite:** Crear regla, editar regla, eliminar regla, listar reglas, consultar opciones de tipos y ámbitos.
- **Condiciones o limitaciones:** Las reglas se evalúan al aplicar descuentos en una venta; si tienen código, solo aplican cuando se introduce ese código. Por negocio.
- **Dependencias:** Negocio.
- **Estado:** Completa.

### 6.2 discount-preview-and-apply
- **ID:** `discount-preview-and-apply`
- **Nombre:** Vista previa y aplicación de descuentos en venta
- **Categoría:** Operaciones
- **Descripción funcional:** Calcula el resultado de aplicar las reglas de descuento activas a un carrito (productos y cantidades) y opcionalmente códigos introducidos, devolviendo el total con descuentos y el detalle de descuentos aplicados. Esa lógica se usa al registrar la venta para guardar los importes descontados.
- **Acciones que permite:** Obtener vista previa de descuentos para un carrito (web y app), aplicar descuentos al registrar la venta y guardar el monto descontado por regla.
- **Condiciones o limitaciones:** Solo aplican reglas activas y vigentes en fecha. Las condiciones (mínimo, productos, categorías, código) deben cumplirse.
- **Dependencias:** Reglas de descuento del negocio.
- **Estado:** Completa.

---

## 7. Cierre de caja

### 7.1 period-open-close
- **ID:** `period-open-close`
- **Nombre:** Apertura y cierre de período de caja
- **Categoría:** Operaciones
- **Descripción funcional:** Permite abrir un nuevo período de caja en una tienda (cuando no hay uno abierto) y cerrar el período actual. Al cerrar se calculan totales de ventas (efectivo, transferencia, descuentos) y ganancias (propias y consignación). El cierre queda cerrado y las ventas posteriores pertenecen a un nuevo período al abrirlo.
- **Acciones que permite:** Obtener último cierre, abrir período, cerrar período, consultar un cierre por identificador, consultar resumen del cierre (totales y ganancias).
- **Condiciones o limitaciones:** No se puede abrir un nuevo período si ya hay uno abierto. Solo se puede cerrar el período actual. Sujeto a permisos de cierre (acceder y cerrar).
- **Dependencias:** Tienda, ventas del período.
- **Estado:** Completa.

### 7.2 period-summary
- **ID:** `period-summary`
- **Nombre:** Resumen de cierre de caja
- **Categoría:** Operaciones
- **Descripción funcional:** Muestra el resumen de un cierre ya cerrado: totales de venta, efectivo, transferencia, descuentos y ganancias (propias y por consignación). Permite revisar cierres anteriores.
- **Acciones que permite:** Ver resumen del cierre (totales y ganancias) por tienda y cierre.
- **Condiciones o limitaciones:** Sujeto a permiso de acceso a resúmenes de cierre.
- **Dependencias:** Cierre cerrado.
- **Estado:** Completa.

---

## 8. Movimientos de inventario

### 8.1 stock-movements
- **ID:** `stock-movements`
- **Nombre:** Movimientos de stock
- **Categoría:** Operaciones
- **Descripción funcional:** Permite registrar movimientos de entrada y salida de productos en una tienda: compra, ajuste de entrada, ajuste de salida, traspaso (entrada/salida entre tiendas), recepción de traspaso, entrada por consignación y devolución de consignación. Cada movimiento actualiza existencia y, cuando aplica, costo promedio ponderado (CPP).
- **Acciones que permite:** Crear movimiento (por tipo), listar movimientos por tienda y tipo, consultar productos para entrada o salida por tipo, consultar recepción de traspasos pendientes.
- **Condiciones o limitaciones:** Cada tipo de movimiento está sujeto a un permiso específico. Los traspasos vinculan tienda origen y destino; la recepción confirma la entrada en destino.
- **Dependencias:** Productos por tienda, tiendas (para traspasos), proveedores (para consignación).
- **Estado:** Completa.

### 8.2 movement-import
- **ID:** `movement-import`
- **Nombre:** Importación de movimientos
- **Categoría:** Operaciones
- **Descripción funcional:** Permite enviar por API un lote de movimientos con datos de contexto (usuario, negocio, local) y una lista de ítems. El sistema crea los movimientos correspondientes según la lógica de importación definida.
- **Acciones que permite:** Enviar un payload con datos de contexto e ítems para crear múltiples movimientos de una vez.
- **Condiciones o limitaciones:** El cuerpo debe incluir `data` (usuarioId, negocioId, localId) e `items` (array no vacío). La estructura de ítems debe cumplir lo que espera la lógica de importación.
- **Dependencias:** Usuario, negocio y local válidos; productos y datos coherentes en ítems.
- **Estado:** Completa.

---

## 9. Inventario y conformación de precios

### 9.1 inventory-view
- **ID:** `inventory-view`
- **Nombre:** Vista de inventario
- **Categoría:** Operaciones
- **Descripción funcional:** Permite consultar el inventario actual de una tienda: productos con existencia, precios y costos. Orientado a revisión y recuperación de datos.
- **Acciones que permite:** Ver listado de productos con sus existencias y precios por tienda.
- **Condiciones o limitaciones:** Sujeto a permiso de acceso a inventario.
- **Dependencias:** Productos por tienda.
- **Estado:** Completa.

### 9.2 conformar-precios
- **ID:** `conformar-precios`
- **Nombre:** Conformar precios
- **Categoría:** Operaciones
- **Descripción funcional:** Permite revisar y ajustar precios (y costos) de productos en una tienda. Incluye la posibilidad de imprimir etiquetas con datos del producto.
- **Acciones que permite:** Consultar datos de precios y costos por tienda, actualizar precios/costos, imprimir etiquetas.
- **Condiciones o limitaciones:** Sujeto a permiso de conformar precios.
- **Dependencias:** Productos por tienda.
- **Estado:** Completa.

---

## 10. Costo promedio ponderado (CPP)

### 10.1 cpp-analysis
- **ID:** `cpp-analysis`
- **Nombre:** Análisis de costo promedio ponderado
- **Categoría:** Recuperaciones / Reportes
- **Descripción funcional:** Calcula y muestra el análisis de CPP por tienda a partir de los movimientos de stock. Permite consultar análisis general o desviaciones respecto a un umbral configurable.
- **Acciones que permite:** Obtener análisis CPP de una tienda, obtener desviaciones de CPP según umbral.
- **Condiciones o limitaciones:** Sujeto a permiso de análisis CPP. Los datos dependen de movimientos con información de costo.
- **Dependencias:** Movimientos de stock con costos, tienda.
- **Estado:** Completa.

### 10.2 cpp-migrate
- **ID:** `cpp-migrate`
- **Nombre:** Migración de datos históricos CPP
- **Categoría:** Recuperaciones / Sistema
- **Descripción funcional:** Permite ejecutar una migración (o simulación) de datos históricos de CPP para una tienda. Puede ejecutarse en modo solo simulación (dry run) sin modificar datos.
- **Acciones que permite:** Ejecutar migración CPP (o simulación) por tienda.
- **Condiciones o limitaciones:** La migración afecta a datos históricos de la tienda. El modo dry run no persiste cambios.
- **Dependencias:** Tienda y datos de movimientos.
- **Estado:** Completa.

---

## 11. Proveedores y consignación

### 11.1 supplier-management
- **ID:** `supplier-management`
- **Nombre:** Gestión de proveedores
- **Categoría:** Configuración
- **Descripción funcional:** Permite crear, editar, eliminar y listar proveedores del negocio. Un proveedor puede estar asociado opcionalmente a un usuario. Los proveedores se usan en productos en consignación y en liquidaciones.
- **Acciones que permite:** Crear proveedor, editar proveedor, eliminar proveedor, listar proveedores.
- **Condiciones o limitaciones:** Nombre único por negocio.
- **Dependencias:** Negocio.
- **Estado:** Completa.

### 11.2 consignment-liquidation
- **ID:** `consignment-liquidation`
- **Nombre:** Liquidación a proveedores (consignación)
- **Categoría:** Operaciones
- **Descripción funcional:** Permite registrar la liquidación a un proveedor por un cierre: se calculan o registran montos vendidos, costos y existencias por producto en consignación para ese cierre y proveedor, y se marca como liquidado.
- **Acciones que permite:** Listar proveedores con productos en consignación, consultar datos por proveedor, registrar liquidación por cierre y proveedor.
- **Condiciones o limitaciones:** Sujeto a permiso de liquidar a proveedores. Requiere cierre cerrado y productos en consignación asociados al proveedor.
- **Dependencias:** Proveedores, productos en consignación, cierre de período.
- **Estado:** Completa.

---

## 12. Dashboard y reportes

### 12.1 dashboard-summary
- **ID:** `dashboard-summary`
- **Nombre:** Resumen del dashboard
- **Categoría:** Operaciones
- **Descripción funcional:** Muestra un resumen de la tienda seleccionada para el usuario: indicadores y datos agregados útiles para la operación diaria.
- **Acciones que permite:** Consultar resumen por tienda.
- **Condiciones o limitaciones:** Sujeto a permiso de acceso al dashboard.
- **Dependencias:** Tienda, datos de ventas y cierres.
- **Estado:** Completa.

### 12.2 dashboard-metrics
- **ID:** `dashboard-metrics`
- **Nombre:** Métricas del dashboard
- **Categoría:** Operaciones
- **Descripción funcional:** Expone métricas por tienda para alimentar gráficos o paneles (por ejemplo ventas, tendencias). Consumido por la interfaz de dashboard.
- **Acciones que permite:** Consultar métricas por tienda.
- **Condiciones o limitaciones:** Sujeto a permisos de dashboard.
- **Dependencias:** Tienda y datos de negocio.
- **Estado:** Completa.

---

## 13. Notificaciones

### 13.1 notifications-crud
- **ID:** `notifications-crud`
- **Nombre:** Gestión de notificaciones
- **Categoría:** Configuración
- **Descripción funcional:** Permite crear, editar, eliminar y listar notificaciones del sistema. Cada notificación tiene título, descripción, fechas de vigencia, nivel de importancia (baja, media, alta, crítica) y tipo (alerta, notificación, promoción, mensaje). Se puede dirigir a negocios o usuarios concretos o a todos.
- **Acciones que permite:** Crear notificación, editar notificación, eliminar notificación, listar notificaciones, listar notificaciones activas, consultar estadísticas, marcar como leída.
- **Condiciones o limitaciones:** Las notificaciones se muestran según vigencia y destino. El sistema puede crear notificaciones automáticas (por ejemplo al suspender un negocio).
- **Dependencias:** Ninguna.
- **Estado:** Completa.

### 13.2 notifications-auto-check
- **ID:** `notifications-auto-check`
- **Nombre:** Comprobación automática de notificaciones
- **Categoría:** Operaciones
- **Descripción funcional:** Expone un endpoint para que el frontend compruebe si hay notificaciones nuevas o pendientes para el usuario o negocio, por ejemplo para mostrar un indicador o badge.
- **Acciones que permite:** Comprobar notificaciones activas o estado para el usuario/negocio.
- **Condiciones o limitaciones:** Depende de la configuración de destino de cada notificación.
- **Dependencias:** Notificaciones creadas.
- **Estado:** Completa.

---

## 14. Suscripción y planes

### 14.1 subscription-status
- **ID:** `subscription-status`
- **Nombre:** Estado de suscripción
- **Categoría:** Suscripción
- **Descripción funcional:** Consulta el estado de la suscripción de un negocio: si está activa, días restantes, si está vencida o suspendida, si puede renovar y período de gracia. El login bloquea el acceso si la suscripción está vencida o suspendida (salvo superadministrador).
- **Acciones que permite:** Obtener estado de suscripción por negocio.
- **Condiciones o limitaciones:** Usuarios normales solo pueden consultar el estado de su propio negocio; superadministrador puede consultar cualquier negocio.
- **Dependencias:** Negocio con fecha de límite y flags de suspensión.
- **Estado:** Completa.

### 14.2 subscription-admin
- **ID:** `subscription-admin`
- **Nombre:** Administración de suscripciones (superadministrador)
- **Categoría:** Suscripción
- **Descripción funcional:** Permite al superadministrador activar un negocio, suspenderlo (manual o automático), reactivarlo con nueva fecha de vencimiento, extender la suscripción un número de días, fijar fecha de expiración y ejecutar la suspensión automática de negocios vencidos (según período de gracia). Al suspender se deshabilitan los usuarios del negocio y se crea una notificación crítica.
- **Acciones que permite:** Activar negocio, suspender negocio, reactivar negocio con nueva fecha, extender suscripción, establecer fecha de expiración, ejecutar proceso de auto-suspensión.
- **Condiciones o limitaciones:** Solo superadministrador. Las estadísticas globales de suscripción están disponibles en un endpoint específico.
- **Dependencias:** Negocio, notificaciones.
- **Estado:** Completa.

### 14.3 subscription-plans-config
- **ID:** `subscription-plans-config`
- **Nombre:** Configuración de planes de suscripción
- **Categoría:** Suscripción
- **Descripción funcional:** El sistema tiene definidos planes (por ejemplo Freemium, Básico, Silver, Premium, Custom) con límites de locales, usuarios y productos, precio, moneda y duración. Esos valores se usan para validar límites y para mostrar opciones en la interfaz de planes; la activación o extensión real no está automatizada por pasarela de pago en el código.
- **Acciones que permite:** Consultar y aplicar límites por plan; mostrar planes en configuración/landing.
- **Condiciones o limitaciones:** Los planes están definidos en código. No hay integración con pasarela de pago para cobro automático.
- **Dependencias:** Ninguna.
- **Estado:** Completa.

---

## 15. Suspensiones (gestión)

### 15.1 suspension-management
- **ID:** `suspension-management`
- **Nombre:** Gestión de suspensiones
- **Categoría:** Configuración
- **Descripción funcional:** Permite ver y gestionar la suspensión de negocios desde la interfaz de configuración (suspensiones). La lógica de suspender/reactivar se ejecuta vía APIs de suscripción; esta funcionalidad expone la interfaz para que el administrador realice esas acciones.
- **Acciones que permite:** Ver estado de suspensiones, suspender y reactivar negocios (según permisos).
- **Condiciones o limitaciones:** Sujeto a permisos; típicamente superadministrador o roles con acceso a configuración de suspensiones.
- **Dependencias:** APIs de suscripción.
- **Estado:** Completa.

---

## 16. Backup

### 16.1 backup-generate
- **ID:** `backup-generate`
- **Nombre:** Generación de backup
- **Categoría:** Sistema
- **Descripción funcional:** El superadministrador puede solicitar la generación de un backup. La aplicación no genera el backup localmente sino que llama a un servicio externo mediante URL y clave configuradas en variables de entorno; la respuesta del servicio se devuelve al cliente.
- **Acciones que permite:** Solicitar la generación de backup al servicio externo.
- **Condiciones o limitaciones:** Solo superadministrador. Requiere que estén configuradas la URL y la clave del servicio de backup; si no, devuelve error.
- **Dependencias:** Servicio externo de backup, variables de entorno.
- **Estado:** Completa.

---

## 17. Landing y contacto

### 17.1 contact-form
- **ID:** `contact-form`
- **Nombre:** Formulario de contacto (landing)
- **Categoría:** Landing
- **Descripción funcional:** Recibe los datos del formulario de contacto de la landing (nombre, nombre del negocio, correo, teléfono, tipo de negocio, número de locales, mensaje opcional), los valida y responde con éxito. No persiste en base de datos ni envía correo en el código actual; el envío a un webhook externo (n8n) está comentado en el código.
- **Acciones que permite:** Enviar formulario (validación de campos y formato de email y teléfono), recibir confirmación de envío.
- **Condiciones o limitaciones:** Parcial: no guarda en BD ni envía a webhook en la implementación actual; solo valida y responde.
- **Dependencias:** Ninguna en código activo.
- **Estado:** Parcial.

### 17.2 chatbot
- **ID:** `chatbot`
- **Nombre:** Chatbot de la landing
- **Categoría:** Landing
- **Descripción funcional:** Recibe mensajes del usuario desde el widget de chatbot y los reenvía a un webhook externo (n8n) con sessionId (usuario autenticado o anónimo) e información de usuario si hay sesión. Devuelve al cliente la respuesta que devuelve el webhook.
- **Acciones que permite:** Enviar mensaje al chatbot, recibir respuesta del servicio externo.
- **Condiciones o limitaciones:** Requiere que esté configurada la URL del webhook del chatbot; si no, devuelve servicio no disponible.
- **Dependencias:** Servicio n8n (u otro) configurado con N8N_CHATBOT_WEBHOOK y opcionalmente N8N_API_KEY.
- **Estado:** Completa.

---

## 18. Rutas protegidas y suscripción

### 18.1 protected-routes
- **ID:** `protected-routes`
- **Nombre:** Protección de rutas por sesión y suscripción
- **Categoría:** Seguridad
- **Descripción funcional:** El middleware de la aplicación restringe el acceso a determinadas rutas: exige sesión válida (o token en APIs) y que el usuario tenga negocio y rol. Para rutas protegidas por suscripción, redirige a login o a página de suscripción expirada si el negocio está vencido o suspendido. Las rutas de API para la app envían cabeceras con usuario y permisos cuando se usa token.
- **Acciones que permite:** Redirigir a login si no hay sesión, redirigir a página de suscripción expirada cuando corresponda, permitir o denegar acceso a rutas según lista configurada.
- **Condiciones o limitaciones:** Listas de rutas protegidas y permitidas definidas en código. La app móvil usa token Bearer y no cookies.
- **Dependencias:** Sesión o token, estado de suscripción del negocio.
- **Estado:** Completa.

---

# JSON de funcionalidades

A continuación se incluye la versión estructurada en JSON con la estructura solicitada, para uso por sistemas o IA que actualicen la landing u otras fuentes.

```json
[
  {
    "id": "user-login-web",
    "name": "Inicio de sesión (web)",
    "category": "Autenticación",
    "description": "Permite al usuario identificarse con nombre de usuario y contraseña desde la interfaz web. Tras validar credenciales se crea una sesión. Si el negocio del usuario tiene suscripción vencida o suspendida, el acceso se bloquea (salvo que el usuario sea superadministrador).",
    "actions": ["Iniciar sesión", "Cerrar sesión", "Mantener sesión por cookies"],
    "limitations": "El usuario debe tener al menos un local asignado y un rol en alguna tienda. No existe registro público de nuevos usuarios.",
    "dependencies": [],
    "status": "completa"
  },
  {
    "id": "user-login-app",
    "name": "Inicio de sesión (aplicación móvil)",
    "category": "Autenticación",
    "description": "Permite a la aplicación móvil autenticar al usuario y obtener un token que se usa en las peticiones posteriores. Incluye renovación del token (refresh).",
    "actions": ["Login con usuario y contraseña", "Refrescar token", "Cambiar tienda activa desde la app"],
    "limitations": "Mismas restricciones de suscripción que en web. El token se envía en cabeceras para las APIs bajo /api/app/.",
    "dependencies": [],
    "status": "completa"
  },
  {
    "id": "change-password",
    "name": "Cambio de contraseña",
    "category": "Autenticación",
    "description": "Permite al usuario autenticado cambiar su contraseña indicando la contraseña actual y la nueva.",
    "actions": ["Cambiar la contraseña del usuario en sesión"],
    "limitations": "Requiere contraseña actual correcta. Sujeto a permisos (configuración de usuarios).",
    "dependencies": ["Usuario autenticado"],
    "status": "completa"
  },
  {
    "id": "change-context-tienda-negocio",
    "name": "Cambio de tienda y negocio en sesión",
    "category": "Autenticación",
    "description": "Permite al usuario cambiar el local (tienda) o el negocio con el que está trabajando sin cerrar sesión. La sesión actualiza el contexto activo.",
    "actions": ["Cambiar tienda actual", "Cambiar negocio actual", "Listar locales disponibles para el usuario"],
    "limitations": "Solo se pueden elegir tiendas/negocios a los que el usuario tiene acceso.",
    "dependencies": ["Usuario autenticado con múltiples tiendas o negocios"],
    "status": "completa"
  },
  {
    "id": "init-superadmin",
    "name": "Inicialización del usuario superadministrador",
    "category": "Autenticación",
    "description": "Endpoint de uso interno que, al invocarse con un secreto correcto, crea el primer usuario superadministrador y un negocio asociado si aún no existe. No crea el usuario si ya hay uno con ese nombre.",
    "actions": ["Crear usuario superadmin y negocio vinculado una sola vez"],
    "limitations": "Requiere parámetro secreto en la URL que coincida con la variable de entorno configurada. Solo debe usarse en despliegue o mantenimiento.",
    "dependencies": ["Variables de entorno para secreto y contraseña del superadmin"],
    "status": "completa"
  },
  {
    "id": "user-management",
    "name": "Gestión de usuarios",
    "category": "Configuración",
    "description": "Permite listar, crear, editar y eliminar o desactivar usuarios del negocio. Los usuarios se asocian a tiendas y se les asigna un rol por tienda.",
    "actions": ["Crear usuario", "Editar usuario", "Eliminar o desactivar usuario", "Listar usuarios", "Asignar usuario a tiendas y rol por tienda"],
    "limitations": "Sujeto a permisos de configuración de usuarios. No hay registro público; los usuarios son creados por un administrador.",
    "dependencies": ["Negocio", "Tiendas y roles existentes"],
    "status": "completa"
  },
  {
    "id": "role-management",
    "name": "Gestión de roles",
    "category": "Configuración",
    "description": "Permite definir roles por negocio (por ejemplo Vendedor, Almacenero, Administrador) y asignar a cada rol un conjunto de permisos. Los permisos controlan qué acciones puede realizar el usuario en cada tienda.",
    "actions": ["Crear rol", "Editar rol", "Eliminar rol", "Listar roles", "Asignar permisos al rol mediante lista predefinida"],
    "limitations": "Los roles son por negocio. Los permisos se seleccionan de una lista fija definida en el sistema.",
    "dependencies": [],
    "status": "completa"
  },
  {
    "id": "permission-templates",
    "name": "Plantillas de permisos",
    "category": "Configuración",
    "description": "Expone la lista de permisos del sistema y plantillas predefinidas (por ejemplo vendedor, almacenero, administrador) para asignar rápidamente conjuntos de permisos a un rol.",
    "actions": ["Consultar lista de permisos", "Consultar plantillas de permisos por tipo de rol"],
    "limitations": "Solo lectura. Las plantillas son fijas en código.",
    "dependencies": [],
    "status": "completa"
  },
  {
    "id": "permission-check",
    "name": "Comprobación de permisos en operaciones",
    "category": "Seguridad",
    "description": "Las operaciones del sistema (APIs y, donde aplica, interfaz) comprueban que el usuario tenga el permiso necesario. El superadministrador omite estas comprobaciones.",
    "actions": ["Bloquear o permitir acceso a cada acción según el rol y permisos del usuario en la tienda actual"],
    "limitations": "Los permisos se resuelven por usuario, tienda y rol asignado en esa tienda. Si la comprobación está desactivada por configuración, no se aplica (en el código actual está activa).",
    "dependencies": ["Roles y asignación usuario-tienda-rol"],
    "status": "completa"
  },
  {
    "id": "business-management",
    "name": "Gestión de negocios",
    "category": "Configuración",
    "description": "Permite listar, crear, editar y eliminar negocios. Cada negocio tiene límites de suscripción (locales, usuarios, productos) y fecha de vencimiento.",
    "actions": ["Crear negocio", "Editar negocio", "Eliminar negocio", "Listar negocios", "Consultar estadísticas por negocio"],
    "limitations": "Acceso restringido según rol (superadministrador puede gestionar todos). Los límites del negocio afectan al uso del sistema.",
    "dependencies": [],
    "status": "completa"
  },
  {
    "id": "locale-management",
    "name": "Gestión de locales (tiendas)",
    "category": "Configuración",
    "description": "Permite crear, editar, eliminar y listar los locales (tiendas o almacenes) de un negocio. Cada local puede ser tipo tienda o almacén y pertenece a un solo negocio.",
    "actions": ["Crear local", "Editar local", "Eliminar local", "Listar locales", "Listar locales disponibles para el usuario actual"],
    "limitations": "El número de locales puede estar limitado por el plan del negocio. El nombre del local es único dentro del negocio.",
    "dependencies": ["Negocio existente"],
    "status": "completa"
  },
  {
    "id": "product-catalog",
    "name": "Catálogo de productos",
    "category": "Configuración",
    "description": "Gestiona los productos a nivel de negocio: nombre, descripción, categoría, si permite decimales y relación de fracción (producto que es fracción de otro). Los productos se asocian luego a cada tienda con precio, costo y existencia.",
    "actions": ["Crear producto", "Editar producto", "Eliminar producto", "Listar productos del negocio"],
    "limitations": "Productos únicos por nombre dentro del negocio. El número de productos puede estar limitado por el plan.",
    "dependencies": ["Categorías existentes"],
    "status": "completa"
  },
  {
    "id": "product-codes",
    "name": "Códigos de producto",
    "category": "Configuración",
    "description": "Asigna códigos (por ejemplo de barras) a productos. Permite generar un código para un producto o generar códigos en lote para varios productos que aún no lo tienen.",
    "actions": ["Generar código para un producto", "Generar códigos en lote para múltiples productos"],
    "limitations": "Sujeto a permiso de generación de códigos. Los códigos deben ser únicos.",
    "dependencies": ["Productos existentes"],
    "status": "completa"
  },
  {
    "id": "product-per-store",
    "name": "Productos por tienda (precio, costo, existencia)",
    "category": "Operaciones",
    "description": "Gestiona por cada tienda el precio de venta, costo y existencia de cada producto, y la asignación de proveedor en caso de productos en consignación. Permite consultar productos con sus códigos para venta.",
    "actions": ["Listar y actualizar precios, costos y existencias por tienda", "Listar productos disponibles para venta en la tienda", "Listar productos con códigos"],
    "limitations": "Los productos deben estar dados de alta en el negocio y asociados a la tienda.",
    "dependencies": ["Catálogo de productos", "Tienda"],
    "status": "completa"
  },
  {
    "id": "category-management",
    "name": "Gestión de categorías",
    "category": "Configuración",
    "description": "Permite crear, editar, eliminar y listar categorías de productos. Cada categoría tiene nombre y color y es por negocio.",
    "actions": ["Crear categoría", "Editar categoría", "Eliminar categoría", "Listar categorías"],
    "limitations": "Nombre único por negocio. Las categorías se usan en productos y en reglas de descuento.",
    "dependencies": ["Negocio"],
    "status": "completa"
  },
  {
    "id": "pos-sales",
    "name": "Punto de venta (POS)",
    "category": "Operaciones",
    "description": "Permite registrar ventas desde la interfaz web: agregar productos al carrito, aplicar descuentos, indicar pago en efectivo y/o transferencia (con destino de transferencia opcional) y cerrar la venta. Las ventas se asocian al cierre de caja (período) abierto en la tienda.",
    "actions": ["Añadir y quitar productos del carrito", "Aplicar descuentos (con vista previa)", "Registrar pago efectivo y transferencia", "Guardar venta", "Sincronizar ventas cuando hay recuperación de conexión"],
    "limitations": "Debe haber un período de caja abierto. Sujeto a permisos de acceso al POS y, para cancelar venta, a permiso específico. Puede operar con soporte offline limitado (reintentos al sincronizar).",
    "dependencies": ["Productos por tienda", "Cierre de período abierto", "Descuentos (opcional)", "Destinos de transferencia (si se usa transferencia)"],
    "status": "completa"
  },
  {
    "id": "app-pos-sales",
    "name": "Ventas desde aplicación móvil",
    "category": "Operaciones",
    "description": "Permite registrar ventas desde la aplicación móvil: consultar período actual, abrir período si corresponde, crear ventas con productos, descuentos y pagos (efectivo/transferencia), y anular ventas. Los productos y destinos de transferencia se obtienen de la API.",
    "actions": ["Obtener período actual de la tienda", "Abrir período", "Crear venta", "Eliminar (anular) venta", "Consultar productos de la tienda", "Consultar destinos de transferencia", "Obtener vista previa de descuentos"],
    "limitations": "Autenticación por token. Misma lógica de cierre y permisos que en web donde aplique.",
    "dependencies": ["Autenticación app", "Productos por tienda", "Períodos", "Descuentos"],
    "status": "completa"
  },
  {
    "id": "sales-list-detail",
    "name": "Listado y detalle de ventas",
    "category": "Operaciones",
    "description": "Permite consultar las ventas realizadas en una tienda dentro de un cierre y ver el detalle de cada venta (productos, cantidades, totales, descuentos, forma de pago). Permite eliminar (anular) una venta si se tiene permiso.",
    "actions": ["Listar ventas por tienda y cierre", "Ver detalle de una venta", "Eliminar venta (anulación)"],
    "limitations": "Sujeto a permisos de acceso a ventas y de eliminación de ventas. Las ventas están asociadas a un cierre; al anular se revierten existencias con movimientos de ajuste.",
    "dependencies": ["Cierre de período", "Ventas registradas"],
    "status": "completa"
  },
  {
    "id": "transfer-destinations",
    "name": "Destinos de transferencia",
    "category": "Configuración",
    "description": "Permite definir por tienda los destinos de transferencia (por ejemplo nombres de bancos o cuentas) que el usuario puede elegir al registrar un pago por transferencia en una venta. Se puede marcar un destino como predeterminado.",
    "actions": ["Crear", "Editar", "Eliminar y listar destinos de transferencia por tienda"],
    "limitations": "Nombre único por tienda. Usado en POS y en app al registrar pagos por transferencia.",
    "dependencies": ["Tienda"],
    "status": "completa"
  },
  {
    "id": "discount-rules",
    "name": "Reglas de descuento",
    "category": "Configuración",
    "description": "Permite crear, editar, eliminar y listar reglas de descuento por negocio. Cada regla tiene tipo (porcentaje, monto fijo o código promocional), valor, ámbito de aplicación (ticket, producto, categoría o cliente) y condiciones opcionales (mínimo de compra, productos o categorías concretas, código). Pueden tener fechas de vigencia.",
    "actions": ["Crear regla", "Editar regla", "Eliminar regla", "Listar reglas", "Consultar opciones de tipos y ámbitos"],
    "limitations": "Las reglas se evalúan al aplicar descuentos en una venta; si tienen código, solo aplican cuando se introduce ese código. Por negocio.",
    "dependencies": ["Negocio"],
    "status": "completa"
  },
  {
    "id": "discount-preview-and-apply",
    "name": "Vista previa y aplicación de descuentos en venta",
    "category": "Operaciones",
    "description": "Calcula el resultado de aplicar las reglas de descuento activas a un carrito (productos y cantidades) y opcionalmente códigos introducidos, devolviendo el total con descuentos y el detalle de descuentos aplicados. Esa lógica se usa al registrar la venta para guardar los importes descontados.",
    "actions": ["Obtener vista previa de descuentos para un carrito (web y app)", "Aplicar descuentos al registrar la venta y guardar el monto descontado por regla"],
    "limitations": "Solo aplican reglas activas y vigentes en fecha. Las condiciones (mínimo, productos, categorías, código) deben cumplirse.",
    "dependencies": ["Reglas de descuento del negocio"],
    "status": "completa"
  },
  {
    "id": "period-open-close",
    "name": "Apertura y cierre de período de caja",
    "category": "Operaciones",
    "description": "Permite abrir un nuevo período de caja en una tienda (cuando no hay uno abierto) y cerrar el período actual. Al cerrar se calculan totales de ventas (efectivo, transferencia, descuentos) y ganancias (propias y consignación). El cierre queda cerrado y las ventas posteriores pertenecen a un nuevo período al abrirlo.",
    "actions": ["Obtener último cierre", "Abrir período", "Cerrar período", "Consultar un cierre por identificador", "Consultar resumen del cierre (totales y ganancias)"],
    "limitations": "No se puede abrir un nuevo período si ya hay uno abierto. Solo se puede cerrar el período actual. Sujeto a permisos de cierre (acceder y cerrar).",
    "dependencies": ["Tienda", "Ventas del período"],
    "status": "completa"
  },
  {
    "id": "period-summary",
    "name": "Resumen de cierre de caja",
    "category": "Operaciones",
    "description": "Muestra el resumen de un cierre ya cerrado: totales de venta, efectivo, transferencia, descuentos y ganancias (propias y por consignación). Permite revisar cierres anteriores.",
    "actions": ["Ver resumen del cierre (totales y ganancias) por tienda y cierre"],
    "limitations": "Sujeto a permiso de acceso a resúmenes de cierre.",
    "dependencies": ["Cierre cerrado"],
    "status": "completa"
  },
  {
    "id": "stock-movements",
    "name": "Movimientos de stock",
    "category": "Operaciones",
    "description": "Permite registrar movimientos de entrada y salida de productos en una tienda: compra, ajuste de entrada, ajuste de salida, traspaso (entrada/salida entre tiendas), recepción de traspaso, entrada por consignación y devolución de consignación. Cada movimiento actualiza existencia y, cuando aplica, costo promedio ponderado (CPP).",
    "actions": ["Crear movimiento (por tipo)", "Listar movimientos por tienda y tipo", "Consultar productos para entrada o salida por tipo", "Consultar recepción de traspasos pendientes"],
    "limitations": "Cada tipo de movimiento está sujeto a un permiso específico. Los traspasos vinculan tienda origen y destino; la recepción confirma la entrada en destino.",
    "dependencies": ["Productos por tienda", "Tiendas (para traspasos)", "Proveedores (para consignación)"],
    "status": "completa"
  },
  {
    "id": "movement-import",
    "name": "Importación de movimientos",
    "category": "Operaciones",
    "description": "Permite enviar por API un lote de movimientos con datos de contexto (usuario, negocio, local) y una lista de ítems. El sistema crea los movimientos correspondientes según la lógica de importación definida.",
    "actions": ["Enviar un payload con datos de contexto e ítems para crear múltiples movimientos de una vez"],
    "limitations": "El cuerpo debe incluir data (usuarioId, negocioId, localId) e items (array no vacío). La estructura de ítems debe cumplir lo que espera la lógica de importación.",
    "dependencies": ["Usuario", "Negocio y local válidos", "Productos y datos coherentes en ítems"],
    "status": "completa"
  },
  {
    "id": "inventory-view",
    "name": "Vista de inventario",
    "category": "Operaciones",
    "description": "Permite consultar el inventario actual de una tienda: productos con existencia, precios y costos. Orientado a revisión y recuperación de datos.",
    "actions": ["Ver listado de productos con sus existencias y precios por tienda"],
    "limitations": "Sujeto a permiso de acceso a inventario.",
    "dependencies": ["Productos por tienda"],
    "status": "completa"
  },
  {
    "id": "conformar-precios",
    "name": "Conformar precios",
    "category": "Operaciones",
    "description": "Permite revisar y ajustar precios (y costos) de productos en una tienda. Incluye la posibilidad de imprimir etiquetas con datos del producto.",
    "actions": ["Consultar datos de precios y costos por tienda", "Actualizar precios/costos", "Imprimir etiquetas"],
    "limitations": "Sujeto a permiso de conformar precios.",
    "dependencies": ["Productos por tienda"],
    "status": "completa"
  },
  {
    "id": "cpp-analysis",
    "name": "Análisis de costo promedio ponderado",
    "category": "Recuperaciones",
    "description": "Calcula y muestra el análisis de CPP por tienda a partir de los movimientos de stock. Permite consultar análisis general o desviaciones respecto a un umbral configurable.",
    "actions": ["Obtener análisis CPP de una tienda", "Obtener desviaciones de CPP según umbral"],
    "limitations": "Sujeto a permiso de análisis CPP. Los datos dependen de movimientos con información de costo.",
    "dependencies": ["Movimientos de stock con costos", "Tienda"],
    "status": "completa"
  },
  {
    "id": "cpp-migrate",
    "name": "Migración de datos históricos CPP",
    "category": "Recuperaciones",
    "description": "Permite ejecutar una migración (o simulación) de datos históricos de CPP para una tienda. Puede ejecutarse en modo solo simulación (dry run) sin modificar datos.",
    "actions": ["Ejecutar migración CPP (o simulación) por tienda"],
    "limitations": "La migración afecta a datos históricos de la tienda. El modo dry run no persiste cambios.",
    "dependencies": ["Tienda y datos de movimientos"],
    "status": "completa"
  },
  {
    "id": "supplier-management",
    "name": "Gestión de proveedores",
    "category": "Configuración",
    "description": "Permite crear, editar, eliminar y listar proveedores del negocio. Un proveedor puede estar asociado opcionalmente a un usuario. Los proveedores se usan en productos en consignación y en liquidaciones.",
    "actions": ["Crear proveedor", "Editar proveedor", "Eliminar proveedor", "Listar proveedores"],
    "limitations": "Nombre único por negocio.",
    "dependencies": ["Negocio"],
    "status": "completa"
  },
  {
    "id": "consignment-liquidation",
    "name": "Liquidación a proveedores (consignación)",
    "category": "Operaciones",
    "description": "Permite registrar la liquidación a un proveedor por un cierre: se calculan o registran montos vendidos, costos y existencias por producto en consignación para ese cierre y proveedor, y se marca como liquidado.",
    "actions": ["Listar proveedores con productos en consignación", "Consultar datos por proveedor", "Registrar liquidación por cierre y proveedor"],
    "limitations": "Sujeto a permiso de liquidar a proveedores. Requiere cierre cerrado y productos en consignación asociados al proveedor.",
    "dependencies": ["Proveedores", "Productos en consignación", "Cierre de período"],
    "status": "completa"
  },
  {
    "id": "dashboard-summary",
    "name": "Resumen del dashboard",
    "category": "Operaciones",
    "description": "Muestra un resumen de la tienda seleccionada para el usuario: indicadores y datos agregados útiles para la operación diaria.",
    "actions": ["Consultar resumen por tienda"],
    "limitations": "Sujeto a permiso de acceso al dashboard.",
    "dependencies": ["Tienda", "Datos de ventas y cierres"],
    "status": "completa"
  },
  {
    "id": "dashboard-metrics",
    "name": "Métricas del dashboard",
    "category": "Operaciones",
    "description": "Expone métricas por tienda para alimentar gráficos o paneles (por ejemplo ventas, tendencias). Consumido por la interfaz de dashboard.",
    "actions": ["Consultar métricas por tienda"],
    "limitations": "Sujeto a permisos de dashboard.",
    "dependencies": ["Tienda y datos de negocio"],
    "status": "completa"
  },
  {
    "id": "notifications-crud",
    "name": "Gestión de notificaciones",
    "category": "Configuración",
    "description": "Permite crear, editar, eliminar y listar notificaciones del sistema. Cada notificación tiene título, descripción, fechas de vigencia, nivel de importancia (baja, media, alta, crítica) y tipo (alerta, notificación, promoción, mensaje). Se puede dirigir a negocios o usuarios concretos o a todos.",
    "actions": ["Crear notificación", "Editar notificación", "Eliminar notificación", "Listar notificaciones", "Listar notificaciones activas", "Consultar estadísticas", "Marcar como leída"],
    "limitations": "Las notificaciones se muestran según vigencia y destino. El sistema puede crear notificaciones automáticas (por ejemplo al suspender un negocio).",
    "dependencies": [],
    "status": "completa"
  },
  {
    "id": "notifications-auto-check",
    "name": "Comprobación automática de notificaciones",
    "category": "Operaciones",
    "description": "Expone un endpoint para que el frontend compruebe si hay notificaciones nuevas o pendientes para el usuario o negocio, por ejemplo para mostrar un indicador o badge.",
    "actions": ["Comprobar notificaciones activas o estado para el usuario/negocio"],
    "limitations": "Depende de la configuración de destino de cada notificación.",
    "dependencies": ["Notificaciones creadas"],
    "status": "completa"
  },
  {
    "id": "subscription-status",
    "name": "Estado de suscripción",
    "category": "Suscripción",
    "description": "Consulta el estado de la suscripción de un negocio: si está activa, días restantes, si está vencida o suspendida, si puede renovar y período de gracia. El login bloquea el acceso si la suscripción está vencida o suspendida (salvo superadministrador).",
    "actions": ["Obtener estado de suscripción por negocio"],
    "limitations": "Usuarios normales solo pueden consultar el estado de su propio negocio; superadministrador puede consultar cualquier negocio.",
    "dependencies": ["Negocio con fecha de límite y flags de suspensión"],
    "status": "completa"
  },
  {
    "id": "subscription-admin",
    "name": "Administración de suscripciones (superadministrador)",
    "category": "Suscripción",
    "description": "Permite al superadministrador activar un negocio, suspenderlo (manual o automático), reactivarlo con nueva fecha de vencimiento, extender la suscripción un número de días, fijar fecha de expiración y ejecutar la suspensión automática de negocios vencidos (según período de gracia). Al suspender se deshabilitan los usuarios del negocio y se crea una notificación crítica.",
    "actions": ["Activar negocio", "Suspender negocio", "Reactivar negocio con nueva fecha", "Extender suscripción", "Establecer fecha de expiración", "Ejecutar proceso de auto-suspensión"],
    "limitations": "Solo superadministrador. Las estadísticas globales de suscripción están disponibles en un endpoint específico.",
    "dependencies": ["Negocio", "Notificaciones"],
    "status": "completa"
  },
  {
    "id": "subscription-plans-config",
    "name": "Configuración de planes de suscripción",
    "category": "Suscripción",
    "description": "El sistema tiene definidos planes (por ejemplo Freemium, Básico, Silver, Premium, Custom) con límites de locales, usuarios y productos, precio, moneda y duración. Esos valores se usan para validar límites y para mostrar opciones en la interfaz de planes; la activación o extensión real no está automatizada por pasarela de pago en el código.",
    "actions": ["Consultar y aplicar límites por plan", "Mostrar planes en configuración/landing"],
    "limitations": "Los planes están definidos en código. No hay integración con pasarela de pago para cobro automático.",
    "dependencies": [],
    "status": "completa"
  },
  {
    "id": "suspension-management",
    "name": "Gestión de suspensiones",
    "category": "Configuración",
    "description": "Permite ver y gestionar la suspensión de negocios desde la interfaz de configuración (suspensiones). La lógica de suspender/reactivar se ejecuta vía APIs de suscripción; esta funcionalidad expone la interfaz para que el administrador realice esas acciones.",
    "actions": ["Ver estado de suspensiones", "Suspender y reactivar negocios (según permisos)"],
    "limitations": "Sujeto a permisos; típicamente superadministrador o roles con acceso a configuración de suspensiones.",
    "dependencies": ["APIs de suscripción"],
    "status": "completa"
  },
  {
    "id": "backup-generate",
    "name": "Generación de backup",
    "category": "Sistema",
    "description": "El superadministrador puede solicitar la generación de un backup. La aplicación no genera el backup localmente sino que llama a un servicio externo mediante URL y clave configuradas en variables de entorno; la respuesta del servicio se devuelve al cliente.",
    "actions": ["Solicitar la generación de backup al servicio externo"],
    "limitations": "Solo superadministrador. Requiere que estén configuradas la URL y la clave del servicio de backup; si no, devuelve error.",
    "dependencies": ["Servicio externo de backup", "Variables de entorno"],
    "status": "completa"
  },
  {
    "id": "contact-form",
    "name": "Formulario de contacto (landing)",
    "category": "Landing",
    "description": "Recibe los datos del formulario de contacto de la landing (nombre, nombre del negocio, correo, teléfono, tipo de negocio, número de locales, mensaje opcional), los valida y responde con éxito. No persiste en base de datos ni envía correo en el código actual; el envío a un webhook externo (n8n) está comentado en el código.",
    "actions": ["Enviar formulario (validación de campos y formato de email y teléfono)", "Recibir confirmación de envío"],
    "limitations": "Parcial: no guarda en BD ni envía a webhook en la implementación actual; solo valida y responde.",
    "dependencies": [],
    "status": "parcial"
  },
  {
    "id": "chatbot",
    "name": "Chatbot de la landing",
    "category": "Landing",
    "description": "Recibe mensajes del usuario desde el widget de chatbot y los reenvía a un webhook externo (n8n) con sessionId (usuario autenticado o anónimo) e información de usuario si hay sesión. Devuelve al cliente la respuesta que devuelve el webhook.",
    "actions": ["Enviar mensaje al chatbot", "Recibir respuesta del servicio externo"],
    "limitations": "Requiere que esté configurada la URL del webhook del chatbot; si no, devuelve servicio no disponible.",
    "dependencies": ["Servicio n8n (u otro) configurado con N8N_CHATBOT_WEBHOOK y opcionalmente N8N_API_KEY"],
    "status": "completa"
  },
  {
    "id": "protected-routes",
    "name": "Protección de rutas por sesión y suscripción",
    "category": "Seguridad",
    "description": "El middleware de la aplicación restringe el acceso a determinadas rutas: exige sesión válida (o token en APIs) y que el usuario tenga negocio y rol. Para rutas protegidas por suscripción, redirige a login o a página de suscripción expirada si el negocio está vencido o suspendido. Las rutas de API para la app envían cabeceras con usuario y permisos cuando se usa token.",
    "actions": ["Redirigir a login si no hay sesión", "Redirigir a página de suscripción expirada cuando corresponda", "Permitir o denegar acceso a rutas según lista configurada"],
    "limitations": "Listas de rutas protegidas y permitidas definidas en código. La app móvil usa token Bearer y no cookies.",
    "dependencies": ["Sesión o token", "Estado de suscripción del negocio"],
    "status": "completa"
  }
]
```
