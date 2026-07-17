/* ─────────────────────────────────────────────
   단장 ver1 — 데모 상품 카탈로그
   실제 쇼핑몰 크롤링은 서버 프록시가 필요해 ver2 과제.
   ver1은 실제 쇼핑몰과 동일한 구조의 사이즈 차트를 가진
   데모 상품에 링크를 매칭해 판정 엔진을 검증한다.

   치수 단위: cm
   상의(top)   : shoulder(어깨너비) · chestFlat(가슴단면) · length(총장) · sleeve(소매길이)
   하의(bottom): waistFlat(허리단면) · hipFlat(엉덩이단면) · length(총장) · thighFlat(허벅지단면)
   stretch     : 원단 신축성 0(없음)~1(높음) — 판정 여유에 반영
────────────────────────────────────────────── */
const CATALOG = [
  {
    id: "tee-basic",
    keywords: ["tshirt", "tee", "t-shirt", "티셔츠", "basic"],
    brand: "무명공방", name: "수피마 코튼 베이직 티셔츠",
    category: "top", type: "tshirt", price: 29000,
    color: "#E8E4DA", accent: "#1D6E5E", stretch: 0.35,
    note: "정사이즈로 나온 데일리 티셔츠",
    soldOut: [],
    sizes: {
      S:  { shoulder: 42, chestFlat: 49, length: 66, sleeve: 20 },
      M:  { shoulder: 44, chestFlat: 52, length: 69, sleeve: 21 },
      L:  { shoulder: 46, chestFlat: 55, length: 72, sleeve: 22 },
      XL: { shoulder: 48, chestFlat: 58, length: 74, sleeve: 23 },
    },
  },
  {
    id: "tee-slim",
    keywords: ["slimtee", "muscle", "슬림티"],
    brand: "세로결", name: "머슬핏 스트레치 티셔츠",
    category: "top", type: "tshirt", price: 24500,
    color: "#3D3A35", accent: "#D9A441", stretch: 0.8,
    note: "작게 나온 제품 — 한 치수 업 권장 리뷰 다수",
    soldOut: ["L"],
    sizes: {
      S:  { shoulder: 39, chestFlat: 44, length: 63, sleeve: 19 },
      M:  { shoulder: 41, chestFlat: 46, length: 65, sleeve: 20 },
      L:  { shoulder: 43, chestFlat: 48, length: 67, sleeve: 21 },
      XL: { shoulder: 45, chestFlat: 50, length: 69, sleeve: 22 },
    },
  },
  {
    id: "hoodie-over",
    keywords: ["hoodie", "후드", "hood"],
    brand: "한강스튜디오", name: "헤비웨이트 오버핏 후드",
    category: "top", type: "hoodie", price: 69000,
    color: "#8A9BB4", accent: "#2B4C7E", stretch: 0.3,
    note: "크게 나온 오버핏 — 평소 사이즈보다 한 치수 다운 추천",
    soldOut: ["M"],
    sizes: {
      S:  { shoulder: 52, chestFlat: 60, length: 68, sleeve: 58 },
      M:  { shoulder: 55, chestFlat: 63, length: 71, sleeve: 60 },
      L:  { shoulder: 58, chestFlat: 66, length: 74, sleeve: 62 },
    },
  },
  {
    id: "knit-crew",
    keywords: ["knit", "니트", "sweater", "스웨터"],
    brand: "온기", name: "램스울 크루넥 니트",
    category: "top", type: "knit", price: 55000,
    color: "#B23A3A", accent: "#D9A441", stretch: 0.7,
    note: "니트 특성상 신축성 좋음",
    soldOut: [],
    sizes: {
      S:  { shoulder: 41, chestFlat: 48, length: 62, sleeve: 57 },
      M:  { shoulder: 43, chestFlat: 51, length: 64, sleeve: 59 },
      L:  { shoulder: 45, chestFlat: 54, length: 66, sleeve: 61 },
    },
  },
  {
    id: "shirt-ocsford",
    keywords: ["shirt", "셔츠", "oxford", "옥스포드"],
    brand: "서촌양복점", name: "옥스포드 버튼다운 셔츠",
    category: "top", type: "shirt", price: 49000,
    color: "#DCE6F2", accent: "#2B4C7E", stretch: 0.1,
    note: "클래식 레귤러핏, 신축 없음",
    soldOut: ["S"],
    sizes: {
      S:  { shoulder: 43, chestFlat: 52, length: 71, sleeve: 60 },
      M:  { shoulder: 45, chestFlat: 55, length: 73, sleeve: 61.5 },
      L:  { shoulder: 47, chestFlat: 58, length: 75, sleeve: 63 },
      XL: { shoulder: 49, chestFlat: 61, length: 77, sleeve: 64.5 },
    },
  },
  {
    id: "blouse-lace",
    keywords: ["blouse", "블라우스", "lace"],
    brand: "달빛다방", name: "레이스 카라 블라우스",
    category: "top", type: "shirt", price: 42000,
    color: "#F4EDE3", accent: "#B23A3A", stretch: 0.15,
    note: "여성 전용 패턴 — 어깨가 좁게 나옴",
    soldOut: [],
    sizes: {
      S: { shoulder: 36, chestFlat: 46, length: 58, sleeve: 56 },
      M: { shoulder: 37.5, chestFlat: 48.5, length: 60, sleeve: 57 },
      L: { shoulder: 39, chestFlat: 51, length: 62, sleeve: 58 },
    },
  },
  {
    id: "denim-straight",
    keywords: ["denim", "jean", "청바지", "데님"],
    brand: "청개천", name: "논페이드 스트레이트 데님",
    category: "bottom", type: "pants", price: 62000,
    color: "#3F5573", accent: "#D9A441", stretch: 0.2,
    note: "허리 정사이즈, 기장 길게 나옴",
    soldOut: ["26"],
    sizes: {
      "26": { waistFlat: 33, hipFlat: 46, length: 100, thighFlat: 28 },
      "28": { waistFlat: 35.5, hipFlat: 48.5, length: 102, thighFlat: 29.5 },
      "30": { waistFlat: 38, hipFlat: 51, length: 104, thighFlat: 31 },
      "32": { waistFlat: 40.5, hipFlat: 53.5, length: 106, thighFlat: 32.5 },
    },
  },
  {
    id: "slacks-wide",
    keywords: ["slacks", "슬랙스", "wide", "와이드"],
    brand: "북촌테일러", name: "세미와이드 울 슬랙스",
    category: "bottom", type: "pants", price: 58000,
    color: "#55524B", accent: "#1D6E5E", stretch: 0.35,
    note: "밴딩 없는 정장 허리 — 실측 그대로 판단",
    soldOut: [],
    sizes: {
      S: { waistFlat: 34, hipFlat: 50, length: 103, thighFlat: 32 },
      M: { waistFlat: 36.5, hipFlat: 52.5, length: 105, thighFlat: 33.5 },
      L: { waistFlat: 39, hipFlat: 55, length: 107, thighFlat: 35 },
    },
  },
  {
    id: "skirt-pleats",
    keywords: ["skirt", "스커트", "치마", "pleats"],
    brand: "달빛다방", name: "미디 플리츠 스커트",
    category: "bottom", type: "skirt", price: 39000,
    color: "#1D6E5E", accent: "#D9A441", stretch: 0.5,
    note: "뒤 밴딩으로 허리 여유 있음",
    soldOut: ["S"],
    sizes: {
      S: { waistFlat: 32, hipFlat: 999, length: 72, thighFlat: 999 },
      M: { waistFlat: 34, hipFlat: 999, length: 74, thighFlat: 999 },
      L: { waistFlat: 36.5, hipFlat: 999, length: 76, thighFlat: 999 },
    },
  },
  {
    id: "jogger-band",
    keywords: ["jogger", "조거", "트레이닝", "training", "sweatpants"],
    brand: "한강스튜디오", name: "테리 조거 팬츠",
    category: "bottom", type: "pants", price: 45000,
    color: "#A9A399", accent: "#B23A3A", stretch: 0.85,
    note: "전체 밴딩 — 신축성 매우 좋음",
    soldOut: [],
    sizes: {
      M: { waistFlat: 33, hipFlat: 54, length: 96, thighFlat: 33 },
      L: { waistFlat: 35, hipFlat: 57, length: 98, thighFlat: 35 },
    },
  },
  {
    id: "tee-boxy",
    keywords: ["boxy", "오버티", "overfit"],
    brand: "무명공방", name: "가먼트다잉 박시 티셔츠",
    category: "top", type: "tshirt", price: 35000,
    color: "#CDD8CE", accent: "#1D6E5E", stretch: 0.3,
    note: "어깨 떨어지는 박시 실루엣",
    soldOut: [],
    sizes: {
      1: { shoulder: 50, chestFlat: 58, length: 70, sleeve: 23 },
      2: { shoulder: 53, chestFlat: 61, length: 73, sleeve: 24 },
    },
  },
  {
    id: "denim-slim",
    keywords: ["slimjean", "슬림진", "skinny", "스키니"],
    brand: "청개천", name: "테이퍼드 슬림 데님",
    category: "bottom", type: "pants", price: 54000,
    color: "#2E3D52", accent: "#B23A3A", stretch: 0.6,
    note: "허벅지 슬림 — 하체 발달 체형은 한 치수 업",
    soldOut: ["30"],
    sizes: {
      "26": { waistFlat: 33, hipFlat: 44, length: 96, thighFlat: 26 },
      "28": { waistFlat: 35.5, hipFlat: 46.5, length: 98, thighFlat: 27.5 },
      "30": { waistFlat: 38, hipFlat: 49, length: 100, thighFlat: 29 },
      "32": { waistFlat: 40.5, hipFlat: 51.5, length: 102, thighFlat: 30.5 },
    },
  },
];

/* 표준 실측 기준(성인 유니섹스 근사) — "같은 M인데 작게 나옴" 판정용 */
const STANDARD_CHART = {
  // 가슴둘레(cm) — 알파벳/숫자(남성 90호대)/한국 여성(44·55·66·77) 표기
  top: {
    S: 100, M: 106, L: 112, XL: 118, 1: 112, 2: 120,
    "90": 96, "95": 101, "100": 106, "105": 111, "110": 116,
    "44": 82, "55": 86, "66": 90, "77": 94,
  },
  // 허리둘레(cm)
  bottom: {
    S: 70, M: 76, L: 82, XL: 88,
    "26": 66, "28": 71, "30": 76, "32": 81, "34": 86,
  },
};

/* 체험용 데모 링크 */
const DEMO_LINKS = [
  "https://store.mumyeong.kr/products/tshirt-supima-white",
  "https://serogyeol.shop/goods/slimtee-stretch-0021",
  "https://hangang-studio.com/item/hoodie-heavy-overfit",
  "https://dalbit-dabang.co.kr/products/blouse-lace-collar",
  "https://cheonggaecheon.kr/denim-straight-nonfade",
  "https://bukchon-tailor.com/slacks-semiwide-wool",
];
