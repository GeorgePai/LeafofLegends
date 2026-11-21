'use strict';
/* =========================================================
   特效：像素繪圖工具、粒子池、特效物件
   ========================================================= */
// --- 像素繪圖工具（美術座標） ---
G.px = (ctx, x, y, w = 1, h = 1) => ctx.fillRect(Math.round(x), Math.round(y), w, h);
G.pxEllipse = (ctx, cx, cy, rx, ry, col, dash = 0, rot = 0) => {
  if (rx < 0.5) return;
  ctx.fillStyle = G.PAL[col];
  const n = Math.max(10, Math.ceil((rx + ry) * 3.2));
  for (let i = 0; i < n; i++) {
    if (dash && ((i + (rot | 0)) % dash) < dash / 2) continue;
    const a = i / n * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
};
// 抖動圖樣（4x4 Bayer），以 pattern 填色取代逐點繪製
G._pats = {}; G._patOff = [0, 0];
G.pat = (ctx, col, a) => {
  const k = Math.round(G.clamp(a, 0, 1) * 16), key = col * 17 + k;
  let p = G._pats[key];
  if (!p) {
    const c = G.canvas(4, 4), x = c.getContext('2d'); x.fillStyle = G.PAL[col];
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) if (G.bayer(xx, yy) < k / 16) x.fillRect(xx, yy, 1, 1);
    p = G._pats[key] = ctx.createPattern(c, 'repeat');
    if (p.setTransform) p.setTransform(new DOMMatrix([1, 0, 0, 1, G._patOff[0], G._patOff[1]]));
  }
  return p;
};
G.setPatOffset = (ox, oy) => {
  const tx = ((-ox % 4) + 4) % 4, ty = ((-oy % 4) + 4) % 4;
  if (tx === G._patOff[0] && ty === G._patOff[1]) return;
  G._patOff = [tx, ty];
  const m = new DOMMatrix([1, 0, 0, 1, tx, ty]);
  for (const k in G._pats) if (G._pats[k].setTransform) G._pats[k].setTransform(m);
};
G.pxDisc = (ctx, cx, cy, rx, ry, col, alpha = 1) => {
  if (rx < 0.5 || alpha <= 0) return;
  ctx.fillStyle = alpha >= 1 ? G.PAL[col] : G.pat(ctx, col, alpha);
  const SQ = G.SSQ || 1, y0 = Math.ceil(-ry), y1 = Math.floor(ry), icx = Math.round(cx * SQ) / SQ, icy = Math.round(cy * SQ) / SQ;   // v3.4 戰場 2 倍細緻時對齊半格
  for (let y = y0; y <= y1; y++) {
    const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) * (y / ry))));
    ctx.fillRect(icx - hw, icy + y, hw * 2 + 1, 1);
  }
};
G.pxLine = (ctx, x0, y0, x1, y1, w = 1) => {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (let k = 0; k < 600; k++) {
    ctx.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
  }
};

