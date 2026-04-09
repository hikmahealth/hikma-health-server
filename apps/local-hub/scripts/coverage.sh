#!/usr/bin/env bash
set -euo pipefail

MANIFEST="src-tauri/Cargo.toml"
BADGE_PATH="coverage-badge.svg"

# Run coverage and capture JSON summary
JSON=$(cargo llvm-cov nextest --manifest-path "$MANIFEST" --json 2>/dev/null)
PERCENT=$(echo "$JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
totals = data['data'][0]['totals']['lines']
pct = (totals['covered'] / totals['count'] * 100) if totals['count'] else 0
print(f'{pct:.1f}')
")

# Pick badge color based on coverage percentage
COLOR=$(python3 -c "
p = $PERCENT
if p >= 80: print('#4c1')
elif p >= 60: print('#a3c51c')
elif p >= 40: print('#dfb317')
else: print('#e05d44')
")

# Generate SVG badge
TEXT_WIDTH=62
PCT_TEXT="${PERCENT}%"
PCT_WIDTH=50
TOTAL_WIDTH=$((TEXT_WIDTH + PCT_WIDTH))

cat > "$BADGE_PATH" <<SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" width="${TOTAL_WIDTH}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${TOTAL_WIDTH}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${TEXT_WIDTH}" height="20" fill="#555"/>
    <rect x="${TEXT_WIDTH}" width="${PCT_WIDTH}" height="20" fill="${COLOR}"/>
    <rect width="${TOTAL_WIDTH}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="$((TEXT_WIDTH / 2))" y="15" fill="#010101" fill-opacity=".3">coverage</text>
    <text x="$((TEXT_WIDTH / 2))" y="14">coverage</text>
    <text x="$((TEXT_WIDTH + PCT_WIDTH / 2))" y="15" fill="#010101" fill-opacity=".3">${PCT_TEXT}</text>
    <text x="$((TEXT_WIDTH + PCT_WIDTH / 2))" y="14">${PCT_TEXT}</text>
  </g>
</svg>
SVGEOF

echo "Coverage: ${PERCENT}% → ${BADGE_PATH}"
