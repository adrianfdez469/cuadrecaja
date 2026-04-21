<!-- Consolidado para embeddings. Fuentes: seis archivos `configuracion` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Configuración

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

Aquí “configuración” significa **dejar preparado el negocio en la aplicación**, no cables ni servidores.

---

## Antes de que el día a día funcione bien

| Qué configurar | Para qué sirve en la vida real | Si falta o está mal |
|----------------|--------------------------------|---------------------|
| **Locales (tiendas)** | Saber en qué sucursal se vende y se cuadra. | No se elige bien la tienda, reportes mezclados o no puede trabajar en la sucursal correcta. |
| **Categorías y productos** | Que en el punto de venta existan artículos vendibles. | No hay qué vender o aparecen datos viejos. |
| **Usuarios y roles** | Que cada persona vea solo lo que debe. | Gente sin acceso o con demasiado acceso; errores de “no puedo entrar”. |
| **Descuentos** | Aplicar ofertas con reglas claras. | Descuentos que no aplican o se aplican mal según lo definido. |
| **Proveedores (en configuración)** | Tener el maestro de proveedores del negocio ordenado. | Datos incompletos en compras o informes que usan ese dato. |
| **Destinos de transferencia** | Dejar listos los destinos que el negocio usa en sus traspasos. | No puede completar un traspaso o falta el destino en listas. |
| **Planes y suscripción** | Mantener el servicio activo según contrato. | Bloqueos de acceso para el negocio entero. |

---

## Quién debería hacer cada cosa

- **Dueño o administrador del negocio:** locales, productos, roles, usuarios, plan.
- **Encargado de tienda:** a veces solo consulta o edición limitada; depende del rol que le hayan puesto.
- **Personal de caja:** normalmente **no** configura productos ni roles; solo vende.

---

## Cómo corregir algo mal configurado

1. Identifica **qué parte del trabajo falla** (venta, inventario, cierre, etc.).
2. Vuelve a la tabla de arriba y entra a la pantalla de configuración relacionada.
3. Corrige el dato (nombre de tienda, precio, categoría, etc.) y guarda.
4. Pide a un compañero que **pruebe** la misma acción con su usuario por si era un tema de permisos.

---

## Lo que el usuario final NO puede arreglar desde la pantalla

- Dirección web del negocio mal puesta en el sistema (afecta enlaces de correo).
- Problemas de suscripción que requieren pago o contrato.
- Fallos masivos que afectan a todos los negocios a la vez.

En esos casos el mensaje del bot debe ser: **“te pondremos en contacto con soporte”** o **“habla con quien instaló Cuadre de Caja”**, según el acuerdo del cliente.

## Guía paso a paso

*Flujo principal en la aplicación.*

Esta guía describe **cómo se usa el menú de configuración** en condiciones normales. Los nombres pueden coincidir con lo que ves en pantalla (pueden variar ligeramente según versión).

---

## Abrir el área de configuración

1. Inicia sesión en la aplicación web.
2. Abre el **menú lateral** (icono de menú si estás en móvil o tablet).
3. Busca la sección **Configuración** y despliégala.
4. Deberías ver varias opciones (usuarios, roles, locales, productos, etc.).  
   - **Qué debería pasar:** Cada opción al pulsarla abre una pantalla de trabajo.  
   - **Si no ves opciones:** revisa el documento de permisos o “problemas y soluciones” de configuración.

---

## Gestionar personas que usan el sistema (usuarios)

1. Menú **Configuración → Usuarios**.
2. Desde ahí se suelen dar de alta personas, asignarles tienda y rol, o enviar invitaciones según lo que permita tu pantalla.
3. **Qué debería pasar:** La persona invitada recibe instrucciones por correo y puede activar su acceso.

---

## Definir qué puede hacer cada tipo de usuario (roles)

1. Menú **Configuración → Roles**.
2. Ahí se arman los “perfiles” (por ejemplo vendedor, encargado, administrador del negocio).
3. **Qué debería pasar:** Al asignar un rol a un usuario, sus menús y botones cambian según lo definido en ese rol.

---

## Gestionar tiendas o sucursales (locales)

1. Menú **Configuración → Locales**.
2. Aquí se registran las tiendas donde opera el negocio.
3. **Qué debería pasar:** En el punto de venta y en otros módulos podrás elegir la tienda correcta al trabajar.

---

## Productos y categorías

1. **Configuración → Categorías** para organizar el catálogo.
2. **Configuración → Productos** para crear o editar productos que luego verá el inventario y el POS.
3. **Qué debería pasar:** Los productos configurados aparecen al vender y en reportes según las reglas del negocio.

