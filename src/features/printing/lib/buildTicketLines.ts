import {
  TICKET_FOOTER_URL,
  TICKET_MARKETING_QR_LABEL,
  TICKET_MARKETING_URL,
} from "@/constants/ticket";
import { convertFromBase } from "@/lib/currency";
import {
  ITicketPayload,
  ITicketRenderedLine,
} from "../types/ITicketData";
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

function center(text: string): ITicketRenderedLine {
  return { kind: "text", text, align: "center" };
}

function left(text: string): ITicketRenderedLine {
  return { kind: "text", text, align: "left" };
}

function qrLine(url: string): ITicketRenderedLine {
  return { kind: "qr", url, align: "center" };
}

function buildPaymentLines(payload: ITicketPayload, width: number): ITicketRenderedLine[] {
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
          padLine("Pago Efectivo", formatTicketAmount(payload.totalCash), width),
        ),
      );
    }
    if (payload.totalTransfer > 0) {
      lines.push(
        left(
          padLine("Pago Transf", formatTicketAmount(payload.totalTransfer), width),
        ),
      );
    }
  }

  const hasPayments =
    (payload.pagosDetalle?.length ?? 0) > 0 ||
    payload.totalCash > 0 ||
    payload.totalTransfer > 0;

  const vueltoItems =
    payload.vueltoDetalle?.filter((v) => v.monto > 0) ?? [];

  if (vueltoItems.length > 0) {
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
  }

  return lines;
}

function boldHeaderLabel(text: string): ITicketRenderedLine {
  return center(`** ${text} **`);
}

export function buildTicketLines(payload: ITicketPayload): ITicketRenderedLine[] {
  const { plantilla, monedaBase } = payload;
  const ancho = (plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
  const width = getCharsPerLine(ancho);
  const tasas = payload.tasaSnapshot ?? {};
  const lines: ITicketRenderedLine[] = [];

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

  if (
    plantilla.mostrarTasas &&
    payload.monedasParaTasas.length > 0
  ) {
    lines.push(left(fullSeparator(width, "=")));
    for (const moneda of payload.monedasParaTasas) {
      lines.push(left(formatTasaLine(moneda, tasas)));
    }
    lines.push(left(fullSeparator(width, "=")));
  }

  const productAmounts = payload.productos.flatMap((p) => [p.subtotal, p.precioUnitario]);
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
    left(padLine(`TOTAL ${monedaBase}`, formatTicketAmount(payload.total), width)),
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
        left(
          padLine(
            `TOTAL ${moneda}`,
            formatTicketAmount(converted),
            width,
          ),
        ),
      );
    }
  }

  lines.push(left(fullSeparator(width, "=")));

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
