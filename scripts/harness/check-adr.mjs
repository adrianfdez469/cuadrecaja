#!/usr/bin/env node
// Two ADRs shared the number 0036 because the only rule was "number it after the last existing
// one" — with no index and no allocator, two architects (or two parallel runs) compute the same
// "last" and collide. This check fails on a duplicate and prints the next free number, so the
// arch-guardian asks instead of guessing.
import { readdirSync } from "node:fs";

const DIR = "docs/adr";
// Un ADR es `NNNN-slug.md` (heredado) o `PREFIJO-NNNN-slug.md` (a partir del prefijo local).
// La IDENTIDAD es prefijo+número: `ADRIAN-0151` y `KM-0151` son dos ADR distintos y correctos;
// dos ficheros con el MISMO prefijo y número son la colisión que este check existe para cazar.
const RE = /^(?:([A-Za-z][A-Za-z0-9]*)-)?(\d{4})-.*\.md$/;
const files = readdirSync(DIR).filter((f) => RE.test(f));

const byId = new Map();
const numeros = [];
for (const f of files.sort()) {
  const [, prefijo, num] = f.match(RE);
  const id = prefijo ? `${prefijo}-${num}` : num;
  if (!byId.has(id)) byId.set(id, []);
  byId.get(id).push(f);
  numeros.push(Number(num));
}

const dupes = [...byId.entries()].filter(([, fs]) => fs.length > 1);
const max = Math.max(...numeros);
const next = String(max + 1).padStart(4, "0");

if (dupes.length) {
  console.error(`✗ identificadores de ADR duplicados (${dupes.length}):\n`);
  for (const [id, fs] of dupes) {
    console.error(`  ${id}:`);
    fs.forEach((f) => console.error(`     ${f}`));
  }
  console.error(`\nRenumera el que se creó después con:  node scripts/harness/next-id.mjs adr`);
  console.error("Corrige también las referencias entrantes:");
  console.error(`  grep -rn "${dupes[0][0]}" .agents/ docs/ src/ .claude/`);
  process.exit(1);
}

const conPrefijo = files.filter((f) => f.match(RE)[1]).length;
console.log(`✓ ${files.length} ADR sin colisiones (${conPrefijo} con prefijo, ${files.length - conPrefijo} heredados) — el siguiente número libre es ${next}`);
