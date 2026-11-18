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
  I.reset = () => { I.shk = 0; I.t = 0; parts = []; snd = {}; I.tw = -1; I.st = -1; I.from = null; };
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
    const shk = (t > TC - 0.02 && t < END) || (t > 3.35 && t < 3.6) || I.shk > 0 ? Math.round((Math.random() - 0.5) * (t > TC ? 6 : 4)) : 0;
    c.fillStyle = P[0]; c.fillRect(0, 0, uw, uh);
    c.save(); c.translate(shk, 0);
    // 地面：從中間往兩側長出
    const gk = ss(seg(t, 0.7, 1.25));
    if (gk > 0) {
      const gw = Math.round(uw * gk), gh = uh > uw ? 64 : 40, strip = G.groundStrip(uw, gh * 2);
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
    // 兩軍（v2.5b 重做）：三層依序登場，越前排越大、越晚到、越有份量
    //   後排（1.3 起）：一整排小兵剪影從地平線後方「浮現」（淡入＋上升）
    //   中排（1.9 起）：英雄／首領成群衝進場
    //   前排（2.5 起）：三位主力英雄／三隻最大的首領「從天而降」：落地揚塵＋震動＋重擊聲
    //   3.4 「VS」蓋章＋首領咆哮 → 4.2 全軍衝鋒 → 4.65 對撞
    const RM = G.ROSTER, T0 = G.Team.get(), HN = G.HEROES.map(q => q.name).filter(n => n !== hero);
    const mine = T0.loadout.length ? [...new Set(T0.loadout.map(e => e.n))] : [];
    const PL = [...mine, ...RM.minions.filter(n => !mine.includes(n))];
    const big = ['bigbear', 'polarbear', 'firebear', 'lion', 'tiger', 'buffalo'].filter(n => RM.bosses.includes(n)), BS = [...big, ...RM.bosses.filter(n => !big.includes(n))];
    const dash = ss(seg(t, TD, TC - 0.03)), fr = (t * 8) | 0, port = uh > uw;
    const K = uw >= 300 || port ? 2 : 1, sp = K * 16, half = cx - sp * (port ? 1.1 : 1.4);   // 直屏也用 2 倍（畫面高、人物太小沒氣勢）
    const nB = port ? 5 : 8, nM = port ? 3 : 4, nF = port ? 2 : 3, RY = port ? [2, 22, 44] : [2, 13, 25];   // 直屏畫面高：三排拉開成縱深
    // 高矮層次：巨型（坦克、大首領）放大一級、菁英小個子縮小一級，其他照排的大小 → 隊伍有大有小
    const GIANT = ['treeprotector', 'leafmuscle', 'muscleleafy', 'cannonleafy', 'bigbear', 'polarbear', 'firebear', 'buffalo', 'turtle'], SMALL = ['quickleafy', 'elitequickleafy', 'seedshooter', 'peasniper', 'twinflower', 'mouse', 'whitemouse', 'chipmunk', 'bat', 'gnome', 'penguin', 'cat'];
    const sizeOf = (n, k) => GIANT.includes(n) ? Math.min(3, k + 1) : SMALL.includes(n) ? Math.max(1, k - 1) : k;
    const pick = (src, ns) => ns.filter(n => src.includes(n) && G.VIS[n]);
    const AF = port ? pick([...PL, ...HN], ['treeprotector', HN[0]]) : pick([...PL, ...HN], ['treeprotector', HN[0], 'leafmuscle']);
    const AM = (port ? [HN[1], 'quickleafy', HN[2]] : [HN[1], 'quickleafy', 'cannonleafy', HN[2], 'elitequickleafy']).filter(n => n && G.VIS[n] && !AF.includes(n));
    const EF = port ? pick(BS, ['bigbear', 'tiger']) : pick(BS, ['bigbear', 'tiger', 'polarbear']);
    const EM = (port ? ['firebear', 'gnome', 'lion'] : ['lion', 'firebear', 'penguin', 'buffalo', 'gnome']).filter(n => G.VIS[n] && !EF.includes(n));
    const gl = l => [...l.filter(n => !GIANT.includes(n)), ...l.filter(n => GIANT.includes(n))];   // 巨型角色排在外側（離中間遠），中間留給一般英雄與小個子菁英 → V 字形把主角框在中間
    const rows0 = side => side > 0
      ? [{ l: PL.filter(n => !AF.includes(n) && !AM.includes(n)).slice(0, nB), k: 1, y: gy + RY[0], t0: 1.3, gap: 0.05, m: 'rise' }, { l: AM, k: K, y: gy + RY[1], t0: 1.9, gap: 0.11, m: 'run' }, { l: AF, k: K, y: gy + RY[2], t0: 2.5, gap: 0.2, m: 'drop' }]
      : [{ l: RM.smalls.filter(n => !EM.includes(n)).slice(0, nB), k: 1, y: gy + RY[0], t0: 1.35, gap: 0.05, m: 'rise' }, { l: EM, k: K, y: gy + RY[1], t0: 1.95, gap: 0.11, m: 'run' }, { l: EF, k: K, y: gy + RY[2], t0: 2.6, gap: 0.2, m: 'drop' }];
    const rows = side => rows0(side).map(r => Object.assign(r, { l: gl(r.l) }));
    const units = [];
    for (const side of [1, -1]) rows(side).forEach((r, ri) => r.l.forEach((n, i) => {
      const f = r.l.length > 1 ? i / (r.l.length - 1) : 0.5, xEnd = cx - side * (sp * 1.5 + 8 + f * (half - 18 - sp * 0.4) * (ri === 0 ? 1 : 0.92)) + (ri === 1 ? side * -4 : 0);
      units.push({ n, side, ri, k: sizeOf(n, r.k), y: r.y + ((i % 2) ? 2 : 0), xEnd, t0: r.t0 + i * r.gap * (ri === 2 ? 1 : 1) + (side < 0 ? 0.04 : 0), m: r.m });
    }));
    // 氣場：兩側的色光（我方綠金、敵方暗紅），隨兵力到齊越來越亮
    { const pw = ss(seg(t, 1.3, 3.0)) * (t > TC ? 0 : 1);
      if (pw > 0) { const glow = (x0, rgb, a) => { const g2 = c.createRadialGradient(x0, gy + 6, 4, x0, gy + 6, half * 1.25); g2.addColorStop(0, 'rgba(' + rgb + ',' + a.toFixed(3) + ')'); g2.addColorStop(1, 'rgba(' + rgb + ',0)'); c.fillStyle = g2; c.fillRect(x0 - half * 1.3, 0, half * 2.6, uh); };
        glow(cx - half * 0.6, '120,220,90', 0.16 * pw); glow(cx + half * 0.6, '220,40,30', (0.2 + (t > 3.35 && t < 4.0 ? 0.12 : 0)) * pw);
        if (Math.random() < 0.5 * pw) parts.push({ x: cx - Math.random() * half, y: gy + 20, vx: G.rr(-4, 4), vy: -G.rr(14, 30), l: G.rr(0.8, 1.4), c: G.pick([11, 16, 20]) });   // 我方：葉片光點上飄
        if (Math.random() < 0.6 * pw) parts.push({ x: cx + Math.random() * half, y: gy + 20, vx: G.rr(-4, 4), vy: -G.rr(16, 34), l: G.rr(0.8, 1.4), c: G.pick([10, 14, 15]) }); } }   // 敵方：火星上飄
    if (t > 1.3 && t < 3.3) { const w = ((t - 1.3) / 0.5) | 0; once('dr' + w, 'opDrum'); }
    for (const u of units.sort((a, b) => a.y - b.y)) {
      if (t < u.t0) continue;
      const lt = t - u.t0, x0 = u.side > 0 ? -28 : uw + 28, foe = u.side < 0;
      let x = u.xEnd, y = u.y, alpha = 1, moving = false, bob = 0;
      if (u.m === 'rise') { const k = ss(seg(lt, 0, 0.5)); y = u.y + (1 - k) * 8; alpha = k * 0.85; }
      else if (u.m === 'run') { const k = ss(seg(lt, 0, 0.6)); x = G.lerp(x0, u.xEnd, k); moving = k < 1; if (moving && fr % 2) parts.push({ x: x - u.side * 8, y: u.y, vx: -u.side * 24, vy: -8, l: 0.3, c: foe ? 4 : 5 }); }
      else { const k = seg(lt, 0, 0.32); y = u.y - (1 - k * k) * (uh * 0.6); if (k >= 1 && !u.landed) { u.landed = 1; }
        if (lt >= 0.32 && !snd['L' + u.n + u.side]) { snd['L' + u.n + u.side] = 1; G.Audio.play('opStomp'); I.shk = 0.12; for (let q = 0; q < 10; q++) parts.push({ x: x + G.rr(-10, 10), y: u.y, vx: G.rr(-40, 40), vy: -G.rr(4, 18), l: 0.45, c: 6 }); }
        if (lt > 0.32 && lt < 0.6) { const r = (lt - 0.32) / 0.28; c.globalAlpha = 1 - r; G.pxEllipse(c, Math.round(x), u.y, 6 + r * 22 * u.k, 2 + r * 6 * u.k, foe ? 10 : 13); c.globalAlpha = 1; } }
      if (!moving && t < TD && u.m !== 'rise') bob = Math.round(Math.abs(Math.sin(t * 6 + u.xEnd)) * -1.5);
      x += u.side * dash * (u.ri === 2 ? 16 : 22);
      if (dash > 0) moving = true;
      c.globalAlpha = alpha; spr(u.n, x, y + bob, u.k, u.side, moving ? fr + u.ri : 0, foe ? (u.ri === 2 && t > 3.35 && t < 3.7 ? 0.35 : u.ri === 0 ? 0.45 : 0.15) : (u.ri === 0 ? 0 : 0)); c.globalAlpha = 1;
    }
    if (I.shk > 0) I.shk -= dt;
    // VS 蓋章（3.4）：白閃＋放大落下＋首領咆哮
    if (t > 3.35 && t < TD + 0.1) {
      once('roar', 'opRoar'); once('vs', 'opStomp');
      const k = ss(seg(t, 3.35, 3.55)), sc = Math.max(2, Math.round((K + 2) * (1 + (1 - k) * 1.5))), vy = Math.round(uh * 0.18), fade = 1 - seg(t, TD - 0.1, TD + 0.1);
      if (t < 3.45) { c.fillStyle = P[9]; c.globalAlpha = (3.45 - t) * 5; c.fillRect(0, 0, uw, uh); c.globalAlpha = 1; }
      c.globalAlpha = fade; for (const [dx, dy, col] of [[1, 1, 0], [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, 13]]) G.text(c, 'VS', cx + dx * Math.max(1, sc >> 1), vy + dy * Math.max(1, sc >> 1), col, sc, null, 0.5); c.globalAlpha = 1;
    }
    if (t > TD) once('chg', 'opCharge');
    if (t > 1.05) {
      const pop = seg(t, 1.05, 1.25), sq = pop < 1 ? Math.round(Math.sin(pop * Math.PI) * 6) : 0;
      once('pop', 'opPop');
      spr(hero, cx - 6 + dash * 14, gy + (port ? 50 : 30) - sq, port ? 3 : K + 1, 1, t > 1.3 ? fr : 0);
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
