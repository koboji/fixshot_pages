/* ============================================================
   FixShot — Site Interactions
   ============================================================ */

(function () {
  'use strict';

  /* ---- Header scroll shadow ---- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Mobile hamburger ---- */
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('.header-nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('is-open');
      nav.classList.toggle('is-open');
      document.body.style.overflow = nav.classList.contains('is-open') ? 'hidden' : '';
    });
    // Close on nav link click
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('is-open');
        nav.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---- Scroll-triggered animations ---- */
  const animatedEls = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .scale-in');
  if (animatedEls.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    animatedEls.forEach((el) => observer.observe(el));
  } else {
    // Fallback: show everything
    animatedEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---- Counter animation ---- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-count'), 10);
          const suffix = el.getAttribute('data-suffix') || '';
          const duration = 1200;
          const start = performance.now();

          const animate = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            el.textContent = Math.round(target * eased) + suffix;
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          counterObserver.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((el) => counterObserver.observe(el));
  }

  /* ---- Smooth scroll for anchor links ---- */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ---- Pricing toggle (monthly / annual) ---- */
  document.querySelectorAll('.pricing-toggle-above').forEach((toggle) => {
    const mBtn = toggle.querySelector('.pricing-toggle-btn:first-child');
    const aBtn = toggle.querySelector('.pricing-toggle-btn:last-child');
    const grid = toggle.closest('.pricing-grid');
    const amount = grid?.querySelector('[id$="PriceAmount"]');
    const period = grid?.querySelector('[id$="PricePeriod"]');
    const proBtn = grid?.querySelector('.pricing-card--featured .btn');
    if (!mBtn || !aBtn || !amount || !period) return;
    mBtn.addEventListener('click', () => {
      mBtn.classList.add('is-active');
      aBtn.classList.remove('is-active');
      amount.textContent = '990';
      period.innerHTML = ' /月<span class="pricing-tax">（税込）</span>';
      if (proBtn) proBtn.href = proBtn.dataset.monthlyUrl || '#';
    });
    aBtn.addEventListener('click', () => {
      aBtn.classList.add('is-active');
      mBtn.classList.remove('is-active');
      amount.textContent = '9,900';
      period.innerHTML = ' /年<span class="pricing-tax">（税込）</span>';
      if (proBtn) proBtn.href = proBtn.dataset.yearlyUrl || '#';
    });
  });

  /* ---- Parallax-lite for hero decorative blobs ---- */
  const hero = document.querySelector('.hero');
  if (hero) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        hero.style.setProperty('--parallax-y', (y * 0.3) + 'px');
      }
    }, { passive: true });
  }
})();
