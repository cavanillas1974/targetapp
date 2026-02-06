/**
 * Performance Monitor Module
 * Web Vitals and performance tracking
 */

export class PerformanceMonitor {
    constructor(config = {}) {
        this.config = {
            enableMetrics: config.enableMetrics !== false,
            reportInterval: config.reportInterval || 5000,
        };

        this.metrics = {
            fcp: null,
            lcp: null,
            fid: null,
            cls: null,
        };

        this.observer = null;
    }

    start() {
        if (!this.config.enableMetrics) return;

        this.observePerformance();
        this.logMetrics();
    }

    observePerformance() {
        // Observe Largest Contentful Paint
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                console.warn('LCP observation not supported');
            }
        }

        // Log performance on page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                const perfData = window.performance.timing;
                const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
                console.log(`⚡ Page Load Time: ${pageLoadTime}ms`);
            }, 0);
        });
    }

    logMetrics() {
        if (this.config.enableMetrics) {
            console.log('📊 Performance Monitoring Active');
        }
    }

    pause() {
        // Pause monitoring
    }

    resume() {
        // Resume monitoring
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}
