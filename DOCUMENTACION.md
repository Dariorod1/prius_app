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
    - `grado`: (Text, opcional) Grado/división del lote al que pertenece. Si es null, es un pedido individual.
    - `observaciones`: Notas, alteraciones, puños, etc.
    - `pausado`: (Boolean, DEFAULT false) Si es `true`, la prenda está **excluida** del lote activo. Las prendas excluidas no cuentan para la columna kanban ni para el progreso visible a los empleados. Solo el admin puede excluir/reincorporar prendas.
- **Ejemplo:** `{ tipo_prenda: 'Chomba', talle: 'L', grado: '3er Grado A', precio_total: 25000, monto_pagado: 12500, estado: 'Autorizado', pausado: false }`

> **SQL de migración:**
> ```sql
> ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pausado BOOLEAN DEFAULT false;
> ```

### 4.6 Lotes (`lotes`)
Representa una agrupación de pedidos por escuela + grado. Se crea desde Recepción por Lote.
- **Campos:** `id (UUID)`, `institucion_id (FK)`, `grado (text)`, `imagen_chomba_url (text)`, `imagen_campera_url (text)`, `prioridad (text)`, `prioridad_chomba (text)`, `prioridad_campera (text)`, `precio_chomba (numeric)`, `precio_campera (numeric)`, `created_at`.
- **Prioridades:** `ninguna`, `baja`, `media`, `alta`, `urgente`.
- **Prioridad por tipo de prenda:** `prioridad_chomba` y `prioridad_campera` permiten asignar prioridades **independientes** por tipo. Por ejemplo, un lote puede tener prioridad `urgente` en Chombas y `baja` en Camperas. Cada card kanban muestra la prioridad correspondiente a su tipo de prenda.
- **Constraint:** UNIQUE(institucion_id, grado) — solo un lote por escuela+grado.
- **Imágenes:** Se almacenan en Supabase Storage (bucket `imagenes`, público). Path: `lotes/{loteId}_chomba.ext` o `lotes/{loteId}_campera.ext`.
- **Precios del lote:** `precio_chomba` y `precio_campera` se guardan en el lote (no en cada pedido por separado). Se persisten automáticamente al salir del campo en RecepcionLote y se pre-cargan la próxima vez que se abre el lote.
- **Ejemplo:** `{ institucion_id: '...', grado: '3er Grado A', prioridad_chomba: 'urgente', prioridad_campera: 'baja', precio_chomba: 25000, precio_campera: 38000, imagen_chomba_url: 'https://...' }`

> **SQL de migración:**
> ```sql
> ALTER TABLE lotes ADD COLUMN IF NOT EXISTS prioridad_chomba TEXT DEFAULT 'ninguna';
> ALTER TABLE lotes ADD COLUMN IF NOT EXISTS prioridad_campera TEXT DEFAULT 'ninguna';
> -- Migrar prioridad global existente a ambos campos:
> UPDATE lotes SET prioridad_chomba = prioridad, prioridad_campera = prioridad
> WHERE prioridad IS NOT NULL AND prioridad != 'ninguna';
> ```

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

### 5.1 Autorización de Pedidos (Envío a Corte)
Un pedido nace en estado **Pendiente**. La autorización para corte se realiza **manualmente** desde la pantalla de Recepción por Lote:
1. El operador selecciona pedidos individuales con checkboxes o usa "Seleccionar todos".
2. Presiona "Enviar a Corte" → los pedidos seleccionados pasan a **Autorizado**.
3. Un usuario con rol `admin` también puede usar **"Forzar Autorización"** desde Pagos.

> **Nota:** No hay regla automática del 50%. La decisión de cuándo enviar a corte es del operador.

### 5.2 El Flujo de Producción (Kanban)
1. **Corte:** El cortador ve la cola de `Autorizado`. Los pedidos se agrupan visualmente por **lote** (escuela + grado + tipo_prenda). Cada card muestra la imagen de la prenda y la prioridad como barra de color. Al hacer click/tap se despliega el detalle con:
   - **Resumen de talles** (fichas grandes: cantidad + talle, ordenadas de menor a mayor). Es la info crítica para el cortador.
   - Lista de todos los alumnos/prendas con estado individual.
   - Acciones masivas (mover todo el lote) + botones individuales por prenda.
   - **Lote unificado:** Si se finaliza una prenda individual, la card del lote permanece en "En Corte" hasta que TODAS estén finalizadas. Se muestra progreso "2/5 finalizadas".
   Al iniciar, el pedido pasa a `En Corte`. Al terminar, a `Corte Finalizado`.
