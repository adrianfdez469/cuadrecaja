# Análisis CPP — guía paso a paso

## Dónde está

- Menú principal, sección de **resúmenes / recuperaciones** → **Análisis de CPP** (la ruta interna puede llamarse “cpp-analysis”).
- Título de la pantalla: **Análisis de Costo Promedio Ponderado**.

## Antes de empezar

1. Tené **tienda actual** seleccionada: todo el informe es de esa sucursal.
2. Entrá al menú solo si tu rol tiene permiso (si no lo ves, pedilo).

---

## Qué muestra la parte de arriba (resumen)

- **Productos analizados:** cantidad de artículos con **stock mayor que cero** que entran en el cálculo.
- **Valor total inventario:** suma aproximada del valor del stock según costo actual × existencia.
- **Productos con desviación:** cuántos aparecen en la pestaña de desviaciones (según reglas del sistema).
- **Confiabilidad promedio:** indicador global de qué tan completos están los costos en el historial de entradas.

---

## Pestaña “Análisis general”

Tabla por producto con, entre otros:

- **Existencia** y **costo actual** en tienda.
- **Promedio cambios en costo:** referencia calculada a partir de entradas **con costo bien registrado**.
- **Valor inventario.**
- **Último movimiento que cambió costo** (fecha de la última compra válida con datos, o “N/A”).
- **Confiabilidad** en porcentaje con color (verde / amarillo / rojo según umbrales de la pantalla).

**Qué hacer aquí:** buscar productos con confiabilidad baja y revisar después en **Movimientos** si las compras tenían costo.

---

## Pestaña “Productos con desviación”

Lista artículos donde el sistema detecta **diferencia relevante** entre el **costo actual** y el **último costo unitario** de una entrada válida, **solo** si hay bastante información confiable (por reglas internas de la pantalla).

Si no hay filas, verás un mensaje tipo **“excelente, no hay desviaciones significativas”**.

---

## Pestaña “Confiabilidad de datos”

- Tarjetas con productos de datos **completos**, **parciales** o **insuficientes**.
- Tabla con **compras con CPP** vs **compras sin CPP** (entradas que cuentan para el análisis vs entradas sin costo guardado).
- Barra de progreso y etiqueta **Completo / Parcial / Insuficiente**.

**Uso:** identificar qué productos necesitan que, de ahora en adelante, las **entradas** se carguen siempre con **costo**.

---

## Aviso “Datos históricos detectados” y botón “Migrar datos”

1. Si aparece, significa que hay productos con **movimientos viejos sin costo** que pueden ensuciar el análisis.
2. **Migrar datos** primero abre una **vista previa** (simulación) con detalle.
3. Solo si tu negocio lo autoriza, alguien con responsabilidad pulsa **Ejecutar migración** para que el sistema intente **alinear** esos registros.

**Importante:** no es un paso rutinario de caja diaria; coordinación con administración o soporte.

---

## Relación con el trabajo diario

| Para… | Usar principalmente |
|--------|----------------------|
| Subir stock y costo | **Movimientos** (compra, recepción, consignación entrada) |
| Ver cantidades | **Inventario** |
| Entender si el costo es confiable | **Análisis CPP** (esta pantalla) |
