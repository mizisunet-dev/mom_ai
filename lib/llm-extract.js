/* ─────────────────────────────────────────────
   단장 ver2 — Claude 기반 사이즈표 추출 (폴백)
   휴리스틱 파서가 사이즈표를 못 찾은 페이지에서,
   페이지 텍스트를 Claude에 넘겨 구조화 추출한다.
   ANTHROPIC_API_KEY(또는 AUTH_TOKEN)가 있을 때만 동작.
────────────────────────────────────────────── */
"use strict";

const Anthropic = require("@anthropic-ai/sdk");
const { normalizeChart, pickColor } = require("./extract");

function isLLMAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean", description: "사이즈 실측 정보를 찾았는지" },
    name: { type: "string" },
    brand: { type: "string" },
    price: { type: "number", description: "판매가(원). 모르면 0" },
    category: { type: "string", enum: ["top", "bottom"] },
    sold_out_sizes: { type: "array", items: { type: "string" } },
    sizes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "사이즈 표기 (S, M, 28, FREE 등)" },
          shoulder: { type: "number", description: "어깨너비 cm. 없으면 0" },
          chest_flat: { type: "number", description: "가슴 단면 cm (둘레는 2로 나눠 단면으로). 없으면 0" },
          waist_flat: { type: "number", description: "허리 단면 cm. 없으면 0" },
          hip_flat: { type: "number", description: "엉덩이 단면 cm. 없으면 0" },
          thigh_flat: { type: "number", description: "허벅지 단면 cm. 없으면 0" },
          sleeve: { type: "number", description: "소매길이 cm. 없으면 0" },
          length: { type: "number", description: "총장 cm. 없으면 0" },
        },
        required: ["label", "shoulder", "chest_flat", "waist_flat", "hip_flat", "thigh_flat", "sleeve", "length"],
        additionalProperties: false,
      },
    },
  },
  required: ["found", "name", "brand", "price", "category", "sold_out_sizes", "sizes"],
  additionalProperties: false,
};

async function llmExtractProduct(pageText, url) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system:
      "당신은 쇼핑몰 상품 페이지에서 의류 사이즈 실측 정보를 추출하는 도구입니다. " +
      "주어진 페이지 텍스트에서 상품명, 브랜드, 가격, 사이즈별 실측(cm), 품절 사이즈를 추출하세요. " +
      "둘레(circumference)로 표기된 수치는 2로 나누어 단면(flat)으로 변환하세요. " +
      "실측 정보가 전혀 없으면 found를 false로 하세요. 추측으로 수치를 지어내지 마세요.",
    messages: [
      { role: "user", content: `상품 페이지 URL: ${url}\n\n페이지 내용:\n${pageText}` },
    ],
  });

  if (response.stop_reason === "refusal") return { ok: false, reason: "llm_refused" };

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return { ok: false, reason: "llm_empty" };
  const data = JSON.parse(text);
  if (!data.found || !data.sizes?.length) return { ok: false, reason: "no_size_chart" };

  const sizes = {};
  const fieldMap = {
    shoulder: "shoulder", chest_flat: "chestFlat", waist_flat: "waistFlat",
    hip_flat: "hipFlat", thigh_flat: "thighFlat", sleeve: "sleeve", length: "length",
  };
  for (const s of data.sizes) {
    const chart = {};
    for (const [src, dst] of Object.entries(fieldMap)) {
      if (s[src] > 0) chart[dst] = s[src];
    }
    if (Object.keys(chart).length) sizes[String(s.label).toUpperCase()] = chart;
  }
  if (!Object.keys(sizes).length) return { ok: false, reason: "no_size_chart" };

  const [color, accent] = pickColor(url);
  return {
    ok: true,
    product: {
      id: `live-${Date.now()}`,
      brand: data.brand || "쇼핑몰",
      name: data.name || "이름 미확인 상품",
      category: data.category,
      type: data.category === "bottom" ? "pants" : "tshirt",
      price: data.price || 0,
      color, accent,
      stretch: 0.3,
      note: "AI가 상품 페이지를 읽고 추출한 실측입니다",
      soldOut: (data.sold_out_sizes || []).map((s) => String(s).toUpperCase()),
      sizes: normalizeChart(sizes),
      source: "live_llm",
    },
  };
}

module.exports = { isLLMAvailable, llmExtractProduct };