2. **Confección:** El confeccionador toma los `Corte Finalizado`. Inicia (`En Confección`) y termina (`Confección Finalizada`). Las cards se ordenan por prioridad de la prenda correspondiente (`prioridad_chomba` o `prioridad_campera` según el `tipo_prenda` del grupo). El **admin** puede **excluir prendas** del lote desde la sección "Gestión de prendas" en la vista de detalle.
3. **Bordado:** El bordador toma los `Confección Finalizada`. Los pedidos se agrupan por **lote** (escuela + grado + tipo_prenda). El seguimiento es **híbrido lote+individual**. Las cards se ordenan por prioridad de la prenda (`prioridad_chomba` / `prioridad_campera`). El **admin** puede excluir/reincorporar prendas individuales desde la lista de detalle.
   - La columna **Cola** muestra lotes donde ningún pedido está en `En Bordado` ni `Bordado Finalizado`.
   - La columna **En Bordado** muestra lotes donde al menos 1 pedido está en `En Bordado`.
   - La columna **Finalizado** muestra lotes donde todos los pedidos están en `Bordado Finalizado`.
   - Al tocar/hacer click en una card, se abre la **vista detalle** con lista de `nombre_bordado` individuales. Cada ítem tiene un ícono de estado y se puede tocar para abrir el **modal nombre**, que muestra el texto a bordar en grande (3rem) y permite marcar/desmarcar ese pedido individual.
   - Acciones del lote: "Iniciar Bordado del Lote" (mueve todos los de la cola a En Bordado), "Finalizar Lote · N pendientes" (mueve todos los En Bordado a Bordado Finalizado), "Devolver lote a cola". Cada cambio se registra en `pedido_estado_log`.
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
- [x] **Recepción por Lote (`/recepcion-lote`):** Carga masiva de pedidos por escuela+grado. Formulario repetitivo con DNI autocomplete, checkboxes Chomba/Campera, talles, precios (pre-definidos por lote y persistidos automáticamente en `lotes.precio_chomba/campera`), observaciones, seña. Guardado inmediato por alumno. Vista previa de lista con tabs Chomba/Campera. Resumen (alumnos, prendas, total, % cobrado). Upload de imágenes por prenda (Supabase Storage) con botón eliminar + modal de confirmación. Selector de prioridad del lote. Checkboxes para seleccionar pedidos y enviarlos a corte manualmente. Se puede retomar en cualquier momento seleccionando la misma escuela+grado.
- [x] **Corte por Lotes:** Cards agrupadas por lote con imagen grande de la prenda como hero. Barra de color de prioridad (verde=alta, roja=urgente, amarilla=media). Click para ver detalle del lote con resumen de talles (fichas grandes), lista de todos los alumnos/prendas con estado individual. Acciones masivas + individuales. Lote unificado: no se divide la card aunque haya estados mixtos. Indicador de progreso ("2/5 finalizadas"). Ordenado por prioridad.
- [x] **Supabase Storage:** Bucket `imagenes` (público, `UPDATE storage.buckets SET public = true`). Policies de INSERT/UPDATE/SELECT/DELETE habilitadas. Cache-buster (`?t=timestamp`) en URLs para evitar imágenes cacheadas.
- [x] **Libro Mayor (`/libro-mayor`):** Vista consolidada cross-lote de todos los pedidos. Reemplaza la doble entrada de planillas (ya no hace falta registrar el pago en el lote Y en el libro mayor por separado — la DB es única fuente de verdad). Incluye: 4 KPI cards (Total pedidos, Facturado, Cobrado, Saldo pendiente), filtros por Institución + Grado + Prenda + Estado + Estado de cobro (con deuda / pagado completo) + búsqueda por nombre/DNI, columna Institución/Grado en tabla, barra de progreso de pago con saldo pendiente en amarillo, botón **+ Pago** por fila (abre modal para registrar pago con monto + método sin salir de la vista), timeline expandible de estados por pedido.
- [x] **Talonario y comprobante en pagos:** Cada pago registrado (tanto en Pagos/Cuotas como en el modal rápido del Libro Mayor) permite ingresar el **N° de talonario** físico. Si el método es Transferencia, se habilita un botón para **adjuntar el comprobante** (imagen o PDF), que se sube a Supabase Storage en `comprobantes/{pedidoId}_{timestamp}.ext`. El talonario y el link "Ver comprobante" aparecen en cada fila del historial de movimientos (tanto en el modal de Pagos como en el historial colapsable de las cards de búsqueda).
- [x] **Confección por Lotes (`Confeccion.jsx`):** Cards agrupadas por lote (igual que Corte). Estados: `Corte Finalizado` → `En Confección` → `Confección Finalizada`. Swipe táctil (derecha = avanzar, izquierda = retroceder) + Drag & Drop HTML5 entre columnas kanban. Columnas: Cola (Corte Finalizado), En Confección, Finalizada. Vista de detalle al tocar/hacer click en la card (imagen, talles, lista de pedidos, acciones masivas e individuales).
- [x] **Bordado por Lotes (`Bordado.jsx`) — Modelo híbrido lote+individual:** Reescritura completa. Los pedidos se agrupan por `institucion_id + grado + tipo_prenda`. Columnas kanban: Cola (lotes donde ningún pedido está en bordado), En Bordado (al menos 1 pedido en bordado), Finalizado (todos los pedidos bordados). Swipe táctil + Drag & Drop entre columnas. **Vista detalle del lote:** header escuela+grado, barra de progreso amarilla, lista scrollable de `nombre_bordado` (cada fila: ícono círculo/check, nombre bordado en amarillo grande, nombre cliente, ícono alerta si hay obs). **Modal nombre bordado:** overlay con el texto a bordar en 3rem + botón "Marcar como Bordado" / "Reabrir". Acciones del lote: "Iniciar Bordado del Lote", "Finalizar Lote · N pendientes", "Devolver lote a cola".
- [x] **Prioridad por tipo de prenda — `prioridad_chomba` / `prioridad_campera` (Corte, Confección, Bordado):** Cada lote tiene prioridades independientes por tipo de prenda. En RecepcionLote hay un selector de prioridad separado en la pestaña Chomba y en la pestaña Campera. En las secciones kanban de Corte, Confección y Bordado cada card usa la prioridad del campo correspondiente a su `tipo_prenda`. La barra de color en la parte superior de la card refleja esa prioridad específica. Constantes usadas en todos los módulos: `PRIORIDAD_ORDEN = { urgente:0, alta:1, media:2, baja:3, ninguna:4 }` y `PRIORIDAD_COLORS = { urgente:'#EF4444', alta:'#10B981', media:'#FACC15', baja:'#94A3B8', ninguna:'transparent' }`.
- [x] **Excluir/Reincorporar prendas del lote (Confección y Bordado) — Solo admin:** El admin puede excluir prendas individuales de un lote activo (campo `pausado = true` en `pedidos`). Comportamiento:
  - Las prendas excluidas **no cuentan** para la columna kanban del lote ni para el progreso visible.
  - Los **empleados** ven solo el conteo activo sin ninguna indicación de prendas excluidas (vista limpia).
  - El **admin** ve en Confección: sección "Gestión de prendas" en la vista de detalle, con botón **Excluir** (rojo) para prendas activas no finalizadas y **Reincorporar** (verde) para las excluidas. Label "EXCLUIDA" sobre el ítem.
  - El **admin** ve en Bordado: lista de ítems completa incluyendo excluidos (con label `EXCLUIDA`), mismos botones Excluir/Reincorporar. Los empleados ven solo ítems activos en esa lista.
  - Badge `⏸ N` en la card (solo visible para el admin) indica cuántas prendas están excluidas.
  - El texto de progreso muestra `(N excluidas)` solo para el admin.
  - Un lote con todos los pedidos excluidos en Bordado queda en la columna Cola (no desaparece del kanban). Requiere la columna `pausado BOOLEAN DEFAULT false` en la tabla `pedidos`.
