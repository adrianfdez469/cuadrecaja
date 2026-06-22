# Contrato API v2 — App Flutter Cuadre de Caja

Documento de referencia para **cruzar con la API del backend** (jun 2026). Sustituye al contrato v1.0.7 cuando el backend incluye soporte **multimoneda obligatorio** en ventas (`commit aeee54d+`).

> **Uso recomendado con IA de la APK:**
> "Implementa los cambios descritos en API_APP_CONTRATO_FLUTTER_v2.md. Prioridad 1: POST venta con campos multimoneda. Prioridad 2: GET tasas-cambio y errores login 403."

Documentación ampliada del backend: [API_APP_DOCUMENTATION.md](API_APP_DOCUMENTATION.md) · Respuestas POST venta: [API_APP_VENTA_POST_RESPUESTAS.md](API_APP_VENTA_POST_RESPUESTAS.md)

---

## Changelog v1.0.7 → v2.0.0

| Prioridad | Cambio | ¿Rompe sync? |
|-----------|--------|--------------|
| **CRÍTICO** | `POST /venta` exige `pagosDetalle`, `vueltoDetalle`, `tasaSnapshot` | **Sí** |
| **ALTO** | Login: nuevos errores 403 (cuenta pendiente, sin rol) | No |
| **MEDIO** | `negocio.planId` en auth; límites desde plan (`-1` = ilimitado) | No |
| **MEDIO** | `codigos[]` sin `tipo`, con `productoId` | No* |
| **NUEVO** | `GET /api/app/monedas/{negocioId}` y `GET /api/app/tasas-cambio/{negocioId}` | Requerido para multimoneda |
| **MEDIO** | Auth: `negocio.monedaBase` y `negocio.monedaFuerte` | No |
| **MEDIO** | Productos: `monedaPrecioCode` | No |
| **MEDIO** | GET ventas: devuelve `pagosDetalle`, `vueltoDetalle`, `monedaCobro`, `tasaSnapshot` | No |

\* Rompe solo si la app parseaba `codigos.tipo` como obligatorio.

---

## Configuración del cliente

| Concepto | Valor en la app |
|----------|-----------------|
| Base URL app | `{SERVER}/api/app` (`lib/core/constants/api_constants.dart`) |
| Monedas y tasas | `{SERVER}/api/app/monedas/{negocioId}` · `{SERVER}/api/app/tasas-cambio/{negocioId}` |
| Auth | `Authorization: Bearer <token>` en todas las peticiones excepto login |
| Content-Type | `application/json` |
| Timeout | 30 s connect / 30 s receive |
| Cliente HTTP | Dio (`lib/core/network/api_client.dart`) |
| Refresh automático | Ante `401`, reintenta con `POST /auth/refresh`; si falla, re-login con credenciales guardadas |

---

## Resumen de endpoints consumidos

| # | Método | Ruta | ¿Activo? | Cambio vs v1 |
|---|--------|------|----------|--------------|
| 1 | POST | `/auth/login` | ✅ | +2 errores 403 |
| 2 | POST | `/auth/refresh` | ✅ | `negocio.planId` |
| 3 | POST | `/auth/cambiar-tienda` | ✅ | `negocio.planId` |
| 4 | GET | `/productos/{tiendaId}` | ✅ | `monedaPrecioCode`, `codigos` sin `tipo` |
| 5 | POST | `/productos/agregar-codigo/{productoId}` | ✅ | +`success` en body |
| 6 | GET | `/periodo/{tiendaId}/actual` | ✅ | — |
| 7 | POST | `/periodo/{tiendaId}/abrir` | ✅ | — |
| 8 | POST | `/venta/{tiendaId}/{periodoId}` | ✅ | **+multimoneda obligatorio** |
| 9 | GET | `/venta/{tiendaId}/{periodoId}` | ✅ | +campos multimoneda |
| 10 | DELETE | `/venta/{tiendaId}/{periodoId}/{ventaId}` | ✅ | — |
| 11 | GET | `/transfer-destinations/{tiendaId}` | ✅ | — |
| 12 | GET | `/resumen-dia/{tiendaId}` | ✅ | — |
| **13** | GET | `/monedas/{negocioId}` | ✅ **nuevo** | Cache offline multimoneda |
| **14** | GET | `/tasas-cambio/{negocioId}` | ✅ **nuevo** | Cache offline tasas vigentes |
| — | GET | `/venta/{tiendaId}/{periodoId}/{ventaId}` | ⚠️ Definido, no usado en UI | — |
| — | POST | `/descuentos/preview` | ❌ Solo constante, sin uso | — |

