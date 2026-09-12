#!/usr/bin/env node
// Two ADRs shared the number 0036 because the only rule was "number it after the last existing
// one" — with no index and no allocator, two architects (or two parallel runs) compute the same
// "last" and collide. This check fails on a duplicate and prints the next free number, so the
// arch-guardian asks instead of guessing.
import { readdirSync } from "node:fs";

const DIR = "docs/adr";
const files = readdirSync(DIR).filter((f) => /^\d{4}-.*\.md$/.test(f));

const byNumber = new Map();
for (const f of files.sort()) {
  const n = f.slice(0, 4);
  if (!byNumber.has(n)) byNumber.set(n, []);
  byNumber.get(n).push(f);
}

const dupes = [...byNumber.entries()].filter(([, fs]) => fs.length > 1);
const max = Math.max(...byNumber.keys().map(Number));
const next = String(max + 1).padStart(4, "0");

if (dupes.length) {
  console.error(`✗ números de ADR duplicados (${dupes.length}):\n`);
  for (const [n, fs] of dupes) {
    console.error(`  ${n}:`);
    fs.forEach((f) => console.error(`     ${f}`));
  }
  console.error(`\nRenumera el que se creó después al siguiente libre: ${next}`);
  console.error("Corrige también las referencias entrantes:");
  console.error(`  grep -rn "adr/${dupes[0][0]}" .agents/ docs/ src/ .claude/`);
  process.exit(1);
}

console.log(`✓ ${files.length} ADR sin colisiones de número — el siguiente libre es ${next}`);
