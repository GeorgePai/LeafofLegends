'use strict';
/* =========================================================
   全角色像素圖（程序繪製）
   每個角色一個繪製函式 (P, f)：P 為畫筆，f 為影格 0/1（走路/拍翅）
   全部面向右；敵方深色、我方淺色
   ========================================================= */
G.Painter = (w, h) => {
  const g = new Int8Array(w * h).fill(-1);
  const P = {
    w, h, g,
    px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y * w + x] = c; },
    e(cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) P.px(x, y, c); } },
    r(x, y, rw, rh, c) { for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) P.px(x + xx, y + yy, c); },
    l(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) P.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); },
    // 頂部打光 / 底部陰影（只作用於指定色）
    shade(base, hi, lo) {
      const s = g.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (s[i] !== base) continue;
        if (hi != null && (y === 0 || s[i - w] < 0)) g[i] = hi;
        else if (lo != null && (y === h - 1 || s[i + w] < 0)) g[i] = lo;
      }
    }
  };
  return P;
};
// 四足動物
G.quad = (P, f, o) => {
  const c = o.c ?? 1, lc = o.lc ?? 0;
  (o.legs || []).forEach((lx, i) => { const d = f ? (i % 2 ? 1 : -1) : 0; P.r(lx + d, o.ly, o.lw || 2, o.ll || 3, i < 2 && o.legs.length > 2 ? lc : c); });
  if (o.tail) P.l(o.bx - o.brx + 1, o.by - 1, o.bx - o.brx - o.tail[0], o.by - 1 - o.tail[1] + (f ? 1 : 0), c);
  P.e(o.bx, o.by, o.brx, o.bry, c);
  if (o.ear === 'r') { P.e(o.hx - o.hr * 0.4, o.hy - o.hr * 0.9, 1.6, 1.6, c); P.e(o.hx + o.hr * 0.3, o.hy - o.hr * 0.95, 1.6, 1.6, c); }
  if (o.ear === 'p') { P.l(o.hx - 2, o.hy - o.hr + 1, o.hx - 2, o.hy - o.hr - 2, c); P.l(o.hx + 1, o.hy - o.hr + 1, o.hx + 2, o.hy - o.hr - 2, c); }
  if (o.ear === 'f') { P.r(o.hx - 2, o.hy - o.hr, 2, 4, lc); }
  P.e(o.hx, o.hy, o.hr, o.hry || o.hr, c);
  if (o.snout) { P.r(o.hx + o.hr - 1, o.hy, o.snout, o.sh || 2, o.sc ?? 3); P.px(o.hx + o.hr - 2 + o.snout, o.hy, 0); }
  P.px(o.hx + Math.round(o.hr * 0.35), o.hy - Math.round((o.hry || o.hr) * 0.3), o.eye ?? 9);
};
// 鳥類（f 決定翅膀上/下）
G.bird = (P, f, o) => {
  const c = o.c ?? 1;
  if (f) { P.l(o.x - 1, o.y, o.x - o.ws, o.y + 3, c); P.l(o.x, o.y + 1, o.x - o.ws + 1, o.y + 4, c); }
  else { P.l(o.x - 1, o.y, o.x - o.ws, o.y - 4, c); P.l(o.x, o.y, o.x - o.ws + 2, o.y - 5, c); P.l(o.x + 1, o.y, o.x - o.ws + 4, o.y - 5, o.wc ?? 2); }
  P.e(o.x, o.y + 1, o.bw, o.bh, c);
  P.e(o.x + o.bw, o.y - 1, o.hr, o.hr, o.hc ?? c);
  P.r(o.x + o.bw + o.hr - 1, o.y - 1, o.beak || 2, 1, o.bc ?? 5);
  P.px(o.x + o.bw + 1, o.y - 2, o.eye ?? 9);
  P.l(o.x - o.bw, o.y + 1, o.x - o.bw - 3, o.y + 2, c);
};
// 直立生物
G.biped = (P, f, o) => {
  const c = o.c ?? 1;
  P.r(o.x - 2 + (f ? 1 : 0), o.y + o.bh - 1, 2, o.ll || 3, 0); P.r(o.x + 1 - (f ? 1 : 0), o.y + o.bh - 1, 2, o.ll || 3, c);
  P.e(o.x, o.y + o.bh / 2, o.bw, o.bh / 2 + 0.5, c);
  P.e(o.x + (o.hdx || 1), o.y - o.hr + 1, o.hr, o.hr, c);
  if (o.ear === 'r') { P.e(o.x - o.hr * 0.4, o.y - o.hr * 1.8 + 1, 1.5, 1.5, c); P.e(o.x + o.hr * 0.9, o.y - o.hr * 1.8 + 1, 1.5, 1.5, c); }
  if (o.ear === 'p') { P.l(o.x, o.y - o.hr * 2 + 1, o.x, o.y - o.hr * 2 - 1, c); P.l(o.x + 2, o.y - o.hr * 2 + 1, o.x + 3, o.y - o.hr * 2 - 1, c); }
  if (o.snout) { P.r(o.x + (o.hdx || 1) + o.hr - 1, o.y - o.hr + 1, o.snout, 2, 3); }
  P.px(o.x + (o.hdx || 1) + Math.round(o.hr * 0.4), o.y - o.hr, o.eye ?? 9);
  P.l(o.x + o.bw - 1, o.y + 2, o.x + o.bw + 2, o.y + 4 + (f ? -1 : 0), c);   // 手
};
// 力夫系英雄（淺色）
G.leafyBody = (P, f, o = {}) => {
  const cx = o.cx || 6.5, cy = o.cy || 8, r = o.r || 5;
  P.r(cx - 3 + (f ? 1 : 0), cy + r - 1, 2, 3, 6); P.r(cx + 1 - (f ? 1 : 0), cy + r - 1, 2, 3, 6);
  P.e(cx, cy, r + (o.wide || 0), r, 8);
  P.shade(8, 9, 7);
  P.px(cx + 1.5, cy - 1, 0); P.px(cx + 1.5, cy, 0); P.px(cx + 3.5, cy - 1, 0); P.px(cx + 3.5, cy, 0);
  if (o.sprout !== false) { P.px(cx, cy - r - 1, 6); P.px(cx, cy - r - 2, 5); P.px(cx - 1, cy - r - 2, 5); P.px(cx + 1, cy - r - 3, 6); }
};

