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

- **Frontend:** React 19 (Vite 8) para una interfaz rápida y reactiva. Parser OXC (más estricto que Babel).
- **Backend/Base de Datos:** Supabase (PostgreSQL). Provee persistencia, autenticación y manejo relacional. Realtime habilitado en tabla `pedidos`.
- **Iconografía:** Lucide React (reemplazó todos los emojis del sistema).
- **Tipografía:** Nunito Sans (body) + Space Mono (header sidebar "PRIUS APP"). Cargadas desde Google Fonts.
- **Diseño:** CSS Custom Properties + `data-theme` attribute. Tema oscuro por defecto (charcoal `#1C1C1C`), tema claro inspirado en Mercado Pago. Toggle Sol/Luna en topbar, persiste en `localStorage`.
- **PDF:** jsPDF + jspdf-autotable para exportación en Listado.
- **PWA:** vite-plugin-pwa con Workbox NetworkFirst.
- **Deploy:** Vercel, auto-deploy desde GitHub `Dariorod1/prius_app` rama master.

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
6. **Swipe Gestures:** Las cards de producción (Corte, Confección, Bordado) soportan swipe táctil en mobile: derecha = avanzar estado, izquierda = retroceder. Con animación de salida (fly-off + rotación + fade).

---

## 3.1 Sistema de Temas

### Variables CSS (Dark - Default)
```css
--primary: #009EE3
--bg-dark: #1C1C1C
--bg-sidebar: #262626
--text-main: #EFEFEF
--text-muted: #8A8A9A
--accent: #00C896
--border-color: #383838
--topbar-bg: rgba(38, 38, 38, 0.90)
--nav-hover-bg: rgba(0, 158, 227, 0.07)
--mono-font: 'Space Mono', monospace
```

### Variables CSS (Light - `[data-theme="light"]`)
```css
--bg-dark: #F0F4F8
--bg-sidebar: #FFFFFF
--text-main: #1A1A2E
--text-muted: #5E6D82
--accent: #00A650
--border-color: #DDE3EE
--topbar-bg: rgba(255,255,255,0.92)
--nav-hover-bg: rgba(0,158,227,0.08)
```

### Reglas del tema
- **NUNCA** usar `color: white` o `color: #fff` directamente. Usar `var(--text-main)`.
- **NUNCA** usar `rgba(255,255,255,...)` para fondos/bordes. Usar variables CSS.
- El toggle Sol/Luna está en `Layout.jsx`, se persiste en `localStorage` como `priusTheme`.
- El atributo `data-theme` se aplica en `<html>`.

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
4. **Entrega:** Gestionada desde el módulo de **Cobranzas** (`Pagos.jsx`). El botón "Entregar Pedido" aparece sobre la card del pedido únicamente cuando se cumplen **ambas** condiciones simultáneamente:
   - `monto_pagado >= precio_total` (100% pagado).
   - `estado === 'Bordado Finalizado'` (producción completamente terminada).
   Al confirmar, el estado pasa a `Entregado` y se inserta un registro en `pedido_estado_log`.

### 5.3 Interacciones Kanban
- **Desktop:** Drag & Drop nativo (HTML5 API) entre columnas. Se usa `useRef` para el ID del pedido arrastrado (no `useState`, ya que un re-render interrumpe el drag del browser).
- **Mobile:** Swipe táctil en las cards con touch events nativos (`touchstart`/`touchmove`/`touchend`):
  - **Swipe derecha** → Avanza al siguiente estado (primera acción no-outlined del array `acciones`).
  - **Swipe izquierda** → Retrocede al estado anterior (acción outlined del array `acciones`).
  - **Threshold:** 80px mínimo de desplazamiento para activar.
  - **Feedback visual:** La card se desplaza y rota ligeramente siguiendo el dedo. Al pasar el threshold, cambia borde y fondo (verde = avanzar, naranja = retroceder). Al soltar, la card vuela fuera de la pantalla con animación de 300ms antes de ejecutar el cambio de estado.
  - **Contenedores:** Usan `overflow: hidden` para evitar scrollbar horizontal durante la animación.

---

## 6. Estado del Proyecto vs Plan Inicial

### ✅ Completado
- [x] Autenticación con expiración (20 min).
- [x] Gestión de Empleados, Clientes e Instituciones.
- [x] Cobranzas: Diseño responsivo optimizado (Cards adaptables, Status Bar compacta en móvil).
- [x] Mesa de Corte y Mesa de Confección Responsivas (Tabs/Grid sincronizado).
- [x] Trazabilidad total (Log de estados + Timeline en Dashboard).
- [x] **Tema Oscuro Charcoal** (`#1C1C1C`) como default + **Tema Claro** inspirado en Mercado Pago. Toggle Sol/Luna persistido en localStorage.
- [x] **Tipografía:** Nunito Sans (body) + Space Mono (sidebar header).
- [x] **Iconos Lucide React:** Reemplazo completo de emojis por iconos vectoriales en toda la app.
- [x] **Módulo de Bordado:** Interfaz de alto contraste, botones gigantes, tabs en mobile. Estados: `Confección Finalizada` → `En Bordado` → `Bordado Finalizado`. Realtime activo.
- [x] **Módulo de Entrega:** Integrado en Cobranzas. Botón "Entregar Pedido" visible solo cuando el pedido está al 100% pagado Y en estado `Bordado Finalizado`. Registra en `pedido_estado_log`.
- [x] **Supabase Realtime:** Activo en todos los módulos de producción (Corte, Confección, Bordado, Pagos). Las cards se actualizan automáticamente al detectar cambios en la tabla `pedidos` sin necesidad de recargar la página. En Pagos, el Realtime actualiza directamente desde `payload.new` sin depender de closures.
- [x] **PWA (Progressive Web App):** Configurada con `vite-plugin-pwa`. La app es instalable desde el navegador en iOS y Android. Service Worker con estrategia `NetworkFirst` para Supabase y `CacheFirst` para assets estáticos.
- [x] **Drag & Drop Desktop:** HTML5 Drag & Drop nativo en Corte, Confección y Bordado. Usa `useRef` para evitar re-renders que interrumpan el drag.
- [x] **Swipe Mobile:** Touch gestures nativos en las 3 mesas de producción. Swipe derecha = avanzar, izquierda = retroceder. Animación fly-off con rotación y fade antes de ejecutar el cambio.
- [x] **Listado Admin con PDF:** Filtros por escuela/estado, exportación PDF con header "PRIUS" + fecha + línea divisoria + tabla coloreada.
- [x] **Status Bar en Pagos:** Barra de progreso visual con 8 pasos que refleja el estado actual del pedido. Los labels coinciden exactamente con los estados de la DB.
- [x] **Sidebar:** Active indicator con `border-left`, logo PRIUS APP en Space Mono, navegación filtrada por rol.
- [x] **Topbar:** Backdrop-filter blur, avatar, toggle tema, logout.
- [x] **Botones:** Hover con glow + translateY. Clase `.btn-desktop-h` para altura 45px solo en desktop.

