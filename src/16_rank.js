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
G.RankUI = (() => {
  const S = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, ui = () => G.Menus.ui, K = () => G.Rank;
  let cat = 0, quitT = 0;
  S.reset = () => { quitT = 0; K().poll(true); };
  S.esc = () => false;
  S.cat = i => { cat = i; };                                                     // 測試用
  // 分類格：直屏 3×3、橫屏左側一欄（每格同寬同高）
  function grid(c, x, y, w, cols) {
    const n = G.RANK_CATS.length, rows = Math.ceil(n / cols), cw = Math.floor(w / cols), ch = 15, rk = K().joined() ? K().ranks() : {};
    H().box(c, x, y, cw * cols, rows * ch, 0, 3, false);
    G.RANK_CATS.forEach(([k, sn], i) => {
      const xx = x + (i % cols) * cw, yy = y + Math.floor(i / cols) * ch, on = i === cat;
      if (on) H().box(c, xx + 1, yy + 1, cw - 2, ch - 2, 3, 9, false);
      G.cn(c, sn, xx + cw / 2, yy + 1, on ? 9 : 5, 0.5);
      if (rk[k] >= 1 && rk[k] <= 3) { c.fillStyle = P[0]; c.fillRect(xx + cw - 7, yy + 1, 5, 5); c.fillStyle = P[13]; c.fillRect(xx + cw - 6, yy + 2, 3, 3); }   // 自己在前三：黃點
      ui().tap('rkc' + i, xx, yy, cw, ch, () => { if (cat !== i) { cat = i; G.Audio.play('tick'); } });
    });
    return [cw * cols, rows * ch];
  }
  function badge(c, x, y, r) {
    if (r <= 3) { c.fillStyle = P[0]; c.fillRect(x, y, 13, 12); c.fillStyle = P[[13, 7, 14][r - 1]]; c.fillRect(x + 1, y + 1, 11, 10); G.text(c, String(r), x + 7, y + 4, 0, 0.5); }
    else G.cn(c, String(r), x + 6, y, 5, 0.5);
  }
  S.draw = c => {
    const M = ui(); M.tick(); M.bg(c);
    const y0 = M.header(c, '排行榜'), I = R.ins, L = I.l, Rr = R.uw - I.r, B = R.uh - I.b, LD = R.uw > R.uh * 1.15, Kk = K(), b = Kk.board(), st = Kk.state(), me = Kk.me();
    if (b) G.cn(c, '共 ' + b.n + ' 人', Rr, I.t + 1, 6, 1);
    const W = Math.min(Rr - L, 420), x = Math.round((L + Rr) / 2 - W / 2), [k, , full] = G.RANK_CATS[cat];
    let lx = x, lw = W, y = y0;
    if (LD) { const [gw] = grid(c, x, y, 96, 3); lx = x + gw + 6; lw = W - gw - 6; }
    else { const [, gh] = grid(c, x, y, W, 3); y += gh + 4; }
    // 清單標題：分類全名＋更新狀態
    const age = Kk.age(), stTxt = !Kk.on() ? '' : st === 'quota' ? '額度用完' : st === 'err' ? '連不上' : st === 'load' ? '讀取中' : age >= 0 ? (age < 3 ? '剛剛更新' : age + ' 秒前更新') : '';
    G.cn(c, full, lx, y, 13); if (stTxt) G.cn(c, stTxt, lx + lw - 6, y, st === 'ok' || st === 'idle' ? 5 : 10, 1);
    y += 15;
    const barH = 32, listH = B - barH - 3 - y;
    // ---- 清單 ----
    const rows = b && b.cats[k] || [];
    if (!b || !rows.length) {
      const msg = !Kk.on() ? '排行榜準備中，敬請期待' : st === 'quota' ? '今天的排行額度用完了，早上 8 點恢復' : st === 'err' ? '暫時連不上排行榜，稍後會自動再試' : !b ? '讀取中…' : (k === 'wr' || k === 'kda') ? '還沒有人打滿 10 場，快來搶第一！' : '還沒有人上榜，快來搶第一！';
      G.cnWrap(msg, lw - 12).forEach((l, i) => G.cn(c, l, lx + lw / 2 - 3, y + 16 + i * 13, 6, 0.5));
    } else {
      M.scrollDetail(c, lx, y, lw - 6, listH, 'rk' + k, yy => {
        rows.forEach(([id, nm, v], i) => {
          const w = lw - 6, mine = me && id === me.id, vs = Kk.fmt(k, v), vw = G.cnW(vs), avail = w - 21 - 5, two = G.cnW(nm) + vw + 8 > avail, hh = two ? 27 : 15;
          if (yy + hh <= y || yy >= y + listH) { yy += hh + 1; return; }      // 捲出清單範圍的列不畫（不會疊到底部名次列）
          H().box(c, lx, yy, w, hh - 1, 1, mine ? 13 : i < 3 ? [13, 7, 14][i] : 3, false);
          badge(c, lx + 3, yy + 1, i + 1);
          G.cnWrap(nm, avail).slice(0, 1).forEach(l => G.cn(c, l, lx + 19, yy + 1, mine ? 13 : 9));
          G.cn(c, vs, lx + w - 4, yy + 1 + (two ? 12 : 0), mine ? 13 : i < 3 ? 9 : 7, 1);
          yy += hh + 1;
        });
        return yy;
      }, M.SM);
    }
    // ---- 底部：我的名次＋參加／退出 ----
    const by = B - barH;
    H().box(c, x, by, W, barH, 1, me && Kk.joined() ? 13 : 3, false);
    const bw = 56, bx = x + W - bw - 4, tw = W - bw - 14;
    let l1, l2 = '';
    if (G.Team.dev) l1 = '開發者模式不上傳排行';
    else if (!Kk.on()) l1 = '排行榜準備中';
    else if (!Kk.joined()) { l1 = Kk.name() ? '參加後就能上榜' : '先存檔取個名字'; l2 = Kk.name() ? Kk.name() : '就能參加排行'; }
    else {
      const r = Kk.ranks()[k] || 0, my = Kk.mine(k);
      if ((k === 'wr' || k === 'kda') && Kk.stats().games < 10) { l1 = '你：還沒上榜'; l2 = '還差 ' + (10 - Kk.stats().games) + ' 場才上榜'; }
      else if (!r) { l1 = '你：還沒上榜'; l2 = '目前 ' + Kk.fmt(k, my); }
      else {
        const rt = '你：' + (r > 20 ? '20 名以外' : '第 ' + r + ' 名'), vt = Kk.fmt(k, my), up = r > 1 && r <= 21 && rows[r - 2] ? rows[r - 2][2] - my : 0;
        const gt2 = up > 0 ? '差上一名 ' + Kk.fmt(k, k === 'wr' || k === 'kda' ? up : Math.ceil(up)) : r === 1 ? '你是第一名！' : '';
        if (G.cnW(rt + '　' + vt) <= tw) { l1 = rt + '　' + vt; l2 = gt2; } else { l1 = rt; l2 = gt2 && G.cnW(gt2) <= tw ? gt2 : '目前 ' + vt; }   // 放不下就把數值換到第二行
      }
    }
    const ls1 = G.cnWrap(l1, tw), ls2 = l2 ? G.cnWrap(l2, tw) : [], all = ls1.length + ls2.length <= 2 ? ls1.concat(ls2) : ls1.slice(0, 2);   // 最多兩行：放不下就只留第一句
    all.forEach((l, i) => G.cn(c, l, x + 5, by + (all.length > 1 ? 3 + i * 13 : 10), i === 0 ? 9 : 6));
    if (!G.Team.dev && Kk.on()) {
      const byy = by + 8;
      if (!Kk.joined()) {
        if (Kk.name()) M.btnPrimary(c, 'rkJoin', bx, byy, bw, 15, '參加排行', () => Kk.join());
        else M.btnPrimary(c, 'rkSave', bx, byy, bw, 15, '前往存檔', () => M.go('save'));
      } else {
        const ask = quitT && Date.now() - quitT < 3000;
        M.btnSecondary(c, 'rkQuit', bx, byy, bw, 15, ask ? '確定退出' : '退出排行', () => { if (ask) { quitT = 0; Kk.leave(); G.Audio.play('tick'); } else { quitT = Date.now(); G.Audio.play('tick'); } });
      }
    }
  };
  return S;
})();
G.Menus.rank = c => G.RankUI.draw(c);
