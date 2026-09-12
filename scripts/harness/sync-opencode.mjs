#!/usr/bin/env node
// Genera `.opencode/` a partir de `.claude/`, que es la ÚNICA fuente de los agentes.
//
// Por qué existe este script en vez de dos copias a mano: opencode lee `AGENTS.md`,
// `.claude/skills/` y `.agents/skills/` de forma nativa, pero NO lee `.claude/agents/`
// — sus directorios de config son solo `.opencode/` (subiendo por el árbol) y el global.
// Sin los subagentes, `/feature` se cae en el paso 3.
//
// Y copiarlos tal cual tampoco basta: el frontmatter de Claude Code no es válido en opencode.
//
//   color: red|orange|…    → se DESCARTA. opencode solo acepta `#RRGGBB` o siete literales
//                            de tema; un color con nombre es un ERROR DE SCHEMA y el agente
//                            no carga, en silencio.
//   model: opus|sonnet|…   → se DESCARTA (ver la nota de DISCARDED, más abajo).
//   memory: project        → se DESCARTA. Es de Claude Code y opencode lo ignora.
//   (sin `mode`)           → se AÑADE `mode: subagent`: el default de un agente en markdown
//                            es "all", así que los diez saldrían como agentes PRIMARIOS.
//   (sin `permission`)     → se AÑADE la frontera de escritura de cada agente.
//
// Lo que NO se toca es la `description` ni el cuerpo: son el prompt y el disparador del
// subagente. El generador aborta si la traducción los altera.
//
// Dos juegos de definiciones mantenidos a mano se desincronizan en la tercera edición y
// nadie se entera hasta que opencode corre un `implementer` con el prompt viejo. Por eso
// `--check` corre dentro de `npm run harness:check`.
//
// Uso:
//   node scripts/harness/sync-opencode.mjs            # regenera .opencode/
//   node scripts/harness/sync-opencode.mjs --check    # falla si hay deriva
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SOURCE_AGENTS = ".claude/agents";
const TARGET_AGENTS = ".opencode/agent";
const TARGET_COMMANDS = ".opencode/command";

// El aviso va como COMENTARIO YAML dentro del frontmatter: así no entra en el prompt del
// agente. Un aviso en el cuerpo sí lo haría, y el modelo gastaría atención en él.
const BANNER = [
  "# ⚠️  GENERADO por scripts/harness/sync-opencode.mjs — NO EDITAR A MANO.",
  "# La fuente es .claude/agents/<nombre>.md. Edita allí y corre `npm run harness:sync`.",
];

// `model` y `color` se DESCARTAN, no se traducen.
//
// `model`: el alias de Claude Code (`opus`) no vale en opencode, que quiere el id exacto de
// models.dev (`anthropic/claude-opus-5`). Traducirlo obligaría a este script a seguir el
// catálogo de un proveedor concreto y a romperse cada vez que un id se retira, además de
// imponer Anthropic a quien corra opencode con otro proveedor. Sin `model`, cada agente hereda
// el de la sesión. Contrapartida, y conviene saberla: en Claude Code los diez tienen nivel
// propio —`qa` en sonnet, `react-ui-architect` en haiku, el resto en opus— y ese reparto se
// pierde. El requisito real del pipeline (el coordinador necesita Opus) lo dice la skill y lo
// comprueba en su paso 0, que es donde sigue vivo.
//
// `color`: es decoración del selector, y el juego de valores no coincide —Claude Code acepta
// nombres, opencode solo `#RRGGBB` o siete literales de tema—, así que no hay nada que
// preservar. Ojo: un color con nombre en opencode NO es un aviso, es un error de schema que
// deja al agente sin cargar, en silencio. Por eso se quita, no se copia.
const DISCARDED = ["model", "color", "memory"];

// Las fronteras de la tabla «Escribe en / Nunca toca» de AGENTS.md, que hoy son solo prosa
// dentro del prompt. Aquí pasan a ser una regla del runtime.
//
// DOS DETALLES QUE DECIDEN SI ESTO FUNCIONA O ES DECORATIVO:
//
//  1. Gana la ÚLTIMA regla que casa (`findLast` en el evaluador de opencode), no la
//     primera. El catch-all `"*"` va DELANTE y lo específico DETRÁS. Al revés, el
//     catch-all gana siempre y la frontera no existe.
//  2. Si la última regla que casa es `"*": "deny"`, opencode retira la herramienta entera
//     del agente. Por eso todo bloque que empieza denegando termina con sus permisos.
//
// `*` casa cero o más caracteres CUALESQUIERA, la barra incluida: por eso `*__tests__/*`
// cubre tanto `src/__tests__/x.ts` como la forma absoluta de la misma ruta.
const PERMISSIONS = {
  // Paso 5, en paralelo: fronteras disjuntas. Es lo único que evita que los dos choquen.
  implementer: { edit: { "*": "allow", "*__tests__/*": "deny" } },
  "dev-tester": { edit: { "*": "deny", "*__tests__/*": "allow", ".agents/*": "allow" } },

  // Pasos 3, 4 y 4b: escriben documentos, nunca código.
  spec: { edit: { "*": "deny", ".agents/*": "allow" } },
  "arch-guardian": { edit: { "*": "deny", ".agents/*": "allow", "docs/adr/*": "allow" } },
  "security-guardian": { edit: { "*": "deny", ".agents/*": "allow" } },
  "ui-designer": { edit: { "*": "deny", ".agents/*": "allow" } },

  // Paso 6: verifica EJECUTANDO, así que bash queda libre; lo que no puede es tocar el
  // código que juzga. `.qa-tmp/` es su banco de trabajo (capturas, fixtures) y va en
  // .gitignore.
  qa: { edit: { "*": "deny", ".agents/*": "allow", ".qa-tmp/*": "allow" } },

  // code-refactorer, react-ui-architect y ux-ui-designer son bajo demanda, fuera del
  // pipeline: no tienen frontera que imponer y se quedan con los permisos por defecto.
};

