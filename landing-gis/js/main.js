/**
 * Main Entry Point - Target GIS Landing Page
 * Modern ES6+ JavaScript with modular architecture
 * @version 2.0.0
 */

import { ScrollAnimations } from './modules/animations.js';
import { PerformanceMonitor } from './modules/performance.js';
import { ScrollEffects } from './modules/scroll-effects.js';

/**
 * Application Configuration
 */
const CONFIG = {
    animations: {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
        duration: 600,
    },
    performance: {
        enableMetrics: true,
        reportInterval: 5000,
    },
};

/**
 * Application Class
 * Manages the entire landing page lifecycle
 */
class App {
    constructor(config) {
        this.config = config;
        this.modules = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize all modules
     */
    async init() {
        if (this.isInitialized) {
            console.warn('App already initialized');
            return;
        }

        try {
            // Initialize performance monitoring first
            if (this.config.performance.enableMetrics) {
                const perfMonitor = new PerformanceMonitor(this.config.performance);
                this.modules.set('performance', perfMonitor);
                perfMonitor.start();
            }

            // Initialize scroll animations
            const scrollAnims = new ScrollAnimations(this.config.animations);
            this.modules.set('animations', scrollAnims);

            // Initialize scroll effects
            const scrollEffects = new ScrollEffects();
            this.modules.set('scrollEffects', scrollEffects);

            // Setup event listeners
            this.setupEventListeners();

            // Mark as initialized
            this.isInitialized = true;

            // Log success
            this.logBranding();

            // Dispatch ready event
            document.dispatchEvent(new CustomEvent('app:ready'));
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.handleError(error);
        }
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Smooth scroll for anchor links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="#"]');
            if (link) {
                e.preventDefault();
                const targetId = link.getAttribute('href').slice(1);
                this.scrollToElement(targetId);
            }
        });

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onPageHidden();
            } else {
                this.onPageVisible();
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * Smooth scroll to element
     */
    scrollToElement(id) {
        const element = document.getElementById(id);
        if (!element) return;

        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });

        // Update URL without triggering navigation
        if (history.pushState) {
            history.pushState(null, null, `#${id}`);
        }
    }

    /**
     * Handle page hidden
     */
    onPageHidden() {
        // Pause animations, stop timers, etc.
        this.modules.forEach((module) => {
            if (typeof module.pause === 'function') {
                module.pause();
            }
        });
    }

    /**
     * Handle page visible
     */
    onPageVisible() {
        // Resume animations, restart timers, etc.
        this.modules.forEach((module) => {
            if (typeof module.resume === 'function') {
                module.resume();
            }
        });
    }

    /**
     * Cleanup on page unload
     */
    cleanup() {
        this.modules.forEach((module) => {
            if (typeof module.destroy === 'function') {
                module.destroy();
            }
        });
        this.modules.clear();
    }

    /**
     * Handle errors
     */
    handleError(error) {
        // Log to console
        console.error('App Error:', error);

        // Send to error tracking service (if configured)
        if (window.errorTracker) {
            window.errorTracker.log(error);
        }

        // Show user-friendly message
        this.showErrorMessage('Algo salió mal. Por favor, recarga la página.');
    }

    /**
     * Show error message to user
     */
    showErrorMessage(message) {
        const errorEl = document.createElement('div');
        errorEl.className = 'error-toast';
        errorEl.textContent = message;
        errorEl.setAttribute('role', 'alert');
        errorEl.setAttribute('aria-live', 'assertive');

        document.body.appendChild(errorEl);

        setTimeout(() => {
            errorEl.remove();
        }, 5000);
    }

    /**
     * Log branding to console
     */
    logBranding() {
        const styles = {
            title: 'color: #00d9ff; font-size: 20px; font-weight: bold;',
            subtitle: 'color: #00ffa3; font-size: 12px;',
            divider: 'color: #00d9ff;',
        };

        console.log('%c🚀 Sistema de Optimización Target', styles.title);
        console.log('%cPowered by AI & GIS Technology', styles.subtitle);
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles.divider);
        console.log('%cVersion 2.0.0 | Modern Architecture', 'color: #888; font-size: 10px;');
    }
}

/**
 * Initialize app when DOM is ready
 */
function initApp() {
    const app = new App(CONFIG);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }

    // Expose app instance globally for debugging
    if (process.env.NODE_ENV === 'development') {
        window.__APP__ = app;
    }
}

// Start the app
initApp();

// Export for testing
export { App, CONFIG };
