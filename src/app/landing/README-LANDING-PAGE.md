# 🚀 Landing Page - Cuadre de Caja

## Descripción General

La landing page de Cuadre de Caja es una página pública diseñada para convertir visitantes en leads cualificados. Incluye toda la información necesaria sobre el sistema POS y un chatbot inteligente integrado con n8n.

## Características Principales

### ✨ Secciones Incluidas

1. **Hero Section**
   - Propuesta de valor principal
   - Call-to-action prominente
   - Estadísticas visuales en tiempo real

2. **Features Section**
   - 6 funcionalidades principales con iconos
   - Características técnicas avanzadas
   - Beneficios específicos por característica

3. **Benefits Section**
   - Problemas que resuelve el sistema
   - Beneficios cuantificables con estadísticas
   - Tipos de negocio objetivo

4. **Pricing Section**
   - 3 planes de precios claros
   - Servicios adicionales
   - Garantía de satisfacción

5. **Testimonials Section**
   - 6 testimonios reales con métricas
   - Estadísticas de satisfacción
   - Casos de éxito específicos

6. **Contact Section**
   - Formulario de contacto completo
   - Información de contacto
   - Beneficios de la demo

7. **Footer**
   - Información de contacto
   - Enlaces importantes
   - Funcionalidades resumidas

### 🤖 Chatbot Inteligente

- Widget flotante en esquina inferior derecha
- Integración con n8n para respuestas con IA
- Respuestas de fallback sin conexión
- Preguntas frecuentes predefinidas
- Interfaz conversacional intuitiva

### 📝 Formulario de Contacto

Campos incluidos:
- Nombre completo
- Nombre del negocio
- Correo electrónico
- Teléfono
- Tipo de negocio (dropdown)
- Número de locales (dropdown)
- Mensaje opcional

## Acceso y Rutas

### URL de Acceso
```
https://tu-dominio.com/landing
```

### Rutas API
```
POST /api/contact-form  - Procesar formulario de contacto
```

## Configuración

### Variables de Entorno Necesarias

```env
# Chatbot n8n Integration
NEXT_PUBLIC_N8N_CHATBOT_WEBHOOK=https://your-n8n-instance.com/webhook/chatbot

# Contact Form Integration  
N8N_CONTACT_FORM_WEBHOOK=https://your-n8n-instance.com/webhook/contact-form

# Company Information
COMPANY_EMAIL=info@cuadrecaja.com
COMPANY_PHONE=+57 300 123 4567
```

### Personalización

#### Colores y Tema
Los colores se basan en el tema principal de Material-UI:
- Primario: #1976d2 (azul)
- Secundario: #dc004e (rosa)
- Éxito: #4caf50 (verde)
- ChatBot: #25D366 (verde WhatsApp)

#### Contenido
Para modificar el contenido, edita los archivos:
- `HeroSection.tsx` - Encabezado principal
- `FeaturesSection.tsx` - Características
- `BenefitsSection.tsx` - Beneficios y problemas
- `PricingSection.tsx` - Planes y precios
- `TestimonialsSection.tsx` - Testimonios
- `ContactSection.tsx` - Formulario de contacto

## Funcionalidades Técnicas

### Responsive Design
- Optimizada para móviles, tablets y desktop
- Breakpoints de Material-UI
- Componentes adaptativos

### Performance
- Lazy loading de componentes
- Optimización de imágenes
- Minimización de JavaScript

### SEO Ready
- Meta tags configurados
- Estructura semántica HTML
- Schema markup preparado

### Analytics Ready
- Google Analytics preparado
- Facebook Pixel preparado
- Eventos de conversión configurados

## Integración con n8n

### Chatbot
El chatbot se integra con n8n para:
- Respuestas inteligentes con IA
- Clasificación automática de leads
- Escalamiento a humanos cuando sea necesario
- Análisis de conversaciones

### Formulario de Contacto
Los datos del formulario se pueden enviar a n8n para:
- Crear leads en CRM automáticamente
- Enviar emails de seguimiento
- Programar llamadas de ventas
- Análisis de conversión

## Métricas y Conversión

### KPIs Principales
- Tasa de conversión del formulario
- Interacciones con el chatbot
- Tiempo en página
- Scroll depth
- Clics en CTAs

### Eventos de Conversión
- `form_submit` - Envío de formulario
- `chatbot_interaction` - Uso del chatbot
- `demo_request` - Solicitud de demo
- `pricing_view` - Visualización de precios

## Mantenimiento

### Actualización de Contenido

1. **Precios**: Modificar `PricingSection.tsx`
2. **Testimonios**: Actualizar `TestimonialsSection.tsx`
3. **Características**: Editar `FeaturesSection.tsx`
4. **Información de contacto**: Cambiar `ContactSection.tsx`

### Monitoreo

- Revisar logs de formulario en `/api/contact-form`
- Monitorear respuestas del chatbot
- Verificar integración con n8n
- Analizar métricas de conversión

## Despliegue

### Requisitos
- Node.js 18+
- Next.js 15
- Material-UI v5
- Conexión a n8n (opcional)

### Comandos
```bash
npm run build
npm run start
```

### Variables de Producción
Asegúrate de configurar todas las variables de entorno en tu plataforma de despliegue.

## Soporte y Desarrollo

### Estructura de Archivos
```
src/app/landing/
├── page.tsx                    # Página principal
├── layout.tsx                  # Layout sin sidebar/header
├── components/
│   ├── HeroSection.tsx        # Sección principal
│   ├── FeaturesSection.tsx    # Características
│   ├── BenefitsSection.tsx    # Beneficios
│   ├── PricingSection.tsx     # Precios
│   ├── TestimonialsSection.tsx # Testimonios
│   ├── ContactSection.tsx     # Formulario contacto
│   └── ChatbotWidget.tsx      # Widget chatbot
├── README-LANDING-PAGE.md     # Esta documentación
└── README-CHATBOT-N8N.md     # Documentación chatbot
```

### Próximas Mejoras

1. **A/B Testing** - Diferentes versiones de CTAs
2. **Más Idiomas** - Soporte multiidioma
3. **Video Demo** - Integración de video
4. **Live Chat** - Chat en tiempo real con humanos
5. **Calculadora ROI** - Herramienta de cálculo de beneficios
6. **Blog Integration** - Sección de contenido educativo

## Contacto para Soporte

Para soporte técnico o mejoras:
- Email: dev@cuadrecaja.com
- Documentación: Ver archivos README en el proyecto
- Issues: GitHub repository issues
