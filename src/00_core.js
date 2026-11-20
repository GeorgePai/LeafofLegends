'use strict';
/* =========================================================
   Leaf of Legends（原名 LEAF WAR）— core: 命名空間、調色盤、工具、像素精靈、字型
   ========================================================= */
const G = window.G = {}; G.FONT_DATA = window.G_FONT;

// 10 階灰：0 最黑 → 9 最白（全遊戲只用這組顏色）
G.PAL = ['#0a0a0a', '#1a1a1a', '#2b2b2b', '#3f3f3f', '#575757', '#737373', '#959595', '#bcbcbc', '#e0e0e0', '#ffffff',
  // 點綴色（10 紅 HP / 11 綠 MP / 12 藍 BOSS / 13 黃 指示/升級 / 14 橘 爆擊 / 15 深紅 / 16 深綠）
  '#ec4a3f', '#43c466', '#4a8ff5', '#f7d23c', '#f68a2c', '#7c211b', '#1f6a35', '#a35cf0',
  // 介面專用（數值條）：18 青 攻速 / 19 粉 爆擊 / 20 黃綠 移速
  '#3fc6d6', '#ec64a6', '#a8d94a',
  // 21 米色：經驗值
  '#d9c08c',
  // v2.6 自然色（落葉粒子等）：22 柔葉綠 / 23 嫩芽黃綠 / 24 枯葉棕 / 25 河水淺藍
  '#6f9a55', '#a3b866', '#b58a4c', '#9cc3cc',
  // 26 神話（鑽石淺青；實際外框是七彩）
  '#b8fff4',
  // 27 死靈淡紫（亮）／28 死靈深紫（暗）
  '#d6b4ff', '#2c0f3d'];
// v2.6 戰場自然色盤：低彩度、彼此色相相近（綠偏黃、藍偏青、木偏暖），當背景不搶角色
G.NAT = {
  // 森林地面（樹冠下）：深墨綠
  fSh: '#121b16', fD: '#18261d', fM: '#203325', fHi: '#2f4a35',
  // 森林邊緣崖面：深木色土壁
  cl0: '#1b1814', cl1: '#28231c', cl2: '#383024',
  // 草地：鼠尾草綠三階＋草叢亮綠
  grD: '#4a6443', grM: '#56744c', grL: '#7a9a5e', grDk: '#3c5438',
  // 泥土路：暖灰褐
  rdD: '#6f6350', rdM: '#857862', rdL: '#978a72', rdPb: '#ada288',
  // 崖下陰影
  shD: '#24301f', shM: '#33412c',
  // 河水：深→淺的青藍
  wDeep: '#1f3a4c', wD: '#27485b', wM: '#32576a', wHi: '#4b7688',
  sD: '#3d6872', sM: '#4a7880', sL: '#6b9898', foam: '#a7c7c0',
  // 濕潤河岸
  bkD: '#34452f', bkM: '#42563b',
  // 點綴：小白花、小黃花、小粉花、碎石
  fl1: '#e4dec4', fl2: '#d6c26a', fl3: '#d7a6a0', stD: '#5a574f', stL: '#9f9a88'
};
G.hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// 自訂調色盤（精靈用）：以 G.PAL_RGB 為底，map = {索引: '#hex'} 覆寫
G.palWith = map => { const a = G.PAL.map(G.hexRGB); for (const k in map) a[k] = G.hexRGB(map[k]); return a; };
// 色票加亮（k>0，往白）／加暗（k<0，往黑），結果快取
G._tint = {};
G.tint = (i, k) => { const key = i + ':' + k; let v = G._tint[key]; if (v) return v; const c = G.PAL_RGB[i] || [128, 128, 128], t = k > 0 ? 255 : 0, a = Math.abs(k); v = 'rgb(' + c.map(q => Math.round(q + (t - q) * a)).join(',') + ')'; G._tint[key] = v; return v; };
G.PAL_RGB = G.PAL.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

// 世界座標：原著 1 格 = 32 單位；美術 1px = 2 單位；Y 軸壓縮 0.75 做出斜俯視
G.TILE = 32;
G.AX = 0.5;          // world → art x
G.AY = 0.375;        // world → art y（0.5 * 0.75）
G.AZ = 0.5;          // 高度 → art

