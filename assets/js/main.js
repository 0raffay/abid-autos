/* Abid Autos – language, UI, animations, lead capture & tracking
 *
 * - Urdu is the default language. Elements carry English in data-en / data-en-ph / data-en-aria.
 * - Every form submission becomes a pre-filled WhatsApp message to the workshop, tagged with
 *   where the visitor came from (Facebook ad, Google ad, etc.).
 * - Optionally set LEAD_ENDPOINT to also save each lead to a Google Sheet (see google-sheet-leads.gs).
 */
(function () {
  'use strict';

  var CONFIG = {
    WHATSAPP_NUMBER: '923201291613',
    LEAD_ENDPOINT: '', // e.g. 'https://script.google.com/macros/s/XXXX/exec'
    POPUP_DELAY_MS: 30000, // show booking popup after 30s on page…
    POPUP_SCROLL_RATIO: 0.5, // …or once the visitor has scrolled half the page
    HOURS: { open: 9, close: 19, closedDays: [0] } // Mon–Sat 9am–7pm, Sunday closed (Pakistan time)
  };

  var TEXT = {
    ur: {
      title: 'عابد آٹوز | گاڑی کی مرمت، آئل چینج اور مکمل سروس',
      openNow: 'ابھی کھلا ہے · شام 7 بجے تک',
      closedOpensToday: 'ابھی بند ہے · آج صبح 9 بجے کھلے گا',
      closedOpensTomorrow: 'ابھی بند ہے · کل صبح 9 بجے کھلے گا',
      closedOpensMonday: 'آج بند ہے · پیر صبح 9 بجے کھلے گا',
      waGeneral: 'السلام علیکم! میں نے عابد آٹوز کی ویب سائٹ دیکھی ہے، گاڑی کے کام کے بارے میں پوچھنا ہے۔',
      waAppointment: 'السلام علیکم! مجھے اپائنٹمنٹ بک کرنی ہے (ویب سائٹ 15% رعایت)۔',
      waQuote: 'السلام علیکم! مجھے اپنی گاڑی کے کام کا تخمینہ چاہیے۔',
      name: 'نام', phone: 'فون', service: 'سروس', car: 'گاڑی', date: 'تاریخ', time: 'وقت', issue: 'مسئلہ',
      via: 'ویب سائٹ سے'
    },
    en: {
      title: 'Abid Autos | Car Repair, Oil Change & Full Service Workshop',
      openNow: 'Open now · until 7pm',
      closedOpensToday: 'Closed now · opens 9am today',
      closedOpensTomorrow: 'Closed now · opens 9am tomorrow',
      closedOpensMonday: 'Closed today · opens 9am Monday',
      waGeneral: 'Assalam-o-Alaikum! I found Abid Autos on the website and want to ask about a car repair.',
      waAppointment: 'Assalam-o-Alaikum! I want to book an appointment (15% website discount).',
      waQuote: 'Assalam-o-Alaikum! I need a quote for my car.',
      name: 'Name', phone: 'Phone', service: 'Service', car: 'Car', date: 'Preferred date', time: 'Time', issue: 'Issue',
      via: 'via website'
    }
  };

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- safe storage ---------- */
  function sGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function lGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  function lang() { return root.lang === 'en' ? 'en' : 'ur'; }
  function t(key) { return TEXT[lang()][key]; }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* =====================================================================
     Language
     ===================================================================== */
  function swapAttr(el, enAttr, urAttr, target, toEn) {
    if (el.getAttribute(urAttr) === null) el.setAttribute(urAttr, target(el) || '');
    target(el, toEn ? el.getAttribute(enAttr) : el.getAttribute(urAttr));
  }

  function applyLanguage(next, save) {
    var toEn = next === 'en';
    root.lang = next;
    root.dir = toEn ? 'ltr' : 'rtl';

    var ltr = document.getElementById('bs-ltr');
    var rtl = document.getElementById('bs-rtl');
    if (ltr && rtl) { ltr.media = toEn ? 'all' : 'not all'; rtl.media = toEn ? 'not all' : 'all'; }

    $all('[data-en]').forEach(function (el) {
      swapAttr(el, 'data-en', 'data-ur', function (e, v) {
        if (v === undefined) return e.textContent.replace(/\s+/g, ' ').trim();
        e.textContent = v;
      }, toEn);
    });
    $all('[data-en-ph]').forEach(function (el) {
      swapAttr(el, 'data-en-ph', 'data-ur-ph', function (e, v) {
        if (v === undefined) return e.getAttribute('placeholder');
        e.setAttribute('placeholder', v);
      }, toEn);
    });
    $all('[data-en-aria]').forEach(function (el) {
      swapAttr(el, 'data-en-aria', 'data-ur-aria', function (e, v) {
        if (v === undefined) return e.getAttribute('aria-label');
        e.setAttribute('aria-label', v);
      }, toEn);
    });

    document.title = t('title');
    updateWhatsAppLinks();
    updateOpenStatus();
    document.dispatchEvent(new Event('aa:lang'));
    if (save) lSet('aa_lang', next);
  }

  function initLanguage() {
    if (lang() === 'en') applyLanguage('en', false);
    else { updateWhatsAppLinks(); updateOpenStatus(); }

    $all('.js-lang-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        root.classList.add('is-switching');
        applyLanguage(lang() === 'en' ? 'ur' : 'en', true);
        hideToast();
        setTimeout(function () { root.classList.remove('is-switching'); }, 400);
        track('language_switch', { language: lang() });
      });
    });
  }

  /* ---------- first-visit language toast ---------- */
  var toast = document.querySelector('.lang-toast');
  function hideToast() {
    if (!toast || toast.hidden) return;
    toast.classList.remove('is-visible');
    setTimeout(function () { toast.hidden = true; }, 350);
  }
  function initToast() {
    if (!toast || lGet('aa_lang')) return;
    setTimeout(function () {
      toast.hidden = false;
      requestAnimationFrame(function () { requestAnimationFrame(function () { toast.classList.add('is-visible'); }); });
    }, 1200);
    $all('.js-toast-en', toast).forEach(function (b) {
      b.addEventListener('click', function () { applyLanguage('en', true); hideToast(); track('language_switch', { language: 'en' }); });
    });
    $all('.js-toast-ur', toast).forEach(function (b) {
      b.addEventListener('click', function () { lSet('aa_lang', 'ur'); hideToast(); });
    });
  }

  /* =====================================================================
     Header, menu, scroll spy
     ===================================================================== */
  function initHeader() {
    var header = document.querySelector('.site-header');
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var menu = document.getElementById('mobileMenu');
    var openBtn = document.querySelector('.js-menu-open');
    function setMenu(open) {
      root.classList.toggle('menu-open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var first = menu.querySelector('a'); if (first) setTimeout(function () { first.focus(); }, 250); }
    }
    openBtn.addEventListener('click', function () { setMenu(true); });
    $all('.js-menu-close').forEach(function (el) { el.addEventListener('click', function () { setMenu(false); }); });
    $all('a, [data-bs-toggle="modal"]', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

    // Highlight the nav link of the section on screen
    if (!('IntersectionObserver' in window)) return;
    var links = $all('.main-nav a');
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        if (map[en.target.id]) map[en.target.id].classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* =====================================================================
     Animations: reveal on scroll + counters
     ===================================================================== */
  function initReveal() {
    var items = $all('[data-reveal]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        el.classList.add('is-visible');
        // Hand control back to the element's own hover transitions once the entrance is done
        var delay = (parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0) * 90;
        setTimeout(function () { el.removeAttribute('data-reveal'); el.classList.remove('is-visible'); }, delay + 800);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  function initCounters() {
    var els = $all('.js-count');
    var fmt = function (n) { return n.toLocaleString('en-US'); };
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, end = parseInt(el.getAttribute('data-count'), 10), start = null, dur = 1600;
        var step = function (ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(Math.round(end * eased));
          if (p < 1) requestAnimationFrame(step);
        };
        el.textContent = '0';
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* =====================================================================
     "Open now" status (Pakistan time)
     ===================================================================== */
  function karachiNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi', weekday: 'short', hour: 'numeric', hour12: false
      }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[o.weekday], hour: parseInt(o.hour, 10) % 24 };
    } catch (e) {
      var d = new Date(); return { day: d.getDay(), hour: d.getHours() };
    }
  }
  function updateOpenStatus() {
    var el = document.querySelector('.js-open-status');
    if (!el) return;
    var now = karachiNow(), h = CONFIG.HOURS;
    var closedToday = h.closedDays.indexOf(now.day) !== -1;
    var open = !closedToday && now.hour >= h.open && now.hour < h.close;
    var key;
    if (open) key = 'openNow';
    else if (!closedToday && now.hour < h.open) key = 'closedOpensToday';
    else if (closedToday || now.day === 6) key = 'closedOpensMonday';
    else key = 'closedOpensTomorrow';
    el.classList.toggle('is-open', open);
    el.querySelector('.txt').textContent = t(key);
  }

  /* =====================================================================
     Tracking + source attribution
     ===================================================================== */
  function captureSource() {
    if (sGet('aa_source')) return;
    var p = new URLSearchParams(location.search);
    var src = p.get('utm_source');
    if (!src && p.get('gclid')) src = 'google-ads';
    if (!src && p.get('fbclid')) src = 'facebook';
    if (!src && document.referrer) {
      try {
        var host = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (host !== location.hostname) src = host;
      } catch (e) { /* ignore */ }
    }
    var campaign = p.get('utm_campaign');
    sSet('aa_source', (src || 'direct') + (campaign ? ' / ' + campaign : ''));
  }
  function getSource() { return sGet('aa_source') || 'direct'; }

  function track(event, params) {
    params = params || {};
    params.lead_source = getSource();
    if (typeof window.gtag === 'function') window.gtag('event', event, params);
    if (typeof window.fbq === 'function') {
      if (event === 'lead_submit') window.fbq('track', 'Lead', params);
      else if (event === 'call_click' || event === 'whatsapp_click') window.fbq('track', 'Contact', params);
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: event }, params));
  }

  function initClickTracking() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-track]');
      if (el) track(el.getAttribute('data-track'));
    });
  }

  /* =====================================================================
     WhatsApp
     ===================================================================== */
  function waUrl(text) {
    return 'https://wa.me/' + CONFIG.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
  }
  function openWhatsApp(text) {
    var url = waUrl(text);
    var win = window.open(url, '_blank', 'noopener');
    if (!win) location.href = url;
  }
  function updateWhatsAppLinks() {
    var msg = t('waGeneral') + ' (' + getSource() + ')';
    $all('.js-wa-link').forEach(function (a) { a.href = waUrl(msg); });
  }

  /* =====================================================================
     Lead forms
     ===================================================================== */
  // Pakistani mobile: 03XX-XXXXXXX, +92 3XX…, 92 3XX…, 0092 3XX…
  function normalisePkMobile(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.indexOf('0092') === 0) d = d.slice(4);
    else if (d.indexOf('92') === 0) d = d.slice(2);
    else if (d.indexOf('0') === 0) d = d.slice(1);
    return /^3\d{9}$/.test(d) ? '0' + d.slice(0, 3) + '-' + d.slice(3) : null;
  }
  /* ---------- Phone mask: always shows 03XX-XXXXXXX while typing ---------- */
  function maskPkMobile(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.indexOf('0092') === 0) d = '0' + d.slice(4);
    else if (d.indexOf('92') === 0 && d.length > 2) d = '0' + d.slice(2);
    else if (d.charAt(0) === '3') d = '0' + d;
    d = d.slice(0, 11);
    return d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d;
  }

  function initPhoneMask(input) {
    input.setAttribute('maxlength', '12');
    input.setAttribute('autocomplete', 'tel-national');

    function apply() {
      var pos = input.selectionStart;
      var atEnd = pos === input.value.length;
      var digitsBefore = input.value.slice(0, pos).replace(/\D/g, '').length;
      var masked = maskPkMobile(input.value);
      if (masked !== input.value) {
        input.value = masked;
        // keep the caret after the same number of digits it was after before
        var newPos = masked.length;
        if (!atEnd) {
          var seen = 0;
          for (var i = 0; i < masked.length; i++) {
            if (seen === digitsBefore) { newPos = i; break; }
            if (/\d/.test(masked[i])) seen++;
          }
        }
        try { input.setSelectionRange(newPos, newPos); } catch (e) { /* ignore */ }
      }
      input.setCustomValidity('');
      input.classList.toggle('is-complete', normalisePkMobile(masked) !== null);
    }

    // Backspace right after the dash deletes the digit before it, instead of getting stuck
    input.addEventListener('keydown', function (e) {
      var p = input.selectionStart;
      if (e.key === 'Backspace' && p === input.selectionEnd && p > 0 && input.value.charAt(p - 1) === '-') {
        e.preventDefault();
        input.value = input.value.slice(0, p - 2) + input.value.slice(p);
        try { input.setSelectionRange(p - 2, p - 2); } catch (err) { /* ignore */ }
        apply();
      }
    });
    input.addEventListener('input', apply);
    if (input.value) apply();
  }

  /* ---------- Day picker: next working days as tappable cards ---------- */
  var DAYS_TO_SHOW = 12;
  var LAST_SAME_DAY_HOUR = 17; // after 5pm, don't offer "today"

  function karachiDateParts() {
    var iso = todayISO().split('-');
    return { y: +iso[0], m: +iso[1], d: +iso[2] };
  }

  function renderDayPicker(picker) {
    var list = picker.querySelector('.day-list');
    var checked = list.querySelector('input:checked');
    var keep = checked ? checked.value : null;
    var name = picker.getAttribute('data-name') || 'date';
    var loc = lang() === 'en' ? 'en-GB' : 'ur-PK';
    var wk = new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' });
    var mo = new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' });
    var labels = lang() === 'en' ? { today: 'Today', tomorrow: 'Tomorrow' } : { today: 'آج', tomorrow: 'کل' };

    var t0 = karachiDateParts();
    var now = karachiNow();
    var base = Date.UTC(t0.y, t0.m - 1, t0.d, 12);
    var html = '';
    var shown = 0;
    for (var i = 0; shown < DAYS_TO_SHOW && i < 40; i++) {
      var dt = new Date(base + i * 864e5);
      if (CONFIG.HOURS.closedDays.indexOf(dt.getUTCDay()) !== -1) continue;
      if (i === 0 && now.hour >= LAST_SAME_DAY_HOUR) continue;
      var value = dt.toISOString().slice(0, 10);
      var top = i === 0 ? labels.today : i === 1 ? labels.tomorrow : wk.format(dt);
      var id = picker.id + '-' + value;
      html += '<input type="radio" class="day-radio" name="' + name + '" id="' + id + '" value="' + value + '" required' +
        (value === keep ? ' checked' : '') + '>' +
        '<label class="day-card" for="' + id + '">' +
        '<span class="day-top">' + top + '</span>' +
        '<span class="day-num">' + dt.getUTCDate() + '</span>' +
        '<span class="day-month">' + mo.format(dt) + '</span>' +
        '</label>';
      shown++;
    }
    list.innerHTML = html;
    updateDayArrows(picker);
  }

  function updateDayArrows(picker) {
    var list = picker.querySelector('.day-list');
    var max = list.scrollWidth - list.clientWidth;
    var pos = Math.abs(list.scrollLeft); // RTL scrollLeft is negative
    picker.classList.toggle('can-prev', pos > 4);
    picker.classList.toggle('can-next', pos < max - 4);
  }

  function initDayPickers() {
    $all('.js-day-picker').forEach(function (picker) {
      var list = picker.querySelector('.day-list');
      renderDayPicker(picker);
      list.addEventListener('scroll', function () { updateDayArrows(picker); }, { passive: true });
      window.addEventListener('resize', function () { updateDayArrows(picker); });
      $all('.day-arrow', picker).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var dir = btn.classList.contains('is-next') ? 1 : -1;
          var rtl = root.dir === 'rtl' ? -1 : 1;
          list.scrollBy({ left: dir * rtl * list.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
      });
      // Re-render day/month names when the language changes
      document.addEventListener('aa:lang', function () { renderDayPicker(picker); });
      // Recalculate arrows once the modal is visible (sizes are 0 while hidden)
      var modal = picker.closest('.modal');
      if (modal) modal.addEventListener('shown.bs.modal', function () { updateDayArrows(picker); });
    });
  }

  function labelFor(form, name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    if (!el) return '';
    var lab = form.querySelector('label[for="' + el.id + '"]');
    if (!lab) return el.value;
    var parts = $all('span, small', lab).map(function (c) { return c.textContent.trim(); }).filter(Boolean);
    return (parts.length ? parts.join(' ') : lab.textContent).replace(/\s+/g, ' ').trim();
  }

  // Today's date in Pakistan as YYYY-MM-DD
  function todayISO() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
    } catch (e) {
      var d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 10);
    }
  }
  function prettyDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function buildMessage(form, data) {
    var lines = [form === 'appointment' ? t('waAppointment') : t('waQuote'), ''];
    lines.push(t('name') + ': ' + data.name);
    lines.push(t('phone') + ': ' + data.phone);
    if (data.serviceLabel) lines.push(t('service') + ': ' + data.serviceLabel);
    if (data.vehicle) lines.push(t('car') + ': ' + data.vehicle);
    if (data.date) lines.push(t('date') + ': ' + prettyDate(data.date) + (data.dateLabel ? ' (' + data.dateLabel + ')' : ''));
    if (data.timeLabel) lines.push(t('time') + ': ' + data.timeLabel);
    if (data.message) lines.push(t('issue') + ': ' + data.message);
    lines.push('');
    lines.push('(' + t('via') + ' – ' + data.source + ')');
    return lines.join('\n');
  }

  function saveLead(data) {
    if (!CONFIG.LEAD_ENDPOINT) return;
    try {
      fetch(CONFIG.LEAD_ENDPOINT, {
        method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      }).catch(function () { /* WhatsApp is the primary channel */ });
    } catch (e) { /* ignore */ }
  }

  function initForms() {
    $all('.js-lead-form').forEach(function (form) {
      var phone = form.querySelector('[name="phone"]');
      if (phone) initPhoneMask(phone);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var normalised = phone ? normalisePkMobile(phone.value) : null;
        if (phone) phone.setCustomValidity(normalised ? '' : 'invalid');

        if (!form.checkValidity()) {
          form.classList.add('was-validated');
          var bad = form.querySelector(':invalid');
          if (bad) bad.focus();
          return;
        }

        var fd = new FormData(form);
        var select = form.querySelector('[name="service"]');
        var data = {
          form: form.getAttribute('data-form'),
          name: String(fd.get('name') || '').trim(),
          phone: normalised,
          service: String(fd.get('service') || ''),
          serviceLabel: select && select.value ? select.options[select.selectedIndex].textContent.trim() : '',
          vehicle: String(fd.get('vehicle') || '').trim(),
          date: String(fd.get('date') || ''),
          dateLabel: labelFor(form, 'date').replace(/\s*\d+.*$/, ''), // e.g. "Tomorrow" / "Mon"
          time: String(fd.get('time') || ''),
          timeLabel: labelFor(form, 'time'),
          message: String(fd.get('message') || '').trim(),
          language: lang(),
          source: getSource(),
          page: location.href,
          submitted_at: new Date().toISOString()
        };

        saveLead(data);
        track('lead_submit', { form: data.form, service: data.service });
        sSet('aa_lead_sent', '1');
        openWhatsApp(buildMessage(data.form, data));

        var ok = form.querySelector('.form-success');
        if (ok) { ok.classList.remove('d-none'); ok.classList.add('pop-in'); }
        form.classList.remove('was-validated');
      });

      // Clear the error styling as soon as the visitor fixes a field
      form.addEventListener('change', function () {
        if (form.classList.contains('was-validated') && form.checkValidity()) form.classList.remove('was-validated');
      });
    });
  }

  /* Pre-select the service when a "Book" button on a service/offer card opens the modal */
  function initServicePreselect() {
    var select = document.getElementById('apptService');
    if (!select) return;
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-bs-target="#appointmentModal"]');
      if (!btn) return;
      var key = btn.getAttribute('data-service');
      if (key) select.value = key;
    });
  }

  /* =====================================================================
     Booking popup: once per visit, only after real interest
     ===================================================================== */
  function initPopup() {
    var modalEl = document.getElementById('appointmentModal');
    if (!modalEl || !window.bootstrap) return;

    modalEl.addEventListener('show.bs.modal', function () {
      sSet('aa_popup_shown', '1');
      track('booking_open');
    });

    var timer;
    function maybeShow() {
      if (sGet('aa_popup_shown') || sGet('aa_lead_sent')) return cleanup();
      if (document.querySelector('.modal.show') || root.classList.contains('menu-open')) return;
      if (toast && !toast.hidden) return; // don't stack on top of the language toast
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
      cleanup();
    }
    function onScroll() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= CONFIG.POPUP_SCROLL_RATIO) maybeShow();
    }
    function onExit(e) { if (e.clientY <= 0 && !e.relatedTarget) maybeShow(); }
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onExit);
    }
    timer = setTimeout(maybeShow, CONFIG.POPUP_DELAY_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
    if (window.matchMedia('(pointer: fine)').matches) document.addEventListener('mouseout', onExit);
  }

  /* ===================================================================== */
  function init() {
    captureSource();
    initLanguage();
    initToast();
    initHeader();
    initReveal();
    initCounters();
    initClickTracking();
    initDayPickers();
    initForms();
    initServicePreselect();
    initPopup();
    setInterval(updateOpenStatus, 60000);
    root.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