**Orquestación:** `lib/services/sync_service.dart` · **DI:** `lib/core/di/injection.dart`

---

## 1. Autenticación

### POST `/auth/login`

**Envía:**
```json
{ "usuario": "string", "password": "string" }
```

**Espera (200, `success: true`):**
```json
{
  "success": true,
  "token": "string",
  "user": {
    "id": "uuid",
    "nombre": "string",
    "usuario": "string",
    "rol": "string | null",
    "negocio": {
      "id": "uuid",
      "nombre": "string",
      "limitTime": "ISO8601",
      "planId": "uuid",
      "monedaBase": "string (ej. CUP)",
      "monedaFuerte": "string (ej. USD)",
      "userlimit": "number (-1 = ilimitado)",
      "locallimit": "number (-1 = ilimitado)",
      "productlimit": "number (-1 = ilimitado)"
    },
    "localActual": { "id", "nombre", "negocioId", "tipo" },
    "locales": [{ "id", "nombre", "negocioId", "tipo" }],
    "permisos": ["string"] | "string"
  }
}
```

> `permisos` se parsea como **array** o **string** (un solo permiso).

**Errores:** campo `error` en body → `Exception(error)`.

**Errores nuevos (v2):**

| HTTP | `error` |
|------|---------|
| 403 | `Cuenta pendiente de activación. Completa el registro desde el enlace enviado a tu correo.` |
| 403 | `No tienes un rol asignado. Contacta al administrador.` |

**Archivos:** `auth_remote_datasource.dart`, `usuario_model.dart`, `auth_provider.dart`, `secure_storage_service.dart`

---

### POST `/auth/refresh`

**Envía:** body vacío. Header `Authorization: Bearer <token>`.

**Espera:** misma forma que login (`success`, `token`, `user`).

**Archivos:** `auth_remote_datasource.dart`, `api_client.dart` (interceptor 401)

---

### POST `/auth/cambiar-tienda`

**Envía:**
```json
{ "tiendaId": "uuid" }
```

**Espera:** misma forma que login.

**Archivos:** `auth_remote_datasource.dart`, `auth_provider.dart`

---

## 2. Monedas y tasas de cambio (cache offline)

### GET `/monedas/{negocioId}`

**Headers:** `Authorization: Bearer <token>`

**Path:** `negocioId` = `user.negocio.id` del login.

**Espera (200):**
```json
{
  "monedas": [
    {
      "id": "uuid",
      "negocioId": "uuid",
      "monedaCode": "CUP",
      "admiteEfectivo": true,
      "admiteTransferencia": true,
      "activo": true,
      "moneda": {
        "code": "CUP",
        "nombre": "Peso Cubano",
        "simbolo": "$",
        "activo": true,
        "denominaciones": [
          { "id": "uuid", "monedaCode": "CUP", "valor": 1000, "activo": true, "orden": 10 }
        ]
      }
    }
  ]
}
```

**Reglas:** solo monedas activas del negocio (incluida moneda base); denominaciones activas ordenadas `orden` desc; `denominaciones: []` si no hay billetes configurados.

**Errores:** 401 `No autenticado` · 403 `No autorizado` · 404 `Negocio no encontrado`

---

### GET `/tasas-cambio/{negocioId}`

**Headers:** `Authorization: Bearer <token>`

**Path:** `negocioId` = `user.negocio.id` del login.

**Espera (200):**
```json
{
  "monedaBase": "CUP",
  "vigentes": { "USD": 400, "EUR": 450 },
  "actualizadoEn": "2026-06-21T12:00:00.000Z"
}
```

**Reglas de negocio:**

- `vigentes` es el objeto a enviar como `tasaSnapshot` en ventas.
- Cada entrada: 1 unidad de `{monedaCode}` = `vigentes[monedaCode]` unidades de `monedaBase`.
- `monedaBase` no aparece en `vigentes`; solo tasas `> 0`.
- `actualizadoEn` (opcional): fecha de la tasa más reciente; útil para decidir refresh en sync periódico.
- Cachear al arranque (tras login) junto con monedas y refrescar periódicamente o antes de cobrar.

**Errores:** 401 `No autenticado` · 403 `No autorizado` · 404 `Negocio no encontrado`

