'use strict';
/* =========================================================
   技能特效 v1.5：加色光暈、命中星芒、拖尾殘影、施法法陣、元素化命中
   參考：命中白閃＋爆發型粒子快速衰減、命中點火花、擴張→擴散→消散 3~6 格、
   動態彩色光源（Sea of Stars / Octopath 式）、技能預告圈
   ========================================================= */
// ---------- 加色光暈（分段而非平滑漸層，保留像素感） ----------
G._glowSpr = {};
G.glowSpr = (r, col, sq = 1) => {
  r = Math.max(2, Math.min(90, Math.round(r))); const key = r + '_' + col + '_' + sq;
  let c = G._glowSpr[key]; if (c) return c;
  const ry = Math.max(1, Math.round(r * sq)); c = G.canvas(r * 2 + 1, ry * 2 + 1);
  const x = c.getContext('2d'), id = x.createImageData(c.width, c.height), [R, Gc, B] = G.PAL_RGB[col];
  for (let yy = -ry; yy <= ry; yy++) for (let xx = -r; xx <= r; xx++) {
    const d = Math.hypot(xx / r, yy / ry); if (d > 1) continue;
    const a = d < 0.22 ? 0.9 : d < 0.45 ? 0.5 : d < 0.7 ? 0.26 : 0.1;
    const i = ((yy + ry) * c.width + xx + r) * 4; id.data[i] = R; id.data[i + 1] = Gc; id.data[i + 2] = B; id.data[i + 3] = a * 255;
  }
  x.putImageData(id, 0, 0); c.r = r; c.ry = ry; return (G._glowSpr[key] = c);
};
G.glow = (ctx, x, y, r, col, a = 1, sq = 1) => {
  if (a <= 0.02 || r < 1.5) return;
  const c = G.glowSpr(r, col, sq), pa = ctx.globalAlpha, po = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(c, Math.round(x - c.r), Math.round(y - c.ry));
  ctx.globalAlpha = pa; ctx.globalCompositeOperation = po;
};
// 加色線段
G.addLine = (ctx, x0, y0, x1, y1, w, col) => {
  const po = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = G.PAL[col];
  G.pxLine(ctx, x0, y0, x1, y1, w); ctx.globalCompositeOperation = po;
};

// ---------- 元素分類 ----------
G.elemOf = (w) => {
  const n = ((w && w.name) || '').toLowerCase();
  if (/thunder|tunder/.test(n)) return 'thunder';
  if (/meteor2/.test(n)) return 'meteor'; if (/meteor/.test(n)) return 'treemeteor';
  if (/ice/.test(n)) return 'ice'; if (/fire|flame/.test(n)) return 'fire';
  if (/solar/.test(n)) return 'solar'; if (/sun/.test(n)) return 'sun';
  if (/tomato/.test(n)) return 'tomato'; if (/punch|counterstrike/.test(n)) return 'punch';
  if (/sonic/.test(n)) return 'sonic'; if (/air/.test(n)) return 'wind';
  if (/root/.test(n)) return 'root'; if (/spear/.test(n)) return 'spear';
  if (/ground|earth|gstrike|slam/.test(n)) return 'earth'; if (/stone/.test(n)) return 'stone';
  return 'arcane';
};
// 強化版（進階技）：更大、更亮
G.elemStrong = (w) => /bomb|blast|cannon|storm|solar|meteor2|counterstrike|sonic|earthquake|gstrike|zone|misticball/.test(((w && w.name) || '').toLowerCase());
// c 主色 / c2 亮色 / cd 暗色
G.ELEM = {
  arcane: { c: 17, c2: 9, cd: 3 }, ice: { c: 18, c2: 9, cd: 12 }, fire: { c: 14, c2: 13, cd: 15 }, sun: { c: 13, c2: 9, cd: 14 }, solar: { c: 10, c2: 13, cd: 15 },
  tomato: { c: 10, c2: 11, cd: 15 }, punch: { c: 13, c2: 9, cd: 14 }, wind: { c: 18, c2: 9, cd: 7 }, sonic: { c: 17, c2: 18, cd: 12 }, root: { c: 11, c2: 20, cd: 16 },
  spear: { c: 7, c2: 9, cd: 4 }, earth: { c: 21, c2: 8, cd: 4 }, stone: { c: 6, c2: 21, cd: 4 }, thunder: { c: 18, c2: 9, cd: 12 }, meteor: { c: 14, c2: 13, cd: 15 },
  treemeteor: { c: 11, c2: 13, cd: 16 }, shield: { c: 12, c2: 9, cd: 12 }, rage: { c: 10, c2: 14, cd: 15 }, zap: { c: 18, c2: 9, cd: 12 }
};
const EL = el => G.ELEM[el] || G.ELEM.arcane;
const SX = (x, o) => x * G.AX - o.x, SY = (y, z, o) => y * G.AY - z * G.AZ - o.y;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

