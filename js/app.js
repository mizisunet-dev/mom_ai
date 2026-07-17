/* ─────────────────────────────────────────────
   단장 ver1 — 앱 흐름
   스플래시 → 온보딩(3단계) → 홈(마네킹+링크) → 결과
────────────────────────────────────────────── */

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const STORAGE_KEY = "danjang.profile.v1";
const RECENT_KEY = "danjang.recent.v1";

const state = {
  profile: null,      // { gender, height, weight, shoulder, chest, waist, hip, arm, inseam, fitPref }
  obStep: 1,
  lastAnalysis: null,
};

/* ── 화면 전환 ── */
function showScreen(id) {
  $$(".screen").forEach(s => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}

/* ── 스플래시 ── */
function initSplash() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    state.profile = JSON.parse(saved);
    $("#btn-continue").classList.remove("hidden");
    $("#btn-start").textContent = "새 프로필 만들기";
  }
  $("#btn-start").addEventListener("click", () => { state.obStep = 1; syncObStep(); showScreen("screen-onboarding"); });
  $("#btn-continue").addEventListener("click", () => { enterHome(); });
}

/* ── 온보딩 ── */
function syncObStep() {
  $$(".ob-step").forEach(el => el.classList.toggle("active", +el.dataset.step === state.obStep));
  $$("#screen-onboarding .dot").forEach((d, i) => d.classList.toggle("active", i < state.obStep));
  $("#btn-ob-back").classList.toggle("hidden", state.obStep === 1);
  $("#btn-ob-next").textContent = state.obStep === 3 ? "마네킹 만들기" : "다음";
}

function readForm() {
  const f = $("#form-body");
  const num = name => parseFloat(f.elements[name].value) || null;
  return {
    gender: $('.seg[data-name="gender"] .seg-btn.active').dataset.val,
    height: num("height"), weight: num("weight"),
    shoulder: num("shoulder"), chest: num("chest"), waist: num("waist"), hip: num("hip"),
    arm: num("arm"), inseam: num("inseam"),
    fitPref: $('.fit-cards .fit-card.active').dataset.val,
  };
}

function validateStep(step) {
  const fields = step === 1 ? ["height", "weight"] : step === 2 ? ["shoulder", "chest", "waist", "hip"] : [];
  let ok = true;
  for (const name of fields) {
    const input = $("#form-body").elements[name];
    const v = parseFloat(input.value);
    const bad = !v || v < +input.min || v > +input.max;
    input.classList.toggle("invalid", bad);
    if (bad) ok = false;
  }
  return ok;
}

function initOnboarding() {
  // 세그먼트 & 핏 카드 토글
  $$(".seg").forEach(seg => seg.addEventListener("click", e => {
    const btn = e.target.closest(".seg-btn"); if (!btn) return;
    seg.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b === btn));
  }));
  $(".fit-cards").addEventListener("click", e => {
    const card = e.target.closest(".fit-card"); if (!card) return;
    $$(".fit-card").forEach(c => c.classList.toggle("active", c === card));
  });

  $("#btn-estimate").addEventListener("click", () => {
    const f = $("#form-body");
    const h = parseFloat(f.elements.height.value), w = parseFloat(f.elements.weight.value);
    if (!h || !w) { alert("1단계에서 키와 몸무게를 먼저 입력해주세요."); return; }
    const gender = $('.seg[data-name="gender"] .seg-btn.active').dataset.val;
    const est = estimateBody(gender, h, w);
    for (const [k, v] of Object.entries(est)) if (f.elements[k]) f.elements[k].value = v;
    $$('.ob-step[data-step="2"] input').forEach(i => i.classList.remove("invalid"));
  });

  $("#btn-ob-back").addEventListener("click", () => { state.obStep--; syncObStep(); });
  $("#btn-ob-next").addEventListener("click", () => {
    if (!validateStep(state.obStep)) return;
    if (state.obStep < 3) { state.obStep++; syncObStep(); return; }
    state.profile = readForm();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
    enterHome();
  });

  $("#form-body").addEventListener("submit", e => e.preventDefault());
}

