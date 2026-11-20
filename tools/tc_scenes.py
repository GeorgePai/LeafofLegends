import json
F='localStorage.clear(); G.Team.v=null; G.Team.dev=false; G.Team.get();'
up=lambda i:f"G.UI.btns.find(b=>b.id==='{i}')&&G.UI.btns.find(b=>b.id==='{i}').up()"
S=[]
S.append(['menu',F+"G.UI.goTitle(); G.Menus.resetIntro&&G.Menus.resetIntro();",2500])
S.append(['settings',"G.Menus._set(true)",300]); S.append(['settings-x',"G.Menus._set(false)",100])
S.append(['devpad',"G.Menus.devAsk(true)",300]); S.append(['devpad-x',"G.Menus.devAsk(false)",100])   # v2.4 開發者密碼
S.append(['reset',up('rst'),300]); S.append(['reset-close',up('rsNo'),200])
# v1.7：開場動畫、首頁滾輪、問候、成就、存檔
S.append(['tap',"G.UI.screen='tap';G.Intro.tapT=2",150])
for t in (0.3, 1.2, 2.0, 3.0, 3.5, 4.4, 4.8): S.append([f'intro{t}',f"G.UI.screen='intro';G.Intro.t={t}",40])
S.append(['menu2',"G.Intro.skip();",1600])
for t in (0.3,0.5,0.62,0.9,1.6): S.append([f'logo{t}',f"G.Menus._mt({t})",30])
for k in range(10): S.append([f'menuwheel{k}',f"G.Menus.menuWheel.go({k})",450])
S.append(['greet',"G.Team.get().name='八個字的名字喔';G.SaveUI.greet={t:2.5,name:'八個字的名字喔'}",200])
S.append(['hi-wide',"G.SaveUI.greet=null;G.Team.get().name='WWWWWWWW'",200])   # v2.8.3 左上打招呼：最寬的名字
S.append(['welcome',"G.SaveUI.greet=null;G.SaveUI.welcome={t:1.5,name:'八個字的名字喔',parts:[]}",300])
S.append(['welcome-x',"G.SaveUI.welcome=null",100])
S.append(['backup-tip',"G.Team.get().bk={n:5,t:0};G.Menus._mt(3)",300]); S.append(['backup-x',"G.Team.get().bk={n:0,t:Date.now()}",100])
S.append(['ach-banner',"G.Ach.banner={a:G.ACH_BY.gamble5,t:1}",200])
S.append(['ach',"G.Ach.banner=null;var v=G.Team.get();G.Ach.P();v.p.games=7;v.p.kills=345;v.p.gold=12345;v.ach={games1:1,win1:2,comeback:1,gamble5:2,guide:1,hero5:1};G.Menus.ui.go('ach')",400])
for t in range(4): S.append([f'ach-tab{t}',up(f'tab{t}'),300])
S.append(['ach-claim',up('ac_games1'),700])

