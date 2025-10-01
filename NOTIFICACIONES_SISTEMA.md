# Sistema de Notificaciones

## Descripción General

El sistema de notificaciones permite gestionar alertas, promociones y mensajes que pueden ser creados manualmente por usuarios con rol SUPER_ADMIN o generados automáticamente según diversos criterios del sistema.

## Características Principales

### Tipos de Notificaciones
- **ALERTA**: Para situaciones críticas o importantes
- **NOTIFICACION**: Para información general del sistema
- **PROMOCION**: Para ofertas y promociones
- **MENSAJE**: Para comunicaciones generales

### Niveles de Importancia
- **BAJA**: Información general
- **MEDIA**: Información importante
- **ALTA**: Situaciones que requieren atención
- **CRITICA**: Situaciones urgentes

### Destinatarios
- **Todos los usuarios**: Cuando no se especifican destinatarios
- **Negocios específicos**: Array de IDs de negocios
- **Usuarios específicos**: Array de IDs de usuarios

## Estructura de la Base de Datos

### Modelo Notificacion
```sql
model Notificacion {
  id                String   @id @default(uuid())
  titulo            String
  descripcion       String
  fechaInicio       DateTime
  fechaFin          DateTime
  nivelImportancia  NivelImportancia @default(MEDIA)
  tipo              TipoNotificacion
  leidoPor          String   @default("") // Array de userIds separados por coma
  negociosDestino   String   @default("") // Array de negocioIds separados por coma
  usuariosDestino   String   @default("") // Array de userIds separados por coma
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

## Endpoints de la API

### Gestión de Notificaciones (Solo SUPER_ADMIN)

#### GET /api/notificaciones
Obtiene todas las notificaciones del sistema.

#### POST /api/notificaciones
Crea una nueva notificación.

**Body:**
```json
{
  "titulo": "Título de la notificación",
  "descripcion": "Descripción detallada",
  "fechaInicio": "2024-01-01T00:00:00Z",
  "fechaFin": "2024-01-07T23:59:59Z",
  "nivelImportancia": "MEDIA",
  "tipo": "NOTIFICACION",
  "negociosDestino": "id1,id2,id3",
  "usuariosDestino": "userId1,userId2"
}
```

#### GET /api/notificaciones/[id]
Obtiene una notificación específica por ID.

#### PUT /api/notificaciones/[id]
Actualiza una notificación existente.

#### DELETE /api/notificaciones/[id]
Elimina una notificación.

### Notificaciones para Usuarios

#### GET /api/notificaciones/activas
Obtiene las notificaciones activas para el usuario actual.

#### POST /api/notificaciones/[id]/marcar-leida
Marca una notificación como leída por el usuario actual.

### Estadísticas y Gestión

#### GET /api/notificaciones/stats
Obtiene estadísticas de notificaciones (solo SUPER_ADMIN).

#### POST /api/notificaciones/auto-check
Ejecuta verificaciones automáticas (solo SUPER_ADMIN).

**Body (opcional):**
```json
{
  "negocioId": "uuid-del-negocio" // Si no se envía, procesa todos los negocios
}
```

## Notificaciones Automáticas Mejoradas

El sistema ahora incluye una lógica avanzada para manejar notificaciones automáticas con validación, modificación y eliminación inteligente.

### Lógica de Validación

#### 1. Verificación de Existencia
- Busca notificaciones existentes por título y negocio
- Solo considera notificaciones vigentes (fechaFin >= ahora)

#### 2. Validación de Contenido
- Compara descripción, nivel de importancia y fechas
- Detecta cambios en el contenido de la notificación

#### 3. Acciones Automáticas

**Si la notificación NO existe:**
- Crea una nueva notificación automática

**Si la notificación existe y el contenido ha cambiado:**
- Actualiza la notificación existente
- **Marca como no leída por todos los usuarios** (leidoPor = "")

**Si la notificación ya no es válida:**
- Elimina la notificación automáticamente

### Tipos de Notificaciones Automáticas

#### 1. Expiración de Suscripciones
- **7 días antes**: Notificación MEDIA
- **3 días antes**: Notificación ALTA  
- **1 día antes**: Notificación CRITICA
- **Más de 7 días**: Elimina notificación si existe

#### 2. Límites de Productos
- **90% del límite**: Notificación MEDIA
- **95% del límite**: Notificación ALTA
- **Menos del 90%**: Elimina notificación si existe
- **Sin límite**: Elimina notificación si existe

#### 3. Límites de Usuarios
- **90% del límite**: Notificación MEDIA
- **95% del límite**: Notificación ALTA
- **Menos del 90%**: Elimina notificación si existe
- **Sin límite**: Elimina notificación si existe

## Prevención de Ejecuciones Múltiples

### Problema Identificado
Las verificaciones automáticas se ejecutaban múltiples veces debido a:
- **React Strict Mode** en desarrollo (ejecuta efectos dos veces)
- **Re-renders** del componente padre
- **Cambios en las dependencias** del useEffect

### Solución Implementada

#### 1. Hook Personalizado `useNotificationCheck`
```typescript
import { useNotificationCheck } from '@/hooks/useNotificationCheck';

