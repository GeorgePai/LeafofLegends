#!/bin/bash
# 排行榜管理：bash admin.sh list（最近 200 位玩家）／bash admin.sh del 名字或ID
cd "$(dirname "$0")"; U=$(cat url.txt); K=$(cat admin_key.txt)
case "$1" in
  list) curl -s "$U/admin/list?key=$K" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.table(JSON.parse(s).map(p=>({id:p.id,name:p.name,games:p.games,wr:p.wr,kda:p.kda,dmg:p.dmg,keys:p.keys,ach:p.ach}))))' ;;
  del) curl -s -X POST "$U/admin/del" -H 'content-type: application/json' -d "{\"key\":\"$K\",\"id\":\"$2\",\"name\":\"$2\"}"; echo ;;
  *) echo "用法：bash admin.sh list ｜ bash admin.sh del 名字或ID" ;;
esac
