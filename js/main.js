/* ==========================================================================
   Amin Sharif — AI Automation Agency
   main.js — shared UI behaviour + inquiry form handling
   Progressive enhancement: every feature degrades gracefully without JS.
   ========================================================================== */
'use strict';

(function () {
  var CONFIG = window.SITE_CONFIG || {};
  var doc = document;

  function ready(fn) {
    if (doc.readyState !== 'loading') fn();
    else doc.addEventListener('DOMContentLoaded', fn);
  }

  /* ------------------------------------------------------------------
     MOBILE NAVIGATION (accessible: focus trap, Escape, overlay, aria)
     ------------------------------------------------------------------ */
  function initNav() {
    var toggle = doc.getElementById('hamburger');
    var nav = doc.getElementById('primary-nav');
    var overlay = doc.getElementById('nav-overlay');
    var closeBtn = doc.getElementById('nav-close');
    if (!toggle || !nav) return;

    var lastFocused = null;
    var items = nav.querySelectorAll('.nav__item');
    var carets = nav.querySelectorAll('.nav__caret');
    var mq = window.matchMedia('(min-width: 1081px)');

    function focusables() {
      return nav.querySelectorAll('a[href], button:not([disabled])');
    }

    function closeSubmenus(except) {
      items.forEach(function (item) {
        if (item === except) return;
        item.classList.remove('is-open');
        var c = item.querySelector('.nav__caret');
        if (c) c.setAttribute('aria-expanded', 'false');
      });
    }

    function open() {
      lastFocused = doc.activeElement;
      nav.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      doc.body.classList.add('nav-open');
      if (overlay) overlay.classList.add('is-open');
      var f = focusables();
      if (f.length) f[0].focus();
    }

    function close() {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      doc.body.classList.remove('nav-open');
      if (overlay) overlay.classList.remove('is-open');
      closeSubmenus();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function isOpen() { return nav.classList.contains('is-open'); }

    /* Submenu disclosures — click / Enter on the caret opens the panel.
       Works for keyboard, mouse and touch; hover also opens on desktop. */
    carets.forEach(function (caret) {
      caret.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var item = caret.closest('.nav__item');
        if (!item) return;
        var willOpen = !item.classList.contains('is-open');
        closeSubmenus(item);
        item.classList.toggle('is-open', willOpen);
        caret.setAttribute('aria-expanded', String(willOpen));
      });
    });

    /* Clicking anywhere outside the nav closes any open submenu. */
    doc.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) closeSubmenus();
    });

    toggle.addEventListener('click', function () {
      isOpen() ? close() : open();
    });

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', close);

    nav.addEventListener('click', function (e) {
      var link = e.target.closest('a[href]');
      if (link && isOpen() && !link.hasAttribute('data-keep-open')) close();
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (nav.querySelector('.nav__item.is-open')) { closeSubmenus(); return; }
        if (isOpen()) { close(); return; }
      }
      if (!isOpen()) return;
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* Hovering another top-level item releases a panel that a caret click
       pinned open, so two mega panels never overlap on desktop. */
    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () {
        if (mq.matches) closeSubmenus();
      });
    });

    // Close the panel if the viewport grows into desktop layout.
    var onResize = function (e) { if (e.matches && isOpen()) close(); };
    if (mq.addEventListener) mq.addEventListener('change', onResize);
    else if (mq.addListener) mq.addListener(onResize);
  }

  /* ------------------------------------------------------------------
     HEADER SCROLL STATE
     ------------------------------------------------------------------ */
  function initHeader() {
    var header = doc.getElementById('header');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    }
    update();
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     SCROLL REVEAL
     ------------------------------------------------------------------ */
  function initReveal() {
    var els = doc.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     BACK TO TOP
     ------------------------------------------------------------------ */
  function initBackToTop() {
    var btn = doc.getElementById('back-to-top');
    if (!btn) return;
    var ticking = false;
    function update() {
      btn.classList.toggle('is-visible', window.scrollY > 600);
      ticking = false;
    }
    update();
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ------------------------------------------------------------------
     CONFIG-DRIVEN LINKS (booking / LinkedIn)
     ------------------------------------------------------------------ */
  function initConfigLinks() {
    // Booking CTAs: upgrade the safe fallback (contact page) to the real URL.
    doc.querySelectorAll('[data-booking]').forEach(function (el) {
      if (CONFIG.bookingUrl) {
        el.setAttribute('href', CONFIG.bookingUrl);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
        el.removeAttribute('data-booking-fallback');
      } else {
        el.setAttribute('data-booking-fallback', 'true');
      }
    });

    // LinkedIn: only reveal when a genuine profile URL exists.
    doc.querySelectorAll('[data-linkedin]').forEach(function (el) {
      if (CONFIG.linkedinUrl) {
        el.setAttribute('href', CONFIG.linkedinUrl);
        el.removeAttribute('hidden');
        el.removeAttribute('aria-disabled');
        el.removeAttribute('data-placeholder');
      } else {
        el.setAttribute('href', '#');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('data-placeholder', 'true');
        el.setAttribute('title', 'LinkedIn profile not yet configured');
      }
    });

    // GitHub links
    doc.querySelectorAll('[data-github]').forEach(function (el) {
      if (CONFIG.githubUrl) el.setAttribute('href', CONFIG.githubUrl);
    });

    // Contact email links
    doc.querySelectorAll('[data-email]').forEach(function (el) {
      if (CONFIG.contactEmail) el.setAttribute('href', 'mailto:' + CONFIG.contactEmail);
    });
  }

  /* ------------------------------------------------------------------
     FOOTER YEAR
     ------------------------------------------------------------------ */
  function initYear() {
    doc.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ------------------------------------------------------------------
     INQUIRY FORM
     Client-side validation, then storage in PostgreSQL via the backend
     (with a FormSubmit.co email copy / fallback). A success message is
     shown ONLY after an endpoint confirms success.
     ------------------------------------------------------------------ */
  function initForm() {
    var form = doc.getElementById('inquiry-form');
    if (!form) return;

    var statusEl = doc.getElementById('form-status');
    var submitBtn = form.querySelector('[type="submit"]');
    var honeypot = form.querySelector('[data-honeypot]');
    var started = Date.now();

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function setStatus(type, html) {
      if (!statusEl) return;
      statusEl.hidden = false;
      statusEl.className = 'form-status form-status--' + type;
      statusEl.innerHTML = html;
    }

    function clearStatus() {
      if (!statusEl) return;
      statusEl.hidden = true;
      statusEl.textContent = '';
    }

    function fieldError(name, message) {
      var input = form.elements[name];
      var box = form.querySelector('[data-error-for="' + name + '"]');
      if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (box) box.textContent = message || '';
    }

    function validate() {
      var v = {
        name: (form.elements.name && form.elements.name.value || '').trim(),
        email: (form.elements.email && form.elements.email.value || '').trim(),
        service: (form.elements.service && form.elements.service.value || '').trim(),
        message: (form.elements.message && form.elements.message.value || '').trim()
      };
      var errors = {};

      if (v.name.length < 2) errors.name = 'Please enter your name (at least 2 characters).';
      if (!EMAIL_RE.test(v.email)) errors.email = 'Please enter a valid business email address.';
      if (!v.service) errors.service = 'Please choose the service you are interested in.';
      if (v.message.length < 10) errors.message = 'Please describe your situation in at least 10 characters.';

      ['name', 'email', 'service', 'message'].forEach(function (key) {
        fieldError(key, errors[key] || '');
      });

      var firstKey = ['name', 'email', 'service', 'message'].find(function (k) { return errors[k]; });
      if (firstKey && form.elements[firstKey]) form.elements[firstKey].focus();

      return { ok: Object.keys(errors).length === 0, errors: errors };
    }

    // Live clearing once the visitor starts correcting a field.
    ['name', 'email', 'service', 'message'].forEach(function (key) {
      var input = form.elements[key];
      if (!input) return;
      var evt = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(evt, function () {
        if (input.getAttribute('aria-invalid') === 'true') fieldError(key, '');
      });
    });

    /* ------------------------------------------------------------------
       Submission: store the inquiry in PostgreSQL via the backend API,
       then (best effort) email a copy through FormSubmit.co so existing
       email alerts keep working. If the backend cannot be reached, the
       form falls back to FormSubmit.co so no inquiry is ever lost.
       ------------------------------------------------------------------ */
    function apiPath(path) {
      var base = (CONFIG.apiBase || '').replace(/\/+$/, '');
      return base + path;
    }

    function inquiryEndpoint() {
      return CONFIG.inquiryEndpoint || apiPath('/api/inquiries');
    }

    function postJson(url, payload) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      });
    }

    function showSuccess() {
      form.reset();
      setStatus(
        'success',
        '<strong>Thank you — your message was sent.</strong><br>' +
        'I review every inquiry personally and usually reply within one business day. ' +
        'If you would like to talk sooner, email ' +
        '<a href="mailto:' + (CONFIG.contactEmail || '') + '">' + (CONFIG.contactEmail || '') + '</a>.'
      );
      if (statusEl) statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function showTransportError() {
      setStatus(
        'error',
        '<strong>Something went wrong while sending.</strong><br>' +
        'Check your connection and try again, or email me at ' +
        '<a href="mailto:' + (CONFIG.contactEmail || '') + '">' + (CONFIG.contactEmail || '') + '</a>.'
      );
    }

    function submitEmailCopy(payload) {
      return postJson(CONFIG.formEndpoint, {
        name: payload.name, email: payload.email, company: payload.company,
        service: payload.service, message: payload.message, budget: payload.budget,
        contact_method: payload.contact_method,
        _subject: 'New project inquiry — aminsharif.com',
        _template: 'table',
        _captcha: 'false'
      });
    }

    function emailCopyInBackground(payload) {
      if (!CONFIG.formEndpoint) return;
      try {
        fetch(CONFIG.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name: payload.name, email: payload.email, company: payload.company,
            service: payload.service, message: payload.message, budget: payload.budget,
            contact_method: payload.contact_method,
            _subject: 'New project inquiry — aminsharif.com',
            _template: 'table',
            _captcha: 'false'
          }),
          keepalive: true
        }).catch(function () { /* ignore */ });
      } catch (err) { /* ignore */ }
    }

    function fallbackToEmail(payload) {
      if (!CONFIG.formEndpoint) { showTransportError(); return Promise.resolve(); }
      return submitEmailCopy(payload)
        .then(function (out) {
          if (out.ok && String(out.data.success) !== 'false') showSuccess();
          else showTransportError();
        })
        .catch(function () { showTransportError(); });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearStatus();

      // Spam traps: honeypot field + suspiciously fast submission.
      var honeypotFilled = honeypot && honeypot.value.trim() !== '';
      var tooFast = Date.now() - started < 2500;
      if (honeypotFilled || tooFast) return;

      var result = validate();
      if (!result.ok) {
        setStatus('error', 'Please fix the highlighted fields and try again.');
        return;
      }

      var payload = {};
      new FormData(form).forEach(function (value, key) {
        if (key.charAt(0) === '_') return;   // skip honeypot + FormSubmit meta fields
        payload[key] = value;
      });

      var original = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Sending…';
      }

      postJson(inquiryEndpoint(), payload)
        .then(function (out) {
          if (out.ok && String(out.data.success) !== 'false') {
            showSuccess();
            emailCopyInBackground(payload);   // keep email alerts, non-blocking
            return null;
          }
          if (out.status === 400 && out.data && out.data.errors) {
            Object.keys(out.data.errors).forEach(function (key) {
              fieldError(key, out.data.errors[key]);
            });
            setStatus('error', 'Please fix the highlighted fields and try again.');
            return null;
          }
          return fallbackToEmail(payload);
        })
        .catch(function () {
          return fallbackToEmail(payload);
        })
        .then(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = original; }
        });
    });
  }

  /* ------------------------------------------------------------------
     DYNAMIC INSIGHTS MENU
     Keeps the "Insights" dropdown a fixed size no matter how many articles
     exist, by showing *categories* (left column) and the three latest
     articles (right column) instead of every article. The static markup
     stays put as a no-JS / API-unavailable fallback.
     ------------------------------------------------------------------ */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function menuItem(href, title, desc) {
    return '<li><a class="mega__item" href="' + escapeHtml(href) + '">' +
      '<span class="mega__title">' + escapeHtml(title) + '</span>' +
      (desc ? '<span class="mega__desc">' + escapeHtml(desc) + '</span>' : '') +
      '</a></li>';
  }

  function insightsApi(path) {
    return (CONFIG.apiBase || '').replace(/\/+$/, '') + path;
  }

  var MENU_MAX_CATEGORIES = 8; /* hard cap — the menu stays the same size forever */
  var MENU_MAX_LATEST = 3;

  function fillMenuCategories(panel) {
    var list = panel.querySelector('.mega__col .mega__list');
    if (!list) return;

    fetch(insightsApi('/api/categories'), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var cats = (data.categories || [])
          .filter(function (c) { return (c.article_count || 0) > 0; })
          .sort(function (a, b) { return (b.article_count || 0) - (a.article_count || 0); })
          .slice(0, MENU_MAX_CATEGORIES);

        if (!cats.length) return;

        list.innerHTML = cats.map(function (c) {
          var n = c.article_count || 0;
          var href = 'insights.html?category=' + encodeURIComponent(c.slug);
          return menuItem(href, c.name, n === 1 ? '1 article' : n + ' articles');
        }).join('');
      })
      .catch(function () { /* keep the static fallback */ });
  }

  function fillMenuLatest(panel) {
    var cols = panel.querySelectorAll('.mega__col');
    var list = cols.length > 1 ? cols[1].querySelector('.mega__list') : null;
    if (!list) return;

    fetch(insightsApi('/api/articles?limit=' + MENU_MAX_LATEST), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var articles = (data.articles || []).slice(0, MENU_MAX_LATEST);
        if (!articles.length) return;

        var heading = '<li class="mega__heading" aria-hidden="true">Latest</li>';
        list.innerHTML = heading + articles.map(function (article) {
          var desc = String(article.excerpt || '').replace(/\s+/g, ' ').trim();
          if (desc.length > 64) desc = desc.slice(0, 63).replace(/\s+\S*$/, '') + '…';
          return menuItem(article.url, article.title, desc);
        }).join('');
      })
      .catch(function () { /* keep the static fallback */ });
  }

  function initInsightsMenu() {
    var panel = doc.getElementById('sub-insights');
    if (!panel) return;

    fillMenuCategories(panel);
    fillMenuLatest(panel);

    /* Add a "Browse all insights" link to the panel's CTA card. */
    var cta = panel.querySelector('.mega__cta');
    if (cta && !cta.querySelector('[data-menu-all]')) {
      var all = doc.createElement('a');
      all.className = 'mega__cta-link';
      all.href = 'insights.html';
      all.setAttribute('data-menu-all', '');
      all.innerHTML = 'Browse all insights <i class="fas fa-arrow-right" aria-hidden="true"></i>';
      cta.appendChild(all);
    }
  }

  /* ------------------------------------------------------------------
     BOOT
     ------------------------------------------------------------------ */
  ready(function () {
    initNav();
    initHeader();
    initReveal();
    initBackToTop();
    initConfigLinks();
    initYear();
    initForm();
    initInsightsMenu();
  });
})();