const COMMAND_FEATURE = `---
description: Orquesta el pipeline completo de una funcionalidad — spec, arquitectura, diseño, implementación y tests en paralelo, y QA
---

Carga la skill \`feature\` con la herramienta \`skill\` y ejecuta su pipeline al pie de la letra.

Feature a trabajar: $ARGUMENTS

Si no hay argumento, no elijas tú: muestra los features con \`passes: false\` de
\`.agents/features.json\` junto con los progresos abiertos de \`.agents/progress/\`, y pregunta.
`;

// ── frontmatter ───────────────────────────────────────────────────────────────────────
//
// No se reserializa el YAML: se reescriben las líneas que hay que cambiar y el resto viaja
// literal. Las `description` de estos agentes son escalares entre comillas dobles de hasta
// cuarenta líneas, con `<example>` dentro y comillas escapadas; cualquier ida y vuelta por
// un serializador las devolvería con otro plegado y el diff sería ilegible.
//
// El estado `inQuoted` no es adorno: dentro de esas descripciones hay líneas que empiezan
// por `user:` y `assistant:` en la columna cero, y sin llevar la cuenta de las comillas se
// leerían como claves del frontmatter.

function closesQuotedScalar(text, startIndex) {
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === "\\") { i++; continue; }
    if (text[i] === '"') return true;
  }
  return false;
}

function splitFrontmatter(raw, file) {
  const lines = raw.split("\n");
  if (lines[0] !== "---") throw new Error(`${file}: no empieza con un frontmatter \`---\``);
  const end = lines.indexOf("---", 1);
  if (end === -1) throw new Error(`${file}: el frontmatter no se cierra`);
  return { front: lines.slice(1, end), body: lines.slice(end + 1).join("\n") };
}

function transformFrontmatter(front, name, file) {
  const out = [];
  const seen = new Set();
  let inQuoted = false;

  for (const line of front) {
    if (inQuoted) {
      out.push(line);
      if (closesQuotedScalar(line, 0)) inQuoted = false;
      continue;
    }

    const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
    if (!m) { out.push(line); continue; }

    const [, key, value] = m;
    seen.add(key);

    // `memory` va aquí también: la memoria por agente vive en .claude/agent-memory/, que está
    // en .gitignore, y opencode no tiene equivalente.
    if (DISCARDED.includes(key)) continue;

    out.push(line);
    if (value.startsWith('"') && !closesQuotedScalar(value, 1)) inQuoted = true;
  }

  if (inQuoted) throw new Error(`${file}: hay un escalar entre comillas sin cerrar en el frontmatter`);
  for (const required of ["name", "description"]) {
    if (!seen.has(required)) throw new Error(`${file}: falta \`${required}\` en el frontmatter`);
  }

  // Sin esto los diez salen como agentes primarios: el default de opencode es "all".
  out.push("mode: subagent");

  const permission = PERMISSIONS[name];
  if (permission) {
    out.push("permission:");
    for (const [tool, rules] of Object.entries(permission)) {
      out.push(`  ${tool}:`);
      for (const [pattern, action] of Object.entries(rules)) {
        out.push(`    "${pattern}": ${action}`);
      }
    }
  }

  return out;
}

// E-006: una comilla sin escapar dentro de `description` rompe el frontmatter entero y el
// agente desaparece del registro EN SILENCIO — ni error, ni lint, ni markdown roto. La ficha
// pedía parsear el YAML a mano después de cada edición; aquí deja de depender de que alguien
// se acuerde.
//
// El parser es js-yaml a propósito, que es el que usa gray-matter y, por tanto, opencode
// (packages/core/src/config/markdown.ts). El paquete `yaml` implementa YAML 1.2 estricto y
// rechaza cosas que js-yaml acepta —`ux-ui-designer` es una de ellas—, así que validar con él
// daría por rotos agentes que cargan perfectamente.
//
// Llega como dependencia transitiva de eslint, no declarada: si algún día no se resuelve, se
// avisa y se sigue. Un check que se cae solo porque cambió el árbol de node_modules acabaría
// desactivado, y eso sí dejaría E-006 sin red.
let parseYaml = null;
try {
  parseYaml = (await import("js-yaml")).default.load;
} catch {
  console.warn("⚠  js-yaml no se resuelve: el frontmatter no se valida (E-006 sin red).");
}

