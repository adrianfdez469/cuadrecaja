const CLEANUP_FALLBACK_MS = 2000;

/**
 * Imprime HTML sin abrir ventana emergente (iframe oculto).
 * Compatible con Chrome --kiosk-printing para impresión directa a la predeterminada.
 */
export function printHtmlSilently(html: string): Promise<void> {
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

    win.onafterprint = cleanup;

    requestAnimationFrame(() => {
      try {
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
    });
  });
}
