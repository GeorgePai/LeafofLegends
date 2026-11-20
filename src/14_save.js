'use strict';
/* =========================================================
   存檔碼：把所有進度（角色、鑰匙、隊伍、成就、累計數據、名稱）打包成一串文字
   格式：LW1Z-<base64url(deflate(JSON))>-<4 碼檢查碼>（瀏覽器不支援壓縮時用 LW1P，不壓縮）
   ========================================================= */
G.SaveCode = (() => {
  const S = {};
  const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const s = atob(str), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  const sum = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return (h % 1679616).toString(36).toUpperCase().padStart(4, '0'); };
  const pipe = async (bytes, Stream, fmt) => { const s = new Blob([bytes]).stream().pipeThrough(new Stream(fmt)); return new Uint8Array(await new Response(s).arrayBuffer()); };
  S.make = async () => {
    const v = G.Team.get(); G.Ach.P();
    const json = JSON.stringify({ s: 1, v: { name: v.name || '', hero: v.hero, loadout: v.loadout, owned: v.owned, keys: v.keys, p: v.p, ach: v.ach } });
    let raw = new TextEncoder().encode(json), mode = 'P';
    try { if (window.CompressionStream) { raw = await pipe(raw, CompressionStream, 'deflate-raw'); mode = 'Z'; } } catch (e) { mode = 'P'; raw = new TextEncoder().encode(json); }
    const body = b64u(raw);
    return 'LW1' + mode + '-' + body + '-' + sum(body);
  };
  // 讀取：回傳 { ok, v } 或 { ok:false, err }
  S.read = async code => {
    const s = String(code || '').replace(/\s+/g, '');
    if (!s) return { ok: false, err: '請先貼上存檔碼' };
    const m = /^LW1([ZP])-([A-Za-z0-9_-]+)-([0-9A-Z]{4})$/.exec(s);
    if (!m) return { ok: false, err: '這不是 Leaf of Legends 的存檔碼' };
    if (sum(m[2]) !== m[3]) return { ok: false, err: '存檔碼不完整，請確認有完整複製' };
    try {
      let bytes = unb64u(m[2]);
      if (m[1] === 'Z') { if (!window.DecompressionStream) return { ok: false, err: '這個瀏覽器無法讀取壓縮存檔' }; bytes = await pipe(bytes, DecompressionStream, 'deflate-raw'); }
      const d = JSON.parse(new TextDecoder().decode(bytes));
      const v = S.clean(d && d.v); if (!v) return { ok: false, err: '存檔內容有誤' };
      return { ok: true, v };
    } catch (e) { return { ok: false, err: '存檔碼損毀，無法讀取' }; }
  };
  // 檢查並整理資料（不存在的角色、異常數值一律剔除）
  S.clean = v => {
    if (!v || typeof v !== 'object' || !v.owned) return null;
    const HN = G.HEROES.map(h => h.name), MN = G.ROSTER.minions;
    const out = {
      name: String(v.name || '').slice(0, 8),
      hero: G.clamp(v.hero | 0, 0, G.HEROES.length - 1),
      loadout: (Array.isArray(v.loadout) ? v.loadout : []).filter(e => e && G.ORIG.units[e.n]).map(e => ({ n: e.n, l: G.clamp(e.l | 0, 0, 2) })),
      owned: { h: [...new Set((v.owned.h || []).filter(n => HN.includes(n)))], m: [...new Set((v.owned.m || []).filter(n => MN.includes(n)))] },
      keys: G.clamp(Math.floor(+v.keys || 0), 0, 99999),
      p: v.p && typeof v.p === 'object' ? v.p : {},
      ach: {}
    };
    for (const k in v.ach || {}) if (G.ACH_BY[k] && (v.ach[k] === 1 || v.ach[k] === 2)) out.ach[k] = v.ach[k];
    for (const k in out.p) { const x = out.p[k]; if (typeof x === 'number' && !(x >= 0)) out.p[k] = 0; }
    if (!out.owned.h.length) out.owned.h = HN.filter(n => G.rarityOf(n) === 0);
    if (!out.owned.m.length) out.owned.m = MN.filter(n => G.rarityOf(n) === 0);
    return out;
  };
  S.summary = v => {
    const p = v.p || {}, t = Math.floor((p.time || 0) / 60), ach = Object.keys(v.ach || {}).length;
    return [['鑰匙', String(v.keys)], ['英雄', v.owned.h.length + '/' + G.HEROES.length], ['小兵', v.owned.m.length + '/' + G.ROSTER.minions.length], ['成就', ach + '/' + G.ACH.length], ['戰鬥時間', (t >= 60 ? ((t / 60) | 0) + '小時' : '') + (t % 60) + '分']];
  };
  S.apply = v => {
    const T = G.Team; T.v = Object.assign({ hero: 0, loadout: [], keys: 0 }, v); T.sanitize(true); G.Ach.P(); T.save();
  };
  return S;
})();

