"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { ITicketPayload } from "../types/ITicketData";
import { buildTicketLines } from "../lib/buildTicketLines";
import { formatRenderedLine, getCharsPerLine } from "../lib/ticketLayout";
import { generateTicketMarketingQrDataUrl } from "../lib/generateTicketMarketingQr";

interface TicketPreviewContentProps {
  payload: ITicketPayload;
}

export const TicketPreviewContent: React.FC<TicketPreviewContentProps> = ({
  payload,
}) => {
  const ancho = (payload.plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
  const width = getCharsPerLine(ancho);
  const rendered = buildTicketLines(payload);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void generateTicketMarketingQrDataUrl().then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <Box
      sx={{
        bgcolor: "grey.100",
        p: 1.5,
        borderRadius: 1,
        fontFamily: "monospace",
        fontSize: 11,
        whiteSpace: "pre",
        overflowX: "auto",
        maxWidth: ancho === 80 ? 320 : 230,
        mx: "auto",
      }}
    >
      {rendered.map((line, i) => {
        if (line.kind === "qr") {
          return qrDataUrl ? (
            <Box key={i} sx={{ textAlign: "center", my: 0.5 }}>
              <Box
                component="img"
                src={qrDataUrl}
                alt="QR Cuadre de Caja"
                sx={{ width: 88, height: 88, imageRendering: "pixelated" }}
              />
            </Box>
          ) : (
            <Typography
              key={i}
              component="div"
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", fontFamily: "inherit", fontSize: "inherit" }}
            >
              [QR]
            </Typography>
          );
        }

        const text = formatRenderedLine(line.text, line.align, width);
        return (
          <Typography
            key={i}
            component="div"
            variant="body2"
            sx={{ fontFamily: "inherit", fontSize: "inherit", minHeight: "1.25em" }}
          >
            {text || "\u00A0"}
          </Typography>
        );
      })}
    </Box>
  );
};
