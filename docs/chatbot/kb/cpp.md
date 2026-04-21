<!-- Consolidado para embeddings. Fuentes: seis archivos `cpp` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# CPP (análisis)

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

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

## Guía paso a paso

*Flujo principal en la aplicación.*

## Dónde está

- Menú principal, sección de **resúmenes / recuperaciones** → **Análisis de CPP** (la ruta interna puede llamarse “cpp-analysis”).
- Título de la pantalla: **Análisis de Costo Promedio Ponderado**.

## Antes de empezar

1. Tené **tienda actual** seleccionada: todo el informe es de esa sucursal.
2. Entrá al menú solo si tu rol tiene permiso (si no lo ves, pedilo).

---

## Qué muestra la parte de arriba (resumen)

- **Productos analizados:** cantidad de artículos con **stock mayor que cero** que entran en el cálculo.
- **Valor total inventario:** suma aproximada del valor del stock según costo actual × existencia.
- **Productos con desviación:** cuántos aparecen en la pestaña de desviaciones (según reglas del sistema).
- **Confiabilidad promedio:** indicador global de qué tan completos están los costos en el historial de entradas.

---

## Pestaña “Análisis general”

Tabla por producto con, entre otros:

- **Existencia** y **costo actual** en tienda.
- **Promedio cambios en costo:** referencia calculada a partir de entradas **con costo bien registrado**.
- **Valor inventario.**
- **Último movimiento que cambió costo** (fecha de la última compra válida con datos, o “N/A”).
- **Confiabilidad** en porcentaje con color (verde / amarillo / rojo según umbrales de la pantalla).

**Qué hacer aquí:** buscar productos con confiabilidad baja y revisar después en **Movimientos** si las compras tenían costo.

---

## Pestaña “Productos con desviación”

Lista artículos donde el sistema detecta **diferencia relevante** entre el **costo actual** y el **último costo unitario** de una entrada válida, **solo** si hay bastante información confiable (por reglas internas de la pantalla).

Si no hay filas, verás un mensaje tipo **“excelente, no hay desviaciones significativas”**.

---

## Pestaña “Confiabilidad de datos”

- Tarjetas con productos de datos **completos**, **parciales** o **insuficientes**.
- Tabla con **compras con CPP** vs **compras sin CPP** (entradas que cuentan para el análisis vs entradas sin costo guardado).
- Barra de progreso y etiqueta **Completo / Parcial / Insuficiente**.

**Uso:** identificar qué productos necesitan que, de ahora en adelante, las **entradas** se carguen siempre con **costo**.

---

## Aviso “Datos históricos detectados” y botón “Migrar datos”

1. Si aparece, significa que hay productos con **movimientos viejos sin costo** que pueden ensuciar el análisis.
2. **Migrar datos** primero abre una **vista previa** (simulación) con detalle.
3. Solo si tu negocio lo autoriza, alguien con responsabilidad pulsa **Ejecutar migración** para que el sistema intente **alinear** esos registros.

**Importante:** no es un paso rutinario de caja diaria; coordinación con administración o soporte.

---

## Relación con el trabajo diario

| Para… | Usar principalmente |
|--------|----------------------|
| Subir stock y costo | **Movimientos** (compra, recepción, consignación entrada) |
| Ver cantidades | **Inventario** |
| Entender si el costo es confiable | **Análisis CPP** (esta pantalla) |

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

## Ver la pantalla

- Permiso de **recuperaciones de análisis CPP** (descripción interna: acceder a análisis de costo y costo promedio ponderado de los productos).

Sin ese permiso, **no aparece** “Análisis de CPP” en el menú de resúmenes.

---

## Botón “Migrar datos”

- En el código revisado, el botón se muestra a quien ya puede ver la pantalla y cumple la condición de aviso; **no** vimos un permiso aparte solo para migración.

**Recomendación para el negocio:** tratar la migración como acción de **administrador o soporte**, aunque el botón sea visible, para evitar cambios masivos sin control.

---

## Superadministrador

Tiene acceso completo como en el resto del sistema.

---

## Resumen para el bot

- “No veo CPP” → permiso **recuperaciones análisis CPP**.  
- “Veo CPP pero no debería poder migrar” → norma interna del negocio; el producto puede mostrar el botón sin un segundo candado específico en la interfaz analizada.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Cargando análisis…” prolongado

**Qué hacer:** Esperar; si no avanza, actualizar la página o revisar conexión.

---

## “Error al cargar análisis de CPP”

**Qué hacer:** Reintentar; cerrar sesión; si se repite, soporte.

---

## Alerta: “No hay tienda seleccionada”

**Qué hacer:** Elegir tienda en la barra y volver a entrar al análisis.

---

## “Error al obtener vista previa de migración” / “Error al ejecutar migración”

**Qué hacer:** No insistir sin supervisión; contactar a quien administra el sistema o soporte técnico.

---

## “Migración completada exitosamente”

**Qué esperar:** Mensaje de éxito y datos recargados; revisar de nuevo las pestañas de confiabilidad.

---

## Tabla vacía en “Análisis general”

**Causas frecuentes:** Ningún producto con **existencia mayor que cero** en esa tienda, o aún no cargó el servidor.

**Qué hacer:** Ver **Inventario** y movimientos de entrada.

---

## Mensaje positivo en desviaciones (“no hay productos con desviaciones…”)

**Qué es:** No se encontraron diferencias que superen los filtros del sistema; no es un error.

---

## Textos técnicos en el detalle de migración (simulación)

**Qué hacer:** Leer solo el **resumen** y la **cantidad de movimientos**; el detalle largo es para soporte o administración.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

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

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Qué es el CPP?”

**Respuesta sugerida:**  
“En esta pantalla, el **CPP** es el **costo promedio ponderado**: una forma de ver **a cuánto te salió en promedio** cada unidad según las **entradas** donde cargaste **costo** (compras, recepciones de otra tienda o consignación). Te ayuda a ver si el **costo que tiene hoy el producto** está alineado con esas compras y qué tan **completos** están los datos.”

**Pregunta de diagnóstico:** “¿Querés entender **ganancias** o solo por qué un producto tiene **costo raro**?”

---

## “Me sale confiabilidad baja”

**Respuesta sugerida:**  
“Eso indica que hay **entradas** (compras o recepciones) **sin costo guardado** o información vieja incompleta. De ahora en más, cargá siempre el **costo** en **Movimientos** al comprar o recibir. Si aparece el aviso de **migrar datos históricos**, eso lo debe decidir un **administrador**; no es algo rutinario de caja.”

---

## “No me lista productos”

**Respuesta sugerida:**  
“Ese análisis mira **solo productos con stock mayor a cero** en la tienda que tenés seleccionada. Si todo está en cero, la tabla puede quedar vacía. Revisá **Inventario** y la **tienda actual**.”

---

## “¿Debo pulsar Migrar datos?”

**Respuesta sugerida:**  
“No pulses **Ejecutar migración** sin hablar antes con quien administra el negocio o soporte. Primero podés abrir la **vista previa** para ver cuántos movimientos viejos faltan; la migración intenta **ordenar datos antiguos** y puede afectar informes.”

---

## “¿Esto cambia el precio de venta?”

**Respuesta sugerida:**  
“No. Esto es de **costos** y **análisis**. Los precios de venta se gestionan en **Conformar precios** o donde corresponda en vuestra operación.”

---

## Frases a evitar

- “Promedio ponderado con fórmula CPP = …” en la primera respuesta; mejor **una frase** y luego profundizar si preguntan.
- “Endpoint”, “Prisma”, “dry run” → usar **vista previa** y **simulación**.
