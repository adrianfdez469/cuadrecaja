# Especificación de funcionalidades POS para APK offline

Este documento describe las funcionalidades del POS web que deben incorporarse en la aplicación móvil (APK) para uso sin conexión. Está orientado a **implementación por funcionalidad**, no a diseño visual. La APK ya tiene lo básico; aquí se detalla qué debe hacer cada módulo y cómo integrarlo con lo existente.

---

## ¿Se necesitan endpoints nuevos en /api/app?

**No.** Todas las funcionalidades descritas pueden implementarse **sin agregar ningún endpoint nuevo** en `/api/app`. Basta con usar los que ya existen:

| Funcionalidad | Uso de API | Endpoint existente |
|---------------|------------|---------------------|
| **Vista de ventas** | Listar ventas del período (cuando hay red) | `GET /api/app/venta/{tiendaId}/{periodoId}` |
| **Sincronizaciones** | Subir ventas pendientes | `POST /api/app/venta/{tiendaId}/{periodoId}` |
| **Sincronizaciones** | Eliminar venta en servidor (si ya estaba sincronizada) | `DELETE /api/app/venta/{tiendaId}/{periodoId}/{ventaId}` |
| **Búsqueda por nombre** | — | Solo datos locales (productos ya descargados con `GET /api/app/productos/{tiendaId}`) |
| **Búsqueda por scanner** | — | Solo datos locales (los productos incluyen `codigos` en la respuesta de productos) |

- **Ventas**: listado, creación (sincronizar) y eliminación están cubiertos por los endpoints actuales.
- **Productos**: se obtienen una vez con `GET /api/app/productos/{tiendaId}` (incluye `codigos`). Búsqueda por nombre y por código se hace **solo en la APK** sobre esos datos guardados en local.

No se requieren cambios en el backend ni nuevos endpoints.

---

## Contexto de datos

- **Ventas**: Se guardan localmente (p. ej. SQLite) con un `identifier` único (UUID) generado en el cliente. Cuando hay red se sincronizan al backend y se guarda además el `dbId` (id en servidor).
- **Productos**: Se descargan al tener conexión y se persisten localmente. Cada producto de tienda puede tener varios **códigos** (código de barras / SKU) en `codigos` (array de `{ id, codigo, productoId }`).
- **Período de caja**: Hay un período activo por tienda (`cierreId` / `periodoId`). Las ventas pertenecen a ese período. Sin período activo no se permiten ventas nuevas.

---

## 1. Vista de datos de ventas realizadas

### Objetivo

Mostrar todas las ventas del período actual (las ya sincronizadas que vienen del servidor + las creadas en el dispositivo y aún no sincronizadas o ya sincronizadas). El usuario debe poder ver listado y detalle de cada venta.

### Fuentes de datos

- **Ventas en servidor**: Al tener conexión, obtener lista con `GET /api/app/venta/[tiendaId]/[periodoId]` (o equivalente en tu API). Respuesta incluye por cada venta: `id`, `createdAt`, `total`, `totalcash`, `totaltransfer`, `discountTotal`, `tiendaId`, `usuarioId`, `cierrePeriodoId`, `syncId`, `frontendCreatedAt`, `wasOffline`, `syncAttempts`, `productos`, `usuario`, `appliedDiscounts`.
- **Ventas locales pendientes o ya sincronizadas**: Del almacenamiento local (p. ej. tabla/colección de ventas con estado de sincronización).

Unificar en una sola lista “ventas del período”:
- Ventas del servidor (mapear a un modelo común con `dbId` = `id`, `identifier` = `syncId`, `synced` = true).
- Ventas solo locales: `identifier` único, `synced` = false o según estado, sin `dbId` hasta que sincronicen.

### Modelo unificado de “venta en lista”

Usar (o mapear a) una estructura como:

