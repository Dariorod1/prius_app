-- ==========================================
-- SCRIPT DE LIMPIEZA DE DATOS DE PRUEBA
-- PROYECTO: Prius App
-- TABLAS AFECTADAS: pagos_historial, pedido_estado_log, pedidos, clientes
-- TABLAS PRESERVADAS: empleados, instituciones
-- ==========================================
-- ⚠  EJECUTAR EN: Supabase Dashboard → SQL Editor
-- ⚠  ESTA OPERACIÓN ES IRREVERSIBLE
-- ==========================================

-- 1. Primero las tablas hijas (dependen de pedidos)
TRUNCATE TABLE public.pagos_historial    RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.pedido_estado_log  RESTART IDENTITY CASCADE;

-- 2. Luego pedidos (depende de clientes)
TRUNCATE TABLE public.pedidos            RESTART IDENTITY CASCADE;

-- 3. Por último clientes (tabla raíz del flujo)
TRUNCATE TABLE public.clientes           RESTART IDENTITY CASCADE;

-- ==========================================
-- VERIFICACIÓN POST-LIMPIEZA
-- ==========================================
SELECT 'clientes'          AS tabla, COUNT(*) AS registros FROM public.clientes
UNION ALL
SELECT 'pedidos'           AS tabla, COUNT(*) AS registros FROM public.pedidos
UNION ALL
SELECT 'pagos_historial'   AS tabla, COUNT(*) AS registros FROM public.pagos_historial
UNION ALL
SELECT 'pedido_estado_log' AS tabla, COUNT(*) AS registros FROM public.pedido_estado_log
UNION ALL
SELECT 'empleados'         AS tabla, COUNT(*) AS registros FROM public.empleados
UNION ALL
SELECT 'instituciones'     AS tabla, COUNT(*) AS registros FROM public.instituciones;
