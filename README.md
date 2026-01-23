# 🏢 Portal del Empleado - Intranet

Sistema de intranet para empleados que se conecta a la misma base de datos Supabase del sistema administrativo principal.

## 📋 Características

- **💰 Desprendible de Pago**: Visualización e impresión de desprendibles de nómina
- **📄 Carta Laboral**: Generación automática de cartas laborales con salario básico
- **📋 Contrato de Trabajo**: Descarga del contrato de trabajo
- **🕐 Mis Horarios**: Visualización de horarios programados
- **📝 Radicar Solicitud**: Sistema de solicitudes (permisos, vacaciones, licencias, etc.)
- **📖 Reglamento Interno**: Acceso al reglamento interno de trabajo
- **📁 Formatos**: Descarga de formatos empresariales

## 🚀 Instalación

### 1. Configurar Supabase

Copia las credenciales de Supabase del sistema principal y edita el archivo `src/App.js`:

```javascript
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key';
```

### 2. Crear tablas en Supabase

Ejecuta el script SQL en Supabase SQL Editor:

1. Ve a tu proyecto en Supabase
2. Navega a SQL Editor
3. Copia el contenido de `database/schema.sql`
4. Ejecuta el script

### 3. Instalar dependencias

```bash
cd intranet-empleados
npm install
```

### 4. Ejecutar en desarrollo

```bash
npm start
```

La aplicación estará disponible en `http://localhost:3001` (o el puerto que indique).

### 5. Compilar para producción

```bash
npm run build
```

Los archivos compilados estarán en la carpeta `build/`.

## 🔗 Conexión con el Sistema Principal

Esta intranet utiliza las mismas tablas del sistema principal:

| Tabla | Uso en Intranet |
|-------|-----------------|
| `empleados` | Datos del empleado (nombre, cargo, salario, sede) |
| `empresas` | Datos de la empresa (nombre, NIT, representante legal) |
| `nominas` | Desprendibles de pago |
| `horarios_empleados` | Horarios programados |
| `solicitudes_empleados` | Solicitudes radicadas |
| `documentos_empleados` | Documentos del empleado |
| `formatos_empresa` | Formatos disponibles |

## 🔐 Autenticación

Los empleados ingresan con su correo electrónico registrado en el sistema.

### Requisitos:
1. El empleado debe tener un registro en la tabla `empleados`
2. El campo `correo` debe coincidir con el email de autenticación de Supabase
3. El empleado debe tener un usuario creado en Supabase Auth

### Crear usuario en Supabase Auth:

1. Ve a Authentication > Users
2. Click en "Add user"
3. Ingresa el correo del empleado
4. Establece una contraseña temporal

## 📊 Estructura de Datos

### Empleado (campos requeridos)
```javascript
{
  id: "uuid",
  nombre: "Nombre Completo",
  documento: "123456789",
  correo: "empleado@empresa.com",
  cargo: "Cargo del empleado",
  sede: "Sede principal",
  fecha_ingreso: "2024-01-15",
  salario_basico: 1800000,
  tipo_contrato: "Término Indefinido",
  empresa_id: "uuid de la empresa"
}
```

### Nómina (para desprendibles)
```javascript
{
  empleado_id: "uuid",
  periodo_inicio: "2024-01-01",
  periodo_fin: "2024-01-15",
  salario_basico: 900000,
  auxilio_transporte: 81000,
  total_devengado: 981000,
  deduccion_salud: 36000,
  deduccion_pension: 36000,
  total_deducciones: 72000,
  neto_pagar: 909000
}
```

## 🎨 Personalización

### Colores
Los colores principales se pueden modificar en `src/App.js`:
- Color primario: `#1a237e` (azul oscuro)
- Color secundario: `#0d47a1` (azul medio)

### Logo
Reemplaza el favicon en `public/favicon.ico` con el logo de tu empresa.

## 📱 Responsive

La aplicación es responsive y funciona en:
- ✅ Escritorio
- ✅ Tablet
- ✅ Móvil

## 🖨️ Impresión

Los desprendibles y cartas laborales están optimizados para impresión:
- Click en "Imprimir" para generar el documento
- El formato de impresión oculta menús y botones automáticamente

## 📝 Próximas Funcionalidades

- [ ] Notificaciones push
- [ ] Chat interno
- [ ] Calendario de eventos
- [ ] Directorio de empleados
- [ ] Capacitaciones en línea

## 🔧 Solución de Problemas

### El empleado no puede ingresar
1. Verifica que el correo esté registrado en `empleados.correo`
2. Verifica que el usuario exista en Supabase Auth
3. Verifica que la contraseña sea correcta

### No se muestran los desprendibles
1. Verifica que existan registros en la tabla `nominas`
2. El `empleado_id` debe coincidir con el empleado

### Error de permisos
1. Verifica las políticas RLS en Supabase
2. Asegúrate de que el correo del empleado coincida exactamente

## 📞 Soporte

Para soporte técnico, contacta al administrador del sistema.