# v2.8 排行榜
S.append(['rank-none',"G.RANK_URL='https://x.invalid';G.Menus.ui.go('rank')",300])
S.append(['rank-mock',"G.Rank._mock();G.RankUI.cat(6)",300])
for i in range(9): S.append([f'rank-cat{i}',f"G.Rank._mock();G.RankUI.cat({i})",150])
S.append(['rank-dev',"G.Team.setDev(true);G.Rank._mock();G.Menus.ui.go('rank')",300])
S.append(['rank-adm-key',"G.RankUI.adm(true)",300])
S.append(['rank-adm-list',"localStorage.setItem('leafwar_adm','k');G.Rank.adm.t=Date.now()+9e9;G.Rank.adm.busy=0;G.Rank.adm.err='';G.Rank.adm.list=[{id:'a',name:'超級無敵大豌豆',hidden:0,games:120},{id:'b',name:'小派測試',hidden:1,games:3},{id:'c',name:'Leafy99',hidden:0,games:45}]",300])
S.append(['rank-adm-err',"G.Rank.adm.err='連不上伺服器'",200])
S.append(['rank-dev-off',"G.RankUI.adm(false);localStorage.removeItem('leafwar_adm');G.Team.setDev(false)",200])
S.append(['rank-ban',"G.Ach.queueBanner({rk:{s:'超級無敵大豌豆 登上遊玩時長第 1 名！',col:12},t:0.5})",200])
S.append(['rank-ban2',"G.Ach.banner=null;G.Ach.queueBanner({rk:{s:'3 項排行衝進前三名！',col:13},t:0.5})",200])
S.append(['rank-out',"G.Ach.banner=null;G.Ach.bq=[];G.Ach.P().rk=null;G.Rank.forget();G.Team.get().name='';G.Menus.ui.go('menu')",300])
# v2.8 開寶箱分級演出
for t,f in ((3.0,4),(5.2,4),(6.2,4),(7.4,4),(6.9,3),(4.6,2),(3.6,1),(4.2,5)): S.append([f'chest{f}-{t}',f"G.Team.addKeys(99);G.UI.screen='store';G.Store._open({0 if f==5 else 1},{t},{f})",120])
S.append(['chest-close',"G.Store.esc();G.Store.esc();G.Store.esc();G.Store.esc();G.UI.screen='menu'",200])
S.append(['ach-all',up('achAll'),800])
S.append(['save',"G.Menus.ui.go('save')",300])
S.append(['save-ios',"G.SaveUI.forceIos=true",200]); S.append(['save-ios-x',"G.SaveUI.forceIos=false",100])
S.append(['save-name',up('svMake'),300])
S.append(['save-name-typed',"G.Dom.el('name').value='八個字的名字喔'",100])
S.append(['save-name-empty',"G.Dom.el('name').value='';"+up('svNext'),200])
S.append(['save-code',"G.Dom.el('name').value='八個字的名字喔';"+up('svNext'),800])
S.append(['save-gift-x',"G.SaveUI.gift=null",200])   # v3.3 第一次建帳號會播送鑰匙動畫
S.append(['save-done',up('svDone'),200])
S.append(['save-load',up('svLoad'),300])
S.append(['save-load-bad',"G.Dom.el('load').value='abc';"+up('svRead'),400])
S.append(['save-load-code',"G.SaveCode.make().then(c=>{G.Dom.el('load').value=c;window.__c=c;})",300])
S.append(['save-confirm',up('svRead'),500])
S.append(['save-welcome',up('svYes'),900])
S.append(['save-welcome-x',"G.SaveUI.welcome=null",100])
# v2.8.4 帳號管理
S.append(['acct',"G.Menus.ui.go('save');G.SaveUI.go('acct')",300])
S.append(['kick',"G.Menus.ui.go('save');G.SaveUI.go('kick')",400]); S.append(['kick-x',"G.SaveUI.reset();G.Menus.ui.go('menu');G.UI.goMenu()",100])   # v2.8.7 被別台登入
S.append(['acct-out',"G.SaveUI.go('out')",700]); S.append(['acct-out-deny',"G.UI.btns.find(b=>b.id==='svOutGo')&&G.UI.btns.find(b=>b.id==='svOutGo').up()",200])
S.append(['acct-del',"G.SaveUI.go('del')",300]); S.append(['acct-del-ask',"G.UI.btns.find(b=>b.id==='svDelGo')&&G.UI.btns.find(b=>b.id==='svDelGo').up()",200])
S.append(['acct-x',"G.SaveUI.go('home')",100])
S.append(['store',F+"G.UI.screen='store'",400])
for i in range(3): S.append([f'store-info{i}',up(f'ci{i}'),300]); S.append(['close',"G.Store.esc()",150])
S.append(['open-gamble',up('co0'),3300]); S.append(['close',"G.Store.esc();G.Store.esc()",150])
S.append(['open-minion',up('co2'),3000]); S.append(['close',"G.Store.esc();G.Store.esc()",150])
S.append(['store-cd',"G.Team.get().fc=Date.now()-12000",300])
S.append(['store-free',"G.Team.get().fc=0",300])
S.append(['free-banner',"G.Ach.banner={free:true,t:0.5}",200]); S.append(['free-banner-x',"G.Ach.banner=null",100])
S.append(['dev-on',"G.Team.setDev(true)",100])
S.append(['team',"G.UI.screen='team'",500])
for k in range(12):
  S.append([f'team-h{k}',"G.Menus.carStep(1)",650])
  S.append([f'team-h{k}-demo',up('demo'),400])
  for j in range(5): S.append([f'team-h{k}-demo{j}',up(f'dm{j}'),350])
  S.append(['close',"G.UI.btns.find(b=>b.id==='dmX').up()",200])
