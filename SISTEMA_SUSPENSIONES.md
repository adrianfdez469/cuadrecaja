# Sistema de Suspensiones Automáticas

## Descripción General

El sistema de suspensiones automáticas maneja el vencimiento de suscripciones de negocios de manera inteligente, implementando un período de gracia y suspensiones automáticas para proteger el acceso al sistema.

## Características Principales

### 🚨 **Estados de Suscripción**

#### 1. **Activa**
- Suscripción vigente
- Acceso completo al sistema
- Días restantes > 0

#### 2. **Expirada (Período de Gracia)**
- Suscripción vencida pero en período de gracia
- Acceso limitado con advertencias
- Días restantes < 0 pero > -7

#### 3. **Suspendida**
- Suscripción vencida y fuera del período de gracia
- Acceso completamente bloqueado
- Días restantes < -7

### ⏰ **Período de Gracia**

- **Duración**: 7 días después del vencimiento
- **Propósito**: Dar tiempo al cliente para renovar
- **Comportamiento**: 
  - Muestra advertencias pero permite acceso
  - Crea notificaciones automáticas
  - No bloquea funcionalidades

### 🔒 **Suspensión Automática**

- **Trigger**: Después de 7 días de vencimiento
- **Acciones**:
  - Bloquea acceso al sistema
  - Deshabilita usuarios (excepto SUPER_ADMIN)
  - Crea notificación crítica
  - Redirige a página de suscripción expirada

## Arquitectura del Sistema

### Servicios Principales

#### 1. **SubscriptionService**
```typescript
// Verificar estado de suscripción
const status = await SubscriptionService.getSubscriptionStatus(negocioId);

// Suspender negocio
await SubscriptionService.suspendBusiness(negocioId);

// Reactivar negocio
await SubscriptionService.reactivateBusiness(negocioId, newLimitTime);

// Extender suscripción
await SubscriptionService.extendSubscription(negocioId, daysToAdd);

// Verificar suspensiones automáticas
await SubscriptionService.checkAndProcessSuspensions();
```

#### 2. **NotificationService** (Integrado)
- Crea notificaciones automáticas para cada estado
- Maneja actualizaciones y eliminaciones inteligentes
- Integra con el sistema de notificaciones existente

### Endpoints de la API

#### **Estado de Suscripción**
```http
GET /api/subscription/status/[negocioId]
```

**Respuesta:**
```json
{
  "isActive": true,
  "daysRemaining": 15,
  "isExpired": false,
  "isSuspended": false,
  "canRenew": false,
  "gracePeriodDays": 7
}
```

#### **Suspensión Manual**
```http
POST /api/subscription/suspend/[negocioId]
```

#### **Reactivación**
```http
POST /api/subscription/reactivate/[negocioId]
Body: { "daysToAdd": 30 }
```

#### **Extensión de Suscripción**
```http
POST /api/subscription/extend/[negocioId]
Body: { "daysToAdd": 15 }
```

#### **Suspensiones Automáticas**
```http
POST /api/subscription/auto-suspend
```

## Flujo de Suspensión Automática

### 1. **Verificación Diaria**
```bash
# Cron job recomendado
0 2 * * * curl -X POST http://localhost:3000/api/subscription/auto-suspend
```

### 2. **Proceso de Verificación**
```typescript
// 1. Buscar negocios expirados fuera del período de gracia
const expiredBusinesses = await prisma.negocio.findMany({
  where: {
    limitTime: { lt: gracePeriodDate }
  }
});

// 2. Suspender cada negocio
for (const negocio of expiredBusinesses) {
  await SubscriptionService.suspendBusiness(negocio.id);
}

// 3. Procesar notificaciones de período de gracia
const gracePeriodBusinesses = await prisma.negocio.findMany({
  where: {
    limitTime: {
      gte: gracePeriodDate,
      lt: now
    }
  }
});
```

### 3. **Acciones de Suspensión**
- ✅ Marcar negocio como suspendido
- ✅ Deshabilitar usuarios (excepto SUPER_ADMIN)
- ✅ Crear notificación crítica
- ✅ Bloquear acceso al sistema

## Componentes de Frontend

### 1. **SubscriptionWarning**
```typescript
import SubscriptionWarning from '@/components/SubscriptionWarning';

// En el dashboard
<SubscriptionWarning />
```

