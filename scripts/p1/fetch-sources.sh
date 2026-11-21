#!/usr/bin/env bash
# P1: download the official rule texts on node-services, hash them and extract their text.
# Runs inside a throwaway Debian container (network on, for apt and the downloads).
# The downloads are data only: nothing from them is executed. pdftotext and pdftoppm come from
# Debian's poppler-utils. Output: sources/<name>.{pdf,html}, .txt, SHA256SUMS, fetch.log.
set -uo pipefail
mkdir -p sources
cd sources
{
  echo "fetched_utc $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends curl ca-certificates poppler-utils >/dev/null
  dpkg-query -W curl poppler-utils
  get() {  # name url
    local n=$1 u=$2
    curl -sS -L --max-time 180 -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" -H "Accept: text/html,application/pdf,*/*" -o "$n" -w "$n http %{http_code} %{content_type} %{size_download} bytes %{url_effective}\n" "$u" || echo "$n FAILED $u"
  }
  get ng-nta2025-nass.pdf      https://nass.gov.ng/documents/download/11249
  get ng-pit-guidelines-2026.pdf https://www.jtb.gov.ng/assets/2026-pit-guidelines-TJG3n9-T.pdf
  get cn-govcn-6900595.html    https://www.gov.cn/zhengce/zhengceku/202308/content_6900595.htm
  get cn-no30-rate-table.pdf  https://www.gov.cn/zhengce/zhengceku/202308/P020230828633757032068.pdf
  get cn-govcn-6900701.html    https://www.gov.cn/zhengce/zhengceku/202308/content_6900701.htm
  get cn-govcn-6900234.html    https://www.gov.cn/zhengce/zhengceku/202308/content_6900234.htm
  for f in *.pdf; do
    file_type=$(head -c 5 "$f")
    echo "$f starts with: $file_type"
    pdfinfo "$f" 2>&1 | grep -E "Pages|Producer|Creator|Title" || true
    pdftotext -layout "$f" "${f%.pdf}.txt" 2>&1 | head -3
    echo "${f%.pdf}.txt $(wc -c < "${f%.pdf}.txt") bytes of text"
  done
  for f in *.html; do
    sed -e 's/<[^>]*>//g' -e 's/&nbsp;/ /g' "$f" | tr -s ' \t' ' ' | grep -v '^ *$' > "${f%.html}.txt"
    echo "$f title: $(grep -o '<title>[^<]*' "$f" | head -1)"
  done
  echo "--- Fourth Schedule hits (NASS):"
  grep -n -i -E "fourth schedule|first .?800,000|next .?2,200,000|25,000,000|50,000,000" ng-nta2025-nass.txt | head -40
  echo "--- No. 30 hits:"
  grep -l -E "2023年第30号|全年一次性奖金" cn-govcn-*.txt
} > fetch.log 2>&1
sha256sum * > SHA256SUMS 2>/dev/null
chown -R 1000:1000 . 2>/dev/null || true
cat fetch.log
