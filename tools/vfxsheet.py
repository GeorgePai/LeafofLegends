import asyncio, sys, json
from playwright.async_api import async_playwright
# usage: vfxsheet.py "sid,sid,..." "t1,t2,..." out.png [unitName]
sids=sys.argv[1]; times=sys.argv[2]; out=sys.argv[3]; unit=sys.argv[4] if len(sys.argv)>4 else 'leafy'
JS="""(([sids,times,unit])=>{
 const W=170,H=78,S=3, ts=times.split(',').map(Number), ids=sids.split(',').map(x=>x==='b'?null:+x);
 const C=document.createElement('canvas'); C.width=W*S*ts.length+ (ts.length-1)*4; C.height=(H*S+16)*ids.length; const c=C.getContext('2d'); c.imageSmoothingEnabled=false; c.fillStyle='#000'; c.fillRect(0,0,C.width,C.height);
 G.Audio && (G.Audio.play=()=>{});
 ids.forEach((sid,r)=>{
   const sb=new G.Sandbox(); sb.size(W,H); const sd=sid!=null?G.ORIG.skills[sid]:null;
   let nm=unit; sb.setup(nm,0,sid); let t=0; const dt=1/60;
   ts.forEach((T,i)=>{ while(t<T){ sb.update(dt); t+=dt; } const img=sb.draw(); c.drawImage(img,0,0,W,H,i*(W*S+4),r*(H*S+16)+16,W*S,H*S); });
   c.fillStyle='#fff'; c.font='12px monospace'; c.fillText((sid??'basic')+' '+(sd?sd.name:''),4,r*(H*S+16)+12);
 });
 return C.toDataURL();
})"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(700)
        d=await pg.evaluate(JS,[sids,times,unit])
        import base64; open(out,'wb').write(base64.b64decode(d.split(',')[1]))
        print('errs',errs); await b.close()
asyncio.run(main())
