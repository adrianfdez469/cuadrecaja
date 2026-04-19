# Respuestas listas para el chatbot — Proveedores

---

## Pregunta: “¿Qué es eso de proveedores?”

**Respuesta sugerida:**  
“En la app hay dos cosas relacionadas: una es la **ficha de proveedores** del negocio, dentro de **Configuración**, donde guardáis nombre, teléfono y datos de contacto. La otra es la pantalla de **proveedores en consignación**, en el menú de resúmenes, donde veis **cuánto está liquidado**, **cuánto falta** y el detalle por proveedor. No son dos listas distintas: primero se dan de alta en Configuración y luego la parte de consignación muestra los números cuando hay movimientos.”

**Preguntas de diagnóstico:**  
“¿Querés dar de alta un proveedor nuevo o ver números de consignación?” · “¿Ya crearon proveedores en Configuración?”

---

## Pregunta: “No me aparecen proveedores en consignación”

**Respuesta sugerida:**  
“Revisemos dos cosas: primero, ¿ya diste de alta proveedores en **Configuración → Proveedores**? Si la lista está vacía ahí, la otra pantalla también puede quedar vacía. Si ya hay proveedores y aun así no ves datos, puede ser que **todavía no haya cierres o ventas** que alimenten la consignación en el sistema. ¿Ves el menú de consignación o directamente no te aparece la opción?”

**Preguntas de diagnóstico:**  
“¿Te falta el menú entero o ves la pantalla pero en cero?” · “¿Sos administrador o solo caja?”

---

## Pregunta: “No puedo liquidar”

**Respuesta sugerida:**  
“Liquidar es una acción aparte: hace falta un **permiso específico** que suele dar solo el administrador, además del permiso para ver la pantalla. Pedile a tu administrador que active la opción de **liquidar proveedores** en tu rol. Después cerrá sesión y volvé a entrar.”

**Preguntas de diagnóstico:**  
“¿Ves el botón Liquidar o no aparece?” · “¿Qué mensaje sale al pulsar?”

---

## Pregunta: “¿Para qué sirve usuario asociado?”

**Respuesta sugerida:**  
“Es **opcional**. Sirve para enlazar la ficha del proveedor con **una persona usuaria de tu misma empresa** si queréis dejar claro quién es el contacto interno. Si no lo necesitás, podés dejarlo vacío.”

---

## Pregunta: “Me dice que el nombre ya existe”

**Respuesta sugerida:**  
“El sistema no permite dos proveedores con el **mismo nombre** en el mismo negocio. Podés cambiar un poco el nombre o buscar el que ya estaba creado y editarlo en lugar de crear otro.”

---

## Frases que el bot debe evitar

- “API”, “endpoint”, “Prisma”, “JWT”.
- “Es el mismo modelo de datos” → mejor: “**es la misma lista de proveedores del negocio**”.

---

## Si el usuario mezcla con “compras” o “movimientos”

**Respuesta sugerida:**  
“La ficha de proveedores es el **dossier** del proveedor. Las **compras y movimientos** se tratan en otras pantallas; si me decís qué querés hacer (comprar mercancía, traspasar, etc.), te guío al menú correcto cuando tengamos esa guía cargada.”
