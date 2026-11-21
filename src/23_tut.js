'use strict';
/* =========================================================
   v4.0.1 新手引導
   G.Coach：第一次進「隊伍／排行／帳號／單人」頁 → 聚光燈逐步說明（點一下下一步、右上可跳過；看過就不再出現）
   G.Tut  ：單人關卡最前面的「新手教學」關（不強制）。照提示：移動 → 普攻 → 技能 → 升級 → 推塔
            第一次完成送 5 把鑰匙＋成就「新手上路」；隨時可以跳過
   做法參考市面手遊：一次只講一件事、一句話講完、目標用聚光燈／箭頭指出來、做到了才往下
   ========================================================= */
G.Coach = (() => {
  const C = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, U = () => G.UI;
  // 每頁的步驟：id＝要框起來的按鈕（可多個，取聯集）；opt＝找不到就跳過這步
  C.SETS = {
    stages: [{ id: ['@soloCard'], t: '左右滑動選關卡；第一次玩先試試{新手教學}，還有{鑰匙}可以拿' }, { id: ['stGo'], t: '選好了就按「{出發}」', opt: true }],
    team: [{ id: ['car0', 'car1', 'car2', 'carR'], t: '左右滑動，挑選要出戰的{英雄}' }, { id: ['demo'], t: '點「{技能展示}」看英雄的招式動畫' }, { id: ['tab1'], t: '切到「{小兵}」，安排三條路要出戰的小兵' }],
    rank: [{ id: ['wreg'], t: '上下滑動，切換{排行類別}' }, { id: ['rkSave'], t: '取個{玩家名稱}，成績就會自動上榜', opt: true }],
    save: [{ id: ['svMake'], t: '「{產生存檔碼}」把進度存成一串文字' }, { id: ['svLoad'], t: '換手機時「{讀取存檔碼}」，貼上就能還原進度' }]
  };
  let A = null, enter = { s: null, t: 0 };
  const seenAll = () => { try { return JSON.parse(localStorage.getItem('leafwar_coach') || '{}') || {}; } catch (e) { return {}; } };
  const markSeen = k => { const v = seenAll(); v[k] = 1; try { localStorage.setItem('leafwar_coach', JSON.stringify(v)); } catch (e) { } };
  const newbie = () => !G.Team.dev && (G.Ach.P().games || 0) < 5;
  const rectOf = ids => { if (ids[0][0] === '@') { const q = U().cR && U().cR[ids[0].slice(1)]; return q ? { x: q.x, y: q.y, w: q.w, h: q.h } : null; } let r = null; for (const b of U().btns) if (ids.includes(b.id)) { r = r ? { x: Math.min(r.x, b.x), y: Math.min(r.y, b.y), x2: Math.max(r.x2, b.x + b.w), y2: Math.max(r.y2, b.y + b.h) } : { x: b.x, y: b.y, x2: b.x + b.w, y2: b.y + b.h }; } return r && { x: r.x, y: r.y, w: r.x2 - r.x, h: r.y2 - r.y }; };
  C.active = () => !!A;
  // 每幀（頁面畫完之後）呼叫
  C.draw = (c, dt) => {
    const s = U().screen;
    if (enter.s !== s) { enter = { s, t: 0 }; if (A && A.k !== s) A = null; }
    enter.t += dt;
    if (!A) { if (C.SETS[s] && enter.t > 0.45 && newbie() && !seenAll()[s] && !(G.Trans && G.Trans.busy())) A = { k: s, i: 0, t: 0 }; else return; }
    const st = C.SETS[A.k]; A.t += dt;
    let q = st[A.i], r = q && rectOf(q.id);
    while (q && !r && q.opt) { A.i++; q = st[A.i]; r = q && rectOf(q.id); }
    if (!q) { markSeen(A.k); A = null; return; }
    C.spot(c, r, q.t, A.i, st.length, A.t, () => { A.i++; A.t = 0; G.Audio.play('tick'); if (A.i >= st.length) { markSeen(A.k); A = null; } }, () => { markSeen(A.k); A = null; G.Audio.play('click'); });
  };
  // 聚光燈＋對話框（G.Tut 也共用）：r＝框起來的範圍（null＝不框）；next＝點一下；skip＝跳過
  C.spot = (c, r, txt, i, n, t, next, skip, o = {}) => {
    const uw = R.uw, uh = R.uh, I = R.ins, a = Math.min(1, t / 0.2);
    if (H().layer) H().layer();                                           // 之後畫的是上面一層（文字檢查用）
    if (!o.noDim) {
      c.fillStyle = 'rgba(8,8,8,' + (0.68 * a).toFixed(3) + ')';
      if (r) { const p = 3, x0 = r.x - p, y0 = r.y - p, x1 = r.x + r.w + p, y1 = r.y + r.h + p; c.fillRect(0, 0, uw, y0); c.fillRect(0, y1, uw, uh - y1); c.fillRect(0, y0, x0, y1 - y0); c.fillRect(x1, y0, uw - x1, y1 - y0); }
      else c.fillRect(0, 0, uw, uh);
    }
    if (r) C.ring(c, r, t);
    if (next) H().btn('coBg', 0, 0, uw, uh, null, next);
    // 對話框：目標在上半部 → 放下面；在下半部 → 放上面
    // 位置：框的下面 → 上面 → 右邊 → 左邊（放得下才放）；都不行就放畫面中間
    let w = o.w || Math.min(uw - I.l - I.r - 12, 210), cx0 = o.cx != null ? o.cx : uw / 2, by, side = false;
    const hOf = ww => 8 + G.cnWrapRich(txt, ww - 34).length * 13 + 18;
    if (o.y != null) by = o.y;
    else if (!r) by = Math.round(uh / 2 - hOf(w) / 2);
    else {
      const bh0 = hOf(w), below = r.y + r.h + 14, above = r.y - bh0 - 14, rs = uw - I.r - (r.x + r.w) - 12, ls0 = r.x - I.l - 12;
      if (below + bh0 <= uh - I.b - 2) by = below; else if (above >= I.t + 2) by = above;
      else if (rs >= 140) { side = true; w = Math.min(w, rs); cx0 = r.x + r.w + 10 + w / 2; by = Math.round(r.y + r.h / 2 - hOf(w) / 2); }
      else if (ls0 >= 140) { side = true; w = Math.min(w, ls0); cx0 = r.x - 10 - w / 2; by = Math.round(r.y + r.h / 2 - hOf(w) / 2); }
      else by = below;
    }
    const ls = G.cnWrapRich(txt, w - 34), bh = 8 + ls.length * 13 + 18;
    by = Math.round(G.clamp(by, I.t + 2, uh - I.b - bh - 2)); const bx = Math.round(G.clamp(cx0 - w / 2, I.l + 2, uw - I.r - w - 2));
    c.globalAlpha = a;
    H().box(c, bx, by, w, bh, 1, 13);
    { const sp = G.SPR.leafy && G.SPR.leafy[((t * 3) | 0) % G.SPR.leafy.length]; if (sp) c.drawImage(sp.n, bx + 6, by + Math.round(bh / 2 - sp.h / 2) + (((t * 2) | 0) % 2 ? -1 : 0)); }
    ls.forEach((l, k) => G.cnRich(c, l, bx + 28, by + 4 + k * 13, 9));
    // 最下面一列：進度點（左）＋「點一下繼續」＋［跳過］（右，放在框裡面，不會被別的東西蓋住）
    if (n > 1) for (let k = 0; k < n; k++) { c.fillStyle = P[k === i ? 13 : k < i ? 7 : 3]; c.fillRect(bx + 28 + k * 7, by + bh - 9, k === i ? 5 : 3, 2); }
    const sw = G.cnW('跳過') + 10;
    { const ht = o.hint || '點一下繼續', hx = bx + w - 6 - (skip ? sw + 4 : 0); if (next && hx - G.cnW(ht) > bx + 28 + n * 7 + 4) G.cn(c, ht, hx, by + bh - 15, 5, 1); }   // 放不下就不寫
    if (skip) { const sx = bx + w - sw - 4, sy = by + bh - 17, pr = U().press.coSkip > 0 ? 1 : 0; H().key(c, sx, sy + pr, sw, 14, pr, 7); G.cn(c, '跳過', sx + sw / 2, sy + 1 + pr, 9, 0.5); H().btn('coSkip', sx - 2, sy - 2, sw + 4, 18, () => { U().press.coSkip = 0.12; }, skip); }
    c.globalAlpha = 1;
    if (r && !o.noArrow && !side) { const ax = Math.round(r.x + r.w / 2), up = by > r.y, b = Math.round(Math.abs(Math.sin(t * 6)) * 3); c.fillStyle = P[13]; for (let k = 0; k < 5; k++) { const yy = up ? r.y + r.h + 5 + k + b : r.y - 6 - k - b; c.fillRect(ax - k, yy, k * 2 + 1, 1); } }
    return { x: bx, y: by, w, h: bh };
  };
  // 小標籤（貼在框旁邊，上面放不下就放下面）
  C.tag = (c, r, txt, t) => {
    const uw = R.uw, uh = R.uh, I = R.ins, ls = G.cnWrapRich(txt, Math.min(150, uw - 16)), w = Math.max(...ls.map(l => l.reduce((a2, q) => a2 + G.cnW(q[0]), 0))) + 12, h = ls.length * 13 + 4;
    const above = r.y - h - 10 >= I.t + 2, x = Math.round(G.clamp(r.x + r.w / 2 - w / 2, I.l + 2, uw - I.r - w - 2)), y = above ? r.y - h - 10 : Math.min(uh - I.b - h - 2, r.y + r.h + 10), b = Math.round(Math.abs(Math.sin(t * 5)) * 2);
    H().box(c, x, y - (above ? b : -b), w, h, 1, 13); ls.forEach((l, k) => G.cnRich(c, l, x + 6, y + 2 + k * 13 - (above ? b : -b), 9));
    c.fillStyle = P[13]; const ax = Math.round(G.clamp(r.x + r.w / 2, x + 4, x + w - 4)); for (let k = 0; k < 4; k++) c.fillRect(ax - (3 - k), above ? y + h - (above ? b : -b) + k : y - (above ? b : -b) - 1 - k, (3 - k) * 2 + 1, 1);
  };
  // 框線：黃橘交替＋四角外擴
  C.ring = (c, r, t) => {
    const p = 3 + Math.round(Math.abs(Math.sin(t * 4)) * 2), x0 = r.x - p, y0 = r.y - p, w = r.w + p * 2, h = r.h + p * 2;
    c.fillStyle = P[((t * 6) | 0) % 2 ? 13 : 14]; c.fillRect(x0, y0, w, 1); c.fillRect(x0, y0 + h - 1, w, 1); c.fillRect(x0, y0, 1, h); c.fillRect(x0 + w - 1, y0, 1, h);
    c.fillStyle = P[9]; for (const [qx, qy, dx, dy] of [[x0, y0, 1, 1], [x0 + w - 1, y0, -1, 1], [x0, y0 + h - 1, 1, -1], [x0 + w - 1, y0 + h - 1, -1, -1]]) { c.fillRect(qx, qy, 4 * dx, 1); c.fillRect(qx, qy, 1, 4 * dy); }
  };
  return C;
})();

