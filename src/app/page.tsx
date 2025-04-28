"use client";

import { useAppContext } from "@/context/AppContext";
import { CircularProgress, Typography } from "@mui/material";

const HomePage = () => {
  const { loadingContext, user } = useAppContext();

  if (loadingContext) {
    return <CircularProgress size="3rem" />;
  }

  if (user.tiendas.length === 0) {
    return (
      <Typography variant={"h5"}>
        Bienvenido a cuadre de caja. Su usuario no tiene tiendas asociadas
      </Typography>
    );
  } else if (user.tiendaActual) {
    return (
      <>
        <Typography variant={"h5"}>Bienvenido a cuadre de caja.</Typography>
        <Typography variant={"h6"}>
          Local: {user.tiendaActual.nombre}
        </Typography>
      </>
    );
  }
};

export default HomePage;
