# POST /api/app/venta/[tiendaId]/[periodoId] — Respuestas posibles

Todas las respuestas que puede devolver el endpoint de creación de venta.

---

## 1. Éxito

### 201 Created — Venta creada

```json
{
  "success": true,
  "venta": { /* objeto Venta con productos */ },
  "duplicado": false
}
```

---

### 200 OK — Idempotencia (venta ya existía con ese `syncId`)

Si ya existe una venta con el mismo `syncId`, se devuelve la existente sin crear otra.

```json
{
  "success": true,
  "venta": { /* venta existente con productos */ },
  "duplicado": true
}
```

---

## 2. Errores de cliente (4xx)

### 401 Unauthorized — No autenticado

Cuando no hay sesión o no hay usuario en la sesión.

```json
{
  "error": "No autenticado"
}
```

---

### 400 Bad Request — Datos insuficientes

Cuando faltan campos obligatorios en el body. El mensaje incluye la lista de campos faltantes.

```json
{
  "error": "Datos insuficientes para crear la venta: productos (o lista vacía), syncId, createdAt"
}
```

Campos que se validan: `tiendaId`, `periodoId`, `productos` (con al menos un elemento), `syncId`, `createdAt`.

---

### 400 Bad Request — No hay período abierto

La tienda no tiene un período de caja abierto.

```json
{
  "error": "No existe un período abierto en la tienda"
}
```

---

### 404 Not Found — Período no existe

El `periodoId` de la URL no existe en la base de datos.

```json
{
  "error": "No existe un período con el id proporcionado. El ultimo periodo abierto es: <fecha del último período>"
}
```

---

### 400 Bad Request — Período no es el actual

El `periodoId` no coincide con el período abierto actual (venta de un período cerrado o distinto).

```json
{
  "error": "La venta pertenece a un período cerrado o diferente al actual. El ultimo periodo abierto es: <fecha>",
  "periodoActualId": "<uuid del período actual>"
}
```

---

### 400 Bad Request — Tasa de cambio faltante

La venta incluye pagos o vueltos en una moneda distinta a `monedaBase` y ni el `tasaSnapshot`
enviado ni las tasas registradas en el negocio permiten convertirla. El backend completa el
snapshot del cliente con las tasas vigentes al momento de la venta antes de validar; este error
solo aparece si aun así falta una tasa (típicamente la del propio `monedaBase` cuando no es CUP).

Es un error **permanente**: reintentar la sincronización no lo resuelve hasta que un administrador
registre la tasa en Configuración → Tasas de cambio.

```json
{
  "error": "No hay tasa de cambio registrada para USD. Regístrala en Configuración → Tasas de cambio antes de cobrar en otra moneda.",
  "code": "MISSING_EXCHANGE_RATE",
  "monedas": ["USD"]
}
```

---

## 3. Errores dentro de la transacción (500)

Los siguientes errores se lanzan dentro de `prisma.$transaction()` y el `catch` los devuelve como **500 Internal Server Error** con el mensaje en `error`:

### Productos no encontrados

Uno o más `productoTiendaId` de la venta no existen.

```json
{
  "error": "Productos no encontrados: <nombre o productoTiendaId>, <nombre o productoTiendaId>, ..."
}
```

---

### Cantidad decimal no permitida

Algún producto tiene cantidad decimal pero su producto no tiene `permiteDecimal: true`.

```json
{
  "error": "Cantidad decimal no permitida para algunos productos"
}
```

---

### Límite de fracción superado

Se intenta vender unidades sueltas (fracción) en cantidad ≥ unidades por caja en la misma venta.

```json
{
  "error": "Vendes más unidades sueltas de las que lleva una caja en una misma venta. Producto: <nombre>, Cantidad: <cantidad>, Unidades por fracción: <número>"
}
```

---

### Existencia insuficiente para desagregar

No hay stock del producto padre para desagregar (ej. no hay cajas para abrir).

```json
{
  "error": "Existencia insuficiente para desagregar. Producto: <nombre>, Cantidad: <cantidad>, Existencia anterior: <número>"
}
```

---

### Existencia insuficiente para vender

No hay stock suficiente del producto al momento de registrar la venta.

```json
{
  "error": "Existencia insuficiente para <nombre del producto o productoTiendaId>"
}
```

---

## 4. Error genérico de servidor

### 500 Internal Server Error

Cualquier otro error (excepción no prevista, fallo de BD, etc.).

```json
{
  "error": "<mensaje del error>"
}
```

Si el error no es una instancia de `Error`, el mensaje será: `"Error al crear la venta"`.

---

## Resumen por código HTTP

| Código | Situación |
|--------|-----------|
| **200** | Venta ya existía (idempotencia por `syncId`) |
| **201** | Venta creada correctamente |
| **400** | Datos insuficientes, no hay período abierto, período no es el actual, o tasa de cambio faltante (`code: MISSING_EXCHANGE_RATE`) |
| **401** | No autenticado |
| **404** | Período no existe |
| **500** | Productos no encontrados, validaciones de negocio fallidas, o error interno |
