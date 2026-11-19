#!/bin/bash
# Leaf of Legends 排行榜：一鍵部署／更新（可以重複執行）
# （2026-11-19 起：source 分支一有推送，Cloudflare 會自動部署 leaderboard/，平常不用跑這支）
# 第一次會開瀏覽器請你登入 Cloudflare 並按「Allow」；問要不要註冊 workers.dev 子網域時，輸入一個英文名字即可
set -e
cd "$(dirname "$0")"
command -v npx >/dev/null || { echo "❌ 需要先安裝 Node.js：到 https://nodejs.org 下載 LTS 版，裝好後再執行一次"; exit 1; }
W="npx -y wrangler@4"
if $W whoami 2>&1 | grep -qi "not authenticated"; then echo "▶ 登入 Cloudflare（瀏覽器會打開）"; $W login; fi
if ! $W d1 list --json 2>/dev/null | grep -q '"lol-rank"'; then echo "▶ 建立資料庫"; $W d1 create lol-rank; fi
ID=$($W d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s.slice(s.indexOf("[")));console.log(a.find(x=>x.name==="lol-rank").uuid)})')
sed -i '' "s/^database_id = .*/database_id = \"$ID\"/" wrangler.toml
echo "▶ 建立資料表"; $W d1 execute lol-rank --remote --file=schema.sql -y >/dev/null
$W d1 execute lol-rank --remote --command "ALTER TABLE players ADD COLUMN hidden INTEGER DEFAULT 0" -y >/dev/null 2>&1 || true   # v2.8.1 新欄位（已經有就略過）
echo "▶ 部署（第一次會問要不要註冊 workers.dev 子網域：按 Enter 選 Yes，再輸入一個英文名字）"; $W deploy
$W deploy > deploy.log 2>&1 || { cat deploy.log; exit 1; }
[ -f admin_key.txt ] || openssl rand -hex 16 > admin_key.txt
echo "▶ 設定管理密鑰"; tr -d "\n" < admin_key.txt | $W secret put ADMIN_KEY >/dev/null
grep -o 'https://[a-zA-Z0-9.-]*workers\.dev' deploy.log | head -1 > url.txt
echo; echo "✅ 完成：$(cat url.txt)"; echo "回到 Claude 說「部署好了」就可以"
