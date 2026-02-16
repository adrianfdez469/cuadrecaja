# 📱 Prompt para IA: Desarrollo de Aplicación POS Flutter con Funcionalidad Offline

## 🎯 Objetivo del Proyecto

Desarrollar una aplicación móvil en **Flutter** que replique la funcionalidad completa de un **Sistema de Punto de Venta (POS)** con capacidad de **funcionamiento offline total**. La aplicación debe poder operar sin conexión a internet después de la sincronización inicial de datos, registrando todas las ventas localmente y sincronizándolas automáticamente cuando se restablezca la conexión.

---

## 📋 Descripción General

### **Contexto**
Tengo un sistema web de punto de venta (POS) llamado "Cuadre de Caja" desarrollado en Next.js con TypeScript. Necesito una aplicación móvil en Flutter que replique las funcionalidades principales del POS web, pero optimizada para dispositivos móviles y con **capacidad completa de funcionamiento offline**.

### **Arquitectura Objetivo**
```
┌─────────────────────────────────────────────────┐
│          APLICACIÓN MÓVIL FLUTTER               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │      CAPA DE PRESENTACIÓN (UI)          │  │
│  │   - Pantallas de categorías y productos │  │
│  │   - Carrito de compras                   │  │
│  │   - Modal de pago                        │  │
│  │   - Búsqueda de productos                │  │
│  │   - Gestión de múltiples cuentas         │  │
│  └─────────────────────────────────────────┘  │
│                     ↓                           │
│  ┌─────────────────────────────────────────┐  │
│  │    CAPA DE LÓGICA DE NEGOCIO (BLoC)     │  │
│  │   - Gestión de ventas                    │  │
│  │   - Sincronización de datos              │  │
│  │   - Estado del carrito                   │  │
│  │   - Control de períodos                  │  │
│  └─────────────────────────────────────────┘  │
│                     ↓                           │
│  ┌─────────────────────────────────────────┐  │
│  │    CAPA DE PERSISTENCIA LOCAL            │  │
│  │   - SQLite (Base de datos local)         │  │
│  │   - Hive/Isar (Cache rápido)             │  │
│  │   - Shared Preferences (Configuración)   │  │
│  └─────────────────────────────────────────┘  │
│                     ↓                           │
│  ┌─────────────────────────────────────────┐  │
│  │    SERVICIO DE SINCRONIZACIÓN            │  │
│  │   - Descarga de datos al iniciar         │  │
│  │   - Cola de ventas pendientes            │  │
│  │   - Sincronización automática            │  │
│  │   - Manejo de conflictos                 │  │
│  └─────────────────────────────────────────┘  │
│                     ↓                           │
│  ┌─────────────────────────────────────────┐  │
│  │       API REST (Backend Existente)       │  │
│  │   - Autenticación                        │  │
│  │   - CRUD de productos/categorías         │  │
│  │   - Registro de ventas                   │  │
│  │   - Gestión de períodos                  │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🎨 Funcionalidades Principales

### **1. AUTENTICACIÓN Y GESTIÓN DE SESIÓN**

#### Requisitos:
- ✅ Login con usuario y contraseña
- ✅ Almacenamiento seguro del token JWT localmente
- ✅ Selección de negocio (si tiene múltiples)
- ✅ Selección de local/tienda
- ✅ Persistencia de sesión (mantener login)
- ✅ Verificación de suscripción activa
- ✅ Verificación de usuario configurado (con locales y roles)

#### Flujo:
```
1. Usuario abre app
2. Si tiene sesión guardada → Ir a Home
3. Si no → Mostrar pantalla de Login
4. Validar credenciales contra API
5. Si tiene múltiples locales → Mostrar selector
6. Guardar: token, usuario, negocio, local actual
7. Descargar datos iniciales (productos, categorías, período)
8. Navegar a pantalla principal del POS
```

#### Modelos de datos:
```dart
class Usuario {
  String id;
  String nombre;
  String usuario;
  String rol;
  Negocio negocio;
  Local localActual;
  List<Local> locales;
  String permisos; // String separado por |
}

class Negocio {
  String id;
  String nombre;
  int userLimit;
  int localLimit;
  int productLimit;
  DateTime limitTime;
  bool suspended;
}

class Local {
  String id;
  String nombre;
  String negocioId;
  String tipo; // "TIENDA" o "ALMACEN"
}
```

---

### **2. DESCARGA Y SINCRONIZACIÓN DE DATOS**

#### Datos a descargar al iniciar/sincronizar:
1. **Categorías** (nombre, id, color)
2. **Productos** (nombre, precio, stock, categoría, id)
3. **Período actual** (fechaInicio, id, estado)
4. **Destinos de transferencia** (para pagos con transferencia)
5. **Roles y permisos** del usuario

#### Estrategia de sincronización:

**Al Login/Abrir app:**
```
1. Verificar conexión a internet
2. Si hay conexión:
   - Descargar todas las categorías
   - Descargar todos los productos con stock
   - Descargar período activo
   - Guardar todo en SQLite
   - Marcar timestamp de última sincronización
3. Si no hay conexión:
   - Cargar datos de SQLite
   - Mostrar advertencia "Modo Offline"
   - Permitir continuar si hay datos previos