// --- 粒子池（SoA，零配置） ---
G.Particles = class {
  constructor(n) {
    this.n = n; this.c = 0;
    for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'grav', 'drag']) this[k] = new Float32Array(n);
    this.col = new Int8Array(n); this.col2 = new Int8Array(n); this.sz = new Uint8Array(n); this.gnd = new Uint8Array(n);
  }
  add(x, y, z, vx, vy, vz, life, col, col2 = col, sz = 1, grav = 0, drag = 0, gnd = 0) {
    if (this.c >= this.n) return;
    const i = this.c++;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = this.max[i] = life; this.col[i] = col; this.col2[i] = col2; this.sz[i] = sz; this.grav[i] = grav; this.drag[i] = drag; this.gnd[i] = gnd;
  }
  update(dt) {
    for (let i = 0; i < this.c; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.c--; this.copy(this.c, i); i--; continue; }
      const dr = 1 - this.drag[i] * dt;
      this.vx[i] *= dr; this.vy[i] *= dr; this.vz[i] = this.vz[i] * dr - this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.z[i] += this.vz[i] * dt;
      if (this.z[i] < 0) { this.z[i] = 0; this.vz[i] *= -0.35; this.vx[i] *= 0.6; this.vy[i] *= 0.6; }
    }
  }
  copy(a, b) { for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'grav', 'drag', 'col', 'col2', 'sz', 'gnd']) this[k][b] = this[k][a]; }
  draw(ctx, ox, oy, frame, ground) {
    for (let i = 0; i < this.c; i++) {
      if ((this.gnd[i] === 1) !== ground) continue;
      const t = this.life[i] / this.max[i];
      if (t < 0.35 && G.hash(i * 7, frame) > t / 0.35) continue;    // 像素式消散
      ctx.fillStyle = G.PAL[t > 0.5 ? this.col[i] : this.col2[i]];
      const s = this.sz[i] > 1 && t < 0.5 ? this.sz[i] - 1 : this.sz[i];
      ctx.fillRect(Math.round(this.x[i] * G.AX - ox - s / 2), Math.round(this.y[i] * G.AY - this.z[i] * G.AZ - oy - s / 2), s, s);
    }
  }
};

