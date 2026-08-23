/* ─────────────────────────────────────────────
   단장 ver2 — 상품 페이지 휴리스틱 추출기
   1) JSON-LD(schema.org/Product) / OpenGraph → 상품명·브랜드·가격·품절
   2) HTML 표 스캔 → 사이즈 차트 (열/행 방향 모두 지원)
   3) 둘레/단면 자동 판별 → 내부 표준(단면 cm)으로 정규화
   4) 사이즈 옵션 영역에서 품절 사이즈 감지
────────────────────────────────────────────── */
"use strict";

const cheerio = require("cheerio");

/* 측정 항목 키워드 → 내부 필드 */
const MEASURE_KEYS = [
  { re: /어깨/, field: "shoulder", flat: false },
  { re: /가슴|품(?!절)|bust|chest/i, field: "chestFlat", flat: true },
  { re: /허리|waist/i, field: "waistFlat", flat: true },
  { re: /엉덩이|힙|hip/i, field: "hipFlat", flat: true },
  { re: /허벅지|thigh/i, field: "thighFlat", flat: true },
  { re: /소매|팔.?길이|sleeve/i, field: "sleeve", flat: false },
  { re: /총장|총.?기장|기장|length/i, field: "length", flat: false },
];

/* 단면일 때 통상 범위(cm) — 이 상한을 넘으면 둘레로 보고 /2 */
const FLAT_MAX = { chestFlat: 75, waistFlat: 60, hipFlat: 75, thighFlat: 45 };

const SIZE_LABEL_RE = /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|FREE|F|[0-9]{1,3})$/i;

function parseNum(text) {
  const m = String(text).replace(/,/g, "").match(/[0-9]+(?:\.[0-9]+)?/);
  return m ? parseFloat(m[0]) : null;
}

/* ── 1. 상품 메타 ── */
function extractMeta($, url) {
  const meta = { name: null, brand: null, price: null, soldOutAll: false };

  // JSON-LD Product
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      let data = JSON.parse($(el).contents().text());
      const items = Array.isArray(data) ? data : data["@graph"] || [data];
      for (const item of items) {
        if (!/Product/i.test(item?.["@type"] || "")) continue;
        meta.name = meta.name || item.name;
        meta.brand = meta.brand || (typeof item.brand === "object" ? item.brand?.name : item.brand);
        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        if (offers) {
          meta.price = meta.price || parseNum(offers.price);
          if (/OutOfStock|SoldOut/i.test(offers.availability || "")) meta.soldOutAll = true;
        }
      }
    } catch { /* 잘못된 JSON-LD는 무시 */ }
  });

  // OpenGraph / title 폴백
  meta.name = meta.name || $('meta[property="og:title"]').attr("content") || $("title").first().text().trim() || null;
  meta.price =
    meta.price ||
    parseNum($('meta[property="product:price:amount"]').attr("content")) ||
    parseNum($('meta[property="og:price:amount"]').attr("content"));
  meta.brand = meta.brand || $('meta[property="product:brand"]').attr("content") || new URL(url).hostname.replace(/^www\./, "");

  if (meta.name) meta.name = meta.name.replace(/\s*[|\-–]\s*[^|\-–]{0,30}$/, "").trim().slice(0, 80);
  return meta;
}

/* ── 2. 사이즈 차트 ── */
function matchMeasure(text) {
  const t = String(text).trim();
  if (!t) return null;
  for (const mk of MEASURE_KEYS) if (mk.re.test(t)) return mk;
  return null;
}

function isSizeLabel(text) {
  return SIZE_LABEL_RE.test(String(text).trim().replace(/\s+/g, ""));
}

/* 표 하나를 [ [cell,...], ... ] 격자로 */
function tableGrid($, table) {
  const grid = [];
  $(table).find("tr").each((_, tr) => {
    const row = [];
    $(tr).find("th, td").each((_, cell) => row.push($(cell).text().replace(/\s+/g, " ").trim()));
    if (row.length) grid.push(row);
  });
  return grid;
}

/* 격자 해석: 헤더행=측정항목·첫열=사이즈(일반형) 또는 그 전치형 */
function gridToChart(grid) {
  if (grid.length < 2 || grid[0].length < 2) return null;

  const tryParse = (g) => {
    const header = g[0];
    const measures = header.map(matchMeasure); // [null, mk, mk, ...]
    const measureCount = measures.filter(Boolean).length;
    if (measureCount < 1) return null;

    const sizes = {};
    for (let r = 1; r < g.length; r++) {
      const label = String(g[r][0]).trim().replace(/\s+/g, "").toUpperCase();
      if (!isSizeLabel(label)) continue;
      const chart = {};
      for (let c = 1; c < g[r].length; c++) {
        const mk = measures[c];
        if (!mk) continue;
        const v = parseNum(g[r][c]);
        if (v == null || v <= 0 || v > 250) continue;
        chart[mk.field] = v;
      }
      if (Object.keys(chart).length) sizes[label] = chart;
    }
    return Object.keys(sizes).length ? { sizes, measureCount } : null;
  };

  const direct = tryParse(grid);
  if (direct) return direct;
  // 전치형: 첫 행이 사이즈(S M L…), 첫 열이 측정항목
  const width = Math.max(...grid.map((r) => r.length));
  const transposed = Array.from({ length: width }, (_, c) => grid.map((r) => r[c] ?? ""));
  return tryParse(transposed);
}

