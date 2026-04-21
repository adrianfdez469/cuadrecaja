<!-- Consolidado para embeddings. Fuentes: seis archivos `proveedores` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Proveedores

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

## Antes de usar la pantalla de consignación

1. **Alta de proveedores** en Configuración → Proveedores, con nombre claro.
2. **Operación habitual** que genere información de consignación (productos vendidos en consignación, cierres de caja, etc.). Sin esos pasos operativos, la pantalla de consignación puede mostrar poco o nada aunque el catálogo esté bien.

## Datos recomendados en cada ficha

- **Nombre:** que todo el mundo en el negocio reconozca al proveedor.
- **Teléfono y dirección:** útiles para reclamos y pagos; no suelen ser obligatorios en el formulario, pero ayudan en el día a día.
- **Usuario asociado:** solo si vuestro procedimiento interno lo pide (por ejemplo, “el encargado de hablar con ese proveedor”); si no lo usáis, dejadlo vacío.

## Si lo hacéis mal

| Error típico | Consecuencia | Cómo corregirlo |
|--------------|----------------|-----------------|
| Nombres duplicados | No deja guardar o genera confusión al leer reportes. | Unificar criterio de nombres y editar duplicados. |
| Borrar un proveedor que aún se usa en informes | Puede romper referencias o historiales según política del sistema. | Evitar borrar si hay operaciones abiertas; en duda, pedir consejo al administrador antes de eliminar. |
| Liquidar sin haber pagado en la realidad | Los números de la app ya no coinciden con la caja real. | Solo liquidar cuando el pago esté acordado; si hubo error, coordinar con administración y soporte. |

## Lo que el usuario no configura desde aquí

- Cómo se marca un producto como “consignación” en inventario o en compras (eso pertenece a otros módulos; documentación pendiente si aplica a vuestro flujo).

## Guía paso a paso

*Flujo principal en la aplicación.*

## Parte 1: Dar de alta proveedores (ficha del negocio)

**Dónde:** Menú **Configuración** → **Proveedores**.

**Para qué sirve:** Tener registrados los proveedores con los que trabajáis (nombre, teléfono, dirección, notas). Opcionalmente podéis vincular a **una persona de usuario** de vuestra empresa si lo usáis como referencia interna.

**Pasos:**

1. Pulsa **Agregar proveedor** (o el botón equivalente en móvil).
2. Escribe el **nombre** (obligatorio).
3. Completa **descripción**, **teléfono** y **dirección** si queréis.
4. Si aplica, elegid **usuario asociado** de la lista; si no, podéis dejarlo vacío.
5. Guardad. Debería aparecer un mensaje de éxito y el proveedor en la lista.
6. Podéis **buscar** en el cuadro de búsqueda cuando la lista sea larga.
7. Para **cambiar datos**, pulsad sobre la fila o en editar según la vista.
8. Para **borrar**, usad eliminar; el sistema pedirá confirmación.

**Qué debería pasar en cada paso:** Tras guardar, el listado se actualiza. Si algo falla, suele salir un mensaje en rojo arriba o abajo de la pantalla.

---

## Parte 2: Seguimiento de consignación y liquidaciones

**Dónde:** En el menú principal, la entrada suele llamarse **Proveedores consignación** (o similar) y abre la pantalla de **Proveedores** con subtítulo sobre liquidaciones y consignación.

**Para qué sirve:**

- Ver **cuánto dinero** se ha liquidado ya y **cuánto falta** por liquidar.
- Ver **cuántos productos** están en consignación.
- Entrar al **detalle** de un proveedor para ver **liquidaciones** (por periodos de cierre) y la lista de **productos en consignación**.

**Pasos:**

1. Abrís **Proveedores** desde el menú de resúmenes/recuperaciones.
2. Revisáis las tarjetas resumen arriba (totales generales).
3. En la tabla, pulsáis **ver detalle** (icono de ojo o acción similar) en el proveedor que queráis.
4. En el detalle hay **pestañas**:
   - **Liquidaciones:** lista de cierres con importe y estado (pendiente o completada).
   - **Productos en consignación:** artículos, precio, vendidos, disponibles, etc.
5. Si una liquidación está **pendiente** y tenéis permiso, aparece el botón **Liquidar**. Al pulsarlo, el sistema pide confirmación; al confirmar, debería pasar a **completada** y refrescar los importes.

