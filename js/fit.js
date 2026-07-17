/* ─────────────────────────────────────────────
   단장 ver1 — 사이즈 판정 엔진
   제품 실측(단면×2=둘레)과 사용자 실측 둘레를 비교해
   부위별 여유량(ease)을 구하고, 핏 취향별 적정 범위와
   대조해 사이즈별 점수/판정을 낸다.
────────────────────────────────────────────── */

/* 핏 취향별 적정 여유량(cm) — [min, max] */
const EASE_RANGE = {
  top: {
    chest:    { tight: [2, 8],  regular: [8, 16],  boxy: [16, 30] },
    shoulder: { tight: [-1, 2], regular: [1, 5],   boxy: [5, 14] },
  },
  bottom: {
    waist: { tight: [0, 3],  regular: [2, 6],  boxy: [4, 10] },
    hip:   { tight: [2, 6],  regular: [5, 12], boxy: [10, 20] },
  },
};

const PREF_LABEL = { tight: "타이트", regular: "정사이즈", boxy: "박시" };

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/* 작아서 못 입는 것이 커서 헐렁한 것보다 치명적 — 큰 방향은 감점 완화 */
function devPenalty(dev, weight) {
  return dev.amt * weight * (dev.dir === "large" ? 0.6 : 1);
}

/* 여유량이 [min,max] 범위에서 벗어난 정도 → 0(완벽)~1(심각) */
function deviation(ease, [min, max], stretch) {
  // 신축성이 좋으면 '작은 쪽' 허용치가 넓어진다
  const slack = stretch * 4;
  if (ease < min - slack) return { dir: "small", amt: (min - slack) - ease };
  if (ease > max) return { dir: "large", amt: ease - max };
  return { dir: "fit", amt: 0 };
}

/* 사이즈 하나 판정 → { score, status, details[] } */
function judgeSize(product, sizeName, chart, user) {
  const pref = user.fitPref;
  const details = [];
  let penalty = 0;

  if (product.category === "top") {
    const chestC = chart.chestFlat * 2;
    const eChest = chestC - user.chest;
    const dChest = deviation(eChest, EASE_RANGE.top.chest[pref], product.stretch);
    penalty += devPenalty(dChest, 6);
    details.push({
      part: "가슴", ease: eChest, dir: dChest.dir,
      text: `가슴 여유 ${fmtEase(eChest)}`,
    });

    const eShoulder = chart.shoulder - user.shoulder;
    const dSh = deviation(eShoulder, EASE_RANGE.top.shoulder[pref], product.stretch * 0.5);
    penalty += devPenalty(dSh, 5);
    details.push({
      part: "어깨", ease: eShoulder, dir: dSh.dir,
      text: `어깨 ${fmtEase(eShoulder)}`,
    });

    if (chart.sleeve >= 40 && user.arm) { // 긴팔만 팔길이 비교
      const eArm = chart.sleeve - user.arm;
      if (eArm < -3) { penalty += (-3 - eArm) * 2; details.push({ part: "소매", ease: eArm, dir: "small", text: `소매가 ${Math.abs(eArm).toFixed(1)}cm 짧음` }); }
      else if (eArm > 8) { penalty += (eArm - 8) * 1; details.push({ part: "소매", ease: eArm, dir: "large", text: `소매가 ${(eArm).toFixed(1)}cm 김` }); }
    }
  } else {
    const waistC = chart.waistFlat * 2;
    const eWaist = waistC - user.waist;
    const dW = deviation(eWaist, EASE_RANGE.bottom.waist[pref], product.stretch);
    penalty += devPenalty(dW, 7);
    details.push({ part: "허리", ease: eWaist, dir: dW.dir, text: `허리 여유 ${fmtEase(eWaist)}` });

    if (chart.hipFlat < 900) { // 999 = 해당 없음(스커트 등)
      const hipC = chart.hipFlat * 2;
      const eHip = hipC - user.hip;
      const dH = deviation(eHip, EASE_RANGE.bottom.hip[pref], product.stretch);
      penalty += devPenalty(dH, 5);
      details.push({ part: "엉덩이", ease: eHip, dir: dH.dir, text: `엉덩이 여유 ${fmtEase(eHip)}` });
    }

    if (user.inseam && chart.length) {
      const outseamApprox = user.inseam + 26; // 안기장→바지 총장 근사(허리~밑위)
      const eLen = chart.length - outseamApprox;
      if (eLen > 6) details.push({ part: "기장", ease: eLen, dir: "large", text: `기장이 약 ${eLen.toFixed(0)}cm 김 (수선 고려)` });
      else if (eLen < -4) details.push({ part: "기장", ease: eLen, dir: "small", text: `기장이 약 ${Math.abs(eLen).toFixed(0)}cm 짧음` });
    }
  }

  const score = Math.round(clamp(100 - penalty, 0, 100));
  const dirs = details.map(d => d.dir);
  let status;
  if (score >= 82) status = "perfect";
  else if (score >= 60) status = dirs.includes("small") ? "snug" : "loose";
  else status = dirs.includes("small") ? "too_small" : "too_big";

  return { size: sizeName, score, status, details, soldOut: product.soldOut.includes(String(sizeName)) };
}

