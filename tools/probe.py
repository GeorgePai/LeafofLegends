# 用法：python3 probe.py "JS 表達式" → 在 dist/index.html 裡執行並印出 JSON
import asyncio, sys, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(600)
        for js in sys.argv[1:]:
            r = await pg.evaluate(js); print(r if isinstance(r, str) else json.dumps(r, ensure_ascii=False))
        if errs: print('PAGEERR', errs)
        await b.close()
asyncio.run(main())
