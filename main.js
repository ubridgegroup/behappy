/* Be Happy Prep Center — main.js */

(function () {
  'use strict';

  // 1. Sticky header background on scroll
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 24) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // 2. Mobile menu toggle
  const toggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    navLinks.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // 3. Reveal-on-scroll
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  // 4. Animated number counters (stats sections)
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseFloat(el.dataset.count);
          const suffix = el.dataset.suffix || '';
          const decimals = parseInt(el.dataset.decimals || '0', 10);
          const duration = 1400;
          const start = performance.now();
          const ease = (t) => 1 - Math.pow(1 - t, 3);
          const tick = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const val = target * ease(p);
            el.textContent = val.toFixed(decimals) + suffix;
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = target.toFixed(decimals) + suffix;
          };
          requestAnimationFrame(tick);
          cio.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => cio.observe(el));
  }

  // 5. Current year in footer
  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // 6. Contact form — Formspree submission + URL prefill
  const form = document.querySelector('[data-contact-form]');
  if (form) {
    const successEl = form.querySelector('[data-form-success]');
    const errorEl = form.querySelector('[data-form-error]');
    const submitBtn = form.querySelector('[data-form-submit]');

    // Prefill from URL query params (sent by calculator or services CTAs)
    const params = new URLSearchParams(window.location.search);
    const fillField = (name, value) => {
      if (!value) return;
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.value = value;
    };

    fillField('service', params.get('service'));
    fillField('units', params.get('units'));
    fillField('product_size', params.get('size'));

    // If the calculator passed an estimate, drop a friendly summary into the message
    const units = params.get('units');
    const size = params.get('size');
    const estimate = params.get('estimate');
    const service = params.get('service');
    if (units || estimate || service) {
      const msg = form.querySelector('[name="message"]');
      if (msg && !msg.value) {
        const lines = [];
        if (service) lines.push(`Interested in: ${service.toUpperCase()} prep.`);
        if (units) lines.push(`Volume: ~${parseInt(units, 10).toLocaleString('en-US')} units/month${size ? ' (' + size + ')' : ''}.`);
        if (estimate) lines.push(`Calculator estimate seen: $${estimate}/month.`);
        lines.push('', 'Please send me a quote.');
        msg.value = lines.join('\n');
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      successEl && successEl.classList.remove('show');
      errorEl && errorEl.classList.remove('show');

      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending…';
      }

      try {
        const formData = new FormData(form);
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' }
        });

        if (response.ok) {
          form.reset();
          successEl && successEl.classList.add('show');
          // Scroll the success message into view
          successEl && successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const data = await response.json().catch(() => ({}));
          const msg = (data.errors && data.errors.map((er) => er.message).join('. ')) ||
                      "Something went wrong. Please email us directly at behappyprep@gmail.com.";
          if (errorEl) {
            errorEl.textContent = msg;
            errorEl.classList.add('show');
          }
        }
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = "Network error. Please email us directly at behappyprep@gmail.com.";
          errorEl.classList.add('show');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  // 7. Price calculator
  const calc = document.querySelector('[data-calculator]');
  if (calc) {
    // Pricing model — Standard size FBA processing tiers, plus oversize multiplier
    const STANDARD_TIERS = [
      { min: 1,    max: 20,    rate: 1.00, label: 'Up to 20 units' },
      { min: 21,   max: 1000,  rate: 0.80, label: '21 – 1,000 units' },
      { min: 1001, max: 5000,  rate: 0.65, label: '1,001 – 5,000 units' },
      { min: 5001, max: Infinity, rate: 0.50, label: '5,000+ units' }
    ];
    const OVERSIZE_RATE = 2.00; // entry-level oversize price for the calc preview

    const slider = calc.querySelector('[data-calc-slider]');
    const qtyEl  = calc.querySelector('[data-calc-qty]');
    const sizeButtons = calc.querySelectorAll('[data-calc-size]');
    const totalEl    = calc.querySelector('[data-calc-total]');
    const perUnitEl  = calc.querySelector('[data-calc-perunit]');
    const ctaEl      = calc.querySelector('[data-calc-cta]');
    const tierItems  = calc.querySelectorAll('[data-calc-tier]');

    let size = 'standard';

    // Map a logarithmic slider position (0-1000) to a unit count (1 - 10000)
    const sliderToQty = (v) => {
      const min = 1, max = 10000;
      const lmin = Math.log(min), lmax = Math.log(max);
      const scale = (lmax - lmin) / 1000;
      return Math.round(Math.exp(lmin + scale * v));
    };

    const fmt = (n) =>
      '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtQty = (n) => n.toLocaleString('en-US');

    const findTier = (qty) =>
      STANDARD_TIERS.find((t) => qty >= t.min && qty <= t.max) || STANDARD_TIERS[STANDARD_TIERS.length - 1];

    const update = () => {
      const qty = sliderToQty(parseInt(slider.value, 10));
      const tier = findTier(qty);
      const perUnit = size === 'oversize' ? OVERSIZE_RATE : tier.rate;
      const total = perUnit * qty;

      qtyEl.textContent = fmtQty(qty);
      totalEl.textContent = fmt(total);
      totalEl.classList.remove('pulse');
      // Force reflow to restart animation
      void totalEl.offsetWidth;
      totalEl.classList.add('pulse');

      perUnitEl.textContent = `${fmt(perUnit)} per unit · ${size === 'oversize' ? 'Oversize (5–10 lbs)' : tier.label}`;

      // Highlight active tier (only for standard)
      tierItems.forEach((li) => {
        const idx = parseInt(li.dataset.calcTier, 10);
        li.classList.toggle('active', size === 'standard' && idx === STANDARD_TIERS.indexOf(tier));
      });

      // Update CTA link with prefilled query (Contact page reads these)
      if (ctaEl) {
        const params = new URLSearchParams({
          units: qty,
          size: size,
          estimate: total.toFixed(2)
        });
        ctaEl.href = `contact.html?${params.toString()}`;
      }
    };

    slider.addEventListener('input', update);

    sizeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        sizeButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        size = btn.dataset.calcSize;
        update();
      });
    });

    update();
  }
})();
