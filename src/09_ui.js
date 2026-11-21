'use strict';
/* =========================================================
   介面與操作：像素 HUD、按鈕、觸控/滑鼠/鍵盤
   ========================================================= */
G.UI = (() => {
  const U = { panSens: 0.6, screen: 'menu', paused: false, showFps: false, fps: 60, btns: [], press: {}, shakeB: {}, t: 0, toast: null };
  const R = G.Render, P = G.PAL;
  let W = null, M_DT = 1 / 60;
  U.setWorld = w => { W = w; };

  // ---------- 繪圖小工具 ----------
  const box = (...a) => U.h.box(...a);                     // 經由 U.h，方便檢查工具攔截
  const _box = (c, x, y, w, h, bg, bd, sh = true) => {
    x = Math.round(x); y = Math.round(y);
    if (sh) { c.fillStyle = P[0]; c.fillRect(x + 1, y + 1, w, h); c.fillRect(x, y + 2, w, h - 2); }
    c.fillStyle = P[bd]; c.fillRect(x + 1, y, w - 2, h); c.fillRect(x, y + 1, w, h - 2);
    c.fillStyle = P[bg]; c.fillRect(x + 1, y + 1, w - 2, h - 2);
  };
  // 立體按鍵（v2.3）：上緣亮邊＋面板高光＋下方厚度（側面）＋落地影；按下時側面變薄（呼叫端照舊把 y +1）
  // 和平面面板（box）區分：看得出「可以按」
  const KEY_DK = { 0: 0, 1: 0, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 6 };
  const _key = (c, x, y, w, h, pr, bd = 7, bg = 1, sideCol) => {
    x = Math.round(x); y = Math.round(y);
    const lip = pr ? 1 : 2, b0 = bg <= 1 ? 2 : bg, face = pr && b0 <= 7 ? Math.min(9, b0 + 2) : b0, side = sideCol || (KEY_DK[bd] != null ? P[KEY_DK[bd]] : G.tint(bd, -0.5));
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x + 2, y + h + lip, w - 3, 1); c.fillRect(x + w, y + 2, 1, h + lip - 2);   // 落地影
    c.fillStyle = side; c.fillRect(x, y + h - 1, w, lip); c.fillRect(x + 1, y + h - 1 + lip, w - 2, 1);                // 側面厚度
    U.h.box(c, x, y, w, h, face, bd, false);
    c.fillStyle = G.tint(bd, 0.5); c.fillRect(x + 1, y, w - 2, 1);                                                    // 上緣亮邊
    c.fillStyle = G.tint(face, 0.07); c.fillRect(x + 1, y + 1, w - 2, Math.max(1, Math.floor(h / 2) - 1));                 // 上半部稍亮（弧面）
    c.fillStyle = G.tint(face, 0.2); c.fillRect(x + 1, y + 1, w - 2, 1); c.fillRect(x + 1, y + 2, 1, Math.max(1, h - 4));    // 面板高光（上、左）
    c.fillStyle = G.tint(face, -0.5); c.fillRect(x + 2, y + h - 2, w - 3, 1); c.fillRect(x + w - 2, y + 2, 1, h - 4);       // 面板內陰影（下、右）
  };
  const icon = (c, k, cx, cy, dim) => { const s = dim ? G.SPR.icons_dark[k] : G.SPR[k]; if (!s) return; c.drawImage(s.n, Math.round(cx - s.w / 2), Math.round(cy - s.h / 2)); };
  const dither = (c, x, y, w, h, col, a) => { c.fillStyle = G.pat(c, col, a); c.fillRect(x, y, w, h); };
  const bar = (c, x, y, w, h, f, style) => {
    c.fillStyle = P[0]; c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = P[2]; c.fillRect(x, y, w, h);
    const fw = Math.round(w * G.clamp(f, 0, 1));
    if (style === 'w') { c.fillStyle = P[9]; c.fillRect(x, y, fw, h); c.fillStyle = P[7]; c.fillRect(x, y + h - 1, fw, 1); }
    else if (style === 'g') { c.fillStyle = P[6]; c.fillRect(x, y, fw, h); c.fillStyle = P[8]; c.fillRect(x, y, fw, 1); }
    else if (style === 'r' || style === 'xp' || style === 'gn') {   // 立體：上緣高光、下緣暗邊、凹槽上緣陰影
      const col = style === 'r' ? 10 : style === 'gn' ? 11 : 21;
      c.fillStyle = P[1]; c.fillRect(x, y, w, 1);
      if (fw > 0) { c.fillStyle = P[col]; c.fillRect(x, y, fw, h); c.fillStyle = G.tint(col, 0.45); c.fillRect(x, y, fw, 1); if (h >= 4) { c.fillStyle = G.tint(col, 0.18); c.fillRect(x, y + 1, fw, 1); } c.fillStyle = G.tint(col, -0.4); c.fillRect(x, y + h - 1, fw, 1); }
    }
    else if (style === 's') { for (let i = 0; i < fw; i++) { c.fillStyle = P[(i >> 1) & 1 ? 7 : 4]; c.fillRect(x + i, y, 1, h); } }
    else { c.fillStyle = P[7]; c.fillRect(x, y, fw, h); }
  };
  const btn = (id, x, y, w, h, down, up) => { U.btns.push({ id, x, y, w, h, down, up }); };
  const hitBtn = (ux, uy) => { for (let i = U.btns.length - 1; i >= 0; i--) { const b = U.btns[i]; if (ux >= b.x - 2 && ux < b.x + b.w + 2 && uy >= b.y - 2 && uy < b.y + b.h + 2) return b; } return null; };
  const sh = id => (U.shakeB[id] > 0 ? Math.round(Math.sin(U.shakeB[id] * 60) * 2) : 0);
  const deny = id => { U.shakeB[id] = 0.25; G.Audio.play('deny'); };

  // ---------- 直式滾輪（首頁選單、道具欄共用）：拖曳帶慣性、放開吸附、經過一格「滴」一聲 ----------
  U.wheel = () => {
    const w = { pos: 0, tgt: 0, vel: 0, drag: false, n: 1, sp: 20, bump: 0, settled: true };
    const idx = () => G.clamp(Math.round(w.pos), 0, w.n - 1);
    w.idx = idx;
    w.grab = () => { w.drag = true; w.vel = 0; w.tgt = w.pos; w.lt = performance.now(); };
    w.dragBy = dy => {                               // dy：UI px（往上拖＝下一個）
      const b = idx(), now = performance.now(), dt = Math.max(8, now - (w.lt || now)) / 1000; w.lt = now;
      let d = -dy / w.sp; if (w.pos + d < -0.4 || w.pos + d > w.n - 0.6) d *= 0.35;
      w.pos += d; w.vel = G.lerp(w.vel, d / dt, 0.5);
      if (idx() !== b) { G.Audio.play('tick', 1, 0.02); w.bump = 1; }
    };
    w.release = () => { w.drag = false; w.tgt = G.clamp(Math.round(w.pos + G.clamp(w.vel * 0.15, -3, 3)), 0, w.n - 1); w.settled = false; };
    w.step = k => { w.tgt = G.clamp(w.tgt + k, 0, w.n - 1); w.settled = false; };
    w.go = i => { w.tgt = Math.max(0, i); w.settled = false; };   // 上限在 update 時夾住（n 可能還沒更新）
    w.update = (dt, n) => {
      w.n = Math.max(1, n); if (w.tgt > w.n - 1) w.tgt = w.n - 1; if (w.pos > w.n - 1 && !w.drag) w.pos = Math.min(w.pos, w.n - 1 + 0.4);
      w.bump = Math.max(0, w.bump - dt * 6);
      if (w.drag) return;
      const b = idx(); w.pos += (w.tgt - w.pos) * (1 - Math.exp(-dt * 12));
      if (idx() !== b) { G.Audio.play('tick', 1, 0.02); w.bump = 1; }
      if (!w.settled && Math.abs(w.tgt - w.pos) < 0.02) { w.pos = w.tgt; w.settled = true; G.Audio.play('snap'); }
    };
    return w;
  };
  // 讓最後一個按鈕也能拖動滾輪（從按鈕上開始拖也會捲）
  const wheelBtn = (wh, x, y, w, h) => U.btns.push({ id: 'wreg', x, y, w, h, wheel: wh });
  const tagWheel = wh => { const b = U.btns[U.btns.length - 1]; if (b) b.wheel = wh; };

  // ---------- 畫面切換 ----------
  const leaveBattle = () => { if (G.W && !G.W.attract && G.Ach) { G.Ach.commit(G.W); G.Ach.abandon(G.W); } };   // v3.8 沒打完就離開：這場不算進排行
  U.goTitle = U.goMenu = () => { U.leaveAsk = null; if (U.screen && U.screen !== 'menu' && U.screen !== 'tap' && U.screen !== 'intro' && G.Trans) G.Trans.reveal(); leaveBattle(); if (G.Menus) G.Menus.resetIntro(); U.screen = 'menu'; U.paused = false; if (!G.W || !G.W.attract) G.newWorld({ attract: true }); R.cam.zoom = 1; G.Audio.setMode('menu'); };
  U.start = st => { if (typeof st === 'number') U.stageI = st; leaveBattle(); U.leaveAsk = null; U.lvUp = null; U.ctlOpen = false; if (G.Ctl) { G.Ctl.joyEnd(); G.Ctl.closeEd(); } U.tpAsk = null; G.Team.sanitize(); const T = G.Team.get(); U.screen = 'battle'; U.paused = false; G.newWorld({ hero: T.hero, loadout: T.loadout, stage: U.stageI || 0 }); R.cam.follow = true; R.cam.zoom = 1; G.Audio.musicRestart('battle'); G.Audio.setMode('battle'); G.Audio.play('level'); };
  // 全畫面暗幕：純黑半透明（不用顆粒，眼睛比較舒服）
  const dim = (...a) => U.h.dim(...a);
  const _dim = (c, a) => { if (R.hi) for (const q of R.hi) q.cov = true; c.fillStyle = 'rgba(10,10,10,' + a + ')'; c.fillRect(0, 0, R.uw, R.uh); };
  // ---------- 音量滑桿（v2.3，首頁設定與暫停選單共用）----------
  // 一列：圖示＋名稱｜凹槽＋黃色填色＋立體旋鈕｜百分比。整列都能點、按住左右拖
  const _slider = (c, id, x, y, w, ic, lab, v, set) => {
    const lw = 18 + G.cnW(lab) + 6, tx = x + lw, tw = w - lw - 30, ty = y + 7;
    icon(c, ic, x + 6, y + 9); G.cn(c, lab, x + 14, y + 3, 9);
    G.bar3d ? G.bar3d(c, tx, ty, tw, 4, v, 13) : bar(c, tx, ty, tw, 4, v, 'w');
    const kx = Math.round(tx + tw * v - 3), hold = U.press[id] > 0 || (U.slideId === id);
    U.h.key(c, kx, y + 3 + (hold ? 1 : 0), 7, 11, hold, 13, 13, G.tint(14, -0.5));
    G.text(c, Math.round(v * 100) + '%', x + w, y + 7, v > 0 ? 9 : 5, 1, null, 1);
    const f = ux => set(G.clamp((ux - tx) / tw, 0, 1));
    U.btns.push({ id, x: tx - 6, y, w: tw + 12, h: 18, down: ux => { U.slideId = id; f(ux); }, drag: ux => f(ux), up: () => { U.slideId = null; } });
    return y + 20;
  };
  U.volPanel = (c, x, y, w) => {
    const A = G.Audio;
    y = _slider(c, 'vMus', x, y, w, 'i_music', '音樂', A.vol('music'), v => A.setVol('music', v));
    y = _slider(c, 'vSfx', x, y, w, 'i_sound', '音效', A.vol('sfx'), v => { const o = A.vol('sfx'), n = A.setVol('sfx', v); if (n !== o) A.play('tick'); });
    return y;
  };
  U.h = { layer: () => { }, box: _box, slider: (...a) => _slider(...a), key: (...a) => _key(...a), icon, bar, btn: (...a) => btn(...a), dither, dim: _dim, sh: id => sh(id), deny: id => deny(id), wheelBtn: (...a) => wheelBtn(...a), tagWheel: wh => tagWheel(wh) };

  // ---------- 技能按鈕（主動：點擊施放；被動：只顯示；長按任一顆 → 資訊卡）----------
  const LP = 0.35;                                       // 長按秒數
  // v3.14 圓形按鈕（主動技）：落地影＋外框＋內面（上緣亮一點，看得出可以按）
  const circBtn = U.circBtn = (c, cx, cy, r, bg, bd, o = 0) => {
    G.pxDisc(c, cx + 1, cy + 2, r, r, 0, 0.6);
    G.pxDisc(c, cx, cy + o, r, r, bd);
    G.pxDisc(c, cx, cy + o, r - 1, r - 1, 0);
    G.pxDisc(c, cx, cy + o, r - 2, r - 2, bg <= 1 ? 2 : bg);
    G.pxDisc(c, cx, cy + 1 + o, r - 3, r - 3, bg <= 1 ? 1 : G.clamp(bg - 1, 0, 9));
  };
  function skillBtn(c, s, r) {
    const h = W.hero, i = h.skills.indexOf(s), id = 'sk' + (s.passive ? 'p' + h.pskills.indexOf(s) : i), w = r.w;
    const x = r.x + sh(id), y = r.y, cx = r.cx + sh(id), cy = r.cy;
    const cost = Math.round(s.mp * (1 - (h.mpDisc || 0) / 100)), pr = U.press[id] > 0 || (U.hold && U.hold.id === id), noMp = !s.passive && h.mp < cost, cd = s.cd > 0, lock = !s.lv;
    const o = pr ? 1 : 0, mx = s.lv >= G.SKILL_MAX;
    if (s.passive) {                                      // 被動：方形暗底 + 虛線內框（紫色＝被動）
      box(c, x, y + o, w, w, 0, lock ? 3 : mx ? 17 : 4);
      c.fillStyle = P[lock ? 2 : 3]; for (let k = 2; k < w - 2; k += 2) { c.fillRect(x + k, y + 2 + o, 1, 1); c.fillRect(x + k, y + w - 3 + o, 1, 1); c.fillRect(x + 2, y + k + o, 1, 1); c.fillRect(x + w - 3, y + k + o, 1, 1); }
      icon(c, s.icon, cx, cy + o, lock);
    } else {
      const R0 = Math.floor(w / 2), bd = s.ready > 0 ? 9 : (h.pending && h.pending.i === i && ((U.t * 8) | 0) % 2 ? 9 : lock ? 3 : mx ? 13 : 5);   // v3.14 滿級：金色外框
      circBtn(c, cx, cy, R0, pr ? 3 : 1, bd, o);
      icon(c, s.icon, cx, cy + o, lock || noMp || cd || !h.alive);
      if (cd && !lock) {
        const f = s.cd / s.cdMax, rr = (R0 - 2) * (R0 - 2);
        c.fillStyle = P[0];
        for (let yy = -R0 + 2; yy <= R0 - 2; yy++) for (let xx = -R0 + 2; xx <= R0 - 2; xx++) {
          if (xx * xx + yy * yy > rr) continue;
          let a = Math.atan2(xx + 0.5, -(yy + 0.5)) / (Math.PI * 2); if (a < 0) a += 1;
          if (a > 1 - f && G.bayer(xx + 64, yy + 64) < 0.75) c.fillRect(cx + xx, cy + yy + o, 1, 1);
        }
        G.text(c, Math.ceil(s.cd), cx, cy - 4 + o, 9, R0 >= 13 ? 2 : 1, 0, 0.5);
      }
      if (!lock && !cd) G.text(c, cost, cx, cy + R0 - 8 + o, noMp ? 10 : 6, 1, 0, 0.5);
    }
    if (lock) icon(c, 'i_lock', cx, cy + o);
    // 技能等級：上緣三顆小點
    const lx = Math.round(cx - 5), ly = s.passive ? y + 2 + o : Math.round(cy - w / 2 + 3 + o);
    for (let k = 0; k < G.SKILL_MAX; k++) { c.fillStyle = P[0]; c.fillRect(lx + k * 3, ly, 4, 3); c.fillStyle = P[k < s.lv ? (s.passive ? 17 : 13) : 3]; c.fillRect(lx + 1 + k * 3, ly + 1, 2, 1); }
    U.btns.push({ id, x: r.x, y: r.y, w, h: r.h, down: () => { U.hold = { id, t: 0, s, fired: false, x: r.x, y: r.y, w }; if (!s.passive && s.lv) U.aim = { i, s, pre: true, on: false, bx: cx, by: cy, dx: 0, dy: 0 }; },
      drag: s.passive ? null : (ux, uy) => U.aimDrag(ux, uy), up: () => {
      if (U.aim && U.aim.on) { U.aimRelease(); return; }
      U.aim = null;
      if (U.hold && U.hold.fired) return;
      if (s.passive) { U.press[id] = 0.12; U.toastMsg('長按查看說明', 7); G.Audio.play('tick'); return; }
      const r2 = W.trySkill(i); U.press[id] = 0.12;
      if (r2 === 'ok' || r2 === 'queued') G.Audio.play('click');
      else {
        deny(id);
        if (r2 === 'none' && h.alive && s.needT) G.FX.ring(W, h.x, h.y, s.range, s.range + 4, 0.45, 7, 1);
        if (r2 === 'mp') U.toastMsg('MP不足', 11); if (r2 === 'lock') U.toastMsg('尚未學習', 7);
      }
    } });
  }
  U.toastMsg = (s, col = 9) => { U.toast = { s, t: 0.9, col }; };
  // ---------- v2.4 技能瞄準（仿傳說對決：點一下＝快速施放；按住拖曳＝自己選落點；拖到「取消」放開＝取消）----------
  // 電腦：按住 Q/E/R 跟著滑鼠瞄準、放開施放；Esc 或右鍵取消
  const AIM_DEAD = 7, AIM_R = 36;                          // 拖曳多遠才進入瞄準、搖桿半徑（UI px）
  U.aimDrag = (ux, uy) => {
    const A = U.aim; if (!A) return;
    A.dx = ux - A.bx; A.dy = uy - A.by; A.ux = ux; A.uy = uy;
    if (!A.on && Math.hypot(A.dx, A.dy) > AIM_DEAD && !(U.hold && U.hold.fired)) { A.on = true; A.pre = false; U.hold = null; G.Audio.play('tick'); }
    if (A.on) U.aimUpdate();
  };
  U.aimUpdate = () => {
    const A = U.aim, h = W && W.hero; if (!A || !A.on || !h) return;
    const sp = A.s.shape, cast = sp.cast || 0; let dx, dy, dist;
    if (A.mouse) { if (!U.mouse) return; const [wx, wy] = R.screenToWorld(U.mouse[0], U.mouse[1]); dx = wx - h.x; dy = wy - h.y; dist = Math.min(Math.hypot(dx, dy), cast); }
    else {
      // v2.5 靠邊補償：按鈕在右下角，往右／往下能拖的空間比較少 → 那個方向只要拖到螢幕邊就算拉滿（360 度都一樣好拉）
      const sR = Math.max(10, R.uw - A.bx - 3), sD = Math.max(10, R.uh - A.by - 3), sL = Math.max(10, A.bx - 3), sU = Math.max(10, A.by - 3);
      const ex = A.dx / Math.min(AIM_R, A.dx > 0 ? sR : sL), ey = A.dy / Math.min(AIM_R, A.dy > 0 ? sD : sU), m = Math.hypot(ex, ey), d0 = AIM_DEAD / AIM_R;
      const k = G.clamp((m - d0) / (1 - d0), 0, 1); dx = ex / G.AX; dy = ey / G.AY; dist = k * cast; A.auto = k < 0.12; A.kx = ex; A.ky = ey;
    }
    const l = Math.hypot(dx, dy) || 1; if (!(dx || dy)) { dx = h.face; dy = 0; }
    A.x = h.x + dx / l * (sp.k === 'line' ? Math.max(dist, 40) : dist); A.y = h.y + dy / l * (sp.k === 'line' ? Math.max(dist, 40) : dist);
    if (sp.k === 'unit') {                                 // 指定目標：選離落點最近、在施放距離內的敵人
      let best = null, bd = 1e9;
      for (const e of W.units) { if (!W.valid(h, e) || W.dist(h, e) > A.s.range + 10) continue; const d = A.auto ? W.dist(h, e) : Math.hypot(e.x - A.x, e.y - A.y); if (d < bd) { bd = d; best = e; } }
      A.t = best;
    }
    const cb = U.cancelBtn; A.cancel = !A.mouse && !!cb && A.ux != null && Math.hypot(A.ux - cb.x, A.uy - cb.y) <= cb.r + 5;
  };
  U.aimRelease = () => {
    const A = U.aim; U.aim = null; if (!A || !A.on) return;
    if (A.cancel) { G.Audio.play('click'); U.toastMsg('已取消施放', 7); return; }
    let r = W.castAim(A.i, A);
    if (r === 'none' && A.s.shape.k === 'unit') r = W.trySkill(A.i);     // 範圍內沒有目標：照一般點擊處理（追過去）
    const id = 'sk' + A.i; U.press[id] = 0.12;
    if (r === 'ok' || r === 'queued') G.Audio.play('click');
    else { deny(id); if (r === 'mp') U.toastMsg('MP不足', 11); else if (r === 'none') U.toastMsg('範圍內沒有目標', 7); }
  };
  U.aimCancel = () => { if (U.aim && U.aim.on) { U.aim = null; G.Audio.play('click'); U.toastMsg('已取消施放', 7); return true; } U.aim = null; return false; };
  // 取消區：瞄準時出現在技能列左上方（手指拖過去會變紅）
  function aimCancelUI(c, x, y) {
    const A = U.aim; if (!A || !A.on || A.mouse) { U.cancelBtn = null; return; }
    { const r = 16, m = Math.hypot(A.kx || 0, A.ky || 0) || 1, f = Math.min(1, m), kx = Math.round(A.bx + (A.kx || 0) / m * f * r), ky = Math.round(A.by + (A.ky || 0) / m * f * r);   // 搖桿：外圈＋拇指（顯示目前拉了多少）
      c.globalAlpha = 0.5; G.pxEllipse(c, A.bx, A.by, r, r, A.cancel ? 10 : 13, 3, U.t * 4); c.globalAlpha = 1; G.pxDisc(c, kx, ky, 4, 4, A.cancel ? 10 : 13, 0.8); G.pxDisc(c, kx, ky, 2, 2, 9, 1); }
    const r = 11; U.cancelBtn = { x, y, r };
    const hot = A.cancel; c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.arc(x, y, r + 2, 0, 6.2832); c.fill();
    c.fillStyle = P[hot ? 10 : 2]; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    c.fillStyle = P[hot ? 9 : 6]; for (let k = -4; k <= 4; k++) { c.fillRect(x + k, y + k, 1, 1); c.fillRect(x + k, y - k, 1, 1); c.fillRect(x + k + 1, y + k, 1, 1); c.fillRect(x + k + 1, y - k, 1, 1); }
    G.cn(c, '取消', x, y + r + 3, hot ? 10 : 7, 0.5);
  }
  U.cardTip = (s) => { U.card = { s, t: 1.6 }; };
  // 資訊卡：名稱、類型、等級、說明、數值（目前 → 下一級）
  // 數值列：標籤靠左、數值靠右（目前 → 下一級）；任何一列放不下時，整張表都改成「標籤一行、數值一行」，保持一致
  function valRows(c, rows, lv, x, y, w, draw) {
    const nx = Math.min(G.SKILL_MAX, lv + 1);
    const R2 = rows.map(r => { const cur = String(r.f(Math.max(1, lv))), nxt = String(r.f(nx)), up = lv && lv < G.SKILL_MAX && nxt !== cur, nw = up ? G.cnW('→' + nxt) : 0; return { r, cur, nxt, up, nw, vw: G.cnW(cur) + (up ? nw + 5 : 0) }; });
    const stack = R2.some(q => G.cnW(q.r.k) + q.vw + 10 > w);
    let yy = y;
    R2.forEach(({ r, cur, nxt, up, nw }) => {
      if (draw) G.cn(c, r.k, x, yy, 6);
      if (stack) yy += 12;
      if (draw) { if (up) { G.cn(c, '→' + nxt, x + w, yy, 13, 1); G.cn(c, cur, x + w - nw - 5, yy, 9, 1); } else G.cn(c, cur, x + w, yy, lv ? 9 : 5, 1); }
      yy += 13;
    });
    return yy - y;
  }
  // 技能資訊卡（長按）：名稱、動畫展示（取代文字說明）、數值。
  // 先在卡片畫布上以 1 倍畫好，再以原生解析度縮成約 2/3 大小貼到螢幕（整數倍放大，像素字保持清晰）
  let cardC = null, cardSb = null;
  function skillCard(c, s, ax, ay) {
    const sd = s.s, rows = G.skillRows(sd), lv = s.lv, h0 = W.hero;
    const req = lv < G.SKILL_MAX ? G.skillReq(sd, lv + 1) : 0, reqS = req ? '升到 Lv' + (lv + 1) + ' 需英雄等級 ' + req : '已達最高等級';
    const k = Math.max(1, Math.round(R.uiS * 2 / 3)), f = k / R.uiS;            // 顯示倍率（約原本 2/3）
    const cw = Math.min(176, Math.floor((R.uw - R.ins.l - R.ins.r - 8) / f)), aw = cw - 8, ah = 70;
    const ch = 30 + ah + 6 + valRows(R.uctx, rows, lv, 0, 0, cw - 12, false) + 16;
    if (!cardC || cardC.width !== cw || cardC.height !== ch) cardC = G.canvas(cw, ch);
    const cc = cardC.getContext('2d'); cc.imageSmoothingEnabled = false; cc.clearRect(0, 0, cw, ch);
    // 動畫展示（同技能展示的沙盒）
    if (!cardSb || cardSb.sid !== sd.id || cardSb.hero !== h0.name) { cardSb = new G.Sandbox(); cardSb.mute = true; cardSb.size(aw, ah); cardSb.setup(h0.name, 0, sd.id); cardSb.soundT = 0; cardSb.hero = h0.name; }
    cardSb.size(aw, ah); cardSb.update(M_DT);
    box(cc, 0, 0, cw, ch, 1, 7, false);
    icon(cc, s.icon, 12, 12);
    G.cn(cc, G.skillName(s.id), 24, 4, 9);
    const tg = sd.active ? '主動' : '被動', tgw = G.cn(cc, tg, 24, 17, sd.active ? 13 : G.PASSIVE_COL); G.cn(cc, lv ? 'Lv ' + lv + '/3' : '未學習', 24 + tgw + 8, 17, 6);
    cc.fillStyle = P[0]; cc.fillRect(3, 31, aw + 2, ah + 2); cc.drawImage(cardSb.draw(), 4, 32);
    let yy = 32 + ah + 4;
    yy += valRows(cc, rows, lv, 6, yy, cw - 12, true);
    G.cn(cc, reqS, 6, yy + 1, req && h0.level < req ? 10 : 5);
    // 貼到畫面：顯示尺寸 = 卡片尺寸 × f（UI px）
    const dw = cw * f, dh = ch * f;
    const x = Math.round(G.clamp(ax - dw + 10, R.ins.l + 2, R.uw - R.ins.r - dw - 2)), y = Math.round(G.clamp(ay - dh - 18, R.ins.t + 2, R.uh - dh - 2));
    dim(c, 0.6);
    c.drawImage(cardC, x, y, Math.round(dw), Math.round(dh));                   // UI 畫布上的低解析版本（備援）
    R.hiQ(ctx => { ctx.imageSmoothingEnabled = false; ctx.drawImage(cardC, Math.round(x * R.uiS), Math.round(y * R.uiS), cw * k, ch * k); });
  }
  // 增益資訊卡（長按左上狀態圖示）：名稱、效果、剩餘時間
  G.buffInfo = key => {
    if (key === 'i_inv') return { n: '無敵', d: '{不受傷害與控制}' };   // v3.14 復活後的無敵
    if (key.startsWith('i_')) { const it = G.SHOP_BY[key.slice(2)]; return it ? { n: it.n, d: G.potTxt(it, 1) } : { n: key, d: '' }; }
    return { n: key, d: '' };
  };
  function buffCard(c, key, ax, ay) {
    const b = W.hero.tb && W.hero.tb[key]; if (!b) return;
    const inf = G.buffInfo(key), w = Math.min(150, R.uw - R.ins.l - R.ins.r - 8), lines = G.cnWrapRich(inf.d, w - 12), h = 22 + lines.length * 13 + 18;
    const x = Math.round(G.clamp(ax, R.ins.l + 2, R.uw - R.ins.r - w - 2)), y = Math.round(G.clamp(ay, R.ins.t + 2, R.uh - h - 2));
    dim(c, 0.6);
    box(c, x, y, w, h, 1, b.col != null ? b.col : 7);
    icon(c, b.ic, x + 11, y + 10);
    G.cn(c, inf.n, x + 22, y + 3, 9);
    let yy = y + 20; lines.forEach(l => { G.cnRich(c, l, x + 6, yy, 7); yy += 13; });
    const f = b.t / b.max; c.fillStyle = P[0]; c.fillRect(x + 6, yy + 5, w - 60, 3); c.fillStyle = P[b.t < 8 ? 10 : 9]; c.fillRect(x + 6, yy + 6, Math.max(1, Math.round((w - 60) * f)), 1);
    G.cn(c, '剩 ' + Math.ceil(b.t) + ' 秒', x + w - 6, yy, b.t < 8 ? 10 : 13, 1);
  }

  // ---------- 地圖（小地圖與大地圖共用）----------
  // x,y,w,h 以 UI px 計；S = 每 UI px 的實際像素（UI 畫布為 1；螢幕原生解析度為 R.uiS）
  function mapDraw(c, x, y, w, h, S, big) {
    const X0 = Math.round(x * S), Y0 = Math.round(y * S), Wd = Math.round(w * S), Hd = Math.round(h * S), mm = W.ground.mini, hero = W.hero;
    c.save(); c.beginPath(); c.rect(X0, Y0, Wd, Hd); c.clip();
    c.imageSmoothingEnabled = false; c.drawImage(mm, 0, 0, mm.width, mm.height, X0, Y0, Wd, Hd);
    if (R.fogC && !W.attract) { c.imageSmoothingEnabled = true; c.drawImage(R.fogC, X0, Y0, Wd, Hd); if (!big) c.drawImage(R.fogC, X0, Y0, Wd, Hd); c.imageSmoothingEnabled = false; }
    const sx = Wd / W.M.ww, sy = Hd / W.M.wh, d = Math.max(1, S * (big ? 1.5 : 1));
    const sq = (px, py, r, col, ol) => { r = Math.max(0.5, r); if (ol != null) { c.fillStyle = P[ol]; c.fillRect(Math.round(px - r) - Math.max(1, S >> 2), Math.round(py - r) - Math.max(1, S >> 2), Math.round(r * 2) + 2 * Math.max(1, S >> 2), Math.round(r * 2) + 2 * Math.max(1, S >> 2)); } c.fillStyle = P[col]; c.fillRect(Math.round(px - r), Math.round(py - r), Math.max(1, Math.round(r * 2)), Math.max(1, Math.round(r * 2))); };
    // 空的野怪營地（大地圖顯示）
    if (big) for (const cp of W.camps || []) if (!cp.u) { const px = X0 + cp.x * sx, py = Y0 + cp.y * sy; c.fillStyle = P[4]; c.fillRect(Math.round(px - d), Math.round(py), Math.round(d * 2), Math.max(1, S >> 1)); c.fillRect(Math.round(px), Math.round(py - d), Math.max(1, S >> 1), Math.round(d * 2)); }
    for (const u of W.units) {
      if (!u.alive || u === hero || !W.seen(0, u)) continue;
      const px = X0 + u.x * sx, py = Y0 + u.y * sy, ally = u.side === 0;
      if (u.kind === 'holy') { const dia = (r, col) => { c.fillStyle = P[col]; c.beginPath(); c.moveTo(Math.round(px), Math.round(py - r)); c.lineTo(Math.round(px + r), Math.round(py)); c.lineTo(Math.round(px), Math.round(py + r)); c.lineTo(Math.round(px - r), Math.round(py)); c.closePath(); c.fill(); }; dia(d * 3.1 + S, 0); dia(d * 3.1, 13); dia(d * 2.1, ally ? 12 : 10); dia(d * 0.8, 9); }   // v3.9 聖域：金邊菱形（和方形的塔分開，不會看成第五座塔）
      else if (u.static) sq(px, py, d * 1.5, ally ? 12 : 10, 0);
      else if (u.side === 2) sq(px, py, d * (u.kind === 'boss' ? 1.3 : 0.8), 13, 0);
      else if (u.kind === 'jungler') sq(px, py, d * 1.2, 14, 0);
      else sq(px, py, d * (u.kind === 'boss' ? 1.1 : 0.7), ally ? 12 : 10, S > 1 ? 0 : null);
    }
    if (hero && hero.alive) { const px = X0 + hero.x * sx, py = Y0 + hero.y * sy; sq(px, py, d * 1.4, ((U.t * 4) | 0) % 2 ? 9 : 18, 0); }
    // 鏡頭範圍
    const vw = R.sw / R.scale / G.AX * sx, vh = R.sh / R.scale / G.AY * sy, lw = Math.max(1, S >> 1);
    const cx0 = Math.round(X0 + R.cam.x * sx - vw / 2), cy0 = Math.round(Y0 + R.cam.y * sy - vh / 2);
    c.fillStyle = P[9]; c.globalAlpha = 0.8;
    c.fillRect(cx0, cy0, Math.round(vw), lw); c.fillRect(cx0, cy0 + Math.round(vh) - lw, Math.round(vw), lw); c.fillRect(cx0, cy0, lw, Math.round(vh)); c.fillRect(cx0 + Math.round(vw) - lw, cy0, lw, Math.round(vh));
    c.globalAlpha = 1; c.restore();
  }
  function expandIcon(c, x, y, w, h, col) {   // 四角框（展開）
    c.fillStyle = P[col];
    for (const [ax, ay, sx2, sy2] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) { c.fillRect(Math.min(ax, ax + sx2 * 2), ay, 3, 1); c.fillRect(ax, Math.min(ay, ay + sy2 * 2), 1, 3); }
  }
  // 大地圖：置中、盡量大；點一下地圖 → 鏡頭移過去並關閉
  function bigMap(c) {
    const uw = R.uw, uh = R.uh, I = R.ins, ar = W.M.ww / W.M.wh;
    dim(c, 0.75);
    U.btns = []; btn('bigBg', 0, 0, uw, uh, () => { U.bigMap = false; G.Audio.play('click'); });   // 點地圖外 → 關閉
    // 圖例先排版（放不下就換行），再決定地圖大小
    const LEG = [[12, '我方'], [10, '敵方'], [13, '野怪'], [14, '獵人'], [-1, '聖所']];   // v3.9 聖所＝金邊菱形
    const legLayout = (w) => { const out = []; let lx = 0, ly = 0; for (const [col, s2] of LEG) { const iw = 8 + G.cnW(s2); if (lx && lx + iw > w) { lx = 0; ly += 13; } out.push([lx, ly, col, s2]); lx += iw + 8; } return { out, h: ly + 13 }; };
    let w = uw - I.l - I.r - 16, h = Math.round(w / ar), lg = legLayout(w); const hMax = () => uh - I.t - I.b - 30 - lg.h - 8;
    for (let k = 0; k < 4 && h > hMax(); k++) { h = hMax(); w = Math.round(h * ar); lg = legLayout(w); }   // v3.9 地圖縮窄後圖例重新換行（之前第二次縮窄沒重排，橫屏「獵人」超出框）
    const tot = 20 + h + 4 + lg.h + 4, x = Math.round(uw / 2 - w / 2), y = Math.round(I.t + (uh - I.t - I.b) / 2 - tot / 2) + 20;
    box(c, x - 4, y - 20, w + 8, tot, 1, 7);
    G.cn(c, '地圖', x, y - 17, 9);
    box(c, x + w - 14, y - 18, 14, 14, 1, 5); G.text(c, 'X', x + w - 7, y - 13, 8, 1, null, 0.5);
    btn('bigX', x + w - 14, y - 18, 14, 14, () => { U.bigMap = false; G.Audio.play('click'); });
    mapDraw(c, x, y, w, h, 1, true);
    R.hiQ(ctx => mapDraw(ctx, x, y, w, h, R.uiS, true));
    btn('bigIn', x, y, w, h, (ux, uy) => { R.cam.follow = false; R.cam.x = (ux - x) / w * W.M.ww; R.cam.y = (uy - y) / h * W.M.wh; U.bigMap = false; G.Audio.play('tick'); });
    for (const [lx, ly, col, s2] of lg.out) { const xx = x + lx, yy = y + h + 4 + ly; if (col < 0) { for (const [r, k] of [[4, 0], [3, 13], [1, 9]]) { c.fillStyle = P[k]; for (let dy = -r; dy <= r; dy++) c.fillRect(xx + 3 - (r - Math.abs(dy)), yy + 6 + dy, (r - Math.abs(dy)) * 2 + 1, 1); } } else { c.fillStyle = P[0]; c.fillRect(xx, yy + 3, 6, 6); c.fillStyle = P[col]; c.fillRect(xx + 1, yy + 4, 4, 4); } G.cn(c, s2, xx + 8, yy, 7); }
  }

  // ---------- 廣播 ----------
  G.NOTICE_IN = 0.28; G.NOTICE_OUT = 0.3;
  // v3.14 廣播與大招名稱改成「不擋畫面中央」：
  //  橫屏＝廣播在上方中間（左上資訊和右上小地圖之間）、大招名稱在左側；直屏＝廣播靠左在狀態列下方、大招名稱靠右在小地圖下方
  //  都是 1 倍字、半透明細條，最多同時 2 則
  G.NOTICE_N = 2;
  const noticeBox = () => { const I = R.ins, uw = R.uw, port = R.uh > uw; return port ? { x0: I.l, x1: uw - I.r - 68, y0: I.t + 52, al: 0 } : { x0: I.l + 104, x1: uw - I.r - 66, y0: I.t + 1, al: 0.5 }; };
  function ultBanner(c) {
    const B = W.ultBan; B.t += M_DT; const T = B.t, D = 1.6; if (T > D || !B.n) { W.ultBan = null; return; }
    const E = G.ELEM[B.el] || G.ELEM.arcane, I = R.ins, uw = R.uw, port = R.uh > uw, tw = G.cnW(B.n), w = tw + 26, hh = 15;
    const right = port, y = port ? I.t + 114 : I.t + 54, edge = right ? uw - I.r : I.l;
    const inK = 1 - Math.pow(1 - Math.min(1, T / 0.18), 3), outK = Math.max(0, (T - (D - 0.3)) / 0.3), x = Math.round(right ? edge - w * inK : edge - w + w * inK);
    c.save(); c.globalAlpha = 1 - outK;
    c.fillStyle = 'rgba(8,8,8,0.72)'; c.fillRect(x, y, w, hh);
    c.fillStyle = P[E.c]; c.fillRect(x, y, w, 1); c.fillRect(x, y + hh - 1, w, 1);
    c.fillStyle = P[E.c]; c.fillRect(right ? x : x + w - 2, y, 2, hh);                   // 內側色條
    for (let i = 0; i < 4; i++) { const ly = y + 3 + i * 3, L2 = 6 + ((T * 90 + i * 37) % 14); c.globalAlpha = (1 - outK) * 0.55; c.fillStyle = P[i % 2 ? E.c : E.c2]; c.fillRect(Math.round(right ? x + w - 4 - L2 - ((T * 60 + i * 11) % 8) : x + 4 + ((T * 60 + i * 11) % 8)), ly, L2, 1); }
    c.globalAlpha = 1 - outK; G.cn(c, B.n, Math.round(right ? x + 6 : x + w - 6 - tw), y + 2, E.c);
    c.restore();
  }
  function drawNotices(c) {
    const A = noticeBox(), maxW = A.x1 - A.x0, ease = k => 1 - Math.pow(1 - k, 3), fromR = A.al === 0 ? false : null;
    let yy = A.y0;
    W.notices.slice(0, G.NOTICE_N).forEach(n => {
      const ls = n._ls && n._w === maxW ? n._ls : (n._ls = G.cnWrap(n.s, maxW - 20), n._w = maxW, n._ls), tw = Math.max(...ls.map(l => G.cnW(l))) + 20, hh = ls.length * 12 + 3;
      const tx = Math.round(A.al ? (A.x0 + A.x1) / 2 - tw / 2 : A.x0);
      n.y = n.y == null ? yy : n.y + (yy - n.y) * Math.min(1, M_DT * 12);   // 上面那則離開時，下面的平滑補位
      let x = tx, al = 1;
      if (n.age < G.NOTICE_IN) { const k = ease(n.age / G.NOTICE_IN); al = k; x = Math.round(tx - (1 - k) * 12); }
      else if (n.age > n.t) { const k = Math.min(1, (n.age - n.t) / G.NOTICE_OUT); al = 1 - k; }
      const y = Math.round(n.y);
      c.globalAlpha = Math.max(0.05, al);
      c.fillStyle = 'rgba(8,8,8,0.7)'; c.fillRect(x, y, tw, hh);
      c.fillStyle = P[n.col]; c.fillRect(x, y, 2, hh);                                        // 左側色條
      icon(c, n.ic, x + 10, y + Math.round(hh / 2));
      ls.forEach((l, i) => G.cn(c, l, x + 18, y + 1 + i * 12, 9));
      c.globalAlpha = 1; yy += hh + 2;
    });
  }
  // ---------- 即時戰鬥數據 ----------
  function statPanel(c) {
    const uw = R.uw, uh = R.uh, I = R.ins, st = W.stats, h = W.hero;
    dim(c, 0.75);
    U.btns = []; btn('stBg', 0, 0, uw, uh, () => { U.statP = false; G.Audio.play('click'); });
    const w = Math.min(uw - I.l - I.r - 12, 260), cols = w >= 250 ? 2 : 1, t = st.time | 0;
    const rows = [['野生首領', st.wboss], ['推倒敵塔', st.towers], ['升級藥水', st.potUp || 0], ['取得鑰匙', W.keysGot || 0], ['造成傷害', Math.round(st.dmg)], ['承受傷害', Math.round(st.taken)], ['對塔傷害', Math.round(st.tower)], ['英雄等級', 'Lv' + h.level]];
    const nr = Math.ceil(rows.length / cols), hh = 22 + 34 + nr * 14 + 8, x = Math.round(uw / 2 - w / 2), y = Math.round(G.clamp(uh / 2 - hh / 2, I.t + 2, uh - hh - 2));
    box(c, x, y, w, hh, 1, 7);
    G.cn(c, '戰鬥數據', x + 6, y + 3, 9); G.text(c, String((t / 60) | 0) + ':' + String(t % 60).padStart(2, '0'), x + w - 24, y + 6, 7, 1, null, 1);
    box(c, x + w - 18, y + 3, 14, 14, 1, 5); G.text(c, 'X', x + w - 11, y + 8, 8, 1, null, 0.5); btn('stX', x + w - 18, y + 3, 14, 14, () => { U.statP = false; G.Audio.play('click'); });
    // K / D / A 三格
    const ky = y + 22, kw = Math.floor((w - 12 - 8) / 3);
    [['擊殺', st.kills, 13], ['陣亡', st.deaths, 10], ['助攻', st.assists, 18]].forEach(([lab, v, col], i) => {
      const bx = x + 6 + i * (kw + 4); box(c, bx, ky, kw, 30, 0, 4, false);
      G.text(c, v, bx + kw / 2, ky + 4, col, 2, null, 0.5); G.cn(c, lab, bx + kw / 2, ky + 16, 6, 0.5);
    });
    // 其他數據：標籤靠左、數值靠右
    const ry = ky + 36, cw = Math.floor((w - 12 - (cols - 1) * 12) / cols);
    rows.forEach(([lab, v], i) => {
      const col = (i / nr) | 0, row = i % nr, rx = x + 6 + col * (cw + 12), yy = ry + row * 14;
      if (row % 2 === 0) { c.fillStyle = P[1]; c.fillRect(rx - 2, yy - 1, cw + 4, 14); }
      G.cn(c, lab, rx, yy, 6); G.cn(c, String(v), rx + cw, yy, 9, 1);
    });
  }

  // ---------- 戰鬥 HUD ----------
  function hud(c) {
    const uw = R.uw, uh = R.uh, h = W.hero, I = R.ins;
    if (!h) return;
    const L = I.l, Rt = uw - I.r, T0 = I.t, B = uh - I.b;
    // 左上：頭像 + 血/魔/經驗
    box(c, L, T0, 24, 24, h.alive ? 2 : 0, 6);
    const ps = h.spr[0]; c.drawImage(h.alive ? ps.n : G.SPR.icons_dark.i_skull.n, Math.round(L + 12 - ps.w / 2), Math.round(T0 + 13 - ps.h / 2) + (h.alive && ((U.t * 2) | 0) % 2 ? -1 : 0));
    box(c, L + 15, T0 + 17, 13, 9, 0, 7, false); G.text(c, h.level, L + 22, T0 + 19, 9, 1, null, 0.5);
    btn('heroP', L, T0, 26, 26, () => { U.heroPanel = !U.heroPanel; G.Audio.play(U.heroPanel ? 'open' : 'click'); });
    const bx = L + 30;
    // 三條等粗（5px，與字高相同）、等距（每條間隔 8px）；標籤都是 7px 寬（M 用窄版字形）
    [['HP', 10, h.hp / h.st.hp, 'r', Math.ceil(h.hp)], ['ᴍP', 11, h.mp / h.st.mp, 'gn', Math.floor(h.mp)], ['XP', 21, h.exp / W.expNeed(h), 'xp', null]].forEach(([lab, col, f, st, num], i) => {
      const yy = T0 + 2 + i * 8; G.text(c, lab, bx, yy, col); bar(c, bx + 10, yy, 50, 5, f, st); if (num != null) G.text(c, num, bx + 63, yy, 9, 1, 0);
    });
    // 本局取得的鑰匙
    U.keyPos = [bx + 6, T0 + 29];
    const kb = (U.keyBump || 0) > 0 ? 1 : 0; U.keyBump = Math.max(0, (U.keyBump || 0) - M_DT);
    c.fillStyle = P[0]; c.fillRect(bx - 1, T0 + 25 - kb, 14 + G.textW('X' + (W.keysGot || 0)) + 3, 8);
    // 即時戰鬥數據（鑰匙右邊，同高；右緣對齊 XP 條）：顯示 K/D/A，點開看完整數據
    { const st = W.stats, kda = st.kills + '/' + st.deaths + '/' + st.assists, kx = bx - 1 + 14 + G.textW('X' + (W.keysGot || 0)) + 3 + 3, kr = bx + 61, kw = Math.max(kr - kx, G.textW(kda) + 6), on = U.statP || U.press.statP > 0;
      c.fillStyle = P[0]; c.fillRect(kx, T0 + 25, kw, 8); c.fillStyle = P[on ? 13 : 4]; c.fillRect(kx, T0 + 32, kw, 1);
      G.text(c, kda, kx + kw / 2, T0 + 26, on ? 13 : 9, 1, null, 0.5);
      btn('statP', kx, T0 + 23, kw, 12, () => { U.press.statP = 0.12; U.statP = !U.statP; G.Audio.play(U.statP ? 'open' : 'click'); }); }
    icon(c, 'i_key', bx + 6, T0 + 29 - kb); G.text(c, 'X' + (W.keysGot || 0), bx + 13, T0 + 26 - kb, kb ? 9 : 13, 1);
    // 小地圖（放大到 56×42；實際以螢幕原生解析度繪製，見 mapDraw / R.hi）
    const mw = 56, mh = 42, mx = Rt - mw - 2, my = T0 + 1;
    box(c, mx - 2, my - 2, mw + 4, mh + 4, 1, 6);
    mapDraw(c, mx, my, mw, mh, 1, false);
    R.hiQ(ctx => mapDraw(ctx, mx, my, mw, mh, R.uiS, false));
    btn('mini', mx, my, mw, mh, (ux, uy) => { R.cam.follow = false; U.miniDrag = true; U.miniTo(ux, uy); });
    U.miniTo = (ux, uy) => { R.cam.x = (ux - mx) / mw * W.M.ww; R.cam.y = (uy - my) / mh * W.M.wh; };
    const by = my + mh + 5;
    U.h.key(c, Rt - 16, by, 14, 12, U.press.pause > 0, 5); icon(c, 'i_pause', Rt - 9, by + 6);
    btn('pause', Rt - 16, by, 14, 12, () => { U.press.pause = 0.1; G.Audio.play('click'); U.paused = true; });
    // 展開大地圖（暫停左邊）
    U.h.key(c, Rt - 32, by, 14, 12, U.bigMap, U.bigMap ? 13 : 5); expandIcon(c, Rt - 32 + 3, by + 2, 8, 8, U.bigMap ? 13 : 8);
    btn('bigmap', Rt - 32, by, 14, 12, () => { U.bigMap = !U.bigMap; G.Audio.play(U.bigMap ? 'open' : 'click'); if (U.bigMap && G.Ach && G.W && !G.W.attract) G.Ach.on('map'); });
    // v3.14 升級進度（地圖左邊）：還有點數可以用 → 黃框呼吸＋右上角數字；點開會暫停
    { const ch = W.lvChoices(), n = (ch & 1 ? h.sp || 0 : 0) + (ch & 2 ? h.pp || 0 : 0), on = n > 0, lx = Rt - 48, pr = U.press.lvBtn > 0;
      if (on) { c.globalAlpha = 0.35 + 0.25 * Math.sin(U.t * 5); c.fillStyle = P[13]; c.fillRect(lx - 1, by - 1, 16, 15); c.globalAlpha = 1; }
      U.h.key(c, lx, by, 14, 12, pr, on ? 13 : 5); icon(c, 'i_up', lx + 7, by + 6);
      if (on) { const ns = String(Math.min(9, n)); c.fillStyle = P[0]; c.fillRect(lx - 3, by - 4, 7, 7); c.fillStyle = P[10]; c.fillRect(lx - 2, by - 3, 5, 5); G.text(c, ns, lx + 0.5, by - 3, 9, 1, null, 0.5); }   // 左上角紅點＋數字
      btn('lvBtn', lx, by, 14, 12, () => { U.press.lvBtn = 0.1; }, () => { U.openLv(false); }); }
    // 鎖定中的目標：圖示 + 血條（點一下鏡頭移過去）
    const lt = h.alive && h.cmd && h.cmd.lock && h.cmd.t && h.cmd.t.alive ? h.cmd.t : null;
    if (lt) {
      const lw = 64, lx = Rt - lw, ly = by + 16, sp = lt.spr[0], sc = Math.min(1, 16 / sp.w, 16 / sp.h);
      box(c, lx, ly, lw, 21, 0, 10);
      c.fillStyle = P[5]; c.fillRect(lx + 2, ly + 2, 17, 17);
      c.save(); c.beginPath(); c.rect(lx + 1, ly + 1, 19, 19); c.clip();
      c.drawImage(sp.n, Math.round(lx + 10.5 - sp.w * sc / 2), Math.round(ly + 19 - sp.h * sc), Math.round(sp.w * sc), Math.round(sp.h * sc)); c.restore();
      c.fillStyle = P[10]; for (let k = 0; k < 3; k++) { c.fillRect(lx + 1 + k, ly + 1, 1, 1); c.fillRect(lx + 1, ly + 1 + k, 1, 1); c.fillRect(lx + 19 - k, ly + 19, 1, 1); c.fillRect(lx + 19, ly + 19 - k, 1, 1); }
      bar(c, lx + 23, ly + 5, lw - 27, 3, lt.hp / lt.st.hp, 'r');
      G.text(c, Math.ceil(lt.hp), lx + lw - 3, ly + 12, 9, 1, 0, 1);
      btn('lockT', lx, ly, lw, 21, () => { R.cam.follow = false; R.cam.x = lt.x; R.cam.y = lt.y; G.Audio.play('tick'); });
    }
    const Ct = G.Ctl;
    // 視角置中、放大／縮小（位置可在操作設定自訂）
    { const r = Ct.rect('cam'); box(c, r.x, r.y, r.w, r.h, R.cam.follow ? 1 : 3, R.cam.follow ? 5 : 9); icon(c, 'i_center', r.cx, r.cy);
      btn('center', r.x, r.y, r.w, r.h, () => { R.cam.follow = true; G.Audio.play('click'); }); }
    { const r = Ct.rect('zoom'), w2 = Math.round((r.w - 3) / 2);
      [[-1, 'zout', 'i_zout', r.x], [1, 'zin', 'i_zin', r.x + r.w - w2]].forEach(([dir, id, ic, zx]) => {
        const ok = R.zoomAt(dir), o = U.press[id] > 0 ? 1 : 0;
        if (!ok) c.globalAlpha = 0.45;
        box(c, zx, r.y + o, w2, r.h, 0, 5); icon(c, ic, zx + w2 / 2, r.cy + o);
        c.globalAlpha = 1;
        btn(id, zx, r.y, w2, r.h, () => { U.press[id] = 0.12; }, () => { if (R.zoomBy(dir)) G.Audio.play('tick'); else deny(id); });
      }); }
    // 傳送引導中 → 畫面中下方進度條
    const tp = W.tp;
    if (tp && tp.ch) {
      const bw2 = 90, bx2 = Math.round(uw / 2 - bw2 / 2), by2 = Math.round(uh * 0.68);
      box(c, bx2, by2, bw2, 24, 0, 13);
      G.cn(c, '傳送中', bx2 + 6, by2 + 2, 13); G.text(c, tp.ch.t.toFixed(1), bx2 + bw2 - 6, by2 + 5, 9, 1, 0, 1);
      bar(c, bx2 + 6, by2 + 17, bw2 - 12, 2, 1 - tp.ch.t / tp.ch.max, 'w');
    }
    // 狀態列（頭像下方）：復活次數、傳送冷卻、計時增益；長按增益顯示效果與剩餘時間
    let bxx = L; const byy = T0 + 34;
    if (W.rev > 0) {
      box(c, bxx, byy, 13, 13, 0, 19, false); icon(c, 'p_rev', bxx + 6.5, byy + 6.5); G.text(c, W.rev, bxx + 12, byy + 9, 9, 1, 0, 1);
      btn('revI', bxx - 1, byy - 1, 15, 15, null, () => { U.toastMsg('陣亡時自動復活，剩 ' + W.rev + ' 次', 19); G.Audio.play('tick'); });
      bxx += 15;
    }
    if (tp && tp.cd > 0) {
      const ts = G.SPR.ptower[0], k = Math.min(1, 11 / ts.h);
      box(c, bxx, byy, 13, 13, 0, 4, false); c.globalAlpha = 0.45; c.drawImage(ts.n, Math.round(bxx + 6.5 - ts.w * k / 2), Math.round(byy + 12 - ts.h * k), Math.round(ts.w * k), Math.round(ts.h * k)); c.globalAlpha = 1;
      G.text(c, Math.ceil(tp.cd), bxx + 6.5, byy + 4, 13, 1, 0, 0.5);
      btn('tpI', bxx - 1, byy - 1, 15, 15, null, () => { U.toastMsg('傳送冷卻中', 7); G.Audio.play('tick'); });
      bxx += 15;
    }
    for (const k in h.tb || {}) {
      const b2 = h.tb[k], f = b2.t / b2.max, id = 'bf_' + k, hold = U.hold && U.hold.id === id;
      box(c, bxx, byy, 13, 13, hold ? 3 : 0, b2.col != null ? b2.col : 5, false);
      icon(c, b2.ic, bxx + 6.5, byy + 6.5);
      c.fillStyle = P[0]; c.fillRect(bxx + 1, byy + 14, 11, 2); c.fillStyle = P[b2.t < 8 && ((U.t * 6) | 0) % 2 ? 10 : 9]; c.fillRect(bxx + 1, byy + 14, Math.max(1, Math.round(11 * f)), 1);
      const bx3 = bxx;
      btn(id, bxx - 1, byy - 1, 15, 17, () => { U.hold = { id, t: 0, buff: k, fired: false, x: bx3, y: byy + 19 }; }, () => { if (U.hold && U.hold.fired) return; U.toastMsg('長按查看說明', 7); });
      bxx += 15;
    }
    // v3.14 搖桿（左下）
    Ct.drawJoy(c);
    // v3.14 技能：右下弧形（左下 技能 1 → 技能 2 → 右上 大招）、被動方形在角落；位置可自訂
    const act = h.skills, nA = act.length;
    act.forEach((s, i) => skillBtn(c, s, Ct.rect(Ct.slotOf(i, nA))));
    h.pskills.forEach((s, i) => skillBtn(c, s, Ct.rect(i === 0 ? 'ps' : 'sk0')));
    if (U.aim && (!h.alive || W.over)) U.aim = null;
    if (U.aim && U.aim.on) U.aimUpdate();
    { const rs = act.map((s, i) => Ct.rect(Ct.slotOf(i, nA))), ax = Math.min(...rs.map(r => r.cx)), ay = Math.min(...rs.map(r => r.y)) - 30;   // 取消區：技能群左上方（拇指往上拖就到）
      aimCancelUI(c, Math.round(G.clamp(ax, L + 14, Rt - 14)), Math.round(G.clamp(ay, T0 + 76, B - 14))); }
    // 長按資訊卡
    if (U.hold && U.hold.fired && !U.lvUp) { const hs = U.hold; if (hs.buff) { if (h.tb && h.tb[hs.buff]) buffCard(c, hs.buff, hs.x, hs.y); } else if (hs.s) skillCard(c, hs.s, hs.x, hs.y); }
    if (U.bigMap) { bigMap(c); return; }
    if (U.statP) { statPanel(c); return; }
    // 廣播（擊敗野怪等）：由左滑入 → 停留 → 向右滑出；多則時上下堆疊
    drawNotices(c);
    if (W.ultBan) ultBanner(c);
    keyFly(c);
    if (U.heroPanel) heroPanel(c);
    // 英雄死亡倒數
    if (!h.alive && !W.over) {
      G.text(c, Math.ceil(h.dead), uw / 2, uh / 2 - 12, 9, 4, 0, 0.5);
      icon(c, 'i_tree', uw / 2, uh / 2 + 16);
    }
    // 傳送確認：點過一次我方塔 → 塔上方顯示「再點一下傳送」與倒數條
    if (U.tpAsk) {
      const a = U.tpAsk, u = a.u, left = G.TUNE.tp.ask - (U.t - a.t);
      if (left <= 0 || !u.alive || (W.tp && W.tp.ch)) U.tpAsk = null;
      else {
        const sh0 = u.spr && u.spr[0] ? u.spr[0].h : 30, p0 = R.worldToScreen(u.x, u.y, 0), p1 = R.worldToScreen(u.x, u.y, sh0 / G.AZ + 6);
        const bx0 = p0[0] / R.uiS, by0 = p0[1] / R.uiS, ty0 = p1[1] / R.uiS, lab = '再點一下傳送', ly = Math.round(Math.max(T0 + 4, ty0 - 15));
        const fin = Math.min(1, (U.t - a.t) / 0.15), fout = Math.min(1, left / 0.25), al = Math.min(fin, fout) * (0.72 + Math.sin(U.t * 5) * 0.12);   // 輕：無框、半透明、慢慢呼吸
        c.globalAlpha = al * 0.7; const pr = (U.t * 1.5) % 1; G.pxEllipse(c, bx0, by0, 12 + pr * 6, 4 + pr * 2, 13); c.globalAlpha = al;
        G.cn(c, lab, Math.round(bx0), ly, 13, 0.5, 0); c.globalAlpha = 1;
      }
    }
    if (U.toast) { const t = U.toast; G.cn(c, t.s, uw / 2, uh * 0.62 - (0.9 - t.t) * 10, t.col || 9, 0.5, 0); }
  }

  // ---------- 鑰匙掉落特效：從擊倒處跳出旋轉 → 拖著光尾飛進左上的鑰匙計數 ----------
  function keyFly(c) {
    const L = W.keyFx; if (!L || !L.length) return;
    const s = G.SPR.i_key, [tx, ty] = U.keyPos || [40, 30];
    for (let i = L.length - 1; i >= 0; i--) {
      const k = L[i]; k.t += M_DT;
      let x, y, sc;
      if (k.t < 0.55) {
        const e = 1 - Math.pow(1 - k.t / 0.55, 3), p = R.worldToScreen(k.x, k.y, k.z + e * 40);
        x = p[0] / R.uiS; y = p[1] / R.uiS; sc = 2 + Math.sin(k.t * 20) * 0.3; k.sx = x; k.sy = y;
        G.pxEllipse(c, x, y + 8, 6 + e * 10, 2 + e * 3, 13);
      } else {
        const f = Math.min(1, (k.t - 0.55) / 0.55), e = f * f, mx = (k.sx + tx) / 2, my = Math.min(k.sy, ty) - 40;
        x = (1 - e) * (1 - e) * k.sx + 2 * (1 - e) * e * mx + e * e * tx; y = (1 - e) * (1 - e) * k.sy + 2 * (1 - e) * e * my + e * e * ty; sc = 2 - f;
        k.tr = k.tr || []; k.tr.push([x, y]); if (k.tr.length > 8) k.tr.shift();
        k.tr.forEach(([qx, qy], j) => { c.fillStyle = P[j % 2 ? 13 : 9]; c.globalAlpha = j / 8; c.fillRect(Math.round(qx), Math.round(qy), 2, 2); }); c.globalAlpha = 1;
        if (f >= 1) { L.splice(i, 1); U.keyBump = 0.3; G.Audio.play('keyGet', 1, 0); continue; }
      }
      for (let j = 0; j < 4; j++) { const a = U.t * 5 + j * 1.57, r = 8 + Math.sin(U.t * 9 + j) * 2; c.fillStyle = P[j % 2 ? 9 : 13]; c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), 1, 1); }
      const spin = Math.abs(Math.cos(k.t * 9)) * 0.85 + 0.15;
      c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(Math.max(0.2, sc * spin), sc); c.drawImage(s.n, -s.w / 2, -s.h / 2); c.restore();
    }
  }
  // ---------- 英雄資訊（點左上頭像）：目前能力值條；之後可擴充裝備欄 ----------
  function heroPanel(c) {
    const h = W.hero, I = R.ins, L = I.l, uw = R.uw, uh = R.uh;
    btn('hpBg', 0, 0, uw, uh, null, () => { U.heroPanel = false; });
    const st = h.st, base = { hp: st.hp, mp: st.mp, power: st.power, armor: st.armor, crit: st.crit, aspd: 1 / st.delay, range: st.range, speed: st.speed };
    const cur = Object.assign({}, base, { power: st.power * (h.iPow || 1) * (h.bPow || 1), armor: st.armor * (h.bArm || 1) + (h.iArm || 0), crit: st.crit + (h.iCrit || 0), aspd: 1 / (st.delay * (h.iDel || 1) * (h.bDel || 1)), speed: st.speed * (h.iSpd || 1) });
    const wide = uw - L - I.r >= 270, mx = G.statMax('hero', h.level), w = wide ? Math.min(uw - L - I.r - 4, 264) : Math.min(uw - L - I.r - 4, 200), nst = base.mp > 0 ? 8 : 7;
    const hh = 20 + Math.ceil((nst + 1) / (w >= 250 ? 2 : 1)) * 12 + 16, x = wide ? Math.round(uw / 2 - w / 2) : L, y = Math.round(G.clamp(wide ? uh / 2 - hh / 2 : I.t + 98, I.t + 2, uh - hh - 2));
    dim(c, 0.6);
    box(c, x, y, w, hh, 1, 7);
    btn('hpIn', x, y, w, hh, null, () => { U.heroPanel = false; });
    G.cn(c, G.nameOf(h.name), x + 6, y + 3, 9); G.text(c, 'LV' + h.level, x + w - 6, y + 6, 13, 1, 0, 1);
    const xf = h.exp / W.expNeed(h);
    G.statBars(c, x + 6, y + 20, w - 12, base, mx, cur, { extra: [{ lab: '經驗', f: xf, txt: Math.floor(xf * 100) + '%', col: 21 }] });   // v2.5 經驗條和其他數值條同長度、同粗細、左右對齊
    G.cn(c, '黃色＝增益中　點一下關閉', x + w / 2, y + hh - 14, 4, 0.5);
  }

  // ---------- v3.14 升級頁（升級時自動打開、或點右上「升級」；打開時戰鬥暫停）----------
  // 每升 1 級：技能點、藥水點各 1。點卡片＝升級；長按＝看說明。點數可以留著之後再用
  U.openLv = auto => {
    if (!W || W.over || U.lvUp) return;
    if (U.aim) U.aim = null; U.hold = null; if (G.Ctl) G.Ctl.joyEnd(); U.bigMap = false; U.statP = false; U.heroPanel = false;
    U.lvUp = { t: 0, auto: !!auto, fl: {}, sp: [] }; G.Audio.play(auto ? 'level' : 'open');
  };
  U.closeLv = () => {
    if (!U.lvUp) return; U.lvUp = null; U.hold = null; G.Audio.play('click');
    const h = W.hero, L = W.lvFx || []; W.lvFx = [];   // 回到戰場後，在英雄身上補播剛剛升級的特效
    if (!h || !h.alive) return;
    L.forEach((q, k) => G.VFX.later(W, k * 0.22, () => {
      if (q.pot) { if (q.pot.k === 'rev') { G.FX.ring(W, h.x, h.y, 4, 40, 0.5, 19, 2); G.VFX.light(W, h.x, h.y, 12, 24, 19, 0.5, 0.7); W.sfx('shield'); } else G.VFX.potion(W, h, Object.assign({}, q.pot, { k: q.pot.k === 'hpPct' ? 'hp' : q.pot.k === 'mpPct' ? 'mp' : q.pot.k, noPop: 1 })); }
      else if (q.sk) { const el = q.sk.passive ? 17 : 13; G.FX.ring(W, h.x, h.y, 3, 30, 0.4, el, 2); G.VFX.spark(W, h.x, h.y, 26, 9, el, 0.25); for (let n = 0; n < 12; n++) W.parts.add(h.x + G.rr(-8, 8), h.y, G.rr(4, 20), 0, 0, G.rr(40, 90), 0.7, el, 9, 1, -10, 0); }
    }));
  };
  // 升級頁版面：直屏＝技能一列、藥水 4 欄；橫屏＝左邊技能 2×2、右邊藥水 6 欄
  function lvLayout() {
    const I = R.ins, uw = R.uw, uh = R.uh, h = W.hero, port = uh > uw, nS = h.skills.length + h.pskills.length, nP = G.POT.length, g = 3;
    const aw = uw - I.l - I.r - 8;
    if (port) {
      const pw = Math.min(aw, 196), cw = Math.min(42, Math.floor((pw - 12 - (Math.max(4, nS) - 1) * g) / Math.max(4, nS))), pc = 4, chS = 36, chP = 40;
      const prow = Math.ceil(nP / pc), ph = 20 + 14 + chS + 8 + 14 + prow * (chP + g) - g + 8 + 20 + 6;
      return { port, pw, ph, cw, chS, chP, g, sc: nS, pc, sx: 6, sy: 34, px: 6, py: 34 + chS + 8 + 14 };
    }
    const pc = 6, sc = 2, cw = Math.min(36, Math.floor((aw - 12 - 8 - (sc - 1) * g - (pc - 1) * g) / (sc + pc))), chS = 34, chP = 38;
    const sw = sc * cw + (sc - 1) * g, pw = 12 + sw + 8 + pc * cw + (pc - 1) * g, prow = Math.ceil(nP / pc), srow = Math.ceil(nS / sc);
    const bodyH = Math.max(srow * (chS + g) - g, prow * (chP + g) - g), ph = 18 + 14 + bodyH + 6 + 20 + 6;
    return { port, pw, ph, cw, chS, chP, g, sc, pc, sx: 6, sy: 32, px: 6 + sw + 8, py: 32 };
  }
  function lvCard(c, id, x, y, w, hh, bd, flash, fn, hold) {
    const o = U.press[id] > 0 ? 1 : 0;
    box(c, x, y + o, w, hh, o ? 3 : 1, bd);
    if (flash > 0) { c.globalAlpha = Math.min(1, flash * 2.5) * 0.7; c.fillStyle = P[flash > 0.25 ? 9 : 13]; c.fillRect(x + 1, y + 1 + o, w - 2, hh - 2); c.globalAlpha = 1; }
    btn(id, x, y, w, hh, () => { U.press[id] = 0.12; U.hold = Object.assign({ id, t: 0, fired: false, x, y, w }, hold); }, () => { if (U.hold && U.hold.fired) return; fn(); });
    return o;
  }
  const pips = (c, cx, y, lv, col) => { const lx = Math.round(cx - 5); for (let k = 0; k < G.SKILL_MAX; k++) { c.fillStyle = P[0]; c.fillRect(lx + k * 3, y, 4, 3); c.fillStyle = P[k < lv ? col : 3]; c.fillRect(lx + 1 + k * 3, y + 1, 2, 1); } };
  function lvBurst(x, y, col) { const L = U.lvUp; for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, sp = G.rr(20, 60); L.sp.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, t: G.rr(0.35, 0.6), col: k % 3 ? col : 9 }); } }
  function lvPage(c) {
    const L = U.lvUp, h = W.hero, uw = R.uw, uh = R.uh, I = R.ins; L.t += M_DT;
    for (const k in L.fl) L.fl[k] -= M_DT;
    const Y = lvLayout(), e = Math.min(1, L.t / 0.22), ee = 1 - Math.pow(1 - e, 3);
    dim(c, 0.72 * ee);
    U.btns = []; btn('lvBg', 0, 0, uw, uh, null, null);
    const pw = Y.pw, ph = Y.ph, x0 = Math.round(uw / 2 - pw / 2), y0 = Math.round(G.clamp(uh / 2 - ph / 2, I.t + 2, Math.max(I.t + 2, uh - I.b - ph - 2)) + (1 - ee) * 16);
    c.globalAlpha = ee;
    box(c, x0, y0, pw, ph, 1, 13);
    // 標題：升級！Lv5 ／ 升級進度 Lv5；右邊經驗條
    const tt = L.auto ? '升級！' : '升級進度'; icon(c, 'i_up', x0 + 9, y0 + 9); const tw = G.cn(c, tt, x0 + 17, y0 + 3, 13);
    G.text(c, 'LV' + h.level, x0 + 17 + tw + 5, y0 + 6, 9, 1);
    { const bw = Math.min(56, pw - 17 - tw - 40 - 30), bx = x0 + pw - bw - 6; if (bw >= 24) { bar(c, bx, y0 + 7, bw, 3, h.exp / W.expNeed(h), 'xp'); G.text(c, 'XP', bx - 11, y0 + 6, 21, 1); } }
    // 技能區
    const lab = (t, n, x, y) => { const w0 = G.cn(c, t, x, y, 9); G.cn(c, '點數', x + w0 + 6, y, 6); G.text(c, n, x + w0 + 6 + G.cnW('點數') + 4, y + 3, n > 0 ? 13 : 5, 1); };
    lab('技能', h.sp || 0, x0 + Y.sx, y0 + (Y.port ? 20 : 18));
    const sks = [...h.skills, ...h.pskills];
    sks.forEach((s, k) => {
      const col = k % Y.sc, row = (k / Y.sc) | 0, x = x0 + Y.sx + col * (Y.cw + Y.g), y = y0 + Y.sy + row * (Y.chS + Y.g), id = 'lvS' + k;
      const can = W.canLevel(s), mx = s.lv >= G.SKILL_MAX, req = mx ? 0 : G.skillReq(s.s, s.lv + 1), blink = ((U.t * 3) | 0) % 2;
      const bd = s.passive ? 17 : can ? (blink ? 13 : 14) : mx ? 13 : 4;
      const o = lvCard(c, id, x, y, Y.cw, Y.chS, bd, L.fl[id] || 0, () => {
        if (s.passive) { deny(id); U.toastMsg('被動會隨英雄等級自動升級', 17); return; }
        if (W.levelSkill(s, true)) { L.fl[id] = 0.45; (W.lvFx = W.lvFx || []).push({ sk: s, lv: s.lv }); lvBurst(x + Y.cw / 2, y + 10, 13); G.Audio.play('level'); return; }
        deny(id); U.toastMsg(mx ? '已經滿級' : !(h.sp > 0) ? '沒有技能點了' : '英雄 Lv' + req + ' 才能升級', 7);
      }, { s });
      icon(c, s.icon, x + Y.cw / 2, y + 10 + o, !s.lv);
      pips(c, x + Y.cw / 2, y + 19 + o, s.lv, s.passive ? 17 : 13);
      const st = s.passive ? ['自動', 17] : can ? ['升級', blink ? 13 : 14] : mx ? ['滿級', 13] : null;
      if (st) G.cn(c, st[0], x + Y.cw / 2, y + Y.chS - 13 + o, st[1], 0.5);
      else G.text(c, 'LV' + req, x + Y.cw / 2, y + Y.chS - 9 + o, 5, 1, null, 0.5);
    });
    // 藥水區
    const pY = Y.py - 14; lab('藥水', h.pp || 0, x0 + Y.px, y0 + pY);
    G.POT.forEach((it, k) => {
      const col = k % Y.pc, row = (k / Y.pc) | 0, x = x0 + Y.px + col * (Y.cw + Y.g), y = y0 + Y.py + row * (Y.chP + Y.g), id = 'lvP' + k;
      const lv = W.pot[it.id] || 0, mx = lv >= G.POT_MAX, can = W.canPot(it.id);
      const o = lvCard(c, id, x, y, Y.cw, Y.chP, mx ? 13 : can ? 6 : 4, L.fl[id] || 0, () => {
        if (W.upPot(it.id)) { L.fl[id] = 0.45; lvBurst(x + Y.cw / 2, y + 8, it.col); G.Audio.play('level'); return; }
        deny(id); U.toastMsg(mx ? '已經滿級' : '沒有藥水點了', 7);
      }, { pot: it });
      if (!lv && !can) c.globalAlpha *= 0.4; icon(c, it.ic, x + Y.cw / 2, y + 8 + o); c.globalAlpha = Math.min(1, ee);   // 藥水圖示沒有暗色版 → 用半透明
      G.cn(c, it.e, x + Y.cw / 2, y + 14 + o, lv ? 9 : 6, 0.5);
      pips(c, x + Y.cw / 2, y + 27 + o, lv, it.col === 9 ? 13 : it.col);
      const vt = it.k === 'rev' ? (W.rev > 0 ? 'X' + W.rev : '') : lv ? G.potVal(it, lv) : '';
      if (vt) G.text(c, vt, x + Y.cw / 2, y + 32 + o, lv ? 9 : 5, 1, null, 0.5);
    });
    // 繼續戰鬥
    const bw = Math.min(120, pw - 12), bx = Math.round(x0 + pw / 2 - bw / 2), by = y0 + ph - 26, done = !W.lvChoices(), ob = U.press.lvGo > 0 ? 1 : 0;
    U.h.key(c, bx, by + ob, bw, 20, ob, done ? 13 : 7, done ? 2 : 1); G.cn(c, '繼續戰鬥', bx + bw / 2, by + 4 + ob, done ? 13 : 9, 0.5);
    btn('lvGo', bx, by, bw, 20, () => { U.press.lvGo = 0.12; }, () => U.closeLv());
    c.globalAlpha = 1;
    // 點擊光點
    for (let k = L.sp.length - 1; k >= 0; k--) { const q = L.sp[k]; q.t -= M_DT; if (q.t <= 0) { L.sp.splice(k, 1); continue; } q.x += q.vx * M_DT; q.y += q.vy * M_DT; q.vy += 120 * M_DT; c.fillStyle = P[q.col]; c.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
    // 長按：技能卡／藥水卡
    if (U.hold && U.hold.fired) { if (U.hold.s) skillCard(c, U.hold.s, U.hold.x + U.hold.w, U.hold.y + 4); else if (U.hold.pot) potCard(c, U.hold.pot, U.hold.x, U.hold.y); }
  }
  // 藥水資訊卡：名稱、說明、1～3 級的效果（目前等級亮黃）
  function potCard(c, it, ax, ay) {
    const lv = W.pot[it.id] || 0, w = Math.min(it.k === 'rev' ? 184 : 160, R.uw - R.ins.l - R.ins.r - 8);
    const head = it.k === 'rev' ? G.cnWrapRich('每升 1 級存 1 次復活。' + G.potTxt(it, 1), w - 12) : [];
    const rows = it.k === 'rev' ? [] : [1, 2, 3].map(k => ['Lv' + k, G.cnWrapRich(G.potTxt(it, k), w - 38)]);
    const hh = 22 + head.length * 13 + rows.reduce((a2, r2) => a2 + r2[1].length * 13, 0) + 8 + (it.k === 'rev' ? 13 : 0);
    const x = Math.round(G.clamp(ax - w / 2 + 18, R.ins.l + 2, R.uw - R.ins.r - w - 2)), y = Math.round(G.clamp(ay - hh - 6, R.ins.t + 2, R.uh - hh - 2));
    dim(c, 0.6); box(c, x, y, w, hh, 1, it.col === 9 ? 7 : it.col);
    icon(c, it.ic, x + 11, y + 10); G.cn(c, it.n, x + 22, y + 3, 9); G.cn(c, lv ? 'Lv ' + lv + '/3' : '未升級', x + w - 6, y + 3, 6, 1);
    let yy = y + 20;
    head.forEach(l => { G.cnRich(c, l, x + 6, yy, 7); yy += 13; });
    if (it.k === 'rev') { G.cn(c, '目前存了 ' + (W.rev || 0) + ' 次', x + 6, yy, 13); yy += 13; }
    rows.forEach(([a, ls], k) => { const on = k + 1 === lv; G.cn(c, a, x + 6, yy, on ? 13 : 5); ls.forEach(l => { G.cnRich(c, l, x + 32, yy, on ? 9 : 6); yy += 13; }); });
  }
  // ---------- 暫停 ----------
  function pause(c) {
    const uw = R.uw, uh = R.uh;
    if (G.Ctl.ed) { G.Ctl.drawEd(c); return; }                                       // v3.14 自訂按鈕位置
    dim(c, 0.7);
    // 每個按鈕都有圖示＋名稱
    // v3.10 「這場不計入排行」改成按了重新開始／回首頁之後才跳確認（Pai：直接寫在暫停裡很冗）
    const ranked = !G.Team.dev && W && !W.over && !W.attract, leave = (k, fn) => () => { if (ranked) { U.leaveAsk = k; G.Audio.play('open'); } else fn(); };
    if (U.leaveAsk) return leaveAsk(c);
    if (U.ctlOpen) return setPanel(c);
    const items = [['i_play', '繼續', () => { U.paused = false; }], ['i_guide', '教學', () => G.Menus.openGuide(true)], ['i_gear', '設定', () => { U.ctlOpen = true; }], ['i_retry', '重新開始', leave('retry', () => U.start(U.hero))],
      ['i_tree', '回首頁', leave('home', () => U.goTitle())]];
    const bw = Math.max(Math.max(...items.map(q => G.cnW(q[1]))) + 34, Math.min(150, uw - R.ins.l - R.ins.r - 16)), bh = 20, gap = 4;
    const tot = 18 + items.length * (bh + gap) - gap;
    const x = Math.round(uw / 2 - bw / 2); let y = Math.round(uh / 2 - tot / 2);
    G.cn(c, '暫停', uw / 2, y, 9, 0.5); y += 18;
    items.forEach(([ic, lab, fn], i) => {
      const id = 'pm' + i, o = U.press[id] > 0 ? 1 : 0;
      U.h.key(c, x, y + o, bw, bh, o, i === 0 ? 13 : 7); icon(c, ic, x + 11, y + 10 + o); G.cn(c, lab, x + 22, y + 4 + o, i === 0 ? 13 : 9);
      btn(id, x, y, bw, bh, () => { U.press[id] = 0.12; G.Audio.play('click'); }, fn);
      y += bh + gap;
    });
  }
  // v3.14 戰鬥中設定：音量、移動方式、自訂按鈕位置
  function setPanel(c) {
    const uw = R.uw, uh = R.uh, I = R.ins, w = Math.min(uw - I.l - I.r - 12, 200), iw = w - 12, mh = G.Ctl.moveRowH(iw);
    const hh = 22 + 44 + 6 + mh + 6 + 20 + 6 + 20 + 6, x = Math.round(uw / 2 - w / 2); let y = Math.round(G.clamp(uh / 2 - hh / 2, I.t + 2, Math.max(I.t + 2, uh - I.b - hh - 2)));
    btn('spBg', 0, 0, uw, uh, null, null);
    box(c, x, y, w, hh, 1, 7); icon(c, 'i_gear', x + 10, y + 10); G.cn(c, '設定', x + 18, y + 4, 9);
    y += 22; box(c, x + 6, y, iw, 44, 1, 4, false); U.volPanel(c, x + 8, y + 2, iw - 4); y += 44 + 6;
    G.Ctl.moveRow(c, x + 6, y, iw); y += mh + 6;
    const b2 = (id, lab, col, fn) => { const o = U.press[id] > 0 ? 1 : 0; U.h.key(c, x + 6, y + o, iw, 20, o, col); G.cn(c, lab, x + 6 + iw / 2, y + 4 + o, col === 13 ? 13 : 9, 0.5); btn(id, x + 6, y, iw, 20, () => { U.press[id] = 0.12; G.Audio.play('click'); }, fn); y += 26; };
    b2('spLay', '自訂按鈕位置', 7, () => G.Ctl.openEd());
    b2('spBack', '返回', 13, () => { U.ctlOpen = false; });
  }
  // 離開確認：這場還沒打完 → 不會計入排行
  function leaveAsk(c) {
    const uw = R.uw, uh = R.uh, k = U.leaveAsk, home = k === 'home';
    const PW = Math.min(uw - R.ins.l - R.ins.r - 12, 190), iw = PW - 16, title = home ? '要回首頁嗎？' : '要重新開始嗎？';
    const lines = ['這場還沒打完，', '成績不會計入排行榜。'].flatMap(t => G.cnWrap(t, iw)), bh = 20;   // 斷在逗號後，手機上不會斷在詞中間
    const tot = 8 + 14 + 6 + lines.length * 13 + 8 + bh + 8, x = Math.round(uw / 2 - PW / 2); let y = Math.round(uh / 2 - tot / 2);
    btn('lvBg', 0, 0, uw, uh, null, () => { });                                       // 擋住後面的按鈕
    box(c, x, y, PW, tot, 1, 13); y += 8;
    G.cn(c, title, uw / 2, y, 13, 0.5); y += 14 + 6;
    lines.forEach((l, i) => G.cn(c, l, uw / 2, y + i * 13, 7, 0.5)); y += lines.length * 13 + 8;
    const g = 6, w2 = Math.floor((iw - g) / 2), bx = x + 8;
    const b2 = (id, lab, xx, col, fn) => { const o = U.press[id] > 0 ? 1 : 0; U.h.key(c, xx, y + o, w2, bh, o, col); G.cn(c, lab, xx + w2 / 2, y + 4 + o, col === 13 ? 13 : 9, 0.5); btn(id, xx, y, w2, bh, () => { U.press[id] = 0.12; G.Audio.play('click'); }, fn); };
    b2('lvNo', '取消', bx, 7, () => { U.leaveAsk = null; });
    b2('lvYes', home ? '回首頁' : '重新開始', bx + w2 + g, 13, () => { U.leaveAsk = null; home ? U.goTitle() : U.start(U.hero); });
  }
  // ---------- 結算 ----------
  // 評價：依擊殺、助攻、推塔、野生首領、首領、陣亡、勝負計分（門檻暫定）
  U.grade = (st, win) => {
    const sc = st.kills * 2 + st.assists + st.towers * 6 + st.camps * 2 + (st.bosses || 0) * 5 - st.deaths * 4 + (win ? 25 : 0) + Math.min(20, st.dmg / 2000);
    const G2 = [[160, 'S', 14], [110, 'A', 13], [70, 'B', 11], [35, 'C', 12], [-1e9, 'D', 6]].find(q => sc >= q[0]);
    return { s: Math.round(sc), g: G2[1], col: G2[2] };
  };
  // 本場亮點（最多 2 個）
  const highlights = st => [[st.deaths === 0 && st.time > 300, '不死之身', 11], [st.towers >= 5, '推塔王', 14], [st.kills >= 30, '收割者', 10], [st.assists >= 15, '神助攻', 18], [(st.bosses || 0) >= 3, '首領剋星', 12], [(st.potMax || 0) >= 3, '三管齊下', 13]].filter(q => q[0]).slice(0, 2);
  function end(c) {
    // v2.4：數值用遊戲結束那一刻的快照（W.overSt），背景戰鬥繼續也不會再變；節奏放慢、一組一組出現；點畫面可跳到最後
    const uw = R.uw, uh = R.uh, I = R.ins, win = W.over.win, st = W.overSt || W.stats, h = W.hero;
    if (U.endW !== W) { U.endW = W; U.endT = 0; U.endParts = []; U.endSnd = {}; U.endGr = U.grade(st, win); U.endQuiet = false; U.endCnt = {}; }
    const TK = { sub: 0.7, hero: 1.1, kda: 1.7, rows: 2.9, row: 0.45, grade: 6.0, rw: 6.8, btn: 7.4 };
    const t = (U.endT += M_DT), a = G.clamp(t * 2.5, 0, 1), gr = U.endGr, snd = k => { if (!U.endSnd[k]) { U.endSnd[k] = 1; return !U.endQuiet; } return false; };
    if (t < TK.btn) btn('endSkip', 0, 0, uw, uh, null, () => { U.endT = TK.btn; U.endQuiet = true; G.Audio.play('cntDone'); });   // 點一下跳到最後
    dim(c, a * 0.82);
    // 勝利：落葉彩帶
    if (win && U.endParts.length < 60 && t < 5) U.endParts.push({ x: Math.random() * uw, y: -4, vy: G.rr(20, 45), vx: G.rr(-8, 8), r: Math.random() * 6, c: G.pick([11, 13, 16, 9, 14]) });
    for (const p of U.endParts) { p.y += p.vy * M_DT; p.x += (p.vx + Math.sin(t * 3 + p.r) * 10) * M_DT; if (p.y < uh + 4) { c.fillStyle = P[p.c]; c.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); c.fillRect(Math.round(p.x) + (((t * 4 + p.r) | 0) % 2), Math.round(p.y) + 1, 2, 1); } }
    if (t < 0.15) return;
    const LD = uw > uh * 1.15, PW = Math.min(uw - I.l - I.r - 4, LD ? 320 : 176), px = Math.round(uw / 2 - PW / 2);
    // ── 橫幅：VICTORY / DEFEAT（落下＋彈一下）
    const word = win ? 'VICTORY' : 'DEFEAT', sc = LD ? 3 : 3, tw = G.textW(word) * sc, k0 = G.clamp((t - 0.15) / 0.35, 0, 1);
    const by0 = I.t + 3, drop = Math.round((1 - k0) * (1 - k0) * -40 + Math.sin(k0 * Math.PI) * 3);
    const rb = win ? 13 : 15, rbw = Math.min(PW, tw + 40), rbx = Math.round(uw / 2 - rbw / 2), rbh = 5 * sc + 8;
    c.fillStyle = P[0]; c.fillRect(rbx - 1, by0 + drop - 1, rbw + 2, rbh + 2);
    c.fillStyle = P[rb]; c.fillRect(rbx, by0 + drop, rbw, rbh); c.fillStyle = P[win ? 14 : 1]; c.fillRect(rbx, by0 + drop + rbh - 2, rbw, 2);
    for (let k = 0; k < 4; k++) { c.fillStyle = P[0]; c.fillRect(rbx + k, by0 + drop + 4 + k, 1, rbh - 8 - k * 2); c.fillRect(rbx + rbw - 1 - k, by0 + drop + 4 + k, 1, rbh - 8 - k * 2); }   // 緞帶尾端缺口
    G.text(c, word, uw / 2 + 1, by0 + drop + 5, 0, sc, null, 0.5); G.text(c, word, uw / 2, by0 + drop + 4, win ? 0 : 9, sc, null, 0.5);
    if (k0 >= 1 && snd('ban')) { G.Audio.play('snap'); G.Audio.play(win ? 'endWin' : 'endLose'); }
    let y = by0 + rbh + 4;
    const sub = win ? '敵方聖所已摧毀！' : '我方聖樹倒下了……';
    c.globalAlpha = G.clamp((t - TK.sub) / 0.3, 0, 1); G.cnWrap(sub, PW).forEach(l => { G.cn(c, l, uw / 2, y, win ? 13 : 7, 0.5); y += 13; }); c.globalAlpha = 1; y += 3;
    if (t < TK.sub) return;
    // 兩欄（橫屏）或單欄（直屏）
    const colL = LD ? Math.round(PW * 0.34) : PW, lx = px, rx = LD ? px + colL + 8 : px, rw = LD ? PW - colL - 8 : PW;
    let yl = y, yr = y;
    // ── 英雄＋評價
    if (t >= TK.hero) {
      if (snd('hero')) G.Audio.play('rowIn');
      const fr = G.SPR[G.VIS[h.name].spr], f = fr[win ? ((t * 6) | 0) % fr.length : 0], img = G.scaled(f.n, 2), hx = lx + 4, hy = yl + 34;
      const jy = win ? -Math.round(Math.abs(Math.sin(t * 5)) * 3) : 0;
      G.pxDisc(c, hx + img.width / 2, hy, img.width * 0.35, 3, 0, 0.6);
      c.drawImage(img, hx, hy - img.height + jy);
      if (!win) { c.globalAlpha = 0.55; c.drawImage(G.scaled(G.glowOf(f.n, 0, 1, 2).tint, 2), hx, hy - img.height); c.globalAlpha = 1; }
      const nx = hx + img.width + 6, tt = st.time | 0;
      G.cn(c, G.cnWrap(G.nameOf(h.name), colL - (nx - lx) - 30)[0], nx, yl + 4, 9);
      G.text(c, 'LV' + (st.lv || h.level), nx, yl + 18, 13); icon(c, 'i_clock', nx + 3, yl + 30); G.text(c, String((tt / 60) | 0) + ':' + String(tt % 60).padStart(2, '0'), nx + 9, yl + 28, 7);
      // 評價章（所有數據跳完後才蓋章）
      const gk = G.clamp((t - TK.grade) / 0.18, 0, 1);
      if (gk > 0) {
        if (snd('gr')) { G.Audio.play('stamp'); U.endShake = 0.35; }
        const gs = Math.round(3 + (1 - gk) * 3), gx = lx + colL - 13, gy2 = yl + 18, rr = 12 + Math.round((1 - gk) * 6);
        c.fillStyle = P[0]; c.fillRect(gx - rr - 1, gy2 - rr - 1, rr * 2 + 2, rr * 2 + 2);
        c.fillStyle = P[gr.col]; c.fillRect(gx - rr, gy2 - rr, rr * 2, rr * 2); c.fillStyle = P[1]; c.fillRect(gx - rr + 2, gy2 - rr + 2, rr * 2 - 4, rr * 2 - 4);
        G.text(c, gr.g, gx + 1, gy2 - Math.round(gs * 2.5) + 1, 0, gs, null, 0.5); G.text(c, gr.g, gx, gy2 - Math.round(gs * 2.5), gr.col, gs, null, 0.5);
        if (gk >= 1) G.cn(c, '評價', gx, gy2 + rr + 1, 6, 0.5);
      }
    }
    yl += 50;
    if (!LD) yr = yl;
    // ── 數字跳動：跳的過程有細碎的刻度聲，跳完「叮」一聲
    const cnt = (v, t0, key, D = 0.8) => { const k = G.clamp((t - t0) / D, 0, 1), n = Math.round(v * (1 - Math.pow(1 - k, 3))); if (!U.endQuiet && v > 0 && k < 1 && U.endCnt[key] !== n) G.Audio.play('cnt'); U.endCnt[key] = n; if (k >= 1 && snd('d' + key)) G.Audio.play('cntDone'); return n; };
    // ── K / D / A（一組一起出現）
    if (t >= TK.kda) { const kw = Math.floor((rw - 8) / 3);
      if (snd('kda')) G.Audio.play('rowIn');
      [['擊殺', st.kills, 13], ['陣亡', st.deaths, 10], ['助攻', st.assists, 18]].forEach(([lab, v, col], i) => {
        const t0 = TK.kda + 0.15;
        const bx = rx + i * (kw + 4); box(c, bx, yr, kw, 28, 0, 4, false);
        G.text(c, cnt(v, t0, 'k' + i), bx + kw / 2, yr + 4, col, 2, null, 0.5); G.cn(c, lab, bx + kw / 2, yr + 14, 6, 0.5);
      }); }
    yr += 32;
    // ── 其他數據（兩欄，數字跳動）
    { const vals = [st.towers, st.bosses || 0, st.wboss || 0, st.potUp || 0, Math.round(st.dmg), Math.round(st.taken)], vw = Math.max(...vals.map(v => G.cnW(String(v))));
      const long = ['推倒敵塔', '擊倒首領', '野生首領', '升級藥水', '造成傷害', '承受傷害'], short = ['推塔', '首領', '野王', '藥水', '輸出', '承傷'];
      const labs = LD && Math.floor((rw - 6) / 2) < 52 + vw + 4 ? short : long, rows = labs.map((l, i) => [l, vals[i]]);   // 橫屏放不下兩欄 → 用短標籤
      const need = Math.max(...rows.map(q => G.cnW(q[0]))) + Math.max(...rows.map(q => G.cnW(String(q[1])))) + 4, cols = Math.floor((rw - 6) / 2) >= need ? 2 : 1, nr = Math.ceil(rows.length / cols), cw = Math.floor((rw - (cols - 1) * 6) / cols);   // 兩欄放不下就改一欄
      rows.forEach(([lab, v], i) => {
        const t0 = TK.rows + i * TK.row; if (t < t0) return; if (snd('r' + i)) G.Audio.play('rowIn');
        const col = (i / nr) | 0, r = i % nr, xx = rx + col * (cw + 6), yy = yr + r * 13;
        if (r % 2 === 0) { c.fillStyle = P[1]; c.fillRect(xx - 2, yy - 1, cw + 4, 13); }
        c.globalAlpha = G.clamp((t - t0) / 0.2, 0, 1); G.cn(c, lab, xx, yy, 6); G.cn(c, String(cnt(v, t0 + 0.1, 'r' + i, 0.5)), xx + cw, yy, 9, 1); c.globalAlpha = 1;
      }); yr += nr * 13 + 4; }
    if (!LD) yl = yr;
    // ── 獎勵：鑰匙、成就、亮點
    if (t > TK.rw) {
      const kg = st.keys != null ? st.keys : (W.keysGot || 0), ach = (G.Ach && G.Ach.recent) || [];
      if (snd('rw')) G.Audio.play(kg ? 'keyGet' : 'tick');
      icon(c, 'i_key', lx + 6, yl + 6); G.cn(c, '鑰匙 +' + kg, lx + 14, yl, kg ? 13 : 6);
      const hl = highlights(st); let hx2 = lx + 14 + G.cnW('鑰匙 +' + kg) + 8;
      hl.forEach(([, s2, col]) => { const w2 = G.cnW(s2) + 6; if (hx2 + w2 > lx + colL) return; c.fillStyle = P[0]; c.fillRect(hx2, yl, w2, 13); c.fillStyle = P[col]; c.fillRect(hx2, yl, w2, 1); c.fillRect(hx2, yl + 12, w2, 1); c.fillRect(hx2, yl, 1, 13); c.fillRect(hx2 + w2 - 1, yl, 1, 13); G.cn(c, s2, hx2 + 3, yl, col); hx2 += w2 + 3; });
      yl += 16;
      const sr = W.soloRes; if (sr && sr.win) {                                // v3.0 關卡星等與獎勵（v3.4 橫屏放右欄數據下方，左欄留給成就）
        const bx0 = LD ? rx : lx, cW = LD ? rw : colL, bTop = uh - I.b - 18 - 4; let by0 = LD ? yr : yl;
        G.Solo.stars(c, bx0 + 2, by0 + 2, sr.stars, 3, 9);
        const txt = sr.rew ? (sr.first ? '首次通關 ' : '新星等 ') + '+' + sr.rew : G.Team.dev ? '不計獎勵' : '已拿過這個星等', one = G.cnW(txt) + (sr.rew ? 14 : 0) <= cW - 40;
        const tx = one ? bx0 + 40 : bx0 + 2, ty = one ? by0 : by0 + 14;
        if (sr.rew) icon(c, 'i_key', tx + 6, ty + 6);
        const ls = G.cnWrap(txt, cW - (tx - bx0) - (sr.rew ? 14 : 0)); ls.forEach((l, i) => G.cn(c, l, tx + (sr.rew ? 14 : 0), ty + i * 13, sr.rew ? 13 : 6));
        by0 = ty + ls.length * 13 + (LD ? 1 : 3);
        if (sr.unlock && (!LD || by0 + 13 <= bTop)) {                                                     // v3.4 解鎖新關卡
          const ul = G.cnWrap('解鎖新關卡「' + G.SOLO[sr.unlock - 1].n + '」', cW - 16), bl = ((t * 3) | 0) % 2;
          icon(c, 'i_play', bx0 + 6, by0 + 6); ul.forEach((l, i) => G.cn(c, l, bx0 + 14, by0 + i * 13, bl ? 13 : 14)); by0 += ul.length * 13 + 3;
        }
        if (LD) yr = by0; else yl = by0;
      }
      if (ach.length) {
        icon(c, 'i_trophy', lx + 6, yl + 6); G.cn(c, '成就達成 ×' + ach.length, lx + 14, yl, 13); yl += 14;
        const tip = n2 => (n2 > 0 ? '還有 ' + n2 + ' 個，' : '') + '到「成就」領取', tipH = G.cnWrap(tip(ach.length), colL - 8).length * 13;
        const room = (LD ? uh - I.b - 22 : uh - I.b - 30) - yl - tipH, show = ach.slice(0, G.clamp(Math.floor(room / 13), 0, 3));   // 放得下幾行就列幾個
        show.forEach((id, i) => { G.cnWrap('・' + G.ACH_BY[id].n, colL - 8).slice(0, 1).forEach(l => G.cn(c, l, lx + 8, yl + i * 13, 9)); });
        yl += show.length * 13;
        const more = ach.length - show.length; G.cnWrap(tip(more), colL - 8).forEach(l => { G.cn(c, l, lx + 8, yl, 6); yl += 13; }); yl += 1;
      } else if (G.Team.dev) { G.cn(c, '開發者模式不記錄成就', lx + 2, yl, 6); yl += 14; }
    }
    // ── 按鈕（文字＋圖示）
    if (t >= TK.btn) {
      const bh = 18, by = LD ? uh - I.b - bh - 2 : Math.min(uh - I.b - bh - 2, Math.max(yl, yr) + 8), bw = Math.floor((PW - 6) / 2);
      const hi = W.soloRes && W.soloRes.unlock ? 1 : 0;                         // v3.4 解鎖新關卡：改成「選擇關卡」閃黃框
      [['i_retry', '再來一局', () => U.start(U.hero), 7], W.stageI ? ['i_play', '選擇關卡', () => { U.goTitle(); G.Solo.open(); }, 7] : ['i_tree', '回首頁', () => U.goTitle(), 7]].forEach(([ic, lab, fn, col], i) => {
        const x = px + i * (bw + 6), id = 'end' + i, o = U.press[id] > 0 ? 1 : 0, on = i === hi;
        if (on) { c.fillStyle = P[Math.sin(t * 6) > 0 ? 13 : 14]; c.fillRect(x - 1, by - 1 + o, bw + 2, bh + 2); }
        U.h.key(c, x, by + o, bw, bh, o, on ? 0 : col, on ? 13 : 1);
        const lw = G.cnW(lab) + 14, sx = Math.round(x + bw / 2 - lw / 2);
        icon(c, ic, sx + 5, by + 9 + o, on); G.cn(c, lab, sx + 14, by + 3 + o, on ? 0 : 9);
        btn(id, x, by, bw, bh, () => { U.press[id] = 0.12; G.Audio.play('click'); }, fn);
      });
    }
  }

  U.draw = function (dt) {
    W = G.W; U.t += dt; U.btns = []; M_DT = dt;
    if (U.hold) { U.hold.t += dt; if (!U.hold.fired && U.hold.t >= LP) { U.hold.fired = true; G.Audio.play('tick'); } }
    for (const k in U.press) U.press[k] -= dt;
    for (const k in U.shakeB) U.shakeB[k] -= dt;
    if (U.toast) { U.toast.t -= dt; if (U.toast.t <= 0) U.toast = null; }
    if ((U.paused || U.lvUp || U.screen !== 'battle') && G.Ctl) G.Ctl.joyEnd();
    const c = R.uctx; c.clearRect(0, 0, R.uw, R.uh); c.imageSmoothingEnabled = false; R.hi = [];
    if (G.Dom) G.Dom.begin();
    if (G.Menus && G.Menus[U.screen]) G.Menus[U.screen](c);
    else {
      if (W.lvOpen && !U.paused && !U.lvUp && !W.over && U.screen === 'battle') { W.lvOpen = false; U.openLv(true); }   // v3.14 升級：暫停並打開升級頁
      if (!(W.over && W.over.t > 1.6)) hud(c);
      if (W.over && W.over.t > 1.6) { U.lvUp = null; end(c); }
      else if (U.paused) { U.btns = []; pause(c); }
      else if (U.lvUp) lvPage(c);
    }
    if (G.Ach && G.Ach.drawBanner) G.Ach.drawBanner(c);
    if (G.Mail) G.Mail.drawCast(c, M_DT);                                         // v3.2 系統公告跑馬燈
    G.Trans.draw(c, M_DT);
    if (G.StageGo) G.StageGo.draw(c, M_DT);
    if (G.Dom) G.Dom.end();
    if (U.showFps) G.text(c, Math.round(U.fps) + 'FPS', R.uw / 2, R.ins.t + 2, 4, 1, null, 0.5);
  };

  // ---------- 場景轉場（v2.3）----------
  // 首頁按鈕：按鈕左右交錯撥開（像撥開草叢，葉片飛散）→ 黑幕收合 → 切換場景 → 圓形光圈由中心展開（經典 iris 轉場）
  const easeIO = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  G.Trans = {
    ph: null, t: 0, leaves: [],
    PART: 0.3, CLOSE: 0.14, OPEN: 0.45,
    start(fn, part = true) {
      if (this.ph) return;
      this.fn = fn; this.ph = part ? 'part' : 'close'; this.t = 0; G.Audio.play('swoosh');
      if (part) for (let i = 0; i < 26; i++) { const d = i % 2 ? 1 : -1; this.leaves.push({ x: R.uw / 2 + G.rr(-50, 50), y: R.uh * G.rr(0.45, 0.85), vx: d * G.rr(80, 220), vy: G.rr(-90, 10), r: Math.random() * 6, vr: G.rr(-10, 10), l: G.rr(0.5, 0.9), col: Math.random() < 0.6 ? 11 : Math.random() < 0.5 ? 16 : 20 }); }
    },
    reveal() { if (!this.ph) { this.ph = 'open'; this.t = 0; } },          // 只播「光圈展開」（例：從子畫面回首頁）
    part() { return this.ph === 'part' ? easeIO(Math.min(1, this.t / this.PART)) : this.ph === 'close' ? 1 : 0; },
    busy() { return !!this.ph && this.ph !== 'open'; },
    draw(c, dt) {
      const uw = R.uw, uh = R.uh;
      if (this.ph) {
        this.t += Math.min(dt, 0.05);
        U.btns.push({ id: 'trans', x: -10, y: -10, w: uw + 20, h: uh + 20 });            // 轉場中吃掉所有點擊
        if (this.ph === 'part' && this.t >= this.PART) { this.ph = 'close'; this.t = 0; }
        if (this.ph === 'close') {
          const k = Math.min(1, this.t / this.CLOSE); c.fillStyle = 'rgba(10,10,10,' + k.toFixed(3) + ')'; c.fillRect(0, 0, uw, uh);
          if (k >= 1) { const f = this.fn; this.fn = null; this.ph = 'open'; this.t = 0; if (f) f(); }
        } else if (this.ph === 'open') {
          const k = Math.min(1, this.t / this.OPEN), e = 1 - Math.pow(1 - k, 3), rr = Math.hypot(uw, uh) / 2 + 4, r = Math.round(rr * e);
          if (R.hi && k < 0.85) for (const q of R.hi) q.cov = true;                     // 原生解析度圖層等光圈開完再顯示
          c.fillStyle = P[0]; c.beginPath(); c.rect(0, 0, uw, uh); if (r > 0) c.arc(Math.round(uw / 2), Math.round(uh / 2), r, 0, Math.PI * 2, true); c.fill('evenodd');
          if (r > 2) { c.strokeStyle = P[13]; c.globalAlpha = 1 - k; c.lineWidth = 1; c.beginPath(); c.arc(Math.round(uw / 2), Math.round(uh / 2), r, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }   // 光圈邊緣一圈淡淡的金光
          if (k >= 1) this.ph = null;
        }
      }
      for (let i = this.leaves.length - 1; i >= 0; i--) {                              // 撥開時飛散的葉片
        const q = this.leaves[i]; q.l -= dt; if (q.l <= 0) { this.leaves.splice(i, 1); continue; }
        q.vy += 260 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt;
        const w2 = Math.abs(Math.cos(q.r)) > 0.5 ? 3 : 2; c.fillStyle = P[q.col]; c.fillRect(Math.round(q.x), Math.round(q.y), w2, 5 - w2); c.fillStyle = P[0]; c.fillRect(Math.round(q.x), Math.round(q.y) + 5 - w2, w2, 1);
      }
    }
  };

  // ---------- 輸入 ----------
  const ptrs = new Map(); let pinch = null;
  const toUI = (x, y) => [x / R.uiS, y / R.uiS];
  const evXY = e => [(e.clientX - (R.cssX || 0)) * R.dpr, (e.clientY - (R.cssY || 0)) * R.dpr];
  // 點選單位：ally=false 找敵人（含中立）；ally='tower' 找我方塔／聖樹
  function pickUnit(sx, sy, ally, padX) {
    const [ax, ay] = R.scrToBuf(sx, sy);                             // 與 unitBox 同為緩衝區座標（v3.2.2 含透視）
    let best = null, bd = 1e9;
    for (const u of W.units) {
      if (!u.alive || !W.seen(0, u)) continue;
      if (ally === 'tower' ? !(u.side === 0 && (u.kind === 'tower' || u.kind === 'holy')) : ally ? !(u.side === 0 && (u.kind === 'creep' || u.kind === 'boss')) : u.side === 0) continue;
      const [bx, by, bw, bh] = R.unitBox(u), pad = padX != null ? padX : ally ? 4 : 7;
      if (ax < bx - pad || ax > bx + bw + pad || ay < by - pad || ay > by + bh + pad) continue;
      const d = G.d2(ax, ay, bx + bw / 2, by + bh / 2) + (ally ? 30 : 0); if (d < bd) { bd = d; best = u; }
    }
    return best ? [best, bd] : null;
  }
  function worldTap(sx, sy, quiet) {
    const e = quiet ? null : pickUnit(sx, sy, false);
    const t = e && e[0];
    if (t) { W.cmdLock(t); return 'lock'; }                 // 點到敵人／塔／首領 → 鎖定
    const tw = quiet ? null : pickUnit(sx, sy, 'tower');    // 點到我方塔／聖樹 → 傳送（要點兩下確認）
    if (tw) {
      const e2 = pickUnit(sx, sy, false, 18);               // 塔旁邊有敵人：放寬判定，優先鎖定敵人
      if (e2) { W.cmdLock(e2[0]); return 'lock'; }
      const h = W.hero, far = h && h.alive && Math.hypot(tw[0].x - h.x, tw[0].y - h.y) >= G.TUNE.tp.minDist;
      if (far) {
        const a = U.tpAsk;
        if (a && a.u === tw[0] && U.t - a.t < G.TUNE.tp.ask) { U.tpAsk = null; if (W.startTeleport(tw[0])) return 'tp'; }
        U.tpAsk = { u: tw[0], t: U.t }; G.Audio.play('tick');   // 第一下：顯示「再點一下傳送」，英雄照常走過去
      }
    }
    const [wx, wy] = R.screenToWorld(sx, sy); W.cmdMove(wx, wy, quiet); return 'move';
  }
  U.bind = function (cv) {
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); G.Audio.init(); try { cv.setPointerCapture(e.pointerId); } catch (_) { }
      { const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) ae.blur(); }
      const [x, y] = evXY(e), [ux, uy] = toUI(x, y);
      const p = { x, y, sx: x, sy: y, mode: 'none', last: 0 };
      ptrs.set(e.pointerId, p);
      const b = hitBtn(ux, uy);
      if (b) { p.mode = 'ui'; p.btn = b; if (b.down) b.down(ux, uy); if (G.Menus && G.Menus.scrollHold) G.Menus.scrollHold(); return; }
      if (U.screen === 'guide') { p.mode = 'swipe'; return; }
      if (U.screen === 'team' || U.screen === 'book' || U.screen === 'ach' || U.screen === 'rank' || U.screen === 'fb' || U.screen === 'mail') { p.mode = 'mdrag'; if (G.Menus.scrollHold) G.Menus.scrollHold(); return; }
      if (U.screen !== 'battle' || U.paused || (W.over)) return;
      if (e.pointerType === 'mouse' && e.button === 2 && U.aim && U.aim.on) { U.aimCancel(); p.mode = 'none'; return; }   // 右鍵取消瞄準
      if (e.pointerType === 'mouse' && e.button !== 0) { p.mode = 'pan'; R.cam.follow = false; return; }
      if (G.Ctl.joyZone(ux, uy) && !U.lvUp) { p.mode = 'joy'; G.Ctl.joyStart(ux, uy); return; }   // v3.14 搖桿
      const others = [...ptrs.values()].filter(q => q !== p && q.mode !== 'ui' && q.mode !== 'joy');
      if (others.length) {
        const q = others[0];
        q.mode = 'pinch'; p.mode = 'pinch';
        pinch = { a: q, b: p, d0: Math.hypot(p.x - q.x, p.y - q.y) || 1, z0: R.cam.zoom, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 };
        return;
      }
      // 點一下 = 移動英雄（放開時判定）；拖曳 = 移動視角
      p.mode = 'wait'; p.t0 = performance.now();
    });
    cv.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') U.mouse = evXY(e);
      const p = ptrs.get(e.pointerId); if (!p) return;
      const [x, y] = evXY(e), dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
      if (p.mode === 'joy') { const [ux, uy] = toUI(x, y); G.Ctl.joyMove(ux, uy); return; }
      if (p.mode === 'ui' && p.btn && p.btn.hdrag) {          // v2.7 左右滑動的表格：橫向拖曳才滑表格，直向拖曳照常捲動
        if (!p.hlock && Math.abs(x - p.sx) > 4 * R.dpr && Math.abs(x - p.sx) >= Math.abs(y - p.sy)) p.hlock = true;
        if (p.hlock) { p.btn.hdrag(toUI(x, y)[0]); return; }
      }
      if (p.mode === 'ui' && p.btn && p.btn.drag) { const [ux, uy] = toUI(x, y); p.btn.drag(ux, uy); return; }
      if (p.mode === 'ui' && p.btn && p.btn.id === 'mini' && U.miniDrag) { const [ux, uy] = toUI(x, y); U.miniTo(ux, uy); }
      else if (p.mode === 'ui' && p.btn && p.btn.wheel && Math.abs(y - p.sy) > 4 * R.dpr && Math.abs(y - p.sy) >= Math.abs(x - p.sx)) { p.mode = 'vw'; p.wh = p.btn.wheel; p.btn = null; p.ly = p.sy; p.wh.grab(); }
      else if (p.mode === 'wait') { if (Math.hypot(x - p.sx, y - p.sy) > 10 * R.dpr) { p.mode = 'pan'; R.cam.follow = false; p.lastMove = performance.now(); } }
      else if (p.mode === 'pan') {
        const K = U.panSens, now = performance.now(), mdt = Math.max(8, now - (p.lastMove || now)) / 1000;
        const wx = -dx / R.scale / G.AX * K, wy = -dy / R.scale / G.AY * K;
        R.cam.x += wx; R.cam.y += wy;
        R.cam.vx = G.lerp(R.cam.vx || 0, G.clamp(wx / mdt, -900, 900), 0.4); R.cam.vy = G.lerp(R.cam.vy || 0, G.clamp(wy / mdt, -900, 900), 0.4); p.lastMove = now;
      }
      else if ((p.mode === 'mdrag' || (p.mode === 'ui' && (U.screen === 'team' || U.screen === 'book'))) && G.Menus && G.Menus.inCar(p.sx / R.uiS, p.sy / R.uiS) && Math.abs(x - p.sx) > 4 * R.dpr && Math.abs(x - p.sx) >= Math.abs(y - p.sy)) { p.mode = 'car'; p.btn = null; p.lx = p.sx; G.Menus.carGrab(); }
      else if ((p.mode === 'mdrag' || (p.mode === 'ui' && !(p.btn && p.btn.wheel) && (U.screen === 'team' || U.screen === 'book' || U.screen === 'ach' || U.screen === 'rank' || U.screen === 'fb' || U.screen === 'mail'))) && Math.abs(y - p.sy) > 7 * R.dpr) { p.mode = 'mscroll'; p.btn = null; p.ly = p.sy; }
      if (p.mode === 'vw') { p.wh.dragBy((y - p.ly) / R.uiS); p.ly = y; }
      if (p.mode === 'car') { G.Menus.carDrag((x - p.lx) / R.uiS); p.lx = x; }
      else if (p.mode === 'mscroll' && G.Menus) { const d = (p.ly - y) / R.uiS, now = performance.now(), mdt = Math.max(8, now - (p.lmt || now)) / 1000; p.lmt = now; p.svy = G.lerp(p.svy || 0, d / mdt, 0.5); G.Menus.scroll(d, p.sx / R.uiS, p.sy / R.uiS); p.ly = y; }
      else if (p.mode === 'pinch' && pinch) {
        const a = pinch.a, b = pinch.b, d = Math.hypot(a.x - b.x, a.y - b.y);
        R.setZoom(pinch.z0 * d / pinch.d0);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (Math.hypot(mx - pinch.mx, my - pinch.my) > 4) { R.cam.follow = false; R.cam.x -= (mx - pinch.mx) / R.scale / G.AX; R.cam.y -= (my - pinch.my) / R.scale / G.AY; pinch.mx = mx; pinch.my = my; }
      }
    });
    const upf = e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      ptrs.delete(e.pointerId);
      if (p.mode === 'joy') G.Ctl.joyEnd();
      if (p.mode === 'wait' && e.type === 'pointerup' && U.screen === 'battle' && !U.paused && W && !W.over) { worldTap(p.x, p.y); R.cam.vx = R.cam.vy = 0; }   // 點一下 = 移動
      if (p.mode === 'pan' && performance.now() - (p.lastMove || 0) > 80) R.cam.vx = R.cam.vy = 0;
      if (p.mode === 'car') G.Menus.carRelease();
      if (p.mode === 'vw') p.wh.release();
      if (p.mode === 'mscroll' && G.Menus && G.Menus.fling) G.Menus.fling(performance.now() - (p.lmt || 0) < 90 ? p.svy || 0 : 0, p.sx / R.uiS, p.sy / R.uiS);
      if (p.mode === 'ui' && p.btn) {
        U.miniDrag = false;
        const [ux, uy] = toUI(p.x, p.y), b = hitBtn(ux, uy);
        if (p.btn.up && ((b && b.id === p.btn.id) || p.btn.drag || p.btn.hdrag)) p.btn.up();
      }
      if (U.hold) U.hold = null;
      if (p.mode === 'swipe' && Math.abs(p.x - p.sx) > 30 * R.dpr && G.Menus) G.Menus.guideTurn(p.x < p.sx ? 1 : -1);
      if (p.mode === 'pinch') { pinch = null; for (const q of ptrs.values()) if (q.mode === 'pinch') q.mode = 'none'; }
    };
    cv.addEventListener('pointerup', upf); cv.addEventListener('pointercancel', upf);
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      if (G.Update && G.Update.isOpen && G.Update.isOpen()) { G.Update.wheel(e.deltaY * 0.25); return; }   // v3.2.4 更新內容卡可用滾輪捲動
      { const [ux, uy] = evXY(e).map(v => v / R.uiS); for (let i = U.btns.length - 1; i >= 0; i--) { const b = U.btns[i]; if (b.wheel && ux >= b.x && ux < b.x + b.w && uy >= b.y && uy < b.y + b.h) { const now = performance.now(); if (now - (U.wheelT || 0) > 90) { U.wheelT = now; b.wheel.step(Math.sign(e.deltaY || e.deltaX)); } return; } } }
      if (G.Menus && G.Menus.hscroll && (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) && G.Menus.hscroll(e.shiftKey && !e.deltaX ? e.deltaY * 0.5 : e.deltaX * 0.5, ...evXY(e).map(v => v / R.uiS))) return;   // v2.7 表格左右滑動
      if ((U.screen === 'team' || U.screen === 'book') && G.Menus && G.Menus.inCar(...evXY(e).map(v => v / R.uiS))) { const now = performance.now(); if (now - (U.wheelT || 0) > 90) { U.wheelT = now; G.Menus.carStep(Math.sign(e.deltaY || e.deltaX)); } return; }
      if ((U.screen === 'team' || U.screen === 'book' || U.screen === 'ach' || U.screen === 'rank' || U.screen === 'fb' || U.screen === 'mail') && G.Menus) { G.Menus.scroll(e.deltaY * 0.25, ...evXY(e).map(v => v / R.uiS)); return; }
      if (U.screen === 'battle' && !U.paused) R.setZoom(R.cam.zoom * Math.exp(-e.deltaY * 0.0012));   // 只有戰鬥中能縮放（首頁背景固定）
    }, { passive: false });
    // 鍵盤
    const keys = {};
    addEventListener('keydown', e => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // 輸入名稱／存檔碼時不觸發遊戲快捷鍵
      G.Audio.init();
      const k = e.key.toLowerCase(); if (keys[k]) return; keys[k] = true;
      if (G.StageGo && G.StageGo.active()) { if (k === 'enter' || k === ' ' || k === 'escape') G.StageGo.skip(); return; }   // v3.1 過場中不吃快捷鍵（Enter／空白／Esc＝跳過）
      if (U.screen !== 'battle') { if (G.Menus && G.Menus.key) G.Menus.key(k); return; }
      if (k === 'escape' && U.aim && U.aim.on) { U.aimCancel(); return; }
      if (G.Ctl.ed) { if (k === 'escape') G.Ctl.closeEd(); return; }
      if (U.lvUp) { if (k === 'escape' || k === 'enter' || k === ' ' || k === 'l') U.closeLv(); return; }   // v3.14 升級頁：Esc／Enter／L 繼續戰鬥
      if (k === 'escape' && U.ctlOpen) { U.ctlOpen = false; return; }
      if (k === 'escape' && U.leaveAsk) { U.leaveAsk = null; return; }               // v3.10 離開確認：Esc＝取消
      if (k === 'escape' || k === 'p') { U.paused = !U.paused; U.leaveAsk = null; return; }
      if (U.paused || !W || W.over) return;
      const sk = { q: 0, e: 1, r: 2, '1': 0, '2': 1, '3': 2 }[k];
      if (sk != null && U.mouse && W.hero && W.hero.alive && W.hero.skills[sk] && W.hero.skills[sk].lv && !W.hero.chg) { U.aim = { i: sk, s: W.hero.skills[sk], on: true, mouse: true, key: k }; U.aimUpdate(); }
      else if (sk != null) { const r = W.trySkill(sk); U.press['sk' + sk] = 0.12; if (r !== 'ok' && r !== 'queued') { deny('sk' + sk); if (r === 'mp') U.toastMsg('MP不足', 11); if (r === 'lock') U.toastMsg('尚未學習', 7); } }
      if (k === 'c') R.cam.follow = true;
      if (k === 'l') U.openLv(false);
      if (k === 'u') { if (!W.autoLevel()) G.Audio.play('deny'); }
      if (k === 'm') G.Audio.toggleMute();
      if (k === 'f') U.showFps = !U.showFps;
    });
    addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys[k] = false; if (U.aim && U.aim.mouse && U.aim.key === k) U.aimRelease(); });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    U.keyDir = () => {
      const jd = G.Ctl.joyDir(); if (jd) return jd;   // v3.14 搖桿優先
      let x = 0, y = 0;
      if (keys.a || keys.arrowleft) x--; if (keys.d || keys.arrowright) x++;
      if (keys.w || keys.arrowup) y--; if (keys.s || keys.arrowdown) y++;
      if (!x && !y) return null; const l = Math.hypot(x, y); return [x / l, y / l];
    };
  };
  return U;
})();
