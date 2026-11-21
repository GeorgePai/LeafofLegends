'use strict';
/* =========================================================
   v3.14 操作設定
   - 移動方式：搖桿／點地面（存在這台裝置）
   - 按鈕位置自訂：技能 1／2／大招、被動、視角置中、放大縮小、搖桿
     仿傳說對決的排版編輯：拖曳移動、點選後調大小、重疊會變紅不能儲存、一鍵重設；直屏、橫屏各存一份
   - 虛擬搖桿：在搖桿那半邊的下方任意位置按下就出現（離預設位置近就從預設位置開始），拖太遠底座會跟著走
   ========================================================= */
G.Ctl = (() => {
  const C = {}, KEY = 'leafwar_ctl', P = G.PAL;
  const H = () => G.UI.h, U = () => G.UI;
  const touchDev = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  C.s = null;
  C.get = () => {
    if (!C.s) {
      let v = null; try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { }
      C.s = Object.assign({ move: touchDev() ? 'joy' : 'tap' }, v && typeof v === 'object' ? v : {});
      C.s.lay = Object.assign({ p: {}, l: {} }, C.s.lay && typeof C.s.lay === 'object' ? C.s.lay : {});
    }
    return C.s;
  };
  C.save = () => { try { localStorage.setItem(KEY, JSON.stringify(C.get())); } catch (e) { } };
  C.joyOn = () => C.get().move === 'joy';
  C.setMove = m => { C.get().move = m; C.save(); C.joyEnd(); };

  // ---------- 版面 ----------
  C.IDS = ['joy', 'sk0', 'sk1', 'sk2', 'ps', 'zoom', 'cam'];
  C.NAME = { sk0: '技能 1', sk1: '技能 2', sk2: '大招', ps: '被動', cam: '視角置中', zoom: '放大縮小', joy: '搖桿' };
  const BASE = { sk0: [28, 28], sk1: [28, 28], sk2: [32, 32], ps: [20, 20], cam: [16, 16], zoom: [35, 16], joy: [56, 56] };
  C.KMIN = 0.8; C.KMAX = 1.4;
  // 預設位置：[錨點 x（l 左／r 右）, 錨點 y（t 上／b 下）, 中心離錨點 x, 中心離錨點 y]
  // 技能沿右下角排成弧形（反 L）：左下 技能 1 → 技能 2 → 右上 大招；被動（方形）在角落
  const DEF = {
    p: { ps: ['r', 'b', 17, 17], sk0: ['r', 'b', 66, 24], sk1: ['r', 'b', 50, 55], sk2: ['r', 'b', 17, 69], cam: ['r', 'b', 10, 101], zoom: ['r', 'b', 40, 101], joy: ['l', 'b', 44, 46] },
    l: { ps: ['r', 'b', 17, 17], sk0: ['r', 'b', 66, 24], sk1: ['r', 'b', 50, 55], sk2: ['r', 'b', 17, 69], cam: ['r', 'b', 96, 10], zoom: ['r', 'b', 128, 10], joy: ['l', 'b', 48, 48] }
  };
  C.port = () => G.Render.uh > G.Render.uw;
  C.okey = () => C.port() ? 'p' : 'l';
  C.area = () => { const R = G.Render, I = R.ins; return { L: I.l, T: I.t, R: R.uw - I.r, B: R.uh - I.b }; };
  C.layNow = () => (C.ed ? C.ed.lay : C.get().lay[C.okey()]) || {};
  C.rect = (id, lay) => {
    const A = C.area(), o = (lay || C.layNow())[id] || {}, a = o.a || DEF[C.okey()][id], k = o.k || 1, bs = BASE[id], w = Math.round(bs[0] * k), h = Math.round(bs[1] * k);
    let cx = a[0] === 'l' ? A.L + a[2] : A.R - a[2], cy = a[1] === 't' ? A.T + a[3] : A.B - a[3];
    cx = G.clamp(cx, A.L + w / 2, A.R - w / 2); cy = G.clamp(cy, A.T + h / 2, A.B - h / 2);
    return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, cx: Math.round(cx), cy: Math.round(cy), k };
  };
  C.anchor = (cx, cy) => { const A = C.area(), ax = cx < (A.L + A.R) / 2 ? 'l' : 'r', ay = cy < (A.T + A.B) / 2 ? 't' : 'b'; return [ax, ay, Math.round(ax === 'l' ? cx - A.L : A.R - cx), Math.round(ay === 't' ? cy - A.T : A.B - cy)]; };
  // 主動技對應的位置：3 招 → 技能 1、2、大招；2 招 → 技能 2、大招（第 2 個被動放在技能 1 的位置）
  C.slotOf = (i, n) => n >= 3 ? 'sk' + Math.min(2, i) : 'sk' + (i + 3 - n);
  // 固定不能放的區域（左上角英雄資訊、右上角小地圖和按鈕）
  C.fixed = () => { const A = C.area(); return [{ x: A.L, y: A.T, w: 112, h: 34 }, { x: A.R - 62, y: A.T, w: 62, h: 62 }]; };
  const hit = (a, b, m = 2) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
  C.bad = lay => { const r = {}, ids = C.IDS.filter(id => id !== 'joy' || C.joyOn()), rs = Object.fromEntries(ids.map(id => [id, C.rect(id, lay)])), fx = C.fixed();
    ids.forEach((a, i) => { for (const f of fx) if (hit(rs[a], f, 0)) r[a] = 1; ids.slice(i + 1).forEach(b => { if (hit(rs[a], rs[b])) { r[a] = 1; r[b] = 1; } }); });
    return r; };

  // ---------- 虛擬搖桿 ----------
  const J = C.J = { on: false, bx: 0, by: 0, kx: 0, ky: 0, dir: null };
  C.joyZone = (ux, uy) => {
    if (!C.joyOn()) return false;
    const A = C.area(), r = C.rect('joy'), left = r.cx < (A.L + A.R) / 2;
    if (Math.hypot(ux - r.cx, uy - r.cy) <= r.w * 0.7) return true;
    const inX = left ? ux < A.L + (A.R - A.L) * 0.45 : ux > A.R - (A.R - A.L) * 0.45;
    return inX && uy > A.T + 64 && uy > A.T + (A.B - A.T) * 0.4;
  };
  C.joyStart = (ux, uy) => {
    const r = C.rect('joy'), A = C.area(), R0 = r.w / 2;
    J.on = true; J.dir = null;
    if (Math.hypot(ux - r.cx, uy - r.cy) <= R0 * 1.2) { J.bx = r.cx; J.by = r.cy; }
    else { J.bx = G.clamp(ux, A.L + R0, A.R - R0); J.by = G.clamp(uy, A.T + R0, A.B - R0); }
    C.joyMove(ux, uy);
  };
  C.joyMove = (ux, uy) => {
    if (!J.on) return;
    const R0 = C.rect('joy').w / 2 - 6; let dx = ux - J.bx, dy = uy - J.by, l = Math.hypot(dx, dy);
    if (l > R0 * 1.6) { const k = (l - R0 * 1.6) / l; J.bx += dx * k; J.by += dy * k; dx = ux - J.bx; dy = uy - J.by; l = Math.hypot(dx, dy); }   // 拖太遠：底座跟著手指走
    const m = Math.min(l, R0); J.kx = J.bx + (l ? dx / l * m : 0); J.ky = J.by + (l ? dy / l * m : 0);
    if (l < 3) { J.dir = null; return; }
    const wx = dx / G.AX, wy = dy / G.AY, wl = Math.hypot(wx, wy); J.dir = [wx / wl, wy / wl];   // 螢幕方向 → 世界方向（地面有透視壓縮）
  };
  C.joyEnd = () => { J.on = false; J.dir = null; };
  C.joyDir = () => J.on && J.dir ? J.dir : null;
  C.drawJoy = c => {
    if (!C.joyOn()) return;
    const r = C.rect('joy'), R0 = r.w / 2, on = J.on, bx = on ? J.bx : r.cx, by = on ? J.by : r.cy, kx = on ? J.kx : r.cx, ky = on ? J.ky : r.cy;
    c.globalAlpha = on ? 0.85 : 0.4;
    G.pxDisc(c, bx, by, R0, R0, 0, 0.35); G.pxEllipse(c, bx, by, R0, R0, on ? 7 : 5); G.pxEllipse(c, bx, by, R0 - 1, R0 - 1, 0);
    c.fillStyle = P[on ? 8 : 6];
    for (const [ax, ay] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) for (let k = 0; k < 3; k++) { const px = Math.round(bx + ax * (R0 - 5)), py = Math.round(by + ay * (R0 - 5)); c.fillRect(px - (ay ? k : 0) + (ax ? -ax * k : 0), py - (ax ? k : 0) + (ay ? -ay * k : 0), ay ? k * 2 + 1 : 1, ax ? k * 2 + 1 : 1); }
    const kr = Math.round(R0 * 0.42); G.pxDisc(c, kx, ky + 1, kr, kr, 0, 0.5); G.pxDisc(c, kx, ky, kr, kr, on ? 8 : 6, 1); G.pxDisc(c, kx - 1, ky - 1, kr - 2, kr - 2, on ? 9 : 7, 1); G.pxEllipse(c, kx, ky, kr, kr, 0);
    c.globalAlpha = 1;
  };

  // ---------- 排版編輯器 ----------
  C.ed = null;
  C.openEd = () => { const s = C.get(); C.ed = { key: C.okey(), lay: JSON.parse(JSON.stringify(s.lay[C.okey()] || {})), sel: 'sk2' }; G.Audio.play('open'); };
  C.closeEd = () => { C.ed = null; };
  const setK = (id, k) => { const E = C.ed, r = C.rect(id, E.lay); E.lay[id] = { a: C.anchor(r.cx, r.cy), k: Math.round(G.clamp(k, C.KMIN, C.KMAX) * 10) / 10 }; };
  // 編輯畫面上的元件外觀（和戰鬥中一樣：主動圓形、被動方形）
  C.drawPart = (c, id, r, col) => {
    const h = G.W && G.W.hero, U0 = U();
    if (id === 'joy') { const R0 = r.w / 2; G.pxDisc(c, r.cx, r.cy, R0, R0, 0, 0.35); G.pxEllipse(c, r.cx, r.cy, R0, R0, col); const kr = Math.round(R0 * 0.42); G.pxDisc(c, r.cx, r.cy, kr, kr, 7, 1); G.pxEllipse(c, r.cx, r.cy, kr, kr, 0); return; }
    if (id === 'cam') { H().box(c, r.x, r.y, r.w, r.h, 1, col); H().icon(c, 'i_center', r.cx, r.cy); return; }
    if (id === 'zoom') { const w2 = Math.round((r.w - 3) / 2); H().box(c, r.x, r.y, w2, r.h, 0, col); H().icon(c, 'i_zout', r.x + w2 / 2, r.cy); H().box(c, r.x + r.w - w2, r.y, w2, r.h, 0, col); H().icon(c, 'i_zin', r.x + r.w - w2 / 2, r.cy); return; }
    let ic = 'i_lock';
    if (h) { const n = h.skills.length; if (id === 'ps') ic = h.pskills[0] ? h.pskills[0].icon : ic; else { const i = h.skills.findIndex((s, j) => C.slotOf(j, n) === id); if (i >= 0) ic = h.skills[i].icon; else if (h.pskills[1]) ic = h.pskills[1].icon; } }
    if (id === 'ps' || (h && h.skills.length < 3 && id === 'sk0')) { H().box(c, r.x, r.y, r.w, r.h, 0, col); H().icon(c, ic, r.cx, r.cy); return; }
    U0.circBtn(c, r.cx, r.cy, r.w / 2, 1, col); H().icon(c, ic, r.cx, r.cy);
  };
  C.drawEd = c => {
    const E = C.ed, R = G.Render, uw = R.uw, uh = R.uh, A = C.area(), bad = C.bad(E.lay), b = H();
    b.dim(c, 0.55);
    b.btn('edBg', 0, 0, uw, uh, null, null);
    for (const f of C.fixed()) { c.globalAlpha = 0.5; b.dither(c, f.x, f.y, f.w, f.h, 4, 0.5); c.globalAlpha = 1; c.fillStyle = P[4]; c.fillRect(f.x, f.y + f.h - 1, f.w, 1); }
    // 工具列（畫面中間）
    // 工具列：直屏放畫面中間；橫屏放上方中間（左上資訊和右上小地圖之間），不蓋到下方的按鈕
    const port = C.port(), pw = port ? Math.min(176, A.R - A.L - 8) : Math.min(176, A.R - A.L - 112 - 62 - 6), sel = E.sel, k = (E.lay[sel] && E.lay[sel].k) || 1, hint = G.cnWrap('拖曳移動，點選後調大小', pw - 12);
    const ph = 6 + 14 + hint.length * 13 + 13 + 4 + 18 + 6 + 18 + 6, px = Math.round(port ? (A.L + A.R) / 2 - pw / 2 : A.L + 112 + ((A.R - 62) - (A.L + 112)) / 2 - pw / 2), py = Math.round(port ? G.clamp((A.T + A.B) / 2 - ph / 2 - 30, A.T + 66, A.B - ph - 2) : A.T + 1);
    b.box(c, px, py, pw, ph, 1, 13); b.btn('edIn', px, py, pw, ph, null, null);
    G.cn(c, '自訂按鈕位置', px + 6, py + 5, 13);
    let y = py + 20; hint.forEach((l, i) => G.cn(c, l, px + 6, y + i * 13, 6)); y += hint.length * 13; G.cn(c, '已選：' + C.NAME[sel], px + 6, y, 13); y += 13 + 4;
    // 大小：[−] 名稱 100% [＋]
    const sb = (id, lab, x, on, fn) => { const o = U().press[id] > 0 ? 1 : 0; if (!on) c.globalAlpha = 0.4; b.key(c, x, y + o, 18, 16, o, 7); G.cn(c, lab, x + 9, y + 2 + o, 9, 0.5); c.globalAlpha = 1; b.btn(id, x, y, 18, 16, () => { U().press[id] = 0.12; }, () => { if (on) { fn(); G.Audio.play('tick'); } else b.deny(id); }); };
    sb('edKm', '−', px + 6, k > C.KMIN + 0.01, () => setK(sel, k - 0.1));
    sb('edKp', '＋', px + pw - 24, k < C.KMAX - 0.01, () => setK(sel, k + 0.1));
    G.text(c, Math.round(k * 100) + '%', px + pw / 2, y + 5, 9, 1, null, 0.5);
    y += 18 + 6;
    const bw = Math.floor((pw - 12 - 8) / 3), bt = (id, lab, i, col, fn) => { const x = px + 6 + i * (bw + 4), o = U().press[id] > 0 ? 1 : 0; b.key(c, x, y + o, bw, 18, o, col); G.cn(c, lab, x + bw / 2, y + 3 + o, col === 13 ? 13 : 9, 0.5); b.btn(id, x, y, bw, 18, () => { U().press[id] = 0.12; G.Audio.play('click'); }, fn); };
    bt('edRs', '重設', 0, 7, () => { E.lay = {}; U().toastMsg('已恢復預設位置', 7); });
    bt('edNo', '取消', 1, 7, () => C.closeEd());
    bt('edOk', '儲存', 2, 13, () => { if (Object.keys(C.bad(E.lay)).length) { b.deny('edOk'); U().toastMsg('按鈕重疊了，請移開', 10); return; } C.get().lay[E.key] = E.lay; C.save(); C.closeEd(); U().toastMsg('已儲存', 13); });
    // 元件（畫在工具列上面，才拖得到）
    for (const id of C.IDS) {
      if (id === 'joy' && !C.joyOn()) continue;
      const r = C.rect(id, E.lay), on = sel === id, col = bad[id] ? 10 : on ? 13 : 7;
      C.drawPart(c, id, r, col);
      if (on) { c.fillStyle = P[13]; for (const [qx, qy] of [[r.x - 3, r.y - 3], [r.x + r.w + 1, r.y - 3], [r.x - 3, r.y + r.h + 1], [r.x + r.w + 1, r.y + r.h + 1]]) c.fillRect(qx, qy, 2, 2); }
      if (bad[id]) { c.globalAlpha = 0.35 + 0.15 * Math.sin(U().t * 8); c.fillStyle = P[10]; c.fillRect(r.x, r.y, r.w, r.h); c.globalAlpha = 1; }
      b.btn('ed_' + id, r.x - 2, r.y - 2, r.w + 4, r.h + 4, (ux, uy) => { E.sel = id; E.dx = ux - r.cx; E.dy = uy - r.cy; G.Audio.play('tick'); }, null);
      U().btns[U().btns.length - 1].drag = (ux, uy) => {
        const r2 = C.rect(id, E.lay), cx = G.clamp(Math.round(ux - E.dx), A.L + r2.w / 2, A.R - r2.w / 2), cy = G.clamp(Math.round(uy - E.dy), A.T + r2.h / 2, A.B - r2.h / 2);
        E.lay[id] = { a: C.anchor(cx, cy), k: r2.k };
      };
    }
  };
  // 移動方式切換列（首頁設定、戰鬥操作設定共用）：回傳高度
  C.moveRow = (c, x, y, w) => {
    const b = H(), m = C.get().move, bw = Math.floor((w - 60 - 4) / 2);
    G.cn(c, '移動方式', x, y + 3, 9);
    [['joy', '搖桿'], ['tap', '點地面']].forEach(([k, lab], i) => {
      const bx = x + 60 + i * (bw + 4), on = m === k, id = 'mv_' + k, o = U().press[id] > 0 ? 1 : 0;
      b.key(c, bx, y + o, bw, 18, o, on ? 13 : 5, on ? 2 : 1); G.cn(c, lab, bx + bw / 2, y + 3 + o, on ? 13 : 7, 0.5);
      b.btn(id, bx, y, bw, 18, () => { U().press[id] = 0.12; }, () => { if (!on) { C.setMove(k); G.Audio.play('click'); } });
    });
    const d = G.cnWrap(m === 'joy' ? '在畫面左下拖曳搖桿移動' : '點地面，英雄就走過去', w);
    d.forEach((l, i) => G.cn(c, l, x, y + 22 + i * 13, 6));
    return 22 + d.length * 13;
  };
  C.moveRowH = w => 22 + G.cnWrap(C.get().move === 'joy' ? '在畫面左下拖曳搖桿移動' : '點地面，英雄就走過去', w).length * 13;
  return C;
})();