G.Tut = (() => {
  const T = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, U = () => G.UI;
  T.on = false; T.REWARD = 5; T.lvTip = '';
  let st = null;
  const W = () => G.W;
  const joy = () => G.Ctl.joyOn();
  // 開始教學：第 1 關的地圖，關掉自動出兵、獵手、野怪
  T.start = () => {
    U().start(1, { tut: true }); T.on = true;
    const w = W(), h = w.hero; st = { i: 0, t: 0, ui: 0, fin: null, foes: [], ups: 0 };
    w.stats.tut = 1;
    for (const tw of w.towers[0]) tw.tutOff = 1;                          // 我方塔先不打（敵人留給玩家打）
    const tw0 = w.towers[0][0], dx = h.x - tw0.x, dy = h.y - tw0.y, l = Math.hypot(dx, dy) || 1;
    st.mark = [tw0.x + dx / l * 52, tw0.y + dy / l * 52];
    G.Audio.play('open');
  };
  T.hold = () => !!(T.on && st && st.fin);
  const fwd = (d) => { const w = W(), h = w.hero, a = w.holy[0], b = w.holy[1], vx = b.x - a.x, vy = b.y - a.y, l = Math.hypot(vx, vy); let x = h.x + vx / l * d, y = h.y + vy / l * d; if (!w.M.isWalk(x, y)) { x = h.x; y = h.y; } return [x, y]; };
  const spawnFoes = (n, d) => {
    const w = W(), [cx, cy] = fwd(d), out = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.283, x = cx + Math.cos(a) * (n > 1 ? 14 : 0), y = cy + Math.sin(a) * (n > 1 ? 10 : 0);
      const u = w.add(new G.Unit(w, 'babybear', 1, w.M.isWalk(x, y) ? x : cx, w.M.isWalk(x, y) ? y : cy, 1, 'creep'));
      u.lane = 0; u.lo = 0; u.st.hp = u.hp = 46; u.st.power = Math.max(1, Math.round(u.st.power * 0.35)); u.tutFoe = 1; G.FX.spawn(w, u); out.push(u);
    }
    w.sfx('spawn', cx, cy); return out;
  };
  const alive = L => L.some(u => u.alive);
  // 步驟：t＝提示（依移動方式）；ui＝要框的按鈕；go＝開始時做的事；ok＝完成條件；at＝世界上要指的位置
  const STEPS = [
    { t: () => '歡迎！跟著提示，{1 分鐘}學會基本操作', ok: () => st.t > 2.6, tap: true },
    { t: () => joy() ? '按住左下的{搖桿}，走到{發光的圈}' : '{點地面}，走到{發光的圈}', ui: () => joy() ? 'joy' : null, at: () => st.mark, ok: () => { const h = W().hero; return Math.hypot(h.x - st.mark[0], h.y - st.mark[1]) < 26; } },
    { t: () => joy() ? '按右下的{拳頭}普攻，打倒敵人' : '敵人靠近會{自動攻擊}，也可以{點敵人}鎖定', ui: () => joy() ? 'atk' : null, go: () => { st.foes = spawnFoes(3, 70); }, at: () => { const u = st.foes.find(q => q.alive); return u && [u.x, u.y]; }, ok: () => !alive(st.foes) },
    { t: () => '按{技能鈕}放技能，一次打好幾隻！', ui: () => 'sk' + W().hero.skills.findIndex(s => s.lv > 0), go: () => { const h = W().hero; h.mp = h.st.mp; h.skills.forEach(s => { s.cd = 0; }); st.c0 = h.castN || 0; st.foes = spawnFoes(4, 60); }, at: () => { const u = st.foes.find(q => q.alive); return u && [u.x, u.y]; }, ok: () => !alive(st.foes) && (W().hero.castN || 0) > st.c0 },
    { t: () => U().lvUp ? (U().lvUp.sel ? '按「{升級}」確認' : st.ups ? '按「{繼續戰鬥}」回到戰場' : '點一個{技能}或{藥水}看說明') : st.ups ? '' : '點右上的{升級}鈕，選擇要升級的東西', go: () => { const w = W(), h = w.hero; w.gainExp(h, w.expNeed(h) - h.exp + 1); st.sp0 = (h.sp || 0) + (h.pp || 0); },
      ui: () => { const L = U().lvUp; if (!L) return 'lvBtn'; if (L.sel) return 'selOk'; if (st.ups) return 'lvGo'; const h = W().hero, k = h.skills.findIndex(s => W().canLevel(s)); return k >= 0 ? 'lvS' + k : 'lvP2'; },
      ok: () => { const h = W().hero; st.ups = st.sp0 - (h.sp || 0) - (h.pp || 0); return st.ups > 0 && !U().lvUp; } },
    { t: () => '最後，推倒前面的{敵方塔}！', go: () => { const w = W(), hx = w.holy[0]; let best = null, bd = 1e9; for (const tw of w.towers[1]) { const d = Math.hypot(tw.x - hx.x, tw.y - hx.y); if (tw.alive && d < bd) { bd = d; best = tw; } } st.tw = best; if (best) { best.hp = Math.round(best.st.hp * 0.3); best.st.power = Math.max(1, Math.round(best.st.power * 0.25)); } for (const tw of w.towers[0]) tw.tutOff = 0; }, at: () => st.tw && st.tw.alive && [st.tw.x, st.tw.y], ok: () => !st.tw || !st.tw.alive }
  ];
  T._st = () => st;                                                   // 測試用
  T.uiId = () => { if (!T.on || !st || st.fin) return null; const q = STEPS[st.i]; return q && q.ui ? q.ui() : null; };
  function step() {
    const q = STEPS[st.i]; if (!q) return;
    if (!st.started) { st.started = 1; st.t = 0; if (q.go) q.go(); }
    if (q.ok()) { st.i++; st.started = 0; st.t = 0; G.Audio.play(st.i >= STEPS.length ? 'win' : 'level'); if (st.i >= STEPS.length) finish(); }
  }
  function finish() {
    const Pf = G.Ach.P(), first = !Pf.tutDone;
    st.fin = { t: 0, first };
    if (first) { Pf.tutDone = 1; G.Team.addKeys(T.REWARD); G.Team.save(); G.Ach.check(null, null); }
  }
  T.leave = () => { T.on = false; st = null; U().goTitle(); };
  // 每幀（HUD／升級頁畫完之後）
  T.draw = (c, dt) => {
    if (!T.on || !st || U().screen !== 'battle') return;
    const w = W(), uw = R.uw, uh = R.uh, I = R.ins;
    st.t += dt;
    if (st.fin) return drawFin(c, dt);
    if (!U().paused && !w.over) step();
    if (st.fin || U().paused) return;
    const q = STEPS[st.i]; if (!q) return;
    // 世界上的目標：腳下光圈＋頭上彈跳箭頭；畫面外 → 邊緣箭頭
    const at = q.at && q.at();
    if (at && !U().lvUp) {
      const p = R.worldToScreen(at[0], at[1], 0), b = Math.round(Math.abs(Math.sin(st.t * 5)) * 4), on = p[0] > I.l + 8 && p[0] < uw - I.r - 8 && p[1] > I.t + 70 && p[1] < uh - I.b - 8;
      if (on) {
        const rr = 10 + Math.round(Math.sin(st.t * 4) * 2); c.globalAlpha = 0.8; G.pxEllipse(c, Math.round(p[0]), Math.round(p[1]), rr, Math.round(rr * 0.45), 13, 4, st.t * 8); c.globalAlpha = 1;
        c.fillStyle = P[13]; for (let k = 0; k < 6; k++) c.fillRect(Math.round(p[0]) - k, Math.round(p[1]) - 40 - b + 6 - k, k * 2 + 1, 1);
      } else {
        const cx = uw / 2, cy = uh / 2, dx = p[0] - cx, dy = p[1] - cy, k = Math.min((uw / 2 - 18) / Math.abs(dx || 1), (uh / 2 - 40) / Math.abs(dy || 1)), ex = Math.round(cx + dx * k), ey = Math.round(cy + dy * k), a = Math.atan2(dy, dx);
        c.fillStyle = P[13]; for (let s2 = 0; s2 < 7; s2++) for (let t2 = -s2; t2 <= s2; t2++) c.fillRect(Math.round(ex + Math.cos(a) * (6 - s2) - Math.sin(a) * t2 * 0.6), Math.round(ey + Math.sin(a) * (6 - s2) + Math.cos(a) * t2 * 0.6), 1, 1);
      }
    }
    // 要按的按鈕：框起來
    const id = q.ui && q.ui(); let r = null;
    if (id) { if (['joy', 'atk', 'sk0', 'sk1', 'sk2'].includes(id) && !U().lvUp) r = G.Ctl.rect(id === 'sk0' || id === 'sk1' || id === 'sk2' ? G.Ctl.slotOf(+id[2], w.hero.skills.length) : id); else { const b = U().btns.find(b2 => b2.id === id); if (b) r = { x: b.x, y: b.y, w: b.w, h: b.h }; } }
    if (r && (!U().lvUp || U().lvUp.t > 0.4)) G.Coach.ring(c, r, st.t);
    const txt = q.t(); T.lvTip = ''; if (!txt) return;
    if (U().lvUp) { T.lvTip = txt; return; }                              // 升級頁上：提示寫在升級頁裡（「繼續戰鬥」上方），不另外蓋一張
    // 直屏：小地圖下方整排；橫屏：上方中間（左上資訊和小地圖之間），不擋到畫面中間的英雄
    const port = uh > uw, ox = port ? {} : { w: (uw - I.r - 62) - (I.l + 112) - 4, cx: Math.round(((I.l + 112) + (uw - I.r - 62)) / 2) };
    G.Coach.spot(c, null, txt, st.i, STEPS.length, Math.max(st.t, 0.3), q.tap ? () => { st.t = 99; } : null, () => T.leave(), Object.assign({ noDim: true, y: I.t + (port ? 66 : 1), noArrow: true, hint: '點一下開始' }, ox));
  };
  function drawFin(c, dt) {
    const F = st.fin, uw = R.uw, uh = R.uh, I = R.ins; F.t += dt;
    const e = Math.min(1, F.t / 0.3);
    H().dim(c, 0.7 * e); H().btn('tfBg', 0, 0, uw, uh, null, null);
    const w = Math.min(uw - I.l - I.r - 16, 200), rows = F.first ? 2 : 1, hh = 30 + 30 + rows * 18 + 8 + 22 + 26, x = Math.round(uw / 2 - w / 2), y = Math.round(uh / 2 - hh / 2 + (1 - e) * 20);
    c.globalAlpha = e;
    H().box(c, x, y, w, hh, 1, 13);
    G.cnBig(c, '教學完成！', uw / 2, y + 6, 13, 2);
    { const sp = G.SPR.leafy[((F.t * 4) | 0) % G.SPR.leafy.length]; c.drawImage(sp.n, Math.round(uw / 2 - sp.w / 2), y + 32 + (((F.t * 3) | 0) % 2 ? -1 : 0)); }
    let yy = y + 60;
    if (F.first) {
      H().icon(c, 'i_key', x + 16, yy + 6); G.cn(c, '鑰匙 +' + T.REWARD, x + 26, yy, 13); yy += 18;
      H().icon(c, 'i_trophy', x + 16, yy + 6); G.cn(c, '成就「新手上路」', x + 26, yy, 9); yy += 18;
    } else { G.cn(c, '已經領過獎勵了', uw / 2, yy, 6, 0.5); yy += 18; }
    yy += 8;
    const bw = Math.floor((w - 16) / 2), b2 = (id, lab, bx, col, fn) => { const o = U().press[id] > 0 ? 1 : 0; H().key(c, bx, yy + o, bw, 20, o, col, col === 13 ? 2 : 1); G.cn(c, lab, bx + bw / 2, yy + 4 + o, col === 13 ? 13 : 9, 0.5); H().btn(id, bx, yy, bw, 20, () => { U().press[id] = 0.12; G.Audio.play('click'); }, fn); };
    b2('tfHome', '回首頁', x + 6, 7, () => T.leave());
    b2('tfGo', '挑戰第 1 關', x + w - 6 - bw, 13, () => { T.on = false; st = null; U().goTitle(); G.StageGo.go(1); });
    c.globalAlpha = 1;
    if (F.t < 1.2) for (let k = 0; k < 3; k++) { const a = F.t * 9 + k * 2.1; c.fillStyle = P[k % 2 ? 13 : 9]; c.fillRect(Math.round(uw / 2 + Math.cos(a) * 60 * F.t), Math.round(y + 14 + Math.sin(a) * 20 * F.t), 2, 2); }
  }
  return T;
})();
