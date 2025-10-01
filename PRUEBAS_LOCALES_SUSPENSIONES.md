# Pruebas Locales del Sistema de Suspensiones

## 🧪 **Métodos de Prueba Local**

### **1. Comandos Directos (Más Rápido)**

#### **Verificar Estado del Sistema**
```bash
curl -X POST http://localhost:3000/api/subscription/auto-suspend
```

#### **Verificar Notificaciones**
```bash
curl -X GET http://localhost:3000/api/notificaciones/activas
```

#### **Ejecutar Verificaciones de Notificaciones**
```bash
curl -X POST http://localhost:3000/api/notificaciones/auto-check
```

### **2. Scripts Automatizados**

#### **Script de Pruebas Rápidas**
```bash
./scripts/quick-test-suspensions.sh
```

**Características:**
- ✅ Verificación de suspensiones automáticas
- ✅ Estado del sistema
- ✅ Notificaciones activas
- ✅ Verificación de notificaciones
- ✅ Múltiples ejecuciones

#### **Script de Pruebas Complejas**
```bash
node scripts/test-local-suspensions.js
```

**Características:**
- ✅ Pruebas detalladas
- ✅ Manejo de errores
- ✅ Estadísticas completas
- ✅ Monitoreo en tiempo real (opcional)

#### **Simulación de Cron Job**
```bash
./scripts/simulate-cron-local.sh
```

**Características:**
- ✅ Ejecución cada 30 segundos
- ✅ Máximo 10 iteraciones
- ✅ Estadísticas en tiempo real
- ✅ Simula comportamiento de cron job

### **3. Monitoreo en Tiempo Real**
```bash
node scripts/test-local-suspensions.js --monitor
```

**Características:**
- ✅ Ejecución cada 5 segundos
- ✅ Duración: 1 minuto
- ✅ Estadísticas continuas
- ✅ Detección automática de cambios

## 📊 **Interpretación de Resultados**

### **Estadísticas del Sistema**
```json
{
  "stats": {
    "total": 4,        // Total de negocios
    "active": 3,       // Negocios con suscripción activa
    "expired": 1,      // Negocios expirados
    "suspended": 0,    // Negocios suspendidos
    "gracePeriod": 1   // Negocios en período de gracia
  }
}
```

### **Estados Posibles**

| Estado | Descripción | Acciones |
|--------|-------------|----------|
| **Activo** | Suscripción vigente | Ninguna |
| **Expirado** | En período de gracia | Advertencias |
| **Suspendido** | Fuera del período de gracia | Bloqueo total |

## 🔧 **Configuración para Pruebas**

### **Modificar Intervalos de Prueba**

#### **En `simulate-cron-local.sh`**
```bash
INTERVAL_SECONDS=30  # Cambiar a 60 para pruebas más lentas
MAX_ITERATIONS=10    # Cambiar a 5 para pruebas más cortas
```

#### **En `test-local-suspensions.js`**
```javascript
// Monitoreo en tiempo real
}, 5000); // Cambiar a 10000 para cada 10 segundos
```

### **Modificar Período de Gracia**

#### **En `src/services/subscriptionService.ts`**
```typescript
const gracePeriodDays = 7; // Cambiar a 3 para pruebas más rápidas
```

## 🚀 **Flujo de Pruebas Recomendado**

### **1. Prueba Inicial**
```bash
# Verificar que el sistema funciona
curl -X POST http://localhost:3000/api/subscription/auto-suspend
```

### **2. Pruebas Básicas**
```bash
# Ejecutar script de pruebas rápidas
./scripts/quick-test-suspensions.sh
```

### **3. Pruebas Detalladas**
```bash
# Ejecutar pruebas completas
node scripts/test-local-suspensions.js
```

### **4. Simulación de Cron Job**
```bash
# Simular ejecución automática
./scripts/simulate-cron-local.sh
```

### **5. Monitoreo Continuo**
```bash
# Monitorear en tiempo real
node scripts/test-local-suspensions.js --monitor
```

## 🐛 **Troubleshooting Local**

### **Problemas Comunes**

#### **1. Error de Autenticación**
```
{"error":"Usuario no autenticado"}
```
**Solución:** Algunos endpoints requieren autenticación. Los endpoints de suspensiones automáticas funcionan sin autenticación.

#### **2. Error de Acceso Denegado**
```
{"error":"Acceso denegado"}
```
**Solución:** Verificar que tienes permisos de SUPER_ADMIN para ciertos endpoints.

#### **3. Servidor No Responde**
```
curl: (7) Failed to connect to localhost port 3000
```
**Solución:** Verificar que el servidor esté ejecutándose en `localhost:3000`.

