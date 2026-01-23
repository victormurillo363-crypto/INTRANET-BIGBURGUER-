-- ============================================
-- TABLAS NECESARIAS PARA LA INTRANET DE EMPLEADOS
-- Ejecutar en Supabase SQL Editor
-- ============================================
-- NOTA: Este script NO hace referencias a tablas que puedan no existir.
-- Las tablas se crean de forma independiente usando "documento" como identificador.

-- ============================================
-- 1. TABLA DE SOLICITUDES DE EMPLEADOS
-- ============================================
CREATE TABLE IF NOT EXISTS solicitudes_empleados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID,  -- ID del usuario que hace la solicitud
  documento VARCHAR(50),  -- Documento del empleado
  empleado_nombre VARCHAR(200),  -- Nombre del empleado
  tipo VARCHAR(50) NOT NULL, -- 'permiso', 'vacaciones', 'licencia', 'cambio_horario', 'certificado', 'otro'
  descripcion TEXT NOT NULL,
  fecha_inicio DATE,
  fecha_fin DATE,
  estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'aprobada', 'rechazada'
  respuesta TEXT,
  respondido_por UUID,
  fecha_respuesta TIMESTAMPTZ,
  empresa_id UUID,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para solicitudes
CREATE INDEX IF NOT EXISTS idx_solicitudes_documento ON solicitudes_empleados(documento);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_empleados(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_empresa ON solicitudes_empleados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON solicitudes_empleados(fecha_creacion DESC);

-- ============================================
-- 2. TABLA DE HORARIOS PARA INTRANET
-- ============================================
CREATE TABLE IF NOT EXISTS horarios_intranet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  documento VARCHAR(50) NOT NULL,  -- Documento del empleado
  fecha DATE NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  es_descanso BOOLEAN DEFAULT FALSE,
  sede VARCHAR(200),
  turno VARCHAR(50), -- 'mañana', 'tarde', 'noche', 'completo'
  notas TEXT,
  empresa_id UUID,
  creado_por UUID,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para horarios
CREATE INDEX IF NOT EXISTS idx_horarios_intranet_doc ON horarios_intranet(documento);
CREATE INDEX IF NOT EXISTS idx_horarios_intranet_fecha ON horarios_intranet(fecha);
CREATE INDEX IF NOT EXISTS idx_horarios_intranet_empresa ON horarios_intranet(empresa_id);

-- ============================================
-- 3. TABLA DE NÓMINAS/DESPRENDIBLES
-- ============================================
CREATE TABLE IF NOT EXISTS nominas_intranet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  documento VARCHAR(50) NOT NULL,  -- Documento del empleado
  empleado_nombre VARCHAR(200),
  periodo_nombre VARCHAR(100),
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  fecha_pago DATE,
  
  -- Devengados
  salario_basico DECIMAL(12,2) DEFAULT 0,
  auxilio_transporte DECIMAL(12,2) DEFAULT 0,
  horas_extras DECIMAL(12,2) DEFAULT 0,
  horas_extras_nocturnas DECIMAL(12,2) DEFAULT 0,
  recargos_nocturnos DECIMAL(12,2) DEFAULT 0,
  recargos_dominicales DECIMAL(12,2) DEFAULT 0,
  comisiones DECIMAL(12,2) DEFAULT 0,
  bonificaciones DECIMAL(12,2) DEFAULT 0,
  otros_devengados DECIMAL(12,2) DEFAULT 0,
  total_devengado DECIMAL(12,2) DEFAULT 0,
  
  -- Deducciones
  deduccion_salud DECIMAL(12,2) DEFAULT 0,
  deduccion_pension DECIMAL(12,2) DEFAULT 0,
  fondo_solidaridad DECIMAL(12,2) DEFAULT 0,
  retencion_fuente DECIMAL(12,2) DEFAULT 0,
  libranzas DECIMAL(12,2) DEFAULT 0,
  embargos DECIMAL(12,2) DEFAULT 0,
  otros_descuentos DECIMAL(12,2) DEFAULT 0,
  total_deducciones DECIMAL(12,2) DEFAULT 0,
  
  -- Neto
  neto_pagar DECIMAL(12,2) DEFAULT 0,
  
  -- Metadata
  empresa_id UUID,
  creado_por UUID,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para nóminas
CREATE INDEX IF NOT EXISTS idx_nominas_intranet_doc ON nominas_intranet(documento);
CREATE INDEX IF NOT EXISTS idx_nominas_intranet_periodo ON nominas_intranet(periodo_fin DESC);
CREATE INDEX IF NOT EXISTS idx_nominas_intranet_empresa ON nominas_intranet(empresa_id);

-- ============================================
-- 4. TABLA DE DOCUMENTOS PARA INTRANET
-- ============================================
CREATE TABLE IF NOT EXISTS documentos_intranet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  documento VARCHAR(50) NOT NULL,  -- Documento del empleado
  tipo VARCHAR(50) NOT NULL, -- 'contrato', 'carta_laboral', 'certificado', 'reglamento', 'otro'
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  url TEXT NOT NULL,
  fecha_expedicion DATE,
  fecha_vencimiento DATE,
  empresa_id UUID,
  subido_por UUID,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para documentos
CREATE INDEX IF NOT EXISTS idx_documentos_intranet_doc ON documentos_intranet(documento);
CREATE INDEX IF NOT EXISTS idx_documentos_intranet_tipo ON documentos_intranet(tipo);
CREATE INDEX IF NOT EXISTS idx_documentos_intranet_empresa ON documentos_intranet(empresa_id);

-- ============================================
-- 5. TABLA DE FORMATOS DISPONIBLES
-- ============================================
CREATE TABLE IF NOT EXISTS formatos_intranet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(50), -- 'rrhh', 'operaciones', 'administrativo'
  url TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  empresa_id UUID,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para formatos
CREATE INDEX IF NOT EXISTS idx_formatos_intranet_empresa ON formatos_intranet(empresa_id);
CREATE INDEX IF NOT EXISTS idx_formatos_intranet_categoria ON formatos_intranet(categoria);

-- ============================================
-- 6. TABLA DE CONFIGURACIÓN DE EMPRESA (para cartas laborales)
-- ============================================
CREATE TABLE IF NOT EXISTS config_empresa_intranet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID UNIQUE,
  nombre_empresa VARCHAR(200),
  nit VARCHAR(50),
  direccion VARCHAR(300),
  telefono VARCHAR(50),
  ciudad VARCHAR(100),
  representante_legal VARCHAR(200),
  cargo_representante VARCHAR(100),
  reglamento_url TEXT,
  logo_url TEXT,
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTA IMPORTANTE:
-- La autenticación se hace contra la tabla "usuarios" existente
-- usando el campo "usuario" (documento) y "clave" (contraseña)
-- NO SE NECESITA CREAR LA TABLA USUARIOS, YA EXISTE.
-- ============================================
