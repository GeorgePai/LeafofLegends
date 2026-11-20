# 自動檢查：每個畫面的文字有沒有超出螢幕、或超出它所在的框
import asyncio, json, sys
from playwright.async_api import async_playwright
INJ = r'''
(()=>{ if (window.__tc) return; window.__tc = 1;
 const R=G.Render, U=G.UI;
 const rec=()=>window.__rec;
 const ocn=G.cn; G.cn=(ctx,s,x,y,col,align=0,ol)=>{ const w=ocn(ctx,s,x,y,col,align,ol); if(ctx===R.uctx&&rec()&&String(s).trim()) { const x0=Math.round(x-w*align)-2; rec().t.push([String(s),x0+2,x0+w,Math.round(y), rec().b.length, rec().d||0, 11]); } return w; };
 const otx=G.text; G.text=function(ctx,s,x,y,col,sc=1,ol,align=0){ otx.apply(this,arguments); if(ctx===R.uctx&&rec()&&String(s).trim()){ const w=G.textW(String(s))*(sc||1); const x0=Math.round(x-w*align); rec().t.push([String(s),x0,x0+w,Math.round(y),rec().b.length, rec().d||0, 5*(sc||1)]); } };
 const obox=U.h.box; U.h.box=(c,x,y,w,h,...a)=>{ if(c===R.uctx&&rec()) rec().b.push([x,y,w,h]); return obox(c,x,y,w,h,...a); };
 const odim=U.h.dim; U.h.dim=(...a)=>{ if(rec()) rec().d=rec().b.length; return odim(...a); }; const olay=U.h.layer; U.h.layer=(...a)=>{ if(rec()) rec().d=rec().b.length; return olay&&olay(...a); };
 const od=U.draw.bind(U); U.draw=(dt)=>{ window.__rec={t:[],b:[]}; od(dt); window.__last=window.__rec; window.__rec=null; };
})()'''
ANA = r'''
(()=>{ const L=window.__last; if(!L) return ['no frame']; const R=G.Render, out=[];
 for (const [s,x0,x1,y,nb,df] of L.t) {
   if (x0 < -1 || x1 > R.uw + 1) { out.push('螢幕外 '+s+' ['+x0+','+x1+'] uw='+R.uw); continue; }
   // 找最後畫、且包住文字起點的框
   let box=null; for(let i=nb-1;i>=(df||0);i--){ const [bx,by,bw,bh]=L.b[i]; if(x0+3>=bx&&x0+3<=bx+bw&&y+5>=by&&y+5<=by+bh){ box=L.b[i]; break; } }
   if (box && (x1 > box[0]+box[2]+2 || x0 < box[0]-2)) out.push('超出框 '+s+' ['+x0+','+x1+'] 框['+box[0]+','+(box[0]+box[2])+']');
 }
 // 文字互相重疊（只比較最上層、沒有被全黑遮罩蓋住的文字）
 const T=L.t;
 for(let i=0;i<T.length;i++) for(let j=i+1;j<T.length;j++){ const a=T[i], b=T[j]; if((a[5]||0)!==(b[5]||0)) continue; if(a[0]===b[0]&&Math.abs(a[1]-b[1])<=8&&Math.abs(a[3]-b[3])<=8) continue;   // 同字串小位移＝陰影/描邊
   const [e,l]=a[4]<=b[4]?[a,b]:[b,a]; let hid=false; for(let k=e[4];k<l[4];k++){ const [bx,by,bw,bh]=L.b[k]; if(bx<=e[1]+1&&bx+bw>=e[2]-1&&by<=e[3]+1&&by+bh>=e[3]+e[6]-1){ hid=true; break; } } if(hid) continue;   // 先畫的字被後畫的框蓋住
   const ox=Math.min(a[2],b[2])-Math.max(a[1],b[1]), oy=Math.min(a[3]+a[6],b[3]+b[6])-Math.max(a[3],b[3]);
   if(ox>2&&oy>3) out.push('重疊 「'+a[0]+'」×「'+b[0]+'」 y'+a[3]+'/'+b[3]); }
 return out; })()'''
async def main():
    SC=json.load(open(sys.argv[1]))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        devs={'d':dict(viewport={'width':1280,'height':720}),'m':dict(viewport={'width':390,'height':844},device_scale_factor=3,has_touch=True,is_mobile=True),'n':dict(viewport={'width':360,'height':740},device_scale_factor=3,has_touch=True,is_mobile=True),'w':dict(viewport={'width':1288,'height':620},device_scale_factor=2),'u':dict(viewport={'width':2200,'height':900}),'t':dict(viewport={'width':1440,'height':1100}),'L':dict(viewport={'width':844,'height':390},device_scale_factor=3,has_touch=True,is_mobile=True)}
        for dv in sys.argv[2]:
            c=await b.new_context(**devs[dv]); pg=await c.new_page(); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('file:///home/claude/leafwar/dist/index.html'); await pg.wait_for_timeout(700)
            await pg.evaluate(INJ); await pg.evaluate('G.HD&&(G.HD.on=false)')   # v3.2.2 文字檢查不需要 HD-2D 後製（軟體繪圖很慢）
            for name,js,wait in SC:
                for part in js.split('||WAIT||'):
                    try: await pg.evaluate(part)
                    except Exception as e: print(dv,name,'JSERR',str(e)[:120])
                    await pg.wait_for_timeout(wait)
                r=await pg.evaluate(ANA)
                for line in sorted(set(r)): print(dv, name, line)
            if errs: print(dv,'PAGEERR',errs)
            await c.close()
        await b.close()
asyncio.run(main())
