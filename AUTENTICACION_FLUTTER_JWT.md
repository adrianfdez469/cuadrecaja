# 📱 Autenticación JWT desde Flutter

## 🎯 Problema Resuelto

Los endpoints de Next.js usan `getSession()` que depende de **cookies de sesión** de NextAuth. Esto funciona perfecto para aplicaciones web, pero desde una app móvil Flutter necesitamos usar **tokens JWT en headers**.

## ✅ Solución Implementada

Se ha creado una **utilidad dual** que soporta ambos métodos:

1. **Web (cookies)**: Para la aplicación web existente
2. **Mobile (JWT headers)**: Para la app Flutter

---

## 📋 Archivos Modificados

### 1. **`src/utils/authFromRequest.ts`** (NUEVO)
Utilidad que extrae autenticación desde cookies o headers.

### 2. **`src/app/api/categorias/route.ts`** (ACTUALIZADO)
Endpoint de ejemplo actualizado para soportar ambos métodos.

---

## 🔐 Flujo de Autenticación desde Flutter

### **Paso 1: Login y Obtener Token**

Desde Flutter, primero debes hacer login y guardar el token JWT:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  final Dio _dio;
  final FlutterSecureStorage _storage = FlutterSecureStorage();
  
  AuthService(this._dio);
  
  /// Login y obtener token JWT
  Future<bool> login(String usuario, String password) async {
    try {
      final response = await _dio.post(
        '/api/auth/callback/credentials',
        data: {
          'usuario': usuario,
          'password': password,
        },
      );
      
      if (response.statusCode == 200) {
        // NextAuth devuelve una cookie, pero necesitamos el token JWT
        // Opción 1: Extraer el token desde la cookie
        final cookies = response.headers['set-cookie'];
        final token = _extractTokenFromCookie(cookies);
        
        if (token != null) {
          await _storage.write(key: 'auth_token', value: token);
          return true;
        }
      }
      
      return false;
    } catch (e) {
      print('Error en login: $e');
      return false;
    }
  }
  
  /// Extraer token JWT de la cookie next-auth.session-token
  String? _extractTokenFromCookie(List<String>? cookies) {
    if (cookies == null) return null;
    
    for (var cookie in cookies) {
      if (cookie.contains('next-auth.session-token')) {
        // Formato: next-auth.session-token=TOKEN; Path=/; ...
        final parts = cookie.split(';')[0].split('=');
        if (parts.length == 2) {
          return parts[1];
        }
      }
    }
    return null;
  }
  
  /// Obtener token guardado
  Future<String?> getToken() async {
    return await _storage.read(key: 'auth_token');
  }
  
  /// Logout
  Future<void> logout() async {
    await _storage.delete(key: 'auth_token');
  }
}
```

---

### **Paso 2: Configurar Dio con Interceptor para Token**

```dart
import 'package:dio/dio.dart';

class ApiClient {
  late Dio _dio;
  final AuthService _authService;
  
  ApiClient(this._authService, {String baseUrl = 'http://localhost:3000/api'}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: Duration(seconds: 30),
      receiveTimeout: Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));
    
    // 🔥 Interceptor para agregar token JWT en cada request
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _authService.getToken();
          
          if (token != null) {
            // Agregar token en header Authorization
            options.headers['Authorization'] = 'Bearer $token';
            print('✅ Token agregado al request: Bearer ${token.substring(0, 20)}...');
          } else {
            print('⚠️ No hay token disponible');
          }
          
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // Si el token expiró (401), intentar renovar o hacer logout
          if (error.response?.statusCode == 401) {
            print('❌ Token expirado o inválido');
            await _authService.logout();
            // Opcional: Navegar a login
          }
          return handler.next(error);
        },
      ),
    );
    
    // Logging interceptor (opcional, para debugging)
    _dio.interceptors.add(LogInterceptor(
      request: true,
      requestHeader: true,
      requestBody: true,
      responseHeader: true,
      responseBody: true,
      error: true,
    ));
  }
  
  Dio get dio => _dio;
}
```

---

### **Paso 3: Llamar al Endpoint de Categorías**

```dart
class CategoriaService {
  final Dio _dio;
  
  CategoriaService(this._dio);
  
  /// Obtener todas las categorías
  Future<List<Categoria>> getCategorias() async {
    try {
      final response = await _dio.get('/categorias');
      
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((json) => Categoria.fromJson(json)).toList();
      }
      
      throw Exception('Error al obtener categorías');
    } catch (e) {
      print('❌ Error al obtener categorías: $e');
      if (e is DioException) {
        print('Status: ${e.response?.statusCode}');
        print('Message: ${e.response?.data}');
      }
      rethrow;
    }
  }
  
  /// Crear nueva categoría
  Future<Categoria> createCategoria(String nombre, String color) async {
    try {
      final response = await _dio.post(
        '/categorias',
        data: {
          'nombre': nombre,
          'color': color,
        },
      );
      
      if (response.statusCode == 201) {
        return Categoria.fromJson(response.data);
      }
      
      throw Exception('Error al crear categoría');
    } catch (e) {
      print('❌ Error al crear categoría: $e');
      rethrow;
    }
  }
}
```

---

### **Paso 4: Modelo de Categoría**

```dart
class Categoria {
  final String id;
  final String nombre;
  final String color;
  final String negocioId;
  final DateTime createdAt;
  final DateTime updatedAt;
  
