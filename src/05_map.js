'use strict';
/* =========================================================
   地圖：程序化邊界（場域函數）+ 可走網格 + 導航（Dijkstra 流場）
   ========================================================= */
G.buildMap = function (def) {
  const T = G.TILE, M = { def, w: def.w, h: def.h, ww: def.w * T, wh: def.h * T };
  const segs = [];
  for (const l of def.lanes) for (let i = 0; i < l.pts.length - 1; i++) segs.push([l.pts[i][0], l.pts[i][1], l.pts[i + 1][0], l.pts[i + 1][1], l.r]);
  // 河道（可涉水通過，不算路面）
  const rsegs = []; if (def.river) { const rp = def.river.pts; for (let i = 0; i < rp.length - 1; i++) rsegs.push([rp[i][0], rp[i][1], rp[i + 1][0], rp[i + 1][1], def.river.r]); }
  const segDist = (px, py, s) => {
    const dx = s[2] - s[0], dy = s[3] - s[1], L = dx * dx + dy * dy;
    let t = L ? ((px - s[0]) * dx + (py - s[1]) * dy) / L : 0; t = G.clamp(t, 0, 1);
    return Math.hypot(px - s[0] - dx * t, py - s[1] - dy * t);
  };
  const sd = def.seed * 17.3;
  // 場域：<0 可走；單位＝格
  M.field = (tx, ty) => {
    let d = 1e9;
    for (const s of segs) { const v = segDist(tx, ty, s) - s[4]; if (v < d) d = v; }
    for (const c of def.clear) { const v = Math.hypot(tx - c[0], ty - c[1]) - c[2]; if (v < d) d = v; }
    for (const s of rsegs) { const v = segDist(tx, ty, s) - s[4] - 0.6; if (v < d) d = v; }
    d += (G.fbm(tx * 0.42 + sd, ty * 0.42 - sd) - 0.5) * 1.3;
    const b = Math.min(tx, ty, def.w - tx, def.h - ty);
    if (b < 1.2) d = Math.max(d, 1.2 - b);
    return d;
  };
  // 河道：距離中心線（格），<0 為水面
  M.river = (tx, ty) => { let d = 1e9; for (const s of rsegs) { const v = segDist(tx, ty, s) - s[4] + (G.fbm(tx * 0.7 + 9, ty * 0.7) - 0.5) * 0.9; if (v < d) d = v; } return d; };
  M.hasRiver = rsegs.length > 0;
  // 與某條路中心線的距離（格）
  M.laneSegs = def.lanes.map(l => { const a = []; for (let i = 0; i < l.pts.length - 1; i++) a.push([l.pts[i][0], l.pts[i][1], l.pts[i + 1][0], l.pts[i + 1][1], l.r]); return a; });
  M.laneDist = (li, tx, ty) => { let d = 1e9; for (const sg of M.laneSegs[li]) { const v = segDist(tx, ty, sg); if (v < d) d = v; } return d; };
  // 路面程度（0=路中央，1=路邊）
  M.pathiness = (tx, ty) => {
    let p = 9;
    for (const s of segs) { const v = segDist(tx, ty, s) / s[4]; if (v < p) p = v; }
    return p + (G.fbm(tx * 1.3 + 40, ty * 1.3) - 0.5) * 0.5;
  };

  // 可走網格（8 單位一格）
  M.cs = 8; M.cw = Math.ceil(M.ww / M.cs); M.ch = Math.ceil(M.wh / M.cs);
  M.walk = new Uint8Array(M.cw * M.ch);
  for (let y = 0; y < M.ch; y++) for (let x = 0; x < M.cw; x++)
    M.walk[y * M.cw + x] = M.field((x + 0.5) * M.cs / T, (y + 0.5) * M.cs / T) < 0 ? 1 : 0;
  M.isWalk = (x, y) => {
    const cx = (x / M.cs) | 0, cy = (y / M.cs) | 0;
    if (x < 0 || y < 0 || cx >= M.cw || cy >= M.ch) return false;
    return M.walk[cy * M.cw + cx] === 1;
  };
  // 視線
  M.los = (x0, y0, x1, y1) => {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
    for (let i = 1; i <= n; i++) { const t = i / n; if (!M.isWalk(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  };

  // 導航網格（半格 16 單位）
  M.ns = 16; M.nw = Math.ceil(M.ww / M.ns); M.nh = Math.ceil(M.wh / M.ns);
  M.nav = new Uint8Array(M.nw * M.nh);
  for (let y = 0; y < M.nh; y++) for (let x = 0; x < M.nw; x++) {
    const wx = (x + 0.5) * M.ns, wy = (y + 0.5) * M.ns;
    M.nav[y * M.nw + x] = (M.isWalk(wx, wy) && M.isWalk(wx - 5, wy) && M.isWalk(wx + 5, wy) && M.isWalk(wx, wy - 5) && M.isWalk(wx, wy + 5)) ? 1 : 0;
  }
  M.cellOf = (x, y) => G.clamp((y / M.ns) | 0, 0, M.nh - 1) * M.nw + G.clamp((x / M.ns) | 0, 0, M.nw - 1);
  M.cellXY = i => [((i % M.nw) + 0.5) * M.ns, (((i / M.nw) | 0) + 0.5) * M.ns];
  // 最近可走導航格
  M.nearestNav = (x, y) => {
    const c = M.cellOf(x, y); if (M.nav[c]) return c;
    const cx = c % M.nw, cy = (c / M.nw) | 0;
    for (let r = 1; r < 20; r++) {
      let best = -1, bd = 1e9;
      for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) {
        if (xx < 0 || yy < 0 || xx >= M.nw || yy >= M.nh) continue;
        if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) !== r) continue;
        const i = yy * M.nw + xx; if (!M.nav[i]) continue;
        const [wx, wy] = M.cellXY(i), d = G.d2(wx, wy, x, y); if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) return best;
    }
    return c;
  };
  // Dijkstra（二元堆積）
  const N = M.nw * M.nh;
  M.dijkstra = (seeds, wt) => {
    const dist = new Float64Array(N).fill(1e9), heap = [], pri = [];
    const push = (i, p) => { heap.push(i); pri.push(p); let k = heap.length - 1; while (k > 0) { const pa = (k - 1) >> 1; if (pri[pa] <= pri[k]) break; [heap[pa], heap[k]] = [heap[k], heap[pa]];[pri[pa], pri[k]] = [pri[k], pri[pa]]; k = pa; } };
    const pop = () => {
      const top = heap[0], tp = pri[0], li = heap.pop(), lp = pri.pop();
      if (heap.length) {
        heap[0] = li; pri[0] = lp; let k = 0;
        for (; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && pri[l] < pri[m]) m = l; if (r < heap.length && pri[r] < pri[m]) m = r; if (m === k) break;[heap[m], heap[k]] = [heap[k], heap[m]];[pri[m], pri[k]] = [pri[k], pri[m]]; k = m; }
      }
      return [top, tp];
    };
    for (const s of seeds) { if (dist[s] > 0) { dist[s] = 0; push(s, 0); } }
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const [i, p] = pop(); if (p > dist[i]) continue;
      const x = i % M.nw, y = (i / M.nw) | 0;
      for (const [dx, dy, c] of dirs) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= M.nw || ny >= M.nh) continue;
        const j = ny * M.nw + nx; if (!M.nav[j]) continue;
        if (dx && dy && (!M.nav[y * M.nw + nx] || !M.nav[ny * M.nw + x])) continue;
        const nd = p + c * (wt ? wt[j] : 1); if (nd < dist[j]) { dist[j] = nd; push(j, nd); }
      }
    }
    return dist;
  };
  // 依距離場取得前進方向
  M.flowDir = (dist, x, y) => {
    let c = M.cellOf(x, y); if (!M.nav[c] || dist[c] >= 1e9) c = M.nearestNav(x, y);
    const cx = c % M.nw, cy = (c / M.nw) | 0;
    let best = c, bd = dist[c];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= M.nw || ny >= M.nh) continue;
      const j = ny * M.nw + nx; if (!M.nav[j]) continue;
      if (dx && dy && (!M.nav[cy * M.nw + nx] || !M.nav[ny * M.nw + cx])) continue;
      if (dist[j] < bd) { bd = dist[j]; best = j; }
    }
    const [tx, ty] = M.cellXY(best);
    const vx = tx - x, vy = ty - y, l = Math.hypot(vx, vy);
    if (l < 0.01) return null;
    return [vx / l, vy / l];
  };
  // 路徑（拉線平滑）
  M.path = (sx, sy, ex, ey) => {
    const goal = M.nearestNav(ex, ey);
    const [gx, gy] = M.cellXY(goal);
    const fx = M.nav[M.cellOf(ex, ey)] && M.isWalk(ex, ey) ? ex : gx, fy = M.nav[M.cellOf(ex, ey)] && M.isWalk(ex, ey) ? ey : gy;
    if (M.los(sx, sy, fx, fy)) return [[fx, fy]];
    const dist = M.dijkstra([goal]);
    let c = M.nearestNav(sx, sy); const pts = [];
    for (let k = 0; k < 400 && c !== goal; k++) {
      const cx = c % M.nw, cy = (c / M.nw) | 0; let best = c, bd = dist[c];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= M.nw || ny >= M.nh) continue;
        const j = ny * M.nw + nx; if (dist[j] < bd) { bd = dist[j]; best = j; }
      }
      if (best === c) break; c = best; pts.push(M.cellXY(c));
    }
    pts.push([fx, fy]);
    // 拉線
    const out = []; let ax = sx, ay = sy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !M.los(ax, ay, pts[j][0], pts[j][1])) j--;
      out.push(pts[j]); ax = pts[j][0]; ay = pts[j][1]; i = j + 1;
    }
    return out;
  };

  // 道具（樹/石）— 以種子固定
  const rng = G.mulberry(def.seed * 999);
  M.props = [];
  for (let y = -200; y < M.wh + 260; y += 22) for (let x = -180; x < M.ww + 180; x += 22) {
    const px = x + (rng() - 0.5) * 16, py = y + (rng() - 0.5) * 14, f = M.field(px / T, py / T);
    if (f > 0.22 && f < 1.4 && rng() < 0.5) M.props.push({ x: px, y: py, s: G.SPR.trees[(rng() * 3) | 0], tree: 1 });
    else if (f >= 1.3 && rng() < 0.09) M.props.push({ x: px, y: py, s: G.SPR.trees[(rng() * 3) | 0], tree: 1 });
    else if (f < -0.9 && f > -1.6 && M.pathiness(px / T, py / T) > 0.9 && !(M.hasRiver && M.river(px / T, py / T) < 0.5) && rng() < 0.05) M.props.push({ x: px, y: py, s: G.SPR.rocks[(rng() * 3) | 0] });
  }
  return M;
};

