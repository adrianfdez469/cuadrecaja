import {
  TICKET_FEED_BLANK_LINES,
  TICKET_FEED_LEADING_LINES,
  TICKET_FOOTER_URL,
  TICKET_MARKETING_QR_LABEL,
  TICKET_MARKETING_URL,
} from "@/constants/ticket";
import { CREDIT_TICKET_COPY } from "@/constants/creditoVenta";
import { convertFromBase } from "@/lib/currency";
import { stripControlCharacters } from "@/utils/printableText";
import { ITicketPayload, ITicketRenderedLine } from "../types/ITicketData";
import {
  formatTicketAmount,
  formatRenderedLine,
  formatTasaLine,
  fullSeparator,
  getCharsPerLine,
  getPriceColumnWidth,
  padLine,
  wrapProductBlock,
} from "./ticketLayout";

const DEFAULT_PIE = "GRACIAS POR SU COMPRA";

function blankLine(): ITicketRenderedLine {
  return { kind: "text", text: "", align: "left" };
}

/** Avance de papel con marca visible (el spooler Windows recorta el vacío). */
function feedLine(marker: boolean): ITicketRenderedLine {
  return { kind: "feed", marker };
}

/**
 * The two module functions that build EVERY text line of the ticket, and therefore the one
 * place the control bytes are taken out (ADR 0120).
 *
 * Here and not at the customer's interpolation, for three reasons: it closes the whole class
 * in one place — `Cajero: …` carries Usuario.nombre, the product blocks carry the product
 * name and the footer carries `plantilla.pie`, none of which has a character bound and none
 * of which is F-034's; it covers what the schema cannot, because the `.refine` is an ENTRANCE
 * door and says nothing about rows written before it existed; and it is the cheapest place
 * F-034 is entitled to touch — `escpos/encoder.ts`, where the debt really lives, is not in
 * its list and is NOT touched.
 *
 * What this does NOT promise (E-017): it does not stop ESC bytes from reaching the printer —
 * `encodeTicketToEscPos` emits them on purpose to align, cut and draw the QR. What it
 * guarantees is that none of them comes from the text of a field.
 *
 * `blankLine`, `feedLine` and `qrLine` do not go through here and do not need to: they build
 * their own content.
 */
function center(text: string): ITicketRenderedLine {
  return { kind: "text", text: stripControlCharacters(text), align: "center" };
}

function left(text: string): ITicketRenderedLine {
  return { kind: "text", text: stripControlCharacters(text), align: "left" };
}

function qrLine(url: string): ITicketRenderedLine {
  return { kind: "qr", url, align: "center" };
}

function buildPaymentLines(
  payload: ITicketPayload,
  width: number,
): ITicketRenderedLine[] {
  const lines: ITicketRenderedLine[] = [];

  if (payload.pagosDetalle?.length) {
    for (const pago of payload.pagosDetalle) {
      const label = pago.tipo === "cash" ? "Pago Efectivo" : "Pago Transf";
      const right = `${formatTicketAmount(pago.monto)} ${pago.moneda}`;
      lines.push(left(padLine(label, right, width)));
    }
  } else {
    if (payload.totalCash > 0) {
      lines.push(
        left(
          padLine(
            "Pago Efectivo",
            formatTicketAmount(payload.totalCash),
            width,
          ),
        ),
      );
    }
    if (payload.totalTransfer > 0) {
      lines.push(
        left(
          padLine(
            "Pago Transf",
            formatTicketAmount(payload.totalTransfer),
            width,
          ),
        ),
      );
    }
  }

  const hasPayments =
    (payload.pagosDetalle?.length ?? 0) > 0 ||
    payload.totalCash > 0 ||
    payload.totalTransfer > 0;

  const vueltoItems = payload.vueltoDetalle?.filter((v) => v.monto > 0) ?? [];

  const tipTotal = payload.tipTotal ?? 0;
  const showTip = tipTotal > 0 && payload.plantilla.mostrarPropina;

  if (vueltoItems.length > 0 || showTip) {
    if (hasPayments) {
      lines.push(left(fullSeparator(width, "-")));
    }
    for (const v of vueltoItems) {
      lines.push(
        left(
          padLine(`Devuelto ${v.moneda}`, formatTicketAmount(v.monto), width),
        ),
      );
    }
    // Impresa aparte del total: el cliente debe poder ver que lo que dejó al
    // personal no formó parte del precio de lo que compró.
    if (showTip) {
      lines.push(left(padLine("Propina", formatTicketAmount(tipTotal), width)));
    }
  }

  return lines;
}

function boldHeaderLabel(text: string): ITicketRenderedLine {
  return center(`** ${text} **`);
}

