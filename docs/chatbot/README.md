# Base de conocimiento para chatbot (soporte funcional)

Textos pensados para **usuarios finales sin conocimientos técnicos**. No sustituyen al equipo humano cuando hace falta acceso interno o cambios en la cuenta del negocio.

## Embeddings y RAG

Para **indexar o generar embeddings**, usa los documentos **consolidados por tema** en la carpeta **`kb/`** (un archivo por módulo, con toda la información relacionada en el mismo sitio). Ver `kb/README.md`.

Tras editar los archivos fuente en la raíz de `docs/chatbot/`, regenera los consolidados:

```bash
python3 docs/chatbot/build_kb.py
```

## Cómo está organizado el contenido fuente

Cada **tema** del producto se documenta en **seis archivos** en `docs/chatbot/`, con prefijo de capa:

| Prefijo del archivo | Contenido |
|---------------------|-----------|
| `configuracion_usuario_` | Qué debe dejar listo el usuario o el administrador del negocio |
| `guia_paso_a_paso_` | Tutoriales: “pulsa aquí, luego allá” |
| `permisos_usuario_` | Por qué a veces “no aparece” una opción |
| `errores_comunes_` | Mensajes o comportamientos y cómo reaccionar |
| `problemas_y_soluciones_` | Síntomas habituales y qué hacer |
| `respuestas_chatbot_` | Frases listas y preguntas de diagnóstico |

Nombre: **`<capa>_<tema>.md`**. Ejemplo: `permisos_usuario_pos.md`.

## Temas (orden de trabajo)

1. **Configuración** — `configuracion`  
2. **Proveedores** — `proveedores`  
3. **Movimientos** — `movimientos`  
4. **Inventario** — `inventario`  
5. **CPP (análisis)** — `cpp`  
6. **Conformar precios** — `conformar_precios`  
7. **Gastos** — `gastos`  
8. **POS** — `pos`  
9. **Ventas** — `ventas`  
10. **Cierre** — `cierre`  
11. **Resumen de cierres** — `resumen_cierres`  
12. **Dashboard** (ejecutivo + Resumen del negocio) — `dashboard`  
13. **Inicio (`/home`)** — `home`  
14. **Descargar app** — `descargar_app`  
15. **Suscripción y planes** — `suscripcion`  
16. **Acceso a la cuenta** — `acceso_cuenta`

Cada tema tiene su vista consolidada en **`kb/<tema>.md`** (por ejemplo `kb/pos.md`).

Opcionales sugeridos en el plan: FAQ transversal y glosario (`PLAN_BASE_CONOCIMIENTO.md`).

Ítem de plan: `PLAN_BASE_CONOCIMIENTO.md`.