```

**Sincronización en segundo plano:**
```
1. Cada 5 minutos (si hay conexión):
   - Verificar si hay cambios en productos/categorías
   - Actualizar solo lo modificado (delta sync)
   
2. Constantemente (si hay conexión):
   - Intentar subir ventas pendientes de sincronización
   - Marcar ventas como sincronizadas exitosamente
   - Remover ventas muy antiguas ya sincronizadas
```

#### Modelos de datos:
```dart
class Categoria {
  String id;
  String nombre;
  String color; // hex color
  String negocioId;
}

class Producto {
  String id;
  String nombre;
  String descripcion;
  double precio;
  double stock;
  String categoriaId;
  String productoTiendaId; // ID de la relación ProductoTienda
  bool isActive;
}

class Periodo {
  String id;
  String localId;
  DateTime fechaInicio;
  DateTime? fechaFin;
  double montoInicial;
}
```

---

### **3. INTERFAZ PRINCIPAL DEL POS**

#### Pantalla de Categorías:
- ✅ **Grid de categorías** con colores personalizados
- ✅ **Nombre de la categoría** visible
- ✅ **Contador de productos** en cada categoría
- ✅ **Animación** al tocar categoría
- ✅ **Búsqueda rápida** de productos (barra superior)
- ✅ **Badge del carrito** con cantidad de items
- ✅ **Indicador de conexión** (online/offline)
- ✅ **Indicador de período activo**

```dart
// Ejemplo de Widget de Categoría
class CategoryCard extends StatelessWidget {
  final Categoria categoria;
  final int productCount;
  final VoidCallback onTap;
  
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(int.parse(categoria.color)),
              Color(int.parse(categoria.color)).withOpacity(0.7),
            ],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [/* sombras */],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.category, size: 48, color: Colors.white),
            SizedBox(height: 8),
            Text(categoria.nombre, style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            SizedBox(height: 4),
            Chip(label: Text('$productCount productos'), backgroundColor: Colors.white30),
          ],
        ),
      ),
    );
  }
}
```

#### Pantalla/Modal de Productos:
- ✅ **Lista de productos** de la categoría seleccionada
- ✅ **Card de producto** con:
  - Nombre del producto
  - Precio formateado
  - Stock disponible
  - Botón "Agregar al carrito"
  - Indicador de "Sin stock" (deshabilitado)
- ✅ **Búsqueda/filtro** dentro de la categoría
- ✅ **Ordenamiento** (nombre, precio, stock)
- ✅ **Agregar cantidad personalizada** (long press)

```dart
class ProductCard extends StatelessWidget {
  final Producto producto;
  final Function(Producto, int) onAddToCart;
  
  Widget build(BuildContext context) {
    final hasStock = producto.stock > 0;
    
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Icon(Icons.shopping_bag),
          backgroundColor: hasStock ? Colors.green : Colors.grey,
        ),
        title: Text(producto.nombre),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Precio: \$${producto.precio.toStringAsFixed(2)}'),
            Text('Stock: ${producto.stock.toStringAsFixed(1)}', 
              style: TextStyle(color: hasStock ? Colors.black : Colors.red)),
          ],
        ),
        trailing: IconButton(
          icon: Icon(Icons.add_shopping_cart),
          onPressed: hasStock ? () => onAddToCart(producto, 1) : null,
        ),
      ),
    );
  }
}
```

---

### **4. CARRITO DE COMPRAS (MULTI-CUENTA)**

#### Funcionalidades:
- ✅ **Múltiples carritos simultáneos** (Cuenta #1, Cuenta #2, etc.)
- ✅ **Crear nueva cuenta** con nombre personalizable
- ✅ **Cambiar entre cuentas** (tabs o dropdown)
- ✅ **Eliminar cuenta** (excepto si es la única)
- ✅ **Renombrar cuenta**
- ✅ **Lista de productos** en el carrito actual
- ✅ **Editar cantidad** de cada producto
- ✅ **Eliminar producto** del carrito
- ✅ **Vaciar carrito** completo
- ✅ **Total calculado** automáticamente
- ✅ **Persistencia local** (mantener carritos al cerrar app)

#### Modelo de datos:
```dart
class Cart {
  String id;
  String nombre; // "Cuenta #1"
  List<CartItem> items;
  double total;
}

class CartItem {
  String productId;
  String nombre;
  double precio;
  double cantidad;
  String productoTiendaId;
}
```

#### Estado del carrito (con BLoC o Provider):
```dart
class CartState {
  List<Cart> carts;
  String activeCartId;
  
  // Métodos
  void createCart(String? nombre);
  void setActiveCart(String id);
  void renameCart(String id, String nombre);
  void removeCart(String id);
  void addToCart(CartItem item);
  void updateQuantity(String productId, double cantidad);
  void removeFromCart(String productId);
  void clearCart();
}
```

---

### **5. PROCESAMIENTO DE PAGOS**

#### Modal de Pago:
- ✅ **Total a pagar** destacado
- ✅ **Dos métodos de pago**:
  1. **Efectivo** (con cálculo de cambio)
  2. **Transferencia** (con selector de destino)
- ✅ **Combinación de métodos** (pago mixto)
- ✅ **Validaciones**:
  - Monto en efectivo >= 0
  - Monto en transferencia >= 0
  - Total pagado >= Total de la venta
- ✅ **Cálculo de cambio** (si paga más en efectivo)
- ✅ **Botón confirmar** pago

```dart
class PaymentModal extends StatefulWidget {
  final double total;
  final Function(PaymentData) onConfirm;
  final List<TransferDestination> transferDestinations;
  