**Archivos sugeridos:** `monedas_remote_datasource.dart`, `tasas_remote_datasource.dart`, `tasa_snapshot_model.dart`, provider de tasas, integración en `sync_service.dart` y `payment_modal.dart`

---

## 3. Productos

### GET `/productos/{tiendaId}`

**Espera:**
```json
{
  "success": true,
  "productos": [ ... ],
  "total": 2
}
```

La app puede ignorar `success` y `total` (compatible con v1).

**Cada producto — campos parseados:**

| Campo | Tipo | Uso en app | Cambio v2 |
|-------|------|------------|-----------|
| `id` | string | ID ProductoTienda | — |
| `productoId` | string | ID producto base | — |
| `nombre` | string | UI | — |
| `descripcion` | string? | UI | — |
| `precio` | number | Ventas | **Omitido** si usuario es proveedor |
| `monedaPrecioCode` | string \| null | Conversión a moneda base | **Nuevo**; `null` = moneda base del negocio |
| `costo` | number | Cache | — |
| `existencia` | number | Stock offline | — |
| `permiteDecimal` | bool | Validación local | — |
| `categoria` | `{ id, nombre, color }` \| null | Grid POS | Puede ser null |
| `codigos` | `[{ id, codigo, productoId }]` | Escáner | **Sin `tipo`**; +`productoId` |
| `proveedor` | `{ id, nombre }` \| null | Filtros ventas | — |
| `esFraccion` | bool | Desagregación local | — |
| `fraccionDe` | `{ id, nombre }`? | Desagregación local | — |
| `unidadesPorFraccion` | int? | Desagregación local | — |

**Archivos:** `productos_remote_datasource.dart`, `producto_model.dart`, `sync_service.dart`, `productos_provider.dart`

---

### POST `/productos/agregar-codigo/{productoId}`

**Path:** `productoId` = ID del **producto base** (`producto.productoId`), no ProductoTienda.

**Envía:**
```json
{ "codigo": "string" }
```

**Espera (201):**
```json
{
  "success": true,
  "codigo": { "id": "uuid", "codigo": "string", "productoId": "uuid" }
}
```

**Errores:** campo `error` en body (400, 403, 404, 409).

**Permiso en app:** `operaciones.pos-venta.asociar_codigo` (o `SUPER_ADMIN`).

**Archivos:** `productos_remote_datasource.dart`, `asociar_codigo_sheet.dart`, `barcode_scanner_screen.dart`

---

## 4. Período de caja

### GET `/periodo/{tiendaId}/actual`

**Espera:**
```json
{
  "success": true,
  "periodo": {
    "id", "tiendaId", "fechaInicio", "fechaFin",
    "totalVentas", "totalGanancia", "totalInversion", "totalTransferencia"
  } | null,
  "estaAbierto": bool,
  "mensaje": "string?"
}
```

Si `periodo == null` → app interpreta "sin período".

**Archivos:** `periodos_remote_datasource.dart`, `periodo_model.dart`, `periodo_provider.dart`

---

### POST `/periodo/{tiendaId}/abrir`

**Envía:** body vacío.

**Espera (201):** `{ "success": true, "periodo": { ... }, "estaAbierto": true }`

**Errores:** `{ "error": "string" }` si `success != true`.

**Archivos:** `periodos_remote_datasource.dart`, `periodo_provider.dart`

---

## 5. Ventas (crítico — offline-first + multimoneda)

### POST `/venta/{tiendaId}/{periodoId}`

**Envía** (`VentaLocalModel.toApiJson` + campos multimoneda persistidos para sync):

```json
{
  "syncId": "uuid",
  "createdAt": 1705401600000,
  "productos": [{ "productoTiendaId", "cantidad", "name?", "precio" }],
  "total": "number",
  "totalcash": "number",
  "totaltransfer": "number",
  "transferDestinationId": "uuid? | null",
  "wasOffline": "bool",
  "syncAttempts": "int",
  "discountCodes": ["string"]?,

  "monedaCobro": "string",
  "pagosDetalle": [{
    "tipo": "cash" | "transfer",
    "moneda": "string",
    "monto": "number > 0",
    "equivalenteBase": "number >= 0",
    "transferDestinationId": "uuid?"
  }],
  "vueltoDetalle": [{ "moneda": "string", "monto": "number >= 0" }],
  "tasaSnapshot": { "USD": 120, "MLC": 75 }
}
```

**Campos multimoneda (OBLIGATORIOS desde v2):**

