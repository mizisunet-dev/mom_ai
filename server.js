/* ─────────────────────────────────────────────
   단장 ver2 — 서버
   · 정적 파일 서빙 (프런트)
   · GET /api/analyze?url=<상품링크>
     → 페이지 fetch → 휴리스틱 추출 → (실패 시) Claude 추출
   실행: npm start  (PORT 기본 3000)
────────────────────────────────────────────── */
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const dns = require("node:dns/promises");
const net = require("node:net");

const { fetchPage } = require("./lib/fetch-page");
const { extractProduct, pageTextForLLM } = require("./lib/extract");
const { isLLMAvailable, llmExtractProduct } = require("./lib/llm-extract");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

/* SSRF 최소 방어: 사설/루프백 IP로 향하는 요청 차단 (테스트 시 env로 허용) */
function isPrivateIP(ip) {
  if (net.isIPv6(ip)) return /^(::1|f[cd]|fe80)/i.test(ip);
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}
async function assertPublicHost(url) {
  if (process.env.DANJANG_ALLOW_PRIVATE === "1") return;
  const { hostname } = new URL(url);
  const ips = net.isIP(hostname) ? [hostname] : (await dns.lookup(hostname, { all: true })).map((r) => r.address);
  if (ips.some(isPrivateIP)) throw new Error("내부 네트워크 주소는 분석할 수 없습니다.");
}

function sendJSON(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function handleAnalyze(req, res, query) {
  const url = query.get("url");
  if (!url) return sendJSON(res, 400, { ok: false, reason: "missing_url" });

  try {
    new URL(url);
  } catch {
    return sendJSON(res, 400, { ok: false, reason: "invalid_url" });
  }

  try {
    await assertPublicHost(url);
    const html = await fetchPage(url);

    // 1차: 휴리스틱 파서
    const result = extractProduct(html, url);
    if (result.ok) return sendJSON(res, 200, result);

    // 2차: Claude 구조화 추출 (키 있을 때만)
    if (isLLMAvailable()) {
      try {
        const llmResult = await llmExtractProduct(pageTextForLLM(html), url);
        if (llmResult.ok) return sendJSON(res, 200, llmResult);
        return sendJSON(res, 200, { ok: false, reason: llmResult.reason, meta: result.meta });
      } catch (err) {
        console.error("[llm-extract]", err.message);
      }
    }
    return sendJSON(res, 200, { ok: false, reason: result.reason, meta: result.meta });
  } catch (err) {
    const reason = err.name === "AbortError" ? "timeout" : "fetch_failed";
    return sendJSON(res, 200, { ok: false, reason, message: err.message });
  }
}

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || rel.startsWith("node_modules") || rel.startsWith("lib") || rel === "server.js") {
    res.writeHead(404); return res.end("Not Found");
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not Found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
  if (pathname === "/api/analyze") return void handleAnalyze(req, res, searchParams);
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`단장(丹粧) ver2 → http://localhost:${PORT}`);
  console.log(`AI 폴백 추출: ${isLLMAvailable() ? "활성 (Claude)" : "비활성 (ANTHROPIC_API_KEY 미설정)"}`);
});
