# 📋 Cuadre de Caja - Documentación General del Sistema

## 🎯 Descripción General

**Cuadre de Caja** es un sistema integral de punto de venta (POS) y gestión empresarial desarrollado con tecnologías modernas. Está diseñado para pequeñas y medianas empresas que necesitan un control completo de sus operaciones comerciales, inventarios y ventas bajo una arquitectura multi-tenant robusta y escalable.

El sistema permite gestionar múltiples locales (tiendas y almacenes), usuarios con roles específicos, inventarios independientes con sincronización en tiempo real, y proporciona funcionalidades avanzadas como funcionamiento offline, traspasos entre locales, y análisis detallados de rentabilidad.

---

## 🏗️ Arquitectura Técnica

### Características Arquitectónicas

- **Multi-tenant**: Aislamiento completo entre negocios con seguridad a nivel de datos
- **Offline-first**: Funcionamiento sin conexión en módulo POS con sincronización automática
- **Responsive Design**: Optimizado para dispositivos móviles, tablets y escritorio
- **API RESTful**: Integración con sistemas externos y escalabilidad
- **Middleware de Seguridad**: Verificación de autenticación y suscripciones
- **Sistema de Roles**: Permisos granulares por usuario y funcionalidad

---

## 🏢 Modelo de Datos Principal

### Entidades Core del Sistema

#### **Negocio**
- Entidad principal que agrupa toda la información empresarial
- Campos: nombre, descripción, límites de plan, fechas de suscripción
- Relaciones: usuarios, tiendas, categorías, productos, proveedores, roles
- Control de suspensión y límites por plan de suscripción

#### **Tienda/Local**
- Representa locales físicos (tiendas con POS o almacenes solo inventario)
- Tipos: "tienda" (con funcionalidad POS) y "almacen" (solo inventario)
- Relaciones: usuarios asignados, productos con stock, ventas, cierres
- Soporte para traspasos entre locales

#### **Usuario**
- Gestión de usuarios con roles específicos por local
- Campos: nombre, usuario único, password encriptado, estado activo
- Relación con local actual para contexto de trabajo
- Sistema de permisos granulares por funcionalidad

#### **Producto**
- Catálogo de productos con soporte para fracciones
- Campos: nombre único por negocio, descripción, categoría
- Soporte para productos fraccionados (ej: cigarro suelto de caja)
- Múltiples códigos de barras por producto
- Gestión de productos en consignación

#### **ProductoTienda**
- Relación producto-local con información específica
- Campos: costo, precio, existencia (soporta decimales)
- Soporte para múltiples proveedores por producto
- Control de stock independiente por local

### Módulos de Operación

#### **Ventas**
- Registro completo de transacciones con múltiples productos
- Soporte para métodos de pago mixtos (efectivo + transferencia)
- Trazabilidad completa con timestamps y sincronización offline
- Relación con destinos de transferencia configurables

#### **MovimientoStock**
- Auditoría completa de movimientos de inventario
- Tipos: COMPRA, VENTA, TRASPASO, AJUSTE, CONSIGNACION
- Cálculo automático de Costo Promedio Ponderado (CPP)
- Estados: PENDIENTE, APROBADO para control de traspasos

#### **CierrePeriodo**
- Gestión de períodos contables con cierres automáticos
- Resúmenes denormalizados para performance
- Separación de ventas propias vs consignación
- Generación automática de reportes

---

## 🛠️ Funcionalidades Principales

### 🛒 Punto de Venta (POS)
- **Interfaz táctil optimizada** para tablets y computadoras
- **Funcionamiento offline** con sincronización automática
- **Búsqueda inteligente** de productos en tiempo real
- **Carrito de compras** con gestión de cantidades decimales
- **Múltiples métodos de pago** en una sola transacción
- **Validación automática** de existencias antes de vender
- **Gestión de transferencias** con destinos configurables
- **Historial de ventas** pendientes de sincronización

### 📦 Gestión de Inventario
- **Consulta de stock** en tiempo real por local
- **Movimientos de inventario** con tipos específicos
- **Traspasos entre locales** con estados de aprobación
- **Importación masiva** desde archivos Excel
- **Cálculo automático** de Costo Promedio Ponderado (CPP)
- **Productos fraccionados** con conversiones automáticas
- **Gestión de consignación** con proveedores específicos
- **Auditoría completa** de todos los movimientos

### 💰 Cierre de Caja
- **Verificación automática** de ventas pendientes
- **Resumen del período** con métricas calculadas
- **Confirmación de cierre** con validaciones
- **Generación automática** de reportes en Word
- **Apertura automática** del nuevo período
- **Análisis de rentabilidad** por producto y categoría
- **Separación de ventas** propias vs consignación

