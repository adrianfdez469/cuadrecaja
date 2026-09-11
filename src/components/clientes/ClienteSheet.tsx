"use client";

import { useState } from "react";
import { Box, ButtonBase, InputAdornment, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
  BottomSheet,
  SHEET_ROW_SX,
  SheetRadio,
} from "@/app/pos/components/checkout/BottomSheet";
import SelectableTextField from "@/components/SelectableTextField";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { CLIENTES_COPY, CLIENTES_DOM } from "@/constants/clientes";
import { useClienteSearch } from "@/hooks/useClienteSearch";
import { ClienteCacheNotice } from "@/components/clientes/ClienteCacheNotice";
import { ClienteQuickCreate } from "@/components/clientes/ClienteQuickCreate";
import { ClienteSaldoAmount } from "@/components/clientes/ClienteSaldoAmount";
import { clienteCreateActionLabel } from "@/lib/clientes/clienteCopy";
import { normalizeClienteNombre } from "@/lib/clientes/clienteNombre";
import { CREDIT_CHECKOUT_COPY, CREDIT_DOM } from "@/constants/creditoVenta";
import type { IClienteOption } from "@/schemas/clienteSaldo";

export interface IClienteSheetProps {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (cliente: IClienteOption) => void;
  /**
   * Offline only: what to do with a typed name when no row can be created yet. When it is
   * given, the create action stays enabled with no connection and hands the typed term over
   * instead of POSTing it. When it is not, the sheet behaves EXACTLY as F-033 shipped it —
   * the action dimmed with CLIENTE_CREATE_BLOCK_COPY.offline beside it.
   *
   * It returns `void` and this sheet NEVER calls `onClose` from it: whoever owns the open
   * state closes, and only on the branch that accepts (contract § 6.2, D6). If the sheet
   * closed on a rejection the cashier would be left with no sheet, no name, no credit and a
   * notice in the opposite corner of the screen.
   */
  onNameOnly?: (nombre: string) => void;
}

/**
 * Picking a debtor with a thumb, standing up, with or without a connection.
 *
 * Built on the `BottomSheet` the checkout already has — no second bottom sheet — and it takes
 * neither the term nor the results by prop: it calls `useClienteSearch()` itself, so F-034
 * mounts it with these four props and nothing else (ADR 0113).
 *
 * There is no «Listo»: choosing a row already is finishing.
 */