  Categoria({
    required this.id,
    required this.nombre,
    required this.color,
    required this.negocioId,
    required this.createdAt,
    required this.updatedAt,
  });
  
  factory Categoria.fromJson(Map<String, dynamic> json) {
    return Categoria(
      id: json['id'],
      nombre: json['nombre'],
      color: json['color'],
      negocioId: json['negocioId'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nombre': nombre,
      'color': color,
      'negocioId': negocioId,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
```

---

### **Paso 5: Uso Completo (Ejemplo en Widget)**

```dart
import 'package:flutter/material.dart';

class CategoriasScreen extends StatefulWidget {
  @override
  _CategoriasScreenState createState() => _CategoriasScreenState();
}

class _CategoriasScreenState extends State<CategoriasScreen> {
  late CategoriaService _categoriaService;
  List<Categoria> _categorias = [];
  bool _loading = false;
  
  @override
  void initState() {
    super.initState();
    
    // Inicializar servicios
    final authService = AuthService(Dio());
    final apiClient = ApiClient(authService, baseUrl: 'http://192.168.1.100:3000/api');
    _categoriaService = CategoriaService(apiClient.dio);
    
    // Cargar categorías
    _loadCategorias();
  }
  
  Future<void> _loadCategorias() async {
    setState(() => _loading = true);
    
    try {
      final categorias = await _categoriaService.getCategorias();
      setState(() {
        _categorias = categorias;
        _loading = false;
      });
      print('✅ ${categorias.length} categorías cargadas');
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al cargar categorías: $e')),
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Center(child: CircularProgressIndicator());
    }
    
    return ListView.builder(
      itemCount: _categorias.length,
      itemBuilder: (context, index) {
        final categoria = _categorias[index];
        return ListTile(
          leading: CircleAvatar(
            backgroundColor: Color(int.parse('0xFF${categoria.color}')),
          ),
          title: Text(categoria.nombre),
          subtitle: Text(categoria.id),
        );
      },
    );
  }
}
```

---

## 🔧 Configuración de la Base URL

### **Desarrollo Local**

#### **Android Emulador:**
```dart
baseUrl: 'http://10.0.2.2:3000/api'
```

#### **iOS Simulator:**
```dart
baseUrl: 'http://localhost:3000/api'
```

#### **Dispositivo Físico:**
```dart
baseUrl: 'http://192.168.1.100:3000/api' // Cambiar por tu IP local
```

**Obtener tu IP local:**

```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig

# Busca algo como: 192.168.1.100 o 10.0.0.x
```

---

## 🔐 Método Alternativo: Login Custom Endpoint

Si necesitas un endpoint más limpio para Flutter, puedes crear uno custom:

### **Backend: `src/app/api/auth/login-mobile/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { usuario, password } = await request.json();
    
    // Validar credenciales
    const user = await prisma.usuario.findUnique({
      where: { usuario },
      include: {
        negocio: true,
        tiendas: {
          include: {
            tienda: true,
            rol: true,
          },
        },
      },
    });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }
    
    // Verificar suscripción (igual que en authOptions.ts)
    // ... código de verificación ...
    
    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        rol: user.rol,
        negocio: {
          id: user.negocio.id,
          nombre: user.negocio.nombre,
        },
        // ... otros datos
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '30d' }
    );
    
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol: user.rol,
        // ... otros datos
      },
    });
  } catch (error) {
    console.error('Error en login mobile:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

### **Flutter: Login con Endpoint Custom**

```dart
Future<bool> login(String usuario, String password) async {
  try {
    final response = await _dio.post(
      '/auth/login-mobile',
      data: {
        'usuario': usuario,
        'password': password,
      },
    );
    
    if (response.statusCode == 200) {
      final token = response.data['token'];
      final user = response.data['user'];
      
      // Guardar token
      await _storage.write(key: 'auth_token', value: token);
      
      // Guardar info del usuario (opcional)
      await _storage.write(key: 'user_data', value: jsonEncode(user));
      
      print('✅ Login exitoso: ${user['nombre']}');
      return true;
    }
    
    return false;
  } catch (e) {
    print('❌ Error en login: $e');
    return false;
  }
}
```

---

## 🧪 Testing y Debugging

### **Test 1: Verificar que el token se está enviando**

```dart
void testTokenHeader() async {
  final authService = AuthService(Dio());
  await authService.login('admin', 'password123');
  
  final apiClient = ApiClient(authService, baseUrl: 'http://192.168.1.100:3000/api');
  
  try {
    final response = await apiClient.dio.get('/categorias');
    print('✅ Request exitoso: ${response.data}');
  } catch (e) {
    print('❌ Error: $e');
    if (e is DioException) {
      print('Status: ${e.response?.statusCode}');
      print('Headers enviados: ${e.requestOptions.headers}');
      print('Response: ${e.response?.data}');
    }
  }
}
```

### **Test 2: Verificar estructura del token**

```dart
import 'dart:convert';

void decodeToken(String token) {
  try {
    // Los JWT tienen 3 partes separadas por puntos: header.payload.signature
    final parts = token.split('.');
    if (parts.length != 3) {
      print('❌ Token inválido: debe tener 3 partes');
      return;
    }
    
    // Decodificar payload (parte 2)
    final payload = parts[1];
    
    // Agregar padding si es necesario
    var normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    while (normalized.length % 4 != 0) {
      normalized += '=';
    }
    
    final decoded = utf8.decode(base64.decode(normalized));
    final json = jsonDecode(decoded);
    
    print('✅ Token decodificado:');
    print('  - Usuario: ${json['usuario']}');
    print('  - Nombre: ${json['nombre']}');
    print('  - Rol: ${json['rol']}');
    print('  - Negocio: ${json['negocio']['nombre']}');
    print('  - Expira: ${DateTime.fromMillisecondsSinceEpoch(json['exp'] * 1000)}');
  } catch (e) {
    print('❌ Error al decodificar token: $e');
  }
}
```

### **Test 3: Verificar CORS**

```dart
void testCors() async {
  final dio = Dio(BaseOptions(
    baseUrl: 'http://192.168.1.100:3000/api',
  ));
  
  try {
    final response = await dio.get('/categorias');
    
    print('✅ CORS funcionando correctamente');
    print('Status: ${response.statusCode}');
    print('Headers: ${response.headers}');
  } catch (e) {
    print('❌ Error de CORS: $e');
    if (e is DioException) {
      print('Type: ${e.type}');
      print('Message: ${e.message}');
    }
  }
}
```

---

## 🐛 Solución de Problemas

### **Error: "No autenticado. Debes iniciar sesión."**

**Causa:** El token no se está enviando o es inválido.

**Solución:**
1. Verifica que el token se guardó correctamente:
```dart
final token = await _storage.read(key: 'auth_token');
print('Token guardado: $token');
```

2. Verifica que el interceptor está agregando el header:
```dart
// En el interceptor, agregar log:
print('Headers antes: ${options.headers}');
options.headers['Authorization'] = 'Bearer $token';
print('Headers después: ${options.headers}');
```

---

### **Error: "CORS policy: No 'Access-Control-Allow-Origin' header"**

**Causa:** El servidor no está devolviendo headers CORS.

**Solución:**
1. Verifica que el servidor esté corriendo con la configuración CORS:
```bash
npm run dev
```

2. Verifica en los logs del servidor que el middleware CORS se está ejecutando.

3. Verifica que tu origen esté permitido en `src/middleware/cors.ts`.

---

### **Error: "Connection refused" o "Network error"**

**Causa:** No puedes conectarte al servidor.

**Soluciones:**

1. **Verifica que el servidor esté corriendo:**
```bash
# En tu computadora
npm run dev
# Debería decir: ✓ Ready on http://localhost:3000
```

2. **Verifica la IP correcta:**
```bash
# Obtén tu IP local
ifconfig | grep "inet "  # macOS/Linux
ipconfig                 # Windows
```

3. **Verifica el firewall:**
   - Asegúrate de que el firewall permita conexiones en el puerto 3000

4. **Verifica permisos en AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.INTERNET" />
<application android:usesCleartextTraffic="true">
```

---

## 📦 Dependencias de Flutter

Agrega estas dependencias en `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # HTTP Client
  dio: ^5.4.0
  
  # Secure Storage para tokens
  flutter_secure_storage: ^9.0.0
  
  # State Management (opcional)
  provider: ^6.1.1
  # o
  riverpod: ^2.4.9
  
  # JSON Serialization (opcional)
  json_annotation: ^4.8.1

dev_dependencies:
  # JSON Code Generation
  build_runner: ^2.4.7
  json_serializable: ^6.7.1
```

---

## ✅ Checklist de Implementación

- [ ] Crear `AuthService` con login y logout
- [ ] Crear `ApiClient` con interceptor para token
- [ ] Configurar `FlutterSecureStorage` para guardar token
- [ ] Crear servicios para cada endpoint (CategoriaService, ProductoService, etc.)
- [ ] Configurar base URL correcta (IP local o dominio)
- [ ] Agregar permisos de internet en AndroidManifest.xml
- [ ] Configurar NSAppTransportSecurity en iOS si usas HTTP
- [ ] Implementar manejo de errores (token expirado, etc.)
- [ ] Agregar logs para debugging
- [ ] Probar login y requests a endpoints
- [ ] Implementar renovación automática de token (opcional)
- [ ] Implementar logout y limpieza de token

---

## 🎉 ¡Listo!

Ahora tu app Flutter puede:

✅ **Autenticarse** con el backend Next.js  
✅ **Enviar el token JWT** en cada request  
✅ **Llamar cualquier endpoint** protegido  
✅ **Funcionar con CORS** habilitado  
✅ **Manejar errores** de autenticación  

**¡Tu app Flutter ya puede comunicarse completamente con el API!** 🚀


