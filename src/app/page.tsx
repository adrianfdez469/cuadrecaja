"use client"

import { useAppContext } from "@/context/AppContext";
import { Button, Card, CardContent, CircularProgress, FormControlLabel, Radio, RadioGroup, Typography } from "@mui/material";
import { useEffect, useState } from "react";

const HomePage = () => {

  const [selectedTienda, setSelectedTienda] = useState("");
  const { loadingContext, user, seleccionarTiendaActual } = useAppContext();
  
  
  const handleSelectTienda = (value) => {
    setSelectedTienda(value);
    const tiendaSeleccionada = user.tiendas.find(t => t.id === value);
    if (tiendaSeleccionada) {
      // setear la tienda en el contexto
      seleccionarTiendaActual(tiendaSeleccionada);
    }
  }

  const handleConfirm = () => {
    const tiendaSeleccionada = user.tiendas.find(t => t.id === selectedTienda);
    if (tiendaSeleccionada) {
      // setear la tienda en el contexto
      seleccionarTiendaActual(tiendaSeleccionada);
    }
  }

  useEffect(() => {
    if(!loadingContext) {
      if(!user.tiendaActual && user.tiendas.length === 1){
        handleSelectTienda(user.tiendas[0].id);
      }
    }
  }, [user, loadingContext])
  
  if(loadingContext) {
    return (
      <CircularProgress size="3rem" />
    ); 
  }
  
  if(user.tiendas.length === 0) {
    return <Typography variant={'h5'}>Bienvenido a cuadre de caja. Su usuario no tiene tiendas asociadas</Typography>
  } else if(selectedTienda) {
    return (
      <>
      <Typography variant={'h5'}>Bienvenido a cuadre de caja.</Typography>
      <Typography variant={'h6'}>Local: {user.tiendaActual.nombre}</Typography>
      </>
     )
  } else if (!selectedTienda){
    return (
      <Card sx={{ maxWidth: 400, mx: "auto", mt: 10, p: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Selecciona una tienda
          </Typography>
          <RadioGroup value={selectedTienda} onChange={(e) => handleSelectTienda(e.target.value)}>
            {user.tiendas.map((tienda) => (
              <FormControlLabel
                key={tienda.id}
                value={tienda.id}
                control={<Radio />}
                label={tienda.nombre}
              />
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    );
  }

}

export default HomePage;