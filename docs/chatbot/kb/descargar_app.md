<!-- Consolidado para embeddings. Fuentes: seis archivos `descargar_app` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Descargar la app

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Requisito | Motivo |
|-----------|--------|
| **Teléfono Android** compatible | La página publica APK para Android. |
| **Espacio libre** suficiente | Los APK ocupan megabytes según versión. |
| **Permiso para instalar** desde el navegador o archivos | Política de seguridad de Android. |
| **Conexión estable** | Evita descargas truncadas. |

No hace falta estar **logueado** en la web para abrir esta página en el flujo típico (está entre rutas permitidas sin suscripción en el middleware).

## Guía paso a paso

*Flujo principal en la aplicación.*

1. Entrá a **Descargar** desde el menú (o el enlace que te pasen).
2. Leé la **versión** y el **changelog** (novedades y correcciones).
3. Elegí el **APK** que corresponda a tu teléfono (la página sugiere una arquitectura).
4. Pulsá **Descargar** y esperá a que termine el archivo.
5. Abrí el APK desde **Descargas** o **notificaciones** y seguí los pasos de instalación de Android.
6. Si algo falla, usá **Reintentar** en la misma página o volvé a abrir el enlace.

**Consejo:** anotá la versión instalada por si soporte te la pide al reportar un fallo.

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

- La descarga **no** depende de permisos internos tipo “POS” o “recuperaciones”.
- Si el menú **Descargar App** no aparece, puede ser por **rol personalizado del menú** o política del negocio; en el código base el ítem usa permiso comodín `*` (visible para muchos usuarios).

**Resumen para el bot:** “No veo descargar” → revisar menú / enlace directo; no es un permiso de operaciones de tienda.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Oops! No pudimos cargar la información de descarga…”

**Qué hacer:** Reintentar; revisar red; otro navegador.

---

## Descarga cortada o archivo corrupto

**Qué hacer:** Borrar el APK parcial, volver a descargar con buena señal Wi‑Fi.

---

## “App no instalada” o error del paquete

**Qué hacer:** Desinstalar versión previa incompatible si soporte lo indica; probar otra variante de arquitectura.

---

## Página en blanco

**Qué hacer:** Recargar; desactivar bloqueadores agresivos; probar en ventana privada.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

La página **Descargar** ofrece la **app Android** oficial (APK), versión y notas de la versión. Suele abrirse desde el menú **Descargar App** (acceso amplio en el layout).

---

## “Oops! No pudimos cargar la información de descarga”

**Qué es:** No se pudo obtener el archivo de versiones desde el servicio externo configurado.

**Qué hacer:** Pulsar **Reintentar**, comprobar **internet**, probar más tarde o pedir el enlace alternativo a **soporte**.

---

## No sé qué APK bajar (arm64, armeabi, etc.)

**Qué es:** Hay varias **arquitecturas** de procesador; la página intenta **detectar** la del dispositivo.

**Qué hacer:** Usar la opción que marque como recomendada; si falla la instalación, probá la variante **universal** si existe, o consultá con soporte el modelo exacto del teléfono.

---

## La instalación dice “origen desconocido”

**Qué es:** Android pide permitir **fuentes desconocidas** o confirmar el instalador.

**Qué hacer:** En ajustes del teléfono, permitir la instalación desde el **navegador o archivos** que usaste para abrir el APK (varía por marca).

---

## Quiero la app en iPhone

**Qué hacer:** Esta pantalla está orientada a **Android**; iOS depende de si el producto publica en App Store (consultar soporte o documentación comercial actual).

---

## “Volver al inicio” me lleva fuera

**Qué hacer:** Es normal: vuelve a la **página pública** de entrada; para la web logueada usá **Inicio** desde el menú tras iniciar sesión.

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Dónde bajo la app?”

**Respuesta sugerida:**  
“En el menú **Descargar App** de la web (página de descarga oficial). Ahí elegís el **APK** para Android según tu teléfono y seguís la instalación.”

---

## “Me dice Oops al abrir la página”

**Respuesta sugerida:**  
“Falló cargar la lista de versiones desde internet. Probá **Reintentar**, otra red o más tarde; si sigue, escribí a **soporte**.”

---

## “¿Hay para iPhone?”

**Respuesta sugerida:**  
“La página actual está pensada para **Android** (APK). Para **iPhone** consultá con soporte si hay versión en App Store o enlace oficial.”

---

## Frases a evitar

- “Google Drive file id”, “revalidate”.
