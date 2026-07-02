/** HTML mínimo para imprimir ticket como texto (transporte browser / kiosk-printing). */
export function buildTicketPrintHtml(lines: string[]): string {
  const body = lines.map((line) => line.replace(/</g, "&lt;")).join("\n");
  return `<!DOCTYPE html>
<html><head><title>Ticket</title>
<style>
  body { font-family: monospace; font-size: 12px; margin: 8px; width: 58mm; }
  pre { margin: 0; white-space: pre-wrap; }
</style></head>
<body><pre>${body}</pre></body></html>`;
}