**Qué debería pasar:** Los importes “por liquidar” deberían bajar cuando se completan liquidaciones. Si los números no cuadran con lo que esperáis, hay que revisar con quien hace los **cierres** y cómo se cargaron los productos en consignación.

---

## Cómo explicarlo en una frase a un compañero

- **Configuración → Proveedores** = “**Quiénes son** nuestros proveedores y sus datos.”
- **Menú Proveedores (consignación)** = “**Cuánto debemos o hemos pagado** y **qué mercancía** está en consignación por cada uno.”

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

## Tres ideas que debe conocer soporte

1. **Ver y editar la ficha de proveedores** (Configuración → Proveedores) requiere permiso de **configuración de proveedores**.
2. **Entrar a la pantalla de consignación** del menú principal requiere permiso de **recuperaciones / proveedores en consignación** (acceso amplio a esa sección según la descripción interna del producto).
3. **Pulsar el botón “Liquidar”** en una liquidación pendiente depende de un permiso adicional de **liquidar proveedores**, descrito en el producto como parte de la configuración de proveedores aunque el botón aparezca en la pantalla de consignación.

## Cómo se nota cada falta de permiso

| Situación | Lo que ve el usuario |
|-----------|----------------------|
| Sin acceso a configuración de proveedores | No aparece “Proveedores” en Configuración, o al guardar sale no autorizado. |
| Sin acceso a consignación | No aparece “Proveedores consignación” en el menú de resúmenes. |
| Sin permiso de liquidar | Puede que el botón “Liquidar” no esté disponible o que falle al usarlo (según dispositivo o vista). |

## Superadministrador

Quien administra toda la plataforma conserva acceso completo a todo; no aplica la restricción anterior.

## Qué pedir al administrador del negocio

- “Necesito **dar de alta proveedores**” → permiso de configuración de proveedores.  
- “Necesito **ver cuadros de consignación**” → permiso de proveedores en consignación en recuperaciones.  
- “Necesito **cerrar liquidaciones**” → permiso de liquidar proveedores.

Tras cualquier cambio de rol, **cerrar sesión y volver a entrar** antes de probar otra vez.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

Los textos siguientes son los que el usuario puede ver o inferir; pueden cambiar ligeramente según versión.

---

## “El nombre es obligatorio”

**Qué significa:** Se intentó guardar sin rellenar el nombre del proveedor.

**Qué hacer:** Escribir el nombre y volver a guardar.

---

## “Ya existe un proveedor con ese nombre”

**Qué significa:** En vuestro negocio ya hay otro registro con ese mismo nombre.

**Qué hacer:** Cambiar el nombre (por ejemplo añadiendo ciudad o razón social) o editar el registro duplicado en lugar de crear uno nuevo.

---

## “El usuario seleccionado no existe o no pertenece al negocio”

**Qué significa:** En el campo opcional de “usuario asociado” se eligió alguien que no es válido para vuestro negocio.

**Qué hacer:** Elegir otro usuario de la lista o dejar el campo vacío.

---

## “Acceso no autorizado” o no podéis guardar / borrar

**Qué significa:** No tenéis permiso de administración de proveedores.

**Qué hacer:** Pedir al administrador el permiso de **acceder a proveedores en configuración**.

---

## “Error al cargar los proveedores” o “Error al guardar” genérico

**Qué puede ser:** Fallo de conexión, sesión caducada o problema temporal del servidor.

**Qué hacer:** Actualizar la página, cerrar sesión y entrar de nuevo. Si se repite, avisar a soporte con captura y hora.

---

## “¿Está seguro de que desea liquidar al proveedor?”

**Qué es:** Confirmación normal antes de cerrar una liquidación pendiente.

**Qué hacer:** Solo confirmar si el pago o el acuerdo con el proveedor ya está hecho en la vida real; es una acción contable importante.

---

## “Proveedor liquidado correctamente”

**Qué esperar:** La fila debería pasar a estado completado y los totales actualizarse al refrescar.

---

## “Error al liquidar el proveedor”

**Qué hacer:** Repetir tras actualizar. Si persiste, soporte revisará permisos y datos del cierre.