| Campo | Regla |
|-------|-------|
| `pagosDetalle` | Array con **≥ 1** pago; transfer requiere `transferDestinationId` |
| `vueltoDetalle` | Array obligatorio; `[]` si no hay vuelto |
| `tasaSnapshot` | Objeto obligatorio; `{}` válido si negocio solo usa CUP |
| `monedaCobro` | Moneda principal del cobro (ej. `"CUP"`) |

**`equivalenteBase`:** monto del pago convertido a `monedaBase` del negocio usando `tasaSnapshot` y la lógica de ancla CUP del backend.

**Nota:** `usuarioId` en body es **ignorado** por el backend; usa el usuario del JWT.

**Migración mínima (negocio solo CUP, sin UI multimoneda):**

```json
{
  "monedaCobro": "CUP",
  "pagosDetalle": [
    {
      "tipo": "cash",
      "moneda": "CUP",
      "monto": "<totalcash>",
      "equivalenteBase": "<totalcash>"
    }
  ],
  "vueltoDetalle": [],
  "tasaSnapshot": {}
}
```

Si hay transferencia, añadir línea adicional:

```json
{
  "tipo": "transfer",
  "moneda": "CUP",
  "monto": "<totaltransfer>",
  "equivalenteBase": "<totaltransfer>",
  "transferDestinationId": "<uuid>"
}
```

**Espera éxito (200 idempotente / 201 creada):**
```json
{
  "success": true,
  "venta": {
    "id", "tiendaId", "usuarioId", "cierrePeriodoId",
    "total", "totalcash", "totaltransfer", "discountTotal",
    "syncId", "createdAt", "frontendCreatedAt?", "wasOffline",
    "monedaCobro?", "pagosDetalle?", "vueltoDetalle?", "tasaSnapshot?",
    "usuario": { "nombre" }?,
    "productos": [{ "productoTiendaId", "cantidad", "precio"|"price", "name"? }]
  },
  "duplicado": "bool"
}
```

**Errores:** siempre campo `error: string` en body.

**Mensajes de error que la app reconoce** (ver `sync_error_messages.dart`):

Existentes (sin cambio de texto):

- `No autenticado`
- `Datos insuficientes para crear la venta: ...`
- `No existe un período abierto en la tienda`
- `No existe un período con el id proporcionado...`
- `La venta pertenece a un período cerrado o diferente al actual...`
- `Productos no encontrados: ...`
- `Cantidad decimal no permitida para algunos productos`
- `Vendes más unidades sueltas de las que lleva una caja...`
- `Existencia insuficiente para desagregar...`
- `Existencia insuficiente para ...`
- `Error al crear la venta`

**Nuevos (v2 — añadir a `sync_error_messages.dart`):**

| Substring en `error` | Título sugerido |
|----------------------|-----------------|
| `pagosDetalle es requerido` | Datos de pago incompletos |
| `vueltoDetalle inválido` | Error en vuelto |
| `tasaSnapshot es requerido` | Tasas no disponibles |

> **Cambiar el texto de estos errores rompe la UX** (títulos amigables y detección de conflicto de período).

**Flujo app:** guarda local (incl. multimoneda) → descuenta stock → sincroniza en background cada 30 s.

**Archivos:** `ventas_remote_datasource.dart`, `venta_model.dart`, `sync_service.dart`, `ventas_provider.dart`, `sync_error_messages.dart`, `payment_modal.dart`, `ventas_list_screen.dart`

---

### GET `/venta/{tiendaId}/{periodoId}`

**Espera:** `{ "success": true, "ventas": [ ... ], "total": N }`

**Campos de venta parseados:** `id`, `createdAt`, `total`, `totalcash`, `totaltransfer`, `discountTotal`, `tiendaId`, `usuarioId`, `cierrePeriodoId`, `syncId`, `wasOffline`, `frontendCreatedAt`, `usuario.nombre`, `productos[]` (incl. `monedaPrecioCode`), `transferDestination` o `transferDestinationId`, **`monedaCobro`**, **`pagosDetalle`**, **`vueltoDetalle`**, **`tasaSnapshot`**.

**NO parsea:** `appliedDiscounts`, `success`, `total`.

**Archivos:** `ventas_remote_datasource.dart`, `venta_model.dart`, `ventas_list_screen.dart`, `ventas_detail_screen.dart`

---

### DELETE `/venta/{tiendaId}/{periodoId}/{ventaId}`

**Espera:** 200 con `{ "success": true, "message": "Venta cancelada correctamente" }` (body no crítico).

