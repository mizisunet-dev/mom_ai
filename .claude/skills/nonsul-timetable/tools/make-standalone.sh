#!/usr/bin/env bash
# 이 스킬 폴더를 "독립 저장소로 올릴 수 있는 형태"로 복사한다.
#
#   bash tools/make-standalone.sh [내보낼_경로]
#
# 기본 내보내기 위치: ~/nonsul-timetable
# 결과 폴더의 내용을 그대로 새 GitHub 저장소의 루트에 올리면 된다.

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$HOME/nonsul-timetable}"

if [ -e "$DEST" ]; then
  echo "이미 있습니다: $DEST"
  echo "다른 경로를 주거나, 기존 폴더를 지우고 다시 실행하세요."
  exit 1
fi

mkdir -p "$DEST"
cp -R "$SRC/scripts"   "$DEST/"
cp -R "$SRC/templates" "$DEST/"
cp    "$SRC/README.md" "$SRC/SKILL.md" "$SRC/LICENSE" "$DEST/"
cp    "$SRC"/*.pdf     "$DEST/" 2>/dev/null || true
rm -rf "$DEST/scripts/__pycache__"

cat > "$DEST/.gitignore" <<'EOF'
__pycache__/
*.pyc
.DS_Store
*.ics
EOF

echo "완성: $DEST"
echo
echo "확인:"
echo "  cd \"$DEST\" && python3 scripts/solve.py --sample"
echo
echo "GitHub에 올리기:"
echo "  cd \"$DEST\""
echo "  git init -b main"
echo "  git add ."
echo "  git commit -m \"논술 시간표 첫 공개\""
echo "  git remote add origin https://github.com/<내계정>/nonsul-timetable.git"
echo "  git push -u origin main"
