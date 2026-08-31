"use client";

import {
  Card,
  CardContent,
  Stack,
  Typography,
  IconButton,
  Grid,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import dayjs from "dayjs";

interface DiscountConditions {
  code?: string;
  minTotal?: number;
  productIds?: string[];
  categoryIds?: string[];
  customerIds?: string[];
}

interface DiscountRule {
  id: string;
  name: string;
  type: "PERCENTAGE" | "FIXED" | "PROMO_CODE";
  value: number;
  appliesTo: "TICKET" | "PRODUCT" | "CATEGORY" | "CUSTOMER";
  conditions?: DiscountConditions;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  createdAt?: string;
}

interface Props {
  rule: DiscountRule;
  onEdit: (rule: DiscountRule) => void;
  onDelete: (rule: DiscountRule) => void;
  onToggleActive: (rule: DiscountRule) => void;
  isMobile?: boolean;
}

export function DiscountRuleCard({
  rule,
  onEdit,
  onDelete,
  onToggleActive,
  isMobile = false,
}: Props) {
  const conditions: DiscountConditions =
    (rule.conditions as DiscountConditions) || {};

  const cardElement = (
    <Card variant={isMobile ? undefined : "outlined"}>
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="start"
          mb={1}
        >
          <Typography variant="h6">{rule.name}</Typography>
          <Stack direction="row" spacing={1}>
            <IconButton
              onClick={() => onToggleActive(rule)}
              size="small"
              title={rule.isActive ? "Desactivar" : "Activar"}
            >
              {rule.isActive ? (
                <CheckIcon color="success" />
              ) : (
                <CloseIcon color="error" />
              )}
            </IconButton>
            <IconButton
              onClick={() => onEdit(rule)}
              size="small"
              title="Editar"
            >
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={() => onDelete(rule)}
              size="small"
              color="error"
              title="Eliminar"
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Tipo: {rule.type} · Ámbito: {rule.appliesTo}
        </Typography>
        <Typography variant="body2" gutterBottom>
          Valor:{" "}
          {rule.type === "PERCENTAGE" ? `${rule.value}%` : `${rule.value}`}
        </Typography>
        {(conditions?.code || conditions?.minTotal) && (
          <Typography variant="body2" color="text.secondary">
            Condiciones: {conditions?.code ? `código "${conditions.code}"` : ""}
            {conditions?.code && conditions?.minTotal ? " · " : ""}
            {conditions?.minTotal ? `mínimo ${conditions.minTotal}` : ""}
          </Typography>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          mt={1}
        >
          Vigencia:{" "}
          {rule.startDate ? dayjs(rule.startDate).format("YYYY-MM-DD") : "—"} a{" "}
          {rule.endDate ? dayjs(rule.endDate).format("YYYY-MM-DD") : "—"}
        </Typography>
      </CardContent>
    </Card>
  );

  if (isMobile) {
    return cardElement;
  }

  return (
    <Grid item xs={12} md={6} lg={4}>
      {cardElement}
    </Grid>
  );
}
