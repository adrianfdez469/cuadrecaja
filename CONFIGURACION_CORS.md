# 🌐 Configuración de CORS para la API

## 📋 ¿Qué es CORS y por qué lo necesitas?

**CORS (Cross-Origin Resource Sharing)** es un mecanismo de seguridad que permite que tu API sea accesible desde diferentes orígenes (dominios, protocolos o puertos).

### **¿Cuándo lo necesitas?**

- ✅ **Aplicación móvil Flutter** conectándose a tu API
- ✅ **Aplicaciones web** en diferentes dominios
- ✅ **Desarrollo local** con diferentes puertos
- ✅ **Aplicaciones Capacitor/Ionic**
- ✅ **Extensiones de navegador**

---

## ✅ Configuración Implementada

Se ha implementado una solución completa de CORS en tu aplicación Next.js:

### **Archivos Creados/Modificados**

1. **`src/middleware/cors.ts`** - Configuración centralizada de CORS
2. **`src/middleware.ts`** - Middleware principal actualizado con CORS

---

## 🔧 Cómo Funciona

### **1. Orígenes Permitidos**

En `src/middleware/cors.ts`, línea 10-17:

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',      // Desarrollo local web
  'http://localhost:8080',      // Desarrollo Flutter (web)
  'http://localhost:5173',      // Vite dev server
  'capacitor://localhost',      // Capacitor iOS
  'ionic://localhost',          // Ionic
  'http://localhost',           // Flutter mobile emulador
  'https://tu-dominio.com',     // Producción web
];
```

### **2. Modo Desarrollo vs Producción**

```typescript
// Desarrollo: Permite TODOS los orígenes (más flexible)
if (isDevelopment) {
  headers['Access-Control-Allow-Origin'] = origin || '*';
}

// Producción: Solo orígenes específicos (más seguro)
else {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
}
```

### **3. Headers Permitidos**

```typescript
'Access-Control-Allow-Headers': 
  'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-api-key'
```

Esto permite que tu app Flutter envíe:
- ✅ `Content-Type: application/json`
- ✅ `Authorization: Bearer <token>`
- ✅ `x-api-key: <api-key>` (para el backup)

### **4. Métodos HTTP Permitidos**

```typescript
'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
```

---

## 🚀 Configuración para Flutter

### **Código Flutter para llamar al API**

```dart
import 'package:dio/dio.dart';

class ApiClient {
  late Dio _dio;
  
  ApiClient() {
    _dio = Dio(BaseOptions(
      // 🔥 IMPORTANTE: Usar tu IP local o dominio
      baseUrl: 'http://192.168.1.100:3000/api', // Cambiar por tu IP
      connectTimeout: Duration(seconds: 30),
      receiveTimeout: Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));
    
    // Agregar token en cada request
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await getToken(); // Tu función para obtener token
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
      ),
    );
  }
  
  Dio get dio => _dio;
}
```

### **Ejemplo de Login desde Flutter**

```dart
Future<Map<String, dynamic>?> login(String usuario, String password) async {
  try {
    final response = await _dio.post(
      '/auth/login',
      data: {
        'usuario': usuario,
        'password': password,
      },
    );
    
    if (response.statusCode == 200) {
      return response.data;
    }
  } catch (e) {
    print('Error en login: $e');
  }
  return null;
}
```

---

## ⚙️ Configuración Personalizada

### **Agregar Nuevos Orígenes**

Edita `src/middleware/cors.ts`:

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://mi-app.com',        // ← Agregar tu dominio
  'https://www.mi-app.com',    // ← Con www
  'capacitor://localhost',     // ← Para apps Capacitor
  // Agregar más según necesites
];
```

### **Permitir Todos los Orígenes (Solo Desarrollo)**

Si quieres permitir TODOS los orígenes temporalmente:

```typescript
// En src/middleware/cors.ts, línea 19
const isDevelopment = true; // Forzar modo desarrollo
```

⚠️ **ADVERTENCIA:** NO uses esto en producción.

---

## 🔍 Cómo Probar CORS

### **1. Desde el Navegador (DevTools)**

```javascript
// Abre la consola en cualquier sitio web y ejecuta:

fetch('http://localhost:3000/api/categorias', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer TU_TOKEN_AQUI',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

**Resultado esperado:**
- ✅ Respuesta exitosa con datos
- ❌ Si falla con error de CORS, verifica la configuración

### **2. Desde Flutter (Debug)**

```dart
void testApiConnection() async {
  try {
    final response = await dio.get('/categorias');
    print('✅ Conexión exitosa: ${response.data}');
  } catch (e) {
    print('❌ Error: $e');
    if (e is DioException) {
      print('Status: ${e.response?.statusCode}');
      print('Message: ${e.message}');
    }
  }
}
```

### **3. Con cURL**

```bash
# Terminal en tu máquina o dispositivo móvil

