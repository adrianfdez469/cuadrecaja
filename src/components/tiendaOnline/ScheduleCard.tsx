"use client";

import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Schedule } from "@mui/icons-material";

import { AppDialog } from "@/components/AppDialog";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import type {
  IOpeningHours,
  IOpeningHoursIssue,
} from "@/schemas/qabOpeningHours";
import { shape, touch } from "@/theme/tokens";

import {
  describeStructuralIssue,
  emptyOpeningHours,
  isClosedAllWeek,
} from "./openingHoursCopy";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";

export interface ScheduleCardProps {
  /** The draft. `null` means «no calendar configured», NOT «seven closed days». */
  value: IOpeningHours | null;
  /** The rules the DRAFT breaks. Empty while the draft is a valid calendar. */
  issues: IOpeningHoursIssue[];
  /**
   * The rules the STORED calendar breaks. Non-empty only for a value written
   * before this feature existed: the column accepted any JSON.
   */
  storedIssues: IOpeningHoursIssue[];
  isMobile: boolean;
  focusFirstIssueNonce: number;
  onChange: (next: IOpeningHours | null) => void;
}

const CARD_TITLE = "Horario semanal";

/**
 * The calendar card, in its three states: not configured, editable, and
 * unreadable-as-stored.
 *
 * «Not configured» and «seven closed days» are DIFFERENT things and the card
 * says so: the first omits the `openingHours` key, which leaves the online
 * store's own column untouched; the second sends seven empty days, which shows
 * the local as always closed.
 */
export function ScheduleCard({
  value,
  issues,
  storedIssues,
  isMobile,
  focusFirstIssueNonce,
  onChange,
}: Readonly<ScheduleCardProps>) {
  const [removeOpen, setRemoveOpen] = useState(false);

  // The stored value is unusable AND the merchant has not started over yet.
  const structural = value === null && storedIssues.length > 0;

  return (
    <ContentCard title={CARD_TITLE} spaceButton>
      {structural && (
        <Stack spacing={1.5}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${shape.radius.md}px`,
              bgcolor: "semantic.hue.negative.surface",
              color: "semantic.hue.negative.main",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              El horario guardado no se puede enviar a la tienda online.
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {describeStructuralIssue(storedIssues[0], storedIssues)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              No se puede editar tal cual está: hay que configurarlo de nuevo.
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            Mientras tanto, Cuadre de Caja no envía ningún horario y el que tenga
            tu tienda online se queda como está.
          </Typography>
          <Box>
            <Button
              variant="outlined"
              onClick={() => onChange(emptyOpeningHours())}
              sx={{ minHeight: touch.min }}
            >
              Configurar el horario de nuevo
            </Button>
          </Box>
        </Stack>
      )}

      {!structural && value === null && (
        <EmptyState
          variant="empty"
          size="compact"
          icon={<Schedule sx={{ fontSize: "inherit" }} />}
          title="Todavía no configuraste un horario"
          description="Sin horario, tu tienda online no muestra ninguno. Puedes configurarlo ahora o dejarlo para después."
          action={{
            label: "Configurar el horario",
            onClick: () => onChange(emptyOpeningHours()),
          }}
        />
      )}

      {value !== null && (
        <Stack spacing={2}>
          {isClosedAllWeek(value) && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: `${shape.radius.md}px`,
                bgcolor: "semantic.hue.caution.surface",
                color: "semantic.hue.caution.main",
              }}
            >
              <Typography variant="body2">
                Con los siete días cerrados, tu tienda online te va a mostrar
                como cerrado siempre.
              </Typography>
            </Box>
          )}

          <WeeklyScheduleEditor
            value={value}
            issues={issues}
            isMobile={isMobile}
            focusFirstIssueNonce={focusFirstIssueNonce}
            onChange={onChange}
            onRemove={() => setRemoveOpen(true)}
          />
        </Stack>
      )}

      <AppDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Quitar el horario"
        confirm={{
          label: "Quitar el horario",
          onClick: () => {
            onChange(null);
            setRemoveOpen(false);
          },
        }}
      >
        <Typography variant="body2">
          Quitar el horario hace que Cuadre de Caja <b>deje de enviarlo</b>. El
          que tu tienda online tenga ahora mismo <b>se queda como está</b>: esto
          no lo borra de allá.
        </Typography>
      </AppDialog>
    </ContentCard>
  );
}

export default ScheduleCard;
