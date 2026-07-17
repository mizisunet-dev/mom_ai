/* ─────────────────────────────────────────────
   단장 ver1 — 마네킹 렌더러
   사용자 실측(키·어깨·가슴·허리·엉덩이)에 비례해
   SVG 마네킹을 그리고, 제품 실측 그대로의 폭으로
   옷을 겹쳐 그려 타이트/박시가 눈에 보이게 한다.
────────────────────────────────────────────── */

const MQ = { W: 300, H: 560, PAD_TOP: 26 };

/* 둘레(cm) → 정면 폭(px) : 정면 폭 ≈ 둘레 / 2.9 */
function girthToW(cm, s) { return (cm / 2.9) * s; }

function bodyFrame(user) {
  const s = (MQ.H - MQ.PAD_TOP - 18) / user.height; // px per cm
  const cx = MQ.W / 2;
  const topY = MQ.PAD_TOP;
  const y = f => topY + user.height * s * f; // 키 비율 → y좌표
  return {
    s, cx,
    headR: 10.5 * s,
    headCY: topY + 11 * s,
    neckY: y(0.115),
    shoulderY: y(0.155),
    chestY: y(0.245),
    waistY: y(0.40),
    hipY: y(0.50),
    kneeY: y(0.735),
    ankleY: y(0.965),
    shoulderW: user.shoulder * s * 1.04,
    chestW: girthToW(user.chest, s),
    waistW: girthToW(user.waist, s),
    hipW: girthToW(user.hip, s),
  };
}

function torsoPath(F) {
  const { cx } = F;
  const sw = F.shoulderW / 2, ch = F.chestW / 2, wa = F.waistW / 2, hp = F.hipW / 2;
  return `
    M ${cx - sw} ${F.shoulderY}
    C ${cx - ch - 2} ${F.chestY - 8}, ${cx - ch} ${F.chestY}, ${cx - ch} ${F.chestY}
    C ${cx - ch} ${F.chestY + 10}, ${cx - wa} ${F.waistY - 10}, ${cx - wa} ${F.waistY}
    C ${cx - wa} ${F.waistY + 8}, ${cx - hp} ${F.hipY - 10}, ${cx - hp} ${F.hipY}
    L ${cx + hp} ${F.hipY}
    C ${cx + hp} ${F.hipY - 10}, ${cx + wa} ${F.waistY + 8}, ${cx + wa} ${F.waistY}
    C ${cx + wa} ${F.waistY - 10}, ${cx + ch} ${F.chestY + 10}, ${cx + ch} ${F.chestY}
    C ${cx + ch} ${F.chestY}, ${cx + ch + 2} ${F.chestY - 8}, ${cx + sw} ${F.shoulderY}
    Q ${cx} ${F.shoulderY - 7} ${cx - sw} ${F.shoulderY}
    Z`;
}

function legsShape(F) {
  const { cx } = F;
  const hp = F.hipW / 2;
  const thigh = hp * 0.52, knee = hp * 0.34, ankle = hp * 0.22, gap = 3;
  const leg = sign => `
    M ${cx + sign * gap} ${F.hipY - 2}
    L ${cx + sign * hp} ${F.hipY - 2}
    C ${cx + sign * (gap + thigh)} ${F.hipY + 30}, ${cx + sign * (gap + knee)} ${F.kneeY - 12}, ${cx + sign * (gap + knee)} ${F.kneeY}
    C ${cx + sign * (gap + knee)} ${F.kneeY + 18}, ${cx + sign * (gap + ankle)} ${F.ankleY - 10}, ${cx + sign * (gap + ankle)} ${F.ankleY}
    L ${cx + sign * gap} ${F.ankleY}
    Z`;
  return leg(1) + " " + leg(-1);
}

