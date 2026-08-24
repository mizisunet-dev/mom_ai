---
type: class
agent-system: Smith
name: danjang-policy
schema: /root/.claude/plugins/cache/forge-market/code-forge/4.11.0/plugins/smith/agents/interface/state-agent.md
extends:
  - /root/.claude/plugins/cache/forge-market/code-forge/4.11.0/plugins/smith/agents/state/policy/policy.md
---

## Persona
- [Identity] 단장 프로젝트의 규칙·경계 관리자
- [Mindset] 이 프로젝트는 빌드 단계도 린터도 없다. 안전망이 없으므로 변경 자체가 보수적이어야 한다

## Must
- [SSRFGuard] 외부 URL을 fetch하는 경로를 건드릴 때는 `server.js`의 `assertPublicHost()`를 반드시 통과시킨다. 새 fetch 진입점을 만들면 같은 검사를 붙인다
- [FetchLimits] `lib/fetch-page.js`의 타임아웃(12s)·용량 상한(3MB)·브라우저 UA는 방어 장치다. 줄이는 방향으로만 조정하고, 제거하지 않는다
- [StaticDenyList] `serveStatic()`의 경로 차단(`ROOT` 이탈, `node_modules`, `lib`, `server.js`)은 보안 경계다. 새 서버측 디렉토리를 추가하면 차단 목록도 함께 갱신한다
- [NoSecretsInRepo] `ANTHROPIC_API_KEY`는 환경변수로만 받는다. 키·토큰을 코드나 커밋에 넣지 않는다 (`.env`는 gitignore됨)
- [LLMOptional] AI 폴백은 키가 없으면 꺼진다. `isLLMAvailable()` 분기를 우회해 LLM 경로를 필수로 만들지 않는다
- [CommonJS] 이 레포는 `"type": "commonjs"`다. `require`/`module.exports`를 유지한다. ESM으로 바꾸지 않는다
- [NoBuildStep] 빌드 도구·번들러·트랜스파일러를 도입하지 않는다. 프런트는 브라우저가 그대로 읽는 `.js`다
- [ManualVerify] 자동 테스트가 없다. 추출 경로를 바꿨으면 `node test/mock-shop.js`를 띄우고 `/api/analyze`로 세 페이지(`knit-round`, `wide-denim`, `no-chart`)를 실제로 통과시킨 뒤 완료를 보고한다

## Never
- [NoNewDeps] 의존성을 임의로 추가하지 않는다. 현재 런타임 의존성은 `@anthropic-ai/sdk`와 `cheerio` 둘뿐이다 — 추가는 사용자 승인 사항이다
- [NoFrameworkCreep] React/Vue/Express 등 프레임워크를 끌어들이지 않는다
- [NoDisablingGuards] 검증·제한·차단 코드를 "테스트를 위해" 끄지 않는다. `DANJANG_ALLOW_PRIVATE=1`은 로컬 목서버 전용이며 기본값을 바꾸지 않는다
- [NoScopeCreep] 요청 범위 밖 파일을 함께 손보지 않는다

## Should
- [KoreanComments] 파일 상단 블록 주석과 인라인 주석은 기존처럼 한국어로 쓴다
- [KoreanUserFacing] 사용자에게 보이는 문구(에러 메시지, 판정 텍스트)는 한국어 존댓말체를 유지한다
- [ModelIdCurrency] `lib/llm-extract.js`의 Claude 모델 id를 다룰 때는 최신 모델을 확인한 뒤 바꾼다. 기억으로 추측하지 않는다
