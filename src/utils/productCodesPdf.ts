import jsPDF from "jspdf";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import { ICodigoProducto } from "@/schemas/codigoProducto";

export async function generateProductCodesPDF(
  nombre: string,
  codigosProducto: ICodigoProducto[],
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "A4",
  });
  const padding = 24;
  const codeHeight = 60;
  const qrSize = 60;
  let y = padding;

  for (const codigo of codigosProducto) {
    // Barcode as PNG (bwip-js to canvas, then to dataURL)
    const canvas = document.createElement("canvas");
    try {
      bwipjs.toCanvas(canvas, {
        bcid: "code128",
        text: codigo.codigo,
        scale: 2,
        height: codeHeight,
        includetext: true,
        textxalign: "center",
      });
    } catch (e) {
      console.error(e);
      // fallback: skip this code
      continue;
    }
    const barcodeDataUrl = canvas.toDataURL("image/png");

    // QR as PNG (qrcode toDataURL)
    const qrDataUrl = await QRCode.toDataURL(codigo.codigo, {
      width: qrSize,
      margin: 0,
    });

    // Draw barcode
    doc.addImage(barcodeDataUrl, "PNG", padding, y, 180, codeHeight + 20);
    // Draw QR
    doc.addImage(qrDataUrl, "PNG", padding + 200, y, qrSize, qrSize);
    // Draw code text
    doc.setFontSize(12);
    doc.text(codigo.codigo, padding + 200 + qrSize + 16, y + qrSize / 2 + 8);
    // Space for cutting
    y += Math.max(codeHeight + 32, qrSize + 32);
    if (y > 750) {
      doc.addPage();
      y = padding;
    }
  }
  doc.save(`codigos_${nombre.replace(/\s+/g, "_")}.pdf`);
}