G.VFX = {
  // ===== 基本零件 =====
  // 動態光源（空中，加色）。r 為美術像素
  light(W, x, y, z, r, col, dur, a = 0.7, flick = 0) {
    W.effects.push({ t: 0, dur, layer: 1, draw(ctx, o) { const p = this.t / this.dur, k = (1 - p) * (1 - p) * (flick ? 0.8 + 0.2 * Math.sin(this.t * 70) : 1); G.glow(ctx, SX(x, o), SY(y, z, o), r * (0.65 + 0.35 * Math.min(1, p * 6)), col, a * k); } });
  },
  // 地面光（照亮地板，壓扁）
  groundLight(W, x, y, r, col, dur, a = 0.6) {
    W.effects.push({ t: 0, dur, layer: 0, draw(ctx, o) { const p = this.t / this.dur; G.glow(ctx, SX(x, o), SY(y, 0, o), r, col, a * (1 - p), 0.6); } });
  },
  // 命中星芒：前 30% 白色，之後轉元素色並收縮
  spark(W, x, y, z, s, col, dur = 0.16) {
    W.effects.push({
      t: 0, dur, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, cx = Math.round(SX(x, o)), cy = Math.round(SY(y, z, o));
        const L = Math.max(1, Math.round(s * (p < 0.2 ? 0.55 + p * 2.25 : 1 - (p - 0.2) / 0.8 * 0.85)));
        G.glow(ctx, cx, cy, s * 1.4, col, 0.55 * (1 - p));
        ctx.fillStyle = G.PAL[p < 0.3 ? 9 : col];
        const v = Math.round(L * 0.75);
        ctx.fillRect(cx - L, cy, L * 2 + 1, 1); ctx.fillRect(cx, cy - v, 1, v * 2 + 1);
        if (s >= 9 && p < 0.6) { ctx.fillRect(cx - (L >> 1), cy - 1, L + 1, 3); ctx.fillRect(cx - 1, cy - (v >> 1), 3, v + 1); }
        const d = Math.round(L * 0.38); for (let i = 1; i <= d; i++) { ctx.fillRect(cx + i, cy + i, 1, 1); ctx.fillRect(cx - i, cy - i, 1, 1); ctx.fillRect(cx + i, cy - i, 1, 1); ctx.fillRect(cx - i, cy + i, 1, 1); }
        if (p < 0.5) { ctx.fillStyle = G.PAL[9]; ctx.fillRect(cx - 1, cy - 1, 3, 3); }
      }
    });
  },
  // 空中衝擊環（以命中點為中心的橢圓）
  ringAir(W, x, y, z, r0, r1, dur, col, th = 1) {
    W.effects.push({
      t: 0, dur, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, e = 1 - (1 - p) * (1 - p), r = r0 + (r1 - r0) * e; if (p > 0.75 && (((this.t * 40) | 0) & 1)) return;
        for (let k = 0; k < th; k++) G.pxEllipse(ctx, SX(x, o), SY(y, z, o), Math.max(1, r - k), Math.max(1, (r - k) * 0.55), p < 0.25 ? 9 : col);
      }
    });
  },
  // 爆發粒子（快速衰減）
  burst(W, x, y, z, n, c1, c2, s0, s1, l0, l1, grav = 0, drag = 4, sz = 1, up0 = 20, up1 = 120) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = G.rr(s0, s1); W.parts.add(x, y, z, Math.cos(a) * s, Math.sin(a) * s * 0.7, G.rr(up0, up1), G.rr(l0, l1), c1, c2, typeof sz === 'number' ? sz : G.ri(sz[0], sz[1]), grav, drag, 2); }
  },
  // 延遲執行（以特效時間軸，不用 setTimeout）
  later(W, d, fn) { const sk = G.VFX._sk; W.effects.push({ t: 0, dur: d + 0.001, layer: 9, update() { if (this.t >= d && !this.done) { this.done = 1; if (sk && W.skFx && !G.VFX._sk) W.skFx(fn); else fn(); } } }); },
  // 地面裂痕
  cracks(W, x, y, R, dur = 1.4, n = 6) {
    const L = []; for (let i = 0; i < n; i++) {
      let a = i / n * 6.283 + G.rr(-0.3, 0.3); const r0 = G.rr(9, 13); let px = Math.cos(a) * r0, py = Math.sin(a) * r0 * 0.6; const seg = [[px, py]], len = R * G.AX * G.rr(0.3, 0.55), steps = 4;
      for (let k = 0; k < steps; k++) { a += G.rr(-0.5, 0.5); px += Math.cos(a) * len / steps; py += Math.sin(a) * len / steps * 0.6; seg.push([px, py]); }
      L.push(seg);
    }
    W.effects.push({
      t: 0, dur, layer: 0, draw(ctx, o) {
        const p = this.t / this.dur, g = Math.min(1, this.t / 0.12), cx = SX(x, o), cy = SY(y, 0, o);
        for (const seg of L) { const m = Math.max(1, Math.round((seg.length - 1) * g)); for (let k = 0; k < m; k++) { if (p > 0.4 && G.hash(k * 13 + seg.length, (this.t * 30) | 0) < (p - 0.4) / 0.6) continue; ctx.fillStyle = G.PAL[6]; G.pxLine(ctx, cx + seg[k][0], cy + seg[k][1] + 1, cx + seg[k + 1][0], cy + seg[k + 1][1] + 1, 1); ctx.fillStyle = G.PAL[3]; G.pxLine(ctx, cx + seg[k][0], cy + seg[k][1], cx + seg[k + 1][0], cy + seg[k + 1][1], 1); } }
      }
    });
  },
  // 鋸齒電弧（a、b 可為單位，會追蹤位置）
  arc(W, a, b, dur, col = 18, seg = 7) {
    const P = q => q.alive !== undefined ? [q.x, q.y, (q.z || 0) + (q.vis && q.vis.fly || 0) + (q.static ? 20 : 10)] : q;
    W.effects.push({
      t: 0, dur, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, [ax, ay, az] = P(a), [bx, by, bz] = P(b), x0 = SX(ax, o), y0 = SY(ay, az, o), x1 = SX(bx, o), y1 = SY(by, bz, o);
        const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, fr = (this.t * 30) | 0, pts = [[x0, y0]];
        for (let i = 1; i < seg; i++) { const j = (G.hash(i * 7, fr) - 0.5) * Math.min(10, l * 0.25); pts.push([x0 + dx * i / seg + nx * j, y0 + dy * i / seg + ny * j]); }
        pts.push([x1, y1]);
        const w = p < 0.3 ? 3 : 2;
        for (let i = 0; i < pts.length - 1; i++) G.addLine(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, col);
        ctx.fillStyle = G.PAL[9]; for (let i = 0; i < pts.length - 1; i++) G.pxLine(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1);
        G.glow(ctx, x1, y1, 8, col, 0.6 * (1 - p)); G.glow(ctx, x0, y0, 5, col, 0.4 * (1 - p));
      }
    });
  },

  // ===== 施法預備：腳下法陣 + 聚氣粒子 + 手部光 =====
  cast(W, u, el) {
    const E = EL(el), big = u.kind === 'boss', R = big ? 18 : 13, hz = (u.vis.fly || 0) + (big ? 22 : 14), hx = u.x + u.face * (big ? 12 : 8);
    W.effects.push({
      t: 0, dur: 0.5, layer: 0, draw(ctx, o) {
        const p = this.t / this.dur, k = p < 0.18 ? p / 0.18 : 1, cx = SX(u.x, o), cy = SY(u.y, 0, o), rx = R * k, ry = rx * 0.42;
        if (p > 0.7 && (((this.t * 30) | 0) & 1)) return;
        G.glow(ctx, cx, cy, rx + 4, E.c, 0.35 * (1 - p), 0.45);
        G.pxEllipse(ctx, cx, cy, rx, ry, E.c, 6, this.t * 40);
        G.pxEllipse(ctx, cx, cy, rx * 0.62, ry * 0.62, E.c2);
        ctx.fillStyle = G.PAL[E.c2];
        for (let i = 0; i < 4; i++) { const a = -this.t * 6 + i * 1.571; ctx.fillRect(Math.round(cx + Math.cos(a) * rx * 0.82), Math.round(cy + Math.sin(a) * ry * 0.82), 1, 1); }
      }
    });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.283, d = G.rr(22, 34), life = G.rr(0.18, 0.26), sx = hx + Math.cos(a) * d, sy = u.y + Math.sin(a) * d * 0.5, sz = hz + G.rr(-12, 12);
      W.parts.add(sx, sy, sz, (hx - sx) / life, (u.y - sy) / life, (hz - sz) / life, life, E.c2, E.c, 1, 0, 0, 2);
    }
    G.VFX.light(W, hx, u.y, hz, big ? 14 : 10, E.c, 0.35, 0.8);
  },
  // 增益技施放
  buffCast(W, u, el) {
    const E = EL(el), z = (u.vis.fly || 0) + 10;
    if (el === 'shield') {
      G.FX.ring(W, u.x, u.y, 44, 12, 0.35, 12, 2); G.VFX.light(W, u.x, u.y, z, 22, 12, 0.5, 0.7); G.VFX.spark(W, u.x, u.y, z + 14, 9, 12, 0.22);
      for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283, d = G.rr(30, 44), l = 0.3, sx = u.x + Math.cos(a) * d, sy = u.y + Math.sin(a) * d * 0.6, sz = z + G.rr(-6, 16); W.parts.add(sx, sy, sz, (u.x - sx) / l, (u.y - sy) / l, (z - sz) / l, l, 9, 12, 1, 0, 0, 2); }
    } else if (el === 'rage') {
      G.FX.ring(W, u.x, u.y, 4, 44, 0.45, 10, 2); G.VFX.ringAir(W, u.x, u.y, z, 4, 26, 0.25, 14, 2); G.VFX.light(W, u.x, u.y, z, 26, 10, 0.6, 0.8, 1); G.VFX.groundLight(W, u.x, u.y, 24, 10, 0.6, 0.6);
      G.VFX.burst(W, u.x, u.y, 6, 26, 13, 15, 30, 110, 0.4, 0.8, -80, 2, [1, 2], 60, 180);
    } else {
      G.FX.ring(W, u.x, u.y, 4, 40, 0.4, 18, 2); G.VFX.light(W, u.x, u.y, z, 22, 18, 0.5, 0.8, 1); G.VFX.spark(W, u.x, u.y, z + 6, 10, 18, 0.2);
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + G.rr(-0.4, 0.4); G.VFX.arc(W, u, [u.x + Math.cos(a) * 34, u.y + Math.sin(a) * 22, 0], 0.22, 18, 5); }
      G.VFX.burst(W, u.x, u.y, z, 14, 9, 18, 80, 200, 0.12, 0.3, 0, 6);
    }
  },

  // ===== 投射物：拖尾粒子（updateProj 每 tick 呼叫） =====
  trail(W, p, nx, ny, nz) {
    const el = p.o.fx, dx = nx - p.x, dy = ny - p.y, l = Math.hypot(dx, dy) || 1, bx = -dx / l * 40, by = -dy / l * 40, S = p.o.fxS;
    const add = (c1, c2, s = 1, gr = 0, vz = 0, life = 0.25) => W.parts.add(nx + G.rr(-2, 2), ny + G.rr(-2, 2), nz + G.rr(-2, 2), bx + G.rr(-14, 14), by + G.rr(-10, 10), vz + G.rr(-8, 8), life * G.rr(0.7, 1.3), c1, c2, s, gr, 2, 3);
    switch (el) {
      case 'ice': add(9, 18, 1, 160, 10, 0.32); if (S) add(18, 12, 1, 120, 0, 0.3); break;
      case 'fire': add(13, 14, G.ri(1, 2), -60, 20, 0.35); add(14, 15, 1, -40, 10, 0.3); if (Math.random() < 0.35) add(5, 3, 2, -20, 10, 0.5); break;
      case 'tomato': if (Math.random() < 0.4) add(10, 15, 1, 380, 0, 0.4); break;
      case 'wind': add(9, 7, 1, 0, 0, 0.14); break;
      case 'sonic': add(17, 18, 1, 0, 0, 0.18); add(9, 17, 1, 0, 0, 0.12); break;
      case 'punch': add(9, 13, 1, 0, 0, 0.14); if (S) add(14, 13, 1, 0, 0, 0.16); break;
      case 'stone': if (Math.random() < 0.6) add(21, 6, 2, 50, 0, 0.35); break;
      default: add(9, 17, 1, 0, 0, 0.22); if (Math.random() < 0.4) add(17, 3, 1, 0, 0, 0.35); if (S) add(17, 9, 1, 0, 0, 0.28);
    }
  },
  // 投射物外觀；回傳 true 表示已畫完（不再畫原精靈）
  drawProj(ctx, p, o, s, rt) {
    const el = p.o.fx, E = EL(el), S = p.o.fxS, sx = SX(p.x, o), sy = SY(p.y, p.z, o), H = p.hist || [];
    let dx = (p.tx - p.x0) * G.AX, dy = (p.ty - p.y0) * G.AY;
    if (H.length) { const h = H[0]; const ddx = (p.x - h[0]) * G.AX, ddy = (p.y - h[1]) * G.AY - (p.z - h[2]) * G.AZ; if (Math.hypot(ddx, ddy) > 0.5) { dx = ddx; dy = ddy; } }
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const hp = (h) => [SX(h[0], o), SY(h[1], h[2], o)], n = H.length;
    if (p.o.ult) {                                                    // v3.8 大招子彈：外圈大光暈＋環繞光點
      G.glow(ctx, sx, sy, 26, E.c, 0.5 + 0.15 * Math.sin(rt * 30)); G.glow(ctx, sx, sy, 12, E.c2, 0.5);
      ctx.fillStyle = G.PAL[E.c2]; for (let j = 0; j < 6; j++) { const a = rt * 10 + j * 1.047; ctx.fillRect(Math.round(sx + Math.cos(a) * 11), Math.round(sy + Math.sin(a) * 7), 2, 2); }
    }
    switch (el) {
      case 'ice': {
        const L = S ? 7 : 5;
        for (let i = 0; i < n; i++) { const [hx, hy] = hp(H[i]), k = (i + 1) / (n + 1); ctx.globalAlpha = 0.45 * k; ctx.fillStyle = G.PAL[18]; G.pxLine(ctx, hx - dx * 2, hy - dy * 2, hx + dx * 3, hy + dy * 3, 1); }
        ctx.globalAlpha = 1;
        G.glow(ctx, sx, sy, S ? 12 : 9, 18, 0.55);
        ctx.fillStyle = G.PAL[12]; G.pxLine(ctx, sx - dx * L, sy - dy * L, sx + dx * L, sy + dy * L, 3);
        ctx.fillStyle = G.PAL[18]; G.pxLine(ctx, sx - dx * (L - 1), sy - dy * (L - 1), sx + dx * L, sy + dy * L, 2);
        ctx.fillStyle = G.PAL[9]; G.pxLine(ctx, sx, sy, sx + dx * (L + 1), sy + dy * (L + 1), 1);
        if (((rt * 20) | 0) & 1) { const tx = Math.round(sx + dx * (L + 1)), ty = Math.round(sy + dy * (L + 1)); ctx.fillRect(tx - 2, ty, 5, 1); ctx.fillRect(tx, ty - 2, 1, 5); }
        return true;
      }
      case 'fire': {
        for (let i = 0; i < n; i++) { const [hx, hy] = hp(H[i]), k = (i + 1) / (n + 1), r = (S ? 4.5 : 3.2) * k; G.pxDisc(ctx, hx, hy, r, r, k < 0.4 ? 15 : k < 0.7 ? 14 : 13, 0.85); }
        G.glow(ctx, sx, sy, S ? 17 : 12, 14, 0.6 + 0.15 * Math.sin(rt * 55));
        const r = S ? 5 : 4; G.pxDisc(ctx, sx, sy, r, r, 14, 1); G.pxDisc(ctx, sx + dx, sy + dy, r - 1.5, r - 1.5, 13, 1); G.pxDisc(ctx, sx + dx * 1.5, sy + dy * 1.5 - 0.5, 1.5, 1.5, 9, 1);
        ctx.fillStyle = G.PAL[13]; for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(sx - dx * (r + 1 + i * 2) + G.rr(-1.5, 1.5)), Math.round(sy - dy * (r + 1 + i * 2) + G.rr(-1.5, 1.5)), 1, 1);
        return true;
      }
      case 'wind': case 'sonic': {
        const px = -dy, py = dx, N = S ? 9 : 7;
        const cres = (cx, cy, sc, col, w) => { ctx.fillStyle = G.PAL[col]; for (let k = -N; k <= N; k++) { const f = k / N, off = Math.cos(f * 1.571) * 4 * sc; ctx.fillRect(Math.round(cx + px * k * sc + dx * off), Math.round(cy + py * k * sc + dy * off), w, w); } };
        for (let i = 0; i < n; i++) { const [hx, hy] = hp(H[i]), k = (i + 1) / (n + 1); ctx.globalAlpha = 0.35 * k; cres(hx, hy, 1, el === 'sonic' ? 17 : 7, 1); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = G.PAL[7]; for (let j = -1; j <= 1; j++) { const bx = sx + px * j * 4 - dx * 4, by = sy + py * j * 4 - dy * 4, L = 9 + ((G.hash(j + 5, (rt * 20) | 0) * 6) | 0); G.pxLine(ctx, bx, by, bx - dx * L, by - dy * L, 1); }
        if (el === 'sonic') {
          G.glow(ctx, sx, sy, 14, 17, 0.45);
          for (let i = 2; i >= 0; i--) { const pul = 0.6 + i * 0.28 + Math.sin(rt * 30 + i) * 0.06; cres(sx - dx * i * 3, sy - dy * i * 3, pul, [9, 18, 17][i], i ? 1 : 2); }
        } else {
          G.glow(ctx, sx, sy, 12, 18, 0.35);
          cres(sx, sy, 1, 18, 2); cres(sx + dx, sy + dy, 0.9, 9, 1);
        }
        return true;
      }
      case 'punch': {
        if (s) for (let i = 0; i < n; i++) { const [hx, hy] = hp(H[i]), k = (i + 1) / (n + 1); ctx.globalAlpha = 0.32 * k; ctx.drawImage(dx < 0 ? s.m : s.n, Math.round(hx - s.w / 2), Math.round(hy - s.h / 2)); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = G.PAL[9]; for (let j = -2; j <= 2; j++) { const by = sy + j * 2, bx = sx - dx * 6, L = 5 + ((G.hash(j + 9, (rt * 24) | 0) * 8) | 0); G.pxLine(ctx, bx, by, bx - dx * L, by, 1); }
        G.glow(ctx, sx, sy, S ? 14 : 10, S ? 14 : 13, 0.55);
        return false;
      }
      case 'tomato': if (S) G.glow(ctx, sx, sy, 9, 10, 0.35); return false;
      case 'stone': G.glow(ctx, sx, sy, 7, 21, 0.25); return false;
      default: {   // 秘術
        for (let i = 0; i < n; i++) { const [hx, hy] = hp(H[i]), k = (i + 1) / (n + 1), r = (S ? 3 : 2.2) * k + 0.5; G.pxDisc(ctx, hx, hy, r, r, 17, 0.55 * k + 0.1); }
        G.glow(ctx, sx, sy, S ? 15 : 11, 17, 0.55 + 0.12 * Math.sin(rt * 40));
        const r = S ? 4 : 3; G.pxDisc(ctx, sx, sy, r, r, 17, 1); G.pxDisc(ctx, sx - 0.5, sy - 0.5, r - 1.5, r - 1.5, 9, 1);
        ctx.fillStyle = G.PAL[9]; const m = S ? 3 : 2, R = S ? 7 : 5;
        for (let j = 0; j < m; j++) { const a = rt * 16 + j * 6.283 / m; ctx.fillRect(Math.round(sx + Math.cos(a) * R), Math.round(sy + Math.sin(a) * R * 0.6), 1, 1); }
        return true;
      }
    }
  },

  // ===== 投射物命中（依元素） =====
  impact(W, el, x, y, z, o = {}, splash = 0) {
    const E = EL(el), S = o.fxS, R = splash ? splash * G.AX : 0;
    switch (el) {
      case 'ice':
        G.VFX.spark(W, x, y, z, S ? 10 : 8, 18); G.VFX.ringAir(W, x, y, z, 3, S ? 22 : 16, 0.22, 18);
        G.VFX.burst(W, x, y, z, S ? 18 : 12, 9, 18, 60, 190, 0.3, 0.6, 520, 1, [1, 2], 60, 170);
        G.FX.ring(W, x, y, 4, S ? 44 : 30, 0.35, 18, 1); G.VFX.crystals(W, x, y, S ? 6 : 4, S ? 28 : 18);
        G.VFX.light(W, x, y, z, S ? 30 : 22, 18, 0.35, 0.7); G.VFX.groundLight(W, x, y, S ? 24 : 16, 18, 0.5, 0.5);
        for (let i = 0; i < 5; i++) W.parts.add(x + G.rr(-8, 8), y + G.rr(-4, 4), G.rr(2, 10), G.rr(-8, 8), 0, G.rr(6, 16), G.rr(0.6, 1.0), 7, 18, 1, 0, 1, 2);
        break;
      case 'fire': {
        const big = S || splash;
        G.VFX.spark(W, x, y, z, big ? 12 : 9, 13); G.VFX.flare(W, x, y, z, big ? 15 : 10);
        G.VFX.burst(W, x, y, z, big ? 26 : 16, 13, 15, 40, 160, 0.4, 0.9, -70, 2.5, [1, 2], 40, 160);
        G.FX.smoke(W, x, y, z, big ? 8 : 5, 5); G.FX.scorch(W, x, y, big ? 22 : 14, 3);
        G.VFX.light(W, x, y, z, big ? 44 : 32, 14, 0.5, 0.85, 1); G.VFX.groundLight(W, x, y, big ? 36 : 26, 14, 0.6, 0.65);
        if (big) { G.FX.ring(W, x, y, 6, 50, 0.35, 14, 2); W.shake(0.3); }
        break;
      }
      case 'tomato': {
        const RR = splash || 40;
        G.VFX.spark(W, x, y, z, S ? 12 : 9, 10); G.VFX.ringAir(W, x, y, 4, 4, RR * G.AX, 0.25, 10, 2);
        G.FX.ring(W, x, y, 4, RR, 0.3, 10, 2); G.FX.wave(W, x, y, RR, 0.3);
        G.VFX.burst(W, x, y, 6, S ? 30 : 20, 10, 15, 60, 210, 0.4, 0.8, 600, 1, [1, 2], 60, 200);
        G.VFX.burst(W, x, y, 6, 8, 13, 21, 40, 140, 0.4, 0.7, 500, 1, 1, 60, 160);
        W.decals.push({ x, y, r: RR * 0.55, t: 0, dur: 4, col: 15 });
        G.VFX.light(W, x, y, 8, S ? 34 : 26, 10, 0.3, 0.55); G.FX.smoke(W, x, y, 4, 5, 6);
        if (S) { G.VFX.ringAir(W, x, y, 10, 4, RR * G.AX * 0.7, 0.2, 13, 1); W.flashScreen = Math.max(W.flashScreen, 0.05); }
        break;
      }
      case 'punch':
        G.VFX.spark(W, x, y, z, S ? 16 : 13, S ? 14 : 13, 0.22); G.VFX.ringAir(W, x, y, z, 3, S ? 28 : 22, 0.2, 9, 2); G.VFX.ringAir(W, x, y, z, 2, S ? 18 : 14, 0.28, 13, 1);
        G.VFX.lines(W, x, y, z, 8, S ? 16 : 12, 9);
        G.VFX.burst(W, x, y, z, 10, 9, 13, 100, 240, 0.12, 0.25, 0, 7);
        G.VFX.light(W, x, y, z, 30, 13, 0.25, 0.8); W.hitstop = Math.max(W.hitstop || 0, S ? 0.09 : 0.07); W.shake(S ? 0.4 : 0.3);
        W.flashScreen = Math.max(W.flashScreen, 0.04);
        break;
      case 'stone':
        G.VFX.spark(W, x, y, z, 8, 21); G.VFX.burst(W, x, y, z, 12, 21, 6, 40, 150, 0.4, 0.8, -10, 3, 2, 10, 60);
        G.VFX.burst(W, x, y, z, 10, 5, 3, 60, 160, 0.4, 0.7, 520, 1, [1, 2], 80, 180); G.FX.ring(W, x, y, 4, 30, 0.3, 6, 1); W.shake(0.2);
        break;
      case 'wind': case 'sonic': G.VFX.spark(W, x, y, z, 7, E.c); break;
      default:   // 秘術
        G.VFX.spark(W, x, y, z, S ? 11 : 8, 17); G.VFX.ringAir(W, x, y, z, 3, S ? 26 : 18, 0.25, 17, S ? 2 : 1);
        G.VFX.burst(W, x, y, z, S ? 20 : 12, 9, 17, 60, 170, 0.2, 0.45, 0, 4);
        G.VFX.light(W, x, y, z, S ? 38 : 26, 17, 0.32, 0.65); G.VFX.groundLight(W, x, y, S ? 26 : 18, 17, 0.4, 0.45);
        if (S) { G.FX.ring(W, x, y, 4, 44, 0.35, 17, 2); W.shake(0.25); }
    }
  },
  // 技能傷害的命中點小火花（每個被打到的目標）
  hitSpark(W, el, x, y, z, crit) {
    const E = EL(el);
    switch (el) {
      case 'wind': case 'sonic': G.VFX.cut(W, x, y, z, el === 'sonic' ? 17 : 18); break;
      case 'earth': case 'root': case 'spear': case 'stone': G.VFX.spark(W, x, y, z, 5, 9, 0.12); G.VFX.burst(W, x, y, z, 5, E.c, 6, 30, 90, 0.3, 0.5, 300, 2, 1, 40, 100); break;
      case 'thunder': G.VFX.spark(W, x, y, z, 7, 18, 0.14); G.VFX.burst(W, x, y, z, 6, 9, 18, 90, 200, 0.1, 0.22, 0, 6); break;
      case 'fire': G.VFX.spark(W, x, y, z, 6, 14, 0.12); G.VFX.burst(W, x, y, z, 4, 13, 15, 30, 90, 0.3, 0.5, -50, 2); break;
      case 'ice': G.VFX.spark(W, x, y, z, 6, 18, 0.12); G.VFX.burst(W, x, y, z, 4, 9, 18, 40, 120, 0.25, 0.45, 400, 2); break;
      case 'sun': case 'solar': G.VFX.spark(W, x, y, z, 5, E.c, 0.1); break;
      default: G.VFX.spark(W, x, y, z, 6, E.c, 0.12);
    }
    if (crit) G.VFX.spark(W, x, y, z + 2, 12, 14, 0.2);
  },
  // 斬痕（兩道交叉的切線）
  cut(W, x, y, z, col) {
    const a = G.rr(-0.5, 0.5);
    W.effects.push({
      t: 0, dur: 0.16, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, cx = SX(x, o), cy = SY(y, z, o), L = 9 * Math.min(1, p * 5), c = p < 0.35 ? 9 : col;
        for (const b of [a + 0.75, a - 0.75]) { const ex = Math.cos(b) * L, ey = Math.sin(b) * L * 0.8; ctx.fillStyle = G.PAL[c]; G.pxLine(ctx, cx - ex, cy - ey, cx + ex, cy + ey, p < 0.4 ? 2 : 1); }
        G.glow(ctx, cx, cy, 8, col, 0.5 * (1 - p));
      }
    });
  },
  // 放射速度線
  lines(W, x, y, z, n, R, col) {
    const as = []; for (let i = 0; i < n; i++) as.push(i / n * 6.283 + G.rr(-0.2, 0.2));
    W.effects.push({ t: 0, dur: 0.16, layer: 1, draw(ctx, o) { const p = this.t / this.dur, cx = SX(x, o), cy = SY(y, z, o); ctx.fillStyle = G.PAL[col]; for (const a of as) { const r0 = R * (0.4 + p * 0.8), r1 = r0 + R * 0.5 * (1 - p); G.pxLine(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7, 1); } } });
  },
  // 火焰綻放（同心色帶）
  flare(W, x, y, z, r) {
    W.effects.push({
      t: 0, dur: 0.3, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, cx = SX(x, o), cy = SY(y, z, o), rr = r * (0.4 + 0.6 * Math.sqrt(p)), a = 1 - p;
        G.pxDisc(ctx, cx, cy, rr, rr * 0.85, 15, a * 0.9); G.pxDisc(ctx, cx, cy - 1, rr * 0.75, rr * 0.65, 14, a); G.pxDisc(ctx, cx, cy - 1, rr * 0.45, rr * 0.4, 13, a); if (p < 0.4) G.pxDisc(ctx, cx, cy - 1, rr * 0.2, rr * 0.2, 9, 1);
      }
    });
  },
  // 冰晶：命中處冒出短冰柱
  crystals(W, x, y, n, R) {
    const pts = []; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, G.rr(0, 0.08), G.ri(5, 9)]); }
    W.effects.push({
      t: 0, dur: 0.8, layer: 1, draw(ctx, o) {
        for (const [px, py, d, H] of pts) {
          const k = G.clamp((this.t - d) / 0.07, 0, 1) * (this.t > 0.55 ? (0.8 - this.t) / 0.25 : 1), hh = Math.round(H * k); if (hh <= 0) continue;
          const sx = Math.round(SX(px, o)), sy = Math.round(SY(py, 0, o));
          ctx.fillStyle = G.PAL[12]; ctx.fillRect(sx - 1, sy - hh, 3, hh); ctx.fillStyle = G.PAL[18]; ctx.fillRect(sx, sy - hh, 1, hh); ctx.fillStyle = G.PAL[9]; ctx.fillRect(sx, sy - hh - 1, 1, 2);
        }
      }
    });
  },

  // ===== 光束（陽光炙烤 / 太陽耀斑） =====
  beam(W, u, t, dur, el) {
    const E = EL(el), S = el === 'solar';
    W.effects.push({
      t: 0, dur, layer: 1,
      update() { if (!t.alive) return; if (W.frame % 2 === 0) { W.parts.add(t.x + G.rr(-6, 6), t.y + G.rr(-3, 3), (t.z || 0) + G.rr(4, 14), G.rr(-10, 10), 0, G.rr(30, 70), G.rr(0.3, 0.6), 13, E.c === 13 ? 14 : 15, 1, -30, 1, 2); } if (Math.random() < 0.3) G.VFX.burst(W, t.x, t.y, (t.z || 0) + 8, 2, 9, E.c, 60, 140, 0.1, 0.2, 0, 5); },
      draw(ctx, o) {
        if (!t.alive && this.t > 0.05) return;
        const p = this.t / this.dur, fade = p > 0.8 ? (1 - p) / 0.2 : 1, x0 = SX(u.x + u.face * 6, o), y0 = SY(u.y, (u.z || 0) + (u.vis.fly || 0) + 14, o), x1 = SX(t.x, o), y1 = SY(t.y, (t.z || 0) + (t.vis.fly || 0) + (t.static ? 20 : 8), o);
        const L = Math.hypot(x1 - x0, y1 - y0), N = Math.max(2, Math.round(L / 7)), w = Math.max(1, Math.round(((S ? 5 : 4) + Math.sin(this.t * 60)) * fade));
        for (let i = 0; i <= N; i++) G.glow(ctx, x0 + (x1 - x0) * i / N, y0 + (y1 - y0) * i / N, S ? 8 : 6, E.c, 0.28 * fade);
        G.addLine(ctx, x0, y0, x1, y1, w, E.c); ctx.fillStyle = G.PAL[S ? 13 : 13]; G.pxLine(ctx, x0, y0, x1, y1, Math.max(1, w - 2)); ctx.fillStyle = G.PAL[9]; G.pxLine(ctx, x0, y0, x1, y1, 1);
        G.glow(ctx, x0, y0, S ? 10 : 8, E.c, 0.8 * fade); G.pxDisc(ctx, x0, y0, 2, 2, 9, 1);
        G.glow(ctx, x1, y1, (S ? 15 : 12) + Math.sin(this.t * 50) * 2, E.c, 0.8 * fade); G.pxDisc(ctx, x1, y1, 3, 3, 9, 1);
        const ra = this.t * 12; ctx.fillStyle = G.PAL[13]; for (let i = 0; i < 4; i++) { const a = ra + i * 1.571; G.pxLine(ctx, x1 + Math.cos(a) * 4, y1 + Math.sin(a) * 4, x1 + Math.cos(a) * 7, y1 + Math.sin(a) * 7, 1); }
        G.glow(ctx, x1, SY(t.y, 0, o), S ? 20 : 15, E.c, 0.4 * fade, 0.6);
      }
    });
    if (S) G.FX.scorch(W, t.x, t.y, 16, dur + 2);
  },

  // ===== 落雷 =====
  bolt(W, x, y, S) {
    const N = 12, pts = []; let cx = 0; for (let i = 0; i <= N; i++) { pts.push([cx, i / N]); cx += G.rr(-7, 7); } pts[N][0] = 0;
    const br = []; for (let b = 0; b < (S ? 3 : 2); b++) { const i0 = G.ri(3, 8), sg = Math.random() < 0.5 ? -1 : 1, q = [[pts[i0][0], pts[i0][1]]]; let bx = pts[i0][0], by = pts[i0][1]; for (let k = 0; k < 3; k++) { bx += sg * G.rr(4, 9); by += G.rr(0.04, 0.08); q.push([bx, by]); } br.push(q); }
    const TOP = 150;
    W.effects.push({
      t: 0, dur: 0.4, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, bx = SX(x, o), by = SY(y, 0, o), early = this.t < 0.07;
        if (!early && (((this.t * 40) | 0) & 1)) { G.glow(ctx, bx, by, 18, 18, 0.4 * (1 - p), 0.6); return; }
        const P = q => [bx + q[0], by - TOP * (1 - q[1])];
        for (let i = 0; i < N; i += 2) { const [gx, gy] = P(pts[i]); G.glow(ctx, gx, gy, early ? 10 : 7, 18, 0.45 * (1 - p)); }
        for (let i = 0; i < N; i++) { const [ax, ay] = P(pts[i]), [cx2, cy2] = P(pts[i + 1]); G.addLine(ctx, ax, ay, cx2, cy2, early ? 5 : 3, 18); }
        for (const q of br) for (let i = 0; i < q.length - 1; i++) { const [ax, ay] = P(q[i]), [cx2, cy2] = P(q[i + 1]); G.addLine(ctx, ax, ay, cx2, cy2, early ? 2 : 1, 18); if (early) { ctx.fillStyle = G.PAL[9]; G.pxLine(ctx, ax, ay, cx2, cy2, 1); } }
        ctx.fillStyle = G.PAL[9]; for (let i = 0; i < N; i++) { const [ax, ay] = P(pts[i]), [cx2, cy2] = P(pts[i + 1]); G.pxLine(ctx, ax, ay, cx2, cy2, early ? 2 : 1); }
        G.pxDisc(ctx, bx, by, 9 * (1 - p), 4.5 * (1 - p), 9, 1);
      }
    });
    // 地面電流爬行
    W.effects.push({
      t: 0, dur: 0.38, layer: 1, draw(ctx, o) {
        const fr = (this.t * 20) | 0, bx = SX(x, o), by = SY(y, 0, o);
        for (let j = 0; j < 3; j++) { let px = bx, py = by; const a = G.hash(j * 31, fr) * 6.283; for (let k = 0; k < 4; k++) { const nx = px + Math.cos(a + (G.hash(j * 7 + k, fr) - 0.5) * 1.5) * 4, ny = py + Math.sin(a + (G.hash(k * 5 + j, fr) - 0.5) * 1.5) * 2.5; G.addLine(ctx, px, py, nx, ny, 1, k < 2 ? 9 : 18); px = nx; py = ny; } }
      }
    });
    W.flashScreen = Math.max(W.flashScreen, S ? 0.14 : 0.1);
    G.VFX.light(W, x, y, 20, S ? 42 : 34, 18, 0.4, 0.85, 1); G.VFX.groundLight(W, x, y, S ? 32 : 26, 18, 0.5, 0.75);
    G.VFX.spark(W, x, y, 4, 12, 18, 0.2); G.VFX.burst(W, x, y, 4, 16, 9, 18, 100, 240, 0.15, 0.32, 0, 6);
    G.FX.ring(W, x, y, 4, 40, 0.3, 18, 1); G.FX.scorch(W, x, y, 14, 3);
  },

  // ===== 隕石 =====
  meteor(W, tx, ty, R, onImpact, el, fall = 0.65) {
    const tree = el === 'treemeteor', hz = el === 'hazard', c = tree ? 11 : 14;
    // 預告圈：外圈虛線旋轉 + 向內收縮的紅環 + 填色漸增（v3.8 場景熔岩彈 hazard：藍白色，岩漿地上才看得清楚；越接近落地閃越快）
    const rc = hz ? 12 : 10, fc = hz ? 12 : 15;
    W.effects.push({
      t: 0, dur: fall, layer: 0, draw(ctx, o) {
        const p = this.t / fall, cx = SX(tx, o), cy = SY(ty, 0, o), rx = R * G.AX, ry = R * G.AY, bl = hz ? 6 + p * 18 : 16;
        G.pxDisc(ctx, cx, cy, rx * p, ry * p, fc, (hz ? 0.22 : 0.3) + 0.3 * p); G.pxDisc(ctx, cx, cy, rx * 0.35 * p, ry * 0.35 * p, hz ? 9 : 0, hz ? 0.35 : 0.5);
        G.pxEllipse(ctx, cx, cy, rx, ry, (((this.t * bl) | 0) & 1) ? 9 : rc, 4, this.t * 30);
        if (hz) G.pxEllipse(ctx, cx, cy, rx + 1, ry + 1, 0);
        const q = 1 - ((this.t * (hz ? 1.5 : 3)) % 1); G.pxEllipse(ctx, cx, cy, rx * q, ry * q, rc);
        G.glow(ctx, cx, cy, rx, rc, (hz ? 0.35 : 0.25) * p, 0.75);
      }
    });
    W.effects.push({
      t: 0, dur: fall, layer: 1, update() {
        const p = this.t / fall, z = 300 * (1 - p), x = tx + 120 * (1 - p);
        for (let k = 0; k < 3; k++) W.parts.add(x + G.rr(-6, 6), ty, z + G.rr(-6, 6), G.rr(-20, 20) + 60, 0, G.rr(20, 60), G.rr(0.3, 0.6), tree ? 20 : 13, tree ? 16 : 15, G.ri(1, 3), 0, 2);
        if (Math.random() < 0.6) W.parts.add(x + G.rr(-6, 6), ty, z + G.rr(-6, 6), 40, 0, 30, G.rr(0.5, 0.8), 5, 3, 3, 0, 1.5);
        if (tree && Math.random() < 0.5) W.parts.add(x + G.rr(-8, 8), ty, z, G.rr(-30, 30), G.rr(-10, 10), G.rr(-10, 20), 1.0, 11, 16, 1, 40, 2);
      },
      draw(ctx, o) {
        const p = this.t / fall, z = 300 * (1 - p), x = tx + 120 * (1 - p), cx = SX(x, o), cy = SY(ty, z, o);
        G.glow(ctx, cx, cy, 20, c, 0.6 + 0.1 * Math.sin(this.t * 60));
        if (tree) { G.pxDisc(ctx, cx, cy, 9, 9, 16, 1); G.pxDisc(ctx, cx - 1, cy - 1, 7, 7, 11, 1); G.pxDisc(ctx, cx - 3, cy - 3, 3, 3, 20, 1); ctx.fillStyle = G.PAL[16]; ctx.fillRect(Math.round(cx - 4), Math.round(cy - 1), 8, 1); ctx.fillRect(Math.round(cx), Math.round(cy - 5), 1, 9); }
        else { G.pxDisc(ctx, cx, cy, 9, 9, 15, 1); G.pxDisc(ctx, cx - 1, cy - 1, 7, 7, 14, 1); G.pxDisc(ctx, cx - 3, cy - 3, 4, 4, 13, 1); G.pxDisc(ctx, cx - 4, cy - 4, 1.5, 1.5, 9, 1); }
        G.pxDisc(ctx, SX(tx, o), SY(ty, 0, o), 10 * p, 4 * p, 0, 0.5);
      }
    });
    G.VFX.later(W, fall, onImpact);
  },
  // ===== v3.8 大招儀式 =====
  // 放出瞬間：白閃、三圈衝擊波、停格、光芒，接著 1.6 秒的餘燼往上飄
  ultRelease(W, u, el) {
    const E = EL(el), x = u.x, y = u.y;
    W.flashScreen = Math.max(W.flashScreen, 0.14); W.shake(0.6); W.hitstop = Math.max(W.hitstop || 0, 0.09);
    G.VFX.light(W, x, y, 14, 70, E.c, 0.7, 0.95, 1); G.VFX.groundLight(W, x, y, 60, E.c, 1.0, 0.8);
    [[60, 0.45, E.c2, 3], [90, 0.6, E.c, 2], [120, 0.75, 9, 1]].forEach(([r, d, c, th], i) => G.VFX.later(W, i * 0.06, () => G.FX.ring(W, x, y, 4, r, d, c, th)));
    G.VFX.ringAir(W, x, y, 14, 6, 44, 0.35, 9, 2); G.VFX.lines(W, x, y, 14, 12, 40, E.c2);
    G.VFX.burst(W, x, y, 10, 30, E.c, E.c2, 80, 240, 0.4, 0.9, 0, 3, [1, 2], 40, 200);
    W.effects.push({ t: 0, dur: 1.6, layer: 1, update() { if (Math.random() < 0.7) { const a = Math.random() * 6.28, r = G.rr(8, 50); W.parts.add(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, G.rr(2, 10), G.rr(-6, 6), 0, G.rr(25, 60), G.rr(0.7, 1.2), Math.random() < 0.5 ? E.c : E.c2, E.cd, G.ri(1, 2), -10, 1); } } });
  },
  // 大招命中的大爆發：光柱、雙層衝擊環、放射光線、碎片、餘燼、地面裂痕與焦痕
  ultBlast(W, x, y, el, R = 60, k = 1) {
    const E = EL(el === 'clone' ? 'ice' : el), r = R * k, rx = r * G.AX;
    W.flashScreen = Math.max(W.flashScreen, 0.09 * k); W.shake(0.5 * k); W.hitstop = Math.max(W.hitstop || 0, 0.06 * k);
    G.VFX.light(W, x, y, 12, rx * 1.7, E.c, 0.8, 0.9, 1); G.VFX.groundLight(W, x, y, rx * 1.5, E.c, 1.3, 0.8);
    G.VFX.ringAir(W, x, y, 6, 6, rx * 1.7, 0.45, E.c2, 3); G.VFX.ringAir(W, x, y, 6, 4, rx * 1.15, 0.55, E.c, 2);
    G.FX.ring(W, x, y, 4, r * 1.7, 0.6, E.c, 3); G.FX.ring(W, x, y, 4, r * 1.15, 0.45, 9, 1); G.FX.wave(W, x, y, r * 1.5, 0.55);
    G.VFX.lines(W, x, y, 8, 14, rx * 1.3, E.c2);
    G.VFX.burst(W, x, y, 8, Math.round(40 * k), E.c, E.c2, 80, 280, 0.5, 1.1, 260, 1.5, [1, 3], 80, 300);
    G.VFX.burst(W, x, y, 6, Math.round(20 * k), 9, E.c, 30, 120, 0.8, 1.6, -80, 2, 1, 40, 160);
    G.VFX.cracks(W, x, y, r * 0.9, 1.6, 8); G.FX.scorch(W, x, y, r * 0.7, 2.5);   // v3.9 焦痕 6→2.5 秒（減少殘影）
    W.effects.push({ t: 0, dur: 0.75, layer: 1, draw(ctx, o) {        // 光柱
      const p = this.t / 0.75, cx = SX(x, o), cy = SY(y, 0, o), w = Math.max(2, Math.round((16 + 12 * (1 - p)) * k)), H = 240;
      ctx.globalAlpha = 0.55 * (1 - p); ctx.fillStyle = G.PAL[E.c]; ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - H), w, H);
      ctx.fillStyle = G.PAL[9]; const w2 = Math.max(1, Math.round(w / 3)); ctx.fillRect(Math.round(cx - w2 / 2), Math.round(cy - H), w2, H); ctx.globalAlpha = 1;
      G.glow(ctx, cx, cy - 10, 44 * k, E.c, 0.55 * (1 - p));
    } });
  },
  // 穿透大招：沿路徑長出一道光帶（前端發亮），結束後慢慢消失；途中每段迸出火花
  // v3.9 改成「彗星光帶」：只留頭後面一段尾巴，跟著往前跑，到終點後尾巴 0.25 秒收掉（原本整條留到最後才淡出 → 殘影）
  ultSlash(W, x0, y0, x1, y1, D, el) {
    const E = EL(el), FADE = 0.25, Lt = Math.hypot(x1 - x0, y1 - y0) || 1, tl = Math.min(1, 110 / Lt);
    W.effects.push({ t: 0, dur: D + FADE, layer: 1, draw(ctx, o) {
      const k = Math.min(1, this.t / D), k0 = Math.min(k, Math.max(0, k - tl) + (this.t > D ? (this.t - D) / FADE * tl : 0)), f = this.t < D ? 1 : 1 - (this.t - D) / FADE;
      if (k - k0 < 0.002) return;
      const P = q => [SX(x0 + (x1 - x0) * q, o), SY(y0 + (y1 - y0) * q, 12, o)], [ax, ay] = P(k0), [mx, my] = P(k0 + (k - k0) * 0.45), [bx, by] = P(k);
      ctx.globalAlpha = 0.35 * f; ctx.fillStyle = G.PAL[E.c]; G.pxLine(ctx, ax, ay, mx, my, 3);                   // 尾端細、淡
      ctx.globalAlpha = 0.7 * f; ctx.fillStyle = G.PAL[E.c]; G.pxLine(ctx, mx, my, bx, by, 7); ctx.fillStyle = G.PAL[E.c2]; G.pxLine(ctx, mx, my, bx, by, 4);
      ctx.globalAlpha = f; ctx.fillStyle = G.PAL[9]; G.pxLine(ctx, mx, my, bx, by, 1); ctx.globalAlpha = 1;
      if (this.t < D) G.glow(ctx, bx, by, 30, E.c, 0.7);
    } });
    for (let i = 1; i <= 6; i++) G.VFX.later(W, D * i / 6, () => { const px = x0 + (x1 - x0) * i / 6, py = y0 + (y1 - y0) * i / 6; G.VFX.spark(W, px, py, 12, 10, E.c2); G.VFX.ringAir(W, px, py, 12, 3, 22, 0.3, E.c, 2); G.VFX.burst(W, px, py, 12, 8, E.c, 9, 60, 180, 0.3, 0.6, 0, 4); });
    G.VFX.later(W, D, () => G.VFX.ultBlast(W, x1, y1, el, 45, 0.7));
  },
  // 增益大招期間：全身火焰光環＋往上竄的火星
  ultAura(ctx, u, ax, ay, base, s, rt, W) {
    const E = EL(u.ultEl || 'rage'), left = u.ultEnd - W.time; if (left <= 0) return;
    const a = Math.min(1, left / 0.6), gl = G.glowOf(base, E.c, 1, 3);
    G.glow(ctx, ax + s.w / 2, ay + s.h * 0.55, s.h * 1.3, E.c, (0.28 + 0.1 * Math.sin(rt * 9)) * a, 1.2);
    ctx.globalAlpha = (0.55 + 0.25 * Math.sin(rt * 14 + u.id)) * a; ctx.drawImage(gl.c, ax - gl.p, ay - gl.p - 1); ctx.globalAlpha = 1;
    if ((W.frame & 1) === 0) W.parts.add(u.x + G.rr(-10, 10), u.y + G.rr(-3, 3), G.rr(4, 24), G.rr(-8, 8), 0, G.rr(40, 80), G.rr(0.4, 0.7), Math.random() < 0.5 ? E.c : E.c2, E.cd, G.ri(1, 2), -20, 1);
  },
  meteorImpact(W, x, y, R, el) {
    const tree = el === 'treemeteor', c = tree ? 11 : 14, rx = R * G.AX;
    W.flashScreen = Math.max(W.flashScreen, 0.14);
    G.VFX.light(W, x, y, 14, rx * 1.4, c, 0.6, 0.85, 1); G.VFX.groundLight(W, x, y, rx * 1.3, c, 1.0, 0.75);
    G.VFX.spark(W, x, y, 10, 18, tree ? 20 : 13, 0.24); G.VFX.ringAir(W, x, y, 3, 6, rx * 1.4, 0.3, 9, 2);
    G.FX.wave(W, x, y, R * 1.2, 0.45); G.FX.ring(W, x, y, 6, R * 1.5, 0.5, c, 3); G.FX.ring(W, x, y, 4, R * 1.1, 0.35, 9, 1);
    G.VFX.burst(W, x, y, 6, 50, tree ? 20 : 13, tree ? 16 : 15, 60, 260, 0.5, 1.1, 300, 1.5, [1, 3], 80, 320);
    G.VFX.burst(W, x, y, 4, 16, 5, 3, 60, 200, 0.5, 0.9, 600, 1, [2, 3], 120, 260);
    if (tree) G.VFX.burst(W, x, y, 20, 14, 11, 16, 30, 120, 1.0, 1.6, 40, 2, 1, 40, 140);
    else G.VFX.burst(W, x, y, 6, 14, 13, 14, 20, 80, 0.8, 1.4, -60, 1.5, 1, 40, 120);
    G.FX.smoke(W, x, y, 4, 14, 6); G.FX.scorch(W, x, y, R * 0.8, 6); G.VFX.cracks(W, x, y, R * 0.9, 2.4, 7);
  },

  // ===== 大地系（地動波 / 地震波 / 地面強擊 / 地動襲） =====
  quake(W, x, y, R, stun, S) {
    G.VFX.spark(W, x, y, 6, S ? 12 : 10, 9, 0.18);
    const ripple = (d, rr) => G.VFX.later(W, d, () => {
      G.FX.ring(W, x, y, 8, rr, 0.38, 21, 2); G.FX.ring(W, x, y, 4, rr * 0.75, 0.3, 9, 1);
      W.effects.push({ t: 0, dur: 0.4, layer: 0, draw(ctx, o) { const p = this.t / this.dur, r = rr * (0.3 + 0.7 * Math.sqrt(p)); G.pxDisc(ctx, SX(x, o), SY(y, 0, o), r * G.AX, r * G.AY, 21, (1 - p) * 0.35); } });
      for (let k = 0; k < 18; k++) { const a = Math.random() * 6.283, r = rr * G.rr(0.5, 1); W.parts.add(x + Math.cos(a) * r, y + Math.sin(a) * r, 0, Math.cos(a) * 30, Math.sin(a) * 20, G.rr(10, 40), G.rr(0.6, 1.0), 21, 6, G.ri(2, 3), -15, 3, 2); }
    });
    if (stun) {   // 波動型：連續三道漣漪
      ripple(0, R); ripple(0.14, R * 0.8); if (S) ripple(0.28, R * 1.05);
      G.VFX.cracks(W, x, y, R * 0.6, 1.2, 4);
    } else {      // 重擊型：一記重拳砸地，裂地＋碎石
      ripple(0, R); G.VFX.cracks(W, x, y, R * 0.9, 1.6, S ? 8 : 6);
      G.VFX.burst(W, x, y, 4, S ? 20 : 14, 5, 3, 40, 160, 0.5, 0.9, 600, 1, [1, 2], 140, 260);
      G.VFX.light(W, x, y, 6, 20, 21, 0.25, 0.5);
    }
  },
  // ===== 地刺（召喚樹根 / 地矛亂刺）：由中心向外依序竄出 =====
  spikes(W, x, y, R, el) {
    const root = el === 'root', pts = [];
    for (let i = 0; i < (root ? 9 : 11); i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R; pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, d: r / R * 0.18, H: root ? G.ri(11, 16) : G.ri(13, 18), sg: Math.random() < 0.5 ? -1 : 1 }); }
    W.effects.push({
      t: 0, dur: 0.85, layer: 1,
      update() { for (const q of pts) if (!q.f && this.t >= q.d) { q.f = 1; G.VFX.burst(W, q.x, q.y, 2, 5, root ? 21 : 6, root ? 16 : 3, 20, 80, 0.3, 0.5, 400, 2, 1, 40, 120); G.FX.ring(W, q.x, q.y, 2, 10, 0.2, root ? 21 : 7, 1); } },
      draw(ctx, o) {
        for (const q of pts) {
          const k = G.clamp((this.t - q.d) / 0.07, 0, 1) * (this.t > 0.6 ? (0.85 - this.t) / 0.25 : 1), hh = Math.round(q.H * k); if (hh <= 0) continue;
          const sx = Math.round(SX(q.x, o)), sy = Math.round(SY(q.y, 0, o));
          if (root) {
            for (let yy = 0; yy < hh; yy++) { const f = yy / hh, w = f < 0.35 ? 3 : f < 0.7 ? 2 : 1, ox = Math.round(Math.sin(f * 3.14) * 1.5 * q.sg); ctx.fillStyle = G.PAL[0]; ctx.fillRect(sx - (w >> 1) - 1 + ox, sy - yy, w + 2, 1); ctx.fillStyle = G.PAL[16]; ctx.fillRect(sx - (w >> 1) + ox, sy - yy, w, 1); if (w > 1) { ctx.fillStyle = G.PAL[11]; ctx.fillRect(sx - (w >> 1) + ox, sy - yy, 1, 1); } }
            ctx.fillStyle = G.PAL[20]; ctx.fillRect(sx + Math.round(Math.sin(3.14) * 1.5 * q.sg), sy - hh, 1, 1);
            if (hh > 6) { ctx.fillStyle = G.PAL[16]; ctx.fillRect(sx + 2 * q.sg, sy - (hh >> 1), 1, 1); }
          } else {
            ctx.fillStyle = G.PAL[0]; ctx.fillRect(sx - 2, sy - hh, 4, hh); ctx.fillStyle = G.PAL[6]; ctx.fillRect(sx - 1, sy - hh + 1, 2, hh - 1); ctx.fillStyle = G.PAL[8]; ctx.fillRect(sx - 1, sy - hh + 1, 1, Math.max(1, hh - 3));
            ctx.fillStyle = G.PAL[9]; ctx.fillRect(sx - 1, sy - hh - 1, 2, 2);
            const tt = this.t - q.d; if (tt > 0.04 && tt < 0.16) { ctx.fillRect(sx - 3, sy - hh - 1, 7, 1); ctx.fillRect(sx, sy - hh - 4, 1, 7); G.glow(ctx, sx, sy - hh, 6, 9, 0.5); }
          }
        }
      }
    });
    G.FX.ring(W, x, y, 4, R, 0.35, root ? 11 : 7, 1); G.FX.scorch(W, x, y, R * 0.6, 3); G.VFX.cracks(W, x, y, R * 0.7, 1.0, 5);
  },

  // ===== 角色身上的持續狀態（rt 為繪製時間） =====
  auraBack(ctx, u, ax, ay, base, gx, gy, rt, W) {
    const bt = u.buffT || {};
    if (bt.rage) {
      G.glow(ctx, gx, gy, 15, 10, 0.4 + 0.15 * Math.sin(rt * 10), 0.55);
      const gl = G.glowOf(base, 10, 1, 2); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(rt * 12); ctx.drawImage(gl.c, ax - gl.p, ay - gl.p); ctx.globalAlpha = 1;
      if (W.frame % 3 === 0) W.parts.add(u.x + G.rr(-7, 7), u.y + G.rr(-2, 2), (u.vis.fly || 0) + G.rr(2, 14), 0, 0, G.rr(30, 60), G.rr(0.3, 0.5), 14, 15, 1, -40, 1, 2);
    }
    if (u.zap) {
      G.glow(ctx, gx, ay + base.height / 2, 13, 18, 0.25 + 0.15 * G.hash(u.id || 1, (rt * 20) | 0));
      const gl = G.glowOf(base, 18, 1, 2); ctx.globalAlpha = (((rt * 20) | 0) & 1) ? 0.7 : 0.35; ctx.drawImage(gl.c, ax - gl.p, ay - gl.p); ctx.globalAlpha = 1;
    }
    if (!u.static && u.slow > 0 && !bt.rage) { const gl = G.glowOf(base, 18, 1, 1); ctx.globalAlpha = 0.5; ctx.drawImage(gl.c, ax - gl.p, ay - gl.p); ctx.globalAlpha = 1; }
    if (u.poison) { const gl = G.glowOf(base, 11, 1, 1); ctx.globalAlpha = 0.45; ctx.drawImage(gl.c, ax - gl.p, ay - gl.p); ctx.globalAlpha = 1; }
  },
  auraFront(ctx, u, ax, ay, s, gx, gy, rt, W) {
    const bt = u.buffT || {};
    if (u.inv > 0) {   // v2.4 無敵：金色光殼＋流光
      const cx = gx, cy = ay + s.h / 2, rx = s.w / 2 + 5, ry = s.h / 2 + 4, end = u.inv < 0.6 && (((rt * 16) | 0) & 1);
      if (!end) { G.glow(ctx, cx, cy, Math.max(rx, ry) + 3, 13, 0.32 + 0.12 * Math.sin(rt * 14), ry / Math.max(rx, ry)); G.pxEllipse(ctx, cx, cy, rx, ry, 13, 5, rt * 14); G.pxEllipse(ctx, cx, cy, rx - 2, ry - 2, 9, 2, -rt * 20); }
      if (W.frame % 4 === 0) W.parts.add(u.x + G.rr(-8, 8), u.y + G.rr(-3, 3), G.rr(2, 16), 0, 0, G.rr(30, 60), 0.4, 13, 9, 1, -30, 1, 2);
    }
    if (u.tLock && u === W.hero && u.alive) {   // v2.4 被敵塔鎖定：頭上紅色驚嘆號（跳出來後輕輕跳動）
      const k = Math.min(1, (u.lockT || 0) / 0.12), by = Math.round(ay - 12 - (1 - k) * 6 + Math.abs(Math.sin(rt * 7)) * -2), bx = Math.round(gx);
      ctx.fillStyle = G.PAL[0]; ctx.fillRect(bx - 2, by - 1, 5, 11);
      ctx.fillStyle = G.PAL[(((rt * 6) | 0) & 1) ? 10 : 15]; ctx.fillRect(bx - 1, by, 3, 6); ctx.fillRect(bx - 1, by + 7, 3, 2);
      ctx.fillStyle = G.PAL[9]; ctx.fillRect(bx - 1, by, 1, 2);
      G.glow(ctx, bx, by + 4, 9, 10, 0.35);
    }
    if (bt.red) {   // 護盾泡泡
      const cx = gx, cy = ay + s.h / 2, rx = s.w / 2 + 4, ry = s.h / 2 + 3, hit = u.shieldHit && now() - u.shieldHit < 160;
      G.glow(ctx, cx, cy, Math.max(rx, ry), 12, hit ? 0.45 : 0.18, ry / Math.max(rx, ry));
      G.pxEllipse(ctx, cx, cy, rx, ry, hit ? 9 : 12, hit ? 0 : 8, rt * 10);
      ctx.fillStyle = G.PAL[9]; for (let i = 0; i < 4; i++) { const a = -2.4 + i * 0.16; ctx.fillRect(Math.round(cx + Math.cos(a) * (rx - 2)), Math.round(cy + Math.sin(a) * (ry - 2)), 1, 1); }
    }
    if (u.zap && (((rt * 15) | 0) % 3) !== 2) {   // 身上電弧
      const fr = (rt * 15) | 0, cx = gx, cy = ay + s.h / 2;
      for (let j = 0; j < 2; j++) {
        const a0 = G.hash(j * 17 + (u.id || 0), fr) * 6.283; let px = cx + Math.cos(a0) * (s.w / 2 + 2), py = cy + Math.sin(a0) * (s.h / 2 + 1);
        for (let k = 0; k < 3; k++) { const nx = px + (G.hash(k * 3 + j, fr) - 0.5) * 8, ny = py + (G.hash(k * 5 + j * 2, fr) - 0.5) * 6; G.addLine(ctx, px, py, nx, ny, 1, k ? 18 : 9); px = nx; py = ny; }
      }
    }
    if (u.stun > 0 && !u.static) {   // 暈眩星星
      for (let i = 0; i < 3; i++) { const a = rt * 6 + i * 2.1, x = Math.round(gx + Math.cos(a) * 6), y = Math.round(ay - 3 + Math.sin(a) * 1.8); ctx.fillStyle = G.PAL[13]; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.fillStyle = G.PAL[9]; ctx.fillRect(x, y, 1, 1); }
    }
  }
};

