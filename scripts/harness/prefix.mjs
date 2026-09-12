// El prefijo local del desarrollador. Va DELANTE de todo identificador nuevo del harness
// (ADR, ficha de error, feature) para que dos personas trabajando en paralelo no puedan
// crear el mismo. Ya pasó dos veces sin él: dos ADR con el número 0036, y cuatro features
// F-031..F-034 que hubo que renumerar al integrar.
//
// Vive en un fichero ignorado por git a propósito: si viajara en el repositorio, todos
// tendríamos el mismo prefijo y volveríamos al punto de partida.
import { readFileSync, writeFileSync } from "node:fs";

export const PREFIX_FILE = ".agents/.local-prefix";
// 2-12 caracteres, empieza por letra. Se conserva tal cual se escribió.
export const PREFIX_RE = /^[A-Za-z][A-Za-z0-9]{1,11}$/;

export class PrefijoAusente extends Error {}

export function leerPrefijo() {
  let bruto;
  try {
    bruto = readFileSync(PREFIX_FILE, "utf8");
  } catch {
    throw new PrefijoAusente(
      `No existe ${PREFIX_FILE}.\n\n` +
      `Ese fichero lleva TU prefijo, y sin él no se puede crear ningún identificador nuevo\n` +
      `del harness. No lo inventes: **pregúntaselo a la persona con la que trabajas** y créalo\n` +
      `con lo que responda:\n\n` +
      `    echo "<prefijo>" > ${PREFIX_FILE}\n\n` +
      `Entre 2 y 12 caracteres, empezando por letra (p. ej. sus iniciales). Está en .gitignore:\n` +
      `es de esta máquina y no se comparte.`,
    );
  }
  const p = bruto.trim();
  if (!PREFIX_RE.test(p)) {
    throw new PrefijoAusente(
      `El prefijo de ${PREFIX_FILE} no es válido: ${JSON.stringify(p)}.\n` +
      `Debe tener entre 2 y 12 caracteres, empezar por letra y llevar solo letras o dígitos.`,
    );
  }
  if (/^[EF]$/i.test(p)) {
    throw new PrefijoAusente(`El prefijo no puede ser «E» ni «F»: se confundiría con el tipo del identificador.`);
  }
  return p;
}

export function escribirPrefijo(p) {
  if (!PREFIX_RE.test(p)) throw new Error(`Prefijo inválido: ${JSON.stringify(p)}`);
  writeFileSync(PREFIX_FILE, p + "\n");
  return p;
}
