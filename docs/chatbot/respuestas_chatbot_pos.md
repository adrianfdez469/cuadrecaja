# Respuestas listas para el chatbot — POS

---

## “¿Por qué no me aparecen productos para vender?”

**Respuesta sugerida:**  
“El POS solo muestra artículos con **precio de venta mayor a cero** y con **stock disponible** según las reglas del sistema (a veces un producto en **porciones** se muestra si el **pack padre** todavía tiene unidades). Revisá que estés en la **tienda** correcta, que el producto tenga **precio** en **Conformar precios** y que haya **existencia** en **Inventario** o por **movimientos**. Si tu usuario está **ligado a un proveedor**, puede que solo veas parte del catálogo.”

**Preguntas de diagnóstico:** “¿El mismo producto lo ve otro compañero?” · “¿El precio está en cero?”

---

## “¿Cómo vendo lo que viene de un pack o porciones?”

**Respuesta sugerida:**  
“Si el producto está configurado como **porción** de otro (por ejemplo cigarrillos sueltos de una caja), el POS usa el **stock del producto padre** para dejarte vender la porción. Si no aparece, casi siempre falta **stock del padre** o **precio** en la línea que estás vendiendo. Si necesitás el detalle exacto de tu catálogo, lo confirma un administrador en **Productos**.”

---

## “La venta quedó en el celular y no sube”

**Respuesta sugerida:**  
“Conectate a internet y usá la opción de **sincronizar ventas pendientes** en el POS. Si sale **stock** o **período**, anotá el mensaje completo y pasáselo a administración.”

---

## “No me deja cerrar la caja / sincronizar ventas”

**Respuesta sugerida:**  
“En **Cierre** a veces pide que las ventas del POS estén **sincronizadas** con el servidor. Volvé al POS, sincronizá, y reintentá el cierre.”

*(Detalle ampliado en la guía de Cierre cuando esté documentada.)*

---

## “Escaneo y no encuentra”

**Respuesta sugerida:**  
“Comprobá que el código sea del producto y de esta tienda. Si es un código **nuevo**, puede hacer falta el permiso de **asociar código** para enlazarlo a un producto ya existente; si no lo tenés, quien administre productos debe cargar el código.”

---

## Frases a evitar

- “createSell”, “Zustand”, “UUID”.
- Prometer que “siempre” sincroniza en X segundos (depende de la red).
