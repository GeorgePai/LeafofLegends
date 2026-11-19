// ============================================================
// v2.8 線上排行榜（伺服器：Cloudflare Worker＋D1，程式在 leaderboard/）
// 規則一句話：存過檔取了名字就能參加，排行榜每 30 秒刷新，進前三名就廣播
// - 身分：P.rk = { id, tok }（放在成就檔案裡，所以會跟著存檔碼走，換手機也是同一個人）
// - 上傳：存檔、每場戰鬥結束、開遊戲時；同一人 30 秒最多 1 次（伺服器也會擋）
// - 刷新：不在戰鬥中、畫面在前景時，每 30 秒拿一次排行（順便收全服「登上第 1 名」消息）
// - DEV 模式不上傳
// ============================================================
G.RANK_URL = 'https://lol-rank.leafoflegends.workers.dev';                    // 部署後填入 https://lol-rank.<子網域>.workers.dev
G.RANK_GAP = 30;                      // 刷新間隔（秒）
G.RANK_CATS = [                       // [欄位, 短名（分類格）, 全名, 單位]
  ['heroes', '英雄', '英雄收集', '位'], ['minions', '小兵', '小兵收集', '隻'], ['games', '場數', '戰鬥場數', '場'],
  ['wr', '勝率', '勝率', ''], ['kda', 'KDA', 'KDA', ''], ['keys', '鑰匙', '累積鑰匙', '把'],
  ['dmg', '傷害', '總傷害', ''], ['time', '時長', '遊玩時長', ''], ['ach', '成就', '成就數', '個']
];
G.Rank = (() => {
  const K = {}, CN = Object.fromEntries(G.RANK_CATS.map(c => [c[0], c[2]]));
  let board = null, boardT = 0, lastPoll = -1e12, lastSub = -1e12, busy = 0, pend = true, state = 'idle', ranks = null;
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
  K.ranks = () => ranks || ls('ranks') || {};
  K.fmt = (k, v) => {
    v = +v || 0;
    if (k === 'wr') return v.toFixed(1) + '%';
    if (k === 'kda') return v.toFixed(2);
    if (k === 'time') { const m = Math.floor(v / 60); return m >= 60 ? Math.floor(m / 60) + '時' + (m % 60) + '分' : m + '分'; }
    if (k === 'dmg') return v >= 1e4 ? (v / 1e4).toFixed(v >= 1e6 ? 0 : 1) + '萬' : String(Math.round(v));
    const u = (G.RANK_CATS.find(c => c[0] === k) || [])[3] || ''; return v + (u ? ' ' + u : '');
  };
  // 本機目前的數據（和伺服器欄位對應）
  K.stats = () => {
    const v = G.Team.get(), p = P(), f = x => Math.max(0, Math.floor(+x || 0));
    return { heroes: v.owned.h.length, minions: v.owned.m.length, games: f(p.games), wins: Math.min(f(p.wins), f(p.games)), kills: f(p.kills), deaths: f(p.deaths), assists: f(p.assists), keys: f(p.keysTot), dmg: f(p.dmg), time: f(p.time), ach: G.Ach.doneCount() };
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
    if (!K.on() || busy || (!force && Date.now() - lastPoll < G.RANK_GAP * 1000)) return;
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
    if (!K.on() || G.Team.dev || !K.joined()) return;
    if (busy || Date.now() - lastSub < (G.RANK_GAP + 1) * 1000) { pend = true; return; }
    busy = 1; pend = false; lastSub = Date.now();
    const me = K.me(), j = await req('/submit', { id: me.id, tok: me.tok, name: K.name(), s: K.stats() }); busy = 0;
    if (j.ok) { diff(j.ranks || {}); lastPoll = -1e12; return; }                 // 上傳後馬上刷新排行
    if (j.err === 'wait') { pend = true; lastSub = Date.now() - (G.RANK_GAP - (j.wait || 5)) * 1000; return; }
    if (j.err === 'auth') { P().rk = null; G.Team.save(); ranks = {}; ls('ranks', {}); banner('排行身分失效，請重新參加', 10); return; }
    if (j.err === 'name') { banner('這個名字不能上排行，請到存檔改名', 10); return; }
    if (j.err === 'value') return;                                              // 數據不合理：不上傳
    pend = true; state = errState(j);
  };
  K.autoJoin = () => { if (K.on() && !G.Team.dev && !K.joined() && K.name() && !P().rkOff) { K.join(); banner('已加入線上排行榜！', 11); } else K.submit(); };   // 存檔時：沒退出過就自動參加
  K.join = () => {
    if (!K.name()) return false;
    P().rkOff = 0;
    if (!K.me()) { P().rk = { id: hex(16), tok: hex(32) }; G.Team.save(); }
    lastSub = -1e12; K.submit(); G.Audio.play('level'); return true;
  };
  K.leave = async () => {
    const me = K.me(); if (!me) return;
    P().rk = null; P().rkOff = 1; G.Team.save(); ranks = {}; ls('ranks', {});
    await req('/leave', { id: me.id, tok: me.tok }); lastPoll = -1e12;
  };
  K.tick = () => {
    if (!K.on()) return;
    const sc = G.UI.screen; if (sc === 'battle' || sc === 'intro' || sc === 'tap' || document.hidden) return;
    if (pend && K.joined() && !G.Team.dev && Date.now() - lastSub > (G.RANK_GAP + 1) * 1000) { K.submit(); return; }
    K.poll();
  };
  // ---- v2.8.1 管理（開發者模式）：隱藏／復原／永久刪除；密鑰存在這台裝置（leafwar_adm），不進存檔碼 ----
  K.admKey = () => { try { return localStorage.getItem('leafwar_adm') || ''; } catch (e) { return ''; } };
  K.adm = { list: null, busy: 0, err: '' };
  K.admLoad = async key => {
    const k = key || K.admKey(); if (!k || K.adm.busy) return false;
    K.adm.busy = 1; K.adm.err = '';
    let j; try { const r = await fetch(G.RANK_URL + '/admin/list?key=' + encodeURIComponent(k)); j = await r.json(); } catch (e) { j = { err: 'net' }; }
    K.adm.busy = 0;
    if (Array.isArray(j)) { K.adm.list = j; if (key) try { localStorage.setItem('leafwar_adm', key); } catch (e) { } return true; }
    K.adm.err = j.err === 'auth' ? '密鑰不對' : '連不上伺服器'; if (j.err === 'auth' && !key) try { localStorage.removeItem('leafwar_adm'); } catch (e) { }
    return false;
  };
  K.admAct = async (act, id, h) => {
    const j = await req('/admin/' + act, { key: K.admKey(), id, h }); if (!j.ok) { K.adm.err = '操作失敗'; return; }
    G.Audio.play(act === 'del' ? 'deny' : 'tick'); lastPoll = -1e12; await K.admLoad();
  };
  K._mock = () => {                                                              // 測試用：假資料（20 人、含長名字）
    const nm = ['葉子王', '小派', '阿明', '超級無敵大豌豆', 'Leafy99', '風之子', 'ABCDEFGH', '豆豆', '阿珠', '小樹苗', '火焰射手', '冰霜', '雷神', '阿傑', 'Mia', 'Ken', '老王', '小美', '長名字測試八', '路人'];
    const base = { heroes: [11, 0.5], minions: [18, 0.5], games: [300, 7], wr: [92.5, 2.3], kda: [9.87, 0.3], keys: [500, 13], dmg: [9876543, 400000], time: [360000, 9000], ach: [60, 2] }, cats = {};
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
  let quitT = 0, adm = false, askDel = null;
  const cw = G.UI.wheel();
  const cat = () => cw.idx();
  S.reset = () => { quitT = 0; adm = false; askDel = null; K().poll(true); };
  S.esc = () => { if (adm) { adm = false; return true; } return false; };
  S.cat = i => { cw.go(i); cw.pos = cw.tgt = i; cw.settled = true; };                         // 測試用
  S.adm = on => { adm = on; if (on) K().admLoad(); };                                         // 測試用
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
      if (rk[k] >= 1 && rk[k] <= 3) { c.fillStyle = P[0]; c.fillRect(xx + w2 - 7, yy + 1, 5, 5); c.fillStyle = P[13]; c.fillRect(xx + w2 - 6, yy + 2, 3, 3); }   // 自己在前三：黃點
      if (!ctr) { c.fillStyle = 'rgba(12,12,12,' + Math.min(0.55, ad * 0.3).toFixed(3) + ')'; c.fillRect(xx, yy, w2 + 1, bh + 1); }
      ui().tap('rkw' + i, xx, yy, w2, bh, () => { if (Math.abs(cw.pos - i) >= 0.5) cw.go(i); });
      H().tagWheel(cw);
    }
    c.restore();
    const ax = Math.round(Math.abs(Math.sin(gt * 4)) * 2); c.fillStyle = P[13];                // 左右黃色箭頭（和首頁一樣）
    for (let q = 0; q < 4; q++) { c.fillRect(x + 2 - ax + q, cy - 3 + q, 1, 7 - q * 2); c.fillRect(x + w - 3 + ax - q, cy - 3 + q, 1, 7 - q * 2); }
    return bot - top;
  }
  function badge(c, x, y, r) {
    if (r <= 3) { c.fillStyle = P[0]; c.fillRect(x, y, 13, 12); c.fillStyle = P[[13, 7, 14][r - 1]]; c.fillRect(x + 1, y + 1, 11, 10); G.text(c, String(r), x + 7, y + 4, 0, 0.5); }
    else G.cn(c, String(r), x + 6, y, 5, 0.5);
  }
  // 底部列：文字 1～2 行（高度跟著行數），右邊一顆按鈕
  function bar(c, x, B, W, lines, col, btn) {
    const tw = W - (btn ? 70 : 10), ls = [].concat(...lines.filter(Boolean).map(l => G.cnWrap(l, tw))).slice(0, 2), h = ls.length > 1 ? 32 : 22, by = B - h;
    H().box(c, x, by, W, h, 1, col, false);
    ls.forEach((l, i) => G.cn(c, l, x + 5, by + (ls.length > 1 ? 3 + i * 13 : 5), i === 0 ? 9 : 6));
    if (btn) { const bw = 56, bx = x + W - bw - 4, byy = by + Math.round((h - 15) / 2); (btn[3] ? ui().btnPrimary : ui().btnSecondary)(c, btn[0], bx, byy, bw, 15, btn[1], btn[2]); }
    return h;
  }
  S.draw = c => {
    const M = ui(); M.tick(); M.bg(c);
    const y0 = M.header(c, adm ? '管理玩家' : '排行榜'), I = R.ins, L = I.l, Rr = R.uw - I.r, B = R.uh - I.b, LD = R.uw > R.uh * 1.15, Kk = K(), b = Kk.board(), st = Kk.state(), me = Kk.me();
    const W = Math.min(Rr - L, 420), x = Math.round((L + Rr) / 2 - W / 2);
    if (adm) return admin(c, M, x, y0, W, B);
    // 標題列右邊：人數＋更新狀態
    const age = Kk.age(), stTxt = !Kk.on() ? '' : st === 'quota' ? '額度用完' : st === 'err' ? '連不上' : st === 'load' ? '讀取中' : age >= 0 ? (age < 3 ? '剛剛更新' : age + ' 秒前') : '';
    const hd = (b ? b.n + ' 人' : '') + (b && stTxt ? '・' : '') + stTxt; if (hd) G.cn(c, hd, Rr, I.t + 1, st === 'err' || st === 'quota' ? 10 : 6, 1);
    const k = G.RANK_CATS[cat()][0];
    let lx = x, lw = W, y = y0;
    if (LD) { wheel(c, x, y + 4, 96, 2); lx = x + 102; lw = W - 102; }
    else { y += wheel(c, x, y, W, 1) + 4; }
    // ---- 底部：我的名次＋參加／退出 ----
    let lines, btn = null, col = 3;
    if (G.Team.dev) { lines = ['開發者模式', '不上傳排行']; if (Kk.on()) btn = ['rkAdm', '管理玩家', () => { adm = true; askDel = null; Kk.admLoad(); G.Audio.play('open'); }]; }
    else if (!Kk.on()) lines = ['排行榜準備中'];
    else if (!Kk.joined()) { lines = Kk.name() ? ['參加後就能上榜', Kk.name()] : ['先存檔取個名字', '就能參加排行']; btn = Kk.name() ? ['rkJoin', '參加排行', () => Kk.join(), 1] : ['rkSave', '前往存檔', () => M.go('save'), 1]; }
    else {
      col = 13; const r = Kk.ranks()[k] || 0, my = Kk.mine(k), g = Kk.stats().games;
      if ((k === 'wr' || k === 'kda') && g < 10) lines = ['你：還沒上榜', '還差 ' + (10 - g) + ' 場才上榜'];
      else if (!r) lines = ['你：還沒上榜', '目前 ' + Kk.fmt(k, my)];
      else { const rt = '你：' + (r > 20 ? '20 名以外' : '第 ' + r + ' 名'), vt = Kk.fmt(k, my); lines = G.cnW(rt + '　' + vt) <= W - 70 ? [rt + '　' + vt] : [rt, '目前 ' + vt]; }
      const ask = quitT && Date.now() - quitT < 3000;
      btn = ['rkQuit', ask ? '確定退出' : '退出排行', () => { if (ask) { quitT = 0; Kk.leave(); } else quitT = Date.now(); G.Audio.play('tick'); }];
    }
    const bh = bar(c, x, B, W, lines, col, btn), listH = B - bh - 3 - y;
    // ---- 清單（每列固定 15 高；名字放不下用「…」）----
    const rows = b && b.cats[k] || [];
    if (!b || !rows.length) {
      const msg = !Kk.on() ? '排行榜準備中，敬請期待' : st === 'quota' ? '今天的排行額度用完了，早上 8 點恢復' : st === 'err' ? '暫時連不上排行榜，稍後會自動再試' : !b ? '讀取中…' : (k === 'wr' || k === 'kda') ? '還沒有人打滿 10 場，快來搶第一！' : '還沒有人上榜，快來搶第一！';
      G.cnWrap(msg, lw - 12).forEach((l, i) => G.cn(c, l, lx + lw / 2 - 3, y + 16 + i * 13, 6, 0.5));
      return;
    }
    M.scrollDetail(c, lx, y, lw - 6, listH, 'rk' + k, yy => {
      rows.forEach(([id, nm, v], i) => {
        if (yy + 15 <= y || yy >= y + listH) { yy += 16; return; }                          // 捲出清單範圍的列不畫
        const w = lw - 6, mine = me && id === me.id, vs = Kk.fmt(k, v), vw = G.cnW(vs);
        H().box(c, lx, yy, w, 14, 1, mine ? 13 : i < 3 ? [13, 7, 14][i] : 3, false);
        badge(c, lx + 3, yy + 1, i + 1);
        G.cn(c, ell(nm, w - 19 - vw - 10), lx + 19, yy + 1, mine ? 13 : 9);
        G.cn(c, vs, lx + w - 4, yy + 1, mine ? 13 : i < 3 ? 9 : 7, 1);
        yy += 16;
      });
      return yy;
    }, M.SM);
  };
  // ---- 管理玩家（開發者模式）：隱藏＝不出現在排行、可復原；刪除＝永久移除（要按兩下）----
  function admin(c, M, x, y, W, B) {
    const Kk = K(), A = Kk.adm, key = Kk.admKey();
    const bh = bar(c, x, B, W, ['隱藏可以復原', '刪除無法復原'], 3, ['rkAdmBk', '返回', () => { adm = false; askDel = null; G.Audio.play('click'); }]);
    if (!key || (!A.list && A.err === '密鑰不對')) {                                           // 第一次：貼上管理密鑰
      G.cnWrap('第一次使用請貼上管理密鑰（只存在這台裝置）', W - 8).forEach((l, i) => G.cn(c, l, x + 4, y + i * 13, 7));
      const iy = y + 30, e = G.Dom.place('adm', 'input', x + 4, iy, W - 72, 18, { ph: '管理密鑰', max: 64 });
      M.btnPrimary(c, 'rkAdmOk', x + W - 62, iy + 1, 58, 16, '確定', async () => { const v = (e.value || '').trim(); if (v && await Kk.admLoad(v)) { e.value = ''; G.Audio.play('level'); } else G.Audio.play('deny'); });
      if (A.err) G.cn(c, A.err, x + 4, iy + 24, 10);
      return;
    }
    if (!A.list) { G.cn(c, A.busy ? '讀取中…' : A.err || '讀取中…', x + W / 2, y + 16, A.err ? 10 : 6, 0.5); if (!A.busy && !A.err) Kk.admLoad(); return; }
    const hid = A.list.filter(p => p.hidden).length;
    G.cn(c, A.err || '共 ' + A.list.length + ' 人' + (hid ? '・隱藏 ' + hid : ''), x, y, A.err ? 10 : 13);   // 錯誤訊息直接取代人數，不並排
    const ly = y + 15, listH = B - bh - 3 - ly;
    M.scrollDetail(c, x, ly, W - 6, listH, 'rkadm', yy => {
      A.list.forEach(p => {
        if (yy + 15 <= ly || yy >= ly + listH) { yy += 16; return; }
        const w = W - 6, bw = 30, del = askDel && askDel.id === p.id && Date.now() - askDel.t < 3000, info = p.games + ' 場';
        H().box(c, x, yy, w, 14, 1, p.hidden ? 2 : 3, false);
        const iw = G.cnW(info), nx = x + 4, nmax = w - 4 - (bw * 2 + 6) - iw - 12;
        G.cn(c, ell(p.name, nmax), nx, yy + 1, p.hidden ? 4 : 9);
        G.cn(c, info, x + w - bw * 2 - 10, yy + 1, 5, 1);
        M.btnSecondary(c, 'ah' + p.id, x + w - bw * 2 - 4, yy + 1, bw, 12, p.hidden ? '復原' : '隱藏', () => Kk.admAct('hide', p.id, p.hidden ? 0 : 1));
        (del ? M.btnPrimary : M.btnSecondary)(c, 'ad' + p.id, x + w - bw - 2, yy + 1, bw, 12, del ? '確定' : '刪除', () => { if (del) { askDel = null; Kk.admAct('del', p.id); } else { askDel = { id: p.id, t: Date.now() }; G.Audio.play('tick'); } });
        yy += 16;
      });
      return yy;
    }, M.SM);
  }
  return S;
})();
G.Menus.rank = c => G.RankUI.draw(c);