S.append(['minion',up('tab1'),500])
for k in range(18): S.append([f'minion{k}',"G.Menus.carStep(1)",600])
S.append(['book',"G.UI.screen='book'",500])
for t in range(5):
  S.append([f'book-tab{t}',up(f'tab{t}'),500])
  for k in range(14 if t==1 else 4):
    S.append([f'book{t}-{k}',"G.Menus.carStep(1)",550])
    S.append([f'book{t}-{k}-demo',up('demo'),300])
    for j in range(3): S.append([f'book{t}-{k}-demo{j}',up(f'dm{j}'),300])
    S.append(['close',"G.UI.btns.find(b=>b.id==='dmX').up()",150])
S.append(['battle',"G.Team.setDev(false); G.UI.start(); G.W.gold=3000; ['hp','mp','spd','pow','move','eye','arm'].forEach(i=>G.W.buy(i)); G.W.useItem('spd');",800])
for k in range(6): S.append([f'bag{k}',f"G.UI.bagGo={k}",400])
S.append(['bag-collapsed',"G.UI.bagUse=-99",700]); S.append(['bag-open',"G.UI.bagUse=G.UI.t",400])
S.append(['tpask',"var h=G.W.hero;var tw=G.W.units.filter(u=>u.side===0&&u.kind==='tower').sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[1];G.UI.tpAsk={u:tw,t:G.UI.t};G.Render.cam.follow=false;G.Render.cam.x=tw.x;G.Render.cam.y=tw.y",300])
S.append(['tpask-x',"G.UI.tpAsk=null;G.Render.cam.follow=true",100])
S.append(['shop',"G.UI.shop=true; G.UI.shopSel='arm'",300]); S.append(['shop2',"G.UI.shopSel='eye'",300]); S.append(['shopx',"G.UI.shop=false",100])
S.append(['heropanel',"G.UI.heroPanel=true",300]); S.append(['hpx',"G.UI.heroPanel=false",100])
S.append(['skillcard',"const h=G.W.hero; G.UI.hold={id:'x',t:1,s:h.skills[0],fired:true,x:G.Render.uw-120,y:G.Render.uh-24,w:24};",300])
S.append(['buffcard',"G.UI.hold={id:'bf_i_spd',t:1,buff:'i_spd',fired:true,x:G.Render.ins.l,y:G.Render.ins.t+53};",300])
S.append(['pause',"G.UI.hold=null; G.UI.paused=true",300]); S.append(['unpause',"G.UI.paused=false",100])
S.append(['bigmap',"G.UI.bigMap=true",300]); S.append(['bigmapx',"G.UI.bigMap=false",100])
S.append(['statp',"G.W.stats.kills=12;G.W.stats.deaths=3;G.W.stats.assists=27;G.W.stats.dmg=123456;G.W.stats.gold=98765;G.UI.statP=true",300]); S.append(['statpx',"G.UI.statP=false",100])
S.append(['zoomout',"G.Render.setZoom(0.01)",400]); S.append(['zoomback',"G.Render.setZoom(1)",100])
for hi in range(12):
  S.append([f'card-h{hi}',f"G.UI.hold=null; G.UI.screen='battle'; if({hi}<G.HEROES.length) G.newWorld({{hero:{hi}}});",500])
  for sk in range(4):
    for lv in (0,1,3): S.append([f'card-h{hi}-s{sk}-lv{lv}',f"const h=G.W.hero, s=h.skills[{sk}]; if(s){{ s.lv={lv}; G.UI.hold={{id:'x',t:1,s,fired:true,x:G.Render.uw-120+{sk}*28,y:G.Render.uh-24,w:24}}; }}",150])
S.append(['cardx',"G.UI.hold=null",100])
S.append(['charge',"G.UI.hold=null; G.UI.screen='battle'; G.newWorld({hero:0}); var h=G.W.hero; h.skills.forEach(s=>s.lv=1); h.chg={sd:h.skills[0].s,t:null,lv:1,T:0.2,dur:0.5,el:'arcane',big:true};",200])
for hi in range(11):
  S.append([f'skup-h{hi}',f"G.UI.hold=null; G.UI.screen='battle'; G.newWorld({{hero:{hi}}}); var W=G.W,h=W.hero; h.level=12; var A=[...h.skills,...h.pskills]; A.forEach(s=>s.lv=1); h.sp=9; W.notices=[]; A.forEach(s=>W.levelSkill(s)); W.notices.forEach(n=>n.age=1);",400])