**Archivos:** `ventas_remote_datasource.dart`, `sync_service.dart` (restaura stock local tras borrar)

---

## 6. Destinos de transferencia

### GET `/transfer-destinations/{tiendaId}`

**Espera:** `{ "success": true, "destinos": [{ "id", "nombre", "descripcion", "default" }], "total": N }`

**Archivos:** `transfer_destinations_remote_datasource.dart`, `transfer_destination_model.dart`, `payment_modal.dart`

---

## 7. Resumen de día (Punto de partida)

### GET `/resumen-dia/{tiendaId}?cierreId={periodoId}&soloConMovimientos={bool}`

**Query params:**

| Param | Obligatorio | Default app |
|-------|-------------|-------------|
| `cierreId` | Sí | ID del período activo |
| `soloConMovimientos` | No | `true` |

**Espera (200):**
```json
{
  "totales": { "ventas", "entradas", "salidas" },
  "productos": [{
    "productoTiendaId", "productoId", "nombre", "proveedorNombre",
    "permiteDecimal", "categoriaId", "categoriaNombre", "categoriaColor",
    "tieneMovimientos", "ultimaModificacion",
    "cantidadInicial", "ventas", "entradas", "salidas", "cantidadFinal"
  }]
}
```

**Archivos:** `resumen_dia_remote_datasource.dart`, `resumen_dia_model.dart`, `punto_de_partida_screen.dart`

---

## Flujos críticos (no deben romperse)

```
Login
  → GET monedas/{negocioId}                        ← NUEVO v2
  → GET tasas-cambio/{negocioId}                   ← NUEVO v2
  → Cargar productos + período + destinos transferencia
  → Si período cerrado: abrir período
  → POS: ventas offline-first con syncId + multimoneda
  → Sync background cada 30s
  → Refresh token automático en 401
```

| Flujo | Dependencias API |
|-------|------------------|
| Arranque POS | login/refresh, **GET monedas**, **GET tasas-cambio**, GET productos, GET período, GET transfer-destinations |
| Venta offline | POST venta (idempotencia syncId + **pagosDetalle/vueltoDetalle/tasaSnapshot**) |
| Historial ventas | GET ventas del período |
| Cancelar venta | DELETE venta |
| Escáner + código nuevo | POST agregar-codigo |
| Punto de partida | GET resumen-dia |
| Cambio de tienda | POST cambiar-tienda → recarga catálogo, tasas y período |

---

## Campos / endpoints que la app puede ignorar

- `appliedDiscounts` en respuestas de venta
- `POST /descuentos/preview` (no implementado en UI)
- `GET /venta/.../detalle` (datasource existe, UI no lo llama)
- `success` y `total` en listados de productos/ventas/destinos
- `negocio.planId` (informativo)
- `periodoActualId` en error 400 de venta (la app usa texto + PeriodoProvider)

---

## Checklist implementación Flutter (v2)

```
[ ] Modelos: PagoLinea, VueltoLinea, TasaSnapshot, MonedasResponse, TasasVigentesResponse
[ ] Servicio: GET /monedas/{negocioId} y GET /tasas-cambio/{negocioId} (cache local)
[ ] VentaLocalModel.toApiJson(): monedaCobro, pagosDetalle, vueltoDetalle, tasaSnapshot
[ ] PaymentModal: generar pagosDetalle desde cash/transfer (o UI multimoneda completa)
[ ] sync_service: migrar ventas pendientes sin multimoneda (payload CUP-only)
[ ] sync_error_messages.dart: mensajes multimoneda (pagosDetalle, vueltoDetalle, tasaSnapshot)
[ ] auth: parsear negocio.monedaBase y negocio.monedaFuerte
[ ] auth: manejar 403 activación pendiente / sin rol
[ ] producto_model: monedaPrecioCode; quitar codigos.tipo, añadir codigos.productoId
[ ] Login negocio: parsear planId (opcional)
```

---

## Prioridad recomendada

1. **Urgente:** parche mínimo POST venta (payload CUP-only) para desbloquear sync offline.
2. **Corto plazo:** consumir tasas + UI multimoneda alineada con web POS.
3. **Medio:** errores login 403 y ajuste modelo `codigos`.

---

## Versión

| Campo | Valor |
|-------|-------|
| Contrato | **v2.0.0** |
| Backend mínimo | `aeee54d` (multimoneda en API app) |
| App Flutter base | v1.0.7 (`pubspec.yaml`) |
| Generado | jun 2026 |
