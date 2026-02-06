/**
 * Scroll Animations Module
 * Modern Intersection Observer-based animations
 */

export class ScrollAnimations {
    constructor(config = {}) {
        this.config = {
            threshold: config.threshold || 0.1,
            rootMargin: config.rootMargin || '0px 0px -50px 0px',
            duration: config.duration || 600,
        };

        this.observers = new Map();
        this.elements = new Set();
        this.isPaused = false;

        this.init();
    }

    /**
     * Initialize animations
     */
    init() {
        // Find all elements with data-aos attribute
        const elements = document.querySelectorAll('[data-aos]');

        if (elements.length === 0) return;

        // Create intersection observer
        const observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                threshold: this.config.threshold,
                rootMargin: this.config.rootMargin,
            }
        );

        // Observe all elements
        elements.forEach((el) => {
            this.elements.add(el);
            observer.observe(el);
        });

        this.observers.set('main', observer);
    }

    /**
     * Handle intersection changes
     */
    handleIntersection(entries) {
        if (this.isPaused) return;

        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                this.animateElement(entry.target);
            }
        });
    }

    /**
     * Animate a single element
     */
    animateElement(element) {
        // Get delay from data attribute
        const delay = parseInt(element.dataset.aosDelay) || 0;

        // Apply animation after delay
        setTimeout(() => {
            element.classList.add('aos-animate');

            // Dispatch custom event
            element.dispatchEvent(new CustomEvent('aos:in', {
                bubbles: true,
                detail: { element },
            }));
        }, delay);
    }

    /**
     * Pause animations
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * Resume animations
     */
    resume() {
        this.isPaused = false;
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.observers.forEach((observer) => observer.disconnect());
        this.observers.clear();
        this.elements.clear();
    }
}

/**
 * Stats Counter Animation
 */
export class StatsCounter {
    constructor(selector = '.stat__number') {
        this.elements = document.querySelectorAll(selector);
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

        // Observe parent container
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

        // Extract number and suffix
        const match = text.match(/^([\d,]+)(.*)$/);
        if (!match) return;

        const [, numberStr, suffix] = match;
        const targetValue = parseInt(numberStr.replace(/,/g, ''));

        if (isNaN(targetValue)) return;

        this.animateValue(element, 0, targetValue, 2000, suffix);
    }

    animateValue(element, start, end, duration, suffix = '') {
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

    destroy() {
        // Cleanup if needed
    }
}

/**
 * Button Ripple Effect
 */
export class ButtonRipple {
    constructor(selector = '.btn') {
        this.buttons = document.querySelectorAll(selector);
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

        ripple.classList.add('ripple');
        button.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    }

    destroy() {
        // Cleanup if needed
    }
}

/**
 * Floating Elements Animation
 */
export class FloatingElements {
    constructor(selector = '.floating-cube') {
        this.element = document.querySelector(selector);
        this.isPaused = false;

        if (this.element) {
            this.init();
        }
    }

    init() {
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    }

    handleMouseMove(event) {
        if (this.isPaused || !this.element) return;

        const x = (event.clientX / window.innerWidth - 0.5) * 20;
        const y = (event.clientY / window.innerHeight - 0.5) * 20;

        requestAnimationFrame(() => {
            this.element.style.transform = `
        translateY(-20px) 
        rotateX(${y}deg) 
        rotateY(${x}deg)
      `;
        });
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    destroy() {
        // Cleanup if needed
    }
}

// Initialize stats counter and button ripple automatically
document.addEventListener('DOMContentLoaded', () => {
    new StatsCounter();
    new ButtonRipple();
    new FloatingElements();
});
