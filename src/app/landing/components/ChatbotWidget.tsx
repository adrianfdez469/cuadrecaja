"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Fab,
  Paper,
  Typography,
  TextField,
  Button,
  Avatar,
  Stack,
  Chip,
  IconButton,
  Fade,
  CircularProgress,
} from '@mui/material';
import {
  Chat,
  Close,
  Send,
  SmartToy,
  Minimize,
} from '@mui/icons-material';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const quickQuestions = [
  '¿Cuánto cuesta el sistema?',
  '¿Funciona sin internet?',
  '¿Cómo funciona la demo?',
  '¿Qué incluye el plan básico?',
  '¿Puedo manejar varias tiendas?',
  '¿Hay capacitación incluida?'
];

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '¡Hola! 👋 Soy el asistente virtual de Cuadre de Caja. Estoy aquí para resolver todas tus dudas sobre nuestro sistema POS. ¿En qué puedo ayudarte?',
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const sendMessageToN8N = async (message: string): Promise<string> => {
    try {
      const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_CHATBOT_WEBHOOK;
      const N8N_API_KEY = process.env.N8N_API_KEY;
      // const N8N_WEBHOOK_URL = "https://n8n.srv1022003.hstgr.cloud/webhook-test/a53c36ec-c0db-4b1c-a1fc-afbe9111b79e";
      
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': N8N_API_KEY || '',
        },
        body: JSON.stringify({
          message: message,
          timestamp: new Date().toISOString(),
          source: 'landing-page-chatbot'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.response || data.message || 'Gracias por tu pregunta. Un especialista se contactará contigo pronto.';
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error enviando mensaje a n8n:', error);
      
      // Respuestas de fallback basadas en palabras clave
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('precio') || lowerMessage.includes('costo') || lowerMessage.includes('cuánto')) {
        return 'Nuestros planes empiezan desde $89,000/mes. Tenemos planes Básico, Profesional y Empresarial. ¿Te gustaría que te envíe más detalles por email?';
      }
      
      if (lowerMessage.includes('internet') || lowerMessage.includes('offline') || lowerMessage.includes('conexión')) {
        return '¡Sí! Una de nuestras características principales es el funcionamiento offline. Puedes seguir vendiendo sin conexión a internet y todo se sincroniza automáticamente cuando vuelve la conexión.';
      }
      
      if (lowerMessage.includes('demo') || lowerMessage.includes('prueba') || lowerMessage.includes('gratis')) {
        return 'Ofrecemos una demo personalizada de 30 minutos completamente gratis. También incluye 15 días de prueba sin costo. ¿Te gustaría programar una demo?';
      }
      
      if (lowerMessage.includes('tienda') || lowerMessage.includes('local') || lowerMessage.includes('multi')) {
        return 'Sí, nuestro sistema está diseñado para manejar múltiples tiendas desde una sola plataforma. Puedes controlar inventarios independientes y hacer traspasos automáticos entre locales.';
      }
      
      if (lowerMessage.includes('capacitación') || lowerMessage.includes('entrenamiento') || lowerMessage.includes('aprender')) {
        return 'Incluimos capacitación completa para tu equipo sin costo adicional. También tenemos soporte técnico 24/7 y documentación detallada.';
      }
      
      return 'Gracias por tu pregunta. Te recomiendo completar el formulario de contacto para que uno de nuestros especialistas pueda darte información más detallada. 😊';
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const botResponse = await sendMessageToN8N(textToSend);
      
      // Simular delay de escritura
      setTimeout(() => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: botResponse,
          isUser: false,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, botMessage]);
        setIsTyping(false);
      }, 1000 + Math.random() * 1000);
      
    } catch (error) {
      console.error('Error:', error);
      setIsTyping(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <Fab
        color="primary"
        onClick={() => setIsOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          bgcolor: '#25D366',
          '&:hover': {
            bgcolor: '#128C7E',
            transform: 'scale(1.1)',
          },
          transition: 'all 0.3s ease',
          animation: 'pulse 2s infinite',
          '@keyframes pulse': {
            '0%': {
              boxShadow: '0 0 0 0 rgba(37, 211, 102, 0.7)',
            },
            '70%': {
              boxShadow: '0 0 0 10px rgba(37, 211, 102, 0)',
            },
            '100%': {
              boxShadow: '0 0 0 0 rgba(37, 211, 102, 0)',
            },
          },
        }}
      >
        <Chat />
      </Fab>
    );
  }

  return (
    <Fade in={isOpen}>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: isMinimized ? 24 : 24,
          right: 24,
          width: isMinimized ? 320 : 380,
          height: isMinimized ? 60 : 500,
          zIndex: 1000,
          borderRadius: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            bgcolor: '#25D366',
            color: 'white',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'white', color: '#25D366', mr: 1, width: 32, height: 32 }}>
              <SmartToy />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                Asistente Virtual
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Cuadre de Caja
              </Typography>
            </Box>
          </Box>
          
          <Box>
            <IconButton
              size="small"
              onClick={() => setIsMinimized(!isMinimized)}
              sx={{ color: 'white', mr: 0.5 }}
            >
              <Minimize />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setIsOpen(false)}
              sx={{ color: 'white' }}
            >
              <Close />
            </IconButton>
          </Box>
        </Box>

        {!isMinimized && (
          <>
            {/* Messages */}
            <Box
              sx={{
                flexGrow: 1,
                p: 2,
                overflowY: 'auto',
                bgcolor: '#f5f5f5',
                '&::-webkit-scrollbar': {
                  width: '4px',
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: 'rgba(0,0,0,0.2)',
                  borderRadius: '2px',
                },
              }}
            >
              <Stack spacing={2}>
                {messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      display: 'flex',
                      justifyContent: message.isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: '80%',
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: message.isUser ? '#1976d2' : 'white',
                        color: message.isUser ? 'white' : 'text.primary',
                        boxShadow: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                        {message.text}
                      </Typography>
                    </Box>
                  </Box>
                ))}

                {isTyping && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'white',
                        boxShadow: 1,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Escribiendo...
                      </Typography>
                    </Box>
                  </Box>
                )}

                {messages.length === 1 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Preguntas frecuentes:
                    </Typography>
                    <Stack spacing={1}>
                      {quickQuestions.slice(0, 3).map((question, index) => (
                        <Chip
                          key={index}
                          label={question}
                          variant="outlined"
                          size="small"
                          onClick={() => handleQuickQuestion(question)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: 'primary.light',
                              color: 'white',
                            },
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
              <div ref={messagesEndRef} />
            </Box>

            {/* Input */}
            <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  ref={inputRef}
                  fullWidth
                  size="small"
                  placeholder="Escribe tu pregunta..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isTyping}
                />
                <Button
                  variant="contained"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isTyping}
                  sx={{ minWidth: 'auto', px: 2 }}
                >
                  <Send />
                </Button>
              </Box>
            </Box>
          </>
        )}
      </Paper>
    </Fade>
  );
}