  // UI con TextField para efectivo, transferencia
  // Dropdown para destino de transferencia
  // Validaciones en tiempo real
}

class PaymentData {
  double totalCash;
  double totalTransfer;
  String? transferDestinationId;
  double cambio; // calculado
}
```

#### Flujo de pago:
```
1. Usuario hace clic en "Cobrar"
2. Abrir Modal de Pago
3. Usuario ingresa montos (efectivo/transferencia)
4. Sistema calcula cambio si aplica
5. Usuario confirma pago
6. Crear venta en estado "not_synced"
7. Guardar venta en SQLite
8. Guardar venta en memoria (store)
9. Si hay conexión:
   - Intentar sincronizar inmediatamente
10. Si no hay conexión:
    - Marcar como "pendiente de sincronización"
11. Limpiar carrito
12. Mostrar mensaje de éxito
13. Reproducir sonido de éxito (opcional)
```

---

### **6. GESTIÓN DE VENTAS (OFFLINE-FIRST)**

#### Modelo de Venta:
```dart
class Sale {
  String? dbId; // ID en el servidor (null si no está sincronizada)
  String identifier; // UUID local único
  String localId;
  String periodoId;
  String usuarioId;
  double total;
  double totalCash;
  double totalTransfer;
  String? transferDestinationId;
  List<SaleProduct> productos;
  
  // Campos de sincronización
  bool synced;
  SyncState syncState; // synced, syncing, not_synced, sync_err
  int syncAttempts;
  DateTime createdAt;
  bool wasOffline;
}

enum SyncState {
  synced,      // Ya está en el servidor
  syncing,     // En proceso de subida
  notSynced,   // Pendiente de subir
  syncError    // Error al sincronizar
}

class SaleProduct {
  String productId;
  String nombre;
  double cantidad;
  double precio;
  double subtotal;
  String productoTiendaId;
}
```

#### Flujo de sincronización de ventas:

**Al crear venta (online):**
```
1. Crear objeto Sale con identifier único (UUID)
2. Guardar en SQLite con syncState = "syncing"
3. Intentar POST al servidor
4. Si éxito:
   - Actualizar dbId con el ID del servidor
   - Cambiar syncState a "synced"
   - Marcar timestamp de sincronización
5. Si fallo:
   - Cambiar syncState a "not_synced"
   - Incrementar syncAttempts
   - Programar retry
```

**Al crear venta (offline):**
```
1. Crear objeto Sale con identifier único (UUID)
2. Guardar en SQLite con syncState = "not_synced"
3. wasOffline = true
4. Agregar a cola de sincronización
5. Mostrar mensaje "Venta guardada (se sincronizará cuando haya conexión)"
```

**Sincronización automática en background:**
```
1. Cada 30 segundos (si hay conexión):
   a. Obtener todas las ventas con syncState != "synced"
   b. Ordenar por createdAt (más antiguas primero)
   c. Para cada venta:
      - Si syncAttempts > 5 → Marcar como "sync_err" y notificar
      - Si no:
        * Cambiar a "syncing"
        * Intentar POST al servidor
        * Si éxito → Marcar "synced"
        * Si fallo → Marcar "not_synced", incrementar syncAttempts
```

#### Vista de ventas pendientes:
- ✅ **Lista de ventas** del período actual
- ✅ **Estado de cada venta** (badge de color):
  - 🟢 Sincronizada
  - 🟡 Sincronizando...
  - 🔴 Error de sincronización
  - ⚪ Pendiente
- ✅ **Detalle de venta** al hacer tap
- ✅ **Botón "Reintentar"** para ventas con error
- ✅ **Botón "Sincronizar todas"** (manual)
- ✅ **Eliminar venta** (solo ventas no sincronizadas)

---

### **7. BÚSQUEDA DE PRODUCTOS**

#### Funcionalidades:
- ✅ **Barra de búsqueda** en pantalla principal
- ✅ **Búsqueda en tiempo real** (mientras escribe)
- ✅ **Búsqueda por**:
  - Nombre del producto
  - Categoría
  - Código/SKU (si aplica)
- ✅ **Resultados filtrados** instantáneamente
- ✅ **Agregar al carrito** desde resultados
- ✅ **Destacar texto coincidente**

```dart
class ProductSearch extends StatefulWidget {
  final List<Producto> allProducts;
  final Function(Producto) onAddToCart;
  
