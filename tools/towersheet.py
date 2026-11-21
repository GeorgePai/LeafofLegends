import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':900,'height':500})).new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(1200)
        url = await pg.evaluate("""()=>{ const ks=['tw_e0','tw_e1','tw_e2','tw_em','tw_p0','tw_p1','tw_p2','tw_pm'].filter(k=>G.SPR[k]); const S=4, c=document.createElement('canvas'); c.width=ks.length*70*S; c.height=96*S; const x=c.getContext('2d'); x.fillStyle='#6f9a55'; x.fillRect(0,0,c.width,c.height); x.imageSmoothingEnabled=false;
          ks.forEach((k,i)=>{ const s=G.SPR[k][0]; const img=G.bevelOf? G.bevelOf(s.n):s.n; x.drawImage(img, i*70*S+ (70-s.w)/2*S, (94-s.h)*S, s.w*S, s.h*S); }); return c.toDataURL(); }""")
        import base64; open(sys.argv[1],'wb').write(base64.b64decode(url.split(',')[1])); print('ok', errs[:3])
        await b.close()
asyncio.run(main())
