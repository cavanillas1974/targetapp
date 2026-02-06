/**
 * Professional Landing Page - Unified Script
 * Modern JavaScript without ES6 modules for maximum compatibility
 * @version 2.0.1
 */

(function () {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        animations: {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px',
            duration: 600,
        }
    };

    // ============================================
    // SCROLL ANIMATIONS
    // ============================================
    class ScrollAnimations {
        constructor(config) {
            this.config = config;
            this.elements = document.querySelectorAll('[data-aos]');
            this.isPaused = false;

            if (this.elements.length > 0) {
                this.init();
            }
        }

        init() {
            const observer = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                {
                    threshold: this.config.threshold,
                    rootMargin: this.config.rootMargin,
                }
            );

            this.elements.forEach((el) => observer.observe(el));
        }

        handleIntersection(entries) {
            if (this.isPaused) return;

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const delay = parseInt(entry.target.dataset.aosDelay) || 0;
                    setTimeout(() => {
                        entry.target.classList.add('aos-animate');
                    }, delay);
                }
            });
        }
    }

    // ============================================
    // STATS COUNTER
    // ============================================
    class StatsCounter {
        constructor() {
            this.elements = document.querySelectorAll('.stat__number');
            this.hasAnimated = false;

            if (this.elements.length > 0) {
                this.init();
            }
        }

        init() {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting && !this.hasAnimated) {
                            this.animateAll();
                            this.hasAnimated = true;
                        }
                    });
                },
                { threshold: 0.5 }
            );

            const container = this.elements[0]?.closest('.hero__stats');
            if (container) {
                observer.observe(container);
            }
        }

        animateAll() {
            this.elements.forEach((el) => this.animateCounter(el));
        }

        animateCounter(element) {
            const text = element.textContent.trim();
            if (!text) return;

            const match = text.match(/^([\d,]+)(.*)$/);
            if (!match) return;

            const numberStr = match[1];
            const suffix = match[2];
            const targetValue = parseInt(numberStr.replace(/,/g, ''));

            if (isNaN(targetValue)) return;

            this.animateValue(element, 0, targetValue, 2000, suffix);
        }

        animateValue(element, start, end, duration, suffix) {
            const range = end - start;
            const increment = range / (duration / 16);
            let current = start;

            const timer = setInterval(() => {
                current += increment;

                if (current >= end) {
                    current = end;
                    clearInterval(timer);
                }

                const formatted = Math.floor(current).toLocaleString('es-MX');
                element.textContent = formatted + suffix;
            }, 16);
        }
    }

    // ============================================
    // BUTTON RIPPLE
    // ============================================
    class ButtonRipple {
        constructor() {
            this.buttons = document.querySelectorAll('.btn');
            this.init();
        }

        init() {
            this.buttons.forEach((button) => {
                button.addEventListener('click', (e) => this.createRipple(e, button));
            });
        }

        createRipple(event, button) {
            const ripple = document.createElement('span');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = event.clientX - rect.left - size / 2;
            const y = event.clientY - rect.top - size / 2;

            ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
      `;

            button.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }
    }

    // ============================================
    // PARALLAX EFFECT
    // ============================================
    class ParallaxEffect {
        constructor() {
            this.ticking = false;
            this.init();
        }

        init() {
            window.addEventListener('scroll', () => this.onScroll(), { passive: true });
        }

        onScroll() {
            if (!this.ticking) {
                window.requestAnimationFrame(() => {
                    this.update();
                    this.ticking = false;
                });
                this.ticking = true;
            }
        }

        update() {
            const scrollY = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.hero__background');

            parallaxElements.forEach((el) => {
                const speed = 0.5;
                el.style.transform = `translateY(${scrollY * speed}px)`;
            });
        }
    }

    // ============================================
    // FLOATING CUBE
    // ============================================
    class FloatingCube {
        constructor() {
            this.element = document.querySelector('.floating-cube');
            if (this.element) {
                this.init();
            }
        }

        init() {
            document.addEventListener('mousemove', (e) => {
                const x = (e.clientX / window.innerWidth - 0.5) * 20;
                const y = (e.clientY / window.innerHeight - 0.5) * 20;

                requestAnimationFrame(() => {
                    this.element.style.transform = `
            translateY(-20px) 
            rotateX(${y}deg) 
            rotateY(${x}deg)
          `;
                });
            });
        }
    }

    // ============================================
    // SMOOTH SCROLL FUNCTIONS
    // ============================================
    window.scrollToDemo = function () {
        const demo = document.getElementById('demo');
        if (demo) {
            demo.scrollIntoView({ behavior: 'smooth' });
        }
    };

    window.scrollToContact = function () {
        const contact = document.getElementById('contact');
        if (contact) {
            contact.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // ============================================
    // INITIALIZE APP
    // ============================================
    function initApp() {
        try {
            new ScrollAnimations(CONFIG.animations);
            new StatsCounter();
            new ButtonRipple();
            new ParallaxEffect();
            new FloatingCube();

            // Log branding
            console.log('%c🚀 Sistema de Optimización Target', 'color: #00d9ff; font-size: 20px; font-weight: bold;');
            console.log('%cPowered by AI & GIS Technology', 'color: #00ffa3; font-size: 12px;');
            console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #00d9ff;');
            console.log('%cVersion 2.0.1 | Professional Architecture', 'color: #888; font-size: 10px;');

            document.body.classList.add('loaded');
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();