  // TextField con debounce de 300ms
  // Filtrar productos localmente (offline-first)
  // Mostrar resultados en ListView/GridView
}
```

---

### **8. GESTIÓN DE PERÍODOS**

#### Funcionalidades:
- ✅ **Verificar período activo** al iniciar
- ✅ **Abrir nuevo período** si no hay uno activo
- ✅ **Modal de confirmación** para abrir período
- ✅ **Ingresar monto inicial** (efectivo en caja)
- ✅ **No permitir ventas** sin período activo
- ✅ **Mostrar información** del período actual:
  - Fecha de inicio
  - Monto inicial
  - Total vendido (calculado localmente)

```dart
class PeriodService {
  Future<Periodo?> getActivePeriod(String localId);
  Future<Periodo> openNewPeriod(String localId, double montoInicial);
  Future<void> closePeriod(String periodoId);
}
```

---

### **9. INDICADORES Y FEEDBACK VISUAL**

#### Estados de conexión:
- 🟢 **Online** (conexión estable)
- 🟡 **Conectando...** (intentando conectar)
- 🔴 **Offline** (sin conexión)

```dart
class ConnectionIndicator extends StatelessWidget {
  final ConnectionState state;
  
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _getColor(state),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_getIcon(state), size: 16, color: Colors.white),
          SizedBox(width: 4),
          Text(_getText(state), style: TextStyle(color: Colors.white)),
        ],
      ),
    );
  }
}
```

#### Notificaciones/Snackbars:
- ✅ **Venta exitosa** (verde)
- ✅ **Venta pendiente de sincronización** (amarillo)
- ✅ **Error al sincronizar** (rojo)
- ✅ **Conexión restablecida** (azul)
- ✅ **Sincronización completada** (verde)

#### Sonidos (opcional):
- 🔊 Agregar producto al carrito (beep corto)
- 🔊 Venta exitosa (campana/ding)
- 🔊 Error (sonido de error)

---

## 🏗️ Arquitectura Técnica Detallada

### **Stack Tecnológico Recomendado**

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  flutter_bloc: ^8.1.3  # o Provider, Riverpod
  
  # Persistencia Local
  sqflite: ^2.3.0  # SQLite para datos estructurados
  path: ^1.8.3
  hive_flutter: ^1.1.0  # Cache rápido (opcional)
  shared_preferences: ^2.2.2  # Configuración simple
  
  # HTTP & Networking
  dio: ^5.4.0  # HTTP client con interceptors
  connectivity_plus: ^5.0.2  # Detectar conexión
  
  # Utilidades
  uuid: ^4.2.2  # Generar IDs únicos
  intl: ^0.18.1  # Formateo de fechas/números
  
  # Seguridad
  flutter_secure_storage: ^9.0.0  # Almacenar tokens
  
  # UI
  flutter_slidable: ^3.0.1  # Swipe actions
  shimmer: ^3.0.0  # Loading skeleton
  
  # Audio (opcional)
  audioplayers: ^5.2.1
```

---

### **Estructura de Carpetas**

```
lib/
├── main.dart
├── app.dart
│
├── core/
│   ├── constants/
│   │   ├── api_constants.dart
│   │   ├── storage_keys.dart
│   │   └── app_constants.dart
│   ├── errors/
│   │   ├── failures.dart
│   │   └── exceptions.dart
│   ├── network/
│   │   ├── network_info.dart
│   │   └── api_client.dart
│   └── utils/
│       ├── formatters.dart
│       ├── validators.dart
│       └── helpers.dart
│
├── data/
│   ├── datasources/
│   │   ├── local/
│   │   │   ├── database_helper.dart
│   │   │   ├── productos_local_datasource.dart
│   │   │   ├── ventas_local_datasource.dart
│   │   │   └── categorias_local_datasource.dart
│   │   └── remote/
│   │       ├── auth_remote_datasource.dart
│   │       ├── productos_remote_datasource.dart
│   │       └── ventas_remote_datasource.dart
│   ├── models/
│   │   ├── usuario_model.dart
│   │   ├── producto_model.dart
│   │   ├── venta_model.dart
│   │   ├── categoria_model.dart
│   │   ├── periodo_model.dart
│   │   └── cart_model.dart
│   └── repositories/
│       ├── auth_repository_impl.dart
│       ├── productos_repository_impl.dart
│       └── ventas_repository_impl.dart
│
├── domain/
│   ├── entities/
│   │   ├── usuario.dart
│   │   ├── producto.dart
│   │   ├── venta.dart
│   │   ├── categoria.dart
│   │   └── periodo.dart
│   ├── repositories/
│   │   ├── auth_repository.dart
│   │   ├── productos_repository.dart
│   │   └── ventas_repository.dart
│   └── usecases/
│       ├── login_usecase.dart
│       ├── sync_productos_usecase.dart
│       ├── create_venta_usecase.dart
│       └── sync_ventas_usecase.dart
│
├── presentation/
│   ├── bloc/
│   │   ├── auth/
│   │   │   ├── auth_bloc.dart
│   │   │   ├── auth_event.dart
│   │   │   └── auth_state.dart
│   │   ├── cart/
│   │   │   ├── cart_bloc.dart
│   │   │   ├── cart_event.dart
│   │   │   └── cart_state.dart
│   │   ├── productos/
│   │   │   ├── productos_bloc.dart
│   │   │   ├── productos_event.dart
│   │   │   └── productos_state.dart
│   │   ├── ventas/
│   │   │   ├── ventas_bloc.dart
│   │   │   ├── ventas_event.dart
│   │   │   └── ventas_state.dart
│   │   └── sync/
│   │       ├── sync_bloc.dart
│   │       ├── sync_event.dart
│   │       └── sync_state.dart
│   ├── screens/
│   │   ├── login/
│   │   │   └── login_screen.dart
│   │   ├── home/
│   │   │   ├── home_screen.dart
│   │   │   └── widgets/
│   │   │       ├── category_card.dart
│   │   │       ├── search_bar.dart
│   │   │       └── connection_indicator.dart
│   │   ├── productos/
│   │   │   ├── productos_screen.dart
│   │   │   └── widgets/
│   │   │       └── product_card.dart
│   │   ├── cart/
│   │   │   ├── cart_screen.dart
│   │   │   └── widgets/
│   │   │       ├── cart_item.dart
│   │   │       └── multi_cart_tabs.dart
│   │   ├── payment/
│   │   │   └── payment_modal.dart
│   │   └── ventas/
│   │       ├── ventas_screen.dart
│   │       └── widgets/
│   │           └── venta_card.dart
│   └── widgets/
│       ├── custom_button.dart
│       ├── loading_indicator.dart
│       └── error_widget.dart
│
└── services/
    ├── sync_service.dart
    ├── audio_service.dart
    └── notification_service.dart
```

