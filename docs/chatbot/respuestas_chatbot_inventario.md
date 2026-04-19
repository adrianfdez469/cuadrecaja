# Respuestas listas para el chatbot — Inventario

---

## “¿Qué es la pantalla de Inventario?”

**Respuesta sugerida:**  
“Es donde ves **qué hay en la tienda**: cantidades, precio, costo, valor aproximado del stock y avisos de **caducidad**. Si hacés clic en un producto, ves el **historial de movimientos** de ese artículo. Para **entrar mercancía** o corregir cantidades se usa **Movimientos**; para **vender**, el **POS** baja el stock solo.”

**Pregunta de diagnóstico:** “¿Querés **consultar** cantidades o **cambiar** cuánto hay?”

---

## “No me deja poner la fecha de vencimiento”

**Respuesta sugerida:**  
“Guardar la fecha desde Inventario en muchos casos requiere también el permiso de **Conformar precios**, aunque solo toques la fecha. Pedile a tu administrador que te habilite esa opción o que actualice las fechas alguien que ya la tenga.”

**Pregunta de diagnóstico:** “¿Te sale algún mensaje de **no autorizado** o solo no hace nada?”

---

## “Exporto y dice que no hay productos con precio”

**Respuesta sugerida:**  
“La exportación solo lleva productos con **precio mayor a cero**. Revisá precios en **Conformar precios** o como lo haga tu negocio, y volvé a exportar.”

---

## “Veo menos productos que mi compañero”

**Respuesta sugerida:**  
“Compará si están en la **misma tienda** y sin el filtro de **alarma** (próximos a vencer). Si tu usuario está **asociado a un proveedor** en configuración, el sistema puede mostrarte solo la mercancía de ese proveedor. Si no es tu caso, pasame si usás filtro o no.”

---

## “Dice sin stock pero acabamos de comprar”

**Respuesta sugerida:**  
“Revisá que estés en la **misma sucursal** donde se registró la compra y mirá en **Movimientos** si la compra quedó cargada. Si no hay movimiento, el inventario no sube.”

---

## Frases a evitar

- “ProductoTienda”, “GET”, “omit precio”.
- Decir “bug” sin descartar **filtro**, **tienda** o **usuario proveedor**.
