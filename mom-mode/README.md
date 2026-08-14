# 엄마모드 작업 폴더

두 아이는 트랙이 다르므로 파일도 분리합니다.

| 파일 | 대상 | 용도 |
|---|---|---|
| `2027-논술후보.csv` | 첫째 (재수생) | 논술 후보 대학 — 채워서 충돌 검사에 사용 |
| `2028-영화과-전형지도.md` | 둘째 (고2) | 영화·영상 관련 학과 전형 유형 비교표 (작성 예정) |

## 논술 시간표 돌리기

```bash
python3 .claude/skills/nonsul-timetable/scripts/solve.py mom-mode/2027-논술후보.csv --top 5
```

캘린더에 넣기:

```bash
python3 .claude/skills/nonsul-timetable/scripts/solve.py mom-mode/2027-논술후보.csv --ics mom-mode/2027-논술.ics
```

형식이 헷갈리면 샘플부터 봅니다:

```bash
python3 .claude/skills/nonsul-timetable/scripts/solve.py --sample
```

자세한 사용법과 열 설명은 `.claude/skills/nonsul-timetable/SKILL.md`.

## 날짜를 채울 때

**출처는 각 대학 입학처의 최종 모집요강 PDF뿐입니다.**
입시 커뮤니티·블로그 요약본에는 변경 전 일정이 섞여 있습니다.
확인한 날짜는 `메모` 열에 "8/14 입학처 확인"처럼 적어 두면 나중에 재확인이 쉽습니다.

`권역` 열을 비우면 이동시간을 계산할 수 없어 보수적인 기본값(120분)이 적용됩니다. 꼭 채우세요.
