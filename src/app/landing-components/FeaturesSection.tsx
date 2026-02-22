"use client";

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import {
  ShoppingCart,
  Inventory,
  Analytics,
  Security,
  Store,
  OfflineBolt,
  Receipt,
  LocalOffer,
  NotificationsActive,
  PhoneAndroid,
  CardMembership,
  Handshake,
  ShowChart,
  QrCode2,
} from '@mui/icons-material';

const features = [
  {
    icon: ShoppingCart,
    title: 'Vender sin depender del internet',
    description: 'El flujo de ventas (lo crítico) puede usarse sin conexión; se guardan solas y se sincronizan cuando vuelva el internet. Pantalla pensada para tocar y buscar productos rápidamente.',
    details: ['Búsqueda instantánea', 'Efectivo y transferencia', 'Ventas pendientes hasta sincronizar'],
    color: '#FF6B35',
    modalContent: {
      detail: 'Solo el proceso de venta (cobrar, agregar productos al carrito, registrar el pago) está disponible sin conexión. Si se cae el internet, puedes seguir vendiendo: cada venta se guarda en el dispositivo y, al recuperar la conexión, se sube sola al sistema. Así no pierdes ventas por fallos de red. El resto de funciones (ver reportes, modificar inventario, configurar productos) requiere internet.',
      examples: ['Ejemplo: estás cobrando y se va la luz o el WiFi; terminas la venta y al rato, cuando vuelva la conexión, esa venta ya aparece en el cierre de caja y en los reportes.', 'Puedes usar efectivo y transferencia en la misma venta; el resumen del día separa ambos totales.'],
    },
  },
  {
    icon: Store,
    title: 'Varios locales en uno',
    description: 'Si tienes más de una tienda o almacenes, todo se lleva en un solo sistema. Cada tienda tiene su caja y su inventario; puedes pasar productos entre almacenes y tiendas desde el sistema.',
    details: ['Traspasos entre locales', 'Tiendas y almacenes', 'Cierre de caja por tienda'],
    color: '#4ECDC4',
    modalContent: {
      detail: 'Un mismo negocio puede tener varias tiendas y/o almacenes. Cada uno tiene su propio inventario y su cierre de caja. Puedes crear movimientos de traspaso para enviar productos de un local a otro (por ejemplo, del almacén a la tienda). Los reportes y el dashboard pueden filtrarse por local o verse en conjunto.',
      examples: ['Ejemplo: tienes un almacén y dos tiendas; al cerrar caja ves cuánto vendió cada tienda y cuánto stock quedó en cada sitio.', 'Traspasas 10 unidades del producto X del almacén a la tienda 1 desde el sistema; el stock se descuenta en el almacén y se suma en la tienda.'],
    },
  },
  {
    icon: Receipt,
    title: 'Cierre de caja y resumen del día',
    description: 'Abre y cierra tu caja por día o por turno. Al cerrar ves cuánto vendiste, cuánto entró en efectivo, cuánto por transferencia y cuánto ganaste (tuyo y de productos en consignación).',
    details: ['Resumen por período', 'Totales y ganancias', 'Historial de cierres'],
    color: '#5C6BC0',
    modalContent: {
      detail: 'Antes de empezar a vender abres un período de caja; al terminar el día o el turno lo cierras. En el cierre ves el total vendido, cuánto fue en efectivo, cuánto en transferencia, descuentos aplicados y la ganancia (separando productos propios y en consignación). Todo queda registrado para consultas y reportes posteriores.',
      examples: ['Ejemplo: cierras a las 22:00 y ves "Ventas $150.000, Efectivo $90.000, Transferencia $60.000, Ganancia propia $25.000, Consignación $8.000".', 'Puedes revisar cierres de días anteriores para comparar o llevar el control.'],
    },
  },
  {
    icon: Inventory,
    title: 'Control de inventario y costos',
    description: 'El sistema lleva solito el costo promedio de lo que vendes, así sabes si ganas o pierdes con cada producto. Incluye productos que se venden por unidad, por kilo o por porción.',
    details: ['Cálculo automático de ganancia', 'Productos por unidad, kilo o porción', 'Stock en tiempo real'],
    color: '#45B7D1',
    modalContent: {
      detail: 'Cada producto puede tener un costo de compra; el sistema calcula el costo promedio ponderado (CPP) cuando registras entradas (compra, traspaso, etc.). Así sabes cuánto te costó en promedio cada unidad y si el precio de venta te deja ganancia. Puedes definir productos que se venden por unidad, por peso (kilo) o por porción (fracción), y el sistema ajusta el stock y el costo en consecuencia.',
      examples: ['Ejemplo: compras 20 unidades a $5 y luego 10 a $6; el sistema calcula un costo promedio; al vender ves la ganancia por producto.', 'Producto "Queso": vendes por kilo o por porción; al registrar la venta el stock se descuenta según la cantidad.'],
    },
  },
  {
    icon: QrCode2,
    title: 'Códigos, etiquetas y escaneo',
    description: 'Genera códigos por producto e imprime etiquetas con precio. Escanea con pistola o con la cámara del celular; al escanear se agrega el producto al carrito de ventas. Puedes generar tus propios códigos, imprimir el PDF y pegarlos en el mostrador.',
    details: ['Códigos por producto e impresión de etiquetas', 'Escaneo con pistola o cámara', 'PDF con códigos y precios para pegar en productos'],
    color: '#2E7D32',
    modalContent: {
      detail: 'Puedes asignar o generar un código (código de barras o similar) por producto. El sistema permite imprimir etiquetas con el código y el precio para pegarlas en los productos del mostrador. Si prefieres códigos propios, puedes generarlos en el sistema, imprimir un PDF con todos los códigos y precios, y colocarlos en cada producto. En la venta, escaneas con una pistola de escaneo o con la cámara del celular/tablet y el producto se agrega solo al carrito; no tienes que buscarlo a mano. Ideal para agilizar la venta cuando tienes muchos ítems en mostrador.',
      examples: ['Ejemplo: tienes 50 productos en vitrina; generas códigos, imprimes el PDF de etiquetas con nombre y precio, las pegas en cada uno. Cuando el cliente pide tres productos, escaneas los tres y ya están en la venta.', 'En la tienda usas una pistola de escaneo conectada al equipo, o en el celular abres la cámara y escaneas; el producto se suma al carrito al instante.'],
    },
  },
  {
    icon: Handshake,
    title: 'Productos en consignación',
    description: 'Lleva productos que te deja un proveedor para vender y pagarle después. Registra entradas y devoluciones por proveedor; al cerrar caja ves ventas y ganancia de consignación por separado. Puedes liquidar al proveedor por período. Además, le puedes crear una cuenta al proveedor para que entre al sistema y revise solo el inventario de sus productos en tu negocio, sin ver el resto.',
    details: ['Entradas y devoluciones por proveedor', 'Liquidación por cierre', 'Cuenta para el proveedor (solo ve sus productos)'],
    color: '#8B7355',
    modalContent: {
      detail: 'Los productos en consignación son aquellos que un proveedor te deja para vender; tú le pagas según lo vendido. En el sistema registras las entradas (cuando te deja producto) y las devoluciones (cuando le devuelves lo no vendido). En el cierre de caja las ventas y la ganancia de consignación aparecen separadas de las tuyas. Puedes hacer la liquidación al proveedor por período (qué vendiste, cuánto le corresponde). Opcionalmente, al proveedor se le puede crear un usuario: entra al sistema y solo ve el inventario y movimientos de sus productos, no el resto del negocio.',
      examples: ['Ejemplo: un proveedor de pan te deja 50 unidades; registras "entrada consignación" por ese proveedor. Al vender, el sistema separa ganancia propia de consignación. Al final del mes liquidas y le pagas lo vendido.', 'El proveedor tiene su cuenta y entra desde su casa para ver cuántas unidades suyas tienes en stock y qué se vendió.'],
    },
  },
  {
    icon: ShowChart,
    title: 'Análisis de variación de precios',
    description: 'Ve cómo cambian los precios de compra de tus productos con el tiempo. El sistema te muestra si el costo sube o baja y en qué porcentaje, para que decidas si debes subir o bajar tus precios de venta y mantener tu margen.',
    details: ['Historial de costos por producto', 'Variación y tendencia', 'Ayuda a fijar precios de venta'],
    color: '#9C27B0',
    modalContent: {
      detail: 'El sistema guarda el historial de costos por producto (según las compras o entradas que registres). Puedes ver cómo ha variado el costo en el tiempo y si hay desviaciones respecto al promedio. Así detectas, por ejemplo, si un proveedor te subió el precio y puedes decidir si subes el precio de venta o buscas otra opción para mantener tu margen.',
      examples: ['Ejemplo: el producto "Arroz 1 kg" antes te costaba $2 y ahora $2,50; el reporte te muestra la variación en %; decides subir el precio de venta para no perder margen.', 'Ves qué productos tienen mayor variación de costo y priorizas revisar precios de venta en esos.'],
    },
  },
  {
    icon: LocalOffer,
    title: 'Descuentos y promociones',
    description: 'Aplica descuentos por porcentaje, monto fijo o código. Puedes poner mínimo de compra y fecha de vigencia; en la venta se ve el precio con descuento antes de cobrar.',
    details: ['Porcentaje, fijo o código', 'Mínimo de compra', 'Vista previa en venta'],
    color: '#26A69A',
    modalContent: {
      detail: 'Puedes crear reglas de descuento: por porcentaje (ej. 10 % en toda la compra), monto fijo (ej. $50 de descuento) o mediante un código que el cliente o el vendedor introduce. Las promociones pueden tener vigencia (fecha inicio y fin) y mínimo de compra. En la pantalla de venta, al aplicar el descuento se ve el total con descuento antes de confirmar el cobro.',
      examples: ['Ejemplo: "10 % en compras mayores a $100" válido esta semana; el cliente lleva $150, aplicas la promoción y el total pasa a $135.', 'Código "VERANO20": 20 % en una categoría; el vendedor escribe el código y se aplica el descuento a los productos que correspondan.'],
    },
  },
  {
    icon: Analytics,
    title: 'Reportes y resúmenes',
    description: 'Ve ventas y ganancias en tiempo real. Saca reportes de inventario y cierres de caja en Word o Excel para llevarlos a tu contador o revisarlos cuando quieras.',
    details: ['Métricas en tiempo real', 'Reportes en Word o Excel', 'Análisis por categoría'],
    color: '#96CEB4',
    modalContent: {
      detail: 'El dashboard muestra métricas en tiempo real (ventas del día, productos vendidos, ganancia). Además puedes generar reportes de inventario (qué tienes, costos, valorización) y de cierres de caja (totales por día, por tienda). Esos reportes se pueden exportar a Word o Excel para archivarlos o enviarlos al contador.',
      examples: ['Ejemplo: cada fin de mes exportas el reporte de cierres a Excel y lo envías a tu contador.', 'En el dashboard ves "Hoy: $X vendidos, Y productos, ganancia $Z" y lo comparas con días anteriores.'],
    },
  },
  {
    icon: Security,
    title: 'Quién puede hacer qué',
    description: 'Define qué puede hacer cada persona: vendedor, encargado de almacén o administrador. Puedes limitar por local y el sistema registra quién hizo cada operación.',
    details: ['Permisos por función y por tienda', 'Vendedor, almacén o administrador', 'Registro de quién hizo cada movimiento'],
    color: '#FFEAA7',
    modalContent: {
      detail: 'Cada usuario puede tener un rol (por ejemplo: vendedor, almacenero, administrador) con permisos distintos: el vendedor puede hacer ventas y ver su caja; el almacenero puede registrar movimientos de inventario; el administrador puede todo, incluyendo configuración y reportes. Los permisos pueden limitarse por tienda (un usuario solo ve o actúa en ciertos locales). El sistema registra quién realizó cada venta o movimiento para tener trazabilidad.',
      examples: ['Ejemplo: María solo puede vender en la tienda 1 y no puede ver reportes globales; Juan es administrador y ve todas las tiendas.', 'Revisas quién hizo una venta o un ajuste de inventario en el historial.'],
    },
  },
  {
    icon: OfflineBolt,
    title: 'App en el celular o tablet',
    description: 'Instala el sistema como app en tu celular o tablet. Cobra desde ahí con la misma lógica de cierre de caja y permisos; todo se sincroniza solo.',
    details: ['Instalable como app', 'Ventas desde móvil', 'Sincronización automática'],
    color: '#DDA0DD',
    modalContent: {
      detail: 'Puedes usar Cuadre de Caja desde el celular o la tablet como si fuera una app: se instala en la pantalla de inicio (PWA o app nativa según el plan). Desde el móvil puedes hacer ventas, escanear códigos con la cámara y cerrar caja; las mismas reglas de permisos y cierre aplican. Los datos se sincronizan con el resto de los dispositivos y con la nube.',
      examples: ['Ejemplo: en una feria o punto de venta temporal usas la tablet; al terminar el día cierras caja desde ahí y los datos ya están en tu cuenta.', 'Un vendedor usa el celular para cobrar en la tienda; las ventas se ven en el mismo cierre que el de la caja principal.'],
    },
  },
];

