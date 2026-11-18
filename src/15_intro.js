'use strict';
/* =========================================================
   開場動畫（v2.5 延長為 5 秒，右下可跳過）
   0.0 一片葉子從天而降 → 0.7 落地發光、地面向兩側長出 → 1.0 英雄冒出來
   → 1.3 雙方大軍一波波進場（我方植物從左、敵方野獸＋首領從右，前排大、後排小，仿貓咪大戰爭的兩軍對陣）
   → 3.3 對峙：首領咆哮、畫面震動 → 4.2 全軍衝鋒 → 4.65 對撞白光 → 標題畫面
   ========================================================= */
G.Intro = (() => {
  const I = { t: 0, flash: 0 }, P = G.PAL, R = G.Render, H = () => G.UI.h;
  const END = 5.0, TC = 4.65, TD = 4.2, ss = t => t * t * (3 - 2 * t), seg = (t, a, b) => G.clamp((t - a) / (b - a), 0, 1);
  let parts = [], snd = {};
  const once = (k, name) => { if (!snd[k]) { snd[k] = 1; G.Audio.play(name); } };
  I.reset = () => { I.t = 0; parts = []; snd = {}; I.tw = -1; I.st = -1; I.from = null; };
  I.skip = () => {
    if (G.UI.screen !== 'intro' && G.UI.screen !== 'tap') return;
    G.UI.screen = 'menu'; G.Menus.resetIntro(); I.flash = 0.35;
    const nm = G.Team.get().name; if (nm && G.SaveUI) G.SaveUI.greet = { t: 0, name: nm };
  };
  function spr(name, x, by, k, face, frame, dark) {
    const fr = G.SPR[G.VIS[name].spr], f = fr[frame % fr.length], img0 = face < 0 ? f.m : f.n, img = k > 1 ? G.scaled(img0, k) : img0;
    const fly = G.VIS[name].fly ? 8 * k : 0, x0 = Math.round(x - img.width / 2), y0 = Math.round(by - img.height - fly);
    G.pxDisc(R.uctx, x, by, img.width * 0.32, 2 + k, 0, 0.5);
    if (dark) { const gl = G.glowOf(img, 10, 1, 2); R.uctx.globalAlpha = 0.55 + Math.sin(I.t * 9) * 0.2; R.uctx.drawImage(gl.c, x0 - gl.p, y0 - gl.p); R.uctx.globalAlpha = 1; }   // 敵人：紅色外光
    R.uctx.drawImage(img, x0, y0);
    if (dark) { const c = R.uctx; c.globalAlpha = dark; c.drawImage(G.scaled(G.glowOf(img0, 0, 1, 2).tint, k), x0, y0); c.globalAlpha = 1; }
  }
  I.draw = c => {
    const dt = Math.min(0.05, G.Menus.dt || 1 / 60);
    G.Menus.ui.tick(); I.t += G.Menus.dt || dt;
    const t = I.t, uw = R.uw, uh = R.uh, cx = Math.round(uw / 2), gy = Math.round(uh * 0.6), Ins = R.ins;
    // 震動
    const shk = (t > TC - 0.02 && t < END) || (t > 3.35 && t < 3.6) ? Math.round((Math.random() - 0.5) * (t > TC ? 6 : 3)) : 0;
    c.fillStyle = P[0]; c.fillRect(0, 0, uw, uh);
    c.save(); c.translate(shk, 0);
    // 地面：從中間往兩側長出
    const gk = ss(seg(t, 0.7, 1.25));
    if (gk > 0) {
      const gw = Math.round(uw * gk), gh = 32, strip = G.groundStrip(uw, gh * 2);
      c.save(); c.beginPath(); c.rect(Math.round(cx - gw / 2), 0, gw, uh); c.clip();
      c.drawImage(strip, 0, gh, uw, gh, Math.round(cx - gw / 2), gy - 6, gw, gh);
      G.stageDeco(c, 0, gy - 16, uw, gh, true);                     // 地面上緣一排樹（森林背景）
      c.restore();
      c.fillStyle = P[0]; for (let k = 0; k < 6; k++) { c.globalAlpha = 0.5 - k * 0.08; c.fillRect(Math.round(cx - gw / 2), gy - 6 + gh - 6 + k, gw, 1); } c.globalAlpha = 1;
      // 草叢
      c.fillStyle = P[6];
      for (let i = 0; i < 22; i++) { const gx = Math.round(cx + (G.hash(i, 3) - 0.5) * uw), gyy = gy - 4 + Math.round(G.hash(i, 7) * 14); if (Math.abs(gx - cx) > gw / 2) continue; c.fillRect(gx, gyy, 1, 2); c.fillRect(gx - 1, gyy + 1, 1, 1); c.fillRect(gx + 1, gyy + 1, 1, 1); }
    }
    // 落葉時：一路灑下柔和的鈴聲光點；小兵跑步時：輕輕的腳步聲
    if (t < 0.68) { const k = (t / 0.085) | 0; if (k !== I.tw) { I.tw = k; G.Audio.play('opTwinkle', 1, 0.05); } }
    if (t > 1.3 && t < 2.05) { const k = (t / 0.14) | 0; if (k !== I.st) { I.st = k; G.Audio.play('opStep', 1, 0.05); } }
    // A：落葉
    if (t < 0.75) {
      const fr0 = I.from || [cx, -12], k = ss(seg(t, 0, 0.7)), lx = G.lerp(fr0[0], cx, k) + Math.sin(t * 9) * 14 * (1 - k) * (I.from ? 0.5 : 1), ly = G.lerp(fr0[1], gy - 4, k);
      const lf = G.scaled(G.SPR.leaf_pt.n, 3), gl = G.glowOf(lf, 11, 1, 3); c.globalAlpha = 0.6 + Math.sin(t * 20) * 0.2; c.drawImage(gl.c, Math.round(lx - lf.width / 2) - gl.p, Math.round(ly - lf.height / 2) - gl.p); c.globalAlpha = 1; c.drawImage(lf, Math.round(lx - lf.width / 2), Math.round(ly - lf.height / 2));
      if (Math.random() < 0.6) parts.push({ x: lx + G.rr(-3, 3), y: ly, vx: G.rr(-8, 8), vy: G.rr(-6, 6), l: 0.5, c: G.pick([11, 16, 13]) });
    }
    if (t >= 0.7) { once('land', 'opLand'); once('swell', 'opSwell'); }
    // 落地光圈
    { const k = seg(t, 0.7, 1.1); if (k > 0 && k < 1) { const r = Math.round(4 + k * 50); G.pxEllipse(c, cx, gy, r, Math.round(r * 0.32), k < 0.5 ? 13 : 11); } }
    // B：嫩芽 → 英雄冒出
    const T = G.Team.get(), hero = G.HEROES[T.hero].name;
    if (t > 0.85 && t < 1.05) { const h = Math.round(seg(t, 0.85, 1.05) * 9); c.fillStyle = P[11]; c.fillRect(cx, gy - h, 1, h); c.fillRect(cx - 2, gy - h, 2, 1); c.fillRect(cx + 1, gy - h + 1, 2, 1); }
    // 兩軍（v2.5）：我方＝玩家的陣容＋其他植物；敵方＝各種野獸＋首領。前排大、後排小、越後面越晚到
    const mine = T.loadout.length ? [...new Set(T.loadout.map(e => e.n))] : [], RM = G.ROSTER;
    const allies = [...mine, ...RM.minions.filter(n => !mine.includes(n))].slice(0, 9), foes = [...RM.smalls.slice(0, 7), RM.bosses[0], RM.bosses[3] || RM.bosses[1], 'hunter'];
    const dash = ss(seg(t, TD, TC - 0.03)), fr = (t * 8) | 0;
    const K = uw >= 300 ? 2 : 1, sp = K * 16;
    if (t > 1.3 && t < 3.3) { const w = ((t - 1.3) / 0.6) | 0; once('dr' + w, 'opDrum'); }   // 進場戰鼓（每 0.6 秒一聲）
    if (t > 3.35) once('roar', 'opRoar'); if (t > TD) once('chg', 'opCharge');
    // 聚光燈（英雄登場後）
    if (t > 1.0) { const a = Math.min(1, (t - 1.0) / 0.3) * (t > TC - 0.05 ? 0 : 1); c.fillStyle = P[9]; for (let y = 0; y < gy; y += 2) { const hw = Math.round(6 + y / gy * 30 * K); c.globalAlpha = a * (0.02 + y / gy * 0.07); c.fillRect(cx - 6 - hw, y, hw * 2 + 12, 2); } c.globalAlpha = a * 0.35; G.pxDisc(c, cx - 6, gy + 2, 26 * K, 6 * K, 9, 0.12); c.globalAlpha = 1; }
    // 排兵：三排（後排在上、小一號；前排在下、大），每隻有自己的出發時間 → 一波波湧進來
    const army = (list, side) => {
      const half = uw / 2 - sp * 1.6, out = [];
      list.forEach((n, i) => {
        const row = i < 3 ? 0 : i < 6 ? 1 : 2, col = row ? (i - (row === 1 ? 3 : 6)) : i, k = row === 0 ? K : Math.max(1, K - 1);
        const big = RM.bosses.includes(n) || n === 'hunter', y = gy + 20 - row * 8 + (col % 2) * 2, span = half - 10;
        const xEnd = cx - side * (sp * 1.6 + 6 + (col + 0.5) * span / (row === 2 ? 3.2 : 3.4) + row * 6), t0 = 1.3 + row * 0.45 + col * 0.12 + (big ? 0.2 : 0);
        out.push({ n, y, k: big ? K : k, xEnd, t0, row, side, big });
      });
      return out;
    };
    for (const u of [...army(allies, 1), ...army(foes, -1)].sort((a, b) => a.y - b.y)) {
      if (t < u.t0) continue;
      const r = ss(seg(t, u.t0, u.t0 + 0.75)), x0 = u.side > 0 ? -24 : uw + 24, idle = r >= 1 && t < TD, bob = idle ? Math.round(Math.abs(Math.sin(t * 6 + u.xEnd)) * -1.5) : 0;
      const x = G.lerp(x0, u.xEnd, r) + u.side * dash * (u.big ? 14 : 22), moving = r < 1 || dash > 0;
      spr(u.n, x, u.y + bob, u.k, u.side, moving ? fr + u.row : 0, u.side < 0 ? (u.big && t > 3.35 && t < 3.7 ? 0.35 : 0.15) : 0);
      if (moving && fr % 2 && Math.random() < 0.5) parts.push({ x: x - u.side * 6, y: u.y, vx: -u.side * 20, vy: -8, l: 0.3, c: u.side > 0 ? 5 : 4 });
    }
    // 對峙：首領咆哮的衝擊環＋敵方那半邊泛紅
    if (t > 3.35 && t < 3.9) { const k = seg(t, 3.35, 3.9), bx = Math.round(uw - (uw / 2 - sp * 1.6) * 0.5); c.globalAlpha = 1 - k; G.pxEllipse(c, bx, gy - 10 * K, 6 + k * 50, 3 + k * 22, 10); c.globalAlpha = 1; }
    if (t > 3.3 && t < TC) { const a = 0.18 * seg(t, 3.3, 3.6), g2 = c.createLinearGradient(cx, 0, uw, 0); g2.addColorStop(0, 'rgba(180,20,20,0)'); g2.addColorStop(1, 'rgba(180,20,20,' + a.toFixed(3) + ')'); c.fillStyle = g2; c.fillRect(cx, 0, uw - cx, uh); }
    if (t > 1.05) {
      const pop = seg(t, 1.05, 1.25), sq = pop < 1 ? Math.round(Math.sin(pop * Math.PI) * 6) : 0;
      once('pop', 'opPop');
      spr(hero, cx - 6 + dash * 14, gy + 14 - sq, K + 1, 1, t > 1.3 ? fr : 0);
    }
    // D：對撞白光＋星芒
    if (t > TC) {
      once('hit', 'opClash');
      const k = seg(t, TC, END), r = Math.round(6 + k * 60);
      c.fillStyle = P[9];
      for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4, l = r * (a % 2 ? 0.6 : 1); G.pxLine(c, cx + 8, gy - 14, cx + 8 + Math.cos(ang) * l, gy - 14 + Math.sin(ang) * l * 0.7, a % 2 ? 1 : 2); }
      c.globalAlpha = Math.min(1, k * 1.6); c.fillRect(0, 0, uw, uh); c.globalAlpha = 1;
    }
    // 粒子
    for (const p of parts) { p.l -= dt; if (p.l <= 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; c.fillStyle = P[p.c]; c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    parts = parts.filter(p => p.l > 0);
    c.restore();
    // 跳過（右下）
    const bw = G.cnW('跳過') + 22, bx = uw - Ins.r - bw - 2, by = uh - Ins.b - 18, o = G.Menus.ui.pr('skip') ? 1 : 0;
    H().key(c, bx, by + o, bw, 16, o, 6);
    G.cn(c, '跳過', bx + 5, by + 2 + o, 8); H().icon(c, 'i_skip', bx + bw - 9, by + 8 + o);
    G.Menus.ui.tap('skip', bx, by, bw, 16, () => I.skip());
    if (t >= END) I.skip();
  };
  // 標題畫面一開始的白光淡出
  I.drawFlash = c => { if (I.flash <= 0) return; I.flash -= G.Menus.dt || 1 / 60; c.fillStyle = P[9]; c.globalAlpha = G.clamp(I.flash / 0.35, 0, 1); c.fillRect(0, 0, R.uw, R.uh); c.globalAlpha = 1; };
  return I;
})();
G.Menus.intro = c => G.Intro.draw(c);
// ---------- 「點一下開始」：瀏覽器規定第一次點擊前不能出聲，所以先用這一下解鎖聲音，開場動畫才有完整音效 ----------
// 葉子停在畫面上方輕輕飄、發光；點一下（或按任意鍵）→ 解鎖聲音 → 葉子直接接到開場動畫裡落下
G.Intro.tapT = 0;
G.Intro.start = () => { const f = G.Intro.from; G.Audio.init(); G.Audio.musicPrime('menu'); G.Intro.reset(); G.Intro.from = f; G.UI.screen = 'intro'; };   // 葉子從「點一下開始」畫面的位置接著落下
G.Menus.tap = c => {
  const M = G.Menus.ui, R = G.Render, P = G.PAL, uw = R.uw, uh = R.uh;
  M.tick(); const t = (G.Intro.tapT += G.Menus.dt || 0.016);
  if (G.Audio.running()) { G.Intro.start(); return; }   // 已允許出聲（例如常玩的網站）→ 直接開演
  c.fillStyle = P[0]; c.fillRect(0, 0, uw, uh);
  const a = Math.min(1, t / 0.6), cx = Math.round(uw / 2), ly = Math.round(uh * 0.3 + Math.sin(t * 1.6) * 3);   // 葉子：開場動畫從這個位置接著落下
  const lf = G.scaled(G.SPR.leaf_pt.n, 3), gl = G.glowOf(lf, 11, 1, 3), lx = Math.round(cx + Math.sin(t * 1.1) * 6);
  G.Intro.from = [lx, ly];
  c.globalAlpha = a * (0.75 + Math.sin(t * 3) * 0.25); c.drawImage(gl.c, lx - lf.width / 2 - gl.p, ly - lf.height / 2 - gl.p);
  c.globalAlpha = a; c.drawImage(lf, lx - lf.width / 2, ly - lf.height / 2);
  // 光點：慢慢往上飄
  for (let i = 0; i < 10; i++) { const k = (t * 0.25 + i / 10) % 1, x = cx + Math.sin(i * 2.3 + t * 0.7) * uw * 0.32, y = uh * (0.95 - k * 0.8); c.globalAlpha = a * Math.sin(k * Math.PI) * 0.7; c.fillStyle = P[i % 3 ? 11 : 13]; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
  const desk = !matchMedia('(pointer: coarse)').matches, lab = desk ? '點一下或按任意鍵開始' : '點一下開始';
  c.globalAlpha = a * (0.8 + Math.sin(t * 2.6) * 0.2); G.cn(c, lab, cx, Math.round(uh * 0.62), 9, 0.5);
  c.globalAlpha = a * 0.8; G.cn(c, '建議開啟聲音', cx, Math.round(uh * 0.62) + 18, 6, 0.5); c.globalAlpha = 1;
  G.UI.h.btn('tapStart', 0, 0, uw, uh, null, () => G.Intro.start());
};
