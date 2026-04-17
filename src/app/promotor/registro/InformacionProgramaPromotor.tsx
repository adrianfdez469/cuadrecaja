import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function InformacionProgramaPromotor() {
  return (
    <Box sx={{ color: 'rgba(255,255,255,0.88)' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#6ee7de' }}>
        Guía para nuevos promotores
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)' }}>
        Aquí tienes lo esencial del programa. Cuadre de Caja es un sistema de punto de venta e inventario para
        negocios; el programa de promotores sirve para que personas o negocios recomienden la plataforma y
        reciban una recompensa cuando se cumplan las reglas del programa.
      </Typography>

      <Accordion
        defaultExpanded
        disableGutters
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px !important',
          mb: 1,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />}>
          <Typography fontWeight={600}>¿Qué es ser promotor?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'rgba(255,255,255,0.78)' }}>
            Recibes un código único (formato <strong>PRM-XXXX</strong>). Lo compartes con dueños de negocios que
            quieran usar Cuadre de Caja. Si se registran con tu código y más adelante cumplen las condiciones del
            programa, puedes tener derecho a una recompensa según las reglas vigentes. Tú no vendes licencias: solo
            refieres; el alta y el cobro del plan los gestiona el equipo de Cuadre de Caja.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px !important',
          mb: 1,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />}>
          <Typography fontWeight={600}>¿Cómo funciona el proceso?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List dense sx={{ py: 0 }}>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <CheckCircleOutlineIcon sx={{ color: '#4ECDC4', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="1. Registro"
                secondary="Envías este formulario con tu nombre y correo. Recibirás un enlace para activar tu cuenta de promotor (revisa spam)."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <CheckCircleOutlineIcon sx={{ color: '#4ECDC4', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="2. Activación"
                secondary="Al abrir el enlace confirmas tu correo y se genera tu código PRM-XXXX."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <CheckCircleOutlineIcon sx={{ color: '#4ECDC4', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="3. Compartir"
                secondary="Das tu código o un enlace con tu código a quien vaya a darse de alta. El negocio nuevo debe introducir el código al registrarse (por ejemplo en el formulario de contacto o en la activación de cuenta)."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <CheckCircleOutlineIcon sx={{ color: '#4ECDC4', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="4. Calificación"
                secondary="Cuando el negocio referido contrata un plan de pago y el primer pago queda registrado en el sistema, el referido puede pasar a estado calificado y la recompensa queda reflejada según la regla del plan vigente en ese momento."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <CheckCircleOutlineIcon sx={{ color: '#4ECDC4', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="5. Liquidación"
                secondary="Un responsable de Cuadre de Caja marca la liquidación cuando la recompensa se haya pagado o acreditado según lo acordado. Verás en tu panel estados como pendiente o liquidado."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px !important',
          mb: 1,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />}>
          <Typography fontWeight={600}>¿Qué gana el negocio que refiero?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'rgba(255,255,255,0.78)' }}>
            Según las reglas de referidos configuradas en el sistema, el negocio nuevo puede tener derecho a un
            descuento asociado al plan que contrate. El descuento concreto depende del plan y de las reglas
            activas en el momento de la calificación; no es un porcentaje fijo prometido en esta página.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px !important',
          mb: 1,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />}>
          <Typography fontWeight={600}>¿Qué gano yo y cuánto?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'rgba(255,255,255,0.78)' }}>
            La recompensa del promotor está definida por <strong>tabla de reglas por plan</strong> (importes que
            puede ver el equipo interno). Cuando un referido queda calificado, en tu panel de promotor verás los
            importes de referencia (descuento al negocio y recompensa al promotor) según lo aplicado en ese
            momento. Si necesitas cifras concretas antes de empezar, pide al equipo de Cuadre de Caja el detalle de
            planes vigentes.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px !important',
          mb: 1,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />}>
          <Typography fontWeight={600}>Formas de pago y plazos</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'rgba(255,255,255,0.78)' }}>
            El sistema <strong>no transfiere dinero automáticamente</strong> a tu cuenta. La liquidación es{' '}
            <strong>manual</strong>: cuando corresponda, se coordina contigo (por ejemplo efectivo, transferencia
            bancaria u otro medio acordado con Cuadre de Caja). En el panel verás cuándo figura como liquidado.
            Los plazos de pago tras la calificación dependen del acuerdo operativo con el equipo; no son un SLA
            técnico fijado en esta web.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px !important',
          mb: 1,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />}>
          <Typography fontWeight={600}>Condiciones y límites importantes</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List dense sx={{ py: 0 }}>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <InfoOutlinedIcon sx={{ color: '#ffb74d', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="Mismo correo que el dueño del negocio"
                secondary="Si el correo del promotor es el mismo que el del administrador del negocio referido, el sistema marca el caso como fraude y no hay recompensa para el promotor."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <InfoOutlinedIcon sx={{ color: '#ffb74d', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="Solo el periodo de prueba no basta"
                secondary="Hace falta que el negocio pase a plan de pago y se registre el primer pago en el sistema para que el referido pueda calificar para recompensa."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <InfoOutlinedIcon sx={{ color: '#ffb74d', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="Baja sin pago"
                secondary="Si el negocio se elimina por no haber contratado plan de pago (por ejemplo tras el periodo de prueba), el referido se cancela y no genera recompensa."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
            <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <InfoOutlinedIcon sx={{ color: '#ffb74d', fontSize: 22 }} />
              </ListItemIcon>
              <ListItemText
                primary="Enlaces de correo"
                secondary="Los enlaces de activación y de acceso caducan y son de un solo uso; si expiran, puedes solicitar uno nuevo desde el registro o la página de acceso."
                primaryTypographyProps={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.72)', sx: { mt: 0.5 } }}
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px !important',
          mb: 1,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />}>
          <Typography fontWeight={600}>Privacidad y datos</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'rgba(255,255,255,0.78)' }}>
            Usamos tu nombre y correo para gestionar tu cuenta de promotor, enviarte enlaces de activación y
            acceso, y para mostrarte en el panel el estado de tus referidos. No compartimos tu correo con terceros
            para fines ajenos al programa sin la base legal o el consentimiento que corresponda.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>
        El programa puede actualizarse; en caso de discrepancia entre esta página y una comunicación oficial del
        equipo de Cuadre de Caja, prevalece lo acordado por ese canal. Si ya tienes cuenta, usa la página de{' '}
        <strong>acceso con enlace mágico</strong> en lugar de volver a registrarte.
      </Typography>
    </Box>
  );
}
