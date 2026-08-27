"use client";

import React, { useState, useEffect } from "react";
import { StatStrip } from "@/components/StatStrip";
import { StatusPill } from "@/components/StatusPill";
import { touch } from "@/theme";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  Stack,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
} from "@mui/material";
import {
  Delete,
  Edit,
  Add,
  Category,
  ColorLens,
  Search,
  Refresh,
} from "@mui/icons-material";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/services/categoryService";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import SelectableTextField from "@/components/SelectableTextField";
import { useSession } from "next-auth/react";
import type { ICategory } from "@/schemas/categoria";

export default function CategoriasPage() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ICategory | null>(
    null,
  );
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#1976d2");
  const [createAsGlobal, setCreateAsGlobal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();

  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.rol === "SUPER_ADMIN";

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));


  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
      showMessage("Error al cargar categorías", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (category: ICategory | null = null) => {
    if (category?.esGlobal && !isSuperAdmin) return;
    setEditingCategory(category);
    setNombre(category ? category.nombre : "");
    setColor(category ? category.color : "#1976d2");
    setCreateAsGlobal(false);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCategory(null);
    setNombre("");
    setColor("#1976d2");
    setCreateAsGlobal(false);
  };

  const handleSave = async () => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, nombre, color);
        showMessage("Categoría actualizada exitosamente", "success");
      } else {
        await createCategory(nombre, color, isSuperAdmin && createAsGlobal);
        showMessage("Categoría creada exitosamente", "success");
      }
      await loadCategories();
      handleClose();
    } catch (error) {
      console.error("Error al guardar categoría:", error);
      showMessage("Error al guardar la categoría", "error");
    }
  };

  const handleDelete = async (id: string) => {
    confirmDialog("¿Está seguro que desea eliminar la categoría?", async () => {
      try {
        await deleteCategory(id);
        showMessage("Categoría eliminada", "success");
      } catch (error) {
        console.error(error);
        showMessage(
          "Error al intentar eliminar la categoría. Es probable que esté en uso!",
          "error",
        );
      } finally {
        await loadCategories();
      }
    });
  };

  const filteredCategories = categories.filter((category) =>
    category.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Cálculos para estadísticas
  const totalCategorias = categories.length;
  const coloresUnicos = [...new Set(categories.map((c) => c.color))].length;
  const categoriasVisibles = filteredCategories.length;

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Categorías" },
  ];

  // The stats toggle is gone with the cards it used to hide: a StatStrip is two
  // lines tall, so there is nothing left to fold away.
  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar categorías">
        <IconButton onClick={loadCategories} disabled={loading}>
          <Refresh />
        </IconButton>
      </Tooltip>
      {!isMobile && (
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>
          Agregar Categoría
        </Button>
      )}
    </Stack>
  );

  // Componente de estadística móvil optimizado
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
          Cargando categorías...
        </Typography>
      </Box>
    );
  }

  return (
    <PageContainer
      title="Gestión de Categorías"
      subtitle="Organiza tus productos con categorías personalizadas"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {isMobile && (
        <Button
          variant="contained"
          startIcon={<Add />}
          fullWidth
          onClick={() => handleOpen()}
          sx={{ minHeight: touch.comfortable, mb: 2.5 }}
        >
          Agregar
        </Button>
      )}

      <StatStrip
        stats={[
          { label: "Total Categorías", value: totalCategorias.toLocaleString() },
          { label: "Colores Únicos", value: coloresUnicos.toLocaleString() },
          {
            label: "Categorías Visibles",
            value: categoriasVisibles.toLocaleString(),
          },
        ]}
      />

      {/* Lista de categorías */}
      <ContentCard
        title="Lista de Categorías"
        subtitle={
          !isMobile
            ? "Las categorías globales son compartidas por todos los negocios"
            : undefined
        }
        headerActions={
          <SelectableTextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar categoría..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: isMobile ? 160 : 250,
              maxWidth: isMobile ? 200 : "none",
            }}
          />
        }
        noPadding
        fullHeight
      >
        {filteredCategories.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Box sx={{ textAlign: "center", py: 8 }}>
              <Category sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {searchTerm
                  ? "No se encontraron categorías"
                  : "No hay categorías registradas"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm
                  ? "Intenta con otros términos de búsqueda"
                  : "Agrega categorías para organizar mejor tus productos"}
              </Typography>
            </Box>
          </Box>
        ) : isMobile ? (
          // One card holding rows, not a card per category: nesting a card in a
          // card cost a border and an indent per row and pushed the list down
          // the screen. The swatch is the data here, so it stays saturated and
          // everything around it goes quiet.
          <Box>
            {filteredCategories.map((categoria, index) => {
              const isGlobalReadOnly = categoria.esGlobal && !isSuperAdmin;
              return (
                <Box
                  key={categoria.id}
                  onClick={() => !isGlobalReadOnly && handleOpen(categoria)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    minHeight: 64,
                    pl: 2,
                    pr: 0.5,
                    py: 1,
                    cursor: isGlobalReadOnly ? "default" : "pointer",
                    ...(index > 0 && { borderTop: 1, borderColor: "divider" }),
                  }}
                >
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      flex: "0 0 22px",
                      borderRadius: "6px",
                      bgcolor: categoria.color,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography sx={{ fontSize: "1rem", fontWeight: 600 }}>
                        {categoria.nombre}
                      </Typography>
                      {categoria.esGlobal && (
                        <StatusPill label="Global" />
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.25, fontFamily: "monospace" }}
                    >
                      {categoria.color}
                    </Typography>
                  </Box>
                  <Tooltip
                    title={
                      isGlobalReadOnly
                        ? "Las categorías globales no se pueden eliminar"
                        : "Eliminar categoría"
                    }
                  >
                    <span>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(categoria.id);
                        }}
                        color="error"
                        disabled={isGlobalReadOnly}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Color</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCategories.map((categoria) => {
                  const isGlobalReadOnly = categoria.esGlobal && !isSuperAdmin;
                  return (
                    <TableRow
                      key={categoria.id}
                      onClick={() => handleOpen(categoria)}
                      sx={{
                        cursor: isGlobalReadOnly ? "default" : "pointer",
                        "&:hover": {
                          backgroundColor: isGlobalReadOnly
                            ? undefined
                            : "action.hover",
                        },
                      }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Box
                            sx={{
                              width: 22,
                              height: 22,
                              flex: "0 0 22px",
                              borderRadius: "6px",
                              bgcolor: categoria.color,
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          />
                          <Typography variant="body2" fontWeight="medium">
                            {categoria.nombre}
                          </Typography>
                          {categoria.esGlobal && (
                            // Almost every row carries this: repeated facts do
                            // not get to be the loudest thing in the cell.
                            <StatusPill label="Global" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontFamily: "monospace" }}
                        >
                          {categoria.color}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="center"
                        >
                          <Tooltip
                            title={
                              isGlobalReadOnly
                                ? "Las categorías globales no se pueden modificar"
                                : "Editar categoría"
                            }
                          >
                            <span>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpen(categoria);
                                }}
                                size="small"
                                color="primary"
                                disabled={isGlobalReadOnly}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip
                            title={
                              isGlobalReadOnly
                                ? "Las categorías globales no se pueden eliminar"
                                : "Eliminar categoría"
                            }
                          >
                            <span>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(categoria.id);
                                }}
                                size="small"
                                color="error"
                                disabled={isGlobalReadOnly}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Dialog para crear/editar categoría */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Bebidas, Snacks, Limpieza..."
            />

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Color de la categoría
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <TextField
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  sx={{ width: 80 }}
                />
                <Box
                  sx={{
                    width: 60,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: color,
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ColorLens sx={{ color: "white", fontSize: 16 }} />
                </Box>
                <Chip
                  label={nombre || "Vista previa"}
                  size="small"
                  sx={{
                    bgcolor: color,
                    color: "white",
                    fontWeight: "medium",
                  }}
                />
              </Box>
            </Box>

            {isSuperAdmin && !editingCategory && (
              <FormControlLabel
                control={
                  <Switch
                    checked={createAsGlobal}
                    onChange={(e) => setCreateAsGlobal(e.target.checked)}
                    color="info"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Categoría Global</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Disponible para todos los negocios, solo editable por
                      superadmins
                    </Typography>
                  </Box>
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={!nombre.trim()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
