# 用法：python3 animlab.py html out.gif [秒數]  — 動畫實驗場：固定鏡頭，兩邊少量小兵對打（待機、走路、轉身、受擊、倒下都會出現）
import asyncio, sys, io
from playwright.async_api import async_playwright
from PIL import Image
html, out = sys.argv[1], sys.argv[2]; secs = float(sys.argv[3]) if len(sys.argv) > 3 else 4
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width': 640, 'height': 360})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + html); await pg.wait_for_timeout(900)
        await pg.evaluate("""()=>{ Math.random=(()=>{let s=11;return()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};})(); G.UI.start(2); const W=G.W; W.waveT=[1e9,1e9]; W.jgs=[];
          for(let i=0;i<60*2;i++) W.update(1/60);
          W.units=W.units.filter(u=>u.static||u.kind==='holy'||u===W.hero);
          const o=W.towers[0].find(t=>t.tier===0), cx=W.M.ww/2, cy=W.M.wh/2, X=o.x+(cx-o.x)*0.45, Y=o.y+(cy-o.y)*0.45;
          const h=W.hero; h.st.hp=h.hp=1e6; h.x=X-70; h.y=Y+18; h.px=h.x; h.py=h.y;
          const mk=(n,s,dx,dy,lv)=>{const u=W.add(new G.Unit(W,n,s,X+dx,Y+dy,lv||1,'creep')); u.lane=0; u.spawnT=0; return u;};
          mk('leafblower',0,-40,-14); mk('seedshooter',0,-58,8); mk('muscleleafy',0,-30,22);
          mk('babybear',1,90,-10,3); mk('babybear',1,104,14,3); mk('bear',1,120,0,2);
          const R=G.Render; R.cam.follow=false; R.cam.x=X+20; R.cam.y=Y; R.cam.zoom=R.cam.zt=3; }""")
        frames = []; n = int(secs * 15)
        for i in range(n):
            frames.append(Image.open(io.BytesIO(await pg.screenshot())).convert('RGB')); await pg.wait_for_timeout(25)
        q = [f.quantize(128) for f in frames]
        q[0].save(out, save_all=True, append_images=q[1:], duration=66, loop=0)
        sel = frames[::max(1, n // 12)][:12]; W = Image.new('RGB', (640 * 4 // 2, 360 * 3 // 2))
        for k, f in enumerate(sel): W.paste(f.resize((320, 180)), ((k % 4) * 320, (k // 4) * 180))
        W.save(out.replace('.gif', '_sheet.png')); print('ok', len(frames), errs[:3]); await b.close()
asyncio.run(main())