---

### **Base de Datos Local (SQLite)**

#### Esquema de Tablas:

```sql
-- Tabla de Categorías
CREATE TABLE categorias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  color TEXT NOT NULL,
  negocioId TEXT NOT NULL,
  lastSyncAt INTEGER
);

-- Tabla de Productos
CREATE TABLE productos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL,
  stock REAL NOT NULL,
  categoriaId TEXT NOT NULL,
  productoTiendaId TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  lastSyncAt INTEGER,
  FOREIGN KEY (categoriaId) REFERENCES categorias(id)
);

-- Tabla de Ventas
CREATE TABLE ventas (
  identifier TEXT PRIMARY KEY,
  dbId TEXT,
  localId TEXT NOT NULL,
  periodoId TEXT NOT NULL,
  usuarioId TEXT NOT NULL,
  total REAL NOT NULL,
  totalCash REAL NOT NULL,
  totalTransfer REAL NOT NULL,
  transferDestinationId TEXT,
  syncState TEXT NOT NULL, -- 'synced', 'syncing', 'not_synced', 'sync_err'
  syncAttempts INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL,
  wasOffline INTEGER DEFAULT 0,
  productos TEXT NOT NULL -- JSON stringificado
);

-- Tabla de Períodos
CREATE TABLE periodos (
  id TEXT PRIMARY KEY,
  localId TEXT NOT NULL,
  fechaInicio INTEGER NOT NULL,
  fechaFin INTEGER,
  montoInicial REAL NOT NULL,
  isActive INTEGER DEFAULT 1
);

-- Tabla de Carritos (persistencia)
CREATE TABLE carritos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  items TEXT NOT NULL, -- JSON stringificado
  total REAL NOT NULL,
  isActive INTEGER DEFAULT 0
);

-- Índices para mejorar performance
CREATE INDEX idx_productos_categoria ON productos(categoriaId);
CREATE INDEX idx_ventas_sync_state ON ventas(syncState);
CREATE INDEX idx_ventas_periodo ON ventas(periodoId);
CREATE INDEX idx_ventas_created_at ON ventas(createdAt);
```

---

### **Servicio de Sincronización**

```dart
class SyncService {
  final ProductosRemoteDataSource remoteDataSource;
  final ProductosLocalDataSource localDataSource;
  final VentasRemoteDataSource ventasRemoteDataSource;
  final VentasLocalDataSource ventasLocalDataSource;
  final NetworkInfo networkInfo;
  
  // Sincronizar productos y categorías (descarga)
  Future<void> syncProductsAndCategories() async {
    if (!await networkInfo.isConnected) return;
    
    try {
      // Obtener última sincronización
      final lastSync = await _getLastSyncTimestamp();
      
      // Descargar cambios desde el servidor
      final categorias = await remoteDataSource.getCategorias();
      final productos = await remoteDataSource.getProductos();
      
      // Guardar en base de datos local
      await localDataSource.saveCategorias(categorias);
      await localDataSource.saveProductos(productos);
      
      // Actualizar timestamp de sincronización
      await _updateLastSyncTimestamp(DateTime.now());
      
      print('✅ Sincronización de productos completada');
    } catch (e) {
      print('❌ Error en sincronización: $e');
      rethrow;
    }
  }
  
  // Sincronizar ventas (subida)
  Future<void> syncPendingSales() async {
    if (!await networkInfo.isConnected) return;
    
    try {
      // Obtener ventas no sincronizadas
      final pendingSales = await ventasLocalDataSource.getUnsyncedSales();
      
      if (pendingSales.isEmpty) {
        print('ℹ️ No hay ventas pendientes de sincronización');
        return;
      }
      
      print('📤 Sincronizando ${pendingSales.length} ventas...');
      
      for (final sale in pendingSales) {
        // Marcar como "sincronizando"
        await ventasLocalDataSource.updateSyncState(
          sale.identifier, 
          SyncState.syncing
        );
        
        try {
          // Intentar subir al servidor
          final response = await ventasRemoteDataSource.createSale(sale);
          
          // Si éxito, marcar como sincronizada
          await ventasLocalDataSource.markAsSynced(
            sale.identifier,
            response.id // ID del servidor
          );
          
          print('✅ Venta ${sale.identifier} sincronizada');
        } catch (e) {
          // Si fallo, marcar como error e incrementar intentos
          await ventasLocalDataSource.updateSyncState(
            sale.identifier,
            SyncState.syncError
          );
          await ventasLocalDataSource.incrementSyncAttempts(sale.identifier);
          
          print('❌ Error al sincronizar venta ${sale.identifier}: $e');
        }
      }
      
      print('✅ Sincronización de ventas completada');
    } catch (e) {
      print('❌ Error en sincronización de ventas: $e');
      rethrow;
    }
  }
  
  // Sincronización automática periódica
  void startPeriodicSync() {
    Timer.periodic(Duration(seconds: 30), (timer) async {
      if (await networkInfo.isConnected) {
        await syncPendingSales();
      }
    });
    
    Timer.periodic(Duration(minutes: 5), (timer) async {
      if (await networkInfo.isConnected) {
        await syncProductsAndCategories();
      }
    });
  }
}
```

