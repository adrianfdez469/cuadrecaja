"use client";

import { useState } from "react";
import { Alert, Button, Collapse, Divider, Stack, TextField, Typography } from "@mui/material";
import { SectionLabel } from "@/components/SectionLabel";
import {
  QAB_TOKEN_MAX_LENGTH,
  QAB_TOKEN_MIN_LENGTH,
} from "@/constants/qabProvisioning";
import { touch } from "@/theme/tokens";

export type QabTokenRescueDisclosureProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether there is already a stored credential, so the replacement is announced. */
  hasCredential: boolean;
  /** Resolves when the credential is stored; rejects with the route's failure. */
  onSave: (token: string) => Promise<void>;
  disabled: boolean;
}>;

const INVALID_TOKEN_MESSAGE =
  "Esa credencial no tiene la forma que espera QAB. Revisá que la pegaste completa, sin espacios ni saltos de línea.";

/**
 * The rescue path of acceptance criterion 13, and its PRESENTATION as an
 * exception rather than as the normal way in - which is itself part of the
 * criterion, so it is a piece with rules and not a loose `TextField`.
 *
 * Five structural rules: it sits last, it is collapsed (so no credential input
 * exists in the DOM until someone asks for it), its trigger is the only
 * `variant="text"` control of the panel, it never opens by itself, and the field
 * is a password with no control anywhere that reveals what it holds.
 */
export function QabTokenRescueDisclosure({
  open,
  onOpenChange,
  hasCredential,
  onSave,
  disabled,
}: QabTokenRescueDisclosureProps) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const close = () => {
    setToken("");
    setInvalid(false);
    onOpenChange(false);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setInvalid(false);
    try {
      await onSave(token);
      // Cleared the moment it is sent: it lives nowhere else.
      setToken("");
      onOpenChange(false);
    } catch {
      // The field keeps what was typed so it can be corrected, and the message
      // never quotes a single character of it.
      setInvalid(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Divider sx={{ my: 2.5 }} />
      <SectionLabel>Vía de rescate</SectionLabel>

      <Button
        variant="text"
        onClick={() => (open ? close() : onOpenChange(true))}
        disabled={disabled}
        sx={{ minHeight: touch.min }}
      >
        Pegar una credencial a mano
      </Button>

      <Typography
        variant="body2"
        sx={{ color: "semantic.text.secondary", mt: 0.5 }}
      >
        Solo hace falta cuando QAB rota la credencial de este negocio desde su terminal.
        El alta automática no rota nunca, así que en el camino normal este campo no se usa.
      </Typography>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Alert severity="warning">
            Usá esto solo cuando el equipo de QAB haya rotado la credencial de este
            negocio y te la haya pasado. No hay forma de recuperar una credencial ya
            acuñada: si se perdió, hay que pedir una rotación con corte.
          </Alert>

          {hasCredential && (
            <Alert severity="warning">
              Vas a reemplazar la credencial guardada de este negocio. La anterior deja
              de servir en cuanto guardes.
            </Alert>
          )}

          <TextField
            label="Credencial de QAB"
            type="password"
            fullWidth
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            error={invalid}
            helperText={
              invalid
                ? INVALID_TOKEN_MESSAGE
                : `Entre ${QAB_TOKEN_MIN_LENGTH} y ${QAB_TOKEN_MAX_LENGTH} caracteres, sin espacios.`
            }
          />

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={saving || token.length === 0}
              sx={{ minHeight: touch.min }}
            >
              {saving ? "Guardando…" : "Guardar credencial"}
            </Button>
            <Button
              variant="text"
              onClick={close}
              disabled={saving}
              sx={{ minHeight: touch.min }}
            >
              Cancelar
            </Button>
          </Stack>
        </Stack>
      </Collapse>
    </>
  );
}

export default QabTokenRescueDisclosure;
