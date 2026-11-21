import asyncio, sys, base64
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':900,'height':500})).new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(1200)
        url = await pg.evaluate("""(names)=>{ const S=3, T=[0.3,0.75,1.2,1.5,2.0,3.2], rows=[]; 
          for (const n of names) { const hd=G.HEROES.find(h=>h.name===n); const sid=hd.skills[hd.skills.length-1]; const sb=new G.Sandbox(); sb.mute=true; sb.size(200,110); sb.setup(n,0,sid); const fr=[]; let t=0;
            for (const tt of T) { while (t<tt) { sb.update(1/60); t+=1/60; } const c=document.createElement('canvas'); c.width=200; c.height=110; c.getContext('2d').drawImage(sb.draw(),0,0); fr.push(c); }
            rows.push([n+' '+G.skillName(sid)+' ult='+sb.isUlt(G.ORIG.skills[sid]), fr]); }
          const c=document.createElement('canvas'); c.width=T.length*204*S; c.height=rows.length*124*S; const x=c.getContext('2d'); x.imageSmoothingEnabled=false; x.fillStyle='#222'; x.fillRect(0,0,c.width,c.height); x.font='30px sans-serif'; x.fillStyle='#fd4';
          rows.forEach(([lab,fr],r)=>{ x.fillText(lab,4,r*124*S+30); fr.forEach((f,i)=>x.drawImage(f,i*204*S,(r*124+12)*S,200*S,110*S)); }); return c.toDataURL(); }""", sys.argv[2].split(','))
        open(sys.argv[1],'wb').write(base64.b64decode(url.split(',')[1])); print('ok', errs[:3])
        await b.close()
asyncio.run(main())
