# Respuestas listas para el chatbot — Movimientos

---

## “¿Para qué sirve Movimientos?”

**Respuesta sugerida:**  
“Es la pantalla donde ves el **historial de entradas y salidas** de mercancía de tu tienda, y donde puedes **registrar** cosas como compras, ajustes por roturas o inventario, envíos a otra sucursal y movimientos de consignación. Las **ventas del día** bajan el inventario cuando cobras en el **punto de venta**; aquí solo las ves en el historial, no las cargas como si fueran una compra.”

**Pregunta de diagnóstico:** “¿Querés **ver** qué pasó con el stock o **registrar** una compra o traspaso?”

---

## “No me deja crear el movimiento”

**Respuesta sugerida:**  
“Revisemos cuatro cosas rápidas: ¿tenés **tienda** elegida arriba? ¿Agregaste **productos** con cantidad mayor a cero? Si es **compra, recepción o consignación entrada**, ¿pusiste **costo** en cada línea? Si es **consignación**, ¿elegiste **proveedor**? Si es **envío a otra tienda**, ¿elegiste **destino**? Si todo eso está y sigue fallando, decime qué **tipo** de movimiento elegiste y si sale algún mensaje en rojo.”

---

## “Me llegó mercancía de otra tienda y no sé qué hacer”

**Respuesta sugerida:**  
“Entrá a **Movimientos** y mirá si aparece un **icono con aviso** (como un mensaje con número). Ahí están los productos **pendientes de recepcionar**. Abrí la lista, revisá cantidades y **costo** (no puede ir en cero), y confirmá. Si el envío está mal, podés **rechazar** la línea y escribir el motivo.”

---

## “No veo el tipo traspaso / consignación / ajuste”

**Respuesta sugerida:**  
“Cada tipo de movimiento tiene su **permiso**. Tu administrador puede haberte dejado solo compras, por ejemplo. Decile qué operación necesitás y que revise tu **rol** en movimientos.”

---

## “¿Cómo importo desde Excel?”

**Respuesta sugerida:**  
“Si ves el botón **Importar Excel**, el archivo tiene que traer en la primera fila exactamente estas columnas: **Categoría, Producto, Costo, Precio, Cantidad** y si querés, **Proveedor**. Los números tienen que estar bien en costo, precio y cantidad. Si no te aparece el botón, puede ser porque ya hay movimientos listados o tu tipo de usuario no lo usa; en ese caso cargá la compra con **Crear movimiento**.”

---

## Enlace “Ir a configuración de tiendas” que no abre

**Respuesta sugerida:**  
“En algunas pantallas el botón puede mandar a una dirección antigua. Andá manualmente a **Configuración → Locales** para crear o revisar sucursales.”

*(Interpretación documentada en otros temas de configuración; si el producto corrige el enlace, esta respuesta se puede acortar.)*

---

## Frases a evitar

- “MovimientoStock”, “API”, “batch”, “enum”.
- Decir “error de validación” sin decir **qué campo** revisar.
