import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Box,
  Stack
} from "@mui/material";
import { importarMovimientosExcel } from "@/services/movimientoService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";

const HEADERS_ESPERADOS = ["Nombre", "Costo", "Precio", "Cantidad", "esConsignación"];

export default function ImportarExcelDialog({ open, onClose, onSuccess }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);

  const { user } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // Validar y parsear el Excel
  const handleFile = async (e) => {
    setErrores([]);
    setItems([]);
    setPreview(false);

    const file = e.target.files[0];
    if (!file) return;

    setArchivo(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Validar encabezados
      const headers = rows[0] as string[];
      const erroresTemp: string[] = [];
      if (
        !headers ||
        headers.length !== 5 ||
        !HEADERS_ESPERADOS.every((h, i) => h === headers[i])
      ) {
        erroresTemp.push(
          "El archivo debe tener exactamente 5 columnas con los encabezados: " +
            HEADERS_ESPERADOS.join(", ")
        );
      }

      // Validar filas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsTemp: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const [nombre, costo, precio, cantidad, esConsignacion] = rows[i] as string[];
        const filaErrores = [];
        if (!nombre) filaErrores.push("Nombre vacío");
        if (typeof costo !== "number" || isNaN(costo)) filaErrores.push("Costo inválido");
        if (typeof precio !== "number" || isNaN(precio)) filaErrores.push("Precio inválido");
        if (typeof cantidad !== "number" || isNaN(cantidad)) filaErrores.push("Cantidad inválida");
        if (
          typeof esConsignacion !== "boolean" &&
          esConsignacion !== "0" &&
          esConsignacion !== "1" &&
          esConsignacion !== "TRUE" &&
          esConsignacion !== "FALSE" &&
          esConsignacion !== "true" &&
          esConsignacion !== "false" &&
          esConsignacion !== "SI" &&
          esConsignacion !== "NO" &&
          esConsignacion !== "si" &&
          esConsignacion !== "no"
        ) {
          filaErrores.push("esConsignación debe ser SI/NO");
        }
        if (filaErrores.length > 0) {
          erroresTemp.push(`Fila ${i + 1}: ${filaErrores.join(", ")}`);
        } else {
          itemsTemp.push({
            nombreProducto: nombre,
            costo: Number(costo),
            precio: Number(precio),
            cantidad: Number(cantidad),
            esConsignación:
              esConsignacion === "TRUE" ||
              esConsignacion === "true" ||
              esConsignacion === "1" ||
              esConsignacion === "SI" ||
              esConsignacion === "si"
          });
        }
      }

      setErrores(erroresTemp);
      setItems(itemsTemp);
      setPreview(erroresTemp.length === 0 && itemsTemp.length > 0);
    } catch {
      setErrores(["No se pudo leer el archivo. ¿Es un Excel válido?"]);
    }
  };

  // Enviar al backend
  const handleImportar = async () => {
    setLoading(true);
    setErrores([]);
    try {
      const dataEnvio = {
        usuarioId: user.id,
        negocioId: user.negocio.id,
        localId: user.localActual.id
      };
      const resultado = await importarMovimientosExcel(dataEnvio, items);
      setLoading(false);
      if (resultado.success) {
        showMessage("Importación exitosa: " + resultado.message, "success");
        onSuccess?.();
        onClose();
      } else {
        setErrores([resultado.errorCause || resultado.message]);
      }
    } catch {
      setLoading(false);
      setErrores(["Error de red o inesperado"]);
    }
  };

  const handleClose = () => {
    setArchivo(null);
    setErrores([]);
    setItems([]);
    setPreview(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullScreen={fullScreen} maxWidth="md" fullWidth>
      <DialogTitle>Importar productos desde Excel</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Button variant="contained" component="label" fullWidth>
            Seleccionar archivo Excel
            <input type="file" accept=".xlsx,.xls" hidden onChange={handleFile} />
          </Button>
          {archivo && (
            <Typography variant="body2" color="text.secondary">
              Archivo seleccionado: {archivo.name}
            </Typography>
          )}
          {errores.length > 0 && (
            <Alert severity="error">
              <Typography variant="subtitle2">Errores encontrados:</Typography>
              <ul>
                {errores.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </Alert>
          )}
          {preview && (
            <Box sx={{ overflowX: "auto" }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Vista previa de productos a importar:
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {HEADERS_ESPERADOS.map((h) => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.nombreProducto}</TableCell>
                      <TableCell>{item.costo}</TableCell>
                      <TableCell>{item.precio}</TableCell>
                      <TableCell>{item.cantidad}</TableCell>
                      <TableCell>
                        {item.esConsignación ? "Sí" : "No"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="secondary">
          Cancelar
        </Button>
        <Button
          onClick={handleImportar}
          variant="contained"
          color="primary"
          disabled={!preview || loading}
        >
          {loading ? <CircularProgress size={24} /> : "Importar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}