// ---------- v2.4 藥水使用特效（每種藥水一套光影＋音效）----------
G.VFX.potion = function (W, h, it) {
  const V = G.VFX, x = h.x, y = h.y, z = 10, k = it.k, A = G.Audio;
  const col = { hp: 10, mp: 11, del: 13, crit: 14, arm: 12, pow: 17, spd: 9, cdr: 18, xp: 20, wave: 11, inv: 13, rev: 19 }[k] || 9;
  const rise = (n, c1, c2, up0, up1, R = 10, sz = 1) => { for (let i = 0; i < n; i++) W.parts.add(x + G.rr(-R, R), y + G.rr(-R * 0.4, R * 0.4), G.rr(0, 12), G.rr(-6, 6), G.rr(-4, 4), G.rr(up0, up1), G.rr(0.5, 1), c1, c2, sz, -20, 1.5, 2); };
  W.sfx('gulp'); V.later(W, 0.12, () => W.sfx('pot_' + k));
  // 共通：瓶子破開的小光點＋腳下光圈
  V.light(W, x, y, z, 22, col, 0.5, 0.55); G.FX.ring(W, x, y, 4, 24, 0.35, col, 1);
  if (k === 'hp' || k === 'mp') {      // 回復：十字光點往上飄＋身體一閃＋數字
    const c2 = k === 'hp' ? 15 : 16;
    for (let i = 0; i < 14; i++) V.later(W, i * 0.04, () => { const a = Math.random() * 6.28; W.parts.add(x + Math.cos(a) * 9, y + Math.sin(a) * 4, G.rr(0, 6), 0, 0, G.rr(40, 70), 0.7, i % 3 ? col : 9, c2, i % 4 ? 1 : 2, -10, 1, 2); });
    V.groundLight(W, x, y, 26, col, 0.8, 0.5); G.FX.popText(W, x, y, 30, '+' + it.v, col);
    if (k === 'mp') for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28, r = 26; W.parts.add(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 8, -Math.cos(a) * r * 2.6, -Math.sin(a) * r * 1.6, 20, 0.4, 11, 9, 1, 0, 0); }   // 魔力從四周吸進來
  } else if (k === 'del') {            // 攻速：黃色快速往上的環＋速度線
    for (let i = 0; i < 3; i++) V.later(W, i * 0.08, () => V.ringAir(W, x, y, 6 + i * 8, 6, 16, 0.3, 13));
    rise(18, 13, 14, 80, 160, 8);
  } else if (k === 'crit') {           // 爆擊：頭上一顆大星芒＋橘色火花爆開
    V.spark(W, x, y, 30, 12, 14, 0.4); V.burst(W, x, y, 20, 22, 14, 13, 40, 110, 0.3, 0.6, 200, 3, 1, 20, 90);
  } else if (k === 'arm') {            // 防禦：藍色護殼從外面收進身上
    G.FX.ring(W, x, y, 34, 8, 0.4, 12, 2); V.later(W, 0.36, () => { V.ringAir(W, x, y, 10, 12, 20, 0.35, 12, 2); V.light(W, x, y, 10, 18, 12, 0.4, 0.7); });
  } else if (k === 'pow') {            // 攻擊：紫色火焰往上竄＋一記低沉衝擊
    V.groundLight(W, x, y, 24, 17, 0.7, 0.55); rise(26, 17, 10, 60, 130, 9, 1); W.shake(0.15);
  } else if (k === 'spd') {            // 跑速：左右兩側白色風線
    for (let i = 0; i < 14; i++) { const d = i % 2 ? 1 : -1; W.parts.add(x + d * G.rr(4, 10), y + G.rr(-5, 5), G.rr(2, 16), d * G.rr(90, 160), 0, 0, G.rr(0.25, 0.4), 9, 7, 1, 0, 2); }
  } else if (k === 'cdr') {            // 冷卻：青色時鐘環，指針轉一圈
    W.effects.push({ t: 0, dur: 0.9, layer: 1, draw(ctx, o) {
      const p = this.t / this.dur, cx = Math.round(SX(x, o)), cy = Math.round(SY(y, 14, o)), r = 9 + Math.min(1, p * 5) * 3, a = -1.57 + p * 6.283 * 1.5;
      ctx.globalAlpha = 1 - Math.max(0, p - 0.7) / 0.3; G.glow(ctx, cx, cy, r + 4, 18, 0.3);
      G.pxEllipse(ctx, cx, cy, r, r, 18); for (let i = 0; i < 4; i++) { const b = i * 1.5708; ctx.fillStyle = G.PAL[9]; ctx.fillRect(Math.round(cx + Math.cos(b) * (r - 2)), Math.round(cy + Math.sin(b) * (r - 2)), 1, 1); }
      ctx.fillStyle = G.PAL[9]; G.pxLine(ctx, cx, cy, cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3), 1); ctx.globalAlpha = 1;
    } });
  } else if (k === 'xp') {             // 經驗：黃綠光球從四周飛進身體
    for (let i = 0; i < 10; i++) V.later(W, i * 0.05, () => { const a = Math.random() * 6.28, r = G.rr(30, 44); W.parts.add(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 14, -Math.cos(a) * r * 3, -Math.sin(a) * r * 1.8, 0, 0.33, 20, 9, 2, 0, 0); });
    V.later(W, 0.4, () => { V.light(W, x, y, 12, 20, 20, 0.4, 0.7); G.FX.popText(W, x, y, 30, 'EXP', 20); });
  } else if (k === 'wave') {           // 小兵：葉片旋起＋向外擴散的大波紋＋廣播
    for (let i = 0; i < 3; i++) V.later(W, i * 0.15, () => G.FX.ring(W, x, y, 8, 60 + i * 20, 0.6, 11, 1));
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; W.parts.add(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 4, Math.cos(a) * 60, Math.sin(a) * 36, G.rr(60, 120), G.rr(0.6, 1), i % 2 ? 11 : 16, 20, 2, 120, 1.5, 2); }
    W.say({ s: '我方出兵加速', ic: 'p_wave', col: 11, t: 2 });
  } else if (k === 'inv') {            // 無敵：白閃＋金色光柱
    W.flashScreen = Math.max(W.flashScreen || 0, 0.08); V.light(W, x, y, 12, 30, 13, 0.6, 0.8); V.ringAir(W, x, y, 12, 4, 26, 0.4, 13, 2);
    G.FX.levelUp && W.effects.push({ t: 0, dur: 0.5, layer: 1, draw(ctx, o) { const p = this.t / this.dur, cx = Math.round(SX(x, o)), cy = Math.round(SY(y, 0, o)), w = Math.round(6 * (1 - p)) + 1; ctx.globalAlpha = 1 - p; ctx.fillStyle = G.PAL[9]; ctx.fillRect(cx - (w >> 1), cy - 80, w, 80); ctx.fillStyle = G.PAL[13]; ctx.fillRect(cx - (w >> 1) - 1, cy - 80, 1, 80); ctx.fillRect(cx + w - (w >> 1), cy - 80, 1, 80); ctx.globalAlpha = 1; } });
  } else if (k === 'rev') {            // 復活：天上光柱＋粉色光環＋葉片
    G.FX.respawn(W, h); G.FX.ring(W, x, y, 6, 50, 0.6, 19, 2); V.light(W, x, y, 12, 34, 19, 0.8, 0.8); W.flashScreen = Math.max(W.flashScreen || 0, 0.12); W.shake(0.3);
  }
};
