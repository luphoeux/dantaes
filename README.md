# Farmers de Azeroth - Analytics

Proyecto de panel de análisis de ventas para World of Warcraft, diseñado con una estética moderna y funcional.

## Estructura del Proyecto

- **index.html**: Estructura principal, enlaza estilos y scripts.
- **css/style.css**: Hoja de estilos con variables CSS modernas (Inter font, paleta oscura/gold).
- **js/app.js**: Lógica principal de la aplicación, manejo de eventos y renderizado.
- **js/data.js**: Generación de datos de prueba (Mock Data).

## Características

- **Diseño Moderno**: Modo oscuro, glassmorphism sutil, tipografía Inter.
- **KPIs Dinámicos**: Cálculo de ingresos totales, semanales y ticket promedio.
- **Gráficos SVG Interactivos**: Gráficos de línea personalizados sin librerías pesadas.
- **Integración Wowhead**: Tooltips nativos de Wowhead para items.

## Cómo ejecutar

Simplemente abre el archivo `index.html` en un navegador web moderno.
Para un correcto funcionamiento de los módulos ES6 (si se presentan problemas de CORS localmente), se recomienda usar un servidor local (ej. Live Server en VSCode o `npx http-server`).
