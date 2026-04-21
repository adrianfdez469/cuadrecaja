# Plan: base de conocimiento para chatbot (soporte funcional)

**Objetivo:** que el bot responda con precisión a preguntas reales de usuarios (sin tecnicismos), con guías, permisos y errores comunes por módulo.

**Estado actual:** **Plan operativo + ampliación de cuenta/inicio** — doce módulos núcleo **más cuatro temas**. El contenido por capa vive en `docs/chatbot/<capa>_<tema>.md`; para **embeddings** usar **`docs/chatbot/kb/<tema>.md`** (consolidado por tema, generado con `python3 docs/chatbot/build_kb.py`).

---

## Qué falta (por orden acordado)

Para cada módulo se repite el mismo paquete en **seis archivos** en `docs/chatbot/` con prefijo de capa (`configuracion_usuario_`, `guia_paso_a_paso_`, etc.). Vista única para RAG: **`kb/<tema>.md`**.

| Orden | Módulo | Por qué importa para preguntas típicas |
|-------|--------|----------------------------------------|
| 1 | ~~Configuración~~ | Hecho. |
| 2 | ~~**Proveedores**~~ | Hecho: ficha en Configuración vs pantalla de consignación y liquidaciones; permisos de ver / liquidar. |
| 3 | ~~**Movimientos**~~ | Hecho: historial, crear movimiento, recepciones pendientes, importación Excel, permisos por tipo; vínculo con ventas (POS) y consignación. |
| 4 | ~~**Inventario**~~ | Hecho: consulta por tienda, exportación, vencimiento (permiso Conformar precios al guardar), historial por producto, filtro proveedor-usuario. |
| 5 | ~~**CPP (análisis)**~~ | Hecho: qué es CPP en la UI, pestañas, confiabilidad, desviaciones, migración histórica, solo productos con stock > 0. |
| 6 | ~~**Conformar precios**~~ | Hecho: tabla precio/costo/rentabilidad, guardar, etiquetas PDF, permiso compartido con guardados de producto-tienda; costo vía movimientos. |
| 7 | ~~**Gastos**~~ | Hecho: gastos de tienda, plantillas, permisos ver/gestionar/plantillas; vínculo con cierre y revisión previa; ad-hoc. |
| 8 | ~~**POS**~~ | Hecho: catálogo (precio, stock, fracción/padre, usuario-proveedor), período abierto, offline/sincronización, permisos cancelar/ganancias/asociar código; enlace correcto a **Locales** si un botón antiguo dice “tiendas”. |
| 9 | ~~**Ventas**~~ | Hecho: listado por tienda y último período, búsqueda, detalle y descuentos; eliminar venta o línea (permiso **eliminar ventas** o **cancelar POS**; línea: venta propia o superadmin; no en período cerrado); coherencia con POS y sincronización. |
| 10 | ~~**Cierre**~~ | Hecho: resumen del período, propias vs consignación, export Excel, gastos (ver/gestionar), revisión previa (recurrentes + ad-hoc), bloqueo por ventas locales sin sincronizar en POS, permisos acceder/cerrar/ganancias; cierre + apertura automática del período siguiente. |
| 11 | ~~**Resumen de cierres**~~ | Hecho: histórico de períodos **cerrados**, filtros por fechas (recarga al cambiar), paginación, totales y desglose de transferencias; detalle en panel con `TablaProductosCierre`; permiso **recuperaciones.resumencierres.acceder** + **operaciones.cierre.gananciascostos** para montos sensibles; vacío si nunca hubo cierre. |
| 12 | ~~**Dashboard y dashboard-resumen**~~ | Hecho: **Resumen del Negocio** (menú Recuperaciones → Dashboard, permiso `recuperaciones.dashboard.acceder`, filtros Día/Semana/Mes/Año/Personalizado, botón **Aplicar**); **Dashboard ejecutivo** (`/dashboard`, filtros reactivos, período actual de caja + inventario; API sin ese permiso pero requiere período activo); diferencias vs **Resumen de cierres**. |

### Ampliación (cuenta, inicio, app)

