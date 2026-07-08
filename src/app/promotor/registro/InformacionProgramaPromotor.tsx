'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { IPublicReferralRewardRule } from '@/lib/referrals/publicRewardRules';
import { formatCurrency } from '@/utils/formatters';

const ACCORDION_SUMMARY_SX = {
  '& .MuiAccordionSummary-content .MuiTypography-root': {
    color: '#ffffff',
    fontWeight: 700,
  },
};

const accordionSx = {
  bgcolor: 'rgba(255,255,255,0.04)',
  color: 'inherit',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px !important',
  mb: 1,
  '&:before': { display: 'none' },
};

function formatUsd(amount: number): string {
  return `${formatCurrency(amount)} USD`;
}

function RewardRulesTable({
  rules,
  valueKey,
  valueLabel,
}: {
  rules: IPublicReferralRewardRule[];
  valueKey: 'rewardForPromoter' | 'discountForNewBusiness';
  valueLabel: string;
}) {
  if (rules.length === 0) {
    return (
      <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'rgba(255,255,255,0.78)' }}>
        No hay reglas activas publicadas en este momento. Contacta al equipo de Cuadre de Caja para conocer
        los importes vigentes.
      </Typography>
    );
  }

  const sortedRules = rules.toSorted((a, b) => a[valueKey] - b[valueKey]);

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 280 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, borderColor: 'rgba(255,255,255,0.12)' }}>
              Plan
            </TableCell>
            <TableCell
              align="right"
              sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, borderColor: 'rgba(255,255,255,0.12)' }}
            >
              {valueLabel}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRules.map((rule) => (
            <TableRow key={rule.planNombre}>
              <TableCell sx={{ color: 'rgba(255,255,255,0.92)', borderColor: 'rgba(255,255,255,0.08)' }}>
                {rule.planNombre}
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: '#6ee7de', fontWeight: 700, borderColor: 'rgba(255,255,255,0.08)' }}
              >
                {formatUsd(rule[valueKey])}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'rgba(255,255,255,0.55)' }}>
        Importes configurados en el sistema y aplicables cuando el referido califica según las reglas del
        programa.
      </Typography>
    </Box>
  );
}

export default function InformacionProgramaPromotor() {
  const [rules, setRules] = useState<IPublicReferralRewardRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadRules = async () => {
      try {
        const response = await fetch('/api/public/referral-reward-rules');
        const data = (await response.json()) as { ok?: boolean; items?: IPublicReferralRewardRule[] };
        if (!cancelled && response.ok && data.ok && Array.isArray(data.items)) {
          setRules(data.items);
        }
      } catch {
        // Si falla la carga, se muestra el mensaje de reglas no disponibles.
      } finally {
        if (!cancelled) setLoadingRules(false);
      }
    };

    void loadRules();
    return () => {
      cancelled = true;
    };
  }, []);

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

      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 2,
          bgcolor: 'rgba(78, 205, 196, 0.14)',
          border: '1px solid rgba(78, 205, 196, 0.4)',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ffffff', mb: 1 }}>
          Lo que ganas por referido
        </Typography>
        {loadingRules ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={24} sx={{ color: '#6ee7de' }} />
          </Box>
        ) : (
          <RewardRulesTable rules={rules} valueKey="rewardForPromoter" valueLabel="Recompensa (USD)" />
        )}
        <Typography variant="body2" sx={{ mt: 1.25, color: 'rgba(255,255,255,0.88)' }}>
          El método de pago será acordado entre los
          administradores del sistema y el promotor.
        </Typography>
      </Box>

      <Accordion defaultExpanded disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />} sx={ACCORDION_SUMMARY_SX}>
          <Typography>¿Qué es ser promotor?</Typography>
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

      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />} sx={ACCORDION_SUMMARY_SX}>
          <Typography>¿Cómo funciona el proceso?</Typography>
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

      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />} sx={ACCORDION_SUMMARY_SX}>
          <Typography>¿Qué gana el negocio que refiero?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'rgba(255,255,255,0.78)', mb: 2 }}>
            Según las reglas de referidos configuradas en el sistema, el negocio nuevo puede tener derecho a un
            descuento asociado al plan que contrate. El descuento concreto depende del plan y de las reglas
            activas en el momento de la calificación:
          </Typography>
          {loadingRules ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} sx={{ color: '#6ee7de' }} />
            </Box>
          ) : (
            <RewardRulesTable rules={rules} valueKey="discountForNewBusiness" valueLabel="Descuento" />
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />} sx={ACCORDION_SUMMARY_SX}>
          <Typography>¿Qué gano yo y cuánto?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'rgba(255,255,255,0.78)', mb: 2 }}>
            La recompensa del promotor está definida por plan. Cuando un referido queda calificado, en tu panel
            verás los importes aplicados en ese momento. La moneda es siempre USD y el método de pago se acuerda
            entre los administradores del sistema y el promotor.
          </Typography>
          {loadingRules ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} sx={{ color: '#6ee7de' }} />
            </Box>
          ) : (
            <RewardRulesTable rules={rules} valueKey="rewardForPromoter" valueLabel="Tu recompensa (USD)" />
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />} sx={ACCORDION_SUMMARY_SX}>
          <Typography>Formas de pago y plazos</Typography>
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

      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />} sx={ACCORDION_SUMMARY_SX}>
          <Typography>Condiciones y límites importantes</Typography>
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

      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#6ee7de' }} />} sx={ACCORDION_SUMMARY_SX}>
          <Typography>Privacidad y datos</Typography>
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