// ---------- 疊在 canvas 上的 HTML 輸入框（名稱、存檔碼）：每幀依 UI 座標擺放，沒用到就隱藏 ----------
G.Dom = (() => {
  const D = {}, els = {};
  const css = 'position:fixed;z-index:5;box-sizing:border-box;margin:0;padding:4px 6px;background:#151515;color:#eeeeee;border:none;outline:none;border-radius:0;'
    + '-webkit-appearance:none;appearance:none;resize:none;font-family:Cubic11,monospace;line-height:1.25;word-break:break-all;overflow-wrap:anywhere;-webkit-user-select:text;user-select:text;display:none;';
  D.get = (id, tag) => {
    if (els[id]) return els[id];
    const e = document.createElement(tag); e.style.cssText = css; e.spellcheck = false; e.autocomplete = 'off'; e.setAttribute('autocapitalize', 'off'); e.setAttribute('autocorrect', 'off');
    e.addEventListener('pointerdown', ev => ev.stopPropagation());
    document.body.appendChild(e); els[id] = e; return e;
  };
  D.begin = () => { for (const k in els) els[k]._used = false; };
  D.place = (id, tag, x, y, w, h, opt = {}) => {
    const e = D.get(id, tag), R = G.Render, k = R.uiS / R.dpr;
    e._used = true;
    const st = e.style; st.display = 'block';
    st.left = Math.round(R.cssX + x * k) + 'px'; st.top = Math.round(R.cssY + y * k) + 'px'; st.width = Math.round(w * k) + 'px'; st.height = Math.round(h * k) + 'px';
    st.fontSize = Math.max(10, Math.round(12 * k)) + 'px'; st.padding = Math.round(3 * k) + 'px ' + Math.round(4 * k) + 'px';
    if (opt.ph != null && e.placeholder !== opt.ph) e.placeholder = opt.ph;
    if (opt.ro != null) e.readOnly = !!opt.ro;
    if (opt.max) e.maxLength = opt.max;
    st.color = opt.ro ? '#f2d24a' : '#eeeeee';
    return e;
  };
  D.end = () => { for (const k in els) { const e = els[k]; if (!e._used && e.style.display !== 'none') { if (document.activeElement === e) e.blur(); e.style.display = 'none'; } } };
  D.el = id => els[id];
  return D;
})();