// ---------- 工具 ----------
G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
G.rand = Math.random;
G.rr = (a, b) => a + Math.random() * (b - a);
G.ri = (a, b) => (a + Math.random() * (b - a + 1)) | 0;
G.pick = a => a[(Math.random() * a.length) | 0];
G.damp = (k, dt) => 1 - Math.exp(-k * dt);
G.mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
G.hash = (x, y) => { let h = (x | 0) * 374761393 + (y | 0) * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
G.vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = G.hash(xi, yi), b = G.hash(xi + 1, yi), c = G.hash(xi, yi + 1), d = G.hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
G.fbm = (x, y) => G.vnoise(x, y) * 0.6 + G.vnoise(x * 2.1, y * 2.1) * 0.3 + G.vnoise(x * 4.3, y * 4.3) * 0.1;
G.BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
G.bayer = (x, y) => G.BAYER[(y & 3) * 4 + (x & 3)];
G.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };

// ---------- 像素精靈 ----------
// rows: 字串陣列，'0'-'9' = 調色盤索引，'.' = 透明
// 產生：一般 / 受擊白閃 / 鏡像（面向左）
G.spriteFromGrid = function (grid, w, h, opt = {}) {
  const ol = opt.outline;
  const pad = ol != null ? 1 : 0;
  const W = w + pad * 2, H = h + pad * 2;
  const g = new Int8Array(W * H).fill(-1);
  const BR = [0, 1, 2, 3, 4, 6, 7, 8, 9, 9];                // 我方提亮：5→6、6→7、7→8、8→9
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = grid[y * w + x]; g[(y + pad) * W + x + pad] = opt.bright && v >= 0 && v <= 9 ? BR[v] : v; }
  if (ol != null) {
    const src = g.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (src[y * W + x] >= 0) continue;
      const n = (x > 0 && src[y * W + x - 1] >= 0) || (x < W - 1 && src[y * W + x + 1] >= 0) || (y > 0 && src[(y - 1) * W + x] >= 0) || (y < H - 1 && src[(y + 1) * W + x] >= 0);
      if (n) g[y * W + x] = ol;
    }
  }
  const mk = (flash, mirror) => {
    const c = G.canvas(W, H), x = c.getContext('2d'), id = x.createImageData(W, H);
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const v = g[yy * W + (mirror ? W - 1 - xx : xx)];
      if (v < 0) continue;
      const o = (yy * W + xx) * 4, rgb = flash ? [255, 255, 255] : (opt.pal && opt.pal[v]) || G.PAL_RGB[v];
      id.data[o] = rgb[0]; id.data[o + 1] = rgb[1]; id.data[o + 2] = rgb[2]; id.data[o + 3] = 255;
    }
    x.putImageData(id, 0, 0); return c;
  };
  return { w: W, h: H, n: mk(false, false), m: mk(false, true), f: mk(true, false), fm: mk(true, true) };
};
G.sprite = function (rows, opt = {}) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const grid = new Int8Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x];
    if (ch >= '0' && ch <= '9') grid[y * w + x] = ch.charCodeAt(0) - 48;
    else if (ch >= 'a' && ch <= 'l') grid[y * w + x] = ch.charCodeAt(0) - 87;   // a=10 … h=17、i=18 青、j=19 粉、k=20 黃綠、l=21 米
  }
  return G.spriteFromGrid(grid, w, h, opt);
};
// 程序化陰影球體（樹冠、石頭、光球）：Bayer 抖動 + 頂左光源
G.shadedBlob = function (w, h, circles, levels, opt = {}) {
  const grid = new Int8Array(w * h).fill(-1);
  const L = [-0.55, -0.7, 0.55]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = -1, bn = null;
    for (const c of circles) {
      const dx = (x + 0.5 - c[0]) / c[2], dy = (y + 0.5 - c[1]) / (c[3] || c[2]);
      const r2 = dx * dx + dy * dy; if (r2 > 1) continue;
      const hz = Math.sqrt(1 - r2) + (c[4] || 0);
      if (hz > best) { best = hz; bn = [dx, dy, Math.sqrt(1 - r2)]; }
    }
    if (!bn) continue;
    let b = (bn[0] * L[0] + bn[1] * L[1] + bn[2] * L[2]);
    b = G.clamp((b + 0.35) / 1.35, 0, 1);
    if (opt.noise) b += (G.hash(x * 7 + opt.seed, y * 13) - 0.5) * opt.noise;
    const t = G.clamp(b * (levels.length - 1) + (G.bayer(x, y) - 0.5), 0, levels.length - 1);
    grid[y * w + x] = levels[Math.round(t)];
  }
  if (opt.post) opt.post(grid, w, h);
  return G.spriteFromGrid(grid, w, h, opt);
};