### **Comandos de Diagnóstico**

#### **Verificar Estado del Servidor**
```bash
# Verificar si el servidor responde
curl -I http://localhost:3000

# Verificar endpoints específicos
curl -I http://localhost:3000/api/subscription/auto-suspend
```

#### **Verificar Logs del Servidor**
```bash
# En la terminal donde ejecutas el servidor
# Buscar logs relacionados con suspensiones
grep -i "suspension" logs/server.log
```

## 📈 **Métricas de Prueba**

### **Qué Monitorear**

#### **1. Rendimiento**
- Tiempo de respuesta de endpoints
- Número de negocios procesados
- Errores por iteración

#### **2. Funcionalidad**
- Negocios suspendidos correctamente
- Notificaciones creadas
- Estados actualizados

#### **3. Consistencia**
- Resultados consistentes entre ejecuciones
- No duplicación de acciones
- Integridad de datos

### **Ejemplo de Salida Exitosa**
```
🚀 Iniciando Pruebas Locales del Sistema de Suspensiones

📊 1. Estado actual del sistema:
   ✅ Estadísticas obtenidas:
      - Total de negocios: 4
      - Negocios activos: 3
      - Negocios expirados: 1
      - Negocios suspendidos: 0
      - En período de gracia: 1
      - Timestamp: 2025-08-25T18:48:57.914Z

✅ Pruebas locales completadas exitosamente
```

## 🎯 **Casos de Prueba Específicos**

### **1. Negocio Activo**
- Verificar que no se suspenda
- Verificar que no se creen notificaciones de expiración

### **2. Negocio en Período de Gracia**
- Verificar que se creen notificaciones de advertencia
- Verificar que no se suspenda automáticamente

### **3. Negocio Fuera del Período de Gracia**
- Verificar que se suspenda automáticamente
- Verificar que se creen notificaciones críticas

### **4. Múltiples Ejecuciones**
- Verificar que no se dupliquen acciones
- Verificar consistencia de resultados

## 🔄 **Integración con Desarrollo**

### **Durante el Desarrollo**
```bash
# Ejecutar en paralelo con el servidor
npm run dev &
./scripts/simulate-cron-local.sh
```

### **Antes de Commits**
```bash
# Verificar que todo funciona
./scripts/quick-test-suspensions.sh
```

### **En Pull Requests**
```bash
# Pruebas completas
node scripts/test-local-suspensions.js
```

## 📝 **Logs y Debugging**

### **Habilitar Logs Detallados**

#### **En el Servidor**
```typescript
// En src/services/subscriptionService.ts
console.log(`Procesando negocio: ${negocio.id}`);
console.log(`Estado: ${status.isSuspended ? 'Suspendido' : 'Activo'}`);
```

#### **En los Scripts**
```bash
# Habilitar debug en curl
curl -v -X POST http://localhost:3000/api/subscription/auto-suspend
```

### **Filtrar Logs**
```bash
# Filtrar logs de suspensiones
tail -f logs/server.log | grep -i "suspension"

# Filtrar logs de notificaciones
tail -f logs/server.log | grep -i "notification"
```

## 🚀 **Próximos Pasos**

### **1. Configurar Cron Job Real**
```bash
# Agregar al crontab
crontab -e

# Agregar línea:
0 2 * * * curl -X POST http://localhost:3000/api/subscription/auto-suspend
```

### **2. Configurar Monitoreo**
- Alertas por email cuando hay suspensiones
- Dashboard de métricas
- Logs centralizados

### **3. Automatizar Pruebas**
- Integrar con CI/CD
- Pruebas automáticas en cada deploy
- Reportes de cobertura

## 💡 **Tips y Trucos**

### **1. Pruebas Rápidas**
```bash
# Ejecutar solo una vez
curl -s -X POST http://localhost:3000/api/subscription/auto-suspend | jq '.stats'
```

### **2. Monitoreo Continuo**
```bash
# Usar watch para monitoreo simple
watch -n 30 'curl -s -X POST http://localhost:3000/api/subscription/auto-suspend | jq ".stats"'
```

### **3. Debugging Avanzado**
```bash
# Verificar todos los endpoints
for endpoint in auto-suspend notificaciones/activas notificaciones/auto-check; do
  echo "Probando $endpoint..."
  curl -s -X POST http://localhost:3000/api/$endpoint
done
```

### **4. Comparar Estados**
```bash
# Comparar estado antes y después
echo "Antes:"; curl -s -X POST http://localhost:3000/api/subscription/auto-suspend | jq '.stats'
sleep 5
echo "Después:"; curl -s -X POST http://localhost:3000/api/subscription/auto-suspend | jq '.stats'
```



