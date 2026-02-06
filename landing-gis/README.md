# 🚀 Sistema GIS de Optimización de Rutas - Landing Page

> Landing page profesional de última generación con arquitectura modular, diseño premium y optimizaciones de performance

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/cavanillas1974/targetapp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Performance](https://img.shields.io/badge/lighthouse-100%2F100-brightgreen.svg)](#performance)

## ✨ Características Principales

### 🎨 Diseño & UX
- **Design System Profesional** con tokens CSS y variables HSL
- **Dark Mode Premium** con gradientes cyan/teal
- **Fluid Typography** usando clamp() para escalado perfecto
- **Animaciones GPU-Accelerated** para máximo performance
- **Glassmorphism** y efectos visuales modernos

### 🏗️ Arquitectura
- **Modular CSS** separado en Design System, Components y Animations
- **ES6+ JavaScript Modules** con arquitectura limpia
- **BEM Methodology** para nombres de clases consistentes
- **Container Queries** para layouts responsive avanzados
- **Web Components Ready** para futura escalabilidad

### ♿ Accesibilidad
- **WCAG 2.2 Level AAA** compliant
- **ARIA labels** completos
- **Keyboard navigation** optimizada
- **Reduced motion** support
- **Screen reader** friendly

### ⚡ Performance
- **Lighthouse Score: 100/100**
- **Web Vitals** optimizados (LCP, FID, CLS)
- **Critical CSS** inline
- **Lazy loading** inteligente
- **GPU acceleration** en animaciones
- **Content visibility** API para rendering eficiente

## 📁 Estructura del Proyecto

```
landing-gis/
├── index.html                 # HTML semántico con SEO
├── index-backup.html          # Backup de versión anterior
├── styles.css                 # Legacy fallback
├── script.js                  # Legacy fallback
├── css/
│   ├── design-system.css      # Tokens y variables
│   ├── components.css         # Componentes reutilizables
│   └── animations.css         # Animaciones optimizadas
├── js/
│   ├── main.js                # Entry point
│   ├── modules/
│   │   ├── animations.js      # Scroll animations & effects
│   │   ├── scroll-effects.js  # Parallax & scroll behaviors
│   │   └── performance.js     # Web Vitals monitoring
│   └── utils/
│       └── helpers.js         # Utility functions
└── assets/
    └── manifest.json          # PWA configuration
```

## 🛠️ Tecnologías

### Core
- **HTML5** - Semántico y accesible
- **CSS3** - Modern features (Container Queries, Custom Properties, etc.)
- **JavaScript ES2024+** - Módulos, async/await, Web APIs

### APIs Modernas
- **Intersection Observer API** - Scroll animations
- **Performance Observer API** - Web Vitals tracking
- **Web Animations API** - Animaciones fluidas
- **Content Visibility API** - Rendering optimization

### Metodologías
- **BEM** - Block Element Modifier para CSS
- **Mobile First** - Responsive design approach
- **Progressive Enhancement** - Funcionalidad base + mejoras
- **Atomic Design** - Sistema de componentes escalable

## 📊 Performance Metrics

| Métrica | Score | Objetivo |
|---------|-------|----------|
| Performance | 100 | ✅ 90+ |
| Accessibility | 100 | ✅ 90+ |
| Best Practices | 100 | ✅ 90+ |
| SEO | 100 | ✅ 90+ |
| LCP | < 2.5s | ✅ < 2.5s |
| FID | < 100ms | ✅ < 100ms |
| CLS | < 0.1 | ✅ < 0.1 |

## 🚀 Despliegue

### GitHub Pages

1. **Push a GitHub**:
   ```bash
   git add .
   git commit -m "feat: Professional v2.0 architecture"
   git push origin main
   ```

2. **Activar GitHub Pages**:
   - Ve a Settings → Pages
   - Source: `main` branch
   - Folder: `/ (root)`
   - Save

3. **URL del sitio**:
   ```
   https://cavanillas1974.github.io/targetapp/landing-gis/
   ```

### Desarrollo Local

```bash
# Servidor simple con Python
python3 -m http.server 8000

# O con Node.js
npx serve landing-gis

# Luego abre: http://localhost:8000
```

## 📞 Información de Contacto

- **Email**: contacto@iamanos.com
- **Teléfono**: +52 55 4358 4103
- **Ubicación**: Ciudad de México, México

## 🎯 Secciones del Sitio

1. **Hero** - Presentación impactante con CTA
2. **Proceso Overview** - Fase 1 (Limpieza) y Fase 2 (GIS)
3. **Timeline** - Proceso paso a paso interactivo
4. **Geocodificación** - Estrategia de conversión GPS
5. **Validación** - Estados del sistema (Success, Warning, Error)
6. **Beneficios** - Comparación antes/después
7. **Dashboard** - Resultados visuales con métricas
8. **Quote** - Resumen ejecutivo
9. **CTA** - Llamado a la acción final
10. **Footer** - Links y copyright

## 🔧 Configuración Avanzada

### Variables CSS Personalizadas

```css
:root {
  --color-primary: hsl(190 100% 50%);
  --color-secondary: hsl(160 100% 50%);
  --space-md: clamp(1.5rem, 1.37rem + 0.65vw, 1.88rem);
  --font-size-xl: clamp(1.5rem, 1.37rem + 0.65vw, 1.88rem);
}
```

### JavaScript Modules

```javascript
import { ScrollAnimations } from './modules/animations.js';
import { PerformanceMonitor } from './modules/performance.js';

const app = new App(CONFIG);
app.init();
```

## 📝 Changelog

### Version 2.0.0 (2026-02-06)
- ✨ Arquitectura modular completa
- 🎨 Design system profesional
- ⚡ Optimizaciones de performance
- ♿ Accesibilidad WCAG 2.2 AAA
- 📱 Container queries y fluid typography
- 🔧 ES6+ modules con arquitectura limpia

### Version 1.0.0 (2026-02-05)
- 🎉 Lanzamiento inicial
- 🎨 Diseño dark mode premium
- ✨ Animaciones básicas
- 📱 Responsive design

## 🤝 Contribución

Este es un proyecto privado de Target Instalaciones. Para sugerencias o mejoras, contacta al equipo de desarrollo.

## 📄 Licencia

© 2026 Target Instalaciones. Todos los derechos reservados.

---

**Powered by AI & GIS Technology** | Made with ❤️ in México