function armsShape(F) {
  const { cx } = F;
  const sw = F.shoulderW / 2;
  const armW = Math.max(6, F.chestW * 0.115);
  const wristY = F.waistY + (F.hipY - F.waistY) * 0.9;
  const arm = sign => `
    M ${cx + sign * (sw - armW * 0.4)} ${F.shoulderY + 2}
    C ${cx + sign * (sw + armW)} ${F.shoulderY + 14}, ${cx + sign * (sw + armW * 0.9)} ${F.chestY + 20}, ${cx + sign * (sw + armW * 0.55)} ${F.waistY}
    L ${cx + sign * (sw + armW * 0.35)} ${wristY}
    L ${cx + sign * (sw - armW * 0.45)} ${wristY}
    C ${cx + sign * (sw - armW * 0.35)} ${F.chestY + 16}, ${cx + sign * (sw - armW * 0.5)} ${F.shoulderY + 22}, ${cx + sign * (sw - armW * 0.4)} ${F.shoulderY + 2}
    Z`;
  return arm(1) + " " + arm(-1);
}

/* 상의 오버레이 — 제품 실측 폭 그대로 */
function garmentTop(F, chart, color, accent, type) {
  const s = F.s, cx = F.cx;
  const gShoulder = (chart.shoulder * s * 1.04) / 2;
  const gChest = girthToW(chart.chestFlat * 2, s) / 2;
  const hemY = F.shoulderY + chart.length * s;
  const hemW = gChest * (type === "hoodie" ? 0.96 : 0.98);
  const sleeveLen = (chart.sleeve || 20) * s;
  const longSleeve = (chart.sleeve || 0) >= 40;
  const slvW = Math.max(9, gChest * 0.26);

  const sleeve = sign => {
    const sx = cx + sign * (gShoulder - 2);
    const ex = cx + sign * (gShoulder + (longSleeve ? slvW * 0.75 : slvW * 1.15));
    const ey = F.shoulderY + (longSleeve ? sleeveLen * 0.96 : sleeveLen * 1.25);
    return `M ${sx} ${F.shoulderY}
      C ${cx + sign * (gShoulder + slvW)} ${F.shoulderY + 8}, ${ex + sign * 3} ${ey - 16}, ${ex} ${ey}
      L ${ex - sign * slvW * 0.8} ${ey + 2}
      C ${cx + sign * (gShoulder - slvW * 0.15)} ${F.shoulderY + sleeveLen * 0.5}, ${sx - sign * 2} ${F.shoulderY + 22}, ${sx - sign * 4} ${F.shoulderY + 14} Z`;
  };

  const bodyPath = `
    M ${cx - gShoulder} ${F.shoulderY}
    Q ${cx} ${F.shoulderY - 6} ${cx + gShoulder} ${F.shoulderY}
    C ${cx + gChest} ${F.shoulderY + 26}, ${cx + gChest} ${F.chestY}, ${cx + gChest} ${F.chestY + 6}
    L ${cx + hemW} ${hemY}
    L ${cx - hemW} ${hemY}
    L ${cx - gChest} ${F.chestY + 6}
    C ${cx - gChest} ${F.chestY}, ${cx - gChest} ${F.shoulderY + 26}, ${cx - gShoulder} ${F.shoulderY}
    Z`;

  const neck = type === "hoodie"
    ? `<path d="M ${cx - 16} ${F.shoulderY - 2} Q ${cx} ${F.shoulderY + 20} ${cx + 16} ${F.shoulderY - 2} Q ${cx} ${F.shoulderY - 14} ${cx - 16} ${F.shoulderY - 2} Z" fill="${shade(color, -18)}"/>`
    : `<path d="M ${cx - 11} ${F.shoulderY - 1} Q ${cx} ${F.shoulderY + 10} ${cx + 11} ${F.shoulderY - 1}" fill="none" stroke="${shade(color, -22)}" stroke-width="3" stroke-linecap="round"/>`;

  return `<g class="garment">
    <path d="${sleeve(-1)}" fill="${color}" stroke="${shade(color, -14)}" stroke-width="1"/>
    <path d="${sleeve(1)}" fill="${color}" stroke="${shade(color, -14)}" stroke-width="1"/>
    <path d="${bodyPath}" fill="${color}" stroke="${shade(color, -14)}" stroke-width="1.2"/>
    ${neck}
    <line x1="${cx - hemW + 6}" y1="${hemY - 5}" x2="${cx + hemW - 6}" y2="${hemY - 5}" stroke="${accent}" stroke-width="1.6" opacity=".55" stroke-dasharray="5 4"/>
  </g>`;
}