/* 프로필 수정 진입 시 기존 값 채우기 */
function fillFormFromProfile(p) {
  const f = $("#form-body");
  for (const k of ["height", "weight", "shoulder", "chest", "waist", "hip", "arm", "inseam"])
    if (p[k] != null) f.elements[k].value = p[k];
  $$('.seg[data-name="gender"] .seg-btn').forEach(b => b.classList.toggle("active", b.dataset.val === p.gender));
  $$(".fit-card").forEach(c => c.classList.toggle("active", c.dataset.val === p.fitPref));
}

/* ── 홈 ── */
function enterHome() {
  renderMannequin($("#mannequin-home"), state.profile, null);
  const prefLabel = { tight: "타이트핏", regular: "정사이즈핏", boxy: "박시핏" }[state.profile.fitPref];
  $("#home-caption").textContent = `${state.profile.height}cm · ${prefLabel} 취향 마네킹이에요`;
  renderRecent();
  showScreen("screen-home");
}

function initHome() {
  $("#btn-profile").addEventListener("click", () => {
    fillFormFromProfile(state.profile);
    state.obStep = 1; syncObStep();
    showScreen("screen-onboarding");
  });

  $("#btn-demo-links").addEventListener("click", () => {
    const box = $("#demo-links");
    if (!box.childElementCount) {
      box.innerHTML = DEMO_LINKS.map(u => `<button class="demo-link-chip" data-url="${u}">${u}</button>`).join("");
      box.addEventListener("click", e => {
        const chip = e.target.closest(".demo-link-chip"); if (!chip) return;
        $("#input-link").value = chip.dataset.url;
        startAnalysis(chip.dataset.url);
      });
    }
    box.classList.toggle("hidden");
  });

  $("#btn-analyze").addEventListener("click", () => {
    const url = $("#input-link").value.trim();
    if (!/^https?:\/\/\S+/.test(url)) { alert("올바른 상품 링크(URL)를 붙여넣어주세요."); return; }
    startAnalysis(url);
  });
}

/* ── 최근 기록 ── */
function loadRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } }
function saveRecent(entry) {
  const list = loadRecent().filter(r => r.productId !== entry.productId);
  list.unshift(entry);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
}
const VERDICT_BADGE = {
  ok: ["잘 맞음", "st-ok"], size_mismatch: ["사이즈 주의", "st-warn"],
  soldout: ["품절", "st-out"], no_fit: ["안 맞음", "st-bad"], no_data: ["정보 부족", "st-out"],
};
function renderRecent() {
  const list = loadRecent();
  const box = $("#recent-list");
  if (!list.length) { box.innerHTML = `<div class="recent-empty">아직 입어본 옷이 없어요.<br>위에 링크를 붙여넣어 시작해보세요!</div>`; return; }
  box.innerHTML = list.map(r => {
    const [label, cls] = VERDICT_BADGE[r.verdict];
    return `<button class="recent-item" data-url="${r.url}">
      <span class="recent-swatch" style="background:${r.color}"></span>
      <span><b>${r.name}</b><small>${r.brand}</small></span>
      <span class="recent-badge ${cls}">${label}</span>
    </button>`;
  }).join("");
  box.onclick = e => {
    const item = e.target.closest(".recent-item"); if (!item) return;
    startAnalysis(item.dataset.url);
  };
}

/* ── 분석 흐름 ── */
const LOADING_STEPS = ["상품 페이지를 읽고 있어요…", "사이즈 실측표를 찾고 있어요…", "내 치수와 대조하고 있어요…", "마네킹에 입혀보는 중…"];

const FAIL_REASON_TEXT = {
  no_size_chart: "페이지에서 사이즈 실측표를 찾지 못했어요",
  fetch_failed: "상품 페이지에 접속하지 못했어요",
  timeout: "상품 페이지 응답이 너무 느려요",
  llm_refused: "AI가 이 페이지 분석을 건너뛰었어요",
  server_unreachable: "분석 서버가 꺼져 있어요 (npm start로 실행하세요)",
};

