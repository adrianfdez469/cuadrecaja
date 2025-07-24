"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  TextField,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  IconButton,
  Divider,
} from "@mui/material";
import {
  Print,
  Add,
  Remove,
  Warning,
  CheckCircle,
  QrCode,
  QrCode2,
} from "@mui/icons-material";
import { formatCurrency } from '@/utils/formatters';
import jsPDF from "jspdf";
import bwipjs from "bwip-js";
import QRCode from "qrcode";
import generateEAN13 from '@/utils/generateProductCode';
import { useMessageContext } from "@/context/MessageContext";

interface ProductoConCodigos {
  id: string;
  nombre: string;
  precio: number;
  categoria?: {
    nombre: string;
    color: string;
  };
  producto: {
    id: string;
    nombre: string;
    codigosProducto: {
      id: string;
      codigo: string;
    }[];
  };
  proveedor?: {
    nombre: string;
  };
}

interface SelectedProduct extends ProductoConCodigos {
  cantidad: number;
  needsCode: boolean;
  generatedCode?: string;
}

interface PrintLabelsModalProps {
  open: boolean;
  onClose: () => void;
  tiendaId: string;
}

export const PrintLabelsModal: React.FC<PrintLabelsModalProps> = ({
  open,
  onClose,
  tiendaId,
}) => {
  const [productos, setProductos] = useState<ProductoConCodigos[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [codeType, setCodeType] = useState<'barcode' | 'qr'>('barcode');
  const { showMessage } = useMessageContext();

  // Cargar productos al abrir el modal
  useEffect(() => {
    if (open && tiendaId) {
      loadProductos();
    }
  }, [open, tiendaId]);

  const loadProductos = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/productos_tienda/${tiendaId}/with-codes`);
      if (!response.ok) throw new Error("Error al cargar productos");
      const data = await response.json();
      const data2 = (data as ProductoConCodigos[]).reduce((acum: ProductoConCodigos[], item) => {
        const prodFind = acum.find(p => p.nombre === item.nombre && p.precio === item.precio);
        if(prodFind) {
          return acum;
        } else {
          return [...acum, item];
        }
      }, []);

      setProductos(data2);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = productos.filter(
    (product) =>
      product.producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.categoria?.nombre?.toLowerCase()?.includes(searchTerm.toLowerCase())
  );

  const handleProductSelect = (product: ProductoConCodigos, selected: boolean) => {
    if (selected) {
      const needsCode = product.producto.codigosProducto.length === 0;
      setSelectedProducts(prev => [
        ...prev,
        { ...product, cantidad: 1, needsCode }
      ]);
    } else {
      setSelectedProducts(prev => 
        prev.filter(p => p.id !== product.id)
      );
    }
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setSelectedProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, cantidad: newQuantity } : p)
    );
  };

  const generateMissingCodes = async () => {
    const productsNeedingCodes = selectedProducts.filter(p => p.needsCode);
    if (productsNeedingCodes.length === 0) return;

    setGeneratingCodes(true);
    showMessage(`Generando códigos para ${productsNeedingCodes.length} producto(s)...`, 'info');

    // Obtener códigos existentes para evitar duplicados
    const allCodes = productos
      .flatMap(p => p.producto.codigosProducto.map(c => c.codigo))
      .concat(selectedProducts.map(p => p.generatedCode).filter(Boolean));
    
    const existingCodes = new Set(allCodes);

    try {
      // Generar códigos para cada producto que los necesite
      const updatedProducts = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const product of productsNeedingCodes) {
        try {
          // Generar código
          const generatedCode = generateEAN13(existingCodes);
          existingCodes.add(generatedCode);
          
          // Guardar en la base de datos
          const response = await fetch(`/api/productos/${product.producto.id}/generate-code`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ codigo: generatedCode })
          });

          if (!response.ok) {
            throw new Error(`Error guardando código para ${product.producto.nombre}`);
          }

          const savedCode = await response.json();
          updatedProducts.push({
            ...product,
            generatedCode: savedCode.codigo,
            needsCode: false,
            producto: {
              ...product.producto,
              codigosProducto: [
                ...product.producto.codigosProducto,
                { id: savedCode.id, codigo: savedCode.codigo }
              ]
            }
          });
          successCount++;
        } catch (error) {
          console.error(`Error generando código para ${product.producto.nombre}:`, error);
          // Mantener el producto sin cambios si hay error
          updatedProducts.push(product);
          errorCount++;
        }
      }

      // Actualizar el estado con los productos que se pudieron actualizar
      setSelectedProducts(prev => prev.map(product => {
        const updated = updatedProducts.find(up => up.id === product.id);
        return updated || product;
      }));

      // También actualizar la lista principal de productos para reflejar los nuevos códigos
      setProductos(prev => prev.map(product => {
        const updated = updatedProducts.find(up => up.id === product.id);
        return updated ? {
          ...product,
          producto: updated.producto
        } : product;
      }));

      // Mostrar mensaje de resultado
      if (successCount > 0 && errorCount === 0) {
        showMessage(`Se generaron ${successCount} códigos exitosamente`, 'success');
      } else if (successCount > 0 && errorCount > 0) {
        showMessage(`Se generaron ${successCount} códigos. ${errorCount} fallaron.`, 'warning');
      } else if (errorCount > 0) {
        showMessage(`Error generando códigos para ${errorCount} producto(s)`, 'error');
      }

    } catch (error) {
      console.error('Error generando códigos:', error);
      showMessage('Error generando códigos de barras', 'error');
    } finally {
      setGeneratingCodes(false);
    }
  };

  const generatePriceLabelsPDF = async () => {
    if (selectedProducts.length === 0) return;

    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'A4' });
      const pageWidth = 595;
      const pageHeight = 842;
      
      // Etiquetas más compactas
      const labelWidth = 140;  // Reducido de 180 a 140
      const labelHeight = 80;  // Reducido de 120 a 80
      const margin = 10;       // Reducido de 15 a 10
      const spacing = 2;       // Espaciado entre etiquetas
      
      const cols = Math.floor((pageWidth - 2 * margin) / (labelWidth + spacing));
      const rows = Math.floor((pageHeight - 2 * margin) / (labelHeight + spacing));
      
      let currentPage = 1;
      let currentRow = 0;
      let currentCol = 0;
      let labelCount = 0;

      for (const product of selectedProducts) {
        for (let i = 0; i < product.cantidad; i++) {
          // Verificar si necesitamos nueva página
          if (labelCount > 0 && labelCount % (cols * rows) === 0) {
            doc.addPage();
            // currentPage++;
            currentRow = 0;
            currentCol = 0;
          }

          const x = margin + currentCol * (labelWidth + spacing);
          const y = margin + currentRow * (labelHeight + spacing);

          // Código de barras a usar
          const codigoBarras = product.generatedCode || 
            (product.producto.codigosProducto[0]?.codigo) || 
            `NO-CODE-${product.id}`;

          // Dibujar borde de etiqueta más sutil
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.5);
          doc.rect(x, y, labelWidth, labelHeight);

          // Nombre del producto (letra más pequeña, arriba)
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          const nombreWrapped = doc.splitTextToSize(product.producto.nombre, labelWidth - 8);
          doc.text(nombreWrapped.slice(0, 1), x + 4, y + 10); // Solo 1 línea para ser más compacto

          // Precio (letra grande pero proporcionalmente ajustada)
          doc.setFontSize(18); // Reducido de 24 a 18
          doc.setFont('helvetica', 'bold');
          const precioText = formatCurrency(product.precio);
          const precioWidth = doc.getTextWidth(precioText);
          doc.text(precioText, x + (labelWidth - precioWidth) / 2, y + 35); // Centrado verticalmente

          // Generar código según el tipo seleccionado
          if (codigoBarras !== `NO-CODE-${product.id}`) {
            try {
              if (codeType === 'barcode') {
                // Código de barras
                const canvas = document.createElement('canvas');
                bwipjs.toCanvas(canvas, {
                  bcid: 'code128',
                  text: codigoBarras,
                  scale: 0.8,  // Reducido de 1 a 0.8
                  height: 12,  // Reducido de 20 a 12
                  includetext: false,
                  textxalign: 'center',
                });
                const barcodeDataUrl = canvas.toDataURL('image/png');
                doc.addImage(barcodeDataUrl, 'PNG', x + 4, y + 45, labelWidth - 8, 16); // Más compacto
              } else {
                // Código QR
                const qrDataUrl = await QRCode.toDataURL(codigoBarras, { 
                  width: 48, 
                  margin: 0,
                  errorCorrectionLevel: 'M'
                });
                const qrSize = 16; // Tamaño compacto para QR
                doc.addImage(qrDataUrl, 'PNG', x + (labelWidth - qrSize) / 2, y + 45, qrSize, qrSize);
              }
              
              // Número del código (letra muy pequeña)
              doc.setFontSize(4); // Reducido de 6 a 4
              doc.setFont('helvetica', 'normal');
              const codigoWidth = doc.getTextWidth(codigoBarras);
              doc.text(codigoBarras, x + (labelWidth - codigoWidth) / 2, y + 70);
            } catch (error) {
              console.error("Error generando código:", error);
              // Fallback: mostrar solo el texto del código
              doc.setFontSize(5);
              doc.setFont('helvetica', 'normal');
              doc.text(`Código: ${codigoBarras}`, x + 4, y + 55);
            }
          } else {
            // Sin código de barras
            doc.setFontSize(5);
            doc.setFont('helvetica', 'normal');
            doc.text("Sin código", x + 4, y + 55);
          }

          // Siguiente posición
          currentCol++;
          if (currentCol >= cols) {
            currentCol = 0;
            currentRow++;
          }
          labelCount++;
        }
      }

      const codeTypeText = codeType === 'barcode' ? 'barras' : 'QR';
      doc.save(`etiquetas_precios_${codeTypeText}_${new Date().getTime()}.pdf`);
      showMessage(`PDF generado con ${labelCount} etiquetas con códigos ${codeTypeText}`, 'success');
    } catch (error) {
      console.error("Error generando PDF:", error);
      showMessage('Error generando el PDF de etiquetas', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const totalLabels = selectedProducts.reduce((sum, p) => sum + p.cantidad, 0);
  const productsWithoutCodes = selectedProducts.filter(p => p.needsCode && !p.generatedCode);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Print />
          <Typography variant="h6">Imprimir Etiquetas de Precios</Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Cargando productos...
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* Búsqueda */}
            <TextField
              fullWidth
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />

            {/* Selector de tipo de código */}
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                Tipo de código a imprimir:
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant={codeType === 'barcode' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setCodeType('barcode')}
                  startIcon={<QrCode />}
                >
                  Código de Barras
                </Button>
                <Button
                  variant={codeType === 'qr' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setCodeType('qr')}
                  startIcon={<QrCode2 />}
                >
                  Código QR
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {codeType === 'barcode' 
                  ? 'Los códigos de barras son ideales para escáneres tradicionales de tiendas'
                  : 'Los códigos QR pueden escanearse con cualquier smartphone'
                }
              </Typography>
            </Box>

            {/* Productos sin códigos - advertencia */}
            {productsWithoutCodes.length > 0 && (
              <Alert 
                severity="warning" 
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={generateMissingCodes}
                    startIcon={generatingCodes ? <CircularProgress size={16} /> : <QrCode />}
                    disabled={generatingCodes}
                  >
                    {generatingCodes ? 'Generando...' : 'Auto-generar códigos'}
                  </Button>
                }
              >
                {productsWithoutCodes.length} producto(s) seleccionado(s) no tienen código de barras
              </Alert>
            )}

            {/* Resumen de selección */}
            {selectedProducts.length > 0 && (
              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Productos seleccionados: {selectedProducts.length} ({totalLabels} etiquetas)
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {selectedProducts.map((product) => (
                    <Chip
                      key={product.id}
                      label={`${product.producto.nombre} (${product.cantidad})`}
                      size="small"
                      onDelete={() => handleProductSelect(product, false)}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            <Divider />

            {/* Lista de productos */}
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              <List>
                {filteredProducts.map((product) => {
                  const isSelected = selectedProducts.some(p => p.id === product.id);
                  const selectedProduct = selectedProducts.find(p => p.id === product.id);
                  const hasCode = product.producto.codigosProducto.length > 0;

                  return (
                    <ListItem key={product.id} dense>
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => handleProductSelect(product, e.target.checked)}
                      />
                      <ListItemText
                        primary={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body2">
                              {product.producto.nombre}
                            </Typography>
                            {!hasCode && (
                              <Chip
                                label="Sin código"
                                size="small"
                                color="warning"
                                icon={<Warning />}
                              />
                            )}
                            {hasCode && (
                              <Chip
                                label={`${product.producto.codigosProducto.length} código(s)`}
                                size="small"
                                color="success"
                                icon={<CheckCircle />}
                              />
                            )}
                          </Stack>
                        }
                        secondary={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                              {formatCurrency(product.precio)}
                            </Typography>
                            {product.categoria && (
                              <Chip
                                label={product.categoria.nombre}
                                size="small"
                                sx={{
                                  bgcolor: product.categoria.color,
                                  color: 'white',
                                  fontSize: '0.65rem',
                                  height: 16
                                }}
                              />
                            )}
                          </Stack>
                        }
                      />
                      {isSelected && (
                        <ListItemSecondaryAction>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => handleQuantityChange(product.id, selectedProduct.cantidad - 1)}
                              disabled={selectedProduct.cantidad <= 1}
                            >
                              <Remove fontSize="small" />
                            </IconButton>
                            <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>
                              {selectedProduct.cantidad}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => handleQuantityChange(product.id, selectedProduct.cantidad + 1)}
                            >
                              <Add fontSize="small" />
                            </IconButton>
                          </Stack>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={generatePriceLabelsPDF}
          disabled={selectedProducts.length === 0 || generating || productsWithoutCodes.length > 0}
          startIcon={generating ? <CircularProgress size={16} /> : <Print />}
        >
          {generating ? 'Generando...' : `Imprimir ${totalLabels} etiqueta(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 