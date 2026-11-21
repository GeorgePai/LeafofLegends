import asyncio, sys
from playwright.async_api import async_playwright
from PIL import Image
HEROES = sys.argv[1].split(',')
TIMES = [float(x) for x in (sys.argv[3] if len(sys.argv)>3 else "0.45,0.95,1.35,2.0").split(",")]
SETUP = """(i)=>{ G.Team.dev=true; G.UI.goTitle(); G.Intro.skip(); G.UI.start(1); const W=G.W, h=W.hero; G.Menus&&0;
  // 換英雄
  W.units=W.units.filter(u=>u!==h); W.hero=null; W.spawnHero(G.HEROES[i]); const H=W.hero; H.x=W.M.ww/2-120; H.y=W.M.wh/2; H.px=H.x; H.py=H.y;
  const all=[...H.skills,...H.pskills]; all.forEach(s=>s.lv=Math.max(1,s.lv||0)); H.mp=9999; H.sp=0;
  for(let k=0;k<8;k++){ const e=new G.Unit(W,'bear',1,H.x+150+(k%4)*22,H.y-30+Math.floor(k/4)*40,3,'creep'); e.px=e.x; e.py=e.y; e.hp=e.st.hp=99999; W.add(e); }
  W.units.forEach(u=>{ if(u.side===1&&u.kind==='creep'&&Math.hypot(u.x-H.x,u.y-H.y)>400) u.alive=false; });
  W.vis.fog.fill(0); G.Render.cam.follow=true; G.UI.paused=false;
  const t=W.units.find(u=>u.alive&&u.side===1&&u.kind==='creep'&&Math.hypot(u.x-H.x,u.y-H.y)<300);
  window._ultT=t; return H.skills.length; }"""
CAST = """()=>{ const W=G.W,H=W.hero,t=window._ultT, i=H.skills.length-1; if(H.hd.name==='necroleafy'){ for(let k=0;k<3;k++){const u=new G.Unit(W,'leafblower',0,H.x+20+k*10,H.y+12,1,'creep');u.px=u.x;u.py=u.y;u.summon=1;u.necro=1;W.add(u);} } H.skills[i].cd=0; return W.trySkill(i,{x:t.x,y:t.y,t}); }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
        ctx = await b.new_context(viewport={'width':844,'height':390}, device_scale_factor=1)
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(1200)
        rows=[]
        for hn in HEROES:
            idx = await pg.evaluate("n=>G.HEROES.findIndex(h=>h.name===n)", hn)
            await pg.evaluate(SETUP, idx); await pg.wait_for_timeout(700)
            r = await pg.evaluate(CAST); t0=0; frames=[]
            import time; st=time.time()
            for T in TIMES:
                d = T-(time.time()-st)
                if d>0: await pg.wait_for_timeout(int(d*1000))
                fn=f'/tmp/s/u_{hn}_{T}.png'; await pg.screenshot(path=fn); frames.append(fn)
            rows.append((hn, r, frames))
        await b.close()
        W,H=420,195
        sheet=Image.new('RGB',(W*len(TIMES), (H+14)*len(rows)),(20,20,20))
        from PIL import ImageDraw; d=ImageDraw.Draw(sheet)
        for ri,(hn,r,fr) in enumerate(rows):
            for ci,f in enumerate(fr):
                im=Image.open(f).convert('RGB').resize((W,H)); sheet.paste(im,(ci*W, ri*(H+14)+14))
            d.text((4, ri*(H+14)), f'{hn} {r}', fill=(255,220,80))
        sheet.save(sys.argv[2]); print('ok', errs[:3])
asyncio.run(main())