---

## 🔐 Seguridad y Autenticación

### **Almacenamiento Seguro de Tokens**

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  final _storage = FlutterSecureStorage();
  
  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'user_data';
  
  Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }
  
  Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }
  
  Future<void> saveUser(Map<String, dynamic> userData) async {
    await _storage.write(key: _userKey, value: jsonEncode(userData));
  }
  
  Future<Map<String, dynamic>?> getUser() async {
    final data = await _storage.read(key: _userKey);
    if (data != null) {
      return jsonDecode(data);
    }
    return null;
  }
  
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
```

### **Cliente HTTP con Autenticación**

```dart
import 'package:dio/dio.dart';

class ApiClient {
  late Dio _dio;
  final SecureStorageService _secureStorage;
  
  ApiClient(this._secureStorage) {
    _dio = Dio(BaseOptions(
      baseUrl: 'https://tu-api.com/api',
      connectTimeout: Duration(seconds: 30),
      receiveTimeout: Duration(seconds: 30),
    ));
    
    // Interceptor para agregar token a cada request
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _secureStorage.getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) async {
          // Si es 401 (no autorizado), cerrar sesión
          if (error.response?.statusCode == 401) {
            await _secureStorage.clearAll();
            // Navegar a login
          }
          return handler.next(error);
        },
      ),
    );
  }
  
  Dio get dio => _dio;
}
```

---

## 📱 Flujo de Usuario Completo

### **Primera Vez que Abre la App**

```
1. ¿Tiene sesión guardada? → NO
2. Mostrar pantalla de Login
3. Usuario ingresa credenciales
4. Validar contra API
5. Si válido:
   a. Guardar token en secure storage
   b. Guardar datos del usuario
   c. Si tiene múltiples locales → Mostrar selector
   d. Guardar local seleccionado
   e. Descargar datos iniciales:
      - Categorías
      - Productos
      - Período activo
   f. Mostrar progreso de descarga
   g. Navegar a Home
6. Si inválido:
   - Mostrar error
   - Permitir reintentar
```

### **Aperturas Subsecuentes**

```
1. ¿Tiene sesión guardada? → SÍ
2. Verificar si token es válido (no expirado)
3. Si válido:
   a. Cargar datos del usuario desde storage
   b. Verificar conexión a internet
   c. Si hay conexión:
      - Sincronizar ventas pendientes (background)
      - Verificar actualizaciones de productos
   d. Si no hay conexión:
      - Cargar datos de SQLite
      - Mostrar indicador "Modo Offline"
   e. Navegar a Home
4. Si token expiró:
   - Limpiar storage
   - Navegar a Login
```

### **Flujo de Venta (Online)**

```
1. Usuario selecciona categoría
2. Ver lista de productos
3. Agregar productos al carrito (múltiples)
4. Ver carrito con total
5. Hacer clic en "Cobrar"
6. Abrir modal de pago
7. Ingresar montos (efectivo/transferencia)
8. Confirmar pago
9. Crear objeto Sale con UUID
10. Guardar en SQLite (syncState: "syncing")
11. Intentar POST al servidor
12. Si éxito:
    - Obtener ID del servidor
    - Actualizar dbId
    - Cambiar syncState a "synced"
    - Mostrar "Venta exitosa"
13. Si fallo:
    - Cambiar syncState a "not_synced"
    - Mostrar "Venta guardada (se sincronizará luego)"
14. Limpiar carrito
15. Reproducir sonido de éxito
```

### **Flujo de Venta (Offline)**

```
1. Usuario selecciona categoría
2. Ver lista de productos (cargados de SQLite)
3. Agregar productos al carrito
4. Ver carrito con total
5. Hacer clic en "Cobrar"
6. Abrir modal de pago
7. Ingresar montos
8. Confirmar pago
9. Crear objeto Sale con UUID
10. Guardar en SQLite (syncState: "not_synced", wasOffline: true)
11. Mostrar "Venta guardada. Se sincronizará cuando haya conexión"
12. Limpiar carrito
13. Reproducir sonido de éxito
14. Agregar a cola de sincronización
```

### **Recuperación de Conexión**

```
1. App detecta que la conexión se restableció
2. Mostrar notificación "Conexión restablecida"
3. Automáticamente:
   a. Obtener ventas pendientes de sincronización
   b. Para cada venta:
      - Intentar subir al servidor
      - Si éxito → Marcar como sincronizada
      - Si fallo → Dejar pendiente, incrementar intentos
   c. Sincronizar productos/categorías actualizadas
