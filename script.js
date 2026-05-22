/* ═══════════════════════════════════════════════════════════
   DESAFIO FAÇA & VENDA — Landing Page Scripts
   Modules: Config · ScrollAnimator · FaqController ·
            StickyController · Analytics · Init
   Dependencies: None
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   1. CONFIG
   ═══════════════════════════════════════════ */
const CONFIG = {
  // URLs — update when checkout link is ready
  CHECKOUT_URL: 'https://pay.kiwify.com.br/OxJV34U',

  // Tracking IDs — update when provided
  META_PIXEL_ID: '',
  GA4_MEASUREMENT_ID: '',

  // Thresholds
  SCROLL_ANIMATE_THRESHOLD: 0.2,

  // Selectors
  SELECTORS: {
    hero: '#hero',
    offer: '#offer',
    stickyCta: '#sticky-cta',
    faqItems: '.faq-item',
    animatable: '[data-animate]',
    ctaButtons: '.cta-button',
  },
};

/* ═══════════════════════════════════════════
   2. SCROLL ANIMATOR
   ═══════════════════════════════════════════ */
const ScrollAnimator = {
  init() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything immediately
      document.querySelectorAll(CONFIG.SELECTORS.animatable).forEach((el) => {
        el.classList.add('is-visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: CONFIG.SCROLL_ANIMATE_THRESHOLD }
    );

    document.querySelectorAll(CONFIG.SELECTORS.animatable).forEach((el) => {
      observer.observe(el);
    });
  },
};

/* ═══════════════════════════════════════════
   3. FAQ CONTROLLER
   ═══════════════════════════════════════════ */
const FaqController = {
  init() {
    const items = document.querySelectorAll(CONFIG.SELECTORS.faqItems);

    items.forEach((item) => {
      const summary = item.querySelector('summary');

      summary.addEventListener('click', (e) => {
        e.preventDefault();

        if (item.open) {
          this.close(item);
        } else {
          // Close others first
          items.forEach((other) => {
            if (other !== item && other.open) {
              this.close(other);
            }
          });
          this.open(item);
        }
      });
    });
  },

  open(item) {
    const answer = item.querySelector('.faq-item__answer');
    item.open = true;
    answer.style.maxHeight = '0px';
    answer.style.overflow = 'hidden';
    answer.style.transition = 'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms';
    answer.style.opacity = '0';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        answer.style.maxHeight = answer.scrollHeight + 'px';
        answer.style.opacity = '1';
      });
    });

    answer.addEventListener('transitionend', function handler() {
      answer.style.maxHeight = 'none';
      answer.style.overflow = '';
      answer.removeEventListener('transitionend', handler);
    });

    // Track
    const questionText = item.querySelector('summary span:last-child')?.textContent || '';
    Analytics.trackFaqOpen(questionText);
  },

  close(item) {
    const answer = item.querySelector('.faq-item__answer');
    answer.style.maxHeight = answer.scrollHeight + 'px';
    answer.style.overflow = 'hidden';
    answer.style.transition = 'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        answer.style.maxHeight = '0px';
        answer.style.opacity = '0';
      });
    });

    answer.addEventListener('transitionend', function handler() {
      item.open = false;
      answer.style.maxHeight = '';
      answer.style.overflow = '';
      answer.style.opacity = '';
      answer.style.transition = '';
      answer.removeEventListener('transitionend', handler);
    });
  },
};

/* ═══════════════════════════════════════════
   4. STICKY CONTROLLER
   ═══════════════════════════════════════════ */
const StickyController = {
  state: {
    heroVisible: true,
    offerVisible: false,
    simulatorVisible: false,
    visibleOnPageButtons: new Set(),
  },

  init() {
    const hero = document.querySelector(CONFIG.SELECTORS.hero);
    const offer = document.querySelector(CONFIG.SELECTORS.offer);
    const simulator = document.querySelector('.simulator-card');
    const sticky = document.querySelector(CONFIG.SELECTORS.stickyCta);

    if (!hero || !sticky) return;

    // Watch hero
    const heroObserver = new IntersectionObserver(
      (entries) => {
        this.state.heroVisible = entries[0].isIntersecting;
        this.update(sticky);
      },
      { threshold: 0 }
    );
    heroObserver.observe(hero);

    // Watch offer
    if (offer) {
      const offerObserver = new IntersectionObserver(
        (entries) => {
          this.state.offerVisible = entries[0].isIntersecting;
          this.update(sticky);
        },
        { threshold: 0.1 }
      );
      offerObserver.observe(offer);
    }

    // Watch simulator card to avoid covering inputs/results
    if (simulator) {
      const simulatorObserver = new IntersectionObserver(
        (entries) => {
          this.state.simulatorVisible = entries[0].isIntersecting;
          this.update(sticky);
        },
        { threshold: 0 } // Hide as soon as any part of the simulator is visible
      );
      simulatorObserver.observe(simulator);
    }

    // Watch all on-page CTA buttons (excluding the sticky one)
    const onPageButtons = document.querySelectorAll('.cta-button:not(.cta-button--full)');
    if (onPageButtons.length > 0) {
      const buttonObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.state.visibleOnPageButtons.add(entry.target);
            } else {
              this.state.visibleOnPageButtons.delete(entry.target);
            }
          });
          this.update(sticky);
        },
        { threshold: 0.1 }
      );
      onPageButtons.forEach((btn) => buttonObserver.observe(btn));
    }
  },

  update(sticky) {
    const hasButtonOnScreen = this.state.visibleOnPageButtons.size > 0;
    const shouldShow = !this.state.heroVisible && !this.state.offerVisible && !this.state.simulatorVisible && !hasButtonOnScreen;
    sticky.classList.toggle('is-visible', shouldShow);
  },
};

