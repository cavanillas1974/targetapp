// ============================================
// SMOOTH SCROLL
// ============================================
function scrollToDemo() {
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
}

function scrollToContact() {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// SCROLL ANIMATIONS (AOS - Animate On Scroll)
// ============================================
class ScrollAnimations {
    constructor() {
        this.elements = document.querySelectorAll('[data-aos]');
        this.init();
    }

    init() {
        this.observeElements();
        window.addEventListener('scroll', () => this.checkElements());
        // Initial check
        this.checkElements();
    }

    observeElements() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('aos-animate');
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '0px 0px -100px 0px'
            }
        );

        this.elements.forEach(el => observer.observe(el));
    }

    checkElements() {
        this.elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            if (rect.top < windowHeight * 0.85) {
                const delay = el.getAttribute('data-aos-delay') || 0;
                setTimeout(() => {
                    el.classList.add('aos-animate');
                }, delay);
            }
        });
    }
}

// ============================================
// FLOATING CUBE ANIMATION
// ============================================
class FloatingCube {
    constructor() {
        this.cube = document.querySelector('.floating-cube');
        if (this.cube) {
            this.init();
        }
    }

    init() {
        // Add interactive mouse movement
        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 20;
            const y = (e.clientY / window.innerHeight - 0.5) * 20;

            this.cube.style.transform = `
                translateY(-20px) 
                rotateX(${y}deg) 
                rotateY(${x}deg)
            `;
        });
    }
}

// ============================================
// STATS COUNTER ANIMATION
// ============================================
class StatsCounter {
    constructor() {
        this.stats = document.querySelectorAll('.stat-number');
        this.hasAnimated = false;
        this.init();
    }

    init() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.hasAnimated) {
                        this.animateStats();
                        this.hasAnimated = true;
                    }
                });
            },
            { threshold: 0.5 }
        );

        const heroStats = document.querySelector('.hero-stats');
        if (heroStats) {
            observer.observe(heroStats);
        }
    }

    animateStats() {
        this.stats.forEach(stat => {
            const target = stat.textContent;
            const isNumber = !isNaN(target.replace(/,/g, ''));

            if (isNumber) {
                const finalValue = parseInt(target.replace(/,/g, ''));
                this.animateValue(stat, 0, finalValue, 2000);
            }
        });
    }

    animateValue(element, start, end, duration) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if (current >= end) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current).toLocaleString();
        }, 16);
    }
}

// ============================================
// METRIC CARDS ANIMATION
// ============================================
class MetricCardsAnimation {
    constructor() {
        this.metrics = document.querySelectorAll('.metric-card');
        this.hasAnimated = false;
        this.init();
    }

    init() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.hasAnimated) {
                        this.animateMetrics();
                        this.hasAnimated = true;
                    }
                });
            },
            { threshold: 0.3 }
        );

        const dashboard = document.querySelector('.dashboard-metrics');
        if (dashboard) {
            observer.observe(dashboard);
        }
    }

    animateMetrics() {
        this.metrics.forEach((metric, index) => {
            setTimeout(() => {
                metric.style.animation = 'slideInUp 0.6s ease forwards';
            }, index * 100);
        });
    }
}

// ============================================
// MAP PINS ANIMATION
// ============================================
class MapPinsAnimation {
    constructor() {
        this.pins = document.querySelectorAll('.pin');
        this.init();
    }

    init() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.animatePins();
                    }
                });
            },
            { threshold: 0.5 }
        );

        const mapPlaceholder = document.querySelector('.map-placeholder');
        if (mapPlaceholder) {
            observer.observe(mapPlaceholder);
        }
    }

    animatePins() {
        this.pins.forEach((pin, index) => {
            setTimeout(() => {
                pin.style.opacity = '0';
                pin.style.transform = 'scale(0)';

                setTimeout(() => {
                    pin.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                    pin.style.opacity = '1';
                    pin.style.transform = 'scale(1)';
                }, 100);
            }, index * 200);
        });
    }
}

// ============================================
// PARALLAX EFFECT
// ============================================
class ParallaxEffect {
    constructor() {
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.hero-bg');

            parallaxElements.forEach(el => {
                const speed = 0.5;
                el.style.transform = `translateY(${scrolled * speed}px)`;
            });
        });
    }
}

// ============================================
// BUTTON RIPPLE EFFECT
// ============================================
class ButtonRipple {
    constructor() {
        this.buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
        this.init();
    }

    init() {
        this.buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const ripple = document.createElement('span');
                const rect = button.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.classList.add('ripple');

                button.appendChild(ripple);

                setTimeout(() => ripple.remove(), 600);
            });
        });
    }
}

// Add ripple CSS dynamically
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
    .btn-primary, .btn-secondary {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: rippleAnimation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes rippleAnimation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(rippleStyle);

// ============================================
// NAVBAR SCROLL EFFECT (if you add a navbar later)
// ============================================
class NavbarScroll {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        if (this.navbar) {
            this.init();
        }
    }

    init() {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }
        });
    }
}

// ============================================
// FORM VALIDATION (for future contact form)
// ============================================
class FormValidation {
    constructor() {
        this.forms = document.querySelectorAll('form');
        this.init();
    }

    init() {
        this.forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.validateForm(form);
            });
        });
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('input[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                isValid = false;
                input.classList.add('error');
            } else {
                input.classList.remove('error');
            }
        });

        if (isValid) {
            this.submitForm(form);
        }
    }

    submitForm(form) {
        // Handle form submission
        console.log('Form submitted successfully!');
        // You can add AJAX submission here
    }
}

// ============================================
// PERFORMANCE OPTIMIZATION
// ============================================
class PerformanceOptimizer {
    constructor() {
        this.init();
    }

    init() {
        // Lazy load images
        this.lazyLoadImages();

        // Debounce scroll events
        this.debounceScrollEvents();
    }

    lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');

        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    debounceScrollEvents() {
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                // Scroll event handling
            }, 100);
        });
    }
}

// ============================================
// INITIALIZE ALL MODULES
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components
    new ScrollAnimations();
    new FloatingCube();
    new StatsCounter();
    new MetricCardsAnimation();
    new MapPinsAnimation();
    new ParallaxEffect();
    new ButtonRipple();
    new NavbarScroll();
    new FormValidation();
    new PerformanceOptimizer();

    // Add loading animation
    document.body.classList.add('loaded');
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Smooth scroll to element
function smoothScrollTo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Throttle function for performance
function throttle(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// CONSOLE BRANDING
// ============================================
console.log('%c🚀 Sistema de Optimización Target', 'color: #00d9ff; font-size: 20px; font-weight: bold;');
console.log('%cPowered by AI & GIS Technology', 'color: #00ffa3; font-size: 12px;');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #00d9ff;');
