#!/usr/bin/env bash
# 平行跑完整文字檢查，只輸出摘要（每個裝置幾筆＋前 15 筆內容）
# 用法：bash /home/claude/tools/tc_all.sh [裝置，預設 nmdL]
DEVS=${1:-nmdL}
cd /home/claude
python3 tools/tc_scenes.py
N=$(python3 -c "import json;print(len(json.load(open('/tmp/tc.json'))))")
for d in $(echo $DEVS | grep -o .); do python3 tools/textcheck.py /tmp/tc.json $d > /tmp/tc_$d.log 2>&1 & done
wait
TOTAL=0
for d in $(echo $DEVS | grep -o .); do
  C=$(grep -c . /tmp/tc_$d.log); TOTAL=$((TOTAL+C))
  echo "裝置 $d：$C 筆"; head -n 15 /tmp/tc_$d.log
done
echo "場景 $N 個，合計 $TOTAL 筆"