**Detalle:** a veces el botón “Liquidar” **se ve** en el ordenador aunque luego no deje completar la acción; en el móvil a veces sale **apagado**. En ambos casos lo habitual es pedir el **permiso de liquidar** en el rol y cerrar sesión.

---

## Lista vacía en consignación sin mensaje de error

**Qué puede ser:** No hay proveedores dados de alta, o no hay datos de consignación aún.

**Qué hacer:** Ver la guía “Parte 1 y Parte 2” en `guia_paso_a_paso_proveedores.md` (mismo contenido en el consolidado `kb/proveedores.md`, sección *Guía paso a paso*).

---

## “No se pudo encontrar el proveedor solicitado”

**Qué hacer:** Volver atrás y abrir el proveedor desde el listado actual; puede haberse eliminado o cambiado el enlace.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

En la aplicación hay **dos sitios distintos** con la palabra “proveedores”. No son dos listas diferentes: en la práctica el negocio tiene **una ficha de proveedores**; una pantalla sirve para **crear y editar datos** y la otra para **ver dinero y consignación** cuando aplica.

---

## No veo el menú “Proveedores consignación” (o “Proveedores” en resúmenes)

**Cómo identificarlo:** En el menú principal, dentro del bloque de resúmenes o recuperaciones, no aparece la opción.

**Qué suele pasar:** Tu usuario no tiene permiso para esa sección.

**Solución paso a paso:**

1. Confirma con tu administrador que tu trabajo deba incluir **seguimiento de proveedores en consignación**.
2. Pide que revisen tu **rol** y activen el permiso correspondiente a “recuperaciones / proveedores consignación” (el nombre exacto en pantalla de roles puede variar).
3. Cierra sesión y vuelve a entrar.

---

## No veo “Proveedores” dentro de Configuración

**Qué suele pasar:** Mismo caso: falta permiso de **configuración de proveedores**.

**Solución:** Un administrador debe darte acceso a **Configuración → Proveedores** desde los roles.

---

## En “Proveedores” (consignación) la lista sale vacía o todo en cero

**Cómo identificarlo:** Entras a la pantalla de gestión de consignación y no hay filas, o los totales son cero.

**Posibles causas:**

1. **Aún no se dieron de alta proveedores** en Configuración → Proveedores.
2. **No hay movimientos de consignación** registrados para esos proveedores (por ejemplo, sin cierres o sin productos ligados a consignación según cómo trabaje tu negocio).

**Solución:**

1. Primero revisa **Configuración → Proveedores** y crea al menos el proveedor con nombre y datos de contacto.
2. Si los proveedores ya existen pero la otra pantalla sigue vacía, el tema ya no es “el catálogo”, sino **que no haya operaciones de consignación** que alimenten los totales. Ahí debe intervenir quien lleva el **cierre de caja** o la operación diaria, según el procedimiento del negocio.

---

## No me deja guardar un proveedor nuevo

**Señales:** Mensaje de que falta el nombre, o que ya existe otro con el mismo nombre, o algo sobre el usuario elegido.

**Soluciones:**

- **Falta el nombre:** es obligatorio; escribe al menos el nombre comercial del proveedor.
- **“Ya existe con ese nombre”:** cambia el nombre o edita el proveedor que ya estaba creado.
- **Usuario no válido:** si elegiste una “persona de la empresa” vinculada al proveedor, debe ser alguien **del mismo negocio**. Si no estás seguro, deja ese campo vacío (es opcional).

---

## Veo liquidaciones “pendientes” pero no puedo pulsar “Liquidar” o no hace nada

**Qué suele pasar:** Tu rol **no incluye** la acción de registrar liquidaciones a proveedores. En la aplicación, ese permiso está ligado a la **configuración de proveedores (liquidar)**, aunque el botón esté en la pantalla de consignación.

**Solución:** Pide al administrador que añada a tu rol el permiso de **liquidar proveedores** (o que liquide él las pendientes).

**Nota:** Si ves el botón pero al usarlo falla, anota el mensaje exacto y la hora; puede ser fallo puntual o permiso que no se aplicó hasta cerrar sesión.

---

## Me dice “proveedor no encontrado” al abrir un detalle

**Qué suele pasar:** Enlace viejo, proveedor borrado, o estás en otro negocio/tienda de contexto.

**Solución:** Vuelve al listado general de proveedores en consignación y entra de nuevo desde la lista actual.

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

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
