-- ==========================================
-- SCRIPT DE INICIALIZACIÓN DE BASE DE DATOS
-- PROYECTO: Prius App
-- FECHA: Mayo 2026
-- ==========================================

-- 1. LIMPIEZA DE TABLAS ANTERIORES (Opcional, cuidado en producción)
DROP TABLE IF EXISTS public.pedidos CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.instituciones CASCADE;

-- ==========================================
-- CREACIÓN DE TABLAS
-- ==========================================

-- 2. Tabla Instituciones (Catálogo de escuelas/empresas)
CREATE TABLE public.instituciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL
);

-- 3. Tabla Clientes (DNI como identificador único)
CREATE TABLE public.clientes (
    dni TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT
);

-- 4. Tabla Empleados (Autenticación interna)
CREATE TABLE public.empleados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla Pedidos (Relacionada a Clientes e Instituciones)
CREATE TABLE public.pedidos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cliente_dni TEXT NOT NULL REFERENCES public.clientes(dni) ON DELETE RESTRICT,
    institucion_id UUID REFERENCES public.instituciones(id) ON DELETE SET NULL,
    tipo_prenda TEXT NOT NULL,
    talle TEXT NOT NULL,
    nombre_bordado TEXT,
    observaciones TEXT, -- Notas, alteraciones, puños, etc.
    precio_total NUMERIC NOT NULL DEFAULT 0,
    monto_pagado NUMERIC NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'Pendiente'
);

-- 6. Tabla Pagos Historial (Trazabilidad de cuotas)
CREATE TABLE public.pagos_historial (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
    monto NUMERIC NOT NULL,
    metodo_pago TEXT NOT NULL,
    empleado_username TEXT,
    talonario TEXT,              -- Número de talonario físico del comprobante
    comprobante_url TEXT,        -- URL del comprobante de transferencia (Supabase Storage bucket 'imagenes', path 'comprobantes/')
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar columnas de talonario y comprobante (si la tabla ya existía)
ALTER TABLE public.pagos_historial ADD COLUMN IF NOT EXISTS talonario TEXT;
ALTER TABLE public.pagos_historial ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- 7. Log de Cambios de Estado (trazabilidad de producción)
CREATE TABLE public.pedido_estado_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
    estado TEXT NOT NULL,
    empleado_username TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- CONFIGURACIÓN DE SEGURIDAD (RLS)
-- ==========================================

-- Desactivado temporalmente para fase de desarrollo
ALTER TABLE public.instituciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_historial DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_estado_log DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- DATOS DE PRUEBA (MOCK DATA)
-- ==========================================

-- 8. Tabla Lotes (Agrupación de pedidos por escuela+grado)
CREATE TABLE public.lotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institucion_id UUID REFERENCES public.instituciones(id) ON DELETE SET NULL,
    grado TEXT NOT NULL,
    imagen_chomba_url TEXT,
    imagen_campera_url TEXT,
    prioridad TEXT DEFAULT 'ninguna', -- ninguna, baja, media, alta, urgente
    precio_chomba NUMERIC,            -- Precio base de chomba para el lote
    precio_campera NUMERIC,           -- Precio base de campera para el lote
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(institucion_id, grado)
);

-- Agregar columnas de precio al lote (si la tabla ya existía)
ALTER TABLE public.lotes ADD COLUMN IF NOT EXISTS precio_chomba NUMERIC;
ALTER TABLE public.lotes ADD COLUMN IF NOT EXISTS precio_campera NUMERIC;

-- 9. Columna grado en pedidos (vincula pedidos a un lote)
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS grado TEXT;

-- ==========================================
-- CONFIGURACIÓN DE STORAGE (Bucket de imágenes)
-- ==========================================
-- Crear bucket 'imagenes' como PÚBLICO desde el Dashboard de Supabase.
-- Luego ejecutar estas policies para permitir subir/leer:

CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'imagenes');

CREATE POLICY "Allow public updates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'imagenes');

CREATE POLICY "Allow public reads" ON storage.objects
  FOR SELECT USING (bucket_id = 'imagenes');

CREATE POLICY "Allow public deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'imagenes');

-- Marcar el bucket como público (necesario para URLs /object/public/)
UPDATE storage.buckets SET public = true WHERE id = 'imagenes';

-- ==========================================
-- RLS para tabla lotes
-- ==========================================
ALTER TABLE public.lotes DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- DATOS DE PRUEBA (MOCK DATA)
-- ==========================================

-- Insertamos el Administrador principal
INSERT INTO public.empleados (email, username, password, rol, activo) VALUES
    ('admin@prius.com', 'admin', 'prius-admin', 'admin', true);

-- Insertamos primero las Instituciones
INSERT INTO public.instituciones (id, nombre) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Colegio San Martín'),
    ('22222222-2222-2222-2222-222222222222', 'Instituto Belgrano'),
    ('33333333-3333-3333-3333-333333333333', 'Empresa Tech SRL');

-- Insertamos los Clientes
INSERT INTO public.clientes (dni, nombre, telefono) VALUES
    ('35123456', 'Lucas Torres', '351-555-1234'),
    ('40987654', 'María Galarza', '351-555-9876'),
    ('28765432', 'Juan Pérez', '351-555-1111');

-- Insertamos los Pedidos de prueba
INSERT INTO public.pedidos (cliente_dni, institucion_id, tipo_prenda, talle, nombre_bordado, observaciones, precio_total, monto_pagado, estado) VALUES
    ('35123456', '11111111-1111-1111-1111-111111111111', 'Chomba Egresados', 'L', 'LUCAS', 'Cuello color azul marino', 15000, 15000, 'Cortado'),
    ('40987654', '11111111-1111-1111-1111-111111111111', 'Campera Egresados', 'M', 'MERY', '', 35000, 10000, 'Pendiente'),
    ('28765432', '22222222-2222-2222-2222-222222222222', 'Chomba Tradicional', 'XL', null, '', 12000, 12000, 'Autorizado'),
    ('35123456', '33333333-3333-3333-3333-333333333333', 'Campera Polar', 'L', 'TORRES', 'Puño más ajustado', 40000, 40000, 'Confeccionado');