// ---------- 3x5 像素字型 ----------
G.FONT = (() => {
  const s = {
    '0': '###,#.#,#.#,#.#,###', '1': '.#.,##.,.#.,.#.,###', '2': '###,..#,###,#..,###', '3': '###,..#,.##,..#,###', '4': '#.#,#.#,###,..#,..#',
    '5': '###,#..,###,..#,###', '6': '###,#..,###,#.#,###', '7': '###,..#,.#.,.#.,.#.', '8': '###,#.#,###,#.#,###', '9': '###,#.#,###,..#,###',
    'A': '.#.,#.#,###,#.#,#.#', 'B': '##.,#.#,##.,#.#,##.', 'C': '.##,#..,#..,#..,.##', 'D': '##.,#.#,#.#,#.#,##.', 'E': '###,#..,##.,#..,###',
    'F': '###,#..,##.,#..,#..', 'G': '.##,#..,#.#,#.#,.##', 'H': '#.#,#.#,###,#.#,#.#', 'I': '###,.#.,.#.,.#.,###', 'J': '..#,..#,..#,#.#,.#.',
    'K': '#.#,#.#,##.,#.#,#.#', 'L': '#..,#..,#..,#..,###', 'M': '#...#,##.##,#.#.#,#...#,#...#', 'ᴍ': '#.#,###,###,#.#,#.#', 'N': '##.,#.#,#.#,#.#,#.#', 'O': '.#.,#.#,#.#,#.#,.#.',
    'P': '##.,#.#,##.,#..,#..', 'Q': '.#.,#.#,#.#,##.,.##', 'R': '##.,#.#,##.,#.#,#.#', 'S': '.##,#..,.#.,..#,##.', 'T': '###,.#.,.#.,.#.,.#.',
    'U': '#.#,#.#,#.#,#.#,###', 'V': '#.#,#.#,#.#,#.#,.#.', 'W': '#...#,#...#,#.#.#,##.##,#...#', 'X': '#.#,#.#,.#.,#.#,#.#', 'Y': '#.#,#.#,.#.,.#.,.#.',
    'Z': '###,..#,.#.,#..,###', '/': '..#,..#,.#.,#..,#..', '+': '...,.#.,###,.#.,...', '-': '...,...,###,...,...', ':': '...,.#.,...,.#.,...',
    '!': '.#.,.#.,.#.,...,.#.', '.': '...,...,...,...,.#.', 'x': '...,#.#,.#.,#.#,...', ' ': '...,...,...,...,...', '?': '##.,..#,.#.,...,.#.',
    '%': '#.#,..#,.#.,#..,#.#', '<': '..#,.#.,#..,.#.,..#', '>': '#..,.#.,..#,.#.,#..', '·': '...,...,.#.,...,...'
  };
  const out = {};
  for (const k in s) out[k] = s[k].split(',');
  return out;
})();
G._fontCache = {};
G.glyphW = (k) => { const g = G.FONT[k]; return g ? g[0].length : 3; };
G.fontAtlas = function (col) {
  if (G._fontCache[col]) return G._fontCache[col];
  const keys = Object.keys(G.FONT), c = G.canvas(keys.length * 6, 5), x = c.getContext('2d');
  x.fillStyle = G.PAL[col];
  const map = {};
  keys.forEach((k, i) => { map[k] = i * 6; const g = G.FONT[k]; for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < g[yy].length; xx++) if (g[yy][xx] === '#') x.fillRect(i * 6 + xx, yy, 1, 1); });
  return (G._fontCache[col] = { c, map });
};
G.textW = (s, sc = 1) => { s = String(s).toUpperCase(); let w = 0; for (const ch of s) w += G.glyphW(ch) + 1; return Math.max(0, w - 1) * sc; };
// 畫字（可帶外框），align: 0 左 / 0.5 中 / 1 右
G.text = function (ctx, s, x, y, col = 9, sc = 1, ol = null, align = 0) {
  s = String(s).toUpperCase();
  x = Math.round(x - G.textW(s, sc) * align); y = Math.round(y);
  const draw = (cc, ox, oy) => {
    const at = G.fontAtlas(cc); let cx = 0;
    for (let i = 0; i < s.length; i++) {
      const gw = G.glyphW(s[i]), sx = at.map[s[i]];
      if (sx != null) ctx.drawImage(at.c, sx, 0, gw, 5, x + cx * sc + ox, y + oy, gw * sc, 5 * sc);
      cx += gw + 1;
    }
  };
  if (ol != null) { for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) draw(ol, ox, oy); }
  draw(col, 0, 0);
};

