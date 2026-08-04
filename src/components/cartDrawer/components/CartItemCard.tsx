"use client";

import { Delete, Remove, Add } from "@mui/icons-material";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  useTheme,
  alpha,
} from "@mui/material";
import { ICartItem } from "@/store/cartStore";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";

function ExpiryChip({ fechaVencimiento }: { fechaVencimiento: string }) {
  const ahora = new Date();
  const fecha = new Date(fechaVencimiento);
  const dias = Math.ceil(
    (fecha.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dias <= 0) {
    return (
      <Tooltip title="Este producto está vencido">
        <Chip
          label="Vencido"
          color="error"
          size="small"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      </Tooltip>
    );
  }
  if (dias <= 7) {
    return (
      <Tooltip title={`Vence en ${dias} día(s)`}>
        <Chip
          label={`Vence en ${dias}d`}
          color="error"
          size="small"
          variant="outlined"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      </Tooltip>
    );
  }
  if (dias <= 30) {
    return (
      <Tooltip title={`Vence en ${dias} día(s)`}>
        <Chip
          label={`Vence en ${dias}d`}
          color="warning"
          size="small"
          variant="outlined"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      </Tooltip>
    );
  }
  return null;
}

interface CartItemCardProps {
  item: ICartItem;
  onDecrease: (id: string) => void;
  onIncrease: (id: string) => void;
  onRemove?: (item: ICartItem) => void;
  canUpdateQuantity: boolean;
}

export function CartItemCard({
  item,
  onDecrease,
  onIncrease,
  onRemove,
  canUpdateQuantity,
}: CartItemCardProps) {
  const theme = useTheme();
  // Use priceBase (monedaBase equivalent) for MultiCurrencyAmount display; fall back to raw price if not set
  const lineTotal = (item.priceBase ?? item.price) * item.quantity;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.25, sm: 1.5 },
        mb: 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Fila 1: nombre + eliminar */}
      <Box
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        mb={1}
      >
        <Box flex={1} minWidth={0}>
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.name}
          </Typography>
          {item.fechaVencimiento && (
            <Box mt={0.5}>
              <ExpiryChip fechaVencimiento={item.fechaVencimiento} />
            </Box>
          )}
        </Box>

        {onRemove && (
          <IconButton
            onClick={() => onRemove(item)}
            size="small"
            aria-label={`Eliminar ${item.name}`}
            sx={{
              flexShrink: 0,
              color: "error.main",
              mt: -0.25,
              "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.08) },
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Fila 2: precios en dos columnas */}
      <Box
        display="grid"
        gridTemplateColumns="1fr 1fr"
        gap={1}
        mb={1.25}
        sx={{
          borderTop: "1px dashed",
          borderColor: "divider",
          pt: 1,
        }}
      >
        <Box minWidth={0}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{
              mb: 0.25,
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Unitario
          </Typography>
          <MultiCurrencyAmount
            amount={item.priceBase ?? item.price}
            variant="compact"
          />
        </Box>

        <Box minWidth={0}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            align="right"
            sx={{
              mb: 0.25,
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Subtotal
          </Typography>
          <MultiCurrencyAmount
            amount={lineTotal}
            variant="compact"
            align="right"
            color="success.main"
          />
        </Box>
      </Box>

      {/* Fila 3: cantidad centrada a ancho completo */}
      {canUpdateQuantity && (
        <Box display="flex" justifyContent="center">
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              width: "100%",
              maxWidth: 200,
              bgcolor: "action.hover",
              borderRadius: 2,
              px: 0.5,
              py: 0.25,
            }}
          >
            <IconButton
              size="small"
              onClick={() => onDecrease(item.id)}
              aria-label={`Reducir cantidad de ${item.name}`}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Remove />
            </IconButton>
            <Typography
              variant="body1"
              fontWeight={700}
              sx={{ minWidth: 32, textAlign: "center" }}
            >
              {item.quantity}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onIncrease(item.id)}
              aria-label={`Aumentar cantidad de ${item.name}`}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Add />
            </IconButton>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