### 📊 Dashboard y Reportes
- **Métricas en tiempo real** del negocio
- **Comparativas de períodos** anteriores
- **Productos más vendidos** con rankings
- **Estado del inventario** con alertas
- **Exportación a Word** con reportes profesionales
- **Filtros avanzados** por fecha, local y categoría
- **Visualizaciones gráficas** de tendencias

### ⚙️ Configuración del Sistema
- **Gestión de productos** con categorías y códigos
- **Administración de usuarios** con roles específicos
- **Configuración de locales** (tiendas/almacenes)
- **Gestión de proveedores** para consignación
- **Sistema de roles** con permisos granulares
- **Destinos de transferencia** configurables
- **Notificaciones del sistema** con niveles de importancia

---

## 🔐 Sistema de Seguridad y Permisos

### Autenticación
- **NextAuth.js** con JWT para sesiones seguras
- **Passwords encriptados** con bcrypt
- **Middleware de autenticación** en todas las rutas protegidas
- **Headers de usuario** codificados en Base64 para APIs

### Autorización
- **Sistema de roles** granular por usuario y local
- **Permisos específicos** por funcionalidad del sistema
- **Verificación en frontend** y backend
- **Aislamiento multi-tenant** a nivel de datos

---

## 💳 Sistema de Suscripciones

### Planes Disponibles

#### **FREEMIUM** (Gratuito - 30 días)
- 2 locales máximo
- 1 usuario
- Hasta 30 productos
- Funcionalidades básicas
- Soporte por email

#### **BÁSICO** ($10/mes)
- 2 locales máximo
- 2 usuarios
- Hasta 100 productos
- Capacitación inicial
- Acceso completo a funcionalidades

#### **SILVER** ($20/mes) - Recomendado
- Hasta 5 locales
- Usuarios ilimitados
- Hasta 500 productos
- Soporte prioritario
- Capacitación incluida

#### **PREMIUM** ($30/mes)
- Hasta 20 locales
- Usuarios ilimitados
- Productos ilimitados
- Soporte 24/7
- Funcionalidades personalizadas
- Integración con impresoras

#### **CUSTOM** (Negociable)
- Límites personalizados
- Funcionalidades específicas
- Soporte dedicado
- Duración negociable

### Control de Suscripciones
- **Verificación automática** de límites por plan
- **Suspensión automática** por vencimiento
- **Middleware de verificación** en tiempo real
- **Alertas de vencimiento** con anticipación
- **Reactivación automática** al renovar

---

## 🌐 Funcionalidades Offline y PWA

### Capacidades Offline
- **POS parcialmente funcional** sin conexión a internet
- **Almacenamiento local** de ventas pendientes
- **Sincronización automática** al recuperar conexión
- **Detección de estado** de red en tiempo real
- **Banner de estado offline** para usuarios

---

## 📱 Compatibilidad y Responsive Design

### Dispositivos Soportados
- **Computadoras de escritorio** (Windows, macOS, Linux)
- **Tablets** (iPad, Android tablets)
- **Smartphones** (iOS, Android)
- **Pantallas táctiles** optimizadas para POS

### Navegadores Compatibles
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 📈 Métricas y Monitoreo

### Métricas del Sistema
- **Estadísticas de uso** del negocio
- **Límites de plan** en tiempo real
- **Días restantes** de suscripción
- **Uso de recursos** (productos, usuarios, locales)

### Notificaciones del Sistema
- **Alertas de vencimiento** de suscripción
- **Notificaciones de límites** alcanzados
- **Mensajes promocionales** configurables
- **Niveles de importancia** (BAJA, MEDIA, ALTA, CRÍTICA)

---

## 🛡️ Backup y Recuperación

### Estrategia de Backup
- **Respaldos semanales** de bases de datos

### Integridad de Datos
- **Constraints de base de datos** para consistencia
- **Validaciones en múltiples capas** (frontend, backend, DB)
- **Transacciones atómicas** para operaciones críticas
- **Auditoría completa** de cambios importantes

---

## 📞 Soporte y Contacto

### Canales de Soporte
- **Email**: adrianfdez469@gmail.com
- **Nombre del desarrollador**: Adrián Fernandez
- **Numero de telefono del desarrollador**: +53 53334449
- **Numero de telefono del desarrollador**: +598 97728107
- **Capacitación**: Incluida según plan de suscripción
- **Soporte técnico**: Disponible según nivel de plan

---

## 📝 Notas Técnicas Importantes

### Limitaciones Conocidas
- **Sincronización offline** limitada a ventas por el momento
- **Reportes complejos** pueden requerir optimización
- **Límites de plan** verificados en tiempo real

### Recomendaciones de Uso
- **Conexión estable** recomendada para mejor experiencia
- **Monitoreo de límites** de suscripción
- **Capacitación de usuarios** para aprovechamiento completo

---

*Documento generado automáticamente - Versión 1.0*  
*Última actualización: Octubre 2025*