async function startAnalysis(url) {
  const overlay = $("#overlay-loading");
  overlay.classList.remove("hidden");
  let i = 0;
  $("#loading-text").textContent = LOADING_STEPS[0];
  const timer = setInterval(() => {
    i = Math.min(i + 1, LOADING_STEPS.length - 1);
    $("#loading-text").textContent = LOADING_STEPS[i];
  }, 900);

  // 실제 분석 + 최소 노출시간을 함께 대기
  const minDelay = new Promise(r => setTimeout(r, 1200));
  let product = null, live = false, failReason = null;
  try {
    const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.ok) { product = data.product; live = true; }
    else failReason = data.reason || "fetch_failed";
  } catch {
    failReason = "server_unreachable";
  }
  await minDelay;
  clearInterval(timer);
  overlay.classList.add("hidden");

  let matched = true;
  if (!product) {
    // 실제 분석 실패 → 데모 카탈로그로 대체 분석 (화면에 사유 표시)
    const m = matchProductByUrl(url);
    product = m.product;
    matched = m.matched;
  }

  const analysis = analyzeProduct(product, state.profile);
  state.lastAnalysis = { url, matched, live, failReason, analysis };
  saveRecent({ url, productId: product.id, name: product.name, brand: product.brand, color: product.color, verdict: analysis.verdict });
  renderResult();
  showScreen("screen-result");
}

/* ── 결과 렌더 ── */
function verdictBanner(a) {
  const best = a.bestInStock || a.best;
  const sizingNote = a.sizing && a.sizing.dir !== "normal" ? ` ${a.sizing.text}` : "";
  switch (a.verdict) {
    case "ok": {
      const soldOutNote = (a.best.soldOut && a.best.size !== best.size)
        ? ` 가장 잘 맞는 ${a.best.size}는 품절이라 차선으로 추천드려요.` : "";
      return { cls: "verdict-ok", icon: "✓", title: `${best.size} 사이즈를 추천해요`,
        body: `${a.prefLabel} 취향 기준 적합도 ${best.score}점.${soldOutNote}${sizingNote}` };
    }
    case "size_mismatch":
      return { cls: "verdict-warn", icon: "!", title: "사이즈가 애매해요",
        body: `가장 가까운 ${best.size}도 ${a.prefLabel} 기준에 완전히 맞지 않아요.${sizingNote} 아래 대체상품을 확인해보세요.` };
    case "soldout":
      return { cls: "verdict-bad", icon: "✕", title: "맞는 사이즈가 품절이에요",
        body: `회원님께 맞는 ${a.best.size} 사이즈가 품절됐어요. 아래에서 비슷한 대체상품을 찾아드렸어요.` };
    case "no_data":
      return { cls: "verdict-warn", icon: "?", title: "실측을 비교할 수 없어요",
        body: "사이즈표는 찾았지만 내 치수와 비교 가능한 항목이 없어요. 상품 상세의 실측을 직접 확인해주세요." };
    default:
      return { cls: "verdict-bad", icon: "✕", title: "사이즈가 안 맞습니다",
        body: `이 제품은 어떤 사이즈도 회원님 치수와 ${a.prefLabel} 취향에 맞지 않아요.${sizingNote} 아래 대체상품을 추천드려요.` };
  }
}

const STATUS_LABEL = {
  perfect: ["잘 맞아요", "st-ok"], snug: ["딱 붙어요", "st-warn"], loose: ["여유 있어요", "st-warn"],
  too_small: ["작아요", "st-bad"], too_big: ["커요", "st-bad"], no_data: ["실측 없음", "st-out"],
};

