# Mejora del Comportamiento del Escáner en POS

## Problemas Identificados

### 1. Escáner se Abría Automáticamente
Cuando se buscaba un producto manualmente desde el buscador y se agregaba al carrito, el escáner de códigos QR se abría automáticamente, causando una mala experiencia de usuario.

### 2. Conflicto de Foco con el Buscador
El escáner de hardware "robaba" el foco cuando el usuario intentaba escribir en el campo de búsqueda, debido al `onBlur` automático del componente `HardwareQrScanner`.

## Soluciones Implementadas

### Solución 1: Control Inteligente de Reapertura del Escáner

Se modificó la lógica para que el escáner solo se reabra automáticamente cuando el producto se agregó mediante **escaneo de cámara**.

**Cambios:**
1. **Nuevo Estado**: Se agregó `productOrigin` para rastrear el origen del producto seleccionado
2. **Función Mejorada**: Se reemplazó `reopenScanner()` por `reopenScannerIfNeeded()`
3. **Marcado de Origen**: Se estableció el origen en cada método de selección

### Solución 2: Manejo Inteligente del Foco

Se implementó un sistema para controlar cuándo el escáner debe mantener el foco y cuándo debe permitir que el buscador lo tome.

**Cambios:**
1. **Estado de Intención**: Se agregó `intentToSearch` para rastrear cuándo el usuario quiere buscar
2. **Eventos Mejorados**: Se agregaron manejadores para `onMouseDown`, `onBlur` mejorado, y manejo de clicks en resultados
3. **Control de `keepFocus`**: El escáner solo mantiene foco cuando `intentToSearch` es `false`

```typescript
// Nuevas funciones agregadas
const handleSearchMouseDown = () => {
  setIntentToSearch(true); // ANTES del evento de foco
};

const handleSearchBlur = () => {
  setTimeout(() => {
    setIntentToSearch(false);
    setShowSearchResults(false);
  }, 150); // Delay para permitir clicks en resultados
};
```

### Comportamiento Actual

| Acción del Usuario | Comportamiento del Foco |
|-------------------|------------------------|
| 🖱️ Click en buscador | ✅ Foco va al buscador (escáner no interfiere) |
| ⌨️ Escribir en buscador | ✅ Foco permanece en buscador |
| 🖱️ Click en resultado | ✅ Selecciona producto y foco regresa al escáner |
| ❌ Cerrar buscador | ✅ Foco regresa al escáner |
| 📷 Escanear con cámara | ✅ Después de agregar, reabre escáner |
| 🔍 Búsqueda manual | ❌ No reabre escáner |
| 🔫 Pistola/Hardware | ❌ No reabre escáner |

### Flujo de Funcionamiento del Foco

1. **Estado inicial**: Escáner tiene foco (`intentToSearch = false`)
2. **Usuario hace click/mousedown en buscador** → `setIntentToSearch(true)`
3. **Escáner pierde foco** → `keepFocus = false` (no roba foco)
4. **Usuario escribe/busca** → Foco permanece en buscador
5. **Usuario selecciona resultado o cierra** → `setIntentToSearch(false)`
6. **Escáner recupera foco** → `keepFocus = true` (vuelve a mantener foco)

## Beneficios

- ✅ **Mejor UX de búsqueda**: El buscador funciona sin interferencia del escáner
- ✅ **Flujo natural**: El escáner se reabre solo cuando es apropiado
- ✅ **Sin conflictos de foco**: Transiciones suaves entre buscador y escáner
- ✅ **Comportamiento intuitivo**: El usuario controla cuándo buscar vs escanear
- ✅ **Compatibilidad**: Funciona con búsqueda manual, escáner de cámara y pistola 