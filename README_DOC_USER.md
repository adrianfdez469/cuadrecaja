# 📦 Cuadre de Caja - Documentación de Usuario

## 🎯 ¿Qué es Cuadre de Caja?

**Cuadre de Caja** es un sistema integral de punto de venta (POS) diseñado para gestionar múltiples tiendas o locales comerciales. Permite el control completo de inventarios, ventas, usuarios y reportes financieros de manera eficiente y organizada.

## 🚀 Características Principales

### 📱 Punto de Venta (POS)
- **Interfaz intuitiva** para realizar ventas rápidas
- **Búsqueda de productos** por nombre o categoría
- **Carrito de compras** con gestión de cantidades
- **Métodos de pago múltiples**: efectivo y transferencia
- **Sincronización automática** de ventas

### 🏪 Gestión Multi-Tienda
- **Múltiples locales** bajo un mismo negocio
- **Usuarios asignados** a tiendas específicas
- **Inventarios independientes** por tienda
- **Traspasos de productos** entre tiendas
- **Nombres únicos por negocio**: Cada negocio puede tener sus propias tiendas con nombres únicos

### 📊 Control de Inventarios
- **Gestión de productos** por categorías
- **Control de existencias** en tiempo real
- **Movimientos de stock** detallados
- **Fraccionamiento de productos** (ej: vender cigarros sueltos de una caja)
- **Ajustes de inventario** manuales
- **📄 Exportación a Word**: Genera reportes de inventario en formato Word organizados por categoría
- **Productos únicos por negocio**: Cada negocio puede tener sus propios productos y categorías

### 💰 Control Financiero
- **Cierres de período** automáticos
- **Reportes de ventas** detallados
- **Control de costos y precios** por tienda
- **Ganancias y márgenes** calculados automáticamente

### 👥 Gestión de Usuarios
- **Roles diferenciados**: vendedor, administrador, superadmin
- **Control de acceso** por tienda
- **Historial de ventas** por usuario

## 🔐 Primeros Pasos

### 1. Acceso al Sistema
1. Ingresa a la aplicación web
2. Usa tus credenciales de usuario y contraseña
3. Selecciona la tienda donde vas a trabajar (si tienes múltiples asignadas)

### 2. Iniciar un Período de Ventas
- Al iniciar el día, el sistema te pedirá **abrir un nuevo período**
- Es necesario tener un período abierto para realizar ventas
- Solo puede haber un período abierto por tienda a la vez

## 📋 Guía de Uso

### 🛒 Realizar una Venta

1. **Seleccionar Productos**:
   - Haz clic en una categoría para ver sus productos
   - Usa la barra de búsqueda para encontrar productos específicos
   - Haz clic en un producto para agregarlo al carrito

2. **Gestionar el Carrito**:
   - Ajusta las cantidades según necesites
   - Elimina productos si es necesario
   - Revisa el total de la venta

3. **Procesar el Pago**:
   - Haz clic en el ícono del carrito
   - Selecciona "Procesar Pago"
   - Ingresa los montos en efectivo y/o transferencia
   - Confirma la venta

### 📦 Gestión de Inventario

#### Ver Productos
- Ve a **"Inventario"** para ver todos los productos de la tienda
- Filtra por categorías o busca productos específicos
- Revisa existencias actuales

#### 📄 Exportar Inventario a Word
1. En la página de **"Inventario"**, busca el botón **"Exportar a Word"**
2. Haz clic para generar el documento
3. El archivo se descargará automáticamente con:
   - **Título del reporte** con fecha actual
   - **Productos organizados por categoría** (ordenados alfabéticamente)
   - **Tabla detallada** con: Producto, Precio, Cantidad Inicial, Cantidad Vendida, Cantidad Final
   - **Formato profesional** con encabezados de categoría destacados

#### Movimientos de Stock
- Accede a **"Movimientos"** para ver el historial
- Tipos de movimientos:
  - **Compra**: Ingreso de mercancía
  - **Venta**: Salida por venta
  - **Traspaso**: Movimiento entre tiendas
  - **Ajuste**: Correcciones manuales