export function ClienteSheet({
  open,
  onClose,
  selectedId,
  onSelect,
  onNameOnly,
}: Readonly<IClienteSheetProps>) {
  const {
    term,
    setTerm,
    results,
    loading,
    error,
    source,
    isOnline,
    canCreate,
    blockReason,
    createCliente,
  } = useClienteSearch();

  const [creating, setCreating] = useState(false);

  const choose = (cliente: IClienteOption) => {
    onSelect(cliente);
    onClose();
  };

  /**
   * With no connection AND a caller that knows what to do with a bare name, the create
   * action stays alive and hands the typed term over instead of POSTing it: that is the
   * whole of criterion 8 of F-034, and it is the only thing this component gains.
   *
   * Gated on being offline rather than on `blockReason === "offline"`: selling on credit
   * takes no permission (ADR 0119), and `resolveCreateAvailability` reports "sin-permiso"
   * ahead of "offline", so a cashier without `configuracion.clientes.acceder` would
   * otherwise be locked out of the very path the contract § 10.9 says they have.
   */
  const nameOnlyMode = Boolean(onNameOnly) && !isOnline;
  const nameOnlyEnabled = normalizeClienteNombre(term) !== "";

  return (
    <BottomSheet open={open} onClose={onClose} title={CLIENTES_COPY.selectorTitulo}>
      <Box
        component="section"
        aria-label={CLIENTES_COPY.selectorTitulo}
        className={CLIENTES_DOM.sheet}
      >
        {/* No `autoFocus`, and it is a decision: on a 320px phone the on-screen keyboard
            covers most of the sheet, and opening it focused turns "see who I can lend to"
            into "type something first". While the short create form is unfolded the field
            steps aside, so the sheet never shows two competing name inputs. */}
        {!creating && (
          <Box sx={{ px: 2, pt: 1, pb: 1.5 }}>
            <SelectableTextField
              fullWidth
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={CLIENTES_COPY.selectorBuscarPlaceholder}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        )}

        {source === "cache" && <ClienteCacheNotice />}

        {/* `ClienteQuickCreate` is F-033's and is NOT touched. Offline with `onNameOnly`,
            this sheet renders its own row in the same slot, with the same shape and the
            same location class, so the locators the qa already knows keep working. It does
            NOT unfold the short form: there is no row to write yet, and a phone number
            typed and silently discarded is worse than not asking for one. */}
        {nameOnlyMode ? (
          <Box>
            {nameOnlyEnabled ? (
              <ButtonBase
                className={CLIENTES_DOM.createAction}
                onClick={() => onNameOnly(term)}
                sx={{
                  ...SHEET_ROW_SX,
                  fontWeight: 600,
                  color: "semantic.hue.accent.main",
                }}
              >
                <PersonAddIcon
                  fontSize="small"
                  sx={{ color: "semantic.hue.accent.main" }}
                />
                {clienteCreateActionLabel(term)}
              </ButtonBase>
            ) : (
              <Box
                className={CLIENTES_DOM.createAction}
                aria-disabled="true"
                sx={{
                  ...SHEET_ROW_SX,
                  fontWeight: 600,
                  color: "semantic.text.disabled",
                  opacity: 0.6,
                  cursor: "default",
                }}
              >
                <PersonAddIcon
                  fontSize="small"
                  sx={{ color: "semantic.text.disabled" }}
                />
                {clienteCreateActionLabel(term)}
              </Box>
            )}
            {/* The reason lives OUTSIDE the row, as a sibling at full opacity: inside, the
                dimming would eat it. Two different classes for two different states, so a
                criterion can tell them apart. */}
            <Typography
              variant="body2"
              className={
                nameOnlyEnabled
                  ? CREDIT_DOM.nameOnlyNote
                  : CLIENTES_DOM.createReason
              }
              sx={{
                mt: 1,
                px: 2,
                opacity: 1,
                color: "semantic.text.secondary",
              }}
            >
              {nameOnlyEnabled
                ? CREDIT_CHECKOUT_COPY.crearSinConexionEnVenta
                : CREDIT_CHECKOUT_COPY.crearSinNombreEnVenta}
            </Typography>
          </Box>
        ) : (
          <ClienteQuickCreate
            variant="sheet"
            term={term}
            canCreate={canCreate}
            blockReason={blockReason}
            onCreate={createCliente}
            onCreated={choose}
            onExpandedChange={setCreating}
          />
        )}

        {!creating && (
          <Box>
            {loading && (
              <Box sx={{ px: 2, py: 2 }}>
                <LoadingState variant="list" count={4} />
              </Box>
            )}

            {!loading && error && (
              <Typography
                variant="body2"
                sx={{ px: 2, py: 2, color: "semantic.hue.negative.main" }}
              >
                {error}
              </Typography>
            )}

            {!loading && !error && results.length === 0 && term.trim() !== "" && (
              <EmptyState
                variant="no-results"
                size="compact"
                title={CLIENTES_COPY.selectorSinResultadosTitulo}
                description={CLIENTES_COPY.selectorSinResultadosDescripcion}
              />
            )}

            {!loading && !error && results.length === 0 && term.trim() === "" && (
              <EmptyState
                variant="empty"
                size="compact"
                title={CLIENTES_COPY.selectorSinClientes}
              />
            )}

            {!loading &&
              !error &&
              results.map((cliente) => (
                <ButtonBase
                  key={cliente.id}
                  className={CLIENTES_DOM.sheetRow}
                  onClick={() => choose(cliente)}
                  sx={{ ...SHEET_ROW_SX, py: 1 }}
                >
                  <SheetRadio on={cliente.id === selectedId} />
                  <Box sx={{ minWidth: 0, textAlign: "left" }}>
                    <Typography
                      component="span"
                      sx={{
                        display: "block",
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "semantic.text.primary",
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {cliente.nombre}
                    </Typography>
                    {cliente.telefono && (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{
                          display: "block",
                          color: "semantic.text.secondary",
                        }}
                      >
                        {cliente.telefono}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ ml: "auto", pl: 1 }}>
                    <ClienteSaldoAmount saldo={cliente.saldo} />
                  </Box>
                </ButtonBase>
              ))}
          </Box>
        )}
      </Box>
    </BottomSheet>
  );
}

export default ClienteSheet;
