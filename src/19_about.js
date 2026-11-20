// ============================================================
// v2.8.6 關於（首頁「關於」）：電影片尾式的感謝名單
// 深色夜空＋飄落的櫻花；名單由下往上慢慢捲，最後「致所有遊戲人」停在畫面中間 → 柔和淡出回首頁
// 點一下畫面：快轉／恢復；左上返回鍵可以直接離開
// ============================================================
G.About = (() => {
  const S = {}, R = G.Render, H = () => G.UI.h, ui = () => G.Menus.ui;
  const SPD = 19, HOLD = 4.5, FADE = 1.4, BACK = 1.1;          // 捲動速度（每秒幾格）、結尾停留、淡出、回首頁淡入（秒）
  const PINK = '#f7a8c0', CREAM = '#f3e6c8', SOFT = '#bfb3c9', GOLD = '#f7d23c';
  let t = 0, off = 0, fast = false, end = -1, out = -1, petals = [], back = 0;
  const tc = new Map();                                          // 任意顏色的中文字（白字＋上色，快取）
  function tint(s, hex) {
    const k = s + '|' + hex; let e = tc.get(k); if (e) return e;
    if (tc.size > 300) tc.clear();
    const b = G.cnImg(s, 9), cv = G.canvas(b.c.width, b.c.height), g = cv.getContext('2d');
    g.drawImage(b.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = hex; g.fillRect(0, 0, cv.width, cv.height);
    e = { c: cv, w: b.w }; tc.set(k, e); return e;
  }
  const txt = (c, s, cx, y, hex, sc = 1) => { const e = tint(s, hex); c.drawImage(e.c, Math.round(cx - e.w * sc / 2) - 2 * sc, Math.round(y) - sc, e.c.width * sc, e.c.height * sc); };
  // ---- 名單內容（由上到下）----
  function content(cw) {
    const L = [], lab = s => L.push({ k: 'lab', s, h: 16 }), gap = h => L.push({ k: 'gap', h });
    const line = (s, col, sc = 1) => {
      let ls = G.cnWrap(s, cw / sc);
      if (sc > 1 && ls.length > 1) { const a = [...s], h2 = Math.ceil(a.length / 2); ls = [a.slice(0, h2).join(''), a.slice(h2).join('')]; }   // 大字放不下：對半切成兩行（不留孤字）
      ls.forEach(l => L.push({ k: 't', s: l, col, sc, h: 13 * sc + (sc > 1 ? 4 : 1) }));
    };
    L.push({ k: 'logo', h: 0 });   // 高度在 layout() 算 gap(28);
    lab('開發者'); line('Pai', '#ffffff', 2); gap(22);
    lab('開發工具'); line('Claude by Anthropic', '#ffffff'); gap(46);
    line('雖然漸漸電子陽痿', CREAM); line('但年輕時的遊戲魂還在', CREAM); gap(18);
    line('希望帶著年輕時沒玩透的遺憾', CREAM); gap(18);
    line('在這 AI 的列車上', CREAM); line('圓一場遊戲夢。', CREAM); gap(46);
    lab('音樂'); line('引用自小時候瘋過的遊戲', SOFT); gap(14);
    line('Littleroot Town', '#ffffff'); line('Pokémon Omega Ruby & Alpha Sapphire', SOFT); line('Recreation & interpolation', SOFT); line('by Craig Maywell Vlogs Brawlgamemusic', SOFT); gap(14);
    line('彈彈堂', '#ffffff'); line('大廳 BGM・房間 BGM', SOFT); gap(14);
    line('忍豆風雲 3', '#ffffff'); line('國際版 BGM・大廳 BGM', SOFT); gap(80);
    L.push({ k: 'end', h: 0 });
    line('致所有遊戲人', GOLD, 2); gap(6); line('2026.11.20', SOFT); gap(14); L.push({ k: 'leafy', h: 16 });
    return L;
  }
  // 版面：每一項的 y（相對於捲動起點）、結尾區塊的位置
  let LAY = null;
  function layout(uw) {
    const I = R.ins, cw = Math.min(uw - I.l - I.r - 12, 250), lw = Math.min(cw, 200);
    if (LAY && LAY.uw === uw) return LAY;
    const L = content(cw); let y = 0, endY = 0;
    L.forEach(it => { if (it.k === 'logo') { it.top = 24; it.h = ui().logoSize(lw).h + 24 + 30; } if (it.k === 'end') endY = y; it.y = y; y += it.h; });   // logo：上面留 Leafy、下面留光暈
    return (LAY = { uw, cw, lw, L, endY, blockH: y - endY });
  }
  S.reset = () => { t = 0; off = 0; fast = false; end = -1; out = -1; petals = []; };
  S._skip = (sec, f) => { for (let i = 0; i < sec * 30; i++) step(1 / 30, R.uw, R.uh, f); };   // 測試用：快轉 sec 秒
  S._end = () => { for (let i = 0; i < 20000 && end < 0; i++) step(1 / 30, R.uw, R.uh, true); };   // 測試用：直接到結尾（停在中間那一刻）
  function step(dt, uw, uh, f) {
    t += dt;
    // 櫻花：一直補到 34 片；慢慢飄、左右擺、轉（用寬窄變化模擬翻面）
    while (petals.length < 34) petals.push({ x: Math.random() * uw, y: petals.length < 20 && t < 0.1 ? Math.random() * uh : -6 - Math.random() * 40, vy: 7 + Math.random() * 9, vx: 3 + Math.random() * 5, ph: Math.random() * 6.3, sp: 1 + Math.random() * 1.6, c: Math.random() < 0.3 ? '#ffe3ec' : Math.random() < 0.6 ? '#ffc4d6' : '#f59ab4', z: Math.random() < 0.25 ? 2 : 1 });
    petals.forEach(p => { p.y += p.vy * dt * p.z * 0.8; p.x += (p.vx + Math.sin(t * p.sp + p.ph) * 8) * dt; if (p.y > uh + 6 || p.x > uw + 8) { p.y = -6; p.x = Math.random() * uw - 20; } });
    if (end < 0) {
      off += SPD * dt * (f || fast ? 5 : 1);
      const Y = layout(uw), stop = uh + Y.endY + Y.blockH / 2 - uh / 2;               // 結尾區塊的中心到畫面中間就停
      if (off >= stop) { off = stop; end = t; }
    }
    if (end >= 0 && out < 0 && t - end > HOLD) out = t;
  }
  S.draw = c => {
    const M = ui(); M.tick();
    const uw = R.uw, uh = R.uh, I = R.ins, dt = G.Menus.dt || 1 / 60, cx = uw / 2;
    step(dt, uw, uh, false);
    // 夜空：上深紫、下暖一點
    const gr = c.createLinearGradient(0, 0, 0, uh); gr.addColorStop(0, '#0c0a14'); gr.addColorStop(0.65, '#16101e'); gr.addColorStop(1, '#241722'); c.fillStyle = gr; c.fillRect(0, 0, uw, uh);
    for (let i = 0; i < 26; i++) { const sx = (i * 97) % uw, sy = (i * 53) % Math.round(uh * 0.7), a = 0.25 + 0.25 * Math.sin(t * 1.3 + i); c.globalAlpha = a; c.fillStyle = '#ffffff'; c.fillRect(sx, sy, 1, 1); } c.globalAlpha = 1;
    // 遠景櫻花（小、淡）在字後面
    const drawP = far => petals.forEach(p => { if ((p.z === 1) !== far) return; const w = Math.abs(Math.sin(t * p.sp * 1.7 + p.ph)) > 0.45 ? 2 : 1; c.globalAlpha = far ? 0.55 : 0.95; c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), w * p.z, p.z === 2 ? 3 : 2); if (p.z === 2) { c.fillStyle = '#ffffff'; c.globalAlpha = 0.6; c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); } c.globalAlpha = 1; });
    drawP(true);
    // ---- 名單 ----
    const Y = layout(uw);
    Y.L.forEach(it => {
      const y = uh - off + it.y;
      if (y + it.h < -30 || y > uh + 30) return;
      if (it.k === 'logo') ui().bigTitle(c, cx, y + it.top, Y.lw, 99);
      else if (it.k === 'lab') { const w = tint(it.s, PINK).w; txt(c, it.s, cx, y, PINK); c.fillStyle = PINK; c.globalAlpha = 0.5; c.fillRect(Math.round(cx - w / 2 - 22), y + 6, 14, 1); c.fillRect(Math.round(cx + w / 2 + 8), y + 6, 14, 1); c.globalAlpha = 1; }
      else if (it.k === 't') txt(c, it.s, cx, y, it.col, it.sc);
      else if (it.k === 'leafy') { const fr = G.SPR.leafy && G.SPR.leafy[((t * 6) | 0) % G.SPR.leafy.length]; if (fr) c.drawImage(fr.n, Math.round(cx - fr.w), Math.round(y), fr.w * 2, fr.h * 2); }
    });
    // 上下淡出（像電影字幕）
    const fadeE = (y0, y1, a0) => { const g2 = c.createLinearGradient(0, y0, 0, y1); g2.addColorStop(0, a0 ? 'rgba(12,10,20,1)' : 'rgba(36,23,34,0)'); g2.addColorStop(1, a0 ? 'rgba(12,10,20,0)' : 'rgba(36,23,34,1)'); c.fillStyle = g2; c.fillRect(0, y0, uw, y1 - y0); };
    fadeE(0, 34, 1); fadeE(uh - 30, uh, 0);
    drawP(false);                                                              // 近景櫻花在字前面
    // 返回鍵＋提示
    M.header(c, '');
    H().btn('abTap', 0, I.t + 18, uw, uh - I.t - 18, null, () => { fast = !fast; G.Audio.play('click'); });
    if (t < 5 || fast) { c.globalAlpha = fast ? 0.8 : Math.min(1, (5 - t) / 1.5) * 0.7; G.cn(c, fast ? '快轉中・點一下恢復' : '點一下畫面可以快轉', cx, uh - I.b - 14, 7, 0.5); c.globalAlpha = 1; }
    // 結束：柔和淡出 → 回首頁（首頁再淡入）
    if (out >= 0) { const k = Math.min(1, (t - out) / FADE); c.fillStyle = 'rgba(0,0,0,' + (k * k * (3 - 2 * k)).toFixed(3) + ')'; c.fillRect(0, 0, uw, uh); if (k >= 1) { back = BACK; S.reset(); G.UI.goMenu(); } }
  };
  // 回首頁的淡入（首頁最後呼叫）
  S.post = c => { if (back <= 0) return; back -= G.Menus.dt || 1 / 60; const k = Math.max(0, back / BACK); c.fillStyle = 'rgba(0,0,0,' + (k * k).toFixed(3) + ')'; c.fillRect(0, 0, R.uw, R.uh); };
  return S;
})();
G.Menus.about = c => G.About.draw(c);
