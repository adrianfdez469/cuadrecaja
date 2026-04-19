# Análisis CPP (costo promedio) — problemas y soluciones

**CPP** en esta pantalla significa, en lenguaje corriente: **a cuánto te sale en promedio cada unidad** de un producto según las **entradas** donde se registró **costo** (compras, recepciones de traspaso y entradas de consignación). Sirve para **comparar** ese promedio con el **costo que tiene hoy** el producto en la tienda y ver si los datos son **confiables**.

---

## No veo el menú “Análisis de CPP”

**Qué suele pasar:** Falta el permiso de **recuperaciones / análisis CPP**.

**Qué hacer:** Pedir al administrador que active el acceso. Está en el mismo bloque de menú que inventario y otros resúmenes.

---

## “No hay tienda seleccionada”

**Qué hacer:** Elegir la **tienda actual** arriba; el análisis es solo de esa sucursal.

---

## “Productos analizados” sale en cero o muy pocos

**Causa principal documentada en el sistema:** el análisis toma **solo productos con existencia mayor que cero** en esa tienda. Si todo está en cero o casi, la lista será corta o vacía.

**Qué hacer:** Revisar **Inventario** y **Movimientos** (compras, recepciones) para entender el stock real.

---

## “Confiabilidad” baja o dice “insuficiente”

**Qué significa en la práctica:** Parte de las **entradas** que deberían traer costo (compras, recepciones, consignación entrada) **no tienen costo guardado** en el historial, o son datos viejos incompletos.

**Qué hacer:**

1. A partir de ahora, registrar **compras y recepciones** siempre con **costo** en **Movimientos**.
2. Si la pantalla muestra el aviso de **datos históricos** y el botón **Migrar datos**, habla con el **administrador** antes de ejecutar nada: es una acción que toca movimientos antiguos y conviene saber si vuestra empresa ya lo aprobó.

---

## La pestaña “Productos con desviación” está vacía y dice que todo está bien

**Qué puede ser:** No hay diferencias grandes entre el **último costo de compra** registrado y el **costo actual**, o los productos no superan los filtros de **confiabilidad mínima** que usa el sistema (por ejemplo, si hay poca información con costo, no entran en la lista de desviaciones).

**Qué hacer:** Revisar la pestaña **Confiabilidad de datos**; si ahí todo está verde, el mensaje de “excelente” es coherente.

---

## “Error al cargar análisis de CPP”

**Qué hacer:** Actualizar la página, comprobar internet, cerrar sesión. Si persiste, soporte.

---

## Errores al usar “Migrar datos”

**Mensajes posibles:** error al obtener **vista previa** o al **ejecutar** migración.

**Qué hacer:** No repetir a ciegas; anotar hora y contactar a soporte o quien administra el sistema. La migración no es algo que el personal de caja deba hacer sin instrucciones.

---

## Los números no coinciden con mi hoja manual

**Qué recordar:** El sistema usa **reglas internas** (qué movimientos entran al historial de CPP, qué entradas tienen costo, etc.). Pequeñas diferencias con Excel casero son normales si en el pasado faltaron costos en movimientos.

**Qué hacer:** Priorizar la pestaña de **confiabilidad**; mejorar datos futuros con compras/recepciones bien cargadas.
