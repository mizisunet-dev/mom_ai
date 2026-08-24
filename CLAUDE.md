# danjang CLAUDE.md

> 자동 생성: /setup 스킬 | 수정 시 .claude/profile.json을 변경 후 /setup 재실행

단장(丹粧) — 쇼핑몰 상품 링크를 붙여넣으면 사이즈 실측표를 추출해
내 치수 마네킹이 대신 입어보고 핏을 판정하는 모바일 웹앱.

## 스택

- Framework: node-http — Node.js 내장 `http` 서버 (CommonJS), 프레임워크 없음
- Design System: 없음
- State: 없음 — 프런트는 순수 DOM 조작 (`js/app.js`)
- Styling: vanilla-css — `css/style.css` (단청 팔레트: 석록·석간주·군청·황)
- Testing: manual-mock-server — `test/mock-shop.js` 목 쇼핑몰로 추출 경로 수동 검증

## 구조

```
server.js          정적 서빙 + GET /api/analyze?url=<상품링크>
lib/fetch-page.js  상품 페이지 fetch (SSRF 방어: dns/net 검사)
lib/extract.js     휴리스틱 추출 (JSON-LD / OG / 사이즈표 파싱)
lib/llm-extract.js Claude 폴백 추출 (@anthropic-ai/sdk)
js/app.js          화면 흐름
js/data.js         치수 저장 (localStorage)
js/fit.js          핏 판정 로직
js/mannequin.js    마네킹 렌더링
```

## 명령어

```bash
# 개발 (= 실행). PORT 기본 3000
npm start

# AI 폴백 추출까지 켜고 실행
ANTHROPIC_API_KEY=sk-ant-... npm start

# 목 쇼핑몰 (PORT 기본 8899) — 띄워두고 /api/analyze로 검증
node test/mock-shop.js
```

빌드 단계와 린터는 설정돼 있지 않습니다.

## 규칙 참조

프로젝트 스택(vanilla JS + Node http)에 대응하는 code-forge 스택 모듈이 없어
모듈 참조는 비어 있습니다. 작업 규칙은 AGENTS.md를 따릅니다.
