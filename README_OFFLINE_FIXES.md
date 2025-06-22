# Mejoras para Funcionamiento Offline - Cuadre de Caja

## Problema Identificado

La aplicación presentaba comportamientos problemáticos cuando perdía la conexión a internet:

- **Recarga automática**: Al minimizar el navegador o cambiar de ventana sin conexión, la aplicación se recargaba automáticamente
- **Redirecciones no deseadas**: El sistema redirigía al login cuando no había conexión
- **Pérdida de estado**: Los datos del POS se perdían al recargar la página
- **Experiencia de usuario deficiente**: No había indicadores claros del estado de conexión

## Causa Raíz

El problema se originaba en múltiples puntos:

1. **Validación de sesión agresiva**: El `Layout.tsx` tenía un `useEffect` que redirigía al login cada vez que `session` era `null`, incluso cuando estaba offline
2. **Redirecciones automáticas**: El `AppContext.tsx` redirigía automáticamente sin considerar el estado de conexión
3. **Falta de manejo de estado offline**: No había lógica para detectar y manejar el estado offline

## Soluciones Implementadas

### 1. Hook personalizado para estado de red (`useNetworkStatus`)

```typescript
// src/hooks/useNetworkStatus.ts
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastStatusChange, setLastStatusChange] = useState<Date | null>(null);
  // ... lógica inteligente con timeouts y verificaciones
};
```

**Características:**
- Detección inteligente de conexión con timeouts para evitar falsos positivos
- Estado `wasOffline` para evitar redirecciones inmediatas después de reconectar
- Tracking de `lastStatusChange` para mejor control de banners
- Verificación periódica cada 30 segundos
- Delay de 1 segundo antes de marcar como offline
- Período de gracia de 5 segundos después de reconectar (aumentado de 3)
- Helper `isRecentStatusChange` para determinar cambios recientes

### 2. Mejoras en Layout.tsx

**Antes:**
```typescript
useEffect(() => {
  if (session?.user.expiresAt && new Date() > new Date(session.user.expiresAt)) {
    signOut();
  }
  if(!session) {
    goToLogin(); // ❌ Siempre redirigía
  }
}, [session]);
```

**Después:**
```typescript
useEffect(() => {
  if (session?.user.expiresAt && new Date() > new Date(session.user.expiresAt)) {
    signOut();
  }
  
  // ✅ Solo redirigir si estamos online y no estuvimos offline recientemente
  if (!session && isOnline && !wasOffline) {
    goToLogin();
  }
}, [session, isOnline, wasOffline]);
```

### 3. Mejoras en AppContext.tsx

**Cambios realizados:**
- Solo redirigir después de autenticación si hay conexión
- Solo redirigir al login si hay conexión disponible

```typescript
// Solo redirigir si estamos online para evitar problemas offline
if (navigator.onLine) {
  router.push('/');
}
```

### 4. Indicadores visuales de estado mejorados

#### Banner de estado offline con funcionalidades avanzadas
- **Auto-ocultado**: Desaparece automáticamente después de 3 segundos
- **Closable**: Botón X para cerrar manualmente
- **No intrusivo**: Se posiciona debajo del AppBar sin interferir
- **Responsive**: Ancho máximo limitado y centrado
- **Inteligente**: No reaparece si fue cerrado manualmente hasta el próximo cambio de estado

```typescript
// Características del banner:
- Auto-hide después de 3 segundos
- Botón de cierre manual
- Reseteo de estado manual en cambios de red
- Animación suave con Collapse
- Posicionamiento optimizado
```

#### Indicador en POS
- Indicador visual fijo en la esquina superior derecha
- Estados: "🟢 Online" / "🔴 Offline"
- Colores: verde para online, naranja para offline

### 5. Mejoras en el POS para funcionamiento offline

#### Manejo inteligente de ventas
```typescript
// Intentar sincronizar con el backend si estamos online
if (isOnline) {
  try {
    const ventaDb = await createSell(/* ... */);
    markSynced(identifier, ventaDb.id);
    showMessage("Venta procesada y sincronizada", "success");
  } catch (syncError) {
    showMessage("Venta guardada localmente. Se sincronizará cuando haya conexión.", "warning");
  }
} else {
  showMessage("Venta guardada localmente. Se sincronizará cuando haya conexión.", "info");
}
```

#### Persistencia automática
- El store de ventas ya usa `zustand/persist`
- Los datos se guardan automáticamente en `localStorage`
- Las ventas offline se mantienen hasta sincronizar

### 6. Configuración PWA básica

#### Manifest.json
```json
{
  "name": "Cuadre de Caja",
  "short_name": "CuadreCaja",
  "display": "standalone",
  "start_url": "/",
  // ... configuración PWA
}
```