/* 하의 오버레이 */
function garmentBottom(F, chart, color, accent, type) {
  const s = F.s, cx = F.cx;
  const gWaist = girthToW(chart.waistFlat * 2, s) / 2;
  const topY = F.waistY + (F.hipY - F.waistY) * 0.25;
  const hemY = Math.min(topY + chart.length * s * 0.94, F.ankleY + 6);

  if (type === "skirt") {
    const hemW = gWaist * 2.3;
    return `<g class="garment">
      <path d="M ${cx - gWaist} ${topY} L ${cx + gWaist} ${topY} L ${cx + hemW} ${hemY} L ${cx - hemW} ${hemY} Z"
        fill="${color}" stroke="${shade(color, -14)}" stroke-width="1.2"/>
      ${[-0.6, -0.2, 0.2, 0.6].map(t =>
        `<line x1="${cx + gWaist * t}" y1="${topY + 4}" x2="${cx + hemW * t}" y2="${hemY}" stroke="${shade(color, -16)}" stroke-width="1"/>`).join("")}
      <line x1="${cx - gWaist}" y1="${topY + 3}" x2="${cx + gWaist}" y2="${topY + 3}" stroke="${accent}" stroke-width="2" opacity=".6"/>
    </g>`;
  }

  const gHip = girthToW(Math.min(chart.hipFlat, 500) * 2, s) / 2;
  const gThigh = chart.thighFlat && chart.thighFlat < 900 ? girthToW(chart.thighFlat * 2, s) / 2 : gHip * 0.55;
  const hipY = F.hipY + 4;
  const hemW = Math.max(gThigh * 0.62, gHip * 0.3);
  const gap = 2.5;
  const leg = sign => `
    M ${cx + sign * gap} ${hipY + 12}
    L ${cx + sign * gHip} ${hipY}
    L ${cx + sign * (gap + gThigh)} ${hipY + 40}
    L ${cx + sign * (gap + hemW)} ${hemY}
    L ${cx + sign * gap} ${hemY}
    Z`;
  return `<g class="garment">
    <path d="M ${cx - gWaist} ${topY} L ${cx + gWaist} ${topY} L ${cx + gHip} ${hipY} L ${cx - gHip} ${hipY} Z"
      fill="${color}" stroke="${shade(color, -14)}" stroke-width="1"/>
    <path d="${leg(-1)}" fill="${color}" stroke="${shade(color, -14)}" stroke-width="1"/>
    <path d="${leg(1)}" fill="${color}" stroke="${shade(color, -14)}" stroke-width="1"/>
    <line x1="${cx - gWaist + 4}" y1="${topY + 3.5}" x2="${cx + gWaist - 4}" y2="${topY + 3.5}" stroke="${accent}" stroke-width="2" opacity=".6"/>
  </g>`;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/* 메인 렌더 — outfit: { product, sizeName } | null */
function renderMannequin(el, user, outfit) {
  const F = bodyFrame(user);
  const skin = "#EDE4D8", skinLine = "#D9CCBA";

  let garment = "";
  if (outfit) {
    const chart = outfit.product.sizes[outfit.sizeName];
    garment = outfit.product.category === "top"
      ? garmentTop(F, chart, outfit.product.color, outfit.product.accent, outfit.product.type)
      : garmentBottom(F, chart, outfit.product.color, outfit.product.accent, outfit.product.type);
  }

  el.innerHTML = `
  <svg viewBox="0 0 ${MQ.W} ${MQ.H}" role="img" aria-label="내 마네킹">
    <ellipse cx="${F.cx}" cy="${F.ankleY + 10}" rx="${F.hipW * 0.95}" ry="9" fill="#26221C" opacity=".07"/>
    <g stroke="${skinLine}" stroke-width="1.2">
      <path d="${armsShape(F)}" fill="${skin}"/>
      <path d="${legsShape(F)}" fill="${skin}"/>
      <path d="${torsoPath(F)}" fill="${skin}"/>
      <rect x="${F.cx - 5.5}" y="${F.headCY + F.headR - 4}" width="11" height="${F.neckY - F.headCY - F.headR + 10}" rx="5" fill="${skin}"/>
      <circle cx="${F.cx}" cy="${F.headCY}" r="${F.headR}" fill="${skin}"/>
    </g>
    ${garment}
  </svg>`;
}