// ---------- 輪廓光暈：依精靈剪影外擴（稀有度外框 / 護盾） ----------
// 回傳 {c, p, tint}：c = 外框+抖動光暈（需在 (x-p, y-p) 繪製），tint = 剪影上色（疊在角色上）
G._glowCache = new WeakMap();
G.glowOf = function (src, col, ring = 1, halo = 3) {
  let m = G._glowCache.get(src); if (!m) G._glowCache.set(src, m = {});
  const key = col + '_' + ring + '_' + halo; if (m[key]) return m[key];
  const w = src.width, h = src.height, p = ring + halo, W = w + p * 2, H = h + p * 2;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const inside = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sd[(y * w + x) * 4 + 3] > 40) inside[(y + p) * W + x + p] = 1;
  // 距離（BFS，八方向）
  const dist = new Uint8Array(W * H).fill(255), q = [];
  for (let i = 0; i < W * H; i++) if (inside[i]) { dist[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % W, y = (i / W) | 0, d = dist[i] + 1; if (d > p) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (dist[j] > d) { dist[j] = d; q.push(j); }
    }
  }
  const c = G.canvas(W, H), x = c.getContext('2d'), id = x.createImageData(W, H), [r, g, b] = G.PAL_RGB[col];
  const BY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = y * W + xx, d = dist[i]; if (d === 0 || d === 255) continue;
    let a = 0;
    if (d <= ring) a = 255;
    else { const k = 1 - (d - ring) / (halo + 0.5); if (BY[(y & 3) * 4 + (xx & 3)] / 16 < k * 0.75) a = Math.round(120 + 100 * k); }
    if (!a) continue; const o = i * 4; id.data[o] = r; id.data[o + 1] = g; id.data[o + 2] = b; id.data[o + 3] = a;
  }
  x.putImageData(id, 0, 0);
  const t = G.canvas(w, h), tx = t.getContext('2d'); tx.drawImage(src, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = G.PAL[col]; tx.fillRect(0, 0, w, h);
  return (m[key] = { c, p, tint: t });
};
// 敵方配色（v3.1）：地圖改彩色後，敵人改回開場動畫那種「暗黑」色調（v2.3～v3.0 是赤紅）
// 只換灰階像素；外框維持近黑，其他點綴色（眼睛、武器、火光）不動。戰場上另外加一圈細紅邊（08_render）
// 場景生物各有自己的暗色調：森林苔黑、秋楓棕黑、凍原冰藍、熔岩黑曜、深淵紫黑（幽魂是淡紫的亡魂）
G.FOE_RAMPS = {
  base: ['#050505', '#0f0f11', '#161619', '#1e1e22', '#27272c', '#313137', '#3d3d44', '#4c4c54', '#62626b', '#85858f'],
  moss: ['#060705', '#10130e', '#171c14', '#20261b', '#293023', '#333b2c', '#3f4937', '#4f5a45', '#66735a', '#8a987a'],
  umber: ['#080604', '#17110c', '#201812', '#2a2018', '#35291f', '#413227', '#4f3d30', '#614b3b', '#7b604c', '#a08068'],
  frost: ['#0b1420', '#1c2c40', '#26394f', '#31465e', '#3d546d', '#4b637d', '#5d7690', '#7790a8', '#9ab0c4', '#c6d6e4'],
  obsidian: ['#070504', '#140f0d', '#1c1512', '#251c18', '#2f241f', '#3a2c26', '#47362f', '#58433a', '#70574b', '#937462'],
  shade: ['#08050c', '#140e1c', '#1c1426', '#251b31', '#2f233d', '#3a2c4a', '#47375a', '#58466d', '#706085', '#9282a6'],
  ghost: ['#140c1f', '#2e2140', '#3b2b52', '#4a3865', '#5a4878', '#6c5a8c', '#8270a2', '#9d8cbb', '#bfb1d6', '#e4dcf2']
};
G.FOE_RAMP_OF = { shroom: 'moss', hedgehog: 'umber', stagking: 'umber', snowhare: 'frost', yeti: 'frost', salamander: 'obsidian', magmagolem: 'obsidian', wraith: 'ghost', cerberus: 'shade' };
G._redCache = {};
G.isFoe = n => n === 'hunter' || !!(G.ORIG && G.ORIG.units[n] && G.ORIG.units[n].type === 'enemy');
G.foeImg = (n, img) => G.isFoe(n) ? G.redOf(img, n) : img;
G.redOf = function (src, n) {
  const key = G.FOE_RAMP_OF[n] || 'base', C = G._redCache[key] || (G._redCache[key] = new WeakMap());
  let r = C.get(src); if (r) return r;
  const w = src.width, h = src.height, c = G.canvas(w, h), x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, w, h), a = d.data, RR = G.FOE_RAMPS[key].map(hx => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)]);
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue; const R0 = a[i], G0 = a[i + 1], B0 = a[i + 2]; if (Math.abs(R0 - G0) > 6 || Math.abs(G0 - B0) > 6) continue;   // 非灰階：保留
    let k = 0, bd = 1e9; for (let j = 0; j < 10; j++) { const dd = Math.abs(G.PAL_RGB[j][0] - R0); if (dd < bd) { bd = dd; k = j; } }
    a[i] = RR[k][0]; a[i + 1] = RR[k][1]; a[i + 2] = RR[k][2];
  }
  x.putImageData(d, 0, 0); C.set(src, c); return c;
};
// 稀有度：0 普通(白) 1 稀有(綠) 2 史詩(紫) 3 傳說(橘)
// v2.6 新增 4 神話（傳說之上）：外框是流動的七彩光＋鑽石閃光（G.mythGlow），文字用七彩逐字變色（G.cnRb）
G.RARITY = [{ n: '普通', c: 9 }, { n: '稀有', c: 11 }, { n: '史詩', c: 17 }, { n: '傳說', c: 14 }, { n: '神話', c: 26, myth: true }];
G.MYTHIC = { necroleafy: 1 };
// 七彩鑽石光暈：以白色外框為遮罩，疊上斜向流動的彩虹漸層，外圈再加幾顆旋轉的十字星芒；預先做 12 張，依時間輪播
G._mythCache = new WeakMap();
G.mythGlow = function (src, ring = 1, halo = 3, t = performance.now() / 1000) {
  let m = G._mythCache.get(src); if (!m) G._mythCache.set(src, m = {});
  const key = ring + '_' + halo, N = 12;
  if (!m[key]) {
    const base = G.glowOf(src, 9, ring, halo), W = base.c.width, H = base.c.height, bd = base.c.getContext('2d').getImageData(0, 0, W, H).data;
    const rim = []; for (let i = 0; i < W * H; i++) if (bd[i * 4 + 3] === 255) rim.push(i);
    m[key] = [];
    for (let k = 0; k < N; k++) {
      const c = G.canvas(W, H), x = c.getContext('2d'); x.drawImage(base.c, 0, 0); x.globalCompositeOperation = 'source-atop';
      const L = Math.max(W, H), gr = x.createLinearGradient(0, 0, L, L);
      for (let j = 0; j <= 6; j++) gr.addColorStop(j / 6, 'hsl(' + Math.round((j / 6 * 360 + k / N * 360) % 360) + ',95%,68%)');
      x.fillStyle = gr; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
      // 鑽石閃光：外框上 3 顆十字星芒，位置隨幀輪轉
      x.fillStyle = '#ffffff';
      for (let q = 0; q < 3 && rim.length; q++) {
        const i = rim[Math.floor(((q / 3 + k / N * 0.5) % 1) * rim.length)], px = i % W, py = (i / W) | 0, big = (k + q * 4) % N < 4;
        x.fillRect(px, py, 1, 1); if (big) { x.fillRect(px - 1, py, 3, 1); x.fillRect(px, py - 1, 1, 3); if ((k + q) % 3 === 0) { x.fillRect(px - 2, py, 1, 1); x.fillRect(px + 2, py, 1, 1); x.fillRect(px, py - 2, 1, 1); x.fillRect(px, py + 2, 1, 1); } }
      }
      m[key].push(c);
    }
    m[key].p = base.p; m[key].tint = base.tint;
  }
  const A = m[key]; return { c: A[Math.floor(t * 10) % N], p: A.p, tint: A.tint };
};
// 依稀有度取外框（神話＝七彩）
G.rarGlow = (src, rar, ring, halo) => rar === 4 ? G.mythGlow(src, ring, halo) : G.glowOf(src, G.RARITY[rar].c, ring, halo);
G.rarityOf = function (name) {
  const u = G.ORIG && G.ORIG.units[name]; if (!u) return 0;
  if (G.MYTHIC[name]) return 4;
  if (u.type === 'player') return ({ leafy: 0, quickleafy: 0, spearleafy: 1, splashleafy: 1, muscleleafy: 1, eliteleafy: 2, elitequickleafy: 2, elitespearleafy: 2, cannonleafy: 3, berserkerleafy: 3 })[name] || 0;
  if (u.type === 'mercenary') return 3;
  if (u.type === 'npc') return G.clamp((u.unit_point || 2) - 2, 0, 3);
  return 0;
};
// 整數倍放大（快取），讓放大後的外框光暈仍是 1px 清晰
G._scCache = new WeakMap();
G.scaled = function (src, k) {
  if (k <= 1) return src;
  let m = G._scCache.get(src); if (!m) G._scCache.set(src, m = {});
  if (m[k]) return m[k];
  const c = G.canvas(src.width * k, src.height * k), x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
  return (m[k] = c);
};