const TEAL = '#4ECDC4';
const TEAL_LIGHT = '#6ee7de';

export default function FeaturesSection() {
  const [modalFeatureIndex, setModalFeatureIndex] = useState<number | null>(null);
  const selectedFeature = modalFeatureIndex !== null ? features[modalFeatureIndex] : null;

  return (
    <Box sx={{ py: 10, bgcolor: '#1e2433', position: 'relative' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="✨ Funcionalidades"
            sx={{
              bgcolor: 'rgba(78, 205, 196, 0.15)',
              color: TEAL_LIGHT,
              border: '1px solid rgba(78, 205, 196, 0.35)',
              mb: 2,
              px: 2,
              fontWeight: 600,
            }}
          />
          <Typography 
            variant="h3" 
            component="h2" 
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}
          >
            Todo lo que tu Negocio Necesita
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Todo lo que necesitas para vender, controlar stock y saber cuánto ganas. Si tienes un solo local o varios, hay un plan para ti.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  onClick={() => setModalFeatureIndex(index)}
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      borderColor: 'rgba(78, 205, 196, 0.25)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: feature.color,
                          width: 56,
                          height: 56,
                          mr: 2,
                        }}
                      >
                        <IconComponent sx={{ fontSize: 28, color: 'white' }} />
                      </Avatar>
                      <Typography 
                        variant="h6" 
                        component="h3"
                        sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}
                      >
                        {feature.title}
                      </Typography>
                    </Box>
                    
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        mb: 3, 
                        color: 'rgba(255,255,255,0.75)',
                        lineHeight: 1.6,
                        flexGrow: 1
                      }}
                    >
                      {feature.description}
                    </Typography>

                    <Stack spacing={1}>
                      {feature.details.map((detail, detailIndex) => (
                        <Box key={detailIndex} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: feature.color,
                              mr: 1.5,
                              flexShrink: 0,
                            }}
                          />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            {detail}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                    <Typography variant="caption" sx={{ mt: 2, color: 'rgba(255,255,255,0.5)' }}>
                      Haz clic para ver más detalles
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Modal detalle funcionalidad */}
        <Dialog
          open={modalFeatureIndex !== null}
          onClose={() => setModalFeatureIndex(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: '#252a3a',
              color: 'white',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.1)',
            },
          }}
        >
          {selectedFeature && (() => {
          const ModalIcon = selectedFeature.icon;
          return (
            <>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
                <Avatar sx={{ bgcolor: selectedFeature.color, width: 48, height: 48 }}>
                  <ModalIcon sx={{ fontSize: 24, color: 'white' }} />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', flex: 1 }}>
                  {selectedFeature.title}
                </Typography>
                <IconButton onClick={() => setModalFeatureIndex(null)} sx={{ color: 'rgba(255,255,255,0.7)' }} size="small">
                  <Close />
                </IconButton>
              </DialogTitle>
              <DialogContent sx={{ pt: 3 }}>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, mb: 3 }}>
                  {selectedFeature.modalContent.detail}
                </Typography>
                {selectedFeature.modalContent.examples && selectedFeature.modalContent.examples.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: TEAL_LIGHT, fontWeight: 600, mb: 1.5 }}>
                      Ejemplos:
                    </Typography>
                    <Stack spacing={1.5}>
                      {selectedFeature.modalContent.examples.map((ex, i) => (
                        <Box
                          key={i}
                          sx={{
                            pl: 2,
                            borderLeft: `3px solid ${selectedFeature.color}`,
                            py: 0.5,
                          }}
                        >
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
                            {ex}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </DialogContent>
            </>
          );
          })()}
        </Dialog>

        {/* Más valor para tu negocio */}
        <Box sx={{ mt: 8 }}>
          <Typography 
            variant="h4" 
            component="h3" 
            textAlign="center"
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 6 }}
          >
            Más valor para tu negocio
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <PhoneAndroid sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  App móvil
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Registra ventas desde celular o tablet con la misma seguridad y cierre de caja
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <NotificationsActive sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Notificaciones
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Alertas y avisos centralizados por negocio para tu equipo
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <CardMembership sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Planes por suscripción
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Límites de locales, usuarios y productos según el plan que elijas
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Store sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Destinos de transferencia
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Puedes configurar destinos de transferencia para que al momento del cierre de caja sepas cuanto de la venta tienes en cada una de tus tarjetas.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
