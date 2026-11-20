// ============================================================
// v3.0 選擇關卡（首頁「單人」）
// - 橫向關卡卡片轉盤（沿用圖鑑／隊伍的聚光燈轉盤手感）：左右滑、點旁邊的卡、方向鍵
// - 背景跟著選到的關卡換成那個場景的顏色與天氣（森林花瓣、楓葉、飄雪、火星、幽光）
// - 卡片：場景縮圖＋這關的敵人與首領、難度骷髏、特殊規則、首通獎勵、星等；沒解鎖＝剪影＋鎖
// - 停在一張卡上時，首領叫一聲
// ============================================================
G.Solo = (() => {
  const S = {}, R = G.Render, P = G.PAL, H = () => G.UI.h, U = () => G.UI, ui = () => G.Menus.ui;
  const ORDER = [1, 2, 3, 4, 5, 0];                                  // 卡片順序：五個關卡，最後是經典戰場
  const DIFF = ['', '簡單', '普通', '困難', '極難', '超難'], DCOL = [0, 11, 13, 14, 10, 17];
  let pos = 0, tgt = 0, drag = null, cried = -1, t = 0, wx = [], bgK = 0, bgFrom = null;
  const info = si => si ? G.SOLO[si - 1] : { theme: 'forest', n: '經典戰場', en: 'CLASSIC', d: 0, rule: '沒有特殊規則', rew: 0, roster: [['babybear', 'eagle', 'bear']], boss: 'bigbear' };
  const open = si => G.SoloW.open(si);
  // 進入：停在「最新可以挑戰」的那一關
  S.open = () => {
    let k = 0; for (let i = 0; i < 5; i++) if (open(ORDER[i])) k = i;
    for (let i = 0; i < 5; i++) if (open(ORDER[i]) && !G.SoloW.best(ORDER[i]).c) { k = i; break; }
    pos = tgt = k; cried = k; wx = []; G.Menus.ui.go('stages'); G.Audio.play('open');
  };
  S.reset = () => { drag = null; };
  S.key = k => {
    if (k === 'arrowright' || k === 'd') { step(1); return true; }
    if (k === 'arrowleft' || k === 'a') { step(-1); return true; }
    if (k === 'enter' || k === ' ') { go(); return true; }
    return false;
  };
  const step = d => { const n = G.clamp(Math.round(tgt) + d, 0, ORDER.length - 1); if (n !== tgt) { tgt = n; G.Audio.play('tick'); } };
  const go = () => { const si = ORDER[Math.round(tgt)]; if (!open(si)) { G.Audio.play('deny'); return; } G.StageGo.go(si); };   // v3.1 出發過場（過場裡才建立戰場）
  S.cur = () => ORDER[Math.round(tgt)];
  S._go = i => { pos = tgt = i; };                                   // 測試用
  // ---- 小圖示：星星、骷髏（像素點陣）----
  const STAR = ['....#....', '...###...', '#########', '.#######.', '..#####..', '.###.###.', '.##...##.'];
  S.stars = (c, x, y, n, max = 3, sz = 9) => {
    for (let k = 0; k < max; k++) { const on = k < n, ox = x + k * (sz + 2);
      STAR.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') { c.fillStyle = P[0]; c.fillRect(ox + i, y + j + 1, 1, 1); } });
      STAR.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') { c.fillStyle = P[on ? (j < 2 ? 9 : 13) : 3]; c.fillRect(ox + i, y + j, 1, 1); } });
    }
    return max * (sz + 2);
  };
  const SKULL = ['.#####.', '#######', '#.##.##', '#######', '.#.#.#.'];
  function skulls(c, x, y, d) {
    for (let k = 0; k < 5; k++) { const on = k < d, col = on ? DCOL[d] : 3;
      SKULL.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '#') { c.fillStyle = P[col]; c.fillRect(x + k * 9 + i, y + j, 1, 1); } else if (j === 2 && (i === 1 || i === 4)) { c.fillStyle = P[0]; c.fillRect(x + k * 9 + i, y + j, 1, 1); } } });
    }
    return 45;
  }
  // v3.1 敵人改暗色：加一圈細紅邊（和戰場一樣），暗底上也看得清楚
  const rim = (c, img, x, y) => { const gl = G.glowOf(img, 15, 1, 1); c.globalAlpha = 0.9; c.drawImage(gl.c, x - gl.p, y - gl.p); c.globalAlpha = 1; c.drawImage(img, x, y); };
  // ---- 場景縮圖：主題地面＋兩棵樹＋這關的敵人（首領最大）----
  function preview(c, x, y, w, h, si, lock, big) {
    const I = info(si), th = I.theme;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.drawImage(G.withTheme(th, () => G.groundStrip(w, h)), x, y);
    const trees = G.SPR.trees; if (trees) [0, 1].forEach(k => { const s = trees[k % trees.length], img = G.themeImg(s.n, th); c.drawImage(img, Math.round(x + (k ? w - s.w * 0.6 : -s.w * 0.4)), Math.round(y + h * 0.42 - s.h)); });
    const names = (I.fresh || []).filter(n => n !== I.boss).concat(I.roster[I.roster.length - 1].filter(n => !(I.fresh || []).includes(n) && n !== I.boss)).slice(0, 2), fl = y + h - 5;
    const draw = (nm, cx, sc, face) => {
      const fr = G.SPR[G.VIS[nm].spr], f = fr[big ? ((t * 4) | 0) % fr.length : 0], img = sc > 1 ? G.scaled(G.foeImg(nm, face < 0 ? f.m : f.n), sc) : G.foeImg(nm, face < 0 ? f.m : f.n);
      const dx = Math.round(cx - img.width / 2), dy = Math.round(fl - img.height - (G.VIS[nm].fly ? 6 * sc : 0));
      G.pxDisc(c, cx, fl, img.width * 0.32, 2, 0, 0.5);
      if (lock) { c.drawImage(G.scaled(G.glowOf(f.n, 0, 1, 2).tint, sc), dx, dy); } else rim(c, img, dx, dy);
    };
    const sc = h >= 60 ? 2 : 1;
    names.forEach((nm, i) => draw(nm, x + w * (0.18 + i * 0.2), sc, -1));
    draw(I.boss, x + w * 0.72, sc, -1);
    // 天氣粒子（卡片裡）
    if (big && !lock) {
      const T = G.THEMES[th], k = T.wx;
      for (let i = 0; i < 14; i++) {
        const sd = G.hash(i, 3), sp = 0.15 + G.hash(i, 7) * 0.2, u = ((t * sp + sd) % 1);
        let px, py, col;
        if (k === 'ember' || k === 'mote') { px = x + G.hash(i, 9) * w + Math.sin(t * 2 + i) * 3; py = y + h - u * h; col = k === 'ember' ? (i % 3 ? 14 : 13) : [27, 17, 11][i % 3]; }
        else { px = x + ((G.hash(i, 9) * w + u * 18) % w); py = y + u * h; col = k === 'snow' ? 9 : k === 'maple' ? [14, 24, 10][i % 3] : [19, 23, 22][i % 3]; }
        c.fillStyle = P[col]; c.globalAlpha = Math.sin(u * Math.PI); c.fillRect(Math.round(px), Math.round(py), 1, 1); c.globalAlpha = 1;
      }
    }
    if (G.THEMES[th].grade && !lock) { const [m, col, a] = G.THEMES[th].grade; c.globalCompositeOperation = m; c.globalAlpha = a; c.fillStyle = col; c.fillRect(x, y, w, h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    if (lock) { c.fillStyle = 'rgba(8,8,8,0.55)'; c.fillRect(x, y, w, h); H().icon(c, 'i_lock', x + w / 2, y + h / 2 - 2); }
    c.restore();
  }
  // ---- 卡片 ----
  function card(c, x, y, w, h, si, act, LD) {
    const I = info(si), lock = !open(si), best = si ? G.SoloW.best(si) : null, col = lock ? 3 : act ? 13 : 6;
    H().box(c, x, y, w, h, 1, col, false);
    const pw = LD ? Math.round(w * 0.42) : w - 8, ph = LD ? h - 8 : Math.round(G.clamp(h * 0.4, 66, 128));
    preview(c, x + 4, y + 4, pw, ph, si, lock, act);
    if (!act) { const nm = si ? si + '  ' + I.n : I.n, l = G.cnWrap(nm, w - 8)[0], lw = G.cnW(l); if (x + w / 2 - lw / 2 >= 0 && x + w / 2 + lw / 2 <= R.uw) G.cn(c, l, x + w / 2, LD ? y + h - 16 : y + ph + 8, lock ? 4 : 7, 0.5); return; }   // 旁邊的卡：名字整個在畫面內才畫
    let ix = LD ? x + pw + 10 : x + 6, iy = LD ? y + 5 : y + ph + 8; const iw = LD ? w - pw - 16 : w - 12;
    // 關卡編號＋名稱、英文
    if (si) { const bw = 13; c.fillStyle = P[lock ? 3 : DCOL[I.d]]; c.fillRect(ix, iy + 1, bw, 11); G.text(c, String(si), ix + 7, iy + 4, 0, 1, null, 0.5); }
    const nx = si ? ix + 17 : ix, nl = G.cnWrap(I.n, iw - (nx - ix)); nl.forEach((l, i) => G.cn(c, l, nx, iy + i * 13, lock ? 5 : 9)); iy += nl.length * 13;
    G.text(c, I.en, ix, iy + 1, lock ? 3 : 5); iy += 10;
    // 難度
    G.cn(c, '難度', ix, iy, 6);
    if (si) { const sx = ix + G.cnW('難度') + 4; if (sx + 45 + 4 + G.cnW(DIFF[I.d]) <= ix + iw) { skulls(c, sx, iy + 4, I.d); G.cn(c, DIFF[I.d], sx + 49, iy, lock ? 4 : DCOL[I.d]); } else { G.cn(c, DIFF[I.d], sx, iy, lock ? 4 : DCOL[I.d]); iy += 13; skulls(c, ix, iy + 4, I.d); } }
    else G.cn(c, '越打越強', ix + G.cnW('難度') + 4, iy, 7);
    iy += 15;
    // 特殊規則（重點上色）
    if (lock) { const pv = info(si - 1); G.cnWrap('通關「' + pv.n + '」解鎖', iw).forEach(l => { G.cn(c, l, ix, iy, 6); iy += 13; }); }
    else if (I.rule) G.cnWrapRich(I.rule, iw).forEach(l => { G.cnRich(c, l, ix, iy, 7); iy += 13; });
    iy += 3;
    // 直屏空間夠：列出這關會出現的敵人（小圖）＋獵手數
    if (!LD) {
      const all = [...new Set(I.roster.flat().concat([I.boss]))], foot = y + h - 18;
      if (iy + 30 <= foot) {
        G.cn(c, '出沒', ix, iy, 6); iy += 14;
        const imgs = all.map(nm => { const f = G.SPR[G.VIS[nm].spr][0]; return lock ? G.glowOf(f.n, 0, 1, 2).tint : G.foeImg(nm, f.m); }), rows = [[]]; let rw = 0;
        for (const im of imgs) { if (rw + im.width > iw && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(im); rw += im.width + 3; }
        for (const row of rows) { const rh = Math.max(...row.map(im => im.height)); if (iy + rh > foot - 14) break; let sx = ix; for (const im of row) { if (lock) c.drawImage(im, Math.round(sx), Math.round(iy + rh - im.height)); else rim(c, im, Math.round(sx), Math.round(iy + rh - im.height)); sx += im.width + 3; } iy += rh + 3; }
        iy += 2;
        const hn = si ? I.hunt.n : 1;
        if (iy + 13 <= foot) { H().icon(c, 'i_attack', ix + 4, iy + 6); G.cn(c, hn ? '敵方獵手 ×' + hn : '沒有敵方獵手', ix + 11, iy, hn ? 14 : 6); iy += 14; }
      }
    }
    // 獎勵與星等
    if (si) {
      const gap = LD ? y + h - 15 : Math.max(iy, y + h - 16);
      const sw = S.stars(c, ix, gap, best.s, 3, 9);
      H().icon(c, 'i_key', ix + sw + 8, gap + 4);
      const rt = best.c ? '已通關 ' + best.c + ' 次' : '首通 +' + I.rew;
      if (G.cnW(rt) + sw + 18 <= iw) G.cn(c, rt, ix + sw + 15, gap - 2, best.c ? 6 : 13);
    } else G.cnWrap('不計星等', iw).forEach(l => { G.cn(c, l, ix, iy, 5); iy += 13; });
  }
  // ---- 背景：選到的關卡場景顏色＋天氣（換關時淡入）----
  function bg(c, uw, uh) {
    const si = ORDER[Math.round(pos)], th = info(si).theme, T = G.THEMES[th];
    c.fillStyle = T.sky; c.fillRect(0, 0, uw, uh);
    const gh = Math.round(uh * 0.42), strip = G.withTheme(th, () => G.groundStrip(Math.ceil(uw / 2), Math.ceil(gh / 2)));
    c.globalAlpha = 0.5; c.drawImage(strip, 0, uh - gh, Math.ceil(uw / 2) * 2, Math.ceil(gh / 2) * 2); c.globalAlpha = 1;
    const g = c.createLinearGradient(0, uh - gh, 0, uh - gh + 30); g.addColorStop(0, T.sky); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, uh - gh, uw, 30);
    // 天氣
    if (wx.length < 40 && Math.random() < 0.5) wx.push({ x: Math.random() * uw, y: T.wx === 'ember' || T.wx === 'mote' ? uh + 2 : -2, v: G.rr(8, 22), s: Math.random() * 6, k: T.wx });
    for (let i = wx.length - 1; i >= 0; i--) {
      const q = wx[i], up = q.k === 'ember' || q.k === 'mote', dt = G.Menus.dt || 1 / 60;
      q.y += (up ? -q.v : q.v) * dt; q.x += Math.sin(t * 1.5 + q.s) * 6 * dt + (q.k === 'maple' || q.k === 'petal' ? 6 * dt : 0);
      if (q.y < -4 || q.y > uh + 4 || q.k !== T.wx) { wx.splice(i, 1); continue; }
      const col = q.k === 'snow' ? 9 : q.k === 'ember' ? (q.s > 3 ? 14 : 13) : q.k === 'mote' ? [27, 17, 11][(q.s | 0) % 3] : q.k === 'maple' ? [14, 24, 10][(q.s | 0) % 3] : [19, 23, 22][(q.s | 0) % 3];
      c.fillStyle = P[col]; c.globalAlpha = 0.8; c.fillRect(Math.round(q.x), Math.round(q.y), q.k === 'snow' || q.k === 'mote' ? 1 : 2, 1); c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(8,8,8,0.35)'; c.fillRect(0, 0, uw, uh);
  }
  S.draw = c => {
    const M = ui(); M.tick(); const dt = G.Menus.dt || 1 / 60; t += dt;
    const uw = R.uw, uh = R.uh, I = R.ins, LD = M.land();
    const dg = drag && drag.moved;
    if (!dg) pos += (tgt - pos) * (1 - Math.exp(-dt * 13));
    if (Math.abs(tgt - pos) < 0.01 && !dg) { pos = tgt; if (cried !== tgt) { cried = tgt; const si = ORDER[tgt]; if (open(si)) G.Audio.cry(info(si).boss); G.Audio.play('snap'); } }
    bg(c, uw, uh);
    const y0 = M.header(c, '單人關卡');
    const bh = 18, by = uh - I.b - bh - 6, cy = y0 + 2, ch = by - 8 - cy;
    const cw = LD ? Math.min(uw - I.l - I.r - 70, 300) : Math.min(uw - I.l - I.r - 36, 200), cx = Math.round(uw / 2 - cw / 2);
    // 旁邊的卡（小、暗）→ 中間的卡
    const sp = cw + 10, order = ORDER.map((_, i) => i).sort((a, b) => Math.abs(b - pos) - Math.abs(a - pos));
    for (const i of order) {
      const d = i - pos, ad = Math.abs(d); if (ad > 1.6) continue;
      const act = ad < 0.5, sc = 1 - Math.min(ad, 1) * 0.12, w = Math.round(cw * sc), h = Math.round(ch * sc), x = Math.round(uw / 2 + d * sp * 0.92 - w / 2), y = Math.round(cy + (ch - h) / 2);
      card(c, x, y, w, h, ORDER[i], act, LD);
      if (!act) { c.fillStyle = 'rgba(10,10,10,' + Math.min(0.6, ad * 0.55).toFixed(3) + ')'; c.fillRect(x, y, w + 1, h + 1); }
    }
    // 滑動（v3.1 改順）：整排都能拖、卡片跟著手指走；放開時看甩的速度——輕輕一甩或拖超過 12% 就換到下一張，甩得快可以連跳
    const px = sp * 0.92;
    U().btns.push({ id: 'stDrag', x: 0, y: cy, w: uw, h: ch,
      down: ux => { drag = { x0: ux, lx: ux, lt: performance.now(), p0: pos, b0: Math.round(tgt), v: 0, moved: false }; },
      hdrag: ux => { if (!drag) return; drag.moved = true; const now = performance.now(), dt2 = Math.max(8, now - drag.lt) / 1000;
        drag.v = G.lerp(drag.v, -(ux - drag.lx) / px / dt2, 0.45); drag.lx = ux; drag.lt = now;
        let p = drag.p0 - (ux - drag.x0) / px; if (p < 0) p *= 0.35; if (p > ORDER.length - 1) p = ORDER.length - 1 + (p - ORDER.length + 1) * 0.35; pos = p; },   // 兩端有彈性
      up: () => { if (!drag) return; const D = drag; drag = null;
        if (!D.moved) { const k = D.x0 < cx ? -1 : D.x0 > cx + cw ? 1 : 0; if (k) step(k); return; }   // 點旁邊的卡＝換過去
        const v = performance.now() - D.lt > 90 ? 0 : D.v, mv = pos - D.b0;
        let n = D.b0;
        if (Math.abs(v) > 0.9 || Math.abs(mv) > 0.12) { const dir = Math.abs(v) > 0.9 ? Math.sign(v) : Math.sign(mv); n = D.b0 + dir * Math.max(1, Math.round(Math.abs(mv + G.clamp(v * 0.22, -2, 2)))); }
        n = G.clamp(n, 0, ORDER.length - 1); if (n !== tgt) G.Audio.play('tick'); tgt = n; } });
    // 左右箭頭
    const arrow = (dir, x) => { const id = 'sta' + dir, en = dir < 0 ? tgt > 0 : tgt < ORDER.length - 1, o = pr(id) ? 1 : 0, ay = Math.round(cy + ch / 2);
      c.fillStyle = P[en ? 9 : 3]; for (let k = 0; k < 5; k++) c.fillRect(x + (dir < 0 ? k : -k) + o * dir, ay - 4 + k, 1, 9 - k * 2);
      if (en) H().btn(id, x - 8, ay - 12, 16, 24, () => { U().press[id] = 0.12; }, () => step(dir)); };
    arrow(-1, I.l + 6); arrow(1, uw - I.r - 7);
    // 頁點
    const n = ORDER.length, dx0 = Math.round(uw / 2 - n * 3); for (let k = 0; k < n; k++) { c.fillStyle = P[k === Math.round(pos) ? 13 : 3]; c.fillRect(dx0 + k * 6, by - 5, k === Math.round(pos) ? 4 : 2, 2); }
    // 出發
    const si = ORDER[Math.round(tgt)], bw = Math.min(cw, 140), bx = Math.round(uw / 2 - bw / 2);
    if (open(si)) M.btnPrimary(c, 'stGo', bx, by, bw, bh, '出發', go);
    else { H().key(c, bx, by, bw, bh, 0, 3); G.cn(c, '尚未解鎖', bx + bw / 2, by + 3, 4, 0.5); H().btn('stLock', bx, by, bw, bh, null, () => G.UI.h.deny('stLock')); }
  };
  const pr = id => (U().press[id] || 0) > 0;
  return S;
})();
G.Menus.stages = c => G.Solo.draw(c);
