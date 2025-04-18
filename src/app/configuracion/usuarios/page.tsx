"use client"

import { useEffect, useState } from "react";
import { Container, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import axios from "axios";
import useConfirmDialog from "@/components/confirmDialog";

const roles = ["ADMIN", "VENDEDOR"];

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [adminCant, setAdminCant] = useState(0);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    fetchUsuarios();
  }, []);

  useEffect(() => {
    setAdminCant(usuarios.filter(user => user.rol === "ADMIN").length);
  }, [usuarios]);

  

  const fetchUsuarios = async () => {
    try {
      const response = await axios.get("/api/usuarios");
      setUsuarios(response.data);
    } catch (error) {
      console.error("Error al obtener los usuarios", error);
    }
  };

  const handleOpen = (user = null) => {
    setEditingUser(user);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
  };

  const handleDelete = async (id) => {
    confirmDialog("¿Estás seguro de eliminar este usuario?",  async () => {
      try {
        await axios.delete(`/api/usuarios/${id}`);
        fetchUsuarios();
      } catch (error) {
        console.error("Error al eliminar el usuario", error);
      }
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = {
      nombre: formData.get("nombre"),
      usuario: formData.get("usuario"),
      password: formData.get("password"),
      rol: formData.get("rol"),
    };

    try {
      if (editingUser) {
        await axios.put(`/api/usuarios/${editingUser.id}`, data);
      } else {
        await axios.post("/api/usuarios", data);
      }
      fetchUsuarios();
      handleClose();
    } catch (error) {
      console.error("Error al guardar el usuario", error);
    }
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Gestión de Usuarios
      </Typography>
      <Button variant="contained" color="primary" onClick={() => handleOpen()}>
        Nuevo Usuario
      </Button>
      <TableContainer component={Paper} sx={{ marginTop: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usuarios.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.nombre}</TableCell>
                <TableCell>{user.usuario}</TableCell>
                <TableCell>{user.rol}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(user)} color="primary">
                    <Edit />
                  </IconButton>
                  {adminCant > 1} {
                    <IconButton onClick={() => handleDelete(user.id)} color="error">
                      <Delete />
                    </IconButton>
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit} id="usuario-form">
            <TextField fullWidth margin="dense" label="Nombre" name="nombre" defaultValue={editingUser?.nombre || ""} required />
            <TextField fullWidth margin="dense" label="Usuario" name="usuario" defaultValue={editingUser?.usuario || ""} required />
            <TextField fullWidth margin="dense" label="Contraseña" name="password" type="password" required={!editingUser} />
            <TextField fullWidth margin="dense" select label="Rol" name="rol" defaultValue={editingUser?.rol || "VENDEDOR"}>
              {roles.map((role) => (
                <MenuItem key={role} value={role}>{role}</MenuItem>
              ))}
            </TextField>
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary">
            Cancelar
          </Button>
          <Button type="submit" form="usuario-form" variant="contained" color="primary">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </Container>
  );
}
