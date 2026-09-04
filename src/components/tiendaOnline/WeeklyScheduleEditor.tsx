"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { DeleteOutline } from "@mui/icons-material";

import {
  QAB_OPENING_HOURS_DAYS,
  QAB_OPENING_HOURS_END_OF_DAY,
  QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY,
} from "@/constants/qab";
import { TIENDA_ONLINE_UI } from "@/constants/tiendaOnline";
import { openingHoursMinutes } from "@/schemas/qabOpeningHours";
import type {
  IOpeningHours,
  IOpeningHoursDay,
  IOpeningHoursIssue,
  IOpeningHoursWindow,
} from "@/schemas/qabOpeningHours";
import { shape, touch } from "@/theme/tokens";

import {
  DAY_LABELS,
  canAddWindow,
  crossesMidnight,
  defaultWindow,
  describeWindowIssue,
  issueDay,
  issueField,
  issueWindowIndex,
  summarizeDay,
  summarizeIssue,
} from "./openingHoursCopy";

type TimeField = "from" | "to";

export interface WeeklyScheduleEditorProps {
  value: IOpeningHours;
  /** The coded rules the current draft breaks. The authority is the collector. */
  issues: IOpeningHoursIssue[];
  isMobile: boolean;
  /**
   * Bumped by the page when «Guardar cambios» is pressed while issues are
   * pending: the button is never disabled, so pressing it has to take the
   * merchant to the problem instead of doing nothing.
   */
  focusFirstIssueNonce: number;
  onChange: (next: IOpeningHours) => void;
  onRemove: () => void;
}

const DAY_LABEL_WIDTH = 110;
const TIME_FIELD_MIN_WIDTH = 130;

function fieldKey(day: IOpeningHoursDay, index: number, field: TimeField): string {
  return `${day}-${index}-${field}`;
}

/**
 * The seven-day editor.
 *
 * It owns the fold state, the issue summary and the focus jumps, so the card
 * around it stays a frame. What it never owns is the notion of validity: that
 * comes in as `issues`, collected by `collectOpeningHoursIssues` (ADR 0031).
 */