#### Meta tags en layout
```html
<meta name="theme-color" content="#1976d2" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="manifest" href="/manifest.json" />
```

## Beneficios Obtenidos

### ✅ Para el Usuario
- **No más recargas inesperadas**: La aplicación mantiene su estado cuando está offline
- **Continuidad de trabajo**: Puede seguir vendiendo sin conexión
- **Feedback claro y no intrusivo**: Banners que desaparecen automáticamente
- **Control total**: Puede cerrar banners manualmente si lo desea
- **Sincronización automática**: Los datos se sincronizan al recuperar conexión

### ✅ Para el Desarrollador
- **Código más robusto**: Manejo inteligente de estados de red
- **Debugging mejorado**: Logs claros del estado de sincronización
- **Mantenibilidad**: Hook reutilizable para estado de red
- **UX mejorada**: Banners no intrusivos con mejor experiencia
- **Escalabilidad**: Base sólida para más funciones offline

### ✅ Para el Negocio
- **Disponibilidad 24/7**: El POS funciona incluso sin internet
- **Prevención de pérdidas**: No se pierden ventas por problemas de conexión
- **Confiabilidad**: Sistema más estable y predecible
- **Experiencia profesional**: Comportamiento esperado en aplicaciones modernas
- **Interfaz limpia**: Sin elementos molestos que interfieran con el trabajo

## Flujo de Trabajo Offline

1. **Detección de pérdida de conexión**
   - Hook detecta el cambio de estado
   - Se muestra banner informativo (auto-oculta en 3s)
   - POS continúa funcionando normalmente

2. **Operación offline**
   - Ventas se guardan en localStorage
   - Inventario se actualiza localmente
   - Usuario recibe feedback apropiado

3. **Restauración de conexión**
   - Hook detecta reconexión
   - Banner muestra estado restaurado (auto-oculta en 3s)
   - Sincronización automática en background

4. **Sincronización**
   - Ventas pendientes se envían al servidor
   - Estados se actualizan correctamente
   - Usuario recibe confirmación

## Características del Banner Mejorado

### ✅ Auto-ocultado
- Desaparece automáticamente después de 3 segundos
- No interfiere con el flujo de trabajo del usuario
- Proporciona información sin ser intrusivo

### ✅ Closable
- Botón X para cierre manual
- Estado de cierre se mantiene hasta el próximo cambio de red
- Control total para el usuario

### ✅ Posicionamiento Inteligente
- Se posiciona debajo del AppBar (top: 64px)
- Ancho máximo limitado (600px) y centrado
- Márgenes laterales para mejor apariencia
- No interfiere con el contenido principal

### ✅ Animaciones Suaves
- Usa `Collapse` de Material-UI para transiciones suaves
- Entrada y salida animadas
- Experiencia visual pulida

## Testing

Para probar las mejoras:

1. **Simular pérdida de conexión**
   ```bash
   # En Chrome DevTools
   Network tab > Throttling > Offline
   ```

2. **Verificar comportamientos del banner**
   - Banner aparece al perder conexión
   - Se auto-oculta después de 3 segundos
   - Puede cerrarse manualmente con el botón X
   - No reaparece si fue cerrado manualmente
   - Reaparece en el próximo cambio de estado de red

3. **Verificar comportamientos generales**
   - Minimizar/maximizar ventana → No debe recargar
   - Realizar ventas offline → Deben guardarse localmente
   - Restaurar conexión → Debe sincronizar automáticamente

## Archivos Modificados

- `src/hooks/useNetworkStatus.ts` (mejorado)
- `src/components/OfflineBanner.tsx` (mejorado significativamente)
- `src/components/Layout.tsx`
- `src/context/AppContext.tsx`
- `src/app/pos/page.tsx`
- `src/app/layout.tsx`
- `public/manifest.json` (nuevo)

## Próximos Pasos Recomendados

1. **Service Worker**: Implementar para cache más avanzado
2. **Sincronización en background**: Para cuando la app no esté activa
3. **Conflicto de datos**: Manejo de conflictos al sincronizar
4. **Iconos PWA**: Agregar iconos reales para la aplicación
5. **Offline first**: Considerar arquitectura offline-first completa
6. **Banner personalizable**: Permitir configurar tiempo de auto-ocultado
7. **Sonidos de notificación**: Alertas audibles opcionales para cambios de estado

---

**Resultado:** La aplicación ahora funciona de manera confiable en modo offline, con banners informativos no intrusivos que se auto-ocultan y pueden cerrarse manualmente, proporcionando una experiencia de usuario profesional y pulida. 