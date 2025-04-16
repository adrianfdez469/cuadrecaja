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
  Typography,
  CircularProgress,
} from "@mui/material";
import { ProductoForm } from "./components/product.form";
import { Delete, Edit } from "@mui/icons-material";
import {
  createProduct,
  deleteProduct,
  editProduct,
  fetchProducts,
} from "@/services/productServise";
import { IProducto } from "@/types/IProducto";
import { useMessageContext } from "@/context/MessageContext";

export default function ProductList() {
  const [products, setProducts] = useState<IProducto[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showMessage } = useMessageContext();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const prods = await fetchProducts();
    setProducts(prods);
    setLoading(false);
  };

  const handleOpen = (prodEdit?: IProducto) => {
    console.log('click');
    
    if(prodEdit){
      console.log(prodEdit);
      
      setEditingProd(prodEdit);
    } else {
      setOpen(true);
    }
    
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProd(null);
  };

  const handleSave = async (
    nombre: string,
    descripcion: string,
    categoriaId: string,
    fraccion?: { fraccionDeId?: string; unidadesPorFraccion?: number }
  ) => {
    if (editingProd) {
      await editProduct(editingProd.id, nombre, descripcion, categoriaId, fraccion);
    } else {
      await createProduct(nombre, descripcion, categoriaId, fraccion);
    }
    await loadProducts();
    handleClose();
  };

  const handleDelete = async (id: string) => {
    if(confirm('Está seguro que desea eliminar el producto?')) {
      try {
        await deleteProduct(id);
        showMessage('Producto eliminado', 'success');
      } catch (error) {
        showMessage('Error al intentar eliminar el producto. Es problable que esté en uso!', 'error');
      } finally {
        await loadProducts();
      }
    }
  };

  return (
    <Box>
      <Box
        display={"flex"}
        flexDirection={"row"}
        justifyContent={"space-between"}
      >
        <Typography variant="h4">Gestión de Productos</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleOpen()}
        >
          Añadir Producto
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell>Fraccion</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          {loading ? (
            <CircularProgress size="3rem" />
          ) : (
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.nombre}</TableCell>
                  <TableCell>{p.descripcion}</TableCell>
                  <TableCell>
                    <Box
                      display="flex"
                      flexDirection={"row"}
                      justifyContent={"flex-start"}
                    >
                      <Box style={{}} />
                      <span
                        style={{
                          backgroundColor: p.categoria?.color,
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          marginRight: 10,
                        }}
                      />
                      {p.categoria?.nombre || "Sin categoría"}
                    </Box>
                  </TableCell>
                  <TableCell>{`${
                    p.fraccionDe && p.unidadesPorFraccion
                      ? p.fraccionDe.nombre + " - " + p.unidadesPorFraccion
                      : ""
                  }`}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleOpen(p)}
                      color="primary"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(p.id)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </TableContainer>
      
      {(open || !!editingProd) && 
        <ProductoForm
          open={true}
          editingProd={editingProd || undefined}
          handleClose={handleClose}
          handleSave={handleSave}
        />
      }
    </Box>
  );
}