---

## Descuentos y proveedores (catálogo del negocio)

1. **Configuración → Descuentos** para reglas de descuento que aplican en operación.
2. **Configuración → Proveedores** para el catálogo de proveedores que usa el negocio en configuración (no confundir con otros informes de “proveedores” que puedan estar en otra parte del menú principal).

---

## Destinos de transferencia

1. Menú **Configuración → Destinos de transferencia**.
2. Sirve para dejar preparados los destinos que usarán movimientos o traspasos según cómo lo tenga montado tu negocio.

---

## Planes y suscripción del negocio

1. Menú **Configuración → Planes y suscripción** (o nombre muy similar).
2. Ahí suele verse información del plan y opciones de mejora o renovación según tu contrato.
3. **Qué debería pasar:** Puedes revisar límites o estado del servicio. Si algo no se puede pulsar o pide datos de pago, sigue las instrucciones en pantalla o contacta a comercial.

---

## Tareas solo para quien administra toda la plataforma

Si tu usuario es el **superadministrador** de la plataforma, verás entradas extra (por ejemplo negocios, planes generales, suspensiones, referidos, notificaciones del sistema).  
Un usuario normal de un negocio **no** debería ver ese bloque: si lo ves sin serlo, es situación excepcional y debe revisarla soporte interno.

---

## Plantillas de gastos

En el menú de configuración puede aparecer un acceso a **plantillas de gastos** que en realidad abre la sección de **Gastos** del sistema. Eso se documentará en el bloque “Gastos” cuando corresponda; aquí solo se nombra para que no busques esa función dentro de “Locales” o “Productos”.

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

## Idea simple

Los permisos son las **llaves** que abren cada parte del menú. Si no tienes la llave, la opción no aparece o la pantalla no te deja guardar.

---

## Superadministrador de la plataforma

- Ve **todo**, incluidas opciones que un negocio normal no debería ver: gestión de muchos negocios, suspensiones, planes generales, etc.
- Sirve para soporte entre negocios o dirección de la plataforma, no para el día a día de una sola tienda.

---

## Administrador del negocio (típico)

- Debería poder entrar a **usuarios, roles, locales, categorías, productos, descuentos, proveedores, destinos de transferencia** si su rol fue armado así.
- Es quien debe arreglar el 80 % de los “no puedo ver configuración” de los empleados.

---

## Vendedor o personal operativo

- Muchas veces **no** tiene entradas de configuración en el menú: es normal.
- Si necesita un cambio (precio, producto nuevo, usuario nuevo), debe pedírselo al administrador.

---

## Cómo saber si el problema es de permisos

**Señales:**

- Otros compañeros sí ven el menú “Configuración” y tú no.
- Ves el menú pero te falta una opción concreta (por ejemplo solo ves “Productos” pero no “Locales”).
- Entras a una pantalla y los botones de guardar no están o dicen que no tienes autorización.

**Qué hacer:**  
Un administrador abre **Configuración → Roles** (o **Usuarios**), revisa tu usuario y la tienda en la que estás, y te asigna el rol adecuado. Luego **cierras sesión y vuelves a entrar**.

---

## “Planes y suscripción”

En el menú lateral esta opción suele estar visible para cualquier persona con sesión iniciada; eso **no** significa que todos puedan contratar o pagar: solo que el acceso al menú es amplio. Lo que cada uno pueda hacer **dentro** de esa pantalla depende del diseño del producto y del negocio. Si algo sensible solo lo debe tocar el dueño, conviene **norma interna** del negocio, no solo la pantalla.

---

## Resumen para el bot

- “No veo X en configuración” → **rol y permisos**, pedir ayuda al administrador del negocio.
- “Soy el dueño y tampoco veo nada” → puede haber **un solo usuario mal asignado** o hace falta **usuario administrador de respaldo**; escalar a soporte si no hay nadie con acceso.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Usuario no encontrado” o contraseña incorrecta al entrar

**Qué ve el usuario:** Mensaje al iniciar sesión diciendo que el usuario no existe o que la clave no coincide.

**Qué hacer:** Revisar mayúsculas, espacios y teclado. Si sigue igual, pedir al administrador que confirme el usuario o use la opción de recuperar contraseña si está disponible.

---

## Mensaje de que la cuenta está pendiente de verificación

**Qué ve el usuario:** Texto que indica que debe completar la activación desde el correo.

