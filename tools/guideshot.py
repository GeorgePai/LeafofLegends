import asyncio, sys
from playwright.async_api import async_playwright
dev=sys.argv[1]; pages=[int(v) for v in sys.argv[2].split(',')]; times=[float(v) for v in sys.argv[3].split(',')]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        kw={'m':dict(viewport={'width':390,'height':844},device_scale_factor=3,has_touch=True,is_mobile=True),'w':dict(viewport={'width':1288,'height':620},device_scale_factor=2)}.get(dev,dict(viewport={'width':1280,'height':720}))
        c=await b.new_context(**kw); pg=await c.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(800)
        await pg.evaluate('G.Menus.openGuide(false)'); await pg.wait_for_timeout(200)
        cur=0
        for pi in pages:
            while cur<pi: await pg.evaluate('G.Menus.guideTurn(1)'); cur+=1
            for j,tm in enumerate(times):
                await pg.evaluate(f'G.Menus._gt && G.Menus._gt({tm})')
                await pg.wait_for_timeout(60)
                await pg.screenshot(path=f'/tmp/s/q{dev}{pi}_{j}.png')
        print(errs); await b.close()
asyncio.run(main())