// En el componente
useNotificationCheck({ 
  negocioId: user?.negocio?.id,
  checkInterval: 24 * 60 * 60 * 1000 // 24 horas
});
```

#### 2. Características del Hook
- **Ejecución única por sesión**: Usa `useRef` para evitar ejecuciones múltiples
- **Control por localStorage**: Verifica la última ejecución por negocio
- **Intervalo configurable**: Por defecto 24 horas, pero se puede personalizar
- **Manejo de errores**: No interrumpe la aplicación si falla

#### 3. Lógica de Control
```typescript
// Verifica si debe ejecutar la verificación
const lastCheckKey = `lastNotificationCheck_${negocioId}`;
const lastCheck = localStorage.getItem(lastCheckKey);
const now = new Date().getTime();
const shouldCheck = !lastCheck || (now - parseInt(lastCheck)) > checkInterval;

if (shouldCheck) {
  // Ejecuta verificación automática
  await NotificationApiService.runAutomaticChecks(negocioId);
  localStorage.setItem(lastCheckKey, now.toString());
}
```

#### 4. Beneficios
- ✅ **Previene ejecuciones múltiples** en la misma sesión
- ✅ **Control de frecuencia** por negocio
- ✅ **Persistencia** entre sesiones del navegador
- ✅ **Configuración flexible** de intervalos
- ✅ **Manejo robusto** de errores

## Servicios Mejorados

### NotificationService
Servicio para manejar notificaciones automáticas con lógica avanzada:

```typescript
// Crear notificación automática
await NotificationService.createAutomaticNotification({
  titulo: "Título",
  descripcion: "Descripción",
  fechaInicio: new Date(),
  fechaFin: new Date(),
  nivelImportancia: 'MEDIA',
  tipo: 'NOTIFICACION'
});

// Buscar notificación existente
const notificacion = await NotificationService.findExistingNotification(
  "Título de búsqueda", 
  "negocioId" // opcional
);

// Actualizar notificación (marca como no leída)
await NotificationService.updateNotification(notificationId, {
  descripcion: "Nueva descripción",
  nivelImportancia: 'ALTA'
});

// Eliminar notificación
await NotificationService.deleteNotification(notificationId);

// Ejecutar verificaciones automáticas
await NotificationService.runAutomaticChecks(); // Todos los negocios
await NotificationService.runAutomaticChecks("negocioId"); // Negocio específico
```

### NotificationApiService
Servicio para llamadas a la API desde el frontend:

```typescript
// Obtener notificaciones activas
const notificaciones = await NotificationApiService.getActiveNotifications();

// Marcar como leída
await NotificationApiService.markAsRead(notificationId);

// Crear notificación
await NotificationApiService.createNotification(notificationData);

// Ejecutar verificaciones automáticas
await NotificationApiService.runAutomaticChecks(); // Todos los negocios
await NotificationApiService.runAutomaticChecks("negocioId"); // Negocio específico
```

## Tipos TypeScript

```typescript
interface INotificacion {
  id: string;
  titulo: string;
  descripcion: string;
  fechaInicio: Date;
  fechaFin: Date;
  nivelImportancia: NivelImportancia;
  tipo: TipoNotificacion;
  leidoPor: string;
  negociosDestino: string;
  usuariosDestino: string;
  createdAt: Date;
  updatedAt: Date;
}

interface INotificacionConEstado extends INotificacion {
  yaLeida: boolean;
}
```

## Permisos

- **SUPER_ADMIN**: Acceso completo a todas las funcionalidades
- **Usuarios normales**: Solo pueden ver notificaciones activas y marcarlas como leídas

## Validaciones

### Creación/Actualización
- Título y descripción son obligatorios
- Fecha de inicio debe ser anterior a fecha de fin
- Tipo y nivel de importancia deben ser válidos

### Acceso
- Verificación de permisos de usuario
- Verificación de vigencia de notificación
- Verificación de destinatarios

### Lógica Automática
- Validación de contenido antes de actualizar
- Eliminación automática de notificaciones no válidas
- Marcado como no leída al modificar contenido

## Pruebas

### Scripts de Prueba
```bash
# Pruebas básicas
node scripts/test-notifications.js

