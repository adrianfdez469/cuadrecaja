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
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          background: "#f8fafc",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "480px" }}>
          <div
            style={{
              fontSize: "8rem",
              fontWeight: 700,
              color: "#d32f2f",
              opacity: 0.12,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            500
          </div>
          <h1 style={{ color: "#1a202c", margin: "0.5rem 0", fontSize: "1.75rem" }}>
            Error crítico
          </h1>
          <p style={{ color: "#718096", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Ocurrió un error inesperado en la aplicación. Recarga la página o intenta de nuevo.
          </p>
          {error.digest && (
            <p
              style={{
                color: "#9ca3af",
                fontSize: "0.8rem",
                marginBottom: "1.5rem",
                background: "#f1f5f9",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                display: "inline-block",
              }}
            >
              Código: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => (window.location.href = "/home")}
              style={{
                background: "transparent",
                color: "#1976d2",
                border: "1px solid #1976d2",
                borderRadius: "8px",
                padding: "10px 24px",
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
                background: "#1976d2",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 24px",
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