/* ═══════════════════════════════════════════
   5. ANALYTICS
   ═══════════════════════════════════════════ */
const Analytics = {
  scrollDepthTracked: new Set(),

  init() {
    this.trackPageView();
    this.setupScrollDepth();
  },

  trackPageView() {
    if (typeof fbq !== 'undefined' && CONFIG.META_PIXEL_ID) {
      fbq('track', 'PageView');
    }
  },

  trackCTAClick(ctaText, sectionName) {
    // Meta Pixel
    if (typeof fbq !== 'undefined') {
      fbq('track', 'InitiateCheckout', {
        content_name: ctaText,
        content_category: sectionName,
      });
    }
    // GA4
    if (typeof gtag !== 'undefined') {
      gtag('event', 'cta_click', {
        cta_text: ctaText,
        section: sectionName,
      });
    }
  },

  trackSectionView(sectionName) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'section_view', {
        section_name: sectionName,
      });
    }
  },

  trackFaqOpen(questionText) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'faq_open', {
        question: questionText,
      });
    }
  },

  trackScrollDepth(depth) {
    if (this.scrollDepthTracked.has(depth)) return;
    this.scrollDepthTracked.add(depth);

    if (typeof gtag !== 'undefined') {
      gtag('event', 'scroll_depth', { depth: depth });
    }
  },

  setupScrollDepth() {
    if (!('IntersectionObserver' in window)) return;

    const markers = document.querySelectorAll('[data-scroll-depth]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const depth = entry.target.getAttribute('data-scroll-depth');
            this.trackScrollDepth(depth);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0 }
    );

    markers.forEach((marker) => observer.observe(marker));
  },
};

/* ═══════════════════════════════════════════
   6. SIMULATOR CONTROLLER
   ═══════════════════════════════════════════ */
const SimulatorController = {
  init() {
    const slider = document.getElementById('batch-range');
    const valueDisplay = document.getElementById('batch-value');
    const revDisplay = document.getElementById('result-revenue');
    const costDisplay = document.getElementById('result-cost');
    const profitDisplay = document.getElementById('result-profit');

    if (!slider || !valueDisplay || !revDisplay || !costDisplay || !profitDisplay) return;

    const updateSliderFill = () => {
      const min = parseFloat(slider.min) || 1;
      const max = parseFloat(slider.max) || 6;
      const val = parseFloat(slider.value);
      const percent = ((val - min) / (max - min)) * 100;
      slider.style.background = `linear-gradient(to right, var(--color-gold-500) 0%, var(--color-gold-300) ${percent}%, rgba(255, 255, 255, 0.08) ${percent}%)`;
    };

    const updateValues = () => {
      const batches = parseInt(slider.value, 10);
      valueDisplay.textContent = batches;

      const monthlyBatches = batches * 4;
      const revenue = monthlyBatches * 200;
      const cost = monthlyBatches * 50;
      const profit = monthlyBatches * 150;

      revDisplay.textContent = `R$ ${revenue.toLocaleString('pt-BR')}`;
      costDisplay.textContent = `R$ ${cost.toLocaleString('pt-BR')}`;
      profitDisplay.textContent = `R$ ${profit.toLocaleString('pt-BR')}`;

      updateSliderFill();
    };

    slider.addEventListener('input', updateValues);
    updateValues(); // Initial call
  }
};

/* ═══════════════════════════════════════════
   7. CTA SETUP
   ═══════════════════════════════════════════ */
function setupCTALinks() {
  const buttons = document.querySelectorAll(CONFIG.SELECTORS.ctaButtons);

  buttons.forEach((btn) => {
    if (btn.id === 'cta-offer') {
      // Set checkout URL for the actual purchase button in the pricing table
      if (CONFIG.CHECKOUT_URL && CONFIG.CHECKOUT_URL !== '#') {
        btn.href = CONFIG.CHECKOUT_URL;
      }

      btn.addEventListener('click', (e) => {
        const ctaText = btn.textContent.trim();
        const section = btn.getAttribute('data-section') || 'unknown';

        Analytics.trackCTAClick(ctaText, section);

        // Always prevent default to avoid '#' jumping to the top of the page
        e.preventDefault();

        // Small delay to ensure tracking fires before redirecting
        if (CONFIG.CHECKOUT_URL && CONFIG.CHECKOUT_URL !== '#') {
          setTimeout(() => {
            window.location.href = CONFIG.CHECKOUT_URL;
          }, 150);
        } else {
          console.warn('Checkout URL not configured yet. Please set CONFIG.CHECKOUT_URL in script.js');
        }
      });
    } else {
      // All other CTA buttons scroll the user down to the pricing/offer section
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const ctaText = btn.textContent.trim();
        const section = btn.getAttribute('data-section') || 'unknown';

        Analytics.trackCTAClick(ctaText, section);

        const target = document.getElementById('offer');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  });
}

/* ═══════════════════════════════════════════
   8. SECTION VIEW TRACKING
   ═══════════════════════════════════════════ */
function setupSectionTracking() {
  if (!('IntersectionObserver' in window)) return;

  const sections = document.querySelectorAll('section[id]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          Analytics.trackSectionView(entry.target.id);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  sections.forEach((section) => observer.observe(section));
}

/* ═══════════════════════════════════════════
   9. INIT
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Core interactions
  ScrollAnimator.init();
  FaqController.init();
  SimulatorController.init();

  // Mobile sticky CTA
  if (window.matchMedia('(max-width: 1023px)').matches) {
    StickyController.init();
  }

  // CTA links
  setupCTALinks();

  // Analytics
  Analytics.init();
  setupSectionTracking();
});
