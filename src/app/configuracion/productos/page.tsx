"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography
} from "@mui/material";
import { Categoria } from './types/categorias';
import { ProductoForm } from './components/product.form'
import { Delete, Edit, Padding } from "@mui/icons-material";

const API_URL = "/api/productos";
const API_CATEGORIES = "/api/categorias";

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState({ name: "", description: "", categoryId: "" });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    const res = await fetch(API_URL);
    const data = await res.json();
    setProducts(data);
  };

  const fetchCategories = async () => {
    const res = await fetch(API_CATEGORIES);
    const data = await res.json();
    console.log(data);
    
    setCategories(data);
  };

  const handleOpen = (prod = { name: "", description: "", categoryId: "" }, id = null) => {
    setProduct(prod);
    setEditingId(id);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setProduct({ name: "", description: "", categoryId: "" });
    setEditingId(null);
  };

  const handleSave = async (nombre, descripcion, categoriaId) => {
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `${API_URL}/${editingId}` : API_URL;
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descripcion: descripcion,
        nombre: nombre, 
        categoriaId: categoriaId
      }),
    });
    fetchProducts();
    handleClose();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    fetchProducts();
  };

  return (
    <Box>

      <Box display={'flex'} flexDirection={'row'} justifyContent={'space-between'}>
        <Typography variant="h4">Gestión de Productos</Typography>
        <Button variant="contained" color="primary" onClick={() => handleOpen()}>Añadir Producto</Button>
      </Box>

      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>
                    {p.nombre}
                </TableCell>
                <TableCell>{p.descripcion}</TableCell>
                <TableCell>
                  <Box display='flex' flexDirection={'row'} justifyContent={'flex-start'} >
                    <Box style={{  }}/>
                    <span style={{backgroundColor: p.categoria?.color, width: 20, height: 20, borderRadius: 5, marginRight: 10}} />
                    {p.categoria?.nombre || "Sin categoría"}
                  </Box>
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(p, p.id)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(p.id)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
                {/* <TableCell>
                  <Button onClick={() => handleOpen(p, p.id)}>Editar</Button>
                  <Button color="error" onClick={() => handleDelete(p.id)}>Eliminar</Button>
                </TableCell> */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <ProductoForm open={open} handleClose={handleClose} handleSave={handleSave}/>
    </Box>
  );
}




