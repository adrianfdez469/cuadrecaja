# Interfaz de Usuario - Sistema de Notificaciones

## Descripción

La interfaz de usuario del sistema de notificaciones incluye una página de gestión completa para SUPER_ADMIN y un widget de visualización para todos los usuarios en la pantalla principal.

## Componentes Implementados

### 1. Página de Gestión de Notificaciones
**Ruta:** `/configuracion/notificaciones`

#### Características:
- **CRUD completo** para notificaciones
- **Estadísticas en tiempo real** del sistema
- **Búsqueda y filtrado** de notificaciones
- **Verificaciones automáticas** ejecutables manualmente
- **Interfaz responsive** para móviles y desktop

#### Funcionalidades:

##### 📊 Dashboard de Estadísticas
- Total de notificaciones
- Notificaciones activas
- Notificaciones leídas vs no leídas
- Porcentaje de lectura

##### 📝 Gestión de Notificaciones
- **Crear**: Formulario completo con validaciones
- **Editar**: Modificación de notificaciones existentes
- **Eliminar**: Confirmación antes de eliminar
- **Buscar**: Filtrado por título, descripción o tipo

##### ⚙️ Configuración Avanzada
- **Tipos**: Alerta, Notificación, Promoción, Mensaje
- **Niveles de importancia**: Baja, Media, Alta, Crítica
- **Destinatarios**: Negocios específicos o usuarios específicos
- **Fechas**: Inicio y fin de vigencia

##### 🔄 Verificaciones Automáticas
- Botón para ejecutar verificaciones manualmente
- Notificaciones automáticas de:
  - Expiración de suscripciones
  - Límites de productos
  - Límites de usuarios

### 2. Widget de Notificaciones
**Ubicación:** Pantalla principal (`/`)

#### Características:
- **Visualización compacta** de notificaciones activas
- **Badge con contador** de notificaciones no leídas
- **Expansión/colapso** para ver detalles
- **Marcado como leída** con un clic
- **Modal de detalles** completo

#### Funcionalidades:

##### 👁️ Visualización
- Lista de notificaciones activas
- Iconos por tipo de notificación
- Chips de nivel de importancia
- Indicador de no leídas (punto rojo)

##### 📱 Interacción
- **Clic en notificación**: Abre modal con detalles
- **Marcar como leída**: Botón individual o automático al abrir
- **Expandir/colapsar**: Para ver más o menos notificaciones

##### 🎨 Diseño
- **Responsive**: Adaptado para móviles y desktop
- **Colores**: Según tipo e importancia
- **Animaciones**: Transiciones suaves

## Estructura de Archivos

```
src/
├── app/
│   └── configuracion/
│       └── notificaciones/
│           └── page.tsx              # Página de gestión
├── components/
│   └── NotificationsWidget.tsx       # Widget de visualización
├── services/
│   ├── notificationService.ts        # Servicio backend
│   └── notificationApiService.ts     # Servicio frontend
└── types/
    └── INotificacion.ts              # Tipos TypeScript
```

## Uso de los Componentes

### Página de Gestión (SUPER_ADMIN)

```typescript
// Acceso directo
router.push('/configuracion/notificaciones');

// O desde el menú de configuración
// Configuración > Notificaciones
```

### Widget de Notificaciones

```typescript
import NotificationsWidget from '@/components/NotificationsWidget';

// Uso básico
<NotificationsWidget />

// Con configuración personalizada
<NotificationsWidget 
  maxNotifications={5} 
  showBadge={true} 
/>
```

## Permisos y Acceso

### SUPER_ADMIN
- ✅ Acceso completo a la página de gestión
- ✅ Crear, editar, eliminar notificaciones
- ✅ Ver estadísticas
- ✅ Ejecutar verificaciones automáticas
- ✅ Ver widget de notificaciones

### Usuarios Normales
- ❌ Sin acceso a la página de gestión
- ✅ Ver widget de notificaciones
- ✅ Marcar notificaciones como leídas
- ✅ Ver detalles de notificaciones

