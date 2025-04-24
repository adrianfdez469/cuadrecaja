"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
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
  MenuItem,
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { planesNegocio } from "@/utils/planesNegocio";
import { createNegocio, getNegocios } from "@/services/negocioServce";
import { useMessageContext } from "@/context/MessageContext";
import { INegocio } from "@/types/INegocio";

const planesNegocioArr = Object.entries(planesNegocio);

export default function Tiendas() {
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedNegocio, setSelectedNegocio] = useState(null);
  const { showMessage } = useMessageContext();

  const [nombre, setNombre] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<{
    limiteLocales: number;
    limiteUsuarios: number;
  }>();

  useEffect(() => {
    fetchNegocios();
  }, []);

  const fetchNegocios = async () => {
    try {
      const data = await getNegocios();
      setNegocios(data);
    } catch (error) {
      console.log(error);

      
    }
  };

  const handleSave = async () => {
    try {
      await createNegocio(nombre, selectedPlan.limiteLocales, selectedPlan.limiteUsuarios);
      showMessage('Negocio creado satisfactoriamente', 'success');
    } catch (error) {
      console.log(error);
      showMessage('Ocurrió un error al crear el negocio', 'error');
    }
  };

  const handleDelete = async (id) => {
    console.log(id);
  };

  const handleEdit = (negocio) => {
    console.log(negocio);
  };

  // const resetForm = () => {};

  const handleSetSelectedPlan = (plan) => {
    setSelectedPlan(planesNegocio[plan]);
  };

  const handleCloseDialog = () => {
    setNombre('');
    setSelectedNegocio(undefined);
    setSelectedPlan(undefined);
    setOpen(false);
  }

  return (
    <Box>
      <Box
        display={"flex"}
        flexDirection={"row"}
        justifyContent={"space-between"}
      >
        <Typography variant="h4">Gestión de Negocios</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Agregar Negocio
        </Button>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Límite de Fecha</TableCell>
              <TableCell>Limite de Tiendas</TableCell>
              <TableCell>Limite de Usuarios</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {negocios.map((negocio) => (
              <TableRow key={negocio.id}>
                <TableCell>{negocio.nombre}</TableCell>
                <TableCell>{new Date(negocio.limitTime).toLocaleDateString()}</TableCell>
                <TableCell>{negocio.locallimit}</TableCell>
                <TableCell>{negocio.userlimit}</TableCell>

                <TableCell>
                  <IconButton onClick={() => handleEdit(negocio)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(negocio.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleCloseDialog} fullWidth>
        <DialogTitle>
          {selectedNegocio ? "Editar Negocio" : "Agregar Negocio"}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Nombre"
            fullWidth
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Typography variant="subtitle1">Plan de pago</Typography>
          <Select
            fullWidth
            value={selectedPlan}
            onChange={(e) => handleSetSelectedPlan(e.target.value as string)}
          >
            {planesNegocioArr.map((plan) => (
              <MenuItem key={plan[0]} value={plan[0]}>
                <Typography>{plan[0]}</Typography>
              </MenuItem>
            ))}
          </Select>
          <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: 4,
            marginTop: 2
          }}>
            <Typography>{`Límite locales: ${selectedPlan ? selectedPlan.limiteLocales : '-'}`}</Typography>
            <Typography>{`Límite usuarios: ${selectedPlan ? selectedPlan.limiteUsuarios : '-'} `}</Typography>
          </Box>


        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button disabled={!nombre || !selectedPlan} variant="contained" onClick={handleSave}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
