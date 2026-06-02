"use client";

import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useEffect, useState } from "react";
import { IGastoCierre } from "@/schemas/gastos";
import {
  IGastosCierreResponse,
  getGastosCierre,
  deleteGastoAdHoc,
} from "@/services/gastoService";
import { TIPO_CALCULO_LABELS, TIPO_CALCULO_COLORS } from "@/constants/gastos";
import { useMessageContext } from "@/context/MessageContext";

interface Props {
  cierreId: string;
  totalGanancia: number;
  canDelete?: boolean;
}

export default function GastoCierreList({
  cierreId,
  totalGanancia,
  canDelete = false,
}: Props) {
  const [data, setData] = useState<IGastosCierreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showMessage } = useMessageContext();

  const fetchData = () => {
    setLoading(true);
    getGastosCierre(cierreId)
      .then(setData)
      .finally(() => setLoading(false));
  };

  const handleDelete = async (gastoId: string) => {
    setDeletingId(gastoId);
    try {
      await deleteGastoAdHoc(cierreId, gastoId);
      showMessage("Gasto eliminado", "success");
      fetchData();
    } catch {
      showMessage("Error al eliminar el gasto", "error");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cierreId]);

  if (loading)
    return (
      <Box py={2} textAlign="center">
        <CircularProgress size={24} />
      </Box>
    );
  if (!data || data.gastos.length === 0) return null;

  const { totalGastos, agrupados } = data;
  const totalGananciaFinal = totalGanancia - totalGastos;
  const esNegativo = totalGananciaFinal < 0;

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <ReceiptLongIcon fontSize="small" color="action" />
        <Typography variant="subtitle2">Gastos del período</Typography>
      </Box>

      <Stack spacing={0.5}>
        {Object.entries(agrupados).map(([categoria, items]) => (
          <Box key={categoria}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight="bold"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
            >
              {categoria}
            </Typography>
            {(items as IGastoCierre[]).map((g) => (
              <Box
                key={g.id}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={0.5}
                pl={1}
              >
                <Box
                  display="flex"
                  alignItems="center"
                  gap={1}
                  flex={1}
                  minWidth={0}
                >
                  <Chip
                    label={TIPO_CALCULO_LABELS[g.tipoCalculo]}
                    size="small"
                    sx={{
                      backgroundColor: TIPO_CALCULO_COLORS[g.tipoCalculo],
                      color: "#fff",
                      height: 18,
                      fontSize: "0.625rem",
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" noWrap>
                    {g.nombre}
                  </Typography>
                  {g.esAdHoc && (
                    <Chip
                      label="Ad-hoc"
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.625rem", flexShrink: 0 }}
                    />
                  )}
                </Box>
                <Box
                  display="flex"
                  alignItems="center"
                  gap={0.5}
                  flexShrink={0}
                >
                  <Typography
                    variant="body2"
                    color="error.main"
                    fontWeight="medium"
                  >
                    -${g.montoCalculado.toFixed(2)}
                  </Typography>
                  {canDelete && g.esAdHoc && (
                    <Tooltip title="Eliminar gasto">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={deletingId === g.id}
                          onClick={() => handleDelete(g.id)}
                          sx={{ p: 0.25 }}
                        >
                          {deletingId === g.id ? (
                            <CircularProgress size={14} color="error" />
                          ) : (
                            <DeleteOutlineIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Total gastos:
        </Typography>
        <Typography variant="body2" color="error.main" fontWeight="bold">
          -${totalGastos.toFixed(2)}
        </Typography>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mt={0.5}
      >
        <Typography variant="body2" fontWeight="bold">
          Ganancia neta:
        </Typography>
        <Typography
          variant="body2"
          fontWeight="bold"
          color={esNegativo ? "error.main" : "success.main"}
        >
          ${totalGananciaFinal.toFixed(2)}
          {esNegativo && " ⚠"}
        </Typography>
      </Box>
    </Box>
  );
}
