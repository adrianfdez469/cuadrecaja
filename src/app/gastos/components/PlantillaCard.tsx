"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
import { RECURRENCIA_LABELS, TIPO_CALCULO_LABELS } from "@/constants/gastos";
import { formatearCuandoAplica } from "@/utils/gastos";
import type { IGastoPlantilla } from "@/schemas/gastos";

type PlantillaConCount = IGastoPlantilla & {
  _count?: { asignaciones: number };
};

interface Props {
  plantilla: PlantillaConCount;
  onEdit: (plantilla: PlantillaConCount) => void;
  onDelete: (plantilla: PlantillaConCount) => void;
}

/** One label/value line inside the card. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="baseline"
      gap={1.5}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textAlign: "right" }}>
        {value}
      </Typography>
    </Box>
  );
}

/** One plantilla, as a card — `rediseno/gastos-plantillas-movil.html`'s mobile layout, same shape as `GastoTiendaCard`. */
export default function PlantillaCard({ plantilla, onEdit, onDelete }: Props) {
  const asignaciones = plantilla._count?.asignaciones ?? 0;

  return (
    <Card sx={{ opacity: plantilla.activo ? 1 : 0.6 }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={0}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            gap={1.5}
          >
            <Box minWidth={0}>
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ lineHeight: 1.35 }}
              >
                {plantilla.nombre}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.375 }}
              >
                {plantilla.categoria}
              </Typography>
            </Box>
            {asignaciones > 0 && (
              <Chip
                icon={<LinkIcon fontSize="small" />}
                label={`${asignaciones} tienda${asignaciones > 1 ? "s" : ""}`}
                size="small"
                sx={{
                  flexShrink: 0,
                  bgcolor: "semantic.hue.neutral.surface",
                  color: "semantic.hue.neutral.main",
                }}
              />
            )}
          </Box>

          <Stack
            spacing={0.5}
            sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}
          >
            <MetaRow
              label="Tipo de cálculo"
              value={TIPO_CALCULO_LABELS[plantilla.tipoCalculo]}
            />
            <MetaRow
              label="Recurrencia"
              value={RECURRENCIA_LABELS[plantilla.recurrencia]}
            />
            <MetaRow
              label="Cuándo aplica"
              value={formatearCuandoAplica(plantilla)}
            />
          </Stack>

          <Box
            display="flex"
            justifyContent="flex-end"
            sx={{ mt: 1, pt: 0.75, borderTop: 1, borderColor: "divider" }}
          >
            <IconButton size="small" onClick={() => onEdit(plantilla)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(plantilla)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
