#!/usr/bin/env node
// E-001: a machine-specific filesystem path baked into a shared agent file.
// These files travel through git: one developer's path does not exist on another's machine,
// and nothing compiles them, so the failure is silent.
//
// The gap that let E-001 recur a third time was SCOPE: the check was pointed at the agent
// definitions but not at the reports the agents write. Everything under .agents/, .claude/ and
// .opencode/ is in scope here, reports included. .opencode/ is generated from .claude/, but it
// is committed and shared all the same, so a machine path would travel through it too.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = [".agents", ".claude", ".opencode"];
const EXTS = [".md", ".json", ".mjs", ".js", ".ts"];

// A real home/machine path. The lookbehind is what keeps `src/app/home/page.tsx` out:
// a repo-relative path that merely contains the segment `home` is not a machine path.
const UNIX = /(?<![\w/.\-])\/(?:Users|home|root)\//;
// Windows drive: one backslash then a path char. Requiring the trailing char is what keeps
// `Examples:\\n` (an escaped newline inside YAML) from matching.
const WIN = /(?<![\w\\])[A-Za-z]:\\[A-Za-z]/;
// `~/` only when it opens a path segment.
const TILDE = /(?:^|[\s"'`(=])~\//;

// Files whose PURPOSE is to quote the offending paths.
const SKIP_FILES = [
  ".agents/errors/E-001-rutas-de-maquina-en-archivos-compartidos.md",
  "scripts/harness/check-paths.mjs",
];
// Lines that contain the pattern because they ARE this check, written out.
const ALLOW_LINE = /grep -rn|--include=|\(\/Users\/\||check-paths/;

// node_modules is gitignored wherever it appears (e.g. .opencode/node_modules from plugin
// installs): those files are machine-local and never travel through git, so scanning them
// turns third-party docs into false E-001 hits.
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".git") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(".", file);
    if (SKIP_FILES.includes(rel)) continue;
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (ALLOW_LINE.test(line)) return;
      if (UNIX.test(line) || WIN.test(line) || TILDE.test(line)) {
        hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
      }
    });
  }
}

if (hits.length) {
  console.error(`✗ rutas de máquina en archivos compartidos (${hits.length}):\n`);
  hits.forEach((h) => console.error("  " + h));
  console.error("\nEstos archivos se comparten por git. Usa una ruta relativa al repo, o declara");
  console.error("la documentación externa con una variable de entorno (ver AGENTS.md). Ficha: E-001.");
  process.exit(1);
}
console.log(`✓ sin rutas de máquina en ${ROOTS.join(", ")}`);
