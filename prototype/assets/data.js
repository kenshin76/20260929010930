/* ==========================================================================
   B2B 전용 주문·견적 쇼핑몰 — 프로토타입 도메인 엔진
   제안서 §3-2 / §7-1 의 설계를 실제로 동작하는 형태로 구현한다.
   · 3단 가격 조회 (기본가 → 등급 할인 → 거래처 개별 단가)
   · 주문·견적 성립 시점의 스냅샷 복제 저장
   · MOQ 3지점 검증 / 장바구니 담은 시점 단가 대조
   · 가격 격리 (서버 측 거래처 ID 강제 적용을 모사)
   외부 의존성 없음. 상태는 메모리에만 두고 새로고침 시 초기화된다.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- 유틸 */
  var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
  var D = function (s) { return new Date(s + 'T00:00:00'); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var addD = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var won = function (n) { return (Math.round(n) || 0).toLocaleString('ko-KR'); };
  var pct = function (n) { return (Math.round(n * 10) / 10) + '%'; };

  /* 데모 기준 시각 — 「시간 경과」 버튼으로 앞당길 수 있다 */
  var CLOCK = { now: D('2026-09-29'), tick: 0 };

  var seq = {};
  function nextNo(prefix, dt) {
    var k = prefix + iso(dt).replace(/-/g, '');
    seq[k] = (seq[k] || 0) + 1;
    return prefix + iso(dt).replace(/-/g, '') + '-' + pad(seq[k], 3);
  }

  /* ------------------------------------------------------------ 카테고리 */
  var CATS = [
    { id: 'c1', name: '포장 자재', subs: [{ id: 'c1a', name: '박스·완충재' }, { id: 'c1b', name: '테이프·끈' }] },
    { id: 'c2', name: '위생 용품', subs: [{ id: 'c2a', name: '장갑·마스크' }, { id: 'c2b', name: '소독·세정' }] },
    { id: 'c3', name: '일회용품', subs: [{ id: 'c3a', name: '컵·용기' }, { id: 'c3b', name: '수저·빨대' }] },
    { id: 'c4', name: '청소 용품', subs: [{ id: 'c4a', name: '세제·약품' }, { id: 'c4b', name: '도구·봉투' }] },
  ];

  /* -------------------------------------------------------------- 상품 24 */
  /* [코드, 이름, 규격, 중분류, 기본가, MOQ, 주문단위, 재고, 신상품] */
  var P = [
    ['PK-1010', '택배박스 1호', '220×190×90mm · 100매', 'c1a', 24000, 10, 5, 640, 0],
    ['PK-1020', '택배박스 3호', '270×180×150mm · 100매', 'c1a', 31000, 10, 5, 420, 0],
    ['PK-1030', '완충 에어캡', '1.2m×50m · 롤', 'c1a', 18500, 6, 2, 210, 1],
    ['PK-1040', '종이 완충재', '400mm×300m · 롤', 'c1a', 26000, 4, 2, 96, 1],
    ['PK-2010', 'OPP 투명테이프', '48mm×100m · 50개', 'c1b', 29000, 5, 5, 380, 0],
    ['PK-2020', '박스 청테이프', '50mm×40m · 30개', 'c1b', 21000, 5, 5, 264, 0],
    ['PK-2030', 'PP 포장끈', '15mm×1000m · 롤', 'c1b', 12500, 8, 4, 152, 0],
    ['HY-1010', '니트릴 장갑 M', '100매×10박스', 'c2a', 78000, 4, 2, 180, 0],
    ['HY-1020', '니트릴 장갑 L', '100매×10박스', 'c2a', 78000, 4, 2, 164, 0],
    ['HY-1030', '위생 비닐장갑', '100매×20팩', 'c2a', 16000, 10, 10, 520, 0],
    ['HY-1040', 'KF94 마스크', '개별포장 · 100매', 'c2a', 34000, 6, 3, 300, 1],
    ['HY-2010', '손소독제 500ml', '12개입 · 박스', 'c2b', 42000, 4, 2, 144, 0],
    ['HY-2020', '살균 물티슈', '80매×24팩', 'c2b', 38000, 5, 5, 175, 0],
    ['DP-1010', '종이컵 6.5oz', '50개×40줄', 'c3a', 27000, 8, 4, 288, 0],
    ['DP-1020', '아이스컵 14oz', '50개×20줄', 'c3a', 33000, 6, 2, 132, 0],
    ['DP-1030', '도시락 용기 3칸', '300세트', 'c3a', 58000, 4, 2, 88, 1],
    ['DP-1040', '컵홀더', '1000매', 'c3a', 19000, 10, 5, 410, 0],
    ['DP-2010', '나무 젓가락', '개별포장 · 1000개', 'c3b', 23000, 8, 4, 336, 0],
    ['DP-2020', '종이 빨대', '개별포장 · 3000개', 'c3b', 31000, 6, 3, 198, 0],
    ['CL-1010', '주방 세제 18L', '말통', 'c4a', 46000, 2, 1, 74, 0],
    ['CL-1020', '락스 20L', '말통', 'c4a', 27000, 2, 1, 86, 0],
    ['CL-1030', '유리 세정제 4L', '4개입 · 박스', 'c4a', 32000, 4, 2, 120, 0],
    ['CL-2010', '종량제 규격봉투 100L', '100매', 'c4b', 88000, 2, 1, 64, 0],
    ['CL-2020', '극세사 걸레', '20매', 'c4b', 24000, 6, 3, 156, 0],
  ];
  var products = P.map(function (r, i) {
    return {
      id: 'p' + (i + 1), code: r[0], name: r[1], spec: r[2], sub: r[3],
      cat: CATS.filter(function (c) { return c.subs.some(function (s) { return s.id === r[3]; }); })[0].id,
      basePrice: r[4], moq: r[5], unit: r[6], stock: r[7],
      // 등록일 기준 자동 선정: 신상품 표시 대상은 등록 후 NEW_DAYS 이내
      regAt: iso(addD(CLOCK.now, r[8] ? -(6 + i) : -(120 + i * 9))),
      pinNew: false,                                        // 관리자 수동 고정 (기간과 무관하게 노출)
      featured: false, active: true,
      desc: r[1] + ' — ' + r[2] + '. 업소용 대량 납품 규격이며, 거래처 등급과 개별 단가에 따라 공급가가 달라집니다.',
    };
  });
  ['p3', 'p11', 'p16', 'p1', 'p12'].forEach(function (id, i) {
    var p = products.filter(function (x) { return x.id === id; })[0];
    p.featured = true; p.featuredOrder = i + 1;
  });

  /* -------------------------------------------------------------- 등급 */
  var GRADES = [
    { id: 'g1', name: 'VIP', rate: 12, perms: ['quote', 'order', 'bulk', 'excel'], note: '연 거래액 1억 이상' },
    { id: 'g2', name: '일반', rate: 7, perms: ['quote', 'order', 'bulk'], note: '정기 거래처' },
    { id: 'g3', name: '신규', rate: 3, perms: ['quote', 'order'], note: '거래 6개월 미만' },
  ];
  var PERM_LABEL = { quote: '견적 요청', order: '주문 생성', bulk: '대량 담기', excel: '엑셀 일괄', credit: '후불 결제' };

  /* ------------------------------------------------------------ 거래처 5 */
  var partners = [
    { id: 'b1', biz: '128-81-45723', name: '대성유통', ceo: '김대성', mgr: '박정우', tel: '031-452-7781',
      email: 'jw.park@daesung.example', addr: '경기도 부천시 소사구 경인로 590', status: '승인', grade: 'g1',
      joined: '2024-03-12', taxEmail: 'tax@daesung.example', biztype: '도소매', bizitem: '생활용품',
      license: '사업자등록증_대성유통.pdf' },
    { id: 'b2', biz: '214-88-10231', name: '한결상사', ceo: '이한결', mgr: '최민서', tel: '02-3141-2280',
      email: 'ms.choi@hangyeol.example', addr: '서울시 강서구 공항대로 415', status: '승인', grade: 'g2',
      joined: '2025-01-08', taxEmail: 'acc@hangyeol.example', biztype: '도매', bizitem: '포장자재',
      license: '사업자등록증_한결상사.pdf' },
    { id: 'b3', biz: '506-81-33912', name: '미래푸드시스템', ceo: '정미래', mgr: '오세훈', tel: '053-654-1120',
      email: 'sh.oh@miraefood.example', addr: '대구시 달서구 성서로 88', status: '승인', grade: 'g3',
      joined: '2026-06-20', taxEmail: 'sh.oh@miraefood.example', biztype: '서비스', bizitem: '급식',
      license: '사업자등록증_미래푸드.pdf' },
    { id: 'b4', biz: '311-05-88120', name: '우리마트 상동점', ceo: '장우리', mgr: '장우리', tel: '032-320-4417',
      email: 'woori@woorimart.example', addr: '경기도 부천시 원미구 길주로 12', status: '대기', grade: 'g3',
      joined: '2026-09-26', taxEmail: 'woori@woorimart.example', biztype: '소매', bizitem: '식료품',
      license: '사업자등록증_우리마트.pdf' },
    { id: 'b5', biz: '777-12-00001', name: '(주)테스트무역', ceo: '홍길동', mgr: '홍길동', tel: '02-000-0000',
      email: 'test@example.com', addr: '서울시 중구 1', status: '반려', grade: 'g3',
      joined: '2026-09-18', taxEmail: 'test@example.com', biztype: '무역', bizitem: '기타',
      license: '사업자등록증_테스트.pdf', rejectReason: '제출하신 사업자등록증의 상호와 신청 상호가 일치하지 않습니다. 정정 후 재신청 부탁드립니다.' },
  ];

  /* 거래처별 배송지 주소록 */
  var addresses = [
    { id: 'a1', partner: 'b1', label: '본사 창고', receiver: '박정우', tel: '031-452-7781', addr: '경기도 부천시 소사구 경인로 590 대성물류센터 1F', def: true },
    { id: 'a2', partner: 'b1', label: '김포 지점', receiver: '유상호', tel: '031-988-2210', addr: '경기도 김포시 통진읍 김포대로 1120', def: false },
    { id: 'a3', partner: 'b2', label: '강서 물류', receiver: '최민서', tel: '02-3141-2280', addr: '서울시 강서구 공항대로 415 B동 하역장', def: true },
    { id: 'a4', partner: 'b3', label: '성서 중앙주방', receiver: '오세훈', tel: '053-654-1120', addr: '대구시 달서구 성서로 88 급식동 지하1층', def: true },
  ];

  /* 거래처별 개별 단가 예외 — 전 조합을 만들지 않고 예외만 저장 (제안서 §3-2①) */
  var overrides = [
    { partner: 'b1', product: 'p1', price: 20400, memo: '연간 계약 단가' },
    { partner: 'b1', product: 'p8', price: 66000, memo: '연간 계약 단가' },
    { partner: 'b1', product: 'p23', price: 74800, memo: '물량 조건부' },
    { partner: 'b2', product: 'p5', price: 25900, memo: '경쟁사 대응' },
    { partner: 'b2', product: 'p14', price: 24300, memo: '경쟁사 대응' },
    { partner: 'b3', product: 'p16', price: 55000, memo: '신규 거래 프로모션' },
  ];

  /* 거래처별 판매 가능 상품 — 예외만 등록 (기본 전체 공개) */
  var blocks = [{ partner: 'b3', product: 'p23', reason: '취급 품목 아님' }];

  /* -------------------------------------------------------- 단가 변경 이력 */
  var priceLog = [
    { at: '2026-08-14 10:22', by: '상품담당 윤지호', product: 'p1', kind: '기본가', from: 23000, to: 24000, memo: '원지 가격 인상 반영' },
    { at: '2026-09-02 15:40', by: '상품담당 윤지호', product: 'p14', kind: '기본가', from: 26000, to: 27000, memo: '분기 단가 조정' },
    { at: '2026-09-11 09:05', by: '최고관리자 서지원', product: 'p1', kind: '거래처 단가(대성유통)', from: 20000, to: 20400, memo: '연간 계약 갱신' },
  ];

  /* ------------------------------------------------------------ 관리자 3 */
  var admins = [
    { id: 'm1', name: '서지원', loginId: 'admin', role: '최고관리자', tel: '032-320-1000', last: '2026-09-29 08:40' },
    { id: 'm2', name: '한도윤', loginId: 'ops', role: '운영자', tel: '032-320-1002', last: '2026-09-29 09:12' },
    { id: 'm3', name: '윤지호', loginId: 'goods', role: '상품담당', tel: '032-320-1005', last: '2026-09-28 17:55' },
  ];
  var ROLE_PERMS = {
    '최고관리자': ['order', 'ship', 'goods', 'price', 'member', 'content', 'stat', 'account'],
    '운영자': ['order', 'ship', 'content', 'stat'],
    '상품담당': ['goods', 'price', 'stat'],
  };
  var ROLE_PERM_LABEL = { order: '주문·입금', ship: '배송·송장', goods: '상품·재고', price: '가격 변경',
    member: '회원 승인·거래처', content: '공지·문의·배너', stat: '통계 조회', account: '관리자 계정' };

  /* -------------------------------------------------------- 콘텐츠 / 문의 */
  var notices = [
    { id: 'n1', type: '공지', title: '10월 연휴 배송 일정 안내', at: '2026-09-25', body: '10월 3일(토)~10월 9일(금) 연휴 기간 중 10월 5일·6일은 출고가 없습니다. 해당 기간 주문은 10월 7일 순차 출고됩니다. 급한 물량은 10월 2일 오전까지 주문해 주세요.', pin: true },
    { id: 'n2', type: '공지', title: '포장 자재 단가 조정 안내 (10월 1일 적용)', at: '2026-09-18', body: '원지 가격 인상으로 택배박스 1호·3호의 기본 단가가 10월 1일부터 조정됩니다. 거래처별 계약 단가가 등록된 품목은 기존 단가가 유지됩니다.', pin: true },
    { id: 'n3', type: '공지', title: '세금계산서 발행 정보 확인 요청', at: '2026-09-10', body: '마이페이지 > 세금계산서 정보에서 담당자 이메일과 업태·종목을 확인해 주세요.', pin: false },
    { id: 'f1', type: 'FAQ', title: '최소 주문 수량(MOQ)은 어디서 확인하나요?', at: '2026-09-01', body: '상품 상세 화면과 장바구니에 품목별 MOQ와 주문 단위가 표시됩니다. 기준에 못 미치면 담기·주문서 작성·최종 주문 확정 세 지점에서 각각 안내됩니다.', pin: false },
    { id: 'f2', type: 'FAQ', title: '견적서 금액과 주문 금액이 다를 수 있나요?', at: '2026-09-01', body: '아닙니다. 유효한 견적을 주문으로 전환하면 견적에서 확정된 품목·수량·금액이 주문에 그대로 적용됩니다.', pin: false },
    { id: 'f3', type: 'FAQ', title: '단가가 바뀌면 이미 확정한 주문 금액도 바뀌나요?', at: '2026-09-01', body: '바뀌지 않습니다. 주문 당시 확정된 단가·할인율·금액을 기준으로 보관하므로, 이후 기준 단가가 변경되어도 기존 주문 금액은 그대로 유지됩니다.', pin: false },
    { id: 'f4', type: 'FAQ', title: '무통장 입금 기한이 지나면 어떻게 되나요?', at: '2026-09-01', body: '입금 기한(주문일 +3일)이 지나면 주문이 자동 취소되고 재고가 복원됩니다. 취소 사유에 「입금 기한 초과」가 기록되며 안내 메일이 발송됩니다.', pin: false },
    { id: 'f5', type: 'FAQ', title: '다른 거래처의 공급가를 볼 수 있나요?', at: '2026-09-01', body: '볼 수 없습니다. 로그인한 거래처에 적용되는 공급가만 조회할 수 있으며, 다른 거래처의 가격 정보에는 접근할 수 없습니다.', pin: false },
  ];

  var inquiries = [
    { id: 'q1', partner: 'b1', kind: '상품', ref: 'p8', title: '니트릴 장갑 M 사이즈 재입고 일정', at: '2026-09-26 11:20',
      body: '다음 주 200박스 필요한데 재고가 충분한지 확인 부탁드립니다.', status: '답변완료',
      answer: '현재 180박스 보유 중이며 10월 2일 400박스 입고 예정입니다. 사전 예약 주문 넣어 두시면 입고 즉시 출고해 드리겠습니다.', answerAt: '2026-09-26 14:05', answerBy: '한도윤' },
    { id: 'q2', partner: 'b2', kind: '주문', ref: null, title: '송장번호가 조회되지 않습니다', at: '2026-09-27 09:40',
      body: '어제 출고 처리된 주문인데 택배사 사이트에서 조회가 안 됩니다.', status: '접수' },
    { id: 'q3', partner: 'b1', kind: '상품', ref: 'p23', title: '종량제 봉투 규격 문의', at: '2026-09-28 16:10',
      body: '부천시 규격으로 납품 가능한지요?', status: '접수' },
    { id: 'q4', partner: 'b3', kind: '주문', ref: null, title: '세금계산서 발행 일자 변경 요청', at: '2026-09-22 13:30',
      body: '월말 마감이라 9월 30일자로 발행 부탁드립니다.', status: '답변완료',
      answer: '9월 30일자로 발행 예정입니다. 등록하신 담당자 이메일로 전달드리겠습니다.', answerAt: '2026-09-22 17:20', answerBy: '서지원' },
  ];

  var banners = [
    { id: 'bn1', title: '10월 연휴 배송 일정 안내', link: '#/notice', from: '2026-09-25', to: '2026-10-09', order: 1, active: true },
    { id: 'bn2', title: '신규 거래처 첫 주문 무료배송', link: '#/products', from: '2026-09-01', to: '2026-10-31', order: 2, active: true },
    { id: 'bn3', title: '위생용품 신규 입고', link: '#/products?cat=c2', from: '2026-09-20', to: '2026-10-20', order: 3, active: false },
  ];

  /* ------------------------------------------------------------- 알림 이력 */
  var NOTI_KINDS = ['가입 승인', '가입 반려', '견적서 발송', '주문 접수', '입금 확인',
    '출고(송장 등록)', '취소·반품 처리 완료', '입금 기한 초과 자동 취소', '문의 답변 등록'];
  var notifications = [];
  function notify(kind, to, subject, ref) {
    notifications.unshift({
      id: 'nt' + (notifications.length + 1), kind: kind, to: to, subject: subject, ref: ref || '',
      at: iso(CLOCK.now) + ' ' + pad(9 + (notifications.length % 9)) + ':' + pad((notifications.length * 7) % 60),
      status: '발송완료', tries: 1,
    });
    return notifications[0];
  }
  /** 발송 실패를 만들어 재시도 큐를 시연한다 */
  function failNotify(n, reason) {
    n.status = '발송 실패'; n.tries = 1; n.error = reason || 'SMTP 550 mailbox unavailable';
    n.queued = true;
    return n;
  }
  /** 재시도 큐 처리 — 실패 건을 한 번씩 재발송한다 */
  function retryNotifications(by) {
    var hit = notifications.filter(function (n) { return n.status === '발송 실패'; });
    hit.forEach(function (n) {
      n.tries += 1; n.status = '발송완료'; n.queued = false;
      n.at = iso(CLOCK.now) + ' ' + pad(9 + (n.tries % 9)) + ':' + pad((n.tries * 13) % 60);
    });
    if (hit.length) log(by || '관리자', '알림 재시도 큐 처리', hit.length + '건 재발송');
    return hit;
  }

  /* ------------------------------------------------------------ 감사 로그 */
  var audit = [];
  function log(actor, action, detail, level) {
    audit.unshift({ at: iso(CLOCK.now) + ' ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()),
      actor: actor, action: action, detail: detail, level: level || 'info' });
  }

  /* ======================================================================
     가격 엔진 — 3단 조회 (제안서 §3-2① / §7-1 2-2)
     ====================================================================== */
  function gradeOf(partnerId) {
    var b = partners.filter(function (x) { return x.id === partnerId; })[0];
    return b ? GRADES.filter(function (g) { return g.id === b.grade; })[0] : null;
  }
  function overrideOf(partnerId, productId) {
    return overrides.filter(function (o) { return o.partner === partnerId && o.product === productId; })[0] || null;
  }
  /** 거래처마다 「차단 목록(기본)」 또는 「허용 목록」 중 하나를 쓴다 */
  function listModeOf(partnerId) {
    var b = partners.filter(function (x) { return x.id === partnerId; })[0];
    return (b && b.listMode) || 'block';
  }
  function setListMode(partnerId, mode, by) {
    var b = partners.filter(function (x) { return x.id === partnerId; })[0];
    if (!b) return { ok: false };
    b.listMode = mode === 'allow' ? 'allow' : 'block';
    log(by || '관리자', '판매 가능 상품 목록 모드 변경',
      b.name + ' → ' + (b.listMode === 'allow' ? '허용 목록' : '차단 목록'));
    return { ok: true, mode: b.listMode };
  }
  var NEW_DAYS = 30;                                        // 신상품 노출 기준 일수 (관리자 설정값)
  /** 신상품 = 등록일 기준 NEW_DAYS 이내, 또는 관리자가 수동 고정한 것 */
  function isNewProduct(p) {
    if (!p) return false;
    if (p.pinNew) return true;
    if (!p.regAt) return false;
    return D(p.regAt) >= addD(CLOCK.now, -NEW_DAYS);
  }
  function isBlocked(partnerId, productId) {
    var listed = blocks.some(function (b) { return b.partner === partnerId && b.product === productId; });
    // 허용 목록 모드에서는 「등록된 것만」 판매 가능 — 판정을 뒤집는다
    return listModeOf(partnerId) === 'allow' ? !listed : listed;
  }
  /** 3단 조회: ③ 거래처 개별 단가가 있으면 ③, 없으면 ① 기본가에 ② 등급 할인 적용 */
  function priceFor(productId, partnerId) {
    var p = products.filter(function (x) { return x.id === productId; })[0];
    if (!p) return null;
    var g = gradeOf(partnerId), ov = overrideOf(partnerId, productId);
    if (ov) {
      return { unit: ov.price, base: p.basePrice, gradeRate: g ? g.rate : 0, gradeName: g ? g.name : '-',
        source: '거래처 개별 단가', step: 3, memo: ov.memo };
    }
    var rate = g ? g.rate : 0;
    return { unit: Math.round(p.basePrice * (100 - rate) / 100), base: p.basePrice, gradeRate: rate,
      gradeName: g ? g.name : '-', source: rate ? '기본가 − 등급 할인 ' + rate + '%' : '기본가', step: rate ? 2 : 1, memo: '' };
  }
  /** 가격 격리 — 서버 측 거래처 ID 강제 적용을 모사한다 */
  function priceForSession(productId, session) {
    if (!session || session.kind !== 'partner') return null;
    var b = partners.filter(function (x) { return x.id === session.partner; })[0];
    if (!b || b.status !== '승인') return null;          // 승인 전에는 가격 API 차단
    if (isBlocked(session.partner, productId)) return null;
    return priceFor(productId, session.partner);
  }
  var blockedAttempts = [];
  function attemptForeignPrice(session, targetPartner, productId) {
    blockedAttempts.unshift({ at: iso(CLOCK.now), who: session ? session.label : '비로그인',
      target: (partners.filter(function (x) { return x.id === targetPartner; })[0] || {}).name || '?',
      product: (products.filter(function (x) { return x.id === productId; })[0] || {}).code || '?' });
    log(session ? session.label : '비로그인', '타사 가격 조회 차단',
      '대상 거래처 ' + targetPartner + ' / 상품 ' + productId + ' — 서버에서 차단', 'warn');
    return null;
  }

  /* ======================================================================
     MOQ 검증 — 담기 / 주문서 작성 / 최종 확정 3지점 (제안서 §7-1 2-2)
     ====================================================================== */
  var MOQ_POINTS = { cart: '장바구니 담기', form: '주문서 작성', confirm: '최종 주문 확정' };
  function validateMoq(productId, qty) {
    var _p = products.filter(function (x) { return x.id === productId; })[0];
    if (_p && (!(_p.moq >= 1) || !(_p.unit >= 1)))
      return { ok: false, reason: 'MOQ · 주문 단위가 올바르게 설정되지 않은 상품입니다 (관리자 확인 필요)' };
    var p = products.filter(function (x) { return x.id === productId; })[0];
    if (!p) return { ok: false, reason: '존재하지 않는 상품입니다' };
    if (!qty || qty <= 0) return { ok: false, reason: '수량을 1 이상 입력해 주세요' };
    if (qty < p.moq) return { ok: false, reason: '최소 주문 수량 ' + p.moq + ' 미만 (현재 ' + qty + ')', need: p.moq };
    if (qty % p.unit !== 0) {
      var up = Math.ceil(qty / p.unit) * p.unit;
      return { ok: false, reason: '주문 단위 ' + p.unit + ' 의 배수가 아닙니다 (현재 ' + qty + ' → ' + up + ' 권장)', need: up };
    }
    return { ok: true };
  }
  function validateStock(productId, qty) {
    var p = products.filter(function (x) { return x.id === productId; })[0];
    if (qty > p.stock) return { ok: false, reason: '재고 부족 (가용 ' + p.stock + ')' };
    return { ok: true };
  }

  /* ======================================================================
     스냅샷 — 견적 확정·주문 생성 시점의 값을 그 행에 복제 저장
     ====================================================================== */
  var VAT = 0.1;
  function makeLine(productId, qty, partnerId) {
    var p = products.filter(function (x) { return x.id === productId; })[0];
    var pr = priceFor(productId, partnerId);
    var supply = pr.unit * qty;
    return {
      product: productId, code: p.code, name: p.name, spec: p.spec,     // 상품 정보도 함께 고정
      qty: qty, moq: p.moq, unitStep: p.unit,
      unitPrice: pr.unit, basePrice: pr.base, gradeRate: pr.gradeRate, priceSource: pr.source,
      supply: supply, vat: Math.round(supply * VAT), total: supply + Math.round(supply * VAT),
    };
  }
  function sumLines(lines) {
    var s = lines.reduce(function (a, l) { return a + l.supply; }, 0);
    var v = lines.reduce(function (a, l) { return a + l.vat; }, 0);
    return { supply: s, vat: v, total: s + v };
  }

  /* ======================================================================
     장바구니 — 담은 시점 단가를 함께 저장해 확정 직전 대조 (제안서 §7-1 2-2)
     ====================================================================== */
  var carts = {};   // partnerId → [{product, qty, addedPrice, addedAt}]
  function cart(partnerId) { return (carts[partnerId] = carts[partnerId] || []); }
  function cartAdd(partnerId, productId, qty) {
    if (isBlocked(partnerId, productId))
      return { ok: false, reason: '이 거래처에 판매 제외로 지정된 품목입니다' };
    var c = cart(partnerId), ex = c.filter(function (x) { return x.product === productId; })[0];
    var have = ex ? ex.qty : 0;
    var want = have + qty;                                  // 누적 수량으로 검증한다
    function back(r) {                                      // 사유·권장값을 「이번에 담을 수량」 기준으로 되돌린다
      return { ok: false, need: (r.need == null ? r.need : Math.max(0, r.need - have)),
        reason: r.reason + (have ? ' — 장바구니 ' + have + '개를 더한 누계 ' + want + ' 기준' : '') };
    }
    var v = validateMoq(productId, want); if (!v.ok) return back(v);
    var st = validateStock(productId, want); if (!st.ok) return back(st);
    var pr = priceFor(productId, partnerId);
    if (ex) { ex.qty = want; }      // addedPrice 는 최초로 담은 시점 값을 유지한다
    else c.push({ product: productId, qty: qty, addedPrice: pr.unit, addedAt: iso(CLOCK.now) });
    return { ok: true };
  }
  function cartSetQty(partnerId, productId, qty) {
    if (isBlocked(partnerId, productId))
      return { ok: false, reason: '이 거래처에 판매 제외로 지정된 품목입니다' };
    var v = validateMoq(productId, qty); if (!v.ok) return v;
    var s = validateStock(productId, qty); if (!s.ok) return s;
    var it = cart(partnerId).filter(function (x) { return x.product === productId; })[0];
    if (it) it.qty = qty;
    return { ok: true };
  }
  function cartRemove(partnerId, productId) {
    carts[partnerId] = cart(partnerId).filter(function (x) { return x.product !== productId; });
  }
  function cartClear(partnerId) { carts[partnerId] = []; }
  /** 담은 시점 단가 vs 현재 단가 대조 — 차이가 있으면 재확인을 받아야 한다 */
  function cartDrift(partnerId) {
    return cart(partnerId).map(function (it) {
      var now = priceFor(it.product, partnerId).unit;
      return { product: it.product, was: it.addedPrice, now: now, diff: now - it.addedPrice };
    }).filter(function (d) { return d.diff !== 0; });
  }
  function cartAckDrift(partnerId, only) {
    cart(partnerId).forEach(function (it) {
      if (only && only.indexOf(it.product) < 0) return;
      it.addedPrice = priceFor(it.product, partnerId).unit;
    });
  }

  /* ======================================================================
     견적
     ====================================================================== */
  var QUOTE_ST = ['요청', '검토 중', '발송 완료', '거절'];
  var quotes = [];
  function validateLines(lines, checkStock, partnerId) {
    var errs = [];
    lines.forEach(function (l) {
      if (partnerId && isBlocked(partnerId, l.product)) {
        errs.push({ product: l.product, name: l.name, reason: '판매 제외로 지정된 품목입니다' });
        return;
      }
      var v = validateMoq(l.product, l.qty);
      if (!v.ok) errs.push({ product: l.product, name: l.name, reason: v.reason, need: v.need });
      else if (checkStock) {
        var s = validateStock(l.product, l.qty);
        if (!s.ok) errs.push({ product: l.product, name: l.name, reason: s.reason });
      }
    });
    return { ok: errs.length === 0, errors: errs };
  }
  function createQuote(partnerId, lines, memo, dueDays) {
    var v = validateLines(lines, false, partnerId);
    if (!v.ok) return { error: v.errors };
    var q = {
      id: 'q' + (quotes.length + 1), no: nextNo('QT-', CLOCK.now), partner: partnerId,
      status: '요청', at: iso(CLOCK.now), memo: memo || '', lines: lines, sum: sumLines(lines),
      validUntil: iso(addD(CLOCK.now, dueDays || 14)), converted: null, adjustNote: '',
    };
    quotes.unshift(q);
    log(nameOfPartner(partnerId), '견적 요청', q.no + ' · ' + lines.length + '개 품목');
    return q;
  }
  /** 요청 → 검토 중 (담당자 배정) */
  function reviewQuote(quoteId, by) {
    var q = quotes.filter(function (x) { return x.id === quoteId; })[0];
    if (q.status !== '요청') return { ok: false, reason: '요청 상태의 견적만 검토 중으로 바꿀 수 있습니다' };
    q.status = '검토 중'; q.reviewer = by || '관리자'; q.reviewAt = iso(CLOCK.now);
    log(by || '관리자', '견적 검토 착수', q.no);
    return { ok: true };
  }
  function sendQuote(quoteId, adjustNote) {
    var q = quotes.filter(function (x) { return x.id === quoteId; })[0];
    if (q.status !== '요청' && q.status !== '검토 중')
      return { error: [{ reason: '요청 또는 검토 중 상태의 견적만 발송할 수 있습니다' }] };
    q.status = '발송 완료'; q.adjustNote = adjustNote || '';
    notify('견적서 발송', nameOfPartner(q.partner), '견적서 ' + q.no + ' 발송', q.no);
    log('관리자', '견적서 발송', q.no);
    return q;
  }
  function rejectQuote(quoteId, reason) {
    var q = quotes.filter(function (x) { return x.id === quoteId; })[0];
    q.status = '거절'; q.adjustNote = reason || '';
    log('관리자', '견적 거절', q.no + ' — ' + (reason || ''));
    return q;
  }

  /* ======================================================================
     주문 — 상태 전이, 스냅샷, 재고, 입금 기한
     ====================================================================== */
  var ORDER_ST = ['결제대기', '결제완료', '준비중', '출고', '배송중', '배송완료'];
  var ST_NEXT = { '결제대기': '결제완료', '결제완료': '준비중', '준비중': '출고', '출고': '배송중', '배송중': '배송완료', '배송완료': null };
  var orders = [];

  function nameOfPartner(id) { var b = partners.filter(function (x) { return x.id === id; })[0]; return b ? b.name : '?'; }
  function addrSnapshot(addrId) {
    var a = addresses.filter(function (x) { return x.id === addrId; })[0];
    return a ? { label: a.label, receiver: a.receiver, tel: a.tel, addr: a.addr } : null;
  }

  function createOrder(partnerId, lines, opt) {
    opt = opt || {};
    var blk = lines.filter(function (l) { return isBlocked(partnerId, l.product); });
    if (blk.length) return { error: blk.map(function (l) {
      return { product: l.product, name: l.name, reason: '판매 제외로 지정된 품목입니다' };
    }) };
    var short = lines.filter(function (l) {
      var p = products.filter(function (x) { return x.id === l.product; })[0];
      return !p || l.qty > p.stock;
    });
    if (short.length) return { error: short.map(function (l) {
      var p = products.filter(function (x) { return x.id === l.product; })[0];
      return { product: l.product, name: l.name, reason: '재고 부족 (요청 ' + l.qty + ' / 가용 ' + (p ? p.stock : 0) + ')' };
    }) };
    lines.forEach(function (l) {
      var p = products.filter(function (x) { return x.id === l.product; })[0];
      p.stock -= l.qty;                                     // 주문 확정 시 재고 차감 (잠금 트랜잭션 가정)
    });
    var o = {
      id: 'o' + (orders.length + 1), no: nextNo('OD-', CLOCK.now), partner: partnerId,
      at: iso(CLOCK.now), status: opt.pay === 'card' ? '결제완료' : '결제대기',
      pay: opt.pay === 'card' ? '카드' : '무통장', payer: opt.payer || nameOfPartner(partnerId),
      payDue: opt.pay === 'card' ? null : iso(addD(CLOCK.now, 3)),
      paidAt: opt.pay === 'card' ? iso(CLOCK.now) : null,
      txid: opt.txid || (opt.pay === 'card' ? 'PG' + Date.now().toString().slice(-10) : null),
      lines: lines, sum: sumLines(lines),
      ship: opt.ship || null, shipMemo: opt.shipMemo || '',
      fromQuote: opt.fromQuote || null,                     // 원 견적 번호 역추적
      courier: null, invoice: null, cancelReason: null,
      history: [{ at: iso(CLOCK.now), st: opt.pay === 'card' ? '결제완료' : '결제대기', by: nameOfPartner(partnerId) }],
      claims: [],
    };
    orders.unshift(o);
    notify('주문 접수', nameOfPartner(partnerId), '주문 ' + o.no + ' 접수', o.no);
    if (o.status === '결제완료') notify('입금 확인', nameOfPartner(partnerId),
      '주문 ' + o.no + ' 카드 결제가 승인되었습니다 (거래 고유번호 ' + o.txid + ')', o.no);
    log(nameOfPartner(partnerId), '주문 생성', o.no + ' · ' + won(o.sum.total) + '원');
    return o;
  }

  /** 견적 → 주문 전환 : 견적 행을 복제하고 가격을 다시 산정하지 않는다 */
  function convertQuote(quoteId, opt) {
    var q = quotes.filter(function (x) { return x.id === quoteId; })[0];
    if (q.status !== '발송 완료') return { error: [{ reason: '발송 완료된 견적만 주문으로 전환할 수 있습니다' }] };
    if (q.converted) return { error: [{ reason: '이미 ' + q.converted + ' 으로 전환된 견적입니다' }] };
    if (q.validUntil < iso(CLOCK.now))
      return { error: [{ reason: '견적 유효기간(' + q.validUntil + ')이 지났습니다. 재견적을 요청해 주세요',
        expired: true }] };
    var lines = JSON.parse(JSON.stringify(q.lines));        // 복제 — 금액 재산정 없음
    var v = validateLines(lines, true, q.partner);          // 수량·재고·판매 제외를 다시 확인한다
    if (!v.ok) return { error: v.errors };
    var o = createOrder(q.partner, lines, Object.assign({}, opt, { fromQuote: q.no }));
    q.converted = o.no;
    log(nameOfPartner(q.partner), '견적 → 주문 전환', q.no + ' → ' + o.no + ' (금액 재산정 없음)');
    return o;
  }

  function advance(orderId, by) {
    var o = orders.filter(function (x) { return x.id === orderId; })[0];
    var nx = ST_NEXT[o.status];
    if (!nx) return { ok: false, reason: '더 진행할 상태가 없습니다' };
    if (o.status === '결제대기') return { ok: false, reason: '입금 확인을 먼저 처리해야 합니다' };
    if (nx === '배송중' && !o.invoice) return { ok: false, reason: '송장번호를 등록한 후 배송 중으로 전환할 수 있습니다' };
    o.status = nx; o.history.push({ at: iso(CLOCK.now), st: nx, by: by || '관리자' });
    if (nx === '출고') notify('출고(송장 등록)', nameOfPartner(o.partner), '주문 ' + o.no + ' 출고 (송장 등록)', o.no);
    log(by || '관리자', '주문 상태 변경', o.no + ' → ' + nx);
    return { ok: true, status: nx };
  }
  function setStatus(orderId, to, by) {
    var o = orders.filter(function (x) { return x.id === orderId; })[0];
    var from = ORDER_ST.indexOf(o.status), t = ORDER_ST.indexOf(to);
    if (t < 0) return { ok: false, reason: '알 수 없는 상태' };
    if (t !== from + 1) return { ok: false, reason: '「' + o.status + '」 다음은 「' + ST_NEXT[o.status] + '」 입니다. 단계 건너뛰기는 서버에서 차단됩니다' };
    return advance(orderId, by);
  }
  function confirmPayment(orderId, by) {
    var o = orders.filter(function (x) { return x.id === orderId; })[0];
    if (o.status !== '결제대기') return { ok: false, reason: '결제 대기 상태가 아닙니다' };
    o.status = '결제완료'; o.paidAt = iso(CLOCK.now);
    o.history.push({ at: iso(CLOCK.now), st: '결제완료', by: by || '관리자' });
    notify('입금 확인', nameOfPartner(o.partner), '주문 ' + o.no + ' 무통장 입금 확인', o.no);
    log(by || '관리자', '입금 확인', o.no);
    return { ok: true };
  }
  function setInvoice(orderId, courier, invoice, by) {
    var o = orders.filter(function (x) { return x.id === orderId; })[0];
    o.courier = courier; o.invoice = invoice;
    log(by || '관리자', '송장 등록', o.no + ' · ' + courier + ' ' + invoice);
    return { ok: true };
  }
  function restock(o) { o.lines.forEach(function (l) {
    var p = products.filter(function (x) { return x.id === l.product; })[0]; if (p) p.stock += l.qty; }); }

  function cancelOrder(orderId, reason, by) {
    var o = orders.filter(function (x) { return x.id === orderId; })[0];
    if (o.status === '취소' || o.status === '반품 완료')
      return { ok: false, reason: '이미 ' + o.status + ' 처리된 주문입니다' };
    o.status = '취소'; o.cancelReason = reason;
    o.history.push({ at: iso(CLOCK.now), st: '취소', by: by || '관리자' });
    restock(o);
    notify('취소·반품 처리 완료', nameOfPartner(o.partner), '주문 ' + o.no + ' 취소 — ' + reason, o.no);
    log(by || '관리자', '주문 취소', o.no + ' — ' + reason);
    return { ok: true };
  }

  /** 입금 기한 초과 자동 취소 — 취소·재고 복원·알림 이벤트를 한 트랜잭션으로 */
  function runPaymentDeadlineJob() {
    var hit = [];
    orders.forEach(function (o) {
      if (o.status === '결제대기' && o.payDue && D(o.payDue) < CLOCK.now) {
        o.status = '취소'; o.cancelReason = '입금 기한 초과';
        o.history.push({ at: iso(CLOCK.now), st: '취소', by: '스케줄러' });
        restock(o);
        notify('입금 기한 초과 자동 취소', nameOfPartner(o.partner),
          '주문 ' + o.no + ' 입금 기한 초과 자동 취소', o.no);
        log('스케줄러', '입금 기한 초과 자동 취소', o.no + ' · 재고 복원 완료', 'warn');
        hit.push(o);
      }
    });
    return hit;
  }

  /* 취소·반품 요청 워크플로 */
  function createClaim(orderId, kind, reason, refundAcc) {
    var o = orders.filter(function (x) { return x.id === orderId; })[0];
    var c = { id: 'cl' + (o.claims.length + 1) + '-' + o.id, kind: kind, reason: reason,
      status: '요청', at: iso(CLOCK.now), refundAcc: refundAcc || '', decidedAt: null, note: '' };
    o.claims.push(c);
    log(nameOfPartner(o.partner), kind + ' 요청', o.no + ' — ' + reason);
    return c;
  }
  function decideClaim(orderId, claimId, approve, note, by) {
    var o = orders.filter(function (x) { return x.id === orderId; })[0];
    var c = o.claims.filter(function (x) { return x.id === claimId; })[0];
    c.status = approve ? '승인' : '거절'; c.note = note || ''; c.decidedAt = iso(CLOCK.now);
    log(by || '관리자', c.kind + ' ' + c.status, o.no);
    return c;
  }
  var refundLog = [];                                       // 환불 처리 이력
  var pgApproved = {};                                      // 거래 고유번호 → 주문번호
  /** 동일 결제(거래 고유번호)의 중복 승인을 차단한다 */
  function pgUsed(txid) { return pgApproved[txid] || null; }
  function pgApprove(txid, orderNo) {
    if (pgApproved[txid]) return { ok: false, reason: '이미 ' + pgApproved[txid] + ' 에 승인된 거래번호입니다 (중복 승인 차단)' };
    pgApproved[txid] = orderNo;
    return { ok: true };
  }
  function completeClaim(orderId, claimId, by) {
    var o = orders.filter(function (x) { return x.id === orderId; })[0];
    var c = o.claims.filter(function (x) { return x.id === claimId; })[0];
    if (c.status !== '승인') return { ok: false, reason: '승인된 요청만 처리 완료할 수 있습니다' };
    if (o.status === '취소' || o.status === '반품 완료')
      return { ok: false, reason: '이미 ' + o.status + ' 처리된 주문입니다' };
    c.status = '처리 완료'; c.completedAt = iso(CLOCK.now);
    if (c.kind === '취소') { o.status = '취소'; o.cancelReason = '거래처 취소 요청'; restock(o); }
    else { o.status = '반품 완료'; restock(o); }          // 반품은 검수 완료 시 재고 복원
    o.history.push({ at: iso(CLOCK.now), st: o.status, by: by || '관리자' });
    var card = /카드/.test(o.pay);
    c.refund = {
      at: iso(CLOCK.now), by: by || '관리자', amount: o.sum.total,
      via: card ? 'PG 취소 API' : '계좌 환불',
      ref: card ? (o.txid || 'PG-' + o.no) : (c.refundAcc || '환불 계좌 미등록'),
      result: card ? '승인 취소 완료' : '환불 이체 완료',
    };
    refundLog.unshift({ at: c.refund.at, order: o.no, partner: nameOfPartner(o.partner), kind: c.kind,
      amount: o.sum.total, via: c.refund.via, ref: c.refund.ref, by: c.refund.by });
    notify('취소·반품 처리 완료', nameOfPartner(o.partner), '주문 ' + o.no + ' ' + c.kind + ' 처리 완료', o.no);
    log(by || '관리자', c.kind + ' 처리 완료',
      o.no + ' · 재고 복원 · ' + c.refund.via + ' ' + won(o.sum.total) + '원 (' + c.refund.ref + ')');
    return { ok: true };
  }

  /* ======================================================================
     엑셀 업로드 — 전 행 검증 후 한 건이라도 오류면 전체 미반영
     ====================================================================== */
  var EXCEL_KINDS = {
    product: { label: '상품', cols: ['상품코드', '상품명', '기본가', 'MOQ', '주문단위', '재고'] },
    order: { label: '주문', cols: ['거래처 사업자번호', '상품코드', '수량'] },
    price: { label: '거래처 단가', cols: ['거래처 사업자번호', '상품코드', '단가'] },
    invoice: { label: '송장', cols: ['주문번호', '택배사', '송장번호'] },
  };
  function excelValidate(kind, rows) {
    var errs = [];
    var need = {};                                          // 주문 업로드 — 같은 상품이 여러 행에 나오면 합산해 재고를 본다
    rows.forEach(function (r, i) {
      var n = i + 2;                                       // 헤더 1행 가정
      if (kind === 'product') {
        if (!products.some(function (p) { return p.code === r[0]; })) errs.push({ row: n, col: '상품코드', msg: '존재하지 않는 상품코드: ' + r[0] });
        if (!(+r[2] > 0)) errs.push({ row: n, col: '기본가', msg: '숫자가 아니거나 0 이하: ' + r[2] });
        if (!(+r[3] > 0)) errs.push({ row: n, col: 'MOQ', msg: '숫자가 아니거나 0 이하: ' + r[3] });
      } else if (kind === 'order') {
        var b = partners.filter(function (x) { return x.biz === r[0]; })[0];
        if (!b) errs.push({ row: n, col: '거래처 사업자번호', msg: '등록되지 않은 사업자번호: ' + r[0] });
        else if (b.status !== '승인') errs.push({ row: n, col: '거래처 사업자번호', msg: '승인되지 않은 거래처: ' + b.name + ' (' + b.status + ')' });
        var p = products.filter(function (x) { return x.code === r[1]; })[0];
        if (!p) errs.push({ row: n, col: '상품코드', msg: '존재하지 않는 상품코드: ' + r[1] });
        else {
          var v = validateMoq(p.id, +r[2]);
          if (!v.ok) errs.push({ row: n, col: '수량', msg: v.reason });        // 업로드 주문에도 MOQ 검증
          if (b && isBlocked(b.id, p.id)) errs.push({ row: n, col: '상품코드', msg: b.name + ' 판매 제외 품목' });
          need[p.id] = (need[p.id] || 0) + (+r[2] || 0);                       // 업로드 주문에도 재고 검증
          if (need[p.id] > p.stock)
            errs.push({ row: n, col: '수량', msg: '재고 부족 (이 파일 누계 ' + need[p.id] + ' / 가용 ' + p.stock + ')' });
        }
      } else if (kind === 'price') {
        if (!partners.some(function (x) { return x.biz === r[0]; })) errs.push({ row: n, col: '거래처 사업자번호', msg: '등록되지 않은 사업자번호: ' + r[0] });
        if (!products.some(function (x) { return x.code === r[1]; })) errs.push({ row: n, col: '상품코드', msg: '존재하지 않는 상품코드: ' + r[1] });
        if (!(+r[2] > 0)) errs.push({ row: n, col: '단가', msg: '숫자가 아니거나 0 이하: ' + r[2] });
      } else if (kind === 'invoice') {
        if (!orders.some(function (x) { return x.no === r[0]; })) errs.push({ row: n, col: '주문번호', msg: '존재하지 않는 주문번호: ' + r[0] });
        if (!r[1]) errs.push({ row: n, col: '택배사', msg: '택배사가 비어 있습니다' });
        if (!/^\d{9,14}$/.test(String(r[2] || ''))) errs.push({ row: n, col: '송장번호', msg: '송장번호 형식 오류: ' + r[2] });
      }
    });
    return { ok: errs.length === 0, total: rows.length, errors: errs };
  }
  function excelApply(kind, rows) {
    var v = excelValidate(kind, rows);
    if (!v.ok) { log('관리자', '엑셀 업로드 반려', EXCEL_KINDS[kind].label + ' ' + rows.length + '행 중 ' + v.errors.length + '건 오류 — 전 행 미반영', 'warn'); return v; }
    if (kind === 'product') rows.forEach(function (r) {
      var p = products.filter(function (x) { return x.code === r[0]; })[0];
      if (p.basePrice !== +r[2]) priceLog.unshift({ at: iso(CLOCK.now) + ' 엑셀', by: '엑셀 일괄', product: p.id, kind: '기본가', from: p.basePrice, to: +r[2], memo: '엑셀 일괄 업로드' });
      p.basePrice = +r[2]; p.moq = +r[3]; p.unit = +r[4]; p.stock = +r[5];
    });
    if (kind === 'price') rows.forEach(function (r) {
      var b = partners.filter(function (x) { return x.biz === r[0]; })[0];
      var p = products.filter(function (x) { return x.code === r[1]; })[0];
      var ov = overrideOf(b.id, p.id);
      if (ov) { priceLog.unshift({ at: iso(CLOCK.now) + ' 엑셀', by: '엑셀 일괄', product: p.id, kind: '거래처 단가(' + b.name + ')', from: ov.price, to: +r[2], memo: '엑셀 일괄 업로드' }); ov.price = +r[2]; }
      else overrides.push({ partner: b.id, product: p.id, price: +r[2], memo: '엑셀 일괄 업로드' });
    });
    if (kind === 'invoice') rows.forEach(function (r) {
      var o = orders.filter(function (x) { return x.no === r[0]; })[0];
      setInvoice(o.id, r[1], String(r[2]), '엑셀 일괄');
    });
    if (kind === 'order') {
      var made = [], fail = null;
      rows.forEach(function (r, i) {
        if (fail) return;
        var b = partners.filter(function (x) { return x.biz === r[0]; })[0];
        var p = products.filter(function (x) { return x.code === r[1]; })[0];
        var o = createOrder(b.id, [makeLine(p.id, +r[2], b.id)],
          { pay: 'bank', ship: addrSnapshot((addresses.filter(function (a) { return a.partner === b.id && a.def; })[0] || {}).id) });
        if (o.error) fail = { row: i + 2, col: '수량', msg: o.error[0].reason };
        else made.push(o);
      });
      if (fail) {                                            // 한 건이라도 실패하면 이미 만든 주문을 되돌린다
        var nos = made.map(function (o) { return o.no; });
        made.forEach(function (o) { restock(o); });           // 재고만 되돌리고 취소 주문을 남기지 않는다
        orders = orders.filter(function (o) { return nos.indexOf(o.no) < 0; });
        // 되돌린 주문을 가리키는 알림도 함께 지운다 (없는 주문번호가 이력에 남지 않도록)
        for (var ni = notifications.length - 1; ni >= 0; ni--)
          if (nos.indexOf(notifications[ni].ref) >= 0) notifications.splice(ni, 1);
        log('관리자', '엑셀 업로드 반려',
          EXCEL_KINDS[kind].label + ' — 반영 중 오류로 전 행 롤백 (재고 복원 · 주문 미생성)', 'warn');
        return { ok: false, total: rows.length, errors: [fail] };
      }
    }
    log('관리자', '엑셀 업로드 반영', EXCEL_KINDS[kind].label + ' ' + rows.length + '행 전체 반영');
    return v;
  }

  /* ======================================================================
     회원 승인
     ====================================================================== */
  function setBlock(partnerId, productId, on, by) {
    // 예외 테이블은 하나이고 모드에 따라 판정 방향만 다르다.
    // 차단 목록: 목록에 있으면 제외 / 허용 목록: 목록에 있으면 판매 가능
    var allow = listModeOf(partnerId) === 'allow';
    var listed = blocks.some(function (b) { return b.partner === partnerId && b.product === productId; });
    var want = allow ? !on : on;                            // 목록에 있어야 하는가
    if (want && !listed) blocks.push({ partner: partnerId, product: productId,
      reason: allow ? '허용 목록 등록' : '거래처 판매 제외' });
    if (!want && listed) {
      for (var i = blocks.length - 1; i >= 0; i--)
        if (blocks[i].partner === partnerId && blocks[i].product === productId) blocks.splice(i, 1);
    }
    log(by || '관리자', '판매 가능 상품 ' + (on ? '제외' : '해제'),
      nameOfPartner(partnerId) + ' / ' + (products.filter(function (x) { return x.id === productId; })[0] || {}).code);
    return { ok: true, blocked: on };
  }
  /** 견적 품목의 단가를 건별 조정 — 조정 사유를 함께 기록한다 */
  function adjustQuoteLine(quoteId, productId, unit, memo, by) {
    var q = quotes.filter(function (x) { return x.id === quoteId; })[0];
    var l = q.lines.filter(function (x) { return x.product === productId; })[0];
    if (!l) return { ok: false };
    var from = l.unitPrice;
    l.unitPrice = +unit;
    l.supply = l.unitPrice * l.qty;
    l.vat = Math.round(l.supply * VAT);
    l.total = l.supply + l.vat;
    l.priceSource = '견적 건별 조정';
    l.adjust = { from: from, to: +unit, memo: memo || '', by: by || '관리자', at: iso(CLOCK.now) };
    q.sum = sumLines(q.lines);
    log(by || '관리자', '견적 단가 조정', q.no + ' / ' + l.code + ' ' + won(from) + ' → ' + won(unit) + (memo ? ' — ' + memo : ''));
    return { ok: true };
  }
  function approvePartner(id, by) {
    var b = partners.filter(function (x) { return x.id === id; })[0];
    b.status = '승인'; b.rejectReason = null;
    notify('가입 승인', b.name, b.name + ' 가입 승인', b.biz);
    log(by || '관리자', '가입 승인', b.name);
  }
  function rejectPartner(id, reason, by) {
    var b = partners.filter(function (x) { return x.id === id; })[0];
    b.status = '반려'; b.rejectReason = reason;
    notify('가입 반려', b.name, b.name + ' 가입 반려 — ' + reason, b.biz);
    log(by || '관리자', '가입 반려', b.name + ' — ' + reason);
  }

  /* ======================================================================
     단가 마스터 변경 — 항상 이력을 남긴다
     ====================================================================== */
  function changeBasePrice(productId, to, by, memo) {
    var p = products.filter(function (x) { return x.id === productId; })[0];
    var from = p.basePrice; p.basePrice = +to;
    priceLog.unshift({ at: iso(CLOCK.now) + ' ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()),
      by: by || '관리자', product: productId, kind: '기본가', from: from, to: +to, memo: memo || '' });
    log(by || '관리자', '기본가 변경', p.code + ' ' + won(from) + ' → ' + won(to) + '원');
    return { from: from, to: +to };
  }
  function changeOverride(partnerId, productId, to, by, memo) {
    var ov = overrideOf(partnerId, productId), from = ov ? ov.price : null;
    if (ov) ov.price = +to; else overrides.push({ partner: partnerId, product: productId, price: +to, memo: memo || '' });
    priceLog.unshift({ at: iso(CLOCK.now) + ' ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()),
      by: by || '관리자', product: productId, kind: '거래처 단가(' + nameOfPartner(partnerId) + ')',
      from: from, to: +to, memo: memo || '' });
    log(by || '관리자', '거래처 단가 변경', nameOfPartner(partnerId) + ' / ' + productId);
    return { from: from, to: +to };
  }
  function removeOverride(partnerId, productId, by) {
    var ov = overrideOf(partnerId, productId); if (!ov) return;
    overrides = overrides.filter(function (o) { return !(o.partner === partnerId && o.product === productId); });
    priceLog.unshift({ at: iso(CLOCK.now), by: by || '관리자', product: productId,
      kind: '거래처 단가(' + nameOfPartner(partnerId) + ')', from: ov.price, to: null, memo: '개별 단가 해제 — 등급 할인으로 복귀' });
    API.overrides = overrides;
    log(by || '관리자', '거래처 단가 해제',
      nameOfPartner(partnerId) + ' / ' + (products.filter(function (x) { return x.id === productId; })[0] || {}).code);
  }
  function changeGradeRate(gradeId, to, by) {
    var g = GRADES.filter(function (x) { return x.id === gradeId; })[0], from = g.rate;
    g.rate = +to;
    priceLog.unshift({ at: iso(CLOCK.now), by: by || '관리자', product: null,
      kind: '등급 할인율(' + g.name + ')', from: from, to: +to, memo: '' });
    log(by || '관리자', '등급 할인율 변경', g.name + ' ' + from + '% → ' + to + '%');
  }

  /* ======================================================================
     통계 — 주문 행의 스냅샷 금액만 집계한다
     ====================================================================== */
  function statsByPeriod() {
    var m = {};
    orders.forEach(function (o) {
      if (o.status === '취소' || o.status === '반품 완료') return;
      var k = o.at.slice(0, 7);
      m[k] = m[k] || { key: k, cnt: 0, supply: 0, vat: 0, total: 0 };
      m[k].cnt++; m[k].supply += o.sum.supply; m[k].vat += o.sum.vat; m[k].total += o.sum.total;
    });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }
  function statsByPartner() {
    var m = {};
    orders.forEach(function (o) {
      if (o.status === '취소' || o.status === '반품 완료') return;
      m[o.partner] = m[o.partner] || { partner: o.partner, name: nameOfPartner(o.partner), cnt: 0, total: 0, qty: 0 };
      m[o.partner].cnt++; m[o.partner].total += o.sum.total;
      m[o.partner].qty += o.lines.reduce(function (a, l) { return a + l.qty; }, 0);
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.total - a.total; });
  }
  function statsByProduct() {
    var m = {};
    orders.forEach(function (o) {
      if (o.status === '취소' || o.status === '반품 완료') return;
      o.lines.forEach(function (l) {
        m[l.product] = m[l.product] || { product: l.product, code: l.code, name: l.name, qty: 0, total: 0 };
        m[l.product].qty += l.qty; m[l.product].total += l.total;
      });
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.total - a.total; });
  }

  /* ======================================================================
     시드 — 과거 견적·주문을 만들어 둔다
     ====================================================================== */
  function seed() {
    var base = CLOCK.now;
    // 2026-09-11 이력 이전 구간은 그때의 단가(20,000원)로 스냅샷이 찍혀야 한다
    var ovP1 = overrideOf('b1', 'p1');
    ovP1.price = 20000;

    // 견적 5건
    CLOCK.now = D('2026-09-08');
    var q1 = createQuote('b1', [makeLine('p1', 60, 'b1'), makeLine('p5', 20, 'b1'), makeLine('p8', 12, 'b1')], '10월 초 납품 예정 물량입니다.', 45);
    sendQuote(q1.id, '박스 1호는 연간 계약 단가를 적용했습니다.');
    CLOCK.now = D('2026-09-15');
    var q2 = createQuote('b2', [makeLine('p14', 40, 'b2'), makeLine('p18', 24, 'b2')], '분기 소요량 견적 요청드립니다.', 14);
    sendQuote(q2.id, '');
    CLOCK.now = D('2026-09-22');
    var q3 = createQuote('b3', [makeLine('p16', 16, 'b3'), makeLine('p15', 12, 'b3'), makeLine('p19', 12, 'b3')], '급식동 신규 품목 견적 부탁드립니다.', 30);
    CLOCK.now = D('2026-09-24');
    createQuote('b1', [makeLine('p23', 8, 'b1')], '종량제 봉투 단가 확인 요청', 30);
    CLOCK.now = D('2026-09-26');
    var q5 = createQuote('b2', [makeLine('p3', 18, 'b2'), makeLine('p4', 8, 'b2')], '완충재 물량 견적', 30);
    sendQuote(q5.id, '에어캡은 10월 1일까지 현 단가 유지됩니다.');

    // 주문 — 다양한 상태
    CLOCK.now = D('2026-08-21');
    var o1 = createOrder('b1', [makeLine('p1', 40, 'b1'), makeLine('p5', 15, 'b1')],
      { pay: 'card', ship: addrSnapshot('a1'), shipMemo: '오전 하역 부탁드립니다' });
    ['준비중', '출고'].forEach(function () { advance(o1.id, '한도윤'); });
    setInvoice(o1.id, 'CJ대한통운', '648201553120', '한도윤');
    advance(o1.id, '한도윤'); advance(o1.id, '한도윤');
    ovP1.price = 20400;                 // 2026-09-11 연간 계약 갱신 (priceLog 기재와 일치)

    CLOCK.now = D('2026-09-03');
    var o2 = createOrder('b2', [makeLine('p14', 24, 'b2'), makeLine('p17', 20, 'b2'), makeLine('p19', 12, 'b2')],
      { pay: 'bank', ship: addrSnapshot('a3') });
    confirmPayment(o2.id, '한도윤');
    advance(o2.id, '한도윤'); advance(o2.id, '한도윤');
    setInvoice(o2.id, '롯데택배', '310558820114', '한도윤');
    advance(o2.id, '한도윤');

    CLOCK.now = D('2026-09-12');
    var o3 = createOrder('b1', [makeLine('p8', 10, 'b1'), makeLine('p9', 8, 'b1'), makeLine('p12', 8, 'b1')],
      { pay: 'card', ship: addrSnapshot('a2'), shipMemo: '지점 직납' });
    advance(o3.id, '한도윤'); advance(o3.id, '한도윤');
    setInvoice(o3.id, '한진택배', '552104778300', '한도윤');
    advance(o3.id, '한도윤');

    CLOCK.now = D('2026-09-18');
    var o4 = createOrder('b3', [makeLine('p16', 8, 'b3'), makeLine('p15', 12, 'b3')],
      { pay: 'bank', ship: addrSnapshot('a4') });
    confirmPayment(o4.id, '서지원');
    advance(o4.id, '한도윤');

    CLOCK.now = D('2026-09-21');
    var o5 = createOrder('b2', [makeLine('p5', 20, 'b2'), makeLine('p6', 15, 'b2')],
      { pay: 'card', ship: addrSnapshot('a3') });
    createClaim(o5.id, '반품', '납품 규격이 주문과 다릅니다 (48mm 요청 / 50mm 수령)', '');
    decideClaim(o5.id, o5.claims[0].id, true, '회수 후 검수 예정', '한도윤');

    CLOCK.now = D('2026-09-25');
    var o6 = createOrder('b1', [makeLine('p20', 6, 'b1'), makeLine('p21', 6, 'b1'), makeLine('p24', 12, 'b1')],
      { pay: 'bank', ship: addrSnapshot('a1') });

    CLOCK.now = D('2026-09-27');
    createOrder('b3', [makeLine('p13', 15, 'b3'), makeLine('p17', 20, 'b3')],
      { pay: 'bank', ship: addrSnapshot('a4'), shipMemo: '지하 1층 하역' });

    // 견적 → 주문 전환 1건 (금액 재산정 없음)
    CLOCK.now = D('2026-09-28');
    convertQuote(q2.id, { pay: 'card', ship: addrSnapshot('a3') });

    CLOCK.now = base;

    // 초기 장바구니 (대성유통) — 담은 시점 단가 대조 데모용
    cartAdd('b1', 'p1', 20); cartAdd('b1', 'p12', 8);

    notify('문의 답변 등록', '대성유통', '「니트릴 장갑 M 사이즈 재입고 일정」 문의 답변 등록', 'q1');
    notify('가입 반려', '(주)테스트무역', '(주)테스트무역 가입 반려', '777-12-00001');

    // 데모 데이터가 화면에 적힌 규칙(MOQ·주문 단위·음수 재고)을 어기지 않는지 확인한다
    var bad = [];
    orders.concat(quotes).forEach(function (d) {
      d.lines.forEach(function (l) {
        var v = validateMoq(l.product, l.qty);
        if (!v.ok) bad.push((d.no || '?') + ' / ' + l.code + ' — ' + v.reason);
      });
    });
    products.forEach(function (p) { if (p.stock < 0) bad.push(p.code + ' 재고 음수 ' + p.stock); });
    if (bad.length && window.console) console.warn('[seed] 규칙 위반', bad);
    API_SEED_ISSUES = bad;
  }
  var API_SEED_ISSUES = [];

  /* ---------------------------------------------------------------- API */
  var API = {
    CLOCK: CLOCK, CATS: CATS, GRADES: GRADES, PERM_LABEL: PERM_LABEL,
    ORDER_ST: ORDER_ST, ST_NEXT: ST_NEXT, QUOTE_ST: QUOTE_ST, MOQ_POINTS: MOQ_POINTS,
    NOTI_KINDS: NOTI_KINDS, EXCEL_KINDS: EXCEL_KINDS, ROLE_PERMS: ROLE_PERMS, ROLE_PERM_LABEL: ROLE_PERM_LABEL,
    products: products, partners: partners, addresses: addresses, admins: admins,
    notices: notices, inquiries: inquiries, banners: banners,
    get overrides() { return overrides; }, set overrides(v) { overrides = v; },
    blocks: blocks, priceLog: priceLog, notifications: notifications, audit: audit,
    refundLog: refundLog, listModeOf: listModeOf, setListMode: setListMode,
    blockedAttempts: blockedAttempts,
    get quotes() { return quotes; }, get orders() { return orders; },
    // 조회
    product: function (id) { return products.filter(function (x) { return x.id === id; })[0]; },
    productByCode: function (c) { return products.filter(function (x) { return x.code === c; })[0]; },
    partner: function (id) { return partners.filter(function (x) { return x.id === id; })[0]; },
    order: function (id) { return orders.filter(function (x) { return x.id === id; })[0]; },
    orderByNo: function (n) { return orders.filter(function (x) { return x.no === n; })[0]; },
    quote: function (id) { return quotes.filter(function (x) { return x.id === id; })[0]; },
    quoteByNo: function (n) { return quotes.filter(function (x) { return x.no === n; })[0]; },
    addrOf: function (pid) { return addresses.filter(function (a) { return a.partner === pid; }); },
    gradeOf: gradeOf, overrideOf: overrideOf, isBlocked: isBlocked, nameOfPartner: nameOfPartner,
    subName: function (id) { var r = '-'; CATS.forEach(function (c) { c.subs.forEach(function (s) { if (s.id === id) r = s.name; }); }); return r; },
    catOfSub: function (id) { var r = null; CATS.forEach(function (c) { c.subs.forEach(function (s) { if (s.id === id) r = c; }); }); return r; },
    // 가격·검증
    priceFor: priceFor, priceForSession: priceForSession, attemptForeignPrice: attemptForeignPrice,
    validateMoq: validateMoq, validateStock: validateStock, makeLine: makeLine, sumLines: sumLines,
    // 장바구니
    cart: cart, cartAdd: cartAdd, cartSetQty: cartSetQty, cartRemove: cartRemove,
    cartClear: cartClear, cartDrift: cartDrift, cartAckDrift: cartAckDrift,
    // 견적·주문
    createQuote: createQuote, sendQuote: sendQuote, rejectQuote: rejectQuote,
    createOrder: createOrder, convertQuote: convertQuote, advance: advance, setStatus: setStatus,
    confirmPayment: confirmPayment, setInvoice: setInvoice, cancelOrder: cancelOrder,
    createClaim: createClaim, decideClaim: decideClaim, completeClaim: completeClaim,
    runPaymentDeadlineJob: runPaymentDeadlineJob,
    // 관리
    approvePartner: approvePartner, rejectPartner: rejectPartner,
    changeBasePrice: changeBasePrice, changeOverride: changeOverride, removeOverride: removeOverride,
    changeGradeRate: changeGradeRate, addrSnapshot: addrSnapshot,
    excelValidate: excelValidate, excelApply: excelApply,
    validateLines: validateLines, setBlock: setBlock, adjustQuoteLine: adjustQuoteLine,
    statsByPeriod: statsByPeriod, statsByPartner: statsByPartner, statsByProduct: statsByProduct,
    notify: notify, log: log, failNotify: failNotify, retryNotifications: retryNotifications,
    pgApprove: pgApprove, pgUsed: pgUsed, reviewQuote: reviewQuote, NEW_DAYS: NEW_DAYS, isNewProduct: isNewProduct,
    // 유틸
    won: won, pct: pct, iso: iso, addD: addD, D: D, pad: pad,
    today: function () { return iso(CLOCK.now); },
    seedIssues: function () { return API_SEED_ISSUES; },
    advanceClock: function (days) { CLOCK.now = addD(CLOCK.now, days); CLOCK.tick += days; return iso(CLOCK.now); },
  };

  seed();
  global.DB = API;
})(window);