S.append(['end',"Object.assign(G.W.stats,{kills:134,deaths:0,assists:112,towers:16,camps:17,gold:123456,dmg:1234567,taken:234567,bosses:13,time:3812});G.W.keysGot=13;G.Ach.recent=['games1','win1','speed','tame','comeback','gamble5'];G.W.over={win:true,t:3}",3200])
S.append(['end-full',"G.UI.endT=9",400])
S.append(['end-lose',"G.UI.start();G.Ach.recent=[];G.W.over={win:false,t:3}",3200])
S.append(['end-lose-full',"G.UI.endT=9",400])
# v2.5 圖鑑藥水、解散跟隨鈕、英雄面板
S.append(['book-pot',"G.UI.screen='book';G.Menus._btab(5)",400]); S.append(['book-pot2',"G.Menus.scroll(400,G.Render.uw/2,G.Render.uh/2)",300]); S.append(['book-pot-x',"G.Menus._btab(0)",200])
S.append(['follow',"G.UI.start();var W=G.W,h=W.hero;for(var i=0;i<5;i++){var u=new G.Unit(W,'leafblower',0,h.x+10*i,h.y+20,1,'creep');W.units.push(u);W.toggleFollow(u);}",400])
S.append(['hpanel',"G.UI.toast=null;G.UI.heroPanel=true",300]); S.append(['hpanel-x',"G.UI.heroPanel=false",100])
# v2.4 技能瞄準＋取消區、被塔鎖定
S.append(['aim',"G.UI.start();var h=G.W.hero;h.skills.forEach(s=>s.lv=1);h.mp=999;G.UI.aim={i:2,s:h.skills[2],on:true,pre:false,bx:G.Render.uw-20,by:G.Render.uh-20,dx:-40,dy:-24,ux:G.Render.uw-60,uy:G.Render.uh-44};",400])
S.append(['aim-cancel',"var A=G.UI.aim,b=G.UI.cancelBtn;if(A&&b){A.ux=b.x;A.uy=b.y;G.UI.aimUpdate();}",200]); S.append(['aim-x',"G.UI.aim=null",100])
S.append(['guide',"G.UI.screen='guide'",300])
for k in range(52):   # v3.1 教學 5 類 51 頁
  S.append([f'guide{k}',"G.Menus.guideTurn(1)",120])
  S.append([f'guide{k}b',"G.Menus._gt(1.9)",60]); S.append([f'guide{k}c',"G.Menus._gt(3.0)",60])
