#!/usr/bin/env node
// The backlog is split in two: features.json holds only open work, features-archive.json the
// closed and deprecated entries. That split is what keeps Paso 0 of the pipeline from paying the
// whole history on every run — and it only holds if nothing is lost or duplicated between them.
import { readFileSync } from "node:fs";

const ACTIVE = ".agents/features.json";
const ARCHIVE = ".agents/features-archive.json";

const active = JSON.parse(readFileSync(ACTIVE, "utf8"));
const archive = JSON.parse(readFileSync(ARCHIVE, "utf8"));

const errors = [];
const ids = new Map(); // id -> where

for (const [file, doc] of [[ACTIVE, active], [ARCHIVE, archive]]) {
  for (const f of doc.features) {
    if (ids.has(f.id)) errors.push(`id duplicado ${f.id}: en ${ids.get(f.id)} y en ${file}`);
    else ids.set(f.id, file);
  }
}

// An open feature living in the archive (or vice versa) breaks the invariant the split relies on.
for (const f of active.features) {
  if (f.passes === true) errors.push(`${f.id} tiene passes:true y sigue en ${ACTIVE} — el Paso 7 debe moverlo al archivo`);
  if (f.status === "deprecated") errors.push(`${f.id} está deprecated y sigue en ${ACTIVE}`);
}
for (const f of archive.features) {
  if (f.passes !== true && f.status !== "deprecated") errors.push(`${f.id} está en ${ARCHIVE} sin passes:true ni status:deprecated`);
}

// Every depends_on must resolve in one of the two files.
for (const [file, doc] of [[ACTIVE, active], [ARCHIVE, archive]]) {
  for (const f of doc.features) {
    for (const dep of f.depends_on ?? []) {
      if (!ids.has(dep)) errors.push(`${f.id} (${file}) depende de ${dep}, que no existe en ninguno de los dos archivos`);
    }
  }
}

// rules and references live only in the active file: the pipeline reads that one.
if (!active.rules?.length) errors.push(`${ACTIVE} no tiene 'rules' — son vinculantes para el coordinador`);
if (archive.rules) errors.push(`${ARCHIVE} no debe llevar 'rules': la fuente es ${ACTIVE}`);

if (errors.length) {
  console.error(`✗ backlog inconsistente (${errors.length}):\n`);
  errors.forEach((e) => console.error("  " + e));
  process.exit(1);
}

const abiertos = active.features.length;
const cerrados = archive.features.length;
console.log(`✓ backlog coherente — ${abiertos} abiertos en features.json, ${cerrados} en el archivo, ${ids.size} ids únicos`);
