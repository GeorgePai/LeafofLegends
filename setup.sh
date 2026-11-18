#!/usr/bin/env bash
# Leaf of Legends 一鍵接手（雲端 container 用）
# 用法：
#   git clone -q -b source --depth 1 https://github.com/GeorgePai/LeafofLegends /home/claude/leafwar
#   bash /home/claude/leafwar/setup.sh          # 安裝＋build＋和線上版比對（約 1～2 分鐘）
#   bash /home/claude/leafwar/setup.sh --check  # 另外跑完整文字檢查（約 4～5 分鐘）
set -e
cd /home/claude/leafwar
mkdir -p /home/claude/tools /tmp/s
cp tools/*.py tools/*.sh /home/claude/tools/ 2>/dev/null || true
python3 -c "import fontTools, brotli" 2>/dev/null || pip install -q fonttools brotli --break-system-packages 2>&1 | grep -v WARNING || true
python3 build.py | tail -1
VER=$(grep -o "'V[0-9][0-9.]*'" src/11_menus.js | head -1)
echo "原始碼版本：$VER"
# 和 GitHub Pages 上線版比對（字型那一行的壓縮編碼每次 build 可能不同，排除）
if git fetch -q --depth 1 origin main 2>/dev/null; then
  if diff -q <(git show FETCH_HEAD:index.html | grep -v '^window.G_FONT') <(grep -v '^window.G_FONT' dist/index.html) >/dev/null; then
    echo "比對：與線上版一致 ✔"
  else
    echo "比對：與線上版不同（原始碼有尚未部署的修改，或線上版較新）"
  fi
else
  echo "比對：無法取得 main 分支，略過"
fi
if [ "$1" = "--check" ]; then bash /home/claude/tools/tc_all.sh; fi
