"use client";

import { Delete, Edit } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { fetchCategories, createCategory, updateCategory, deleteCategory } from "@/services/categoryService";
import { Box, Button, TextField, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Typography } from "@mui/material";


interface Category {
  id: string;
  nombre: string;
  color: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories", error);
    }
  };

  const handleOpen = (category: Category | null = null) => {
    setEditingCategory(category);
    setNombre(category ? category.nombre : "");
    setColor(category ? category.color : "");
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCategory(null);
    setNombre("");
    setColor("");
  };

  const handleSave = async () => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, nombre, color);
      } else {
        await createCategory(nombre, color);
      }
      loadCategories();
      handleClose();
    } catch (error) {
      console.error("Error saving category", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta categoría?")) {
      try {
        await deleteCategory(id);
        loadCategories();
      } catch (error) {
        console.error("Error deleting category", error);
      }
    }
  };

  return (
    <div>
      <Box display={'flex'} flexDirection={'row'} justifyContent={'space-between'}>
        <Typography variant="h4">Gestión de Categorías</Typography>
        <Button variant="contained" color="primary" onClick={() => handleOpen()}>
          Agregar Categoría
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ marginTop: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Color</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.nombre}</TableCell>
                <TableCell>
                  <div style={{ backgroundColor: category.color, width: 50, height: 20, borderRadius: 4 }}></div>
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(category)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(category.id)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editingCategory ? "Editar Categoría" : "Agregar Categoría"}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} sx={{ marginBottom: 2 }} />
          <TextField fullWidth type="color" label="Color" value={color} onChange={(e) => setColor(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
