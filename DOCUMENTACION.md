# Prius App - Documentación Técnica y Operativa

Este documento sirve como fuente única de verdad para el desarrollo, mantenimiento y escalabilidad de **Prius App**. Está diseñado para que cualquier desarrollador o modelo de IA pueda comprender el contexto completo, la arquitectura y las reglas de negocio del sistema.

---

## 1. Contexto del Proyecto

### ¿Qué es?
Prius App es un sistema ERP (Enterprise Resource Planning) a medida para una fábrica textil. Centraliza la recepción de pedidos, el control financiero de cobranzas y el seguimiento en tiempo real del flujo de producción.

### ¿Por qué se hizo?
La fábrica operaba mediante hojas de cálculo de Google Drive y registros en papel. Esto generaba:
1. **Desincronización:** Los bordadores e impresores no tenían acceso a datos actualizados.
2. **Falta de Trazabilidad:** No se sabía quién cobraba qué, ni cuándo se autorizaba una prenda sin pago.
3. **Inoperancia en Taller:** Las hojas de cálculo son difíciles de manejar en dispositivos móviles dentro del taller de corte y confección.

### ¿Para qué se hizo?
Para profesionalizar la operación, garantizar que ninguna prenda se corte sin el pago correspondiente (o autorización explícita) y permitir que el taller trabaje con interfaces táctiles simples y modernas.

---

## 2. Stack Tecnológico ("Con qué se hizo")

- **Frontend:** React (Vite) para una interfaz rápida y reactiva.
- **Backend/Base de Datos:** Supabase (PostgreSQL). Provee persistencia, autenticación y manejo relacional.
- **Iconografía:** Lucide React.
- **Diseño:** CSS Vanilla (Mobile-First). Estética **Dark Mode Premium** con una paleta de colores vibrantes sobre fondos profundos para reducir la fatiga visual en el taller.

---

## 3. El "Mantra" del Diseño Responsivo
Dado que el sistema se utiliza mayormente en celulares dentro del taller, se aplica la siguiente regla de oro en toda la aplicación:

### Regla de Layout Dual
- **Desktop (Pantallas > 768px):** Visualización tipo **Dashboard/Kanban Grid**. Se prioriza la densidad de información y la sincronización de alturas para mantener el orden visual.
- **Mobile (Pantallas < 768px):** Visualización tipo **Tabs/List**. El contenido se divide en pestañas navegables con el pulgar. Los botones de acción son grandes (touch-friendly) y se eliminan textos redundantes a favor de íconos claros.

### Reglaje Técnico para Mobile (Anti-Rotura)
Para evitar que las cards se "rompan" o generen scroll horizontal en celulares:
1. **Paddings:** Máximo `1rem` en contenedores de cards en móvil.
2. **Touch Targets:** Altura mínima de `44px` en botones e inputs.
3. **Estado Responsivo:** Usar siempre el hook de detección de ancho (`window.innerWidth < 768`) para renderizar condicionalmente componentes complejos (como Steppers).
4. **Overflow:** No usar `min-width` fijos en elementos internos sin un contenedor con `overflow-x: auto`. Si se usa scroll horizontal interno, avisar visualmente.
5. **Fuentes:** Títulos en `1rem` a `1.1rem`, textos secundarios en `0.8rem` a `0.85rem`.

---

## 4. Entidades y Estructura de Datos

### 4.1 Instituciones (`instituciones`)
Representa las escuelas o empresas.
- **Campos:** `id (UUID)`, `nombre (text)`, `created_at`.
- **Ejemplo:** `{ id: '...', nombre: 'Colegio San Martín' }`

### 4.2 Clientes (`clientes`)
- **Campos:** `dni (text, PK)`, `nombre (text)`, `telefono (text)`, `email (text)`.
- **Ejemplo:** `{ dni: '37727963', nombre: 'Dario Rodriguez' }`

### 4.3 Pedidos (`pedidos`)
El corazón del sistema.
- **Campos clave:** 
    - `estado`: (`Pendiente`, `Autorizado`, `En Corte`, `Corte Finalizado`, `En Confección`, `Confección Finalizada`, `En Bordado`, `Bordado Finalizado`, `Entregado`).
    - `precio_total`: Monto acordado.
    - `monto_pagado`: Suma de todos los pagos realizados.
- **Ejemplo:** `{ tipo_prenda: 'Remera', talle: 'XXL', precio_total: 10000, monto_pagado: 5000, estado: 'Autorizado' }`

### 4.4 Historial de Pagos (`pagos_historial`)
Auditoría financiera.
- **Campos:** `pedido_id`, `monto`, `metodo_pago`, `empleado_username`, `fecha`.
- **Registro especial:** Las autorizaciones del admin se guardan como un pago de `$0` con método `'AUTORIZACIÓN EXCEPCIONAL'`.

### 4.5 Log de Estados (`pedido_estado_log`)
Trazabilidad de producción.
- **Campos:** `pedido_id`, `estado`, `empleado_username`, `fecha`.
- **Propósito:** Saber exactamente cuánto tiempo estuvo una prenda en cada etapa y quién fue el responsable.