- `identifier`: string (UUID cliente; en servidor = `syncId`)
- `dbId`: string | null (id en backend; null si no sincronizada)
- `tiendaId`, `cierreId`, `usuarioId`: string
- `total`, `totalcash`, `totaltransfer`: number
- `createdAt`: timestamp (número o fecha); en servidor puede venir `frontendCreatedAt` o `createdAt`
- `synced`: boolean
- `syncState`: "synced" | "syncing" | "not_synced" | "sync_err"
- `wasOffline`: boolean
- `syncAttempts`: number
- `productos`: array de { `productId`, `productoTiendaId`, `name`, `cantidad`, `price` }
- Opcional: `usuario` (nombre), `appliedDiscounts`, `discountTotal`, `transferDestinationId`, `discountCodes`

### Comportamiento funcional

1. **Carga inicial**
   - Si hay conexión: llamar a la API de listado de ventas del período y guardar/actualizar en local (p. ej. reemplazar ventas del servidor por `identifier` o `dbId`).
   - Siempre: leer de la base local todas las ventas del período actual (las creadas en el dispositivo y las que vengan del servidor).
   - Ordenar por fecha de creación descendente (más recientes primero).

2. **Listado**
   - Mostrar por cada venta al menos: estado de sincronización, fecha/hora, total efectivo, total transferencia, total, cantidad de ítems (productos).
   - Al hacer tap en una venta: abrir detalle.

3. **Detalle de una venta**
   - Mostrar: fecha/hora, totales (efectivo, transferencia, total, descuentos si aplica), usuario si está disponible.
   - Listar ítems: nombre del producto, cantidad, precio (y opcionalmente subtotal). Los datos vienen de `venta.productos` (campos `name`, `cantidad`, `price`).

No es requisito replicar el diseño exacto del POS web; sí lo es mostrar la misma información y permitir listar y ver detalle.

---

## 2. Vista de sincronizaciones (con opción de eliminar ventas)

### Objetivo

Dar una vista centrada en el estado de sincronización de las ventas y permitir:
- Sincronizar ventas pendientes (una o todas).
- Eliminar una venta (local y, si estaba sincronizada, también en el servidor cuando haya red).

### Estados de una venta

- **synced**: ya guardada en el servidor.
- **syncing**: en proceso de envío.
- **not_synced**: pendiente de envío.
- **sync_err**: error en último intento (opcional mostrar “Reintentar”).

### Acciones

1. **Sincronizar una venta**
   - Solo aplica a ventas con `synced == false` y no en estado `syncing`.
   - Enviar al backend con `POST` al endpoint de creación de venta (ej. `POST /api/app/venta/[tiendaId]/[periodoId]`), enviando: `usuarioId`, `total`, `totalcash`, `totaltransfer`, `productos` (array con `productoTiendaId`, `cantidad`, `price`; el backend puede derivar nombres), `syncId` = `identifier`, y si la API lo soporta: `createdAt`, `wasOffline`, `syncAttempts`, `transferDestinationId`, `discountCodes`.
   - En éxito: guardar en local el `id` devuelto como `dbId`, marcar `synced = true`, `syncState = "synced"`.
   - En error de red: mantener `not_synced` o marcar `sync_err`, incrementar `syncAttempts`; no eliminar la venta local.

2. **Sincronizar todas**
   - Recorrer todas las ventas con `synced == false` (y no en `syncing`) en orden (p. ej. por `createdAt` ascendente) y para cada una ejecutar la misma lógica que “Sincronizar una venta”.

3. **Eliminar una venta**
   - Si la venta está sincronizada (`synced == true` y existe `dbId`): si hay conexión, llamar a `DELETE /api/app/venta/[tiendaId]/[periodoId]/[ventaId]` (con `ventaId = dbId`); si no hay conexión, se puede no permitir eliminar o mostrar mensaje de que se eliminará cuando haya red (según regla de negocio).
   - Siempre: en almacenamiento local, borrar la venta y devolver al inventario local las cantidades de los productos de esa venta (incrementar existencias por cada `productoTiendaId` y `cantidad`), para que el stock local siga consistente.
   - Mostrar confirmación antes de eliminar (“¿Está seguro que desea eliminar la venta seleccionada?”).

