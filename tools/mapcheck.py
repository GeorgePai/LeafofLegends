import asyncio, json, base64
from playwright.async_api import async_playwright
JS = r"""(async()=>{
 const sd=(px,py,s)=>{const dx=s[2]-s[0],dy=s[3]-s[1],L=dx*dx+dy*dy;let t=L?((px-s[0])*dx+(py-s[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-s[0]-dx*t,py-s[1]-dy*t)};
 const segs=pts=>pts.slice(1).map((p,i)=>[pts[i][0],pts[i][1],p[0],p[1]]); const dmin=(p,ss)=>Math.min(...ss.map(s=>sd(p[0],p[1],s)));
 const out={};
 for (const k of ['l1','l2','l3','l4','l5']) { const md=G.MAPS[k], L=segs(md.lanes[0].pts), RV=segs(md.river.pts), r=md.lanes[0].r, C=[36,27];
   const rep={len:+(md.lanes[0].pts.slice(1).reduce((a,p,i)=>a+Math.hypot(p[0]-md.lanes[0].pts[i][0],p[1]-md.lanes[0].pts[i][1]),0)).toFixed(1), issues:[]};
   md.wild.forEach(([kk,p])=>{ const big=kk==='frost'||kk==='blaze', pr=big?3.9:3.1; const dl=dmin(p,L)-r-pr, dr=dmin(p,RV)-2.4-pr, db=Math.min(p[0],p[1],72-p[0],54-p[1])-pr;
     if(dl<1.5) rep.issues.push(kk+' 離路太近 '+dl.toFixed(1)); if(!big && dr<0.5) rep.issues.push(kk+' 泡在河裡 '+dr.toFixed(1)); if(db<1.5) rep.issues.push(kk+' 貼邊 '+db.toFixed(1)); });
   for(let i=0;i<md.wild.length;i++) for(let j=i+1;j<md.wild.length;j++){ const a=md.wild[i],b=md.wild[j], ra=a[0].length>4?3.9:3.1, rb=b[0].length>4?3.9:3.1, d=Math.hypot(a[1][0]-b[1][0],a[1][1]-b[1][1])-ra-rb; if(d<2) rep.issues.push(a[0]+'-'+b[0]+' 太擠 '+d.toFixed(1)); }
   // 河離路（中心 ±10 以外）
   md.river.pts.forEach(p=>{ if(Math.hypot(p[0]-C[0],p[1]-C[1])>12){ const d=dmin(p,L)-r-2.4; if(d<2) rep.issues.push('河又碰到路 '+p+' '+d.toFixed(1)); }});
   // 路自己太近（不相鄰的段）
   const P=md.lanes[0].pts; for(let i=0;i<P.length;i++) for(let j=i+12;j<P.length;j++){ const d=Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1]); if(d<2*r+3){ rep.issues.push('路自己靠太近 '+i+','+j+' '+d.toFixed(1)); i=P.length; break; } }
   P.forEach(p=>{ const b=Math.min(p[0],p[1],72-p[0],54-p[1]); if(b<r+1) { rep.issues.push('路貼邊 '+p); } });
   const tw=md.towers3.player.map(t=>t[0]); rep.outerGap=+Math.hypot(tw[2][0]-md.towers3.enemy[2][0][0],tw[2][1]-md.towers3.enemy[2][0][1]).toFixed(1);
   rep.issues=[...new Set(rep.issues)].slice(0,8);
   // 預覽圖
   const M=G.buildMap(md), gr=G.renderGround(M), mm=gr.mini, cv=document.createElement('canvas'); cv.width=mm.width*4; cv.height=mm.height*4; const c=cv.getContext('2d'); c.imageSmoothingEnabled=false; c.drawImage(mm,0,0,cv.width,cv.height);
   const sx=cv.width/72, sy=cv.height/54, dot=(p,col,s)=>{c.fillStyle='#000';c.fillRect(p[0]*sx-s-1,p[1]*sy-s-1,2*s+2,2*s+2);c.fillStyle=col;c.fillRect(p[0]*sx-s,p[1]*sy-s,2*s,2*s)};
   md.towers3.player.forEach(t=>dot(t[0],'#4af',t[2]===9?6:4)); md.towers3.enemy.forEach(t=>dot(t[0],'#f44',t[2]===9?6:4)); dot(md.holy.player,'#4af',9); dot(md.holy.enemy,'#f44',9);
   md.wild.forEach(([kk,p])=>dot(p,{red:'#f80',blue:'#0cf',exp:'#ff0',frost:'#fff',blaze:'#f0f'}[kk],kk.length>4?7:4));
   // 塔射程
   c.strokeStyle='rgba(255,255,255,0.35)'; [...md.towers3.player,...md.towers3.enemy].forEach(t=>{c.beginPath();c.ellipse(t[0][0]*sx,t[0][1]*sy,190/32*sx,190/32*sy,0,0,6.3);c.stroke();});
   rep.png=cv.toDataURL(); out[k]=rep; }
 return out; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(); await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(800)
        r = await pg.evaluate(JS)
        for k, v in r.items():
            open(f'/tmp/s/map_{k}.png','wb').write(base64.b64decode(v.pop('png').split(',')[1])); print(k, json.dumps(v, ensure_ascii=False))
        await b.close()
asyncio.run(main())