G.BESTIARY = {
  // ---------- 英雄 ----------
  spearleafy: { w: 18, h: 16, ol: 0, draw(P, f) { G.leafyBody(P, f, { cx: 6.5, cy: 9 }); P.l(10, 11, 17, 2, 5); P.px(17, 1, 9); P.px(16, 1, 9); P.px(17, 2, 9); P.r(4, 3, 6, 1, 6); } },
  splashleafy: { w: 16, h: 16, ol: 0, draw(P, f) { G.leafyBody(P, f, { cx: 6.5, cy: 9 }); P.e(13, 9, 2.5, 2.5, 10); P.px(13, 6, 11); P.px(12, 8, 9); } },
  muscleleafy: { w: 18, h: 17, ol: 0, draw(P, f) { G.leafyBody(P, f, { cx: 8, cy: 9, r: 6, wide: 1 }); P.e(2, 10, 2, 2.5, 7); P.e(15, 10, 2.2, 2.5, 7); P.r(5, 4, 7, 1, 6); } },
  eliteleafy: { w: 14, h: 17, ol: 0, draw(P, f) { G.leafyBody(P, f, { cx: 6.5, cy: 10, sprout: false }); P.r(3, 3, 8, 2, 7); P.px(3, 2, 7); P.px(7, 1, 9); P.px(10, 2, 7); P.px(7, 3, 13); } },
  elitequickleafy: { w: 16, h: 16, ol: 0, draw(P, f) { G.leafyBody(P, f, { cx: 6.5, cy: 9 }); P.r(1, 6, 11, 1, 10); P.e(13, 11, 2.2, 2, 9); P.e(1, 11, 1.8, 1.8, 7); P.px(12, 6, 10); P.px(13, 7, 10); } },
  elitespearleafy: { w: 19, h: 17, ol: 0, draw(P, f) { G.leafyBody(P, f, { cx: 6.5, cy: 10, sprout: false }); P.e(6.5, 5, 5, 2.5, 6); P.px(6, 2, 9); P.l(10, 12, 18, 2, 5); P.l(17, 1, 18, 3, 9); P.px(18, 1, 9); P.e(2, 11, 2, 3, 7); } },
  cannonleafy: { w: 18, h: 16, ol: 0, draw(P, f) { G.leafyBody(P, f, { cx: 6.5, cy: 9 }); P.r(5, 4, 11, 4, 3); P.r(15, 3, 2, 6, 2); P.r(6, 4, 9, 1, 5); P.px(4, 6, 3); } },
  berserkerleafy: { w: 19, h: 18, ol: 0, draw(P, f) { G.leafyBody(P, f, { cx: 8, cy: 10, r: 6, wide: 1, sprout: false }); P.l(4, 4, 2, 1, 7); P.l(12, 4, 14, 1, 7); P.e(2, 11, 2, 2.5, 7); P.e(16, 11, 2.4, 2.6, 7); P.px(10, 9, 10); P.px(12, 9, 10); } },
  // ---------- 我方小兵 ----------
  potatoblower: { w: 13, h: 12, ol: 0, draw(P, f) { P.r(3 + f, 9, 2, 3, 6); P.r(8 - f, 9, 2, 3, 6); P.e(6.5, 6, 5.5, 4.5, 7); P.shade(7, 8, 6); P.px(3, 5, 5); P.px(6, 8, 5); P.px(9, 4, 0); P.px(10, 6, 5); P.l(6, 1, 4, 0, 6); P.l(7, 1, 9, 0, 6); } },
  stemskewer: { w: 16, h: 14, ol: 0, draw(P, f) { P.r(4 + f, 11, 2, 3, 6); P.r(7 - f, 11, 2, 3, 6); P.r(5, 4, 3, 8, 7); P.shade(7, 8, 6); P.l(8, 6, 15, 3, 9); P.px(15, 2, 9); P.e(6.5, 3, 2.5, 2.5, 8); P.px(7, 2, 0); P.l(3, 6, 1, 4, 6); } },
  twinflower: { w: 11, h: 13, ol: 0, draw(P, f) { P.r(3 + f, 10, 2, 3, 6); P.r(6 - f, 10, 2, 3, 6); P.l(5, 9, 5, 6, 6); P.l(5, 8, 8, 6, 6); P.px(8, 6, 7); P.e(5, 3.5, 3.4, 3.2, 8); P.e(5, 3.5, 1.6, 1.4, 9); P.px(4, 3, 0); P.px(6, 3, 0); P.px(5, 0, 7); P.px(2, 2, 7); P.px(8, 2, 7); } },
  peasniper: { w: 18, h: 12, ol: 0, draw(P, f) { P.r(3 + f, 9, 2, 3, 6); P.r(6 - f, 9, 2, 3, 6); P.e(5, 5.5, 4.5, 4, 8); P.shade(8, 9, 7); P.r(8, 4, 9, 2, 7); P.r(16, 3, 2, 4, 6); P.r(9, 2, 3, 2, 3); P.px(6, 4, 0); } },
  leafmuscle: { w: 17, h: 15, ol: 0, draw(P, f) { P.r(5 + f, 12, 2, 3, 6); P.r(10 - f, 12, 2, 3, 6); P.e(8.5, 8, 5.5, 5, 7); P.shade(7, 8, 6); P.e(2, 9, 2.2, 3, 6); P.e(15, 8, 2.4, 3, 6); P.l(6, 2, 8, 4, 6); P.l(11, 2, 9, 4, 6); P.px(10, 7, 0); P.px(12, 7, 0); } },
  fruitpult: { w: 16, h: 14, ol: 0, draw(P, f) { P.r(2, 11, 12, 2, 5); P.e(3, 13, 1.5, 1.5, 3); P.e(12, 13, 1.5, 1.5, 3); P.r(4, 8, 8, 3, 7); P.shade(7, 8, 6); P.l(7, 8, 13 - f * 2, 2 + f * 2, 6); P.e(13 - f * 2, 2 + f * 2, 2.2, 2.2, 10); P.px(9, 9, 0); } },
  flame: { w: 13, h: 14, ol: 0, draw(P, f) { P.r(5, 9, 2, 3, 6); P.r(3 + f, 12, 2, 2, 6); P.r(7 - f, 12, 2, 2, 6); P.e(6.5, 5.5, 4.5, 4.5, 14); P.e(6.5, 6, 3, 3, 13); P.px(6, 0, 14); P.px(3, 1, 14); P.px(10, 1, 14); P.px(8, 5, 0); P.r(9, 6, 3, 2, 8); } },
  sunshooter: { w: 14, h: 14, ol: 0, draw(P, f) { P.r(6, 9, 2, 3, 6); P.r(4 + f, 12, 2, 2, 6); P.r(8 - f, 12, 2, 2, 6); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; P.e(7 + Math.cos(a) * 4.3, 5 + Math.sin(a) * 4.3, 1.6, 1.6, 9); } P.e(7, 5, 3, 3, 13); P.px(8, 4, 0); } },
  iceshooter: { w: 13, h: 13, ol: 0, draw(P, f) { P.r(5, 9, 2, 2, 6); P.r(3 + f, 11, 2, 2, 6); P.r(7 - f, 11, 2, 2, 6); P.e(6, 5.5, 4, 4, 8); P.shade(8, 9, 7); P.l(6, 0, 6, 2, 12); P.l(2, 2, 3, 3, 12); P.l(10, 2, 9, 3, 12); P.r(9, 5, 4, 2, 12); P.px(7, 4, 0); } },
  poisonshooter: { w: 13, h: 13, ol: 0, draw(P, f) { P.r(5, 9, 2, 2, 6); P.r(3 + f, 11, 2, 2, 6); P.r(7 - f, 11, 2, 2, 6); P.e(6, 5.5, 4.5, 4.2, 7); P.shade(7, 8, 6); P.px(3, 4, 11); P.px(5, 7, 11); P.px(8, 3, 11); P.r(9, 5, 4, 2, 6); P.px(12, 7, 11); P.px(7, 4, 0); } },
  flametree: { w: 15, h: 15, ol: 0, draw(P, f) { P.r(3 + f, 12, 3, 3, 6); P.r(9 - f, 12, 3, 3, 6); P.r(3, 5, 9, 8, 7); P.shade(7, 8, 6); P.px(5, 8, 0); P.px(9, 8, 0); P.e(5, 3, 2, 3, 14); P.e(9, 2.5, 2, 3.5, 14); P.e(7, 4, 1.5, 2, 13); P.px(12, 3, 14); } },
  vampireflower: { w: 15, h: 14, ol: 0, draw(P, f) { P.r(5, 9, 2, 3, 6); P.r(3 + f, 12, 2, 2, 6); P.r(7 - f, 12, 2, 2, 6); P.e(7, 3.5 - f, 6, 3, 8); P.e(7, 7.5 + f, 6, 2.5, 7); for (let x = 3; x < 13; x += 2) { P.px(x, 5 - f, 9); P.px(x + 1, 6 + f, 9); } P.px(9, 2, 10); } },
  elitepeasniper: { w: 18, h: 13, ol: 0, draw(P, f) { P.r(3 + f, 10, 2, 3, 6); P.r(6 - f, 10, 2, 3, 6); P.e(5, 6.5, 4.5, 4, 8); P.shade(8, 9, 7); P.e(5, 3, 4, 2, 5); P.r(8, 5, 9, 2, 7); P.r(16, 4, 2, 4, 6); P.r(9, 3, 3, 2, 3); P.px(6, 5, 0); } },
  leaftanker: { w: 16, h: 15, ol: 0, draw(P, f) { P.r(4 + f, 12, 2, 3, 6); P.r(8 - f, 12, 2, 3, 6); P.e(6.5, 7, 5, 5.5, 7); P.shade(7, 8, 6); P.px(8, 5, 0); P.e(13, 7.5, 2.5, 5.5, 6); P.l(13, 3, 13, 12, 5); } },
  treestun: { w: 16, h: 15, ol: 0, draw(P, f) { P.r(3 + f, 12, 3, 3, 6); P.r(8 - f, 12, 3, 3, 6); P.r(2, 3, 9, 10, 7); P.shade(7, 8, 6); P.r(2, 1, 9, 2, 6); P.px(5, 6, 0); P.px(8, 6, 0); P.l(11, 9, 15, 3, 5); P.e(15, 3, 1.5, 2, 4); } },
  // ---------- 敵方小怪 ----------
  mouse: { w: 13, h: 9, draw(P, f) { G.quad(P, f, { bx: 5.5, by: 5, brx: 4.5, bry: 2.8, hx: 9.5, hy: 4, hr: 2.5, legs: [3, 7], ly: 7, ll: 2, ear: 'r', snout: 2, tail: [3, -1] }); } },
  whitemouse: { w: 13, h: 9, draw(P, f) { G.quad(P, f, { c: 4, lc: 3, bx: 5.5, by: 5, brx: 4.5, bry: 2.8, hx: 9.5, hy: 4, hr: 2.5, legs: [3, 7], ly: 7, ll: 2, ear: 'r', snout: 2, tail: [3, -1], eye: 10 }); } },
  boar: { w: 15, h: 11, draw(P, f) { G.quad(P, f, { bx: 6.5, by: 5.5, brx: 5.5, bry: 3.5, hx: 11, hy: 5.5, hr: 3, legs: [3, 9, 4, 10], ly: 8, ll: 3, ear: 'p', snout: 2, tail: [2, 1] }); P.px(13, 7, 9); P.px(14, 6, 9); for (let x = 3; x < 10; x += 2) P.px(x, 1, 1); } },
  bigboar: { w: 19, h: 14, draw(P, f) { G.quad(P, f, { bx: 8, by: 7, brx: 7, bry: 4.5, hx: 14, hy: 7, hr: 3.8, legs: [4, 11, 5, 12], ly: 10, ll: 4, lw: 3, ear: 'p', snout: 2, tail: [2, 1] }); P.l(16, 9, 18, 6, 9); for (let x = 3; x < 13; x += 2) P.l(x, 2, x - 1, 0, 1); } },
  chipmunk: { w: 13, h: 12, draw(P, f) { P.e(3, 5, 2.5, 4, 2); P.l(2, 2, 2, 7, 3); G.biped(P, f, { x: 7, y: 5, bw: 3, bh: 4, hr: 2.5, ll: 3, ear: 'r', snout: 1 }); } },
  dog: { w: 14, h: 11, draw(P, f) { G.quad(P, f, { bx: 6, by: 6, brx: 4.5, bry: 2.8, hx: 10.5, hy: 4, hr: 2.8, legs: [3, 8, 4, 9], ly: 8, ll: 3, ear: 'f', snout: 2, tail: [2, 3] }); } },
  bear: { w: 13, h: 14, draw(P, f) { G.biped(P, f, { x: 6, y: 6, bw: 4.5, bh: 5, hr: 3.2, ll: 3, ear: 'r', snout: 2 }); } },
  spearbear: { w: 17, h: 14, draw(P, f) { G.biped(P, f, { x: 6, y: 6, bw: 4.5, bh: 5, hr: 3.2, ll: 3, ear: 'r', snout: 2 }); P.l(8, 12, 16, 1, 4); P.px(16, 0, 7); P.px(15, 1, 7); } },
  gnomebaby: { w: 12, h: 13, draw(P, f) { G.biped(P, f, { x: 5, y: 8, bw: 3, bh: 3, hr: 4, ll: 2, hdx: 1 }); P.e(6, 2.5, 1.5, 1.5, 8); P.px(6, 2, 1); } },
  gorilla: { w: 16, h: 15, draw(P, f) { P.r(2 + f, 11, 3, 4, 0); P.r(10 - f, 11, 3, 4, 1); P.e(7.5, 7, 6, 5, 1); P.e(12, 4, 3, 3, 1); P.r(13, 4, 2, 2, 3); P.px(13, 3, 9); P.r(13, 8, 3, 6, 1); P.r(1, 8, 3, 6, 0); } },
  monkey: { w: 14, h: 13, draw(P, f) { P.l(2, 9, 0, 5, 1); P.px(1, 4, 1); P.px(2, 4, 1); G.biped(P, f, { x: 6, y: 6, bw: 3, bh: 4, hr: 3, ll: 3, ear: 'r', snout: 1 }); P.e(11, 9, 1.5, 1.5, 4); } },
  hippo: { w: 18, h: 12, draw(P, f) { G.quad(P, f, { bx: 7, by: 6.5, brx: 6.5, bry: 4, hx: 13.5, hy: 6, hr: 3.5, hry: 3, legs: [3, 10, 4, 11], ly: 9, ll: 3, lw: 3, ear: 'r', snout: 2, sh: 3 }); P.px(16, 8, 9); } },
  crocodile: { w: 20, h: 9, draw(P, f) { G.quad(P, f, { bx: 8, by: 5, brx: 6.5, bry: 2.5, hx: 14.5, hy: 4.5, hr: 2.2, legs: [4, 11, 5, 12], ly: 6, ll: 2, snout: 5, sh: 2, tail: [6, -1] }); for (let x = 16; x < 20; x += 2) P.px(x, 6, 9); for (let x = 3; x < 13; x += 2) P.px(x, 2, 2); } },
  kangaroo: { w: 15, h: 15, draw(P, f) { P.l(4, 11, 0, 14, 1); P.r(5 + f * 2, 12, 4, 3, 0); G.biped(P, f, { x: 7, y: 6, bw: 3.5, bh: 5, hr: 2.6, ll: 2, ear: 'p', snout: 2 }); } },
  madbuffalo: { w: 18, h: 13, draw(P, f) { G.quad(P, f, { bx: 7.5, by: 7, brx: 6.5, bry: 4, hx: 13.5, hy: 6.5, hr: 3, legs: [3, 10, 4, 11], ly: 10, ll: 3, tail: [2, 2], eye: 10 }); P.l(12, 3, 13, 1, 6); P.l(15, 3, 17, 1, 6); P.e(6, 3, 4, 1.5, 1); } },
  splashbuffalo: { w: 18, h: 13, draw(P, f) { G.quad(P, f, { bx: 7.5, by: 7, brx: 6.5, bry: 4, hx: 13.5, hy: 6.5, hr: 3, legs: [3, 10, 4, 11], ly: 10, ll: 3, tail: [2, 2] }); P.l(12, 3, 13, 1, 6); P.l(15, 3, 17, 1, 6); P.e(6, 2.5, 3, 1.5, 14); P.px(5, 0, 13); P.px(8, 1, 14); } },
  babybear2: null,
  // ---------- 飛行 ----------
  bat: { w: 14, h: 10, fly: 1, draw(P, f) { const y = 5; if (f) { P.l(6, y, 1, y + 3, 1); P.l(8, y, 13, y + 3, 1); } else { P.l(6, y, 0, y - 4, 1); P.l(8, y, 13, y - 4, 1); P.l(1, y - 3, 3, y, 2); P.l(12, y - 3, 10, y, 2); } P.e(7, y + 1, 2.2, 2.5, 1); P.px(6, y - 2, 1); P.px(8, y - 2, 1); P.px(8, y, 9); } },
  vampirebat: { w: 16, h: 11, fly: 1, draw(P, f) { const y = 5; if (f) { P.l(7, y, 1, y + 4, 1); P.l(9, y, 15, y + 4, 1); } else { P.l(7, y, 0, y - 4, 1); P.l(9, y, 15, y - 4, 1); P.l(1, y - 3, 4, y, 2); P.l(14, y - 3, 11, y, 2); } P.e(8, y + 1, 2.8, 3, 1); P.px(7, y - 2, 1); P.px(9, y - 2, 1); P.px(9, y, 10); P.px(8, y + 3, 9); P.px(10, y + 3, 9); } },
  blackvulture: { w: 15, h: 11, fly: 1, draw(P, f) { G.bird(P, f, { x: 6, y: 5, bw: 3.5, bh: 2.8, hr: 2, ws: 6, hc: 3, beak: 2, bc: 6 }); } },
  raven: { w: 14, h: 10, fly: 1, draw(P, f) { G.bird(P, f, { x: 6, y: 5, bw: 3, bh: 2.2, hr: 1.8, ws: 6, beak: 3, bc: 3 }); } },
  // ---------- 首領 ----------
  tiger: { w: 20, h: 13, boss: 1, draw(P, f) { G.quad(P, f, { bx: 8.5, by: 6.5, brx: 7, bry: 3.5, hx: 15, hy: 5.5, hr: 3.2, legs: [4, 12, 5, 13], ly: 9, ll: 4, ear: 'r', snout: 1, tail: [4, 4] }); for (let x = 4; x < 14; x += 3) P.l(x, 3, x + 1, 6, 3); P.px(16, 7, 9); } },
  penguin: { w: 13, h: 17, boss: 1, draw(P, f) { P.r(3 + f, 15, 3, 2, 5); P.r(7 - f, 15, 3, 2, 5); P.e(6, 9, 5, 6.5, 1); P.e(7, 10, 3, 5, 4); P.e(7, 3.5, 3.5, 3.5, 1); P.r(10, 3, 3, 2, 13); P.px(8, 2, 9); P.l(1, 7, 0, 12, 1); } },
  polarbear: { w: 21, h: 14, boss: 1, draw(P, f) { G.quad(P, f, { c: 4, lc: 3, bx: 9, by: 7, brx: 7.5, bry: 4.5, hx: 16, hy: 6, hr: 3.5, legs: [4, 13, 5, 14], ly: 10, ll: 4, lw: 3, ear: 'r', snout: 2, sc: 5 }); P.shade(4, 6, null); } },
  turtle: { w: 19, h: 12, boss: 1, draw(P, f) { P.r(4 + f, 9, 3, 3, 3); P.r(12 - f, 9, 3, 3, 3); P.e(15.5, 6, 2.5, 2.2, 3); P.px(16, 5, 9); P.e(9, 6, 7, 5, 1); for (let i = 0; i < 3; i++) P.e(5 + i * 4, 5, 1.5, 1.5, 2); P.r(2, 9, 14, 1, 2); } },
  gnome: { w: 15, h: 18, boss: 1, draw(P, f) { G.biped(P, f, { x: 6, y: 10, bw: 4, bh: 5, hr: 4.5, ll: 2 }); P.l(6, 0, 2, 6, 1); P.l(6, 0, 11, 6, 1); P.e(7, 6, 1.6, 1.6, 8); P.px(7, 6, 1); P.l(12, 2, 12, 16, 4); P.e(12, 2, 1.5, 1.5, 8); } },
  buffalo: { w: 22, h: 15, boss: 1, draw(P, f) { G.quad(P, f, { bx: 9, by: 8.5, brx: 8, bry: 5, hx: 16.5, hy: 8, hr: 3.5, legs: [4, 13, 5, 14], ly: 12, ll: 3, lw: 3, tail: [2, 2] }); P.e(7, 4, 5, 2.5, 1); P.l(14, 4, 13, 1, 6); P.l(19, 4, 21, 1, 6); P.px(12, 0, 6); } },
  cat: { w: 19, h: 13, boss: 1, draw(P, f) { G.quad(P, f, { bx: 8, by: 7, brx: 6, bry: 3.5, hx: 14, hy: 5, hr: 3, legs: [4, 11, 5, 12], ly: 9, ll: 4, ear: 'p', tail: [3, 5], eye: 13 }); P.px(17, 6, 3); } },
  lion: { w: 21, h: 14, boss: 1, draw(P, f) { G.quad(P, f, { bx: 8.5, by: 7.5, brx: 7, bry: 3.8, hx: 15.5, hy: 6, hr: 3, legs: [4, 13, 5, 14], ly: 10, ll: 4, tail: [4, 2] }); P.e(14.5, 6, 5, 5.2, 2); P.e(15.5, 6, 3, 3, 1); P.r(17, 7, 2, 2, 3); P.px(16, 5, 9); P.e(4, 6, 1, 1, 2); } },
  madwolf: { w: 19, h: 13, boss: 1, draw(P, f) { G.quad(P, f, { bx: 8, by: 7, brx: 6.5, bry: 3.5, hx: 14, hy: 5, hr: 3, legs: [4, 11, 5, 12], ly: 9, ll: 4, ear: 'p', snout: 3, tail: [4, 3], eye: 10 }); for (let x = 3; x < 12; x += 2) P.l(x, 4, x - 1, 2, 1); P.px(17, 7, 9); } },
  smartmonkey: { w: 16, h: 14, boss: 1, draw(P, f) { P.l(2, 10, 0, 6, 1); P.px(1, 5, 1); G.biped(P, f, { x: 6, y: 7, bw: 3.5, bh: 4, hr: 3.2, ll: 3, ear: 'r', snout: 1 }); P.e(12, 8, 2, 2, 4); P.px(12, 5, 14); P.px(11, 6, 14); P.px(13, 6, 13); P.r(4, 1, 5, 1, 13); } },
  firebear: { w: 15, h: 17, boss: 1, draw(P, f) { G.biped(P, f, { x: 7, y: 8, bw: 5, bh: 6, hr: 3.6, ll: 3, ear: 'r', snout: 2, eye: 14 }); P.px(3, 7, 14); P.px(4, 5, 14); P.px(6, 10, 14); P.px(9, 12, 13); P.px(2, 10, 14); } },
  firegnome: { w: 16, h: 19, boss: 1, draw(P, f) { G.biped(P, f, { x: 6, y: 11, bw: 4, bh: 5, hr: 4.5, ll: 2 }); P.l(6, 1, 2, 7, 1); P.l(6, 1, 11, 7, 1); P.e(7, 7, 1.6, 1.6, 14); P.l(13, 3, 13, 18, 4); P.e(13, 2.5, 2, 2.5, 14); P.px(13, 1, 13); P.px(6, 0, 14); } },
  // ---------- 塔 ----------
  etower2: { w: 16, h: 22, tower: 1, draw(P) { P.r(2, 12, 12, 10, 1); P.r(1, 11, 14, 2, 2); P.r(3, 21, 10, 1, 0); P.px(6, 15, 9); P.px(9, 15, 9); P.l(4, 11, 12, 2, 3); P.e(12, 2, 2.5, 2.5, 10); P.px(4, 18, 2); P.px(11, 18, 2); } },
  etower3: { w: 14, h: 24, tower: 1, draw(P) { P.r(3, 16, 8, 8, 1); P.r(2, 22, 10, 2, 2); P.l(7, 0, 3, 8, 3); P.l(7, 0, 11, 8, 3); P.e(7, 8, 4, 8, 2); P.e(7, 6, 2, 3, 13); P.px(7, 5, 9); P.px(6, 18, 9); P.px(8, 18, 9); } },
  etower4: { w: 26, h: 28, tower: 1, draw(P) { P.r(2, 10, 22, 18, 1); for (let x = 2; x < 24; x += 4) P.r(x, 7, 2, 3, 1); P.r(9, 2, 8, 9, 2); P.r(9, 0, 2, 2, 2); P.r(15, 0, 2, 2, 2); P.px(11, 5, 9); P.px(14, 5, 9); P.r(11, 20, 4, 8, 0); P.r(4, 14, 2, 3, 0); P.r(20, 14, 2, 3, 0); P.r(2, 27, 22, 1, 0); P.shade(1, 2, null); } },
  mtower: { w: 16, h: 20, tower: 1, ol: 0, draw(P) { P.r(6, 9, 4, 11, 7); P.shade(7, 8, 6); P.e(8, 6, 7.5, 5, 8); P.shade(8, 9, 7); P.px(4, 4, 6); P.px(10, 3, 6); P.px(12, 6, 6); P.px(7, 13, 0); P.px(9, 13, 0); } }
};
delete G.BESTIARY.babybear2;