4. Mostrar notificación "X ventas sincronizadas"
```

---

## 🎨 Diseño de UI/UX

### **Paleta de Colores Sugerida**

```dart
class AppColors {
  // Colores principales
  static const Color primary = Color(0xFF1976D2); // Azul
  static const Color secondary = Color(0xFFDC004E); // Rojo/Rosa
  static const Color accent = Color(0xFF00BCD4); // Cyan
  
  // Estados
  static const Color success = Color(0xFF4CAF50); // Verde
  static const Color warning = Color(0xFFFFC107); // Amarillo
  static const Color error = Color(0xFFF44336); // Rojo
  static const Color info = Color(0xFF2196F3); // Azul claro
  
  // Estados de sincronización
  static const Color synced = Color(0xFF4CAF50); // Verde
  static const Color syncing = Color(0xFFFFC107); // Amarillo
  static const Color notSynced = Color(0xFF9E9E9E); // Gris
  static const Color syncError = Color(0xFFF44336); // Rojo
  
  // Backgrounds
  static const Color background = Color(0xFFF5F5F5);
  static const Color cardBackground = Colors.white;
  
  // Textos
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textHint = Color(0xFFBDBDBD);
}
```

### **Temas**

```dart
final lightTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    brightness: Brightness.light,
  ),
  appBarTheme: AppBarTheme(
    elevation: 0,
    backgroundColor: AppColors.primary,
    foregroundColor: Colors.white,
  ),
  cardTheme: CardTheme(
    elevation: 2,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
    ),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
      ),
    ),
  ),
);
```

---

## 🧪 Testing y Calidad

### **Tests Críticos a Implementar**

```dart
// 1. Tests unitarios para sincronización
test('Should sync sales when connection is available', () async {
  // Arrange
  when(networkInfo.isConnected).thenAnswer((_) async => true);
  when(ventasLocalDataSource.getUnsyncedSales()).thenAnswer((_) async => [mockSale]);
  when(ventasRemoteDataSource.createSale(any)).thenAnswer((_) async => mockResponse);
  
  // Act
  await syncService.syncPendingSales();
  
  // Assert
  verify(ventasLocalDataSource.markAsSynced(mockSale.identifier, mockResponse.id));
});

// 2. Tests de carrito
test('Should add product to active cart', () {
  // Arrange
  final cartBloc = CartBloc();
  final product = mockProduct;
  
  // Act
  cartBloc.add(AddToCartEvent(product));
  
  // Assert
  expect(cartBloc.state.activeCart.items.length, 1);
});

// 3. Tests de offline
test('Should save sale locally when offline', () async {
  // Arrange
  when(networkInfo.isConnected).thenAnswer((_) async => false);
  
  // Act
  await ventasRepository.createSale(mockSale);
  
  // Assert
  verify(ventasLocalDataSource.saveSale(argThat(
    predicate<Sale>((sale) => sale.syncState == SyncState.notSynced)
  )));
});
```

---

## 📊 Métricas y Monitoreo

### **Eventos a Trackear**

```dart
class AnalyticsEvents {
  // Autenticación
  static const String login = 'login';
  static const String logout = 'logout';
  
  // Ventas
  static const String saleCreated = 'sale_created';
  static const String saleCreatedOffline = 'sale_created_offline';
  static const String saleSynced = 'sale_synced';
  static const String saleSyncError = 'sale_sync_error';
  
  // Productos
  static const String productAddedToCart = 'product_added_to_cart';
  static const String productSearch = 'product_search';
  
  // Sincronización
  static const String syncStarted = 'sync_started';
  static const String syncCompleted = 'sync_completed';
  static const String syncFailed = 'sync_failed';
  
  // Offline
  static const String wentOffline = 'went_offline';
  static const String wentOnline = 'went_online';
}
```

---

## 📚 Endpoints del API Backend

### **Autenticación**

```http
POST /api/auth/login
Content-Type: application/json

{
  "usuario": "string",
  "password": "string"
}

Response 200:
{
  "user": {
    "id": "string",
    "nombre": "string",
    "usuario": "string",
    "rol": "string",
    "negocio": { /* Negocio */ },
    "localActual": { /* Local */ },
    "locales": [ /* Array de Locales */ ],
    "permisos": "string"
  },
  "token": "jwt-token"
}
```

### **Productos**

```http
GET /api/productos?localId={localId}
Authorization: Bearer {token}

Response 200:
{
  "productos": [
    {
      "id": "string",
      "nombre": "string",
      "precio": number,
      "stock": number,
      "categoria": { "id": "string", "nombre": "string", "color": "string" },
      "productoTiendaId": "string"
    }
  ]
}
```

### **Categorías**

```http
GET /api/categorias?negocioId={negocioId}
Authorization: Bearer {token}

