/**
 * Scroll Effects Module
 * Parallax and scroll-based visual effects
 */

export class ScrollEffects {
    constructor() {
        this.ticking = false;
        this.scrollY = 0;
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.onScroll(), { passive: true });
        this.onScroll(); // Initial call
    }

    onScroll() {
        this.scrollY = window.pageYOffset;

        if (!this.ticking) {
            window.requestAnimationFrame(() => {
                this.update();
                this.ticking = false;
            });

            this.ticking = true;
        }
    }

    update() {
        this.updateParallax();
    }

    updateParallax() {
        const parallaxElements = document.querySelectorAll('.hero__background');

        parallaxElements.forEach((el) => {
            const speed = 0.5;
            el.style.transform = `translateY(${this.scrollY * speed}px)`;
        });
    }

    destroy() {
        window.removeEventListener('scroll', this.onScroll);
    }
}