export function WeeklyScheduleEditor({
  value,
  issues,
  isMobile,
  focusFirstIssueNonce,
  onChange,
  onRemove,
}: Readonly<WeeklyScheduleEditorProps>) {
  const [expanded, setExpanded] = useState<IOpeningHoursDay[]>([]);
  const fieldRefs = useRef(new Map<string, HTMLInputElement>());
  const dayRefs = useRef(new Map<IOpeningHoursDay, HTMLDivElement>());

  const setDay = useCallback(
    (day: IOpeningHoursDay, windows: IOpeningHoursWindow[]) => {
      onChange({ ...value, days: { ...value.days, [day]: windows } });
    },
    [onChange, value],
  );

  const toggleExpanded = (day: IOpeningHoursDay) => {
    setExpanded((current) =>
      current.includes(day)
        ? current.filter((other) => other !== day)
        : [...current, day],
    );
  };

  const focusIssue = useCallback((issue: IOpeningHoursIssue) => {
    const day = issueDay(issue);
    if (day === null) return;

    setExpanded((current) => (current.includes(day) ? current : [...current, day]));
    dayRefs.current.get(day)?.scrollIntoView({ block: "center" });

    const index = issueWindowIndex(issue);
    const field = issueField(issue) ?? "from";
    if (index === null) return;
    // After the state update that expands the day, so the input exists.
    window.requestAnimationFrame(() => {
      fieldRefs.current.get(fieldKey(day, index, field))?.focus();
    });
  }, []);

  useEffect(() => {
    if (focusFirstIssueNonce === 0 || issues.length === 0) return;
    focusIssue(issues[0]);
  }, [focusFirstIssueNonce, focusIssue, issues]);

  const handleDayOpen = (day: IOpeningHoursDay, open: boolean) => {
    setDay(day, open ? [defaultWindow()] : []);
    if (open && !expanded.includes(day)) toggleExpanded(day);
  };

  const handleAddWindow = (day: IOpeningHoursDay) => {
    setDay(day, [...value.days[day], defaultWindow()]);
  };

  const handleRemoveWindow = (day: IOpeningHoursDay, index: number) => {
    setDay(
      day,
      value.days[day].filter((_, position) => position !== index),
    );
  };

  const handleTimeChange = (
    day: IOpeningHoursDay,
    index: number,
    field: TimeField,
    time: string,
  ) => {
    setDay(
      day,
      value.days[day].map((window, position) =>
        position === index ? { ...window, [field]: time } : window,
      ),
    );
  };

  const handleEndOfDay = (
    day: IOpeningHoursDay,
    index: number,
    checked: boolean,
  ) => {
    handleTimeChange(
      day,
      index,
      "to",
      // The ONLY path to "24:00" in the whole interface, and it exists only next
      // to `to`: that is what closes the `"24:00"` in `from` rule by
      // construction. `23:59` is never offered — it leaves a minute closed that
      // nobody asked for. Unchecking goes back to the default closing time, not
      // to `from`, which would be an empty window.
      checked ? QAB_OPENING_HOURS_END_OF_DAY : TIENDA_ONLINE_UI.defaultWindowTo,
    );
  };

  const handleSortDay = (day: IOpeningHoursDay) => {
    setDay(
      day,
      [...value.days[day]].sort((left, right) => {
        try {
          return openingHoursMinutes(left.from) - openingHoursMinutes(right.from);
        } catch {
          return 0;
        }
      }),
    );
  };

  const handleApplyToWeek = (day: IOpeningHoursDay) => {
    const source = value.days[day];
    const days = { ...value.days };
    for (const other of QAB_OPENING_HOURS_DAYS) {
      days[other] = source.map((window) => ({ ...window }));
    }
    onChange({ ...value, days });
  };

  return (
    <Stack spacing={2}>
      {issues.length > 0 && (
        <Box
          sx={{
            bgcolor: "semantic.hue.negative.surface",
            color: "semantic.hue.negative.main",
            borderRadius: `${shape.radius.md}px`,
            p: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {`El horario tiene ${issues.length} ${issues.length === 1 ? "problema" : "problemas"} y no se puede guardar todavía.`}
          </Typography>
          <Stack sx={{ mt: 0.5 }}>
            {issues.map((issue, position) => (
              <Button
                key={`${issue.code}-${issue.path.join(".")}-${position}`}
                variant="text"
                onClick={() => focusIssue(issue)}
                sx={{
                  justifyContent: "flex-start",
                  minHeight: touch.min,
                  color: "inherit",
                  textAlign: "left",
                  textTransform: "none",
                  px: 0.5,
                }}
              >
                {`· ${summarizeIssue(issue)}`}
              </Button>
            ))}
          </Stack>
        </Box>
      )}

      {QAB_OPENING_HOURS_DAYS.map((day) => {
        const windows = value.days[day];
        const open = windows.length > 0;
        const isExpanded = expanded.includes(day);
        const dayIssues = issues.filter((issue) => issueDay(issue) === day);

        return (
          <Box
            key={day}
            ref={(node: HTMLDivElement | null) => {
              if (node) dayRefs.current.set(day, node);
            }}
            sx={{
              border: "1px solid",
              borderColor: "semantic.surface.border",
              borderRadius: `${shape.radius.md}px`,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              sx={{ minHeight: touch.row, pr: 1 }}
            >
              <ButtonBase
                onClick={() => toggleExpanded(day)}
                aria-expanded={isExpanded}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: touch.row,
                  px: 1.5,
                  justifyContent: "flex-start",
                  borderRadius: `${shape.radius.md}px`,
                }}
              >
                <Stack
                  direction={isMobile ? "column" : "row"}
                  alignItems={isMobile ? "flex-start" : "center"}
                  spacing={isMobile ? 0 : 2}
                  sx={{ width: "100%", minWidth: 0, py: 0.5 }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 700,
                      color: "semantic.text.primary",
                      ...(isMobile ? {} : { width: DAY_LABEL_WIDTH, flexShrink: 0 }),
                    }}
                  >
                    {DAY_LABELS[day]}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: open
                        ? "semantic.text.secondary"
                        : "semantic.text.disabled",
                      minWidth: 0,
                      textAlign: "left",
                    }}
                  >
                    {summarizeDay(windows)}
                  </Typography>
                </Stack>
              </ButtonBase>
              <Switch
                checked={open}
                onChange={(event) => handleDayOpen(day, event.target.checked)}
                inputProps={{
                  "aria-label": `${open ? "Cerrar" : "Abrir"} el ${DAY_LABELS[day]}`,
                }}
              />
            </Stack>

            {isExpanded && open && (
              <Stack spacing={1.5} sx={{ px: 1.5, pb: 1.5 }}>
                {windows.map((window, index) => {
                  const windowIssues = dayIssues.filter(
                    (issue) => issueWindowIndex(issue) === index,
                  );
                  const endOfDay = window.to === QAB_OPENING_HOURS_END_OF_DAY;
                  const invalidFrom = windowIssues.some(
                    (issue) => issueField(issue) === "from",
                  );
                  const invalidTo = windowIssues.some(
                    (issue) => issueField(issue) === "to",
                  );

                  return (
                    <Box key={`${day}-${index}`}>
                      <Stack
                        direction={isMobile ? "column" : "row"}
                        spacing={1}
                        alignItems={isMobile ? "stretch" : "center"}
                      >
                        {isMobile && (
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Typography
                              variant="caption"
                              sx={{ color: "semantic.text.secondary" }}
                            >
                              {`Franja ${index + 1}`}
                            </Typography>
                            <IconButton
                              aria-label={`Borrar la franja ${index + 1} de ${DAY_LABELS[day]}`}
                              onClick={() => handleRemoveWindow(day, index)}
                              sx={{ width: touch.min, height: touch.min }}
                            >
                              <DeleteOutline />
                            </IconButton>
                          </Stack>
                        )}

                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            type="time"
                            size="small"
                            label="Abre"
                            value={window.from}
                            error={invalidFrom}
                            onChange={(event) =>
                              handleTimeChange(day, index, "from", event.target.value)
                            }
                            inputRef={(node: HTMLInputElement | null) => {
                              if (node) {
                                fieldRefs.current.set(
                                  fieldKey(day, index, "from"),
                                  node,
                                );
                              }
                            }}
                            sx={{ flex: 1, minWidth: TIME_FIELD_MIN_WIDTH }}
                          />
                          <Typography aria-hidden>–</Typography>
                          {endOfDay ? (
                            // Disabled and plain text on purpose: `24:00` is not
                            // representable in an `input[type="time"]`, whose
                            // ceiling is 23:59, and showing the real value beats
                            // showing an empty box.
                            <TextField
                              size="small"
                              label="Cierra"
                              value={QAB_OPENING_HOURS_END_OF_DAY}
                              disabled
                              sx={{ flex: 1, minWidth: TIME_FIELD_MIN_WIDTH }}
                            />
                          ) : (
                            <TextField
                              type="time"
                              size="small"
                              label="Cierra"
                              value={window.to}
                              error={invalidTo}
                              onChange={(event) =>
                                handleTimeChange(day, index, "to", event.target.value)
                              }
                              inputRef={(node: HTMLInputElement | null) => {
                                if (node) {
                                  fieldRefs.current.set(
                                    fieldKey(day, index, "to"),
                                    node,
                                  );
                                }
                              }}
                              sx={{ flex: 1, minWidth: TIME_FIELD_MIN_WIDTH }}
                            />
                          )}
                        </Stack>

                        <FormControlLabel
                          sx={{ minHeight: touch.min, ml: 0 }}
                          control={
                            <Checkbox
                              checked={endOfDay}
                              onChange={(event) =>
                                handleEndOfDay(day, index, event.target.checked)
                              }
                            />
                          }
                          label={
                            <Typography variant="body2">
                              hasta el final del día ({QAB_OPENING_HOURS_END_OF_DAY})
                            </Typography>
                          }
                        />

                        {!isMobile && (
                          <IconButton
                            aria-label={`Borrar la franja ${index + 1} de ${DAY_LABELS[day]}`}
                            onClick={() => handleRemoveWindow(day, index)}
                            sx={{ width: touch.min, height: touch.min }}
                          >
                            <DeleteOutline />
                          </IconButton>
                        )}
                      </Stack>

                      {crossesMidnight(window) && (
                        <Box
                          sx={{
                            mt: 1,
                            p: 1,
                            borderRadius: `${shape.radius.sm}px`,
                            bgcolor: "semantic.hue.info.surface",
                            color: "semantic.hue.info.main",
                          }}
                        >
                          <Typography variant="body2">
                            {`Cruza la medianoche: cierra a las ${window.to} del día siguiente.`}
                          </Typography>
                        </Box>
                      )}

                      {windowIssues.map((issue, position) => (
                        <Typography
                          key={`${issue.code}-${position}`}
                          variant="body2"
                          sx={{ mt: 1, color: "semantic.hue.negative.main" }}
                        >
                          {describeWindowIssue(issue, windows)}
                        </Typography>
                      ))}
                    </Box>
                  );
                })}

                {dayIssues
                  .filter((issue) => issueWindowIndex(issue) === null)
                  .map((issue, position) => (
                    <Stack
                      key={`${issue.code}-${position}`}
                      direction={isMobile ? "column" : "row"}
                      spacing={1}
                      alignItems={isMobile ? "flex-start" : "center"}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "semantic.hue.negative.main" }}
                      >
                        {describeWindowIssue(issue, windows)}
                      </Typography>
                    </Stack>
                  ))}

                {dayIssues.some((issue) => issue.code === "WINDOWS_UNORDERED") && (
                  <Box>
                    <Button
                      variant="text"
                      onClick={() => handleSortDay(day)}
                      sx={{ minHeight: touch.min }}
                    >
                      Ordenarlas
                    </Button>
                  </Box>
                )}

                <Stack
                  direction={isMobile ? "column" : "row"}
                  spacing={1}
                  alignItems={isMobile ? "flex-start" : "center"}
                >
                  <Button
                    variant="text"
                    onClick={() => handleAddWindow(day)}
                    disabled={!canAddWindow(windows)}
                    sx={{ minHeight: touch.min }}
                  >
                    Agregar franja
                  </Button>
                  {!canAddWindow(windows) && (
                    // A disabled primary with no reason beside it is the most
                    // common way to leave someone stuck.
                    <Typography
                      variant="caption"
                      sx={{ color: "semantic.text.secondary" }}
                    >
                      {`Máximo ${QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY} franjas por día.`}
                    </Typography>
                  )}
                </Stack>

                <Box>
                  <Button
                    variant="text"
                    onClick={() => handleApplyToWeek(day)}
                    sx={{ minHeight: touch.min }}
                  >
                    Aplicar este horario a toda la semana
                  </Button>
                </Box>
              </Stack>
            )}

            {isExpanded && !open && (
              <Box sx={{ px: 1.5, pb: 1.5 }}>
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary" }}
                >
                  Este día está cerrado. Enciende el interruptor para agregarle
                  franjas.
                </Typography>
              </Box>
            )}
          </Box>
        );
      })}

      <Box>
        <Button
          variant="text"
          onClick={onRemove}
          sx={{ minHeight: touch.min }}
        >
          Quitar el horario
        </Button>
      </Box>
    </Stack>
  );
}

export default WeeklyScheduleEditor;