function fmtEase(v) {
  if (v >= 0) return `+${v.toFixed(1)}cm`;
  return `${v.toFixed(1)}cm (부족)`;
}

/* "같은 M인데 작게/크게 나옴" — 표준 실측과 비교 */
function labelDeviation(product) {
  const std = STANDARD_CHART[product.category];
  const diffs = [];
  for (const [size, chart] of Object.entries(product.sizes)) {
    const ref = std[size];
    if (!ref) continue;
    const actual = product.category === "top" ? chart.chestFlat * 2 : chart.waistFlat * 2;
    diffs.push(actual - ref);
  }
  if (!diffs.length) return null;
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  if (avg <= -3) return { dir: "small", avg, text: `이 제품은 표기 사이즈보다 평균 ${Math.abs(avg).toFixed(1)}cm 작게 나왔어요.` };
  if (avg >= 4) return { dir: "large", avg, text: `이 제품은 표기 사이즈보다 평균 ${avg.toFixed(1)}cm 크게 나왔어요.` };
  return { dir: "normal", avg, text: "표기 사이즈대로 정사이즈로 나온 제품이에요." };
}

/* 제품 전체 분석 → 종합 판정 */
function analyzeProduct(product, user) {
  const results = Object.entries(product.sizes)
    .map(([sizeName, chart]) => judgeSize(product, sizeName, chart, user));

  const wearable = results.filter(r => r.score >= 60);
  const inStock = wearable.filter(r => !r.soldOut);
  const best = [...results].sort((a, b) => b.score - a.score)[0];
  const bestInStock = [...inStock].sort((a, b) => b.score - a.score)[0] || null;

  let verdict; // ok | size_mismatch | soldout | no_fit
  if (!wearable.length) verdict = "no_fit";
  else if (!inStock.length) verdict = "soldout";
  else if (bestInStock.score >= 75) verdict = "ok";
  else verdict = "size_mismatch";

  return {
    product, results, best, bestInStock, verdict,
    sizing: labelDeviation(product),
    prefLabel: PREF_LABEL[user.fitPref],
  };
}

/* 대체상품 추천: 같은 카테고리에서 재고 있는 사이즈 중 점수 높은 순 */
function findAlternatives(product, user, limit = 3) {
  return CATALOG
    .filter(p => p.id !== product.id && p.category === product.category)
    .map(p => {
      const a = analyzeProduct(p, user);
      return a.bestInStock ? { product: p, best: a.bestInStock } : null;
    })
    .filter(x => x && x.best.score >= 70)
    .sort((a, b) => b.best.score - a.best.score)
    .slice(0, limit);
}

/* 키·몸무게·성별로 상세 치수 추정 (한국인 인체치수조사 근사 회귀) */
function estimateBody(gender, height, weight) {
  const bmi = weight / ((height / 100) ** 2);
  const f = gender === "female";
  return {
    shoulder: +( (f ? 0.235 : 0.255) * height + (bmi - 21) * 0.35 ).toFixed(1),
    chest:    +( (f ? 0.52 : 0.54) * height + (bmi - 21) * 2.1 ).toFixed(1),
    waist:    +( (f ? 0.40 : 0.44) * height + (bmi - 21) * 2.4 ).toFixed(1),
    hip:      +( (f ? 0.56 : 0.55) * height + (bmi - 21) * 1.7 ).toFixed(1),
    arm:      +( 0.345 * height ).toFixed(1),
    inseam:   +( 0.45 * height ).toFixed(1),
  };
}

/* URL → 카탈로그 매칭. 키워드 매칭 실패 시 URL 해시로 결정적 선택 */
function matchProductByUrl(url) {
  const u = url.toLowerCase();
  let bestMatch = null, bestHits = 0;
  for (const p of CATALOG) {
    // 긴 키워드일수록 구체적이므로 글자수 합으로 점수화 ("slimtee" > "tee")
    const hits = p.keywords.filter(k => u.includes(k)).reduce((sum, k) => sum + k.length, 0);
    if (hits > bestHits) { bestHits = hits; bestMatch = p; }
  }
  if (bestMatch) return { product: bestMatch, matched: true };
  let h = 0;
  for (const ch of u) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { product: CATALOG[h % CATALOG.length], matched: false };
}
