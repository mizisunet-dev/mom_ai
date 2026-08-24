# danjang AGENTS.md

> 자동 생성: code-forge /setup | CLAUDE.md와 함께 사용

## Working Protocol

모든 코드 작업에 아래 규칙을 따른다:

1. **읽기 우선** — 수정 전 반드시 파일을 읽는다. 기억에서 추론하지 않는다
2. **패턴 준수** — 기존 코드의 구조, 네이밍, 스타일을 따른다
3. **정책 보존** — 비즈니스 로직을 임의 변경하지 않는다
4. **최소 변경** — 요청받은 것만 수정한다
5. **스코프 준수** — 대상 외 파일은 명시 요청 없이 수정하지 않는다

작업 루프: GROUND(맥락 파악) → APPLY(구현) → VERIFY(검증) → ADAPT(실패 시 조정)

## Project Conventions

Read CLAUDE.md for stack-specific rules, commands, and module references.
