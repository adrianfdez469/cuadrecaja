# Base de conocimiento para chatbot (soporte funcional)

Textos pensados para **usuarios finales sin conocimientos técnicos**. No sustituyen al equipo humano cuando hace falta acceso interno o cambios en la cuenta del negocio.

## Cómo está organizado

| Carpeta | Para qué sirve |
|---------|----------------|
| `problemas_y_soluciones` | Síntomas habituales y qué hacer |
| `guia_paso_a_paso` | Tutoriales: “pulsa aquí, luego allá” |
| `errores_comunes` | Mensajes o comportamientos y cómo reaccionar |
| `configuracion_usuario` | Qué debe dejar listo el usuario o el administrador del negocio |
| `permisos_usuario` | Por qué a veces “no aparece” una opción |
| `respuestas_chatbot` | Frases listas y preguntas de diagnóstico |

## Nombres de archivo

En cada subcarpeta de `docs/chatbot/`, el nombre del fichero combina el **nombre de esa carpeta**, un guion bajo y el **tema**, con extensión `.md`. Ejemplo: acceso a cuenta en configuración de usuario → `configuracion_usuario/configuracion_usuario_acceso_cuenta.md`.

## Temas (orden de trabajo)

Cada tema aparece **una vez por carpeta** con el nombre anterior (mismo orden de trabajo):

1. **Configuración** — tema `configuracion`.  
2. **Proveedores** — tema `proveedores`.  
3. **Movimientos** — tema `movimientos`.  
4. **Inventario** — tema `inventario`.  
5. **CPP (análisis)** — tema `cpp`.  
6. **Conformar precios** — tema `conformar_precios`.  
7. **Gastos** — tema `gastos`.  
8. **POS** — tema `pos`.  
9. **Ventas** — tema `ventas`.  
10. **Cierre** — tema `cierre`.  
11. **Resumen de cierres** — tema `resumen_cierres`.  
12. **Dashboard** (ejecutivo + Resumen del negocio) — tema `dashboard`.  
13. **Inicio (`/home`)** — tema `home`.  
14. **Descargar app** — tema `descargar_app`.  
15. **Suscripción y planes** — tema `suscripcion`.  
16. **Acceso a la cuenta** (olvidé contraseña, restablecer, activar) — tema `acceso_cuenta`.

Opcionales sugeridos en el plan: FAQ transversal y glosario (`PLAN_BASE_CONOCIMIENTO.md`).

Ítem de plan: `PLAN_BASE_CONOCIMIENTO.md`.