// --- 特效生成器（作用於 world W） ---
G.FX = {
  // 擊中火花
  hit(W, x, y, z, big, col = 9) {
    const n = big ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = G.rr(40, big ? 180 : 110);
      W.parts.add(x, y, z, Math.cos(a) * s, Math.sin(a) * s * 0.7, G.rr(20, 120), G.rr(0.15, 0.35), col, 6, big && i < 4 ? 2 : 1, 380, 3);
    }
    W.effects.push({ t: 0, dur: big ? 0.12 : 0.08, layer: 1, x, y, z, draw(ctx, o) { const r = (big ? 7 : 4) * (1 - this.t / this.dur); G.pxDisc(ctx, this.x * G.AX - o.x, this.y * G.AY - this.z * G.AZ - o.y, r, r, 9, 1); } });
  },
  // 近戰爪痕/斬擊
  slash(W, x, y, z, face, dark) {
    W.effects.push({
      t: 0, dur: 0.12, layer: 1, x, y, z, face, draw(ctx, o) {
        const p = this.t / this.dur, cx = this.x * G.AX - o.x, cy = this.y * G.AY - this.z * G.AZ - o.y;
        ctx.fillStyle = G.PAL[dark ? 1 : 9];
        for (let i = 0; i < 3; i++) { const yy = cy - 5 + i * 3; G.pxLine(ctx, cx - 4 * this.face + p * 2, yy - 3, cx + 4 * this.face + p * 2, yy + 2, 1); }
      }
    });
  },
  // 近戰揮擊的弧形殘影（v2.3）：攻擊者前方一道由上往下掃的月牙，前端亮、尾巴淡出
  swingArc(b, u, ax, ay, s, prog) {
    const f = u.face, k = G.clamp(prog / 0.75, 0, 1), e = 1 - (1 - k) * (1 - k);
    const cx = ax + s.w / 2 + f * s.w * 0.12, cy = ay + s.h * 0.55, big = u.kind === 'boss' || u.kind === 'hero', r = Math.max(6, s.w * 0.55) + (big ? 4 : 2);
    const a0 = -2.1, a1 = 0.9, lead = a0 + (a1 - a0) * e, tail = Math.max(a0, lead - 1.3), n = 14;
    const cHead = u.side === 1 ? 14 : 9, cTail = u.side === 1 ? 15 : u.kind === 'hero' ? 13 : 7;
    for (let i = 0; i <= n; i++) {
      const q = i / n, a = tail + (lead - tail) * q, rr = r - (1 - q) * 2, x = Math.round(cx + Math.cos(a) * rr * f), y = Math.round(cy + Math.sin(a) * rr * 0.85);
      b.globalAlpha = (0.25 + 0.75 * q) * (1 - k * 0.6); b.fillStyle = G.PAL[q > 0.7 ? cHead : cTail];
      const th = big && q > 0.5 ? 2 : 1; b.fillRect(x, y, th, th);
      if (q > 0.4) { const x2 = Math.round(cx + Math.cos(a) * (rr - 2) * f), y2 = Math.round(cy + Math.sin(a) * (rr - 2) * 0.85); b.fillRect(x2, y2, 1, 1); }
    }
    b.globalAlpha = 1;
  },
  // 死亡：碎成像素
  shatter(W, u) {
    const n = u.kind === 'boss' ? 50 : u.kind === 'tower' ? 60 : 22, col = u.side === 0 ? 8 : 1, col2 = u.side === 0 ? 6 : 3;
    const h = u.spr[0].h / G.AZ;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = G.rr(30, 140);
      W.parts.add(u.x + G.rr(-u.vis.r, u.vis.r), u.y, u.z + G.rr(0, h), Math.cos(a) * s, Math.sin(a) * s * 0.6, G.rr(60, 220), G.rr(0.4, 0.9), col, col2, G.ri(1, 2), 500, 2);
    }
    G.FX.ring(W, u.x, u.y, 4, u.vis.r * 2 + 10, 0.3, u.side === 0 ? 9 : 2);
    for (let i = 0; i < 6; i++) W.parts.add(u.x + G.rr(-8, 8), u.y + G.rr(-4, 4), 4, G.rr(-20, 20), G.rr(-10, 10), G.rr(20, 50), G.rr(0.5, 0.9), 6, 4, 3, -10, 2);
  },
  // 地面擴散環
  ring(W, x, y, r0, r1, dur, col = 9, th = 1) {
    W.effects.push({ t: 0, dur, layer: 0, draw(ctx, o) { const p = this.t / this.dur, e = 1 - (1 - p) * (1 - p), r = r0 + (r1 - r0) * e; for (let k = 0; k < th; k++) G.pxEllipse(ctx, x * G.AX - o.x, y * G.AY - o.y, (r - k) * G.AX, (r - k) * G.AY, p > 0.6 ? (col > 9 ? 6 : Math.max(0, col - 3)) : col); } });
  },
  // 地面衝擊波（實心抖動）
  wave(W, x, y, r1, dur) {
    W.effects.push({ t: 0, dur, layer: 0, draw(ctx, o) { const p = this.t / this.dur, r = r1 * (0.3 + 0.7 * Math.sqrt(p)); G.pxDisc(ctx, x * G.AX - o.x, y * G.AY - o.y, r * G.AX, r * G.AY, 8, (1 - p) * 0.45); G.pxEllipse(ctx, x * G.AX - o.x, y * G.AY - o.y, r * G.AX, r * G.AY, 9); } });
  },
  // 地面焦痕
  scorch(W, x, y, r, life = 5) { W.decals.push({ x, y, r, t: 0, dur: life }); },
  // 傷害數字
  num(W, x, y, z, n, crit, side) {
    W.effects.push({
      t: 0, dur: crit ? 0.95 : 0.7, layer: 2, x: x + G.rr(-4, 4), y, z, vz: crit ? 90 : 70,
      update(dt) { this.z += this.vz * dt; this.vz *= 1 - 5 * dt; },
      draw(ctx, o) {
        const p = this.t / this.dur; if (p > 0.7 && (((this.t * 30) | 0) & 1)) return;
        const sc = crit && p < 0.15 ? 2 : 1;
        G.text(ctx, String(n) + (crit ? '!' : ''), this.x * G.AX - o.x, this.y * G.AY - this.z * G.AZ - o.y, crit ? 14 : side === 1 ? 9 : 6, sc, 0, 0.5);
      }
    });
  },
  // 文字/圖示提示
  popText(W, x, y, z, s, col = 9) {
    W.effects.push({ t: 0, dur: 1.2, layer: 2, update(dt) { z += 25 * dt; }, draw(ctx, o) { G.text(ctx, s, x * G.AX - o.x, y * G.AY - z * G.AZ - o.y, col, 1, 0, 0.5); } });
  },
  // 落雷
  bolt(W, x, y) {
    const pts = []; let cx = 0; for (let i = 0; i <= 10; i++) { pts.push([cx, i / 10]); cx += G.rr(-6, 6); } pts[10][0] = 0;
    W.effects.push({
      t: 0, dur: 0.35, layer: 1, draw(ctx, o) {
        if (this.t > 0.12 && (((this.t * 40) | 0) & 1)) return;
        const bx = x * G.AX - o.x, by = y * G.AY - o.y, top = 120;
        ctx.fillStyle = G.PAL[9];
        for (let i = 0; i < 10; i++) G.pxLine(ctx, bx + pts[i][0], by - top * (1 - pts[i][1]), bx + pts[i + 1][0], by - top * (1 - pts[i + 1][1]), this.t < 0.08 ? 3 : 1);
        G.pxDisc(ctx, bx, by, 10 * (1 - this.t / this.dur), 5 * (1 - this.t / this.dur), 9, 1);
      }
    });
    W.flashScreen = Math.max(W.flashScreen, 0.12);
  },
  // 升級光柱（v3.14 加強：依英雄階級換色、地面雙衝擊波、星芒、數字跳出、能力成長字；進階時更大）
  levelUp(W, u, o2) {
    o2 = o2 || {}; const tc = G.HERO_TIER ? G.HERO_TIER[G.heroTier(u.level || 1)].c : 13, col = tc === 9 ? 13 : tc, big = !!o2.tier, H = big ? 120 : 90;
    W.effects.push({
      t: 0, dur: big ? 1.3 : 1.0, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, cx = u.x * G.AX - o.x, cy = u.y * G.AY - o.y, w = Math.round((big ? 14 : 10) * (1 - p)) + 1;
        for (let yy = 0; yy < H; yy++) for (let xx = -w; xx <= w; xx++) { const f = (1 - p) * (1 - yy / H) * (1 - Math.abs(xx) / (w + 1)) * 1.6, b = G.bayer(cx + xx, cy - yy); if (b < f) { ctx.fillStyle = G.PAL[b < f * 0.35 ? 9 : col]; ctx.fillRect(Math.round(cx + xx), Math.round(cy - yy), 1, 1); } }
      }
    });
    G.FX.ring(W, u.x, u.y, 6, big ? 110 : 76, 0.5, col, 2); G.FX.ring(W, u.x, u.y, 2, big ? 70 : 46, 0.35, 9, 1);
    if (G.VFX) { G.VFX.groundLight(W, u.x, u.y, big ? 44 : 30, col, 0.7, 0.7); G.VFX.light(W, u.x, u.y, 14, big ? 40 : 28, col, 0.6, 0.8); G.VFX.spark(W, u.x, u.y, 34, big ? 18 : 12, col, 0.3); if (big) G.VFX.later(W, 0.12, () => G.VFX.ringAir(W, u.x, u.y, 18, 6, 50, 0.45, col, 2)); }
    for (let i = 0; i < (big ? 50 : 30); i++) { const a = Math.random() * 6.28; W.parts.add(u.x + Math.cos(a) * 14, u.y + Math.sin(a) * 10, G.rr(0, 10), 0, 0, G.rr(60, 160), G.rr(0.6, 1.2), i % 3 ? col : 9, 9, 1, -20, 1); }
    if (big) { W.flashScreen = Math.max(W.flashScreen, 0.1); W.shake(0.35); }
    // 等級數字：放大跳出、停一下再往上飄
    const lv = 'LV ' + (u.level || 1);
    W.effects.push({ t: 0, dur: 1.4, layer: 2, draw(ctx, o) {
      const p = this.t, k = p < 0.12 ? p / 0.12 : 1, sc = p < 0.12 ? 1 + k : p < 0.22 ? 3 - (p - 0.12) * 10 : 2, z = 58 + Math.max(0, p - 0.5) * 30;
      ctx.globalAlpha = p > 1.1 ? Math.max(0, (1.4 - p) / 0.3) : 1; G.text(ctx, lv, u.x * G.AX - o.x, u.y * G.AY - z * G.AZ - o.y - (sc - 1) * 3, col, Math.round(sc), 0, 0.5); ctx.globalAlpha = 1;
    } });
    // 能力成長：HP／攻擊增加量，一個接一個從身上冒出
    const gains = [o2.hp > 0 && ['HP+' + o2.hp, 10], o2.pow > 0 && ['ATK+' + o2.pow, 14]].filter(Boolean);
    gains.forEach(([t2, c2], i) => { const fn = () => G.FX.popText(W, u.x + (i ? 30 : -30), u.y, 14, t2, c2); G.VFX ? G.VFX.later(W, 0.25 + i * 0.18, fn) : fn(); });
  },
  // 英雄重生：天上一道細光落下 → 地面綠色光圈擴散 → 葉片與光點往上飄（不用升級特效，避免誤會成升級）
  respawn(W, u) {
    W.effects.push({
      t: 0, dur: 0.7, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, cx = Math.round(u.x * G.AX - o.x), cy = Math.round(u.y * G.AY - o.y), w = p < 0.25 ? 1 : Math.round(3 * (1 - p)) + 1, top = Math.round(cy - 90 * Math.min(1, p * 4));
        ctx.fillStyle = G.PAL[9]; ctx.globalAlpha = 1 - p; ctx.fillRect(cx - (w >> 1), top, w, cy - top); ctx.fillStyle = G.PAL[11]; ctx.fillRect(cx - (w >> 1) - 1, top, 1, cy - top); ctx.fillRect(cx + w - (w >> 1), top, 1, cy - top); ctx.globalAlpha = 1;
      }
    });
    G.FX.ring(W, u.x, u.y, 4, 46, 0.45, 11, 2); G.FX.ring(W, u.x, u.y, 2, 26, 0.3, 9, 1);
    for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28; W.parts.add(u.x + Math.cos(a) * 12, u.y + Math.sin(a) * 8, G.rr(0, 6), Math.cos(a) * 20, Math.sin(a) * 12, G.rr(40, 110), G.rr(0.6, 1.1), G.pick([11, 16, 9]), 6, 1, -10, 1); }
    W.flashScreen = Math.max(W.flashScreen, 0.06);
  },
  // 生成
  spawn(W, u) {
    G.FX.ring(W, u.x, u.y, 2, 22, 0.35, u.side === 0 ? 9 : 2);
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28; W.parts.add(u.x, u.y, 4, Math.cos(a) * 60, Math.sin(a) * 40, G.rr(40, 90), 0.4, u.side === 0 ? 8 : 2, 5, 1, 300, 2); }
  },
  // 點擊地面
  tap(W, x, y) { G.FX.ring(W, x, y, 16, 3, 0.3, 9, 1); },
  // 煙
  smoke(W, x, y, z, n = 5, col = 6) { for (let i = 0; i < n; i++) W.parts.add(x + G.rr(-4, 4), y, z, G.rr(-15, 15), G.rr(-8, 8), G.rr(20, 50), G.rr(0.4, 0.8), col, Math.max(1, col - 3), 2, -15, 2); }
