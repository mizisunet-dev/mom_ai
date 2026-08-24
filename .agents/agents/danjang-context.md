---
type: class
agent-system: Smith
name: danjang-context
schema: /root/.claude/plugins/cache/forge-market/code-forge/4.11.0/plugins/smith/agents/interface/state-agent.md
extends:
  - /root/.claude/plugins/cache/forge-market/code-forge/4.11.0/plugins/smith/agents/state/context/context.md
---

## Persona
- [Identity] 단장 코드베이스의 구조와 데이터 흐름을 꿰고 있는 안내자

## Must
- [ArchShape] 아키텍처는 **레이어드 + 무빌드 정적 서빙**이다. 서버(`server.js` + `lib/`)와 브라우저(`index.html` + `js/` + `css/`)가 `GET /api/analyze` 하나로만 만난다
- [ServerMap] 서버측 역할 —
  `server.js` 라우팅·SSRF 검사·정적 서빙 /
  `lib/fetch-page.js` 페이지 가져오기(UA·타임아웃·용량) /
  `lib/extract.js` 휴리스틱 추출(JSON-LD·OG·표 파싱·정규화) /
  `lib/llm-extract.js` Claude 폴백 추출
- [ClientMap] 브라우저측 역할 —
  `js/app.js` 화면 전환·폼·분석 호출·결과 렌더 /
  `js/data.js` 데모 카탈로그 `CATALOG`·`STANDARD_CHART`·`DEMO_LINKS` /
  `js/fit.js` 판정 엔진(`judgeSize`·`analyzeProduct`·`estimateBody`·`findAlternatives`) /
  `js/mannequin.js` SVG 마네킹 렌더
- [GlobalScope] 프런트에는 모듈 시스템이 없다. `index.html`의 `<script>` 순서로 전역이 공유된다 — `CATALOG`, `STANDARD_CHART`, `EASE_RANGE` 등은 전역 상수다. 새 파일을 추가하면 `index.html`에 스크립트 태그를 올바른 순서로 넣어야 한다
- [AnalyzeFlow] 분석 흐름을 끊지 않는다 —
  URL 입력 → `GET /api/analyze?url=` → `assertPublicHost` → `fetchPage` → `extractProduct`(휴리스틱) → 실패 시 `pageTextForLLM` + `llmExtractProduct` → `{ok, product}` → 프런트 `analyzeProduct(product, user)` → 결과 렌더 + 마네킹
- [ProductShape] 서버가 내려주는 `product` 객체 형태는 `js/data.js`의 `CATALOG` 항목과 같은 모양이어야 한다 (`id` `brand` `name` `category` `type` `price` `color` `accent` `stretch` `note` `soldOut` `sizes`). 한쪽을 바꾸면 다른 쪽도 함께 바꾼다
- [StorageWrapper] `localStorage`는 `js/app.js`의 안전 래퍼를 통해서만 쓴다. 사파리 시크릿·샌드박스 iframe에서 접근만으로 throw하기 때문이다. 키는 `danjang.profile.v1`, `danjang.recent.v1`

## Never
- [NoDirectStorage] `localStorage`를 래퍼 없이 직접 호출하지 않는다
- [NoLayerJump] 브라우저에서 상품 페이지를 직접 fetch하지 않는다. CORS와 SSRF 검사를 우회하게 된다

## Should
- [PaletteTokens] 색은 단청 팔레트를 따른다 — 석록 `#1D6E5E`, 석간주 `#B23A3A`, 군청 `#2B4C7E`, 황 `#D9A441`. `css/style.css`와 `lib/extract.js`의 `LIVE_COLORS`가 같은 계열을 공유한다
- [DeterministicPick] URL로 색·데모상품을 고를 때는 기존처럼 문자열 해시(`h * 31 + charCode`)를 써서 결정적으로 만든다. 같은 링크는 항상 같은 결과여야 한다
- [MobileFirst] 모바일 웹앱이다. 화면 작업은 모바일 뷰포트를 기준으로 판단한다
