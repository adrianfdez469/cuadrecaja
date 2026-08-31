"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global error boundary]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          background: "#F7F7FA",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div
          style={{ textAlign: "center", padding: "2rem", maxWidth: "480px" }}
        >
          <div
            style={{
              fontSize: "8rem",
              fontWeight: 700,
              color: "#A5382A",
              opacity: 0.12,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            500
          </div>
          <h1
            style={{
              color: "#131417",
              margin: "0.5rem 0",
              fontSize: "1.75rem",
              fontWeight: 700,
            }}
          >
            Error crítico
          </h1>
          <p
            style={{
              color: "#5F5E68",
              marginBottom: "1.5rem",
              lineHeight: 1.6,
              fontSize: "1rem",
            }}
          >
            Ocurrió un error inesperado en la aplicación. Recarga la página o
            intenta de nuevo.
          </p>
          {error.digest && (
            <p
              style={{
                color: "#5B5A63",
                fontSize: "0.8125rem",
                marginBottom: "1.5rem",
                background: "#F3F2F6",
                padding: "0.75rem 1rem",
                borderRadius: "12px",
                display: "inline-block",
                fontFamily: "monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Código: {error.digest}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => (window.location.href = "/home")}
              style={{
                background: "transparent",
                color: "#5B4CA8",
                border: "1px solid #5B4CA8",
                borderRadius: "12px",
                padding: "12px 24px",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ir al inicio
            </button>
            <button
              onClick={reset}
              style={{
                background: "#5B4CA8",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "12px",
                padding: "12px 24px",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