,
  // 隕石：地面預告 + 落下，fall 秒後呼叫 onImpact
  meteor(W, tx, ty, R, onImpact, fall = 0.65) {
    W.effects.push({ t: 0, dur: fall, layer: 0, draw(ctx, o) { const p = this.t / fall; G.pxDisc(ctx, tx * G.AX - o.x, ty * G.AY - o.y, R * G.AX * p, R * G.AY * p, 0, 0.5); G.pxEllipse(ctx, tx * G.AX - o.x, ty * G.AY - o.y, R * G.AX, R * G.AY, 9, 4, this.t * 30); } });
    W.effects.push({
      t: 0, dur: fall, layer: 1, update(dt) {
        const p = this.t / fall, z = 300 * (1 - p), x = tx + 120 * (1 - p);
        for (let k = 0; k < 3; k++) W.parts.add(x + G.rr(-6, 6), ty, z + G.rr(-6, 6), G.rr(-20, 20), 0, G.rr(10, 40), G.rr(0.3, 0.6), 8, 4, G.ri(1, 3), 0, 2);
      },
      draw(ctx, o) {
        const p = this.t / fall, z = 300 * (1 - p), x = tx + 120 * (1 - p), cx = x * G.AX - o.x, cy = ty * G.AY - z * G.AZ - o.y;
        G.pxDisc(ctx, cx, cy, 9, 9, 3, 1); G.pxDisc(ctx, cx - 2, cy - 2, 7, 7, 6, 1); G.pxDisc(ctx, cx - 3, cy - 3, 4, 4, 9, 1);
      }
    });
    W.effects.push({ t: 0, dur: fall + 0.01, layer: 9, update() { if (this.t >= fall && !this.done) { this.done = 1; onImpact(); } } });
  },
  // 範圍爆炸外觀
  blast(W, x, y, R) {
    G.FX.wave(W, x, y, R * 1.2, 0.45); G.FX.ring(W, x, y, 6, R * 1.5, 0.5, 9, 3); G.FX.hit(W, x, y, 10, true);
    for (let k = 0; k < 60; k++) { const a = Math.random() * 6.28, s = G.rr(60, 260); W.parts.add(x, y, 4, Math.cos(a) * s, Math.sin(a) * s * 0.7, G.rr(80, 320), G.rr(0.5, 1.1), G.pick([9, 7, 4]), 2, G.ri(1, 3), 600, 1.5); }
    G.FX.smoke(W, x, y, 4, 14, 6); G.FX.scorch(W, x, y, R * 0.8, 6);
  },
  // 大地重擊外觀
  slam(W, x, y, R) {
    G.FX.wave(W, x, y, R, 0.4); G.FX.ring(W, x, y, 10, R, 0.35, 9, 2); G.FX.ring(W, x, y, 4, R * 0.7, 0.5, 7, 1);
    for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, r = G.rr(10, R); W.parts.add(x + Math.cos(a) * r, y + Math.sin(a) * r, 0, Math.cos(a) * 60, Math.sin(a) * 40, G.rr(60, 200), G.rr(0.4, 0.8), 6, 3, G.ri(1, 2), 500, 2); }
    G.FX.scorch(W, x, y, R * 0.55, 4);
  }
,
  // 地刺（召喚樹根／地矛亂刺）
  spikes(W, x, y, R) {
    const pts = []; for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, G.rr(0, 0.15)]); }
    W.effects.push({
      t: 0, dur: 0.7, layer: 1, draw(ctx, o) {
        for (const [px, py, d] of pts) {
          const k = G.clamp((this.t - d) / 0.12, 0, 1) * (this.t > 0.5 ? (0.7 - this.t) / 0.2 : 1), hh = Math.round(14 * k);
          if (hh <= 0) continue;
          const sx = Math.round(px * G.AX - o.x), sy = Math.round(py * G.AY - o.y);
          ctx.fillStyle = G.PAL[0]; ctx.fillRect(sx - 2, sy - hh, 4, hh);
          ctx.fillStyle = G.PAL[7]; ctx.fillRect(sx - 1, sy - hh + 1, 2, hh - 1); ctx.fillStyle = G.PAL[9]; ctx.fillRect(sx - 1, sy - hh + 1, 1, Math.max(1, hh - 3));
        }
      }
    });
    G.FX.ring(W, x, y, 4, R, 0.35, 7, 1); G.FX.scorch(W, x, y, R * 0.6, 3);
  }
};