**Características:**
- Muestra advertencias según el estado
- Botones de renovación y soporte
- Colapsable para no molestar
- Integrado en el dashboard principal

### 2. **Página de Suscripción Expirada**
```typescript
// Ruta: /subscription-expired
// Se muestra cuando la cuenta está suspendida
```

**Características:**
- Explicación clara del estado
- Opciones de renovación
- Información de contacto
- Datos preservados

## Middleware de Verificación

### **subscriptionMiddleware**
```typescript
// Verifica estado en cada request
export async function subscriptionMiddleware(request: NextRequest) {
  // Verificar rutas protegidas
  // Obtener negocio del usuario
  // Verificar estado de suscripción
  // Redirigir si está suspendido
  // Permitir acceso con advertencias si está en gracia
}
```

**Rutas Protegidas:**
- `/dashboard`
- `/pos`
- `/ventas`
- `/inventario`
- `/movimientos`
- `/cierre`
- `/configuracion`

**Rutas Permitidas:**
- `/login`
- `/api/auth`
- `/api/subscription/status`
- `/api/notificaciones/activas`

## Notificaciones Automáticas

### **Tipos de Notificaciones**

#### 1. **Advertencia de Vencimiento**
- **Trigger**: 7, 3, 1 días antes
- **Tipo**: ALERTA
- **Importancia**: MEDIA → ALTA → CRITICA

#### 2. **Período de Gracia**
- **Trigger**: Después del vencimiento
- **Tipo**: ALERTA
- **Importancia**: ALTA
- **Contenido**: Días transcurridos desde vencimiento

#### 3. **Suspensión Automática**
- **Trigger**: Después de 7 días de vencimiento
- **Tipo**: ALERTA
- **Importancia**: CRITICA
- **Contenido**: Cuenta suspendida, acceso bloqueado

#### 4. **Reactivación**
- **Trigger**: Al reactivar cuenta
- **Tipo**: NOTIFICACION
- **Importancia**: MEDIA
- **Contenido**: Cuenta reactivada, acceso restaurado

## Configuración y Personalización

### **Período de Gracia**
```typescript
// En SubscriptionService
const gracePeriodDays = 7; // Configurable
```

### **Intervalos de Verificación**
```typescript
// En el hook useNotificationCheck
checkInterval: 24 * 60 * 60 * 1000 // 24 horas
```

### **Cron Jobs Recomendados**
```bash
# Verificación diaria de suspensiones
0 2 * * * curl -X POST http://localhost:3000/api/subscription/auto-suspend

# Verificación de notificaciones
0 3 * * * curl -X POST http://localhost:3000/api/notificaciones/auto-check

# Limpieza de notificaciones antiguas
0 4 * * 0 curl -X DELETE http://localhost:3000/api/notificaciones/cleanup
```

## Pruebas y Validación

### **Script de Pruebas**
```bash
node scripts/test-subscription-system.js
```

**Pruebas Incluidas:**
- ✅ Estado de suscripción
- ✅ Suspensión manual
- ✅ Reactivación
- ✅ Extensión de suscripción
- ✅ Suspensiones automáticas
- ✅ Diferentes estados
- ✅ Integración con notificaciones
- ✅ Flujo completo

### **Casos de Prueba**

#### 1. **Negocio Activo**
- Verificar acceso normal
- Sin advertencias
- Funcionalidades completas

#### 2. **Negocio en Período de Gracia**
- Mostrar advertencias
- Permitir acceso
- Notificaciones automáticas

#### 3. **Negocio Suspendido**
- Bloquear acceso
- Redirigir a página de expiración
- Notificación crítica

#### 4. **Reactivación**
- Restaurar acceso
- Actualizar fecha de vencimiento
- Notificación de reactivación

## Monitoreo y Logs

### **Logs Importantes**
```typescript
// Suspensiones automáticas
console.log(`Negocio ${negocioId} suspendido automáticamente`);

// Reactivaciones
console.log(`Negocio ${negocioId} reactivado`);

// Extensiones
console.log(`Suscripción extendida por ${daysToAdd} días`);

// Errores
console.error('Error al procesar suspensiones automáticas:', error);
```

### **Métricas a Monitorear**
- Total de negocios
- Negocios activos
- Negocios expirados
- Negocios suspendidos
- Negocios en período de gracia
- Tasa de renovación
- Tiempo promedio de reactivación

## Seguridad y Permisos