### Indicadores útiles

- Conexión: online / offline (para habilitar o no “Eliminar” en ventas ya sincronizadas y para intentar sincronizar).
- Por venta: icono o texto de estado (Sincronizada / Pendiente / Sincronizando / Error).
- Botón “Sincronizar todos” visible cuando exista al menos una venta no sincronizada.

La vista puede ser la misma que “Vista de datos de ventas realizadas” con columnas/acciones extra (Sincronizar, Eliminar), o una pantalla específica de “Sincronizaciones”; lo importante es que las acciones anteriores estén disponibles.

---

## 3. Búsqueda por nombre de producto

### Objetivo

Permitir al usuario encontrar productos por texto en el nombre para agregarlos al carrito desde el POS, usando solo datos locales (sin depender de red).

### Datos

- Lista de productos ya disponible en la app (descargados y guardados en local). Cada ítem debe tener al menos: `id` (productoTiendaId), nombre del producto, precio, existencia, y lo que se use para restar stock al vender.

### Comportamiento

1. **Entrada**
   - Campo de búsqueda (por ejemplo en la parte superior del POS). El usuario escribe texto.

2. **Filtrado**
   - Filtrar en memoria la lista de productos donde `nombre` (o el campo equivalente) contenga la cadena escrita, sin distinguir mayúsculas/minúsculas (ej. `nombre.toLowerCase().includes(query.toLowerCase())`).
   - Opcional: limitar cantidad de resultados (ej. 10) para no sobrecargar la UI.

3. **Salida**
   - Mostrar lista de resultados (o lista vacía si no hay coincidencias). Al elegir un producto:
     - Seleccionarlo para definir cantidad y agregar al carrito, o
     - Agregar directamente con cantidad 1, según el flujo actual del POS en la APK.

4. **Actualización**
   - Si la lista de productos en memoria se actualiza (p. ej. tras una venta que modifica existencias o tras una sincronización), volver a aplicar el filtro con el mismo texto para que los resultados sigan siendo coherentes.

No se requiere diseño concreto; sí que la búsqueda sea por nombre, en tiempo real sobre datos locales, y que al seleccionar un resultado se integre con el flujo de “agregar al carrito” existente.

---

## 4. Búsqueda por scanner de código de producto

### Objetivo

Identificar un producto por un código (código de barras, QR, etc.) escaneado con la cámara o con un escáner externo (pistola) y agregarlo al carrito sin depender de red.

### Datos

- Cada producto en la app debe tener un array de códigos asociados (ej. `codigos`: `[{ id, codigo, productoId }]`). Varios productos pueden compartir el mismo código (mismo código en distintos ítems); en el POS web en ese caso se elige uno (p. ej. sin proveedor o mayor existencia).

### Comportamiento

1. **Entrada del código**
   - **Cámara**: pantalla de escaneo que decodifica código de barras/QR y devuelve la cadena (el “código”).
   - **Pistola/teclado**: campo de texto “invisible” o dedicado que recibe la lectura del escáner (normalmente la pistola simula teclado y envía Enter al final). Al recibir la secuencia completa (por ejemplo al detectar Enter o un timeout corto sin nuevas teclas), tratar esa cadena como el código escaneado.

2. **Resolución del producto**
   - Buscar en la lista local de productos (productos de la tienda con sus `codigos`) el ítem cuyo `codigos` contenga un elemento con `codigo` igual al string escaneado (comparación exacta, sin espacios extra si no se desea).
   - Si hay varios productos con ese mismo código:
     - Aplicar regla de desempate: por ejemplo priorizar el que no tiene proveedor (producto propio), o el de mayor existencia; igual que en el POS web.
   - Si no hay ninguno: mostrar mensaje “Producto no encontrado para el código escaneado” (o similar) y opcionalmente sonido de error; no agregar nada al carrito.

