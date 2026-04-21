# Base de conocimiento consolidada (embeddings)

Cada **`*.md` de esta carpeta** agrupa **todo el contenido del mismo tema** que en la raíz de `docs/chatbot/` está repartido en seis archivos (`configuracion_usuario_*`, `guia_paso_a_paso_*`, `permisos_usuario_*`, `errores_comunes_*`, `problemas_y_soluciones_*`, `respuestas_chatbot_*`).

**Para indexar o generar embeddings**, usa preferentemente estos ficheros: un vector por módulo suele dar mejor contexto que seis trozos separados.

**Para editar** el contenido, hazlo en los seis archivos fuente y vuelve a generar esta carpeta:

```bash
python3 docs/chatbot/build_kb.py
```