- [x] **Sidebar:** "Recepción" (`/pedidos`) desactivada temporalmente (comentada en `Sidebar.jsx`). El componente y la ruta siguen existiendo para reactivación futura.
- [x] **Edición de pedidos en RecepcionLote:** Ícono lápiz por fila de pedido (visible solo cuando `estado` es `Pendiente` o `Autorizado`). Modal que permite editar `talle` (select predefinido) y `nombre_bordado` (text input). Guarda directo a Supabase y actualiza estado local.
- [x] **Lotes recientes en RecepcionLote:** Panel lateral "Vistos recientemente" con hasta 3 lotes. Se persiste en `localStorage` (`prius_lotes_recientes`). Layout 2 columnas en desktop (formulario izq, recientes der). Click directo en una card abre el lote sin necesidad de completar el formulario.
- [x] **Libro Mayor — Filtro de Institución (combobox):** Reemplazado el `<input list="datalist">` (que tenía bugs de reapertura) por un combobox personalizado: input de texto que filtra las instituciones con `includes()` en tiempo real, dropdown flotante con los resultados, botón ×  para limpiar la selección. Compatible con cientos de instituciones.
- [x] **Libro Mayor — Filtro de Grado (select dinámico):** Cuando se selecciona una institución, el campo de grado cambia de texto libre a un `<select>` que carga solo los grados con lotes reales en esa institución (query a tabla `lotes`). Al cambiar de institución, el grado se resetea automáticamente.

### ⏳ Pendiente (Por hacer)
- [ ] **Notificaciones WhatsApp:** Avisar al cliente cuando su prenda cambie de estado (integración API).
- [ ] **Reportes:** Dashboard estadístico de tiempos de producción y flujo de caja.
- [ ] **Limpiar console.logs de debug:** Hay logs temporales en `Pagos.jsx` (`[STATUS BAR]`, `[REALTIME]`, `[BUSCAR]`) que deben removerse antes del deploy final.
- [ ] **Reactivar Recepción clásica (`/pedidos`):** El componente `Recepcion.jsx` y su ruta existen pero la entrada del Sidebar está comentada. Descomentar en `Sidebar.jsx` para reactivarla.

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

