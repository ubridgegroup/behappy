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
    // ---------------- Pricing model (from pricing.html source data) ----------------
    const FBA_STANDARD_TIERS = [
      { min: 1,    max: 20,    rate: 1.00, label: 'Up to 20 units' },
      { min: 21,   max: 1000,  rate: 0.80, label: '21 – 1,000 units' },
      { min: 1001, max: 5000,  rate: 0.65, label: '1,001 – 5,000 units' },
      { min: 5001, max: Infinity, rate: 0.50, label: '5,000+ units' }
    ];
    const FBA_OVERSIZE_RATES = {
      'os-1': { rate: 2.00, label: 'Oversize · 5–10 lbs' },
      'os-2': { rate: 3.00, label: 'Oversize · 10–15 lbs' },
      'os-3': { rate: 5.00, label: 'Oversize · 15+ lbs' }
    };
    const FBM_RATES = {
      'std':  { rate: 2.50, label: 'FBM · Standard size' },
      'fbm-1': { rate: 3.50, label: 'FBM · 5–10 lbs' },
      'fbm-2': { rate: 4.50, label: 'FBM · 10–20 lbs' },
      'fbm-3': { rate: 6.00, label: 'FBM · 20+ lbs' }
    };
    const BUNDLE_BASE = 1.20;     // first 2 items
    const BUNDLE_EXTRA = 0.20;    // each additional
    const RETURN_STANDARD = 5.00;
    const RETURN_OVERSIZE = 10.00;

    // ---------------- Element refs ----------------
    const slider     = calc.querySelector('[data-calc-slider]');
    const qtyEl      = calc.querySelector('[data-calc-qty]');
    const totalEl    = calc.querySelector('[data-calc-total]');
    const perUnitEl  = calc.querySelector('[data-calc-perunit]');
    const ctaEl      = calc.querySelector('[data-calc-cta]');
    const tierItems  = calc.querySelectorAll('[data-calc-tier]');
    const breakdownEl = calc.querySelector('[data-calc-breakdown]');

    // Mode buttons (e.g. FBA vs FBM)
    const modeButtons = calc.querySelectorAll('[data-calc-mode]');
    // Size buttons within active mode
    const sizeButtons = calc.querySelectorAll('[data-calc-size]');
    // Add-on inputs
    const bundleToggle  = calc.querySelector('[data-calc-bundle-toggle]');
    const bundleItems   = calc.querySelector('[data-calc-bundle-items]');
    const bundleControls = calc.querySelector('[data-calc-bundle-controls]');
    const returnsToggle = calc.querySelector('[data-calc-returns-toggle]');
    const returnsCount  = calc.querySelector('[data-calc-returns-count]');
    const returnsControls = calc.querySelector('[data-calc-returns-controls]');

    // ---------------- State ----------------
    let mode = calc.dataset.mode || 'fba';  // 'fba' or 'fbm'
    let size = 'std';                        // 'std' | 'os-1' | 'os-2' | 'os-3' | 'fbm-1' | ...

    // ---------------- Helpers ----------------
    const sliderToQty = (v) => {
      const min = 1, max = 10000;
      const lmin = Math.log(min), lmax = Math.log(max);
      const scale = (lmax - lmin) / 1000;
      return Math.round(Math.exp(lmin + scale * v));
    };
    const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtQty = (n) => n.toLocaleString('en-US');
    const findStandardTier = (qty) =>
      FBA_STANDARD_TIERS.find((t) => qty >= t.min && qty <= t.max) || FBA_STANDARD_TIERS[FBA_STANDARD_TIERS.length - 1];

    // Get base per-unit rate for current mode + size
    const getPerUnitRate = (qty) => {
      if (mode === 'fba') {
        if (size === 'std') return { rate: findStandardTier(qty).rate, label: findStandardTier(qty).label, tierIdx: FBA_STANDARD_TIERS.indexOf(findStandardTier(qty)) };
        const os = FBA_OVERSIZE_RATES[size];
        if (os) return { rate: os.rate, label: os.label, tierIdx: -1 };
      }
      if (mode === 'fbm') {
        const fbm = FBM_RATES[size] || FBM_RATES.std;
        return { rate: fbm.rate, label: fbm.label, tierIdx: -1 };
      }
      return { rate: 0, label: '—', tierIdx: -1 };
    };

    // ---------------- Render ----------------
    const update = () => {
      const qty = sliderToQty(parseInt(slider.value, 10));
      const { rate: perUnit, label: rateLabel, tierIdx } = getPerUnitRate(qty);
      const baseCost = perUnit * qty;

      // Bundling: cost per bundle = $1.20 (first 2 items) + $0.20 * (extra items beyond 2)
      // Assume each "bundle" corresponds to one unit shipped — N units = N bundles.
      let bundleCost = 0;
      if (bundleToggle && bundleToggle.checked && bundleItems) {
        const items = Math.max(2, parseInt(bundleItems.value, 10) || 2);
        const extras = Math.max(0, items - 2);
        bundleCost = (BUNDLE_BASE + extras * BUNDLE_EXTRA) * qty;
      }

      // Returns
      let returnsCost = 0;
      let returnsCount_n = 0;
      if (returnsToggle && returnsToggle.checked && returnsCount) {
        returnsCount_n = Math.max(0, parseInt(returnsCount.value, 10) || 0);
        // Treat oversize returns based on size selection
        const isOversize = size.startsWith('os-') || size.startsWith('fbm-');
        returnsCost = returnsCount_n * (isOversize ? RETURN_OVERSIZE : RETURN_STANDARD);
      }

      const total = baseCost + bundleCost + returnsCost;

      // Update visible numbers
      if (qtyEl) qtyEl.textContent = fmtQty(qty);
      if (totalEl) {
        totalEl.textContent = fmt(total);
        totalEl.classList.remove('pulse');
        void totalEl.offsetWidth;
        totalEl.classList.add('pulse');
      }
      if (perUnitEl) perUnitEl.textContent = `${fmt(perUnit)} per unit · ${rateLabel}`;

      // Breakdown (if shown)
      if (breakdownEl) {
        const rows = [];
        rows.push(`<div class="breakdown-row"><span>${rateLabel} × ${fmtQty(qty)}</span><span>${fmt(baseCost)}</span></div>`);
        if (bundleCost > 0) {
          const items = Math.max(2, parseInt(bundleItems.value, 10) || 2);
          rows.push(`<div class="breakdown-row"><span>Bundling — ${items}-item bundles × ${fmtQty(qty)}</span><span>${fmt(bundleCost)}</span></div>`);
        }
        if (returnsCost > 0) {
          const isOversize = size.startsWith('os-') || size.startsWith('fbm-');
          rows.push(`<div class="breakdown-row"><span>Returns × ${returnsCount_n} (${isOversize ? 'oversize' : 'standard'})</span><span>${fmt(returnsCost)}</span></div>`);
        }
        breakdownEl.innerHTML = rows.join('');
      }

      // Highlight active FBA standard tier
      tierItems.forEach((li) => {
        const idx = parseInt(li.dataset.calcTier, 10);
        li.classList.toggle('active', mode === 'fba' && size === 'std' && idx === tierIdx);
      });

      // CTA prefill
      if (ctaEl) {
        const params = new URLSearchParams({
          service: mode,
          units: qty,
          size: size,
          estimate: total.toFixed(2)
        });
        ctaEl.href = `contact.html?${params.toString()}`;
      }
    };

    // ---------------- Wiring ----------------
    if (slider) slider.addEventListener('input', update);

    // Mode buttons (FBA / FBM)
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        modeButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        mode = btn.dataset.calcMode;

        // Reset size to first available for that mode
        const validSizes = calc.querySelectorAll(`[data-calc-mode-group="${mode}"] [data-calc-size]`);
        const allGroups = calc.querySelectorAll('[data-calc-mode-group]');
        allGroups.forEach((g) => g.hidden = g.dataset.calcModeGroup !== mode);

        if (validSizes.length) {
          validSizes.forEach((b) => b.setAttribute('aria-pressed', 'false'));
          validSizes[0].setAttribute('aria-pressed', 'true');
          size = validSizes[0].dataset.calcSize;
        }
        update();
      });
    });

    // Size buttons
    sizeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        // Only toggle within the same mode group
        const group = btn.closest('[data-calc-mode-group]');
        const groupButtons = group ? group.querySelectorAll('[data-calc-size]') : sizeButtons;
        groupButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        size = btn.dataset.calcSize;
        update();
      });
    });

    // Bundling toggle
    if (bundleToggle) {
      bundleToggle.addEventListener('change', () => {
        if (bundleControls) bundleControls.hidden = !bundleToggle.checked;
        update();
      });
    }
    if (bundleItems) bundleItems.addEventListener('input', update);

    // Returns toggle
    if (returnsToggle) {
      returnsToggle.addEventListener('change', () => {
        if (returnsControls) returnsControls.hidden = !returnsToggle.checked;
        update();
      });
    }
    if (returnsCount) returnsCount.addEventListener('input', update);

    update();
  }
})();
