# Análisis CPP — qué debe estar preparado el negocio

Para que el informe tenga sentido:

| Requisito | Por qué importa |
|-----------|-----------------|
| **Productos con stock** en la tienda | El análisis actual **no incluye** filas con existencia en cero. |
| **Compras y recepciones con costo** | Sin costo en la entrada, el movimiento cuenta como “sin CPP” y baja la **confiabilidad**. |
| **Movimientos correctos y fechas coherentes** | El historial de CPP usa tipos de **entrada** con costo: compra, recepción de traspaso y consignación entrada. |
| **Decisión interna sobre migración** | Si aparece el asistente de migración, el negocio debe saber **quién** lo ejecuta y **cuándo** (no es parte del día a día de venta). |

## Si el informe “no refleja la realidad”

1. Comparar con **Inventario** (existencias).
2. Revisar **Movimientos** de los productos dudosos: ¿faltó costo en alguna compra?
3. Mirar la pestaña **Confiabilidad de datos** para ver si el problema es **histórico** o de **carga actual**.

## Lo que esta pantalla no hace

- **No** cambia precios de venta.
- **No** sustituye al contador externo: es una **herramienta dentro de la app** basada en los datos cargados en movimientos.