# v2.6 寶箱新角色→前往隊伍、NEW、死靈召喚力夫戰鬥
S.append(['open-hero',F+"G.Team.get().keys=30;G.UI.screen='store';G.Store._open(1,3)",600])
S.append(['open-hero-go',up('opGo'),600])
S.append(['team-new-away',"G.Menus.carStep(1)",700])
S.append(['necro-battle',"G.UI.hold=null;G.UI.screen='battle';G.newWorld({hero:10});var W=G.W,h=W.hero;[...h.skills,...h.pskills].forEach(s=>s.lv=1);h.mp=999;for(var i=0;i<4;i++){var u=new G.Unit(W,'leafblower',0,h.x+20+i*8,h.y+10,1,'creep');u.lane=1;W.add(u);}W.trySkill(0);",1500])
S.append(['necro-clone',"var W=G.W;W.hero.mp=999;W.trySkill(2);",1500])
S.append(['necro-nobody',"G.newWorld({hero:10});var h=G.W.hero;[...h.skills,...h.pskills].forEach(s=>s.lv=1);h.mp=999;G.W.trySkill(1);",300])
# v2.8.4 圖鑑小按鈕資訊卡、排行跳至自己
S.append(['bk4-boss',"G.UI.screen='book';G.Menus._btab(0)",400]); S.append(['bk4-key',"G.Menus._binfo('key')",300])
S.append(['bk4-wild',"G.Menus._btab(3)",400]); S.append(['bk4-wkey',"G.Menus._binfo('key')",300]); S.append(['bk4-winfo',"G.Menus._binfo('info')",300])
S.append(['bk4-hunt',"G.Menus._btab(4)",400]); S.append(['bk4-hinfo',"G.Menus._binfo('info')",300]); S.append(['bk4-x',"G.Menus._binfo(null)",100])
S.append(['rank4-jump',"G.Rank._mock();G.UI.screen='rank';G.RankUI.cat(2);G.RankUI.jump()",900])
# v2.8.5 版本更新通知
S.append(['upd-menu',"G.Update._set('V9.9.9',[{v:'V9.9.9',d:'12/31',n:['新增版本更新通知：有新版本時，首頁右下角會出現「點擊更新」','八個字的名字喔八個字的名字喔八個字的名字喔']},{v:'V9.9.8',n:['a','b']}]);G.UI.goTitle();G.Intro.skip();G.Menus._mt(3)",1500])
S.append(['upd-card',"G.Update._open(true)",300])
S.append(['upd-card-long',"G.Update._set('V9.9.9',Array.from({length:12},(_, i)=>({v:'V9.9.'+(9-i),n:['更新內容第 '+i+' 項，說明文字比較長一點，測試換行']})))",300])
S.append(['upd-x',"G.Update._open(false);G.Update._set(null,[])",100])
# v2.8.6 反饋、關於、在線人數
FB="[{id:3,body:'排行榜可以加好友功能嗎？想跟朋友比一比，最好可以看到對方的隊伍和成就',t:1795100000,reply:'好主意！已經記下來了，下個版本試試看。謝謝你寫信來，有任何想法都歡迎再寫給我',rt:1795103600,seen:1},{id:2,body:'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',t:1795000000},{id:1,body:'第三關的 BOSS 好難打',t:1794000000}]"
S.append(['fb-none',"G.Team.setDev(false);G.Ach.P().rk=null;G.Team.get().name='';G.Menus.ui.go('fb')",300])
S.append(['fb-me',"G.Rank._mock();G.Team.get().name='八個字的名字喔';G.Menus.ui.go('fb');G.Rank.fb.t=Date.now()+9e9;G.Rank.fb.list="+FB,400])
S.append(['fb-msg',"G.FbUI._say('還有 5 封等待回覆，請等開發者回覆後再寫',10)",200])
S.append(['fb-empty',"G.Rank.fb.list=[]",200])
S.append(['fb-dev',"localStorage.setItem('leafwar_adm','12345678');G.Team.setDev(true);G.Menus.ui.go('fb');G.Rank.fbA.t=Date.now()+9e9;G.Rank.fbA.list="+FB.replace("{id:","{name:'八個字的名字喔',id:"),400])
S.append(['fb-dev-sel',"G.FbUI._sel(2)",300]); S.append(['fb-dev-x',"G.Team.setDev(false);G.Menus.ui.go('menu');G.UI.goMenu()",200])
S.append(['menu-online',"G.Rank.online.t=Date.now()+9e9;G.Rank.online.n=1234;G.Rank.fb.unread=3;G.Team.get().name='八個字的名字喔'",400])
for k in [3, 15, 30, 45, 60]: S.append([f'about-{k}',f"G.Menus.ui.go('about');G.About._skip({k},false)",250])
S.append(['about-end',"G.Menus.ui.go('about');G.About._end()",250]); S.append(['about-x',"G.Menus.ui.go('menu');G.UI.goMenu()",100])


# v3.0 單人關卡：選關（每張卡、鎖住、已通關）、各關戰鬥開場、結算星等
S.append(['stg-open',"G.Ach.P().stg={};G.Solo.open()",500])
for k in range(6): S.append([f'stg-card{k}',f"G.Solo._go({k})",400])
S.append(['stg-done',"G.Ach.P().stg={1:{c:3,s:3},2:{c:1,s:2},3:{c:1,s:1},4:{c:12,s:3},5:{c:1,s:1}};G.Solo._go(4)",400])
S.append(['stg-done2',"G.Solo._go(1)",300])
for k in range(1,6): S.append([f'stg-b{k}',f"G.UI.start({k})",900])
S.append(['stg-win',"G.W.kill(G.W.holy[1],G.W.hero)",9000])
S.append(['stg-x',"G.Ach.P().stg={};G.UI.goTitle()",300])