export function buildTicketLines(
  payload: ITicketPayload,
): ITicketRenderedLine[] {
  const { plantilla, monedaBase } = payload;
  const ancho = (plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
  const width = getCharsPerLine(ancho);
  const tasas = payload.tasaSnapshot ?? {};
  const marcarLineasVacias = plantilla.marcarLineasVacias ?? true;
  const lines: ITicketRenderedLine[] = [];

  for (let i = 0; i < TICKET_FEED_LEADING_LINES; i++) {
    lines.push(feedLine(marcarLineasVacias));
  }

  lines.push(left(fullSeparator(width, "=")));

  if (plantilla.mostrarNegocio) {
    lines.push(boldHeaderLabel(payload.negocioNombre));
  }
  if (plantilla.mostrarTienda) {
    lines.push(boldHeaderLabel(payload.tiendaNombre));
  }
  lines.push(center(`VENTA EN ${monedaBase}`));
  lines.push(left(fullSeparator(width, "=")));
  lines.push(blankLine());

  if (payload.cajeroNombre) {
    lines.push(left(`Cajero: ${payload.cajeroNombre}`));
  }
  lines.push(left(`Fecha: ${payload.fechaCompleta}`));

  if (plantilla.mostrarTasas && payload.monedasParaTasas.length > 0) {
    lines.push(left(fullSeparator(width, "=")));
    for (const moneda of payload.monedasParaTasas) {
      lines.push(left(formatTasaLine(moneda, tasas)));
    }
    lines.push(left(fullSeparator(width, "=")));
  }

  const productAmounts = payload.productos.flatMap((p) => [
    p.subtotal,
    p.precioUnitario,
  ]);
  const priceColWidth = getPriceColumnWidth(productAmounts);

  lines.push(left(fullSeparator(width, "-")));
  for (const prod of payload.productos) {
    const block = wrapProductBlock(
      prod.cantidad,
      prod.nombre,
      prod.precioUnitario,
      prod.subtotal,
      width,
      priceColWidth,
    );
    for (const blockLine of block) {
      lines.push(left(blockLine));
    }
  }
  lines.push(left(fullSeparator(width, "-")));

  lines.push(
    left(padLine("Subtotal", formatTicketAmount(payload.subtotalBase), width)),
  );

  if (payload.discountTotal != null && payload.discountTotal > 0) {
    lines.push(
      left(
        padLine("Descuento", formatTicketAmount(payload.discountTotal), width),
      ),
    );
  }

  lines.push(left(fullSeparator(width, "-")));
  lines.push(
    left(
      padLine(`TOTAL ${monedaBase}`, formatTicketAmount(payload.total), width),
    ),
  );

  if (
    plantilla.mostrarTotalesSecundarios &&
    payload.monedasUsadasEnVenta.length > 0
  ) {
    for (const moneda of payload.monedasUsadasEnVenta) {
      const converted = convertFromBase(
        payload.total,
        moneda,
        tasas,
        monedaBase,
      );
      lines.push(
        left(padLine(`TOTAL ${moneda}`, formatTicketAmount(converted), width)),
      );
    }
  }

  lines.push(left(fullSeparator(width, "=")));

  // OUTSIDE the `mostrarMultimoneda` gate and with no template flag of its own: what a
  // customer owes is the receipt of the operation itself, not an optional section.
  //
  // The customer line uses the same mould as `Cajero: …` — free text on the left, no column
  // — because a long name does not fit a 32-character column; the balance uses `padLine`,
  // like `Propina` and `Descuento`.
  if (payload.creditoBase != null && payload.creditoBase > 0) {
    if (payload.clienteNombre) {
      lines.push(
        left(`${CREDIT_TICKET_COPY.clienteLabel}: ${payload.clienteNombre}`),
      );
    }
    lines.push(
      left(
        padLine(
          CREDIT_TICKET_COPY.saldoLabel,
          formatTicketAmount(payload.creditoBase),
          width,
        ),
      ),
    );
    lines.push(left(fullSeparator(width, "-")));
  }

  if (plantilla.mostrarMultimoneda) {
    const paymentLines = buildPaymentLines(payload, width);
    if (paymentLines.length > 0) {
      lines.push(...paymentLines);
      lines.push(left(fullSeparator(width, "-")));
    }
  }

  lines.push(blankLine());
  const pieText = plantilla.pie?.trim() || DEFAULT_PIE;
  lines.push(center(pieText));
  lines.push(blankLine());
  lines.push(center(TICKET_MARKETING_QR_LABEL));
  lines.push(qrLine(TICKET_MARKETING_URL));
  lines.push(center(TICKET_FOOTER_URL));
  lines.push(blankLine());
  lines.push(left(fullSeparator(width, "=")));

  for (let i = 0; i < TICKET_FEED_BLANK_LINES; i++) {
    lines.push(feedLine(marcarLineasVacias));
  }

  return lines;
}

/** Líneas de texto plano para preview / impresión navegador */
export function ticketLinesToStrings(
  rendered: ITicketRenderedLine[],
  width: number,
): string[] {
  return rendered
    .filter((line) => line.kind === "text")
    .map((line) => formatRenderedLine(line.text, line.align, width));
}
