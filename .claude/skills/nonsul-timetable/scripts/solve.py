#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
논술/실기 시험 일정 충돌 검사 + 수시 6장 최적 조합 탐색기.

입력: 후보 대학 CSV (templates/candidates.sample.csv 참고)
출력: 충돌 쌍 목록 / 실현 가능한 조합 Top-N / 날짜별 타임라인 / (선택) .ics

핵심 규칙
  1) 같은 날 시험 시간이 겹치면 충돌.
  2) 겹치지 않아도 [앞 시험 종료 → 이동시간 → 입실여유] 가 안 되면 충돌.
  3) 수시 지원 횟수(기본 6) 이내에서 선호도 합이 최대인 조합을 찾는다.
  4) 수능최저 미충족 예상(N)은 기본 제외 (--allow-miss 로 포함).

사용:
  python3 solve.py candidates.csv
  python3 solve.py candidates.csv --top 5 --slots 6 --buffer 40 --ics plan.ics
  python3 solve.py --sample            # 동봉 샘플로 시연
"""

import argparse
import csv
import itertools
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE = os.path.join(HERE, "..", "templates", "candidates.sample.csv")

# ── 권역 → 광역그룹 추정 (문자열 포함 매칭, 위에서부터 우선) ────────────────
ZONE_RULES = [
    ("서울", "SEOUL"), ("인천", "INCHEON"),
    ("경기", "GYEONGGI"), ("수원", "GYEONGGI"), ("용인", "GYEONGGI"),
    ("성남", "GYEONGGI"), ("안양", "GYEONGGI"), ("부천", "GYEONGGI"),
    ("고양", "GYEONGGI"), ("의정부", "GYEONGGI"), ("평택", "GYEONGGI"),
    ("대전", "CHUNGCHEONG"), ("세종", "CHUNGCHEONG"), ("천안", "CHUNGCHEONG"),
    ("청주", "CHUNGCHEONG"), ("충남", "CHUNGCHEONG"), ("충북", "CHUNGCHEONG"),
    ("아산", "CHUNGCHEONG"),
    ("강원", "GANGWON"), ("춘천", "GANGWON"), ("원주", "GANGWON"), ("강릉", "GANGWON"),
    ("부산", "YEONGNAM"), ("대구", "YEONGNAM"), ("울산", "YEONGNAM"),
    ("경남", "YEONGNAM"), ("경북", "YEONGNAM"), ("창원", "YEONGNAM"), ("포항", "YEONGNAM"),
    ("광주", "HONAM"), ("전남", "HONAM"), ("전북", "HONAM"), ("전주", "HONAM"),
    ("제주", "JEJU"),
]

# 광역그룹 간 door-to-door 이동시간 추정치(분). 실제 교통편으로 반드시 재확인할 것.
GROUP_TRAVEL = {
    ("SEOUL", "SEOUL"): 60,
    ("SEOUL", "GYEONGGI"): 90,
    ("SEOUL", "INCHEON"): 100,
    ("SEOUL", "CHUNGCHEONG"): 150,
    ("SEOUL", "GANGWON"): 160,
    ("SEOUL", "YEONGNAM"): 250,
    ("SEOUL", "HONAM"): 240,
    ("SEOUL", "JEJU"): 300,
    ("GYEONGGI", "GYEONGGI"): 80,
    ("GYEONGGI", "INCHEON"): 90,
    ("GYEONGGI", "CHUNGCHEONG"): 140,
    ("GYEONGGI", "GANGWON"): 150,
    ("GYEONGGI", "YEONGNAM"): 260,
    ("GYEONGGI", "HONAM"): 250,
    ("INCHEON", "INCHEON"): 60,
    ("CHUNGCHEONG", "CHUNGCHEONG"): 80,
    ("YEONGNAM", "YEONGNAM"): 90,
    ("HONAM", "HONAM"): 90,
    ("GANGWON", "GANGWON"): 90,
}
SAME_ZONE_TRAVEL = 40      # 같은 권역 문자열이 완전히 동일할 때
UNKNOWN_TRAVEL = 120       # 그룹을 못 알아본 경우 보수적으로

KOR_DOW = "월화수목금토일"


def kdow(dt):
    return KOR_DOW[dt.weekday()]


def zone_group(zone: str) -> str:
    z = (zone or "").strip()
    for key, grp in ZONE_RULES:
        if key in z:
            return grp
    return "UNKNOWN"


def travel_minutes(a_zone: str, b_zone: str, overrides: dict) -> int:
    a, b = (a_zone or "").strip(), (b_zone or "").strip()
    key = tuple(sorted((a, b)))
    if key in overrides:
        return overrides[key]
    if a and a == b:
        return SAME_ZONE_TRAVEL
    ga, gb = zone_group(a), zone_group(b)
    if "UNKNOWN" in (ga, gb):
        return UNKNOWN_TRAVEL
    return GROUP_TRAVEL.get(tuple(sorted((ga, gb))), UNKNOWN_TRAVEL)


# ── 데이터 모델 ────────────────────────────────────────────────────────────
@dataclass
class Exam:
    id: str
    univ: str
    dept: str
    track: str
    start: datetime
    end: datetime
    site: str
    zone: str
    min_req: str        # 수능최저 유무 Y/N
    min_ok: str         # 충족 예상 Y/N/?
    pref: float         # 선호도 1~5
    memo: str = ""

    @property
    def day(self):
        return self.start.date()

    def label(self):
        return f"{self.univ} {self.dept}".strip()

    def when(self):
        return f"{self.start:%m/%d}({kdow(self.start)}) {self.start:%H:%M}~{self.end:%H:%M}"


def parse_hhmm(day: str, hhmm: str) -> datetime:
    hhmm = (hhmm or "").strip().replace("시", ":").replace("분", "")
    hhmm = hhmm.replace("：", ":")
    if ":" not in hhmm and hhmm.isdigit() and len(hhmm) == 4:
        hhmm = hhmm[:2] + ":" + hhmm[2:]
    return datetime.strptime(f"{day.strip()} {hhmm}", "%Y-%m-%d %H:%M")


def load_candidates(path: str, default_minutes: int):
    rows, errors = [], []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for i, r in enumerate(csv.DictReader(f), start=2):
            r = {(k or "").strip(): (v or "").strip() for k, v in r.items()}
            if not r.get("대학") or not r.get("날짜") or not r.get("시작"):
                continue
            try:
                start = parse_hhmm(r["날짜"], r["시작"])
                end = parse_hhmm(r["날짜"], r["종료"]) if r.get("종료") \
                    else start + timedelta(minutes=default_minutes)
            except ValueError as e:
                errors.append(f"  {i}행 {r.get('대학')}: 날짜/시간 형식 오류 ({e})")
                continue
            if end <= start:
                errors.append(f"  {i}행 {r.get('대학')}: 종료가 시작보다 빠름")
                continue
            try:
                pref = float(r.get("선호도") or 3)
            except ValueError:
                pref = 3.0
            rows.append(Exam(
                id=r.get("id") or f"C{i-1}",
                univ=r["대학"], dept=r.get("모집단위", ""), track=r.get("전형", ""),
                start=start, end=end,
                site=r.get("고사장", ""), zone=r.get("권역", ""),
                min_req=(r.get("수능최저") or "").upper(),
                min_ok=(r.get("최저충족") or "?").upper(),
                pref=pref, memo=r.get("메모", ""),
            ))
    return rows, errors


def load_travel_overrides(path):
    ov = {}
    if not path:
        return ov
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            a, b = (r.get("from") or "").strip(), (r.get("to") or "").strip()
            try:
                ov[tuple(sorted((a, b)))] = int(r.get("minutes") or 0)
            except ValueError:
                pass
    return ov


# ── 충돌 판정 ──────────────────────────────────────────────────────────────
@dataclass
class Conflict:
    a: Exam
    b: Exam
    kind: str           # "overlap" | "travel"
    detail: str
    need: int = 0
    have: int = 0


def pair_conflict(a: Exam, b: Exam, buffer_min: int, overrides: dict):
    """a, b 두 시험을 같이 볼 수 있는가. 불가하면 Conflict 반환."""
    if a.day != b.day:
        return None
    first, second = (a, b) if a.start <= b.start else (b, a)
    if second.start < first.end:
        return Conflict(first, second, "overlap",
                        f"시험 시간이 {int((first.end - second.start).total_seconds() // 60)}분 겹칩니다")
    gap = int((second.start - first.end).total_seconds() // 60)
    move = travel_minutes(first.zone, second.zone, overrides)
    need = move + buffer_min
    if gap < need:
        return Conflict(first, second, "travel",
                        f"여유 {gap}분 < 필요 {need}분(이동 {move}분 + 입실여유 {buffer_min}분)",
                        need=need, have=gap)
    return None


def pair_warning(a: Exam, b: Exam, overrides: dict):
    """충돌은 아니지만 알려줘야 할 것 (연속일 원거리 이동 등)."""
    if a.day == b.day:
        return None
    first, second = (a, b) if a.start <= b.start else (b, a)
    if (second.day - first.day).days != 1:
        return None
    move = travel_minutes(first.zone, second.zone, overrides)
    if move >= 150:
        return (f"{first.univ}({first.start:%m/%d}) → {second.univ}({second.start:%m/%d}) "
                f"연속일 장거리 이동 추정 {move}분 · 전날 숙박 검토")
    return None


def build_matrix(cands, buffer_min, overrides):
    n = len(cands)
    conflicts = {}
    ok = [[True] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            c = pair_conflict(cands[i], cands[j], buffer_min, overrides)
            if c:
                ok[i][j] = ok[j][i] = False
                conflicts[(i, j)] = c
    return ok, conflicts


# ── 조합 탐색 ──────────────────────────────────────────────────────────────
def search(cands, ok, slots, max_per_day, max_per_univ, overrides, top):
    n = len(cands)
    idx = sorted(range(n), key=lambda i: (-cands[i].pref, cands[i].start))
    results = []
    best_prefix = [0.0] * (n + 1)
    for k in range(n - 1, -1, -1):          # 남은 후보로 얻을 수 있는 선호도 상한
        best_prefix[k] = cands[idx[k]].pref + best_prefix[k + 1]

    def score_of(combo):
        return sum(cands[i].pref for i in combo)

    def dfs(pos, combo):
        if combo:
            results.append(tuple(combo))
        if len(combo) == slots or pos >= n:
            return
        for p in range(pos, n):
            i = idx[p]
            if any(not ok[i][j] for j in combo):
                continue
            if max_per_day:
                same_day = sum(1 for j in combo if cands[j].day == cands[i].day)
                if same_day >= max_per_day:
                    continue
            if max_per_univ:
                same_u = sum(1 for j in combo if cands[j].univ == cands[i].univ)
                if same_u >= max_per_univ:
                    continue
            combo.append(i)
            dfs(p + 1, combo)
            combo.pop()

    dfs(0, [])

    def rank_key(combo):
        same_day = sum(1 for a, b in itertools.combinations(combo, 2)
                       if cands[a].day == cands[b].day)
        move = sum(travel_minutes(cands[a].zone, cands[b].zone, overrides)
                   for a, b in itertools.combinations(combo, 2)
                   if cands[a].day == cands[b].day)
        return (-len(combo), -score_of(combo), same_day, move)

    seen, uniq = set(), []
    for c in sorted(results, key=rank_key):
        key = tuple(sorted(c))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(sorted(c, key=lambda i: cands[i].start))
        if len(uniq) >= top:
            break
    return uniq


# ── 출력 ──────────────────────────────────────────────────────────────────
def print_report(cands, excluded, ok, conflicts, combos, overrides, slots, buffer_min):
    print("=" * 68)
    print(f" 논술 시간표 충돌 분석 — 후보 {len(cands)}개 / 지원 슬롯 {slots}장 / 입실여유 {buffer_min}분")
    print("=" * 68)

    if excluded:
        print("\n[제외됨]")
        for e, why in excluded:
            print(f"  · {e.label()} ({e.when()}) — {why}")

    print("\n[후보 목록]")
    for i, e in enumerate(cands):
        flag = "" if e.min_ok != "?" or e.min_req != "Y" else "  ※최저 충족여부 미확인"
        print(f"  {i+1:2d}. {e.when()}  {e.label():<22} {e.track:<10} "
              f"{e.zone:<8} 선호{e.pref:g}{flag}")

    print("\n[충돌 쌍]")
    if not conflicts:
        print("  없음 — 모든 후보를 자유롭게 조합할 수 있습니다.")
    for (i, j), c in sorted(conflicts.items(), key=lambda kv: kv[1].a.start):
        mark = "✕겹침" if c.kind == "overlap" else "△이동"
        print(f"  {mark}  {c.a.label()} ({c.a.start:%m/%d %H:%M}~{c.a.end:%H:%M})"
              f"  ↔  {c.b.label()} ({c.b.start:%H:%M}~{c.b.end:%H:%M})")
        print(f"        {c.detail}")

    warns = []
    for a, b in itertools.combinations(cands, 2):
        w = pair_warning(a, b, overrides)
        if w:
            warns.append(w)
    if warns:
        print("\n[주의(충돌 아님)]")
        for w in sorted(set(warns)):
            print(f"  · {w}")

    print("\n" + "=" * 68)
    print(f" 추천 조합 Top {len(combos)}")
    print("=" * 68)
    for rank, combo in enumerate(combos, 1):
        total = sum(cands[i].pref for i in combo)
        print(f"\n── 조합 {rank} — {len(combo)}장 / 선호도 합 {total:g}")
        by_day = {}
        for i in combo:
            by_day.setdefault(cands[i].day, []).append(cands[i])
        for day in sorted(by_day):
            items = sorted(by_day[day], key=lambda e: e.start)
            print(f"   {day:%Y-%m-%d}({KOR_DOW[day.weekday()]})")
            prev = None
            for e in items:
                print(f"     {e.start:%H:%M}~{e.end:%H:%M}  {e.label()}  "
                      f"[{e.track}] {e.site or e.zone}")
                if prev:
                    gap = int((e.start - prev.end).total_seconds() // 60)
                    mv = travel_minutes(prev.zone, e.zone, overrides)
                    print(f"        ↳ 이동 여유 {gap}분 (추정 이동 {mv}분) — "
                          f"{'여유 있음' if gap - mv >= 60 else '빠듯함, 교통편 사전 예약'}")
                prev = e
        left = slots - len(combo)
        if left > 0:
            print(f"   · 남는 카드 {left}장 → 학생부/교과/실기 전형으로 채울 수 있습니다.")


def write_ics(cands, combo, path, buffer_min):
    def fmt(dt):
        return dt.strftime("%Y%m%dT%H%M%S")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//nonsul-timetable//KR",
             "CALSCALE:GREGORIAN"]
    for i in combo:
        e = cands[i]
        lines += [
            "BEGIN:VEVENT",
            f"UID:{e.id}-{fmt(e.start)}@nonsul",
            f"DTSTAMP:{fmt(datetime.now())}",
            f"DTSTART;TZID=Asia/Seoul:{fmt(e.start - timedelta(minutes=buffer_min))}",
            f"DTEND;TZID=Asia/Seoul:{fmt(e.end)}",
            f"SUMMARY:{e.univ} {e.dept} 논술",
            f"LOCATION:{e.site or e.zone}",
            f"DESCRIPTION:{e.track} / 입실 {buffer_min}분 전 도착 기준 / {e.memo}",
            "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY",
            f"DESCRIPTION:내일 {e.univ} 논술", "END:VALARM",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\r\n".join(lines))
    print(f"\n[ICS] {path} — 구글/애플 캘린더에 가져오기 하세요 (입실여유 {buffer_min}분 포함).")


def main():
    ap = argparse.ArgumentParser(description="논술 시간표 충돌 검사 + 6장 조합 탐색")
    ap.add_argument("csv", nargs="?", help="후보 CSV 경로")
    ap.add_argument("--sample", action="store_true", help="동봉 샘플 CSV로 실행")
    ap.add_argument("--slots", type=int, default=6, help="수시 지원 가능 횟수 (기본 6)")
    ap.add_argument("--buffer", type=int, default=40, help="입실 여유 분 (기본 40)")
    ap.add_argument("--duration", type=int, default=120, help="종료시간 미기재 시 시험시간 (기본 120분)")
    ap.add_argument("--max-per-day", type=int, default=2, help="하루 최대 응시 수 (기본 2, 0=무제한)")
    ap.add_argument("--max-per-univ", type=int, default=0, help="같은 대학 최대 지원 수 (0=무제한)")
    ap.add_argument("--top", type=int, default=3, help="추천 조합 개수")
    ap.add_argument("--travel", help="이동시간 override CSV (from,to,minutes)")
    ap.add_argument("--allow-miss", action="store_true", help="수능최저 미충족(N) 후보도 포함")
    ap.add_argument("--ics", help="1순위 조합을 .ics 파일로 저장")
    args = ap.parse_args()

    path = SAMPLE if args.sample else args.csv
    if not path:
        ap.error("CSV 경로를 주거나 --sample 을 쓰세요.")
    if not os.path.exists(path):
        sys.exit(f"파일을 찾을 수 없습니다: {path}")

    cands, errors = load_candidates(path, args.duration)
    if errors:
        print("[입력 오류 — 해당 행은 건너뜁니다]")
        print("\n".join(errors), "\n")
    if not cands:
        sys.exit("읽어들인 후보가 없습니다. 헤더와 날짜 형식(YYYY-MM-DD)을 확인하세요.")

    excluded = []
    if not args.allow_miss:
        keep = []
        for e in cands:
            if e.min_req == "Y" and e.min_ok == "N":
                excluded.append((e, "수능최저 미충족 예상 (--allow-miss 로 포함 가능)"))
            else:
                keep.append(e)
        cands = keep
    cands.sort(key=lambda e: e.start)

    overrides = load_travel_overrides(args.travel)
    ok, conflicts = build_matrix(cands, args.buffer, overrides)
    combos = search(cands, ok, args.slots, args.max_per_day or 0,
                    args.max_per_univ or 0, overrides, args.top)

    print_report(cands, excluded, ok, conflicts, combos, overrides, args.slots, args.buffer)

    if args.ics and combos:
        write_ics(cands, combos[0], args.ics, args.buffer)

    print("\n※ 이동시간은 권역 기반 추정치입니다. 최종 확정 전 실제 교통편으로 검증하고,")
    print("  시험일·입실시각은 각 대학 최종 모집요강/수험표로 반드시 재확인하세요.")


if __name__ == "__main__":
    main()