**Qué hacer:** Buscar el correo de bienvenida o invitación (y la carpeta de spam). Pedir un **nuevo correo** si ya pasó mucho tiempo. Si el enlace “caducó”, hace falta una nueva invitación.

---

## Mensaje de suscripción vencida o no puede usar el sistema

**Qué ve el usuario:** No puede iniciar sesión o le indican que el servicio del negocio no está activo.

**Qué hacer:** Renovación o contacto comercial. No se arregla cambiando productos en configuración.

---

## Pantalla en blanco o vuelve al inicio de sesión al abrir configuración

**Qué ve el usuario:** Parece que “expulsa” o no carga la página.

**Posibles causas en lenguaje llano:** Sesión caducada, problema de conexión, o el navegador tiene datos viejos guardados.

**Qué hacer:**  
1. Cerrar sesión y entrar de nuevo.  
2. Probar otro navegador o ventana privada.  
3. Comprobar internet.  
4. Si pasa a todo el personal al mismo tiempo, avisar a soporte (puede ser algo del servidor o del dominio).

---

## “No tengo permiso” o botones grises

**Qué ve el usuario:** Ve la pantalla pero no puede guardar, o faltan botones.

**Qué hacer:** Un administrador del negocio debe ajustar el **rol** o los permisos del usuario para esa tarea concreta.

---

## Desde otra pantalla me lleva a configurar algo y no abre

**Qué ve el usuario:** Pulsó un enlace tipo “configurar tiendas” desde ventas o cierre y no obtiene la pantalla esperada.

**Qué hacer:** Ir manualmente a **Configuración → Locales**. Si eso funciona, el problema era solo la ruta del botón; el dato del negocio se gestiona igual desde Locales.

---

## Nota para quien redacta respuestas del bot

No digas “error del servidor” salvo que el usuario ya haya probado sesión, otro navegador y que otros compañeros fallen igual. Prioriza **permisos**, **sesión** y **enlaces del correo**.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

## No veo la sección “Configuración” o está vacía

**Cómo se nota:** En el menú lateral no aparece “Configuración”, o al abrirla casi no hay opciones.

**Qué suele pasar:** Tu usuario está pensado solo para vender o consultar, no para administrar el negocio. Quien administra el sistema debe darte permisos o un rol que incluya tareas de configuración.

**Qué hacer (paso a paso):**

1. Pregunta a la persona responsable del negocio (dueño o administrador) si tu usuario debería poder entrar a configuración.
2. Si la respuesta es sí, pídele que revise tu **rol** y los permisos asociados a tu usuario (o a la tienda en la que trabajas).
3. Cierra sesión y vuelve a entrar después de que te hayan hecho el cambio.
4. Si nadie del negocio puede administrar usuarios, hay que contactar a quien da soporte de la plataforma o al superadministrador acordado con tu empresa.

---

## Me mandan a “configurar tiendas” y la pantalla no carga o da error

**Cómo se nota:** Desde el punto de venta, ventas, movimientos o cierre pulsas un acceso para configurar tiendas y no ves lo esperado.

**Qué suele pasar (interpretación posible):** En algunas pantallas el acceso puede llevar a una dirección distinta a la que usa el menú principal. Lo habitual en la aplicación es gestionar las tiendas desde **Configuración → Locales**.

**Qué hacer:**

1. Abre el menú lateral.
2. Entra en **Configuración**.
3. Elige **Locales** (es donde se gestionan las tiendas del negocio).
4. Si aun así no puedes entrar, el problema es de permisos: quien administra debe darte acceso a “Locales” en configuración.

---

## No puedo entrar a la aplicación y antes sí podía

**Cómo se nota:** Al iniciar sesión aparece un mensaje sobre suscripción caducada o similar, o directamente no te deja pasar.

**Qué suele pasar:** El negocio puede tener el periodo de uso vencido o la cuenta del negocio suspendida por políticas comerciales.

**Qué hacer:**

1. Si el mensaje habla de **plan o suscripción**, entra con un usuario que sí pueda abrir la app y ve a **Configuración → Planes y suscripción** (si tienes acceso a la aplicación con otro usuario).
2. Renueva o contacta a quien lleva el contrato con Cuadre de Caja.
3. Si no entra nadie del negocio, escribe al soporte comercial o técnico que tengáis contratado con el dato del **nombre del negocio** y el **usuario** que falla.

---

## Los enlaces del correo (activar cuenta, invitación) no funcionan

**Cómo se nota:** El enlace abre una página en blanco, dice que el enlace no es válido o que expiró.

