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
// v3.9 立體塔：圓柱體受光（左上來光、蘭伯特明暗＋網點過渡）、磚縫沿弧線彎曲、接縫越靠邊越密、
// 橢圓頂面與前後城垛分層、挑簷與底部接觸陰影、圓錐屋頂、多切面水晶（Pai：塔看起來太扁平）
G.towerArt = (W, H, tier, K, main) => P => {
  const RY = 0.4, BY = [0, 0.5, 0.75, 0.25];
  const lam = (nx, nz) => 0.2 + 0.8 * Math.max(0, -0.62 * nx + 0.78 * nz);
  const pick = (ramp, I, x, y) => { const v = G.clamp(I, 0, 1) * (ramp.length - 1); let i = Math.floor(v); if (v - i > BY[(x & 1) + ((y & 1) << 1)]) i++; return ramp[G.clamp(i, 0, ramp.length - 1)]; };
  const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5; return h - Math.floor(h); };
  // 圓柱：cx 中心、yT/yB 為頂/底面中心線；o.brick 磚紋、o.aoT 頂部挑簷陰影列數、o.dth 磚寬（弧度）
  const cyl = (cx, yT, yB, rx, ramp, o = {}) => {
    const ry = rx * RY, dth = o.dth || Math.PI / 6;
    for (let X = Math.floor(cx - rx); X < Math.ceil(cx + rx); X++) {
      const nx = (X + 0.5 - cx) / rx; if (Math.abs(nx) >= 1) continue;
      const nz = Math.sqrt(1 - nx * nx), off = ry * nz, nx2 = Math.min(0.999, (X + 1.5 - cx) / rx);
      for (let Y = Math.round(yT + off); Y <= Math.round(yB + off); Y++) {
        let I = lam(nx, nz), dk = 0; const loc = Y - (yT + off);
        if (o.aoT && loc < o.aoT) I *= 0.55 + 0.45 * loc / o.aoT;
        if (yB + off - Y < 2) I *= 0.8;
        if (o.brick) {                                                   // 磚縫：比磚面暗一階（不打網點，線條乾淨）
          const row = Math.floor(loc / 4), sh = (row % 2) * dth / 2, s0 = Math.floor((Math.asin(nx) + sh + 4) / dth), s1 = Math.floor((Math.asin(nx2) + sh + 4) / dth);
          if (((loc % 4) + 4) % 4 >= 3 || (s0 !== s1 && nx2 < 0.999)) dk = 1; else if (hash(row, s0) < 0.15) I -= 0.08;
        }
        const ci = ramp.indexOf(pick(ramp, I, X, Y)); P.px(X, Y, ramp[Math.max(0, ci - dk)]);
      }
    }
  };
  // 橢圓頂面：外圈亮、內圈（地板）暗
  const top = (cx, y, rx, ramp, inner) => {
    const ry = rx * RY;
    for (let Y = Math.floor(y - ry); Y <= y + ry; Y++) for (let X = Math.floor(cx - rx); X <= cx + rx; X++) {
      const dx = (X + 0.5 - cx) / rx, dy = (Y + 0.5 - y) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
      const inF = inner && d < Math.pow(inner / rx, 2); let I = inF ? 0.34 + 0.12 * dy : 0.72 - 0.25 * dx;
      if (!inF && dy > 0.55 && d > 0.7) I += 0.12;                                   // 前緣受光
      if (inF && dy < -0.35) I -= 0.12;                                               // 後牆投下的陰影
      P.px(X, Y, pick(ramp, I, X, Y));
    }
  };
  // 城垛：front=true 只畫前半圈（蓋住頂面前緣），false 畫後半圈（看到內側面）
  const merlons = (cx, y, R, n, ramp, front, h = 4) => {
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * Math.PI * 2 / n, sa = Math.sin(a), ca = Math.cos(a); if (front ? sa <= 0.05 : sa > 0.05) continue;
      const mx = Math.round(cx + R * ca), my = Math.round(y + R * RY * sa), w = Math.abs(ca) > 0.8 ? 2 : 3, I = front ? lam(ca, sa) : lam(-ca, -sa) * 0.8;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const X = mx - 1 + xx, Y = my - h + yy; P.px(X, Y, pick(ramp, yy === 0 ? I + 0.25 : xx === w - 1 && ca > -0.2 ? I - 0.15 : I, X, Y)); }
    }
  };
  // 圓錐屋頂：瓦片列沿弧線、左亮右暗
  const cone = (cx, yb, ya, R, ramp) => {
    const n = Math.ceil((yb - ya) * 3 + R * 6);
    for (let k = 0; k <= n; k++) { const t = k / n;
      for (let j = 0; j <= 80; j++) { const th = -Math.PI / 2 + Math.PI * j / 80, sx = Math.sin(th), cz = Math.cos(th), X = Math.round(cx + R * t * sx - 0.5), Y = Math.round(ya + (yb - ya) * t + R * t * RY * cz);
        let I = 0.15 + 0.85 * Math.max(0, -0.62 * sx + 0.55 * cz + 0.3); if (Math.floor(t * (yb - ya) / 3) % 2 && ((t * (yb - ya)) % 3) < 0.9) I -= 0.25;
        P.px(X, Y, pick(ramp, I, X, Y)); } }
  };
  // 多切面水晶：左上面最亮、右下面最暗、中脊高光；下方地板畫一圈淡影＝漂浮感
  const crystal = (x, y, h, w, floorY) => {
    const CR = K.CR, mid = y + Math.round(h * 0.42);
    if (floorY != null) { const r = Math.round(w * 0.45); P.e(x, floorY, r, Math.max(1, r * RY), K.R[0]); }
    for (let i = 0; i <= h; i++) { const Y = y + i, k = 1 - Math.abs(i - h * 0.42) / (h * (i < h * 0.42 ? 0.42 : 0.58)), hw = Math.max(0, Math.round(w / 2 * Math.max(0, k)));
      for (let d = -hw; d <= hw; d++) { const up = Y < mid; let c = d < 0 ? (up ? CR[2] : CR[1]) : (up ? CR[1] : CR[0]); if (d === 0) c = CR[3]; if (Math.abs(d) === hw && hw > 0) c = d < 0 ? CR[1] : CR[0]; P.px(x + d, Y, c); } }
    P.px(x - 1, y + Math.round(h * 0.25), 9); P.px(x - 2, y + Math.round(h * 0.35), 9);
  };
  // 箭孔窗（在圓柱表面，位置隨弧線）：深色洞＋右側內壁受光
  const win = (cx, yT, rx, nx, y0, hgt) => {
    const X = Math.round(cx + nx * rx), off = rx * RY * Math.sqrt(1 - nx * nx), Y = Math.round(yT + off + y0), w = Math.abs(nx) > 0.5 ? 1 : 2;
    P.r(X - (w >> 1), Y + 1, w, hgt - 1, K.w); P.px(X - (w >> 1) + (w > 1 ? 0 : 0), Y, K.w); if (w > 1) P.px(X + 1, Y, K.w);
    if (w > 1) P.l(X + 1, Y + 2, X + 1, Y + hgt - 1, K.R[1]); else P.px(X, Y + 1, K.R[1]);
    P.px(X - (w >> 1), Y + hgt, K.R[K.R.length - 1]);                               // 窗台
  };
  const R0 = K.R, cx = W / 2;
  if (main) {
    // 主塔（城堡）：後方圓形主樓（圓錐頂＋大水晶）→ 前方城牆（看得到牆頂走道）→ 左右前角圓塔
    const yG = H - 7;                                                                  // 地面中心線
    top(cx, yG, 30, R0); cyl(cx, yG, yG + 3, 30, R0);                                  // 大底座
    const dR = 12, dT = 31; cyl(cx, dT, yG - 14, dR, R0, { brick: 1, aoT: 3 });         // 主樓
    cyl(cx, dT - 4, dT, dR + 3, R0, {}); top(cx, dT - 4, dR + 3, R0);
    win(cx, dT, dR, -0.35, 4, 6); win(cx, dT, dR, 0.35, 4, 6);
    cone(cx, dT - 5, 14, dR + 4, K.RR);
    crystal(cx, 0, 13, 9);
    // 城牆：正面（平面，左亮右暗＋磚紋）＋上方牆頂走道
    const x0 = 13, x1 = W - 13, wT = H - 36, wB = yG;
    for (let X = x0; X < x1; X++) for (let Y = wT; Y <= wB; Y++) {
      const f = (X - x0) / (x1 - x0), loc = Y - wT, row = Math.floor(loc / 4); let I = 0.62 - 0.16 * f;
      const dk = loc % 4 === 3 || (X - x0 + (row % 2) * 3) % 6 === 5 ? 1 : 0; if (!dk && hash(row, Math.floor((X - x0 + (row % 2) * 3) / 6)) < 0.15) I -= 0.08;
      if (loc < 3) I *= 0.6 + 0.13 * loc; if (wB - Y < 2) I *= 0.8;
      P.px(X, Y, R0[Math.max(0, R0.indexOf(pick(R0, I, X, Y)) - dk)]);
    }
    for (let X = x0; X < x1; X++) for (let Y = wT - 5; Y < wT; Y++) P.px(X, Y, pick(R0, Y < wT - 3 ? 0.35 : 0.8, X, Y));   // 牆頂走道（後暗前亮）
    for (let X = x0 + 2; X < x1 - 2; X += 5) for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 3; xx++) P.px(X + xx, wT - 9 + yy, pick(R0, yy === 0 ? 0.95 : xx === 2 ? 0.5 : 0.7, X + xx, wT - 9 + yy));
    // 城門：拱形深洞＋右側內壁受光＋鐵柵
    const gw = 12, gT = yG - 17, gl = Math.round(cx - gw / 2);
    P.r(gl - 2, gT - 2, gw + 4, 19, pick(R0, 0.85, 0, 0)); P.e(cx, gT + 4, gw / 2 + 2, gw / 2 + 2, pick(R0, 0.85, 0, 0));   // 門框石
    P.e(cx, gT + 4, gw / 2, gw / 2, K.w); P.r(gl, gT + 4, gw, 13, K.w);
    P.l(gl + gw - 1, gT + 4, gl + gw - 1, yG, R0[1]); P.l(gl + gw - 2, gT + 6, gl + gw - 2, yG, R0[1]);
    for (let x = gl + 2; x < gl + gw - 2; x += 2) P.l(x, gT + 1, x, yG - 3, R0[2]); P.l(gl + 1, gT + 9, gl + gw - 3, gT + 9, R0[2]);
    // 門兩側旗幟（布有皺褶明暗）
    for (const sx of [cx - 14, cx + 10]) { const AR = K.AR; for (let yy = 0; yy < 13; yy++) for (let xx = 0; xx < 4; xx++) P.px(sx + xx, wT + 3 + yy, AR[xx === 0 ? 2 : xx === 3 ? 0 : 1]); P.px(sx + 1, wT + 16, AR[1]); P.px(sx + 2, wT + 16, AR[0]); P.px(sx + 1, wT + 7, K.CR[3]); }
    // 前角圓塔
    for (const tx of [10, W - 10]) {
      const tT = H - 48; cyl(tx, tT, yG - 1, 8, R0, { brick: 1, aoT: 3 });
      cyl(tx, tT - 4, tT, 10, R0, {}); top(tx, tT - 4, 10, R0);
      win(tx, tT, 8, -0.2, 6, 5);
      cone(tx, tT - 5, tT - 19, 11, K.RR);
      P.px(tx, tT - 20, K.CR[3]); P.px(tx, tT - 21, K.CR[2]);
    }
    return;
  }
  const rx = tier === 2 ? 12 : tier === 1 ? 11 : 10, pr = rx + 4, yB = Math.floor(H - 2 - 3 - pr * RY), yT = Math.round(H * (tier === 2 ? 0.42 : tier === 1 ? 0.38 : 0.34));
  // 底座：寬圓台（先畫頂面，塔身蓋上去後前方露出一圈月牙）
  top(cx, yB, pr, R0); cyl(cx, yB, yB + 3, pr, R0);
  // 塔身
  cyl(cx, yT, yB, rx, R0, { brick: 1, aoT: 3 });
  // 腰帶（凸出一圈的彩色石帶）
  const band = yT + Math.round((yB - yT) * 0.68); cyl(cx, band, band + 2, rx + 1, K.AR);
  // 箭孔窗：正面一個，中/內塔兩側各一個（靠邊被壓窄，看得出是圓的）
  win(cx, yT, rx, -0.05, Math.round((yB - yT) * 0.28), 6);
  if (tier >= 1) { win(cx, yT, rx, -0.68, Math.round((yB - yT) * 0.32), 4); win(cx, yT, rx, 0.68, Math.round((yB - yT) * 0.32), 4); }
  // 挑簷平台＋頂面＋城垛（後半圈 → 頂上物件 → 前半圈）
  const pw = rx + 3; cyl(cx, yT - 4, yT, pw, R0, {}); top(cx, yT - 4, pw, R0, pw - 2.2);
  if (tier !== 2) merlons(cx, yT - 4, pw - 1, 10, R0, false);
  if (tier === 0) crystal(cx, Math.round(yT * 0.06), Math.round(yT * 0.62), 9, yT - 4);   // 外塔：一顆浮空水晶
  if (tier === 1) {                                                                         // 中塔：兩支彎角＋水晶
    for (let i = 0; i < 11; i++) for (const sd of [-1, 1]) { const X = cx + sd * (pw - 2 + i * 0.4), Y = yT - 6 - i; P.px(X, Y, K.AR[sd < 0 ? 2 : 0]); P.px(X - sd, Y, K.AR[1]); if (i > 7) P.px(X + sd * 0.6, Y - 1, K.AR[sd < 0 ? 3 : 1]); }
    crystal(cx, Math.round(yT * 0.04), Math.round(yT * 0.6), 11, yT - 4);
  }
  if (tier === 2) {                                                                         // 內塔：圓錐瓦頂＋頂端水晶＋兩側旗
    const ya = Math.round(yT * 0.42); cone(cx, yT - 5, ya, pw + 2, K.RR);
    crystal(cx, 0, ya + 1, 10);
    for (const sd of [-1, 1]) { const fx = Math.round(cx + sd * (pw + 3)); P.l(fx, yT - 15, fx, yT - 2, R0[1]); for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 5; xx++) P.px(sd < 0 ? fx - 5 + xx : fx + 1 + xx, yT - 15 + yy + (xx > 2 && yy === 3 ? 0 : 0), K.AR[xx < 2 ? 2 : xx < 4 ? 1 : 0]); }
  }
  if (tier !== 2) merlons(cx, yT - 4, pw - 1, 10, R0, true);
};
{
  const E = { R: [1, 2, 3, 4, 5], AR: [15, 15, 10, 14], RR: [1, 15, 15, 10, 14], CR: [15, 10, 14, 13], w: 0 };                  // 敵方：暗石、深紅點綴、紅水晶
  const A = { R: [4, 5, 6, 7, 8], AR: [16, 22, 11, 20], RR: [16, 16, 22, 11, 20], CR: [16, 11, 20, 9], w: 1 };                    // 我方：淺石、綠葉點綴、綠水晶
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
