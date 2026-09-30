/* ==========================================================================
   사용자(거래처) 24화면
   ========================================================================== */
(function () {
  'use strict';
  var esc = APP.esc, ic = APP.ic, go = APP.go, toast = APP.toast, $ = APP.$, $$ = APP.$$;
  var S = { txid: null, draft: null, quoteSel: [], quoteInit: false, quoteMemo: '', quoteDue: 14,
            lastOrder: null, inqDraft: null, bulkRows: null };

  /* --------------------------------------------------------- 공통 조각 */
  function ph(crumb, title, sub, acts, sid) {
    return '<div class="ph"><div class="ph-t">' +
      (crumb ? '<div class="crumb">' + crumb + '</div>' : '') +
      '<h1>' + esc(title) + '</h1>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
      (acts ? '<div class="ph-a">' + acts + '</div>' : '') + '</div>';
  }
  /** 조회 화면 공통 — 기간 필터 (제안서 §7-1 2-4: 각 탭이 기간 필터와 엑셀 내려받기를 공통으로 갖는다) */
  var PERIODS = [['', '전체'], ['7', '최근 7일'], ['30', '최근 30일'], ['90', '최근 90일'], ['custom', '직접 지정']];
  function periodBar(path, q) {
    var pd = q.pd || '', f = q.from || '', t2 = q.to || '';
    return PERIODS.map(function (x) {
      return '<button class="btn sm ' + (pd === x[0] ? 'p' : '') + '" data-act="period" ' +
        'data-path="' + path + '" data-pd="' + x[0] + '">' + x[1] + '</button>';
    }).join('') +
    (pd === 'custom' ? '<span class="small">기간</span>' +
      '<input class="inp" type="date" id="pf-from" data-act="pf" data-path="' + path + '" value="' + esc(f) + '" aria-label="조회 시작일">' +
      '<span class="small">~</span>' +
      '<input class="inp" type="date" id="pf-to" data-act="pf" data-path="' + path + '" value="' + esc(t2) + '" aria-label="조회 종료일">' : '');
  }
  /** 기간 필터 적용 — 화면마다 날짜를 꺼내는 함수만 다르다 */
  function inPeriod(q, dateOf) {
    var pd = q.pd || '';
    if (!pd) return function () { return true; };
    if (pd === 'custom') {
      var f = q.from || '', t2 = q.to || '';
      return function (x) { var d = (dateOf(x) || '').slice(0, 10);
        return (!f || d >= f) && (!t2 || d <= t2); };
    }
    var from = DB.iso(DB.addD(DB.CLOCK.now, -(+pd)));
    return function (x) { return (dateOf(x) || '').slice(0, 10) >= from; };
  }
  function qs(q, extra) {
    var o = {};
    ['st', 'pd', 'from', 'to'].forEach(function (k) { if (q[k]) o[k] = q[k]; });
    Object.keys(extra || {}).forEach(function (k) {
      if (extra[k] === null) delete o[k]; else o[k] = extra[k];
    });
    var ks = Object.keys(o);
    return ks.length ? '?' + ks.map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&') : '';
  }
  var ST_CLS = { '결제대기': 'wait', '결제완료': 'go', '준비중': 'go', '출고': 'ac',
    '배송중': 'ac', '배송완료': 'ok', '취소': 'dg', '반품 완료': 'dg' };
  var ST_LABEL = { '결제대기': '결제 대기', '결제완료': '결제 완료', '준비중': '준비 중',
    '배송중': '배송 중', '배송완료': '배송 완료' };
  function statusLabel(s) { return ST_LABEL[s] || s; }
  function stChip(s) { return '<span class="chip ' + (ST_CLS[s] || 'mut') + '">' + esc(statusLabel(s)) + '</span>'; }
  var QST_CLS = { '요청': 'wait', '검토 중': 'go', '발송 완료': 'ok', '거절': 'dg' };
  function qChip(s) { return '<span class="chip ' + (QST_CLS[s] || 'mut') + '">' + esc(s) + '</span>'; }

  /** 3단 가격 조회 분해 — 제안서 §3-2① 을 화면으로 */
  function priceStack(pid, bid) {
    var p = DB.product(pid), g = DB.gradeOf(bid), ov = DB.overrideOf(bid, pid);
    var pr = DB.priceFor(pid, bid);
    var gradeUnit = Math.round(p.basePrice * (100 - g.rate) / 100);
    return '<div class="pstack">' +
      '<div class="row ' + (!ov && !g.rate ? 'act' : '') + '"><span class="st">1</span>' +
        '<span class="lb">상품 기본가</span><span class="vl">' + DB.won(p.basePrice) + '원</span></div>' +
      '<div class="row ' + (!ov ? 'act' : 'off') + '"><span class="st">2</span>' +
        '<span class="lb">' + esc(g.name) + ' 등급 할인 <b class="mono">−' + g.rate + '%</b></span>' +
        '<span class="vl">' + DB.won(gradeUnit) + '원</span></div>' +
      '<div class="row ' + (ov ? 'act' : 'off') + '"><span class="st">3</span>' +
        '<span class="lb">거래처 개별 단가' + (ov && ov.memo ? ' <i class="faint small">(' + esc(ov.memo) + ')</i>' : '') + '</span>' +
        '<span class="vl">' + (ov ? DB.won(ov.price) + '원' : '미등록') + '</span></div>' +
      '<div class="fin"><span>적용 공급가 <i class="faint small" style="font-style:normal">' + esc(pr.source) + '</i></span>' +
        '<span class="vl">' + DB.won(pr.unit) + '원</span></div></div>';
  }
  function moqLine(p) {
    return '<span class="pill">MOQ <b class="mono">' + p.moq + '</b></span>' +
      '<span class="pill">주문 단위 <b class="mono">' + p.unit + '</b></span>' +
      '<span class="pill ' + (p.stock < 60 ? 'k' : '') + '">재고 <b class="mono">' + p.stock + '</b></span>';
  }
  /** 스냅샷 품목 표 — 주문·견적 공통 */
  function lineTable(lines, sum, opt) {
    opt = opt || {};
    return '<div class="tw"><table class="t"><thead><tr>' +
      '<th>상품</th><th class="r">확정 단가</th><th class="r">수량</th>' +
      '<th class="r">공급가</th><th class="r">부가세</th><th class="r">합계</th></tr></thead><tbody>' +
      lines.map(function (l) {
        return '<tr><td><b>' + esc(l.name) + '</b><div class="small faint mono">' + esc(l.code) + ' · ' + esc(l.spec) + '</div>' +
          (opt.showSource ? '<div class="small faint">' + esc(l.priceSource) + '</div>' : '') + '</td>' +
          '<td class="r">' + DB.won(l.unitPrice) + '</td><td class="r">' + l.qty + '</td>' +
          '<td class="r">' + DB.won(l.supply) + '</td><td class="r">' + DB.won(l.vat) + '</td>' +
          '<td class="r"><b>' + DB.won(l.total) + '</b></td></tr>';
      }).join('') + '</tbody><tfoot><tr><td colspan="3">합계</td>' +
      '<td class="r">' + DB.won(sum.supply) + '</td><td class="r">' + DB.won(sum.vat) + '</td>' +
      '<td class="r">' + DB.won(sum.total) + '원</td></tr></tfoot></table></div>';
  }
  function emptyRow(cols, msg) {
    return '<tr><td colspan="' + cols + '"><div class="t-empty">' + ic('inbox') + '<div>' + esc(msg) + '</div></div></td></tr>';
  }

  /* ===================================================== S01 로그인 */
  APP.route('/login', {
    id: 'S01', title: '로그인', pub: true, bare: true,
    render: function () {
      return '<div class="auth"><div class="auth-box">' +
        '<a class="auth-home" href="../index.html">' + ic('home') + '메인으로</a>' + 
        '<div class="auth-brand"><span class="brand-m">HS</span><span><b>한성상사 B2B 포털</b>' +
        '<small>거래처 전용 주문·견적 서비스</small></span></div>' +
        '<div class="card"><div class="card-h"><h2>거래처 로그인</h2></div><div class="card-b">' +
          '<div class="f"><div class="fr"><label>아이디 (사업자번호)</label>' +
            '<input class="inp" value="128-81-45723" autocomplete="username"></div>' +
          '<div class="fr"><label>비밀번호</label><input class="inp" type="password" value="demo1234" autocomplete="current-password"></div>' +
          '<button class="btn p blk" data-act="login-b" data-b="b1">로그인</button></div>' +
          '<div class="sep"></div>' +
          '<details class="trial-accounts"><summary>접속 계정 안내</summary><div class="trial-accounts-b">' +
          '<div class="small faint" style="margin-bottom:9px">권한과 거래 상태가 다른 계정으로 각 업무 화면을 살펴볼 수 있습니다.</div>' +
          APP.accounts().filter(function (a) { return a.kind === 'partner'; }).map(function (a, i) {
            return '<button class="acct" data-act="login-b" data-b="' + a.partner + '">' +
              '<span class="av">' + esc(a.label.slice(0, 1)) + '</span>' +
              '<span class="tt"><b>' + esc(a.label) + '</b><span>' + esc(a.sub) + '</span></span>' +
              '<span class="chip ' + (a.status === '승인' ? 'ok' : a.status === '대기' ? 'wait' : 'dg') + '">' +
              esc(a.status) + (a.status === '승인' ? ' · ' + esc(a.gradeName) : '') + '</span></button>';
          }).join('') + '</div></details>' +
        '</div><div class="card-f"><button class="btn sm" data-act="goto" data-path="/signup">기업 회원가입</button>' +
          '<button class="btn sm gh" data-act="goto" data-path="/reset">비밀번호 재설정</button>' +
          '<span style="flex:1 1 auto"></span>' +
          '<button class="btn sm" data-act="goto" data-path="/a/login">관리자 로그인 →</button></div></div>' +
        '</div></div>';
    },
  });

  /* ===================================================== S02 회원가입 */
  APP.route('/signup', {
    id: 'S02', title: '기업 회원가입', pub: true, bare: true,
    render: function () {
      return '<div class="auth"><div class="auth-box" style="max-width:560px">' +
        '<a class="auth-home" href="../index.html">' + ic('home') + '메인으로</a>' + 
        '<div class="auth-brand"><span class="brand-m">HS</span><span><b>기업 회원가입</b>' +
        '<small>관리자 승인 후 서비스를 이용할 수 있습니다</small></span></div>' +
        '<div class="card"><div class="card-h"><h2>사업자 정보</h2></div>' +
        '<div class="card-b"><form class="f" id="su">' +
          '<div class="f2"><div class="fr"><label>사업자등록번호 <span class="req">*</span></label>' +
            '<input class="inp" name="biz" placeholder="000-00-00000" value="311-05-88121"></div>' +
            '<div class="fr"><label>상호 <span class="req">*</span></label><input class="inp" name="name" value="우리마트 중동점"></div></div>' +
          '<div class="f2"><div class="fr"><label>대표자 <span class="req">*</span></label><input class="inp" name="ceo" value="장우리"></div>' +
            '<div class="fr"><label>담당자 <span class="req">*</span></label><input class="inp" name="mgr" value="김담당"></div></div>' +
          '<div class="f2"><div class="fr"><label>연락처 <span class="req">*</span></label><input class="inp" name="tel" value="032-320-5580"></div>' +
            '<div class="fr"><label>이메일 <span class="req">*</span></label><input class="inp" name="email" value="buy@woorimart.example"></div></div>' +
          '<div class="f2"><div class="fr"><label>업태</label><input class="inp" name="biztype" value="소매"></div>' +
            '<div class="fr"><label>종목</label><input class="inp" name="bizitem" value="식료품"></div></div>' +
          '<div class="fr"><label>사업장 주소 <span class="req">*</span></label><input class="inp" name="addr" value="경기도 부천시 원미구 부일로 245"></div>' +
          '<div class="fr"><label>사업자등록증 첨부 <span class="req">*</span></label>' +
            '<div class="row"><button type="button" class="btn sm" data-act="su-file">파일 선택</button>' +
            '<span class="small mono" id="su-fn">사업자등록증_우리마트중동.pdf</span></div>' +
            '<div class="hint">제출한 서류는 안전하게 보관되며, 가입 심사를 담당하는 관리자만 열람할 수 있습니다. ' +
            '등록 가능한 파일 형식과 용량을 확인한 뒤 첨부해 주세요.</div></div>' +
          '<label class="chk"><input type="checkbox" checked> <span>이용약관 및 개인정보 처리방침에 동의합니다. ' +
            '<i class="faint small" style="font-style:normal">보관 기간·삭제 기준과 다운로드 감사 로그는 처리방침에 따릅니다.</i></span></label>' +
          '<button class="btn p blk" type="button" data-act="su-submit">가입 신청</button>' +
        '</form></div>' +
        '<div class="card-f"><button class="btn sm gh" data-act="goto" data-path="/login">← 로그인으로</button></div></div>' +
        '</div></div>';
    },
  });

  /* ============================================ S03 가입 완료 / 승인 대기 */
  APP.route('/signup-done', {
    id: 'S03', title: '가입 신청 완료', pub: true, bare: true, needApproved: false,
    render: function () {
      var b = APP.session && APP.session.kind === 'partner' ? DB.partner(APP.session.partner) : null;
      var st = b ? b.status : '대기';
      var isRej = st === '반려';
      return '<div class="auth"><div class="auth-box" style="max-width:560px">' +
        '<a class="auth-home" href="../index.html">' + ic('home') + '메인으로</a>' + 
        '<div class="auth-brand"><span class="brand-m">HS</span><span><b>' +
        (isRej ? '가입이 반려되었습니다' : st === '승인' ? '가입이 승인되었습니다' : '가입 신청이 접수되었습니다') +
        '</b><small>' + esc(b ? b.name : '우리마트 중동점') + '</small></span></div>' +
        '<div class="card"><div class="card-h"><h2>심사 상태</h2></div><div class="card-b">' +
        '<div class="steps" style="margin-bottom:16px">' +
          '<div class="s done"><span class="b">' + '1' + '</span><span>신청 접수</span></div><div class="ln done"></div>' +
          '<div class="s ' + (st === '대기' ? 'now' : isRej ? 'dead' : 'done') + '"><span class="b">2</span><span>' +
            (isRej ? '반려' : '관리자 심사') + '</span></div><div class="ln ' + (st === '승인' ? 'done' : '') + '"></div>' +
          '<div class="s ' + (st === '승인' ? 'done' : '') + '"><span class="b">3</span><span>이용 시작</span></div></div>' +
        (isRej ?
          '<div class="note dg">' + ic('alert') + '<div class="bd"><b>반려 사유</b>' + esc(b.rejectReason || '') +
          '<div class="small faint" style="margin-top:6px">정정 후 재신청해 주시면 다시 심사해 드립니다.</div></div></div>' :
         st === '승인' ?
          '<div class="note ok">' + ic('check') + '<div class="bd"><b>이용 가능합니다</b>' +
          esc((DB.gradeOf(b.id) || {}).name) + ' 등급이 부여되었습니다. 등급에 따라 공급가와 이용 권한이 적용됩니다.</div></div>' :
          '<div class="note wn">' + ic('clock') + '<div class="bd"><b>관리자 승인 대기 중입니다</b>' +
          '승인 전에는 <b>상품과 거래처 전용 가격을 조회할 수 없습니다.</b> 승인 결과는 담당자 이메일로 안내됩니다.' +
          '<div class="small faint" style="margin-top:6px">' +
          '신청일 ' + esc(b ? b.joined : DB.today()) + ' · 통상 1영업일 이내 처리</div></div></div>') +
        (st !== '승인' ? '<div class="sep"></div>' +
          '<div class="small faint" style="margin-bottom:8px">승인이 완료되면 상품과 거래처 전용 공급가를 조회할 수 있습니다.</div>' : '') +
        '</div><div class="card-f">' +
        (st === '승인' ? '<button class="btn p" data-act="goto" data-path="/">서비스 시작하기</button>' : '') +
        '<button class="btn gh sm" data-act="logout">다른 계정으로 로그인</button></div></div>' +
        '</div></div>';
    },
  });

  /* ================================================ S04 비밀번호 재설정 */
  APP.route('/reset', {
    id: 'S04', title: '비밀번호 재설정', pub: true, bare: true,
    render: function () {
      return '<div class="auth"><div class="auth-box">' +
        '<a class="auth-home" href="../index.html">' + ic('home') + '메인으로</a>' + 
        '<div class="auth-brand"><span class="brand-m">HS</span><span><b>비밀번호 재설정</b>' +
        '<small>등록된 담당자 이메일로 1회용 링크를 보냅니다</small></span></div>' +
        '<div class="card"><div class="card-h"><h2>재설정 링크 요청</h2></div>' +
        '<div class="card-b"><div class="f">' +
          '<div class="fr"><label>사업자등록번호</label><input class="inp" id="rs-biz" value="128-81-45723"></div>' +
          '<div class="fr"><label>담당자 이메일</label><input class="inp" id="rs-mail" value="jw.park@daesung.example"></div>' +
          '<div class="note">' + ic('info') + '<div class="bd"><b>재설정 링크는 30분 동안 한 번만 사용할 수 있습니다</b>' +
            '새 비밀번호는 안전하게 암호화해 저장합니다.</div></div>' +
          '<button class="btn p blk" data-act="rs-send">재설정 링크 보내기</button></div></div>' +
        '<div class="card-f"><button class="btn sm gh" data-act="goto" data-path="/login">← 로그인으로</button></div></div>' +
        '</div></div>';
    },
  });

  /* ======================================================== S05 홈 */
  APP.route('/', {
    id: 'S05', title: '홈',
    render: function () {
      var bid = APP.session.partner, b = DB.partner(bid), g = DB.gradeOf(bid);
      var bn = DB.banners.filter(function (x) { return x.active && x.from <= DB.today() && DB.today() <= x.to; })
        .sort(function (a, c) { return a.order - c.order; })[0];
      var myOrders = DB.orders.filter(function (o) { return o.partner === bid; });
      var myQuotes = DB.quotes.filter(function (q) { return q.partner === bid; });
      var waitQ = myQuotes.filter(function (q) { return q.status === '발송 완료' && !q.converted; });
      var shipping = myOrders.filter(function (o) { return ['준비중', '출고', '배송중'].indexOf(o.status) >= 0; });
      var unpaid = myOrders.filter(function (o) { return o.status === '결제대기'; });
      var cartN = DB.cart(bid).length;
      var nw = DB.products.filter(function (p) { return DB.isNewProduct(p) && p.active && !DB.isBlocked(bid, p.id); });
      var ft = DB.products.filter(function (p) { return p.featured && p.active && !DB.isBlocked(bid, p.id); })
        .sort(function (a, c) { return a.featuredOrder - c.featuredOrder; });

      return ph('<b>홈</b>', b.name + ' 님, 안녕하세요',
        esc(g.name) + ' 등급과 거래 조건에 맞춘 전용 공급가가 적용됩니다. 주문 전 최종 금액과 재고를 다시 확인해 주세요.',
        (APP.can('bulk') ? '<button class="btn" data-act="goto" data-path="/bulk">' + ic('grid') + '대량 담기</button>' : '') +
        '<button class="btn p" data-act="goto" data-path="/products">' + ic('box') + '상품 둘러보기</button>', 'S05') +

        '<section class="hero" aria-label="주요 서비스 안내"><div class="hero-kicker">HANSEONG BUSINESS SUPPLY</div>' +
          '<h2>필요한 사업용품을<br>거래 조건에 맞는 가격으로</h2>' +
          '<p>포장·위생·일회용·청소용품을 한곳에서 찾고, 거래처별 공급가로 견적부터 주문과 배송 조회까지 이어서 처리하세요.</p>' +
          '<div class="row"><button class="btn p" data-act="goto" data-path="/products">상품 둘러보기</button>' +
          (APP.can('bulk') ? '<button class="btn" data-act="goto" data-path="/bulk">상품 코드로 빠르게 담기</button>' : '') + '</div>' +
          (bn ? (function () {
            var nt = DB.notices.filter(function (n) { return n.title === bn.title; })[0];
            return '<button class="hero-notice" data-act="notice" data-id="' + (nt ? nt.id : '') + '">' +
              '<span>공지</span><b>' + esc(bn.title) + '</b><i aria-hidden="true">→</i></button>';
          })() : '') + '</section>' +

        '<div class="service-ribbon" aria-label="서비스 이용 안내">' +
          '<div>' + ic('money') + '<span><b>거래처별 공급가</b> 로그인 계정의 등급과 개별 계약 단가 자동 적용</span></div>' +
          '<div>' + ic('doc') + '<span><b>견적에서 주문까지</b> 확정 견적을 다시 입력하지 않고 주문으로 전환</span></div>' +
          '<div>' + ic('truck') + '<span><b>배송 현황 통합</b> 주문 접수부터 출고·배송 완료까지 한곳에서 확인</span></div>' +
        '</div>' +

        '<section class="home-section" aria-labelledby="home-category-title"><div class="section-head">' +
          '<div><h2 id="home-category-title">카테고리로 찾기</h2><p>자주 구매하는 사업용품을 빠르게 찾아보세요.</p></div>' +
          '<button class="btn sm gh" data-act="goto" data-path="/products">전체 상품</button></div>' +
          '<div class="cat-showcase">' +
            '<button class="cat-tile" data-act="goto" data-path="/products?cat=c1"><img src="assets/images/category-packaging.jpg" alt="" loading="lazy"><span><b>포장 자재</b><small>박스·완충재·테이프</small></span></button>' +
            '<button class="cat-tile" data-act="goto" data-path="/products?cat=c2"><img src="assets/images/category-hygiene.jpg" alt="" loading="lazy"><span><b>위생 용품</b><small>장갑·마스크·소독</small></span></button>' +
            '<button class="cat-tile" data-act="goto" data-path="/products?cat=c3"><img src="assets/images/category-disposable.jpg" alt="" loading="lazy"><span><b>일회용품</b><small>컵·용기·수저</small></span></button>' +
            '<button class="cat-tile" data-act="goto" data-path="/products?cat=c4"><img src="assets/images/category-cleaning.jpg" alt="" loading="lazy"><span><b>청소 용품</b><small>세제·도구·봉투</small></span></button>' +
          '</div></section>' +

        '<div class="grid g4" style="margin-bottom:16px">' +
          '<dl class="kpi k-br"><dt>' + ic('cart') + '장바구니</dt><dd>' + cartN + '<em>품목</em></dd>' +
            '<div class="d">' + (cartN ? '주문 확정 직전에 단가 변동을 다시 확인합니다' : '담긴 품목이 없습니다') + '</div></dl>' +
          '<dl class="kpi k-ac"><dt>' + ic('doc') + '주문 전환 가능 견적</dt><dd>' + waitQ.length + '<em>건</em></dd>' +
            '<div class="d">발송 완료된 견적을 주문으로 전환할 수 있습니다</div></dl>' +
          '<dl class="kpi k-wn"><dt>' + ic('clock') + '입금 대기</dt><dd>' + unpaid.length + '<em>건</em></dd>' +
            '<div class="d">' + (unpaid.length ? '기한 초과 시 자동 취소·재고 복원' : '입금 대기 주문 없음') + '</div></dl>' +
          '<dl class="kpi"><dt>' + ic('truck') + '배송 진행</dt><dd>' + shipping.length + '<em>건</em></dd>' +
            '<div class="d">준비 중 · 출고 · 배송 중</div></dl></div>' +

        '<div class="split">' +
          '<div>' +
            '<div class="card"><div class="card-h"><h2>추천 상품</h2>' +
              '<span class="hint">거래처에서 자주 찾는 주요 공급 품목입니다</span></div>' +
              '<div class="card-b"><div class="pgrid">' + ft.map(function (p) { return pcard(p, bid); }).join('') + '</div></div></div>' +
            '<div class="card"><div class="card-h"><h2>신상품</h2>' +
              '<span class="hint">최근 입고된 신규 품목을 확인해 보세요</span></div>' +
              '<div class="card-b"><div class="pgrid">' + nw.map(function (p) { return pcard(p, bid); }).join('') + '</div></div></div>' +
          '</div>' +
          '<div>' +
            '<div class="card"><div class="card-h"><h2>최근 주문</h2>' +
              '<button class="btn xs gh" data-act="goto" data-path="/orders">전체</button></div>' +
              '<div class="card-b flush"><div class="tw"><table class="t"><tbody>' +
              (myOrders.slice(0, 5).map(function (o) {
                return '<tr><td><button class="lk" data-act="goto" data-path="/order/' + o.id + '">' + esc(o.no) + '</button>' +
                  '<div class="small faint">' + esc(o.at) + ' · ' + o.lines.length + '품목</div></td>' +
                  '<td class="r">' + DB.won(o.sum.total) + '</td><td class="c">' + stChip(o.status) + '</td>' +
                  '<td class="r">' + (o.status !== '취소' ? '<button class="btn xs" data-act="reorder" data-id="' + o.id + '">재주문</button>' : '') + '</td></tr>';
              }).join('') || emptyRow(4, '주문 내역이 없습니다')) + '</tbody></table></div></div></div>' +
            '<div class="card"><div class="card-h"><h2>공지</h2>' +
              '<button class="btn xs gh" data-act="goto" data-path="/notice">전체</button></div>' +
              '<div class="card-b"><div class="stack">' +
              DB.notices.filter(function (n) { return n.type === '공지'; }).slice(0, 3).map(function (n) {
                return '<button class="sc" style="margin:0" data-act="notice" data-id="' + n.id + '"><b>' +
                  (n.pin ? '📌 ' : '') + esc(n.title) + '</b><span>' + esc(n.at) + '</span></button>';
              }).join('') + '</div></div></div>' +
          '</div></div>';
    },
  });

  function pcard(p, bid) {
    var pr = DB.priceForSession(p.id, APP.session);
    var tag = DB.isNewProduct(p) ? '<span class="chip ac">신상품</span>' : (p.featured ? '<span class="chip vi">추천</span>' : '');
    if (!pr) {
      return '<button type="button" class="pc" data-act="prod" data-id="' + p.id + '" ' +
        'aria-label="' + esc(p.name) + ' — 가격 조회 권한 없음">' + APP.thumb(p, tag) +
        '<div class="pc-lock">' + ic('lock') + '가격 조회 권한 없음</div></button>';
    }
    var ov = DB.overrideOf(bid, p.id);
    return '<button type="button" class="pc" data-act="prod" data-id="' + p.id + '" ' +
      'aria-label="' + esc(p.name + ' · ' + p.spec + ' · 공급가 ' + DB.won(pr.unit) + '원') + '">' + APP.thumb(p, tag) +
      '<div class="pc-b"><div class="pc-n">' + esc(p.name) + '</div>' +
      '<div class="pc-s">' + esc(p.spec) + '</div>' +
      '<div class="pc-p"><span class="u">' + DB.won(pr.unit) + '</span><span class="w">원 · ' +
        (ov ? '개별 단가' : pr.gradeRate ? '등급 −' + pr.gradeRate + '%' : '기본가') + '</span></div>' +
      '<div class="pc-m"><span>MOQ <b>' + p.moq + '</b></span><span>단위 <b>' + p.unit + '</b></span>' +
        '<span>재고 <b>' + p.stock + '</b></span></div></div></button>';
  }

  /* ================================================== S06 상품 목록 */
  APP.route('/products', {
    id: 'S06', title: '상품 목록', keepScroll: true,
    render: function (_, q) {
      var bid = APP.session.partner;
      var cat = q.cat || '', sub = q.sub || '', kw = (q.q || '').trim(), sort = q.sort || 'code';
      var list = DB.products.filter(function (p) { return p.active; });
      if (cat) list = list.filter(function (p) { return p.cat === cat; });
      if (sub) list = list.filter(function (p) { return p.sub === sub; });
      if (kw) {
        var k = kw.toLowerCase();
        list = list.filter(function (p) {
          return p.name.toLowerCase().indexOf(k) >= 0 || p.code.toLowerCase().indexOf(k) >= 0 ||
            DB.subName(p.sub).indexOf(kw) >= 0;
        });
      }
      list = list.slice();
      if (sort === 'price') list.sort(function (a, b) {
        var pa = DB.priceForSession(a.id, APP.session), pb = DB.priceForSession(b.id, APP.session);
        return (pa ? pa.unit : 9e9) - (pb ? pb.unit : 9e9);
      });
      else if (sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
      else list.sort(function (a, b) { return a.code.localeCompare(b.code); });

      var catNav = '<button class="btn sm ' + (!cat ? 'p' : '') + '" data-act="goto" data-path="/products' +
        (kw ? '?q=' + encodeURIComponent(kw) : '') + '">전체</button>' +
        DB.CATS.map(function (c) {
          return '<button class="btn sm ' + (cat === c.id ? 'p' : '') + '" data-act="goto" data-path="/products?cat=' + c.id + '">' +
            esc(c.name) + '</button>';
        }).join('');
      var subNav = cat ? '<div class="row" style="margin-top:8px">' +
        DB.CATS.filter(function (c) { return c.id === cat; })[0].subs.map(function (s2) {
          return '<button class="btn xs ' + (sub === s2.id ? 'p' : '') + '" data-act="goto" data-path="/products?cat=' +
            cat + '&sub=' + s2.id + '">' + esc(s2.name) + '</button>';
        }).join('') + '</div>' : '';

      return ph('<b>상품</b> · 카테고리 · 전체 · 검색', '상품 목록',
        '카테고리와 상품명·상품 코드 검색으로 필요한 품목을 빠르게 찾을 수 있습니다. 표시 금액은 <b>' +
        esc(DB.partner(bid).name) + ' 전용 공급가</b>입니다.',
        (APP.can('bulk') ? '<button class="btn" data-act="goto" data-path="/bulk">' + ic('grid') + '대량 담기</button>' : ''), 'S06') +

        '<div class="card"><div class="fbar">' + catNav +
          '<span class="sp"></span>' +
          '<select class="inp" data-act="sort" id="sortsel" aria-label="상품 정렬 기준">' +
            '<option value="code"' + (sort === 'code' ? ' selected' : '') + '>상품 코드순</option>' +
            '<option value="name"' + (sort === 'name' ? ' selected' : '') + '>상품명순</option>' +
            '<option value="price"' + (sort === 'price' ? ' selected' : '') + '>공급가 낮은 순</option>' +
          '</select>' +
          '<span class="cntx">' + list.length + '건</span></div>' +
        (subNav || kw ? '<div style="padding:10px 16px 0">' + subNav +
          (kw ? '<div class="row" style="margin-top:8px"><span class="pill k">검색어 “' + esc(kw) + '”</span>' +
            '<button class="btn xs gh" data-act="goto" data-path="/products">검색 해제</button></div>' : '') + '</div>' : '') +
        '<div class="card-b">' +
          (list.length ? '<div class="pgrid">' + list.map(function (p) { return pcard(p, bid); }).join('') + '</div>'
            : '<div class="t-empty">' + ic('search') + '<div>조건에 맞는 상품이 없습니다</div></div>') +
        '</div></div>';
    },
    onMount: function (_, q) {
      var s = $('#sortsel');
      if (s) s.addEventListener('change', function () {
        var p = new URLSearchParams(); if (q.cat) p.set('cat', q.cat); if (q.sub) p.set('sub', q.sub);
        if (q.q) p.set('q', q.q); p.set('sort', s.value);
        go('/products?' + p.toString());
      });
      if (q.demo === 'isolate') setTimeout(function () { foreignAttempt(); }, 260);
    },
  });

  /* ================================================== S07 상품 상세 */
  APP.route('/product/:id', {
    id: 'S07', title: '상품 상세',
    render: function (pm, q) {
      var bid = APP.session.partner, p = DB.product(pm.id);
      if (!p) return '<div class="note dg">' + ic('alert') + '<div class="bd">존재하지 않는 상품입니다</div></div>';
      var pr = DB.priceForSession(p.id, APP.session);
      if (!pr) {
        return ph('<b>상품</b>', p.name, '', '', 'S07') +
          '<div class="card"><div class="card-b"><div class="note dg">' + ic('lock') +
          '<div class="bd"><b>가격을 조회할 수 없습니다</b>' +
          (DB.isBlocked(bid, p.id) ? '이 거래처의 판매 제외 품목입니다.' :
            '승인되지 않은 계정은 상품과 거래처 전용 가격을 조회할 수 없습니다.') +
          '</div></div></div></div>';
      }
      var ov = DB.overrideOf(bid, p.id);
      return ph('<b>상품</b> · ' + esc((DB.catOfSub(p.sub) || {}).name) + ' · ' + esc(DB.subName(p.sub)),
        p.name, esc(p.desc),
        '<button class="btn" data-act="goto" data-path="/inquiry/product?p=' + p.id + '">' + ic('chat') + '상품 문의</button>', 'S07') +

        '<div class="split"><div>' +
          '<div class="card"><div class="card-b">' +
            '<div style="display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:20px" class="pd-top">' +
            APP.thumb(p, '') +
            '<div><dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' +
              '<dt>상품 코드</dt><dd class="mono">' + esc(p.code) + '</dd>' +
              '<dt>규격</dt><dd>' + esc(p.spec) + '</dd>' +
              '<dt>분류</dt><dd>' + esc((DB.catOfSub(p.sub) || {}).name) + ' › ' + esc(DB.subName(p.sub)) + '</dd>' +
              '<dt>최소 주문 수량</dt><dd><b class="mono">' + p.moq + '</b> 이상</dd>' +
              '<dt>주문 단위</dt><dd><b class="mono">' + p.unit + '</b>의 배수</dd>' +
              '<dt>재고</dt><dd class="stk ' + (p.stock < 60 ? 'low' : p.stock < 140 ? 'mid' : '') + '">' + p.stock + '</dd>' +
            '</dl></div></div>' +
          '</div></div>' +

          '<div class="card"><div class="card-h"><h2>적용 공급가</h2>' +
            '<span class="hint">현재 거래처의 등급과 개별 계약 단가를 반영한 금액입니다</span></div>' +
            '<div class="card-b">' + priceStack(p.id, bid) +
            '<div class="note ac" style="margin-top:12px">' + ic('shield') + '<div class="bd">' +
            '<b>' + esc(DB.partner(bid).name) + ' 전용 공급가입니다</b>' +
            '로그인한 거래처의 계약 조건에 맞는 가격만 조회할 수 있습니다.' +
            (ov ? '<div class="small" style="margin-top:6px">개별 단가 사유: ' + esc(ov.memo) + '</div>' : '') +
            '</div></div></div></div>' +
        '</div>' +

        '<div><div class="card"><div class="card-h"><h2>장바구니에 담기</h2></div><div class="card-b">' +
          '<div class="row" style="margin-bottom:10px">' + moqLine(p) + '</div>' +
          '<div class="fr" style="margin-bottom:12px"><label>수량</label>' +
            '<div class="row"><span class="qty">' +
              '<button type="button" data-act="q-" aria-label="수량 ' + p.unit + ' 감소">−</button>' +
              '<input id="pq" class="num" type="number" value="' + p.moq + '" min="1" step="1" aria-label="주문 수량">' +
              '<button type="button" data-act="q+" aria-label="수량 ' + p.unit + ' 증가">+</button></span>' +
              '<span class="small faint">MOQ ' + p.moq + ' · ' + p.unit + ' 단위</span></div>' +
            '<div id="pq-err"></div></div>' +
          '<div class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden;margin-bottom:12px">' +
            '<dt>공급가</dt><dd class="mono" id="pv-sup">' + DB.won(pr.unit * p.moq) + '원</dd>' +
            '<dt>부가세</dt><dd class="mono" id="pv-vat">' + DB.won(Math.round(pr.unit * p.moq * .1)) + '원</dd>' +
            '<dt>합계</dt><dd class="mono" id="pv-tot"><b>' + DB.won(Math.round(pr.unit * p.moq * 1.1)) + '원</b></dd></div>' +
          '<button class="btn p blk" data-act="add-cart" data-id="' + p.id + '">' + ic('cart') + '장바구니에 담기</button>' +
          '<button class="btn blk" style="margin-top:7px" data-act="quote-one" data-id="' + p.id + '">' + ic('doc') + '이 상품으로 견적 요청</button>' +
          '<div class="sep"></div>' +
          '<div class="small faint">장바구니에 담은 뒤 공급가가 바뀌면 주문을 확정하기 전에 변경된 상품과 금액을 안내합니다. ' +
          '변경 내용을 확인한 후에만 주문을 완료할 수 있습니다.</div>' +
        '</div></div></div></div>';
    },
    onMount: function (pm, q) {
      var p = DB.product(pm.id);
      var inp = $('#pq'); if (!inp) return;
      function upd() {
        var qty = +inp.value || 0;
        var pr = DB.priceForSession(p.id, APP.session); if (!pr) return;
        var sup = pr.unit * qty;
        $('#pv-sup').textContent = DB.won(sup) + '원';
        $('#pv-vat').textContent = DB.won(Math.round(sup * .1)) + '원';
        $('#pv-tot').innerHTML = '<b>' + DB.won(sup + Math.round(sup * .1)) + '원</b>';
        var v = DB.validateMoq(p.id, qty);
        $('#pq-err').innerHTML = v.ok ? '' :
          '<div class="err-t">' + ic('alert') + esc(v.reason) + '</div>';
        inp.classList.toggle('err', !v.ok);
      }
      inp.addEventListener('input', upd);
      APP.__pqUpd = upd;
      if (q.demo === 'moq') setTimeout(function () {
        inp.value = String(Math.max(1, p.moq - 3)); upd(); inp.focus();
        toast('MOQ 미달 수량을 넣어 두었습니다', 'wn', '담기 · 주문서 작성 · 최종 확정 세 지점에서 각각 차단됩니다');
      }, 250);
    },
  });

  /* =================================================== S08 장바구니 */
  APP.route('/cart', {
    id: 'S08', title: '장바구니',
    render: function () {
      var bid = APP.session.partner, c = DB.cart(bid);
      var drift = DB.cartDrift(bid);
      var driftMap = {}; drift.forEach(function (d) { driftMap[d.product] = d; });
      var lines = c.map(function (it) { return DB.makeLine(it.product, it.qty, bid); });
      var sum = DB.sumLines(lines);
      var blockedItems = c.filter(function (it) { return DB.isBlocked(bid, it.product); });
      var bad = c.map(function (it) { return { it: it, v: DB.validateMoq(it.product, it.qty) }; })
        .filter(function (x) { return !x.v.ok; });
      var canOrder = !blockedItems.length && !bad.length;

      return ph('<b>장바구니</b>', '장바구니',
        '장바구니는 계정에 저장되어 PC에서 담은 상품을 태블릿·휴대폰에서도 이어서 주문할 수 있습니다. ' +
        '주문 전 수량·재고·공급가 변동을 다시 확인합니다.',
        (c.length ? '<button class="btn" data-act="cart-clear">비우기</button>' +
          (APP.can('quote') ? '<button class="btn" data-act="cart-quote">' + ic('doc') + '견적 요청</button>' : '') +
          '<button class="btn p" data-act="to-checkout"' + (canOrder ? '' : ' disabled') + '>' +
          ic('cart') + '주문서 작성</button>' : ''), 'S08') +

        (blockedItems.length ? '<div class="note dg" style="margin-bottom:14px">' + ic('lock') + '<div class="bd">' +
          '<b>판매 제외로 지정된 품목이 ' + blockedItems.length + '건 있습니다</b>' +
          blockedItems.map(function (it) {
            return '· ' + esc(DB.product(it.product).name) + ' — 담은 뒤 판매 제외로 바뀌었습니다'; }).join('<br>') +
          '<div class="small" style="margin-top:6px">판매 중단된 품목은 주문과 견적에서 모두 제외됩니다. ' +
          '해당 행을 빼고 주문해 주세요.</div></div></div>' : '') +

        (drift.length ? '<div class="note wn" style="margin-bottom:14px">' + ic('alert') + '<div class="bd">' +
          '<b>담은 뒤 단가가 바뀐 품목이 ' + drift.length + '건 있습니다</b>' +
          '아래 표에서 변경된 상품과 금액을 확인해 주세요. <b>변경 내용을 확인하기 전에는 주문을 진행할 수 없습니다.</b>' +
          '<div class="row" style="margin-top:9px"><button class="btn sm p" data-act="ack-drift">변동 내용 확인하고 계속</button></div>' +
          '</div></div>' : '') +
        (bad.length ? '<div class="note dg" style="margin-bottom:14px">' + ic('alert') + '<div class="bd">' +
          '<b>MOQ · 주문 단위 기준을 충족하지 못한 품목이 ' + bad.length + '건 있습니다</b>' +
          bad.map(function (x) { return '· ' + esc(DB.product(x.it.product).name) + ' — ' + esc(x.v.reason); }).join('<br>') +
          '</div></div>' : '') +

        '<div class="card"><div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>상품</th><th class="r">담을 때 단가</th><th class="r">현재 단가</th><th class="c">수량</th>' +
        '<th class="r">합계</th><th></th></tr></thead><tbody>' +
        (c.length ? c.map(function (it) {
          var p = DB.product(it.product), pr = DB.priceFor(it.product, bid);
          var d = driftMap[it.product];
          var v = DB.validateMoq(it.product, it.qty);
          var tot = pr.unit * it.qty; tot = tot + Math.round(tot * .1);
          var blk = DB.isBlocked(bid, it.product);
          return '<tr class="' + (blk ? 'dgrow' : d ? 'em' : '') + '"><td><b>' + esc(p.name) + '</b>' +
            (blk ? ' <span class="chip dg nb">판매 제외</span>' : '') +
            '<div class="small faint mono">' + esc(p.code) + ' · ' + esc(p.spec) + '</div>' +
            '<div class="small faint">MOQ ' + p.moq + ' · 단위 ' + p.unit + ' · 담은 날짜 ' + esc(it.addedAt) + '</div>' +
            (it.reorderFrom ? '<div class="small ' + (it.reorderFrom.now > it.reorderFrom.unit ? 'diff-up' : 'diff-dn') +
              '" style="margin-top:4px">지난 주문 대비 변동 · ' + esc(it.reorderFrom.no) + ' ' +
              DB.won(it.reorderFrom.unit) + '원 → ' + DB.won(it.reorderFrom.now) + '원</div>' : '') +
            (v.ok ? '' : '<div class="err-t" style="margin-top:4px">' + ic('alert') + esc(v.reason) + '</div>') + '</td>' +
            '<td class="r mono">' + DB.won(it.addedPrice) + '</td>' +
            '<td class="r mono">' + DB.won(pr.unit) +
              (d ? '<div class="small ' + (d.diff > 0 ? 'diff-up' : 'diff-dn') + '">' +
                (d.diff > 0 ? '▲ +' : '▼ ') + DB.won(d.diff) + '</div>' : '') + '</td>' +
            '<td class="c"><span class="qty">' +
              '<button type="button" data-act="c-" data-id="' + it.product + '" aria-label="' + esc(p.name) + ' 수량 감소">−</button>' +
              '<input class="num" type="number" value="' + it.qty + '" data-act="c-set" data-id="' + it.product +
              '" aria-label="' + esc(p.name) + ' 수량">' +
              '<button type="button" data-act="c+" data-id="' + it.product + '" aria-label="' + esc(p.name) + ' 수량 증가">+</button></span></td>' +
            '<td class="r"><b>' + DB.won(tot) + '</b></td>' +
            '<td class="c"><button class="btn xs gh" data-act="c-del" data-id="' + it.product + '" aria-label="삭제">' + ic('x') + '</button></td></tr>';
        }).join('') : emptyRow(6, '장바구니가 비어 있습니다')) +
        '</tbody>' + (c.length ? '<tfoot><tr><td colspan="4">합계 (부가세 포함)</td>' +
          '<td class="r">' + DB.won(sum.total) + '원</td><td></td></tr></tfoot>' : '') +
        '</table></div></div>' +
        (c.length ? '<div class="card-f"><span class="small faint">공급가 ' + DB.won(sum.supply) +
          '원 · 부가세 ' + DB.won(sum.vat) + '원</span><span style="flex:1 1 auto"></span>' +
          (APP.can('quote') ? '<button class="btn" data-act="cart-quote">견적 요청</button>' : '') +
          '<button class="btn p" data-act="to-checkout">주문서 작성 →</button></div>' : '') +
        '</div>' +
        (c.length ? '' : '<div class="row" style="margin-top:14px"><button class="btn p" data-act="goto" data-path="/products">상품 둘러보기</button>' +
          (APP.can('bulk') ? '<button class="btn" data-act="goto" data-path="/bulk">대량 담기</button>' : '') + '</div>');
    },
  });

  /* ================================================= S09 대량 담기 */
  APP.route('/bulk', {
    id: 'S09', title: '대량 담기', perm: 'bulk',
    render: function () {
      var sample = 'PK-1010,20\nPK-2010,10\nHY-1010,8\nDP-1010,16\nCL-1010,4';
      return ph('<b>장바구니</b> · 대량 담기', '대량 담기',
        '상품 코드와 수량을 붙여 넣어 여러 품목을 한 번에 담을 수 있습니다. 장바구니에 담기 전에 상품 코드, 최소 주문 수량, 주문 단위와 재고를 모두 확인합니다.',
        '<button class="btn" data-act="bulk-sample">예시 채우기</button>', 'S09') +
        '<div class="split"><div>' +
        '<div class="card"><div class="card-h"><h2>상품 코드 · 수량</h2>' +
          '<span class="hint">한 줄에 한 품목 · 쉼표 또는 탭으로 구분</span></div><div class="card-b">' +
          '<textarea class="bulk" id="bulk" aria-label="상품 코드와 수량 목록" placeholder="PK-1010,20&#10;PK-2010,10">' + sample + '</textarea>' +
          '<div class="row" style="margin-top:11px"><button class="btn p" data-act="bulk-check">검증하기</button>' +
          '<button class="btn" data-act="bulk-clear">지우기</button></div>' +
          '<div id="bulk-res" style="margin-top:14px"></div>' +
        '</div></div></div>' +
        '<div><div class="card"><div class="card-h"><h2>상품 코드 안내</h2></div>' +
          '<div class="card-b flush"><div class="tw" style="max-height:440px;overflow-y:auto">' +
          '<table class="t"><thead><tr><th>코드</th><th>상품</th><th class="r">MOQ</th><th class="r">단위</th></tr></thead><tbody>' +
          DB.products.map(function (p) {
            return '<tr><td class="mono small">' + esc(p.code) + '</td><td class="small">' + esc(p.name) + '</td>' +
              '<td class="r">' + p.moq + '</td><td class="r">' + p.unit + '</td></tr>';
          }).join('') + '</tbody></table></div></div></div></div></div>';
    },
  });

  /* ================================================ S10 견적 요청 */
  APP.route('/quote/new', {
    id: 'S10', title: '견적 요청', perm: 'quote',
    render: function () {
      var bid = APP.session.partner, c = DB.cart(bid);
      if (!S.quoteInit) {
        S.quoteSel = c.map(function (i) { return { product: i.product, qty: i.qty }; });
        S.quoteInit = true;
      }
      var sel = S.quoteSel;
      var lines = sel.map(function (s) { return DB.makeLine(s.product, s.qty, bid); });
      var sum = DB.sumLines(lines);
      return ph('<b>견적</b> · 요청', '견적 요청',
        '요청하신 품목은 <b>요청 → 검토 중 → 발송 완료</b> 순으로 처리됩니다. 견적서에는 현재 거래 조건에 따른 공급가가 우선 적용됩니다.',
        '<button class="btn" data-act="goto" data-path="/products">품목 추가</button>', 'S10') +
        '<div class="split"><div><div class="card"><div class="card-h"><h2>요청 품목</h2>' +
        '<span class="hint">' + sel.length + '개</span></div><div class="card-b flush"><div class="tw">' +
        '<table class="t"><thead><tr><th>상품</th><th class="c">수량</th><th class="r">예상 공급가</th><th></th></tr></thead><tbody>' +
        (sel.length ? sel.map(function (s) {
          var p = DB.product(s.product), pr = DB.priceFor(s.product, bid);
          return '<tr><td><b>' + esc(p.name) + '</b><div class="small faint mono">' + esc(p.code) + '</div></td>' +
            '<td class="c"><span class="qty">' +
            '<button type="button" data-act="qs-" data-id="' + s.product + '" aria-label="' + esc(p.name) + ' 수량 감소">−</button>' +
            '<input class="num" type="number" value="' + s.qty + '" data-act="qs-set" data-id="' + s.product +
            '" aria-label="' + esc(p.name) + ' 수량">' +
            '<button type="button" data-act="qs+" data-id="' + s.product + '" aria-label="' + esc(p.name) + ' 수량 증가">+</button></span></td>' +
            '<td class="r mono">' + DB.won(pr.unit * s.qty) + '</td>' +
            '<td class="c"><button class="btn xs gh" data-act="qs-del" data-id="' + s.product +
              '" aria-label="' + esc(p.name) + ' 삭제">' + ic('x') + '</button></td></tr>';
        }).join('') : emptyRow(4, '요청할 품목을 추가해 주세요')) +
        '</tbody>' + (sel.length ? '<tfoot><tr><td colspan="2">예상 합계 (부가세 포함)</td>' +
        '<td class="r">' + DB.won(sum.total) + '원</td><td></td></tr></tfoot>' : '') + '</table></div></div></div></div>' +
        '<div><div class="card"><div class="card-h"><h2>요청 정보</h2></div><div class="card-b">' +
        '<div class="f"><div class="fr"><label for="qdue">희망 회신 기한</label>' +
        '<select class="inp" id="qdue" data-act="qdue">' + [7, 14, 21, 30].map(function (d) {
          return '<option value="' + d + '"' + (S.quoteDue === d ? ' selected' : '') + '>' + d + '일 이내</option>';
        }).join('') + '</select></div>' +
        '<div class="fr"><label for="qmemo">요청 메모</label><textarea class="inp" id="qmemo" data-act="qmemo" ' +
        'placeholder="납품 시기, 물량 조건 등을 적어 주세요">' + esc(S.quoteMemo) + '</textarea></div>' +
        '<div class="note">' + ic('info') + '<div class="bd"><b>예상 공급가는 참고용입니다</b>' +
        '최종 금액은 관리자가 발송한 견적서에서 확정되며, 그 견적을 주문으로 전환할 때 <b>금액을 다시 산정하지 않습니다.</b></div></div>' +
        '<button class="btn p blk" data-act="quote-send"' + (sel.length ? '' : ' disabled') + '>견적 요청 보내기</button>' +
        '</div></div></div></div></div>';
    },
  });

  /* ================================================ S11 견적 목록 */
  APP.route('/quotes', {
    id: 'S11', title: '견적 목록', perm: 'quote',
    render: function (_, q) {
      var bid = APP.session.partner;
      var f = q.st || '';
      var list = DB.quotes.filter(function (x) { return x.partner === bid; });
      if (f) list = list.filter(function (x) { return x.status === f; });
      list = list.filter(inPeriod(q, function (x) { return x.at; }));
      return ph('<b>견적</b> · 목록', '견적 목록',
        '발송 완료된 견적은 유효기간 안에 주문으로 전환할 수 있습니다. 전환된 주문에는 <b>견적의 품목·수량·확정 금액이 그대로 적용</b>됩니다. ' +
        '<span class="pill">운영 정책</span> 유효기간이 지난 견적은 주문으로 전환할 수 없으며, 새 견적을 요청해야 합니다.',
        '<button class="btn" data-act="excel-dl">' + ic('excel') + '엑셀 내려받기</button>' +
        '<button class="btn p" data-act="goto" data-path="/quote/new">' + ic('plus') + '견적 요청</button>', 'S11') +
        '<div class="card"><div class="fbar">' +
        ['', '요청', '검토 중', '발송 완료', '거절'].map(function (s) {
          return '<button class="btn sm ' + (f === s ? 'p' : '') + '" data-act="goto" data-path="/quotes' +
            qs(q, { st: s || null }) + '">' + (s || '전체') + '</button>';
        }).join('') + '<span class="sp"></span><span class="cntx">' + list.length + '건</span></div>' +
        '<div class="fbar">' + periodBar('/quotes', q) + '</div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>견적번호</th><th>요청일</th><th class="c">품목</th><th class="r">금액</th>' +
        '<th>유효기간</th><th class="c">상태</th><th>전환</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (x) {
          return '<tr><td><button class="lk" data-act="goto" data-path="/quote/' + x.id + '">' + esc(x.no) + '</button></td>' +
            '<td class="mono small">' + esc(x.at) + '</td><td class="c">' + x.lines.length + '</td>' +
            '<td class="r">' + DB.won(x.sum.total) + '</td>' +
            '<td class="mono small">' + esc(x.validUntil) + '</td>' +
            '<td class="c">' + qChip(x.status) + '</td>' +
            '<td>' + (x.converted ? '<span class="chip ok nb">' + esc(x.converted) + '</span>' : '<span class="faint small">-</span>') + '</td>' +
            '<td class="c">' + (x.status === '발송 완료' && !x.converted ?
              '<button class="btn xs p" data-act="convert" data-id="' + x.id + '">주문 전환</button>' : '') + '</td></tr>';
        }).join('') : emptyRow(8, '견적이 없습니다')) +
        '</tbody></table></div></div></div>';
    },
    onMount: function (_, q) {
      if (q.demo === 'convert') {
        var t = DB.quotes.filter(function (x) { return x.partner === APP.session.partner && x.status === '발송 완료' && !x.converted; })[0];
        if (t) setTimeout(function () { convertFlow(t.id); }, 280);
      }
    },
  });

  /* ================================================ S12 견적 상세 */
  APP.route('/quote/:id', {
    id: 'S12', title: '견적 상세', perm: 'quote',
    render: function (pm) {
      var x = DB.quote(pm.id);
      if (!x || x.partner !== APP.session.partner) return '<div class="note dg">' + ic('alert') + '<div class="bd">견적을 찾을 수 없습니다</div></div>';
      return ph('<button class="lk" data-act="goto" data-path="/quotes">견적 목록</button> › <b>' + esc(x.no) + '</b>',
        '견적서 ' + x.no, '요청일 ' + esc(x.at) + ' · 유효기간 ' + esc(x.validUntil),
        (x.status === '발송 완료' && !x.converted ?
          '<button class="btn p" data-act="convert" data-id="' + x.id + '">' + ic('cart') + '주문으로 전환</button>' : '') +
        '<button class="btn" data-act="goto" data-path="/quotes">목록</button>', 'S12') +
        '<div class="card"><div class="card-h"><h2>상태</h2><span style="flex:1 1 auto"></span>' + qChip(x.status) + '</div>' +
        '<div class="card-b">' +
        '<div class="steps">' + ['요청', '검토 중', '발송 완료'].map(function (s, i, arr) {
          var idx = ['요청', '검토 중', '발송 완료'].indexOf(x.status);
          var cur = x.status === '거절' ? -1 : idx;
          return '<div class="s ' + (i < cur ? 'done' : i === cur ? 'now' : '') + '"><span class="b">' + (i + 1) +
            '</span><span>' + s + '</span></div>' + (i < arr.length - 1 ? '<div class="ln ' + (i < cur ? 'done' : '') + '"></div>' : '');
        }).join('') + (x.converted ? '<div class="ln done"></div><div class="s done"><span class="b">4</span><span>주문 전환</span></div>' : '') + '</div>' +
        (x.memo ? '<div class="note" style="margin-top:14px">' + ic('chat') + '<div class="bd"><b>요청 메모</b>' + esc(x.memo) + '</div></div>' : '') +
        (x.adjustNote ? '<div class="note ac" style="margin-top:10px">' + ic('info') + '<div class="bd"><b>관리자 회신</b>' + esc(x.adjustNote) + '</div></div>' : '') +
        (x.converted ? '<div class="note ok" style="margin-top:10px">' + ic('check') + '<div class="bd">' +
          '<b>주문 ' + esc(x.converted) + '으로 전환되었습니다</b>견적에서 확정된 품목·수량·금액이 주문에 그대로 적용되었습니다. ' +
          '<button class="btn xs" data-act="goto-order-no" data-no="' + esc(x.converted) + '" style="margin-left:6px">주문 보기</button></div></div>' : '') +
        '</div></div>' +
        '<div class="card"><div class="card-h"><h2>견적 확정 품목</h2>' +
        '<span class="hint">주문 전환 시 확정된 품목과 금액이 그대로 적용됩니다</span></div>' +
        '<div class="card-b flush">' + lineTable(x.lines, x.sum, { showSource: true }) + '</div></div>';
    },
  });

  /* ============================================== S13 주문서 작성 */
  APP.route('/checkout', {
    id: 'S13', title: '주문서 작성',
    render: function () {
      var bid = APP.session.partner;
      var d = S.draft;
      if (!d) { setTimeout(function () { go('/cart'); }, 0); return '<div class="note wn">' + ic('info') + '<div class="bd">장바구니에서 주문서 작성을 시작해 주세요</div></div>'; }
      var lines = d.items.map(function (i) { return DB.makeLine(i.product, i.qty, bid); });
      var sum = DB.sumLines(lines);
      var addrs = DB.addrOf(bid);
      var bad = d.items.map(function (i) { return { i: i, v: DB.validateMoq(i.product, i.qty) }; })
        .filter(function (x) { return !x.v.ok; });
      var b = DB.partner(bid);

      return ph('<button class="lk" data-act="goto" data-path="/cart">장바구니</button> › <b>주문서 작성</b>',
        '주문서 작성', '상품 수량과 재고를 확인한 뒤 배송지를 선택해 주세요. 주문이 확정되면 <b>선택한 배송지와 금액이 주문 내역에 보존</b>됩니다.',
        '', 'S13') +

        (bad.length ? '<div class="note dg" style="margin-bottom:14px">' + ic('alert') + '<div class="bd">' +
          '<b>주문 기준을 충족하지 못한 품목이 ' + bad.length + '건 있습니다</b>' +
          bad.map(function (x) { return '· ' + esc(DB.product(x.i.product).name) + ' — ' + esc(x.v.reason); }).join('<br>') +
          '<div class="row" style="margin-top:8px"><button class="btn sm" data-act="goto" data-path="/cart">장바구니에서 수정</button></div>' +
          '</div></div>' : '') +

        '<div class="split"><div>' +
        '<div class="card"><div class="card-h"><h2>배송지</h2>' +
          '<button class="btn xs" data-act="addr-new">새 배송지 입력</button></div><div class="card-b">' +
          (addrs.length ? '' : '<div class="note wn" style="margin-bottom:12px">' + ic('alert') +
            '<div class="bd"><b>등록된 배송지가 없습니다</b>마이페이지에서 배송지를 먼저 등록해 주세요.</div></div>') +
          '<div class="stack">' + addrs.map(function (a) {
            return '<label class="acct" style="margin:0;cursor:pointer">' +
              '<input type="radio" name="addr" value="' + a.id + '"' + (d.addr === a.id ? ' checked' : '') +
              ' data-act="pick-addr" style="accent-color:var(--br);width:16px;height:16px">' +
              '<span class="tt"><b>' + esc(a.label) + (a.def ? ' <span class="chip ok nb">기본</span>' : '') + '</b>' +
              '<span>' + esc(a.receiver) + ' · ' + esc(a.tel) + ' · ' + esc(a.addr) + '</span></span></label>';
          }).join('') + '</div>' +
          '<div class="fr" style="margin-top:12px"><label>배송 요청사항</label>' +
          '<input class="inp" id="ck-memo" data-act="ck-memo" value="' + esc(d.memo || '') + '" placeholder="예: 오전 하역 부탁드립니다"></div>' +
          '<div class="note" style="margin-top:12px">' + ic('info') + '<div class="bd">' +
          '<b>본사 청구 / 지점 납품 분리</b>세금계산서 정보는 거래처 단위, 배송지는 주문 단위로 분리 저장합니다.</div></div>' +
        '</div></div>' +
        '<div class="card"><div class="card-h"><h2>주문 품목</h2><span class="hint">주문 확정 후 금액이 변경되지 않습니다</span></div>' +
          '<div class="card-b flush">' + lineTable(lines, sum, { showSource: true }) + '</div></div>' +
        '</div>' +
        '<div><div class="card"><div class="card-h"><h2>결제 정보</h2></div><div class="card-b">' +
          '<dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden;margin-bottom:12px">' +
          '<dt>공급가</dt><dd class="mono">' + DB.won(sum.supply) + '원</dd>' +
          '<dt>부가세</dt><dd class="mono">' + DB.won(sum.vat) + '원</dd>' +
          '<dt>합계</dt><dd class="mono"><b style="font-size:16px">' + DB.won(sum.total) + '원</b></dd></dl>' +
          '<div class="fr" style="margin-bottom:12px"><label>세금계산서 발행 정보</label>' +
          '<div class="small faint">' + esc(b.name) + ' · ' + esc(b.biz) + '<br>' + esc(b.taxEmail) + '</div></div>' +
          '<button class="btn p blk" data-act="to-pay"' + (bad.length || !addrs.length ? ' disabled' : '') + '>결제 단계로 →</button>' +
          '<button class="btn blk" style="margin-top:7px" data-act="goto" data-path="/cart">장바구니로 돌아가기</button>' +
        '</div></div></div></div>';
    },
  });

  /* ==================================================== S14 결제 */
  APP.route('/pay', {
    id: 'S14', title: '결제',
    render: function () {
      var bid = APP.session.partner, d = S.draft;
      if (!d) { setTimeout(function () { go('/cart'); }, 0); return ''; }
      if (!S.txid) S.txid = 'PG' + String(Date.now()).slice(-10);   // 승인 응답의 거래 고유번호
      var lines = d.items.map(function (i) { return DB.makeLine(i.product, i.qty, bid); });
      var sum = DB.sumLines(lines);
      var drift = DB.cartDrift(bid).filter(function (x) {
        return d.items.some(function (i) { return i.product === x.product; });
      });
      return ph('<button class="lk" data-act="goto" data-path="/checkout">주문서</button> › <b>결제</b>', '결제',
        '<b>최종 주문 전 확인 단계</b>입니다. 최소 주문 수량·재고·장바구니에 담은 이후의 단가 변동을 다시 확인합니다.', '', 'S14') +

        (drift.length ? '<div class="note wn" style="margin-bottom:14px">' + ic('alert') + '<div class="bd">' +
          '<b>담은 뒤 단가가 바뀐 품목이 있습니다 — 재확인이 필요합니다</b>' +
          '<div class="tw" style="margin-top:8px"><table class="t"><thead><tr><th>상품</th><th class="r">담을 때</th>' +
          '<th class="r">현재</th><th class="r">차이</th></tr></thead><tbody>' +
          drift.map(function (x) {
            return '<tr><td>' + esc(DB.product(x.product).name) + '</td>' +
              '<td class="r mono">' + DB.won(x.was) + '</td><td class="r mono">' + DB.won(x.now) + '</td>' +
              '<td class="r ' + (x.diff > 0 ? 'diff-up' : 'diff-dn') + '">' + (x.diff > 0 ? '+' : '') + DB.won(x.diff) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="row" style="margin-top:9px"><button class="btn sm p" data-act="ack-drift">변동 내용 확인함</button>' +
          '<button class="btn sm" data-act="goto" data-path="/cart">장바구니에서 조정</button></div></div></div>' : '') +

        '<div class="split"><div><div class="card"><div class="card-h"><h2>결제 수단</h2></div><div class="card-b">' +
        '<div class="stack">' +
        '<label class="acct" style="margin:0;cursor:pointer"><input type="radio" name="pay" value="card"' +
          (d.pay !== 'bank' ? ' checked' : '') + ' data-act="pick-pay" style="accent-color:var(--br);width:16px;height:16px">' +
          '<span class="tt"><b>온라인 결제</b><span>카드·계좌이체를 지원하며 거래 고유번호를 기준으로 중복 결제를 방지합니다</span></span></label>' +
        '<label class="acct" style="margin:0;cursor:pointer"><input type="radio" name="pay" value="bank"' +
          (d.pay === 'bank' ? ' checked' : '') + ' data-act="pick-pay" style="accent-color:var(--br);width:16px;height:16px">' +
          '<span class="tt"><b>무통장 입금</b><span>입금 기한 ' + esc(DB.iso(DB.addD(DB.CLOCK.now, 3))) +
          ' — 기한 초과 시 자동 취소되고 재고가 복원됩니다</span></span></label></div>' +
        '<div id="pay-bank" style="margin-top:14px;' + (d.pay === 'bank' ? '' : 'display:none') + '">' +
          '<div class="f2"><div class="fr"><label>입금자명</label><input class="inp" id="payer" value="' +
            esc(DB.partner(bid).name) + '"></div>' +
          '<div class="fr"><label>입금 계좌</label><input class="inp" value="국민 123456-04-778120 (주)한성상사" readonly></div></div></div>' +
        '</div></div>' +
        '<div class="card"><div class="card-h"><h2>최종 확인</h2></div><div class="card-b flush">' +
        lineTable(lines, sum, { showSource: true }) + '</div></div></div>' +
        '<div><div class="card"><div class="card-h"><h2>결제 금액</h2></div><div class="card-b">' +
        '<dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden;margin-bottom:12px">' +
        '<dt>공급가</dt><dd class="mono">' + DB.won(sum.supply) + '원</dd>' +
        '<dt>부가세</dt><dd class="mono">' + DB.won(sum.vat) + '원</dd>' +
        '<dt>결제 금액</dt><dd class="mono"><b style="font-size:17px;color:var(--key-d)">' + DB.won(sum.total) + '원</b></dd></dl>' +
        '<button class="btn p blk" data-act="place-order"' + (drift.length ? ' disabled' : '') + '>' +
          (drift.length ? '단가 변동 확인 후 진행' : '주문 확정') + '</button>' +
        '<div class="small faint" style="margin-top:10px">주문을 확정하면 현재 단가·할인율·수량과 결제 금액이 주문 내역에 저장됩니다. ' +
        '이후 기준 단가가 변경되어도 확정된 주문 금액은 바뀌지 않습니다.</div>' +
        '</div></div>' +
        (d.pay !== 'bank' ? '<div class="card"><div class="card-h"><h2>결제 보안 정보</h2>' +
          '<span class="hint">중복 결제 방지</span></div><div class="card-b">' +
          '<dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' +
          '<dt>거래 고유번호</dt><dd class="mono">' + esc(S.txid) + '</dd>' +
          '<dt>승인 상태</dt><dd>' + (DB.pgUsed(S.txid) ? '<span class="chip dg">사용됨</span>' :
            '<span class="chip wait">미승인</span>') + '</dd></dl>' +
          '<div class="small faint" style="margin:10px 0">거래 고유번호를 기준으로 동일한 결제가 두 번 승인되지 않도록 보호합니다.</div>' +
          '<button class="btn blk" data-act="pg-dup">결제 상태 다시 확인</button>' +
          '</div></div>' : '') +
        '</div></div>';
    },
  });

  /* =============================================== S15 주문 완료 */
  APP.route('/order-done/:id', {
    id: 'S15', title: '주문 완료',
    render: function (pm) {
      var o = DB.order(pm.id);
      if (!o) return '<div class="note dg">' + ic('alert') + '<div class="bd">주문을 찾을 수 없습니다</div></div>';
      return '<div class="wrap nar">' +
        '<div class="card" style="text-align:center"><div class="card-b" style="padding:34px 24px">' +
        '<div style="width:56px;height:56px;border-radius:50%;background:var(--ok-l);color:var(--ok);' +
          'display:flex;align-items:center;justify-content:center;margin:0 auto 14px">' +
          '<svg class="i" style="width:28px;height:28px" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg></div>' +
        '<h1 style="font-size:20px;margin-bottom:6px">주문이 접수되었습니다</h1>' +
        '<div class="mono" style="font-size:15px;color:var(--key-d);font-weight:700">' + esc(o.no) + '</div>' +
        '<p class="muted small" style="margin-top:8px">' +
        (o.pay === '무통장' ? '입금 기한 <b>' + esc(o.payDue) + '</b> 까지 입금해 주세요. 기한이 지나면 자동 취소되고 재고가 복원됩니다.'
          : '결제가 완료되었습니다. 거래 고유번호 <span class="mono">' + esc(o.txid) + '</span>') + '</p>' +
        '<div class="row" style="justify-content:center;margin-top:16px">' +
        '<button class="btn p" data-act="goto" data-path="/order/' + o.id + '">주문 상세 보기</button>' +
        '<button class="btn" data-act="goto" data-path="/orders">주문 내역</button>' +
        '<button class="btn gh" data-act="goto" data-path="/products">쇼핑 계속</button></div>' +
        '</div></div>' +
        '<div class="card"><div class="card-h"><h2>확정된 주문 금액</h2>' +
        '<span class="hint">이후 단가 변경의 영향을 받지 않습니다</span></div>' +
        '<div class="card-b flush">' + lineTable(o.lines, o.sum, { showSource: true }) + '</div></div>' +
        '<div class="note ac" style="margin-top:14px">' + ic('shield') + '<div class="bd">' +
        '<b>주문 금액이 안전하게 확정되었습니다</b>주문 이후 상품의 공급가가 변경되더라도 이 주문의 품목별 단가와 합계는 바뀌지 않습니다.</div></div></div>';
    },
  });

  /* =============================================== S16 주문 목록 */
  APP.route('/orders', {
    id: 'S16', title: '주문 목록',
    render: function (_, q) {
      var bid = APP.session.partner, f = q.st || '';
      var list = DB.orders.filter(function (o) { return o.partner === bid; });
      if (f) list = list.filter(function (o) { return o.status === f; });
      list = list.filter(inPeriod(q, function (o) { return o.at; }));
      var sts = ['', '결제대기', '결제완료', '준비중', '출고', '배송중', '배송완료', '취소'];
      return ph('<b>주문</b> · 목록', '주문 목록',
        '주문 당시 확정된 금액을 기준으로 표시되며, 이후 공급가가 변경되어도 과거 주문 금액은 바뀌지 않습니다.',
        '<button class="btn" data-act="excel-dl">' + ic('excel') + '엑셀 내려받기</button>', 'S16') +
        '<div class="card"><div class="fbar">' + sts.map(function (s) {
          return '<button class="btn sm ' + (f === s ? 'p' : '') + '" data-act="goto" data-path="/orders' +
            qs(q, { st: s || null }) + '">' + (s ? statusLabel(s) : '전체') + '</button>';
        }).join('') + '<span class="sp"></span><span class="cntx">' + list.length + '건</span></div>' +
        '<div class="fbar">' + periodBar('/orders', q) + '</div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>주문번호</th><th>주문일</th><th class="c">품목</th><th class="r">금액</th>' +
        '<th>결제</th><th class="c">상태</th><th>원 견적</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (o) {
          return '<tr><td><button class="lk" data-act="goto" data-path="/order/' + o.id + '">' + esc(o.no) + '</button></td>' +
            '<td class="mono small">' + esc(o.at) + '</td><td class="c">' + o.lines.length + '</td>' +
            '<td class="r">' + DB.won(o.sum.total) + '</td>' +
            '<td class="small">' + esc(o.pay) + (o.status === '결제대기' ? '<div class="small faint mono">기한 ' + esc(o.payDue) + '</div>' : '') + '</td>' +
            '<td class="c">' + stChip(o.status) + '</td>' +
            '<td>' + (o.fromQuote ? '<span class="chip ac nb">' + esc(o.fromQuote) + '</span>' : '<span class="faint small">-</span>') + '</td>' +
            '<td class="c nowrap">' + (o.status !== '취소' ?
              '<button class="btn xs p" data-act="reorder" data-id="' + o.id + '">재주문</button> ' : '') +
              '<button class="btn xs" data-act="goto" data-path="/order/' + o.id + '">상세</button></td></tr>';
        }).join('') : emptyRow(8, '주문이 없습니다')) + '</tbody></table></div></div></div>';
    },
  });

  /* =============================================== S17 주문 상세 */
  APP.route('/order/:id', {
    id: 'S17', title: '주문 상세',
    render: function (pm) {
      var o = DB.order(pm.id);
      if (!o || o.partner !== APP.session.partner) return '<div class="note dg">' + ic('alert') + '<div class="bd">주문을 찾을 수 없습니다</div></div>';
      var canClaim = ['결제완료', '준비중', '출고', '배송중', '배송완료'].indexOf(o.status) >= 0 && !o.claims.some(function (c) { return c.status !== '거절'; });
      var idx = DB.ORDER_ST.indexOf(o.status);
      var moved = o.lines.map(function (l) {
        return { l: l, now: DB.priceFor(l.product, o.partner).unit };
      }).filter(function (x) { return x.now !== x.l.unitPrice; });

      return ph('<button class="lk" data-act="goto" data-path="/orders">주문 내역</button> › <b>' + esc(o.no) + '</b>',
        '주문 ' + o.no, '주문일 ' + esc(o.at) + ' · ' + esc(o.pay) +
        (o.fromQuote ? ' · 원 견적 <b>' + esc(o.fromQuote) + '</b>' : ''),
        (o.status !== '취소' ? '<button class="btn p" data-act="reorder" data-id="' + o.id + '">' + ic('cart') + '재주문</button>' : '') +
        (canClaim ? '<button class="btn" data-act="goto" data-path="/claim/' + o.id + '">' + ic('alert') + '취소 · 반품 요청</button>' : '') +
        '<button class="btn" data-act="goto" data-path="/inquiry/order?o=' + o.id + '">' + ic('chat') + '주문 문의</button>', 'S17') +

        '<div class="card"><div class="card-h"><h2>진행 상태</h2><span style="flex:1 1 auto"></span>' + stChip(o.status) + '</div>' +
        '<div class="card-b">' +
        (o.status === '취소' || o.status === '반품 완료' ?
          '<div class="note dg">' + ic('alert') + '<div class="bd"><b>' + esc(o.status) + '</b>' +
          esc(o.cancelReason || '거래처 요청') + ' · 재고가 복원되었습니다</div></div>' :
          '<div class="steps">' + DB.ORDER_ST.map(function (s, i, arr) {
            return '<div class="s ' + (i < idx ? 'done' : i === idx ? 'now' : '') + '">' +
              '<span class="b">' + (i < idx ? '✓' : i + 1) + '</span><span>' + statusLabel(s) + '</span></div>' +
              (i < arr.length - 1 ? '<div class="ln ' + (i < idx ? 'done' : '') + '"></div>' : '');
          }).join('') + '</div>') +
        (o.status === '결제대기' ? '<div class="note wn" style="margin-top:14px">' + ic('clock') + '<div class="bd">' +
          '<b>입금 기한 ' + esc(o.payDue) + '</b>기한이 지나면 자동 취소되고 재고가 복원되며, 취소 사유에 「입금 기한 초과」가 기록됩니다.</div></div>' : '') +
        (o.invoice ? '<div class="note ac" style="margin-top:14px">' + ic('truck') + '<div class="bd">' +
          '<b>' + esc(o.courier) + ' ' + esc(o.invoice) + '</b>' +
          '<button class="btn xs" data-act="track" data-c="' + esc(o.courier) + '" data-n="' + esc(o.invoice) + '" style="margin-top:6px">택배사 배송 조회</button></div></div>' : '') +
        '</div></div>' +

        '<div class="split"><div>' +
        '<div class="card"><div class="card-h"><h2>주문 확정 품목</h2>' +
          '<span class="hint">주문 당시 확정 금액 유지</span></div>' +
          '<div class="card-b flush">' + lineTable(o.lines, o.sum, { showSource: true }) + '</div>' +
          (moved.length ? '<div class="card-f" style="display:block"><div class="note ac" style="margin:0">' + ic('shield') +
            '<div class="bd"><b>이 주문 이후 적용 단가가 바뀐 품목이 ' + moved.length + '건 있습니다</b>' +
            moved.map(function (x) {
              return '· ' + esc(x.l.name) + ' — 확정 시점 <b class="mono">' + DB.won(x.l.unitPrice) +
                '원</b> / 현재 <span class="mono">' + DB.won(x.now) + '원</span>';
            }).join('<br>') +
            '<div class="small" style="margin-top:6px">이 주문은 확정 시점 금액을 그대로 유지합니다. ' +
            '조회·통계·세금계산서 정보는 주문 당시 확정된 금액을 기준으로 처리됩니다.</div></div></div>' : '') +
        '</div></div>' +
        '<div>' +
        '<div class="card"><div class="card-h"><h2>주문 배송지</h2></div><div class="card-b">' +
        (o.ship ? '<dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' +
          '<dt>배송지</dt><dd>' + esc(o.ship.label) + '</dd>' +
          '<dt>받는 분</dt><dd>' + esc(o.ship.receiver) + '</dd>' +
          '<dt>연락처</dt><dd class="mono">' + esc(o.ship.tel) + '</dd>' +
          '<dt>주소</dt><dd>' + esc(o.ship.addr) + '</dd>' +
          (o.shipMemo ? '<dt>요청사항</dt><dd>' + esc(o.shipMemo) + '</dd>' : '') + '</dl>' +
          '<div class="small faint" style="margin-top:9px">주소록을 수정해도 이 주문의 배송지는 변하지 않습니다.</div>'
          : '<div class="faint small">배송지 정보 없음</div>') + '</div></div>' +
        '<div class="card"><div class="card-h"><h2>상태 이력</h2></div><div class="card-b"><div class="tl">' +
        o.history.slice().reverse().map(function (h, i) {
          return '<div class="it ' + (i === 0 ? 'hi' : '') + (h.st === '취소' ? ' dg' : '') + '">' +
            '<div class="tm">' + esc(h.at) + '</div><div class="tt">' + esc(statusLabel(h.st)) + '</div>' +
            '<div class="td">' + esc(h.by) + '</div></div>';
        }).join('') + '</div></div></div>' +
        (o.claims.length ? '<div class="card"><div class="card-h"><h2>취소 · 반품</h2></div><div class="card-b"><div class="stack">' +
          o.claims.map(function (c) {
            return '<div class="note ' + (c.status === '처리 완료' ? 'ok' : c.status === '거절' ? 'dg' : 'wn') + '">' + ic('alert') +
              '<div class="bd"><b>' + esc(c.kind) + ' · ' + esc(c.status) + '</b>' + esc(c.reason) +
              (c.note ? '<div class="small faint" style="margin-top:4px">관리자: ' + esc(c.note) + '</div>' : '') + '</div></div>';
          }).join('') + '</div></div></div>' : '') +
        '</div></div>';
    },
  });

  /* =============================================== S18 배송 현황 */
  APP.route('/shipping', {
    id: 'S18', title: '배송 현황',
    render: function (_, q) {
      var bid = APP.session.partner;
      var list = DB.orders.filter(function (o) {
        return o.partner === bid && ['준비중', '출고', '배송중', '배송완료'].indexOf(o.status) >= 0;
      }).filter(inPeriod(q, function (o) { return o.at; }));
      return ph('<b>배송</b> · 현황', '배송 현황',
        '등록된 택배사와 송장번호를 기준으로 배송 조회 페이지를 연결합니다.',
        '<button class="btn" data-act="excel-dl">' + ic('excel') + '엑셀 내려받기</button>', 'S18') +
        '<div class="card"><div class="fbar">' + periodBar('/shipping', q) +
        '<span class="sp"></span><span class="cntx">' + list.length + '건</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>주문번호</th><th>배송지</th><th>택배사 · 송장</th><th class="c">상태</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (o) {
          return '<tr><td><button class="lk" data-act="goto" data-path="/order/' + o.id + '">' + esc(o.no) + '</button>' +
            '<div class="small faint">' + esc(o.at) + '</div></td>' +
            '<td class="small">' + (o.ship ? esc(o.ship.label) + '<div class="faint">' + esc(o.ship.addr) + '</div>' : '-') + '</td>' +
            '<td>' + (o.invoice ? esc(o.courier) + '<div class="mono small">' + esc(o.invoice) + '</div>' : '<span class="faint small">등록 전</span>') + '</td>' +
            '<td class="c">' + stChip(o.status) + '</td>' +
            '<td class="c">' + (o.invoice ? '<button class="btn xs" data-act="track" data-c="' + esc(o.courier) +
              '" data-n="' + esc(o.invoice) + '">조회</button>' : '') + '</td></tr>';
        }).join('') : emptyRow(5, '배송 중인 주문이 없습니다')) + '</tbody></table></div></div></div>';
    },
  });

  /* ============================================ S19 취소·반품 요청 */
  APP.route('/claim/:id', {
    id: 'S19', title: '취소 · 반품 요청',
    render: function (pm) {
      var o = DB.order(pm.id);
      if (!o || o.partner !== APP.session.partner) return '<div class="note dg">' + ic('alert') + '<div class="bd">주문을 찾을 수 없습니다</div></div>';
      var canCancel = ['결제완료', '준비중'].indexOf(o.status) >= 0;
      return ph('<button class="lk" data-act="goto" data-path="/order/' + o.id + '">' + esc(o.no) + '</button> › <b>취소 · 반품 요청</b>',
        '취소 · 반품 요청', '요청 → 승인 → 처리 완료 또는 요청 → 거절로 분기해 관리합니다. 반품은 승인 후 상품 회수 · 검수를 거쳐 처리되며 <b>재고는 검수 완료 시 복원</b>됩니다.', '', 'S19') +
        '<div class="wrap nar"><div class="card"><div class="card-h"><h2>요청 내용</h2></div><div class="card-b">' +
        '<div class="f">' +
        '<div class="fr"><span class="lbl-t" id="ck-lg">요청 구분</span>' +
        '<div class="row" role="radiogroup" aria-labelledby="ck-lg">' +
          '<label class="chk"><input type="radio" name="ck" value="취소" ' + (canCancel ? 'checked' : 'disabled') + ' data-act="pick-claim"> 주문 취소' +
          (canCancel ? '' : ' <i class="faint small">(출고 이후에는 반품만 가능)</i>') + '</label>' +
          '<label class="chk"><input type="radio" name="ck" value="반품" ' + (canCancel ? '' : 'checked') + ' data-act="pick-claim"> 반품</label>' +
        '</div></div>' +
        '<div class="fr"><label>사유 <span class="req">*</span></label>' +
        '<textarea class="inp" id="cl-reason" placeholder="구체적인 사유를 적어 주세요"></textarea></div>' +
        '<div class="fr" id="cl-acc"' + (o.pay === '무통장' ? '' : ' style="display:none"') + '>' +
          '<label>환불 계좌</label><input class="inp" id="cl-bank" placeholder="은행 · 계좌번호 · 예금주">' +
          '<div class="hint">무통장 입금 건은 환불 계좌를 확인한 뒤 관리자가 처리 이력을 기록합니다. ' +
          '카드 결제 건은 기존 결제 승인을 취소하는 방식으로 환불됩니다.</div></div>' +
        '<div class="note wn">' + ic('info') + '<div class="bd"><b>취소·반품 정책</b>' +
          '현재 주문은 <b>전량 취소·전량 반품</b>만 신청할 수 있습니다. 일부 품목만 반품하려면 고객센터로 문의해 주세요.</div></div>' +
        '<div class="row end"><button class="btn" data-act="goto" data-path="/order/' + o.id + '">취소</button>' +
        '<button class="btn p" data-act="claim-send" data-id="' + o.id + '">요청 보내기</button></div>' +
        '</div></div></div>' +
        '<div class="card"><div class="card-h"><h2>대상 주문</h2></div><div class="card-b flush">' +
        lineTable(o.lines, o.sum) + '</div></div></div>';
    },
  });

  /* =============================================== S20 마이페이지 */
  APP.route('/mypage', {
    id: 'S20', title: '마이페이지',
    render: function (_, q) {
      var bid = APP.session.partner, b = DB.partner(bid), g = DB.gradeOf(bid);
      var tab = q.tab || 'company';
      var tabs = [['company', '회사 · 담당자'], ['tax', '세금계산서 정보'], ['addr', '배송지 주소록'], ['perm', '등급 · 이용 권한']];
      var body = '';
      if (tab === 'company') {
        body = '<div class="f"><div class="f2">' +
          '<div class="fr"><label>사업자등록번호</label><input class="inp" value="' + esc(b.biz) + '" readonly></div>' +
          '<div class="fr"><label>상호</label><input class="inp" value="' + esc(b.name) + '" readonly></div></div>' +
          '<div class="note wn">' + ic('lock') + '<div class="bd"><b>계약 식별 정보는 승인 후 변경됩니다</b>' +
          '사업자번호 · 상호 · 대표자 변경은 「승인 대기」 상태로 전환되어 관리자 재승인을 받습니다. ' +
          '세금계산서 정보의 근거가 되는 값이 승인 없이 바뀌지 않도록 변경 전후 값을 이력에 남깁니다.' +
          '<div class="row" style="margin-top:8px"><button class="btn sm" data-act="req-change">계약 정보 변경 신청</button></div></div></div>' +
          '<div class="f2"><div class="fr"><label>대표자</label><input class="inp" value="' + esc(b.ceo) + '" readonly></div>' +
          '<div class="fr"><label>담당자 <i class="faint small" style="font-weight:400">직접 수정 가능</i></label>' +
          '<input class="inp" id="my-mgr" value="' + esc(b.mgr) + '"></div></div>' +
          '<div class="f2"><div class="fr"><label>연락처</label><input class="inp" id="my-tel" value="' + esc(b.tel) + '"></div>' +
          '<div class="fr"><label>이메일</label><input class="inp" id="my-email" value="' + esc(b.email) + '"></div></div>' +
          '<div class="fr"><label>사업장 주소</label><input class="inp" id="my-addr" value="' + esc(b.addr) + '"></div>' +
          '<div class="row end"><button class="btn p" data-act="my-save">담당자 정보 저장</button></div></div>';
      } else if (tab === 'tax') {
        body = '<div class="f"><div class="note">' + ic('info') + '<div class="bd">' +
          '<b>세금계산서 발행 정보를 정확히 입력해 주세요</b>주문 금액은 공급가와 부가세로 구분해 관리됩니다. ' +
          '전자세금계산서 발행 전 담당자 이메일과 사업자 정보를 확인해 주세요.</div></div>' +
          '<div class="f2"><div class="fr"><label>사업자등록번호</label><input class="inp" value="' + esc(b.biz) + '" readonly></div>' +
          '<div class="fr"><label>상호</label><input class="inp" value="' + esc(b.name) + '" readonly></div></div>' +
          '<div class="f2"><div class="fr"><label>업태</label><input class="inp" id="tx-t" value="' + esc(b.biztype) + '"></div>' +
          '<div class="fr"><label>종목</label><input class="inp" id="tx-i" value="' + esc(b.bizitem) + '"></div></div>' +
          '<div class="fr"><label>계산서 담당자 이메일</label><input class="inp" id="tx-m" value="' + esc(b.taxEmail) + '"></div>' +
          '<div class="row end"><button class="btn p" data-act="tax-save">저장</button></div></div>';
      } else if (tab === 'addr') {
        var list = DB.addrOf(bid);
        body = '<div class="row" style="margin-bottom:12px"><button class="btn p sm" data-act="addr-new">' + ic('plus') + '배송지 추가</button>' +
          '<span class="small faint">기본 배송지와 추가 배송지를 등록해 주문할 때 선택할 수 있습니다.</span></div>' +
          '<div class="tw"><table class="t"><thead><tr><th>구분</th><th>받는 분</th><th>연락처</th><th>주소</th><th></th></tr></thead><tbody>' +
          (list.length ? '' : emptyRow(5, '등록된 배송지가 없습니다')) +
          list.map(function (a) {
            return '<tr><td><b>' + esc(a.label) + '</b>' + (a.def ? ' <span class="chip ok nb">기본</span>' : '') + '</td>' +
              '<td>' + esc(a.receiver) + '</td><td class="mono small">' + esc(a.tel) + '</td>' +
              '<td class="small">' + esc(a.addr) + '</td>' +
              '<td class="c"><button class="btn xs" data-act="addr-edit" data-id="' + a.id + '">수정</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        body = '<div class="grid g2">' +
          '<div><div class="sub-h" style="font-weight:700;color:var(--tx);margin-bottom:9px">등급 · 할인</div>' +
          '<dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' +
          '<dt>등급</dt><dd><b>' + esc(g.name) + '</b> <span class="faint small">' + esc(g.note) + '</span></dd>' +
          '<dt>기본 할인율</dt><dd class="mono">−' + g.rate + '%</dd>' +
          '<dt>개별 단가 품목</dt><dd class="mono">' + DB.overrides.filter(function (o) { return o.partner === bid; }).length + '건</dd>' +
          '<dt>판매 제외 품목</dt><dd class="mono">' +
            DB.products.filter(function (p) { return DB.isBlocked(bid, p.id); }).length + '건</dd></dl></div>' +
          '<div><div class="sub-h" style="font-weight:700;color:var(--tx);margin-bottom:9px">이용 권한</div>' +
          '<div class="pills">' + Object.keys(DB.PERM_LABEL).map(function (k) {
            var has = g.perms.indexOf(k) >= 0;
            return '<span class="pill ' + (has ? 'k' : '') + '">' + (has ? '✓ ' : '× ') + esc(DB.PERM_LABEL[k]) + '</span>';
          }).join('') + '</div>' +
          '<div class="small faint" style="margin-top:10px">이용 권한은 거래처 등급에 따라 부여됩니다. ' +
          '권한 변경이 필요하면 담당 영업자 또는 고객센터에 문의해 주세요.</div></div></div>' +
          '<div class="sep"></div>' +
          '<div class="tw"><table class="t"><thead><tr><th>상품</th><th class="r">기본가</th><th class="r">등급 적용가</th>' +
          '<th class="r">개별 단가</th><th>적용</th></tr></thead><tbody>' +
          DB.overrides.filter(function (o) { return o.partner === bid; }).map(function (o) {
            var p = DB.product(o.product);
            return '<tr class="em"><td><b>' + esc(p.name) + '</b><div class="small faint mono">' + esc(p.code) + '</div></td>' +
              '<td class="r mono">' + DB.won(p.basePrice) + '</td>' +
              '<td class="r mono faint">' + DB.won(Math.round(p.basePrice * (100 - g.rate) / 100)) + '</td>' +
              '<td class="r mono"><b>' + DB.won(o.price) + '</b></td>' +
              '<td><span class="chip ac nb">개별 단가 우선</span><div class="small faint">' + esc(o.memo) + '</div></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      return ph('<b>마이페이지</b>', '마이페이지',
        '회사·담당자·세금계산서 정보와 배송지 주소록을 관리할 수 있습니다. <b>등급·이용 권한</b>에서는 현재 계정에서 사용할 수 있는 기능을 확인할 수 있습니다.', '', 'S20') +
        '<div class="card"><div class="card-h" style="padding:0"><div class="tabs" role="tablist" style="border:0;flex:1 1 auto">' +
        tabs.map(function (t) {
          return '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-act="goto" data-path="/mypage?tab=' + t[0] + '">' +
            esc(t[1]) + '</button>';
        }).join('') + '</div></div><div class="card-b">' + body + '</div></div>';
    },
  });

  /* ============================================== S21 공지 · FAQ */
  APP.route('/notice', {
    id: 'S21', title: '공지 · FAQ',
    render: function (_, q) {
      var tab = q.tab || '공지';
      var list = DB.notices.filter(function (n) { return n.type === tab; });
      return ph('<b>지원</b> · 공지 · FAQ', '공지사항 · FAQ',
        '배송 일정과 단가 변경 등 주요 공지와 자주 묻는 질문을 확인할 수 있습니다.', '', 'S21') +
        '<div class="card"><div class="card-h" style="padding:0"><div class="tabs" role="tablist" style="border:0;flex:1 1 auto">' +
        ['공지', 'FAQ'].map(function (t) {
          return '<button role="tab" aria-selected="' + (tab === t) + '" data-act="goto" data-path="/notice?tab=' + t + '">' +
            t + '<span class="cnt">' + DB.notices.filter(function (n) { return n.type === t; }).length + '</span></button>';
        }).join('') + '</div></div><div class="card-b"><div class="stack">' +
        list.map(function (n) {
          return '<button class="sc" style="margin:0" data-act="notice" data-id="' + n.id + '">' +
            '<b>' + (n.pin ? '📌 ' : '') + esc(n.title) + '</b><span>' + esc(n.at) + ' · ' +
            esc(n.body.slice(0, 60)) + '…</span></button>';
        }).join('') + '</div></div></div>';
    },
  });

  /* ============================================== S22 문의 목록 */
  APP.route('/inquiries', {
    id: 'S22', title: '문의 목록',
    render: function () {
      var bid = APP.session.partner;
      var list = DB.inquiries.filter(function (q) { return q.partner === bid; });
      return ph('<b>지원</b> · 문의', '문의 내역',
        '상품 상세의 「상품 문의」와 주문 내역의 「주문 문의」 두 경로로 접수되며, 해당 상품 코드 또는 주문 번호가 문의에 자동으로 연결됩니다.',
        '<button class="btn" data-act="goto" data-path="/inquiry/product">' + ic('chat') + '상품 문의</button>' +
        '<button class="btn p" data-act="goto" data-path="/inquiry/order">' + ic('chat') + '주문 문의</button>', 'S22') +
        '<div class="card"><div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th class="c">구분</th><th>제목</th><th>연결 대상</th><th>등록일</th><th class="c">상태</th></tr></thead><tbody>' +
        (list.length ? list.map(function (q) {
          var ref = q.ref ? (q.kind === '상품' ? DB.product(q.ref) : DB.order(q.ref)) : null;
          return '<tr data-act="inq" data-id="' + q.id + '" tabindex="0" role="button" ' +
            'aria-label="' + esc(q.title) + ' 문의 상세 보기" style="cursor:pointer">' +
            '<td class="c"><span class="chip ' + (q.kind === '상품' ? 'go' : 'vi') + ' nb">' + esc(q.kind) + '</span></td>' +
            '<td><b>' + esc(q.title) + '</b></td>' +
            '<td class="small mono">' + (ref ? esc(q.kind === '상품' ? ref.code : ref.no) : '-') + '</td>' +
            '<td class="mono small">' + esc(q.at) + '</td>' +
            '<td class="c">' + (q.status === '답변완료' ? '<span class="chip ok">답변 완료</span>' : '<span class="chip wait">접수</span>') + '</td></tr>';
        }).join('') : emptyRow(5, '문의가 없습니다')) + '</tbody></table></div></div></div>';
    },
  });

  /* ========================================= S23 상품 문의 작성 */
  APP.route('/inquiry/product', {
    id: 'S23', title: '상품 문의 작성',
    render: function (_, q) {
      var bid = APP.session.partner;
      var pid = q.p || DB.products[0].id;
      var p = DB.product(pid);
      return ph('<button class="lk" data-act="goto" data-path="/inquiries">문의 내역</button> › <b>상품 문의</b>',
        '상품 문의 작성', '선택한 <b>상품 코드와 상품명이 문의에 함께 전달</b>됩니다.', '', 'S23') +
        '<div class="wrap nar"><div class="card"><div class="card-b"><div class="f">' +
        '<div class="fr"><label>연결 상품 <span class="req">*</span></label>' +
        '<select class="inp" id="iq-p">' + DB.products.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === pid ? ' selected' : '') + '>' +
            esc(x.code) + ' · ' + esc(x.name) + '</option>';
        }).join('') + '</select>' +
        '<div class="hint">현재 선택: <b class="mono">' + esc(p.code) + '</b> — 문의에 자동 첨부됩니다</div></div>' +
        '<div class="fr"><label>제목 <span class="req">*</span></label><input class="inp" id="iq-t" placeholder="예: 재입고 일정 문의"></div>' +
        '<div class="fr"><label>내용 <span class="req">*</span></label><textarea class="inp" id="iq-b" placeholder="문의 내용을 적어 주세요"></textarea></div>' +
        '<div class="note">' + ic('info') + '<div class="bd">답변이 등록되면 담당자 이메일로 알림이 발송됩니다. ' +
        '답변 내용을 수정하면 이력이 남아 나중에 무엇이라 답했는지 확인할 수 있습니다.</div></div>' +
        '<div class="row end"><button class="btn" data-act="goto" data-path="/inquiries">취소</button>' +
        '<button class="btn p" data-act="inq-send" data-kind="상품">문의 등록</button></div>' +
        '</div></div></div></div>';
    },
  });

  /* ========================================= S24 주문 문의 작성 */
  APP.route('/inquiry/order', {
    id: 'S24', title: '주문 문의 작성',
    render: function (_, q) {
      var bid = APP.session.partner;
      var mine = DB.orders.filter(function (o) { return o.partner === bid; });
      var oid = q.o || (mine[0] && mine[0].id);
      return ph('<button class="lk" data-act="goto" data-path="/inquiries">문의 내역</button> › <b>주문 문의</b>',
        '주문 문의 작성', '선택한 <b>주문 번호가 문의에 자동으로 연결</b>됩니다.', '', 'S24') +
        '<div class="wrap nar"><div class="card"><div class="card-b"><div class="f">' +
        '<div class="fr"><label>연결 주문 <span class="req">*</span></label>' +
        '<select class="inp" id="iq-o">' + (mine.length ? mine.map(function (o) {
          return '<option value="' + o.id + '"' + (o.id === oid ? ' selected' : '') + '>' +
            esc(o.no) + ' · ' + esc(o.at) + ' · ' + DB.won(o.sum.total) + '원 · ' + esc(statusLabel(o.status)) + '</option>';
        }).join('') : '<option value="">주문 내역이 없습니다</option>') + '</select></div>' +
        '<div class="fr"><label>제목 <span class="req">*</span></label><input class="inp" id="iq-t" placeholder="예: 송장번호 조회 문의"></div>' +
        '<div class="fr"><label>내용 <span class="req">*</span></label><textarea class="inp" id="iq-b"></textarea></div>' +
        '<div class="row end"><button class="btn" data-act="goto" data-path="/inquiries">취소</button>' +
        '<button class="btn p" data-act="inq-send" data-kind="주문"' + (mine.length ? '' : ' disabled') + '>문의 등록</button></div>' +
        '</div></div></div></div>';
    },
  });

  /* ==================================================== 동작 처리 */
  function foreignAttempt() {
    var others = DB.partners.filter(function (b) { return b.id !== APP.session.partner && b.status === '승인'; });
    var target = others[0];
    APP.modal({
      title: '거래처별 가격 보안 확인',
      body: '<p class="small muted">로그인한 거래처에 적용되는 상품과 공급가만 조회할 수 있습니다.</p>' +
        '<div class="note dg">' + ic('lock') + '<div class="bd"><b>가격 정보를 조회할 수 없습니다</b>' +
        esc(DB.partner(APP.session.partner).name) + ' 계정에서는 ' + esc(target.name) + '의 공급가에 접근할 수 없습니다. ' +
        '허용되지 않은 조회 시도는 보안 기록에 남습니다.</div></div>',
      foot: '<button class="btn" data-mclose="1">닫기</button>' +
        '<button class="btn p" data-act="see-audit" data-mclose="1">관리자로 전환해 감사 로그 보기</button>',
    });
    DB.attemptForeignPrice(APP.session, target.id, 'p1');
  }

  function convertFlow(qid) {
    var x = DB.quote(qid);
    if (!x || x.status !== '발송 완료' || x.converted) { toast('전환할 수 없는 견적입니다', 'dg'); return; }
    var addrs = DB.addrOf(x.partner);
    APP.modal({
      title: '견적 → 주문 전환',
      body: '<div class="note ac">' + ic('shield') + '<div class="bd"><b>금액을 다시 산정하지 않습니다</b>' +
        '견적에서 확정된 품목·수량·금액을 그대로 적용하고 원 견적 번호(<b class="mono">' + esc(x.no) + '</b>)를 주문에 남깁니다. ' +
        '주문으로 전환한 뒤에도 견적 금액은 그대로 유지됩니다.</div></div>' +
        lineTable(x.lines, x.sum) +
        '<div class="f" style="margin-top:14px">' +
        '<div class="fr"><label>배송지</label><select class="inp" id="cv-addr">' +
        addrs.map(function (a) { return '<option value="' + a.id + '"' + (a.def ? ' selected' : '') + '>' +
          esc(a.label) + ' · ' + esc(a.addr) + '</option>'; }).join('') + '</select></div>' +
        '<div class="fr"><label>결제 수단</label><select class="inp" id="cv-pay">' +
        '<option value="card">온라인 결제</option><option value="bank">무통장 입금</option></select></div></div>',
      size: 'lg',
      foot: '<button class="btn" data-mclose="1">취소</button>' +
        '<button class="btn p" data-act="cv-go" data-id="' + qid + '">주문으로 전환</button>',
    });
  }

  function noticeModal(id) {
    var n = DB.notices.filter(function (x) { return x.id === id; })[0]; if (!n) return;
    APP.modal({ title: n.title, body: '<div class="small faint" style="margin-bottom:10px">' +
      esc(n.type) + ' · ' + esc(n.at) + '</div><p>' + esc(n.body) + '</p>' });
  }
  function inqModal(id) {
    var q = DB.inquiries.filter(function (x) { return x.id === id; })[0]; if (!q) return;
    var ref = q.kind === '상품' && q.ref ? DB.product(q.ref) : null;
    APP.modal({
      title: q.title,
      body: '<div class="row" style="margin-bottom:10px"><span class="chip ' + (q.kind === '상품' ? 'go' : 'vi') + ' nb">' +
        esc(q.kind) + ' 문의</span>' + (ref ? '<span class="pill k mono">' + esc(ref.code) + ' · ' + esc(ref.name) + '</span>' : '') +
        '<span class="small faint">' + esc(q.at) + '</span></div>' +
        '<p>' + esc(q.body) + '</p>' +
        (q.answer ? '<div class="note ok" style="margin-top:12px">' + ic('chat') + '<div class="bd"><b>답변 · ' +
          esc(q.answerBy) + ' · ' + esc(q.answerAt) + '</b>' + esc(q.answer) + '</div></div>'
          : '<div class="note wn" style="margin-top:12px">' + ic('clock') + '<div class="bd">답변 대기 중입니다</div></div>'),
    });
  }
  function addrModal(id) {
    var a = id ? DB.addresses.filter(function (x) { return x.id === id; })[0] : null;
    APP.modal({
      title: a ? '배송지 수정' : '배송지 추가',
      body: '<div class="f"><div class="fr"><label>구분 이름</label><input class="inp" id="ad-l" value="' +
        esc(a ? a.label : '') + '" placeholder="예: 본사 창고"></div>' +
        '<div class="f2"><div class="fr"><label>받는 분</label><input class="inp" id="ad-r" value="' + esc(a ? a.receiver : '') + '"></div>' +
        '<div class="fr"><label>연락처</label><input class="inp" id="ad-t" value="' + esc(a ? a.tel : '') + '"></div></div>' +
        '<div class="fr"><label>주소</label><input class="inp" id="ad-a" value="' + esc(a ? a.addr : '') + '"></div>' +
        '<label class="chk"><input type="checkbox" id="ad-d"' + (a && a.def ? ' checked' : '') + '> 기본 배송지로 설정</label>' +
        '<div class="note">' + ic('info') + '<div class="bd">주소록을 수정해도 <b>이미 생성된 주문의 배송지는 변하지 않습니다.</b> ' +
        '주문을 확정할 때 선택한 배송지 정보가 주문 내역에 별도로 보관되기 때문입니다.</div></div></div>',
      foot: '<button class="btn" data-mclose="1">취소</button>' +
        '<button class="btn p" data-act="addr-save" data-id="' + (a ? a.id : '') + '">저장</button>',
    });
  }

  function bulkCheck() {
    var raw = $('#bulk').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var bid = APP.session.partner;
    var rows = [], errs = [], seen = {};
    raw.forEach(function (l, i) {
      var parts = l.split(/[,\t]+/).map(function (s) { return s.trim(); });
      var n = i + 1;
      if (parts.length < 2) { errs.push({ row: n, msg: '형식 오류 — 「상품 코드, 수량」으로 입력해 주세요: ' + l }); return; }
      var p = DB.productByCode(parts[0].toUpperCase());
      if (!p) { errs.push({ row: n, msg: '존재하지 않는 상품 코드: ' + parts[0] }); return; }
      if (DB.isBlocked(bid, p.id)) { errs.push({ row: n, msg: p.name + ' — 판매 제외 품목입니다' }); return; }
      var qty = +parts[1];
      if (seen[p.id]) {
        errs.push({ row: n, msg: p.name + ' — ' + p.code + ' 가 ' + seen[p.id] + '행에도 있습니다. 한 행으로 합쳐 주세요' });
        return;
      }
      seen[p.id] = n;
      var inCart = (DB.cart(bid).filter(function (x) { return x.product === p.id; })[0] || {}).qty || 0;
      var v = DB.validateMoq(p.id, qty);
      if (!v.ok) { errs.push({ row: n, msg: p.name + ' — ' + v.reason }); return; }
      var st2 = DB.validateStock(p.id, inCart + qty);       // 장바구니에 이미 담긴 수량까지 더해 본다
      if (!st2.ok) { errs.push({ row: n, msg: p.name + ' — ' + st2.reason +
        (inCart ? ' (장바구니 ' + inCart + ' 포함)' : '') }); return; }
      rows.push({ p: p, qty: qty });
    });
    var box = $('#bulk-res');
    if (errs.length) {
      box.innerHTML = '<div class="note dg">' + ic('alert') + '<div class="bd">' +
        '<b>' + raw.length + '행 중 ' + errs.length + '건에 오류가 있어 전체 품목을 담지 않았습니다</b>' +
        '<div class="tw" style="margin-top:8px"><table class="t"><thead><tr><th class="c">행</th><th>사유</th></tr></thead><tbody>' +
        errs.map(function (e) { return '<tr><td class="c mono">' + e.row + '</td><td>' + esc(e.msg) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="small faint" style="margin-top:8px">' +
        '부분 반영으로 인한 데이터 불일치를 막기 위해, 한 건이라도 오류가 있으면 전체를 반영하지 않습니다.</div></div></div>';
      return;
    }
    var total = rows.reduce(function (a, r) { var pr = DB.priceFor(r.p.id, bid); return a + pr.unit * r.qty; }, 0);
    box.innerHTML = '<div class="note ok">' + ic('check') + '<div class="bd"><b>' + rows.length + '행 전부 통과했습니다</b>' +
      '예상 공급가 합계 <b class="mono">' + DB.won(total) + '원</b></div></div>' +
      '<div class="tw" style="margin-top:10px"><table class="t"><thead><tr><th>상품</th><th class="r">수량</th>' +
      '<th class="r">단가</th><th class="r">공급가</th></tr></thead><tbody>' +
      rows.map(function (r) { var pr = DB.priceFor(r.p.id, bid);
        return '<tr><td>' + esc(r.p.name) + '<div class="small faint mono">' + esc(r.p.code) + '</div></td>' +
          '<td class="r">' + r.qty + '</td><td class="r mono">' + DB.won(pr.unit) + '</td>' +
          '<td class="r mono">' + DB.won(pr.unit * r.qty) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<div class="row" style="margin-top:11px"><button class="btn p" data-act="bulk-add">장바구니에 ' + rows.length + '건 담기</button></div>';
    S.bulkRows = rows;
  }

  /* -------------------------------------------------- 액션 라우터 */
  var prev = APP.onAction;
  APP.onAction = function (a, t, e) {
    var bid = APP.session && APP.session.kind === 'partner' ? APP.session.partner : null;
    switch (a) {
      case 'login-b': {
        var acc = APP.accounts().filter(function (x) { return x.kind === 'partner' && x.partner === t.getAttribute('data-b'); })[0];
        APP.login(acc);
        if (acc.status !== '승인') { go('/signup-done'); toast(acc.label + ' — ' + acc.status + ' 상태입니다', 'wn'); }
        else { go('/'); toast(acc.label + ' 계정으로 로그인했습니다', 'ok', acc.gradeName + ' 등급'); }
        break;
      }
      case 'su-file': {
        toast('사업자등록증_우리마트중동.pdf 를 선택했습니다', 'ok',
          '허용 확장자·MIME 유형·용량 검증과 악성 파일 검사를 거칩니다');
        break;
      }
      case 'su-submit': {
        var f = $('#su');
        var b = { id: 'b' + (DB.partners.length + 1), biz: f.biz.value, name: f.name.value, ceo: f.ceo.value,
          mgr: f.mgr.value, tel: f.tel.value, email: f.email.value, addr: f.addr.value, status: '대기',
          grade: 'g3', joined: DB.today(), taxEmail: f.email.value, biztype: f.biztype.value,
          bizitem: f.bizitem.value, license: '사업자등록증_' + f.name.value + '.pdf' };
        if (DB.partners.some(function (x) { return x.biz === b.biz; })) { toast('이미 등록된 사업자번호입니다', 'dg'); break; }
        DB.partners.push(b);
        DB.log(b.name, '가입 신청', b.biz);
        APP.login({ kind: 'partner', partner: b.id, label: b.name, sub: b.mgr + ' · ' + b.biz, status: '대기', gradeName: '신규' });
        go('/signup-done');
        toast('가입 신청이 접수되었습니다', 'ok', '관리자 승인 후 이용할 수 있습니다');
        break;
      }
      case 'rs-send': {
        toast('재설정 링크를 보냈습니다', 'ok', $('#rs-mail').value + ' · 30분 후 만료되는 1회용 토큰');
        break;
      }
      case 'try-blocked': {
        APP.modal({
          title: '접근 차단',
          body: '<div class="note dg">' + ic('lock') + '<div class="bd"><b>403 Forbidden</b>' +
            '승인 대기 상태에서는 상품과 거래처 전용 가격을 조회할 수 없습니다. ' +
            '승인이 완료되면 이용 가능한 메뉴가 자동으로 열립니다.' +
            '<div class="small faint mono" style="margin-top:8px">GET ' + esc(t.getAttribute('data-path')) +
            ' → 403 (status=대기)</div></div></div>',
        });
        break;
      }
      case 'prod': go('/product/' + t.getAttribute('data-id')); break;
      case 'notice': noticeModal(t.getAttribute('data-id')); break;
      case 'inq': inqModal(t.getAttribute('data-id')); break;
      case 'try-foreign': foreignAttempt(); break;
      case 'q+': case 'q-': {
        var inp = $('#pq'); var p = DB.product(APP.params.id);
        var cur = +inp.value || 0;
        inp.value = Math.max(1, cur + (a === 'q+' ? p.unit : -p.unit));
        if (APP.__pqUpd) APP.__pqUpd();
        break;
      }
      case 'add-cart': {
        var pid = t.getAttribute('data-id'), qty = +$('#pq').value || 0;
        var r = DB.cartAdd(bid, pid, qty);
        if (!r.ok) {
          toast('담기 단계에서 차단되었습니다', 'dg', r.reason);
          APP.modal({ title: '장바구니 담기 — 수량 확인', body:
            '<div class="note dg">' + ic('alert') + '<div class="bd"><b>' + esc(r.reason) + '</b>' +
            '최소 주문 수량과 주문 단위를 확인해 주세요. ' +
            '현재 입력한 수량을 확인해 주세요.' + (r.need ? '<div class="row" style="margin-top:9px">' +
            '<button class="btn sm p" data-act="fix-qty" data-v="' + r.need + '">' + r.need + '으로 맞추기</button></div>' : '') +
            '</div></div>' });
          break;
        }
        toast('장바구니에 담았습니다', 'ok', DB.product(pid).name + ' · ' + qty + '개');
        APP.rerender();
        break;
      }
      case 'fix-qty': { $('#pq').value = t.getAttribute('data-v'); if (APP.__pqUpd) APP.__pqUpd(); APP.closeModal(); break; }
      case 'quote-one': {
        S.quoteSel = [{ product: t.getAttribute('data-id'), qty: DB.product(t.getAttribute('data-id')).moq }];
        go('/quote/new'); break;
      }
      case 'c+': case 'c-': {
        var id = t.getAttribute('data-id'), p2 = DB.product(id);
        var it = DB.cart(bid).filter(function (x) { return x.product === id; })[0];
        var nq = it.qty + (a === 'c+' ? p2.unit : -p2.unit);
        var rq = DB.cartSetQty(bid, id, nq);               // 직접 입력과 같은 검증을 쓴다
        if (!rq.ok) { toast('수량을 조정할 수 없습니다', 'wn', rq.reason); break; }
        APP.rerender(); break;
      }
      case 'c-set': break;
      case 'c-del': DB.cartRemove(bid, t.getAttribute('data-id')); APP.rerender(); break;
      case 'cart-clear': DB.cartClear(bid); toast('장바구니를 비웠습니다', 'ok'); APP.rerender(); break;
      case 'ack-drift': {
        var only = S.draft ? S.draft.items.map(function (i) { return i.product; }) : null;
        DB.cartAckDrift(bid, APP.path === '/pay' ? only : null);
        toast('변동 단가를 확인했습니다', 'ok', '이제 주문을 진행할 수 있습니다');
        APP.rerender(); break;
      }
      case 'cart-quote': {
        S.quoteSel = DB.cart(bid).map(function (i) { return { product: i.product, qty: i.qty }; });
        go('/quote/new'); break;
      }
      case 'to-checkout': {
        var c = DB.cart(bid);
        if (!c.length) { toast('장바구니가 비어 있습니다', 'wn'); break; }
        var blk0 = c.filter(function (i) { return DB.isBlocked(bid, i.product); });
        if (blk0.length) { toast('판매 제외 품목이 담겨 있습니다', 'dg',
          DB.product(blk0[0].product).name + ' 외 ' + (blk0.length - 1) + '건 — 해당 행을 빼 주세요'); break; }
        var bad = c.filter(function (i) { return !DB.validateMoq(i.product, i.qty).ok; });
        if (bad.length) { toast('MOQ 기준을 충족하지 못한 품목이 있습니다', 'dg', bad.length + '건'); break; }
        var def = DB.addrOf(bid).filter(function (x) { return x.def; })[0] || DB.addrOf(bid)[0];
        S.draft = { items: c.map(function (i) { return { product: i.product, qty: i.qty }; }),
          addr: def ? def.id : null, memo: '', pay: 'card' };
        go('/checkout'); break;
      }
      case 'pick-addr': S.draft.addr = t.value; break;
      case 'pick-pay': {
        S.draft.pay = t.value;
        var bk = $('#pay-bank'); if (bk) bk.style.display = t.value === 'bank' ? '' : 'none';
        break;
      }
      case 'to-pay': {
        var mm = $('#ck-memo'); if (mm) S.draft.memo = mm.value;
        var bad2 = S.draft.items.filter(function (i) { return !DB.validateMoq(i.product, i.qty).ok; });
        if (bad2.length) { toast('주문서 작성 단계 검증에서 차단되었습니다', 'dg', bad2.length + '건'); break; }
        go('/pay'); break;
      }
      case 'place-order': {
        var d = S.draft;
        // 주문서 작성 이후 장바구니가 바뀌었을 수 있으므로 확정 직전에 다시 맞춘다
        var live = DB.cart(bid);
        var reconciled = d.items.filter(function (i) {
          var cur = live.filter(function (x) { return x.product === i.product; })[0];
          return cur && cur.qty === i.qty;
        });
        if (reconciled.length !== d.items.length) {
          var gone = d.items.filter(function (i) { return reconciled.indexOf(i) < 0; });
          toast('장바구니가 바뀌었습니다', 'dg', gone.length + '건이 장바구니와 다릅니다');
          APP.modal({ title: '최종 주문 확정 — 장바구니 대조', body:
            '<div class="note dg">' + ic('alert') + '<div class="bd">' +
            '<b>주문서를 작성한 뒤 장바구니가 바뀐 품목이 ' + gone.length + '건 있습니다</b>' +
            gone.map(function (i) {
              var cur = live.filter(function (x) { return x.product === i.product; })[0];
              return '· ' + esc(DB.product(i.product).name) + ' — ' +
                (cur ? '수량 ' + i.qty + ' → ' + cur.qty : '장바구니에서 삭제됨');
            }).join('<br>') +
            '<div class="small" style="margin-top:8px">주문은 <b>확정 시점의 장바구니</b>를 기준으로 생성됩니다. ' +
            '장바구니로 돌아가 내용을 확인한 뒤 다시 진행해 주세요.</div>' +
            '<div class="row" style="margin-top:10px">' +
            '<button class="btn p" data-act="goto" data-path="/cart" data-mclose="1">장바구니로</button></div>' +
            '</div></div>' });
          break;
        }
        var blk1 = d.items.filter(function (i) { return DB.isBlocked(bid, i.product); });
        if (blk1.length) {
          toast('판매 제외 품목이 포함되어 있습니다', 'dg', DB.product(blk1[0].product).name);
          APP.modal({ title: '최종 주문 확정 — 판매 가능 상품 확인', body:
            '<div class="note dg">' + ic('lock') + '<div class="bd">' +
            '<b>판매 제외로 지정된 품목이 ' + blk1.length + '건 있습니다</b>' +
            blk1.map(function (i) { return '· ' + esc(DB.product(i.product).name); }).join('<br>') +
            '<div class="small" style="margin-top:8px">주문서를 작성한 뒤 관리자가 판매 가능 상품을 바꾼 경우에도 ' +
            '이 단계에서 차단됩니다.</div></div></div>' });
          break;
        }
        var bad3 = d.items.map(function (i) { return { i: i, v: DB.validateMoq(i.product, i.qty) }; })
          .filter(function (x) { return !x.v.ok; });
        if (bad3.length) {
          toast('최종 확정 단계에서 차단되었습니다', 'dg', bad3[0].v.reason);
          APP.modal({ title: '최종 주문 확정 — 주문 조건 확인', body:
            '<div class="note dg">' + ic('alert') + '<div class="bd"><b>기준을 충족하지 못한 품목이 ' + bad3.length + '건 있습니다</b>' +
            bad3.map(function (x) { return '· ' + esc(DB.product(x.i.product).name) + ' — ' + esc(x.v.reason); }).join('<br>') +
            '<div class="small" style="margin-top:8px">장바구니에 담은 뒤 관리자가 MOQ를 상향한 경우도 이 단계에서 감지합니다.</div>' +
            '</div></div>' });
          break;
        }
        var drift2 = DB.cartDrift(bid).filter(function (x) { return d.items.some(function (i) { return i.product === x.product; }); });
        if (drift2.length) { toast('단가 변동을 먼저 확인해 주세요', 'wn'); break; }
        var st = d.items.filter(function (i) { return !DB.validateStock(i.product, i.qty).ok; });
        if (st.length) { toast('재고가 부족한 품목이 있습니다', 'dg', DB.product(st[0].product).name); break; }
        var payer = $('#payer');
        if (d.pay !== 'bank' && DB.pgUsed(S.txid)) {         // PG 승인 — 같은 거래번호의 중복 승인을 막는다
          toast('결제 승인이 거절되었습니다', 'dg',
            '이미 ' + DB.pgUsed(S.txid) + ' 에 승인된 거래번호입니다 (중복 승인 차단)');
          break;
        }
        var lines = d.items.map(function (i) { return DB.makeLine(i.product, i.qty, bid); });
        var o = DB.createOrder(bid, lines, { pay: d.pay, payer: payer ? payer.value : null,
          txid: d.pay !== 'bank' ? S.txid : null,
          ship: DB.addrSnapshot(d.addr), shipMemo: d.memo });
        if (o.error) {
          var isBlk = /판매 제외/.test(o.error[0].reason);
          toast('주문을 확정할 수 없습니다', 'dg', o.error[0].reason);
          APP.modal({ title: '최종 주문 확정 — ' + (isBlk ? '판매 가능 상품 확인' : '재고 확인'), body:
            '<div class="note dg">' + ic(isBlk ? 'lock' : 'alert') + '<div class="bd"><b>' +
            (isBlk ? '판매 제외로 지정된 품목이 ' : '재고가 부족한 품목이 ') + o.error.length + '건 있습니다</b>' +
            o.error.map(function (x) { return '· ' + esc(x.name) + ' — ' + esc(x.reason); }).join('<br>') +
            '<div class="small" style="margin-top:8px">' + (isBlk
              ? '현재 거래처에서 구매할 수 없는 상품입니다. 해당 상품을 제외한 뒤 다시 주문해 주세요.'
              : '다른 주문이 먼저 접수되어 가용 재고가 변경될 수 있습니다. 수량을 조정한 뒤 다시 시도해 주세요.') +
            '</div></div></div>' });
          break;
        }
        if (d.pay !== 'bank') DB.pgApprove(S.txid, o.no);    // 승인 결과를 거래번호에 묶어 둔다
        d.items.forEach(function (i) { DB.cartRemove(bid, i.product); });
        S.draft = null; S.txid = null; S.lastOrder = o.id;
        go('/order-done/' + o.id);
        toast('주문이 확정되었습니다', 'ok', o.no + ' · ' + DB.won(o.sum.total) + '원');
        break;
      }
      case 'quote-send': {
        var sel = S.quoteSel;
        if (!sel.length) { toast('요청할 품목을 추가해 주세요', 'wn'); break; }
        var lines2 = sel.map(function (s) { return DB.makeLine(s.product, s.qty, bid); });
        var mm2 = $('#qmemo'); if (mm2) S.quoteMemo = mm2.value;
        var dd2 = $('#qdue'); if (dd2) S.quoteDue = +dd2.value;
        var qq = DB.createQuote(bid, lines2, S.quoteMemo, S.quoteDue);
        if (qq.error) {
          toast('견적을 요청할 수 없습니다', 'dg', qq.error[0].reason);
          APP.modal({ title: '견적 품목 검증', body: '<div class="note dg">' + ic('alert') + '<div class="bd">' +
            '<b>기준을 충족하지 못한 품목이 ' + qq.error.length + '건 있습니다</b>' +
            qq.error.map(function (x) { return '· ' + esc(x.name) + ' — ' + esc(x.reason); }).join('<br>') +
            '<div class="small" style="margin-top:8px">견적을 주문으로 전환할 때는 금액을 다시 산정하지 않으므로, ' +
            '수량 기준은 <b>견적 생성 시점에</b> 확정해야 합니다.</div></div></div>' });
          break;
        }
        S.quoteSel = []; S.quoteInit = false; S.quoteMemo = ''; S.quoteDue = 14;
        go('/quote/' + qq.id);
        toast('견적을 요청했습니다', 'ok', qq.no);
        break;
      }
      case 'qs+': case 'qs-': {
        var id3 = t.getAttribute('data-id'), p3 = DB.product(id3);
        var s3 = S.quoteSel.filter(function (x) { return x.product === id3; })[0];
        s3.qty = Math.max(p3.moq, s3.qty + (a === 'qs+' ? p3.unit : -p3.unit));
        APP.rerender(); break;
      }
      case 'qs-del': S.quoteSel = S.quoteSel.filter(function (x) { return x.product !== t.getAttribute('data-id'); }); APP.rerender(); break;
      case 'convert': convertFlow(t.getAttribute('data-id')); break;
      case 'cv-go': {
        var qid = t.getAttribute('data-id');
        var addr = $('#cv-addr').value, pay = $('#cv-pay').value;
        var x2 = DB.quote(qid);
        var o2 = DB.convertQuote(qid, { pay: pay, ship: DB.addrSnapshot(addr) });
        if (o2.error) {
          APP.closeModal();
          toast('주문으로 전환할 수 없습니다', 'dg', o2.error[0].reason);
          APP.modal({ title: '견적 → 주문 전환 차단 — ' + x2.no, body:
            '<div class="note dg">' + ic('alert') + '<div class="bd">' +
            '<b>전환 조건을 충족하지 못했습니다</b>' +
            o2.error.map(function (x) { return '· ' + esc(x.name || '전환 조건') + ' — ' + esc(x.reason); }).join('<br>') +
            '<div class="small" style="margin-top:8px">견적의 확정 금액은 그대로 유지하며, 유효기간·주문 수량·재고는 ' +
            '<b>전환 시점에</b> 다시 확인합니다.</div></div></div>' });
          break;
        }
        APP.closeModal();
        go('/order/' + o2.id);
        toast('견적을 주문으로 전환했습니다', 'ok', x2.no + ' → ' + o2.no + ' · 견적 금액 유지');
        break;
      }
      case 'goto-order-no': {
        var oo = DB.orderByNo(t.getAttribute('data-no'));
        if (oo) go('/order/' + oo.id);
        break;
      }
      case 'track': {
        APP.modal({ title: '택배사 배송 조회',
          body: '<div class="note">' + ic('truck') + '<div class="bd"><b>' + esc(t.getAttribute('data-c')) + ' · ' +
            esc(t.getAttribute('data-n')) + '</b>등록된 송장번호로 택배사 배송 조회 페이지를 엽니다.' +
            '<div class="small faint" style="margin-top:6px">배송 정보 반영에는 택배사 사정에 따라 시간이 걸릴 수 있습니다.</div></div></div>' });
        break;
      }
      case 'claim-send': {
        var oid2 = t.getAttribute('data-id');
        var reason = $('#cl-reason').value.trim();
        if (!reason) { toast('사유를 입력해 주세요', 'wn'); $('#cl-reason').classList.add('err'); break; }
        var kindEl = document.querySelector('input[name="ck"]:checked');
        var bk2 = $('#cl-bank');
        DB.createClaim(oid2, kindEl.value, reason, bk2 ? bk2.value : '');
        go('/order/' + oid2);
        toast(kindEl.value + ' 요청을 보냈습니다', 'ok', '관리자 승인 후 처리됩니다');
        break;
      }
      case 'pick-claim': break;
      case 'my-save': {
        var b2 = DB.partner(bid);
        b2.mgr = $('#my-mgr').value; b2.tel = $('#my-tel').value;
        b2.email = $('#my-email').value; b2.addr = $('#my-addr').value;
        DB.log(b2.name, '담당자 정보 수정', b2.mgr);
        toast('담당자 정보를 저장했습니다', 'ok');
        APP.rerender(); break;
      }
      case 'req-change': {
        var bq = DB.partner(bid);
        APP.confirmBox('계약 식별 정보 변경 신청',
          '<p>사업자번호 · 상호 · 대표자를 변경하면 계정이 <b>「승인 대기」 상태로 전환</b>되어 관리자 재승인을 받아야 합니다.</p>' +
          '<div class="f" style="margin-top:12px">' +
          '<div class="fr"><label for="rc-name">상호</label><input class="inp" id="rc-name" value="' + esc(bq.name) + '"></div>' +
          '<div class="fr"><label for="rc-biz">사업자번호</label><input class="inp mono" id="rc-biz" value="' + esc(bq.biz) + '"></div>' +
          '<div class="fr"><label for="rc-ceo">대표자</label><input class="inp" id="rc-ceo" value="' + esc(bq.ceo) + '"></div></div>' +
          '<div class="note wn" style="margin-top:12px">' + ic('alert') + '<div class="bd">재승인 전까지 상품 · 가격 조회가 차단되며, ' +
          '변경 전후 값이 이력에 남습니다.</div></div>', '신청하기', function () {
            var nn = $('#rc-name').value.trim(), nb = $('#rc-biz').value.trim(), nc = $('#rc-ceo').value.trim();
            if (!nn || !nb || !nc) { toast('세 항목을 모두 입력해 주세요', 'wn'); return false; }
            var diff = [];
            if (nn !== bq.name) diff.push('상호 ' + bq.name + ' → ' + nn);
            if (nb !== bq.biz) diff.push('사업자번호 ' + bq.biz + ' → ' + nb);
            if (nc !== bq.ceo) diff.push('대표자 ' + bq.ceo + ' → ' + nc);
            if (!diff.length) { toast('변경된 항목이 없습니다', 'wn'); return false; }
            bq.pendingChange = { at: DB.today(), before: { name: bq.name, biz: bq.biz, ceo: bq.ceo },
              after: { name: nn, biz: nb, ceo: nc } };
            bq.name = nn; bq.biz = nb; bq.ceo = nc;
            bq.status = '대기';                               // 재승인 대상
            DB.log(bq.name, '계약 식별 정보 변경 신청', diff.join(' · '), 'warn');
            DB.notify('가입 승인', bq.name, bq.name + ' 계약 정보 변경 — 재승인 대기', bq.biz);
            toast('변경 신청이 접수되었습니다', 'wn', '계정이 「승인 대기」로 전환되었습니다 · 관리자 재승인 후 이용할 수 있습니다');
            go('/signup-done');
          });
        break;
      }
      case 'tax-save': {
        var b3 = DB.partner(bid);
        b3.biztype = $('#tx-t').value; b3.bizitem = $('#tx-i').value; b3.taxEmail = $('#tx-m').value;
        toast('세금계산서 정보를 저장했습니다', 'ok'); APP.rerender(); break;
      }
      case 'addr-new': addrModal(null); break;
      case 'addr-edit': addrModal(t.getAttribute('data-id')); break;
      case 'addr-save': {
        var aid = t.getAttribute('data-id');
        var lab = $('#ad-l').value.trim(), rcv = $('#ad-r').value.trim(),
          tel = $('#ad-t').value.trim(), ad = $('#ad-a').value.trim(), df = $('#ad-d').checked;
        if (!lab || !rcv || !ad) { toast('필수 항목을 입력해 주세요', 'wn'); break; }
        if (df) DB.addrOf(bid).forEach(function (x) { x.def = false; });
        if (aid) {
          var a2 = DB.addresses.filter(function (x) { return x.id === aid; })[0];
          a2.label = lab; a2.receiver = rcv; a2.tel = tel; a2.addr = ad; a2.def = df;
        } else {
          DB.addresses.push({ id: 'a' + (DB.addresses.length + 1), partner: bid, label: lab,
            receiver: rcv, tel: tel, addr: ad, def: df });
        }
        APP.closeModal();
        toast('배송지를 저장했습니다', 'ok', '기존 주문에 기록된 배송지는 바뀌지 않습니다');
        APP.rerender(); break;
      }
      case 'inq-send': {
        var kind = t.getAttribute('data-kind');
        var ti = $('#iq-t').value.trim(), bo = $('#iq-b').value.trim();
        if (!ti || !bo) { toast('제목과 내용을 입력해 주세요', 'wn'); break; }
        var refv = kind === '상품' ? $('#iq-p').value : null;
        var ono = kind === '주문' ? DB.order($('#iq-o').value) : null;
        if (kind === '주문' && !ono) { toast('연결할 주문을 선택해 주세요', 'wn'); break; }
        DB.inquiries.unshift({ id: 'q' + (DB.inquiries.length + 1), partner: bid, kind: kind,
          ref: kind === '주문' ? ono.id : refv, title: ti,
          at: DB.today() + ' ' + new Date().toTimeString().slice(0, 5),
          body: bo, status: '접수' });
        go('/inquiries');
        toast('문의를 등록했습니다', 'ok',
          kind === '상품' ? '상품 코드 ' + DB.product(refv).code + '가 자동 연결되었습니다'
            : '주문번호 ' + (ono ? ono.no : '') + ' 이 자동 연결되었습니다');
        break;
      }
      case 'excel-dl': {
        toast('엑셀 파일을 준비하고 있습니다', 'ac', '데이터가 많으면 파일 생성에 잠시 시간이 걸릴 수 있습니다');
        break;
      }
      case 'bulk-check': bulkCheck(); break;
      case 'bulk-sample': $('#bulk').value = 'PK-1010,20\nPK-2010,10\nHY-1010,8\nDP-1010,16\nCL-1010,4'; break;
      case 'bulk-clear': $('#bulk').value = ''; $('#bulk-res').innerHTML = ''; break;
      case 'bulk-add': {
        var n = 0;
        (S.bulkRows || []).forEach(function (r) { if (DB.cartAdd(bid, r.p.id, r.qty).ok) n++; });
        toast(n + '건을 장바구니에 담았습니다', 'ok');
        go('/cart'); break;
      }
      case 'ck-memo': if (S.draft) S.draft.memo = t.value; break;
      case 'qmemo': S.quoteMemo = t.value; break;
      case 'qdue': S.quoteDue = +t.value; break;
      case 'see-audit': {
        var adm = APP.accounts().filter(function (x) { return x.kind === 'admin' && x.admin === 'm1'; })[0];
        if (adm) { APP.login(adm); go('/a/accounts'); toast('최고관리자 계정으로 전환했습니다', 'ok', '감사 로그에서 차단 기록을 확인하세요'); }
        break;
      }
      case 'reorder': {
        var ro = DB.order(t.getAttribute('data-id'));
        if (!ro || ro.partner !== bid) { toast('주문을 찾을 수 없습니다', 'dg'); break; }
        var rows = ro.lines.map(function (l) {
          var pr = DB.priceFor(l.product, bid);
          var blk = DB.isBlocked(bid, l.product);
          var mv = DB.validateMoq(l.product, l.qty);
          return { l: l, now: pr ? pr.unit : null, blocked: blk, moq: mv };
        });
        var movedR = rows.filter(function (r) { return !r.blocked && r.now !== null && r.now !== r.l.unitPrice; });
        var blockedR = rows.filter(function (r) { return r.blocked || r.now === null; });
        APP.modal({
          title: '재주문 — ' + ro.no,
          size: 'lg',
          body: '<div class="note ac" style="margin-bottom:12px">' + ic('shield') + '<div class="bd">' +
            '<b>품목과 수량만 복사하고, 가격은 복사하지 않습니다</b>' +
            '장바구니에는 <b>현재 거래 조건에 따른 공급가</b>가 적용됩니다. ' +
            '지난 주문의 확정 금액은 그대로 보존됩니다.</div></div>' +
            '<div class="tw"><table class="t"><thead><tr><th>품목</th><th class="r">수량</th>' +
            '<th class="r">지난 주문 단가</th><th class="r">현재 적용 단가</th><th>비고</th></tr></thead><tbody>' +
            rows.map(function (r) {
              return '<tr class="' + (r.blocked ? '' : r.now !== r.l.unitPrice ? 'em' : '') + '">' +
                '<td><b>' + esc(r.l.name) + '</b><div class="small faint mono">' + esc(r.l.code) + '</div></td>' +
                '<td class="r mono">' + r.l.qty + '</td>' +
                '<td class="r mono faint">' + DB.won(r.l.unitPrice) + '</td>' +
                '<td class="r mono">' + (r.now === null ? '-' : '<b>' + DB.won(r.now) + '</b>') + '</td>' +
                '<td class="small">' + (r.blocked || r.now === null ? '<span class="chip dg nb">판매 제외</span>' :
                  r.now > r.l.unitPrice ? '<span class="diff-up">지난 주문 대비 변동 +' + DB.won(r.now - r.l.unitPrice) + '</span>' :
                  r.now < r.l.unitPrice ? '<span class="diff-dn">지난 주문 대비 변동 −' + DB.won(r.l.unitPrice - r.now) + '</span>' :
                  '<span class="faint">동일</span>') +
                  (!r.blocked && !r.moq.ok ? '<div class="small" style="color:var(--dg)">' + esc(r.moq.reason) + '</div>' : '') +
                  '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (movedR.length ? '<div class="note wn" style="margin-top:12px">' + ic('alert') + '<div class="bd">' +
              '<b>단가가 달라진 품목이 ' + movedR.length + '건 있습니다</b>' +
              '장바구니 화면에도 「지난 주문 대비 변동」 표시가 함께 붙습니다.</div></div>' : '') +
            (blockedR.length ? '<div class="note dg" style="margin-top:12px">' + ic('lock') + '<div class="bd">' +
              '<b>판매 제외로 지정된 품목 ' + blockedR.length + '건은 담기지 않습니다</b>' +
              '현재 판매 대상이 아니므로 재주문 품목에서도 제외됩니다.</div></div>' : ''),
          foot: '<button class="btn" data-mclose="1">취소</button>' +
            '<button class="btn p" data-act="reorder-go" data-id="' + ro.id + '">현재 시점 가격으로 장바구니에 담기</button>',
        });
        break;
      }
      case 'reorder-go': {
        var ro2 = DB.order(t.getAttribute('data-id'));
        var added = 0, skipped = 0, drifted = 0;
        ro2.lines.forEach(function (l) {
          var pr = DB.priceFor(l.product, bid);
          if (!pr || DB.isBlocked(bid, l.product)) { skipped++; return; }
          var r = DB.cartAdd(bid, l.product, l.qty);
          if (!r.ok) { skipped++; return; }
          added++;
          if (pr.unit !== l.unitPrice) {
            var it = DB.cart(bid).filter(function (x) { return x.product === l.product; })[0];
            if (it) it.reorderFrom = { no: ro2.no, unit: l.unitPrice, now: pr.unit };
            drifted++;
          }
        });
        APP.closeModal();
        go('/cart');
        toast(added + '개 품목을 장바구니에 담았습니다', added ? 'ok' : 'wn',
          '현재 공급가 적용' + (drifted ? ' · 변동 ' + drifted + '건 표시' : '') +
          (skipped ? ' · 제외 ' + skipped + '건' : ''));
        break;
      }
      case 'pg-dup': {
        var used9 = DB.pgUsed(S.txid);
        var r9 = { ok: false, reason: used9
          ? '이미 ' + used9 + ' 에 승인된 거래번호입니다 (중복 승인 차단)'
          : '이 거래번호는 주문 확정 시 한 번만 승인되며, 같은 번호로 다시 결제할 수 없습니다' };
        {
          APP.modal({ title: 'PG 중복 승인 차단', body:
            '<div class="note dg">' + ic('lock') + '<div class="bd">' +
            '<b>같은 거래 고유번호로는 두 번 승인되지 않습니다</b>' + esc(r9.reason) +
            '<div class="small" style="margin-top:8px">거래 고유번호의 사용 여부를 확인해 이중 클릭이나 새로고침으로 ' +
            '같은 결제가 두 번 처리되지 않도록 보호합니다.</div>' +
            '</div></div>' });
        }
        break;
      }
      case 'period': {
        var pth = t.getAttribute('data-path'), pdv = t.getAttribute('data-pd');
        var cur = APP.query || {};
        var nq = { pd: pdv || null };
        if (pdv !== 'custom') { nq.from = null; nq.to = null; }
        else {
          if (!cur.from) nq.from = DB.iso(DB.addD(DB.CLOCK.now, -30));
          if (!cur.to) nq.to = DB.today();
        }
        go(pth + qs(cur, nq)); break;
      }
      case 'pf': {
        var pth2 = t.getAttribute('data-path');
        var fEl = $('#pf-from'), tEl = $('#pf-to');
        go(pth2 + qs(APP.query || {}, { pd: 'custom',
          from: (fEl && fEl.value) || null, to: (tEl && tEl.value) || null }));
        break;
      }
      case 'sort': break;
      default: if (prev) prev(a, t, e);
    }
  };

  /* 수량 직접 입력 */
  document.addEventListener('change', function (e) {
    var t = e.target.closest('[data-act="c-set"]');
    if (t && APP.session && APP.session.kind === 'partner') {
      var bid = APP.session.partner, id = t.getAttribute('data-id');
      var r = DB.cartSetQty(bid, id, +t.value);
      if (!r.ok) { toast('수량을 조정할 수 없습니다', 'dg', r.reason); }
      APP.rerender();
    }
    var t2 = e.target.closest('[data-act="qs-set"]');
    if (t2) {
      var pid = t2.getAttribute('data-id');
      var v = DB.validateMoq(pid, +t2.value);
      if (!v.ok) {
        toast('견적 수량을 조정할 수 없습니다', 'dg', v.reason);
        if (v.need) { var s0 = S.quoteSel.filter(function (x) { return x.product === pid; })[0];
          if (s0) s0.qty = v.need; }
      } else {
        var s = S.quoteSel.filter(function (x) { return x.product === pid; })[0];
        if (s) s.qty = +t2.value;
      }
      APP.rerender();
    }
  });

  APP.shopState = S;
  APP.lineTable = lineTable;
  APP.stChip = stChip;
  APP.statusLabel = statusLabel;
  APP.qChip = qChip;
  APP.phHead = ph;
  APP.emptyRow = emptyRow;
  APP.priceStack = priceStack;
})();
