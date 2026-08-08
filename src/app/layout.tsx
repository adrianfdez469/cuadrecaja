import { Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./Providers";

// A manually-rendered <meta name="viewport"> tag in a "use client" layout
// doesn't suppress Next's own automatic one — App Router injects its
// default viewport tag regardless unless a `viewport` export overrides it,
// so the two used to coexist (harmlessly, while their content matched).
// `interactiveWidget: "resizes-content"` needs this export specifically:
// without it, iOS Safari doesn't shrink the layout viewport when the
// on-screen keyboard opens, so `dvh`-sized layouts don't reflow around it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#1976d2" />
        <meta
          name="description"
          content="Sistema de punto de venta y gestión de inventario"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <Analytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
