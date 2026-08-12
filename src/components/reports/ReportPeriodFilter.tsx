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
import {
  CalendarMonth,
  DateRange,
  Refresh,
  ShowChart,
  Today,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { Dayjs } from "dayjs";
import type { IReportPeriod } from "@/schemas/reports/common";
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
  icon: typeof Today;
}[] = [
  { value: "dia", label: "Día", shortLabel: "Día", icon: Today },
  { value: "semana", label: "Semana", shortLabel: "Sem.", icon: ShowChart },
  { value: "mes", label: "Mes", shortLabel: "Mes", icon: CalendarMonth },
  { value: "anio", label: "Año", shortLabel: "Año", icon: CalendarMonth },
  {
    value: "personalizado",
    label: "Personalizado",
    shortLabel: "Pers.",
    icon: DateRange,
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
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="flex-end"
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

      <ToggleButtonGroup
        value={periodo}
        exclusive
        onChange={(_, value) =>
          value && onPeriodoChange(value as IReportPeriod)
        }
        size="small"
        color="primary"
        sx={{
          bgcolor: "background.paper",
          boxShadow: 1,
          "& .MuiToggleButton-root": {
            flex: isMobile ? 1 : "unset",
            px: 1,
            py: 0.75,
            fontSize: "0.7rem",
            whiteSpace: "nowrap",
          },
        }}
      >
        {PERIOD_OPTIONS.map(({ value, label, shortLabel, icon: Icon }) => (
          <ToggleButton key={value} value={value}>
            <Icon sx={{ mr: 0.5, fontSize: 18 }} />
            {isMobile ? shortLabel : label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

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
