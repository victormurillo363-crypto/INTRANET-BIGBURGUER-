// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
// En producción (Vercel) usa variables de entorno
// En desarrollo puedes poner los valores directamente

export const SUPABASE_CONFIG = {
  // URL de tu proyecto Supabase
  url: process.env.REACT_APP_SUPABASE_URL || 'https://nhuxbrlbzrulbncghtim.supabase.co',
  
  // Anon Key (clave pública)
  anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odXhicmxienJ1bGJuY2dodGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4OTY1MjAsImV4cCI6MjA4MDQ3MjUyMH0.xP55ysJ8HBoWlAyEiryQ_ZcbIkUtExe7k7BGcqmpUiE',
};

// ============================================
// CONFIGURACIÓN DE LA EMPRESA
// ============================================
export const EMPRESA_CONFIG = {
  // Nombre que aparece en el header
  nombreApp: 'Portal del Empleado',
  
  // Colores personalizados (opcional)
  colorPrimario: '#1a237e',
  colorSecundario: '#0d47a1',
  
  // Puerto del servidor de desarrollo (por defecto 3000)
  // Si el sistema principal usa 3000, cambia este a 3001
  puerto: 3001,
};

// ============================================
// TIPOS DE SOLICITUDES DISPONIBLES
// ============================================
export const TIPOS_SOLICITUD = [
  { id: 'permiso', nombre: 'Permiso', icono: '🙋', requiereFechas: true },
  { id: 'vacaciones', nombre: 'Vacaciones', icono: '🏖️', requiereFechas: true },
  { id: 'licencia', nombre: 'Licencia', icono: '📋', requiereFechas: true },
  { id: 'incapacidad', nombre: 'Incapacidad', icono: '🏥', requiereFechas: true },
  { id: 'cambio_horario', nombre: 'Cambio de Horario', icono: '🕐', requiereFechas: false },
  { id: 'certificado', nombre: 'Certificado Laboral', icono: '📄', requiereFechas: false },
  { id: 'otro', nombre: 'Otra Solicitud', icono: '📝', requiereFechas: false },
];

// ============================================
// FORMATOS DISPONIBLES
// ============================================
export const FORMATOS_DISPONIBLES = [
  { id: 'formato_permiso', nombre: 'Formato Solicitud de Permiso', icono: '📝' },
  { id: 'formato_vacaciones', nombre: 'Formato Solicitud de Vacaciones', icono: '🏖️' },
  { id: 'formato_licencia', nombre: 'Formato Solicitud de Licencia', icono: '📋' },
  { id: 'formato_incapacidad', nombre: 'Formato Reporte de Incapacidad', icono: '🏥' },
  { id: 'formato_horas_extra', nombre: 'Formato Autorización Horas Extra', icono: '⏰' },
  { id: 'formato_dotacion', nombre: 'Formato Entrega de Dotación', icono: '👔' },
];
