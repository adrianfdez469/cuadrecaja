#!/usr/bin/env node
// E-016 (7 apariciones, el error más reincidente del harness): un criterio de diseño exige una
// subcadena literal que el copy dictado por el MISMO documento no contiene. «no una reserva» no
// contiene «no es una reserva»: dos frases que significan lo mismo y una subcadena que no coincide.
// El rechazo apunta entonces a código correcto, porque el implementador escribió lo dictado.
//
// La ficha prescribe un repaso mecánico: extraer los code spans de la sección de criterios y
// buscar cada uno como subcadena literal en el copy. Esto es ese repaso, automatizado.
//
// Uso: node scripts/harness/check-design-copy.mjs [fichero.md ...]
//      sin argumentos, repasa .agents/designs/F-*.md
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = ".agents/designs";
const CRITERIA_HEADING = /^#{1,4}\s.*criterios de dise[nñ]o verificables/i;
const NEXT_HEADING = /^#{1,4}\s/;

// A criterion that asserts a literal string is PRESENT.
const ASSERTS_PRESENCE = /contiene|incluye|includes|dice|r[oó]tulo|etiqueta|texto|label|copy/i;
// ...unless it asserts the opposite, in which case the string is absent by design.
const ASSERTS_ABSENCE = /\bno\b[^.]{0,30}(conten|inclu|aparec|dice)|prohibid|nunca|sin la palabra|ausen|NO debe/i;

const norm = (s) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

// Code spans that are plainly not user-visible copy.
const NOT_COPY = [
  /^[\w.$#[\]()<>/=:{}-]*$/,            // un identificador o selector, sin prosa
  /^[a-z]+[A-Z]/,                        // camelCase: un símbolo, no una frase
  /data-|matchMedia|document\.|window\.|querySelector|aria-/,
  /[=<>]|\(\)|\.\w+\(/,                 // comparaciones y llamadas
  /^\w+:\s*("|\d|true|false)/,          // `state: "FAILED"`, `attempts: 3` — fixtures, no copy
  /^[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/,              // no empieza por letra: casi siempre un hueco capturado
  /px$|rem$|^\d/,
];
const isCopy = (s) => !NOT_COPY.some((re) => re.test(s));

// El span tiene que estar precedido, de cerca, por un verbo que afirme presencia literal.
const PRESENCE_NEAR = /(contiene|incluye|includes|dice|es exactamente|r[oó]tulo(?: es)?|etiqueta(?: es)?|texto es|label(?: es)?)\W{0,24}$/i;

let examined = 0;   // aserciones realmente comprobadas: un verde con 0 no prueba nada

function checkFile(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.findIndex((l) => CRITERIA_HEADING.test(l));
  if (start === -1) return [];

  // La sección termina en el siguiente encabezado del MISMO nivel o superior. Cortar en
  // cualquier encabezado deja fuera los criterios cuando viven bajo un `###` interno
  // («### Los criterios»), y el repaso pasa en verde sin haber mirado ninguno.
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#+)\s/);
    if (h && h[1].length <= level) { end = i; break; }
  }

  // El contraste es INTRA-DOCUMENTO, y no por falta de ambición: es la única formulación con
  // poder de detección. Ampliarlo a src/ o a los demás contratos hace que «no es una reserva»
  // —el caso original de E-016— se encuentre en el documento que narra el incidente, y el repaso
  // pasa en verde sin detectar nada. La ficha prescribe exactamente esto: buscar cada subcadena
  // en el copy QUE EL DOCUMENTO DICTA. Se incluye la propia sección de criterios (menos la línea
  // que afirma) porque ahí viven los bloques de siembra de donde salen los nombres de fixture.
  const findings = [];

  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (!ASSERTS_PRESENCE.test(line) || ASSERTS_ABSENCE.test(line)) continue;
    // Sin longitud mínima en el patrón: si el regex descarta un span corto, el siguiente match
    // empareja la comilla de cierre con la de apertura del siguiente y captura EL HUECO entre
    // ambos, que es prosa del criterio y no una subcadena exigida. Se filtra después.
    for (const m of line.matchAll(/`([^`\n]+)`/g)) {
      const span = norm(m[1]);
      if (span.length < 4 || !/\s/.test(span)) continue;   // una sola palabra: demasiado ruido
      if (!isCopy(span)) continue;
      if (!PRESENCE_NEAR.test(line.slice(0, m.index))) continue;
      examined++;
      // Una plantilla se parte y se exige cada trozo por separado.
      const parts = span.split(/\{[^}]*\}|\d+/).map(norm).filter((p) => p.length >= 4);
      // La propia línea del criterio no cuenta como copy: si contara, todo pasaría siempre.
      const corpus = norm(lines.filter((_, j) => j !== i).join(" "));
      const missing = parts.filter((p) => !corpus.includes(p));
      if (missing.length) {
        findings.push({ path, line: i + 1, span, missing, text: norm(line).slice(0, 110) });
      }
    }
  }
  return findings;
}

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(DIR).filter((f) => /^F-\d+\.md$/.test(f)).sort().map((f) => join(DIR, f));

const all = files.flatMap(checkFile);

// Un fichero pasado por argumento es el contrato EN VUELO: ahí el `ui-designer` puede corregir
// ahora, así que bloquea. El barrido completo sobre contratos ya cerrados informa y no bloquea:
// varios citan legítimamente copy que dicta el contrato de un feature anterior.
const enVuelo = process.argv.length > 2;

if (all.length) {
  const canal = enVuelo ? console.error : console.warn;
  canal(`${enVuelo ? "✗" : "⚠"} criterios que exigen un copy que el documento no dicta (${all.length}):\n`);
  for (const f of all) {
    canal(`  ${f.path}:${f.line}`);
    canal(`     exige: «${f.span}»`);
    canal(`     no está en el copy: ${f.missing.map((s) => `«${s}»`).join(", ")}`);
    canal(`     criterio: ${f.text}`);
  }
  canal("\nCede el criterio, no el copy: el copy es la decisión de producto. Lo corrige el");
  canal("`ui-designer` en su documento; el implementer no improvisa el arreglo. Ficha: E-016.");
  if (enVuelo) process.exit(1);
}
const resumen = `${files.length} contratos de diseño, ${examined} subcadenas exigidas comprobadas`;
console.log(all.length
  ? `⚠ ${resumen}: ${all.length} no aparecen en el copy que su documento dicta (contratos ya cerrados, no bloquean)`
  : `✓ ${resumen}: todas aparecen en el copy dictado`);
if (examined === 0) {
  console.error("✗ 0 aserciones comprobadas: el repaso no examinó nada y este verde no prueba nada.");
  process.exit(1);
}
