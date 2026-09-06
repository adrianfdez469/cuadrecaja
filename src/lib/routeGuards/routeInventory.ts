/**
 * Reads the route-guard inventory and the real route tree, so a test can contrast one against the
 * other: a new `route.ts` that nobody classified breaks the suite (ADR 0079).
 *
 * Plain `.ts`: `node:fs` and `node:path` only — never Prisma, never `next/*`.
 */
import fs from "node:fs";
import path from "node:path";
import {
  ROUTE_GUARD_VERBS,
  routeGuardInventorySchema,
  type IRouteGuardEntry,
  type IRouteGuardInventory,
  type IRouteGuardVerb,
} from "@/schemas/routeGuards";

/** Root of the tree being inventoried. Relative to the repository root, never absolute (E-001). */
export const API_ROUTES_DIR = "src/app/api";

/** Name of the handler file that is recognised. */
export const ROUTE_FILE_NAME = "route.ts";

/** Location of the inventory itself, relative to the repository root. */
export const ROUTE_GUARD_INVENTORY_PATH =
  "src/constants/routeGuards/routeGuards.json";

export type IRouteHandlerVerbs = { route: string; verbs: IRouteGuardVerb[] };

/**
 * NORMATIVE EXTRACTION RULE: a file declares the verb `V` if and only if its text contains one of
 * these FOUR forms, with `V` in `ROUTE_GUARD_VERBS`:
 *
 *   1. `export async function V(`
 *   2. `export function V(`
 *   3. `export const V =`
 *   4. `export { ... as V ... }`   <- used by `auth/[...nextauth]/route.ts`, the only file in the
 *                                    tree that declares its verbs by re-exporting.
 *
 * Nothing else counts — and a form that appears only inside a comment or a string literal does not
 * count either: a commented-out handler is not a declared verb.
 */
function verbPatterns(verb: IRouteGuardVerb): RegExp[] {
  return [
    new RegExp(`export\\s+async\\s+function\\s+${verb}\\s*\\(`),
    new RegExp(`export\\s+function\\s+${verb}\\s*\\(`),
    new RegExp(`export\\s+const\\s+${verb}\\s*=`),
    new RegExp(`export\\s*\\{[^}]*\\bas\\s+${verb}\\b[^}]*\\}`),
  ];
}

/**
 * Blanks out comments and string literals, so a handler that only appears inside one is not read
 * as a declaration. A single left-to-right pass, because the naive "strip comments, then strings"
 * order breaks on a `//` inside a string and on a quote inside a comment.
 */
function stripCommentsAndStrings(source: string): string {
  let out = "";
  let i = 0;

  while (i < source.length) {
    const two = source.slice(i, i + 2);

    if (two === "//") {
      while (i < source.length && source[i] !== "\n") i += 1;
      out += " ";
      continue;
    }

    if (two === "/*") {
      i += 2;
      while (i < source.length && source.slice(i, i + 2) !== "*/") i += 1;
      i += 2;
      out += " ";
      continue;
    }

    const char = source[i];
    if (char === '"' || char === "'" || char === "`") {
      i += 1;
      while (i < source.length && source[i] !== char) {
        i += source[i] === "\\" ? 2 : 1;
      }
      i += 1;
      out += " ";
      continue;
    }

    out += char;
    i += 1;
  }

  return out;
}

/** The same rule, over a loose piece of source. It is what makes the extractor checkable. */
export function extractRouteVerbs(source: string): IRouteGuardVerb[] {
  const code = stripCommentsAndStrings(source);

  return ROUTE_GUARD_VERBS.filter((verb) =>
    verbPatterns(verb).some((pattern) => pattern.test(code)),
  );
}

function collectRouteFiles(
  rootDir: string,
  currentDir: string,
  found: string[],
): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      collectRouteFiles(rootDir, absolute, found);
    } else if (entry.isFile() && entry.name === ROUTE_FILE_NAME) {
      found.push(path.relative(rootDir, absolute).split(path.sep).join("/"));
    }
  }
}

/**
 * Walks `API_ROUTES_DIR` and returns, per file, the verbs it exports.
 *
 * `route` always comes out with `/` as separator and relative to `API_ROUTES_DIR`, so the JSON is
 * the same on any machine. Sorted by `route` and, within it, by the order of `ROUTE_GUARD_VERBS`.
 */
export function listRouteHandlerVerbs(rootDir?: string): IRouteHandlerVerbs[] {
  const root = rootDir ?? path.join(process.cwd(), API_ROUTES_DIR);

  const files: string[] = [];
  collectRouteFiles(root, root, files);
  files.sort((a, b) => a.localeCompare(b));

  return files.map((route) => ({
    route,
    verbs: extractRouteVerbs(fs.readFileSync(path.join(root, route), "utf8")),
  }));
}

/** Reads the JSON and validates it with `routeGuardInventorySchema`. Throws if it does not pass. */
export function readRouteGuardInventory(): IRouteGuardInventory {
  const absolute = path.join(process.cwd(), ROUTE_GUARD_INVENTORY_PATH);
  const raw = JSON.parse(fs.readFileSync(absolute, "utf8"));

  return routeGuardInventorySchema.parse(raw);
}

/** The entries with `corregidaPor === "F-021"`. The cases of criterion 6 come from here. */
export function correctedByF021(
  inventory: IRouteGuardInventory,
): IRouteGuardEntry[] {
  return inventory.filter((entry) => entry.corregidaPor === "F-021");
}

/** The `desprotegida` entries. Their count must equal `DESPROTEGIDAS_ABIERTAS` (ADR 0081). */
export function stillUnprotected(
  inventory: IRouteGuardInventory,
): IRouteGuardEntry[] {
  return inventory.filter((entry) => entry.clasificacion === "desprotegida");
}