### 💰 Cierres y Reportes

#### Cierre de Período
1. Ve a **"Cierre"** cuando termines el día/período
2. Revisa el resumen de ventas
3. Confirma el cierre del período
4. El sistema generará un reporte automático

#### Resumen de Ventas
- Accede a **"Ventas"** para ver historial
- Filtra por fechas, productos o usuarios
- Exporta reportes si es necesario

### ⚙️ Configuración

#### Gestión de Precios
- Ve a **"Costos y Precios"** para ajustar precios
- Modifica costos y precios por producto
- Los cambios se aplican inmediatamente

#### Categorías y Productos
- Los administradores pueden crear nuevas categorías
- Asignar colores distintivos a cada categoría
- Crear nuevos productos y asignarlos a categorías
- **Nombres únicos por negocio**: Puedes usar los mismos nombres que otros negocios sin conflictos

## 🎯 Consejos de Uso

### ✅ Buenas Prácticas
- **Abre siempre un período** antes de comenzar a vender
- **Cierra el período** al final del día para mantener reportes organizados
- **Revisa las existencias** regularmente para evitar quedarte sin stock
- **Sincroniza las ventas** si trabajas sin conexión
- **Exporta reportes regularmente** usando la función de exportación a Word
- **Organiza productos por categorías** para facilitar la búsqueda y reportes

### ⚠️ Precauciones
- **No cierres períodos** sin revisar todas las ventas
- **Verifica los montos** antes de confirmar pagos
- **Mantén actualizado el inventario** para evitar sobreventa
- **Usa traspasos** en lugar de ajustes para mover productos entre tiendas

## 🆘 Resolución de Problemas

### Problemas Comunes

**❓ No puedo realizar ventas**
- Verifica que tengas un período abierto
- Confirma que los productos tengan existencias
- Revisa que los precios estén configurados

**❓ El producto no aparece en la búsqueda**
- Verifica que tenga precio asignado
- Confirma que tenga existencias (o su producto padre si es fracción)
- Revisa que esté asignado a tu tienda

**❓ Error de sincronización**
- Revisa tu conexión a internet
- Intenta sincronizar manualmente desde el menú
- Contacta al administrador si persiste

**❓ Las páginas de cierre, ventas o historial muestran errores en un negocio nuevo**
- Este es un comportamiento normal cuando el negocio no tiene datos históricos
- Realiza algunas ventas y cierres para generar datos
- Las páginas funcionarán correctamente una vez que tengas información

**❓ No puedo crear productos/categorías con nombres existentes**
- Los nombres de productos, categorías y tiendas deben ser únicos **dentro de tu negocio**
- Puedes usar nombres que otros negocios ya utilizan
- Si el error persiste, verifica que no hayas usado ese nombre anteriormente

**❓ La exportación a Word no funciona**
- Asegúrate de tener productos en tu inventario
- Verifica que tu navegador permita descargas
- Intenta desde otro navegador si el problema persiste

## 🎉 Nuevas Funcionalidades

### 🆕 Últimas Mejoras

#### 📄 Exportación de Inventario a Word
- **Nueva funcionalidad** para generar reportes profesionales
- **Organización por categorías** con formato visual distintivo
- **Datos completos** incluyendo cantidades iniciales, vendidas y finales
- **Descarga automática** del documento generado

#### 🏢 Gestión Mejorada Multi-Negocio
- **Restricciones de unicidad por negocio**: Cada negocio puede tener sus propios nombres
- **Mayor flexibilidad** para crear productos y categorías
- **Mejor aislamiento** entre diferentes negocios

## 📞 Soporte

Para asistencia técnica o dudas sobre el uso del sistema:
- Contacta a tu administrador de tienda
- Revisa los reportes de errores en el sistema
- Mantén actualizada la aplicación

---

*Sistema Cuadre de Caja - Versión 0.2.0*
*Última actualización: Enero 2025* 