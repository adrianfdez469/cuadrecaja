/**
 * Genera el golden de líneas del ticket a partir del fixture compartido.
 *
 * El golden es la verdad del POS web: el renderer Dart de la app Flutter lo
 * compara en `test/core/ticket/ticket_lines_golden_test.dart`. Si tocas el
 * layout del ticket, regenera el golden y cópialo al repo de la app; si las
 * dos implementaciones se separan, ese test lo canta.
 *
 *   npx tsx scripts/generate-ticket-golden.ts
 *
 * Ver `.claude/docs/IMPRESION.md` en el repo `cuadre_caja_app`.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildTicketLines } from "../src/features/printing/lib/buildTicketLines";
import {
  formatRenderedLine,
  getCharsPerLine,
  stripBoldMarkers,
} from "../src/features/printing/lib/ticketLayout";
import type { ITicketPayload } from "../src/features/printing/types/ITicketData";

const fixturePath = join(
  __dirname,
  "../src/features/printing/__fixtures__/ticketPayload.fixture.json",
);
const outPath = join(
  __dirname,
  "../src/features/printing/__fixtures__/ticketLines.golden.txt",
);

const payload = JSON.parse(readFileSync(fixturePath, "utf8")) as ITicketPayload;
const ancho = (payload.plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
const width = getCharsPerLine(ancho);

// Los marcadores `** … **` se quitan antes de centrar: en el ticket real son
// negrita (ESC E), no texto. El golden compara lo que se ve en el papel.
const lines = buildTicketLines(payload)
  .filter((l) => l.kind === "text")
  .map((l) =>
    formatRenderedLine(stripBoldMarkers(l.text).text, l.align, width),
  );

writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`${lines.length} líneas escritas en ${outPath}`);
