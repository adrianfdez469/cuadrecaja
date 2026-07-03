const CLEANUP_FALLBACK_MS = 3000;
const PX_PER_MM = 96 / 25.4;

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

function applyMeasuredPageSize(doc: Document, paperWidthMm: number): void {
  const heightMm = Math.max(
    40,
    Math.ceil(doc.body.scrollHeight / PX_PER_MM) + 2,
  );

  doc.querySelector("style[data-ticket-print]")?.remove();

  const style = doc.createElement("style");
  style.setAttribute("data-ticket-print", "1");
  style.textContent = `
    @page {
      size: ${paperWidthMm}mm ${heightMm}mm;
      margin: 0;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 2mm !important;
        width: ${paperWidthMm}mm !important;
        max-width: ${paperWidthMm}mm !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }
    }
  `;
  doc.head.appendChild(style);
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
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";

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