# Pruebas completas
node scripts/test-notifications-complete.js

# Pruebas de lógica mejorada
node scripts/test-notifications-improved.js

# Pruebas de frecuencia (prevención de ejecuciones múltiples)
node scripts/test-notification-frequency.js
```

### Casos de Prueba Mejorados
1. **Creación**: Formulario completo y validaciones
2. **Edición**: Modificación de campos
3. **Eliminación**: Confirmación y eliminación
4. **Búsqueda**: Filtrado de resultados
5. **Marcado como leída**: Interacción del widget
6. **Responsive**: Adaptación móvil/desktop
7. **Validación automática**: Verificación de contenido
8. **Modificación automática**: Actualización y marcado como no leída
9. **Eliminación automática**: Eliminación de notificaciones no válidas
10. **Negocio específico**: Verificaciones para negocio individual
11. **Prevención de ejecuciones múltiples**: Control de frecuencia
12. **Persistencia**: Control entre sesiones del navegador

## Implementación en Frontend

### Componente de Notificaciones
```typescript
import { NotificationApiService } from '@/services/notificationApiService';
import { useNotificationCheck } from '@/hooks/useNotificationCheck';

const [notificaciones, setNotificaciones] = useState<INotificacionConEstado[]>([]);

// Hook para verificaciones automáticas
useNotificationCheck({ 
  negocioId: user?.negocio?.id,
  checkInterval: 24 * 60 * 60 * 1000 // 24 horas
});

useEffect(() => {
  const cargarNotificaciones = async () => {
    try {
      const data = await NotificationApiService.getActiveNotifications();
      setNotificaciones(data);
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    }
  };
  
  cargarNotificaciones();
}, []);
```

### Marcado como Leída
```typescript
const marcarComoLeida = async (id: string) => {
  try {
    await NotificationApiService.markAsRead(id);
    // Actualizar estado local
    setNotificaciones(prev => 
      prev.map(n => n.id === id ? { ...n, yaLeida: true } : n)
    );
  } catch (error) {
    console.error('Error al marcar como leída:', error);
  }
};
```

### Verificaciones Automáticas
```typescript
// Ejecutar para todos los negocios
await NotificationApiService.runAutomaticChecks();

// Ejecutar para negocio específico
await NotificationApiService.runAutomaticChecks("negocioId");
```

## Configuración de Cron Jobs

Para ejecutar verificaciones automáticas periódicamente, configurar un cron job:

```bash
# Ejecutar cada hora para todos los negocios
0 * * * * curl -X POST http://localhost:3000/api/notificaciones/auto-check

# Ejecutar cada 30 minutos para negocio específico
*/30 * * * * curl -X POST http://localhost:3000/api/notificaciones/auto-check -H "Content-Type: application/json" -d '{"negocioId":"uuid-del-negocio"}'
```

## Consideraciones de Seguridad

1. **Autenticación**: Todos los endpoints requieren autenticación
2. **Autorización**: Verificación de roles para endpoints administrativos
3. **Validación**: Validación de datos de entrada
4. **Sanitización**: Limpieza de datos antes de almacenar
5. **Logs**: Registro de todas las operaciones automáticas
6. **Control de frecuencia**: Prevención de ejecuciones múltiples

## Mantenimiento

### Limpieza de Notificaciones Expiradas
Considerar implementar un job para eliminar notificaciones muy antiguas:

```sql
DELETE FROM Notificacion 
WHERE fechaFin < NOW() - INTERVAL '30 days';
```

### Monitoreo
- Revisar logs de creación automática
- Monitorear estadísticas de lectura
- Verificar rendimiento de consultas
- Supervisar eliminaciones automáticas
- Controlar frecuencia de ejecuciones automáticas

## Futuras Mejoras

1. **Notificaciones push**: Integración con servicios de push notifications
2. **Plantillas**: Sistema de plantillas para notificaciones comunes
3. **Programación**: Programación de notificaciones futuras
4. **Categorías**: Categorización más granular de notificaciones
5. **Filtros**: Filtros avanzados para usuarios
6. **Exportación**: Exportación de estadísticas
7. **Webhooks**: Notificaciones a sistemas externos
8. **Notificaciones en tiempo real**: WebSockets para actualizaciones instantáneas
9. **Historial de cambios**: Tracking de modificaciones automáticas
10. **Configuración de umbrales**: Personalización de límites por negocio
11. **Dashboard de monitoreo**: Interfaz para supervisar ejecuciones automáticas
12. **Alertas de sistema**: Notificaciones sobre el estado del sistema de notificaciones
