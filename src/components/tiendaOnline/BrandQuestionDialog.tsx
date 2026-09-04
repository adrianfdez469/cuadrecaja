"use client";

import { useState } from "react";
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";

import { AppDialog } from "@/components/AppDialog";
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONES,
  buildSupportWhatsAppUrl,
} from "@/constants/support";
import { shape, touch } from "@/theme/tokens";

export interface BrandQuestionDialogProps {
  open: boolean;
  /** Shown only in option A, and only when there is nothing to reach the store by. */
  showNoContactWarning: boolean;
  onClose: () => void;
  onPublish: () => void;
}

type BrandChoice = "own" | "join";

const [PRIMARY_SUPPORT_PHONE] = SUPPORT_PHONES;

/**
 * The question asked once, before the first publish.
 *
 * Option B calls NO endpoint and changes nothing: grouping locals under one
 * storefront is a manual, irreversible operation on the online store's own
 * panel, and there is no way to automate it. What this dialog offers is the
 * question and the way to ask a human — never a control that pretends to group.
 */
export function BrandQuestionDialog({
  open,
  showNoContactWarning,
  onClose,
  onPublish,
}: Readonly<BrandQuestionDialogProps>) {
  const [choice, setChoice] = useState<BrandChoice>("own");

  const joinSupportUrl = buildSupportWhatsAppUrl(
    PRIMARY_SUPPORT_PHONE.whatsapp,
    "tiendaOnlineAgrupar",
  );

  const handleConfirm = () => {
    if (choice === "own") {
      onPublish();
      return;
    }
    window.open(joinSupportUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  const optionSx = (value: BrandChoice) => ({
    minHeight: touch.rowLarge,
    borderRadius: `${shape.radius.md}px`,
    border: "1px solid",
    borderColor:
      choice === value ? "semantic.hue.accent.main" : "semantic.surface.border",
    bgcolor: choice === value ? "semantic.hue.accent.surface" : "transparent",
    px: 1.5,
    py: 1,
    m: 0,
    width: "100%",
    alignItems: "flex-start",
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="¿Cómo va a aparecer este local?"
      subtitle="Se responde una sola vez, antes de publicar por primera vez."
      confirm={{
        label: choice === "own" ? "Publicar el local" : "Escribir a soporte",
        onClick: handleConfirm,
      }}
    >
      <RadioGroup
        value={choice}
        onChange={(event) => setChoice(event.target.value as BrandChoice)}
      >
        <Stack spacing={1.5}>
          <FormControlLabel
            value="own"
            control={<Radio />}
            sx={optionSx("own")}
            label={
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Abre su propia tienda
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary" }}
                >
                  Este local va a tener su propia dirección y su propia página.
                  Es lo que hace casi todo el mundo.
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="join"
            control={<Radio />}
            sx={optionSx("join")}
            label={
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Se suma a una tienda que ya publicaste
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary" }}
                >
                  Este local pasaría a ser una sucursal más de una tienda que tu
                  negocio ya tiene publicada, bajo una sola dirección.
                </Typography>
              </Box>
            }
          />
        </Stack>
      </RadioGroup>

      {choice === "join" && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: `${shape.radius.md}px`,
            bgcolor: "semantic.hue.caution.surface",
            color: "semantic.hue.caution.main",
          }}
        >
          {/*
           * The warning names the operation "Agrupar" on purpose, and the
           * design contract fixes this wording (§5): acceptance criterion 6
           * requires warning that GROUPING is manual and irreversible, and a
           * warning cannot avoid naming the thing it warns about. What is
           * forbidden is a CONTROL called `Agrupar`/`Unir`/`Fusionar`, and any
           * string that claims a result that did not happen.
           */}
          <Typography variant="body2">
            <b>Esto no lo hace Cuadre de Caja.</b> Agrupar locales bajo una
            misma tienda es un <b>trámite manual</b> que hace el equipo de la
            tienda online, y <b>no se puede deshacer</b>: una vez agrupados, no
            hay forma de separarlos.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Este local no se va a publicar ahora. Escríbeles para pedirlo.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Si prefieres, publica este local por su cuenta hoy y pide la
            agrupación más adelante: se puede hacer después.
          </Typography>
          <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
            {`O escribe a ${SUPPORT_EMAIL}.`}
          </Typography>
        </Box>
      )}

      {choice === "own" && showNoContactWarning && (
        <Typography
          variant="body2"
          sx={{ mt: 2, color: "semantic.text.secondary" }}
        >
          Tu tienda va a aparecer sin dirección ni forma de contacto. Puedes
          agregarlas después.
        </Typography>
      )}
    </AppDialog>
  );
}

export default BrandQuestionDialog;
