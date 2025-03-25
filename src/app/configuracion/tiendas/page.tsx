"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Select,
  MenuItem
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import axios from "axios";

export default function Tiendas() {
  const [tiendas, setTiendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedTienda, setSelectedTienda] = useState(null);
  const [nombre, setNombre] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    fetchTiendas();
    fetchUsuarios();
  }, []);

  const fetchTiendas = async () => {
    const response = await axios.get("/api/tiendas");
    setTiendas(response.data);
  };

  const fetchUsuarios = async () => {
    const response = await axios.get("/api/usuarios");
    setUsuarios(response.data);
  };

  const handleSave = async () => {
    if (selectedTienda) {
      await axios.put(`/api/tiendas/${selectedTienda.id}`, {
        nombre,
        idusuarios: selectedUsers,
      });
    } else {
      await axios.post("/api/tiendas", {
        nombre,
        idusuarios: selectedUsers,
      });
    }
    fetchTiendas();
    setOpen(false);
    resetForm();
  };

  const handleDelete = async (id) => {
    await axios.delete(`/api/tiendas/${id}`);
    fetchTiendas();
  };

  const handleEdit = (tienda) => {
    setSelectedTienda(tienda);
    setNombre(tienda.nombre);
    setSelectedUsers(tienda.usuarios.map((u) => u.id));
    setOpen(true);
  };

  const resetForm = () => {
    setSelectedTienda(null);
    setNombre("");
    setSelectedUsers([]);
  };

  return (
    <Box>
      <Box display={'flex'} flexDirection={'row'} justifyContent={'space-between'}>
        <Typography variant="h4">Gestión de Tiendas</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Agregar Tienda</Button>
      </Box>
      
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Usuarios</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tiendas.map((tienda) => (
              <TableRow key={tienda.id}>
                <TableCell>{tienda.nombre}</TableCell>
                <TableCell>
                  {tienda.usuarios.map((user) => (
                    <Typography key={user.id}>{user.nombre}</Typography>
                  ))}
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEdit(tienda)}><Edit /></IconButton>
                  <IconButton onClick={() => handleDelete(tienda.id)}><Delete /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth>
        <DialogTitle>{selectedTienda ? "Editar Tienda" : "Agregar Tienda"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Nombre"
            fullWidth
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Typography variant="subtitle1">Usuarios</Typography>
          <Select
            multiple
            fullWidth
            value={selectedUsers}
            onChange={(e) => setSelectedUsers(e.target.value as any)}
          >
            {usuarios.map((usuario) => (
              <MenuItem key={usuario.id} value={usuario.id}>{usuario.nombre}</MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