function renderResult() {
  const { url, matched, live, failReason, analysis: a } = state.lastAnalysis;
  const p = a.product;
  const banner = verdictBanner(a);
  const wearSize = (a.bestInStock || a.best).size;
  // 대체상품: 실상품은 실제 검색 링크로, 데모 상품은 데모 카탈로그에서
  const needAlt = a.verdict !== "ok";
  const alts = (needAlt && !live) ? findAlternatives(p, state.profile) : [];

  let sourceLine;
  if (live) {
    sourceLine = p.source === "live_llm"
      ? "✓ 실제 상품 페이지 — AI가 사이즈표를 추출했어요"
      : "✓ 실제 상품 페이지에서 사이즈 실측표를 읽었어요";
  } else {
    const reason = FAIL_REASON_TEXT[failReason];
    sourceLine = (reason ? `⚠ ${reason} — ` : "") +
      (matched ? "데모 카탈로그 상품으로 분석했어요" : "미등록 상품이라 데모 상품으로 대체 분석했어요");
  }

  const sizeRows = a.results.map(r => {
    const [label, cls] = r.soldOut ? ["품절", "st-out"] : STATUS_LABEL[r.status];
    return `<div class="size-row ${r.size === wearSize ? "best" : ""}">
      <span class="size-chip">${r.size}</span>
      <span class="size-row-txt">
        <b>적합도 ${r.score}점</b>
        <small>${r.details.map(d => d.text).join(" · ")}</small>
      </span>
      <span class="size-state ${cls}">${label}</span>
    </div>`;
  }).join("");

  let altHtml = "";
  if (alts.length) {
    altHtml = `
    <div class="alt-section">
      <h4>대신 이건 어때요?</h4>
      <p>같은 종류에서 회원님 치수·취향에 맞고 재고 있는 상품이에요.</p>
      <div class="alt-list">
        ${alts.map(x => `
          <button class="alt-card" data-id="${x.product.id}">
            <span class="alt-swatch" style="background:${x.product.color}"></span>
            <span><b>${x.product.name}</b><small>${x.product.brand} · ${x.product.price.toLocaleString()}원</small></span>
            <span class="alt-fit"><strong>${x.best.size} · ${x.best.score}점</strong><span>적합</span></span>
          </button>`).join("")}
      </div>
    </div>`;
  } else if (needAlt && live) {
    const query = encodeURIComponent(p.name.replace(/\[[^\]]*\]/g, "").trim());
    altHtml = `
    <div class="alt-section">
      <h4>대체상품을 찾아보세요</h4>
      <p>이 상품이 맞지 않거나 품절이라면, 비슷한 상품을 실측 비교하며 골라보세요.</p>
      <div class="alt-list">
        <a class="alt-card" href="https://search.shopping.naver.com/search/all?query=${query}" target="_blank" rel="noopener">
          <span class="alt-swatch" style="background:#1D6E5E"></span>
          <span><b>네이버쇼핑에서 비슷한 상품 검색</b><small>"${p.name.slice(0, 30)}" 유사 상품 →</small></span>
        </a>
        <a class="alt-card" href="https://www.musinsa.com/search/goods?keyword=${query}" target="_blank" rel="noopener">
          <span class="alt-swatch" style="background:#2B4C7E"></span>
          <span><b>무신사에서 비슷한 상품 검색</b><small>찾은 상품 링크를 다시 붙여넣으면 판정해드려요</small></span>
        </a>
      </div>
    </div>`;
  }

  $("#result-body").innerHTML = `
    <div class="product-card">
      <div class="product-brand">${p.brand}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-meta">${p.note}</div>
      <div class="product-price">${p.price ? p.price.toLocaleString() + "원" : "가격 정보 없음"}</div>
      <div class="product-src">🔗 ${url}</div>
      <div class="product-src ${live ? "src-live" : "src-demo"}">${sourceLine}</div>
    </div>

    <div class="verdict-banner ${banner.cls}">
      <span class="v-icon">${banner.icon}</span>
      <div><h4>${banner.title}</h4><p>${banner.body}</p></div>
    </div>

    <div class="tryon-stage">
      <div id="mannequin-tryon"></div>
      <p class="tryon-caption">${wearSize} 사이즈 착용 — 실측 비율 그대로 입혔어요</p>
    </div>

    <div class="size-table">
      <h4>사이즈별 판정 (${a.prefLabel} 취향 기준)</h4>
      ${sizeRows}
    </div>

    ${altHtml}

    <div class="result-actions">
      <button class="btn btn-ghost" id="btn-again">다른 옷 입어보기</button>
    </div>`;

  renderMannequin($("#mannequin-tryon"), state.profile, { product: p, sizeName: wearSize });

  $("#btn-again").addEventListener("click", () => enterHome());
  $$(".alt-card").forEach(card => card.addEventListener("click", () => {
    const alt = CATALOG.find(c => c.id === card.dataset.id);
    const analysis = analyzeProduct(alt, state.profile);
    state.lastAnalysis = { url: `단장 추천 · ${alt.brand}`, matched: true, analysis };
    saveRecent({ url: DEMO_LINKS[0], productId: alt.id, name: alt.name, brand: alt.brand, color: alt.color, verdict: analysis.verdict });
    renderResult();
    window.scrollTo(0, 0);
  }));
}

/* ── 부팅 ── */
function init() {
  initSplash();
  initOnboarding();
  initHome();
  $("#btn-result-back").addEventListener("click", () => enterHome());
}
document.addEventListener("DOMContentLoaded", init);