function extractSizeChart($) {
  let best = null;
  $("table").each((_, table) => {
    const parsed = gridToChart(tableGrid($, table));
    if (!parsed) return;
    const score = parsed.measureCount * 10 + Object.keys(parsed.sizes).length;
    if (!best || score > best.score) best = { ...parsed, score };
  });
  return best ? best.sizes : null;
}

/* 둘레→단면 정규화 + 명칭 표기(가슴둘레 표가 흔함) */
function normalizeChart(sizes) {
  const out = {};
  for (const [label, chart] of Object.entries(sizes)) {
    const c = { ...chart };
    for (const [field, max] of Object.entries(FLAT_MAX)) {
      if (c[field] != null && c[field] > max) c[field] = +(c[field] / 2).toFixed(1);
    }
    out[label] = c;
  }
  return out;
}

/* ── 3. 품절 사이즈 ── */
function extractSoldOut($, sizeLabels) {
  const soldOut = new Set();
  const SOLD_RE = /품\s*절|sold\s*out|일시품절|재입고/i;

  $("option, button, li, label, span, a").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 40 || !SOLD_RE.test(t)) return;
    for (const label of sizeLabels) {
      const re = new RegExp(`(^|[^A-Z0-9])${label}([^A-Z0-9]|$)`, "i");
      if (re.test(t)) soldOut.add(label);
    }
    const disabled = $(el).is("[disabled], .disabled, .soldout, .sold-out");
    if (disabled) {
      const own = t.replace(SOLD_RE, "").trim().replace(/\s+/g, "").toUpperCase();
      if (sizeLabels.includes(own)) soldOut.add(own);
    }
  });
  return [...soldOut];
}

/* ── 4. 카테고리/타입/신축성 추정 ── */
function inferCategoryType(sizes, name) {
  const fields = new Set(Object.values(sizes).flatMap((c) => Object.keys(c)));
  const isBottom = fields.has("waistFlat") || fields.has("thighFlat") || fields.has("hipFlat");
  const isTop = fields.has("shoulder") || fields.has("chestFlat");
  const category = isTop && !isBottom ? "top" : isBottom && !isTop ? "bottom"
    : /팬츠|바지|데님|진\b|슬랙스|스커트|치마|jean|pants|skirt/i.test(name || "") ? "bottom" : "top";

  const n = name || "";
  let type = category === "top" ? "tshirt" : "pants";
  if (/후드|hood/i.test(n)) type = "hoodie";
  else if (/니트|스웨터|knit|sweater/i.test(n)) type = "knit";
  else if (/셔츠|블라우스|shirt|blouse/i.test(n)) type = "shirt";
  else if (/스커트|치마|skirt/i.test(n)) type = "skirt";
  return { category, type };
}

function inferStretch($, name) {
  const text = ($("body").text().slice(0, 20000) + " " + (name || "")).toLowerCase();
  if (/논스판|논\s?스트레치|non[- ]?stretch/.test(text)) return 0.1;
  if (/스판덱스|폴리우레탄|엘라스테인|spandex|elastane|밴딩/.test(text)) return 0.7;
  if (/니트|스웨터|저지|jersey|knit/.test(text)) return 0.6;
  if (/스판|신축/.test(text)) return 0.5;
  if (/데님|denim|옥스포드|oxford|트윌|twill/.test(text)) return 0.15;
  return 0.3;
}

/* 단청 팔레트에서 URL 해시로 결정적 색 배정 */
const LIVE_COLORS = [
  ["#5B7268", "#D9A441"], ["#8A9BB4", "#B23A3A"], ["#B98D6F", "#1D6E5E"],
  ["#3F5573", "#D9A441"], ["#9A8FA5", "#1D6E5E"], ["#C2B49A", "#B23A3A"],
];
function pickColor(url) {
  let h = 0;
  for (const ch of url) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LIVE_COLORS[h % LIVE_COLORS.length];
}

/* ── 메인 ── */
function extractProduct(html, url) {
  const $ = cheerio.load(html);
  const meta = extractMeta($, url);
  const rawSizes = extractSizeChart($);
  if (!rawSizes) return { ok: false, reason: "no_size_chart", meta };

  const sizes = normalizeChart(rawSizes);
  const labels = Object.keys(sizes);
  const { category, type } = inferCategoryType(sizes, meta.name);
  const [color, accent] = pickColor(url);

  return {
    ok: true,
    product: {
      id: `live-${Date.now()}`,
      brand: meta.brand || "쇼핑몰",
      name: meta.name || "이름 미확인 상품",
      category, type,
      price: meta.price || 0,
      color, accent,
      stretch: inferStretch($, meta.name),
      note: "실제 상품 페이지에서 추출한 실측입니다",
      soldOut: meta.soldOutAll ? labels : extractSoldOut($, labels),
      sizes,
      source: "live",
    },
  };
}

/* LLM 폴백용: 페이지에서 텍스트만 추려 압축 */
function pageTextForLLM(html, maxLen = 60000) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, link").remove();
  // 표는 구조 보존이 중요 — 셀을 | 로 이어붙임
  $("table").each((_, t) => {
    const rows = [];
    $(t).find("tr").each((_, tr) => {
      const cells = [];
      $(tr).find("th, td").each((_, c) => cells.push($(c).text().replace(/\s+/g, " ").trim()));
      rows.push(cells.join(" | "));
    });
    $(t).replaceWith(`\n[표]\n${rows.join("\n")}\n[/표]\n`);
  });
  return $("body").text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLen);
}

module.exports = { extractProduct, pageTextForLLM, normalizeChart, pickColor };
