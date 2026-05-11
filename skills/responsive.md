# Reglas de Diseño Responsivo (Responsive Design)

Para garantizar que Prius App sea cómoda y fácil de usar en cualquier dispositivo (especialmente celulares en la fábrica), todo el desarrollo visual debe seguir estas reglas:

## 1. Enfoque "Mobile First" (Móvil Primero)
Siempre debemos diseñar y estructurar primero pensando en cómo se verá en el teléfono de los empleados (Cortador, Bordador, etc.) y luego adaptar o escalar la vista para las pantallas más grandes (Administrador en la oficina).

## 2. Puntos de Quiebre (Breakpoints)
Utilizaremos los siguientes puntos de quiebre estándar en nuestro CSS:
*   `max-width: 768px`: Teléfonos y Tablets en vertical. (Aquí la barra lateral se oculta y aparece un menú hamburguesa).
*   `max-width: 480px`: Teléfonos pequeños. (Ajustes de tipografía, botones más grandes para tocar con los dedos).

## 3. Uso de Flexbox y Grid
*   Evitar alturas o anchos fijos (ej. `width: 500px;`). 
*   Utilizar siempre porcentajes (`width: 100%;`), viewport units (`vh`, `vw`) o `flex: 1`.
*   Usar `gap` en Flexbox y Grid para separar elementos en lugar de márgenes complejos.

## 4. Tipografía y Botones Accesibles
*   Los botones deben tener un tamaño mínimo de toque (Touch Target) de `44px` x `44px` para que los trabajadores no se equivoquen al presionarlos.
*   En vistas móviles críticas (como la del Bordador), los textos deben ser significativamente más grandes (ej. `font-size: 2rem`) y con alto contraste.

## 5. Menú de Navegación
*   **Escritorio:** Barra lateral izquierda fija (Sidebar).
*   **Móviles:** La barra lateral se oculta y se invoca mediante un botón de menú (Hamburguesa) o se reemplaza por una barra de navegación inferior (Bottom Navigation).

## 6. Tablas Responsivas (Data-Cards)
*   **Regla estricta:** Nunca debe haber scroll horizontal (scroll-x) en vistas móviles, es una mala práctica de UX.
*   En pantallas pequeñas (`max-width: 768px`), las etiquetas `<table>` deben transformarse visualmente en "Tarjetas" (Cards) apiladas verticalmente. Esto se logra ocultando el `thead` y usando `display: block` en los `tr` y `td`, apoyándose en el atributo `data-label` para mostrar de qué trata cada celda.