// ---------- 存檔畫面 ----------
G.SaveUI = (() => {
  const S = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, U = () => G.UI, ui = () => G.Menus.ui;
  let step = 'home', msg = null, code = '', pend = null, copied = 0, busy = false, copiedOnce = false, askDel = 0, working = false;
  S.welcome = null; S.greet = null;
  S.reset = () => { step = 'home'; msg = null; pend = null; copied = 0; busy = false; askDel = 0; working = false; };
  S.go = st => { step = st; msg = null; if (st === 'out' || st === 'kick') prepOut(); };   // 測試用
  // v2.8.7 一帳號同時一台：被別台登入 → 帶到帳號畫面，先給這台的存檔碼（萬一這台進度比較新），再登出
  S.kicked = () => { if (step === 'kick' && G.UI.screen === 'save') return; G.Menus.ui.go('save'); step = 'kick'; msg = null; pend = null; prepOut(); G.Audio.play('deny'); };   // go('save') 會 reset，所以先切畫面再設 step
  S.esc = () => { if (step === 'kick') return true; if (step === 'home') return false; step = step === 'confirm' ? 'load' : (step === 'out' || step === 'del') ? 'acct' : 'home'; msg = null; return true; };
  const say = (s, col = 10) => { msg = { s, col, t: 0 }; };
  // iPhone／iPad 用 Safari 開（還沒加到主畫面）時，提醒「加入主畫面」：Safari 7 天沒玩會清掉網站資料，主畫面版不受影響
  S.forceIos = false;
  S.iosTip = () => { if (S.forceIos) return true; const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); const sa = navigator.standalone || matchMedia('(display-mode: standalone)').matches; return ios && !sa; };
  function iosCard(c, x, y, w) {
    const ls = G.cnWrap('iPhone 建議「加入主畫面」遊玩，進度更不容易遺失', w - 26), hh = 6 + ls.length * 13 + 4;
    H().box(c, x, y, w, hh, 0, 13, false);
    c.drawImage(G.SPR.leaf_pt.n, x + 7, y + Math.round(hh / 2) - 3);
    ls.forEach((l, i) => G.cn(c, l, x + 18, y + 4 + i * 13, 13));
    return y + hh;
  }
  // 存檔資訊卡：名稱＋數據列
  function infoCard(c, x, y, w, name, rows) {
    const nm = name || '尚未設定', two = G.cnW('玩家名稱') + G.cnW(nm) + 16 > w, ex = two ? 13 : 0;   // 名字放不下 → 換到下一行
    const cols = w >= 220 ? 2 : 1, nr = Math.ceil(rows.length / cols), hh = 22 + ex + nr * 13 + 4;
    H().box(c, x, y, w, hh, 0, 4, false);
    G.cn(c, '玩家名稱', x + 5, y + 3, 6); G.cn(c, nm, two ? x + 5 : x + w - 5, y + 3 + ex, name ? 13 : 4, two ? 0 : 1);
    c.fillStyle = P[2]; c.fillRect(x + 4, y + 18 + ex, w - 8, 1);
    const cw = Math.floor((w - 10 - (cols - 1) * 10) / cols);
    rows.forEach(([k, v], i) => { const col = (i / nr) | 0, r = i % nr, rx = x + 5 + col * (cw + 10), ry = y + 21 + ex + r * 13; G.cn(c, k, rx, ry, 6); G.cn(c, v, rx + cw, ry, 9, 1); });
    return y + hh;
  }
  // 大按鈕卡：圖示＋標題＋一行說明
  function actCard(c, id, x, y, w, ic, t, sub, fn, col = 7) {
    const M = ui(), o = M.pr(id) ? 1 : 0, ls = G.cnWrap(sub, w - 34), hh = 18 + ls.length * 12 + 4;
    H().key(c, x, y + o, w, hh, o, col);
    H().icon(c, ic, x + 14, y + Math.round(hh / 2) + o);
    G.cn(c, t, x + 28, y + 3 + o, 9); ls.forEach((l, i) => G.cn(c, l, x + 28, y + 17 + i * 12 + o, 6));
    M.tap(id, x, y, w, hh, fn);
    return y + hh;
  }
  const btnRow = (c, x, y, w, a, b) => {      // 左：次要；右：主要
    const M = ui(), bw = Math.floor((w - 6) / 2);
    M.btnSecondary(c, a[0], x, y, bw, 18, a[1], a[2]);
    M.btnPrimary(c, b[0], x + bw + 6, y, bw, 18, b[1], b[2]);
    return y + 22;
  };
  const centerTitle = (c, x, w, y, t, sub) => { G.cn(c, t, x + w / 2, y, 13, 0.5); y += 15; if (sub) { const ls = G.cnWrap(sub, w); ls.forEach((l, i) => G.cn(c, l, x + w / 2, y + i * 13, 6, 0.5)); y += ls.length * 13; } return y + 4; };
  // v2.8.3＋：存檔碼保存提醒（黃框，一定看得到）
  function keepCard(c, x, y, w, s2) {
    const ls = G.cnWrap(s2 || '請把存檔碼存好（貼到記事本、截圖或傳給自己）。遺失就找不回進度！', w - 22), hh = 6 + ls.length * 13 + 2;
    H().box(c, x, y, w, hh, 0, 13, false);
    H().icon(c, 'i_save', x + 9, y + Math.round(hh / 2));
    ls.forEach((l, i) => G.cn(c, l, x + 17, y + 4 + i * 13, 13));
    return y + hh;
  }
  // v2.8.4 帳號：登出／刪除後回到新玩家（和首頁 RESET 一樣清空本機）
  function wipe(txt) {
    try { localStorage.removeItem('leafwar_team'); } catch (e) { }
    G.Team.v = null; G.Team.get(); G.Menus.ui.resetCars(); if (G.Rank) G.Rank.forget();
    step = 'home'; msg = null; code = ''; askDel = 0; working = false; S.greet = null;
    G.Menus.ui.go('menu'); U().goMenu(); G.Ach.queueBanner({ rk: { s: txt, col: 9 }, t: 0 }); G.Audio.play('open');
  }
  async function prepOut() { copiedOnce = false; code = ''; busy = true; code = await G.SaveCode.make(); busy = false; const e = G.Dom.get('code', 'textarea'); e.value = code; e.scrollTop = 0; }
  async function doDelete() {
    if (working) return; working = true; say('刪除中…', 13);
    const j = G.Rank ? await G.Rank.remove() : { ok: 1 }; working = false;
    if (!j.ok) { say('連不上伺服器，請稍後再試（帳號還沒刪除）', 10); G.Audio.play('deny'); askDel = 0; return; }
    wipe('帳號已刪除');
  }
  async function makeCode() {
    busy = true; code = await G.SaveCode.make(); busy = false; step = 'code'; copied = 0; msg = null; G.Ach.on('code'); if (G.Rank) G.Rank.autoJoin();
    const e = G.Dom.get('code', 'textarea'); e.value = code; e.scrollTop = 0;
  }
  async function copyCode() {
    const e = G.Dom.el('code'); let ok = false;
    try { await navigator.clipboard.writeText(code); ok = true; } catch (err) { }
    if (!ok && e) { try { e.readOnly = false; e.focus(); e.select(); e.setSelectionRange(0, code.length); ok = document.execCommand('copy'); e.readOnly = true; } catch (err) { } }
    copiedOnce = true;
    if (ok) { copied = 1.6; G.Audio.play('coin'); say('已複製！記得貼到安全的地方保存', 11); } else { if (e) { e.focus(); e.select(); } say(isDesk() ? '已選取，按 Cmd+C（Windows 按 Ctrl+C）複製' : '已選取，選「拷貝」即可', 13); }
  }
  // 貼上：先試著直接讀剪貼簿；瀏覽器不允許時，把游標放進輸入框，按 Cmd+V／Ctrl+V 即可（貼上後自動讀取）
  const isDesk = () => !matchMedia('(pointer: coarse)').matches;
  async function pasteCode() {
    const e = G.Dom.get('load', 'textarea');
    try { if (navigator.clipboard && navigator.clipboard.readText) { const t = await navigator.clipboard.readText(); if (t && t.trim()) { e.value = t.trim(); G.Audio.play('tick'); readCode(); return; } } } catch (err) { }
    e.focus(); e.select();
    let ok = false; try { ok = document.execCommand('paste'); } catch (err) { }
    if (ok && e.value.trim()) { readCode(); return; }
    say(isDesk() ? '按 Cmd+V（Windows 按 Ctrl+V）就會貼上' : '點一下輸入框，選「貼上」', 13);
  }
  S.onPaste = txt => {                 // 讀取頁面上任何地方按 Cmd+V／Ctrl+V 都收得到
    if (G.UI.screen !== 'save' || step !== 'load' || !txt) return false;
    const e = G.Dom.get('load', 'textarea'); e.value = txt.trim(); G.Audio.play('tick'); readCode(); return true;
  };
  S.onInput = () => { const e = G.Dom.el('load'); if (step === 'load' && e && /^LW1[ZP]-/.test(e.value.trim()) && /-[0-9A-Z]{4}\s*$/.test(e.value)) readCode(); };   // 貼進去就自動讀取
  let reading = false;
  async function readCode() {
    if (reading || step !== 'load') return; reading = true;
    const e = G.Dom.el('load'), r = await G.SaveCode.read(e ? e.value : ''); reading = false;
    if (!r.ok) { say(r.err, 10); G.Audio.play('deny'); return; }
    pend = r.v; step = 'confirm'; msg = null; G.Audio.play('open');
  }
  function doLoad() {
    G.SaveCode.apply(pend); pend = null; G.Menus.ui.resetCars(); if (G.Rank) G.Rank.forget();
    G.Menus.ui.go('menu'); U().goMenu();
    S.welcome = { t: 0, name: G.Team.get().name || '玩家', parts: [] }; G.Audio.play('fanfare');
  }
  S.draw = c => {
    const M = ui(); M.tick(); M.bg(c);
    const y0 = M.header(c, '帳號'), I = R.ins, L = I.l, Rr = R.uw - I.r, B = R.uh - I.b, LD = M.land(), dt = G.Menus.dt || 1 / 60;
    if (S.gift) { drawGift(c); return; }                                                     // v3.3 建帳號送鑰匙動畫（不畫輸入框，HTML 框自動隱藏）
    copied = Math.max(0, copied - dt); if (msg) msg.t += dt;
    const W = Math.min(Rr - L, LD ? 420 : 300), x = Math.round((L + Rr) / 2 - W / 2), v = G.Team.get();
    let y = y0;
    if (step === 'home') {
      G.Ach.P();
      if (LD) {
        const lw = Math.round(W * 0.48), rx = x + lw + 8, rw = W - lw - 8;
        const iy = infoCard(c, x, y, lw, v.name, G.SaveCode.summary(v));
        if (S.iosTip()) iosCard(c, x, iy + 6, lw);
        let yy = actCard(c, 'svMake', rx, y, rw, 'i_save', '產生存檔碼', '存成一串文字', () => { step = 'name'; msg = null; const e = G.Dom.get('name', 'input'); e.value = v.name || ''; });
        yy = actCard(c, 'svLoad', rx, yy + 6, rw, 'i_paste', '讀取存檔碼', '貼上就能還原進度', () => { step = 'load'; msg = null; const e = G.Dom.get('load', 'textarea'); e.value = ''; if (isDesk()) setTimeout(() => e.focus(), 60); });
        if (v.name) yy = actCard(c, 'svAcct', rx, yy + 6, rw, 'i_gear', '帳號管理', '改名、登出、刪除帳號', () => { step = 'acct'; msg = null; askDel = 0; });
        const fl = G.cnWrap('存檔碼可以跨裝置使用', rw); fl.forEach((l, i) => G.cn(c, l, rx, yy + 8 + i * 13, 4));

      } else {
        y = infoCard(c, x, y, W, v.name, G.SaveCode.summary(v)) + 8;
        y = actCard(c, 'svMake', x, y, W, 'i_save', '產生存檔碼', '存成一串文字', () => { step = 'name'; msg = null; const e = G.Dom.get('name', 'input'); e.value = v.name || ''; }) + 6;
        y = actCard(c, 'svLoad', x, y, W, 'i_paste', '讀取存檔碼', '貼上就能還原進度', () => { step = 'load'; msg = null; const e = G.Dom.get('load', 'textarea'); e.value = ''; if (isDesk()) setTimeout(() => e.focus(), 60); }) + 8;
        if (v.name) y = actCard(c, 'svAcct', x, y - 2, W, 'i_gear', '帳號管理', '改名、登出、刪除帳號', () => { step = 'acct'; msg = null; askDel = 0; }) + 8;
        const fl = G.cnWrap('存檔碼可以跨裝置使用', W); fl.forEach((l, i) => G.cn(c, l, x + W / 2, y + i * 13, 4, 0.5));
        if (S.iosTip()) iosCard(c, x, y + fl.length * 13 + 6, W);
      }
    } else if (step === 'name') {
      y = centerTitle(c, x, W, y + 2, '取個玩家名稱', '排行榜和打招呼都會用這個名字');
      H().box(c, x, y, W, 22, 0, 13, false);
      const e = G.Dom.place('name', 'input', x + 1, y + 1, W - 2, 20, { ph: '最多 8 個字', max: 8 });
      const n = [...(e.value || '')].length; G.text(c, n + '/8', x + W, y + 26, n ? 6 : 4, 1, null, 1);
      y += 36;
      btnRow(c, x, y, W, ['svBack', '返回', () => { step = 'home'; msg = null; }], ['svNext', busy ? '產生中' : '下一步', () => {
        const nm = (e.value || '').trim().slice(0, 8);
        if (!nm) { say('請輸入名字'); G.UI.h.deny('svNext'); return; }
        v.name = nm; G.Team.save(); e.blur(); if (!busy) { grant(); makeCode(); }
      }]);
      y += 24;
    } else if (step === 'code') {
      y = centerTitle(c, x, W, y + 2, '存檔碼', '玩家名稱：' + (v.name || ''));
      const th = LD ? Math.max(40, Math.min(70, B - y - 58)) : 78;
      H().box(c, x, y, W, th + 2, 0, 13, false);
      const e = G.Dom.place('code', 'textarea', x + 1, y + 1, W - 2, th, { ro: true }); if (e.value !== code) e.value = code;
      y += th + 6;
      y = keepCard(c, x, y, W) + 6;                                                            // v2.8.4 提醒保存存檔碼
      btnRow(c, x, y, W, ['svDone', '完成', () => { step = 'home'; msg = null; }], ['svCopy', copied > 0 ? '已複製！' : '複製', () => copyCode()]);
      y += 24;
      if (!(msg && msg.t < 3.2)) G.cnWrap('之後在「讀取存檔碼」貼上，就能還原進度。', W).forEach((l, i) => G.cn(c, l, x + W / 2, y + i * 13, 4, 0.5));   // 有訊息時先顯示訊息
    } else if (step === 'acct') {                                                              // v2.8.4 帳號管理
      const id = G.Rank ? G.Rank.uid() : '';
      y = infoCard(c, x, y, W, v.name, [['玩家 ID', id || '尚未上榜']]) + 8;
      y = actCard(c, 'svRename', x, y, W, 'i_pen', '改名', '排行榜上的名字會一起更新，紀錄都保留', () => { step = 'name'; msg = null; const e = G.Dom.get('name', 'input'); e.value = v.name || ''; }) + 6;
      y = actCard(c, 'svOut', x, y, W, 'i_out', '登出', '回到新玩家。之後用存檔碼就能登入回來', () => { step = 'out'; msg = null; prepOut(); }) + 6;
      y = actCard(c, 'svDel', x, y, W, 'i_trash', '刪除帳號', '從排行榜永久移除，並清空這台裝置的進度', () => { step = 'del'; msg = null; askDel = 0; }, 10) + 8;
      ui().btnSecondary(c, 'svAcBk', Math.round(x + W / 2 - 40), y, 80, 18, '返回', () => { step = 'home'; msg = null; });
      y += 22;
    } else if (step === 'kick') {                                                              // v2.8.7 被別台登入：一定要登出，存檔碼給他留著
      y = centerTitle(c, x, W, y + 2, '此帳號已在其他裝置登入', '同一個帳號同時只能在一台裝置玩，這台要登出了。');
      const th = LD ? Math.max(30, Math.min(50, B - y - 96)) : 56;
      H().box(c, x, y, W, th + 2, 0, 13, false);
      const e = G.Dom.place('code', 'textarea', x + 1, y + 1, W - 2, th, { ro: true }); if (e.value !== code) e.value = code;
      y += th + 6;
      y = keepCard(c, x, y, W, '如果這台的進度比較新，先複製這台的存檔碼，之後讀取就能接回來') + 6;
      btnRow(c, x, y, W, ['svCopy', copied > 0 ? '已複製！' : '複製存檔碼', () => copyCode()], ['svKickGo', '登出', () => { if (busy) return; wipe('已登出'); }]);
      y += 22;
    } else if (step === 'out') {                                                               // 登出：先複製存檔碼才能登出
      y = centerTitle(c, x, W, y + 2, '登出前，先保存存檔碼', '登出後這台裝置會回到新玩家。想回來時，在「讀取存檔碼」貼上就好。');
      const th = LD ? Math.max(30, Math.min(50, B - y - 96)) : 56;
      H().box(c, x, y, W, th + 2, 0, 13, false);
      const e = G.Dom.place('code', 'textarea', x + 1, y + 1, W - 2, th, { ro: true }); if (e.value !== code) e.value = code;
      y += th + 6;
      y = keepCard(c, x, y, W, '沒有存檔碼就找不回這個帳號，請先按「複製」保存') + 6;
      btnRow(c, x, y, W, ['svCopy', copied > 0 ? '已複製！' : '複製存檔碼', () => copyCode()], ['svOutGo', '登出', () => { if (!copiedOnce || busy) { say('請先按「複製存檔碼」保存', 10); G.UI.h.deny('svOutGo'); return; } wipe('已登出'); }]);
      y += 22;
      ui().btnSecondary(c, 'svOutNo', Math.round(x + W / 2 - 40), y, 80, 16, '取消', () => { step = 'acct'; msg = null; });
      y += 20;
    } else if (step === 'del') {                                                               // 刪除帳號：按兩下確認
      y = centerTitle(c, x, W, y + 2, '確定要刪除帳號？', null);
      y = infoCard(c, x, y, W, v.name, G.SaveCode.summary(v)) + 6;
      const ls = G.cnWrap('排行榜紀錄會永久刪除，這台裝置的進度也會清空，無法復原。', W); ls.forEach((l, i) => G.cn(c, l, x + W / 2, y + i * 13, 10, 0.5)); y += ls.length * 13 + 6;
      const ask = askDel && Date.now() - askDel < 3000;
      btnRow(c, x, y, W, ['svDelNo', '取消', () => { step = 'acct'; msg = null; askDel = 0; }], ['svDelGo', working ? '刪除中' : ask ? '再按一次刪除' : '刪除帳號', () => { if (working) return; if (ask) doDelete(); else { askDel = Date.now(); G.Audio.play('tick'); } }]);
      y += 24;
    } else if (step === 'load') {
      y = centerTitle(c, x, W, y + 2, '讀取存檔碼', '貼上之前保存的存檔碼，會自動讀取');
      const th = LD ? Math.max(40, Math.min(70, B - y - 40)) : 78;
      H().box(c, x, y, W, th + 2, 0, 13, false);
      G.Dom.place('load', 'textarea', x + 1, y + 1, W - 2, th, { ro: false, ph: '在這裡貼上存檔碼（Cmd+V／Ctrl+V）' });
      y += th + 8;
      btnRow(c, x, y, W, ['svPaste', '貼上', () => pasteCode()], ['svRead', '讀取', () => readCode()]);
      // 「貼上」上面疊一顆透明的 HTML 按鈕：讓瀏覽器把它視為真正的按鈕點擊，手機才允許讀剪貼簿
      { const pb = G.Dom.place('pasteBtn', 'button', x, y, Math.floor((W - 6) / 2), 18); pb.style.background = 'transparent'; pb.style.color = 'transparent'; pb.style.cursor = 'pointer'; pb.style.webkitTapHighlightColor = 'transparent';
        if (!pb._bound) { pb._bound = 1; pb.addEventListener('pointerdown', () => { U().press.svPaste = 0.15; }); pb.addEventListener('click', ev => { ev.preventDefault(); G.Audio.init(); G.Audio.play('click'); pasteCode(); }); } }
      y += 24;
    } else if (step === 'confirm' && pend) {
      y = centerTitle(c, x, W, y + 2, '要讀取這個存檔嗎？', null);
      y = infoCard(c, x, y, W, pend.name, G.SaveCode.summary(pend)) + 6;
      const ls = G.cnWrap('目前的進度會被取代', W); ls.forEach((l, i) => G.cn(c, l, x + W / 2, y + i * 13, 10, 0.5)); y += ls.length * 13 + 6;
      btnRow(c, x, y, W, ['svNo', '取消', () => { step = 'load'; }], ['svYes', '確定讀取', () => doLoad()]);
      y += 24;
    }
    // 狀態訊息（成功綠、提示黃、錯誤紅）
    if (msg && msg.t < 3.2 && step !== 'home') { const ls = G.cnWrap(msg.s, W); ls.forEach((l, i) => G.cn(c, l, x + W / 2, y + 2 + i * 13, msg.col, 0.5)); }
  };

  // ---------- 偶爾提醒備份：成就達成或拿到新角色累積 3 次、且距離上次提醒超過 20 分鐘 → 首頁下方出現一張小卡 ----------
  S.bump = () => { if (G.Team.dev) return; const v = G.Team.get(); v.bk = v.bk || { n: 0, t: 0 }; v.bk.n++; G.Team.save(); };
  S.drawBackupTip = (c, menuT) => {
    const v = G.Team.get(), bk = v.bk; if (!bk || G.Team.dev || S.needAcct() || bk.n < 3 || Date.now() - bk.t < 20 * 60 * 1000 || menuT < 2.5 || S.welcome || S.greet) return;
    if (G.Menus.pillPos && G.Update && G.Update.has()) return;   // v2.8.6 橫屏有新版本時，右下角讓給「點擊更新」（更新完再提醒備份）
    const M = ui();
    if (G.Menus.pillPos) {                              // 橫屏：小膠囊「要備份嗎？」＋關閉
      const [px, py, pw0] = G.Menus.pillPos, lab = '要備份嗎？', pw = Math.min(pw0, G.cnW(lab) + 34), a = Math.min(1, (menuT - 2.5) / 0.4), o = M.pr('bkGo') ? 1 : 0;
      c.globalAlpha = a;
      H().key(c, px, py + o, pw, 14, o, 13); H().icon(c, 'i_save', px + 8, py + 7 + o); G.cn(c, lab, px + 16, py + 1 + o, 13);
      const cx2 = px + pw - 11; c.fillStyle = P[6]; for (let k = 0; k < 5; k++) { c.fillRect(cx2 + k, py + 5 + k + o, 1, 1); c.fillRect(cx2 + 4 - k, py + 5 + k + o, 1, 1); }
      M.tap('bkGo', px, py, pw - 14, 14, () => { bk.t = Date.now(); bk.n = 0; G.Team.save(); M.go('save'); });
      M.tap('bkLater', px + pw - 14, py, 14, 14, () => { bk.t = Date.now(); bk.n = 0; G.Team.save(); });
      c.globalAlpha = 1; return;
    }
    const [gcx, gy, gw] = G.Menus.greetPos || [R.uw / 2, R.uh - 40, R.uw - 16];
    const w = Math.min(gw - 8, 230), ls = G.cnWrap('進度越來越多了，要產生存檔碼備份一下嗎？', w - 26), hh = 6 + ls.length * 13 + 22, x = Math.round(gcx - w / 2), y = Math.round(gy + 18 - hh);
    const a = Math.min(1, (menuT - 2.5) / 0.4); c.globalAlpha = a;
    H().box(c, x, y, w, hh, 1, 13);
    H().icon(c, 'i_save', x + 10, y + 10);
    ls.forEach((l, i) => G.cn(c, l, x + 20, y + 4 + i * 13, 9));
    const bw = Math.floor((w - 16) / 2), by = y + hh - 18;
    M.btnSecondary(c, 'bkLater', x + 5, by, bw, 14, '稍後', () => { bk.t = Date.now(); bk.n = 0; G.Team.save(); });
    M.btnPrimary(c, 'bkGo', x + 11 + bw, by, bw, 14, '去備份', () => { bk.t = Date.now(); bk.n = 0; G.Team.save(); M.go('save'); });
    c.globalAlpha = 1;
  };
  // ---------- 歡迎回來 ----------
  // 大字（中文像素字放大 2 倍）
  const cnBig = G.cnBig = (c, s, cx, y, col, k = 2) => { const e = G.cnImg(String(s), col, 0); c.drawImage(e.c, Math.round(cx - (e.w * k) / 2) - 2 * k, Math.round(y) - k, e.c.width * k, e.c.height * k); return e.w * k; };
  S.drawWelcome = c => {
    const w = S.welcome; if (!w) return;
    const dt = G.Menus.dt || 1 / 60, uw = R.uw, uh = R.uh; w.t += dt;
    const fade = w.t > 3.4 ? Math.max(0, 1 - (w.t - 3.4) / 0.4) : 1; if (fade <= 0) { S.welcome = null; return; }
    U().btns = [];
    H().btn('wcBg', 0, 0, uw, uh, null, () => { if (w.t > 0.4) w.t = Math.max(w.t, 3.4); });
    H().dim(c, 0.82 * fade);
    c.globalAlpha = fade;
    const cy = Math.round(uh * 0.42), k = Math.min(1, w.t / 0.35);
    // 光圈＋葉子噴發
    if (w.parts.length < 40 && w.t < 0.6) for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, s = G.rr(30, 90); w.parts.push({ x: uw / 2, y: cy - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, c: G.pick([11, 16, 13, 9]), l: G.rr(1, 2.2) }); }
    for (const p of w.parts) { p.l -= dt; if (p.l <= 0) continue; p.vy += 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; c.fillStyle = P[p.c]; c.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); }
    const r = Math.round(10 + k * 34); G.pxEllipse(c, uw / 2, cy - 4, r, Math.round(r * 0.45), 13);
    // 英雄跳一下
    const hn = G.HEROES[G.Team.get().hero].name, fr = G.SPR[G.VIS[hn].spr], f = fr[((w.t * 6) | 0) % fr.length], img = G.scaled(f.n, 2), jy = Math.round(-Math.abs(Math.sin(w.t * 5)) * 6 * (w.t < 1.2 ? 1 : 0.3));
    c.drawImage(img, Math.round(uw / 2 - img.width / 2), cy - img.height + jy);
    const ty = cy + 10 + Math.round((1 - k) * 12);
    cnBig(c, '歡迎回來', uw / 2, ty, 13);
    const nm = w.name, sc = G.cnW(nm) * 2 > uw - 24 ? 1 : 2;
    cnBig(c, nm, uw / 2, ty + 30, 9, sc);
    G.cn(c, '你的進度已經還原', uw / 2, ty + 30 + 14 * sc + 6, 6, 0.5);
    c.globalAlpha = 1;
  };
  // 開啟遊戲時的問候（有存檔名稱才顯示）
  S.drawGreet = c => {
    const g = S.greet; if (!g || G.UI.screen !== 'menu' || S.welcome) return;
    const dt = G.Menus.dt || 1 / 60; g.t += dt;
    const D = 1.2, T = 4.2; if (g.t < D) return; const t = g.t - D; if (t > T) { S.greet = null; return; }
    const inK = Math.min(1, t / 0.3), outK = Math.max(0, (t - T + 0.35) / 0.35);
    const [gcx, gy, gw] = G.Menus.greetPos || [R.uw / 2, R.uh - 40, R.uw - 16];
    const s = '歡迎回來，' + g.name + '！', w = Math.min(gw - 8, G.cnW(s) + 30), x = Math.round(gcx - w / 2);
    const y = Math.round(gy + (1 - inK) * 20 + outK * 20);
    const ls = G.cnWrap(s, w - 22), bh = 5 + ls.length * 13, by = y - (ls.length - 1) * 13;   // 名字長就換行，不截斷
    c.globalAlpha = Math.min(inK, 1 - outK);
    H().box(c, x, by, w, bh, 1, 13);
    c.drawImage(G.SPR.leaf_pt.n, x + 6, by + 6);
    ls.forEach((l, i) => G.cn(c, l, x + 16, by + 3 + i * 13, 9));
    c.globalAlpha = 1;
  };

  // ---------- v3.3 建立帳號送 8 把鑰匙 ----------
  // 規則：新玩家開局 0 把；第一次建立帳號（取名＋產生存檔碼）送 8 把，播領取動畫。旗標 p.gift 跟著存檔碼走；已有名字的舊帳號視為領過
  const GIFT = 8, now = () => performance.now() / 1000;
  let darkKey = null; const dKey = () => darkKey || (darkKey = G.sprite(G.ART_SMALL.i_key.map(r => r.replace(/[1-9a-h]/g, '0'))));
  S.needAcct = () => !G.Team.dev && !G.Ach.P().gift;
  S.makeAcct = () => { const M = ui(); G.Trans.start(() => { M.go('save'); step = 'name'; msg = null; const e = G.Dom.get('name', 'input'); e.value = G.Team.get().name || ''; }); };
  function grant() { if (!S.needAcct()) return; G.Ach.P().gift = 1; G.Team.addKeys(GIFT); S.gift = { t: 0, k: 0, ps: [], pop: 0 }; }
  const easeBack = k => { const s = 1.7; k -= 1; return 1 + k * k * ((s + 1) * k + s); };
  // 八把鑰匙圍成一圈（i：第幾把，rx/ry：半徑，rot：旋轉）
  const ringPos = (i, cx, cy, rx, ry, rot = 0) => { const a = -Math.PI / 2 + i * Math.PI * 2 / GIFT + rot; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; };
  function drawGift(c) {
    const g = S.gift, dt = G.Menus.dt || 1 / 60, uw = R.uw, uh = R.uh, LD = ui().land(); g.t += dt;
    const T0 = 0.45, STEP = 0.15, ALL = T0 + GIFT * STEP + 0.25;
    const out = g.out != null ? Math.min(1, (g.t - g.out) / 0.5) : 0; if (out >= 1) { S.gift = null; return; }
    U().btns = [];
    H().btn('gfBg', 0, 0, uw, uh, null, () => { if (g.t > ALL + 0.3 && g.out == null) { g.out = g.t; G.Audio.play('click'); } else if (g.t > 0.5 && g.t < ALL) g.t = ALL; });   // 播放中點一下＝跳到最後
    H().dim(c, 0.86);
    const cx = Math.round(uw / 2), cy = Math.round(uh * (LD ? 0.5 : 0.46)), rx = 48, ry = LD ? 26 : 30, rot = g.t > ALL ? (g.t - ALL) * 0.45 : 0;
    const k0 = Math.min(1, g.t / 0.35), fade = 1 - out;
    c.globalAlpha = fade;
    const ts = G.cnW('帳號建立完成') * 2 <= uw - 20 ? 2 : 1;
    cnBig(c, '帳號建立完成', cx, cy - ry - (LD ? 32 : 42) - Math.round((1 - k0) * 10), 13, ts);
    const rk = Math.min(1, Math.max(0, (g.t - 0.2) / 0.6));
    G.glow(c, cx, cy, 18 + rk * 34, 13, 0.32 * rk * fade);
    // 鑰匙一把一把飛出來
    const ki = G.scaled(G.SPR.i_key.n, 2);
    for (let i = 0; i < GIFT; i++) {
      const ti = g.t - (T0 + i * STEP); if (ti < 0) continue;
      if (g.k <= i) { g.k = i + 1; g.pop = 1; G.Audio.play('coin');
        const [px, py] = ringPos(i, cx, cy, rx, ry); for (let q = 0; q < 6; q++) { const a = Math.random() * 6.28, s = G.rr(20, 55); g.ps.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: G.pick([13, 9, 14]), l: G.rr(0.3, 0.6) }); } }
      const e = easeBack(Math.min(1, ti / 0.35)), [px, py] = ringPos(i, cx, cy, rx * e, ry * e, rot), bob = 0;
      const ox = px + (uw - 24 - px) * out * out, oy = py + (10 - py) * out * out;    // 收下：飛向右上角
      G.glow(c, ox, oy + bob, 9, 13, 0.25 * fade);
      c.drawImage(ki, Math.round(ox - ki.width / 2), Math.round(oy - ki.height / 2) + bob);
    }
    for (const p of g.ps) { p.l -= dt; if (p.l <= 0) continue; p.vy += 50 * dt; p.x += p.vx * dt; p.y += p.vy * dt; c.fillStyle = P[p.c]; c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    g.pop = Math.max(0, g.pop - dt * 5);
    // 中間的數字：每拿到一把跳一下
    cnBig(c, '× ' + g.k, cx, cy - 11 - Math.round(g.pop * 3), 13, 2);
    if (g.t > ALL) {
      const a = Math.min(1, (g.t - ALL) / 0.3); c.globalAlpha = a * fade;
      const W = Math.min(uw - 20, 240), ls = G.cnWrap('送你 ' + GIFT + ' 把鑰匙！', W).concat(G.cnWrap('到商店開寶箱，抽新角色', W));
      ls.forEach((l, i) => G.cn(c, l, cx, cy + ry + 10 + i * 14, i ? 6 : 9, 0.5));
      if (g.t > ALL + 0.6) { c.globalAlpha = (0.55 + 0.45 * Math.sin(g.t * 4)) * fade; G.cn(c, '點一下繼續', cx, cy + ry + 14 + ls.length * 14, 4, 0.5); }
    }
    c.globalAlpha = 1;
  }
  // 首頁：還沒建帳號 → 第一次跳出邀請卡；之後首頁下方常駐黃色按鈕
  S.drawAcctTip = (c, menuT) => {
    if (!S.needAcct() || S.welcome || S.gift || G.UI.screen !== 'menu' || (G.Update && G.Update.isOpen())) return;
    const p = G.Ach.P(), M = ui(), uw = R.uw, uh = R.uh, t = now();
    if (!p.giftAsk) {
      if (menuT < 1.2) return;
      const a = Math.min(1, (menuT - 1.2) / 0.3), later = () => { p.giftAsk = 1; G.Team.save(); };
      U().btns = [];
      H().btn('gaBg', 0, 0, uw, uh, null, () => {});
      H().dim(c, 0.75 * a); c.globalAlpha = a;
      const w = Math.min(uw - 16, 210), ttl = '送你 ' + GIFT + ' 把鑰匙！', tsc = G.cnW(ttl) * 2 <= w - 16 ? 2 : 1, ls = G.cnWrap('建立帳號就能領取，用來開寶箱抽新角色。', w - 20);
      const h = 60 + 14 * tsc + 6 + ls.length * 13 + 8 + 16 + 8, x = Math.round(uw / 2 - w / 2), y = Math.round(uh / 2 - h / 2) + Math.round((1 - a) * 12);
      H().box(c, x, y, w, h, 1, 13); H().btn('gaIn', x, y, w, h, null, () => {});
      const kcx = x + w / 2, kcy = y + 30, ki = G.scaled(G.SPR.i_key.n, 2);
      G.glow(c, kcx, kcy, 30, 13, 0.24 + 0.08 * Math.sin(t * 2.5));
      for (let i = 0; i < GIFT; i++) { const [px, py] = ringPos(i, kcx, kcy, 44, 18, t * 0.35), bob = 0; c.drawImage(ki, Math.round(px - ki.width / 2), Math.round(py - ki.height / 2) + bob); }
      let yy = y + 60; cnBig(c, ttl, kcx, yy, 13, tsc); yy += 14 * tsc + 6;
      ls.forEach((l, i) => G.cn(c, l, kcx, yy + i * 13, 6, 0.5)); yy += ls.length * 13 + 8;
      const bw = Math.floor((w - 22) / 2);
      M.btnSecondary(c, 'gaLater', x + 8, yy, bw, 16, '稍後', () => later());
      M.btnPrimary(c, 'gaGo', x + 14 + bw, yy, bw, 16, '建立帳號', () => { later(); S.makeAcct(); });
      c.globalAlpha = 1; return;
    }
    const [gcx, gy, gw] = G.Menus.greetPos || [uw / 2, uh - 40, uw - 16];
    const a = Math.min(1, Math.max(0, (menuT - 0.6) / 0.4)); if (a <= 0) return;
    c.globalAlpha = a; S.giftBtn(c, 'gaBar', gcx, gy + 18, gw - 8, true); c.globalAlpha = 1;
  };
  // 黃色「建立帳號送鑰匙」按鈕（首頁、商店共用）：柔光呼吸＋掃光＋鑰匙跳動。bottom＝按鈕底邊
  S.giftBtn = (c, id, cx, bottom, maxW, big) => {
    const M = ui(), t = now(), s = '建立帳號送 ' + GIFT + ' 把鑰匙', w = Math.min(maxW, G.cnW(s) + 30), ls = G.cnWrap(s, w - 26), hh = (big ? 6 : 2) + ls.length * 13;
    const x = Math.round(cx - w / 2), y = Math.round(bottom - hh), o = M.pr(id) ? 1 : 0;
    G.glow(c, cx, y + hh / 2, w * 0.55, 13, 0.16 + 0.1 * Math.sin(t * 2.4), (hh + 14) / (w * 1.1));
    H().key(c, x, y + o, w, hh, o, 14, 13);
    const sw = (t % 2.8) / 1.2; if (sw < 1) { c.save(); c.beginPath(); c.rect(x + 1, y + o + 1, w - 2, hh - 2); c.clip(); const sx = x - 10 + sw * (w + 20); c.fillStyle = 'rgba(255,255,255,0.45)'; for (let k = 0; k < hh; k++) c.fillRect(Math.round(sx - k * 0.5), y + o + k, 3, 1); c.restore(); }
    const kb = Math.round(-Math.abs(Math.sin(t * 4)) * 1.5), dk = dKey();
    c.drawImage(dk.n, x + 6, Math.round(y + o + hh / 2 - dk.h / 2) + kb);
    ls.forEach((l, i) => G.cn(c, l, x + 19, y + o + (big ? 3 : 1) + i * 13, 0));
    M.tap(id, x, y, w, hh + 2, () => S.makeAcct());
    return hh;
  };
  return S;
})();
G.Menus.save = c => G.SaveUI.draw(c);
addEventListener('paste', ev => { const t = ev.clipboardData && ev.clipboardData.getData('text'); if (t && G.SaveUI.onPaste(t)) ev.preventDefault(); });
addEventListener('input', ev => { if (ev.target && ev.target === G.Dom.el('load')) G.SaveUI.onInput(); });