---

## 5. Lógica de Negocio y Flujo Operativo

### 5.1 Regla del 50% (Control de Riesgo)
Un pedido nace en estado **Pendiente**. Solo pasa a **Autorizado** (visible para el cortador) si:
1. `monto_pagado >= (precio_total * 0.5)`
2. O un usuario con rol `admin` presiona **"Forzar Autorización"**.

### 5.2 El Flujo de Producción (Kanban)
1. **Corte:** El cortador ve la cola de `Autorizado`. Al iniciar, el pedido pasa a `En Corte`. Al terminar, a `Corte Finalizado`.
2. **Confección:** El confeccionador toma los `Corte Finalizado`. Inicia (`En Confección`) y termina (`Confección Finalizada`).
3. **Bordado:** El bordador toma los `Confección Finalizada`. Al iniciar, pasa a `En Bordado`. Al terminar, a `Bordado Finalizado`. Cada cambio se registra en `pedido_estado_log`.
4. **Entrega:** Gestionada desde el módulo de **Cobranzas** (`Pagos.jsx`). El botón "📦 Entregar Pedido" aparece sobre la card del pedido únicamente cuando se cumplen **ambas** condiciones simultáneamente:
   - `monto_pagado >= precio_total` (100% pagado).
   - `estado === 'Bordado Finalizado'` (producción completamente terminada).
   Al confirmar, el estado pasa a `Entregado` y se inserta un registro en `pedido_estado_log`.

---

## 6. Estado del Proyecto vs Plan Inicial

### ✅ Completado
- [x] Autenticación con expiración (20 min).
- [x] Gestión de Empleados, Clientes e Instituciones.
- [x] Cobranzas: Diseño responsivo optimizado (Cards adaptables, Status Bar compacta en móvil).
- [x] Mesa de Corte y Mesa de Confección Responsivas (Tabs/Grid sincronizado).
- [x] Trazabilidad total (Log de estados + Timeline en Dashboard).
- [x] Diseño Dark Mode Premium adaptado a taller.
- [x] **Módulo de Bordado:** Interfaz de alto contraste, botones gigantes, tabs en mobile. Estados: `Confección Finalizada` → `En Bordado` → `Bordado Finalizado`. Realtime activo.
- [x] **Módulo de Entrega:** Integrado en Cobranzas. Botón "📦 Entregar Pedido" visible solo cuando el pedido está al 100% pagado Y en estado `Bordado Finalizado`. Registra en `pedido_estado_log`.
- [x] **Supabase Realtime:** Activo en todos los módulos de producción (Corte, Confección, Bordado, Pagos). Las cards se actualizan automáticamente al detectar cambios en la tabla `pedidos` sin necesidad de recargar la página.
- [x] **PWA (Progressive Web App):** Configurada con `vite-plugin-pwa`. La app es instalable desde el navegador en iOS y Android. Service Worker con estrategia `NetworkFirst` para Supabase y `CacheFirst` para assets estáticos.

### ⏳ Pendiente (Por hacer)
- [ ] **Notificaciones:** Avisar al cliente por WhatsApp (integración) cuando su prenda cambie de estado.
- [ ] **Reportes:** Dashboard estadístico de tiempos de producción y flujo de caja.

---

## 7. Opciones de Mejora (Polishing)

1. **Listado Admin:** Vista exclusiva para admin que lista todos los pedidos con filtros por escuela/estado y permite exportar a PDF con encabezado de marca.
2. **Filtros Avanzados en Dash:** Poder filtrar por operario para medir productividad.
3. **Validación de Talles:** Implementar un selector de talles predefinidos por institución para evitar errores de carga manual.
4. **Fotos de Prendas:** Permitir adjuntar una foto del diseño o tela en el pedido para que el confeccionador no tenga dudas.

---

### ⚠ Configuración Crítica: Supabase Realtime
Para que las actualizaciones instantáneas funcionen en todas las pantallas (Corte, Confección, Bordado, Pagos), es **obligatorio** habilitar la replicación en el Dashboard de Supabase:
1. Ve a **Database** -> **Replication**.
2. En la tabla `supabase_realtime`, haz clic en el botón de la columna **Source** (donde dice "0 tables").
3. Activa el interruptor para la tabla `pedidos`.
4. Sin este paso, el código de suscripción no recibirá eventos de la base de datos.

---

## 8. Guía para el Siguiente Desarrollador / IA

Si vas a agregar un nuevo módulo de producción (ej. Bordado):
1. Crea el archivo en `src/pages/`.
2. Copia la lógica de `isMobile` y `activeTab` de `Corte.jsx`.
3. Asegúrate de insertar un registro en `pedido_estado_log` en cada cambio de estado.
4. Mantén los colores del diseño (morados para botones primarios, bordes sutiles para secundarios).
5. No uses `window.confirm`, usa el sistema de modales o toasts para mantener la estética premium.