curl -X OPTIONS \
  http://localhost:3000/api/categorias \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  -v
```

**Deberías ver:**
```
< HTTP/1.1 204 No Content
< Access-Control-Allow-Origin: http://localhost:8080
< Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization, ...
```

---

## 🐛 Solución de Problemas

### **Problema 1: "CORS policy: No 'Access-Control-Allow-Origin' header"**

**Causa:** Tu origen no está en la lista de permitidos.

**Solución:**
```typescript
// Agregar tu origen en src/middleware/cors.ts
const ALLOWED_ORIGINS = [
  // ... otros orígenes
  'http://tu-origen-aqui:puerto',
];
```

---

### **Problema 2: "CORS policy: Request header field authorization is not allowed"**

**Causa:** El header `Authorization` no está permitido.

**Solución:** Ya está incluido en la configuración actual. Verifica que tu middleware esté funcionando:

```bash
# Verificar que el servidor esté corriendo con la nueva configuración
npm run dev
```

---

### **Problema 3: Flutter no puede conectarse desde el emulador**

**Causa:** `localhost` en el emulador apunta al emulador, no a tu máquina.

**Soluciones:**

#### **Android Emulador:**
```dart
// Usar 10.0.2.2 en lugar de localhost
baseUrl: 'http://10.0.2.2:3000/api'
```

#### **iOS Simulator:**
```dart
// Usar localhost directamente (funciona en iOS)
baseUrl: 'http://localhost:3000/api'
```

#### **Dispositivo Físico:**
```dart
// Usar la IP local de tu computadora
baseUrl: 'http://192.168.1.100:3000/api' // Cambia por tu IP
```

**Cómo obtener tu IP local:**

```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig

# Busca algo como: 192.168.1.100 o 10.0.0.x
```

---

### **Problema 4: Funciona en desarrollo pero no en producción**

**Causa:** En producción, solo se permiten orígenes específicos.

**Solución:**
```typescript
// Agregar tu dominio de producción
const ALLOWED_ORIGINS = [
  // ... desarrollo
  'https://tu-app-produccion.com',
  'https://www.tu-app-produccion.com',
];
```

---

### **Problema 5: Preflight request falla (OPTIONS)**

**Causa:** El servidor no está manejando correctamente las peticiones OPTIONS.

**Verificación:**
```bash
curl -X OPTIONS http://localhost:3000/api/productos -v
```

**Solución:** Ya está implementado en el middleware. Si falla:

1. Verifica que el middleware esté activo:
```bash
# Reinicia el servidor
npm run dev
```

2. Verifica los logs en la consola del servidor

---

## 📊 Flujo de una Petición CORS

```
┌─────────────────────────────────────────────────────────┐
│ 1. Flutter App envía OPTIONS (Preflight)               │
│    Origin: capacitor://localhost                       │
│    Access-Control-Request-Method: POST                 │
│    Access-Control-Request-Headers: Authorization       │
└────────────────────┬────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────┐
│ 2. Middleware detecta OPTIONS                          │
│    → handleCorsMiddleware()                            │
│    → Retorna 204 con headers CORS                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────┐
│ 3. Flutter recibe respuesta 204                        │
│    ✅ Access-Control-Allow-Origin: capacitor://...    │
│    ✅ Access-Control-Allow-Methods: POST, GET, ...    │
│    ✅ Access-Control-Allow-Headers: Authorization, ... │
└────────────────────┬────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────┐
│ 4. Flutter envía la petición real (POST)               │
│    Authorization: Bearer token123                      │
│    Content-Type: application/json                      │
│    Body: { usuario: "juan", password: "..." }          │
└────────────────────┬────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────┐
│ 5. Middleware agrega headers CORS a la respuesta       │
│    → addCorsHeaders(response, origin)                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────┐
│ 6. Flutter recibe respuesta con datos + CORS headers   │
│    ✅ Status: 200                                       │
│    ✅ Data: { token: "...", user: {...} }              │
│    ✅ Access-Control-Allow-Origin: capacitor://...     │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Seguridad

### **Mejores Prácticas Implementadas**

1. ✅ **Modo desarrollo vs producción separado**
   - Desarrollo: Flexible para testing
   - Producción: Solo orígenes específicos

2. ✅ **Lista blanca de orígenes**
   - No se permite `*` en producción
   - Cada origen debe estar explícitamente listado

3. ✅ **Headers específicos**
   - Solo se permiten headers necesarios
   - No se exponen todos los headers

