#!/usr/bin/env node
// Runs every harness check and reports ALL failures, not just the first.
// No pipes: the exit code of a pipe is the exit code of its LAST command, and three agents of
// F-022 reported `npm run lint` green when it was not, exactly because of that (E-045).
import { spawnSync } from "node:child_process";

const CHECKS = [
  ["rutas de máquina (E-001)", "check-paths.mjs"],
  ["numeración de ADR", "check-adr.mjs"],
  ["copy de los criterios de diseño (E-016)", "check-design-copy.mjs"],
  ["integridad del backlog", "check-features.mjs"],
  ["índice de errores", "check-errors-index.mjs"],
];

const failed = [];
for (const [label, file] of CHECKS) {
  const r = spawnSync(process.execPath, [`scripts/harness/${file}`], { stdio: "inherit" });
  if (r.status !== 0) failed.push(label);
}

if (failed.length) {
  console.error(`\n✗ harness:check — ${failed.length} de ${CHECKS.length} fallan:`);
  failed.forEach((f) => console.error(`    · ${f}`));
  process.exit(1);
}
console.log(`\n✓ harness:check — ${CHECKS.length}/${CHECKS.length} en verde`);
