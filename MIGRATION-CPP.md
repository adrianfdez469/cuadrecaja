# 📋 Migración de Datos Históricos CPP

## 🎯 Objetivo

Este documento describe el proceso para migrar datos históricos de movimientos de compra que no tienen campos de **Costo Promedio Ponderado (CPP)** calculados.

## 🔍 Problema

Cuando se implementó el sistema CPP, los movimientos existentes en la base de datos no tenían los siguientes campos:
- `costoUnitario`
- `costoTotal` 
- `costoAnterior`
- `costoNuevo`

Esto causa problemas en:
- ✅ **Análisis de CPP**: Productos aparecen con baja confiabilidad
- ✅ **Reportes**: Estadísticas incompletas
- ✅ **Detección de desviaciones**: Análisis menos preciso

## 🛠️ Solución

### 1. **Identificación Automática**
El sistema detecta automáticamente productos con datos históricos incompletos y muestra:
- Alerta informativa en la interfaz
- Porcentaje de confiabilidad por producto
- Botón para iniciar migración

### 2. **Migración Segura**
- **Vista previa**: Muestra qué se va a migrar antes de ejecutar
- **Marcado histórico**: Los movimientos se marcan con `costoUnitario = 0`
- **Preservación de datos**: No se pierden datos existentes
- **Rollback**: Proceso reversible si es necesario

### 3. **Validación Post-Migración**
- Verificación de datos procesados
- Actualización de estadísticas de confiabilidad
- Refresco automático de análisis

## 🚀 Proceso de Migración

### **Opción 1: Interfaz Web (Recomendada)**

1. **Acceder al análisis CPP**:
   ```
   Sistema → Análisis CPP
   ```

2. **Verificar alerta de datos históricos**:
   - Si aparece la alerta azul, hay datos para migrar
   - Clic en "Migrar Datos" para ver vista previa

3. **Ejecutar migración**:
   - Revisar la lista de movimientos a procesar
   - Clic en "Ejecutar Migración"
   - Esperar confirmación de éxito

### **Opción 2: Script de Línea de Comandos**

1. **Simular migración (recomendado)**:
   ```bash
   node scripts/migrate-cpp-production.js --tienda=TIENDA_ID --dry-run --verbose
   ```

2. **Ejecutar migración**:
   ```bash
   node scripts/migrate-cpp-production.js --tienda=TIENDA_ID --verbose
   ```

3. **Verificar resultados**:
   ```bash
   node scripts/migrate-cpp-production.js --tienda=TIENDA_ID --dry-run
   ```

## 📊 Qué Hace la Migración

### **Antes de la Migración**
```sql
-- Movimiento histórico sin CPP
{
  "costoUnitario": null,
  "costoTotal": null,
  "costoAnterior": null,
  "costoNuevo": null
}
```

### **Después de la Migración**
```sql
-- Movimiento marcado como histórico
{
  "costoUnitario": 0,        // Marcador de dato histórico
  "costoTotal": 0,           // Marcador de dato histórico
  "costoAnterior": 15.50,    // Costo actual del producto
  "costoNuevo": 15.50        // Costo actual del producto
}
```

## 🔒 Seguridad y Respaldos

### **Antes de Ejecutar en Producción**

1. **Backup de base de datos**:
   ```bash
   # Ejemplo con PostgreSQL
   pg_dump -h localhost -U usuario -d cuadre_caja > backup_pre_migracion.sql
   ```

2. **Verificar en desarrollo**:
   ```bash
   # Probar primero en ambiente de desarrollo
   node scripts/migrate-cpp-production.js --tienda=TEST_ID --dry-run
   ```

3. **Validar datos críticos**:
   ```sql
   -- Verificar movimientos sin CPP
   SELECT COUNT(*) FROM MovimientoStock 
   WHERE tipo = 'COMPRA' AND costoUnitario IS NULL;
   ```

### **Rollback (si es necesario)**

```sql
-- Revertir migración (marcar como NULL nuevamente)
UPDATE MovimientoStock 
SET costoUnitario = NULL, 
    costoTotal = NULL,
    costoAnterior = NULL,
    costoNuevo = NULL
WHERE costoUnitario = 0 AND tipo = 'COMPRA';
```

## 📈 Beneficios Post-Migración

### **Análisis Mejorado**
- ✅ **100% de confiabilidad** en productos procesados
- ✅ **Estadísticas completas** de compras históricas
- ✅ **Detección precisa** de desviaciones de costos

### **Reportes Consistentes**
- ✅ **Historial completo** de movimientos CPP
- ✅ **Análisis temporal** de evolución de costos
- ✅ **Comparativas** entre períodos

### **Interfaz Limpia**
- ✅ **Sin alertas** de datos históricos
- ✅ **Chips verdes** de confiabilidad
- ✅ **Análisis confiable** para toma de decisiones

## 🧪 Verificación Post-Migración

### **1. Verificar en Interfaz**
- Acceder a "Análisis CPP"
- Verificar que no aparezca alerta de datos históricos
- Revisar tab "Confiabilidad de Datos"
- Confirmar que productos muestran 100% confiabilidad

### **2. Verificar en Base de Datos**
```sql
-- No debe haber movimientos de compra con costoUnitario NULL
SELECT COUNT(*) FROM MovimientoStock 
WHERE tipo = 'COMPRA' AND costoUnitario IS NULL;
-- Resultado esperado: 0

-- Verificar movimientos marcados como históricos
SELECT COUNT(*) FROM MovimientoStock 
WHERE tipo = 'COMPRA' AND costoUnitario = 0;
-- Resultado: cantidad de movimientos migrados
```

### **3. Verificar Análisis CPP**
- Productos deben mostrar porcentaje de confiabilidad alto
- Análisis de desviaciones debe ser más preciso
- Reportes deben incluir todos los movimientos históricos

## 🆘 Troubleshooting

### **Error: "Tienda no encontrada"**
- Verificar que el ID de tienda sea correcto
- Confirmar que la tienda existe en la base de datos

### **Error: "No se pueden procesar movimientos"**
- Verificar permisos de base de datos
- Confirmar que no hay bloqueos en las tablas

### **Migración parcial**
- Revisar logs de error del script
- Ejecutar nuevamente la migración (es idempotente)
- Verificar integridad de datos

### **Rollback necesario**
- Ejecutar query de rollback SQL
- Verificar que los datos vuelvan al estado anterior
- Re-ejecutar migración si es necesario

## 📞 Soporte

Para problemas durante la migración:
1. **Revisar logs** del script o interfaz web
2. **Verificar estado** de la base de datos
3. **Contactar soporte** con detalles del error
4. **Proporcionar backup** para análisis si es necesario

---

> ⚠️ **Importante**: Siempre hacer backup antes de ejecutar en producción y probar primero en ambiente de desarrollo. 