### ⏳ Pendiente (Por hacer)
- [ ] **Notificaciones WhatsApp:** Avisar al cliente cuando su prenda cambie de estado (integración API).
- [ ] **Reportes:** Dashboard estadístico de tiempos de producción y flujo de caja.
- [ ] **Limpiar console.logs de debug:** Hay logs temporales en `Pagos.jsx` (`[STATUS BAR]`, `[REALTIME]`, `[BUSCAR]`) que deben removerse antes del deploy final.

---

## 7. Opciones de Mejora (Polishing)

1. ~~**Listado Admin:** Vista exclusiva para admin que lista todos los pedidos con filtros por escuela/estado y permite exportar a PDF con encabezado de marca.~~ ✅ Implementado.
2. **Filtros Avanzados en Dash:** Poder filtrar por operario para medir productividad.
3. **Validación de Talles:** Implementar un selector de talles predefinidos por institución para evitar errores de carga manual.
4. **Fotos de Prendas:** Permitir adjuntar una foto del diseño o tela en el pedido para que el confeccionador no tenga dudas.
5. **Notificaciones WhatsApp:** Avisar al cliente cuando su prenda cambie de estado.
6. **Reportes:** Dashboard estadístico de tiempos de producción y flujo de caja.

---

### ⚠ Configuración Crítica: Supabase Realtime
Para que las actualizaciones instantáneas funcionen en todas las pantallas (Corte, Confección, Bordado, Pagos), es **obligatorio** habilitar la replicación en el Dashboard de Supabase:
1. Ve a **Database** -> **Replication**.
2. En la tabla `supabase_realtime`, haz clic en el botón de la columna **Source** (donde dice "0 tables").
3. Activa el interruptor para la tabla `pedidos`.
4. Sin este paso, el código de suscripción no recibirá eventos de la base de datos.

---

## 8. Guía para el Siguiente Desarrollador / IA

### Agregar un nuevo módulo de producción
1. Crea el archivo en `src/pages/`.
2. Copia la lógica de `isMobile` y `activeTab` de `Corte.jsx`.
3. Asegúrate de insertar un registro en `pedido_estado_log` en cada cambio de estado.
4. Mantén los colores del diseño (morados para botones primarios, bordes sutiles para secundarios).
5. No uses `window.confirm`, usa el sistema de modales o toasts para mantener la estética premium.

### Errores comunes con Vite 8 / OXC Parser
- **Template literals en JSX style objects:** OXC puede parsear mal `` `}` `` seguido de caracteres como `20` dentro de objetos style. Usar concatenación de strings en vez de template literals: `'translateX(' + value + 'px)'` en lugar de `` `translateX(${value}px)` ``.
- **Cierres de funciones:** Al convertir una arrow function de `() => (JSX)` a `() => { return (JSX) }`, asegurarse de que `return (` y `);` estén en líneas separadas de la llave de cierre `}`.

### Convenciones de color
- **SIEMPRE** usar variables CSS (`var(--text-main)`, `var(--bg-dark)`, etc.) en lugar de colores hardcodeados.
- Excepción: colores de acción específicos como `#10B981` (verde éxito), `#7C3AED` (morado progreso), `#FACC15` (amarillo advertencia) que son constantes de marca.

### Drag & Drop
- Usar `useRef` para el ID del pedido arrastrado, **nunca** `useState`. Un `setState` durante `onDragStart` causa un re-render que interrumpe el drag del browser.
- Los handlers de drop deben estar tanto en los headers de columna como en las celdas individuales.

### Swipe Mobile
- Los refs (`touchStartX`, `touchDeltaX`, `cardRef`) se crean dentro del componente `CardPedido`.
- Quitar `transition` en `touchStart` para que el arrastre sea inmediato, y re-agregar en `touchEnd` para la animación de salida.
- El contenedor padre necesita `overflow: hidden` para evitar scrollbar horizontal durante el fly-off.

### Status Bar en Pagos
- El array `steps` en `renderStatusBar` debe tener en `labels` los **valores exactos** que la DB almacena en `pedidos.estado`. Si se agrega un nuevo estado, hay que actualizar tanto la DB como este array.
- El Realtime de Pagos actualiza `pedidosEncontrados` directamente desde `payload.new` (sin llamar a `handleBuscar`) para evitar stale closures.
