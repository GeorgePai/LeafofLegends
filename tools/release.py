# 發佈到 main（GitHub Pages）前執行：複製 dist/index.html，並由 release.json 產生 version.json
# 用法：python3 tools/release.py [main 分支的資料夾，預設 /home/claude/leafoflegends]
import json, re, shutil, sys
src = '/home/claude/leafwar'; dst = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/leafoflegends'
ver = re.search(r"G\.VERSION = '(V[0-9.]+)'", open(src + '/src/11_menus.js', encoding='utf-8').read()).group(1)
rel = json.load(open(src + '/release.json', encoding='utf-8'))
lst = rel['list'][:10]
if lst[0]['v'] != ver: sys.exit(f'release.json 最新一筆是 {lst[0]["v"]}，但遊戲版本是 {ver}：請先在 release.json 加上這版的更新內容')
shutil.copy(src + '/dist/index.html', dst + '/index.html')
json.dump({'v': ver, 'list': lst}, open(dst + '/version.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('已準備發佈', ver, '（index.html＋version.json）')