// 地面預先繪製（美術像素）
G.renderGround = function (M) {
  const T = G.TILE, PAD = 110, GW = Math.ceil(M.ww * G.AX) + PAD * 2, GH = Math.ceil(M.wh * G.AY) + PAD * 2;
  const c = G.canvas(GW, GH), x = c.getContext('2d'), id = x.createImageData(GW, GH), d = id.data;
  const idx = new Int8Array(GW * GH);
  const step = 1 / (G.AX * T);   // 美術 1px = 多少格
  for (let ay = 0; ay < GH; ay++) for (let ax = 0; ax < GW; ax++) {
    const tx = (ax - PAD + 0.5) / G.AX / T, ty = (ay - PAD + 0.5) / G.AY / T;
    const f = M.field(tx, ty), b = G.bayer(ax, ay);
    let v;
    if (f >= 0) {
      const below = M.field(tx, ty + 0.42) < 0;                        // 森林邊緣的「崖面」
      if (below) v = (G.fbm(tx * 3, ty * 0.6) > 0.5 ? 2 : 1) + ((ax & 1) && b > 0.6 ? 1 : 0);
      else {
        const n = G.fbm(tx * 1.6, ty * 1.6);
        v = n + (b - 0.5) * 0.25 > 0.52 ? 2 : 1;
        if (f < 0.35 && b < 0.5) v = 0;
        if (G.hash(ax * 3, ay * 7) > 0.985) v = 3;
      }
    } else {
      const p = M.pathiness(tx, ty), n = G.fbm(tx * 0.8 + 50, ty * 0.8);
      if (p < 0.55) v = (n + (b - 0.5) * 0.35 > 0.5) ? 6 : 5;            // 路面
      else if (p < 0.7) v = b < 0.5 ? 5 : 4;                             // 路邊抖動
      else v = (n + (b - 0.5) * 0.3 > 0.55) ? 5 : 4;                     // 草地
      if (M.field(tx, ty - 0.35) >= 0) v = b < 0.65 ? 2 : 3;             // 崖下陰影
      else if (M.field(tx, ty - 0.6) >= 0) v = Math.max(3, v - 1 - (b < 0.4 ? 1 : 0));
      if (M.hasRiver) {
        const rv = M.river(tx, ty);
        if (rv < 0) {                                                    // 水面：深色 + 橫向波紋；路經過處為淺灘
          const shallow = p < 0.75, wav = G.fbm(tx * 2.2, ty * 7) + (b - 0.5) * 0.2;
          if (shallow) v = wav > 0.58 ? 6 : (b < 0.5 ? 4 : 5);
          else v = rv > -0.35 ? 3 : (wav > 0.62 ? 4 : wav > 0.56 && b < 0.5 ? 3 : 2);
          if (rv > -0.18) v = shallow ? 7 : 6;                            // 岸邊浪花
        } else if (rv < 0.35) v = b < 0.5 ? 3 : Math.min(v, 4);          // 濕潤河岸
      }
    }
    idx[ay * GW + ax] = v;
  }
  // 草叢、花、碎石
  const rng = G.mulberry(M.def.seed * 31);
  const put = (ax, ay, v) => { if (ax >= 0 && ay >= 0 && ax < GW && ay < GH) idx[ay * GW + ax] = v; };
  for (let i = 0; i < GW * GH / 55; i++) {
    const ax = (rng() * GW) | 0, ay = (rng() * GH) | 0;
    const tx = (ax - PAD) / G.AX / T, ty = (ay - PAD) / G.AY / T;
    if (M.field(tx, ty) > -0.15) continue;
    const p = M.pathiness(tx, ty), r = rng();
    if (p > 0.75) {
      if (r < 0.7) { put(ax, ay, 6); put(ax - 1, ay - 1, 6); put(ax + 1, ay - 1, 6); put(ax, ay + 1, 3); }   // 草
      else if (r < 0.8) { put(ax, ay, 9); put(ax, ay + 1, 3); }                                          // 小白花
      else { put(ax, ay, 3); put(ax + 1, ay, 3); put(ax, ay - 1, 7); }                                     // 小石
    } else if (r < 0.25) { put(ax, ay, 7); put(ax + 1, ay + 1, 4); }
  }
  for (let i = 0; i < GW * GH; i++) { const rgb = G.PAL_RGB[idx[i]]; d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255; }
  x.putImageData(id, 0, 0);
  // 樹影烘進地面
  G.setPatOffset(0, 0);
  for (const p of M.props) if (p.tree) G.pxDisc(x, p.x * G.AX + PAD, p.y * G.AY + PAD, p.s.w * 0.4, 2.5, 0, 0.6);
  // 小地圖
  const MR = 3, mm = G.canvas(M.w * MR, M.h * MR), mx = mm.getContext('2d'), mid = mx.createImageData(mm.width, mm.height);
  for (let y = 0; y < M.h * MR; y++) for (let xx = 0; xx < M.w * MR; xx++) {
    const fx = (xx + 0.5) / MR, fy = (y + 0.5) / MR, f = M.field(fx, fy);
    const wet = M.hasRiver && f < 0 && M.river(fx, fy) < 0;
    const rgb = G.PAL_RGB[wet ? 2 : f < 0 ? (M.pathiness(fx, fy) < 0.6 ? 5 : 4) : 1], i = (y * mm.width + xx) * 4;
    mid.data[i] = rgb[0]; mid.data[i + 1] = rgb[1]; mid.data[i + 2] = rgb[2]; mid.data[i + 3] = 255;
  }
  mx.putImageData(mid, 0, 0);
  return { c, w: GW, h: GH, pad: PAD, mini: mm };
};
