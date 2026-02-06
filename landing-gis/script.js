// ============================================
// SMOOTH SCROLL
// ============================================
function scrollToDemo() {
    const demo = document.getElementById('demo');
    if (demo) {
        demo.scrollIntoView({ behavior: 'smooth' });
    }
}

function scrollToContact() {
    const contact = document.getElementById('contact');
    if (contact) {
        contact.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================
// SCROLL ANIMATIONS (AOS - Animate On Scroll)
// ============================================
class ScrollAnimations {
    constructor() {
        this.elements = document.querySelectorAll('[data-aos]');
        if (this.elements.length > 0) {
            this.init();
        }
    }

    init() {
        this.observeElements();
    }

    observeElements() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const delay = entry.target.getAttribute('data-aos-delay') || 0;
                        setTimeout(() => {
                            entry.target.classList.add('aos-animate');
                        }, parseInt(delay));
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            }
        );

        this.elements.forEach(el => observer.observe(el));
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
        if (this.stats.length > 0) {
            this.init();
        }
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

            if (!target) return;

            // Remove commas and % signs
            const cleanedText = target.replace(/,/g, '').replace(/%/g, '').trim();

            // Check if it's a number
            if (!isNaN(cleanedText) && cleanedText !== '') {
                const finalValue = parseInt(cleanedText);
                if (!isNaN(finalValue) && finalValue > 0) {
                    this.animateValue(stat, 0, finalValue, 2000);
                }
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
// BUTTON RIPPLE EFFECT
// ============================================
class ButtonRipple {
    constructor() {
        this.buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
        if (this.buttons.length > 0) {
            this.init();
        }
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
`;
if (document.head) {
    document.head.appendChild(rippleStyle);
}

// ============================================
// PARALLAX EFFECT
// ============================================
class ParallaxEffect {
    constructor() {
        this.init();
    }

    init() {
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrolled = window.pageYOffset;
                    const parallaxElements = document.querySelectorAll('.hero-bg');

                    parallaxElements.forEach(el => {
                        const speed = 0.5;
                        el.style.transform = `translateY(${scrolled * speed}px)`;
                    });

                    ticking = false;
                });

                ticking = true;
            }
        });
    }
}

// ============================================
// MAP PINS ANIMATION
// ============================================
class MapPinsAnimation {
    constructor() {
        this.pins = document.querySelectorAll('.pin');
        this.hasAnimated = false;
        if (this.pins.length > 0) {
            this.init();
        }
    }

    init() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.hasAnimated) {
                        this.animatePins();
                        this.hasAnimated = true;
                    }
                });
            },
            { threshold: 0.3 }
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
// INITIALIZE ALL MODULES
// ============================================
function initializeApp() {
    try {
        new ScrollAnimations();
        new FloatingCube();
        new StatsCounter();
        new ButtonRipple();
        new ParallaxEffect();
        new MapPinsAnimation();

        // Add loaded class
        document.body.classList.add('loaded');

        console.log('%c🚀 Sistema de Optimización Target', 'color: #00d9ff; font-size: 20px; font-weight: bold;');
        console.log('%cPowered by AI & GIS Technology', 'color: #00ffa3; font-size: 12px;');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
