#!/usr/bin/env node
// Emite el siguiente identificador libre del harness, YA PREFIJADO. Nadie cuenta «el último
// existente» a ojo: así se produjeron el ADR 0036 duplicado y los F-031..F-034 que hubo que
// renumerar. El número sigue la secuencia global (para conservar la cronología) y el prefijo
// garantiza que dos personas que calculen el mismo número a la vez no colisionen.
//
// Uso: node scripts/harness/next-id.mjs <adr|error|feature>
import { readdirSync, readFileSync } from "node:fs";
import { leerPrefijo, PrefijoAusente } from "./prefix.mjs";

const TIPOS = {
  adr:     { dir: "docs/adr",       re: /^(?:[A-Za-z][A-Za-z0-9]*-)?(\d{4})-.*\.md$/, pad: 4, molde: (p, n) => `${p}-${n}` },
  error:   { dir: ".agents/errors", re: /^(?:[A-Za-z][A-Za-z0-9]*-)?E-(\d+)-.*\.md$/, pad: 3, molde: (p, n) => `${p}-E-${n}` },
  feature: { json: [".agents/features.json", ".agents/features-archive.json"],
             re: /^(?:[A-Za-z][A-Za-z0-9]*-)?F-(\d+)$/,                               pad: 3, molde: (p, n) => `${p}-F-${n}` },
};

const tipo = process.argv[2];
if (!TIPOS[tipo]) {
  console.error(`Uso: node scripts/harness/next-id.mjs <${Object.keys(TIPOS).join("|")}>`);
  process.exit(2);
}

let prefijo;
try {
  prefijo = leerPrefijo();
} catch (e) {
  if (e instanceof PrefijoAusente) { console.error("✗ " + e.message); process.exit(1); }
  throw e;
}

const t = TIPOS[tipo];
const usados = [];
if (t.dir) {
  for (const f of readdirSync(t.dir)) {
    const m = f.match(t.re);
    if (m) usados.push(Number(m[1]));
  }
} else {
  for (const p of t.json) {
    for (const f of JSON.parse(readFileSync(p, "utf8")).features) {
      const m = String(f.id).match(t.re);
      if (m) usados.push(Number(m[1]));
    }
  }
}

const siguiente = String(Math.max(0, ...usados) + 1).padStart(t.pad, "0");
const id = t.molde(prefijo, siguiente);

console.log(id);
if (tipo === "adr")     console.error(`  → docs/adr/${id}-<slug>.md`);
if (tipo === "error")   console.error(`  → .agents/errors/${id}-<slug>.md`);
if (tipo === "feature") {
  console.error(`  → id en .agents/features.json: "${id}"`);
  for (const d of ["specs", "contracts", "designs", "security", "progress"]) {
    console.error(`  → .agents/${d}/${id}.md`);
  }
}
