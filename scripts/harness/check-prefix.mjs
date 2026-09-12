#!/usr/bin/env node
// Sin prefijo local no se puede crear ningún identificador nuevo del harness, así que este
// check es lo primero que corre: si falta, todo lo demás da igual. El mensaje de `prefix.mjs`
// dice qué hacer — preguntárselo a la persona, nunca inventárselo.
import { leerPrefijo, PrefijoAusente, PREFIX_FILE } from "./prefix.mjs";

try {
  const p = leerPrefijo();
  console.log(`✓ prefijo local «${p}» (${PREFIX_FILE}, ignorado por git)`);
} catch (e) {
  if (!(e instanceof PrefijoAusente)) throw e;
  console.error("✗ " + e.message);
  process.exit(1);
}
