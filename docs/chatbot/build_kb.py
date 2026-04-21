#!/usr/bin/env python3
"""
Genera docs/chatbot/kb/<tema>.md fusionando las seis capas por tema:
  configuracion_usuario_<tema>.md
  guia_paso_a_paso_<tema>.md
  permisos_usuario_<tema>.md
  errores_comunes_<tema>.md
  problemas_y_soluciones_<tema>.md
  respuestas_chatbot_<tema>.md

Uso (desde la raíz del repo):
  python3 docs/chatbot/build_kb.py
"""

from __future__ import annotations

from pathlib import Path

CHATBOT = Path(__file__).resolve().parent
KB_DIR = CHATBOT / "kb"

SKIP_FILES = frozenset({"README.md", "PLAN_BASE_CONOCIMIENTO.md"})

SECTIONS: list[tuple[str, str, str]] = [
    (
        "configuracion_usuario_",
        "## Configuración previa",
        "Qué debe tener listo el negocio o el administrador antes de usar el módulo.",
    ),
    ("guia_paso_a_paso_", "## Guía paso a paso", "Flujo principal en la aplicación."),
    ("permisos_usuario_", "## Permisos del usuario", "Por qué puede faltar una opción o un dato."),
    ("errores_comunes_", "## Errores comunes", "Mensajes o comportamientos y cómo reaccionar."),
    ("problemas_y_soluciones_", "## Problemas y soluciones", "Síntomas habituales y qué hacer."),
    ("respuestas_chatbot_", "## Respuestas tipo chatbot", "Frases listas y preguntas de diagnóstico."),
]

TOPIC_ORDER = [
    "configuracion",
    "proveedores",
    "movimientos",
    "inventario",
    "cpp",
    "conformar_precios",
    "gastos",
    "pos",
    "ventas",
    "cierre",
    "resumen_cierres",
    "dashboard",
    "home",
    "descargar_app",
    "suscripcion",
    "acceso_cuenta",
]

TOPIC_TITLES: dict[str, str] = {
    "acceso_cuenta": "Acceso a la cuenta",
    "cierre": "Cierre de período",
    "configuracion": "Configuración",
    "conformar_precios": "Conformar precios",
    "cpp": "CPP (análisis)",
    "dashboard": "Dashboard",
    "descargar_app": "Descargar la app",
    "gastos": "Gastos",
    "home": "Inicio (home)",
    "inventario": "Inventario",
    "movimientos": "Movimientos de stock",
    "pos": "POS",
    "proveedores": "Proveedores",
    "resumen_cierres": "Resumen de cierres",
    "suscripcion": "Suscripción y planes",
    "ventas": "Ventas",
}


def strip_leading_h1(md: str) -> str:
    lines = md.strip().split("\n")
    if lines and lines[0].startswith("# ") and not lines[0].startswith("## "):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines.pop(0)
    return "\n".join(lines).strip()


def collect_topics() -> list[str]:
    topics: set[str] = set()
    for p in CHATBOT.glob("*.md"):
        if p.name in SKIP_FILES:
            continue
        for prefix, _, _ in SECTIONS:
            if p.name.startswith(prefix) and p.name.endswith(".md"):
                topics.add(p.name[len(prefix) : -3])
                break
    ordered = [t for t in TOPIC_ORDER if t in topics]
    for t in sorted(topics):
        if t not in ordered:
            ordered.append(t)
    return ordered


def build_topic(topic: str) -> str:
    title = TOPIC_TITLES.get(topic, topic.replace("_", " ").title())
    parts: list[str] = [
        "<!-- Consolidado para embeddings. Fuentes: seis archivos `"
        + topic
        + "` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->",
        "",
        f"# {title}",
        "",
        "Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).",
        "",
    ]

    for prefix, heading, blurb in SECTIONS:
        path = CHATBOT / f"{prefix}{topic}.md"
        parts.append(heading)
        parts.append("")
        parts.append(f"*{blurb}*")
        parts.append("")
        if not path.is_file():
            parts.append("_(Aún no hay contenido en esta capa para este tema.)_")
            parts.append("")
            continue
        body = strip_leading_h1(path.read_text(encoding="utf-8"))
        if body:
            parts.append(body)
        else:
            parts.append("_(Vacío.)_")
        parts.append("")

    return "\n".join(parts).rstrip() + "\n"


def main() -> None:
    KB_DIR.mkdir(parents=True, exist_ok=True)
    topics = collect_topics()
    for topic in topics:
        out = KB_DIR / f"{topic}.md"
        out.write_text(build_topic(topic), encoding="utf-8")
        print(f"Wrote {out.relative_to(CHATBOT.parent.parent)}")


if __name__ == "__main__":
    main()