### **Control de Acceso**
- Solo SUPER_ADMIN puede suspender/reactivar
- Usuarios normales solo pueden ver su propio estado
- Middleware protege rutas sensibles

### **Validaciones**
- Verificación de negocio existente
- Validación de fechas
- Control de permisos por endpoint

## Integración con Sistemas Externos

### **Sistema de Pagos**
```typescript
// Hook para integración con pasarela de pagos
const handlePaymentSuccess = async (paymentData) => {
  await SubscriptionService.reactivateBusiness(
    paymentData.negocioId, 
    paymentData.newLimitTime
  );
};
```

### **Sistema de Soporte**
```typescript
// Integración con tickets de soporte
const createSupportTicket = async (negocioId, issue) => {
  // Crear ticket automático para suscripciones expiradas
};
```

## Mantenimiento y Limpieza

### **Limpieza de Datos**
```sql
-- Eliminar notificaciones muy antiguas
DELETE FROM Notificacion 
WHERE fechaFin < NOW() - INTERVAL '90 days';

-- Limpiar logs antiguos
DELETE FROM Logs 
WHERE createdAt < NOW() - INTERVAL '1 year';
```

### **Backup y Recuperación**
- Backup automático antes de suspensiones
- Procedimiento de recuperación de emergencia
- Rollback de suspensiones si es necesario

## Futuras Mejoras

### **Funcionalidades Planificadas**
1. **Sistema de Descuentos**: Descuentos por renovación temprana
2. **Planes de Pago**: Diferentes frecuencias de pago
3. **Notificaciones Push**: Alertas en tiempo real
4. **Dashboard de Suscripciones**: Interfaz de gestión avanzada
5. **Analytics**: Métricas detalladas de renovación
6. **Integración con CRM**: Seguimiento de clientes
7. **Sistema de Referidos**: Descuentos por referencias
8. **Pruebas Gratuitas**: Extensión automática para nuevos usuarios

### **Optimizaciones Técnicas**
1. **Cache de Estados**: Cachear estados de suscripción
2. **Batch Processing**: Procesamiento en lotes para grandes volúmenes
3. **Webhooks**: Notificaciones a sistemas externos
4. **API Rate Limiting**: Protección contra abuso
5. **Monitoring Avanzado**: Alertas automáticas de problemas

## Troubleshooting

### **Problemas Comunes**

#### 1. **Suspensiones No Ejecutadas**
- Verificar cron job
- Revisar logs del servidor
- Comprobar permisos de SUPER_ADMIN

#### 2. **Notificaciones No Creadas**
- Verificar NotificationService
- Comprobar configuración de base de datos
- Revisar permisos de escritura

#### 3. **Acceso Bloqueado Incorrectamente**
- Verificar middleware
- Comprobar estado de suscripción
- Revisar configuración de rutas

#### 4. **Reactivación Fallida**
- Verificar permisos de SUPER_ADMIN
- Comprobar datos de entrada
- Revisar logs de transacciones

### **Comandos de Diagnóstico**
```bash
# Verificar estado de suscripción
curl -X GET http://localhost:3000/api/subscription/status/[negocioId]

# Ejecutar suspensiones manualmente
curl -X POST http://localhost:3000/api/subscription/auto-suspend

# Verificar notificaciones
curl -X GET http://localhost:3000/api/notificaciones/activas

# Probar reactivación
curl -X POST http://localhost:3000/api/subscription/reactivate/[negocioId] \
  -H "Content-Type: application/json" \
  -d '{"daysToAdd": 30}'
```

## Conclusión

El sistema de suspensiones automáticas proporciona una gestión robusta y automática de las suscripciones vencidas, protegiendo el acceso al sistema mientras ofrece un período de gracia para la renovación. La integración con el sistema de notificaciones existente asegura una comunicación efectiva con los usuarios.

### **Beneficios Clave**
- ✅ **Protección Automática**: Suspensiones sin intervención manual
- ✅ **Período de Gracia**: Tiempo para renovación sin interrupciones
- ✅ **Comunicación Clara**: Notificaciones automáticas y específicas
- ✅ **Flexibilidad**: Configuración y personalización completa
- ✅ **Seguridad**: Control de acceso y permisos robustos
- ✅ **Monitoreo**: Logs y métricas detalladas
- ✅ **Escalabilidad**: Preparado para grandes volúmenes
