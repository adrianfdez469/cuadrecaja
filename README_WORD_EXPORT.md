# 📄 Exportación de Inventario a Word

## 🎯 Nueva Funcionalidad

Se ha agregado la capacidad de exportar el inventario de productos a un documento de Microsoft Word (.docx) desde la página de **Inventario**.

## 📋 Características del Documento Exportado

### Estructura del Documento
- **Título**: "Inventario de Productos - [Nombre de la Tienda]"
- **Fecha**: Fecha actual de exportación
- **Tabla con 5 columnas**:
  1. **Producto**: Nombres de todos los productos
  2. **Precio**: Precios de venta de cada producto
  3. **Cantidad Inicial**: Columna vacía para llenar manualmente
  4. **Cantidad Vendida**: Columna vacía expandida para llenar manualmente
  5. **Cantidad Final**: Columna vacía para llenar manualmente

### Organización por Categorías
- **Agrupación**: Los productos se agrupan por categoría
- **Orden de categorías**: Alfabético (A-Z)
- **Orden de productos**: Alfabético dentro de cada categoría
- **Separadores de categoría**: 
  - Fila completa con fondo azul
  - Texto en mayúsculas y color blanco
  - Ocupa todas las columnas de la tabla

### Formato del Documento
- **Tamaño de letra**: Grande y legible
  - Título: 16pt (negrita)
  - Fecha: 12pt
  - Encabezados de tabla: 12pt (negrita)
  - Nombres de categoría: 12pt (negrita, blanco)
  - Contenido: 11pt
- **Orientación**: Vertical (Portrait)
- **Ancho de tabla**: 100% de la página
- **Distribución de columnas**:
  - Producto: 30%
  - Precio: 15%
  - Cantidad Inicial: 15%
  - Cantidad Vendida: 25% (expandida)
  - Cantidad Final: 15%

## 🚀 Cómo Usar la Funcionalidad

### Desde la Página de Inventario

1. **Navegar a Inventario**
   - Ve a la sección "Inventario" en el menú principal

2. **Exportar el Documento**
   - Haz clic en el botón **"Exportar a Word"** en la parte superior derecha
   - O usa el botón flotante con ícono de descarga en la esquina inferior derecha

3. **Descarga Automática**
   - El archivo se descargará automáticamente
   - Nombre del archivo: `Inventario_[NombreTienda]_[Fecha].docx`
   - Ejemplo: `Inventario_Mi_Tienda_2024-01-15.docx`

### Requisitos
- Solo se exportan productos que tienen **precio > 0**
- Se requiere tener productos en el inventario
- Conexión a internet (para cargar los datos)

## 💡 Casos de Uso

### Para Control de Inventario Físico
- Imprimir el documento para hacer conteos manuales por categoría
- Llenar las columnas "Cantidad Inicial" con el stock actual
- Registrar ventas en "Cantidad Vendida" organizadas por categoría
- Calcular "Cantidad Final" manualmente
- **Ventaja**: Organización visual por tipo de producto facilita el conteo

### Para Reportes Periódicos
- Generar reportes semanales/mensuales organizados por categoría
- Comparar inventario teórico vs físico por sección
- Documentar diferencias y ajustes por tipo de producto
- **Ventaja**: Identificar fácilmente categorías con mayor rotación

### Para Auditorías
- Proporcionar documentación formal del inventario por categorías
- Registro histórico de productos y precios organizados
- Evidencia para controles internos por sección
- **Ventaja**: Facilita la revisión sistemática por tipo de producto

## 🔧 Detalles Técnicos

### Librerías Utilizadas
- **docx**: Generación de documentos Word
- **file-saver**: Descarga automática de archivos

### Filtros y Ordenamiento Aplicados
- Solo productos con precio > 0
- Productos de la tienda actual del usuario
- **Categorías ordenadas alfabéticamente**
- **Productos ordenados alfabéticamente dentro de cada categoría**

### Formato de Categorías
- **Fondo**: Azul (#4472C4)
- **Texto**: Blanco, mayúsculas, negrita
- **Posición**: Centrado
- **Ancho**: Ocupa las 5 columnas completas

### Compatibilidad
- Compatible con Microsoft Word 2010+
- Compatible con LibreOffice Writer
- Compatible con Google Docs (importación)

## ⚠️ Consideraciones

### Limitaciones
- Requiere JavaScript habilitado en el navegador
- No funciona en modo offline
- Tamaño máximo recomendado: 1000 productos por documento

### Recomendaciones
- Usar filtros de búsqueda si tienes muchos productos
- Verificar que los precios estén actualizados antes de exportar
- Guardar copias de seguridad de los documentos generados
- **Revisar que las categorías estén bien asignadas** para una mejor organización

## 🐛 Solución de Problemas

### El botón no aparece
- Verificar que tengas productos en el inventario
- Asegurarte de que al menos un producto tenga precio > 0

### Error al descargar
- Verificar conexión a internet
- Intentar refrescar la página
- Contactar soporte si persiste

### Archivo no se abre
- Verificar que tengas software compatible instalado
- El archivo es formato .docx estándar
- Intentar abrir con diferentes programas (Word, LibreOffice, etc.)

### Categorías no aparecen correctamente
- Verificar que los productos tengan categoría asignada
- Las categorías sin productos no aparecerán en el documento
- Contactar soporte si hay problemas con las categorías

---

*Funcionalidad agregada en versión 0.1.0*
*Agrupación por categorías agregada en versión 0.1.1* 