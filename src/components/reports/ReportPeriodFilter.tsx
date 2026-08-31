"use client";

import {
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Refresh } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { Dayjs } from "dayjs";
import type { IReportPeriod } from "@/schemas/reports/common";
import { shape } from "@/theme";
import { DisplayCurrencySelect } from "./DisplayCurrencySelect";

type ReportPeriodFilterProps = {
  periodo: IReportPeriod;
  onPeriodoChange: (periodo: IReportPeriod) => void;
  fechaInicio: Dayjs | null;
  fechaFin: Dayjs | null;
  onFechaInicioChange: (value: Dayjs | null) => void;
  onFechaFinChange: (value: Dayjs | null) => void;
  onRefresh: () => void;
  loading?: boolean;
  ready?: boolean;
  displayCurrency?: string;
  onDisplayCurrencyChange?: (currency: string) => void;
  availableCurrencies?: string[];
};

const PERIOD_OPTIONS: {
  value: IReportPeriod;
  label: string;
  shortLabel: string;
}[] = [
  { value: "dia", label: "Día", shortLabel: "Día" },
  { value: "semana", label: "Semana", shortLabel: "Sem." },
  { value: "mes", label: "Mes", shortLabel: "Mes" },
  { value: "anio", label: "Año", shortLabel: "Año" },
  {
    value: "personalizado",
    label: "Personalizado",
    shortLabel: "Pers.",
  },
];

/**
 * The period/currency/refresh control bar, lifted out of the dashboard page so
 * every report offers the same filtering behaviour.
 */
export function ReportPeriodFilter({
  periodo,
  onPeriodoChange,
  fechaInicio,
  fechaFin,
  onFechaInicioChange,
  onFechaFinChange,
  onRefresh,
  loading = false,
  ready = true,
  displayCurrency,
  onDisplayCurrencyChange,
  availableCurrencies = [],
}: ReportPeriodFilterProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Stack spacing={1.5} sx={{ width: "100%" }}>
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={1.5}
        alignItems={isMobile ? "stretch" : "center"}
      >
        <ToggleButtonGroup
          value={periodo}
          exclusive
          onChange={(_, value) =>
            value && onPeriodoChange(value as IReportPeriod)
          }
          sx={{
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: `${shape.radius.md}px`,
            "& .MuiToggleButtonGroup-grouped": {
              border: 0,
              borderRadius: `${shape.radius.md}px`,
            },
            "& .MuiToggleButton-root": {
              flex: isMobile ? 1 : "unset",
              minHeight: 44,
              px: 2,
              fontSize: "0.875rem",
              fontWeight: 600,
              textTransform: "none",
              color: "text.secondary",
              whiteSpace: "nowrap",
              "&.Mui-selected": {
                bgcolor: "semantic.hue.accent.surface",
                color: "semantic.hue.accent.main",
                fontWeight: 700,
                "&:hover": { bgcolor: "semantic.hue.accent.surface" },
              },
            },
          }}
        >
          {PERIOD_OPTIONS.map(({ value, label, shortLabel }) => (
            <ToggleButton key={value} value={value}>
              {isMobile ? shortLabel : label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ ml: isMobile ? 0 : "auto" }}
        >
          {displayCurrency && onDisplayCurrencyChange && (
            <DisplayCurrencySelect
              value={displayCurrency}
              onChange={onDisplayCurrencyChange}
              currencies={availableCurrencies}
            />
          )}

          <Tooltip title="Actualizar datos">
            <span>
              <IconButton
                onClick={onRefresh}
                disabled={loading || !ready}
                color="primary"
                size="small"
              >
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {periodo === "personalizado" && (
        <Stack direction="row" spacing={1} alignItems="center">
          <DatePicker
            label="Desde"
            value={fechaInicio}
            onChange={onFechaInicioChange}
            slotProps={{ textField: { fullWidth: true, size: "small" } }}
          />
          <DatePicker
            label="Hasta"
            value={fechaFin}
            onChange={onFechaFinChange}
            slotProps={{ textField: { fullWidth: true, size: "small" } }}
          />
        </Stack>
      )}
    </Stack>
  );
}
