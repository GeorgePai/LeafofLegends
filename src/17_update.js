// ============================================================
// v2.8.5 版本更新通知
// 規則一句話：有新版本時，首頁右下角版本號上方出現「點擊更新」→ 看更新內容 → 按「立即更新」重新載入新版
// - 偵測：讀同一個網站的 version.json（GitHub Pages，和 index.html 一起部署；不經過排行榜伺服器）
//   開遊戲時、每 5 分鐘、從背景切回來時各讀一次；戰鬥中不讀；只在 github.io 上啟用（作品頁、Mac 備份檔不檢查）
// - 更新：用帶版本號的網址重新載入（?v=2.8.5），避開瀏覽器快取；存檔在同一個網址底下，不會不見
// - 更新完第一次打開：頂端通知條「已更新到 V○○！」＋「查看更新內容」（v3.2.4；內容在 build 時打包成 G.RELEASE）
// - version.json 由 source 分支的 release.json 產生（tools/release.py）
// ============================================================
G.Update = (() => {
  const U = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, M = () => G.Menus.ui;
  const num = v => String(v || '').replace(/^V/i, '').split('.').map(x => +x || 0);
  const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  let remote = null, list = [], lastT = -1e12, busy = 0, open = false, going = false, booted = false, mode = 'new', fromV = null;
  const SC = { s: 0, v: 0, max: 0, ly: 0, lt: 0 };   // 更新內容捲動
  U.GAP = 300;                                                                    // 幾秒檢查一次
  U.force = false;                                                                // 測試用：不在 github.io 也檢查
  U.on = () => U.force || /\.github\.io$/.test(location.hostname);
  U.has = () => !!remote && newer(remote, G.VERSION);
  U.newer = newer;
  U.check = async force => {
    if (!U.on() || busy || (!force && Date.now() - lastT < U.GAP * 1000)) return;
    busy = 1; lastT = Date.now();
    try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); const j = await r.json(); if (j && j.v) { remote = String(j.v); list = Array.isArray(j.list) ? j.list : []; } } catch (e) { }
    busy = 0;
  };
  function boot() {                                                               // 更新後第一次打開：提示已更新（新玩家不提示）
    booted = true; let seen = null;
    try { seen = localStorage.getItem('leafwar_ver'); localStorage.setItem('leafwar_ver', G.VERSION); } catch (e) { }
    if (seen && newer(G.VERSION, seen)) G.Ach.queueBanner({ upd: seen, t: 0 });   // v3.2.4 通知條附「查看更新內容」
  }
  U.tick = () => {
    const sc = G.UI.screen; if (sc === 'battle' || sc === 'intro' || sc === 'tap' || document.hidden) return;
    if (!booted) boot();
    U.check();
  };
  addEventListener('visibilitychange', () => { if (!document.hidden) lastT = -1e12; });   // 從背景切回來馬上檢查
  U._set = (v, l) => { remote = v; list = l || []; };                             // 測試用
  U._open = on => { open = on; };                                                 // 測試用
  // ---- 首頁右下角：版本號；有新版時上方出現「點擊更新」＋箭頭指著版本號 ----
  U.corner = (c, rx, y) => {
    const has = U.has(), vs = G.VERSION;
    G.text(c, vs, rx, y, has ? 13 : 3, 1, null, 1);
    if (!has) return;
    const gt = M().gt(), bob = Math.round(Math.abs(Math.sin(gt * 4)) * 2), lab = '點擊更新', lw = G.cnW(lab) + 10, vw = G.textW(vs);
    c.fillStyle = P[13];
    if (R.uw > R.uh * 1.15) {                                                     // 橫屏：上方是選單，改放在版本號左邊、箭頭往右
      const lx = rx - vw - 17 - lw - bob, ly = y - 5;
      H().box(c, lx, ly, lw, 14, 0, 13, false); G.cn(c, lab, lx + lw / 2, ly + 1, 13, 0.5);
      c.fillStyle = P[13]; c.fillRect(lx + lw, y + 2, rx - vw - 5 - (lx + lw), 1);
      for (let k = 0; k < 4; k++) c.fillRect(rx - vw - 6 + k, y + 2 - 3 + k, 1, 7 - k * 2);
      M().tap('upd', lx - 2, ly - 2, rx + 3 - lx, 18, () => U.show('new'));
      return;
    }
    const ax = Math.round(rx - vw / 2), lx = Math.min(rx - lw + 2, ax - Math.round(lw / 2)), ly = y - 27 - bob;   // 直屏：在版本號上方、箭頭往下
    H().box(c, lx, ly, lw, 14, 0, 13, false); G.cn(c, lab, lx + lw / 2, ly + 1, 13, 0.5);
    c.fillStyle = P[13]; c.fillRect(ax, ly + 14, 1, y - 5 - (ly + 14));
    for (let k = 0; k < 4; k++) c.fillRect(ax - 3 + k, y - 6 + k, 7 - k * 2, 1);
    const tx = Math.min(lx, rx - vw - 4);
    M().tap('upd', tx, ly - 2, rx + 3 - tx, y + 8 - ly, () => U.show('new'));
  };
  // ---- 更新內容資訊卡（黑色遮罩、置中；內容長就上下捲動，不截斷）----
  // mode 'new'＝有新版本（稍後／立即更新）；'done'＝已經更新好（從通知條的「查看更新內容」打開，只有「知道了」）
  U.show = (m, from) => { mode = m; fromV = from || null; open = true; SC.s = 0; SC.v = 0; G.Audio.play('open'); };
  U.isOpen = () => open;
  U.wheel = dy => { if (!open) return false; SC.s = G.clamp(SC.s + dy, 0, SC.max); return true; };
  U._show = (m, from) => U.show(m, from);                                         // 測試用
  U._sc = v => { SC.s = v; };                                                     // 測試用
  function entries() {
    const src = list.length ? list : (G.RELEASE || []);
    let ents;
    if (mode === 'new') ents = src.filter(e => e && e.v && newer(e.v, G.VERSION));
    else { ents = src.filter(e => e && e.v && !newer(e.v, G.VERSION) && (!fromV || newer(e.v, fromV))); if (!ents.length) ents = src.filter(e => e && e.v === G.VERSION); }
    if (!ents.length) ents = [{ v: mode === 'new' ? remote : G.VERSION, n: ['遊戲內容更新與修正'] }];
    return ents;
  }
  U.card = c => {
    if (!open) return;
    const uw = R.uw, uh = R.uh, w = Math.min(uw - 24, 240), x = Math.round(uw / 2 - w / 2), iw = w - 16, nw = mode === 'new';
    const ents = entries();
    // 內容：每個版本一個小標題＋條列（自動換行，「・」後面縮排）
    const rows = [];
    ents.forEach((e, i) => { rows.push({ h: 1, s: e.v + (e.d ? '　' + e.d : ''), gap: i ? 4 : 0 }); (e.n || []).forEach(s => G.cnWrap(String(s), iw - 14).forEach((l, k) => rows.push({ s: l, b: k === 0 }))); });
    const full = rows.reduce((a, r) => a + 13 + (r.gap || 0), 0), viewH = full <= uh - 88 ? full : Math.floor((uh - 88) / 13) * 13, more = full > viewH, hh = 44 + viewH + (more ? 31 : 26), y = Math.round(uh / 2 - hh / 2);   // 捲動時內容和按鈕中間多留 5px 放「下面還有」箭頭（不蓋字）
    SC.max = Math.max(0, full - viewH); SC.s = G.clamp(SC.s, 0, SC.max);
    if (SC.v) { SC.s += SC.v * (G.Menus.dt || 1 / 60); SC.v *= Math.exp(-(G.Menus.dt || 1 / 60) * 3.2); if (Math.abs(SC.v) < 6 || SC.s <= 0 || SC.s >= SC.max) SC.v = 0; SC.s = G.clamp(SC.s, 0, SC.max); }
    const close = () => { if (!going) { open = false; G.Audio.play('click'); } };
    H().btn('updBg', 0, 0, uw, uh, null, close);
    H().dim(c, 0.75);
    H().box(c, x, y, w, hh, 1, 13); H().btn('updIn', x, y, w, hh, null, null);
    G.cn(c, nw ? '有新版本！' : '更新內容', x + w / 2, y + 5, 13, 0.5);
    G.cn(c, nw ? G.VERSION + ' → ' + remote : (fromV ? fromV + ' → ' : '') + G.VERSION, x + w / 2, y + 19, 6, 0.5);
    c.fillStyle = P[3]; c.fillRect(x + 6, y + 36, w - 12, 1);
    const vy = y + 41;
    c.save(); c.beginPath(); c.rect(x + 2, vy - 1, w - 4, viewH + 1); c.clip();
    let yy = vy - Math.round(SC.s);
    for (const r of rows) {
      yy += r.gap || 0;
      if (yy > vy - 14 && yy < vy + viewH) {
        if (r.h) G.cn(c, r.s, x + 8, yy, 9);
        else { if (r.b) G.cn(c, '・', x + 8, yy, 13); G.cn(c, r.s, x + 18, yy, 7); }
      }
      yy += 13;
    }
    c.restore();
    if (SC.max > 0) {                                                              // 捲軸＋還有內容的箭頭
      const th = Math.max(10, Math.round(viewH * viewH / (viewH + SC.max))), ty = vy + Math.round((viewH - th) * SC.s / SC.max);
      c.fillStyle = P[2]; c.fillRect(x + w - 5, vy, 2, viewH); c.fillStyle = P[7]; c.fillRect(x + w - 5, ty, 2, th);
      if (SC.s < SC.max - 2) { const ax = Math.round(x + w / 2), ay = vy + viewH + 2 + Math.round(Math.abs(Math.sin(M().gt() * 4))); c.fillStyle = P[0]; c.fillRect(ax - 4, ay - 1, 9, 4); c.fillStyle = P[13]; c.fillRect(ax - 3, ay - 1, 7, 1); c.fillRect(ax - 2, ay, 5, 1); c.fillRect(ax - 1, ay + 1, 3, 1); c.fillRect(ax, ay + 2, 1, 1); }
      G.UI.btns.push({ id: 'updSc', x: x + 2, y: vy, w: w - 4, h: viewH,
        down: (ux, uy) => { SC.ly = uy; SC.lt = performance.now(); SC.v = 0; SC.sv = 0; },
        drag: (ux, uy) => { const d = SC.ly - uy, now = performance.now(), mdt = Math.max(8, now - SC.lt) / 1000; SC.lt = now; SC.sv = G.lerp(SC.sv || 0, d / mdt, 0.5); SC.s = G.clamp(SC.s + d, 0, SC.max); SC.ly = uy; },
        up: () => { SC.v = performance.now() - SC.lt < 90 ? G.clamp(SC.sv || 0, -1600, 1600) : 0; } });
    }
    const by = y + hh - 22;
    if (!nw) { M().btnPrimary(c, 'updOk', Math.round(x + w / 2 - 34), by, 68, 16, '知道了', () => { open = false; }); return; }
    const bw = Math.floor((w - 22) / 2);
    M().btnSecondary(c, 'updLater', x + 8, by, bw, 16, '稍後', () => { if (!going) { open = false; } });
    M().btnPrimary(c, 'updGo', x + w - 8 - bw, by, bw, 16, going ? '更新中…' : '立即更新', () => {
      if (going) return; going = true; G.Audio.play('level');
      try { G.Team.save(); } catch (e) { }
      setTimeout(() => location.replace(location.pathname + '?v=' + String(remote).replace(/^V/i, '')), 250);
    });
  };
  return U;
})();
