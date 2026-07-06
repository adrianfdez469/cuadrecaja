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
  Stack,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { importarMovimientosExcel } from "@/services/movimientoService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";

const HEADERS_REQUERIDOS = [
  "Categoría",
  "Producto",
  "Costo",
  "Precio",
  "Cantidad",
];

export default function ImportarExcelDialog({ open, onClose, onSuccess }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);

  const { user, monedaBase } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const handleDescargarPlantilla = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      [
        "Categoría",
        "Producto",
        "Costo",
        "Moneda Costo",
        "Precio",
        "Moneda Precio",
        "Cantidad",
        "Proveedor",
      ],
      [
        "Ejemplo Categoría",
        "Nombre Producto",
        100,
        monedaBase,
        150,
        monedaBase,
        50,
        "",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_importacion_movimientos.xlsx");
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFile = async (e: any) => {
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

      // Parseo por clave: la primera fila es encabezado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

      const erroresTemp: string[] = [];

      if (rows.length === 0) {
        erroresTemp.push("El archivo no contiene filas de datos");
        setErrores(erroresTemp);
        return;
      }

      // Validar que existan los encabezados requeridos
      const primeraFila = rows[0];
      const headersPresentes = Object.keys(primeraFila);
      const headersFaltantes = HEADERS_REQUERIDOS.filter(
        (h) => !headersPresentes.includes(h),
      );
      if (headersFaltantes.length > 0) {
        erroresTemp.push(
          `Faltan columnas requeridas: ${headersFaltantes.join(", ")}`,
        );
        setErrores(erroresTemp);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsTemp: any[] = [];
      const duplicados = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const filaNum = i + 2; // +2 porque fila 1 = encabezado
        const filaErrores: string[] = [];

        const categoria = String(row["Categoría"] ?? "").trim();
        const producto = String(row["Producto"] ?? "").trim();
        const costo = Number(row["Costo"]);
        const precio = Number(row["Precio"]);
        const cantidad = Number(row["Cantidad"]);
        const proveedor = String(row["Proveedor"] ?? "").trim() || undefined;
        const monedaCosto =
          String(row["Moneda Costo"] ?? "").trim() || monedaBase;
        const monedaPrecio =
          String(row["Moneda Precio"] ?? "").trim() || monedaBase;

        if (!producto) filaErrores.push("Producto vacío");
        if (!categoria) filaErrores.push("Categoría vacía");
        if (isNaN(costo) || costo < 0) filaErrores.push("Costo inválido");
        if (isNaN(precio) || precio < 0) filaErrores.push("Precio inválido");
        if (isNaN(cantidad)) filaErrores.push("Cantidad inválida");

        const clave = `${producto}|||${proveedor ?? ""}`;
        if (duplicados.has(clave)) {
          filaErrores.push("Producto y proveedor duplicados en el archivo");
        } else {
          duplicados.add(clave);
        }

        if (filaErrores.length > 0) {
          erroresTemp.push(`Fila ${filaNum}: ${filaErrores.join(", ")}`);
        } else {
          itemsTemp.push({
            categoria,
            nombreProducto: producto,
            costo,
            precio,
            cantidad,
            nombreProveedor: proveedor,
            monedaCostoCode: monedaCosto,
            monedaPrecioCode: monedaPrecio,
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

  const handleImportar = async () => {
    setLoading(true);
    setErrores([]);
    try {
      const dataEnvio = {
        usuarioId: user.id,
        negocioId: user.negocio.id,
        localId: user.localActual.id,
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
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>Importar productos desde Excel</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Button variant="contained" component="label" fullWidth>
            Seleccionar archivo Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={handleFile}
            />
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDescargarPlantilla}
            fullWidth
          >
            Descargar Plantilla
          </Button>

          <Typography variant="caption" color="text.secondary">
            Columnas requeridas:{" "}
            <strong>Categoría, Producto, Costo, Precio, Cantidad</strong>.
            Opcionales: <strong>Moneda Costo, Moneda Precio, Proveedor</strong>.
            Si no se especifica moneda, se usa <strong>{monedaBase}</strong>.
          </Typography>

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
                    <TableCell>Categoría</TableCell>
                    <TableCell>Producto</TableCell>
                    <TableCell>Costo</TableCell>
                    <TableCell>Moneda Costo</TableCell>
                    <TableCell>Precio</TableCell>
                    <TableCell>Moneda Precio</TableCell>
                    <TableCell>Cantidad</TableCell>
                    <TableCell>Proveedor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.categoria}</TableCell>
                      <TableCell>{item.nombreProducto}</TableCell>
                      <TableCell>{item.costo}</TableCell>
                      <TableCell>{item.monedaCostoCode}</TableCell>
                      <TableCell>{item.precio}</TableCell>
                      <TableCell>{item.monedaPrecioCode}</TableCell>
                      <TableCell>{item.cantidad}</TableCell>
                      <TableCell>{item.nombreProveedor || "-"}</TableCell>
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
