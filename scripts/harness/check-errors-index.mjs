#!/usr/bin/env node
// COMMON_ERRORS.md is the index every pipeline agent reads before touching code. Two ways it
// silently stops being an index, both of which had already happened:
//   1. A ficha exists on disk and no row points at it (E-067 was invisible).
//   2. A row is appended after the closing prose instead of into the table, so it renders as
//      stray markdown and indexes nothing (E-082, E-083 and E-084 were all three out there).
// It also guards the size discipline: a row is one line, the narrative belongs in the ficha.
import { readdirSync, readFileSync } from "node:fs";

const INDEX = ".agents/COMMON_ERRORS.md";
const ERRORS_DIR = ".agents/errors";
const ROW_BUDGET = 420;   // chars: el enlace ya gasta ~90, la síntesis cabe en el resto

// Una ficha es `E-###-slug.md` (heredada) o `PREFIJO-E-###-slug.md` (a partir del prefijo local).
const FICHA_RE = /^((?:[A-Za-z][A-Za-z0-9]*-)?E-\d+)-.*\.md$/;
const lines = readFileSync(INDEX, "utf8").split("\n");
const fichas = new Set(
  readdirSync(ERRORS_DIR).map((f) => f.match(FICHA_RE)?.[1]).filter(Boolean),
);

let section = null;
const rows = { frec: [], reg: [] };
const orphans = [];
const tooLong = [];

lines.forEach((line, i) => {
  if (/^## Frecuentes/.test(line)) section = "frec";
  else if (/^## Registrados/.test(line)) section = "reg";
  else if (/^## /.test(line)) section = null;

  if (!/^\| \[(?:[A-Za-z][A-Za-z0-9]*-)?E-\d+\]/.test(line)) return;
  const id = line.match(/^\| \[((?:[A-Za-z][A-Za-z0-9]*-)?E-\d+)\]/)?.[1];
  if (!id) return;
  if (!section) { orphans.push(`${INDEX}:${i + 1}  ${id} — fila fuera de las tablas`); return; }
  rows[section].push(id);
  if (line.length > ROW_BUDGET) tooLong.push(`${INDEX}:${i + 1}  ${id} — ${line.length} chars`);
});

const errors = [];
orphans.forEach((o) => errors.push(o));

const indexed = new Set(rows.reg);
[...fichas].sort().forEach((f) => {
  if (!indexed.has(f)) errors.push(`${f}: ficha en disco sin fila en «Registrados» — nadie la encontrará`);
});
rows.reg.forEach((id) => {
  if (!fichas.has(id)) errors.push(`${id}: indexado en «Registrados» sin ficha en ${ERRORS_DIR}/`);
});
const dupes = rows.reg.filter((id, i) => rows.reg.indexOf(id) !== i);
[...new Set(dupes)].forEach((d) => errors.push(`${d}: fila duplicada en «Registrados»`));

// Enlaces que no resuelven.
for (const [, target] of readFileSync(INDEX, "utf8").matchAll(/\]\((errors\/[^)]+)\)/g)) {
  try { readFileSync(`.agents/${target}`); } catch { errors.push(`enlace roto: ${target}`); }
}

if (errors.length || tooLong.length) {
  if (errors.length) {
    console.error(`✗ índice de errores inconsistente (${errors.length}):\n`);
    errors.forEach((e) => console.error("  " + e));
  }
  if (tooLong.length) {
    console.error(`\n✗ filas que dejaron de ser una línea (${tooLong.length}, tope ${ROW_BUDGET} chars):\n`);
    tooLong.forEach((e) => console.error("  " + e));
    console.error("\n  La adenda va a la ficha, no al índice: el índice lo leen 5 agentes por feature.");
  }
  process.exit(1);
}
console.log(`✓ índice de errores: ${fichas.size} fichas, todas indexadas; ${rows.frec.length} en Frecuentes; ninguna fila fuera de tabla`);