3. **Al encontrar el producto**
   - Opción A (como escáner de pistola en el POS web): agregar directamente al carrito con cantidad 1 y feedback (mensaje y/o sonido de éxito).
   - Opción B (como escáner cámara en el POS web): abrir pantalla/modal de cantidad para ese producto y luego agregar al carrito.
   - En ambos casos: actualizar existencias locales al agregar (descontar del stock local).

4. **Integración con búsqueda por nombre**
   - Si el mismo campo de texto se usa para búsqueda por nombre y para pistola, distinguir: por ejemplo si la entrada termina en Enter y es una cadena corta sin espacios, tratarla como código de escáner; si no, como búsqueda por nombre. En el POS web se usa “intención de búsqueda” y un campo dedicado para pistola para no robar el foco; en la APK se puede tener un campo dedicado para escáner o una pantalla de cámara separada.

### Resumen de reglas

- Un código puede corresponder a varios productos: aplicar criterio de desempate (sin proveedor primero, o mayor existencia).
- Todo el matching se hace contra datos locales (lista de productos con `codigos`).
- No se requiere conexión para escanear ni para agregar al carrito.

---

## Integración con lo existente en la APK

- **Ventas**: Reutilizar el modelo y la persistencia local de ventas; asegurar que el listado unifique ventas del servidor (cuando se hayan traído) y ventas solo locales, y que el detalle y las acciones de sincronizar/eliminar usen los mismos identificadores (`identifier`, `dbId`).
- **Productos**: La búsqueda por nombre y por código debe usar la misma fuente de productos que el resto del POS (catálogo local). Al agregar al carrito, usar el mismo flujo y actualizar las mismas estructuras de carrito e inventario local.
- **Período**: Las ventas mostradas y sincronizadas deben ser siempre del período actual; al abrir la app o al cambiar de período, recargar ventas (desde API si hay red y desde local).

---

## Endpoints de referencia (API app) — sin endpoints nuevos

Todos los requisitos de red se cubren con los endpoints actuales de `/api/app`. No hace falta crear ninguno adicional.

- **Productos (para búsqueda por nombre y por código)**: `GET /api/app/productos/{tiendaId}` — la respuesta incluye `codigos` por producto.
- **Listar ventas del período**: `GET /api/app/venta/{tiendaId}/{periodoId}`
- **Crear venta (sincronizar)**: `POST /api/app/venta/{tiendaId}/{periodoId}` (body: usuarioId, total, totalcash, totaltransfer, productos, syncId, y opcionales createdAt, wasOffline, syncAttempts, transferDestinationId, discountCodes)
- **Eliminar venta**: `DELETE /api/app/venta/{tiendaId}/{periodoId}/{ventaId}` (ventaId = id en servidor, es decir `dbId`)

Documentación detallada: `docs/API_APP_DOCUMENTATION.md`.

---

## Resumen para la IA implementadora

1. **Vista de ventas**: Listar ventas del período (servidor + local), orden por fecha descendente; al tocar una, mostrar detalle (totales + ítems con nombre, cantidad, precio).
2. **Vista de sincronizaciones**: Misma lista con estados (synced/syncing/not_synced/sync_err); acciones “Sincronizar una”, “Sincronizar todas”, “Eliminar” (con confirmación); al eliminar, borrar en servidor si está sincronizada y hay red, y siempre en local y restaurar stock local.
3. **Búsqueda por nombre**: Filtrado en tiempo real sobre productos locales por nombre (case-insensitive); al seleccionar, integrar con flujo de agregar al carrito.
4. **Búsqueda por scanner**: Resolver código escaneado (cámara o pistola) contra `codigos` de productos locales; si hay varios con el mismo código, desempatar; al encontrar, agregar al carrito (cantidad 1 o modal de cantidad) y actualizar stock local.

Centrarse en que estas cuatro funcionalidades operen correctamente con datos locales y con la API cuando haya conexión, sin priorizar diseño visual.