## Flujo de Usuario

### 1. Crear Notificación (SUPER_ADMIN)
1. Ir a **Configuración > Notificaciones**
2. Hacer clic en **"Agregar Notificación"**
3. Completar formulario:
   - Título y descripción
   - Fechas de inicio y fin
   - Tipo y nivel de importancia
   - Destinatarios (opcional)
4. Guardar

### 2. Ver Notificaciones (Todos los Usuarios)
1. Ir a la **pantalla principal**
2. Ver widget de notificaciones
3. Expandir para ver lista completa
4. Hacer clic en notificación para ver detalles
5. Marcar como leída (automático o manual)

### 3. Gestionar Notificaciones (SUPER_ADMIN)
1. Ir a **Configuración > Notificaciones**
2. Ver lista de todas las notificaciones
3. Usar búsqueda para filtrar
4. Editar o eliminar según necesidad
5. Ver estadísticas en tiempo real

## Validaciones

### Frontend
- **Título y descripción**: Obligatorios
- **Fechas**: Inicio debe ser anterior a fin
- **Tipos**: Selección de valores válidos
- **Niveles**: Selección de valores válidos

### Backend
- **Permisos**: Verificación de rol SUPER_ADMIN
- **Datos**: Validación de formato y contenido
- **Acceso**: Verificación de destinatarios

## Estados de la Interfaz

### Notificaciones
- **Activa**: Dentro del período de vigencia
- **Inactiva**: Fuera del período de vigencia
- **Leída**: Marcada como leída por el usuario
- **No leída**: Sin marcar como leída

### Widget
- **Colapsado**: Solo muestra título y contador
- **Expandido**: Muestra lista de notificaciones
- **Cargando**: Muestra spinner
- **Vacío**: No se muestra si no hay notificaciones

## Responsive Design

### Desktop (> 768px)
- Tabla completa con todas las columnas
- Estadísticas siempre visibles
- Formularios en modal grande

### Mobile (≤ 768px)
- Tabla adaptada con columnas principales
- Estadísticas colapsables
- Formularios optimizados para touch

## Integración con el Sistema

### Menú de Navegación
- Agregado en **Configuración > Notificaciones**
- Solo visible para SUPER_ADMIN
- Icono de notificaciones

### Pantalla Principal
- Widget integrado antes de las acciones rápidas
- Actualización automática al cargar
- No interfiere con otras funcionalidades

## Pruebas

### Scripts de Prueba
```bash
# Pruebas básicas
node scripts/test-notifications.js

# Pruebas completas
node scripts/test-notifications-complete.js
```

### Casos de Prueba
1. **Creación**: Formulario completo y validaciones
2. **Edición**: Modificación de campos
3. **Eliminación**: Confirmación y eliminación
4. **Búsqueda**: Filtrado de resultados
5. **Marcado como leída**: Interacción del widget
6. **Responsive**: Adaptación móvil/desktop

## Consideraciones de UX

### Accesibilidad
- **Contraste**: Colores adecuados para lectura
- **Navegación**: Teclado y mouse
- **Screen readers**: Textos descriptivos

### Rendimiento
- **Lazy loading**: Carga bajo demanda
- **Caché**: Datos en memoria local
- **Optimización**: Consultas eficientes

### Usabilidad
- **Feedback**: Mensajes de éxito/error
- **Confirmaciones**: Para acciones destructivas
- **Ayuda**: Tooltips y textos informativos

## Futuras Mejoras

### Funcionalidades
1. **Notificaciones push**: Integración con navegador
2. **Plantillas**: Notificaciones predefinidas
3. **Programación**: Notificaciones futuras
4. **Categorías**: Filtros avanzados
5. **Exportación**: Reportes en PDF/Excel

### UX/UI
1. **Animaciones**: Transiciones más fluidas
2. **Temas**: Modo oscuro/claro
3. **Personalización**: Configuración de usuario
4. **Accesos directos**: Teclas de acceso rápido
5. **Notificaciones en tiempo real**: WebSockets
