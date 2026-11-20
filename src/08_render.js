'use strict';
/* =========================================================
   繪製：低解析像素緩衝 → 整數放大 + 次像素平移（鏡頭平滑）
   ========================================================= */
G.Render = (() => {
  const R = {
    cam: { x: 0, y: 0, zoom: 1, follow: true, vx: 0, vy: 0 },
    scale: 4, uiS: 3, sw: 0, sh: 0, dpr: 1, ox: 0, oy: 0, fx: 0, fy: 0
  };
  let cv, ctx, buf, bctx, ui, uctx, vign;

  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d', { alpha: false });
    buf = G.canvas(8, 8); bctx = buf.getContext('2d');
    ui = G.canvas(8, 8); uctx = ui.getContext('2d');
    R.uctx = uctx;
    R.resize();
  };
  // 固定畫面比例：橫屏固定 320×180（16:9）、直屏寬固定 180（高 320~400）；
  // 視窗多出來的部分留黑邊，不論視窗多大，畫面內所有物件的比例都一樣
  R.resize = function () {
    R.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W0 = innerWidth, H0 = innerHeight, port = H0 > W0;
    const LW = port ? 180 : 320, LH = port ? G.clamp(Math.round(180 * H0 / W0), 320, 400) : 180;
    // 電腦：每個像素放大成「整數倍」的螢幕實體像素 → 所有像素一樣大，字與輪廓不會粗細不均（看起來糊）
    // 手機：像素很密，看不出差異，維持填滿畫面
    const touch0 = matchMedia('(pointer: coarse)').matches;
    let cs = Math.min(W0 / LW, H0 / LH), kInt = 0;
    if (!touch0) { const k = Math.floor(cs * R.dpr); if (k >= 2) { kInt = k; cs = k / R.dpr; } }
    const cw = kInt ? LW * cs : Math.floor(LW * cs), ch = kInt ? LH * cs : Math.floor(LH * cs);
    R.cssX = Math.floor((W0 - cw) / 2); R.cssY = Math.floor((H0 - ch) / 2);
    cv.style.position = 'fixed'; cv.style.left = R.cssX + 'px'; cv.style.top = R.cssY + 'px'; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    R.sw = kInt ? LW * kInt : Math.round(cw * R.dpr); R.sh = kInt ? LH * kInt : Math.round(ch * R.dpr);
    cv.width = R.sw; cv.height = R.sh;
    R.uw = LW; R.uh = LH; R.uiS = R.sw / LW;
    R.base = port ? R.uiS * 0.9 : R.uiS;
    // 安全邊距（UI px，固定值）：直屏避開圓角/底部手勢列，橫屏避開瀏海；系統安全區超出黑邊時再加大
    const touch = matchMedia('(pointer: coarse)').matches, cssPerUi = cs;
    let si = { l: 0, r: 0, t: 0, b: 0 };
    const pr = document.getElementById('safe'); if (pr) { const b = pr.getBoundingClientRect(); si = { l: b.left, t: b.top, r: W0 - b.right, b: H0 - b.bottom }; }
    const ex = (v, gap) => Math.ceil(Math.max(0, v - gap) / cssPerUi), gx = R.cssX, gy = R.cssY;
    const base = port ? { l: 5, r: 5, t: 5, b: touch ? 15 : 5 } : { l: touch ? 13 : 2, r: touch ? 13 : 2, t: touch ? 3 : 2, b: touch ? 6 : 2 };
    R.ins = { l: Math.max(base.l, ex(si.l, gx)), r: Math.max(base.r, ex(si.r, gx)), t: Math.max(base.t, ex(si.t, gy)), b: Math.max(base.b, ex(si.b, gy)) };
    ui.width = R.uw; ui.height = R.uh;
    // 暗角
    vign = G.canvas(R.sw, R.sh); const v = vign.getContext('2d');
    const g = v.createRadialGradient(R.sw / 2, R.sh / 2, Math.min(R.sw, R.sh) * 0.35, R.sw / 2, R.sh / 2, Math.hypot(R.sw, R.sh) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    v.fillStyle = g; v.fillRect(0, 0, R.sw, R.sh);
  };
  // 最小縮放：可以縮到整張地圖都在畫面內
  R.zoomMin = () => { const W = G.W; if (!W || !W.M) return 0.6; const fit = Math.min(R.sw / (W.M.ww * G.AX), R.sh / (W.M.wh * G.AY)) / R.base; return Math.min(0.6, fit * 0.98); };
  R.setZoom = z => { R.cam.zt = null; R.cam.zoom = G.clamp(z, R.zoomMin(), 2.0); };
  // v3.2.4 放大／縮小按鈕：每按一下 ×1.35（平滑過去）；回傳 false＝已到極限
  R.ZSTEP = 1.35;
  R.zoomBy = dir => { const c = R.cam, lo = R.zoomMin(), base = c.zt != null ? c.zt : c.zoom, t = G.clamp(base * (dir > 0 ? R.ZSTEP : 1 / R.ZSTEP), lo, 2.0); if (Math.abs(t - base) < 0.001) return false; c.zt = t; return true; };
  R.zoomAt = dir => { const c = R.cam, z = c.zt != null ? c.zt : c.zoom; return dir > 0 ? z < 2.0 - 0.001 : z > R.zoomMin() + 0.001; };

  // 鏡頭
  R.updateCam = function (W, dt) {
    const c = R.cam, h = W.hero;
    if (c.zt != null) { c.zoom += (c.zt - c.zoom) * G.damp(12, dt); if (Math.abs(c.zt - c.zoom) < 0.002) { c.zoom = c.zt; c.zt = null; } }   // v3.2.4 按鈕縮放：平滑過去
    let tx = c.x, ty = c.y;
    if (W.attract) { const t = W.time * 0.05; tx = W.M.ww * (0.5 + Math.sin(t) * 0.28); ty = W.M.wh * (0.5 - Math.sin(t) * 0.22); }
    else if (c.follow) {
      if (h && h.alive) { tx = h.x + h.vx * 0.35; ty = h.y + h.vy * 0.35; }
      else if (W.over) { const t = W.holy[W.over.win ? 1 : 0]; tx = t.x; ty = t.y; }
      else { tx = W.spawnPt[0][0]; ty = W.spawnPt[0][1]; }
    }
    if (c.follow) { const k = G.damp(7, dt); c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.vx = c.vy = 0; }
    else if (c.vx || c.vy) { c.x += c.vx * dt * 0.5; c.y += c.vy * dt * 0.5; const d = Math.exp(-dt * 9); c.vx *= d; c.vy *= d; if (Math.abs(c.vx) + Math.abs(c.vy) < 2) c.vx = c.vy = 0; }
    const sc = R.base * c.zoom, hw = R.sw / sc / 2 / G.AX, hh = R.sh / sc / 2 / G.AY;
    const px = W.ground.pad / G.AX - 20, py = W.ground.pad / G.AY - 20;   // 地圖外圍森林邊界
    c.x = G.clamp(c.x, Math.min(hw - px, W.M.ww / 2), Math.max(W.M.ww - hw + px, W.M.ww / 2));
    c.y = G.clamp(c.y, Math.min(hh - py, W.M.wh / 2), Math.max(W.M.wh - hh + py, W.M.wh / 2));
    W.cam = c;
  };
  // 直線範圍（穿透技）：從 (x0,y0) 往 (x1,y1) 方向、長 len、寬 w 的長方形
  G.drawLineZone = (b, ox, oy, x0, y0, x1, y1, len, w, col, a, rt) => {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy * w, ny = ux * w;
    const P2 = [[x0 + nx, y0 + ny], [x0 + ux * len + nx, y0 + uy * len + ny], [x0 + ux * len - nx, y0 + uy * len - ny], [x0 - nx, y0 - ny]].map(([x, y]) => [x * G.AX - ox, y * G.AY - oy]);
    b.globalAlpha = a; b.fillStyle = G.PAL[col]; b.beginPath(); P2.forEach(([x, y], i) => i ? b.lineTo(x, y) : b.moveTo(x, y)); b.closePath(); b.fill(); b.globalAlpha = 1;
    b.fillStyle = G.PAL[col]; for (let i = 0; i < 4; i++) G.pxLine(b, P2[i][0], P2[i][1], P2[(i + 1) % 4][0], P2[(i + 1) % 4][1], 1);
  };
  // v3.2.2 螢幕（實體像素）⇄ 緩衝座標：有透視時用和著色器一樣的公式
  R.scrToBuf = (X, Y) => {
    const sc = R.scale, P = R.ps;
    if (!P) return [R.cbx + (X - R.sw / 2) / sc, R.cby + (Y - R.sh / 2) / sc];
    const s = 1 + P * (2 * Y / R.sh - 1); return [R.cbx + (X - R.sw / 2) / (sc * s), R.cby + R.sh / (2 * P * sc) * Math.log(s)];
  };
  R.bufToScr = (bx, by) => {
    const sc = R.scale, P = R.ps;
    if (!P) return [R.sw / 2 + (bx - R.cbx) * sc, R.sh / 2 + (by - R.cby) * sc];
    const s = Math.exp((by - R.cby) * 2 * P * sc / R.sh); return [R.sw / 2 + (bx - R.cbx) * sc * s, R.sh / 2 * (1 + (s - 1) / P)];
  };
  R.depthAt = Y => 1 + (R.ps || 0) * (2 * Y / R.sh - 1);          // 這一列的遠近縮放（頭上 UI 可以跟著縮）
  R.screenToWorld = (sx, sy) => { const [bx, by] = R.scrToBuf(sx, sy); return [(R.ox + bx) / G.AX, (R.oy + by) / G.AY]; };
  R.worldToScreen = (x, y, z = 0) => R.bufToScr(x * G.AX - R.ox, y * G.AY - z * G.AZ - R.oy);

  // 單位在美術座標的外框（點選用）
  R.unitBox = (u) => {
    const s = u.spr[0], ax = u.x * G.AX - R.ox, ay = u.y * G.AY - u.z * G.AZ - R.oy;
    return [ax - s.w / 2, ay - s.h, s.w, s.h];
  };

  const sprOf = (k) => { const s = G.SPR[k]; return Array.isArray(s) ? s[0] : s; };

  R.draw = function (W, alpha, rt) {
    R.dtF = Math.min(0.1, Math.max(0, rt - (R._lrt || rt))); R._lrt = rt;
    const sc = R.scale = R.base * R.cam.zoom;
    const hd = G.HD && G.HD.active(), [OXf, OYf] = hd ? G.HD.over() : [1, 1]; R.ps = hd ? G.HD.P : 0;   // v3.2.2 HD-2D：透視需要外擴緩衝
    const VW = R.sw / sc, VH = R.sh / sc, bw = Math.ceil(VW * OXf) + 2, bh = Math.ceil(VH * OYf) + 2;
    // v3.4 2 倍細緻：緩衝每格美術像素用 2×2 畫，角色可以半格移動（走路不再一格一格跳）；只在 HD 後製下開，掉幀會自動關（08b_hd adapt）
    const SS = R.SS = hd && !R.ssOff && sc >= 3 ? 2 : 1;
    if (buf.width !== bw * SS || buf.height !== bh * SS) { buf.width = bw * SS; buf.height = bh * SS; }
    const b = bctx; b.setTransform(SS, 0, 0, SS, 0, 0); b.imageSmoothingEnabled = false; G.SSQ = SS;
    const q = v => Math.round(v * SS) / SS;                              // 角色位置對齊到半格
    // 鏡頭 + 震動
    const tr = W.trauma * W.trauma, sh = tr * 7;
    const shx = (G.vnoise(rt * 25, 3.1) - 0.5) * 2 * sh, shy = (G.vnoise(5.7, rt * 25) - 0.5) * 2 * sh;
    const left = R.cam.x * G.AX - VW * OXf / 2 + shx, top = R.cam.y * G.AY - VH * OYf / 2 + shy;
    const ox = Math.floor(left), oy = Math.floor(top);
    R.ox = ox; R.oy = oy; R.fx = left - ox; R.fy = top - oy; R.cbx = R.fx + VW * OXf / 2; R.cby = R.fy + VH * OYf / 2;   // 鏡頭中心在緩衝裡的位置
    const o = { x: ox, y: oy };
    G.setPatOffset(ox, oy);
    // 背景 + 地面
    b.fillStyle = G.PAL[1]; b.fillRect(0, 0, bw, bh);
    const gd = W.ground;
    let sx = ox + gd.pad, sy = oy + gd.pad, dx = 0, dy = 0, w = bw, h = bh;
    if (sx < 0) { dx = -sx; w += sx; sx = 0; } if (sy < 0) { dy = -sy; h += sy; sy = 0; }
    if (sx + w > gd.w) w = gd.w - sx; if (sy + h > gd.h) h = gd.h - sy;
    if (w > 0 && h > 0) b.drawImage(gd.c, sx, sy, w, h, dx, dy, w, h);
    b.fillStyle = 'rgba(70,70,70,0.17)'; b.fillRect(0, 0, bw, bh);    // 地面對比稍微壓低（v2.3），讓角色更突出
    // 焦痕
    for (const d of W.decals) { const a = (1 - d.t / d.dur) * 0.75; G.pxDisc(b, d.x * G.AX - ox, d.y * G.AY - oy, d.r * G.AX, d.r * G.AY, d.col ?? 2, a); }
    // 地面特效
    for (const e of W.effects) if (e.layer === 0 && e.draw) e.draw(b, o);
    W.parts.draw(b, ox, oy, W.frame, true);
    // 野怪巢穴：空巢時顯示重生倒數
    const campTxt = [];
    for (const cp of W.camps || []) {
      if (cp.u) continue;
      const gx = cp.x * G.AX - ox, gy = cp.y * G.AY - oy; if (gx < -40 || gy < -40 || gx > bw + 40 || gy > bh + 40) continue;
      const big = cp.def.kind === 'wboss', r = big ? 16 : 10;
      G.pxEllipse(b, gx, gy, r, r * 0.5, 3, 4, rt * 2);
      campTxt.push([Math.round(gx), Math.round(gy - 3), Math.ceil(cp.t)]);
    }
    // 移動落點：地面脈衝圈 + 落下彈跳的箭頭
    const mk = W.mark;
    if (mk && !W.attract) {
      const gx = mk.x * G.AX - ox, gy = mk.y * G.AY - oy, t = mk.t, fade = 1 - (mk.out || 0) / 0.2;
      const pr = (t * 2.2) % 1;
      G.pxEllipse(b, gx, gy, 9 * G.AX * 2 * (1 - pr) + 2, 9 * G.AY * 2 * (1 - pr) + 1, pr > 0.6 ? 15 : 13);
      G.pxDisc(b, gx, gy, 6, 2.5, 13, 0.3 * fade);
      G.pxEllipse(b, gx, gy, 7, 3, 13);
      b.fillStyle = G.PAL[13]; b.fillRect(Math.round(gx), Math.round(gy), 1, 1);
      const drop = t < 0.18 ? (1 - t / 0.18) * 26 : 0, bounce = t < 0.18 ? 0 : Math.abs(Math.sin((t - 0.18) * 7)) * 3;
      mk.ax = Math.round(gx); mk.ay = Math.round(gy - 8 - drop - bounce); mk.fade = fade;
    }
    // v2.5 河流微微流動：沿河道的短亮線順流移動、前後淡入淡出（只畫畫面內的，約幾十個像素）
    { const rv = W.M.def.river, T = G.TILE; if (rv) { const pts = rv.pts; b.fillStyle = W.theme ? W.theme.flow : '#bcd8dc';
      for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, n = Math.ceil(L * 1.4);
        for (let k = 0; k < n; k++) { const h1 = G.hash(i * 97 + k, 5), h2 = G.hash(i * 31 + k, 9), s2 = ((k + h1) / n + rt * (0.018 + h2 * 0.012)) % 1, lat = (h2 - 0.5) * 1.5 * rv.r;
          const wx = (x0 + ux * s2 * L - uy * lat) * T, wy = (y0 + uy * s2 * L + ux * lat) * T, sx = Math.round(wx * G.AX - ox), sy = Math.round(wy * G.AY - oy);
          if (sx < -4 || sy < -4 || sx > bw + 4 || sy > bh + 4) continue;
          const fa = Math.sin(((s2 * n) % 1) * Math.PI); b.globalAlpha = 0.28 * fa; b.fillRect(sx, sy, 2 + ((h1 * 3) | 0), 1); }
      } b.globalAlpha = 1; } }
    // v2.4 敵塔攻擊範圍：英雄靠近時淡入（淡粉紅填滿）；被鎖定時變紅、呼吸
    const h0 = W.hero, P0 = G.PAL;
    const zone = (x, y, r, col, fa, oa, dash) => {           // 地面範圍：半透明填滿＋外框（世界座標、半徑）
      const gx = x * G.AX - ox, gy = y * G.AY - oy;
      if (fa > 0) { b.globalAlpha = fa; b.fillStyle = P0[col]; b.beginPath(); b.ellipse(Math.round(gx), Math.round(gy), r * G.AX, r * G.AY, 0, 0, 6.2832); b.fill(); b.globalAlpha = 1; }
      if (oa > 0) { b.globalAlpha = oa; G.pxEllipse(b, gx, gy, r * G.AX, r * G.AY, col, dash || 0, rt * 6); b.globalAlpha = 1; }
    };
    if (h0 && h0.alive && !W.attract) for (const t of W.units) {
      if (!t.alive || t.kind !== 'tower' || t.side === h0.side) continue;
      const reach = t.st.range + t.r * 0.4 + h0.r, d = Math.hypot(h0.x - t.x, h0.y - t.y), lk = t.target === h0;
      t.zoneA = G.clamp((t.zoneA || 0) + (d < reach + 50 ? 3 : -3) * R.dtF, 0, 1);
      if (t.zoneA > 0.01) { const pu = lk ? 0.5 + 0.5 * Math.sin(rt * 9) : 0; zone(t.x, t.y, reach, lk ? 10 : 19, t.zoneA * (lk ? 0.13 + 0.07 * pu : 0.12), t.zoneA * (lk ? 0.9 : 0.55), lk ? 0 : 4); }
    }
    // 技能預告：蓄力中顯示真正的作用範圍（我方黃、敵方紅）
    for (const u of W.units) {
      const c0 = u.chg; if (!c0 || !u.alive || !W.seen(0, u)) continue;
      const sp = G.skillShape(c0.sd), col = u.side === 0 ? 13 : 10, k = Math.min(1, c0.T / c0.dur), a = 0.1 + 0.12 * k;
      if (sp.k === 'self' || (sp.k === 'buff' && sp.r)) zone(u.x, u.y, sp.r, col, a, 0.9);
      else if (sp.k === 'area' && c0.t) { zone(c0.t.x, c0.t.y, sp.r, col, a, 0.9); zone(c0.t.x, c0.t.y, sp.r * k, col, 0.12, 0); }
      else if (sp.k === 'line' && c0.t) G.drawLineZone(b, ox, oy, u.x, u.y, c0.t.x, c0.t.y, sp.len, sp.w, col, a, rt);
      else if (sp.k === 'unit' && c0.t && c0.t.alive !== false) zone(c0.t.x, c0.t.y, (c0.t.r || 8) + 6, col, 0, 0.9, 3);
    }
    // 技能瞄準（拖曳技能鈕／按住快捷鍵）：施放距離＋落點範圍
    const AM = G.UI.aim;
    if (h0 && h0.alive && AM && (AM.on || (AM.pre && !(G.UI.hold && G.UI.hold.fired))) && !W.attract) {   // 按著技能鈕（還沒拖）也先顯示範圍
      const sp = AM.s.shape, col = AM.cancel ? 10 : 13;
      if (sp.cast) zone(h0.x, h0.y, sp.cast, col, 0.06, 0.8, 4);
      if (sp.k === 'self' || sp.k === 'buff') zone(h0.x, h0.y, sp.r, col, 0.16, 1);
      else if (!AM.on) { }
      else if (sp.k === 'area') zone(AM.x, AM.y, sp.r, col, 0.22, 1);
      else if (sp.k === 'line') G.drawLineZone(b, ox, oy, h0.x, h0.y, AM.x, AM.y, sp.len, sp.w, col, 0.2, rt);
      else { const t = AM.t; if (t) { zone(t.x, t.y, t.r + 8, col, 0.2, 1); b.fillStyle = P0[col]; b.globalAlpha = 0.6; G.pxLine(b, h0.x * G.AX - ox, h0.y * G.AY - oy, t.x * G.AX - ox, t.y * G.AY - oy, 1); b.globalAlpha = 1; } else zone(AM.x, AM.y, 6, col, 0, 0.8, 2); }
    }
    // 英雄攻擊射程（接近敵人時自動淡入；按住或瞄準技能、蓄力時隱藏，避免和技能範圍混淆）
    const skFocus = (AM && (AM.on || AM.pre)) || (h0 && h0.chg);
    if (h0 && h0.alive && h0.rangeA > 0.02 && !W.attract && !skFocus) {
      const x = G.lerp(h0.px, h0.x, alpha), y = G.lerp(h0.py, h0.y, alpha), rr = h0.st.range + h0.r * 0.4 + 8, a = h0.rangeA;
      const hot = h0.nearD <= h0.st.range;                 // 有敵人在射程內
      const gx = x * G.AX - ox, gy = y * G.AY - oy;
      if (a > 0.5) G.pxEllipse(b, gx, gy, rr * G.AX, rr * G.AY, hot ? 9 : 6, hot ? 0 : 6, rt * 6);
      else G.pxEllipse(b, gx, gy, rr * G.AX, rr * G.AY, 6, 4, rt * 6);
    }
    // 大招前搖：場景稍微壓暗，凸顯施法者（v2.3）
    { const hc = W.hero && W.hero.chg; if (hc && hc.big) { b.fillStyle = 'rgba(0,0,0,' + (0.3 * Math.min(1, hc.T / hc.dur)).toFixed(3) + ')'; b.fillRect(0, 0, bw, bh); } }
    // 收集要排序的物件
    const list = [], vx0 = ox - 30, vx1 = ox + bw + 30, vy0 = oy - 10, vy1 = oy + bh + 60;
    const inView = (x, y) => { const ax = x * G.AX, ay = y * G.AY; return ax > vx0 && ax < vx1 && ay > vy0 && ay < vy1; };
    for (const p of W.M.props) if (inView(p.x, p.y)) list.push({ y: p.y, p });
    for (const u of W.units) if (u.alive && inView(u.x, u.y) && W.seen(0, u)) list.push({ y: G.lerp(u.py, u.y, alpha), u });   // 迷霧中的敵人不畫
    for (const p of W.projs) if (p.side === 0 || W.seenXY(0, p.x, p.y)) list.push({ y: p.y, j: p });
    list.sort((a, c) => a.y - c.y);
    const bars = [], arrows = [], reticles = [], flags = [];
    for (const it of list) {
      if (it.p) {
        const p = it.p, s = p.s, ax = Math.round(p.x * G.AX - ox - s.w / 2), ay = Math.round(p.y * G.AY - oy - s.h + 2), sn = W.theme && W.theme.tree ? G.themeImg(s.n, W.themeId) : s.n;   // v3.0 主題換色
        if (p.tree) {                                    // v2.5 樹隨風搖：樹冠上段擺最多、中段一半、樹幹不動（三段貼圖，幾乎不耗效能）
          const ph = p.ph ?? (p.ph = G.hash(p.x | 0, p.y | 0) * 6.283), sw = Math.sin(rt * 1.3 + ph + p.x * 0.004) + Math.sin(rt * 2.9 + ph) * 0.25;
          const h1 = Math.round(s.h * 0.4), h2 = Math.round(s.h * 0.72) - h1, o1 = Math.round(sw * 1.2), o2 = Math.round(sw * 0.55);
          b.drawImage(sn, 0, 0, s.w, h1, ax + o1, ay, s.w, h1); b.drawImage(sn, 0, h1, s.w, h2, ax + o2, ay + h1, s.w, h2); b.drawImage(sn, 0, h1 + h2, s.w, s.h - h1 - h2, ax, ay + h1 + h2, s.w, s.h - h1 - h2);
        } else {
          if (p.deco) G.pxDisc(b, ax + s.w / 2 + 2, ay + s.h - 1, s.w * 0.45, 2, 0, 0.5);
          b.drawImage(p.deco && G.VOL & 1 ? G.bevelOf(sn) : sn, ax, ay);
          if (p.glow) { const fl = 0.75 + 0.15 * Math.sin(rt * 3 + p.x) + 0.1 * Math.sin(rt * 11 + p.y); G.glow(b, ax + s.w / 2, ay + 5, 9, 13, 0.32 * fl); G.glow(b, ax + s.w / 2, ay + s.h, 12, 13, 0.1 * fl, 0.5); }
        }
      } else if (it.u) {
        const u = it.u, x = G.lerp(u.px, u.x, alpha), y = G.lerp(u.py, u.y, alpha);
        const moving = Math.hypot(u.vx, u.vy) > 10;
        const fr = u.spr, fi = u.vis.fly ? ((u.anim * 1.4) | 0) % fr.length : moving ? ((u.anim * 0.7) | 0) % fr.length : 0;
        const s = fr[fi];
        const gx = x * G.AX - ox, gy = y * G.AY - oy;
        // 影子
        const shR = u.vis.shadow * G.AX * (u.vis.fly ? 0.7 : 1);
        G.pxDisc(b, q(gx), q(gy), shR, Math.max(1.5, shR * 0.42), 0, u.static ? 0.7 : 0.55);
        if (!u.vis.fly) G.pxDisc(b, q(gx) + 1, q(gy), shR * 0.55, Math.max(1, shR * 0.22), 0, 0.4);   // v3.2 腳底接觸陰影（環境光遮蔽），角色像真的踩在地上
        if (u === h0) G.pxEllipse(b, gx, gy + 1, shR + 3, shR * 0.42 + 2, 9, 5, rt * 12);
        if (u.chg) {                                            // 施法前搖：腳下法陣由小變大、旋轉
          const cp = Math.min(1, u.chg.T / u.chg.dur), E = G.ELEM[u.chg.el] || G.ELEM.arcane, R0 = (shR + (u.chg.big ? 12 : 7)) * (0.35 + 0.65 * Math.sqrt(cp));
          G.pxEllipse(b, gx, gy + 1, R0, R0 * 0.42, E.c, 3, rt * 10); G.pxEllipse(b, gx, gy + 1, R0 * 0.62, R0 * 0.26, E.c2, 2, -rt * 14);
          if (u.chg.big) { b.globalAlpha = 0.35 * cp; b.fillStyle = G.PAL[E.c]; b.fillRect(Math.round(gx - 3 - cp * 3), 0, Math.round(6 + cp * 6), Math.round(gy)); b.globalAlpha = 1; }   // 大招：光柱
        }
        const tgt = h0 && h0.target === u && h0.alive;
        const lockedU = h0 && h0.alive && h0.cmd && h0.cmd.lock && h0.cmd.t === u;
        if (tgt && !lockedU) { G.pxEllipse(b, gx, gy + 1, shR + 3, shR * 0.42 + 2, 9); G.pxEllipse(b, gx, gy + 1, shR + 2, shR * 0.42 + 1.5, 0); }
        // 鎖定：改成畫在地面（腳下）的紅色圈＋四個轉動小刻度，不擋本體與血條
        if (lockedU) {
          u.lockT = (u.lockT || 0) + 1 / 60;
          const k = Math.min(1, u.lockT / 0.22), rx = shR + 5 + (1 - k) * 12, ry = shR * 0.42 + 3 + (1 - k) * 5;
          G.pxEllipse(b, gx, gy + 2, rx, ry, 0); G.pxEllipse(b, gx, gy + 1, rx, ry, 10, 4, rt * 8);   // 黑色底線＋紅色虛線，在亮/暗地面都看得到
          for (let i = 0; i < 4; i++) { const a = rt * 1.6 + i * Math.PI / 2, px = Math.round(gx + Math.cos(a) * (rx + 2)), py = Math.round(gy + 1 + Math.sin(a) * (ry + 1)); b.fillStyle = G.PAL[0]; b.fillRect(px - 1, py - 1, 3, 3); b.fillStyle = G.PAL[10]; b.fillRect(px, py, 1, 1); }
        } else u.lockT = 0;
        // 動作偏移
        let ddx = 0, ddy = 0;
        // 攻擊姿勢（v2.3）：蓄勢（往後仰＋蹲）→ 出手（前衝＋前傾＋拉長）→ 收招；遠程：後座力；施法：蹲低發抖
        let psx = 1, psy = 1, psk = 0;
        if (u.windup > 0) { const wp = 1 - u.windup / (u.melee ? 0.13 : 0.09); ddx = -u.face * Math.round(1 + wp); psk = u.face * 0.22 * wp; psy = 1 - 0.1 * wp; psx = 1 + 0.08 * wp; }
        if (u.lunge > 0) { const f = u.lunge; ddx = Math.round(Math.sin(f * Math.PI) * 4) * u.face; psk = -u.face * 0.32 * f; psx = 1 + 0.14 * f; psy = 1 - 0.07 * f; }
        if (u.recoil > 0) { ddx = -u.face * Math.round(u.recoil * 2); psy = 1 + 0.06 * u.recoil; psx = 1 - 0.04 * u.recoil; }
        if (u.chg) { const cp = Math.min(1, u.chg.T / u.chg.dur); psy = 1 - 0.09 * cp; psx = 1 + 0.07 * cp; ddx = Math.round(Math.sin(u.chg.T * 70) * cp * (u.chg.big ? 1.4 : 0.8)); }
        if (u.cast > 0.12) { psy = 1.08; psx = 0.95; }
        if (moving && fi === 1) ddy = -1;
        if (!moving && !u.static && Math.sin(u.anim * 3 + u.id) > 0.7) ddy = -1;
        if (u.cast > 0.12) ddy -= 2;
        const zz = u.z + u.spawnT * 70 + (u.vis.fly ? Math.sin(u.anim * 2.5) * 3 : 0);
        const red = u.side === 1 && !u.static;                 // 敵方單位：赤紅配色
        const base = G.lookOf(u, u.face < 0 ? s.m : s.n);             // v2.6 受控＝幽魂紫、複製體＝冰青
        const img = u.flash > 0 ? (u.face < 0 ? s.fm : s.f) : base;
        const ax = q(gx - s.w / 2 + ddx), ay = q(gy - zz * G.AZ - s.h + 1 + ddy);
        // 層次感（v2.3）：光從左上來 → 斜向投影（落在右下方地面）＋左上亮邊＋右下暗邊
        if (!u.vis.fly && u.spawnT <= 0.01) {
          const sil = G.glowOf(base, 0, 1, 0).tint, fx = q(gx + ddx), fy = q(gy) + 1;
          b.save(); b.globalAlpha = u.static ? 0.32 : 0.26; b.setTransform(SS, 0, -0.55 * SS, -0.32 * SS, (fx - s.w / 2) * SS, fy * SS); b.drawImage(sil, 0, -s.h); b.restore();
        }
        const shielded = u.protectors && W.isProtected(u);
        // 稀有度外框（我方英雄與小兵）
        if (u.charm || u.clone) { const gl = G.glowOf(base, u.clone ? 25 : 17, 1, 2); b.globalAlpha = 0.6 + Math.sin(rt * 5 + u.id) * 0.25; b.drawImage(gl.c, ax - gl.p, ay - gl.p); b.globalAlpha = 1; }   // 召喚物外框
        else if (u.side === 0 && (u.kind === 'hero' || u.kind === 'creep') && u.rar != null) {
          const gl = G.rarGlow(base, u.rar, 1, u.rar >= 2 ? 3 : 2);
          b.globalAlpha = u.rar === 0 ? 0.55 : 0.75 + Math.sin(rt * 4 + u.id) * 0.2; b.drawImage(gl.c, ax - gl.p, ay - gl.p); b.globalAlpha = 1;
        }
        // v3.1 敵方：暗色身體＋一圈細紅邊（和開場動畫一樣），彩色地圖上一眼分得出敵我
        if (u.side === 1 && !u.static && !u.charm && !u.clone) { const gl = G.glowOf(base, 10, 1, 1); b.globalAlpha = u.kind === 'boss' ? 0.75 + Math.sin(rt * 4 + u.id) * 0.15 : 0.6; b.drawImage(gl.c, ax - gl.p, ay - gl.p); b.globalAlpha = 1; }
        // 中立野怪：黃色淡外框
        if (u.side === 2) { const gl = G.glowOf(base, 13, 1, 2); b.globalAlpha = 0.45 + Math.sin(rt * 3 + u.id) * 0.15; b.drawImage(gl.c, ax - gl.p, ay - gl.p); b.globalAlpha = 1; }
        // 我方首領（被收服的野生首領）：黃色外框
        if (u.allyBoss) { const gl = G.glowOf(base, 13, 1, 3); b.globalAlpha = 0.8; b.drawImage(gl.c, ax - gl.p, ay - gl.p); b.globalAlpha = 1; }
        // 護盾：沿建築剪影外擴的藍色光殼 + 呼吸光暈
        if (shielded) { const gl = G.glowOf(base, 12, 1, 5); b.globalAlpha = 0.6 + Math.sin(rt * 3 + u.id) * 0.25; b.drawImage(gl.c, ax - gl.p, ay - gl.p); b.globalAlpha = 1; }
        G.VFX.auraBack(b, u, ax, ay, base, gx, gy, rt, W);
        { const gk = G.glowOf(base, 0, 1, 0), gw = G.glowOf(base, 9, 1, 0); b.globalAlpha = 0.55; b.drawImage(gk.tint, ax + 1, ay + 1); b.globalAlpha = u.side === 1 ? 0.35 : 0.22; b.drawImage(gw.tint, ax - 1, ay - 1); b.globalAlpha = 1; }   // 右下暗邊、左上亮邊
        if (u.chg) {                                            // 施法前搖：身體發光（越來越亮）
          const cp = Math.min(1, u.chg.T / u.chg.dur), E = G.ELEM[u.chg.el] || G.ELEM.arcane, gl = G.glowOf(base, E.c, 1, 2);
          b.globalAlpha = 0.25 + 0.6 * cp * (0.75 + 0.25 * Math.sin(rt * 30)); b.drawImage(gl.c, ax - gl.p, ay - gl.p); b.globalAlpha = 1;
        }
        if (u.clone) b.globalAlpha = 0.68 + Math.sin(rt * 9 + u.id) * 0.1;      // 複製體：半透明、微微閃爍
        const vimg = u.flash > 0 || !(G.VOL & 1) ? img : G.bevelOf(img);   // v3.2.1 光影浮雕
        if (psx !== 1 || psy !== 1 || psk !== 0) {              // 以腳底為支點做擠壓／傾斜
          const fx = ax + s.w / 2, fy = ay + s.h;
          b.save(); b.setTransform(psx * SS, 0, psk * SS, psy * SS, fx * SS, fy * SS); b.drawImage(vimg, -s.w / 2, -s.h); b.restore();
        } else b.drawImage(vimg, ax, ay);
        b.globalAlpha = 1;
        if (u.chg && u.chg.T > u.chg.dur - 0.06) { b.globalAlpha = 0.8; b.drawImage(G.glowOf(base, 9, 1, 0).tint, ax, ay); b.globalAlpha = 1; }   // 放招瞬間白閃
        if (u.lunge > 0.25 && !u.static) G.FX.swingArc(b, u, ax, ay, s, 1 - u.lunge);
        if (u.recoil > 0.55) { const mx = Math.round(ax + (u.face > 0 ? s.w + 1 : -2)), my = Math.round(ay + s.h * 0.45); b.fillStyle = G.PAL[u.side === 1 ? 14 : 9]; b.fillRect(mx - 1, my, 3, 1); b.fillRect(mx, my - 1, 1, 3); }
        G.VFX.auraFront(b, u, ax, ay, s, gx, gy, rt, W);
        if (shielded) {
          const gl = G.glowOf(base, 12, 1, 5); b.globalAlpha = 0.14 + Math.sin(rt * 3 + u.id) * 0.06; b.drawImage(gl.tint, ax, ay); b.globalAlpha = 1;
          // 掃光：一道亮帶由下往上掃過剪影
          const sy = ((rt * 0.6 + u.id * 0.37) % 1.6) / 1.6 * (s.h + 16) - 8;
          if (sy > 0 && sy < s.h) { b.save(); b.beginPath(); b.rect(ax - 2, ay + s.h - sy - 2, s.w + 4, 3); b.clip(); b.globalAlpha = 0.5; b.drawImage(gl.tint, ax, ay); b.globalAlpha = 1; b.restore(); }
          if ((W.frame % 10) === 0) W.parts.add(u.x + G.rr(-s.w, s.w) / G.AX * 0.5, u.y + G.rr(-4, 4), G.rr(4, s.h / G.AZ), 0, 0, G.rr(8, 18), 0.9, 12, 9, 1, 0, 0.4);
        }
        // 聖所/塔的待機特效
        if (u.kind === 'holy' && u.side === 0 && (W.frame % 6) === 0) W.parts.add(u.x + G.rr(-24, 24), u.y + G.rr(-6, 6), G.rr(20, 60), 0, 0, G.rr(10, 25), 1.2, 9, 7, 1, 0, 0.5);
        if (u.kind === 'holy' && u.side === 1 && (W.frame % 8) === 0) W.parts.add(u.x + G.rr(-12, 12), u.y, G.rr(50, 70), G.rr(-5, 5), 0, G.rr(10, 20), 1.4, 2, 1, 2, -5, 0.5);
        // 血條
        const full = u.hp >= u.st.hp - 0.5;
        if (!full || u.kind !== 'creep') bars.push([u, q(gx), ay - 3]);
        if (u.follow) flags.push([q(gx), ay - (full && u.kind === 'creep' ? 2 : 6)]);
        const locked = h0 && h0.alive && h0.cmd && h0.cmd.lock && h0.cmd.t === u;
        if (!locked && tgt) arrows.push([q(gx), ay - 9 - Math.round(Math.abs(Math.sin(rt * 6)) * 2)]);
      } else if (it.j) {
        const p = it.j, s = sprOf(p.o.vis);
        const gx = p.x * G.AX - ox, gy = p.y * G.AY - oy;
        if (p.z > 3) G.pxDisc(b, gx, gy, p.o.big ? 3 : 1.5, 1, 0, 0.5);
        const custom = p.o.fx && G.VFX.drawProj(b, p, o, s, rt);
        if (s && !custom) b.drawImage(p.tx < p.x0 ? s.m : s.n, Math.round(gx - s.w / 2), Math.round(gy - p.z * G.AZ - s.h / 2));
        if (p.o.vis === 'mistic' && !custom) G.pxEllipse(b, gx, gy - p.z * G.AZ, 6 + Math.sin(rt * 40), 6 + Math.sin(rt * 40), 9, 3, rt * 40);
      }
    }
    W.parts.draw(b, ox, oy, W.frame, false);
    for (const e of W.effects) if (e.layer === 1 && e.draw) e.draw(b, o);
    // v3.0 關卡整體調色（秋天偏暖、雪地偏冷、火山偏紅、深淵壓暗偏紫）；暴風雪時再蓋一層白霧
    if (W.theme && W.theme.grade) { const [mode, col, a] = W.theme.grade; b.globalCompositeOperation = mode; b.globalAlpha = a; b.fillStyle = col; b.fillRect(0, 0, bw, bh); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; }
    if (W.bliz > 0) { b.globalAlpha = Math.min(0.28, W.bliz * 0.1, (G.SOLO_HZ.blizzard.dur - W.bliz) * 0.2 + 0.02); b.fillStyle = '#e8f2fa'; b.fillRect(0, 0, bw, bh); b.globalAlpha = 1; }
    // 迷霧：看不到的區域蓋上一層暗色（逐格淡入淡出，邊緣柔和）
    if (W.vis && !W.attract) {
      // 迷霧：地圖外圍的森林邊界也要蓋（向外延伸 PD 格，數值沿用最靠近的邊緣格），縮小時才不會出現一圈明顯的框線
      const V = W.vis, n = V.gw * V.gh, v = V.v[0], f = V.fog, k = Math.min(1, (R.dtF || 0.016) * 6);
      const PD = Math.ceil((W.ground.pad / G.AX + 80) / V.cs) + 2, GW = V.gw + PD * 2, GH = V.gh + PD * 2;
      if (!R.fogC || R.fogC.width !== GW || R.fogC.height !== GH) { R.fogC = G.canvas(GW, GH); R.fogX = R.fogC.getContext('2d'); R.fogD = R.fogX.createImageData(GW, GH); }
      for (let i = 0; i < n; i++) f[i] += ((v[i] ? 0 : 1) - f[i]) * k;
      const d = R.fogD.data;
      for (let yy = 0; yy < GH; yy++) { const sy = G.clamp(yy - PD, 0, V.gh - 1) * V.gw; for (let xx = 0; xx < GW; xx++) { const o = (yy * GW + xx) * 4, a = f[sy + G.clamp(xx - PD, 0, V.gw - 1)]; d[o] = 8; d[o + 1] = 10; d[o + 2] = 18; d[o + 3] = Math.round(a * 210); } }
      R.fogX.putImageData(R.fogD, 0, 0);
      b.imageSmoothingEnabled = true;
      b.drawImage(R.fogC, 0, 0, GW, GH, -ox - PD * V.cs * G.AX, -oy - PD * V.cs * G.AY, GW * V.cs * G.AX, GH * V.cs * G.AY);
      b.imageSmoothingEnabled = false;
    }
    // 血條
    for (const [u, cx, y] of bars) {
      const bw2 = u.kind === 'holy' ? 34 : u.static ? 28 : u.kind === 'boss' ? 24 : u.kind === 'hero' ? 16 : 10;
      const x = cx - (bw2 >> 1), f = Math.max(0, Math.round(bw2 * u.hp / u.st.hp));
      if (u.static) {                                       // 建築：粗血條（3px），雙方都用白色，敵方加刻痕
        b.fillStyle = G.PAL[0]; b.fillRect(x - 1, y - 3, bw2 + 2, 5);
        b.fillStyle = G.PAL[2]; b.fillRect(x, y - 2, bw2, 3);
        b.fillStyle = G.PAL[9]; b.fillRect(x, y - 2, f, 3);
        b.fillStyle = G.PAL[u.side === 0 ? 7 : 6]; b.fillRect(x, y, f, 1);
        if (u.side !== 0) { b.fillStyle = G.PAL[0]; for (let i = 7; i < bw2; i += 7) b.fillRect(x + i, y - 2, 1, 3); }
        continue;
      }
      b.fillStyle = G.PAL[0]; b.fillRect(x - 1, y - 1, bw2 + 2, 3);
      if (u.kind === 'hero') { b.fillStyle = G.PAL[10]; b.fillRect(x, y, f, 1); }
      else if (u.side === 0) { b.fillStyle = G.PAL[9]; b.fillRect(x, y, f, 1); }
      else if (u.side === 2) { b.fillStyle = G.PAL[13]; b.fillRect(x, y, f, 1); }
      else { for (let i = 0; i < f; i++) { b.fillStyle = G.PAL[(i % 3) === 2 ? 7 : 9]; b.fillRect(x + i, y, 1, 1); } }   // 敵方：亮白帶刻痕
      if (u.kind === 'hero') { b.fillStyle = G.PAL[3]; b.fillRect(x, y + 2, bw2, 1); b.fillStyle = G.PAL[11]; b.fillRect(x, y + 2, Math.round(bw2 * u.mp / u.st.mp), 1); b.fillStyle = G.PAL[0]; b.fillRect(x - 1, y + 3, bw2 + 2, 1); }
      // v3.2 等級：血條左邊的白字細黑邊（和跳傷害數字同風格），不加底框
      if (u.kind === 'hero' || u.kind === 'jungler') { const ls = String(u.level), lx = x - 3 - G.textW(ls); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) G.text(b, ls, lx + ox, y - 1 + oy, 0); G.text(b, ls, lx, y - 1, 9); }   // 四方向細黑邊
      if (u.kind === 'boss') G.text(b, 'BOSS', cx, y - 7, u.side === 1 ? 12 : 13, 1, 0, 0.5);
      if (u.kind === 'jungler') G.text(b, 'HUNTER', cx, y - 7, 14, 1, 0, 0.5);
    }
    for (const [x, y, t] of campTxt) G.text(b, t, x, y, 5, 1, 0, 0.5);
    // 召集中的小兵：頭上黃色小旗
    for (const [x, y0] of flags) {
      const y = y0 - (((rt * 3) | 0) % 2);
      b.fillStyle = G.PAL[0]; b.fillRect(x - 2, y - 8, 7, 5); b.fillRect(x - 2, y - 8, 3, 10);
      b.fillStyle = G.PAL[9]; b.fillRect(x - 1, y - 7, 1, 8);
      b.fillStyle = G.PAL[13]; b.fillRect(x, y - 7, 4, 3); b.fillStyle = G.PAL[14]; b.fillRect(x, y - 5, 4, 1);
    }
    // 落點箭頭（畫在最上層）
    if (mk && mk.ax != null && mk.fade > 0.3 && !W.attract) {
      const x = mk.ax, y = mk.ay;
      b.fillStyle = G.PAL[0];
      b.fillRect(x - 2, y - 9, 5, 6); b.fillRect(x - 5, y - 4, 11, 2); b.fillRect(x - 4, y - 2, 9, 1); b.fillRect(x - 3, y - 1, 7, 1); b.fillRect(x - 2, y, 5, 1); b.fillRect(x - 1, y + 1, 3, 1);
      b.fillStyle = G.PAL[13];
      b.fillRect(x - 1, y - 8, 3, 5); b.fillRect(x - 4, y - 3, 9, 1); b.fillRect(x - 3, y - 2, 7, 1); b.fillRect(x - 2, y - 1, 5, 1); b.fillRect(x - 1, y, 3, 1);
      b.fillStyle = G.PAL[14]; b.fillRect(x + 1, y - 8, 1, 5); b.fillRect(x + 1, y - 2, 1, 1);
    }
    // 目標箭頭
    for (const [x, y] of arrows) {
      b.fillStyle = G.PAL[0]; b.fillRect(x - 4, y - 1, 9, 1); b.fillRect(x - 4, y, 9, 2); b.fillRect(x - 3, y + 2, 7, 1); b.fillRect(x - 2, y + 3, 5, 1); b.fillRect(x - 1, y + 4, 3, 1);
      b.fillStyle = G.PAL[9]; b.fillRect(x - 3, y, 7, 1); b.fillRect(x - 2, y + 1, 5, 1); b.fillRect(x - 1, y + 2, 3, 1); b.fillRect(x, y + 3, 1, 1);
    }
    for (const e of W.effects) if (e.layer === 2 && e.draw) e.draw(b, o);
    // 輸出到螢幕
    G.SSQ = 1; ctx.imageSmoothingEnabled = false;
    if (hd) G.HD.render(ctx, buf, bw, bh, sc, rt, W.themeId || 'forest');   // v3.2.2 HD-2D（透視＋景深＋柔光＋調色＋光束）
    else { ctx.drawImage(buf, 0, 0, bw * SS, bh * SS, -R.fx * sc, -R.fy * sc, bw * sc, bh * sc); if (G.VOL & 2) tilt(ctx, buf, bw, bh, sc); }   // 不支援 WebGL：退回 v3.2.1 的 2D 景深
    ctx.drawImage(vign, 0, 0);
    if (W.flashScreen > 0) { ctx.fillStyle = `rgba(255,255,255,${W.flashScreen * 2.5})`; ctx.fillRect(0, 0, R.sw, R.sh); }
    if (h0 && !W.attract) {
      if (!h0.alive) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, R.sw, R.sh); }
      else if (h0.hp / h0.st.hp < 0.3) { const a = (0.3 - h0.hp / h0.st.hp) * (0.8 + Math.sin(rt * 8) * 0.4); ctx.globalAlpha = G.clamp(a * 2.5, 0, 0.8); ctx.drawImage(vign, 0, 0); ctx.drawImage(vign, 0, 0); ctx.globalAlpha = 1; }
    }
  };
  // v3.2.1 微縮景深（參考《歧路旅人》HD-2D）：畫面上下緣逐漸模糊（縮小再放大＝便宜的模糊），中間清楚，像在看一座微縮模型；再加柔光和一層暖色頂光
  let blurC = null, bloomC = null, tiltC = null;
  function tilt(ctx, buf, bw, bh, sc) {
    const q = 4, w = Math.ceil(bw / q), h = Math.ceil(bh / q);
    if (!blurC || blurC.width !== w || blurC.height !== h) blurC = G.canvas(w, h);
    const bx = blurC.getContext('2d'); bx.imageSmoothingEnabled = true; bx.clearRect(0, 0, w, h); bx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    // 柔光（HD-2D 的 bloom）：模糊圖用「濾色」疊一層，亮的地方（光暈、水面、法術）會微微發光
    //   只留亮部：模糊圖自己乘自己兩次（≈ 亮度的 4 次方），暗處幾乎歸零，不會讓整個畫面發灰
    if (!bloomC || bloomC.width !== w || bloomC.height !== h) bloomC = G.canvas(w, h);
    const lx = bloomC.getContext('2d'); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, w, h); lx.drawImage(blurC, 0, 0); lx.globalCompositeOperation = 'multiply'; lx.drawImage(blurC, 0, 0); lx.drawImage(bloomC, 0, 0); lx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.4; ctx.drawImage(bloomC, R.fx / q, R.fy / q, R.sw / sc / q, R.sh / sc / q, 0, 0, R.sw, R.sh); ctx.globalCompositeOperation = 'source-over';
    // 上下緣模糊：在小畫布上用漸層遮罩一次做好，再整張放大畫上去（只有一次全螢幕繪製，手機也順）
    if (!tiltC || tiltC.width !== w || tiltC.height !== h) tiltC = G.canvas(w, h);
    const tx = tiltC.getContext('2d'), sy0 = R.fy / q, sH = R.sh / sc / q;
    tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, w, h); tx.drawImage(blurC, 0, 0); tx.globalCompositeOperation = 'destination-in';
    const m = tx.createLinearGradient(0, sy0, 0, sy0 + sH); m.addColorStop(0, 'rgba(0,0,0,0.9)'); m.addColorStop(0.12, 'rgba(0,0,0,0.5)'); m.addColorStop(0.3, 'rgba(0,0,0,0)'); m.addColorStop(0.7, 'rgba(0,0,0,0)'); m.addColorStop(0.88, 'rgba(0,0,0,0.5)'); m.addColorStop(1, 'rgba(0,0,0,0.9)');
    tx.fillStyle = m; tx.fillRect(0, 0, w, h); tx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1; ctx.drawImage(tiltC, R.fx / q, sy0, R.sw / sc / q, sH, 0, 0, R.sw, R.sh);
    const SH = R.sh;
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    const g = ctx.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, 'rgba(255,226,170,0.10)'); g.addColorStop(0.45, 'rgba(255,226,170,0)'); g.addColorStop(1, 'rgba(20,10,40,0.16)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, R.sw, SH);
  }
  // 需要原生解析度的 UI（小地圖、大地圖）：在 UI 畫完後直接畫到螢幕；之後若有遮罩蓋上就不畫（保留 UI 畫布上的低解析版本）
  R.hi = [];
  R.hiQ = fn => R.hi.push({ fn, cov: false });
  R.blitUI = function () {
    G.setPatOffset(0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(ui, 0, 0, R.uw, R.uh, 0, 0, R.uw * R.uiS, R.uh * R.uiS);
    for (const q of R.hi) if (!q.cov) { ctx.save(); q.fn(ctx); ctx.restore(); }
    ctx.imageSmoothingEnabled = false;
  };
  return R;
})();
