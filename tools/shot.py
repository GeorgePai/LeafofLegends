# usage: python3 shot.py '<json list of [name, dev, js, waitms]>'
import asyncio, json, sys
from playwright.async_api import async_playwright
SC=json.load(open(sys.argv[1]))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctxs={'d':dict(viewport={'width':1280,'height':720}),'m':dict(viewport={'width':390,'height':844},device_scale_factor=3,has_touch=True,is_mobile=True),'n':dict(viewport={'width':360,'height':740},device_scale_factor=3,has_touch=True,is_mobile=True),'w':dict(viewport={'width':1288,'height':620},device_scale_factor=2),'u':dict(viewport={'width':2200,'height':900}),'t':dict(viewport={'width':1440,'height':1100}),'L':dict(viewport={'width':844,'height':390},device_scale_factor=3,has_touch=True,is_mobile=True)}
        for name,dev,js,wait in SC:
            c=await b.new_context(**ctxs[dev]); pg=await c.new_page(); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(800)
            if js: 
                for part in js.split('||WAIT||'):
                    await pg.evaluate(part); await pg.wait_for_timeout(wait)
            else: await pg.wait_for_timeout(wait)
            await pg.screenshot(path=f'/tmp/s/{name}.png'); print(name,'errors:',errs)
            await c.close()
        await b.close()
asyncio.run(main())
