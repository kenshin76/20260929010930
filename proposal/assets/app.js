/* ==========================================================================
   웹 제안서 인터랙션 — 스타일.md §13.6 모션 규격
   외부 의존성 없음. 모든 모션은 prefers-reduced-motion에서 확정 상태로 정지.
   ========================================================================== */
(function () {
  'use strict';

  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- 1. 테마 3상태 : 시스템 → 라이트 → 다크 --------------------------- */
  var ORDER = ['system', 'light', 'dark'];
  var ICON = { system: 'M12 3a9 9 0 0 0 0 18z', light: '', dark: 'FILL' };

  function readTheme() {
    try { return localStorage.getItem('wp-theme') || 'system'; } catch (e) { return 'system'; }
  }
  function writeTheme(v) {
    try { localStorage.setItem('wp-theme', v); } catch (e) { /* private mode */ }
  }
  function applyTheme(v) {
    var r = document.documentElement;
    if (v === 'system') r.removeAttribute('data-theme');
    else r.setAttribute('data-theme', v);
    var b = $('#theme');
    if (!b) return;
    var lab = { system: '시스템', light: '라이트', dark: '다크' }[v];
    b.setAttribute('aria-label', '색 테마: ' + lab + ' (클릭해 전환)');
    b.setAttribute('title', '색 테마 — ' + lab);
    var c = $('.th-m', b);
    if (c) {
      c.setAttribute('fill', v === 'dark' ? 'currentColor' : 'none');
      c.setAttribute('d', v === 'light' ? 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18'
        : 'M12 3a9 9 0 0 0 0 18z');
    }
    var t = $('.th-t', b);
    if (t) t.textContent = lab;
  }
  var theme = readTheme();
  applyTheme(theme);
  var themeBtn = $('#theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      theme = ORDER[(ORDER.indexOf(theme) + 1) % 3];
      writeTheme(theme);
      applyTheme(theme);
    });
  }

  /* ---- 2. 스크롤 리빌 --------------------------------------------------- */
  var revealed = 0;
  function settleAll() {
    $$('.rv').forEach(function (el) { el.classList.add('in'); });
    $$('[data-to]').forEach(function (el) { el.textContent = fmt(el); });
  }
  if (RM || !('IntersectionObserver' in window)) {
    settleAll();
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, d = parseInt(el.getAttribute('data-d') || '0', 10);
        setTimeout(function () { el.classList.add('in'); revealed++; countIn(el); }, d);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.04 });
    $$('.rv').forEach(function (el) { io.observe(el); });
  }

  /* ---- 3. 숫자 카운터 --------------------------------------------------- */
  function fmt(el) {
    var to = parseFloat(el.getAttribute('data-to'));
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    var s = to.toFixed(dec);
    if (el.getAttribute('data-sep') !== 'no') {
      var p = s.split('.');
      p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      s = p.join('.');
    }
    return (el.getAttribute('data-pre') || '') + s + (el.getAttribute('data-suf') || '');
  }
  function fmtAt(el, v) {
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    var s = v.toFixed(dec);
    if (el.getAttribute('data-sep') !== 'no') {
      var p = s.split('.');
      p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      s = p.join('.');
    }
    return (el.getAttribute('data-pre') || '') + s + (el.getAttribute('data-suf') || '');
  }
  function countIn(scope) {
    var list = scope.hasAttribute && scope.hasAttribute('data-to')
      ? [scope] : $$('[data-to]', scope);
    list.forEach(function (el) {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      var to = parseFloat(el.getAttribute('data-to'));
      if (RM) { el.textContent = fmt(el); return; }
      var t0 = null, DUR = 1100;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / DUR);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmtAt(el, to * e);
        if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(el);
      }
      requestAnimationFrame(step);
    });
  }

  /* ---- 4. 간트 순차 지연 ------------------------------------------------ */
  $$('.g-bar').forEach(function (b, i) { b.style.setProperty('--dl', (i * 0.11) + 's'); });

  /* ---- 5. 탭 ------------------------------------------------------------ */
  $$('.tabs').forEach(function (tabs) {
    var btns = $$('.tab-b button', tabs), pans = $$('.tab-p', tabs);
    function sel(i) {
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      pans.forEach(function (p, j) { p.classList.toggle('on', j === i); });
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { sel(i); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + btns.length) % btns.length;
        btns[n].focus(); sel(n);
      });
    });
    sel(0);
  });

  /* ---- 6. 상단 바 · 진행 바 · 스크롤스파이 · 맨 위로 -------------------- */
  var topbar = $('#topbar'), prog = $('#prog'), totop = $('#totop'),
    hero = $('#hero'), navLinks = $$('.tb-nav a'),
    secs = navLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var lastY = window.pageYOffset, ticking = false;

  function onScroll() {
    var y = window.pageYOffset;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (prog) prog.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + '%';

    if (topbar && hero) {
      var hb = hero.offsetHeight;
      var past = y > hb * 0.62;
      var up = y < lastY;
      topbar.classList.toggle('show', past && (up || y > hb));
    }
    if (totop) totop.classList.toggle('show', y > 900);

    var cur = -1;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i] && secs[i].getBoundingClientRect().top <= 92) cur = i;
    }
    navLinks.forEach(function (a, i) { a.classList.toggle('on', i === cur); });

    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  if (totop) totop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
  });

  /* ---- 7. 인쇄 : 리빌·카운터·바를 확정 상태로 --------------------------- */
  function beforePrint() {
    settleAll();
    $$('[data-to]').forEach(function (el) { el.textContent = fmt(el); });
  }
  var printBtn = $('#print');
  if (printBtn) printBtn.addEventListener('click', function () {
    beforePrint();
    setTimeout(function () { window.print(); }, 60);
  });
  window.addEventListener('beforeprint', beforePrint);
  if (window.matchMedia) {
    var mq = window.matchMedia('print');
    if (mq.addEventListener) mq.addEventListener('change', function (e) { if (e.matches) beforePrint(); });
  }

  /* ---- 8. 자가 점검용 훅 (자동 검증 스크립트가 읽는다) ------------------ */
  window.__wp = {
    reveals: function () { return { total: $$('.rv').length, pending: $$('.rv:not(.in)').length }; },
    settle: settleAll,
    theme: applyTheme
  };
})();