Response 200:
{
  "categorias": [
    {
      "id": "string",
      "nombre": "string",
      "color": "string",
      "negocioId": "string"
    }
  ]
}
```

### **Ventas**

```http
POST /api/ventas
Authorization: Bearer {token}
Content-Type: application/json

{
  "tiendaId": "string",
  "cierreId": "string",
  "total": number,
  "totalcash": number,
  "totaltransfer": number,
  "transferDestinationId": "string" | null,
  "productos": [
    {
      "productId": "string",
      "cantidad": number,
      "precio": number,
      "name": "string"
    }
  ]
}

Response 201:
{
  "id": "string",
  "message": "Venta creada exitosamente"
}
```

### **Períodos**

```http
GET /api/periodos/last?localId={localId}
Authorization: Bearer {token}

Response 200:
{
  "id": "string",
  "localId": "string",
  "fechaInicio": "ISO-8601",
  "fechaFin": "ISO-8601" | null,
  "montoInicial": number
}

POST /api/periodos/open
Authorization: Bearer {token}
Content-Type: application/json

{
  "localId": "string",
  "montoInicial": number
}

Response 201:
{
  "id": "string",
  "message": "Período abierto exitosamente"
}
```

---

## 🚀 Próximos Pasos para el Desarrollo

### **Fase 1: Setup y Configuración (1-2 días)**
- ✅ Crear proyecto Flutter
- ✅ Configurar dependencias
- ✅ Configurar estructura de carpetas
- ✅ Configurar SQLite y base de datos
- ✅ Implementar cliente HTTP con Dio

### **Fase 2: Autenticación (2-3 días)**
- ✅ Implementar pantalla de login
- ✅ Implementar almacenamiento seguro de tokens
- ✅ Implementar login con API
- ✅ Implementar selección de local
- ✅ Implementar persistencia de sesión

### **Fase 3: Sincronización de Datos (3-4 días)**
- ✅ Implementar descarga de categorías y productos
- ✅ Implementar guardado en SQLite
- ✅ Implementar lógica de sincronización delta
- ✅ Implementar detección de conexión
- ✅ Implementar sincronización automática

### **Fase 4: Interfaz del POS (4-5 días)**
- ✅ Implementar pantalla de categorías
- ✅ Implementar pantalla de productos
- ✅ Implementar búsqueda de productos
- ✅ Implementar carrito multi-cuenta
- ✅ Implementar modal de pago

### **Fase 5: Gestión de Ventas Offline (3-4 días)**
- ✅ Implementar creación de ventas locales
- ✅ Implementar cola de sincronización
- ✅ Implementar sincronización automática de ventas
- ✅ Implementar manejo de errores
- ✅ Implementar vista de ventas pendientes

### **Fase 6: Refinamiento y Testing (2-3 días)**
- ✅ Implementar tests unitarios
- ✅ Implementar tests de integración
- ✅ Pruebas offline completas
- ✅ Optimización de performance
- ✅ Pulido de UI/UX

---

## 📝 Notas Adicionales

### **Consideraciones Importantes**

1. **Manejo de Timestamps:**
   - Usar timestamps UTC en todo momento
   - Convertir a zona horaria local solo para visualización
   - Usar `DateTime.now().millisecondsSinceEpoch` para timestamps

2. **IDs Únicos:**
   - Usar UUIDs v4 para identificadores locales
   - Mantener separados `identifier` (local) y `dbId` (servidor)

3. **Validaciones:**
   - Validar stock disponible antes de agregar al carrito
   - Validar que hay período activo antes de vender
   - Validar permisos del usuario para cada acción

4. **Performance:**
   - Usar paginación para listas grandes
   - Implementar búsqueda con debounce (300ms)
   - Lazy loading de imágenes (si aplica)
   - Índices en SQLite para búsquedas rápidas

5. **Manejo de Errores:**
   - Capturar todas las excepciones de red
   - Mostrar mensajes claros al usuario
   - Logging de errores para debugging
   - Retry automático con backoff exponencial

6. **Experiencia Offline:**
   - Indicador visible de estado de conexión
   - Feedback inmediato al guardar ventas offline
   - Contador de ventas pendientes de sincronización
   - Notificación cuando se sincroniza exitosamente

---

## 🎯 Resultado Esperado

Una aplicación móvil Flutter profesional que:

✅ **Funcione completamente offline** después de la sincronización inicial
✅ **Replique la experiencia del POS web** en dispositivos móviles
✅ **Sincronice automáticamente** cuando haya conexión
✅ **Sea rápida y fluida** con transiciones suaves
✅ **Maneje errores gracefully** con mensajes claros
✅ **Tenga una UI moderna** y fácil de usar
✅ **Sea confiable** con datos persistentes localmente
✅ **Escale bien** con muchos productos y ventas

---

## 📞 Soporte y Referencias

### **Recursos Útiles:**
- [Flutter Documentation](https://docs.flutter.dev/)
- [flutter_bloc Package](https://pub.dev/packages/flutter_bloc)
- [sqflite Package](https://pub.dev/packages/sqflite)
- [dio Package](https://pub.dev/packages/dio)
- [Offline-First Architecture](https://www.infoq.com/articles/offline-first-architecture/)

### **Ejemplos Similares:**
- POS systems en Flutter
- Offline-first e-commerce apps
- Inventory management apps




