# 把多張截圖拼成一張對照圖（省 token：看一張圖取代看很多張）
# 用法：python3 sheet.py out.png a.png b.png ... [--w 寬度上限，預設 1600] [--h 每張高度，預設 420]
import sys
from PIL import Image, ImageDraw
args = sys.argv[1:]; W, H = 1600, 420
if '--w' in args: i = args.index('--w'); W = int(args[i+1]); del args[i:i+2]
if '--h' in args: i = args.index('--h'); H = int(args[i+1]); del args[i:i+2]
out, files = args[0], args[1:]
ims = []
for f in files:
    im = Image.open(f).convert('RGB'); k = H / im.height
    ims.append((f.split('/')[-1].rsplit('.', 1)[0], im.resize((max(1, int(im.width * k)), H), Image.NEAREST)))
rows, row, x = [], [], 0
for name, im in ims:
    if row and x + im.width > W: rows.append(row); row, x = [], 0
    row.append((name, im)); x += im.width + 6
if row: rows.append(row)
LH = 14
sheet = Image.new('RGB', (min(W, max(sum(i.width + 6 for _, i in r) for r in rows)), len(rows) * (H + LH + 6)), (40, 40, 40))
d = ImageDraw.Draw(sheet); y = 0
for r in rows:
    x = 0
    for name, im in r:
        d.text((x + 2, y + 1), name, fill=(255, 220, 80)); sheet.paste(im, (x, y + LH)); x += im.width + 6
    y += H + LH + 6
sheet.save(out); print(out, sheet.size, len(ims), 'shots')