// ---------- v3.8 大塔（Pai：塔太小、存在感低 → 重畫約 3 倍大）----------
// 共用畫法：石磚塔身（左亮右暗、磚縫錯開）＋ 底座 ＋ 城垛 ＋ 頂部造型（tier：0 外塔 1 中塔 2 內塔）＋ 水晶
// K：配色 { s 石, hi 亮面, lo 暗面, m 磚縫, a 點綴, a2 點綴暗, c 水晶, cc 水晶亮, w 窗內 }
G.towerArt = (W, H, tier, K, main) => P => {
  const cx = W / 2, bw = main ? W - 22 : Math.round(W * 0.5), top = main ? Math.round(H * 0.42) : Math.round(H * (tier === 2 ? 0.42 : tier === 1 ? 0.38 : 0.34));
  const brick = (x, y, w, h) => {                                    // 石磚：左 2 欄亮、右 2 欄暗、每 4 列一道縫、直縫錯開
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const X = x + xx, Y = y + yy, row = Math.floor(yy / 4), mor = yy % 4 === 3 || ((xx + (row % 2) * 3) % 6 === 5 && yy % 4 !== 3);
      P.px(X, Y, mor ? K.m : xx < 2 ? K.hi : xx >= w - 2 ? K.lo : K.s);
    } };
  const crystal = (x, y, h, w) => {                                  // 菱形水晶：中間亮線＋左上反光
    for (let i = 0; i <= h; i++) { const k = 1 - Math.abs(i - h * 0.45) / (h * 0.55), hw = Math.max(0, Math.round(w / 2 * Math.max(0, k))); for (let d = -hw; d <= hw; d++) P.px(x + d, y + i, d < 0 ? K.c : K.a2); }
    for (let i = 2; i < h - 1; i++) P.px(x, y + i, K.cc); P.px(x - 1, y + Math.round(h * 0.3), 9); P.px(x - 2, y + Math.round(h * 0.4), K.cc);
  };
  // 底座（三層台階）
  P.r(Math.round(cx - bw / 2 - 5), H - 4, bw + 10, 4, K.lo); P.r(Math.round(cx - bw / 2 - 3), H - 7, bw + 6, 3, K.s); P.r(Math.round(cx - bw / 2 - 3), H - 7, bw + 6, 1, K.hi);
  if (main) {
    // 主塔：中央城樓＋左右兩座副塔＋城門
    const sw = 13, sh = Math.round(H * 0.62);
    for (const sx of [2, W - sw - 2]) { brick(sx, H - 7 - sh + 6, sw, sh - 6); P.r(sx - 1, H - 7 - sh + 2, sw + 2, 4, K.s); P.r(sx - 1, H - 7 - sh + 2, sw + 2, 1, K.hi); for (let x = sx - 1; x < sx + sw + 1; x += 4) P.r(x, H - 7 - sh - 1, 2, 3, K.s);
      P.r(sx + 5, H - 7 - sh + 12, 3, 6, K.w); P.px(sx + 6, H - 7 - sh + 13, K.a); }
    brick(Math.round(cx - bw / 2), top, bw, H - 7 - top);
    P.r(Math.round(cx - bw / 2) - 3, top - 4, bw + 6, 5, K.s); P.r(Math.round(cx - bw / 2) - 3, top - 4, bw + 6, 1, K.hi);
    for (let x = Math.round(cx - bw / 2) - 3; x < cx + bw / 2 + 3; x += 5) P.r(x, top - 8, 3, 4, K.s);
    // 城門（拱形）＋門上旗幟
    P.e(cx, H - 15, 6, 7, K.m); P.r(Math.round(cx - 6), H - 15, 12, 8, K.m); P.e(cx, H - 15, 5, 6, K.w); P.r(Math.round(cx - 5), H - 15, 10, 8, K.w);
    for (let x = Math.round(cx - 4); x <= cx + 4; x += 2) P.l(x, H - 20, x, H - 8, K.lo);
    P.r(Math.round(cx - 9), top + 6, 4, 12, K.a); P.r(Math.round(cx + 5), top + 6, 4, 12, K.a); P.px(cx - 7, top + 17, K.a2); P.px(cx + 7, top + 17, K.a2);
    // 屋頂尖塔＋大水晶
    for (let i = 0; i < 12; i++) P.r(Math.round(cx - 1 - i * 0.7), top - 9 - 12 + i, Math.round(2 + i * 1.4), 1, i < 2 ? K.a : K.lo);
    crystal(cx, 0, Math.round(top - 22), 10);
    return;
  }
  // 塔身
  brick(Math.round(cx - bw / 2), top, bw, H - 7 - top);
  // 箭孔窗、腰帶
  const wy = top + Math.round((H - 7 - top) * 0.35);
  P.r(Math.round(cx - 1), wy, 3, 6, K.w); P.px(cx, wy + 1, K.a);
  if (tier >= 1) { P.r(Math.round(cx - bw / 2 + 3), wy + 2, 2, 4, K.w); P.r(Math.round(cx + bw / 2 - 5), wy + 2, 2, 4, K.w); }
  const band = top + Math.round((H - 7 - top) * 0.68); P.r(Math.round(cx - bw / 2) - 1, band, bw + 2, 3, K.a); P.r(Math.round(cx - bw / 2) - 1, band + 2, bw + 2, 1, K.a2);
  // 平台＋城垛
  const pw = bw + 8; P.r(Math.round(cx - pw / 2), top - 5, pw, 5, K.s); P.r(Math.round(cx - pw / 2), top - 5, pw, 1, K.hi); P.r(Math.round(cx - pw / 2), top - 1, pw, 1, K.lo);
  for (let x = Math.round(cx - pw / 2); x < cx + pw / 2; x += 5) P.r(x, top - 9, 3, 4, K.s);
  if (tier === 0) crystal(cx, Math.round(top * 0.12), Math.round(top * 0.7), 9);                 // 外塔：一顆浮空水晶
  if (tier === 1) {                                                                                 // 中塔：兩支角＋水晶
    for (let i = 0; i < 10; i++) { P.px(cx - 8 - i * 0.35, top - 10 - i, K.a); P.px(cx + 8 + i * 0.35, top - 10 - i, K.a); P.px(cx - 7 - i * 0.35, top - 10 - i, K.a2); P.px(cx + 7 + i * 0.35, top - 10 - i, K.a2); }
    crystal(cx, Math.round(top * 0.08), Math.round(top * 0.68), 11);
  }
  if (tier === 2) {                                                                                 // 內塔：尖頂屋＋大水晶＋兩側旗
    const rh = Math.round(top * 0.4); for (let i = 0; i < rh; i++) { const hw = Math.round((pw / 2) * (i / rh)); P.r(Math.round(cx - hw), top - 9 - rh + i, hw * 2, 1, i % 3 === 0 ? K.lo : K.a); }
    crystal(cx, 0, Math.round(top - 9 - rh + 2), 12);
    for (const sd of [-1, 1]) { const fx = Math.round(cx + sd * (pw / 2 + 1)); P.l(fx, top - 14, fx, top - 1, K.lo); P.r(sd < 0 ? fx - 5 : fx + 1, top - 14, 5, 4, K.a); }
  }
};
{
  const E = { s: 2, hi: 3, lo: 1, m: 0, a: 15, a2: 10, c: 10, cc: 13, w: 0 };                  // 敵方：暗石、深紅點綴、紅水晶
  const A = { s: 7, hi: 8, lo: 5, m: 4, a: 16, a2: 11, c: 11, cc: 9, w: 3 };                    // 我方：淺石、綠葉點綴、綠水晶
  Object.assign(G.BESTIARY, {
    tw_e0: { w: 42, h: 57, tower: 1, draw: G.towerArt(42, 57, 0, E) }, tw_e1: { w: 44, h: 66, tower: 1, draw: G.towerArt(44, 66, 1, E) },
    tw_e2: { w: 46, h: 75, tower: 1, draw: G.towerArt(46, 75, 2, E) }, tw_em: { w: 64, h: 84, tower: 1, draw: G.towerArt(64, 84, 9, E, 1) },
    tw_p0: { w: 42, h: 57, tower: 1, draw: G.towerArt(42, 57, 0, A) }, tw_p1: { w: 44, h: 66, tower: 1, draw: G.towerArt(44, 66, 1, A) },
    tw_p2: { w: 46, h: 75, tower: 1, draw: G.towerArt(46, 75, 2, A) }, tw_pm: { w: 64, h: 84, tower: 1, draw: G.towerArt(64, 84, 9, A, 1) }
  });
}