function validarFrontmatter(front, origen) {
  if (!parseYaml) return;
  let data;
  try {
    data = parseYaml(front.join("\n"));
  } catch (e) {
    throw new Error(`${origen}: el frontmatter no parsea como YAML (E-006): ${e.message.split("\n")[0]}`);
  }
  if (!data || typeof data !== "object") throw new Error(`${origen}: el frontmatter no es un mapa YAML (E-006)`);
  for (const required of ["name", "description"]) {
    if (!data[required]) throw new Error(`${origen}: falta \`${required}\` tras parsear el frontmatter (E-006)`);
  }
  return data;
}

function renderAgent(file) {
  const name = file.replace(/\.md$/, "");
  const origen = join(SOURCE_AGENTS, file);
  const raw = readFileSync(origen, "utf8");
  const { front, body } = splitFrontmatter(raw, origen);

  const fuente = validarFrontmatter(front, origen);
  if (fuente && fuente.name !== name) {
    throw new Error(`${origen}: \`name: ${fuente.name}\` no coincide con el nombre del archivo (${name})`);
  }

  const transformed = transformFrontmatter(front, name, origen);
  const destino = join(TARGET_AGENTS, file);
  // Con el banner incluido: es lo que va a leer opencode, comentarios YAML y todo. Filtrar
  // las líneas `#` aquí podría cortar por la mitad un escalar multilínea del `description`.
  const generado = validarFrontmatter([...BANNER, ...transformed], destino);

  // La descripción es lo que hace que un subagente se invoque solo: si la traducción la
  // alterase, el agente dejaría de dispararse cuando toca y nadie lo relacionaría con esto.
  if (fuente && generado && fuente.description !== generado.description) {
    throw new Error(`${destino}: la traducción alteró \`description\`; debe viajar literal`);
  }

  return ["---", ...BANNER, ...transformed, "---", body.replace(/^\n+/, "\n")].join("\n");
}

function build() {
  const files = readdirSync(SOURCE_AGENTS).filter((f) => f.endsWith(".md")).sort();
  if (files.length === 0) throw new Error(`${SOURCE_AGENTS} no tiene ningún agente`);

  const artefactos = new Map();
  for (const file of files) artefactos.set(join(TARGET_AGENTS, file), renderAgent(file));
  artefactos.set(join(TARGET_COMMANDS, "feature.md"), COMMAND_FEATURE);

  // Un agente borrado en .claude/ tiene que desaparecer de .opencode/, no quedarse
  // huérfano: seguiría cargándose y opencode lo ofrecería como si existiera.
  for (const dir of [TARGET_AGENTS, TARGET_COMMANDS]) {
    let presentes;
    try { presentes = readdirSync(dir); } catch { continue; }
    for (const f of presentes) {
      if (f.endsWith(".md") && !artefactos.has(join(dir, f))) artefactos.set(join(dir, f), null);
    }
  }
  return artefactos;
}

// ── main ──────────────────────────────────────────────────────────────────────────────

const check = process.argv.includes("--check");
let artefactos;
try {
  artefactos = build();
} catch (e) {
  console.error(`✗ .opencode/ no se puede generar: ${e.message}`);
  process.exit(1);
}

const drift = [];
for (const [path, content] of artefactos) {
  let actual = null;
  try { actual = readFileSync(path, "utf8"); } catch { /* no existe */ }

  if (content === null) {
    if (actual !== null) drift.push([path, "sobra (su fuente en .claude/agents/ ya no existe)"]);
  } else if (actual === null) {
    drift.push([path, "falta"]);
  } else if (actual !== content) {
    drift.push([path, "no coincide con su fuente en .claude/"]);
  }
}

if (check) {
  if (drift.length) {
    console.error(`✗ .opencode/ desincronizado de .claude/ (${drift.length}):\n`);
    drift.forEach(([p, why]) => console.error(`  ${p}: ${why}`));
    console.error("\nopencode lee .opencode/, no .claude/agents/. Con deriva, opencode corre los");
    console.error("prompts viejos sin avisar. Regenera con:  npm run harness:sync");
    process.exit(1);
  }
  console.log(`✓ .opencode/ sincronizado con .claude/ (${artefactos.size} artefactos)`);
  process.exit(0);
}

for (const [path, content] of artefactos) {
  if (content === null) { rmSync(path); continue; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

if (drift.length) {
  console.log(`✓ .opencode/ regenerado desde .claude/ (${drift.length} cambios):`);
  drift.forEach(([p, why]) => console.log(`    · ${p} — ${why}`));
} else {
  console.log(`✓ .opencode/ ya estaba al día (${artefactos.size} artefactos)`);
}
