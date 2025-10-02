# 🤖 Configuración del Chatbot con n8n

## Descripción
El chatbot de la landing page está preparado para integrarse con n8n, una plataforma de automatización de flujos de trabajo que permite crear un asistente inteligente con IA.

## Configuración de n8n

### 1. Crear el Workflow en n8n

Necesitas crear un workflow en n8n con los siguientes nodos:

```
Webhook → AI Agent → HTTP Response
```

### 2. Configurar el Webhook

1. **Webhook Node**:
   - Method: POST
   - Path: `/webhook/chatbot`
   - Response Mode: `Respond to Webhook`

2. **Estructura de datos esperada**:
```json
{
  "message": "¿Cuánto cuesta el sistema?",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "source": "landing-page-chatbot"
}
```

### 3. Configurar el AI Agent

Puedes usar cualquiera de estos servicios de IA:

#### Opción A: OpenAI (ChatGPT)
```javascript
// En el nodo de OpenAI
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": `Eres un asistente virtual especializado en Cuadre de Caja, un sistema POS para pequeñas y medianas empresas.

INFORMACIÓN DEL SISTEMA:
- Sistema de punto de venta multi-tienda
- Funciona offline y online
- Gestión completa de inventario
- Reportes profesionales exportables a Word
- Planes desde $89,000/mes
- Demo gratuita de 30 minutos
- 15 días de prueba sin costo
- Soporte 24/7 incluido
- Capacitación completa incluida

INSTRUCCIONES:
- Responde en español
- Sé amigable y profesional
- Si no sabes algo específico, recomienda contactar al equipo de ventas
- Siempre ofrece la demo gratuita
- Mantén las respuestas concisas pero informativas`
    },
    {
      "role": "user",
      "content": "{{ $json.message }}"
    }
  ],
  "max_tokens": 200,
  "temperature": 0.7
}
```

#### Opción B: Anthropic Claude
```javascript
// En el nodo de Anthropic
{
  "model": "claude-3-sonnet-20240229",
  "max_tokens": 200,
  "messages": [
    {
      "role": "user",
      "content": `Contexto: Eres asistente de Cuadre de Caja, sistema POS para PYMES.

Información clave:
- POS multi-tienda con funcionamiento offline
- Gestión completa de inventario
- Reportes exportables a Word
- Precios de 10,20 y 30 USD al mes. Ajustable según persoanlizaciones. 
- Demo gratis de 15 días prueba.
- Soporte 24/7 y capacitación incluida

Pregunta del usuario: {{ $json.message }}

Responde en español, amigable y profesional. Si no sabes algo específico, recomienda contactar ventas.`
    }
  ]
}
```

### 4. Configurar la Respuesta

En el nodo **HTTP Response**:
```json
{
  "response": "{{ $json.choices[0].message.content }}",
  "timestamp": "{{ new Date().toISOString() }}",
  "success": true
}
```

## Variables de Entorno

Agrega estas variables a tu archivo `.env.local`:

```env
# n8n Chatbot Configuration
NEXT_PUBLIC_N8N_CHATBOT_WEBHOOK=https://tu-instancia-n8n.com/webhook/chatbot

# Opcional: Para webhook del formulario de contacto
N8N_CONTACT_FORM_WEBHOOK=https://tu-instancia-n8n.com/webhook/contact-form
```

## Workflow Avanzado (Opcional)

Para un chatbot más sofisticado, puedes agregar:

### 1. Base de Conocimientos
- Nodo **Vector Store** con información detallada del sistema
- **Pinecone** o **Qdrant** para búsqueda semántica

### 2. Análisis de Sentimientos
- Detectar frustración o interés del usuario
- Escalar automáticamente a humano si es necesario

### 3. Seguimiento de Conversaciones
- Guardar conversaciones en base de datos
- Generar leads automáticamente

### 4. Integración con CRM
- Crear contactos automáticamente
- Programar follow-ups

## Ejemplo de Workflow Completo

```
Webhook
  ↓
Análisis de Intención (IA)
  ↓
Switch (por tipo de pregunta)
  ├── Precios → Respuesta Predefinida + Ofrecer Demo
  ├── Funcionalidades → Consulta Vector Store
  ├── Soporte → Escalar a Humano
  └── General → AI Agent
  ↓
Guardar Conversación (Database)
  ↓
HTTP Response
```

## Testing

Para probar la integración:

1. Abre la landing page en `/landing`
2. Haz clic en el chatbot (esquina inferior derecha)
3. Envía un mensaje de prueba
4. Verifica que llegue a tu webhook de n8n
5. Confirma que la respuesta se muestre correctamente

## Fallback sin n8n

Si n8n no está disponible, el chatbot tiene respuestas predefinidas basadas en palabras clave:

- **Precios**: Información de planes
- **Offline**: Funcionalidad sin internet
- **Demo**: Proceso de demostración
- **Multi-tienda**: Capacidades multi-local
- **Capacitación**: Información de entrenamiento

## Soporte

Si necesitas ayuda con la configuración:
1. Revisa los logs del navegador (F12 → Console)
2. Verifica que el webhook de n8n esté activo
3. Confirma las variables de entorno
4. Testa el webhook directamente con Postman

## Próximos Pasos

1. **Configurar n8n** con el workflow básico
2. **Entrenar la IA** con más información específica
3. **Configurar analytics** para medir efectividad
4. **Integrar con CRM** para generar leads automáticamente
