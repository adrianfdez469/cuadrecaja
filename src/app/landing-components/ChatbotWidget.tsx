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
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generar o recuperar sessionId único para usuarios anónimos
  useEffect(() => {
    const generateSessionId = () => {
      return 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };

    // Intentar recuperar sessionId existente del localStorage
    const existingSessionId = localStorage.getItem('chatbot_session_id');
    
    if (existingSessionId) {
      setSessionId(existingSessionId);
    } else {
      // Generar nuevo sessionId y guardarlo
      const newSessionId = generateSessionId();
      localStorage.setItem('chatbot_session_id', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

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

  const sendMessageToChatbot = async (message: string): Promise<string> => {
    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sessionId: sessionId // Incluir el sessionId en la petición
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Respuesta del chatbot:', data);
        
        if (data.success && data.response) {
          return data.response;
        } else {
          throw new Error('Respuesta inválida del servidor');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error enviando mensaje al chatbot:', error);
      
      // Respuesta de fallback genérica en caso de error
      return 'Lo siento, estoy experimentando dificultades técnicas en este momento. Te recomiendo completar el formulario de contacto para que uno de nuestros especialistas pueda ayudarte directamente. 😊';
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
      const botResponse = await sendMessageToChatbot(textToSend);
      
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
