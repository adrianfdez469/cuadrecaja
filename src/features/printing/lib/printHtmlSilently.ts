import { TICKET_PRINT_ROOT_ID } from "./ticketPrintHtml";

const CLEANUP_FALLBACK_MS = 3000;
const PX_PER_MM = 96 / 25.4;
const HEIGHT_BUFFER_MM = 1;

export interface IPrintHtmlSilentlyOptions {
  paperWidthMm?: 58 | 80;
}

function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  ).then(() => undefined);
}

function measureTicketHeightMm(doc: Document): number {
  const root =
    doc.getElementById(TICKET_PRINT_ROOT_ID) ?? doc.body;

  const heightPx = Math.ceil(
    Math.max(root.scrollHeight, root.offsetHeight, root.clientHeight),
  );

  return Math.max(25, Math.ceil(heightPx / PX_PER_MM) + HEIGHT_BUFFER_MM);
}

function applyMeasuredPageSize(doc: Document, paperWidthMm: number): number {
  const heightMm = measureTicketHeightMm(doc);
  const widthIn = (paperWidthMm / 25.4).toFixed(4);
  const heightIn = (heightMm / 25.4).toFixed(4);

  doc.querySelector("style[data-ticket-print]")?.remove();

  const style = doc.createElement("style");
  style.setAttribute("data-ticket-print", "1");
  style.textContent = `
    @page {
      size: ${widthIn}in ${heightIn}in;
      margin: 0;
    }
    @media print {
      html {
        width: ${paperWidthMm}mm !important;
        height: ${heightMm}mm !important;
        max-height: ${heightMm}mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      body {
        width: ${paperWidthMm}mm !important;
        height: ${heightMm}mm !important;
        max-height: ${heightMm}mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      #${TICKET_PRINT_ROOT_ID} {
        width: ${paperWidthMm}mm !important;
        max-height: ${heightMm}mm !important;
        overflow: hidden !important;
      }
    }
  `;
  doc.head.appendChild(style);

  return heightMm;
}

function iframeLayoutStyle(paperWidthMm: number): string {
  const widthPx = Math.round(paperWidthMm * PX_PER_MM);
  return [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${widthPx}px`,
    "height:auto",
    "border:0",
    "visibility:hidden",
    "overflow:hidden",
  ].join(";");
}

/**
 * Imprime HTML sin abrir ventana emergente (iframe oculto).
 * Compatible con Chrome --kiosk-printing para impresión directa a la predeterminada.
 */
export function printHtmlSilently(
  html: string,
  options: IPrintHtmlSilentlyOptions = {},
): Promise<void> {
  const paperWidthMm = options.paperWidthMm ?? 58;

  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Impresión no disponible en este entorno"));
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = iframeLayoutStyle(paperWidthMm);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      iframe.parentNode?.removeChild(iframe);
      resolve();
    };

    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      reject(new Error("No se pudo preparar la impresión"));
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();

    const runPrint = () => {
      try {
        applyMeasuredPageSize(win.document, paperWidthMm);
        win.onafterprint = cleanup;
        win.focus();
        win.print();
      } catch (error) {
        cleanup();
        reject(
          error instanceof Error ? error : new Error("Error al imprimir ticket"),
        );
        return;
      }
      setTimeout(cleanup, CLEANUP_FALLBACK_MS);
    };

    void waitForImages(win.document).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(runPrint);
      });
    });
  });
}