4. ✅ **Credentials habilitados**
   - Permite enviar cookies/tokens
   - `Access-Control-Allow-Credentials: true`

5. ✅ **Cache de preflight**
   - `Access-Control-Max-Age: 86400` (24 horas)
   - Reduce peticiones OPTIONS repetidas

### **⚠️ Advertencias de Seguridad**

#### **NO hacer en producción:**

```typescript
// ❌ MAL: Permitir todos los orígenes
headers['Access-Control-Allow-Origin'] = '*';

// ❌ MAL: Permitir todos los headers
headers['Access-Control-Allow-Headers'] = '*';

// ❌ MAL: Deshabilitar verificación de origen
const ALLOWED_ORIGINS = ['*'];
```

#### **✅ CORRECTO en producción:**

```typescript
// ✅ BIEN: Lista específica de orígenes
const ALLOWED_ORIGINS = [
  'https://mi-app.com',
  'https://www.mi-app.com',
  'capacitor://localhost', // Solo si usas Capacitor
];

// ✅ BIEN: Verificar origen antes de agregar header
if (origin && ALLOWED_ORIGINS.includes(origin)) {
  headers['Access-Control-Allow-Origin'] = origin;
}
```

---

## 📱 Configuración Específica para Flutter

### **android/app/src/main/AndroidManifest.xml**

Agregar permisos de internet:

```xml
<manifest>
  <!-- Permitir acceso a internet -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  
  <!-- Para desarrollo con HTTP (no HTTPS) -->
  <application
    android:usesCleartextTraffic="true"
    ...>
  </application>
</manifest>
```

### **ios/Runner/Info.plist**

Permitir conexiones HTTP en desarrollo:

```xml
<dict>
  <!-- Permitir HTTP en desarrollo -->
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <!-- O solo para tu IP específica: -->
    <key>NSExceptionDomains</key>
    <dict>
      <key>192.168.1.100</key>
      <dict>
        <key>NSExceptionAllowsInsecureHTTPLoads</key>
        <true/>
      </dict>
    </dict>
  </dict>
</dict>
```

---

## 🧪 Script de Prueba

Crea este archivo para probar tu configuración:

**`test-cors.html`:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test CORS</title>
</head>
<body>
  <h1>Test de CORS</h1>
  <button onclick="testCors()">Probar Conexión al API</button>
  <pre id="result"></pre>

  <script>
    async function testCors() {
      const result = document.getElementById('result');
      result.textContent = 'Probando...';
      
      try {
        const response = await fetch('http://localhost:3000/api/categorias', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // 'Authorization': 'Bearer TU_TOKEN_AQUI' // Descomentar si tienes token
          }
        });
        
        const data = await response.json();
        result.textContent = '✅ ÉXITO!\n\n' + JSON.stringify(data, null, 2);
      } catch (error) {
        result.textContent = '❌ ERROR!\n\n' + error.message;
      }
    }
  </script>
</body>
</html>
```

Abre este archivo en tu navegador y haz clic en el botón para probar.

---

## 📚 Variables de Entorno

Si quieres hacer la configuración más flexible, puedes usar variables de entorno:

**`.env.local`:**

```bash
# CORS Configuration
NEXT_PUBLIC_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,https://mi-app.com
CORS_ENABLED=true
```

**`src/middleware/cors.ts`:**

```typescript
const ALLOWED_ORIGINS = process.env.NEXT_PUBLIC_ALLOWED_ORIGINS
  ? process.env.NEXT_PUBLIC_ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:8080',
      // ... defaults
    ];
```

---

## ✅ Checklist de Configuración

Cuando despliegues tu app Flutter, verifica:

- [ ] CORS habilitado en el servidor
- [ ] Origen de tu app agregado a `ALLOWED_ORIGINS`
- [ ] Permisos de internet en AndroidManifest.xml
- [ ] NSAppTransportSecurity configurado en iOS (si usas HTTP)
- [ ] URL del API correcta en Flutter (IP local o dominio)
- [ ] Token JWT se envía correctamente en headers
- [ ] Preflight requests (OPTIONS) funcionan
- [ ] Variables de entorno configuradas en producción

---

## 🎉 ¡Listo!

Tu API ahora está configurada para aceptar peticiones desde:

- ✅ Aplicación web (mismo dominio o diferente)
- ✅ Aplicación móvil Flutter
- ✅ Aplicaciones Capacitor/Ionic
- ✅ Extensiones de navegador
- ✅ Cualquier origen que agregues a la lista

**¡Tu app Flutter ya puede conectarse al API sin problemas de CORS!** 🚀