### Bordado — Modelo híbrido lote+individual
- `agruparPorLote()` agrupa pedidos por `institucion_id + grado + tipo_prenda`.
- La columna de destino de cada lote se determina por el **estado agregado** del grupo, no de pedidos individuales.
- `cambiarEstado(pedidoId, nuevoEstado)` → cambia un pedido individual.
- `cambiarEstadoLote(pedidos, nuevoEstado)` → cambia en bulk, filtrando solo los que aún no tienen ese estado.
- En los drop handlers de D&D, filtrar `p.estado !== col.dropEstado` antes de llamar `cambiarEstadoLote` para no regresar pedidos que ya avanzaron.

### RecepcionLote — Lotes recientes
- `cargarLoteConValores(instId, gr)` acepta valores directamente para evitar leer state obsoleto (cierre/closure).
- `cargarLote` es un thin wrapper sobre `cargarLoteConValores` que usa el state actual.
- `prius_lotes_recientes` en localStorage: array de `{ institucionId, grado, nombre, ts }`, máximo 3 entradas.

### Libro Mayor — Combobox de búsqueda
- El combobox usa `onBlur` + `setTimeout(..., 150)` para ocultar el dropdown. El delay permite que el `onMouseDown` de las opciones se ejecute antes del blur (sin ese delay, el click no llega).
- Usar `onMouseDown` (no `onClick`) en las opciones del dropdown para que el evento ocurra antes del blur del input.
- El estado `filtroInstitucion` guarda el UUID; `filtroInstitucionInput` guarda el texto visible en el input.

### Prioridad por tipo de prenda
- Los campos `prioridad_chomba` y `prioridad_campera` están en la tabla `lotes`, no en `pedidos`.
- En `agruparPorLote()` (Corte, Confección, Bordado), cada grupo toma su prioridad del campo correspondiente a `tipo_prenda`: `tipo_prenda === 'Chomba' ? lote.prioridad_chomba : lote.prioridad_campera`.
- En RecepcionLote, `cambiarPrioridadTipo(tipo, valor)` actualiza directamente el campo `prioridad_chomba` o `prioridad_campera` en Supabase y en el state local.
- El selector de prioridad se renderiza condicionalmente dentro del tab activo (Chomba o Campera), no fuera de las tabs.
- `getLoteKey(g)`: `g.grado ? (g.pedidos[0]?.institucion_id + '|' + g.grado + '|' + g.tipo_prenda) : ('ind|' + g.pedidos[0]?.id)` — clave única por grupo incluyendo el tipo de prenda.

### Excluir/Reincorporar prendas (pausado)
- `esAdmin` se computa inline: `const esAdmin = (JSON.parse(localStorage.getItem('priusUser')) || {}).rol === 'admin';` — fuera del JSX, dentro del componente funcional.
- `cambiarPausado(id, valor)` hace `UPDATE pedidos SET pausado = valor WHERE id = id` y usa el patrón `skipRealtimeCountRef` para evitar el re-fetch del propio cambio.
- **Lógica de columnas con prendas excluidas:**
  - Confección: `const nonPausedTodos = pedidosTodos.filter(p => !p.pausado)` — las 3 columnas usan este array filtrado.
  - Bordado: por grupo, `const np = g.pedidos.filter(p => !p.pausado)`. Si `np.length === 0` (todos excluidos), el grupo va a Cola.
- **Vista de detalle:** `total`, `finalizados`, `enConfeccion`/`enBordado`, `porConfeccionar`/`enCola` usan siempre solo los no pausados. `pausados` es el array complementario, solo para mostrarlos al admin.
- **Admin UI en Confección:** sección "Gestión de prendas" envuelta en `{esAdmin && (...)}`. Muestra todos los pedidos del grupo (incluidos excluidos). Botón **Excluir** (rojo) para activos no finalizados; botón **Reincorporar** (verde) para excluidos; label "EXCLUIDA" en los excluidos.
- **Admin UI en Bordado:** la lista de ítems usa `(esAdmin ? pedidosDelGrupo : pedidosDelGrupo.filter(p => !p.pausado)).map(...)`. Los botones Excluir/Reincorporar están dentro de `{esAdmin && !done && (...)}`.
- **Badge en card:** `{esAdmin && pausadosCount > 0 && <span>⏸ N</span>}` — visible solo para el admin.
- **Regla visual:** los empleados nunca ven la cantidad real de prendas del lote si hay excluidas; solo ven la cantidad activa.
