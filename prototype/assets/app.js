/* ==========================================================================
   B2B 포털 셸 — 라우터 · 세션 · 공통 UI · 체험 가이드
   외부 의존성 없음.
   ========================================================================== */
(function (global) {
  'use strict';

  var APP = {
    routes: [], screens: {}, session: null, params: {}, path: '/',
    navOpen: false, scroll: {},
  };

  /* ----------------------------------------------------------- 유틸 */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  var ICON = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
    box: 'M3 8.5 12 4l9 4.5v7L12 20l-9-4.5zM3 8.5 12 13m0 0 9-4.5M12 13v7',
    cart: 'M3 4h2.2l2.1 10.4A2 2 0 0 0 9.3 16h8.2a2 2 0 0 0 2-1.6L21 8H6M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2m8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
    doc: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zm0 0v4h4M9 12h6M9 16h6',
    truck: 'M3 6h11v10H3zm11 4h4l3 3v3h-7zM7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-7 8a7 7 0 0 1 14 0',
    bell: 'M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M13.7 20a2 2 0 0 1-3.4 0',
    chat: 'M20 14a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z',
    grid: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
    tag: 'm3 12 8.6-8.6a2 2 0 0 1 1.4-.6H20a1 1 0 0 1 1 1v7a2 2 0 0 1-.6 1.4L12 21zM17 7h.01',
    chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
    up: 'M12 19V5m-7 7 7-7 7 7',
    check: 'm5 13 4 4L19 7',
    x: 'M6 6l12 12M18 6 6 18',
    alert: 'M12 8v5m0 3h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
    info: 'M12 16v-5m0-3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5.5-1.5L21 21',
    back: 'M19 12H5m7-7-7 7 7 7',
    plus: 'M12 5v14M5 12h14',
    clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
    shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z M9 12l2 2 4-4',
    excel: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zm0 0v4h4M9 13l6 5m0-5-6 5',
    menu: 'M4 7h16M4 12h16M4 17h16',
    sun: 'M12 5v-2m0 18v-2m7-7h2M3 12h2m11.5-5.5 1.5-1.5M6 18l-1.5 1.5m0-15L6 6m10.5 12 1.5 1.5M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8',
    layer: 'm12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
    money: 'M3 6h18v12H3zm9 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4M6 9h.01M18 15h.01',
    inbox: 'M3 12h5l2 3h4l2-3h5M5 5h14l2 7v7H3v-7z',
  };
  function ic(n, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICON[n] + '"/></svg>'; }

  var CAT_TONE = { c1: ['#FFF1DC', '#8A5A12'], c2: ['#DFF5F2', '#0A6A60'], c3: ['#E4EDFF', '#22409C'], c4: ['#EFE9FE', '#4C33A8'] };
  var CAT_TONE_D = { c1: ['#3A2D18', '#F0C77E'], c2: ['#14332F', '#79E2D6'], c3: ['#1B274A', '#A9C1FF'], c4: ['#2A2247', '#C6B6FF'] };
  var SUB_IMAGE = {
    c1a: 'assets/images/category-packaging.jpg',
    c1b: 'assets/images/subcategory-packing-tape.jpg',
    c2a: 'assets/images/category-hygiene.jpg',
    c2b: 'assets/images/subcategory-sanitation.jpg',
    c3a: 'assets/images/category-disposable.jpg',
    c3b: 'assets/images/subcategory-cutlery.jpg',
    c4a: 'assets/images/category-cleaning.jpg',
    c4b: 'assets/images/subcategory-cleaning-tools.jpg',
  };
  var PRODUCT_IMAGE = {
    p1: 'assets/images/product-shipping-box.jpg',
    p2: 'assets/images/product-shipping-box.jpg',
    p3: 'assets/images/product-bubble-wrap.jpg',
    p4: 'assets/images/product-paper-cushioning.jpg',
    p11: 'assets/images/product-kf94-mask.jpg',
    p12: 'assets/images/product-hand-sanitizer.jpg',
    p16: 'assets/images/product-meal-container.jpg',
  };
  function tone(catId) {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return (dark ? CAT_TONE_D : CAT_TONE)[catId] || ['#EFF3F9', '#475569'];
  }
  function thumb(p, tag) {
    var t = tone(p.cat);
    return '<div class="thumb" style="--ph-bg:' + t[0] + ';--ph-fg:' + t[1] + '">' +
      (tag ? '<span class="tag">' + tag + '</span>' : '') +
      '<img src="' + (PRODUCT_IMAGE[p.id] || SUB_IMAGE[p.sub]) + '" alt="" loading="lazy" decoding="async">' +
      '<span class="code">' + esc(p.code) + '</span></div>';
  }

  /* ----------------------------------------------------- 토스트·모달 */
  function toast(msg, kind, sub) {
    var w = $('#toasts'); if (!w) return;
    var d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.innerHTML = '<div style="flex:1 1 auto;min-width:0"><b>' + esc(msg) + '</b>' +
      (sub ? '<div class="m">' + esc(sub) + '</div>' : '') + '</div>';
    w.appendChild(d);
    setTimeout(function () {
      d.style.transition = 'opacity .3s, transform .3s';
      d.style.opacity = '0'; d.style.transform = 'translateX(18px)';
      setTimeout(function () { d.remove(); }, 320);
    }, kind === 'dg' ? 5200 : 3400);
  }

  /* 라벨 연결 — .fr / .fbar 안의 <label> 을 같은 블록의 컨트롤과 묶는다.
     화면마다 for/id 를 손으로 맞추는 대신 한 곳에서 보장한다. */
  var autoId = 0;
  function linkLabels(scope) {
    $$('label:not([for])', scope || document).forEach(function (lb) {
      if (lb.querySelector('input,select,textarea')) return;   // <label> 이 컨트롤을 감싼 경우
      var box = lb.closest('.fr') || lb.parentNode;
      var c = box && box.querySelector('input:not([type="checkbox"]):not([type="radio"]),select,textarea');
      if (!c) return;
      if (!c.id) c.id = 'fld-' + (++autoId);
      lb.setAttribute('for', c.id);
    });
    // 보이는 라벨이 전혀 없는 컨트롤에는 접근 가능한 이름을 붙인다
    $$('input:not([type="hidden"]):not([type="radio"]),select,textarea', scope || document).forEach(function (c) {
      if (c.getAttribute('aria-label') || c.getAttribute('aria-labelledby')) return;
      if (c.id && document.querySelector('label[for="' + c.id + '"]')) return;
      if (c.closest('label')) return;
      var ph2 = c.getAttribute('placeholder');
      if (ph2) c.setAttribute('aria-label', ph2);
    });
  }
  APP.linkLabels = linkLabels;

  var modalStack = [], modalSeq = 0;
  function modal(opt) {
    var root = $('#modal-root');
    var m = document.createElement('div');
    var tid = 'mt' + (++modalSeq);
    m.className = 'mask';
    m.__opener = document.activeElement;
    m.innerHTML =
      '<div class="modal ' + (opt.size || '') + '" role="dialog" aria-modal="true" aria-labelledby="' + tid + '" tabindex="-1">' +
        '<div class="modal-h"><h3 id="' + tid + '">' + esc(opt.title) + '</h3>' +
          '<button class="x" data-mclose="1" aria-label="닫기">' + ic('x') + '</button></div>' +
        '<div class="modal-b">' + opt.body + '</div>' +
        (opt.foot === null ? '' : '<div class="modal-f">' + (opt.foot ||
          '<button class="btn" data-mclose="1">닫기</button>') + '</div>') +
      '</div>';
    root.appendChild(m);
    modalStack.push(m);
    document.getElementById('app').setAttribute('aria-hidden', 'true');
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
    m.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', m)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    linkLabels(m);
    if (opt.onOpen) opt.onOpen(m);
    var focusTarget = $('.modal-b input,.modal-b select,.modal-b textarea', m) ||
      $('.modal-f .btn.p', m) || $('.modal', m);
    if (focusTarget) setTimeout(function () { try { focusTarget.focus(); } catch (x) {} }, 20);
    return m;
  }
  function closeModal() {
    var m = modalStack.pop();
    if (!m) return;
    var op = m.__opener;
    m.remove();
    if (!modalStack.length) document.getElementById('app').removeAttribute('aria-hidden');
    if (op && document.contains(op)) { try { op.focus(); } catch (x) {} }
  }
  function closeAllModals() {
    while (modalStack.length) modalStack.pop().remove();
    var ap = document.getElementById('app'); if (ap) ap.removeAttribute('aria-hidden');
  }
  function confirmBox(title, body, okLabel, onOk, kind) {
    modal({
      title: title, body: body,
      foot: '<button class="btn" data-mclose="1">취소</button>' +
            '<button class="btn ' + (kind || 'p') + '" data-ok="1">' + esc(okLabel) + '</button>',
      onOpen: function (m) {
        m.querySelector('[data-ok]').addEventListener('click', function () {
          var keep = onOk(m) === false;   // 콜백이 false 를 돌려주면 모달을 닫지 않는다
          if (!keep) closeModal();
        });
      },
    });
  }

  /* ---------------------------------------------------------- 세션 */
  var ACCOUNTS = [];
  function buildAccounts() {
    ACCOUNTS = DB.partners.map(function (b) {
      return { kind: 'partner', partner: b.id, label: b.name, sub: b.mgr + ' · ' + b.biz,
        status: b.status, gradeName: (DB.gradeOf(b.id) || {}).name };
    }).concat(DB.admins.map(function (a) {
      return { kind: 'admin', admin: a.id, label: a.name, sub: a.role + ' · ' + a.loginId, role: a.role };
    }));
  }
  function login(acc) {
    APP.session = acc;
    if (acc.kind === 'admin') { var a = DB.admins.filter(function (x) { return x.id === acc.admin; })[0];
      a.last = DB.today() + ' ' + new Date().toTimeString().slice(0, 5); }
    DB.log(acc.label, '로그인', acc.kind === 'admin' ? acc.role : (acc.status + ' 거래처'));
  }
  function logout() { APP.session = null; go(APP.isAdminPath() ? '/a/login' : '/login'); }
  function can(perm) {
    if (!APP.session) return false;
    if (APP.session.kind === 'admin') return (DB.ROLE_PERMS[APP.session.role] || []).indexOf(perm) >= 0;
    var g = DB.gradeOf(APP.session.partner);
    return g ? g.perms.indexOf(perm) >= 0 : false;
  }
  function approved() {
    return APP.session && APP.session.kind === 'partner' &&
      DB.partner(APP.session.partner).status === '승인';
  }
  /** 세션은 id 만 신뢰하고 표시값은 언제나 DB 에서 다시 읽는다 */
  function sessionView() {
    var s = APP.session; if (!s) return null;
    if (s.kind === 'admin') {
      var a = DB.admins.filter(function (x) { return x.id === s.admin; })[0] || {};
      return { kind: 'admin', label: a.name || s.label, role: a.role || s.role };
    }
    var b = DB.partner(s.partner) || {};
    return { kind: 'partner', label: b.name || s.label, status: b.status || s.status,
      gradeName: (DB.gradeOf(s.partner) || {}).name || s.gradeName };
  }

  /* --------------------------------------------------------- 라우터 */
  function route(pattern, def) {
    var keys = [];
    var rx = new RegExp('^' + pattern.replace(/:([A-Za-z]+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '$');
    APP.routes.push({ pattern: pattern, rx: rx, keys: keys, def: def });
    APP.screens[def.id] = def;
    def.path = pattern;
  }
  function match(path) {
    for (var i = 0; i < APP.routes.length; i++) {
      var m = path.match(APP.routes[i].rx);
      if (m) {
        var p = {};
        APP.routes[i].keys.forEach(function (k, j) { p[k] = decodeURIComponent(m[j + 1]); });
        return { r: APP.routes[i], params: p };
      }
    }
    return null;
  }
  function go(path, replace) {
    if (!replace) APP.scroll[APP.path] = window.scrollY;
    closeAllModals();
    var target = '#' + path;
    if (location.hash === target) { render(); return; }   // 같은 해시면 hashchange 가 없으므로 직접 렌더
    if (replace) location.replace(target); else location.hash = target;
    // 그 외에는 hashchange 핸들러가 한 번만 렌더한다
  }
  APP.isAdminPath = function () { return APP.path.indexOf('/a') === 0; };

  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?');
    var q = {};
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        var a = kv.split('='); if (a[0]) q[a[0]] = decodeURIComponent(a[1] || '');
      });
      h = h.slice(0, qi);
    }
    return { path: h, query: q };
  }

  /* ----------------------------------------------------------- 셸 */
  function navUser() {
    var cartN = approved() ? DB.cart(APP.session.partner).length : 0;
    var qN = approved() ? DB.quotes.filter(function (q) { return q.partner === APP.session.partner && q.status === '발송 완료' && !q.converted; }).length : 0;
    var g = [
      { t: '쇼핑', items: [
        { p: '/', i: 'home', n: '홈' },
        { p: '/products', i: 'box', n: '상품 목록' },
        { p: '/bulk', i: 'grid', n: '대량 담기', k: 'bulk' },
        { p: '/cart', i: 'cart', n: '장바구니', b: cartN, k: 'order' },
      ] },
      { t: '견적 · 주문', items: [
        { p: '/quote/new', i: 'plus', n: '견적 요청', k: 'quote' },
        { p: '/quotes', i: 'doc', n: '견적 목록', b: qN, bc: 'q', k: 'quote' },
        { p: '/orders', i: 'money', n: '주문 목록', k: 'order' },
        { p: '/shipping', i: 'truck', n: '배송 현황' },
      ] },
      { t: '지원', items: [
        { p: '/mypage', i: 'user', n: '마이페이지' },
        { p: '/notice', i: 'bell', n: '공지 · FAQ' },
        { p: '/inquiries', i: 'chat', n: '문의 목록' },
      ] },
    ];
    return navHtml(filterByPerm(g));
  }
  function navAdmin() {
    var waitN = DB.partners.filter(function (b) { return b.status === '대기'; }).length;
    var payN = DB.orders.filter(function (o) { return o.status === '결제대기'; }).length;
    var qN = DB.quotes.filter(function (q) { return q.status === '요청'; }).length;
    var clN = DB.orders.reduce(function (a, o) { return a + o.claims.filter(function (c) { return c.status === '요청'; }).length; }, 0);
    var inqN = DB.inquiries.filter(function (q) { return q.status === '접수'; }).length;
    var g = [
      { t: '운영', items: [
        { p: '/a', i: 'chart', n: '대시보드' },
        { p: '/a/orders', i: 'money', n: '주문 관리', k: 'order' },
        { p: '/a/payments', i: 'inbox', n: '입금 확인', b: payN, bc: 'q', k: 'order' },
        { p: '/a/ship', i: 'truck', n: '배송 · 송장', k: 'ship' },
        { p: '/a/claims', i: 'alert', n: '취소 · 반품', b: clN, k: 'order' },
        { p: '/a/quotes', i: 'doc', n: '견적 관리', b: qN, bc: 'q', k: 'order' },
      ] },
      { t: '거래처 · 상품', items: [
        { p: '/a/members', i: 'user', n: '회원 승인', b: waitN, k: 'member' },
        { p: '/a/partners', i: 'shield', n: '거래처 관리', k: 'member' },
        { p: '/a/prices', i: 'tag', n: '거래처별 단가', k: 'price' },
        { p: '/a/goods', i: 'box', n: '상품 관리', k: 'goods' },
        { p: '/a/stock', i: 'layer', n: '카테고리 · 재고', k: 'goods' },
      ] },
      { t: '분석 · 콘텐츠', items: [
        { p: '/a/stats', i: 'chart', n: '통계', k: 'stat' },
        { p: '/a/excel', i: 'excel', n: '엑셀 업로드 센터', k: ['goods', 'ship', 'order'] },
        { p: '/a/noti', i: 'bell', n: '알림 발송 이력', k: 'content' },
        { p: '/a/content', i: 'chat', n: '콘텐츠 관리', b: inqN, bc: 'q', k: 'content' },
        { p: '/a/banner', i: 'grid', n: '배너 관리', k: 'content' },
        { p: '/a/accounts', i: 'lock', n: '관리자 계정 · 권한', k: 'account' },
      ] },
    ];
    return navHtml(filterByPerm(g));
  }
  /** 권한 코드가 붙은 메뉴는 그 코드를 가진 계정에게만 보인다 — 화면과 API 에 같은 코드를 쓴다 */
  function filterByPerm(groups) {
    return groups.map(function (g) {
      return { t: g.t, items: g.items.filter(function (it) {
        if (!it.k) return true;
        var ks = [].concat(it.k);
        return ks.some(function (k) { return can(k); });
      }) };
    }).filter(function (g) { return g.items.length; });
  }
  function navHtml(groups) {
    return groups.map(function (g) {
      return '<div class="nav-g"><div class="nav-t">' + esc(g.t) + '</div>' +
        g.items.map(function (it) {
          var on = APP.path === it.p || (it.p !== '/' && it.p !== '/a' && APP.path.indexOf(it.p) === 0);
          return '<a href="#' + it.p + '" class="' + (on ? 'on' : '') + '">' + ic(it.i) +
            '<span>' + esc(it.n) + '</span>' +
            (it.b ? '<span class="bdg ' + (it.bc || '') + '">' + it.b + '</span>' : '') + '</a>';
        }).join('') + '</div>';
    }).join('');
  }

  function topbar(isAdmin) {
    var s = sessionView() || APP.session;
    var cartN = (!isAdmin && approved()) ? DB.cart(s.partner).length : 0;
    return '<header class="top">' +
      '<button class="btn gh sm menu-btn" data-act="nav-toggle" aria-label="메뉴">' + ic('menu') + '</button>' +
      '<button class="brand" data-act="goto" data-path="' + (isAdmin ? '/a' : '/') + '">' +
        '<span class="brand-m">HS</span><span>한성상사 ' + (isAdmin ? '관리자' : 'B2B 포털') +
        '<small>' + (isAdmin ? '운영 백오피스' : '거래처 전용 주문·견적') + '</small></span></button>' +
      (isAdmin ? '<div class="top-sp"></div>' :
        '<div class="top-search">' + ic('search') +
        '<input type="search" id="gsearch" placeholder="상품명 · 상품 코드로 검색" ' +
        'value="' + esc(APP.query.q || '') + '" aria-label="상품 검색"></div><div class="top-sp"></div>') +
      '<div class="top-act">' +
        (isAdmin ? '' : '<button class="btn sm" data-act="goto" data-path="/cart" aria-label="장바구니">' + ic('cart') +
          '<span class="lbl nowrap">장바구니</span>' + (cartN ? '<span class="cnt">' + cartN + '</span>' : '') + '</button>') +
        '<a class="btn gh sm home-link" href="../index.html" aria-label="메인으로">' + ic('home') +
          '<span class="lbl">메인으로</span></a>' +
        '<button class="btn gh sm" data-act="theme" aria-label="색 테마 전환">' + ic('sun') + '</button>' +
        '<span class="who"><span class="av ' + (isAdmin ? 'adm' : '') + '">' + esc(s.label.slice(0, 1)) + '</span>' +
          '<b>' + esc(s.label) + '</b><i>' + esc(isAdmin ? s.role : (s.gradeName + ' 등급')) + '</i></span>' +
        '<button class="btn gh sm" data-act="logout" aria-label="로그아웃">' + ic('back') +
          '<span class="lbl">로그아웃</span></button>' +
      '</div></header>';
  }

  /* ------------------------------------------------------- 서비스 체험 가이드 */
  var SCENARIOS = [
    { t: '① 단가를 바꿔도 과거 주문 금액은 그대로', d: '관리자에서 택배박스 1호 기본가를 올린 뒤, 그 전에 들어온 주문을 다시 열어 금액이 변하지 않는 것을 확인합니다.', go: '/a/goods?demo=price' },
    { t: '② 장바구니에 담은 뒤 단가가 바뀌면', d: '장바구니에 담긴 상품의 단가가 바뀌면 주문 전에 변경된 상품과 금액을 확인합니다.', go: '/a/prices?demo=drift' },
    { t: '③ 최소 주문 수량 · 주문 단위 확인', d: '주문 기준에 맞지 않는 수량은 장바구니 담기·주문서 작성·최종 확정 단계에서 각각 안내됩니다.', go: '/product/p1?demo=moq' },
    { t: '④ 견적 → 주문 전환', d: '발송 완료된 견적을 주문으로 전환하면 확정된 품목·수량·금액과 원 견적 번호가 그대로 유지됩니다.', go: '/quotes?demo=convert' },
    { t: '⑤ 다른 거래처의 가격 정보 보호', d: '로그인한 거래처에 적용되는 공급가만 조회할 수 있으며 허용되지 않은 접근은 기록됩니다.', go: '/products?demo=isolate' },
    { t: '⑥ 엑셀 업로드 오류 확인', d: '파일에 오류가 있으면 전체를 반영하지 않고 오류가 있는 행과 사유를 안내합니다.', go: '/a/excel?demo=excel' },
    { t: '⑦ 입금 기한 초과 자동 취소 · 재고 복원', d: '기한이 지난 무통장 주문을 처리하면 주문이 자동 취소되고 재고가 복원됩니다.', go: '/a/payments?demo=deadline' },
    { t: '⑧ 가입 승인 전에는 가격이 보이지 않음', d: '승인 대기 상태의 계정에서는 상품과 거래처 전용 공급가를 조회할 수 없습니다.', go: '/login?demo=pending' },
  ];
  function renderDemo() {
    var b = $('#demo-b'); if (!b) return;
    var acc = ACCOUNTS.map(function (a, i) {
      var cur = APP.session && ((a.kind === 'partner' && APP.session.partner === a.partner) ||
        (a.kind === 'admin' && APP.session.admin === a.admin));
      return '<button class="sc" data-act="switch" data-i="' + i + '"><b>' +
        (cur ? '● ' : '') + esc(a.label) + '</b><span>' + esc(a.sub) +
        (a.kind === 'partner' ? ' · ' + esc(a.status) + (a.gradeName ? ' · ' + esc(a.gradeName) + ' 등급' : '') : '') +
        '</span></button>';
    }).join('');
    b.innerHTML =
      '<div class="clockbar">' + ic('clock') + '<span>업무 기준일</span><b>' + DB.today() + '</b>' +
        '<span class="sp"></span>' +
        '<button class="btn xs" data-act="clock" data-d="1">+1일</button>' +
        '<button class="btn xs" data-act="clock" data-d="3">+3일</button></div>' +
      '<h4>주요 업무 빠르게 살펴보기</h4>' +
      SCENARIOS.map(function (s, i) {
        return '<button class="sc" data-act="scen" data-i="' + i + '"><b>' + esc(s.t) + '</b><span>' + esc(s.d) + '</span></button>';
      }).join('') +
      '<h4>계정 전환</h4>' + acc +
      '<h4>이용 환경 안내</h4>' +
      '<p class="small faint" style="margin:0">현재 데이터는 브라우저에만 보관되며 새로고침하면 초기 상태로 돌아갑니다. ' +
      '결제·메일 전송은 외부로 실행되지 않습니다.</p>';
  }

  /* -------------------------------------------------------- 렌더링 */
  function render() {
    var h = parseHash();
    APP.path = h.path; APP.query = h.query;
    var m = match(h.path);
    if (!m) { go('/', true); return; }
    var def = m.r.def;
    APP.params = m.params;
    APP.current = def;

    // 접근 제어
    var needAdmin = def.area === 'admin', pub = def.pub;
    if (!pub) {
      if (!APP.session) { go(needAdmin ? '/a/login' : '/login', true); return; }
      if (needAdmin && APP.session.kind !== 'admin') { go('/a/login', true); return; }
      if (!needAdmin && APP.session.kind !== 'partner') { go('/login', true); return; }
      if (!needAdmin && !approved() && def.needApproved !== false) { go('/signup-done', true); return; }
      var needPerm = typeof def.perm === 'function' ? def.perm(APP.query || {}) : def.perm;
      // 거래처 등급 권한 — 화면과 API 에 같은 코드를 쓴다
      if (!needAdmin && needPerm && !can(needPerm)) {
        var gg = DB.gradeOf(APP.session.partner) || {};
        $('#app').innerHTML = shellWrap(false,
          '<div class="card"><div class="card-b"><div class="note dg">' + ic('lock') +
          '<div class="bd"><b>이 기능은 현재 등급에서 사용할 수 없습니다</b>' +
          esc(gg.name || '-') + ' 등급에는 「' + esc(DB.PERM_LABEL[needPerm]) + '」 권한이 없습니다. ' +
          '이용 권한은 거래처 등급에 따라 적용됩니다. ' +
          '필요하시면 담당자에게 등급 조정을 문의해 주세요.' +
          '<div class="pills" style="margin-top:8px">' + Object.keys(DB.PERM_LABEL).map(function (k) {
            return '<span class="pill ' + ((gg.perms || []).indexOf(k) >= 0 ? 'k' : '') + '">' +
              ((gg.perms || []).indexOf(k) >= 0 ? '✓ ' : '× ') + esc(DB.PERM_LABEL[k]) + '</span>';
          }).join('') + '</div></div></div>' +
          '<div class="row" style="margin-top:14px"><button class="btn" data-act="goto" data-path="/">홈으로</button>' +
          '<button class="btn p" data-act="goto" data-path="/mypage?tab=perm">내 등급 · 권한 보기</button></div></div></div>');
        afterRender(); return;
      }
      if (needAdmin && needPerm && !can(needPerm)) {
        $('#app').innerHTML = shellWrap(true,
          '<div class="card"><div class="card-b"><div class="note dg">' + ic('lock') +
          '<div class="bd"><b>접근 권한이 없습니다</b>현재 계정(' + esc(APP.session.role) +
          ')에는 「' + esc(DB.ROLE_PERM_LABEL[needPerm]) + '」 권한이 없습니다. ' +
          '권한은 관리자 계정·권한 화면에서 역할별로 관리됩니다.</div></div>' +
          '<div class="row" style="margin-top:14px"><button class="btn" data-act="goto" data-path="/a">대시보드로</button>' +
          '<button class="btn p" data-act="goto" data-path="/a/accounts">권한 확인</button></div></div></div>');
        afterRender(); return;
      }
    }

    document.title = (def.title || '서비스') + ' — 한성상사 B2B 포털';
    var body;
    try {
      body = def.render(APP.params, APP.query) || '';
    } catch (err) {
      body = '<div class="card"><div class="card-b"><div class="note dg">' + ic('alert') +
        '<div class="bd"><b>화면을 그릴 수 없습니다</b>주소의 조건 값이 올바르지 않을 수 있습니다.' +
        '<div class="small faint mono" style="margin-top:6px">' + esc(String(err && err.message || err)) + '</div>' +
        '<div class="row" style="margin-top:10px">' +
        '<button class="btn p" data-act="goto" data-path="' + (needAdmin ? '/a' : '/') + '">처음 화면으로</button>' +
        '</div></div></div></div></div>';
      if (window.console) console.warn('[render]', def.id, err);
    }

    if (def.bare) $('#app').innerHTML = body;
    else $('#app').innerHTML = shellWrap(needAdmin, body);

    afterRender();
    if (def.onMount) def.onMount(APP.params, APP.query);

    var y = APP.scroll[h.path];
    window.scrollTo(0, def.keepScroll ? (y || 0) : 0);
  }
  function shellWrap(isAdmin, body) {
    return topbar(isAdmin) +
      '<div class="shell">' +
        '<nav class="nav' + (APP.navOpen ? ' open' : '') + '" id="nav">' + (isAdmin ? navAdmin() : navUser()) + '</nav>' +
        (APP.navOpen ? '<div class="nav-mask" data-act="nav-toggle"></div>' : '') +
        '<main class="main"><div class="wrap">' + body + '</div></main>' +
      '</div>';
  }
  function afterRender() {
    renderDemo();
    linkLabels(document.getElementById('app'));
    $$('.bar i[data-w]').forEach(function (el) {
      var w = el.getAttribute('data-w');
      requestAnimationFrame(function () { el.style.width = w; el.style.setProperty('--w', w); });
    });
    var gs = $('#gsearch');
    if (gs) gs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') go('/products?q=' + encodeURIComponent(gs.value.trim()));
    });
  }
  APP.rerender = function () { var y = window.scrollY; render(); window.scrollTo(0, y); };

  /* -------------------------------------------------- 이벤트 위임 */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-mclose]');
    if (!t) return;
    var closeAfter = t.hasAttribute('data-mclose');
    var a = t.getAttribute('data-act');
    if (closeAfter && !a) { e.preventDefault(); closeModal(); return; }
    var handled = true;
    switch (a) {
      case 'goto': go(t.getAttribute('data-path')); break;
      case 'back': history.back(); break;
      case 'logout': logout(); break;
      case 'nav-toggle': APP.navOpen = !APP.navOpen; APP.rerender(); break;
      case 'theme': {
        var r = document.documentElement;
        var nx = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        r.setAttribute('data-theme', nx);
        try { localStorage.setItem('pt-theme', nx); } catch (x) { /* private */ }
        APP.rerender();
        break;
      }
      case 'clock': {
        var d = +t.getAttribute('data-d');
        DB.advanceClock(d);
        toast('업무 기준일을 ' + d + '일 앞당겼습니다', 'ac', '현재 ' + DB.today());
        APP.rerender();
        break;
      }
      case 'switch': {
        var acc = ACCOUNTS[+t.getAttribute('data-i')];
        login(acc);
        closeAllModals();
        if (acc.kind === 'admin') go('/a');
        else if (acc.status !== '승인') go('/signup-done');
        else go('/');
        toast(acc.label + ' 계정으로 전환했습니다', 'ok', acc.kind === 'admin' ? acc.role : acc.status + ' 거래처');
        break;
      }
      case 'scen': {
        var s = SCENARIOS[+t.getAttribute('data-i')];
        runScenario(s);
        break;
      }
      case 'demo-toggle': { var dm = $('#demo'); var op = dm.classList.toggle('open');
        $('#demo-h').setAttribute('aria-expanded', op ? 'true' : 'false'); break; }
      default: handled = false;
    }
    if (handled) { if (a !== 'theme' && a !== 'nav-toggle') e.preventDefault(); }
    else if (APP.onAction) APP.onAction(a, t, e);
    if (closeAfter) closeModal();
  });

  /* 입력 요소용 위임 — 클릭이 아닌 change/input 으로 상태를 보존한다 */
  var INPUT_ACTS = ['ck-memo', 'qmemo', 'qdue', 'pick-addr', 'pick-pay'];
  var CHANGE_ONLY = ['pf'];                                 // 화면을 다시 그리는 입력은 change 에서만
  ['change', 'input'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      var a = t.getAttribute('data-act');
      var ok2 = INPUT_ACTS.indexOf(a) >= 0 || (ev === 'change' && CHANGE_ONLY.indexOf(a) >= 0);
      if (!ok2) return;
      if (APP.onAction) APP.onAction(a, t, e);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalStack.length) { e.preventDefault(); closeModal(); }
  });

  /* 체험 시나리오 — 필요한 계정으로 자동 전환한 뒤 해당 화면으로 */
  function runScenario(s) {
    var wantAdmin = s.go.indexOf('/a') === 0;
    var needPending = s.go.indexOf('demo=pending') >= 0;
    if (needPending) {
      login(ACCOUNTS.filter(function (a) { return a.kind === 'partner' && a.status === '대기'; })[0]);
      go('/signup-done');
      toast('승인 대기 계정으로 전환했습니다', 'wn', '상품·가격 조회가 차단된 상태를 확인하세요');
      $('#demo').classList.remove('open'); $('#demo-h').setAttribute('aria-expanded', 'false');
      return;
    }
    if (wantAdmin && (!APP.session || APP.session.kind !== 'admin')) {
      login(ACCOUNTS.filter(function (a) { return a.kind === 'admin' && a.role === '최고관리자'; })[0]);
    }
    if (!wantAdmin && (!APP.session || APP.session.kind !== 'partner' || !approved())) {
      login(ACCOUNTS.filter(function (a) { return a.kind === 'partner' && a.partner === 'b1'; })[0]);
    }
    go(s.go);
    $('#demo').classList.remove('open'); $('#demo-h').setAttribute('aria-expanded', 'false');
    toast(s.t, 'ac', s.d);
  }

  /* ------------------------------------------------------------ 시작 */
  APP.start = function () {
    try {
      var th = localStorage.getItem('pt-theme');
      if (th) document.documentElement.setAttribute('data-theme', th);
    } catch (x) { /* private mode */ }
    buildAccounts();
    var dh = $('#demo-h');
    function demoToggle() {
      var open = $('#demo').classList.toggle('open');
      dh.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    dh.addEventListener('click', demoToggle);
    dh.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); demoToggle(); }
    });
    window.addEventListener('hashchange', render);
    if (!location.hash) location.replace('#/login');
    render();
  };

  /* 공개 */
  APP.esc = esc; APP.$ = $; APP.$$ = $$; APP.ic = ic; APP.thumb = thumb; APP.tone = tone;
  APP.toast = toast; APP.modal = modal; APP.closeModal = closeModal;
  APP.closeAllModals = closeAllModals; APP.confirmBox = confirmBox;
  APP.route = route; APP.go = go; APP.login = login; APP.can = can; APP.approved = approved;
  APP.accounts = function () { buildAccounts(); return ACCOUNTS; };
  APP.scenarios = SCENARIOS;
  global.APP = APP;
})(window);
