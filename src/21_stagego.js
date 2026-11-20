// ============================================================
// v3.1 出發過場：選關畫面 → 戰場
// 1. 斜切黑幕：左右兩片斜面帶著主題色光邊合上（swoosh → 交擊）
// 2. 標題卡：主題天空＋地面＋天氣，英雄和首領從兩側入場對峙；STAGE 編號、金線展開、關卡名逐行揭開、難度骷髏一顆顆亮起
//    黑幕合上後才建立戰場（G.UI.start），建好前戰場不更新；建好後點一下可以跳過
// 3. 上下開幕：整張標題卡從中間裂開、上下滑走，露出戰場
// ============================================================
G.StageGo = (() => {
  const S = {}, R = G.Render, P = G.PAL;
  const ACC = { forest: '#a8e889', autumn: '#ffa04a', snow: '#a8dcff', lava: '#ff7a45', abyss: '#c39bff' };
  const DCOL = [0, 11, 13, 14, 10, 17];
  const SKULL = ['.#####.', '#######', '#.##.##', '#######', '.#.#.#.'];
  const CLOSE = 0.42, HOLD = 1.75, OPEN = 0.5, BUILD = 0.12;
  const eo = k => 1 - Math.pow(1 - k, 3), eio = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, seg = (t, a, b) => G.clamp((t - a) / (b - a), 0, 1);
  let st = null;
  const info = si => si ? G.SOLO[si - 1] : { theme: 'forest', n: '經典戰場', en: 'CLASSIC', d: 0, boss: 'bigbear' };
  S.go = si => {
    if (st) return;
    const I = info(si), T = G.Team.get(), hero = (G.HEROES[T.hero] || G.HEROES[0]).name;
    st = { si, I, hero, t: 0, ph: 'close', built: false, said: {}, wx: [], cv: null };
    G.Audio.play('swoosh');
  };
  S.active = () => !!st;
  S.skip = () => { if (st && st.ph === 'hold' && st.built && st.t > 0.7) { st.ph = 'open'; st.t = 0; G.Audio.play('swoosh'); } };
  S.hold = () => !!st && st.ph !== 'open';                       // 開幕前戰場先不動（開場對陣留給玩家看）
  S._t = (ph, t) => { if (st) { st.ph = ph; st.t = t; if (ph !== 'close' && !st.built) build(); } };   // 測試用
  const once = (k, fn) => { if (!st.said[k]) { st.said[k] = 1; fn(); } };
  function build() { st.built = true; G.UI.start(st.si); }
  // 小骷髏
  function skull(c, x, y, col) { SKULL.forEach((row, j) => { for (let i = 0; i < row.length; i++) { if (row[i] === '#') { c.fillStyle = P[col]; c.fillRect(x + i, y + j, 1, 1); } else if (j === 2 && (i === 1 || i === 4)) { c.fillStyle = P[0]; c.fillRect(x + i, y + j, 1, 1); } } }); }
  // 角色（2 倍、腳底在 fy）
  function actor(c, nm, cx, fy, face, t, foe) {
    const fr = G.SPR[G.VIS[nm].spr], f = fr[((t * 5) | 0) % fr.length], src = face < 0 ? f.m : f.n, img0 = foe ? G.foeImg(nm, src) : src, k = 2, img = G.scaled(img0, k);
    const x = Math.round(cx - img.width / 2), y = Math.round(fy - img.height - (G.VIS[nm].fly ? 10 : 0));
    G.pxDisc(c, cx, fy, img.width * 0.34, 3, 0, 0.5);
    if (foe) { const gl = G.glowOf(img, 10, 1, 2); c.globalAlpha = 0.55 + Math.sin(t * 6) * 0.2; c.drawImage(gl.c, x - gl.p, y - gl.p); c.globalAlpha = 1; }
    c.drawImage(img, x, y);
  }
  // 標題卡（畫到自己的畫布，開幕時才能上下裂開）
  function card(uw, uh, t) {
    if (!st.cv || st.cv.width !== uw || st.cv.height !== uh) st.cv = G.canvas(uw, uh);
    const c = st.cv.getContext('2d'), I = st.I, th = I.theme, T = G.THEMES[th], acc = ACC[th] || '#ffd84a', cx = Math.round(uw / 2);
    c.imageSmoothingEnabled = false;
    // 天空：主題色往下漸暗
    const g = c.createLinearGradient(0, 0, 0, uh); g.addColorStop(0, T.sky); g.addColorStop(1, '#050507'); c.fillStyle = g; c.fillRect(0, 0, uw, uh);
    // 地面（下方 30%）
    const gh = Math.round(uh * 0.3), gy = uh - gh, sw = Math.ceil(uw / 2), shh = Math.ceil(gh / 2);
    c.drawImage(G.withTheme(th, () => G.groundStrip(sw, shh)), 0, gy, sw * 2, shh * 2);
    const gg = c.createLinearGradient(0, gy, 0, gy + 26); gg.addColorStop(0, T.sky); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.fillRect(0, gy, uw, 26);
    if (T.grade) { const [m, col, a] = T.grade; c.globalCompositeOperation = m; c.globalAlpha = a; c.fillStyle = col; c.fillRect(0, 0, uw, uh); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    // 天氣
    const dt = G.Menus.dt || 1 / 60;
    if (st.wx.length < 46 && Math.random() < 0.7) st.wx.push({ x: Math.random() * uw, y: T.wx === 'ember' || T.wx === 'mote' ? uh + 2 : -2, v: G.rr(10, 26), s: Math.random() * 6 });
    for (let i = st.wx.length - 1; i >= 0; i--) {
      const q = st.wx[i], up = T.wx === 'ember' || T.wx === 'mote'; q.y += (up ? -q.v : q.v) * dt; q.x += Math.sin(t * 1.5 + q.s) * 6 * dt + (T.wx === 'maple' || T.wx === 'petal' ? 8 * dt : 0);
      if (q.y < -4 || q.y > uh + 4) { st.wx.splice(i, 1); continue; }
      const col = T.wx === 'snow' ? 9 : T.wx === 'ember' ? (q.s > 3 ? 14 : 13) : T.wx === 'mote' ? [27, 17, 11][(q.s | 0) % 3] : T.wx === 'maple' ? [14, 24, 10][(q.s | 0) % 3] : [19, 23, 22][(q.s | 0) % 3];
      c.fillStyle = P[col]; c.globalAlpha = 0.85; c.fillRect(Math.round(q.x), Math.round(q.y), T.wx === 'snow' || T.wx === 'mote' ? 1 : 2, 1); c.globalAlpha = 1;
    }
    // 英雄 vs 首領：從兩側滑進來
    const fy = gy + Math.round(gh * 0.55), ka = eo(seg(t, 0.05, 0.6)), lx = Math.round(G.lerp(-30, uw * 0.22, ka)), rx = Math.round(G.lerp(uw + 40, uw * 0.78, ka));
    actor(c, st.hero, lx, fy, 1, t, false); actor(c, I.boss, rx, fy, -1, t, true);
    // 標題區
    const ty = Math.round(uh * (uh > uw ? 0.27 : 0.2));
    const tag = st.si ? 'STAGE ' + st.si : 'CLASSIC', k1 = seg(t, 0.12, 0.4);
    if (k1 > 0) { c.globalAlpha = k1; G.text(c, tag, cx, ty - 12 + Math.round((1 - eo(k1)) * 4), 7, 1, null, 0.5); c.globalAlpha = 1; }
    // 金線：從中間往兩邊展開，一顆亮點來回跑
    const lw = Math.round(Math.min(uw * 0.72, 230) * eo(seg(t, 0.2, 0.55)));
    if (lw > 1) {
      c.fillStyle = acc; c.fillRect(cx - (lw >> 1), ty, lw, 1); c.globalAlpha = 0.35; c.fillRect(cx - (lw >> 1), ty + 1, lw, 1); c.globalAlpha = 1;
      const sp = (t * 0.9) % 1, spx = Math.round(cx - lw / 2 + sp * lw); c.fillStyle = '#ffffff'; c.fillRect(spx - 1, ty, 3, 1); c.fillRect(spx, ty - 1, 1, 3);
    }
    // 關卡名：大字，從金線往下揭開
    const k2 = seg(t, 0.32, 0.62);
    if (k2 > 0) {
      once('name', () => G.Audio.play('stamp'));
      const e = G.cnImg(I.n, 9), sc = uw >= 240 ? 3 : 2, w = e.c.width * sc, h = e.c.height * sc, nx = Math.round(cx - e.w * sc / 2) - 2 * sc, ny = ty + 5;
      c.save(); c.beginPath(); c.rect(0, ny, uw, Math.ceil(h * eo(k2))); c.clip();
      const sh = G.cnImg(I.n, 0); c.drawImage(sh.c, nx + sc, ny + sc, w, h); c.drawImage(e.c, nx, ny, w, h); c.restore();
      // 英文副標
      const k3 = seg(t, 0.55, 0.8), ey = ny + h + 3;
      if (k3 > 0 && st.si) { c.globalAlpha = k3; G.text(c, I.en, cx, ey, 5, 1, null, 0.5); c.globalAlpha = 1; }
      // 難度骷髏
      if (st.si) for (let i = 0; i < 5; i++) {
        const ks = seg(t, 0.75 + i * 0.08, 0.82 + i * 0.08); if (ks <= 0) continue;
        const on = i < I.d; if (on) once('sk' + i, () => G.Audio.play('tick'));
        const sx = Math.round(cx - 22 + i * 9), sy = ey + 10 - Math.round((1 - eo(ks)) * 3);
        c.globalAlpha = ks; skull(c, sx, sy, on ? DCOL[I.d] : 3); c.globalAlpha = 1;
      }
    }
    // 黑幕合上後淡入
    const fi = 1 - seg(t, 0, 0.22); if (fi > 0) { c.fillStyle = 'rgba(6,6,8,' + fi.toFixed(3) + ')'; c.fillRect(0, 0, uw, uh); }
    // 細黑邊框（電影感）
    c.fillStyle = '#000'; c.fillRect(0, 0, uw, 4); c.fillRect(0, uh - 4, uw, 4);
    return st.cv;
  }
  S.draw = (c, dt) => {
    if (!st) return;
    const uw = R.uw, uh = R.uh, U = G.UI; st.t += Math.min(dt, 0.05);
    U.btns.push({ id: 'stageGo', x: -10, y: -10, w: uw + 20, h: uh + 20, up: () => S.skip() });   // 吃掉點擊；建好後點一下跳過
    if (R.hi) for (const q of R.hi) q.cov = true;
    const acc = ACC[st.I.theme] || '#ffd84a';
    if (st.ph === 'close') {
      const k = eio(seg(st.t, 0, CLOSE)), s = Math.round(uh * 0.45), a = (uw / 2 + s) * k, b = uw - (uw / 2) * k;
      c.fillStyle = '#08080a';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(a, 0); c.lineTo(a - s, uh); c.lineTo(0, uh); c.fill();
      c.beginPath(); c.moveTo(uw, 0); c.lineTo(b + s * 0, 0); c.lineTo(b - s, uh); c.lineTo(uw, uh); c.fill();
      c.strokeStyle = acc; c.lineWidth = 1;                                                 // 斜邊光
      c.beginPath(); c.moveTo(a, 0); c.lineTo(a - s, uh); c.moveTo(b, 0); c.lineTo(b - s, uh); c.stroke();
      if (st.t >= CLOSE) { once('clash', () => G.Audio.play('opClash')); st.ph = 'hold'; st.t = 0; }
      return;
    }
    if (st.ph === 'hold') {
      c.drawImage(card(uw, uh, st.t), 0, 0);
      if (st.t < 0.12) { c.fillStyle = acc; c.globalAlpha = (1 - st.t / 0.12) * 0.5; c.fillRect(0, 0, uw, uh); c.globalAlpha = 1; }   // 交擊閃光
      if (!st.built && st.t >= BUILD) build();
      if (st.t >= HOLD && st.built) { st.ph = 'open'; st.t = 0; G.Audio.play('swoosh'); }
      return;
    }
    // 開幕：上下裂開
    const k = eio(seg(st.t, 0, OPEN)), cv = card(uw, uh, HOLD + st.t), hh = Math.round(uh / 2), off = Math.round(k * (hh + 6));
    c.drawImage(cv, 0, 0, uw, hh, 0, -off, uw, hh); c.drawImage(cv, 0, hh, uw, uh - hh, 0, hh + off, uw, uh - hh);
    c.fillStyle = acc; c.globalAlpha = 1 - k; c.fillRect(0, hh - off - 1, uw, 1); c.fillRect(0, hh + off, uw, 1); c.globalAlpha = 1;
    if (k > 0.85 && R.hi) for (const q of R.hi) q.cov = false;
    if (st.t >= OPEN) st = null;
  };
  return S;
})();