| Tema | Archivos fuente + consolidado `kb/` | Contenido breve |
|------|--------------------------------------|------------------|
| ~~**Inicio / home**~~ | tema `home` → `kb/home.md` | Atajos por permiso, tipo almacén, chips de plan, avisos, backup superadmin. |
| ~~**Descargar app**~~ | tema `descargar_app` → `kb/descargar_app.md` | APK Android, arquitecturas, fallo de carga, instalación. |
| ~~**Suscripción y planes**~~ | tema `suscripcion` → `kb/suscripcion.md` | `SubscriptionWarning`, `/subscription-expired`, `/configuracion/planes`, `planes-admin`, soporte en UI. |
| ~~**Acceso a la cuenta**~~ | tema `acceso_cuenta` → `kb/acceso_cuenta.md` | `/olvide-contrasena`, `/restablecer-contrasena`, `/activar`, `/activar-usuario`, reglas de contraseña. |

---

## Brechas explícitas respecto a preguntas concretas que ya planteaste

| Pregunta del usuario | Bloques mínimos que faltan documentar |
|----------------------|-------------------------------------|
| ¿Por qué no aparecen productos en el POS? | Cubierto en **POS** (`docs/chatbot/kb/pos.md`; capas `respuestas_chatbot_pos.md` y `problemas_y_soluciones_pos.md`) enlazado con **Inventario** y **Conformar precios**. |
| ¿Cómo vendo productos conformados por otros? | **Conformar precios** + **POS** en chatbot; **Ventas** documenta consulta y anulaciones, no el cobro. |
| ¿Cómo creo nuevos usuarios? | Cubierto en **Configuración**; opcional: ampliar con capturas de flujo si el producto lo permite. |
| ¿Qué es eso de proveedores? | Cubierto en **Proveedores** (`docs/chatbot/kb/proveedores.md`). |

---

## Criterios de calidad por bloque (checklist interna)

Antes de dar por cerrado cada módulo:

1. **Problemas y soluciones:** al menos 5–8 síntomas reales con pasos numerados.
2. **Guía paso a paso:** flujo “feliz” de principio a fin y qué debería verse en pantalla.
3. **Errores comunes:** mensajes o comportamientos en lenguaje del usuario, no de sistema.
4. **Configuración usuario:** qué debe tener listo el negocio para que el módulo funcione.
5. **Permisos:** qué ve o no ve cada perfil típico (caja, encargado, admin).
6. **Respuestas chatbot:** 4–6 mini-diálogos + preguntas de diagnóstico.

---

## Dependencias entre documentos (evitar contradicciones)

- **POS** debe referenciar en una frase a **Locales / tienda actual** y a **Productos** (configuración + inventario).
- **Conformar precios** debe alinearse con **POS** y **Ventas** (misma nomenclatura para el usuario: “producto conformado”, “compuesto”, etc., según lo que diga la UI real).
- **Cierre** y **Resumen de cierres** deben usar los mismos nombres de pasos que ve el usuario.
- **Cierre** enlaza con **POS** (ventas locales sin sincronizar), **Ventas** (coherencia de período) y **Gastos** (revisión previa y ad-hoc); el **histórico** de cortes pasados va en **Resumen de cierres** (menú **Recuperaciones**, permiso distinto al de **Cierre** operativo).
- **Inventario** y **Conformar precios:** editar **fecha de vencimiento** desde inventario requiere permiso de conformar precios en el sistema actual; el chatbot debe decirlo en lenguaje llano (`kb/inventario.md`, sección *Permisos del usuario*).
- **Dashboard** (dos pantallas) vs **Resumen de cierres** vs **Inventario (recuperaciones):** el bot no debe confundir **cortes de caja** (histórico) con **estadísticas por calendario** (Resumen del negocio) ni con **stock actual** (Inventario).
- **Inicio** (tema `home`) enlaza con **Suscripción** y con permisos de cada atajo; **acceso_cuenta** es previo al login y no reemplaza a **Configuración → usuarios**.

---

## Entregables opcionales (después del núcleo)

- Una sola **FAQ transversal** (`problemas_y_soluciones_faq_general.md` en la raíz de `docs/chatbot/`, cuando exista; luego incluirla en `build_kb.py` o fusionar a mano) con enlaces a cada `kb/<tema>.md`.
- Revisión final de **glosario** (una página: “local = tienda”, “conformar”, “CPP”, etc.).

---

## Próximo paso recomendado

**Entregables opcionales** del propio plan (FAQ transversal, glosario) o revisión editorial cruzada de enlaces rotos (`/configuracion/tiendas` vs **Locales**).

## Interpretación documentada en Proveedores (para revisión de producto)

La lista de consignación usa los **mismos proveedores** dados de alta en Configuración; la diferencia es la **pantalla** (ficha vs números de consignación). La vinculación exacta de “producto en consignación” con compras o inventario está cubierta en **Inventario**, **Movimientos** y **Cierre** (totales y liquidaciones en el cierre del período).
