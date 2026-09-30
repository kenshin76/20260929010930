/* ==========================================================================
   관리자 18화면
   ========================================================================== */
(function () {
  'use strict';
  var esc = APP.esc, ic = APP.ic, go = APP.go, toast = APP.toast, $ = APP.$, $$ = APP.$$;
  var ph = APP.phHead, lineTable = APP.lineTable, stChip = APP.stChip, qChip = APP.qChip,
      statusLabel = APP.statusLabel,
      emptyRow = APP.emptyRow, priceStack = APP.priceStack;
  var A = { excelKind: 'product', excelRows: null };

  function me() { return DB.admins.filter(function (x) { return x.id === APP.session.admin; })[0]; }
  function bar(w, cls) { return '<div class="bar"><i class="' + (cls || '') + '" data-w="' + w + '"></i></div>'; }

  /* =================================================== A01 로그인 */
  APP.route('/a/login', {
    id: 'A01', title: '관리자 로그인', pub: true, bare: true, area: 'admin',
    render: function () {
      return '<div class="auth"><div class="auth-box">' +
        '<a class="auth-home" href="../index.html">' + ic('home') + '메인으로</a>' + 
        '<div class="auth-brand"><span class="brand-m">HS</span><span><b>한성상사 관리자</b>' +
        '<small>주문·상품·거래처 통합 운영 시스템</small></span></div>' +
        '<div class="card"><div class="card-h"><h2>관리자 로그인</h2></div>' +
        '<div class="card-b"><div class="f">' +
        '<div class="fr"><label>아이디</label><input class="inp" value="admin" autocomplete="username"></div>' +
        '<div class="fr"><label>비밀번호</label><input class="inp" type="password" value="demo1234" autocomplete="current-password"></div>' +
        '<button class="btn p blk" data-act="alogin" data-m="m1">로그인</button></div>' +
        '<div class="sep"></div>' +
        '<details class="trial-accounts"><summary>접속 계정 안내</summary><div class="trial-accounts-b">' +
        '<div class="small faint" style="margin-bottom:9px">역할에 따라 접근 가능한 운영 메뉴가 달라집니다.</div>' +
        DB.admins.map(function (m) {
          return '<button class="acct" data-act="alogin" data-m="' + m.id + '">' +
            '<span class="av adm">' + esc(m.name.slice(0, 1)) + '</span>' +
            '<span class="tt"><b>' + esc(m.name) + '</b><span>' + esc(m.loginId) + ' · 최근 ' + esc(m.last) + '</span></span>' +
            '<span class="chip ' + (m.role === '최고관리자' ? 'go' : m.role === '운영자' ? 'ac' : 'vi') + '">' +
            esc(m.role) + '</span></button>';
        }).join('') + '</div></details>' +
        '</div><div class="card-f"><button class="btn sm" data-act="goto" data-path="/login">← 거래처 로그인</button></div></div>' +
        '</div></div>';
    },
  });

  /* =================================================== A02 대시보드 */
  APP.route('/a', {
    id: 'A02', title: '대시보드', area: 'admin',
    render: function () {
      var wait = DB.partners.filter(function (b) { return b.status === '대기'; });
      var unpaid = DB.orders.filter(function (o) { return o.status === '결제대기'; });
      var due = unpaid.filter(function (o) { return o.payDue && o.payDue < DB.today(); });
      var qreq = DB.quotes.filter(function (q) { return q.status === '요청'; });
      var claims = []; DB.orders.forEach(function (o) { o.claims.forEach(function (c) { if (c.status === '요청') claims.push({ o: o, c: c }); }); });
      var inq = DB.inquiries.filter(function (q) { return q.status === '접수'; });
      var ship = DB.orders.filter(function (o) { return ['결제완료', '준비중'].indexOf(o.status) >= 0; });
      var low = DB.products.filter(function (p) { return p.stock < 100; }).sort(function (a, b) { return a.stock - b.stock; });
      var sales = DB.statsByPeriod();
      var thisKey = DB.today().slice(0, 7);
      var thisM = sales.filter(function (r) { return r.key === thisKey; })[0] || { total: 0, cnt: 0 };

      return ph('<b>운영</b>', '대시보드',
        esc(me().name) + ' (' + esc(me().role) + ') 님, 처리해야 할 항목입니다. 역할에 따라 접근 가능한 메뉴가 달라집니다.',
        (APP.can('order') ? '<button class="btn" data-act="run-job">' + ic('clock') + '입금 기한 지난 주문 처리</button>' : ''), 'A02') +

        (APP.can('order') && due.length ? '<div class="note wn" style="margin-bottom:14px">' + ic('alert') + '<div class="bd">' +
          '<b>입금 기한이 지난 주문이 ' + due.length + '건 있습니다</b>' +
          '처리하면 주문이 자동 취소되고 재고가 복원되며, 취소 사유에 「입금 기한 초과」가 기록됩니다.' +
          '<div class="row" style="margin-top:8px"><button class="btn sm p" data-act="run-job">지금 실행</button></div></div></div>' : '') +

        '<div class="grid g4" style="margin-bottom:16px">' +
        (APP.can('member') ? '<dl class="kpi k-dg"><dt>' + ic('user') + '가입 승인 대기</dt><dd>' + wait.length + '<em>건</em></dd>' +
          '<div class="d"><button class="btn xs" data-act="goto" data-path="/a/members">처리하기</button></div></dl>' : '') +
        (APP.can('order') ? '<dl class="kpi k-wn"><dt>' + ic('inbox') + '입금 확인 대기</dt><dd>' + unpaid.length + '<em>건</em></dd>' +
          '<div class="d">' + (due.length ? '<b style="color:var(--dg)">기한 초과 ' + due.length + '건</b>' : '기한 내') +
          ' · <button class="btn xs" data-act="goto" data-path="/a/payments">처리하기</button></div></dl>' : '') +
        (APP.can('order') ? '<dl class="kpi k-br"><dt>' + ic('doc') + '견적 요청</dt><dd>' + qreq.length + '<em>건</em></dd>' +
          '<div class="d"><button class="btn xs" data-act="goto" data-path="/a/quotes">견적서 작성</button></div></dl>' : '') +
        (APP.can('goods') ? '<dl class="kpi k-ok"><dt>' + ic('box') + '재고 주의</dt><dd>' + low.length + '<em>품목</em></dd>' +
          '<div class="d"><button class="btn xs" data-act="goto" data-path="/a/stock">재고 관리</button></div></dl>' : '') +
        '<dl class="kpi k-ac"><dt>' + ic('chart') + '이번 달 매출</dt><dd>' + DB.won(thisM.total) + '<em>원</em></dd>' +
          '<div class="d">' + esc(thisKey) + ' · 주문 ' + thisM.cnt + '건 · 확정 매출 집계</div></dl></div>' +

        '<div class="split"><div>' +
        '<div class="card"><div class="card-h"><h2>처리 대기</h2><span class="hint">클릭하면 해당 화면으로 이동합니다</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>구분</th><th>대상</th><th>내용</th><th class="c">경과</th><th></th></tr></thead><tbody>' +
        (((APP.can('member') ? wait : []).map(function (b) {
          return '<tr><td><span class="chip dg nb">가입 승인</span></td><td><b>' + esc(b.name) + '</b>' +
            '<div class="small faint mono">' + esc(b.biz) + '</div></td>' +
            '<td class="small">' + esc(b.ceo) + ' · ' + esc(b.tel) + '</td>' +
            '<td class="c small mono">' + esc(b.joined) + '</td>' +
            '<td class="c"><button class="btn xs p" data-act="goto" data-path="/a/members">처리</button></td></tr>';
        }).join('') +
        (APP.can('order') ? qreq : []).map(function (q) {
          return '<tr><td><span class="chip wait nb">견적 요청</span></td><td><b>' + esc(DB.nameOfPartner(q.partner)) + '</b>' +
            '<div class="small faint mono">' + esc(q.no) + '</div></td>' +
            '<td class="small">' + q.lines.length + '품목 · ' + DB.won(q.sum.total) + '원</td>' +
            '<td class="c small mono">' + esc(q.at) + '</td>' +
            '<td class="c"><button class="btn xs p" data-act="goto" data-path="/a/quotes">작성</button></td></tr>';
        }).join('') +
        (APP.can('order') ? claims : []).map(function (x) {
          return '<tr><td><span class="chip dg nb">' + esc(x.c.kind) + '</span></td>' +
            '<td><b>' + esc(DB.nameOfPartner(x.o.partner)) + '</b><div class="small faint mono">' + esc(x.o.no) + '</div></td>' +
            '<td class="small">' + esc(x.c.reason.slice(0, 40)) + '</td>' +
            '<td class="c small mono">' + esc(x.c.at) + '</td>' +
            '<td class="c"><button class="btn xs p" data-act="goto" data-path="/a/claims">처리</button></td></tr>';
        }).join('') +
        (APP.can('content') ? inq : []).map(function (q) {
          return '<tr><td><span class="chip vi nb">문의</span></td><td><b>' + esc(DB.nameOfPartner(q.partner)) + '</b></td>' +
            '<td class="small">' + esc(q.title) + '</td><td class="c small mono">' + esc(q.at.slice(0, 10)) + '</td>' +
            '<td class="c"><button class="btn xs p" data-act="goto" data-path="/a/content?tab=문의">답변</button></td></tr>';
        }).join('')) || emptyRow(5, '처리 대기 항목이 없습니다')) +
        '</tbody></table></div></div></div>' +

        (APP.can('ship') ? '<div class="card"><div class="card-h"><h2>출고 준비</h2>' +
          '<button class="btn xs gh" data-act="goto" data-path="/a/ship">배송 관리</button></div>' +
          '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
          '<th>주문</th><th>거래처</th><th class="r">금액</th><th class="c">상태</th><th></th></tr></thead><tbody>' +
          (ship.length ? ship.map(function (o) {
            return '<tr><td class="mono small">' + esc(o.no) + '</td><td>' + esc(DB.nameOfPartner(o.partner)) + '</td>' +
              '<td class="r">' + DB.won(o.sum.total) + '</td><td class="c">' + stChip(o.status) + '</td>' +
              '<td class="c"><button class="btn xs" data-act="a-order" data-id="' + o.id + '">상세</button></td></tr>';
          }).join('') : emptyRow(5, '출고 준비 중인 주문이 없습니다')) + '</tbody></table></div></div></div>' : '') +
        '</div>' +

        '<div>' + (APP.can('goods') ? '<div class="card"><div class="card-h"><h2>재고 주의</h2>' +
          '<button class="btn xs gh" data-act="goto" data-path="/a/stock">재고 관리</button></div>' +
          '<div class="card-b"><div class="stack">' + low.slice(0, 6).map(function (p) {
            var w = Math.min(100, p.stock / 3) + '%';
            return '<div><div class="row" style="justify-content:space-between;margin-bottom:4px">' +
              '<span class="small"><b>' + esc(p.name) + '</b></span>' +
              '<span class="stk ' + (p.stock < 80 ? 'low' : 'mid') + '">' + p.stock + '</span></div>' +
              bar(w, p.stock < 80 ? 'dg' : 'wn') + '</div>';
          }).join('') + '</div></div></div>' : '') +
        '<div class="card"><div class="card-h"><h2>최근 감사 로그</h2>' +
          '<span class="hint">가격 변경·권한 차단 기록</span></div>' +
          '<div class="card-b flush"><div class="tw" style="max-height:300px;overflow-y:auto">' +
          '<table class="t"><tbody>' + DB.audit.slice(0, 12).map(function (l) {
            return '<tr><td><div class="small"><b>' + esc(l.action) + '</b>' +
              (l.level === 'warn' ? ' <span class="chip dg nb">주의</span>' : '') + '</div>' +
              '<div class="small faint">' + esc(l.actor) + ' · ' + esc(l.detail) + '</div></td>' +
              '<td class="r small faint mono nowrap">' + esc(l.at) + '</td></tr>';
          }).join('') + '</tbody></table></div></div></div></div></div>';
    },
    onMount: function () {
      $$('.bar i[data-w]').forEach(function (el) {
        var w = el.getAttribute('data-w');
        requestAnimationFrame(function () { el.style.width = w; });
      });
    },
  });

  /* =================================================== A03 회원 승인 */
  APP.route('/a/members', {
    id: 'A03', title: '회원 승인', area: 'admin', perm: 'member',
    render: function (_, q) {
      var f = q.st || '대기';
      var list = DB.partners.filter(function (b) { return f === '전체' || b.status === f; });
      return ph('<b>거래처</b> · 회원 승인', '회원 승인',
        '가입 신청을 <b>대기 → 승인 또는 반려</b> 상태로 관리합니다. 승인 전 계정은 심사 상태만 확인할 수 있으며 상품과 거래처 전용 가격은 조회할 수 없습니다.',
        '', 'A03') +
        '<div class="card"><div class="fbar">' +
        ['대기', '승인', '반려', '전체'].map(function (s) {
          return '<button class="btn sm ' + (f === s ? 'p' : '') + '" data-act="goto" data-path="/a/members?st=' + s + '">' +
            s + ' <span class="mono">' + (s === '전체' ? DB.partners.length : DB.partners.filter(function (b) { return b.status === s; }).length) + '</span></button>';
        }).join('') + '<span class="sp"></span><span class="cntx">' + list.length + '건</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>상호 · 사업자번호</th><th>대표 · 담당자</th><th>연락처</th><th>첨부</th><th>신청일</th>' +
        '<th class="c">상태</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (b) {
          return '<tr><td><b>' + esc(b.name) + '</b><div class="small faint mono">' + esc(b.biz) + '</div></td>' +
            '<td class="small">' + esc(b.ceo) + '<div class="faint">' + esc(b.mgr) + '</div></td>' +
            '<td class="small mono">' + esc(b.tel) + '<div class="faint">' + esc(b.email) + '</div></td>' +
            '<td><button class="btn xs" data-act="view-lic" data-id="' + b.id + '">' + ic('doc') + '등록증</button></td>' +
            '<td class="small mono">' + esc(b.joined) + '</td>' +
            '<td class="c"><span class="chip ' + (b.status === '승인' ? 'ok' : b.status === '대기' ? 'wait' : 'dg') + '">' +
              esc(b.status) + '</span>' + (b.rejectReason ? '<div class="small faint" style="max-width:150px">' +
              esc(b.rejectReason.slice(0, 26)) + '…</div>' : '') + '</td>' +
            '<td class="c nowrap">' + (b.status === '대기' ?
              '<button class="btn xs p" data-act="approve" data-id="' + b.id + '">승인</button> ' +
              '<button class="btn xs dg" data-act="reject" data-id="' + b.id + '">반려</button>' :
              '<button class="btn xs" data-act="goto" data-path="/a/partners?b=' + b.id + '">상세</button>') + '</td></tr>';
        }).join('') : emptyRow(7, '해당 상태의 회원이 없습니다')) + '</tbody></table></div></div></div>';
    },
  });

  /* ================================================= A04 거래처 관리 */
  APP.route('/a/partners', {
    id: 'A04', title: '거래처 관리', area: 'admin', perm: 'member',
    render: function (_, q) {
      var sel = q.b ? DB.partner(q.b) : null;
      var list = DB.partners.filter(function (b) { return b.status === '승인'; });
      return ph('<b>거래처</b> · 관리', '거래처 관리 · 등급 · 권한',
        '거래처별 등급·할인율·개별 단가와 이용 권한을 한곳에서 관리합니다. 변경된 정책은 이후 상품 조회와 주문부터 적용됩니다.',
        '<button class="btn" data-act="grade-edit">' + ic('tag') + '등급 · 할인율 설정</button>', 'A04') +
        '<div class="split"><div><div class="card"><div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>거래처</th><th class="c">등급</th><th class="r">할인율</th><th class="c">개별 단가</th>' +
        '<th class="c">제외 품목</th><th>이용 권한</th><th></th></tr></thead><tbody>' +
        list.map(function (b) {
          var g = DB.gradeOf(b.id);
          return '<tr class="' + (sel && sel.id === b.id ? 'sel' : '') + '">' +
            '<td><b>' + esc(b.name) + '</b><div class="small faint mono">' + esc(b.biz) + '</div></td>' +
            '<td class="c"><span class="chip ' + (g.id === 'g1' ? 'ok' : g.id === 'g2' ? 'go' : 'mut') + ' nb">' + esc(g.name) + '</span></td>' +
            '<td class="r mono">−' + g.rate + '%</td>' +
            '<td class="c mono">' + DB.overrides.filter(function (o) { return o.partner === b.id; }).length + '</td>' +
            '<td class="c mono">' + DB.products.filter(function (p) { return DB.isBlocked(b.id, p.id); }).length +
              (DB.listModeOf(b.id) === 'allow' ? ' <span class="chip wn nb">허용 목록</span>' : '') + '</td>' +
            '<td><div class="pills">' + g.perms.map(function (p) {
              return '<span class="pill k">' + esc(DB.PERM_LABEL[p]) + '</span>'; }).join('') + '</div></td>' +
            '<td class="c nowrap"><button class="btn xs" data-act="grade-set" data-id="' + b.id + '">등급 변경</button> ' +
            '<button class="btn xs" data-act="goto" data-path="/a/prices?b=' + b.id + '">단가</button></td></tr>';
        }).join('') + '</tbody></table></div></div></div></div>' +
        '<div>' +
        (sel ? '<div class="card"><div class="card-h"><h2>거래처 상세</h2>' +
          '<span class="chip ' + (sel.status === '승인' ? 'ok' : sel.status === '대기' ? 'wait' : 'dg') + '">' +
          esc(sel.status) + '</span></div><div class="card-b">' +
          '<dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' +
          '<dt>상호</dt><dd><b>' + esc(sel.name) + '</b></dd>' +
          '<dt>사업자번호</dt><dd class="mono">' + esc(sel.biz) + '</dd>' +
          '<dt>대표</dt><dd>' + esc(sel.ceo) + '</dd>' +
          '<dt>담당자</dt><dd>' + esc(sel.mgr) + '</dd>' +
          '<dt>연락처</dt><dd class="mono">' + esc(sel.tel) + '</dd>' +
          '<dt>이메일</dt><dd class="mono">' + esc(sel.email) + '</dd>' +
          '<dt>신청일</dt><dd class="mono">' + esc(sel.joined) + '</dd>' +
          '<dt>등급</dt><dd>' + esc((DB.gradeOf(sel.id) || {}).name || '-') +
            ' · −' + ((DB.gradeOf(sel.id) || {}).rate || 0) + '%</dd>' +
          '<dt>개별 단가</dt><dd class="mono">' +
            DB.overrides.filter(function (o) { return o.partner === sel.id; }).length + '건</dd>' +
          '<dt>판매 제외</dt><dd class="mono">' +
            DB.products.filter(function (p) { return DB.isBlocked(sel.id, p.id); }).length + '건' +
            (DB.listModeOf(sel.id) === 'allow' ? ' (허용 목록 모드)' : '') + '</dd>' +
          '<dt>주문</dt><dd class="mono">' +
            DB.orders.filter(function (o) { return o.partner === sel.id && o.status !== '취소'; }).length + '건</dd>' +
          (sel.rejectReason ? '<dt>반려 사유</dt><dd>' + esc(sel.rejectReason) + '</dd>' : '') +
          '</dl><div class="row" style="margin-top:12px">' +
          '<button class="btn sm" data-act="view-lic" data-id="' + sel.id + '">' + ic('doc') + '사업자등록증</button>' +
          '<button class="btn sm" data-act="goto" data-path="/a/prices?b=' + sel.id + '">단가 관리</button>' +
          '<button class="btn sm" data-act="goto" data-path="/a/orders?b=' + sel.id + '">주문 내역</button>' +
          '<button class="btn sm gh" data-act="goto" data-path="/a/partners">선택 해제</button>' +
          '</div></div></div>' : '') +
        '<div class="card"><div class="card-h"><h2>등급 체계</h2>' +
        '<span class="chip ok nb">운영 중</span></div><div class="card-b">' +
        '<div class="note" style="margin-bottom:12px">' + ic('info') + '<div class="bd">' +
        '<b>거래처별 등급과 기본 할인율</b>' +
        '현재 VIP·일반·신규 3개 등급을 운영하고 있습니다. 할인율을 변경하면 이후 조회되는 공급가부터 적용되며, 이미 확정된 주문 금액은 바뀌지 않습니다.</div></div><div class="stack">' +
        DB.GRADES.map(function (g) {
          var n = DB.partners.filter(function (b) { return b.grade === g.id && b.status === '승인'; }).length;
          return '<div style="border:1px solid var(--line);border-radius:6px;padding:11px 12px">' +
            '<div class="row" style="justify-content:space-between"><b>' + esc(g.name) + '</b>' +
            '<span class="mono" style="color:var(--key-d);font-weight:700">−' + g.rate + '%</span></div>' +
            '<div class="small faint" style="margin:3px 0 7px">' + esc(g.note) + ' · 거래처 ' + n + '곳</div>' +
            '<div class="pills">' + Object.keys(DB.PERM_LABEL).map(function (k) {
              return '<span class="pill ' + (g.perms.indexOf(k) >= 0 ? 'k' : '') + '">' +
                (g.perms.indexOf(k) >= 0 ? '✓ ' : '× ') + esc(DB.PERM_LABEL[k]) + '</span>'; }).join('') + '</div></div>';
        }).join('') + '</div></div></div></div></div>';
    },
  });

  /* =============================================== A05 거래처별 단가 */
  APP.route('/a/prices', {
    id: 'A05', title: '거래처별 단가', area: 'admin', perm: 'price',
    render: function (_, q) {
      var sel = DB.partners.filter(function (x) { return x.status === '승인'; });
      var bid = q.b || (sel[0] || {}).id;
      if (!DB.partner(bid) || DB.partner(bid).status !== '승인') bid = (sel[0] || {}).id;
      var b = DB.partner(bid), g = DB.gradeOf(bid);
      if (!b || !g) return '<div class="card"><div class="card-b"><div class="note wn">' +
        ic('alert') + '<div class="bd"><b>승인된 거래처가 없습니다</b>회원 승인 화면에서 거래처를 먼저 승인해 주세요.' +
        '<div class="row" style="margin-top:10px"><button class="btn p" data-act="goto" data-path="/a/members">회원 승인으로</button></div>' +
        '</div></div></div></div>';
      var cartItems = DB.cart(bid);
      return ph('<b>거래처</b> · 단가 관리', '거래처별 단가 관리',
        '거래처에 개별 단가가 등록되어 있으면 해당 단가를 우선 적용하고, 없으면 기본가에 등급 할인을 적용합니다. ' +
        '<b>모든 단가 변경은 이력에 남습니다.</b> 판매 가능 상품은 거래처마다 <b>차단 목록 / 허용 목록</b> 중 하나를 골라 운영합니다.',
        '<button class="btn" data-act="goto" data-path="/a/goods">기본가 관리 →</button>', 'A05') +
        '<div class="card"><div class="fbar">' +
        '<span class="small">거래처</span><select class="inp" id="pb-sel">' + sel.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === bid ? ' selected' : '') + '>' + esc(x.name) + '</option>';
        }).join('') + '</select>' +
        '<span class="pill k">' + esc(g.name) + ' 등급 · −' + g.rate + '%</span>' +
        '<span class="small">판매 가능 상품</span>' +
        '<button class="btn sm ' + (DB.listModeOf(bid) === 'block' ? 'p' : '') + '" data-act="lm-set"' +
          ' data-b="' + bid + '" data-m="block">차단 목록</button>' +
        '<button class="btn sm ' + (DB.listModeOf(bid) === 'allow' ? 'p' : '') + '" data-act="lm-set"' +
          ' data-b="' + bid + '" data-m="allow">허용 목록</button>' +
        '<span class="sp"></span>' +
        '<span class="cntx">개별 단가 ' + DB.overrides.filter(function (o) { return o.partner === bid; }).length + '건</span></div>' +
        '<div style="padding:12px 16px 0"><div class="note">' + ic('shield') + '<div class="bd">' +
        '<b>현재 모드: ' + (DB.listModeOf(bid) === 'allow' ? '허용 목록' : '차단 목록') + '</b>' +
        (DB.listModeOf(bid) === 'allow'
          ? '등록된 품목<b>만</b> 판매합니다. 목록에 없는 품목은 이 거래처에게 보이지 않습니다.'
          : '기본은 전체 공개이고, 등록된 품목<b>만</b> 판매에서 제외합니다.') +
        ' 거래처의 판매 정책에 맞는 방식을 선택해 관리할 수 있습니다.' +
        '</div></div></div>' +
        (cartItems.length ? '<div style="padding:12px 16px 0"><div class="note ac">' + ic('cart') + '<div class="bd">' +
          '<b>이 거래처의 장바구니에 ' + cartItems.length + '개 품목이 담겨 있습니다</b>' +
          '아래에서 단가를 바꾸면 거래처가 주문을 확정하기 전에 <b>변경된 상품과 금액을 확인</b>하게 됩니다. ' +
          '담긴 품목: ' + cartItems.map(function (i) { return esc(DB.product(i.product).name); }).join(', ') +
          '</div></div></div>' : '') +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>상품</th><th class="r">① 기본가</th><th class="r">② 등급 적용</th><th class="r">③ 개별 단가</th>' +
        '<th>적용 결과</th><th class="c">판매 ' +
        (DB.listModeOf(bid) === 'allow' ? '(허용 목록)' : '(차단 목록)') + '</th><th></th></tr></thead><tbody>' +
        DB.products.map(function (p) {
          var ov = DB.overrideOf(bid, p.id);
          var gradeUnit = Math.round(p.basePrice * (100 - g.rate) / 100);
          var pr = DB.priceFor(p.id, bid);
          var blocked = DB.isBlocked(bid, p.id);            // 모드에 따라 판정 방향이 뒤집힌다
          var inCart = cartItems.some(function (i) { return i.product === p.id; });
          return '<tr class="' + (ov ? 'em' : '') + '"><td><b>' + esc(p.name) + '</b>' +
            (inCart ? ' <span class="chip ac nb">장바구니</span>' : '') +
            '<div class="small faint mono">' + esc(p.code) + '</div></td>' +
            '<td class="r mono">' + DB.won(p.basePrice) + '</td>' +
            '<td class="r mono faint">' + DB.won(gradeUnit) + '</td>' +
            '<td class="r">' + (ov ? '<b class="mono">' + DB.won(ov.price) + '</b>' : '<span class="faint small">미등록</span>') + '</td>' +
            '<td><b class="mono" style="color:var(--key-d)">' + DB.won(pr.unit) + '</b>' +
              '<div class="small faint">' + esc(pr.source) + '</div></td>' +
            '<td class="c"><button class="chip ' + (blocked ? 'dg' : 'ok') + ' nb" data-act="blk-tg"' +
              ' data-b="' + bid + '" data-p="' + p.id + '" data-on="' + (blocked ? '0' : '1') + '"' +
              ' aria-label="' + esc(p.name) + ' 판매 ' + (blocked ? '가능으로 되돌리기' : '제외로 지정') + '">' +
              (blocked ? '제외' : '가능') + '</button></td>' +
            '<td class="c nowrap"><button class="btn xs" data-act="ov-edit" data-b="' + bid + '" data-p="' + p.id + '">' +
              (ov ? '수정' : '등록') + '</button>' +
              (ov ? ' <button class="btn xs gh" data-act="ov-del" data-b="' + bid + '" data-p="' + p.id + '">해제</button>' : '') +
            '</td></tr>';
        }).join('') + '</tbody></table></div></div></div>' +
        '<div class="card"><div class="card-h"><h2>단가 변경 이력</h2>' +
        '<span class="hint">변경 시각·담당자·변경 전후 금액과 사유를 확인할 수 있습니다</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>시각</th><th>변경자</th><th>대상</th><th>구분</th><th class="r">변경 전</th><th class="r">변경 후</th><th>사유</th></tr></thead><tbody>' +
        DB.priceLog.slice(0, 14).map(function (l) {
          var p = l.product ? DB.product(l.product) : null;
          return '<tr><td class="mono small nowrap">' + esc(l.at) + '</td><td class="small">' + esc(l.by) + '</td>' +
            '<td class="small">' + (p ? '<b>' + esc(p.name) + '</b><div class="faint mono">' + esc(p.code) + '</div>' : '-') + '</td>' +
            '<td class="small">' + esc(l.kind) + '</td>' +
            '<td class="r mono faint">' + (l.from === null ? '-' : DB.won(l.from)) + '</td>' +
            '<td class="r mono"><b>' + (l.to === null ? '해제' : DB.won(l.to)) + '</b></td>' +
            '<td class="small faint">' + esc(l.memo) + '</td></tr>';
        }).join('') + '</tbody></table></div></div></div>';
    },
    onMount: function (_, q) {
      var s = $('#pb-sel');
      if (s) s.addEventListener('change', function () { go('/a/prices?b=' + s.value); });
      if (q.demo === 'drift') setTimeout(function () {
        var it = DB.cart('b1')[0];
        if (it) ovModal('b1', it.product);
        toast('장바구니에 담긴 품목의 단가 설정을 열었습니다', 'ac', '단가가 바뀌면 거래처의 주문 확정 전에 변경 금액이 안내됩니다');
      }, 300);
    },
  });

  /* ================================================= A06 상품 관리 */
  APP.route('/a/goods', {
    id: 'A06', title: '상품 관리', area: 'admin', perm: 'goods',
    render: function (_, q) {
      var kw = (q.q || '').trim(), cat = q.cat || '';
      var list = DB.products.filter(function (p) {
        if (cat && p.cat !== cat) return false;
        if (kw && p.name.indexOf(kw) < 0 && p.code.toUpperCase().indexOf(kw.toUpperCase()) < 0) return false;
        return true;
      });
      return ph('<b>상품</b> · 관리', '상품 관리',
        '기본가 · MOQ · 주문 단위 · 추천 플래그를 관리합니다. <b>가격 변경은 상품담당 이상만 가능하며 항상 변경자가 이력에 기록</b>됩니다.',
        '<button class="btn" data-act="goto" data-path="/a/excel?kind=product">' + ic('excel') + '엑셀 일괄</button>' +
        '<button class="btn p" data-act="goods-new">' + ic('plus') + '상품 등록</button>', 'A06') +
        '<div class="card"><div class="fbar">' +
        '<button class="btn sm ' + (!cat ? 'p' : '') + '" data-act="goto" data-path="/a/goods">전체</button>' +
        DB.CATS.map(function (c) {
          return '<button class="btn sm ' + (cat === c.id ? 'p' : '') + '" data-act="goto" data-path="/a/goods?cat=' + c.id + '">' +
            esc(c.name) + '</button>'; }).join('') +
        '<span class="sp"></span><span class="cntx">' + list.length + '건</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>상품 코드</th><th>상품명 · 규격</th><th>분류</th><th class="r">기본가</th>' +
        '<th class="r">MOQ</th><th class="r">단위</th><th class="r">재고</th><th class="c">노출</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (p) {
          return '<tr><td class="mono small">' + esc(p.code) + '</td>' +
            '<td><b>' + esc(p.name) + '</b><div class="small faint">' + esc(p.spec) + '</div></td>' +
            '<td class="small">' + esc(DB.subName(p.sub)) + '</td>' +
            '<td class="r mono"><b>' + DB.won(p.basePrice) + '</b></td>' +
            '<td class="r mono">' + p.moq + '</td><td class="r mono">' + p.unit + '</td>' +
            '<td class="r stk ' + (p.stock < 80 ? 'low' : p.stock < 140 ? 'mid' : '') + '">' + p.stock + '</td>' +
            '<td class="c">' + (DB.isNewProduct(p) ? '<span class="chip ac nb">신상품' + (p.pinNew ? ' · 고정' : '') + '</span> ' : '') +
              (p.featured ? '<span class="chip vi nb">추천 ' + p.featuredOrder + '</span>' : '') + '</td>' +
            '<td class="c nowrap"><button class="btn xs p" data-act="price-edit" data-id="' + p.id + '">기본가 변경</button> ' +
            '<button class="btn xs" data-act="goods-edit" data-id="' + p.id + '">수정</button></td></tr>';
        }).join('') : emptyRow(9, '조건에 맞는 상품이 없습니다')) + '</tbody></table></div></div></div>';
    },
    onMount: function (_, q) {
      if (q.demo === 'price') setTimeout(function () { priceModal('p1'); }, 300);
    },
  });

  /* ============================================ A07 카테고리 · 재고 */
  APP.route('/a/stock', {
    id: 'A07', title: '카테고리 · 재고', area: 'admin', perm: 'goods',
    render: function () {
      var totalStock = DB.products.reduce(function (a, p) { return a + p.stock; }, 0);
      return ph('<b>상품</b> · 카테고리 · 재고', '카테고리 · 재고 관리',
        '재고는 <b>주문 확정 시 차감, 주문 취소 시 복원, 반품은 입고·검수 완료 후 복원</b>합니다. 입금 기한 초과 자동 취소도 재고를 복원하며, ' +
        '동시에 주문이 들어와도 재고가 0 아래로 내려가지 않도록 자동으로 차단합니다.',
        '<button class="btn" data-act="goto" data-path="/a/excel?kind=product">' + ic('excel') + '재고 일괄 반영</button>', 'A07') +
        '<div class="grid g4" style="margin-bottom:16px">' +
        DB.CATS.map(function (c) {
          var ps = DB.products.filter(function (p) { return p.cat === c.id; });
          var s = ps.reduce(function (a, p) { return a + p.stock; }, 0);
          return '<dl class="kpi"><dt>' + esc(c.name) + '</dt><dd>' + DB.won(s) + '<em>개</em></dd>' +
            '<div class="d">' + ps.length + '개 품목 · 중분류 ' + c.subs.length + '</div></dl>';
        }).join('') + '</div>' +
        '<div class="split"><div><div class="card"><div class="card-h"><h2>재고 현황</h2>' +
        '<span class="hint">총 ' + DB.won(totalStock) + '개</span></div><div class="card-b flush"><div class="tw">' +
        '<table class="t"><thead><tr><th>상품</th><th>분류</th><th class="r">현재고</th>' +
        '<th style="width:140px">수준</th><th></th></tr></thead><tbody>' +
        DB.products.slice().sort(function (a, b) { return a.stock - b.stock; }).map(function (p) {
          var w = Math.min(100, p.stock / 6.5) + '%';
          return '<tr><td><b>' + esc(p.name) + '</b><div class="small faint mono">' + esc(p.code) + '</div></td>' +
            '<td class="small">' + esc(DB.subName(p.sub)) + '</td>' +
            '<td class="r stk ' + (p.stock < 80 ? 'low' : p.stock < 140 ? 'mid' : '') + '">' + p.stock + '</td>' +
            '<td>' + bar(w, p.stock < 80 ? 'dg' : p.stock < 140 ? 'wn' : '') + '</td>' +
            '<td class="c"><button class="btn xs" data-act="stock-edit" data-id="' + p.id + '">조정</button></td></tr>';
        }).join('') + '</tbody></table></div></div></div></div>' +
        '<div><div class="card"><div class="card-h"><h2>카테고리 (2단 고정)</h2>' +
        '<span class="hint">대분류와 중분류별 상품 수를 확인할 수 있습니다</span></div><div class="card-b"><div class="stack">' +
        DB.CATS.map(function (c) {
          return '<div style="border:1px solid var(--line);border-radius:6px;padding:11px 12px">' +
            '<b>' + esc(c.name) + '</b><div class="pills" style="margin-top:7px">' +
            c.subs.map(function (s) {
              var n = DB.products.filter(function (p) { return p.sub === s.id; }).length;
              return '<span class="pill">' + esc(s.name) + ' <b class="mono">' + n + '</b></span>'; }).join('') + '</div></div>';
        }).join('') + '</div></div></div></div></div>';
    },
    onMount: function () {
      $$('.bar i[data-w]').forEach(function (el) {
        var w = el.getAttribute('data-w'); requestAnimationFrame(function () { el.style.width = w; });
      });
    },
  });

  /* ================================================= A08 견적 관리 */
  APP.route('/a/quotes', {
    id: 'A08', title: '견적 관리', area: 'admin', perm: 'order',
    render: function (_, q) {
      var f = q.st || '';
      var list = DB.quotes.filter(function (x) { return !f || x.status === f; });
      var conv = DB.quotes.filter(function (x) { return x.converted; }).length;
      var sent = DB.quotes.filter(function (x) { return x.status === '발송 완료'; }).length;
      return ph('<b>운영</b> · 견적', '견적 관리',
        '<b>요청 → 검토 중 → 발송 완료</b>(또는 거절) 순으로 처리합니다. 견적서에는 <b>거래처에 적용되는 공급가가 기본값으로 입력</b>되며, ' +
        '상품별 단가를 조정할 때는 사유를 함께 기록합니다.',
        '', 'A08') +
        '<div class="grid g4" style="margin-bottom:16px">' +
        '<dl class="kpi k-wn"><dt>요청 대기</dt><dd>' + DB.quotes.filter(function (x) { return x.status === '요청'; }).length + '<em>건</em></dd>' +
          '<div class="d">검토 중 ' + DB.quotes.filter(function (x) { return x.status === '검토 중'; }).length + '건</div></dl>' +
        '<dl class="kpi k-br"><dt>발송 완료</dt><dd>' + sent + '<em>건</em></dd></dl>' +
        '<dl class="kpi k-ac"><dt>주문 전환</dt><dd>' + conv + '<em>건</em></dd>' +
          '<div class="d">전환율 ' + (sent ? Math.round(conv / sent * 100) : 0) + '%</div></dl>' +
        '<dl class="kpi"><dt>전체</dt><dd>' + DB.quotes.length + '<em>건</em></dd></dl></div>' +
        '<div class="card"><div class="fbar">' +
        ['', '요청', '검토 중', '발송 완료', '거절'].map(function (s) {
          return '<button class="btn sm ' + (f === s ? 'p' : '') + '" data-act="goto" data-path="/a/quotes' +
            (s ? '?st=' + encodeURIComponent(s) : '') + '">' + (s || '전체') + '</button>'; }).join('') +
        '<span class="sp"></span><span class="cntx">' + list.length + '건</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>견적번호</th><th>거래처</th><th>요청일</th><th class="c">품목</th><th class="r">금액</th>' +
        '<th class="c">상태</th><th>전환</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (x) {
          return '<tr><td><button class="lk" data-act="a-quote" data-id="' + x.id + '">' + esc(x.no) + '</button></td>' +
            '<td>' + esc(DB.nameOfPartner(x.partner)) + '<div class="small faint">' +
              esc((DB.gradeOf(x.partner) || {}).name) + ' 등급</div></td>' +
            '<td class="mono small">' + esc(x.at) + '</td><td class="c">' + x.lines.length + '</td>' +
            '<td class="r">' + DB.won(x.sum.total) + '</td>' +
            '<td class="c">' + qChip(x.status) + '</td>' +
            '<td>' + (x.converted ? '<span class="chip ok nb">' + esc(x.converted) + '</span>' : '<span class="faint small">-</span>') + '</td>' +
            '<td class="c nowrap">' + (x.status === '요청' ?
              '<button class="btn xs" data-act="q-review" data-id="' + x.id + '">검토 착수</button> ' +
              '<button class="btn xs p" data-act="q-write" data-id="' + x.id + '">견적서 작성</button>' :
              x.status === '검토 중' ?
              '<button class="btn xs p" data-act="q-write" data-id="' + x.id + '">견적서 작성</button> ' +
              '<button class="btn xs" data-act="a-quote" data-id="' + x.id + '">상세</button>' :
              '<button class="btn xs" data-act="a-quote" data-id="' + x.id + '">상세</button>') + '</td></tr>';
        }).join('') : emptyRow(8, '견적이 없습니다')) + '</tbody></table></div></div></div>';
    },
  });

  /* ================================================= A09 주문 관리 */
  APP.route('/a/orders', {
    id: 'A09', title: '주문 관리', area: 'admin', perm: 'order',
    render: function (_, q) {
      var f = q.st || '', bf = q.b || '';
      var list = DB.orders.filter(function (o) {
        return (!f || o.status === f) && (!bf || o.partner === bf);
      });
      var sts = ['', '결제대기', '결제완료', '준비중', '출고', '배송중', '배송완료', '취소'];
      return ph('<b>운영</b> · 주문', '주문 관리',
        '여러 건을 선택해 <b>일괄 상태 변경</b>할 수 있으며, 처리 단계를 건너뛰는 잘못된 상태 변경은 자동으로 차단됩니다.',
        '<button class="btn" data-act="bulk-adv">' + ic('up') + '선택 건 다음 단계로</button>', 'A09') +
        '<div class="card"><div class="fbar">' + sts.map(function (s) {
          return '<button class="btn sm ' + (f === s ? 'p' : '') + '" data-act="goto" data-path="/a/orders' +
            (s ? '?st=' + encodeURIComponent(s) : '') + '">' + (s ? statusLabel(s) : '전체') + '</button>'; }).join('') +
        '<span class="sp"></span>' +
        '<select class="inp" id="ob-sel"><option value="">전체 거래처</option>' +
        DB.partners.filter(function (b) { return b.status === '승인'; }).map(function (b) {
          return '<option value="' + b.id + '"' + (bf === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') +
        '</select><span class="cntx">' + list.length + '건</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th style="width:34px"><input type="checkbox" data-act="chk-all" aria-label="전체 선택"></th>' +
        '<th>주문번호</th><th>거래처</th><th>주문일</th><th class="r">금액</th><th>결제</th>' +
        '<th class="c">상태</th><th>원 견적</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (o) {
          return '<tr><td class="c"><input type="checkbox" class="ochk" value="' + o.id + '" aria-label="선택"></td>' +
            '<td><button class="lk" data-act="a-order" data-id="' + o.id + '">' + esc(o.no) + '</button></td>' +
            '<td>' + esc(DB.nameOfPartner(o.partner)) + '</td>' +
            '<td class="mono small">' + esc(o.at) + '</td>' +
            '<td class="r">' + DB.won(o.sum.total) + '</td>' +
            '<td class="small">' + esc(o.pay) + '</td>' +
            '<td class="c">' + stChip(o.status) + '</td>' +
            '<td>' + (o.fromQuote ? '<span class="chip ac nb">' + esc(o.fromQuote) + '</span>' : '<span class="faint small">-</span>') + '</td>' +
            '<td class="c nowrap">' + (o.status === '결제대기' ?
              '<button class="btn xs p" data-act="pay-ok" data-id="' + o.id + '">입금 확인</button> ' :
              DB.ST_NEXT[o.status] ?
              '<button class="btn xs" data-act="adv" data-id="' + o.id + '">→ ' + statusLabel(DB.ST_NEXT[o.status]) + '</button> ' : '') +
              '<button class="btn xs" data-act="a-order" data-id="' + o.id + '">상세</button></td></tr>';
        }).join('') : emptyRow(9, '주문이 없습니다')) + '</tbody></table></div></div></div>';
    },
    onMount: function () {
      var s = $('#ob-sel');
      if (s) s.addEventListener('change', function () { go('/a/orders' + (s.value ? '?b=' + s.value : '')); });
    },
  });

  /* ================================================= A10 입금 확인 */
  APP.route('/a/payments', {
    id: 'A10', title: '입금 확인', area: 'admin', perm: 'order',
    render: function () {
      var list = DB.orders.filter(function (o) { return o.status === '결제대기'; });
      var over = list.filter(function (o) { return o.payDue < DB.today(); });
      var recent = DB.orders.filter(function (o) { return o.cancelReason === '입금 기한 초과'; });
      return ph('<b>운영</b> · 입금', '입금 확인',
        '무통장 입금 건을 확인합니다. <b>입금 기한이 지난 주문은 취소하고 재고를 복원한 뒤 안내 메일을 발송</b>합니다. ' +
        '메일 발송에 실패한 경우에는 재시도 대기열에서 다시 처리할 수 있습니다.',
        '<button class="btn" data-act="run-job">' + ic('clock') + '기한 지난 주문 처리</button>' +
        '<button class="btn" data-act="clock" data-d="3">+3일 경과</button>', 'A10') +
        (over.length ? '<div class="note wn" style="margin-bottom:14px">' + ic('alert') + '<div class="bd">' +
          '<b>기한이 지난 주문 ' + over.length + '건</b>처리하면 주문이 자동 취소되고 재고가 복원됩니다.</div></div>' : '') +
        '<div class="card"><div class="card-h"><h2>입금 대기</h2><span class="hint">' + list.length + '건</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>주문번호</th><th>거래처</th><th>입금자명</th><th class="r">금액</th>' +
        '<th>주문일</th><th>입금 기한</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (o) {
          var late = o.payDue < DB.today();
          return '<tr class="' + (late ? 'em' : '') + '"><td><button class="lk" data-act="a-order" data-id="' + o.id + '">' +
            esc(o.no) + '</button></td>' +
            '<td>' + esc(DB.nameOfPartner(o.partner)) + '</td>' +
            '<td class="small">' + esc(o.payer) + '</td>' +
            '<td class="r"><b>' + DB.won(o.sum.total) + '</b></td>' +
            '<td class="mono small">' + esc(o.at) + '</td>' +
            '<td class="mono small ' + (late ? 'diff-up' : '') + '">' + esc(o.payDue) +
              (late ? '<div class="small">기한 초과</div>' : '') + '</td>' +
            '<td class="c nowrap"><button class="btn xs p" data-act="pay-ok" data-id="' + o.id + '">입금 확인</button> ' +
            '<button class="btn xs dg" data-act="pay-cancel" data-id="' + o.id + '">취소</button></td></tr>';
        }).join('') : emptyRow(7, '입금 대기 주문이 없습니다')) + '</tbody></table></div></div></div>' +
        (recent.length ? '<div class="card"><div class="card-h"><h2>자동 취소 이력</h2>' +
          '<span class="hint">재고 복원 완료 · 취소 사유 「입금 기한 초과」</span></div>' +
          '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
          '<th>주문번호</th><th>거래처</th><th class="r">금액</th><th>복원된 재고</th></tr></thead><tbody>' +
          recent.map(function (o) {
            return '<tr><td class="mono small">' + esc(o.no) + '</td><td>' + esc(DB.nameOfPartner(o.partner)) + '</td>' +
              '<td class="r">' + DB.won(o.sum.total) + '</td>' +
              '<td class="small">' + o.lines.map(function (l) { return esc(l.code) + ' +' + l.qty; }).join(', ') + '</td></tr>';
          }).join('') + '</tbody></table></div></div></div>' : '');
    },
    onMount: function (_, q) {
      if (q.demo === 'deadline') setTimeout(function () {
        toast('「+3일 경과」를 누른 뒤 스케줄러를 실행해 보세요', 'ac', '기한이 지난 주문이 자동 취소되고 재고가 복원됩니다');
      }, 260);
    },
  });

  /* =============================================== A11 배송 · 송장 */
  APP.route('/a/ship', {
    id: 'A11', title: '배송 · 송장', area: 'admin', perm: 'ship',
    render: function () {
      var list = DB.orders.filter(function (o) {
        return ['결제완료', '준비중', '출고', '배송중', '배송완료'].indexOf(o.status) >= 0; });
      return ph('<b>운영</b> · 배송', '배송 · 송장 관리',
        '출고 대상 목록을 엑셀로 내려받아 송장번호를 채워 다시 업로드하는 왕복 구조를 지원합니다. 송장번호에는 <b>택배사 코드를 함께 저장</b>합니다.',
        '<button class="btn" data-act="ship-dl">' + ic('excel') + '출고 대상 내려받기</button>' +
        '<button class="btn p" data-act="goto" data-path="/a/excel?kind=invoice">' + ic('up') + '송장 일괄 등록</button>', 'A11') +
        '<div class="card"><div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>주문번호</th><th>거래처</th><th>배송지</th><th>택배사 · 송장</th><th class="c">상태</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (o) {
          return '<tr><td><button class="lk" data-act="a-order" data-id="' + o.id + '">' + esc(o.no) + '</button></td>' +
            '<td>' + esc(DB.nameOfPartner(o.partner)) + '</td>' +
            '<td class="small">' + (o.ship ? '<b>' + esc(o.ship.label) + '</b><div class="faint">' +
              esc(o.ship.receiver) + ' · ' + esc(o.ship.addr.slice(0, 26)) + '…</div>' : '-') + '</td>' +
            '<td>' + (o.invoice ? esc(o.courier) + '<div class="mono small">' + esc(o.invoice) + '</div>' :
              '<span class="faint small">미등록</span>') + '</td>' +
            '<td class="c">' + stChip(o.status) + '</td>' +
            '<td class="c nowrap"><button class="btn xs" data-act="inv-edit" data-id="' + o.id + '">' +
              (o.invoice ? '송장 수정' : '송장 등록') + '</button>' +
              (DB.ST_NEXT[o.status] ? ' <button class="btn xs p" data-act="adv" data-id="' + o.id + '">→ ' +
                statusLabel(DB.ST_NEXT[o.status]) + '</button>' : '') + '</td></tr>';
        }).join('') : emptyRow(6, '배송 대상 주문이 없습니다')) + '</tbody></table></div></div></div>';
    },
  });

  /* =============================================== A12 취소 · 반품 */
  APP.route('/a/claims', {
    id: 'A12', title: '취소 · 반품', area: 'admin', perm: 'order',
    render: function () {
      var rows = [];
      DB.orders.forEach(function (o) { o.claims.forEach(function (c) { rows.push({ o: o, c: c }); }); });
      return ph('<b>운영</b> · 취소 · 반품', '취소 · 반품 처리',
        '<b>요청 → 승인 → 처리 완료</b> 또는 <b>요청 → 거절</b>로 관리합니다. 카드 결제 취소는 승인 후 PG 취소로 처리하고, ' +
        '무통장 입금은 환불 계좌를 확인한 뒤 처리 이력을 기록합니다. 반품은 <b>상품 회수 · 검수 완료 시 재고가 복원</b>됩니다.',
        '', 'A12') +
        '<div class="card"><div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th class="c">구분</th><th>주문</th><th>거래처</th><th>사유</th><th>결제</th>' +
        '<th class="c">상태</th><th></th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (x) {
          var st = x.c.status;
          return '<tr><td class="c"><span class="chip ' + (x.c.kind === '취소' ? 'wait' : 'vi') + ' nb">' + esc(x.c.kind) + '</span></td>' +
            '<td><button class="lk" data-act="a-order" data-id="' + x.o.id + '">' + esc(x.o.no) + '</button>' +
            '<div class="small faint">' + DB.won(x.o.sum.total) + '원</div></td>' +
            '<td>' + esc(DB.nameOfPartner(x.o.partner)) + '</td>' +
            '<td class="small">' + esc(x.c.reason) + (x.c.note ? '<div class="faint">' + esc(x.c.note) + '</div>' : '') + '</td>' +
            '<td class="small">' + esc(x.o.pay) + (x.c.refundAcc ? '<div class="faint mono">' + esc(x.c.refundAcc) + '</div>' : '') + '</td>' +
            '<td class="c"><span class="chip ' + (st === '처리 완료' ? 'ok' : st === '거절' ? 'dg' : st === '승인' ? 'go' : 'wait') + '">' +
              esc(st) + '</span></td>' +
            '<td class="c nowrap">' + (st === '요청' ?
              '<button class="btn xs p" data-act="cl-ok" data-o="' + x.o.id + '" data-c="' + x.c.id + '">승인</button> ' +
              '<button class="btn xs dg" data-act="cl-no" data-o="' + x.o.id + '" data-c="' + x.c.id + '">거절</button>' :
              st === '승인' ? '<button class="btn xs p" data-act="cl-done" data-o="' + x.o.id + '" data-c="' + x.c.id + '">처리 완료</button>' : '') +
            '</td></tr>';
        }).join('') : emptyRow(7, '취소 · 반품 요청이 없습니다')) + '</tbody></table></div></div></div>' +
        (DB.refundLog.length ? '<div class="card"><div class="card-h"><h2>환불 처리 이력</h2>' +
          '<span class="hint">카드 결제는 PG 취소 결과를, 무통장은 환불 계좌와 처리 내역을 기록합니다</span></div>' +
          '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
          '<th>처리 시각</th><th>주문</th><th>거래처</th><th class="c">구분</th>' +
          '<th class="r">환불 금액</th><th>경로</th><th>참조</th><th>처리자</th></tr></thead><tbody>' +
          DB.refundLog.map(function (r) {
            return '<tr><td class="mono small nowrap">' + esc(r.at) + '</td>' +
              '<td class="mono small">' + esc(r.order) + '</td><td>' + esc(r.partner) + '</td>' +
              '<td class="c"><span class="chip ' + (r.kind === '취소' ? 'wait' : 'vi') + ' nb">' + esc(r.kind) + '</span></td>' +
              '<td class="r mono"><b>' + DB.won(r.amount) + '</b></td>' +
              '<td class="small">' + esc(r.via) + '</td>' +
              '<td class="mono small faint">' + esc(r.ref) + '</td>' +
              '<td class="small">' + esc(r.by) + '</td></tr>';
          }).join('') + '</tbody></table></div></div></div>' : '');
    },
  });

  /* ==================================================== A13 통계 */
  APP.route('/a/stats', {
    id: 'A13', title: '통계', area: 'admin', perm: 'stat',
    render: function (_, q) {
      var tab = q.tab || 'period';
      var body = '';
      if (tab === 'period') {
        var rows = DB.statsByPeriod();
        var max = Math.max.apply(null, rows.map(function (r) { return r.total; }).concat([1]));
        body = '<div class="tw"><table class="t"><thead><tr><th>기간</th><th class="r">주문 건수</th>' +
          '<th class="r">공급가</th><th class="r">부가세</th><th class="r">합계</th><th style="width:180px">비중</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td class="mono">' + esc(r.key) + '</td><td class="r">' + r.cnt + '</td>' +
              '<td class="r mono">' + DB.won(r.supply) + '</td><td class="r mono">' + DB.won(r.vat) + '</td>' +
              '<td class="r mono"><b>' + DB.won(r.total) + '</b></td>' +
              '<td>' + bar(Math.round(r.total / max * 100) + '%') + '</td></tr>';
          }).join('') + '</tbody><tfoot><tr><td>합계</td>' +
          '<td class="r">' + rows.reduce(function (a, r) { return a + r.cnt; }, 0) + '</td>' +
          '<td class="r">' + DB.won(rows.reduce(function (a, r) { return a + r.supply; }, 0)) + '</td>' +
          '<td class="r">' + DB.won(rows.reduce(function (a, r) { return a + r.vat; }, 0)) + '</td>' +
          '<td class="r">' + DB.won(rows.reduce(function (a, r) { return a + r.total; }, 0)) + '</td><td></td></tr></tfoot></table></div>';
      } else if (tab === 'partner') {
        var rows2 = DB.statsByPartner();
        var max2 = Math.max.apply(null, rows2.map(function (r) { return r.total; }).concat([1]));
        body = '<div class="tw"><table class="t"><thead><tr><th>거래처</th><th class="c">등급</th>' +
          '<th class="r">주문 건수</th><th class="r">수량</th><th class="r">매출</th><th style="width:180px">비중</th></tr></thead><tbody>' +
          rows2.map(function (r) {
            var g = DB.gradeOf(r.partner);
            return '<tr><td><b>' + esc(r.name) + '</b></td>' +
              '<td class="c"><span class="chip mut nb">' + esc(g ? g.name : '-') + '</span></td>' +
              '<td class="r">' + r.cnt + '</td><td class="r mono">' + DB.won(r.qty) + '</td>' +
              '<td class="r mono"><b>' + DB.won(r.total) + '</b></td>' +
              '<td>' + bar(Math.round(r.total / max2 * 100) + '%', 'ac') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        var rows3 = DB.statsByProduct();
        var max3 = Math.max.apply(null, rows3.map(function (r) { return r.total; }).concat([1]));
        body = '<div class="tw"><table class="t"><thead><tr><th>상품</th><th class="r">판매 수량</th>' +
          '<th class="r">매출</th><th style="width:180px">비중</th></tr></thead><tbody>' +
          rows3.map(function (r) {
            return '<tr><td><b>' + esc(r.name) + '</b><div class="small faint mono">' + esc(r.code) + '</div></td>' +
              '<td class="r mono">' + DB.won(r.qty) + '</td><td class="r mono"><b>' + DB.won(r.total) + '</b></td>' +
              '<td>' + bar(Math.round(r.total / max3 * 100) + '%', 'wn') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      return ph('<b>분석</b> · 통계', '통계',
        '<b>주문 당시 확정된 금액</b>을 기준으로 매출과 판매 수량을 집계합니다. 공급가가 변경되어도 과거 기간의 통계는 바뀌지 않습니다.',
        '<button class="btn" data-act="stat-dl">' + ic('excel') + '엑셀 내려받기</button>', 'A13') +
        '<div class="note ac" style="margin-bottom:14px">' + ic('chart') + '<div class="bd">' +
        '<b>운영 리포트</b>기간별 매출·거래처별 구매 내역·상품별 판매 현황을 조회하고 엑셀로 내려받을 수 있습니다.</div></div>' +
        '<div class="card"><div class="card-h" style="padding:0"><div class="tabs" role="tablist" style="border:0;flex:1 1 auto">' +
        [['period', '기간별 매출·주문 현황'], ['partner', '거래처별 구매 내역·매출'], ['product', '상품별 매출']].map(function (t) {
          return '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-act="goto" data-path="/a/stats?tab=' + t[0] + '">' +
            esc(t[1]) + '</button>'; }).join('') + '</div></div><div class="card-b flush">' + body + '</div></div>';
    },
    onMount: function () {
      $$('.bar i[data-w]').forEach(function (el) {
        var w = el.getAttribute('data-w'); requestAnimationFrame(function () { el.style.width = w; });
      });
    },
  });

  /* ========================================= A14 엑셀 업로드 센터 */
  function permOfKind(k) { return k === 'invoice' ? 'ship' : k === 'order' ? 'order' : 'goods'; }
  /** ?kind 가 없으면 지금 계정이 실제로 쓸 수 있는 종류를 기본값으로 삼는다 */
  function defaultKind(q) {
    var k = q.kind || A.excelKind || 'product';
    if (!DB.EXCEL_KINDS[k]) k = 'product';
    if (!q.kind && !APP.can(permOfKind(k))) {
      var pick = Object.keys(DB.EXCEL_KINDS).filter(function (x) { return APP.can(permOfKind(x)); })[0];
      if (pick) k = pick;
    }
    return k;
  }
  var SAMPLES = {
    product: { good: [['PK-1010', '택배박스 1호', '24500', '10', '5', '660'], ['PK-1020', '택배박스 3호', '31500', '10', '5', '430']],
      bad: [['PK-1010', '택배박스 1호', '24500', '10', '5', '660'], ['PK-9999', '없는상품', '31500', '10', '5', '430'], ['PK-1030', '완충 에어캡', '0', '6', '2', '210']] },
    order: { good: [['128-81-45723', 'PK-1010', '20'], ['214-88-10231', 'PK-2010', '10']],
      bad: [['128-81-45723', 'PK-1010', '20'], ['311-05-88120', 'PK-2010', '10'], ['214-88-10231', 'HY-1010', '3']] },
    price: { good: [['128-81-45723', 'PK-1010', '20100'], ['214-88-10231', 'PK-2010', '25500']],
      bad: [['128-81-45723', 'PK-1010', '20100'], ['999-99-99999', 'PK-2010', '25500']] },
    invoice: { good: [], bad: [] },
  };
  APP.route('/a/excel', {
    id: 'A14', title: '엑셀 업로드 센터', area: 'admin',
    perm: function (q) { return permOfKind(defaultKind(q)); },
    render: function (_, q) {
      var kind = defaultKind(q);
      A.excelKind = kind;
      var K = DB.EXCEL_KINDS[kind];
      if (kind === 'invoice') {
        var ship = DB.orders.filter(function (o) { return ['결제완료', '준비중', '출고'].indexOf(o.status) >= 0; });
        SAMPLES.invoice.good = ship.slice(0, 2).map(function (o) { return [o.no, 'CJ대한통운', String(6 + Math.floor(Math.random() * 3)) + '48201553' + (100 + ship.indexOf(o))]; });
        SAMPLES.invoice.bad = ship.slice(0, 1).map(function (o) { return [o.no, 'CJ대한통운', '648201553999']; })
          .concat([['OD-20260101-999', '롯데택배', '310558820114'], [(ship[0] || {}).no || 'OD-0', '', 'abc123']]);
      }
      return ph('<b>분석</b> · 엑셀', '엑셀 업로드 센터',
        '파일의 모든 행을 먼저 확인합니다. <b>오류가 한 건이라도 있으면 파일 전체를 반영하지 않으며</b>, ' +
        '오류가 있는 행과 사유를 결과 파일에서 확인할 수 있습니다.',
        '', 'A14') +
        '<div class="card"><div class="fbar">' +
        Object.keys(DB.EXCEL_KINDS).filter(function (k) { return APP.can(permOfKind(k)); }).map(function (k) {
          return '<button class="btn sm ' + (kind === k ? 'p' : '') + '" data-act="goto" data-path="/a/excel?kind=' + k + '">' +
            esc(DB.EXCEL_KINDS[k].label) + '</button>'; }).join('') +
        '<span class="sp"></span>' +
        '<button class="btn sm" data-act="ex-tpl">' + ic('doc') + '양식 내려받기</button></div>' +
        '<div class="card-b">' +
        '<div class="note" style="margin-bottom:14px">' + ic('info') + '<div class="bd">' +
        '<b>' + esc(K.label) + ' 업로드 양식</b>' + K.cols.map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join(' ') +
        (kind === 'order' ? '<div class="small" style="margin-top:7px">전화·팩스로 받은 주문의 일괄 등록용입니다. ' +
          '<b>업로드한 주문에도 거래처별 공급가와 최소 주문 수량 기준이 동일하게 적용됩니다.</b></div>' : '') +
        '</div></div>' +
        '<div class="row" style="margin-bottom:12px">' +
        '<button class="btn" data-act="ex-load" data-s="good">정상 파일 불러오기</button>' +
        '<button class="btn dg" data-act="ex-load" data-s="bad">오류 포함 파일 불러오기</button>' +
        '<span class="small faint">파일을 고른 뒤 「검증 후 반영」을 누르세요</span></div>' +
        '<div id="ex-box"></div>' +
        '</div></div>';
    },
    onMount: function (_, q) {
      if (q.demo === 'excel') setTimeout(function () {
        loadSample('bad');
        toast('오류가 포함된 파일을 불러왔습니다', 'wn', '「검증 후 반영」을 눌러 오류 내용을 확인하세요');
      }, 280);
    },
  });

  function loadSample(which) {
    var kind = A.excelKind, K = DB.EXCEL_KINDS[kind];
    var rows = SAMPLES[kind][which] || [];
    A.excelRows = rows;
    $('#ex-box').innerHTML =
      '<div class="card" style="box-shadow:none"><div class="card-h"><h2>' +
      esc(K.label) + '_업로드_' + (which === 'bad' ? '오류포함' : '정상') + '.xlsx</h2>' +
      '<span class="hint">' + rows.length + '행</span></div><div class="card-b flush"><div class="tw">' +
      '<table class="t"><thead><tr><th class="c">행</th>' + K.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r, i) {
        return '<tr><td class="c mono faint">' + (i + 2) + '</td>' +
          r.map(function (v) { return '<td class="mono small">' + esc(v) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="card-f"><button class="btn p" data-act="ex-run">검증 후 반영</button>' +
      '<button class="btn" data-act="ex-validate">검증만</button></div></div>' +
      '<div id="ex-res" style="margin-top:14px"></div>';
  }
  function excelRun(apply) {
    var kind = A.excelKind, rows = A.excelRows || [];
    var v = apply ? DB.excelApply(kind, rows) : DB.excelValidate(kind, rows);
    var box = $('#ex-res');
    if (!v.ok) {
      box.innerHTML = '<div class="note dg">' + ic('alert') + '<div class="bd">' +
        '<b>' + v.total + '행 중 ' + v.errors.length + '건에 오류가 있어 파일 전체를 반영하지 않았습니다</b>' +
        '오류 행 번호와 사유를 기재한 결과 파일을 반환합니다.' +
        '<div class="tw" style="margin-top:9px"><table class="t"><thead><tr><th class="c">행</th><th>열</th><th>사유</th></tr></thead><tbody>' +
        v.errors.map(function (e) {
          return '<tr><td class="c mono">' + e.row + '</td><td class="small">' + esc(e.col) + '</td>' +
            '<td class="small">' + esc(e.msg) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' +
        '<div class="row" style="margin-top:9px"><button class="btn sm" data-act="ex-report">결과 파일 내려받기</button></div>' +
        '</div></div>';
      toast('파일을 반영하지 않았습니다', 'dg', v.errors.length + '건의 오류를 확인해 주세요');
    } else {
      box.innerHTML = '<div class="note ok">' + ic('check') + '<div class="bd">' +
        '<b>' + v.total + '행 전부 검증을 통과했습니다</b>' +
        (apply ? '전체가 반영되었습니다. 가격이 바뀐 항목은 변경 이력에 기록됩니다.' : '「검증 후 반영」을 누르면 전체가 반영됩니다.') +
        '</div></div>';
      toast(apply ? '전체 행 반영 완료' : '검증 통과', 'ok', v.total + '행');
      if (apply) setTimeout(function () { APP.rerender(); }, 600);
    }
  }

  /* =========================================== A15 알림 발송 이력 */
  APP.route('/a/noti', {
    id: 'A15', title: '알림 발송 이력', area: 'admin', perm: 'content',
    render: function (_, q) {
      var f = q.k || '';
      var list = DB.notifications.filter(function (n) { return !f || n.kind === f; });
      return ph('<b>분석</b> · 알림', '알림 발송 이력',
        '가입·견적·주문·입금·출고·취소·반품·문의 상태가 변경되면 이메일을 발송합니다. 실패한 알림은 재시도 대기열에서 다시 처리할 수 있습니다.',
        '<button class="btn" data-act="noti-fail">발송 실패 만들기</button>' +
        '<button class="btn p" data-act="noti-retry">' + ic('clock') + '재시도 큐 처리</button>', 'A15') +
        (DB.notifications.filter(function (n) { return n.status === '발송 실패'; }).length ?
          '<div class="note wn" style="margin-bottom:14px">' + ic('alert') + '<div class="bd">' +
          '<b>발송에 실패해 재시도 큐에 남아 있는 알림 ' +
          DB.notifications.filter(function (n) { return n.status === '발송 실패'; }).length + '건</b>' +
          '메일 서비스 장애는 주문·재고 처리에 영향을 주지 않습니다. 이벤트는 이미 저장되어 있고, ' +
          '큐가 처리되면 시도 횟수가 올라가며 발송됩니다.' +
          '<div class="row" style="margin-top:8px"><button class="btn sm p" data-act="noti-retry">지금 재시도</button></div>' +
          '</div></div>' : '') +
        '<div class="card"><div class="card-b" style="padding-bottom:0">' +
        '<div class="pills" style="margin-bottom:12px">' +
        DB.NOTI_KINDS.map(function (k, i) {
          var n = DB.notifications.filter(function (x) { return x.kind === k; }).length;
          return '<button class="pill ' + (f === k ? 'k' : '') + '" data-act="goto" data-path="/a/noti?k=' +
            encodeURIComponent(k) + '" style="cursor:pointer">' + (i + 1) + '. ' + esc(k) + ' <b class="mono">' + n + '</b></button>';
        }).join('') + (f ? '<button class="pill" data-act="goto" data-path="/a/noti" style="cursor:pointer">전체 보기</button>' : '') +
        '</div></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th>발송 시각</th><th>시점</th><th>수신</th><th>제목</th><th>연결</th><th class="c">상태</th></tr></thead><tbody>' +
        (list.length ? list.map(function (n) {
          return '<tr><td class="mono small nowrap">' + esc(n.at) + '</td>' +
            '<td><span class="chip go nb">' + esc(n.kind) + '</span></td>' +
            '<td class="small">' + esc(n.to) + '</td>' +
            '<td class="small">' + esc(n.subject) + '</td>' +
            '<td class="mono small faint">' + esc(n.ref) + '</td>' +
            '<td class="c"><span class="chip ' + (n.status === '발송 실패' ? 'dg' : 'ok') + ' nb">' +
            esc(n.status === '발송완료' ? '발송 완료' : n.status) + '</span>' +
            '<div class="small faint">시도 ' + n.tries + '회' + (n.queued ? ' · 재시도 큐' : '') + '</div>' +
            (n.error ? '<div class="small faint mono">' + esc(n.error) + '</div>' : '') + '</td></tr>';
        }).join('') : emptyRow(6, '발송 이력이 없습니다')) + '</tbody></table></div></div></div>';
    },
  });

  /* ============================================= A16 콘텐츠 관리 */
  APP.route('/a/content', {
    id: 'A16', title: '콘텐츠 관리', area: 'admin', perm: 'content',
    render: function (_, q) {
      var tab = q.tab || '공지';
      var body = '';
      if (tab === '문의') {
        body = '<div class="tw"><table class="t"><thead><tr><th class="c">구분</th><th>거래처</th><th>제목</th>' +
          '<th>연결</th><th>등록</th><th class="c">상태</th><th></th></tr></thead><tbody>' +
          DB.inquiries.map(function (x) {
            var ref = x.ref ? (x.kind === '상품' ? DB.product(x.ref) : DB.order(x.ref)) : null;
            var refText = ref ? (x.kind === '상품' ? ref.code : ref.no) : '-';
            return '<tr><td class="c"><span class="chip ' + (x.kind === '상품' ? 'go' : 'vi') + ' nb">' + esc(x.kind) + '</span></td>' +
              '<td>' + esc(DB.nameOfPartner(x.partner)) + '</td><td><b>' + esc(x.title) + '</b>' +
              '<div class="small faint">' + esc(x.body.slice(0, 44)) + '…</div></td>' +
              '<td class="mono small">' + (ref && x.kind === '주문' ?
                '<button class="lk mono" data-act="a-order" data-id="' + ref.id + '">' + esc(refText) + '</button>'
                : esc(refText)) + '</td>' +
              '<td class="mono small">' + esc(x.at) + '</td>' +
              '<td class="c">' + (x.status === '답변완료' ? '<span class="chip ok">답변 완료</span>' : '<span class="chip wait">접수</span>') +
                ((x.answerHist || []).length ? '<div class="small faint">수정 ' + x.answerHist.length + '회</div>' : '') + '</td>' +
              '<td class="c"><button class="btn xs ' + (x.status === '접수' ? 'p' : '') + '" data-act="inq-ans" data-id="' + x.id + '">' +
                (x.status === '접수' ? '답변' : '수정') + '</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        var list = DB.notices.filter(function (n) { return n.type === tab; });
        body = '<div class="row" style="margin-bottom:12px"><button class="btn p sm" data-act="nt-new" data-t="' + esc(tab) + '">' +
          ic('plus') + esc(tab) + ' 등록</button></div>' +
          '<div class="tw"><table class="t"><thead><tr><th class="c">고정</th><th>제목</th><th>등록일</th><th></th></tr></thead><tbody>' +
          list.map(function (n) {
            return '<tr><td class="c">' + (n.pin ? '📌' : '') + '</td>' +
              '<td><b>' + esc(n.title) + '</b><div class="small faint">' + esc(n.body.slice(0, 56)) + '…</div></td>' +
              '<td class="mono small">' + esc(n.at) + '</td>' +
              '<td class="c"><button class="btn xs" data-act="nt-edit" data-id="' + n.id + '">수정</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      return ph('<b>분석</b> · 콘텐츠', '콘텐츠 관리',
        '공지·FAQ·문의를 한 화면에서 관리합니다. 문의는 <b>접수 → 답변 완료</b> 상태로 관리하고, ' +
        '답변 시 문의자에게 이메일이 자동 발송되며 <b>답변 내용을 수정하면 이력이 남습니다.</b>',
        '', 'A16') +
        '<div class="card"><div class="card-h" style="padding:0"><div class="tabs" role="tablist" style="border:0;flex:1 1 auto">' +
        ['공지', 'FAQ', '문의'].map(function (t) {
          var n = t === '문의' ? DB.inquiries.filter(function (x) { return x.status === '접수'; }).length
            : DB.notices.filter(function (x) { return x.type === t; }).length;
          return '<button role="tab" aria-selected="' + (tab === t) + '" data-act="goto" data-path="/a/content?tab=' + t + '">' +
            esc(t) + '<span class="cnt">' + n + '</span></button>'; }).join('') +
        '</div></div><div class="card-b">' + body + '</div></div>';
    },
  });

  /* =============================================== A17 배너 관리 */
  APP.route('/a/banner', {
    id: 'A17', title: '배너 관리', area: 'admin', perm: 'content',
    render: function () {
      var today = DB.today();
      var live = DB.banners.filter(function (b) { return b.active && b.from <= today && today <= b.to; })
        .sort(function (a, c) { return a.order - c.order; });
      return ph('<b>분석</b> · 배너', '배너 관리',
        '배너마다 <b>노출 시작·종료 일시와 순서값</b>을 설정합니다. 기간이 겹치면 <b>순서값이 가장 낮은 1건만 노출</b>됩니다. ' +
        '운영자가 기간을 겹쳐 등록해도 화면에 두 개가 뜨지 않습니다.',
        '<button class="btn p" data-act="bn-new">' + ic('plus') + '배너 등록</button>', 'A17') +
        '<div class="note ' + (live.length > 1 ? 'wn' : 'ac') + '" style="margin-bottom:14px">' +
        ic(live.length > 1 ? 'alert' : 'check') + '<div class="bd">' +
        '<b>현재 기간이 겹치는 배너 ' + live.length + '건</b>' +
        (live.length ? '이 중 순서값이 가장 낮은 <b>「' + esc(live[0].title) + '」(순서 ' + live[0].order + ')</b> 1건만 홈에 노출됩니다.'
          : '노출 중인 배너가 없습니다.') +
        '<div class="small faint" style="margin-top:5px">홈 상단에는 우선순위가 가장 높은 배너 1건이 노출됩니다. ' +
        '가격 변경이 필요한 행사는 상품·가격 관리에서 별도로 적용해 주세요.</div></div></div>' +
        '<div class="card"><div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
        '<th class="c">순서</th><th>제목</th><th>연결</th><th>노출 기간</th><th class="c">활성</th><th class="c">현재</th><th></th></tr></thead><tbody>' +
        DB.banners.slice().sort(function (a, c) { return a.order - c.order; }).map(function (b) {
          var inRange = b.from <= today && today <= b.to;
          var shown = live.length && live[0].id === b.id;
          return '<tr class="' + (shown ? 'em' : '') + '"><td class="c mono"><b>' + b.order + '</b></td>' +
            '<td><b>' + esc(b.title) + '</b></td><td class="mono small faint">' + esc(b.link) + '</td>' +
            '<td class="mono small">' + esc(b.from) + ' ~ ' + esc(b.to) + '</td>' +
            '<td class="c">' + (b.active ? '<span class="chip ok nb">활성</span>' : '<span class="chip mut nb">비활성</span>') + '</td>' +
            '<td class="c">' + (shown ? '<span class="chip go">노출 중</span>' :
              b.active && inRange ? '<span class="chip wait nb">순서 밀림</span>' : '<span class="faint small">-</span>') + '</td>' +
            '<td class="c nowrap"><button class="btn xs" data-act="bn-toggle" data-id="' + b.id + '">' +
              (b.active ? '비활성' : '활성') + '</button> ' +
              '<button class="btn xs" data-act="bn-edit" data-id="' + b.id + '">수정</button></td></tr>';
        }).join('') + '</tbody></table></div></div></div>';
    },
  });

  /* ==================================== A18 관리자 계정 · 권한 */
  APP.route('/a/accounts', {
    id: 'A18', title: '관리자 계정 · 권한', area: 'admin', perm: 'account',
    render: function () {
      return ph('<b>분석</b> · 계정', '관리자 계정 · 권한',
        '관리자 권한은 <b>최고관리자 / 운영자(주문·배송) / 상품담당(상품·가격)</b>으로 구분되며, <b>가격 변경은 상품담당 이상만</b> 할 수 있습니다. ' +
        '계정의 역할을 변경하면 허용된 운영 메뉴와 처리 권한이 즉시 적용됩니다.',
        '', 'A18') +
        '<div class="card"><div class="card-h"><h2>관리자 계정</h2></div><div class="card-b flush"><div class="tw">' +
        '<table class="t"><thead><tr><th>이름</th><th>아이디</th><th class="c">역할</th><th>권한</th><th>최근 접속</th><th></th></tr></thead><tbody>' +
        DB.admins.map(function (m) {
          var cur = m.id === APP.session.admin;
          return '<tr class="' + (cur ? 'sel' : '') + '"><td><b>' + esc(m.name) + '</b>' +
            (cur ? ' <span class="chip go nb">현재 계정</span>' : '') + '</td>' +
            '<td class="mono small">' + esc(m.loginId) + '</td>' +
            '<td class="c"><span class="chip ' + (m.role === '최고관리자' ? 'go' : m.role === '운영자' ? 'ac' : 'vi') + ' nb">' +
              esc(m.role) + '</span></td>' +
            '<td><div class="pills">' + (DB.ROLE_PERMS[m.role] || []).map(function (p) {
              return '<span class="pill k">' + esc(DB.ROLE_PERM_LABEL[p]) + '</span>'; }).join('') + '</div></td>' +
            '<td class="mono small faint">' + esc(m.last) + '</td>' +
            '<td class="c"><button class="btn xs" data-act="switch-adm" data-id="' + m.id + '">이 역할로 보기</button></td></tr>';
        }).join('') + '</tbody></table></div></div></div>' +
        '<div class="card"><div class="card-h"><h2>역할별 권한 매트릭스</h2>' +
        '<span class="hint">역할별로 허용된 운영 기능을 확인할 수 있습니다</span></div>' +
        '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr><th>권한</th>' +
        Object.keys(DB.ROLE_PERMS).map(function (r) { return '<th class="c">' + esc(r) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + Object.keys(DB.ROLE_PERM_LABEL).map(function (p) {
          return '<tr><td>' + esc(DB.ROLE_PERM_LABEL[p]) + '</td>' +
            Object.keys(DB.ROLE_PERMS).map(function (r) {
              var has = DB.ROLE_PERMS[r].indexOf(p) >= 0;
              return '<td class="c">' + (has ? '<span style="color:var(--ok);font-weight:700">✓</span>' :
                '<span class="faint">·</span>') + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div></div></div>' +
        '<div class="card"><div class="card-h"><h2>감사 로그</h2>' +
        '<span class="hint">가격 변경 · 권한 차단 · 상태 변경 기록</span></div>' +
        '<div class="card-b flush"><div class="tw" style="max-height:420px;overflow-y:auto">' +
        '<table class="t"><thead><tr><th>시각</th><th>수행자</th><th>동작</th><th>내용</th></tr></thead><tbody>' +
        DB.audit.slice(0, 40).map(function (l) {
          return '<tr class="' + (l.level === 'warn' ? 'em' : '') + '">' +
            '<td class="mono small nowrap">' + esc(l.at) + '</td><td class="small">' + esc(l.actor) + '</td>' +
            '<td class="small"><b>' + esc(l.action) + '</b>' +
              (l.level === 'warn' ? ' <span class="chip dg nb">주의</span>' : '') + '</td>' +
            '<td class="small faint">' + esc(l.detail) + '</td></tr>';
        }).join('') + '</tbody></table></div></div></div>' +
        (DB.blockedAttempts.length ? '<div class="card"><div class="card-h"><h2>타사 가격 조회 차단 기록</h2></div>' +
          '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
          '<th>시각</th><th>요청 계정</th><th>요청 대상</th><th>상품</th><th class="c">결과</th></tr></thead><tbody>' +
          DB.blockedAttempts.map(function (x) {
            return '<tr><td class="mono small">' + esc(x.at) + '</td><td>' + esc(x.who) + '</td>' +
              '<td>' + esc(x.target) + '</td><td class="mono small">' + esc(x.product) + '</td>' +
              '<td class="c"><span class="chip dg">403 차단</span></td></tr>'; }).join('') +
          '</tbody></table></div></div></div>' : '');
    },
  });

  /* ==================================================== 모달들 */
  function priceModal(pid) {
    var p = DB.product(pid);
    var affected = DB.orders.filter(function (o) {
      return o.status !== '취소' && o.lines.some(function (l) { return l.product === pid; }); });
    APP.modal({
      title: '기본가 변경 — ' + p.name,
      body: '<div class="f">' +
        '<dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' +
        '<dt>상품 코드</dt><dd class="mono">' + esc(p.code) + '</dd>' +
        '<dt>현재 기본가</dt><dd class="mono"><b>' + DB.won(p.basePrice) + '원</b></dd></dl>' +
        '<div class="fr"><label>변경할 기본가 <span class="req">*</span></label>' +
        '<input class="inp num" id="pm-v" type="number" value="' + (p.basePrice + 3000) + '"></div>' +
        '<div class="fr"><label>변경 사유</label><input class="inp" id="pm-m" value="원지 가격 인상 반영"></div>' +
        '<div class="note ac">' + ic('shield') + '<div class="bd">' +
        '<b>이 변경은 과거 주문 ' + affected.length + '건에 영향을 주지 않습니다</b>' +
        '주문이 생성될 때 단가·할인율·금액이 확정되어 별도로 보관되기 때문입니다. ' +
        '아래 주문은 변경 전 확정 금액을 그대로 유지합니다.' +
        (affected.length ? '<div class="pills" style="margin-top:8px">' + affected.slice(0, 4).map(function (o) {
          return '<span class="pill k mono">' + esc(o.no) + '</span>'; }).join('') + '</div>' : '') +
        '</div></div>' +
        '<div class="note">' + ic('info') + '<div class="bd">변경자 · 시각 · 변경 전후 값이 <b>단가 변경 이력</b>에 자동 기록됩니다. ' +
        '가격 변경은 상품담당 이상만 가능합니다.</div></div></div>',
      size: 'lg',
      foot: '<button class="btn" data-mclose="1">취소</button>' +
        '<button class="btn p" data-act="pm-save" data-id="' + pid + '">변경하고 이력 남기기</button>',
    });
  }
  function ovModal(bid, pid) {
    var p = DB.product(pid), b = DB.partner(bid), g = DB.gradeOf(bid);
    var ov = DB.overrideOf(bid, pid);
    var gradeUnit = Math.round(p.basePrice * (100 - g.rate) / 100);
    var inCart = DB.cart(bid).some(function (i) { return i.product === pid; });
    APP.modal({
      title: '거래처 개별 단가 — ' + b.name + ' / ' + p.name,
      body: '<div class="f">' + priceStack(pid, bid) +
        '<div class="fr"><label>개별 단가 <span class="req">*</span></label>' +
        '<input class="inp num" id="ov-v" type="number" value="' + (ov ? ov.price : gradeUnit - 800) + '">' +
        '<div class="hint">등급 적용가 ' + DB.won(gradeUnit) + '원 · 기본가 ' + DB.won(p.basePrice) + '원</div></div>' +
        '<div class="fr"><label>사유</label><input class="inp" id="ov-m" value="' + esc(ov ? ov.memo : '연간 계약 단가') + '"></div>' +
        (inCart ? '<div class="note wn">' + ic('cart') + '<div class="bd">' +
          '<b>이 품목은 ' + esc(b.name) + ' 장바구니에 담겨 있습니다</b>' +
          '단가를 바꾸면 거래처가 주문을 확정하기 전에 <b>변경된 상품과 금액을 확인</b>하게 됩니다. ' +
          '변경 내용을 확인하기 전에는 주문을 진행할 수 없습니다.</div></div>' : '') +
        '<div class="note">' + ic('info') + '<div class="bd">개별 단가는 <b>등급 할인보다 우선</b> 적용됩니다. ' +
        '등록한 거래처·상품에만 개별 단가가 적용됩니다.</div></div></div>',
      size: 'lg',
      foot: '<button class="btn" data-mclose="1">취소</button>' +
        '<button class="btn p" data-act="ov-save" data-b="' + bid + '" data-p="' + pid + '">저장</button>',
    });
  }
  function orderModal(oid) {
    var o = DB.order(oid);
    var nx = DB.ST_NEXT[o.status];
    var cur = DB.priceFor(o.lines[0].product, o.partner).unit;
    var changed = cur !== o.lines[0].unitPrice;
    APP.modal({
      title: '주문 ' + o.no,
      size: 'xl',
      body: '<div class="row" style="margin-bottom:12px">' + stChip(o.status) +
        '<span class="pill">' + esc(DB.nameOfPartner(o.partner)) + '</span>' +
        '<span class="pill">' + esc(o.pay) + '</span>' +
        (o.fromQuote ? '<span class="pill k">원 견적 ' + esc(o.fromQuote) + '</span>' : '') +
        '<span class="pill">주문일 ' + esc(o.at) + '</span></div>' +
        (changed ? '<div class="note ac" style="margin-bottom:12px">' + ic('shield') + '<div class="bd">' +
          '<b>이 주문 이후 기준 단가가 변경되었습니다</b>' + esc(o.lines[0].name) + '의 현재 적용 단가는 ' +
          '<b class="mono">' + DB.won(cur) + '원</b>이지만, 이 주문에는 확정 당시 단가인 <b class="mono">' +
          DB.won(o.lines[0].unitPrice) + '원</b>이 그대로 유지됩니다.</div></div>' : '') +
        lineTable(o.lines, o.sum, { showSource: true }) +
        (o.ship ? '<div class="sep"></div><dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' +
          '<dt>배송지</dt><dd>' + esc(o.ship.label) + ' · ' + esc(o.ship.receiver) + ' · ' + esc(o.ship.tel) + '</dd>' +
          '<dt>주소</dt><dd>' + esc(o.ship.addr) + '</dd>' +
          (o.shipMemo ? '<dt>요청</dt><dd>' + esc(o.shipMemo) + '</dd>' : '') +
          (o.invoice ? '<dt>송장</dt><dd>' + esc(o.courier) + ' <span class="mono">' + esc(o.invoice) + '</span></dd>' : '') +
          '</dl>' : ''),
      foot: (o.status === '결제대기' ? '<button class="btn p" data-act="pay-ok" data-id="' + o.id + '" data-mclose="1">입금 확인</button>' : '') +
        (nx && o.status !== '결제대기' ? '<button class="btn p" data-act="adv" data-id="' + o.id + '" data-mclose="1">→ ' + statusLabel(nx) + '</button>' : '') +
        '<button class="btn" data-mclose="1">닫기</button>',
    });
  }
  function quoteModal(qid, write) {
    var x = DB.quote(qid);
    APP.modal({
      title: (write ? '견적서 작성 — ' : '견적 ') + x.no,
      size: 'xl',
      body: '<div class="row" style="margin-bottom:12px">' + qChip(x.status) +
        '<span class="pill">' + esc(DB.nameOfPartner(x.partner)) + '</span>' +
        '<span class="pill">' + esc((DB.gradeOf(x.partner) || {}).name) + ' 등급</span>' +
        '<span class="pill">요청일 ' + esc(x.at) + '</span>' +
        '<span class="pill">유효 ' + esc(x.validUntil) + '</span></div>' +
        (x.memo ? '<div class="note" style="margin-bottom:12px">' + ic('chat') + '<div class="bd"><b>거래처 요청 메모</b>' +
          esc(x.memo) + '</div></div>' : '') +
        (write ? '<div class="note ac" style="margin-bottom:12px">' + ic('info') + '<div class="bd">' +
          '<b>거래처에 적용되는 공급가가 기본값으로 입력되어 있습니다</b>상품별 단가를 조정하려면 사유를 함께 기록해 주세요.</div></div>' : '') +
        lineTable(x.lines, x.sum, { showSource: true }) +
        (write ? '<div class="card" style="box-shadow:none;margin-top:14px"><div class="card-h">' +
          '<h2>건별 단가 조정</h2><span class="hint">조정 사유가 함께 기록됩니다</span></div>' +
          '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
          '<th>품목</th><th class="r">적용 공급가</th><th style="width:130px">조정 단가</th>' +
          '<th style="width:200px">조정 사유</th><th></th></tr></thead><tbody>' +
          x.lines.map(function (l) {
            var base = DB.priceFor(l.product, x.partner).unit;
            return '<tr><td><b>' + esc(l.name) + '</b><div class="small faint mono">' + esc(l.code) + '</div>' +
              (l.adjust ? '<div class="small" style="color:var(--key-d)">조정됨 ' + DB.won(l.adjust.from) +
                ' → ' + DB.won(l.adjust.to) + '</div>' : '') + '</td>' +
              '<td class="r mono faint">' + DB.won(base) + '</td>' +
              '<td><input class="inp num" type="number" id="qa-v-' + l.product + '" value="' + l.unitPrice + '"' +
                ' aria-label="' + esc(l.name) + ' 조정 단가"></td>' +
              '<td><input class="inp" id="qa-m-' + l.product + '" value="' + esc(l.adjust ? l.adjust.memo : '') +
                '" placeholder="예: 연간 계약 단가" aria-label="' + esc(l.name) + ' 조정 사유"></td>' +
              '<td class="c"><button class="btn xs p" data-act="qa-set" data-q="' + x.id + '" data-p="' + l.product + '">반영</button></td></tr>';
          }).join('') + '</tbody></table></div></div></div>' +
          '<div class="f" style="margin-top:14px"><div class="fr"><label for="qw-note">조정 사유 · 회신 메모</label>' +
          '<textarea class="inp" id="qw-note" placeholder="예: 박스 1호는 연간 계약 단가를 적용했습니다">' +
          esc(x.adjustNote || '') + '</textarea></div></div>' : '') +
        (x.adjustNote ? '<div class="note ac" style="margin-top:12px">' + ic('info') + '<div class="bd"><b>회신 메모</b>' +
          esc(x.adjustNote) + '</div></div>' : '') +
        (x.converted ? '<div class="note ok" style="margin-top:12px">' + ic('check') + '<div class="bd">' +
          '<b>주문 ' + esc(x.converted) + '으로 전환됨</b>견적에서 확정된 품목·수량·금액이 주문에 그대로 적용되었습니다.</div></div>' : ''),
      foot: '<button class="btn" data-act="q-pdf" data-id="' + qid + '">' + ic('doc') + '견적서 미리보기 · PDF</button>' +
        (write ? '<button class="btn dg" data-act="q-reject" data-id="' + qid + '">거절</button>' +
        '<button class="btn p" data-act="q-send" data-id="' + qid + '">견적서 발송</button>' : '') +
        '<button class="btn" data-mclose="1">닫기</button>',
    });
  }

  /* ------------------------------------------------ 액션 라우터 */
  var prev = APP.onAction;
  APP.onAction = function (a, t, e) {
    switch (a) {
      case 'alogin': {
        var acc = APP.accounts().filter(function (x) { return x.kind === 'admin' && x.admin === t.getAttribute('data-m'); })[0];
        APP.login(acc); go('/a');
        toast(acc.label + ' 계정으로 로그인했습니다', 'ok', acc.role);
        break;
      }
      case 'run-job': {
        var hit = DB.runPaymentDeadlineJob();
        if (!hit.length) toast('기한이 지난 주문이 없습니다', 'ac', '기준일 ' + DB.today() + ' — 「+3일 경과」로 시간을 앞당겨 보세요');
        else {
          toast(hit.length + '건이 자동 취소되었습니다', 'wn',
            '재고 복원 완료 · 사유 「입금 기한 초과」 기록 · 안내 메일 발송');
          APP.modal({ title: '입금 기한 초과 자동 취소', body:
            '<div class="note wn">' + ic('alert') + '<div class="bd"><b>' + hit.length + '건 처리 완료</b>' +
            '주문 취소와 재고 복원을 함께 처리하고 안내 메일 발송 내역을 저장했습니다. ' +
            '메일 발송에 실패한 경우에는 재시도 대기열에서 다시 처리할 수 있습니다.</div></div>' +
            '<div class="tw" style="margin-top:10px"><table class="t"><thead><tr><th>주문</th><th>거래처</th>' +
            '<th class="r">금액</th><th>복원된 재고</th></tr></thead><tbody>' + hit.map(function (o) {
              return '<tr><td class="mono small">' + esc(o.no) + '</td><td>' + esc(DB.nameOfPartner(o.partner)) + '</td>' +
                '<td class="r">' + DB.won(o.sum.total) + '</td><td class="small">' +
                o.lines.map(function (l) { return esc(l.code) + ' <b>+' + l.qty + '</b>'; }).join(', ') + '</td></tr>';
            }).join('') + '</tbody></table></div>' });
        }
        APP.rerender(); break;
      }
      case 'view-lic': {
        var b = DB.partner(t.getAttribute('data-id'));
        APP.modal({ title: '사업자등록증 열람', body:
          '<div class="license-preview"><div class="license-title">사업자등록증</div>' +
          '<dl><dt>등록번호</dt><dd>' + esc(b.biz) + '</dd><dt>상호</dt><dd>' + esc(b.name) + '</dd>' +
          '<dt>대표자</dt><dd>' + esc(b.ceo) + '</dd><dt>사업장</dt><dd>' + esc(b.addr) + '</dd>' +
          '<dt>업태·종목</dt><dd>' + esc(b.biztype) + ' · ' + esc(b.bizitem) + '</dd></dl>' +
          '<div class="license-file">' + ic('doc') + '<span>' + esc(b.license) + '</span></div></div>' +
          '<div class="note" style="margin-top:12px">' + ic('lock') + '<div class="bd">' +
          '<b>보안 문서</b>권한 있는 관리자만 열람할 수 있으며, 열람·다운로드 기록이 감사 로그에 남습니다.</div></div>' });
        DB.log(me().name, '사업자등록증 열람', b.name, 'info');
        break;
      }
      case 'approve': {
        var id = t.getAttribute('data-id'), bb = DB.partner(id);
        APP.confirmBox('가입 승인', '<p><b>' + esc(bb.name) + '</b>의 가입을 승인합니다.</p>' +
          '<div class="f" style="margin-top:12px"><div class="fr"><label>부여할 등급</label>' +
          '<select class="inp" id="ap-g">' + DB.GRADES.map(function (g) {
            return '<option value="' + g.id + '"' + (g.id === 'g3' ? ' selected' : '') + '>' +
              esc(g.name) + ' · −' + g.rate + '% · ' + esc(g.note) + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="note ok" style="margin-top:12px">' + ic('check') + '<div class="bd">' +
          '승인하면 거래처 전용 상품과 공급가를 조회할 수 있으며, 가입 승인 안내 메일이 발송됩니다.</div></div>',
          '승인하기', function () {
            var g = $('#ap-g'); if (g) bb.grade = g.value;
            DB.approvePartner(id, me().name);
            toast(bb.name + ' 가입을 승인했습니다', 'ok', (DB.gradeOf(id) || {}).name + ' 등급 부여 · 안내 메일 발송');
            APP.rerender();
          });
        break;
      }
      case 'reject': {
        var id2 = t.getAttribute('data-id'), b2 = DB.partner(id2);
        APP.modal({
          title: '가입 반려 — ' + b2.name,
          body: '<div class="f"><div class="fr"><label>반려 사유 <span class="req">*</span></label>' +
            '<textarea class="inp" id="rj-r" placeholder="거래처에 그대로 전달되는 문구입니다">제출하신 사업자등록증의 상호와 신청 상호가 일치하지 않습니다. 정정 후 재신청 부탁드립니다.</textarea>' +
            '<div class="hint">입력한 사유가 안내 메일에 그대로 실려 발송됩니다.</div></div></div>',
          foot: '<button class="btn" data-mclose="1">취소</button>' +
            '<button class="btn dg" data-act="rj-go" data-id="' + id2 + '">반려 처리</button>',
        });
        break;
      }
      case 'rj-go': {
        var id3 = t.getAttribute('data-id'), r = $('#rj-r').value.trim();
        if (!r) { toast('반려 사유를 입력해 주세요', 'wn'); break; }
        DB.rejectPartner(id3, r, me().name);
        APP.closeModal();
        toast('가입을 반려했습니다', 'dg', '사유가 담긴 안내 메일이 발송되었습니다');
        APP.rerender(); break;
      }
      case 'grade-set': {
        var bid4 = t.getAttribute('data-id'), b4 = DB.partner(bid4);
        APP.confirmBox('등급 변경 — ' + b4.name,
          '<div class="f"><div class="fr"><label>등급</label><select class="inp" id="gs-v">' +
          DB.GRADES.map(function (g) {
            return '<option value="' + g.id + '"' + (b4.grade === g.id ? ' selected' : '') + '>' +
              esc(g.name) + ' · −' + g.rate + '% · ' + esc(g.note) + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="note" style="margin-top:12px">' + ic('info') + '<div class="bd">' +
          '등급은 <b>가격 정책과 메뉴 권한 두 축</b>을 각각 가리킵니다. 등급을 바꾸면 개별 단가가 없는 품목의 공급가와 이용 권한이 함께 바뀝니다. ' +
          '<b>이미 생성된 주문의 금액은 변하지 않습니다.</b></div></div>',
          '변경', function () {
            var v = $('#gs-v').value; b4.grade = v;
            DB.log(me().name, '거래처 등급 변경', b4.name + ' → ' + DB.gradeOf(bid4).name);
            toast(b4.name + ' 등급을 변경했습니다', 'ok', DB.gradeOf(bid4).name + ' · −' + DB.gradeOf(bid4).rate + '%');
            APP.rerender();
          });
        break;
      }
      case 'grade-edit': {
        APP.modal({
          title: '등급 · 할인율 설정',
          body: '<div class="f">' + DB.GRADES.map(function (g) {
            return '<div class="fr"><label>' + esc(g.name) + ' <i class="faint small" style="font-weight:400">' +
              esc(g.note) + '</i></label><input class="inp num" data-g="' + g.id + '" type="number" value="' + g.rate + '"></div>';
          }).join('') + '<div class="note wn">' + ic('alert') + '<div class="bd">' +
          '할인율을 바꾸면 <b>개별 단가가 없는 모든 품목의 공급가</b>가 즉시 바뀝니다. 변경 이력이 기록되며, ' +
          '<b>이미 생성된 주문의 금액은 영향을 받지 않습니다.</b></div></div></div>',
          foot: '<button class="btn" data-mclose="1">취소</button><button class="btn p" data-act="grade-save">저장</button>',
        });
        break;
      }
      case 'grade-save': {
        $$('[data-g]').forEach(function (el) {
          var g = DB.GRADES.filter(function (x) { return x.id === el.getAttribute('data-g'); })[0];
          if (g && +el.value !== g.rate) DB.changeGradeRate(g.id, +el.value, me().name);
        });
        APP.closeModal(); toast('등급 할인율을 저장했습니다', 'ok', '변경 이력에 기록되었습니다'); APP.rerender(); break;
      }
      case 'price-edit': priceModal(t.getAttribute('data-id')); break;
      case 'pm-save': {
        var pid = t.getAttribute('data-id'), v = +$('#pm-v').value, m = $('#pm-m').value;
        if (!(v > 0)) { toast('0보다 큰 금액을 입력해 주세요', 'wn'); break; }
        var r2 = DB.changeBasePrice(pid, v, me().role + ' ' + me().name, m);
        APP.closeModal();
        toast('기본가를 변경했습니다', 'ok', DB.won(r2.from) + ' → ' + DB.won(r2.to) + '원 · 이력 기록됨');
        var aff = DB.orders.filter(function (o) { return o.status !== '취소' && o.lines.some(function (l) { return l.product === pid; }); });
        if (aff.length) setTimeout(function () {
          APP.modal({ title: '과거 주문 금액 확인', body:
            '<div class="note ac">' + ic('shield') + '<div class="bd"><b>변경 전 주문 ' + aff.length + '건의 금액은 그대로입니다</b>' +
            '아래 표에서 「주문 당시 단가」와 「현재 적용 단가」를 비교할 수 있습니다.</div></div>' +
            '<div class="tw" style="margin-top:10px"><table class="t"><thead><tr><th>주문</th><th>거래처</th>' +
            '<th class="r">주문 당시 단가</th><th class="r">현재 적용 단가</th><th class="r">주문 금액</th></tr></thead><tbody>' +
            aff.map(function (o) {
              var l = o.lines.filter(function (x) { return x.product === pid; })[0];
              var now = DB.priceFor(pid, o.partner).unit;
              return '<tr><td class="mono small">' + esc(o.no) + '</td><td>' + esc(DB.nameOfPartner(o.partner)) + '</td>' +
                '<td class="r mono"><b>' + DB.won(l.unitPrice) + '</b></td>' +
                '<td class="r mono ' + (now !== l.unitPrice ? 'diff-up' : 'faint') + '">' + DB.won(now) + '</td>' +
                '<td class="r mono">' + DB.won(o.sum.total) + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="small faint" style="margin-top:9px">조회·통계·세금계산서에는 주문 당시 확정된 금액이 적용됩니다.</div>' });
        }, 400);
        APP.rerender(); break;
      }
      case 'ov-edit': ovModal(t.getAttribute('data-b'), t.getAttribute('data-p')); break;
      case 'ov-save': {
        var bid5 = t.getAttribute('data-b'), pid5 = t.getAttribute('data-p');
        var v2 = +$('#ov-v').value, m2 = $('#ov-m').value;
        if (!(v2 > 0)) { toast('0보다 큰 금액을 입력해 주세요', 'wn'); break; }
        DB.changeOverride(bid5, pid5, v2, me().role + ' ' + me().name, m2);
        APP.closeModal();
        var inC = DB.cart(bid5).some(function (i) { return i.product === pid5; });
        toast('개별 단가를 저장했습니다', 'ok', inC ?
          '장바구니에 담긴 품목이므로 주문 전에 변경된 금액이 안내됩니다' : '변경 이력에 기록되었습니다');
        APP.rerender(); break;
      }
      case 'ov-del': {
        DB.removeOverride(t.getAttribute('data-b'), t.getAttribute('data-p'), me().name);
        toast('개별 단가를 해제했습니다', 'ok', '등급 할인 적용가로 복귀합니다');
        APP.rerender(); break;
      }
      case 'stock-edit': {
        var p6 = DB.product(t.getAttribute('data-id'));
        APP.confirmBox('재고 조정 — ' + p6.name,
          '<div class="f"><div class="fr"><label for="st-cur">현재고</label>' +
          '<input class="inp num" id="st-cur" value="' + p6.stock + '" readonly></div>' +
          '<div class="fr"><label for="st-v">조정 후 재고</label>' +
          '<input class="inp num" id="st-v" type="number" min="0" value="' + (p6.stock + 100) + '"></div></div>' +
          '<div class="note" style="margin-top:12px">' + ic('info') + '<div class="bd">' +
          '재고 조정은 <b>수량 증감</b>으로 처리하며, 조정 기록은 감사 로그에 남습니다. ' +
          '재고 증감의 원인은 주문 · 취소 · 반품 이력으로 추적할 수 있습니다.</div></div>',
          '저장', function () {
            var nv = +$('#st-v').value;
            if (!(nv >= 0) || String($('#st-v').value).trim() === '') {
              toast('재고는 0 이상이어야 합니다', 'dg', '0 이상의 재고 수량을 입력해 주세요');
              return false;                                  // 모달을 닫지 않는다
            }
            DB.log(me().name, '재고 조정', p6.code + ' ' + p6.stock + ' → ' + nv);
            p6.stock = nv; toast('재고를 조정했습니다', 'ok', p6.code + ' · ' + nv); APP.rerender();
          });
        break;
      }
      case 'goods-edit': case 'goods-new': {
        var p7 = a === 'goods-edit' ? DB.product(t.getAttribute('data-id')) : null;
        APP.modal({
          title: p7 ? '상품 수정 — ' + p7.name : '상품 등록',
          body: '<div class="f"><div class="f2">' +
            '<div class="fr"><label for="gd-c">상품 코드 <span class="req">*</span></label>' +
            '<input class="inp mono" id="gd-c" value="' + esc(p7 ? p7.code : '') + '"></div>' +
            '<div class="fr"><label for="gd-n">상품명 <span class="req">*</span></label>' +
            '<input class="inp" id="gd-n" value="' + esc(p7 ? p7.name : '') + '"></div></div>' +
            '<div class="fr"><label for="gd-s">규격</label><input class="inp" id="gd-s" value="' + esc(p7 ? p7.spec : '') + '"></div>' +
            '<div class="f2">' +
            '<div class="fr"><label for="gd-sub">분류 (대 · 중 2단)</label><select class="inp" id="gd-sub">' +
            DB.CATS.map(function (c) {
              return '<optgroup label="' + esc(c.name) + '">' + c.subs.map(function (sb) {
                return '<option value="' + sb.id + '"' + (p7 && p7.sub === sb.id ? ' selected' : '') + '>' +
                  esc(c.name) + ' › ' + esc(sb.name) + '</option>'; }).join('') + '</optgroup>';
            }).join('') + '</select></div>' +
            '<div class="fr"><label for="gd-bp">기본가</label>' +
            '<input class="inp num" id="gd-bp" type="number" min="1" value="' + (p7 ? p7.basePrice : 10000) + '"' +
              (p7 ? ' readonly' : '') + '>' +
            '<div class="hint">' + (p7 ? '등록된 상품의 기본가는 「기본가 변경」에서 이력과 함께 바꿉니다.'
              : '등록 시점 기본가입니다. 이후 변경은 이력에 기록됩니다.') + '</div></div></div>' +
            '<div class="f3"><div class="fr"><label for="gd-m">MOQ</label>' +
            '<input class="inp num" id="gd-m" type="number" min="1" value="' + (p7 ? p7.moq : 1) + '"></div>' +
            '<div class="fr"><label for="gd-u">주문 단위</label>' +
            '<input class="inp num" id="gd-u" type="number" min="1" value="' + (p7 ? p7.unit : 1) + '"></div>' +
            '<div class="fr"><label for="gd-k">재고</label>' +
            '<input class="inp num" id="gd-k" type="number" min="0" value="' + (p7 ? p7.stock : 0) + '"></div></div>' +
            '<label class="chk"><input type="checkbox" id="gd-f"' + (p7 && p7.featured ? ' checked' : '') + '> 추천 상품으로 노출</label>' +
            '<label class="chk"><input type="checkbox" id="gd-nw"' + (p7 && p7.pinNew ? ' checked' : '') +
            '> 신상품으로 고정 노출</label>' +
            '<div class="note">' + ic('info') + '<div class="bd">' +
            '<b>신상품은 등록일 기준 ' + DB.NEW_DAYS + '일 이내면 자동으로 선정</b>됩니다. 위 체크는 기간이 지난 뒤에도 계속 노출할 때만 씁니다.' +
            (p7 && p7.regAt ? '<div class="small faint" style="margin-top:5px">등록일 ' + esc(p7.regAt) + '</div>' : '') +
            '</div></div>' +
            '<div class="note">' + ic('info') + '<div class="bd">' +
            '<b>상품 1건은 하나의 SKU로 관리</b>합니다. 옵션이나 규격이 다르면 별도 상품 코드를 등록해 주세요. ' +
            '상품 코드는 엑셀 일괄 등록과 대량 담기에서 상품을 식별하는 값이므로 <b>중복으로 등록할 수 없습니다.</b></div></div></div>',
          foot: '<button class="btn" data-mclose="1">취소</button>' +
            '<button class="btn p" data-act="gd-save" data-id="' + (p7 ? p7.id : '') + '">저장</button>',
        });
        break;
      }
      case 'gd-save': {
        var gid = t.getAttribute('data-id');
        var p8 = gid ? DB.product(gid) : null;
        var code = $('#gd-c').value.trim().toUpperCase(), nm = $('#gd-n').value.trim();
        if (!code || !nm) { toast('상품 코드와 상품명을 입력해 주세요', 'wn'); break; }
        var dup = DB.productByCode(code);
        if (dup && (!p8 || dup.id !== p8.id)) {
          toast('이미 사용 중인 상품 코드입니다', 'dg', code + ' — ' + dup.name + '와 중복됩니다');
          break;
        }
        var mq = +$('#gd-m').value, un = +$('#gd-u').value, sk = +$('#gd-k').value;
        if (!(mq >= 1) || !(un >= 1)) { toast('MOQ와 주문 단위는 1 이상이어야 합니다', 'dg',
          '0 이나 빈 값이면 해당 상품을 주문할 수 없게 됩니다'); break; }
        if (!(sk >= 0)) { toast('재고는 0 이상이어야 합니다', 'dg'); break; }
        var subId = $('#gd-sub').value;
        var catObj = DB.catOfSub(subId);
        if (p8) {
          p8.code = code; p8.name = nm; p8.spec = $('#gd-s').value;
          p8.sub = subId; p8.cat = catObj ? catObj.id : p8.cat;
          p8.moq = mq; p8.unit = un; p8.stock = sk;
          p8.featured = $('#gd-f').checked; p8.pinNew = $('#gd-nw').checked;
          if (p8.featured && !p8.featuredOrder) p8.featuredOrder = 9;
          DB.log(me().name, '상품 수정', code);
        } else {
          var bp = +$('#gd-bp').value;
          if (!(bp > 0)) { toast('기본가는 0보다 커야 합니다', 'dg'); break; }
          DB.products.push({ id: 'p' + (DB.products.length + 1), code: code, name: nm, spec: $('#gd-s').value,
            sub: subId, cat: catObj ? catObj.id : 'c1', basePrice: bp, moq: mq, unit: un,
            stock: sk, regAt: DB.today(), pinNew: $('#gd-nw').checked, featured: $('#gd-f').checked,
            featuredOrder: 9, active: true, desc: nm });
          DB.log(me().name, '상품 등록', code + ' · ' + DB.subName(subId) + ' · ' + DB.won(bp) + '원');
        }
        APP.closeModal(); toast('저장했습니다', 'ok', code); APP.rerender(); break;
      }
      case 'a-order': orderModal(t.getAttribute('data-id')); break;
      case 'a-quote': quoteModal(t.getAttribute('data-id'), false); break;
      case 'q-write': quoteModal(t.getAttribute('data-id'), true); break;
      case 'q-send': {
        var nt = $('#qw-note');
        DB.sendQuote(t.getAttribute('data-id'), nt ? nt.value : '');
        APP.closeModal(); toast('견적서를 발송했습니다', 'ok', '거래처에서 주문으로 전환할 수 있습니다'); APP.rerender(); break;
      }
      case 'q-reject': {
        var qid2 = t.getAttribute('data-id');
        var nt2 = $('#qw-note');
        DB.rejectQuote(qid2, nt2 ? nt2.value : '');
        APP.closeModal(); toast('견적을 거절했습니다', 'dg'); APP.rerender(); break;
      }
      case 'adv': {
        var r3 = DB.advance(t.getAttribute('data-id'), me().name);
        if (!r3.ok) toast('상태를 변경할 수 없습니다', 'dg', r3.reason);
        else toast('상태를 변경했습니다', 'ok', '→ ' + r3.status);
        APP.rerender(); break;
      }
      case 'bulk-adv': {
        var sel = $$('.ochk:checked').map(function (c) { return c.value; });
        if (!sel.length) { toast('주문을 선택해 주세요', 'wn'); break; }
        var okN = 0, errs = [];
        sel.forEach(function (id) {
          var r4 = DB.advance(id, me().name);
          if (r4.ok) okN++; else errs.push(DB.order(id).no + ' — ' + r4.reason);
        });
        if (errs.length) APP.modal({ title: '일괄 상태 변경 결과', body:
          '<div class="note ' + (okN ? 'wn' : 'dg') + '">' + ic('alert') + '<div class="bd">' +
          '<b>' + okN + '건 변경 · ' + errs.length + '건 차단</b>' +
          '주문 상태는 정해진 순서대로만 변경할 수 있습니다.<br>' + errs.map(esc).join('<br>') + '</div></div>' });
        else toast(okN + '건의 상태를 변경했습니다', 'ok');
        APP.rerender(); break;
      }
      case 'chk-all': {
        var on = t.checked;
        $$('.ochk').forEach(function (c) { c.checked = on; });
        break;
      }
      case 'pay-ok': {
        var r5 = DB.confirmPayment(t.getAttribute('data-id'), me().name);
        if (!r5.ok) toast('처리할 수 없습니다', 'dg', r5.reason);
        else toast('입금을 확인했습니다', 'ok', '안내 메일이 발송되었습니다');
        APP.rerender(); break;
      }
      case 'pay-cancel': {
        var oid3 = t.getAttribute('data-id'), o3 = DB.order(oid3);
        APP.confirmBox('주문 취소 — ' + o3.no,
          '<p>이 주문을 취소하면 <b>재고가 복원</b>되고 거래처에 안내 메일이 발송됩니다.</p>' +
          '<div class="f" style="margin-top:12px"><div class="fr"><label>취소 사유</label>' +
          '<input class="inp" id="pc-r" value="거래처 요청"></div></div>',
          '취소 처리', function () {
            DB.cancelOrder(oid3, $('#pc-r').value || '관리자 취소', me().name);
            toast('주문을 취소했습니다', 'dg', '재고가 복원되었습니다'); APP.rerender();
          }, 'dg');
        break;
      }
      case 'inv-edit': {
        var o4 = DB.order(t.getAttribute('data-id'));
        APP.modal({
          title: '송장 등록 — ' + o4.no,
          body: '<div class="f"><div class="f2">' +
            '<div class="fr"><label>택배사</label><select class="inp" id="iv-c">' +
            ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'].map(function (c) {
              return '<option' + (o4.courier === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
            '<div class="fr"><label>송장번호</label><input class="inp mono" id="iv-n" value="' + esc(o4.invoice || '') +
            '" placeholder="숫자 9~14자리"></div></div>' +
            '<div class="note">' + ic('info') + '<div class="bd">송장번호에 <b>택배사 코드를 함께 저장</b>해 거래처 화면에서 ' +
            '해당 택배사의 배송 조회 페이지로 연결합니다.</div></div></div>',
          foot: '<button class="btn" data-mclose="1">취소</button>' +
            '<button class="btn p" data-act="iv-save" data-id="' + o4.id + '">저장</button>',
        });
        break;
      }
      case 'iv-save': {
        var n5 = $('#iv-n').value.trim();
        if (!/^\d{9,14}$/.test(n5)) { toast('송장번호 형식이 올바르지 않습니다', 'dg', '숫자 9~14자리'); break; }
        DB.setInvoice(t.getAttribute('data-id'), $('#iv-c').value, n5, me().name);
        APP.closeModal(); toast('송장을 등록했습니다', 'ok'); APP.rerender(); break;
      }
      case 'cl-ok': {
        DB.decideClaim(t.getAttribute('data-o'), t.getAttribute('data-c'), true, '회수 후 검수 예정', me().name);
        toast('요청을 승인했습니다', 'ok', '반품은 검수 완료 시 재고가 복원됩니다'); APP.rerender(); break;
      }
      case 'cl-no': {
        DB.decideClaim(t.getAttribute('data-o'), t.getAttribute('data-c'), false, '요청 사유 확인 불가', me().name);
        toast('요청을 거절했습니다', 'dg'); APP.rerender(); break;
      }
      case 'cl-done': {
        var r6 = DB.completeClaim(t.getAttribute('data-o'), t.getAttribute('data-c'), me().name);
        if (!r6.ok) toast('처리할 수 없습니다', 'dg', r6.reason);
        else toast('처리를 완료했습니다', 'ok', '재고가 복원되고 안내 메일이 발송되었습니다');
        APP.rerender(); break;
      }
      case 'ex-load': loadSample(t.getAttribute('data-s')); break;
      case 'ex-run': excelRun(true); break;
      case 'ex-validate': excelRun(false); break;
      case 'ex-tpl': toast('양식 파일을 내려받았습니다', 'ok', DB.EXCEL_KINDS[A.excelKind].cols.join(' · ')); break;
      case 'ex-report': toast('오류 결과 파일을 내려받았습니다', 'ac', '행 번호와 사유가 기재되어 있습니다'); break;
      case 'ship-dl': toast('출고 대상 목록을 내려받았습니다', 'ok', '송장번호를 채워 다시 업로드하세요'); break;
      case 'stat-dl': toast('통계를 엑셀로 내려받았습니다', 'ok', '데이터가 많으면 파일 생성에 잠시 시간이 걸릴 수 있습니다'); break;
      case 'inq-ans': {
        var iq = DB.inquiries.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
        var ref = iq.kind === '상품' && iq.ref ? DB.product(iq.ref) : null;
        APP.modal({
          title: '문의 답변 — ' + iq.title,
          body: '<div class="row" style="margin-bottom:10px">' +
            '<span class="chip ' + (iq.kind === '상품' ? 'go' : 'vi') + ' nb">' + esc(iq.kind) + '</span>' +
            (ref ? '<span class="pill k mono">' + esc(ref.code) + ' · ' + esc(ref.name) + '</span>' : '') +
            '<span class="pill">' + esc(DB.nameOfPartner(iq.partner)) + '</span></div>' +
            '<div class="note">' + ic('chat') + '<div class="bd">' + esc(iq.body) + '</div></div>' +
            ((iq.answerHist || []).length ? '<div class="card" style="box-shadow:none;margin-top:12px">' +
              '<div class="card-h"><h2>이전 답변 이력</h2><span class="hint">' + iq.answerHist.length + '회 수정</span></div>' +
              '<div class="card-b flush"><div class="tw"><table class="t"><thead><tr>' +
              '<th>수정 시각</th><th>수정자</th><th>그 전에 보낸 답변</th></tr></thead><tbody>' +
              iq.answerHist.slice().reverse().map(function (h) {
                return '<tr><td class="mono small nowrap">' + esc(h.at) + '</td>' +
                  '<td class="small">' + esc(h.by) + '</td>' +
                  '<td class="small">' + esc(h.text) + '</td></tr>';
              }).join('') + '</tbody></table></div></div></div>' : '') +
            '<div class="f" style="margin-top:12px"><div class="fr"><label for="iq-a">답변 <span class="req">*</span></label>' +
            '<textarea class="inp" id="iq-a">' + esc(iq.answer || '') + '</textarea>' +
            '<div class="hint">답변을 등록하면 문의자에게 이메일이 자동 발송됩니다. ' +
            '답변 내용을 수정하면 이력이 남습니다.</div></div></div>',
          foot: '<button class="btn" data-mclose="1">취소</button>' +
            '<button class="btn p" data-act="iq-save" data-id="' + iq.id + '">답변 등록</button>',
        });
        break;
      }
      case 'iq-save': {
        var iq2 = DB.inquiries.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
        var ans = $('#iq-a').value.trim();
        if (!ans) { toast('답변을 입력해 주세요', 'wn'); break; }
        var edit = !!iq2.answer;
        if (edit && iq2.answer !== ans) {                    // 이전 답변 원문을 보존한다
          iq2.answerHist = iq2.answerHist || [];
          iq2.answerHist.push({ at: iq2.answerAt || DB.today(), by: iq2.answerBy || '관리자', text: iq2.answer });
        }
        iq2.answer = ans; iq2.status = '답변완료';
        iq2.answerAt = DB.today() + ' ' + new Date().toTimeString().slice(0, 5);
        iq2.answerBy = me().name;
        DB.notify('문의 답변 등록', DB.nameOfPartner(iq2.partner), '「' + iq2.title + '」 문의에 답변이 등록되었습니다', iq2.id);
        DB.log(me().name, edit ? '문의 답변 수정' : '문의 답변 등록', iq2.title);
        APP.closeModal();
        toast(edit ? '답변을 수정했습니다' : '답변을 등록했습니다', 'ok',
          edit ? '수정 이력이 남았습니다' : '문의자에게 이메일이 발송되었습니다');
        APP.rerender(); break;
      }
      case 'nt-new': case 'nt-edit': {
        var n6 = a === 'nt-edit' ? DB.notices.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0] : null;
        var ty = n6 ? n6.type : t.getAttribute('data-t');
        APP.modal({
          title: n6 ? ty + ' 수정' : ty + ' 등록',
          body: '<div class="f"><div class="fr"><label>제목</label><input class="inp" id="nt-t" value="' + esc(n6 ? n6.title : '') + '"></div>' +
            '<div class="fr"><label>내용</label><textarea class="inp" id="nt-b" style="min-height:130px">' + esc(n6 ? n6.body : '') + '</textarea></div>' +
            (ty === '공지' ? '<label class="chk"><input type="checkbox" id="nt-p"' + (n6 && n6.pin ? ' checked' : '') + '> 상단 고정</label>' : '') +
            '</div>',
          foot: '<button class="btn" data-mclose="1">취소</button>' +
            '<button class="btn p" data-act="nt-save" data-id="' + (n6 ? n6.id : '') + '" data-t="' + ty + '">저장</button>',
        });
        break;
      }
      case 'nt-save': {
        var nid = t.getAttribute('data-id'), ty2 = t.getAttribute('data-t');
        var ti = $('#nt-t').value.trim(), bo = $('#nt-b').value.trim();
        if (!ti || !bo) { toast('제목과 내용을 입력해 주세요', 'wn'); break; }
        var pn = $('#nt-p');
        if (nid) {
          var n7 = DB.notices.filter(function (x) { return x.id === nid; })[0];
          n7.title = ti; n7.body = bo; if (pn) n7.pin = pn.checked;
        } else {
          DB.notices.unshift({ id: 'n' + (DB.notices.length + 1), type: ty2, title: ti, body: bo,
            at: DB.today(), pin: pn ? pn.checked : false });
        }
        DB.log(me().name, ty2 + (nid ? ' 수정' : ' 등록'), ti);
        APP.closeModal(); toast('저장했습니다', 'ok'); APP.rerender(); break;
      }
      case 'bn-toggle': {
        var b9 = DB.banners.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
        b9.active = !b9.active;
        DB.log(me().name, '배너 ' + (b9.active ? '활성' : '비활성'), b9.title);
        toast('배너를 ' + (b9.active ? '활성' : '비활성') + '화했습니다', 'ok'); APP.rerender(); break;
      }
      case 'bn-new': case 'bn-edit': {
        var bn = a === 'bn-edit' ? DB.banners.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0] : null;
        APP.modal({
          title: bn ? '배너 수정' : '배너 등록',
          body: '<div class="f"><div class="fr"><label>제목</label><input class="inp" id="bn-t" value="' + esc(bn ? bn.title : '') + '"></div>' +
            '<div class="fr"><label>연결 링크</label><input class="inp mono" id="bn-l" value="' + esc(bn ? bn.link : '#/products') + '"></div>' +
            '<div class="f3"><div class="fr"><label>시작</label><input class="inp" id="bn-f" type="date" value="' + esc(bn ? bn.from : DB.today()) + '"></div>' +
            '<div class="fr"><label>종료</label><input class="inp" id="bn-o" type="date" value="' + esc(bn ? bn.to : DB.iso(DB.addD(DB.CLOCK.now, 30))) + '"></div>' +
            '<div class="fr"><label>순서값</label><input class="inp num" id="bn-r" type="number" value="' + (bn ? bn.order : DB.banners.length + 1) + '"></div></div>' +
            '<div class="note">' + ic('info') + '<div class="bd">기간이 겹치면 <b>순서값이 가장 낮은 1건만</b> 노출됩니다. ' +
            '같은 기간에 여러 배너가 등록되어도 홈에는 하나만 표시됩니다.</div></div></div>',
          foot: '<button class="btn" data-mclose="1">취소</button>' +
            '<button class="btn p" data-act="bn-save" data-id="' + (bn ? bn.id : '') + '">저장</button>',
        });
        break;
      }
      case 'bn-save': {
        var bid9 = t.getAttribute('data-id');
        var o9 = { title: $('#bn-t').value.trim(), link: $('#bn-l').value.trim(),
          from: $('#bn-f').value, to: $('#bn-o').value, order: +$('#bn-r').value };
        if (!o9.title) { toast('제목을 입력해 주세요', 'wn'); break; }
        if (bid9) {
          var b10 = DB.banners.filter(function (x) { return x.id === bid9; })[0];
          Object.keys(o9).forEach(function (k) { b10[k] = o9[k]; });
        } else {
          o9.id = 'bn' + (DB.banners.length + 1); o9.active = true; DB.banners.push(o9);
        }
        DB.log(me().name, '배너 저장', o9.title);
        APP.closeModal(); toast('배너를 저장했습니다', 'ok'); APP.rerender(); break;
      }
      case 'blk-tg': {
        var bb7 = t.getAttribute('data-b'), pp7 = t.getAttribute('data-p'), on7 = t.getAttribute('data-on') === '1';
        var p7b = DB.product(pp7);
        APP.confirmBox(on7 ? '판매 제외 지정' : '판매 제외 해제',
          '<p><b>' + esc(DB.nameOfPartner(bb7)) + '</b>의 <b>' + esc(p7b.name) + '</b> 판매 설정을 ' +
          (on7 ? '「판매 제외」로 변경합니다.' : '「판매 가능」으로 변경합니다.') + '</p>' +
          '<div class="note" style="margin-top:12px">' + ic('info') + '<div class="bd">' +
          '제외 품목은 <b>상품 목록·검색·상세·장바구니·엑셀 주문 등록에서 모두 구매할 수 없게 처리</b>됩니다. ' +
          '판매 가능 상품 변경 내역은 보안 기록에 남습니다.</div></div>',
          on7 ? '제외 지정' : '해제', function () {
            DB.setBlock(bb7, pp7, on7, me().name);
            toast(on7 ? '판매 제외로 지정했습니다' : '판매 제외를 해제했습니다', on7 ? 'dg' : 'ok',
              DB.nameOfPartner(bb7) + ' / ' + p7b.code);
            APP.rerender();
          }, on7 ? 'dg' : '');
        break;
      }
      case 'qa-set': {
        var qaq = t.getAttribute('data-q'), qap = t.getAttribute('data-p');
        var vEl = $('#qa-v-' + qap), mEl = $('#qa-m-' + qap);
        var nv2 = vEl ? +vEl.value : 0;
        if (!(nv2 > 0)) { toast('0보다 큰 단가를 입력해 주세요', 'wn'); break; }
        var memoV = mEl ? mEl.value.trim() : '';
        if (!memoV) { toast('조정 사유를 입력해 주세요', 'wn', '건별 조정은 사유와 함께 기록됩니다'); break; }
        var rq = DB.adjustQuoteLine(qaq, qap, nv2, memoV, me().name);
        if (!rq.ok) { toast('조정할 수 없습니다', 'dg'); break; }
        var keepNote = $('#qw-note') ? $('#qw-note').value : '';
        if (keepNote) DB.quote(qaq).adjustNote = keepNote;
        toast('단가를 조정했습니다', 'ok', DB.won(nv2) + '원 · 사유가 이력에 기록되었습니다');
        APP.closeModal(); quoteModal(qaq, true); break;
      }
      case 'q-pdf': {
        var qp = DB.quote(t.getAttribute('data-id'));
        var noteEl = $('#qw-note');
        var wasWrite = !!noteEl;
        if (noteEl && noteEl.value.trim()) qp.adjustNote = noteEl.value.trim();
        APP.closeModal();
        APP.modal({
          title: '견적서 미리보기 — ' + qp.no,
          size: 'xl',
          body: '<div class="doc">' +
            '<div class="doc-h"><div><h3>견 적 서</h3>' +
            '<div class="small faint mono">' + esc(qp.no) + ' · 작성일 ' + esc(DB.today()) +
            ' · 유효기간 ' + esc(qp.validUntil) + '</div></div>' +
            '<div class="doc-co"><b>한성상사</b><div class="small faint">사업자등록번호 000-00-00000<br>' +
            '서울특별시 · 대표 000 · TEL 02-000-0000</div></div></div>' +
            '<dl class="dl" style="border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:12px 0">' +
            '<dt>수신</dt><dd><b>' + esc(DB.nameOfPartner(qp.partner)) + '</b> 귀중</dd>' +
            '<dt>등급</dt><dd>' + esc((DB.gradeOf(qp.partner) || {}).name || '-') + '</dd>' +
            '<dt>합계 금액</dt><dd><b class="mono">' + DB.won(qp.sum.total) + '원</b> (부가세 포함)</dd></dl>' +
            lineTable(qp.lines, qp.sum, { showSource: false }) +
            (qp.adjustNote ? '<div class="note ac" style="margin-top:12px">' + ic('info') +
              '<div class="bd"><b>회신 메모</b>' + esc(qp.adjustNote) + '</div></div>' : '') +
            '<div class="note" style="margin-top:12px">' + ic('doc') + '<div class="bd">' +
            '<b>미리보기와 동일한 서식으로 PDF를 내려받을 수 있습니다</b>' +
            '거래처 화면에서도 같은 견적서를 확인할 수 있으며, 파일에는 발행 당시 확정된 단가가 그대로 표시됩니다.</div></div>' +
            '</div>',
          foot: '<button class="btn" data-act="q-pdf-dl" data-id="' + qp.id + '">' + ic('doc') + 'PDF 내려받기</button>' +
            '<button class="btn p" data-act="q-back" data-id="' + qp.id + '" data-w="' + (wasWrite ? '1' : '') + '">← 견적으로 돌아가기</button>' +
            '<button class="btn" data-mclose="1">닫기</button>',
        });
        break;
      }
      case 'q-back': {
        var qbId = t.getAttribute('data-id'), qbW = t.getAttribute('data-w') === '1';
        APP.closeModal(); quoteModal(qbId, qbW); break;
      }
      case 'q-review': {
        var rrv = DB.reviewQuote(t.getAttribute('data-id'), me().name);
        if (!rrv.ok) toast('바꿀 수 없습니다', 'dg', rrv.reason);
        else toast('검토 중으로 바꿨습니다', 'ok', '담당자 ' + me().name + ' 배정 · 거래처 화면에도 같은 상태가 보입니다');
        APP.rerender(); break;
      }
      case 'lm-set': {
        var lb = t.getAttribute('data-b'), lm = t.getAttribute('data-m');
        if (DB.listModeOf(lb) === lm) break;
        var cnt = DB.blocks.filter(function (x) { return x.partner === lb; }).length;
        APP.confirmBox('판매 가능 상품 목록 모드 변경',
          '<p><b>' + esc(DB.nameOfPartner(lb)) + '</b>의 판매 가능 상품을 <b>' +
          (lm === 'allow' ? '허용 목록' : '차단 목록') + '</b> 모드로 운영합니다.</p>' +
          '<div class="note wn" style="margin-top:12px">' + ic('alert') + '<div class="bd">' +
          '<b>현재 등록된 상품 ' + cnt + '건을 기준으로 적용 범위가 변경됩니다</b>' +
          (lm === 'allow'
            ? '지금 등록된 ' + cnt + '건<b>만</b> 판매 가능해지고 나머지 ' + (DB.products.length - cnt) + '건은 보이지 않게 됩니다.'
            : '지금 등록된 ' + cnt + '건<b>만</b> 제외되고 나머지 ' + (DB.products.length - cnt) + '건이 다시 열립니다.') +
          ' 이 거래처의 장바구니에 담긴 품목이 제외 대상이 되면 주문 단계에서 차단됩니다.</div></div>',
          '이 모드로 운영', function () {
            DB.setListMode(lb, lm, me().name);
            toast('목록 모드를 바꿨습니다', 'ok',
              DB.nameOfPartner(lb) + ' · ' + (lm === 'allow' ? '허용 목록' : '차단 목록'));
            APP.rerender();
          });
        break;
      }
      case 'noti-fail': {
        var cand = DB.notifications.filter(function (n) { return n.status === '발송완료'; })[0];
        if (!cand) { toast('발송 이력이 없습니다', 'wn'); break; }
        DB.failNotify(cand, 'SMTP 550 mailbox unavailable');
        toast('발송 실패를 만들었습니다', 'wn', '재시도 큐에 남습니다 — 주문·재고 처리에는 영향이 없습니다');
        APP.rerender(); break;
      }
      case 'noti-retry': {
        var hit2 = DB.retryNotifications(me().name);
        if (!hit2.length) toast('재시도할 알림이 없습니다', 'ac', '발송 실패 건이 없습니다');
        else toast(hit2.length + '건을 재발송했습니다', 'ok', '시도 횟수가 올라갔습니다');
        APP.rerender(); break;
      }
      case 'q-pdf-dl': toast('견적서 PDF를 내려받았습니다', 'ok', DB.quote(t.getAttribute('data-id')).no + '.pdf'); break;
      case 'switch-adm': {
        var acc2 = APP.accounts().filter(function (x) { return x.kind === 'admin' && x.admin === t.getAttribute('data-id'); })[0];
        APP.login(acc2); go('/a');
        toast(acc2.label + ' (' + acc2.role + ') 로 전환했습니다', 'ok', '역할에 따라 메뉴와 접근 권한이 달라집니다');
        break;
      }
      default: if (prev) prev(a, t, e);
    }
  };
})();
