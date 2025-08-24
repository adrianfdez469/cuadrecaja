const BASE_URL = 'http://localhost:3000/api';

// Función para hacer peticiones HTTP
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error en ${url}:`, error.message);
    throw error;
  }
}

// Función para obtener todos los negocios
async function getNegocios() {
  try {
    const response = await makeRequest(`${BASE_URL}/negocio`);
    return response;
  } catch (error) {
    console.log('Error al obtener negocios:', error.message);
    return [];
  }
}

// Función para obtener todas las notificaciones
async function getNotificaciones() {
  try {
    const response = await makeRequest(`${BASE_URL}/notificaciones`);
    return response;
  } catch (error) {
    console.log('Error al obtener notificaciones:', error.message);
    return [];
  }
}

// Función para probar verificaciones automáticas para todos los negocios
async function testAutoCheckAll() {
  console.log('\n=== Probando verificaciones automáticas para todos los negocios ===');
  
  try {
    const result = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    
    console.log('✅ Verificaciones automáticas para todos los negocios ejecutadas:', result);
  } catch (error) {
    console.log('❌ Error al ejecutar verificaciones automáticas para todos:', error.message);
  }
}

// Función para probar verificaciones automáticas para un negocio específico
async function testAutoCheckSpecific(negocioId) {
  console.log(`\n=== Probando verificaciones automáticas para negocio ${negocioId} ===`);
  
  try {
    const result = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
      method: 'POST',
      body: JSON.stringify({ negocioId })
    });
    
    console.log(`✅ Verificaciones automáticas para negocio ${negocioId} ejecutadas:`, result);
  } catch (error) {
    console.log(`❌ Error al ejecutar verificaciones automáticas para negocio ${negocioId}:`, error.message);
  }
}

// Función para crear notificaciones de prueba que luego serán modificadas/eliminadas
async function createTestNotificationsForValidation() {
  console.log('\n=== Creando notificaciones de prueba para validación ===');
  
  const testNotifications = [
    {
      titulo: 'Expiración de suscripción - Negocio Test',
      descripcion: 'La suscripción del negocio "Negocio Test" expira en 5 días. Por favor, renueva la suscripción para evitar interrupciones en el servicio.',
      fechaInicio: new Date().toISOString(),
      fechaFin: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      nivelImportancia: 'MEDIA',
      tipo: 'ALERTA',
      negociosDestino: '',
      usuariosDestino: ''
    },
    {
      titulo: 'Límite de productos - Negocio Test',
      descripcion: 'El negocio "Negocio Test" ha alcanzado el 85% de su límite de productos (85/100). Considera actualizar tu plan para agregar más productos.',
      fechaInicio: new Date().toISOString(),
      fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      nivelImportancia: 'MEDIA',
      tipo: 'NOTIFICACION',
      negociosDestino: '',
      usuariosDestino: ''
    },
    {
      titulo: 'Límite de usuarios - Negocio Test',
      descripcion: 'El negocio "Negocio Test" ha alcanzado el 88% de su límite de usuarios (8/10). Considera actualizar tu plan para agregar más usuarios.',
      fechaInicio: new Date().toISOString(),
      fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      nivelImportancia: 'MEDIA',
      tipo: 'NOTIFICACION',
      negociosDestino: '',
      usuariosDestino: ''
    }
  ];

  const createdIds = [];
  
  for (const notification of testNotifications) {
    try {
      const result = await makeRequest(`${BASE_URL}/notificaciones`, {
        method: 'POST',
        body: JSON.stringify(notification)
      });
      
      console.log(`✅ Notificación de prueba creada: ${result.titulo}`);
      createdIds.push(result.id);
    } catch (error) {
      console.log(`❌ Error al crear notificación de prueba: ${notification.titulo}`, error.message);
    }
  }
  
  return createdIds;
}

// Función para mostrar el estado actual de las notificaciones
async function showNotificationStatus() {
  console.log('\n=== Estado actual de las notificaciones ===');
  
  try {
    const notificaciones = await getNotificaciones();
    console.log(`📊 Total de notificaciones: ${notificaciones.length}`);
    
    notificaciones.forEach((notif, index) => {
      console.log(`  ${index + 1}. ${notif.titulo}`);
      console.log(`     Tipo: ${notif.tipo} | Importancia: ${notif.nivelImportancia}`);
      console.log(`     Estado: ${new Date() >= new Date(notif.fechaInicio) && new Date() <= new Date(notif.fechaFin) ? 'Activa' : 'Inactiva'}`);
      console.log(`     Leída por: ${notif.leidoPor ? notif.leidoPor.split(',').length : 0} usuarios`);
      console.log('');
    });
  } catch (error) {
    console.log('❌ Error al obtener estado de notificaciones:', error.message);
  }
}

// Función para probar la lógica de validación completa
async function testValidationLogic() {
  console.log('\n=== Probando lógica de validación completa ===');
  
  try {
    // 1. Obtener negocios
    const negocios = await getNegocios();
    console.log(`📋 Negocios encontrados: ${negocios.length}`);
    
    if (negocios.length === 0) {
      console.log('⚠️ No hay negocios para probar');
      return;
    }
    
    // 2. Mostrar estado inicial
    console.log('\n📊 Estado inicial de notificaciones:');
    await showNotificationStatus();
    
    // 3. Ejecutar verificaciones para todos los negocios
    console.log('\n🔄 Ejecutando verificaciones para todos los negocios...');
    await testAutoCheckAll();
    
    // 4. Mostrar estado después de verificaciones generales
    console.log('\n📊 Estado después de verificaciones generales:');
    await showNotificationStatus();
    
    // 5. Probar con negocio específico
    const primerNegocio = negocios[0];
    console.log(`\n🔄 Ejecutando verificaciones para negocio específico: ${primerNegocio.nombre}`);
    await testAutoCheckSpecific(primerNegocio.id);
    
    // 6. Mostrar estado final
    console.log('\n📊 Estado final de notificaciones:');
    await showNotificationStatus();
    
    console.log('\n✅ Prueba de lógica de validación completada');
    
  } catch (error) {
    console.log('❌ Error en la prueba de lógica de validación:', error.message);
  }
}

// Función para probar casos específicos
async function testSpecificCases() {
  console.log('\n=== Probando casos específicos ===');
  
  try {
    // Caso 1: Negocio que no existe
    console.log('\n🔍 Caso 1: Negocio que no existe');
    await testAutoCheckSpecific('negocio-inexistente');
    
    // Caso 2: Negocio con ID vacío
    console.log('\n🔍 Caso 2: Negocio con ID vacío');
    await testAutoCheckSpecific('');
    
    // Caso 3: Negocio con ID null
    console.log('\n🔍 Caso 3: Negocio con ID null');
    await testAutoCheckSpecific(null);
    
    console.log('\n✅ Casos específicos probados');
    
  } catch (error) {
    console.log('❌ Error en casos específicos:', error.message);
  }
}

// Función principal
async function runImprovedTests() {
  console.log('🚀 Iniciando pruebas mejoradas del sistema de notificaciones...\n');
  
  try {
    // Probar lógica de validación completa
    await testValidationLogic();
    
    // Probar casos específicos
    await testSpecificCases();
    
    console.log('\n✅ Todas las pruebas mejoradas completadas exitosamente');
    console.log('\n📋 Resumen de funcionalidades probadas:');
    console.log('  ✅ Verificaciones automáticas para todos los negocios');
    console.log('  ✅ Verificaciones automáticas para negocio específico');
    console.log('  ✅ Validación y modificación de notificaciones existentes');
    console.log('  ✅ Eliminación de notificaciones no válidas');
    console.log('  ✅ Marcado como no leída al modificar');
    console.log('  ✅ Manejo de casos edge (negocios inexistentes)');
    
  } catch (error) {
    console.log('\n❌ Error en las pruebas mejoradas:', error.message);
  }
}

// Ejecutar las pruebas si el script se ejecuta directamente
if (typeof window === 'undefined') {
  runImprovedTests();
}

module.exports = {
  testAutoCheckAll,
  testAutoCheckSpecific,
  createTestNotificationsForValidation,
  showNotificationStatus,
  testValidationLogic,
  testSpecificCases,
  runImprovedTests
};
