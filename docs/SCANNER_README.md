# 🚀 Quick Start - Escáner Optimizado

## Uso Inmediato

```tsx
import MobileQrScanner from '@/components/ProductProcessorData/MobileQrScanner';

function App() {
  return (
    <MobileQrScanner
      qrCodeSuccessCallback={(code) => console.log(code)}
      buttonLabel="Escanear"
    />
  );
}
```

## Características Principales

### 🔦 Linterna Automática
- Se muestra automáticamente si el dispositivo la soporta
- Toggle on/off con un clic

### ⚡ 3 Modos de Rendimiento
- **Rápido**: 5 FPS, 640x480 (dispositivos lentos)
- **Balanceado**: 10 FPS, 1280x720 (recomendado)
- **Alta Calidad**: 15 FPS, 1920x1080 (códigos pequeños)

### 📊 Estadísticas en Tiempo Real
- Intentos de escaneo
- Escaneos exitosos
- Tasa de éxito
- Sugerencias inteligentes

### 📱 17 Formatos Soportados
QR, EAN-13, CODE-128, UPC-A, y 13 más

## Documentación Completa

- **[FINAL_SUMMARY.md](./FINAL_SUMMARY.md)** - Resumen completo de todas las características
- **[ADVANCED_SCANNER_FEATURES.md](./ADVANCED_SCANNER_FEATURES.md)** - Guía de características avanzadas
- **[SCANNER_OPTIMIZATION.md](./SCANNER_OPTIMIZATION.md)** - Optimizaciones y troubleshooting
- **[SCANNER_CHANGES.md](./SCANNER_CHANGES.md)** - Cambios antes/después

## Acceso Local

```
https://localhost:3000
https://192.168.1.103:3000  (desde tu teléfono)
```

## Problemas Comunes

### Cámara no inicia
- ✅ Verifica que uses HTTPS
- ✅ Acepta el certificado de seguridad
- ✅ Permite permisos de cámara

### Rendimiento lento
- ✅ Cambia a preset "Rápido"
- ✅ Cierra otras apps que usen la cámara

### No lee códigos
- ✅ Usa la linterna en ambientes oscuros
- ✅ Mantén 10-15cm de distancia
- ✅ Centra el código en el rectángulo

## Soporte

Debug mode está activado. Revisa la consola del navegador para logs detallados.
