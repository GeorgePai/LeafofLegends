// ============================================================
// v3.2 系統公告＋信箱（參考手遊的「公告／系統信」）
// - 開發者（開發者模式）在信箱按「發布」：標題、內容、附件鑰匙、有效天數、要不要跑馬燈
// - 在線玩家：/ping 戰鬥外每 30 秒、戰鬥中 60 秒（換畫面會提早）回傳最新公告 id → 發現新公告就拿清單，畫面上方跑馬燈播一次
// - 不在線的玩家：之後上線，首頁右上角信箱出現紅點，點開看；有附件就按「領取」（領過記在存檔裡，存檔碼會帶著）
// - 伺服器：GET /ann、/admin/ann、/admin/anndel（leaderboard/worker.js）
// ============================================================
G.Mail = (() => {
  const S = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, U = () => G.UI, ui = () => G.Menus.ui;
  const ls = (k, v) => { try { if (v === undefined) { const x = localStorage.getItem('leafwar_' + k); return x == null ? null : JSON.parse(x); } localStorage.setItem('leafwar_' + k, JSON.stringify(v)); } catch (e) { return null; } };
  let known = ls('annmax'), busy = 0, loadT = 0, cast = [], cur = null, sel = null, comp = null, askDel = 0, msg = null, sending = false;
  S.list = null;
  const readSet = () => new Set(ls('annread') || []);
  const markRead = id => { const s = readSet(); if (!s.has(id)) { s.add(id); ls('annread', [...s].slice(-200)); } };
  const got = () => { const p = G.Ach.P(); if (!Array.isArray(p.mailGot)) p.mailGot = []; return p.mailGot; };
  const flat = s => String(s || '').replace(/\s*\n+\s*/g, ' ');
  const when = t => { const d = new Date(t * 1000), z = n => String(n).padStart(2, '0'); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };
  const say = (s, col = 6) => { msg = { s, col, t: Date.now() }; };
  let want = 0, retryT = 0;   // v3.2.4 /ping 說有新公告但清單還沒拿到 → 10 秒後再拿一次
  async function load() {
    if (busy || !G.Rank || !G.Rank.on()) return; busy = 1; loadT = Date.now();
    let j; try { const r = await fetch(G.RANK_URL + '/ann?a=' + want + '&t=' + Date.now(), { cache: 'no-store' }); j = await r.json(); } catch (e) { j = null; } busy = 0;
    if (!j || !j.ok) { if (want > (known || 0)) retryT = Date.now() + 10000; return; }
    S.list = j.list || [];
    const mx = S.list.reduce((a, m) => Math.max(a, m.id), 0);
    retryT = want > mx ? Date.now() + 10000 : 0;
    if (known != null) S.list.filter(m => m.id > known && m.live).reverse().forEach(m => cast.push(m));   // 第一次開遊戲：舊公告不播跑馬燈，只亮紅點
    if (known == null || mx > known) { known = mx; ls('annmax', known); }
  }
  // /ping 回報最新公告 id
  S.seen = a => { if (a > want) want = a; if ((a && (known == null || a > known)) || (S.list == null && Date.now() - loadT > 60000)) load(); };
  S.open = () => sel != null;
  S.unread = () => { if (!S.list) return 0; const r = readSet(), g = got(); return S.list.filter(m => !r.has(m.id) || (m.keys > 0 && !g.includes(m.id))).length; };
  S.reset = () => { sel = null; comp = null; askDel = 0; msg = null; if (!S.list || Date.now() - loadT > 20000) load(); };
  S._cast = m => cast.push(m || { id: 0, title: '測試公告', body: '今晚 10 點伺服器維護 30 分鐘，維護完會發補償鑰匙，記得到信箱領取！', keys: 5, live: 1 });   // 測試用
  S._sel = id => { sel = id; };
  S._comp = () => { comp = { keys: 0, days: 7, live: 1 }; };
  S._set = list => { S.list = list; };

  // ---- 跑馬燈（所有畫面最上層；戰鬥中放在 HUD 下面，不能點）----
  S.drawCast = (c, dt) => {
    if (retryT && Date.now() > retryT && !busy) { retryT = 0; load(); }
    if (!cur && cast.length && U().screen !== 'intro' && U().screen !== 'tap') { cur = { m: cast.shift(), t: 0 }; G.Audio.play('open'); }
    if (!cur) return;
    cur.t += Math.min(dt, 0.05);
    const I = R.ins, uw = R.uw, bat = U().screen === 'battle', wide = uw > R.uh, mid = bat && wide;   // 橫屏戰鬥：夾在左上 HUD 和右上小地圖中間
    const bw = mid ? uw - I.r - 66 - (I.l + 112) : Math.min(uw - I.l - I.r - 8, 300), bx = mid ? I.l + 112 : Math.round(uw / 2 - bw / 2), by = mid ? I.t + 2 : bat ? Math.round(R.uh * 0.2) : I.t + 18, bh = 15;
    const txt = '【系統公告】' + cur.m.title + '：' + flat(cur.m.body), tw = G.cnW(txt), room = bw - 20, SP = 34;
    const dur = tw <= room ? 6 : 1.2 + (tw + room) / SP, a = Math.min(1, cur.t / 0.3, Math.max(0, (dur - cur.t) / 0.3));
    if (cur.t >= dur) { cur = null; return; }
    c.globalAlpha = a;
    c.fillStyle = 'rgba(12,10,6,0.86)'; c.fillRect(bx, by, bw, bh); c.fillStyle = P[13]; c.fillRect(bx, by, bw, 1); c.fillRect(bx, by + bh - 1, bw, 1);
    horn(c, bx + 4, by + 4);
    c.save(); c.beginPath(); c.rect(bx + 16, by, room, bh); c.clip();
    const tx = tw <= room ? bx + 16 : Math.round(bx + 16 + room - (cur.t - 0.6) * SP);
    { const e = G.cnImg(txt, 13); c.drawImage(e.c, Math.min(bx + 16 + (tw <= room ? 0 : room), tx) - 2, by); }   // 直接畫字圖（跑馬燈本來就會被裁切、蓋在畫面上，不進排版檢查）
    c.restore(); c.globalAlpha = 1;
    if (!bat) H().btn('castTap', bx, by, bw, bh, null, () => { const id = cur && cur.m.id; cur = null; if (id) { G.Menus.ui.go ? G.Menus.ui.go('mail') : (U().screen = 'mail'); S.reset(); sel = id; markRead(id); } });
  };
  // 小喇叭
  function horn(c, x, y) {
    const A = ['....9..', '..999.9', '9999...', '9999.99', '9999...', '..999.9', '....9..'];
    A.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '9') { c.fillStyle = P[13]; c.fillRect(x + i, y + j - 1, 1, 1); } });
  }

  // ---- 信箱畫面 ----
  function card(c, x, y, w, m, draw, r, g) {
    const unread = !r.has(m.id), att = m.keys > 0, claimed = g.includes(m.id), hh = 32;
    if (!draw) return y + hh + 4;
    H().box(c, x, y, w, hh, 1, unread ? 13 : 3, false);
    if (unread) { c.fillStyle = P[10]; c.fillRect(x + 4, y + 6, 3, 3); }
    const at = att ? (claimed ? '已領' : '×' + m.keys) : '', aw = att ? G.cnW(at) + 12 : 0, d = new Date(m.t * 1000), dt = (d.getMonth() + 1) + '/' + d.getDate();
    G.cn(c, ell(m.title, w - 14 - aw), x + 10, y + 3, unread ? 13 : 9);
    if (att) { H().icon(c, 'i_key', x + w - aw + 2, y + 9); G.cn(c, at, x + w - 4, y + 3, claimed ? 4 : 13, 1); }
    G.cn(c, dt, x + 10, y + 17, 4); G.cn(c, ell(flat(m.body), w - 18 - G.cnW(dt) - 6), x + 16 + G.cnW(dt), y + 17, 6);
    return y + hh + 4;
  }
  const ell = (s, mw) => { if (G.cnW(s) <= mw) return s; const a = [...s]; while (a.length > 1 && G.cnW(a.join('') + '…') > mw) a.pop(); return a.join('') + '…'; };
  S.draw = c => {
    const M = ui(); M.tick(); M.bg(c);
    const dev = G.Team.dev, y0 = M.header(c, '信箱'), I = R.ins, L = I.l, Rr = R.uw - I.r, B = R.uh - I.b;
    const W = Math.min(Rr - L, 420), x = Math.round((L + Rr) / 2 - W / 2);
    if (!G.Rank || !G.Rank.on()) { G.cn(c, '伺服器準備中，敬請期待', x + W / 2, y0 + 20, 6, 0.5); return; }
    if (dev) M.btnPrimary(c, 'mlNew', Rr - 44, I.t, 44, 14, '發布', () => { comp = { keys: 0, days: 7, live: 1 }; msg = null; G.Dom.get('mailT', 'input').value = ''; G.Dom.get('mailB', 'textarea').value = ''; G.Audio.play('open'); });
    const list = S.list, r = readSet(), g = got();
    if (!list) G.cn(c, busy ? '讀取中…' : '連不上伺服器', x + W / 2, y0 + 16, 6, 0.5);
    else if (!list.length) G.cn(c, '目前沒有公告', x + W / 2, y0 + 16, 6, 0.5);
    else M.scrollDetail(c, x, y0, W - 6, B - y0, 'mail', yy => {
      list.forEach(m => { const ny = card(c, x, yy, W - 6, m, false, r, g); if (ny > y0 && yy < B) { card(c, x, yy, W - 6, m, true, r, g); M.tap('ml' + m.id, x, yy, W - 6, ny - yy - 4, () => { sel = m.id; askDel = 0; msg = null; markRead(m.id); G.Audio.play('tick'); }); } yy = ny; });
      return yy;
    }, M.SM);
    if (sel != null) detail(c, M, list && list.find(m => m.id === sel));
    if (comp) compose(c, M);
  };
  // 一封公告的內容（彈窗）
  function detail(c, M, m) {
    if (!m) { sel = null; return; }
    const uw = R.uw, uh = R.uh, I = R.ins, w = Math.min(uw - 16, 280), x = Math.round(uw / 2 - w / 2), dev = G.Team.dev, att = m.keys > 0, claimed = got().includes(m.id);
    const bl = G.cnWrap(m.body, w - 20), tl = G.cnWrap(m.title, w - 20), left = Math.max(0, Math.ceil((m.exp - Date.now() / 1000) / 86400));
    const foot = (att ? 22 : 0) + 24 + (msg ? 13 : 0), maxH = uh - I.t - I.b - 12, bodyH = Math.min(bl.length * 13 + 4, maxH - 8 - tl.length * 13 - 16 - foot), h = 8 + tl.length * 13 + 16 + bodyH + foot, y = Math.round(uh / 2 - h / 2);
    H().btn('mlBg', 0, 0, uw, uh, null, () => { sel = null; }); H().dim(c, 0.7);
    H().box(c, x, y, w, h, 1, 13); H().btn('mlIn', x, y, w, h, null, null);
    let yy = y + 6; tl.forEach(l => { G.cn(c, l, x + 10, yy, 13); yy += 13; });
    G.cn(c, when(m.t) + '・還有 ' + left + ' 天', x + 10, yy + 1, 4); yy += 16;
    M.scrollDetail(c, x + 10, yy, w - 24, bodyH, 'mlb' + m.id, ty => { bl.forEach(l => { G.cn(c, l, x + 10, ty, 9); ty += 13; }); return ty; }, M.SD);
    yy += bodyH;
    if (att) {
      c.fillStyle = P[3]; c.fillRect(x + 10, yy + 1, w - 20, 1);
      H().icon(c, 'i_key', x + 16, yy + 12); G.cn(c, '鑰匙 ×' + m.keys, x + 24, yy + 6, 13);
      const bw = 52; if (claimed) G.cn(c, '已領取', x + w - 10, yy + 6, 4, 1);
      else M.btnPrimary(c, 'mlGet', x + w - 10 - bw, yy + 4, bw, 15, '領取', () => { G.Team.addKeys(m.keys); got().push(m.id); G.Team.save(); G.Audio.play('coin'); say(G.Team.dev ? '開發者模式：鑰匙不增減' : '已領取 ' + m.keys + ' 把鑰匙', 11); });
      yy += 22;
    }
    if (msg) { G.cn(c, msg.s, x + w / 2, yy + 2, msg.col, 0.5); yy += 13; }
    const bw = 60;
    if (dev) { const ask = askDel && Date.now() - askDel < 3000;
      (ask ? M.btnPrimary : M.btnSecondary)(c, 'mlDel', x + 10, y + h - 21, bw, 16, ask ? '確定刪除' : '刪除', async () => { if (!ask) { askDel = Date.now(); G.Audio.play('tick'); return; } askDel = 0; const j = await post('/admin/anndel', { id: m.id }); if (j.ok) { sel = null; G.Audio.play('deny'); await load(); } else say('刪除失敗', 10); }); }
    M.btnSecondary(c, 'mlOk', dev ? x + w - 10 - bw : Math.round(x + w / 2 - bw / 2), y + h - 21, bw, 16, '關閉', () => { sel = null; });
  }
  async function post(path, body) {
    try { const r = await fetch(G.RANK_URL + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ key: G.Rank.admKey() }, body)) }); return await r.json(); } catch (e) { return { err: 'net' }; }
  }
  // 發布公告（開發者）
  function compose(c, M) {
    const uw = R.uw, uh = R.uh, I = R.ins, w = Math.min(uw - 16, 300), th = Math.max(40, Math.min(90, uh - I.t - I.b - 190));
    const h = 6 + 16 + 22 + 14 + th + 8 + 18 + 18 + 20 + 13 + 16 + 8, x = Math.round(uw / 2 - w / 2), y = Math.max(I.t + 4, Math.round(uh / 2 - h / 2));
    H().btn('mcBg', 0, 0, uw, uh, null, null); H().dim(c, 0.75);
    H().box(c, x, y, w, h, 1, 13); H().btn('mcIn', x, y, w, h, null, null);
    let yy = y + 6; G.cn(c, '發布系統公告', x + 10, yy, 13); yy += 16;
    const te = G.Dom.place('mailT', 'input', x + 11, yy, w - 22, 16, { ph: '標題（最多 20 字）', max: 20 }); H().box(c, x + 10, yy - 1, w - 20, 18, 0, 13, false); yy += 22;
    const be = G.Dom.place('mailB', 'textarea', x + 11, yy + 14, w - 22, th, { ph: '內容（最多 300 字）', max: 300 }); G.cn(c, '內容', x + 10, yy, 6); G.cn(c, [...be.value].length + '/300', x + w - 10, yy, 5, 1);
    H().box(c, x + 10, yy + 13, w - 20, th + 2, 0, 13, false); yy += 14 + th + 8;
    const cw = 82, sx = x + w - 10 - cw;
    const step = (id, lab, v, lo, hi, set, unit) => {
      G.cn(c, lab, x + 10, yy + 2, 7);
      M.btnSecondary(c, id + 'm', sx, yy, 18, 15, '−', () => { set(Math.max(lo, v - 1)); G.Audio.play('tick'); });
      G.cn(c, v + unit, sx + cw / 2, yy + 2, 9, 0.5);
      M.btnSecondary(c, id + 'p', sx + cw - 18, yy, 18, 15, '＋', () => { set(Math.min(hi, v + 1)); G.Audio.play('tick'); });
      yy += 18;
    };
    step('mcK', '附件鑰匙', comp.keys, 0, 50, v => { comp.keys = v; }, ' 把');
    step('mcD', '有效天數', comp.days, 1, 30, v => { comp.days = v; }, ' 天');
    G.cn(c, '跑馬燈', x + 10, yy + 2, 7);
    M.btnSecondary(c, 'mcL', sx, yy, cw, 15, comp.live ? '播放' : '不播', () => { comp.live = comp.live ? 0 : 1; G.Audio.play('tick'); }); yy += 20;
    if (msg) G.cnWrap(msg.s, w - 20).slice(0, 1).forEach(l => G.cn(c, l, x + w / 2, yy, msg.col, 0.5));
    const bw = 64, by = y + h - 24;
    M.btnSecondary(c, 'mcNo', x + 10, by, bw, 16, '取消', () => { comp = null; msg = null; });
    M.btnPrimary(c, 'mcGo', x + w - 10 - bw, by, bw, 16, sending ? '送出中' : '發布', async () => {
      if (sending) return; const title = te.value.trim(), body = be.value.trim();
      if (!title || !body) { say('標題和內容都要寫', 10); G.UI.h.deny('mcGo'); return; }
      sending = true; const j = await post('/admin/ann', { title, body, keys: comp.keys, days: comp.days, live: comp.live }); sending = false;
      if (j.ok) { comp = null; msg = null; G.Audio.play('coin'); await load(); }
      else { say(j.err === 'auth' ? '密碼錯誤，請重新開啟開發者模式' : j.err === 'len' ? '標題或內容太長' : '連不上伺服器', 10); G.Audio.play('deny'); }
    });
  }
  return S;
})();
G.Menus.mail = c => G.Mail.draw(c);
