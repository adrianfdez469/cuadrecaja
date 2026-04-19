# Respuestas listas para el chatbot — Configuración

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
