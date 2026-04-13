"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useRouter } from "next/navigation";
import axios from "axios";
import { IProductoTiendaV2 } from "@/types/IProducto";

interface ExpiringProductsAlertProps {
  tiendaId: string;
}

const getDiasLabel = (fechaVencimiento: string): { dias: number; label: string } => {
  const ahora = new Date();
  const fecha = new Date(fechaVencimiento);
  const dias = Math.ceil((fecha.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000));
  if (dias <= 0) return { dias, label: `Vencido hace ${Math.abs(dias)} día(s)` };
  return { dias, label: `Vence en ${dias} día(s)` };
};

export default function ExpiringProductsAlert({ tiendaId }: ExpiringProductsAlertProps) {
  const [vencidos, setVencidos] = useState<IProductoTiendaV2[]>([]);
  const [porVencer, setPorVencer] = useState<IProductoTiendaV2[]>([]);
  const [expandedVencidos, setExpandedVencidos] = useState(true);
  const [expandedPorVencer, setExpandedPorVencer] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!tiendaId) return;
    axios
      .get<{ vencidos: IProductoTiendaV2[]; porVencer: IProductoTiendaV2[] }>(
        `/api/productos_tienda/expirando?tiendaId=${tiendaId}`
      )
      .then((res) => {
        setVencidos(res.data.vencidos);
        setPorVencer(res.data.porVencer);
      })
      .catch(() => {});
  }, [tiendaId]);

  if (vencidos.length === 0 && porVencer.length === 0) return null;

  return (
    <Box sx={{ mb: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Sección de productos vencidos */}
      {vencidos.length > 0 && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              endIcon={expandedVencidos ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setExpandedVencidos((v) => !v)}
            >
              {expandedVencidos ? "Ocultar" : `Ver ${vencidos.length}`}
            </Button>
          }
        >
          <AlertTitle>
            {vencidos.length} producto(s) <strong>vencido(s)</strong>
          </AlertTitle>
          <Collapse in={expandedVencidos}>
            <List dense disablePadding sx={{ mt: 0.5 }}>
              {vencidos.map((pt) => {
                const { label } = getDiasLabel(pt.fechaVencimiento!);
                return (
                  <ListItem key={pt.id} disableGutters sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {pt.producto.nombre}
                          </Typography>
                          <Chip label={label} color="error" size="small" />
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
            <Divider sx={{ my: 1 }} />
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => router.push("/inventario")}
            >
              Ver en Inventario →
            </Button>
          </Collapse>
        </Alert>
      )}

      {/* Sección de productos próximos a vencer */}
      {porVencer.length > 0 && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              endIcon={expandedPorVencer ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setExpandedPorVencer((v) => !v)}
            >
              {expandedPorVencer ? "Ocultar" : `Ver ${porVencer.length}`}
            </Button>
          }
        >
          <AlertTitle>
            {porVencer.length} producto(s) <strong>próximos a vencer</strong> (≤30 días)
          </AlertTitle>
          <Collapse in={expandedPorVencer}>
            <List dense disablePadding sx={{ mt: 0.5 }}>
              {porVencer.map((pt) => {
                const { label } = getDiasLabel(pt.fechaVencimiento!);
                return (
                  <ListItem key={pt.id} disableGutters sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {pt.producto.nombre}
                          </Typography>
                          <Chip label={label} color="warning" size="small" />
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
            <Divider sx={{ my: 1 }} />
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => router.push("/inventario")}
            >
              Ver en Inventario →
            </Button>
          </Collapse>
        </Alert>
      )}
    </Box>
  );
}