# v3.1 出發過場
for k,(ph,t) in enumerate([('close',0.2),('hold',0.5),('hold',1.6),('open',0.2)]): S.append([f'stgo{k}',f"G.Team.setDev(true);G.Solo.open();G.Solo._go(2);G.StageGo.go(3);G.StageGo._t('{ph}',{t})",80])
S.append(['stgo-x',"G.Team.setDev(false);G.UI.goTitle()",300])
# v3.2 信箱／公告／管理玩家動態
ML="[{id:3,t:1795150000,title:'伺服器維護補償',body:'昨晚維護辛苦了！附上 5 把鑰匙作為補償，祝大家遊戲愉快。\\n下次更新預告：新英雄即將登場。',keys:5,live:1,exp:1795750000},{id:2,t:1795050000,title:'V3.2 更新',body:'新增系統公告與信箱、角色立體感升級。',keys:0,live:1,exp:1795750000},{id:1,t:1794950000,title:'這是一個很長很長的公告標題',body:'測試',keys:10,live:0,exp:1795750000}]"
S.append(['mail-home',F+"G.Mail._set("+ML+");G.UI.goTitle();",1500])
S.append(['mail-list',"G.Menus.ui.go('mail');G.Mail._set("+ML+")",400])
S.append(['mail-det',"G.Mail._sel(3)",300]); S.append(['mail-det2',"G.Mail._sel(1)",300]); S.append(['mail-det-x',"G.Mail._sel(null)",100])
S.append(['mail-dev',"G.Team.setDev(true);localStorage.setItem('leafwar_adm','12345678');G.Mail._comp()",300]); S.append(['mail-dev-x',"G.Menus.ui.go('mail');G.Mail._set("+ML+");G.Mail._sel(3)",300])
S.append(['mail-cast',"G.Team.setDev(false);localStorage.removeItem('leafwar_adm');G.UI.goTitle();G.Mail._cast()",900])
S.append(['mail-cast-b',"G.UI.start(0);G.Mail._cast()",1500])
S.append(['mail-cast-x',"G.UI.goTitle()",4000])
AD="[{id:'a',name:'超級無敵大豌豆',hidden:0,games:120,wins:70,kills:900,deaths:300,assists:200,heroes:9,minions:20,keys:300,dmg:123456,time:36000,ach:40,kda:3.7,created:1794000000,updated:Date.now()/1000-30,pt:Date.now()/1000-20,st:JSON.stringify({s:'battle',g:3,b:205,l:9,h:'leafy',k:'5/1/2'}),v:G.VERSION,m:1,t0:Date.now()/1000-1500},{id:'b',name:'小派測試',hidden:1,games:3,wins:1,pt:Date.now()/1000-7200,st:JSON.stringify({s:'store'}),v:'V3.0',m:0,created:1794000000,updated:1794500000},{id:'c',name:'Leafy99',hidden:0,games:45,wins:20,created:1790000000,updated:1790000000}]"
S.append(['adm-dyn',"localStorage.setItem('leafwar_adm','k');G.Team.setDev(true);G.Menus.ui.go('rank');G.Rank.adm.t=Date.now()+9e9;G.Rank.adm.busy=0;G.Rank.adm.err='';G.Rank.adm.list="+AD+";G.RankUI.adm(true,1);G.Rank.adm.list="+AD,500])
S.append(['adm-det',"G.RankUI._det('a')",300]); S.append(['adm-det2',"G.RankUI._det('b')",300])
S.append(['adm-x',"G.RankUI._det(null);G.RankUI.adm(false);localStorage.removeItem('leafwar_adm');G.Team.setDev(false);G.UI.goTitle()",200])
# v3.2.4 戰場縮放鈕、三路欄位固定高度、更新內容卡（捲動）、更新通知條
S.append(['zoom-btn',"G.UI.start(0);G.W.followCount=()=>3;G.W.tp={cd:20};G.W.bag=G.SHOP.slice(0,4).map(d=>({id:d.id,n:2}))",600])
S.append(['zoom-x',"G.W.followCount=()=>0;G.W.tp=null;G.W.bag=[];G.UI.goTitle()",200])
S.append(['lane-full',"G.Team.setDev(true);const T=G.Team.get();T._bk=JSON.stringify(T.loadout);T.loadout=['leafblower','leafblower','leafblower','seedshooter','seedshooter','treeprotector','potatoblower','stemskewer','peasniper'].map(n=>({n,l:1}));G.Menus.focusTeam('leafblower')",500])
S.append(['lane-x',"const T=G.Team.get();T.loadout=JSON.parse(T._bk);delete T._bk;G.Team.save();G.Team.setDev(false);G.UI.goTitle()",200])
LONG="[{v:'V9.9.2',d:'12/2',n:['這是一條很長的更新說明，用來測試資訊卡在內容很多的時候會不會被裁切或顯示不完整','第二條','第三條比較長一點點的說明文字']},{v:'V9.9.1',d:'12/1',n:['這是一條很長的更新說明，用來測試資訊卡在內容很多的時候會不會被裁切或顯示不完整','第二條']}]"
S.append(['upd2-card',"G.UI.goTitle();G.Update._set('V9.9.2',"+LONG+");G.Update._show('new')",400])
S.append(['upd2-card2',"G.Update._sc(9999)",300])
S.append(['upd-done',"G.Update._show('done','V3.1')",400])
S.append(['upd-x',"G.Update._open(false);G.Update._set(null,[]);G.Ach.queueBanner({upd:'V3.2.2',t:0})",500])
S.append(['upd-bn-x',"G.Ach.banner=null",200])
# v3.3 建帳號送鑰匙
S.append(['gift-pop',"localStorage.clear();G.Team.v=null;G.Team.dev=false;G.UI.goTitle();G.Intro.skip();G.Menus._mt(3)",900])
S.append(['gift-bar',"G.Ach.P().giftAsk=1;G.Menus._mt(3)",500])
S.append(['gift-store',"G.Menus.ui.go('store')",500])
S.append(['gift-anim',"G.Menus.ui.go('save');G.SaveUI.gift={t:3,k:0,ps:[],pop:0}",500])
S.append(['gift-x',"G.SaveUI.gift=null;G.Team.setDev(false);G.UI.goTitle();G.Intro.skip()",300])
# v3.4 管理玩家：未存檔訪客＋幀數
S.append(['adm-guest',"localStorage.setItem('leafwar_adm','k');G.Team.setDev(true);G.Menus.ui.go('rank');G.Rank.adm.t=Date.now()+9e9;G.Rank.adm.busy=0;G.Rank.adm.err='';G.Rank.adm.list="+AD+";G.Rank.adm.guests=[{g:1,id:'g1a2b3c4d',name:'訪客 1A2B',pt:Date.now()/1000-15,t0:Date.now()/1000-900,st:JSON.stringify({s:'battle',g:4,b:312,l:11,h:'leafy',k:'12/3/4',f:57,fl:41,q:85,ss:2}),v:G.VERSION,m:1},{g:1,id:'g9f8e7d6c',name:'訪客 9F8E',pt:Date.now()/1000-600,t0:Date.now()/1000-1500,st:JSON.stringify({s:'stages'}),v:'V3.2.5',m:0},{g:1,id:'g00ff00ff',name:'訪客 00FF',pt:Date.now()/1000-40,st:'',v:G.VERSION,m:1}];G.RankUI.adm(true,1);G.Rank.adm.list="+AD,500])
S.append(['adm-gdet',"G.RankUI._det('g1a2b3c4d')",300]); S.append(['adm-gdet2',"G.RankUI._det('g00ff00ff')",300])
S.append(['adm-gx',"G.RankUI._det(null);G.RankUI.adm(false);G.Rank.adm.guests=[];localStorage.removeItem('leafwar_adm');G.Team.setDev(false);G.UI.goTitle()",200])
# v3.4 新關卡解鎖動畫、結算畫面解鎖提示
UL="localStorage.clear();G.Team.v=null;G.Team.dev=false;G.UI.goTitle();G.Intro.skip();var P=G.Ach.P();P.stg={1:{c:1,s:3},2:{c:1,s:2},3:{c:1,s:1}};P.stgU=3;G.Solo.open();"
S.append(['ul-shake',UL,1300]); S.append(['ul-title',UL,2300])
S.append(['ul-end',"localStorage.clear();G.Team.v=null;G.Team.dev=false;G.UI.goTitle();G.Intro.skip();G.UI.start(4);G.W.stats.time=300;G.W.soloRes={win:true,stars:3,rew:40,first:true,si:4,unlock:5};G.Ach.recent=['win1','games1'];G.W.over={win:true,t:3};setTimeout(()=>{G.UI.endT=9},3000)",3800])
S.append(['ul-x',"G.UI.goTitle()",200])
json.dump(S,open('/tmp/tc.json','w'))
