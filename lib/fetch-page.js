/* 상품 페이지 가져오기 — 브라우저 UA, 타임아웃, 용량 제한 */
"use strict";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const TIMEOUT_MS = 12000;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.5",
};

async function fetchPage(url) {
  const parsed = new URL(url); // throws on invalid URL
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("http/https 링크만 지원합니다.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`상품 페이지 응답 오류 (HTTP ${res.status})`);

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        controller.abort();
        break; // 사이즈표는 보통 앞부분에 있으므로 받은 만큼만 사용
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchPage };
