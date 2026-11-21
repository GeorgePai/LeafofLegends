// ============================================================
// v2.8 線上排行榜（伺服器：Cloudflare Worker＋D1，程式在 leaderboard/）
// 規則一句話：存過檔取了名字就一定在排行榜上（v2.8.4 取消退出），排行榜畫面每 10 秒刷新，進前三名就廣播
// - 身分：P.rk = { id, tok }（放在成就檔案裡，所以會跟著存檔碼走，換手機也是同一個人）
// - 上傳：存檔、每場戰鬥結束、開遊戲時；v2.8.3 起數據有變（開箱、領成就…）也自動上傳；同一人 30 秒最多 1 次（伺服器也會擋）
// - 刷新：v2.8.3 開著排行榜畫面每 10 秒、其他選單畫面每 30 秒（順便收全服「登上第 1 名」消息）；戰鬥中、背景不連線
// - DEV 模式不上傳
// - v2.8.7 一帳號同時一台：這台的工作階段 ss 只存在本機（leafwar_rk_ss，不進存檔碼）；讀存檔碼／更新到新版時 /claim 換成這台，
//   另一台下次連線（/ping 每 60 秒或任何上傳）收到 moved → 帳號畫面「此帳號已在其他裝置登入」→ 登出
// ============================================================
G.RANK_URL = 'https://lol-rank.leafoflegends.workers.dev';                    // 部署後填入 https://lol-rank.<子網域>.workers.dev
G.RANK_GAP = 30;                      // 上傳間隔＆一般刷新間隔（秒）
G.RANK_GHOST = 30;                    // v2.8.4 幾天沒上線算「幽靈帳號」（管理玩家用）
G.RANK_FAST = 10;                     // v2.8.3 開著排行榜畫面時的刷新間隔（秒）
G.RANK_CATS = [                       // [欄位, 短名（分類格）, 全名, 單位]（v3.6 新增星數／速通／本週／擊殺／連勝／獵人；拿掉場數、時長）
  ['stars', '星數', '關卡星數', '顆'], ['spd', '速通', '深淵速通', ''], ['wk', '本週', '本週勝場', '場'],
  ['bk', '擊殺', '單場最高擊殺', '隻'], ['wst', '連勝', '最長連勝', '場'], ['hunt', '獵人', '首領獵人', '隻'],
  ['kda', 'KDA', 'KDA', ''], ['wr', '勝率', '勝率', ''], ['heroes', '英雄', '英雄收集', '位'], ['minions', '小兵', '小兵收集', '隻'],
  ['keys', '鑰匙', '累積鑰匙', '把'], ['dmg', '傷害', '總傷害', ''], ['ach', '成就', '成就數', '個']
];
// 還沒上榜時的提示（底部第二行）、清單是空的時候
G.RANK_HOW = { spd: '通關深淵就能上榜', wk: '本週贏一場就上榜', bk: '打完一場就能上榜', wst: '贏一場就能上榜', stars: '拿到星星就能上榜', hunt: '擊倒首領或獵手就上榜' };
G.RANK_NONE = { spd: '還沒有人通關深淵，快來搶第一！', wk: '這週還沒有人獲勝，快來搶第一！（每週一重置）' };
// 週次：台灣時間每週一 0 點換週（和伺服器同一個公式）
G.weekId = (t = Date.now()) => Math.floor((Math.floor((t / 1000 + 8 * 3600) / 86400) + 3) / 7);
G.RANK_MIN = { wr: 10, kda: 3 };       // v3.5 上榜最少場數（KDA 10→3 場；勝率維持 10 場）
G.Rank = (() => {
  const K = {}, CN = Object.fromEntries(G.RANK_CATS.map(c => [c[0], c[2]]));
  let board = null, boardT = 0, lastPoll = -1e12, lastSub = -1e12, busy = 0, pend = true, state = 'idle', ranks = null, sig = '', sigT = 0;
  const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem('leafwar_rk_' + k)); localStorage.setItem('leafwar_rk_' + k, JSON.stringify(v)); } catch (e) { return null; } };
  const hex = n => { const a = new Uint8Array(n / 2); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
  const P = () => G.Ach.P();
  K.on = () => !!G.RANK_URL;
  K.me = () => { const r = P().rk; return r && r.id ? r : null; };
  K.name = () => String(G.Team.get().name || '').trim();
  K.joined = () => !!(K.me() && K.name());
  K.state = () => state;
  K.board = () => board;
  K.age = () => board ? Math.max(0, Math.round((Date.now() - boardT) / 1000)) : -1;
  K.next = () => busy ? 0 : Math.max(0, Math.ceil((lastPoll + (G.UI.screen === 'rank' ? G.RANK_FAST : G.RANK_GAP) * 1000 - Date.now()) / 1000));   // v2.8.3 距離下次刷新幾秒（倒數）
  K.ranks = () => ranks || ls('ranks') || {};
  K.ss = () => ls('ss') || '';                                                 // v2.8.7 這台的工作階段
  K.moved = false;                                                             // v2.8.7 被別台登入了（等離開戰鬥再處理）
  const isMoved = j => { if (j && (j.err === 'moved' || j.moved)) { K.moved = true; return true; } return false; };
  K.fmt = (k, v) => {
    v = +v || 0;
    if (k === 'wr') return v.toFixed(1) + '%';
    if (k === 'kda') return v.toFixed(2);
    if (k === 'spd') return v ? Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0') : '-';   // v3.6 速通：分:秒
    if (k === 'time') { const m = Math.floor(v / 60); return m >= 60 ? Math.floor(m / 60) + '時' + (m % 60) + '分' : m + '分'; }
    if (k === 'dmg') return v >= 1e4 ? (v / 1e4).toFixed(v >= 1e6 ? 0 : 1) + '萬' : String(Math.round(v));
    const u = (G.RANK_CATS.find(c => c[0] === k) || [])[3] || ''; return v + (u ? ' ' + u : '');
  };
  // 本機目前的數據（和伺服器欄位對應）
  K.stats = () => {
    const v = G.Team.get(), p = P(), f = x => Math.max(0, Math.floor(+x || 0));
    if (!G.Team.dev) p.keysTot = Math.max(f(p.keysTot), G.Team.keysFloor());   // v3.2.6 累積不會少於持有＋已花
    const stg = p.stg || {}, ab = stg[G.SOLO.length], wk = G.weekId();
    const rs = p.rs || {}, W = G.W, kp = W && !W.attract && !W._fin ? W.keysGot || 0 : 0;   // v3.8 排行只用打完的戰鬥（rs）；正在打的這場撿到的鑰匙先不算
    return { heroes: v.owned.h.length, minions: v.owned.m.length, games: f(p.games), wins: Math.min(f(p.wins), f(p.games)), kills: f(rs.kills), deaths: f(rs.deaths), assists: f(rs.assists), keys: Math.max(0, f(p.keysTot) - f(p.kx) - kp), dmg: f(rs.dmg), time: f(rs.time), ach: G.Ach.doneCount(),
      stars: Object.values(stg).reduce((a, o) => a + f(o && o.s), 0), spd: ab && ab.c && ab.t ? f(ab.t) : 0, bk: f(rs.bk), wst: f(p.wstB), hunt: f(rs.bosses) + f(rs.hunters),   // v3.6
      wk: p.wk && p.wk.id === wk ? f(p.wk.n) : 0, wkid: wk };
  };
  K.mine = k => { const s = K.stats(); return k === 'wr' ? (s.games ? Math.round(s.wins / s.games * 1000) / 10 : 0) : k === 'kda' ? Math.round((s.kills + s.assists) / Math.max(1, s.deaths) * 100) / 100 : s[k]; };
  const req = async (path, body) => {
    const ac = window.AbortController ? new AbortController() : null, tm = ac ? setTimeout(() => ac.abort(), 8000) : 0;
    try {
      const r = await fetch(G.RANK_URL + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ac && ac.signal } : { signal: ac && ac.signal });
      const j = await r.json().catch(() => ({ err: 'server' })); return j;
    } catch (e) { return { err: 'net' }; } finally { if (tm) clearTimeout(tm); }
  };
  const errState = j => j.err === 'quota' ? 'quota' : 'err';
  // ---- 通知 ----
  const banner = (s, col) => G.Ach.queueBanner({ rk: { s, col }, t: 0 });
  const inTop = r => r >= 1 && r <= 3;
  function diff(nw) {
    const old = K.ranks(), up = [], down = [];
    for (const [k] of G.RANK_CATS) { const o = old[k] || 0, n = nw[k] || 0; if (inTop(n) && (!inTop(o) || n < o)) up.push([k, n]); else if (inTop(o) && !inTop(n)) down.push(k); }
    if (up.length === 1) banner('登上' + CN[up[0][0]] + '第 ' + up[0][1] + ' 名！', 13);
    else if (up.length > 1) banner(up.length + ' 項排行衝進前三名！', 13);
    if (down.length === 1) banner(CN[down[0]] + '被擠出前三名了', 10);
    else if (down.length > 1) banner(down.length + ' 項排行被擠出前三名', 10);
    ranks = nw; ls('ranks', nw);
  }
  function news(list) {
    const seen = ls('news'), mx = list.reduce((a, n) => Math.max(a, n.id), 0), me = K.me();
    if (seen == null) { ls('news', mx); return; }                          // 第一次：舊消息不播
    const fresh = list.filter(n => n.id > seen && !(me && n.pid === me.id)).reverse(), g = [];
    for (const n of fresh) { const q = g.find(x => x.pid === n.pid && Math.abs(x.t - n.t) < 5); if (q) q.cats.push(n.cat); else g.push({ pid: n.pid, t: n.t, name: n.name, cats: [n.cat] }); }
    g.slice(-3).forEach(q => banner(q.name + ' 登上' + (q.cats.length > 1 ? q.cats.length + ' 項排行' : CN[q.cats[0]]) + '第 1 名！', 12));
    if (mx > seen) ls('news', mx);
  }
  // ---- 拿排行（不在戰鬥中，每 30 秒）----
  K.poll = async force => {
    if (!K.on() || busy || (!force && Date.now() - lastPoll < (G.UI.screen === 'rank' ? G.RANK_FAST : G.RANK_GAP) * 1000)) return;
    busy = 1; lastPoll = Date.now(); if (!board) state = 'load';
    const j = await req('/board'); busy = 0;
    if (j.err || !j.cats) { state = errState(j); return; }
    board = j; boardT = Date.now(); state = 'ok';
    news(j.news || []);
    const me = K.me(); if (me && K.joined()) {                                  // 用前 20 名清單更新自己的名次（被超越也會知道）
      const old = K.ranks(), nw = {};
      for (const [k] of G.RANK_CATS) { const i = (j.cats[k] || []).findIndex(r => r[0] === me.id); nw[k] = i >= 0 ? i + 1 : (old[k] && old[k] <= 20 ? 21 : old[k] || 0); }
      diff(nw);
    }
  };
  // ---- 上傳自己的數據 ----
  K.submit = async () => {
    if (!K.on() || G.Team.dev || !K.joined() || K.moved || !K.ss()) return;
    if (busy || Date.now() - lastSub < (G.RANK_GAP + 1) * 1000) { pend = true; return; }
    busy = 1; pend = false; lastSub = Date.now();
    const me = K.me(), st = K.stats(), j = await req('/submit', { id: me.id, tok: me.tok, ss: K.ss(), name: K.name(), s: st }); busy = 0;
    if (isMoved(j)) return;
    if (j.ok) { sig = K.name() + JSON.stringify(st); diff(j.ranks || {}); lastPoll = -1e12; return; }                 // 上傳後馬上刷新排行
    if (j.err === 'wait') { pend = true; lastSub = Date.now() - (G.RANK_GAP - (j.wait || 5)) * 1000; return; }
    if (j.err === 'auth') { P().rk = null; G.Team.save(); ranks = {}; ls('ranks', {}); pend = true; return; }   // 身分失效：下一輪自動用新身分加入
    if (j.err === 'name') { banner('這個名字不能上排行，請到帳號改名', 10); return; }
    if (j.err === 'value') return;                                              // 數據不合理：不上傳
    pend = true; state = errState(j);
  };
  K.autoJoin = () => { if (K.on() && !G.Team.dev && !K.joined() && K.name()) { K.join(); banner('已加入線上排行榜！', 11); } else K.submit(); };   // 存檔時：自動參加
  K.join = () => {
    if (!K.name()) return false;
    P().rkOff = 0;
    if (!K.me()) { P().rk = { id: hex(16), tok: hex(32) }; G.Team.save(); ls('ss', hex(16)); }   // v2.8.7 新帳號：這台就是登入的那台
    lastSub = -1e12; K.submit(); return true;
  };
  // v2.8.4 帳號：刪除＝把自己從排行榜永久移除（本機進度由存檔畫面清空）
  K.remove = async () => {
    const me = K.me(); if (!me) return { ok: 1 };
    const j = await req('/leave', { id: me.id, tok: me.tok, ss: K.ss() }); if (j.err === 'net' || j.err === 'server' || j.err === 'quota') return j;
    return { ok: 1 };
  };
  K.forget = () => { ls('ss', ''); K.moved = false; claiming = 0; ranks = {}; ls('ranks', {}); sig = ''; pend = true; lastPoll = -1e12; K.fb.list = null; K.fb.unread = 0; K.fb.t = -1e12; };   // 登出／刪除後：本機的名次紀錄清掉
  // v2.8.7 這台登入：產生新的工作階段，伺服器記成這台（另一台就會被登出）
  let claiming = 0;
  K.claim = async () => {
    const me = K.me(); if (!K.on() || !me || claiming || K.moved) return; claiming = 1;
    const ss = hex(16), j = await req('/claim', { id: me.id, tok: me.tok, ss });
    if (j.ok) ls('ss', ss);
    else if (j.err === 'auth') { P().rk = null; G.Team.save(); }               // 身分失效：之後自動用新身分加入
    setTimeout(() => { claiming = 0; }, j.ok ? 0 : 30000);                      // 連不上就 30 秒後再試
  };
  K.uid = () => { const m = K.me(); return m ? m.id.slice(0, 8).toUpperCase() : ''; };
  // ---- v2.8.6 即時在線人數：每台開著遊戲的裝置（含戰鬥中）每 60 秒回報一次，伺服器算最近 2 分鐘有回報的裝置 ----
  K.online = { n: null, t: -1e12, busy: 0 };
  const sid = () => { let s = null; try { s = localStorage.getItem('leafwar_sid'); if (!s) { s = hex(16); localStorage.setItem('leafwar_sid', s); } } catch (e) { s = s || hex(16); } return s; };
  // v3.2 玩家動態（給開發者「管理玩家」看）：目前畫面＋戰鬥狀態，短字串
  //   s 畫面；戰鬥中再加 g 關卡、b 秒數、l 英雄等級、h 英雄、k K/D/A、w 結果（1 勝 2 敗）
  K.state = () => {
    const U = G.UI, sc = document.hidden ? 'bg' : U.screen === 'battle' && U.paused ? 'pause' : U.screen, o = { s: sc };
    if (U.screen === 'battle' && G.W && !G.W.attract) { const W = G.W, h = W.hero, S = W.stats || {}; o.g = W.stageI || 0; o.b = Math.round(W.time || 0); if (h) { o.l = h.level; o.h = h.name; } o.k = (S.kills || 0) + '/' + (S.deaths || 0) + '/' + (S.assists || 0); if (W.over) o.w = W.over.win ? 1 : 2;
      if (U.fpsA) { o.f = Math.round(U.fpsA); o.fl = Math.round(U.fpsLo || U.fpsA); }   // v3.4 幀數（平均／最低）、畫質（HD 解析度 %、超取樣倍數）
      if (G.HD && G.HD.ok) o.q = Math.round(G.HD.q * 100); o.ss = G.Render.SS || 1; }
    if (U.screen === 'battle' && U.lvUp) o.s = 'lvup_b';   // v3.14 升級頁（戰鬥暫停中）
    return JSON.stringify(o);
  };
  let lastSc = '';
  const ping = async () => {
    K.online.busy = 1; K.online.t = Date.now();
    const me = K.me(), ss = K.ss(), base = { sid: sid(), st: G.Team.dev ? '' : K.state(), v: G.VERSION, m: matchMedia && matchMedia('(pointer:coarse)').matches ? 1 : 0 };
    const j = await req('/ping', me && ss && !G.Team.dev ? Object.assign(base, { id: me.id, ss }) : base); K.online.busy = 0;
    isMoved(j);
    if (j.ok) { K.online.n = j.n; if (G.Mail) G.Mail.seen(j.a || 0); } else if (j.err === 'net') K.online.n = null;
  };
  addEventListener('visibilitychange', () => { if (!document.hidden) K.online.t = -1e12; });
  K.tick = () => {
    if (!K.on()) return;
    { const sc = G.UI.screen + (G.UI.paused ? 'p' : '') + (G.UI.shop ? 's' : '') + (G.W && G.W.over ? 'o' : ''); if (sc !== lastSc && Date.now() - K.online.t > 12000 && !K.online.busy) { lastSc = sc; K.online.t = -1e12; } }   // v3.2 換畫面就提早回報（最快 12 秒一次）
    if (!document.hidden && !K.online.busy && Date.now() - K.online.t > (G.UI.screen === 'battle' ? 60000 : 30000)) ping();   // v3.2.4 戰鬥外 30 秒一次（公告更快收到）
    const sc = G.UI.screen; if (sc === 'battle' || sc === 'intro' || sc === 'tap' || document.hidden) return;
    const now = Date.now();
    if (K.moved) { if (G.SaveUI && G.SaveUI.kicked) G.SaveUI.kicked(); return; }   // v2.8.7 被別台登入：到帳號畫面登出（戰鬥中先不打斷）
    if (K.me() && !K.ss() && !G.Team.dev) { K.claim(); return; }                 // v2.8.7 這台還沒登入（讀了存檔碼、剛更新到新版）
    if (K.name() && !K.me() && !G.Team.dev && !busy) { K.join(); return; }
    if (K.joined() && !G.Team.dev && now - K.fb.t > 600000 && G.UI.screen !== 'fb') K.fbLoad(false);   // v2.8.6 每 10 分鐘看有沒有開發者回信（首頁「反饋」紅點）        // v2.8.4 強制參加：有名字就自動加入（舊版退出過的也會回來）
    if (!pend && sig && K.joined() && !G.Team.dev && now - sigT > 2000) { sigT = now; if (K.name() + JSON.stringify(K.stats()) !== sig) pend = true; }   // v2.8.3 數據有變（開箱、領成就、改名…）就排隊上傳
    if (pend && K.joined() && !G.Team.dev && now - lastSub > (G.RANK_GAP + 1) * 1000) { K.submit(); return; }
    K.poll();
  };
  // ---- 管理（開發者模式）：隱藏／復原／永久刪除；v2.8.2 權限＝開發者密碼（開啟開發者模式時記在這台裝置 leafwar_adm），不進存檔碼 ----
  // ---- v2.8.6 反饋信箱 ----
  K.fb = { list: null, unread: 0, busy: 0, err: '', t: -1e12 };
  K.fbLoad = async seen => {
    const me = K.me(); if (!K.on() || !me || K.fb.busy) return;
    K.fb.busy = 1; K.fb.t = Date.now(); const j = await req('/fb/mine', { id: me.id, tok: me.tok, ss: K.ss(), seen: seen ? 1 : 0 }); K.fb.busy = 0;
    if (isMoved(j)) return;
    if (j.ok) { K.fb.list = j.list; K.fb.err = ''; K.fb.unread = seen ? 0 : j.list.filter(m => m.reply && !m.seen).length; }
    else K.fb.err = j.err === 'net' ? '連不上伺服器' : j.err === 'quota' ? '今天的額度用完了' : '讀取失敗';
  };
  K.fbSend = async body => {
    const me = K.me(); if (!me) return { err: 'nouser' };
    const j = await req('/fb/send', { id: me.id, tok: me.tok, ss: K.ss(), body }); isMoved(j); if (j.ok) await K.fbLoad(true); return j;
  };
  K.fbA = { list: null, busy: 0, err: '' };
  K.fbAdmLoad = async () => {
    if (K.fbA.busy || !K.admKey()) return; K.fbA.busy = 1;
    const j = await req('/admin/fb', { key: K.admKey() }); K.fbA.busy = 0;
    if (j.ok) { K.fbA.list = j.list; K.fbA.err = ''; } else K.fbA.err = j.err === 'auth' ? '密碼錯誤' : j.err === 'locked' ? '嘗試太多次，1 小時後再試' : '連不上伺服器';
  };
  K.fbAdmAct = async (act, mid, reply) => { const j = await req('/admin/' + act, { key: K.admKey(), mid, reply }); if (j.ok) await K.fbAdmLoad(); return j; };
  K.admKey = () => { try { return localStorage.getItem('leafwar_adm') || ''; } catch (e) { return ''; } };
  K.adm = { list: null, busy: 0, err: '' };
  K.admLoad = async key => {
    const k = key || K.admKey(); if (!k || K.adm.busy) return false;
    K.adm.busy = 1; K.adm.err = '';
    let j; try { const r = await fetch(G.RANK_URL + '/admin/list?g=1&key=' + encodeURIComponent(k)); j = await r.json(); } catch (e) { j = { err: 'net' }; }
    K.adm.busy = 0;
    if (j && Array.isArray(j.list)) { K.adm.guests = (j.guests || []).map(x => Object.assign(x, { g: 1, id: 'g' + x.gid, name: '訪客 ' + x.gid.slice(0, 4).toUpperCase(), pt: x.t })); j = j.list; }   // v3.4 未存檔玩家（訪客）
    if (Array.isArray(j)) { K.adm.list = j; K.adm.t = Date.now(); if (key) try { localStorage.setItem('leafwar_adm', key); } catch (e) { } return true; }
    K.adm.err = j.err === 'auth' ? '密碼不對' : j.err === 'locked' ? '猜錯太多次，1 小時後再試' : '連不上伺服器';
    return false;
  };
  K.admPurge = async days => {                                                  // v2.8.4 一次清除 N 天沒上線的帳號
    const j = await req('/admin/purge', { key: K.admKey(), days }); if (!j.ok) { K.adm.err = '操作失敗'; return; }
    G.Audio.play('deny'); lastPoll = -1e12; await K.admLoad();
  };
  K.admAct = async (act, id, h) => {
    const j = await req('/admin/' + act, { key: K.admKey(), id, h }); if (!j.ok) { K.adm.err = '操作失敗'; return; }
    G.Audio.play(act === 'del' ? 'deny' : 'tick'); lastPoll = -1e12; await K.admLoad();
  };
  K._mock = () => {                                                              // 測試用：假資料（20 人、含長名字）
    const nm = ['葉子王', '小派', '阿明', '超級無敵大豌豆', 'Leafy99', '風之子', 'ABCDEFGH', '豆豆', '阿珠', '小樹苗', '火焰射手', '冰霜', '雷神', '阿傑', 'Mia', 'Ken', '老王', '小美', '長名字測試八', '路人'];
    const base = { heroes: [11, 0.5], minions: [18, 0.5], games: [300, 7], wr: [92.5, 2.3], kda: [9.87, 0.3], keys: [500, 13], dmg: [9876543, 400000], time: [360000, 9000], ach: [60, 2], stars: [15, 0.6], spd: [620, -25], wk: [42, 2], bk: [88, 4], wst: [23, 1], hunt: [345, 15] }, cats = {};
    for (const [k] of G.RANK_CATS) cats[k] = nm.map((n, i) => [n === '小派' ? 'me00000000000000' : 'id' + String(i).padStart(14, '0'), n, Math.max(1, Math.round((base[k][0] - i * base[k][1]) * 100) / 100)]);
    G.RANK_URL = G.RANK_URL || 'https://x.invalid'; G.Team.get().name = '小派'; G.Ach.P().rk = { id: 'me00000000000000', tok: '0'.repeat(32) };
    K._set({ t: 0, n: 57, news: [], cats }, 'ok', Object.fromEntries(G.RANK_CATS.map(([k], i) => [k, i % 3 ? 2 : 5])));
  };
  K._set = (b, st, rk) => { board = b; boardT = Date.now(); state = st || 'ok'; if (rk) ranks = rk; };   // 測試用
  return K;
})();

// ---------- 排行榜畫面 ----------
// v2.8.1：分類改成首頁那種上下滾輪（中間是選到的分類）；名字太長用「…」，每列一樣高；開發者模式可以管理玩家
G.RankUI = (() => {
  const S = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, ui = () => G.Menus.ui, K = () => G.Rank;
  let adm = false, askDel = null, askPurge = 0, jmp = null;
  const cw = G.UI.wheel();
  const cat = () => cw.idx();
  S.reset = () => { adm = false; det = null; askDel = null; askPurge = 0; jmp = null; K().poll(true); };
  S.jump = () => { jmp = { st: 'ask' }; };
  S.badge = (...a) => badge(...a); S.frame = (...a) => frame(...a);    // 教學頁共用                                                   // 測試用
  S.esc = () => { if (adm) { adm = false; return true; } return false; };
  S.cat = i => { cw.go(i); cw.pos = cw.tgt = i; cw.settled = true; };                         // 測試用
  S.adm = (on, noLoad) => { adm = on; if (on && !noLoad) K().admLoad(); };                                         // 測試用
  S._det = id => { det = id; };                                                               // 測試用
  // 名字太長：截斷加「…」
  const ell = (s, maxW) => { if (G.cnW(s) <= maxW) return s; const a = [...s]; while (a.length > 1 && G.cnW(a.join('') + '…') > maxW) a.pop(); return a.join('') + '…'; };
  // 分類滾輪：中間一格是選到的分類（全名），上下各露出一格（短名）
  function wheel(c, x, y, w, vis) {
    const n = G.RANK_CATS.length, step = 14, bh = 13, top = y, bot = top + step * (vis * 2 + 1), cy = top + vis * step + Math.round(step / 2), rk = K().joined() ? K().ranks() : {}, gt = ui().gt();
    cw.update(G.Menus.dt || 1 / 60, n);
    H().wheelBtn(cw, x, top, w, bot - top);
    c.save(); c.beginPath(); c.rect(x - 2, top, w + 4, bot - top); c.clip();
    const order = G.RANK_CATS.map((q, i) => i).sort((a, b) => Math.abs(b - cw.pos) - Math.abs(a - cw.pos));
    for (const i of order) {
      const [k, sn, full] = G.RANK_CATS[i], d = i - cw.pos, ad = Math.abs(d); if (ad > vis + 0.6) continue;
      const ctr = ad < 0.5, w2 = w - 18 - Math.round(Math.min(ad, 2) * 8), xx = Math.round(x + (w - w2) / 2), yy = Math.round(cy - bh / 2 + d * step - (ctr ? Math.round(cw.bump) : 0));
      if (ctr && cw.settled) { c.fillStyle = P[(Math.sin(gt * 4) > 0) ? 13 : 14]; c.fillRect(xx - 1, yy - 1, w2 + 2, bh + 2); }
      H().key(c, xx, yy, w2, bh, 0, ctr ? 13 : 5, ctr ? 2 : 1);
      G.cn(c, ctr ? full : sn, xx + w2 / 2, yy + 1, ctr ? 9 : 7, 0.5);
      if (rk[k] >= 1 && rk[k] <= 3) { c.fillStyle = P[0]; c.fillRect(xx + w2 - 7, yy + 1, 5, 5); c.fillStyle = TIER[rk[k] - 1]; c.fillRect(xx + w2 - 6, yy + 2, 3, 3); }   // 自己在前三：金／銀／銅點
      if (!ctr) { c.fillStyle = 'rgba(12,12,12,' + Math.min(0.55, ad * 0.3).toFixed(3) + ')'; c.fillRect(xx, yy, w2 + 1, bh + 1); }
      ui().tap('rkw' + i, xx, yy, w2, bh, () => { if (Math.abs(cw.pos - i) >= 0.5) cw.go(i); });
      H().tagWheel(cw);
    }
    c.restore();
    const ax = Math.round(Math.abs(Math.sin(gt * 4)) * 2); c.fillStyle = P[13];                // 左右黃色箭頭（和首頁一樣）
    for (let q = 0; q < 4; q++) { c.fillRect(x + 2 - ax + q, cy - 3 + q, 1, 7 - q * 2); c.fillRect(x + w - 3 + ax - q, cy - 3 + q, 1, 7 - q * 2); }
    return bot - top;
  }
  // v2.8.3 前三名：像素獎盃（金／銀／銅，四階明暗，H 反光、L 亮面、M 中間、D 暗面＋把手；深灰底座），每隔幾秒杯口閃一下星光
  const TROPHY = [
    '.HHLLLLMMD.',
    'D.HLLLLMD.D',
    'D.HLLLLMD.D',
    '.DHLLLLMDD.',
    '...HLLMD...',
    '....LMD....',
    '.....M.....',
    '....LMD....',
    '...bbbbb...',
    '..BBBBBBB..'
  ];
  const TCOL = [
    { H: '#fffbe0', L: '#ffd84a', M: '#eaa516', D: '#b0680c' },
    { H: '#ffffff', L: '#e2e7f0', M: '#aab3c4', D: '#737c8f' },
    { H: '#ffe2c4', L: '#ec9e5e', M: '#c86c2c', D: '#8a4416' }
  ];
  const _tro = [];
  function trophyImg(r) {
    if (_tro[r]) return _tro[r];
    const cv = G.canvas(11, 10), g = cv.getContext('2d'), col = Object.assign({ b: '#7a7a7a', B: '#4a4a4a' }, TCOL[r]);
    TROPHY.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(x, y, 1, 1); } }));
    return (_tro[r] = cv);
  }
  const GLOW = ['#ffd84a', '#dfe6f2', '#d98a4a'];
  const TIER = S.TIER = ['#f7d23c', '#cfd6e2', '#c8773a'];                                            // v2.8.4 前三名外框：金／銀／銅（固定跟名次走，不受「自己」影響）
  const frame = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x + 1, y, w - 2, 1); c.fillRect(x + 1, y + h - 1, w - 2, 1); c.fillRect(x, y + 1, 1, h - 2); c.fillRect(x + w - 1, y + 1, 1, h - 2); };
  function badge(c, x, y, r) {                                                              // y＝框內第一列；獎盃上下各留 1 px
    if (r <= 3) {
      c.drawImage(trophyImg(r - 1), x + 1, y + 1);
      const t = (ui().gt() + r * 1.1) % 3.3;                                                // 星光：三個錯開
      if (t < 0.5) { const k = Math.sin(t / 0.5 * Math.PI), n = k > 0.6 ? 2 : 1, sx = x + 9, sy = y + 2; c.globalAlpha = k; c.fillStyle = '#ffffff'; c.fillRect(sx, sy - n, 1, n * 2 + 1); c.fillRect(sx - n, sy, n * 2 + 1, 1); c.globalAlpha = 1; }
    }
    else G.cn(c, String(r), x + 6, y, 5, 0.5);
  }
  // v2.8.3 前三名資訊條的光暈（全部畫在框內，不加粗外框）：左邊淡淡的底色、框內 2 px 柔光呼吸、外框微微發亮、每隔幾秒一道斜向掃光
  function honor(c, x, y, w, h, r) {
    const gt = ui().gt(), col = GLOW[r - 1], br = 0.5 + 0.5 * Math.sin(gt * 2.4 + r * 2), tw = Math.round(w * 0.45);
    c.fillStyle = col;
    for (let i = 0; i < tw; i += 2) { c.globalAlpha = 0.13 * (1 - i / tw); c.fillRect(x + 1 + i, y + 1, 2, h - 2); }
    [[1, 0.1 + 0.12 * br], [2, 0.05 * br]].forEach(([d, al]) => { c.globalAlpha = al; c.fillRect(x + d, y + d, w - d * 2, 1); c.fillRect(x + d, y + h - 1 - d, w - d * 2, 1); c.fillRect(x + d, y + d + 1, 1, h - d * 2 - 2); c.fillRect(x + w - 1 - d, y + d + 1, 1, h - d * 2 - 2); });
    c.globalAlpha = 0.28 * br; c.fillStyle = '#ffffff';                                       // 外框發亮（同一條線，不變粗）
    c.fillRect(x + 1, y, w - 2, 1); c.fillRect(x + 1, y + h - 1, w - 2, 1); c.fillRect(x, y + 1, 1, h - 2); c.fillRect(x + w - 1, y + 1, 1, h - 2);
    const t = (gt * 0.9 + r * 0.37) % 3.2;                                                    // 3.2 秒一輪，0.7 秒掃過
    if (t < 0.7) { const sx = Math.round(x - 8 + (w + 16) * t / 0.7); c.save(); c.beginPath(); c.rect(x + 1, y + 1, w - 2, h - 2); c.clip(); c.fillStyle = '#ffffff';
      for (let q = 0; q < h; q++) { c.globalAlpha = 0.16; c.fillRect(sx - (q >> 1), y + q, 4, 1); c.globalAlpha = 0.08; c.fillRect(sx - (q >> 1) + 5, y + q, 2, 1); }
      c.restore(); }
    c.globalAlpha = 1;
  }
  // 底部列：文字 1～2 行（高度跟著行數），右邊一顆按鈕
  function bar(c, x, B, W, lines, col, btn) {
    const tw = W - (btn ? 70 : 10), ls = [].concat(...lines.filter(Boolean).map(l => G.cnWrap(l, tw))).slice(0, 2), h = ls.length > 1 ? 32 : 22, by = B - h;
    H().box(c, x, by, W, h, 1, col, false);
    ls.forEach((l, i) => G.cn(c, l, x + 5, by + (ls.length > 1 ? 3 + i * 13 : 5), i === 0 ? 9 : 6));
    if (btn) { const bw = 56, bx = x + W - bw - 4, byy = by + Math.round((h - 15) / 2);
      if (btn[4]) { H().box(c, bx, byy, bw, 15, 1, 3, false); G.cn(c, btn[1], bx + bw / 2, byy + 1, 4, 0.5); }   // 停用（灰）
      else (btn[3] ? ui().btnPrimary : ui().btnSecondary)(c, btn[0], bx, byy, bw, 15, btn[1], btn[2]); }
    return h;
  }
  S.draw = c => {
    const M = ui(); M.tick(); M.bg(c);
    const y0 = M.header(c, adm ? '管理玩家' : '排行榜'), I = R.ins, L = I.l, Rr = R.uw - I.r, B = R.uh - I.b, LD = R.uw > R.uh * 1.15, Kk = K(), b = Kk.board(), st = Kk.state(), me = Kk.me();
    const W = Math.min(Rr - L, 420), x = Math.round((L + Rr) / 2 - W / 2);
    if (adm) return admin(c, M, x, y0, W, B);
    // 標題列右邊：人數＋更新狀態
    const nx = Kk.next(), stTxt = !Kk.on() ? '' : st === 'quota' ? '額度用完' : st === 'err' ? '連不上' : st === 'load' ? '讀取中' : Kk.age() >= 0 ? (nx <= 0 ? '更新中' : nx + ' 秒後更新') : '';   // v2.8.3 改成倒數
    const room = Rr - (L + 24 + G.cnW(adm ? '管理玩家' : '排行榜') + 8), cand = [(b ? b.n + ' 人' : '') + (b && stTxt ? '・' : '') + stTxt, stTxt, stTxt.replace(' 秒後更新', ' 秒')], hd = cand.find(q => G.cnW(q) <= room) || cand[2];   // 放不下：先拿掉人數，再縮短
    if (hd) G.cn(c, hd, Rr, I.t + 1, st === 'err' || st === 'quota' ? 10 : 6, 1);
    const k = G.RANK_CATS[cat()][0];
    let lx = x, lw = W, y = y0;
    if (LD) { wheel(c, x, y + 4, 96, 2); lx = x + 102; lw = W - 102; }
    else { y += wheel(c, x, y, W, 1) + 10; }                                                   // v2.8.4 直屏：滾輪和清單之間留寬一點
    // ---- 底部：我的名次＋跳至自己（v2.8.4 取消退出排行：有名字就一定在榜上）----
    const rows = b && b.cats[k] || [], myI = me ? rows.findIndex(r => r[0] === me.id) : -1, SM = M.SM;
    let lines, btn = null, col = 3;
    if (G.Team.dev) { lines = ['開發者模式', '不上傳排行']; if (Kk.on()) btn = ['rkAdm', '管理玩家', () => { adm = true; askDel = null; askPurge = 0; Kk.admLoad(); G.Audio.play('open'); }]; }
    else if (!Kk.on()) lines = ['排行榜準備中'];
    else if (!Kk.joined()) { if (Kk.name()) lines = ['正在加入排行…', Kk.name()]; else { lines = ['先取個玩家名稱', '就會自動上榜']; btn = ['rkSave', '前往帳號', () => M.go('save'), 1]; } }
    else {
      col = 13; const r = Kk.ranks()[k] || 0, my = Kk.mine(k), g = Kk.stats().games;
      if (G.RANK_MIN[k] && g < G.RANK_MIN[k]) lines = ['你：還沒上榜', '還差 ' + (G.RANK_MIN[k] - g) + ' 場才上榜'];
      else if (!r && !my && G.RANK_HOW[k]) lines = ['你：還沒上榜', G.RANK_HOW[k]];
      else if (!r) lines = ['你：還沒上榜', '目前 ' + Kk.fmt(k, my)];
      else { const rt = '你：' + (r > 20 ? '20 名以外' : '第 ' + r + ' 名'), vt = Kk.fmt(k, my); lines = G.cnW(rt + '　' + vt) <= W - 70 ? [rt + '　' + vt] : [rt, '目前 ' + vt]; }
      btn = ['rkMe', '跳至自己', () => { jmp = { st: 'ask' }; G.Audio.play('click'); }, 0, myI < 0];   // 不在前 20 名：按鈕變灰
    }
    const bh = bar(c, x, B, W, lines, col, btn), listH = B - bh - 3 - y;
    // ---- 清單（每列固定 15 高；名字放不下用「…」）----
    if (!b || !rows.length) {
      const msg = !Kk.on() ? '排行榜準備中，敬請期待' : st === 'quota' ? '今天的排行額度用完了，早上 8 點恢復' : st === 'err' ? '暫時連不上排行榜，稍後會自動再試' : !b ? '讀取中…' : G.RANK_NONE[k] ? G.RANK_NONE[k] : G.RANK_MIN[k] ? '還沒有人打滿 ' + G.RANK_MIN[k] + ' 場，快來搶第一！' : '還沒有人上榜';
      G.cnWrap(msg, lw - 12).forEach((l, i) => G.cn(c, l, lx + lw / 2 - 3, y + 16 + i * 13, 6, 0.5));
      return;
    }
    // v2.8.4 跳至自己：自己那列不在畫面內就先平滑捲過去（置中），到了再輕微震動；本來就看得到就直接震動
    if (jmp && (myI < 0 || (jmp.k && jmp.k !== k))) jmp = null;
    if (jmp) {
      const dt = G.Menus.dt || 1 / 60, cur = SM.key === 'rk' + k ? SM.s : 0, top = y + myI * 16 - cur;
      if (jmp.st === 'ask') { jmp.k = k; jmp.st = top >= y && top + 14 <= y + listH ? 'shake' : 'scroll'; jmp.t = 0; }
      if (jmp.st === 'scroll' && SM.key === 'rk' + k) {
        const tgt = G.clamp(myI * 16 - Math.round((listH - 14) / 2), 0, SM.max || 0); SM.v = 0; SM.s += (tgt - SM.s) * Math.min(1, dt * 10);
        if (Math.abs(tgt - SM.s) < 0.6) { SM.s = tgt; jmp.st = 'shake'; jmp.t = 0; }
      } else if (jmp.st === 'shake') { if (jmp.t === 0) G.Audio.play('tick'); jmp.t += dt; if (jmp.t > 0.5) jmp = null; }
    }
    M.scrollDetail(c, lx, y, lw - 6, listH, 'rk' + k, yy => {
      rows.forEach(([id, nm, v], i) => {
        if (yy + 15 <= y || yy >= y + listH) { yy += 16; return; }                          // 捲出清單範圍的列不畫
        const w = lw - 6, mine = me && id === me.id, vs = Kk.fmt(k, v), vw = G.cnW(vs);
        const sk = mine && jmp && jmp.st === 'shake' ? jmp.t / 0.5 : -1, sx = sk >= 0 ? Math.round(Math.sin(sk * 0.5 * 45) * 2 * (1 - sk)) : 0;   // 震動：左右 ±2 px、0.5 秒衰減
        c.save(); c.translate(sx, 0);
        H().box(c, lx, yy, w, 14, mine ? 2 : 1, 3, false);                                      // 自己：底色亮一階＋左側黃色標記＋黃字（外框固定跟名次走）
        if (i < 3) { frame(c, lx, yy, w, 14, TIER[i]); honor(c, lx, yy, w, 14, i + 1); }
        if (mine) { c.fillStyle = P[13]; c.fillRect(lx + 1, yy + 2, 2, 10); }
        if (sk >= 0) { c.globalAlpha = 0.22 * (1 - sk); c.fillStyle = '#ffffff'; c.fillRect(lx + 1, yy + 1, w - 2, 12); c.globalAlpha = 1; }
        badge(c, lx + 3, yy + 1, i + 1);
        G.cn(c, ell(nm, w - 19 - vw - 10), lx + 19, yy + 1, mine ? 13 : 9);
        G.cn(c, vs, lx + w - 4, yy + 1, mine ? 13 : i < 3 ? 9 : 7, 1);
        c.restore();
        yy += 16;
      });
      return yy;
    }, M.SM);
  };
  // ---- 管理玩家（開發者模式）：隱藏＝不出現在排行、可復原；刪除＝永久移除（要按兩下）----
  // ---- v3.2 玩家動態 ----
  let det = null;
  const SCN = { menu: '首頁', stages: '選關卡', battle: '戰鬥中', pause: '戰鬥暫停中', shop_b: '戰鬥中・逛商店', lvup_b: '戰鬥中・選升級', team: '隊伍', book: '圖鑑', store: '商店（寶箱）', ach: '成就', rank: '排行榜', save: '帳號', guide: '教學', fb: '反饋', about: '關於', mail: '信箱', intro: '開場動畫', tap: '開始畫面', bg: '切到背景' };
  const st = p => { try { return p.st ? JSON.parse(p.st) : {}; } catch (e) { return {}; } };
  const ago = s => s < 60 ? '剛剛' : s < 3600 ? Math.floor(s / 60) + ' 分鐘前' : s < 86400 ? Math.floor(s / 3600) + ' 小時前' : Math.floor(s / 86400) + ' 天前';
  const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function doing(p, now) {
    const o = st(p), sc = SCN[o.s] || o.s || (p.g && !p.st ? '開發者模式' : '');
    if (!p.pt) return '最後上傳 ' + ago(now - (p.updated || p.created || now));
    let t = sc;
    if (o.g != null) { t += '・' + (o.g ? '第 ' + o.g + ' 關' : '經典') + ' ' + mmss(o.b || 0); if (o.l) t += '・Lv' + o.l; if (o.w) t += o.w === 1 ? '・勝利' : '・落敗'; }
    return now - p.pt < 120 ? t : '離線 ' + ago(now - p.pt) + (t ? '（最後在' + t + '）' : '');
  }
  function detail(p, now) {
    const o = st(p), on = p.pt && now - p.pt < 120, d = t => { const x = new Date(t * 1000); return (x.getMonth() + 1) + '/' + x.getDate() + ' ' + x.getHours() + ':' + String(x.getMinutes()).padStart(2, '0'); };
    const r = [['狀態', doing(p, now), on ? 11 : 6]];
    if (o.k) r.push(['本場', o.k + (o.h ? '・' + (G.TXT.unit[o.h] || o.h) : '')]);
    if (on && p.t0) r.push(['上線', Math.max(1, Math.round((now - p.t0) / 60)) + ' 分鐘']);
    if (p.m != null) r.push(['裝置', p.m ? '手機／平板' : '電腦']);
    if (p.v) r.push(['版本', p.v + (p.v !== G.VERSION ? '（舊版）' : ''), p.v !== G.VERSION ? 10 : 9]);
    if (o.f) r.push(['幀數', '平均 ' + o.f + '・最低 ' + (o.fl || o.f) + ' FPS' + (o.q != null ? '・解析度 ' + o.q + '%' : '') + (o.ss > 1 ? '・' + o.ss + ' 倍細緻' : ''), (o.fl || o.f) < 40 ? 10 : (o.fl || o.f) < 55 ? 13 : 9]);   // v3.4
    if (p.g) return r;                                                      // 訪客沒有帳號資料
    r.push(['戰績', (p.games || 0) + ' 場・' + (p.wins || 0) + ' 勝・勝率 ' + (p.games ? Math.round((p.wins || 0) / p.games * 100) : 0) + '%']);
    r.push(['擊殺', (p.kills || 0) + '/' + (p.deaths || 0) + '/' + (p.assists || 0) + '（KDA ' + (p.kda != null ? Number(p.kda).toFixed(1) : '-') + '）']);
    r.push(['收集', '英雄 ' + (p.heroes || 0) + '・小兵 ' + (p.minions || 0) + '・成就 ' + (p.ach || 0)]);
    r.push(['鑰匙', '累積 ' + (p.keys || 0)]);
    if (p.stars != null) r.push(['紀錄', (p.stars || 0) + ' 星・深淵 ' + K().fmt('spd', p.spd || 0) + '・單場擊殺 ' + (p.bk || 0) + '・連勝 ' + (p.wst || 0) + '・本週 ' + (p.wkid === G.weekId() ? p.wk || 0 : 0) + ' 勝']);   // v3.6
    r.push(['時長', Math.round((p.time || 0) / 3600 * 10) / 10 + ' 小時']);
    r.push(['傷害', String(p.dmg || 0)]);
    if (p.created) r.push(['建立', d(p.created)]);
    if (p.updated) r.push(['上傳', d(p.updated)]);
    return r;
  }
  function admin(c, M, x, y, W, B) {
    const Kk = K(), A = Kk.adm, key = Kk.admKey();
    const bh = bar(c, x, B, W, ['刪除無法復原'], 3, ['rkAdmBk', '返回', () => { adm = false; askDel = null; G.Audio.play('click'); }]);
    if (!key || A.err === '密碼不對') {                                                       // 舊版開過開發者模式的裝置：重新輸入一次開發者密碼就好
      G.cnWrap('請先關閉開發者模式，再重新開啟一次（輸入密碼）', W - 8).forEach((l, i) => G.cn(c, l, x + 4, y + i * 13, 7));
      return;
    }
    if (!A.list) { G.cn(c, A.busy ? '讀取中…' : A.err || '讀取中…', x + W / 2, y + 16, A.err ? 10 : 6, 0.5); if (!A.busy && !A.err) Kk.admLoad(); return; }
    if (!A.busy && A.t && !A.err && Date.now() - A.t > 15000) Kk.admLoad();               // 只有上次成功才自動更新（失敗不重試，避免密碼錯誤次數累積）                          // v3.2 停在這頁時每 15 秒更新動態
    const now = Date.now() / 1000, last = p => Math.max(p.pt || 0, p.updated || 0, p.created || 0), days = p => Math.max(0, Math.floor((now - (last(p) || now)) / 86400)), GH = G.RANK_GHOST;
    const on = p => p.pt && now - p.pt < 120, L = A.list.concat(A.guests || []).sort((a, b) => (on(b) - on(a)) || last(b) - last(a)), acc = L.filter(p => !p.g);   // v3.4 訪客（未存檔）一起列，在線的排前面
    const hid = acc.filter(p => p.hidden).length, gh = acc.filter(p => days(p) >= GH).length, onN = L.filter(on).length, gN = L.filter(p => p.g && on(p)).length, fight = L.filter(p => on(p) && /^(battle|pause|shop_b|lvup_b)$/.test(st(p).s)).length, pbw = 52;
    // 上方摘要：總數、在線（戰鬥中）、隱藏、幽靈；幽靈帳號（GH 天以上沒上線）右邊一鍵清除（要按兩下）
    const hl = G.cnWrap(A.err || '共 ' + acc.length + ' 人・在線 ' + onN + (fight ? '（戰鬥 ' + fight + '）' : '') + (gN ? '・未存檔 ' + gN : '') + (hid ? '・隱藏 ' + hid : '') + (gh ? '・幽靈 ' + gh : ''), W - (gh ? pbw + 8 : 0));
    hl.forEach((l, i) => G.cn(c, l, x, y + i * 13, A.err ? 10 : 13));
    if (gh && !A.err) { const ask = askPurge && Date.now() - askPurge < 3000;
      (ask ? M.btnPrimary : M.btnSecondary)(c, 'rkPurge', x + W - pbw - 6, y, pbw, 13, ask ? '確定清除' : '清除幽靈', () => { if (ask) { askPurge = 0; Kk.admPurge(GH); } else { askPurge = Date.now(); G.Audio.play('tick'); } }); }
    const ly = y + Math.max(1, hl.length) * 13 + 2, listH = B - bh - 3 - ly;
    const gl = G.cnWrap('綠點在線・灰名是未存檔訪客・紅字 ' + GH + ' 天沒上線・點一列看詳細', W); gl.forEach((l, i) => G.cn(c, l, x, ly - 1 + i * 13, 4)); const ly2 = ly + gl.length * 13, listH2 = listH - gl.length * 13;
    M.scrollDetail(c, x, ly2, W - 6, listH2, 'rkadm', yy => {                                   // v3.2 每人三行：名字、現在在做什麼、場數／裝置／版本；按鈕在右邊
      L.forEach(p => {
        const RH = 41;
        if (yy + RH <= ly2 || yy >= ly2 + listH2) { yy += RH + 2; return; }
        const d = p.g ? 0 : days(p), w = W - 6, o = on(p), tx = w - 8;
        H().box(c, x, yy, w, RH, 1, p.hidden ? 2 : o ? 16 : 3, false);
        if (o) { c.fillStyle = P[11]; c.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 300); c.fillRect(x + 4, yy + 5, 4, 4); c.globalAlpha = 1; } else { c.fillStyle = P[4]; c.fillRect(x + 4, yy + 5, 4, 4); }
        G.cn(c, ell(p.name, tx - 8), x + 11, yy + 1, p.hidden ? 4 : p.g ? 6 : 9);
        G.cn(c, ell(doing(p, now), tx), x + 4, yy + 14, o ? 11 : d >= GH ? 10 : 5);
        const wr = p.games ? Math.round((p.wins || 0) / p.games * 100) + '%' : '-', dev = p.m == null ? '' : p.m ? '・手機' : '・電腦', old = p.v && p.v !== G.VERSION;
        const l3 = (p.g ? '未存檔' : (p.games || 0) + ' 場') + dev; G.cn(c, ell(l3, tx - (p.v ? G.cnW(p.v) + 6 : 0)), x + 4, yy + 27, 6);
        if (p.v) G.cn(c, p.v, x + 4 + tx, yy + 27, old ? 10 : 5, 1);
        M.tap('aq' + p.id, x, yy, w, RH, () => { det = p.id; askDel = null; G.Audio.play('tick'); });   // 隱藏／刪除改到詳細資料裡，清單留給動態
        yy += RH + 2;
      });
      return yy;
    }, M.SM);
    // v3.2 玩家詳細資料（點一列）
    const p = det != null && L.find(q => q.id === det);
    if (p) {
      H().btn('adBg', 0, 0, R.uw, R.uh, null, () => { det = null; }); H().dim(c, 0.7);
      const pw = Math.min(R.uw - 12, 260), rows = detail(p, now), lw2 = Math.max(...rows.map(r => G.cnW(r[0]))) + 8, vw = pw - 16 - lw2;
      const lines = rows.map(r => G.cnWrap(r[1], vw)), ph = 26 + lines.reduce((a, l) => a + l.length * 13, 0) + 28, px = Math.round(R.uw / 2 - pw / 2), py = Math.max(R.ins.t + 2, Math.round(R.uh / 2 - ph / 2));
      H().box(c, px, py, pw, ph, 1, on(p) ? 11 : 7); H().btn('adIn', px, py, pw, ph, null, null);
      G.cn(c, ell(p.name, pw - 16), px + 8, py + 6, 9);
      let yy = py + 24; rows.forEach((r, i) => { G.cn(c, r[0], px + 8, yy, 5); lines[i].forEach((l, k) => G.cn(c, l, px + 8 + lw2, yy + k * 13, r[2] || 9)); yy += lines[i].length * 13; });
      const bw = Math.floor((pw - 16 - 8) / 3), by = py + ph - 22, del = askDel && askDel.id === p.id && Date.now() - askDel.t < 3000;
      if (p.g) { M.btnSecondary(c, 'adOk', Math.round(px + pw / 2 - bw / 2), by, bw, 16, '關閉', () => { det = null; }); return; }   // 訪客只能看
      M.btnSecondary(c, 'ah' + p.id, px + 8, by, bw, 16, p.hidden ? '復原' : '隱藏', () => Kk.admAct('hide', p.id, p.hidden ? 0 : 1));
      (del ? M.btnPrimary : M.btnSecondary)(c, 'ad' + p.id, px + 12 + bw, by, bw, 16, del ? '確定刪除' : '刪除', () => { if (del) { askDel = null; det = null; Kk.admAct('del', p.id); } else { askDel = { id: p.id, t: Date.now() }; G.Audio.play('tick'); } });
      M.btnSecondary(c, 'adOk', px + 16 + bw * 2, by, bw, 16, '關閉', () => { det = null; });
    }
  }
  return S;
})();
G.Menus.rank = c => G.RankUI.draw(c);
