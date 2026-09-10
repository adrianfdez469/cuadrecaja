"use client";

import { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import { AppDialog } from "@/components/AppDialog";
import { squareIconButtonSx } from "@/theme";
import {
  countFiltrosActivos,
  describeFiltros,
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
} from "@/constants/cuentasPorCobrar";
import { AGING_BUCKET_OPTIONS } from "@/lib/cuentasPorCobrar/panel";
import type { IFiltroOpciones } from "@/lib/cuentasPorCobrar/panel";
import type { ICuentasPorCobrarFiltros } from "@/schemas/cuentasPorCobrarPanel";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

/** The value a `Select` shows for "no filter". `undefined` is not a valid MUI value. */
const TODOS = "";

interface FiltrosDeudoresProps {
  filtros: ICuentasPorCobrarFiltros;
  opciones: IFiltroOpciones;
  onChange: (filtros: ICuentasPorCobrarFiltros) => void;
  isMobile: boolean;
}

/**
 * The four filters of the panel, and the way out of them.
 *
 * Under 600 px they live in a dialog and the clear control sits OUTSIDE it, so the list can be
 * unfiltered without opening anything. From 600 px up they are inline and the clear control is a
 * square icon button, present always and disabled when there is nothing to clear.
 */
export function FiltrosDeudores({
  filtros,
  opciones,
  onChange,
  isMobile,
}: FiltrosDeudoresProps) {
  const [dialogAbierto, setDialogAbierto] = useState(false);

  const activos = countFiltrosActivos(filtros);
  const resumen = describeFiltros(filtros, opciones);

  const set = (patch: Partial<ICuentasPorCobrarFiltros>) =>
    onChange({ ...filtros, ...patch });

  const limpiar = () => onChange({});

  const selects = (
    <>
      <FormControl sx={{ minWidth: 180, flex: isMobile ? "none" : 1 }}>
        <InputLabel id="cc-cxc-filtro-deudor">{COPY.filtroDeudor}</InputLabel>
        <Select
          labelId="cc-cxc-filtro-deudor"
          label={COPY.filtroDeudor}
          value={filtros.clienteId ?? TODOS}
          onChange={(e) =>
            set({ clienteId: e.target.value ? e.target.value : undefined })
          }
        >
          <MenuItem value={TODOS}>{COPY.filtroTodos}</MenuItem>
          {opciones.deudores.map((opcion) => (
            <MenuItem key={opcion.id} value={opcion.id}>
              {opcion.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 180, flex: isMobile ? "none" : 1 }}>
        <InputLabel id="cc-cxc-filtro-tienda">{COPY.filtroTienda}</InputLabel>
        <Select
          labelId="cc-cxc-filtro-tienda"
          label={COPY.filtroTienda}
          value={filtros.tiendaId ?? TODOS}
          onChange={(e) =>
            set({ tiendaId: e.target.value ? e.target.value : undefined })
          }
        >
          <MenuItem value={TODOS}>{COPY.filtroTodas}</MenuItem>
          {opciones.tiendas.map((opcion) => (
            <MenuItem key={opcion.id} value={opcion.id}>
              {opcion.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 180, flex: isMobile ? "none" : 1 }}>
        <InputLabel id="cc-cxc-filtro-antiguedad">
          {COPY.filtroAntiguedad}
        </InputLabel>
        <Select
          labelId="cc-cxc-filtro-antiguedad"
          label={COPY.filtroAntiguedad}
          value={filtros.antiguedad ?? TODOS}
          onChange={(e) =>
            set({ antiguedad: e.target.value ? e.target.value : undefined })
          }
        >
          <MenuItem value={TODOS}>{COPY.filtroTodos}</MenuItem>
          {/* Derived from AGING_BUCKETS: the cuts are never rewritten here (E-014). */}
          {AGING_BUCKET_OPTIONS.map((opcion) => (
            <MenuItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 180, flex: isMobile ? "none" : 1 }}>
        <InputLabel id="cc-cxc-filtro-estado">{COPY.filtroEstado}</InputLabel>
        <Select
          labelId="cc-cxc-filtro-estado"
          label={COPY.filtroEstado}
          value={filtros.estado ?? TODOS}
          onChange={(e) =>
            set({
              estado: e.target.value
                ? (e.target.value as ICuentasPorCobrarFiltros["estado"])
                : undefined,
            })
          }
        >
          <MenuItem value={TODOS}>{COPY.filtroTodos}</MenuItem>
          <MenuItem value="CON_DEUDA">{COPY.estadoConDeuda}</MenuItem>
          <MenuItem value="SALDADA">{COPY.estadoSaldada}</MenuItem>
        </Select>
      </FormControl>
    </>
  );

  if (isMobile) {
    return (
      <Box className={DOM.filtros} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            className={DOM.abrirFiltros}
            variant="outlined"
            size="large"
            startIcon={<FilterListIcon />}
            onClick={() => setDialogAbierto(true)}
            sx={{ flex: 1 }}
          >
            {COPY.filtrosAbrir}
          </Button>
          {activos > 0 && (
            <Button
              className={DOM.limpiarFiltros}
              variant="text"
              onClick={limpiar}
            >
              {COPY.filtrosLimpiar}
            </Button>
          )}
        </Stack>

        {resumen && (
          <Typography
            className={DOM.resumenFiltros}
            variant="caption"
            sx={{ display: "block", mt: 1, color: "semantic.text.secondary" }}
          >
            {resumen}
          </Typography>
        )}

        <AppDialog
          open={dialogAbierto}
          onClose={() => setDialogAbierto(false)}
          title={COPY.filtrosTitulo}
          cancelLabel="Cancelar"
          confirm={{
            label: COPY.filtrosAplicar,
            onClick: () => setDialogAbierto(false),
          }}
        >
          <Stack spacing={2}>
            {selects}
            {/*
              In the BODY and full width, never in `footerStart`: AppDialog paints footerStart in
              the same DialogActions row as Cancel and Confirm, with no flex-wrap, and at 320 px
              three texts in that row crush the two buttons.
            */}
            <Button variant="outlined" fullWidth onClick={limpiar}>
              {COPY.filtrosLimpiar}
            </Button>
          </Stack>
        </AppDialog>
      </Box>
    );
  }

  return (
    <Stack
      className={DOM.filtros}
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{ mb: 2, flexWrap: "wrap", rowGap: 1.5 }}
    >
      {selects}
      <Tooltip title={COPY.filtrosLimpiar}>
        <span>
          <IconButton
            className={DOM.limpiarFiltros}
            aria-label={COPY.filtrosLimpiar}
            onClick={limpiar}
            disabled={activos === 0}
            sx={squareIconButtonSx}
          >
            <FilterAltOffIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