// 外觀表補齊（半徑依圖寬推算）
G.buildBestiary = function () {
  for (const k in G.BESTIARY) {
    const d = G.BESTIARY[k], frames = [];
    for (let f = 0; f < (d.tower ? 1 : 2); f++) {
      const P = G.Painter(d.w, d.h); d.draw(P, f);
      if (d.ol == null && !d.tower) P.shade(1, 2, null);
      frames.push(G.spriteFromGrid(P.g, d.w, d.h, { outline: d.ol != null ? d.ol : (d.tower ? 4 : 0), bright: d.ol === 0 && !d.tower }));
    }
    G.SPR[k] = frames;
  }
  const towerSpr = { player_tower: 'tw_p0', enemy_tower: 'tw_e0', enemy_tower2: 'tw_e1', enemy_tower3: 'tw_e2', enemy_tower4: 'tw_em', mushroom_tower: 'mtower' };   // v3.8 大塔
  for (const name in towerSpr) { const big = name === 'enemy_tower4'; G.VIS[name] = Object.assign({}, G.VIS[name] || {}, { spr: towerSpr[name], r: big ? 30 : name === 'mushroom_tower' ? 16 : 22, shadow: big ? 30 : name === 'mushroom_tower' ? 13 : 21 }); }
  // 我方塔依層級換圖（world 建塔時用）
  G.TOWER_VIS = { 0: 'tw_p0', 1: 'tw_p1', 2: 'tw_p2', 9: 'tw_pm' };
  for (const name in G.ORIG.units) {
    if (G.VIS[name]) continue;
    const s = G.SPR[name]; if (!s) continue;
    const d = G.BESTIARY[name] || {}, w = s[0].w;
    G.VIS[name] = { spr: name, r: G.clamp(Math.round(w * 0.62), 7, 17), shadow: G.clamp(Math.round(w * 0.55), 6, 15), fly: d.fly ? 24 : 0 };
  }
};
