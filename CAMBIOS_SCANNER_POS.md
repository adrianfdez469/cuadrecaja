# Mejora del Comportamiento del Escáner en POS

## Problema Identificado

Cuando se buscaba un producto manualmente desde el buscador y se agregaba al carrito, el escáner de códigos QR se abría automáticamente, causando una mala experiencia de usuario.

## Solución Implementada

Se modificó la lógica para que el escáner solo se reabra automáticamente cuando el producto se agregó mediante **escaneo de cámara**, no por otros métodos.

### Cambios Realizados

1. **Nuevo Estado**: Se agregó `productOrigin` para rastrear el origen del producto seleccionado:
   ```typescript
   const [productOrigin, setProductOrigin] = useState<'camera' | 'search' | 'hardware' | null>(null);
   ```

2. **Función Mejorada**: Se reemplazó `reopenScanner()` por `reopenScannerIfNeeded()`:
   ```typescript
   const reopenScannerIfNeeded = () => {
     if (productOrigin === 'camera' && scannerRef.current) {
       setTimeout(() => {
         scannerRef.current?.openScanner();
       }, 100);
     }
     setProductOrigin(null);
   };
   ```

3. **Marcado de Origen**: Se estableció el origen en cada método de selección:
   - **Búsqueda manual**: `setProductOrigin('search')`
   - **Escaneo de cámara**: `setProductOrigin('camera')`
   - **Escaneo de hardware**: No se reabire el escáner

### Comportamiento Actual

| Método de Selección | ¿Se Reabre el Escáner? |
|-------------------|------------------------|
| 🔍 Búsqueda manual | ❌ No |
| 📷 Escaneo de cámara | ✅ Sí |
| 🔫 Pistola/Hardware | ❌ No |

### Flujo de Funcionamiento

1. **Usuario escanea con cámara** → `handleProductScan()` → `setProductOrigin('camera')`
2. **Se abre QuantityDialog** → Usuario selecciona cantidad
3. **Se confirma cantidad** → `handleConfirmQuantity()` → `onAddToCart={reopenScannerIfNeeded}`
4. **Solo si origen es 'camera'** → Se reabre el escáner automáticamente

## Beneficios

- ✅ Mejor experiencia de usuario al buscar manualmente
- ✅ Flujo natural para escaneo continuo con cámara
- ✅ No interrumpe el flujo de escaneo con pistola/hardware
- ✅ Comportamiento intuitivo y lógico 