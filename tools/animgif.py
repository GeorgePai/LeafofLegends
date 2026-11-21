# 用法：python3 animgif.py html out.gif [秒數] [縮放]  — 戰場近景動圖（快轉到兩邊交戰，鏡頭對準交戰點）
import asyncio, sys, io
from playwright.async_api import async_playwright
from PIL import Image
html, out = sys.argv[1], sys.argv[2]; secs = float(sys.argv[3]) if len(sys.argv) > 3 else 3; zoom = float(sys.argv[4]) if len(sys.argv) > 4 else 2.2
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width': 640, 'height': 360})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + html); await pg.wait_for_timeout(900)
        await pg.evaluate("""()=>{ Math.random=(()=>{let s=7;return()=>{s=(s*16807)%%2147483647;return (s-1)/2147483646;};})(); G.UI.start(2); const W=G.W; for(let i=0;i<60*26;i++) W.update(1/60);
          const e=W.units.filter(u=>u.alive&&u.side===1&&u.kind==='creep').sort((a,b)=>a.x-b.x)[0]; const h=W.hero; h.st.hp=h.hp=1e6; h.st.power*=4; h.x=e.x-110; h.y=e.y+10; W.cmdMove&&W.cmdMove(e.x+60,e.y);
          G.Render.cam.follow=false; G.Render.cam.x=e.x-30; G.Render.cam.y=e.y; G.Render.cam.zoom=G.Render.cam.zt=%f; }""" % zoom)
        frames = []; n = int(secs * 15)
        for i in range(n):
            frames.append(Image.open(io.BytesIO(await pg.screenshot())).convert('RGB').quantize(128)); await pg.wait_for_timeout(30)
        frames[0].save(out, save_all=True, append_images=frames[1:], duration=66, loop=0)
        print('ok', len(frames), errs[:3]); await b.close()
asyncio.run(main())
