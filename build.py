#!/usr/bin/env python3
"""合併 src/*.js → dist/index.html；中文字型依實際用到的字自動子集化後內嵌"""
import pathlib, base64, io
from fontTools import subset
from fontTools.ttLib import TTFont
root = pathlib.Path(__file__).parent
srcs = sorted((root / "src").glob("*.js"))
js = "\n".join(f"// ===== {p.name} =====\n" + p.read_text(encoding="utf-8") for p in srcs)
chars = set(c for c in js if ord(c) > 0x2000) | set(chr(i) for i in range(0x20, 0x7f)) | set("０１２３４５６７８９？！：．／，。（）")
# 玩家自訂名稱：內嵌 Big5 常用字（約 5400 字），讓名字也用像素字顯示
for hi in range(0xA4, 0xC7):
    for lo in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
        try: chars.add(bytes([hi, lo]).decode("big5"))
        except Exception: pass
font = TTFont(root / "assets" / "Cubic_11_1.100_R.ttf")
opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = []
ss = subset.Subsetter(opts); ss.populate(text="".join(chars)); ss.subset(font)
buf = io.BytesIO(); font.flavor = "woff2"; font.save(buf)
b64 = base64.b64encode(buf.getvalue()).decode()
js = f"// 俐方體11號 Cubic 11（免費授權字型，子集 {len(chars)} 字）\nwindow.G_FONT = '{b64}';\n" + js.replace("const G = window.G = {};", "const G = window.G = {}; G.FONT_DATA = window.G_FONT;", 1)
html = (root / "shell.html").read_text(encoding="utf-8").replace("/*__SCRIPTS__*/", js)
out = root / "dist" / "index.html"; out.parent.mkdir(exist_ok=True); out.write_text(html, encoding="utf-8")
# 背景音樂：audio/*.mp3 → dist/audio/（已統一響度，見 HANDOFF）
import shutil
(root / "dist" / "audio").mkdir(exist_ok=True)
for f in sorted((root / "audio").glob("*.mp3")): shutil.copy2(f, root / "dist" / "audio" / f.name)
print(out, len(html), "font", len(buf.getvalue()), "bytes,", len(chars), "chars")