**Qué suele pasar:** El enlace es antiguo, se copió mal, o el negocio cambió de dirección web y el correo quedó con la dirección antigua.

**Qué hacer:**

1. Pide **un correo nuevo** de activación o invitación al administrador.
2. Abre el enlace desde el mismo dispositivo y navegador donde sueles trabajar; evita reenvíos que a veces cortan la dirección.
3. Si el problema es masivo (nadie del negocio recibe enlaces buenos), quien lleva la instalación del sistema debe revisar la dirección web oficial del negocio en el servidor; eso ya no lo resuelve el usuario desde la pantalla.

---

## Resumen para el bot

- “No veo configuración” → casi siempre **permisos o rol**.
- “Enlace a tiendas roto” → probar **Configuración → Locales**.
- “No deja iniciar sesión por suscripción” → **renovar / contacto comercial**.
- “Correo mal” → **nuevo enlace** y, si afecta a todos, **soporte de instalación**.

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

Tono: claro, sin tecnicismos, una sola cosa por mensaje cuando sea posible.

---

## Ejemplo 1: No ve configuración

**Usuario dice:** “No me aparece configuración en el menú.”

**Respuesta sugerida:**  
“Eso suele pasar cuando tu usuario está pensado solo para vender o consultar, no para administrar el negocio. La persona que administra Cuadre de Caja en tu empresa debe revisar tu rol y darte permiso para la parte de configuración que necesites. ¿Tienes a alguien con acceso de administrador a quien pueda avisar?”

**Preguntas de diagnóstico:**

- “¿A otros compañeros sí les sale Configuración?”
- “¿Tu trabajo debería incluir dar de alta productos o usuarios?”

---

## Ejemplo 2: Enlace a “tiendas” no funciona

**Usuario dice:** “Desde el POS me manda a configurar tiendas y no carga.”

**Respuesta sugerida:**  
“Prueba ir por el menú principal: **Configuración** y luego **Locales**. Ahí es donde normalmente se gestionan las tiendas. Si esa pantalla sí te abre, el problema era solo el atajo del botón. Si **Locales** tampoco te deja entrar, entonces tu usuario no tiene permiso y debe habilitarlo un administrador.”

**Preguntas de diagnóstico:**

- “¿Qué ves exactamente: página en blanco, mensaje de error o vuelve al inicio de sesión?”
- “¿Puedes entrar a Configuración → Locales manualmente?”

---

## Ejemplo 3: Suscripción o no deja entrar

**Usuario dice:** “Me dice que la suscripción venció y no puedo entrar.”

**Respuesta sugerida:**  
“Ese mensaje indica que el **servicio del negocio** no está activo por el plan o la fecha de contrato. No se soluciona cambiando productos. Hay que renovar o hablar con quien lleva el contrato con Cuadre de Caja. Si tenéis otro usuario administrador que aún pueda entrar, puede revisar **Planes y suscripción** dentro de la aplicación.”

**Preguntas de diagnóstico:**

- “¿Te pasa solo a ti o a todo el mundo del negocio?”
- “¿Os llegó algún aviso de renovación por correo?”

---

## Ejemplo 4: Correo de invitación

**Usuario dice:** “El enlace del correo no hace nada.”

**Respuesta sugerida:**  
“Los enlaces de activación caducan o a veces se rompen al reenviar. Pide a tu administrador que te envíe **una invitación nueva**. Ábrela desde el navegador que sueles usar y revisa también la carpeta de spam. Si nadie del negocio consigue enlaces buenos, hace falta que revisen la dirección web oficial del sistema quien lo instaló.”

---

## Ejemplo 5: No sabe qué configurar primero

**Usuario dice:** “Acabamos de empezar, ¿por dónde paso?”

**Respuesta sugerida:**  
“Lo usual es este orden: **Locales** (tiendas), **Categorías** y **Productos**, luego **Usuarios** y **Roles** para tu equipo. Después, si usáis descuentos o traspasos, **Descuentos** y **Destinos de transferencia**. Así el punto de venta ya tiene en qué apoyarse.”

---

## Frases que el bot debe evitar

- “Validación en servidor”, “token”, “middleware”, “endpoint”, “JWT”.
- Culpar al “sistema” sin decir **qué comprobar** (permisos, sesión, plan).

---

## Frases útiles para cerrar

- “Si tras cerrar sesión y volver a entrar sigue igual, pásame **qué opción del menú** tocabas y **qué mensaje exacto** sale en pantalla.”
- “Para ayudarte mejor: ¿eres administrador del negocio o usuario de caja?”
