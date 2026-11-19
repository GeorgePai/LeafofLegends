'use strict';
/* =========================================================
   選單：首頁 / 隊伍 / 圖鑑 / 教學
   版面：直屏上下堆疊，橫屏左右分欄
   ========================================================= */
G.Menus = (() => {
  const M = {}, R = G.Render, P = G.PAL;
  const H = () => G.UI.h, U = () => G.UI;
  let tab = 0, skillSel = -1, page = 0, gt = 0, modal = 0, sbKey = '', lastT = performance.now();
  let desk = !matchMedia('(pointer: coarse)').matches;
  const sel = { hero: null, minion: 'leafblower', enemy: 'babybear' };
  const sb = new G.Sandbox();
  const tick = () => { const n = performance.now(); M.dt = Math.min(0.05, (n - lastT) / 1000); lastT = n; gt += M.dt; };
  const pr = id => U().press[id] > 0;
  const tap = (id, x, y, w, h, fn) => H().btn(id, x, y, w, h, () => { U().press[id] = 0.12; G.Audio.play('click'); }, fn);

  // ---------- 共用元件 ----------
  function bg(c) { c.fillStyle = P[1]; c.fillRect(0, 0, R.uw, R.uh); }
  function header(c, title) {
    const L = R.ins.l, T = R.ins.t, o = pr('back') ? 1 : 0;
    H().key(c, L, T + o, 18, 14, o, 6);
    c.fillStyle = P[9];
    for (let i = 0; i < 4; i++) { c.fillRect(L + 6 + i, T + 7 - i + o, 1, 1); c.fillRect(L + 6 + i, T + 7 + i + o, 1, 1); }
    c.fillRect(L + 6, T + 7 + o, 7, 1);
    tap('back', L, T, 18, 14, () => U().guideBack ? U().guideBack() : U().goMenu());
    G.cn(c, title, L + 24, T + 1, 9);
    return T + 20;
  }
  // 按鈕層級：主要（黃底、呼吸光、掃光）＞ 次要（深底白框）＞ 停用（灰）
  function btnPrimary(c, id, x, y, w, h, label, fn) {
    const o = pr(id) ? 1 : 0, glow = (Math.sin(gt * 6) + 1) / 2;
    c.fillStyle = P[glow > 0.5 ? 13 : 14]; c.fillRect(x - 1, y - 1 + o, w + 2, h + 2);
    H().key(c, x, y + o, w, h, o, 14, 13, G.tint(14, -0.5));
    const sx = ((gt * 70) % (w + 30)) - 15;                 // 掃光
    c.fillStyle = P[9]; for (let i = 0; i < h - 2; i++) { const xx = Math.round(x + sx + i * 0.6); if (xx > x && xx < x + w - 2) c.fillRect(xx, y + 1 + i + o, 2, 1); }
    G.cn(c, label, x + w / 2, y + Math.round((h - 12) / 2) + o, 0, 0.5);
    tap(id, x, y, w, h, fn);
  }
  function btnSecondary(c, id, x, y, w, h, label, fn) {
    const o = pr(id) ? 1 : 0;
    H().key(c, x, y + o, w, h, o, 7);
    G.cn(c, label, x + w / 2, y + Math.round((h - 12) / 2) + o, 9, 0.5);
    tap(id, x, y, w, h, fn);
  }
  function btnFlat(c, x, y, w, h, label, col = 5) { H().box(c, x, y, w, h, 1, 3, false); G.cn(c, label, x + w / 2, y + Math.round((h - 12) / 2), col, 0.5); }
  // 跳動提示箭頭（指向右邊的目標）
  function hintArrow(c, x, y) {
    const dx = Math.round(Math.abs(Math.sin(gt * 5)) * 3);
    c.fillStyle = P[0]; c.fillRect(x - 7 + dx, y - 1, 6, 3); c.fillRect(x - 2 + dx, y - 3, 1, 7); c.fillRect(x - 1 + dx, y - 2, 1, 5); c.fillRect(x + dx, y - 1, 1, 3);
    c.fillStyle = P[13]; c.fillRect(x - 6 + dx, y, 5, 1); c.fillRect(x - 2 + dx, y - 2, 1, 5); c.fillRect(x - 1 + dx, y - 1, 1, 3); c.fillRect(x + dx, y, 1, 1);
  }
  // 分段頁籤
  function tabs(c, x, y, w, items, cur, fn, pre = 'tab') {
    const n = items.length, tw = Math.floor(w / n);
    H().box(c, x, y, tw * n, 15, 0, 3, false);
    items.forEach((t, i) => {
      const on = cur === i, xx = x + i * tw;
      if (on) H().box(c, xx + 1, y + 1, tw - 2, 13, 3, 9, false);
      G.cn(c, t, xx + tw / 2, y + 1, on ? 9 : 5, 0.5);
      tap(pre + i, xx, y, tw, 15, () => fn(i));
    });
    return y + 19;
  }
  function sprFit(c, name, cx, by, maxW, maxH, frame = 0) {
    const s = G.SPR[G.VIS[name].spr], f = s[frame % s.length];
    const sc = Math.min(1, maxW / f.w, maxH / f.h);
    const w = Math.max(1, Math.round(f.w * sc)), h = Math.max(1, Math.round(f.h * sc));
    c.drawImage(G.foeImg(name, f.n), Math.round(cx - w / 2), Math.round(by - h), w, h);
  }
  // 卡片格（自動決定欄數，塞進指定區域）
  function grid(c, x, y, w, h, names, selName, badgeOf, onSel) {
    const n = names.length, gap = 2;
    let cols = 3, size = 0;
    for (let k = 3; k <= 10; k++) { const sz = Math.floor((w - gap * (k - 1)) / k), rows = Math.ceil(n / k); if (rows * (sz + gap) - gap <= h && sz >= 18) { cols = k; size = Math.min(sz, 34); break; } }
    if (!size) { cols = 10; size = Math.floor((w - gap * 9) / 10); }
    names.forEach((nm, i) => {
      const cx = x + (i % cols) * (size + gap), cy = y + ((i / cols) | 0) * (size + gap), on = nm === selName;
      H().key(c, cx, cy, size, size, on, on ? 9 : 4);
      c.save(); c.beginPath(); c.rect(cx + 1, cy + 1, size - 2, size - 2); c.clip();
      sprFit(c, nm, cx + size / 2, cy + size - 3 - (G.VIS[nm].fly ? 3 : 0), size - 4, size - 5, on ? ((gt * 3) | 0) : 0);
      c.restore();
      const bd = badgeOf && badgeOf(nm);
      if (bd) { const bw = G.textW(bd) + 3; c.fillStyle = P[0]; c.fillRect(cx + size - bw - 2, cy, bw + 2, 8); c.fillStyle = P[13]; c.fillRect(cx + size - bw - 1, cy + 1, bw, 6); G.text(c, bd, cx + size - bw, cy + 1, 0); }
      tap('g' + i, cx, cy, size, size, () => { onSel(nm); sbKey = ''; skillSel = -1; });
    });
    return Math.ceil(n / cols) * (size + gap);
  }
  const PASSIVE_COL = 17;                                  // 「被動」字樣的辨識色（紫）
  G.PASSIVE_COL = PASSIVE_COL;
  // 技能數值表（Lv1/Lv2/Lv3 對照）。整張表只用一種版型，欄位永遠上下對齊，每一列都在同一行：
  //   1. 標籤欄＋三個數值欄放得下 → 直接排（單位放數值後；放不下時改把單位移到標籤，如「冷卻(秒)」）
  //   2. 還是放不下 → 標籤欄固定，三個數值欄可以「左右滑動」（v2.7，取代舊的「標籤一行、數值一行」）
  //   三級相同的數值也每一格都寫（v2.7）；和前一級不同的數值標黃
  const TS = { s: 0, tgt: 0, max: 0, cw: 1, key: '', region: null, drag: false };
  M.hscroll = (dx, ux, uy) => { const r = TS.region; if (!r || ux < r[0] || ux > r[0] + r[2] || uy < r[1] || uy > r[1] + r[3]) return false; const now = performance.now(); if (Math.abs(dx) > 0.5 && now - (TS.wt || 0) > 160) { TS.wt = now; TS.tgt = G.clamp(TS.tgt + Math.sign(dx) * TS.cw, 0, TS.max); } return true; };   // 滾輪：一次滑一欄
  function lvTable(c, x, cy, w, sd, levels) {
    const rows = G.skillRows(sd);
    if (!levels) {                                        // 單一等級（敵方）：兩欄清單，同樣整張表一致
      const vs = rows.map(r => String(r.f(1))), stack = rows.some((r, i) => G.cnW(r.k) + G.cnW(vs[i]) + 14 > w);
      rows.forEach((r, i) => { G.cn(c, r.k, x + 4, cy, 5); if (stack) cy += 12; G.cn(c, vs[i], x + w - 2, cy, 9, 1); cy += 13; });
      return cy;
    }
    rows.push({ k: '需等級', f: lv => G.skillReq(sd, lv), req: true });
    const fit = (uLab) => {
      const lab = rows.map(r => uLab && r.u ? r.k + '(' + r.u + ')' : r.k);
      const vals = rows.map(r => [1, 2, 3].map(k => String(uLab && r.u ? r.g(k) : r.f(k))));
      const labW = Math.max(...lab.map(G.cnW)), valW = Math.max(0, ...vals.flat().map(G.cnW)), cw = Math.floor((w - labW - 10) / 3);
      return { lab, vals, labW, valW, cw, ok: cw >= valW + 4 };
    };
    let L = fit(false); if (!L.ok) { const L2 = fit(true), nv = q => Math.floor((w - q.labW - 11) / (q.valW + 6)); if (L2.ok || nv(L2) > nv(L)) L = L2; }   // 要滑動時，選看得到較多欄的版本
    const { lab, vals, labW } = L, slide = !L.ok, rh = 13, th = 13 + rows.length * rh + 2, top = cy - 1;
    const vx = x + labW + 9, vw = x + w - 2 - vx, nVis = slide ? G.clamp(Math.floor(vw / (L.valW + 6)), 1, 3) : 3, cw = slide ? Math.floor(vw / nVis) : L.cw;   // 滑動時只顯示完整的欄（不切半欄）
    H().box(c, x, top, w, th, 0, 2, false);
    rows.forEach((r, ri) => { const ry = cy + 13 + ri * rh; if (ri % 2 === 0) { c.fillStyle = P[1]; c.fillRect(x + 1, ry - 1, w - 2, rh); } G.cn(c, lab[ri], x + 4, ry - 1, r.req ? 4 : 6); });
    const cell = (g, ox) => {                            // 表頭 LV1～3 ＋ 每格數值
      for (let k = 0; k < 3; k++) {
        const ccx = ox + cw * k + cw / 2; G.text(g, 'LV' + (k + 1), ccx, 3 + (g === c ? cy : 0), k === 2 ? 13 : 7, 1, null, 0.5);
        rows.forEach((r, ri) => { const v = vals[ri]; G.cn(g, v[k], ccx, (g === c ? cy : 0) + 13 + ri * rh - 1, r.req ? 5 : k && v[k] !== v[k - 1] ? 13 : 9, 0.5); });
      }
    };
    if (!slide) { cell(c, x + w - cw * 3); return cy + 13 + rows.length * rh + 2; }
    // 左右滑動：數值欄先畫在暫存畫布，再只貼出看得到的那一段（標籤欄固定不動）
    const key = sd.id + '|' + w, CW = cw * 3, CH = th - 1;
    if (TS.key !== key) { TS.key = key; TS.s = 0; TS.tgt = 0; TS.drag = false; }
    TS.cw = cw; TS.max = (3 - nVis) * cw; TS.tgt = G.clamp(TS.tgt, 0, TS.max);
    if (!TS.drag) TS.s += (TS.tgt - TS.s) * Math.min(1, M.dt * 14);          // 放開後吸附到整欄
    TS.s = G.clamp(TS.s, 0, TS.max); if (Math.abs(TS.s - TS.tgt) < 0.3 && !TS.drag) TS.s = TS.tgt;
    if (c !== G._mc) {
      const off = G._lvC && G._lvC.width >= CW && G._lvC.height >= CH ? G._lvC : (G._lvC = G.canvas(Math.max(CW, 64), Math.max(CH, 64))), oc = off.getContext('2d');
      oc.clearRect(0, 0, off.width, off.height); cell(oc, 0);
      const sx = Math.round(TS.s), vw2 = nVis * cw; c.drawImage(off, sx, 0, Math.min(vw2, CW - sx), CH, vx, cy, Math.min(vw2, CW - sx), CH);
      c.fillStyle = P[3]; c.fillRect(vx - 2, top + 1, 1, th - 2);                     // 標籤欄分隔線
      // 捲軸（表頭下緣）＋ 兩側箭頭提示
      const bw = Math.max(8, Math.round(vw2 * vw2 / CW)), bx = vx + Math.round((vw2 - bw) * (TS.max ? TS.s / TS.max : 0));
      c.fillStyle = P[2]; c.fillRect(vx, cy + 10, vw2, 1); c.fillStyle = P[7]; c.fillRect(bx, cy + 10, bw, 1);
      const bob = Math.round(Math.abs(Math.sin(gt * 4)) * 1.5), arr = (ax, d) => { c.fillStyle = P[0]; c.fillRect(ax - 2, cy + 1, 5, 7); c.fillStyle = P[13]; for (let i = 0; i < 3; i++) c.fillRect(ax + (d > 0 ? 1 - i : i - 1), cy + 4 - i, 1, 1 + i * 2); };
      if (TS.s > 1) arr(vx + 2 - bob, -1); if (TS.s < TS.max - 1) arr(vx + nVis * cw - 3 + bob, 1);
      TS.region = [vx, top, vw, th];
      U().btns.push({ id: 'lvSlide', x: vx, y: top, w: vw, h: th, down: ux => { TS.ux = ux; TS.s0 = TS.s; }, hdrag: ux => { TS.drag = true; TS.s = G.clamp(TS.s0 - (ux - TS.ux), 0, TS.max); }, up: () => { if (TS.drag) { TS.drag = false; const d = TS.s - TS.s0; TS.tgt = G.clamp((Math.abs(d) > cw * 0.2 ? (d > 0 ? Math.ceil(TS.s / cw) : Math.floor(TS.s / cw)) : Math.round(TS.s0 / cw)) * cw, 0, TS.max); } } });   // 拖超過 1/5 欄就換欄
    }
    return cy + 13 + rows.length * rh + 2;
  }
  // ---------- 基本數值條（同類角色互相比較：英雄比英雄、小兵比小兵、敵人比敵人、塔比塔）----------
  const groupOf = G.groupOf = n => G.ORIG.towers[n] ? 'tower' : G.HEROES.some(h => h.name === n) ? 'hero' : ['npc', 'mercenary'].includes((G.ORIG.units[n] || {}).type) ? 'minion' : G.BOSS_SKILL[n] ? 'boss' : 'enemy';
  const statOf = G.statOf = (n, lv = 1, side = 0) => {
    const kind = G.kindOf(n), st = G.stats(n, lv, side, kind === 'boss' ? 'creep' : kind);
    return { hp: st.hp, mp: st.mp, power: st.power, armor: st.armor, crit: st.crit, aspd: 1 / st.delay, range: st.range, speed: Math.round(st.speed * (kind === 'creep' ? G.TUNE.creepSpeedMul : 1)) };
  };
  const _max = {};
  G.statMax = (grp, lv = 1) => {
    const k = grp + lv; if (_max[k]) return _max[k];
    const names = Object.keys(G.ORIG.units).concat(Object.keys(G.ORIG.towers)).filter(n => G.VIS[n] && groupOf(n) === grp && !(G.ORIG.units[n] || {}).noBook);
    const m = {}; for (const n of names) { const s2 = statOf(n, lv); for (const q in s2) m[q] = Math.max(m[q] || 0, s2[q]); }
    return (_max[k] = m);
  };
  // 配色參考 RPG 慣例：生命紅、魔力綠（與戰鬥 HUD 一致）、攻擊橘、防禦藍、爆擊粉、攻速青、射程紫、移速黃綠；黃色保留給「增益中」
  // 同類角色的中位數（標籤用：明顯高於中位數才算強項）
  const _med = {};
  // 英雄、小兵：和「同稀有度」比（稀有度越高本來就越強）；其他：和同類比
  G.statMed = (grp, rar) => {
    const key = grp + (rar == null ? '' : rar); if (_med[key]) return _med[key];
    const names = Object.keys(G.ORIG.units).concat(Object.keys(G.ORIG.towers)).filter(n => G.VIS[n] && groupOf(n) === grp && (rar == null || G.rarityOf(n) === rar)), m = {};
    const all = names.map(n => statOf(n)); for (const q of Object.keys(all[0] || {})) { const v = all.map(s2 => s2[q]).sort((a, b) => a - b); m[q] = v[v.length >> 1] || 1; }
    return (_med[key] = m);
  };
  const STATS = [['hp', '生命', 10], ['mp', '魔力', 11], ['power', '攻擊', 14], ['armor', '防禦', 12], ['crit', '爆擊', 19], ['aspd', '攻速', 18], ['range', '射程', 17], ['speed', '跑速', 20]];
  // v2.6 數值條補間：切換角色時，條長與數字從舊值平滑滑到新值（ease-out，約 0.35 秒）
  // 同一個 id 超過 0.3 秒沒畫（剛打開畫面）就直接顯示目標值，不從 0 長出來
  const _tw = {};
  const tween = (id, to) => {
    const now = performance.now(), s0 = _tw[id];
    if (!s0 || now - s0.t > 300) { _tw[id] = { v: to, t: now }; return to; }
    const dt = Math.min(0.05, (now - s0.t) / 1000); s0.t = now;
    s0.v += (to - s0.v) * (1 - Math.exp(-dt * 11));
    if (Math.abs(to - s0.v) <= Math.abs(to) * 0.004 + 0.002) s0.v = to;
    return s0.v;
  };
  // cur：目前值（含增益），base：基礎值；回傳結束 y；opt.anim：補間用的 id（同一個畫面固定一個名稱）
  G.statBars = (c, x, y, w, base, mx, cur, opt = {}) => {
    const ex = opt.extra || [];                         // v2.5 額外的列（例：經驗），和數值條同欄寬、同長度、同粗細
    const keys = ex.map(e => [e, e.lab, e.col]).concat(STATS.filter(([k]) => (k !== 'mp' || base.mp > 0) && !(opt.skip || []).includes(k)));
    const cols = w >= 250 ? 2 : 1, cw = Math.floor((w - (cols - 1) * 10) / cols), lw = Math.max(...keys.map(q => G.cnW(q[1]))) + 4;   // 標籤欄依最寬標籤
    keys.forEach(([k, lab, col], i) => {
      const xx = x + (i % cols) * (cw + 10), yy = y + ((i / cols) | 0) * 12, bx = xx + lw, bw = cw - lw - 30;
      if (typeof k === 'object') { G.cn(c, lab, xx, yy - 1, 5); G.bar3d(c, bx, yy + 3, bw, 4, G.clamp(k.f, 0, 1), col); G.text(c, k.txt, xx + cw, yy + 3, 9, 1, null, 1); return; }
      const an = opt.anim ? (q, val) => tween(opt.anim + k + q, val) : (q, val) => val;
      const b0r = base[k], vr = cur ? cur[k] : b0r, b0 = an('b', b0r), v = an('v', vr), f0 = G.clamp(b0 / (mx[k] || 1), 0.04, 1), f1 = G.clamp(v / (mx[k] || 1), 0.04, 1);
      G.cn(c, lab, xx, yy - 1, 5);
      G.bar3d(c, bx, yy + 3, bw, 4, Math.min(f0, f1), col);
      if (f1 > f0) G.bar3d(c, bx + Math.round(bw * f0), yy + 3, Math.round(bw * (f1 - f0)), 4, 1, 13, true);
      c.fillStyle = 'rgba(0,0,0,0.55)'; for (let q = 1; q < 10; q++) c.fillRect(bx + Math.round(bw * q / 10), yy + 3, 1, 4);
      const txt = k === 'aspd' ? v.toFixed(2) : k === 'crit' ? Math.round(v) + '%' : Math.round(v);
      G.text(c, txt, xx + cw, yy + 3, vr > b0r + 0.001 ? 13 : vr < b0r - 0.001 ? 10 : 9, 1, null, 1);
    });
    return y + Math.ceil(keys.length / cols) * 12;
  };
  // 立體數值條（v2.3）：凹槽（上緣暗、下緣亮）＋填色（上緣高光、下緣暗邊）＋外框落地影
  // only：只畫填色（疊在既有條上，例如加成的黃色段）
  G.bar3d = (c, x, y, w, h, f, col, only) => {
    x = Math.round(x); y = Math.round(y);
    if (!only) {
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x, y + h + 1, w + 1, 1); c.fillRect(x + w + 1, y, 1, h + 1);   // 落地影
      c.fillStyle = P[0]; c.fillRect(x - 1, y - 1, w + 2, h + 2);
      c.fillStyle = P[2]; c.fillRect(x, y, w, h); c.fillStyle = P[1]; c.fillRect(x, y, w, 1);                      // 凹槽：上緣陰影
      c.fillStyle = P[3]; c.fillRect(x, y + h - 1, w, 1);
    }
    const fw = Math.round(w * G.clamp(f, 0, 1)); if (fw <= 0) return;
    c.fillStyle = P[col]; c.fillRect(x, y, fw, h);
    c.fillStyle = G.tint(col, 0.45); c.fillRect(x, y, fw, 1);                                                    // 高光
    if (h >= 4) { c.fillStyle = G.tint(col, 0.2); c.fillRect(x, y + 1, fw, 1); }
    c.fillStyle = G.tint(col, -0.4); c.fillRect(x, y + h - 1, fw, 1);                                            // 暗邊
    c.fillStyle = G.tint(col, -0.25); c.fillRect(x + fw - 1, y, 1, h);                                           // 末端
  };
  // ---------- 角色詳細：介紹 + 數值條 + 技能按鈕（點了開技能展示）----------
  function detail(c, x, y, w, name, side, cta, keyTab) {
    let cy = y;
    if (cta) cy = cta(x, cy, w) + 2;
    if (keyTab) {                                         // 圖鑑：鑰匙掉落率
      const r = G.keyRateOf(name, keyTab);
      if (r > 0) {
        const pc = v => (Math.round(v * 10) / 10) + '%';
        const tl2 = G.cnWrap('掉落鑰匙的機率', w - 26), l1 = G.cnWrap('英雄親手擊倒', w - 40), l2 = G.cnWrap('我方小兵或塔擊倒', w - 40);
        const hh = 6 + tl2.length * 13 + 4 + (l1.length + l2.length) * 13 + 4;
        H().box(c, x, cy, w, hh, 0, 13, false); H().icon(c, 'i_key', x + 10, cy + 8); tl2.forEach((l, i) => G.cn(c, l, x + 20, cy + 2 + i * 13, 13));
        let ry = cy + 6 + tl2.length * 13;
        c.fillStyle = P[1]; c.fillRect(x + 3, ry - 1, w - 6, l1.length * 13);
        l1.forEach((l, i) => G.cn(c, l, x + 8, ry - 1 + i * 13, 8)); G.cn(c, pc(r), x + w - 6, ry - 1, 13, 1); ry += l1.length * 13;
        l2.forEach((l, i) => G.cn(c, l, x + 8, ry - 1 + i * 13, 6)); G.cn(c, pc(r / 2), x + w - 6, ry - 1, 9, 1);
        cy += hh + 4;
      }
    }
    cy = G.statBars(c, x, cy, w, statOf(name, 1, side), G.statMax(groupOf(name)), null, { anim: 'det' }) + 4;
    return cy;
  }
  // ---------- 技能展示（彈出視窗）：上方動畫、下方切換列、再下方是該技能的說明與數值 ----------
  let demo = null;
  function openDemo(name, side, sid) {
    const hd = G.HEROES.find(h => h.name === name);
    const ids = [null, ...(hd ? [...hd.skills, ...hd.passives] : (G.BOSS_SKILL[name] ? [G.BOSS_SKILL[name]] : []))];
    demo = { name, side, ids, i: Math.max(0, ids.indexOf(sid == null ? null : sid)) };
    sbKey = ''; G.Audio.play('open');
  }
  M.blocking = () => !!demo;
  // 技能資訊（名稱/類型/說明/數值表）
  function skillInfo(c, x, y, w, name, id, side) {
    const sd = id != null ? G.ORIG.skills[id] : null, hd = G.HEROES.find(h => h.name === name);
    let cy = y;
    if (!sd) {
      G.cn(c, '普通攻擊', x, cy, 9); cy += 15;
      const st = statOf(name, 1, side), w2 = G.ORIG.weapons[G.stats(name, 1, side, G.kindOf(name) === 'boss' ? 'creep' : G.kindOf(name)).weapon] || {};
      const how = w2.type === 'body' ? (w2.attack_type === 'splash' ? '近身攻擊，會波及周圍的敵人。' : w2.attribute === 'return' ? '近身攻擊，打中時吸取對方生命。' : '近身攻擊。') : w2.type === 'line' ? '射出光束攻擊。' : w2.attack_type === 'splash' ? '從遠處攻擊，打中會炸開一小片。' : w2.attack_type === 'piercing' ? '從遠處攻擊，能貫穿一整排敵人。' : w2.attribute === 'slow' ? '從遠處攻擊，打中會減速。' : w2.attribute === 'poison' ? '從遠處攻擊，打中會中毒。' : '從遠處攻擊。';
      cy += G.cnBlock(c, how, x, cy, w, 7, 13, 3) + 4;
      [['攻擊', st.power], ['攻擊間隔', (1 / st.aspd).toFixed(2) + '秒'], ['射程', st.range]].forEach(([k, v], i) => { if (i % 2 === 0) { c.fillStyle = P[1]; c.fillRect(x, cy - 1, w, 13); } G.cn(c, k, x + 4, cy - 1, 6); G.cn(c, String(v), x + w - 3, cy - 1, 9, 1); cy += 13; });
      return cy;
    }
    const tag = sd.active ? '主動' : '被動', tw = G.cnW(tag) + 8;
    G.cn(c, G.cnWrap(G.skillName(id), w - tw)[0], x, cy, 9);
    H().box(c, x + w - tw, cy + 1, tw, 12, sd.active ? 0 : PASSIVE_COL, sd.active ? 13 : PASSIVE_COL, false); G.cn(c, tag, x + w - tw / 2, cy, sd.active ? 13 : 9, 0.5);
    cy += 15;
    cy += G.cnBlock(c, G.skillInfo(id), x, cy, w, 7, 13, 4) + 4;
    return lvTable(c, x, cy, w, sd, !!hd);
  }
  function demoPanel(c) {
    if (!demo) return;
    const uw = R.uw, uh = R.uh, I = R.ins, LD = land();
    H().btn('dmBg', 0, 0, uw, uh, null, () => { demo = null; sbKey = ''; });
    H().dim(c, 0.7);
    const pw = Math.min(uw - I.l - I.r - 6, LD ? 440 : 320);
    // 先量說明區高度（畫在暫存畫布上），讓視窗高度貼合內容
    const sid0 = demo.ids[demo.i], LW = LD ? Math.round(pw * 0.55) : pw, iw0 = LD ? pw - LW - 16 : pw - 22, mk = demo.name + demo.i + iw0;
    if (demo.mk !== mk) { const nb = U().btns.length; demo.mk = mk; demo.infoH = skillInfo(G._mc, 0, 0, iw0, demo.name, sid0, demo.side); U().btns.length = nb; }
    const swp = LW - 12, shp = LD ? 0 : G.clamp(Math.round(swp * 0.52), 70, 130);
    const ph = Math.min(uh - I.t - I.b - 6, LD ? 200 : 22 + shp + 5 + 20 + 8 + demo.infoH + 10);
    const px = Math.round(uw / 2 - pw / 2), py = Math.round(I.t + (uh - I.t - I.b - ph) / 2);
    H().box(c, px, py, pw, ph, 1, 7);
    H().btn('dmIn', px, py, pw, ph, null, null);
    G.cn(c, G.nameOf(demo.name), px + 6, py + 4, 9); G.cn(c, '技能展示', px + pw - 18, py + 4, 13, 1);
    const cl = px + pw - 13; H().key(c, cl, py + 4, 10, 10, pr('dmX'), 6); c.fillStyle = P[9]; for (let k = 0; k < 4; k++) { c.fillRect(cl + 3 + k, py + 7 + k, 1, 1); c.fillRect(cl + 6 - k, py + 7 + k, 1, 1); }
    tap('dmX', cl - 3, py + 1, 16, 16, () => { demo = null; sbKey = ''; });
    // 版面：直屏上下；橫屏左右
    const lw = LD ? Math.round(pw * 0.55) : pw, sw = lw - 12, bs = 20, n = demo.ids.length;
    const shh = LD ? G.clamp(ph - 22 - bs - 14, 60, Math.round(sw * 0.62)) : G.clamp(Math.round(sw * 0.52), 70, 130);
    const sid = demo.ids[demo.i];
    sb.size(sw, shh);
    const key = demo.name + '|' + demo.side + '|' + sw + '|' + shh + '|' + demo.i;
    if (sbKey !== key) { sb.setup(demo.name, demo.side, sid); sbKey = key; if (sid != null && G.Ach) G.Ach.on('demo', String(sid)); }
    sb.update(M.dt);
    H().box(c, px + 5, py + 19, sw + 2, shh + 2, 0, 5, false); c.drawImage(sb.draw(), px + 6, py + 20);
    // 切換列
    const gap = Math.min(4, Math.floor((lw - 12 - n * bs) / Math.max(1, n - 1))), rx = Math.round(px + lw / 2 - (n * bs + (n - 1) * gap) / 2), ry = py + 22 + shh + 5;
    demo.ids.forEach((id, k) => {
      const on = k === demo.i, xx = rx + k * (bs + gap), bid = 'dm' + k, o = pr(bid) ? 1 : 0, sd = id != null ? G.ORIG.skills[id] : null;
      H().key(c, xx, ry + o, bs, bs, on, on ? 13 : sd && !sd.active ? PASSIVE_COL : 6);
      H().icon(c, sd ? G.skillIcon(sd) : 'i_attack', xx + bs / 2, ry + bs / 2 + o);
      tap(bid, xx, ry, bs, bs, () => { demo.i = k; G.Audio.play('tick'); });
    });
    // 說明區（可捲動）
    const ix = LD ? px + lw + 4 : px + 8, iy = LD ? py + 20 : ry + bs + 8, iw = LD ? pw - lw - 16 : pw - 22, ih = py + ph - 6 - iy;
    scrollDetail(c, ix, iy, iw, ih, 'dm' + demo.name + demo.i, yy => skillInfo(c, ix, yy, iw, demo.name, sid, demo.side), SD);
  }
  // 可捲動詳細區：內容超出時可上下拖曳 / 滾輪捲動（主畫面與技能展示各自一組狀態）
  const SM = { s: 0, max: 0, region: null, key: '' }, SD = { s: 0, max: 0, region: null, key: '' };
  M.scroll = (dy, ux, uy) => { const S = demo ? SD : SM, r = S.region; if (!r || ux < r[0] - 6 || uy < r[1] || uy > r[1] + r[3]) return false; S.s = G.clamp(S.s + dy, 0, S.max); return true; };
  // 慣性：手指離開時帶著速度繼續滑，慢慢減速停下
  M.fling = (v, ux, uy) => { const S = demo ? SD : SM, r = S.region; if (!r || ux < r[0] - 6 || uy < r[1] || uy > r[1] + r[3]) return; S.v = G.clamp(v, -1600, 1600); };
  M.scrollHold = () => { SM.v = 0; SD.v = 0; };
  function scrollDetail(c, x, y, w, h, key, draw, S = SM) {
    if (key !== S.key) { S.key = key; S.s = 0; S.v = 0; }
    if (S.v) { S.s += S.v * M.dt; S.v *= Math.exp(-M.dt * 3.2); if (Math.abs(S.v) < 6 || S.s <= 0 || S.s >= S.max) S.v = 0; S.s = G.clamp(S.s, 0, S.max); }
    S.region = [x, y, w, h];
    const nb = U().btns.length;
    c.save(); c.beginPath(); c.rect(x - 2, y, w + 4, h); c.clip();
    const end = draw(y - S.s);
    c.restore();
    U().btns = U().btns.filter((b, i) => i < nb || (b.y + b.h > y && b.y < y + h));
    S.max = Math.max(0, end + S.s - (y + h) + 4); S.s = Math.min(S.s, S.max);
    if (S.max > 0) {
      const th = Math.max(10, Math.round(h * h / (h + S.max))), ty = y + Math.round((h - th) * S.s / S.max);
      c.fillStyle = P[2]; c.fillRect(x + w + 3, y, 2, h); c.fillStyle = P[7]; c.fillRect(x + w + 3, ty, 2, th);
      if (S.s < S.max - 2) { const ax = Math.round(x + w / 2), ay = y + h - 6 + Math.round(Math.abs(Math.sin(gt * 4)) * 2); c.fillStyle = P[0]; c.fillRect(ax - 4, ay - 1, 9, 4); c.fillStyle = P[13]; c.fillRect(ax - 3, ay - 1, 7, 1); c.fillRect(ax - 2, ay, 5, 1); c.fillRect(ax - 1, ay + 1, 3, 1); c.fillRect(ax, ay + 2, 1, 1); }
    }
  }
  // 兩欄（橫屏）/ 上下（直屏）版面
  const land = () => R.uw > R.uh * 1.15;

  // ---------- 首頁 ----------
  const ITEMS = [['單人', 'SOLO', 'i_play', () => U().start()], ['多人', 'MULTI', 'i_users', () => { modal = 2.2; }], ['隊伍', 'TEAM', 'i_tree', () => go('team')], ['商店', 'SHOP', 'i_key', () => go('store')],
    ['成就', 'TROPHY', 'i_trophy', () => go('ach')], ['圖鑑', 'BOOK', 'i_book', () => go('book')], ['教學', 'GUIDE', 'i_guide', () => M.openGuide(false)], ['存檔', 'SAVE', 'i_save', () => go('save')], ['設定', 'SETTING', 'i_gear', () => { setOpen = true; }]];
  // 執行首頁選項：會切換畫面的先播轉場（按鈕撥開 → 光圈展開）；多人、設定是彈窗，直接開
  const runItem = i => { if (G.Trans.busy()) return; const it = ITEMS[i]; if (it[0] === '多人' || it[0] === '設定') it[3](); else G.Trans.start(it[3]); };
  const mw = G.UI.wheel();                                 // 首頁滾輪
  M.menuWheel = mw;
  function go(s) { U().screen = s; sbKey = ''; skillSel = -1; picker = null; info = null; demo = null; if (s === 'save' && G.SaveUI) G.SaveUI.reset(); if (s === 'ach' && G.AchUI) G.AchUI.reset(); }
  let menuT = 0, resetAsk = false, setOpen = false, devAsk = null; const leaves = [];
  // v2.4 開發者模式密碼鎖：只存雜湊值（FNV-1a），原文不寫在程式裡
  const devHash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  const DEV_LEN = 8, DEV_H = 3224873579;
  const devInput = d => {
    if (!devAsk) return;
    if (d === 'del') { devAsk.s = devAsk.s.slice(0, -1); G.Audio.play('tick'); return; }
    if (devAsk.s.length >= DEV_LEN) return;
    devAsk.s += d; G.Audio.play('tick');
    if (devAsk.s.length === DEV_LEN) {
      if (devHash(devAsk.s) === DEV_H) { devAsk = null; G.Team.setDev(true); G.Audio.play('level'); }
      else { devAsk.err = 0.45; devAsk.s = ''; G.Audio.play('deny'); }
    }
  };
  M.devAsk = on => { devAsk = on ? { s: '', err: 0 } : null; };   // 測試用
  M.resetIntro = () => { menuT = 0; };
  M._mt = v => { menuT = v; };   // 測試用
  M._set = v => { setOpen = v; };   // 測試用
  // ---------- 標題 LOGO：Leaf of Legends ----------
  // 版面：上「LEAF」（銀白）→ 中「─◆ OF ◆─」飾線 → 下「LEGENDS」（金色，大字）
  // 字形 5×7；每個字直接以輸出解析度上色：金屬漸層＋上緣亮邊＋下緣暗邊＋黑色外框＋右下影子
  // 動畫：LEGENDS 逐字由大砸下 → 落定時閃光震動、背後光芒展開 → LEAF 落下、飾線向兩側延伸 → 待機：光芒旋轉、光暈呼吸、火星上飄、週期掃光
  const TITLE_GLYPH = {
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'], E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'], N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
    D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'], S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.']
  };
  const GRAD = { gold: f => f < 0.08 ? 9 : f < 0.55 ? 13 : 14, silver: f => f < 0.5 ? 9 : f < 0.8 ? 8 : 7, leaf: f => f < 0.1 ? 20 : f < 0.62 ? 11 : 16, white: () => 9 };
  const titleCache = {};
  function titleLetter(ch, s, style) {
    const key = ch + s + style; if (titleCache[key]) return titleCache[key];
    const g = TITLE_GLYPH[ch], o = Math.max(1, Math.round(s / 2)), sh = Math.max(1, Math.round(s / 2)), on = (X, Y) => X >= 0 && Y >= 0 && X < 5 && Y < 7 && g[Y][X] === '#';
    const c = G.canvas(5 * s + o * 2 + sh, 7 * s + o * 2 + sh), x = c.getContext('2d'), gr = GRAD[style];
    const cells = []; for (let Y = 0; Y < 7; Y++) for (let X = 0; X < 5; X++) if (on(X, Y)) cells.push([X, Y]);
    if (style !== 'white') { x.fillStyle = G.PAL[1]; for (const [X, Y] of cells) x.fillRect(o + X * s + sh, o + Y * s + sh, s, s); }   // 影子
    if (style !== 'white') { x.fillStyle = G.PAL[0]; for (const [X, Y] of cells) x.fillRect(X * s, Y * s, s + o * 2, s + o * 2); }  // 外框
    for (const [X, Y] of cells) for (let yy = 0; yy < s; yy++) {
      const col = gr((Y * s + yy + 0.5) / (7 * s));                     // 整個字一條連續的金屬漸層（不做逐格亮邊，避免雜點）
      x.fillStyle = G.PAL[col]; x.fillRect(o + X * s, o + Y * s + yy, s, 1);
    }
    return (titleCache[key] = { c, o });
  }
  const logoParts = [];
  // 量尺寸：LEGENDS 寬 = 41 格 × s2
  // LEAF 和 LEGENDS 同字級（靠顏色區分層次）
  M.logoSize = maxW => { const s2 = G.clamp(Math.floor((maxW - 4) / 41), 2, 6), sA = s2; return { s2, sA, h: 7 * sA + 6 + 7 + 6 + 7 * s2 + 2 }; };
  function drawWord(c, word, cx, y, s, style, fn) {
    const adv = 6 * s, W2 = word.length * adv - s, x0 = Math.round(cx - W2 / 2);
    for (let i = 0; i < word.length; i++) { const L = titleLetter(word[i], s, style), k = fn ? fn(i) : { a: 1, m: 1, dy: 0 }; if (k.a <= 0) continue;
      const x = x0 + i * adv - L.o, w = L.c.width * k.m, h = L.c.height * k.m, lx = Math.round(x + L.c.width / 2 - w / 2), ly = Math.round(y - L.o + k.dy + L.c.height / 2 - h / 2);
      c.globalAlpha = k.a; c.drawImage(L.c, lx, ly, Math.round(w), Math.round(h)); c.globalAlpha = 1; }
    return [x0, W2];
  }
  // 力夫在標題上的小劇場：走路 → 停下 → 蓄力 → 往前一撲＋斬擊弧＋飛出一片葉子 → 繼續走
  const MAS = { x: 0.5, dir: 1, mode: 'walk', t: 0, next: 2.5, fx: [] };
  function mascot(c, x0, wid, footY) {
    const m = MAS, dt = Math.min(0.05, M.dt || 0.016), fr = G.SPR.leafy;
    m.t += dt;
    if (m.mode === 'walk') {
      m.x += m.dir * dt * 16 / Math.max(20, wid);
      if (m.x > 0.95) { m.x = 0.95; m.dir = -1; } if (m.x < 0.05) { m.x = 0.05; m.dir = 1; }
      m.next -= dt; if (m.next <= 0) { m.mode = 'atk'; m.t = 0; }
    } else if (m.t > 0.75) { m.mode = 'walk'; m.t = 0; m.next = G.rr(2.2, 4.2); if (Math.random() < 0.35) m.dir *= -1; }
    let px = x0 + m.x * wid, py = footY, f = fr[0];
    if (m.mode === 'walk') { f = fr[((menuT * 6) | 0) % fr.length]; py -= ((menuT * 6) | 0) % 2; }
    else {
      const T = m.t;
      if (T < 0.22) px -= m.dir * Math.round(T / 0.22 * 2);                       // 蓄力：往後縮
      else if (T < 0.36) { px += m.dir * Math.round((T - 0.22) / 0.14 * 5); py -= 2; if (!m.hit) { m.hit = 1; m.fx.push({ x: px + m.dir * 8, y: py - 6, d: m.dir, t: 0 }); } }   // 往前撲
      else { px += m.dir * Math.round(5 * (1 - (T - 0.36) / 0.39)); m.hit = 0; }
    }
    const img = m.dir < 0 ? f.m : f.n;
    c.drawImage(img, Math.round(px - f.w / 2), Math.round(py - f.h));
    // 斬擊弧＋飛出的葉子
    for (let i = m.fx.length - 1; i >= 0; i--) {
      const e = m.fx[i]; e.t += dt; if (e.t > 0.6) { m.fx.splice(i, 1); continue; }
      if (e.t < 0.16) { const k = e.t / 0.16; c.fillStyle = P[9]; c.globalAlpha = 1 - k; for (let a = -3; a <= 3; a++) { const ang = a * 0.35, r = 6 + k * 3; c.fillRect(Math.round(e.x + e.d * Math.cos(ang) * r), Math.round(e.y + Math.sin(ang) * r), 1, 1); } c.globalAlpha = 1; }
      const lx = e.x + e.d * e.t * 60, ly = e.y + Math.sin(e.t * 12) * 2; c.globalAlpha = 1 - e.t / 0.6; c.fillStyle = P[11]; c.fillRect(Math.round(lx), Math.round(ly), 2, 1); c.fillStyle = P[16]; c.fillRect(Math.round(lx) + 1, Math.round(ly) + 1, 2, 1); c.globalAlpha = 1;
    }
  }
  function bigTitle(c, cx, ty, maxW) {
    const { s2, sA } = M.logoSize(maxW), t = menuT, ss2 = k => k * k * (3 - 2 * k);
    const yA = ty, yO = yA + 7 * sA + 6, yG = yO + 13, gW = 41 * s2, gcx = cx, gcy = yG + 3.5 * s2;
    const land = 0.08 + 6 * 0.055 + 0.14;                                   // LEGENDS 全部落定的時間
    const shake = t > land && t < land + 0.22 ? Math.round((Math.random() - 0.5) * 2 * s2 * 0.6) : 0;
    const bob = t > 1.2 ? Math.round(Math.sin(t * 1.6)) : 0;
    c.save(); c.translate(shake, bob);
    // 背後：暗色底（和移動的背景分開）＋ 金色光暈呼吸 ＋ 旋轉光芒
    const rk = ss2(G.clamp((t - land) / 0.45, 0, 1));
    const soft = (x, y, rx, ry, rgb, a) => { c.save(); c.translate(x, y); c.scale(1, ry / rx); const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore(); };   // 柔和橢圓（漸層，不用顆粒）
    soft(gcx, (yA + gcy) / 2, gW * 0.72, (gcy - yA) + 10 * s2, '10,10,10', 0.55);
    if (rk > 0) {
      // v2.4 取代一條條的放射光芒：落地時一圈柔光衝擊波 → 待機是「柔光暈＋橫向光帶（鏡頭光暈）＋字上偶爾閃過的星芒」
      const pulse = 0.5 + Math.sin(t * 2.4) * 0.5, rw0 = G.clamp((t - land) / 0.7, 0, 1);
      if (rw0 > 0 && rw0 < 1) { c.globalAlpha = (1 - rw0) * 0.5; c.strokeStyle = 'rgb(255,236,150)'; c.lineWidth = Math.max(1, s2 * (1 - rw0)); c.beginPath(); c.ellipse(gcx, gcy, gW * (0.3 + 0.7 * rw0), 7 * s2 * (0.5 + 1.2 * rw0), 0, 0, 6.2832); c.stroke(); c.globalAlpha = 1; }
      c.globalAlpha = rk; soft(gcx, gcy, gW * 0.7, 7 * s2 * 1.5, '247,190,50', 0.13 + pulse * 0.06); soft(gcx, gcy, gW * 0.38, 7 * s2 * 0.8, '255,240,170', 0.1 + pulse * 0.05);
      { const lw = gW * (0.95 + 0.08 * pulse), ly = Math.round(gcy), lg = c.createLinearGradient(gcx - lw, 0, gcx + lw, 0);
        lg.addColorStop(0, 'rgba(255,230,140,0)'); lg.addColorStop(0.5, 'rgba(255,245,200,' + (0.55 + 0.25 * pulse).toFixed(2) + ')'); lg.addColorStop(1, 'rgba(255,230,140,0)');
        c.fillStyle = lg; c.fillRect(Math.round(gcx - lw), ly, Math.round(lw * 2), 1);
        const lg2 = c.createLinearGradient(gcx - lw * 0.6, 0, gcx + lw * 0.6, 0); lg2.addColorStop(0, 'rgba(255,220,120,0)'); lg2.addColorStop(0.5, 'rgba(255,220,120,0.22)'); lg2.addColorStop(1, 'rgba(255,220,120,0)');
        c.fillStyle = lg2; c.fillRect(Math.round(gcx - lw * 0.6), ly - Math.max(1, s2 >> 1), Math.round(lw * 1.2), Math.max(1, s2 >> 1) * 2 + 1); }
      c.globalAlpha = 1;
      // 星芒：每 0.7 秒在 LEGENDS 某處閃一下（四角星＋柔光）
      if (t > land + 0.4) { const ph = (t - land) / 0.7, n = ph | 0, f = ph - n; if (f < 0.5) { const sxp = Math.round(gcx + (G.hash(n, 3) - 0.5) * gW * 0.9), syp = Math.round(yG + G.hash(n, 7) * 7 * s2), k = Math.sin(f / 0.5 * Math.PI), L = Math.round((2 + s2) * k);
        soft(sxp, syp, L * 2 + 2, L * 2 + 2, '255,250,220', 0.5 * k); c.fillStyle = P[9]; c.fillRect(sxp - L, syp, L * 2 + 1, 1); c.fillRect(sxp, syp - L, 1, L * 2 + 1); } }
    }
    // 火星：從 LEGENDS 下方往上飄
    if (t > land && logoParts.length < 26 && Math.random() < 0.35) logoParts.push({ x: gcx + (Math.random() - 0.5) * gW, y: yG + 7 * s2, vy: -G.rr(8, 22), l: G.rr(1.2, 2.4), l0: 0, c: G.pick([13, 14, 9, 14]) });
    for (let i = logoParts.length - 1; i >= 0; i--) { const p = logoParts[i]; p.l0 += M.dt; if (p.l0 > p.l) { logoParts.splice(i, 1); continue; } p.y += p.vy * M.dt; const xx = Math.round(p.x + Math.sin(p.l0 * 4 + p.y) * 2); c.globalAlpha = 1 - p.l0 / p.l; c.fillStyle = P[p.c]; c.fillRect(xx, Math.round(p.y), 1, 1); c.globalAlpha = 1; }
    // LEGENDS：逐字由大砸下
    const fn = i => { const t0 = 0.08 + i * 0.055, k = G.clamp((t - t0) / 0.14, 0, 1); return { a: k, m: 1 + (1 - k) * (1 - k) * 1.8, dy: 0 }; };
    const [gx0] = drawWord(c, 'LEGENDS', gcx, yG, s2, 'gold', fn);
    // 掃光：一道斜的白光掃過 LEGENDS
    const sp = (t - 1.5) % 3.8;
    if (t > 1.5 && sp < 0.6) {
      const bx = gx0 - 10 + (gW + 30) * (sp / 0.6), bw2 = 3 * s2;
      c.save(); c.beginPath(); c.moveTo(bx, yG - 4); c.lineTo(bx + bw2, yG - 4); c.lineTo(bx + bw2 - 7 * s2 * 0.5, yG + 7 * s2 + 4); c.lineTo(bx - 7 * s2 * 0.5, yG + 7 * s2 + 4); c.closePath(); c.clip();
      c.globalAlpha = 0.85; drawWord(c, 'LEGENDS', gcx, yG, s2, 'white'); c.globalAlpha = 1; c.restore();
    }
    // 落定瞬間：白閃＋塵土
    if (t > land && t < land + 0.3) { c.globalAlpha = 1 - (t - land) / 0.3; drawWord(c, 'LEGENDS', gcx, yG, s2, 'white'); c.globalAlpha = 1; }   // 落定瞬間：整排字閃白
    // LEAF：落下＋小彈跳
    const ka = G.clamp((t - land - 0.05) / 0.3, 0, 1);
    if (ka > 0) {
      const dy = Math.round((1 - ka) * (1 - ka) * -24 + Math.sin(ka * Math.PI) * 3 * (1 - ka));
      const [ax0] = drawWord(c, 'LEAF', cx, yA, sA, 'leaf', () => ({ a: ka, m: 1, dy }));
      // 吉祥物力夫：在 LEAF 上方來回走，時不時停下來揮擊
      if (t > land + 0.45) mascot(c, ax0, 23 * sA, Math.round(yA - Math.max(1, sA >> 1)));
    }
    // 飾線 ─◆ OF ◆─：從中間往兩側延伸
    const ko = ss2(G.clamp((t - land - 0.2) / 0.35, 0, 1));
    if (ko > 0) {
      const osc = s2 >= 5 ? 2 : 1, ow = G.textW('OF') * osc, half = Math.round((gW / 2 - ow / 2 - 8) * ko), my = yO + 3;
      c.fillStyle = P[0]; c.fillRect(Math.round(cx - ow / 2 - 6 - half), my - 1, half, 3); c.fillRect(Math.round(cx + ow / 2 + 6), my - 1, half, 3);
      c.fillStyle = P[13]; c.fillRect(Math.round(cx - ow / 2 - 6 - half), my, half, 1); c.fillRect(Math.round(cx + ow / 2 + 6), my, half, 1);
      const dia = dx => { c.fillStyle = P[0]; c.fillRect(dx - 2, my - 2, 5, 5); c.fillStyle = P[13]; c.fillRect(dx - 1, my - 1, 3, 3); c.fillStyle = P[9]; c.fillRect(dx, my - 1, 1, 1); };
      dia(Math.round(cx - ow / 2 - 6 - half)); dia(Math.round(cx + ow / 2 + 6 + half));
      c.globalAlpha = ko; G.text(c, 'OF', cx, yO + 4 - Math.round(2.5 * osc), 13, osc, 0, 0.5); c.globalAlpha = 1;
    }
    c.restore();
  }
  function drawLeaves(c, uw, uh) {
    if (leaves.length < 22 && Math.random() < 0.3) leaves.push({ x: Math.random() * uw * 1.2 - uw * 0.1, y: -6, vx: G.rr(6, 18), vy: G.rr(8, 18), r: Math.random() * 6, c: G.pick([7, 8, 9, 6]) });
    for (let i = leaves.length - 1; i >= 0; i--) {
      const L = leaves[i]; L.x += (L.vx + Math.sin(menuT * 2 + L.r) * 10) * M.dt; L.y += L.vy * M.dt;
      if (L.y > uh + 6) { leaves.splice(i, 1); continue; }
      c.fillStyle = P[L.c]; const f = ((menuT * 4 + L.r) | 0) % 2;
      c.fillRect(Math.round(L.x), Math.round(L.y), 2, 1); c.fillRect(Math.round(L.x) + f, Math.round(L.y) + 1, 2, 1);
    }
  }
  M.menu = c => {
    tick(); menuT += M.dt;
    const uw = R.uw, uh = R.uh, I = R.ins, LD = uw > uh * 1.15;
    H().dim(c, 0.55);
    drawLeaves(c, uw, uh);
    // 首頁選單：直式滾輪（中間那顆＝點一下進入；其他＝點一下轉過來；上下滑動／滾輪捲動）
    const bw = 116, bh = 18, step = bh + 6, vis = 2, listH = step * (vis * 2 + 1) + 14;
    let tcx, tty, bx, by0, tmax;
    if (LD) {                                             // 橫屏：LOGO 在左、選單在右
      const half = (uw - I.l - I.r) * 0.6;
      bx = Math.round(I.l + half + ((uw - I.r - I.l - half) - bw) / 2); by0 = Math.round(uh / 2 - listH / 2);
      tmax = bx - 22 - I.l; tcx = I.l + tmax / 2; tty = Math.round(uh / 2 - M.logoSize(tmax).h / 2) + 2;   // LOGO 置中於選單左邊的空間（留出選取箭頭的位置）
    } else {
      tmax = uw - I.l - I.r - 8; tcx = uw / 2; const lh = M.logoSize(tmax).h;
      tty = I.t + Math.max(22, Math.round((uh - I.t - I.b - (lh + 24 + listH)) * 0.38));
      bx = Math.round(uw / 2 - bw / 2); by0 = tty + lh + 24;
    }
    bigTitle(c, tcx, tty, tmax);
    mw.sp = step; mw.update(M.dt, ITEMS.length);
    const appear = G.clamp((menuT - 0.85) / 0.35, 0, 1);
    if (appear > 0) {
      const cy = by0 + 7 + vis * step + Math.round(bh / 2), off = Math.round((1 - appear) * (1 - appear) * 30), top = by0 + 7, bot = top + step * (vis * 2 + 1);
      c.globalAlpha = appear;
      // 中央聚光：一道淡淡的亮帶
      c.fillStyle = P[9]; c.globalAlpha = appear * 0.06; c.fillRect(bx - 18, cy - 13 + off, bw + 36, 26); c.globalAlpha = appear;
      H().wheelBtn(mw, bx - 14, top, bw + 28, bot - top);
      c.save(); c.beginPath(); c.rect(bx - 20, top, bw + 40, bot - top); c.clip();
      const order = ITEMS.map((q, i) => i).sort((p2, q) => Math.abs(q - mw.pos) - Math.abs(p2 - mw.pos));
      for (const i of order) {
        const [cn, en, ic, fn] = ITEMS[i], d = i - mw.pos, ad = Math.abs(d); if (ad > vis + 0.6) continue;
        const po = G.Trans.part(), xo = Math.round((i % 2 ? 1 : -1) * po * po * uw * 0.8);       // 轉場：按鈕左右交錯撥開
        const ctr = ad < 0.5, w2 = bw - Math.round(Math.min(ad, 2) * 10), x = Math.round(bx + (bw - w2) / 2) + xo, id = 'm' + i, p = pr(id) ? 1 : 0;
        const y = Math.round(cy - bh / 2 + d * step + off - (ctr ? Math.round(mw.bump) : 0));
        if (ctr && mw.settled) { c.fillStyle = P[(Math.sin(gt * 4) > 0) ? 13 : 14]; c.fillRect(x - 1, y - 1 + p, w2 + 2, bh + 2); }
        H().key(c, x, y + p, w2, bh, p, ctr ? 13 : 5, ctr ? 2 : 1);
        H().icon(c, ic, x + 12, y + 9 + p, ad > 1.5);
        G.cn(c, cn, x + 26, y + 3 + p, ctr ? 9 : 7);
        G.text(c, en, x + w2 - 7, y + 7 + p, ctr ? 13 : 5, 1, null, 1);
        if (i === 3 && G.FreeChest && G.FreeChest.ready()) { const n = 'FREE', dw = G.textW(n) + 4; c.fillStyle = P[0]; c.fillRect(x + w2 - 5 - dw, y - 4 + p, dw + 2, 9); c.fillStyle = P[11]; c.fillRect(x + w2 - 4 - dw, y - 3 + p, dw, 7); G.text(c, n, x + w2 - 2 - dw, y - 2 + p, 0); }   // 賭徒寶箱可免費開
        if (i === 4 && G.Ach.unclaimed() > 0) { const n = String(G.Ach.unclaimed()), dw = G.textW(n) + 4; c.fillStyle = P[0]; c.fillRect(x + w2 - 5 - dw, y - 4 + p, dw + 2, 9); c.fillStyle = P[10]; c.fillRect(x + w2 - 4 - dw, y - 3 + p, dw, 7); G.text(c, n, x + w2 - 2 - dw, y - 2 + p, 9); }   // 有成就可以領：紅點
        if (!ctr) { c.fillStyle = 'rgba(12,12,12,' + Math.min(0.5, ad * 0.24).toFixed(3) + ')'; c.fillRect(x, y + p, w2 + 1, bh + 3 - p); }   // 柔和陰影（半透明，不用顆粒）
        tap(id, x, y, w2, bh, () => { if (Math.abs(mw.pos - i) < 0.5) runItem(i); else mw.go(i); });
        H().tagWheel(mw);
      }
      c.restore();
      // 選取框：左右兩個黃色箭頭（會呼吸）
      const ax = Math.round(Math.abs(Math.sin(gt * 4)) * 2);
      c.fillStyle = P[13]; c.globalAlpha = appear * (1 - G.Trans.part());
      for (let k = 0; k < 4; k++) { c.fillRect(bx - 8 - ax + k, cy - 3 + k + off, 1, 7 - k * 2); c.fillRect(bx + bw + 7 + ax - k, cy - 3 + k + off, 1, 7 - k * 2); }
      // 上下箭頭（點一下也能捲）
      const arrow = (id, yy, dir, en) => {
        const o = pr(id) ? 1 : 0, ax2 = Math.round(bx + bw / 2);
        c.fillStyle = P[en ? 7 : 3]; for (let k = 0; k < 4; k++) c.fillRect(ax2 - k, yy + (dir < 0 ? k : 3 - k) + o, 1 + k * 2, 1);
        if (en) tap(id, ax2 - 12, yy - 3, 24, 10, () => mw.step(dir));
      };
      arrow('mwU', top - 6, -1, mw.tgt > 0); arrow('mwD', bot + 2, 1, mw.tgt < ITEMS.length - 1);
      c.globalAlpha = 1;
    }
    G.text(c, 'V2.8', uw - I.r - 2, uh - I.b - 6, 3, 1, null, 1);
    // 右上：鑰匙數；左下：開發者模式開關
    const kt = G.Team.dev ? '∞' : String(G.Team.keys()), kw = 22 + G.cnW(kt);
    H().box(c, uw - I.r - kw, I.t, kw, 14, 0, 13); H().icon(c, 'i_key', uw - I.r - kw + 9, I.t + 7); G.cn(c, kt, uw - I.r - 4, I.t + 1, 13, 1);
    const dv = G.Team.dev, dvw = dv ? 40 : 24, dvx = I.l + 2, dvy = uh - I.b - 13, dvo = pr('dev') ? 1 : 0;
    H().key(c, dvx, dvy + dvo, dvw, 12, dvo, dv ? 14 : 4, dv ? 13 : 1); G.text(c, dv ? 'DEV ON' : 'DEV', dvx + dvw / 2, dvy + 4 + dvo, dv ? 0 : 5, 1, null, 0.5);
    tap('dev', dvx, dvy, dvw, 12, () => { if (G.Team.dev) { G.Team.setDev(false); G.Audio.play('click'); } else { devAsk = { s: '', err: 0 }; G.Audio.play('open'); } });   // 開啟要密碼、關閉不用
    // 資料重置（測試用）：先跳確認
    const rsx = dvx + dvw + 4, rso = pr('rst') ? 1 : 0;
    H().key(c, rsx, dvy + rso, 32, 12, rso, 10); G.text(c, 'RESET', rsx + 16, dvy + 4 + rso, 10, 1, null, 0.5);
    tap('rst', rsx, dvy, 32, 12, () => { resetAsk = true; });
    // 重播開場動畫：和 DEV／RESET 同高、並排
    { const ow = G.textW('OP') + 12, ox = rsx + 36, oo = pr('replay') ? 1 : 0;
      H().key(c, ox, dvy + oo, ow, 12, oo, 4); G.text(c, 'OP', ox + ow / 2, dvy + 4 + oo, 5, 1, null, 0.5);
      tap('replay', ox, dvy, ow, 12, () => { G.Intro.reset(); U().screen = 'intro'; G.Audio.musicRestart('menu'); }); }
    if (resetAsk) {
      H().btn('rsBg', 0, 0, uw, uh, null, () => { resetAsk = false; });
      H().dim(c, 0.7);
      const w = Math.min(uw - 16, 190), ls = G.cnWrap('角色、鑰匙、隊伍、成就、存檔名稱都會回到初始狀態。', w - 16), h = 52 + ls.length * 13, x = Math.round(uw / 2 - w / 2), y = Math.round(uh / 2 - h / 2);
      H().box(c, x, y, w, h, 1, 10); H().btn('rsIn', x, y, w, h, null, null);
      G.cn(c, '清除所有進度？', x + w / 2, y + 6, 9, 0.5);
      ls.forEach((l, i) => G.cn(c, l, x + w / 2, y + 22 + i * 13, 6, 0.5));
      const bw = 60, by = y + h - 22;
      btnSecondary(c, 'rsNo', Math.round(x + w / 2 - bw - 4), by, bw, 16, '取消', () => { resetAsk = false; });
      const ox = Math.round(x + w / 2 + 4), oo = pr('rsYes') ? 1 : 0; H().key(c, ox, by + oo, bw, 16, oo, 15, 10); G.cn(c, '清除', ox + bw / 2, by + 2 + oo, 9, 0.5);
      tap('rsYes', ox, by, bw, 16, () => { try { localStorage.removeItem('leafwar_team'); localStorage.removeItem('leafwar_dev'); } catch (e) { } G.Team.v = null; G.Team.dev = false; G.Team.get(); cars.team.inited = false; resetAsk = false; G.Audio.play('level'); });
    }
    if (devAsk) {                                        // 開發者密碼：數字鍵盤（也可以直接用鍵盤輸入）
      H().btn('dvBg', 0, 0, uw, uh, null, () => { devAsk = null; });
      H().dim(c, 0.7);
      devAsk.err = Math.max(0, devAsk.err - M.dt);
      const kw = 30, kh = 17, g = 3, w = kw * 3 + g * 2 + 16, h = 8 + 13 + 14 + kh * 4 + g * 3 + 8, x = Math.round(uw / 2 - w / 2), y = Math.round(uh / 2 - h / 2), sx = devAsk.err > 0 ? Math.round(Math.sin(devAsk.err * 60) * 3) : 0;
      H().box(c, x + sx, y, w, h, 1, devAsk.err > 0 ? 10 : 7); H().btn('dvIn', x, y, w, h, null, null);
      G.cn(c, devAsk.err > 0 ? '密碼錯誤' : '輸入開發者密碼', x + w / 2 + sx, y + 6, devAsk.err > 0 ? 10 : 9, 0.5);
      const dw = 8, dx0 = Math.round(x + w / 2 - (DEV_LEN * dw - 3) / 2) + sx;
      for (let i = 0; i < DEV_LEN; i++) { c.fillStyle = P[i < devAsk.s.length ? 13 : 3]; c.fillRect(dx0 + i * dw, y + 22, 5, 5); }
      const ky = y + 8 + 13 + 14;
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', 'del'].forEach((d, i) => {
        const bx = x + 8 + (i % 3) * (kw + g), by = ky + ((i / 3) | 0) * (kh + g), lab = d === 'x' ? '取消' : d === 'del' ? '刪除' : d;
        btnSecondary(c, 'dv_' + d, bx, by, kw, kh, lab, () => { if (d === 'x') { devAsk = null; G.Audio.play('click'); } else devInput(d); });
      });
    }
    if (setOpen) {                                       // 設定：音樂／音效音量
      H().btn('stBg', 0, 0, uw, uh, null, () => { setOpen = false; });
      H().dim(c, 0.7);
      const w = Math.min(uw - 16, 200), h = 26 + 44 + 26, x = Math.round(uw / 2 - w / 2), y = Math.round(uh / 2 - h / 2);
      H().box(c, x, y, w, h, 1, 7); H().btn('stIn', x, y, w, h, null, null);
      H().icon(c, 'i_gear', x + 10, y + 10); G.cn(c, '設定', x + 18, y + 4, 9);
      U().volPanel(c, x + 6, y + 24, w - 12);
      btnSecondary(c, 'stOk', Math.round(x + w / 2 - 30), y + h - 22, 60, 16, '完成', () => { setOpen = false; });
    }
    G.Menus.pillPos = LD ? [bx, uh - I.b - 15, uw - I.r - 26 - bx] : null;   // 橫屏：備份提醒改成選單下方的小膠囊（不蓋到 LOGO）
    G.Menus.greetPos = LD ? [Math.round((I.l + bx - 20) / 2), uh - I.b - 36, bx - 20 - I.l] : [uw / 2, uh - I.b - 38, uw - I.l - I.r];
    if (G.SaveUI) { G.SaveUI.drawGreet(c); if (!resetAsk && !setOpen && modal <= 0) G.SaveUI.drawBackupTip(c, menuT); G.SaveUI.drawWelcome(c); }
    if (G.Intro) G.Intro.drawFlash(c);
    if (modal > 0) {
      modal -= M.dt;
      H().btn('modal', 0, 0, uw, uh, null, () => { modal = 0; });
      H().dim(c, 0.55);
      const w = 132, h = 46, mx = Math.round(uw / 2 - w / 2), my = Math.round(uh / 2 - h / 2);
      H().box(c, mx, my, w, h, 2, 9);
      G.cn(c, '多人模式', uw / 2, my + 8, 9, 0.5);
      G.text(c, 'COMING SOON', uw / 2, my + 28, 13, 1, 0, 0.5);
    }
  };

  // ---------- 隊伍：左右滑動的角色轉盤（中央聚光、兩側暗影）→ 下方顯示資訊與數值 ----------
  const LANES = ['上路', '中路', '下路'];
  let picker = null, info = null, flash = { k: '', t: 0 }, ttab = 0;
  // 植物點數條：preview = 目前選中小兵的花費（以閃爍格預覽）
  function pips(c, x, y, w, preview) {
    const used = G.Team.used(), max = G.TUNE.plantPoints, over = used + (preview || 0) > max, blink = ((gt * 4) | 0) % 2;
    const pw = Math.max(3, Math.min(9, Math.floor((Math.min(w, 190) - 40) / max) - 1)), tot = 12 + max * (pw + 1) + G.textW(max + '/' + max);
    x = Math.round(x + (w - tot) / 2);                     // 置中
    c.drawImage(G.SPR.leaf_pt.n, x, y + 1);
    for (let i = 0; i < max; i++) {
      const pv = preview && i >= used && i < used + preview;
      c.fillStyle = P[0]; c.fillRect(x + 9 + i * (pw + 1), y, pw, 7);
      c.fillStyle = P[i < used ? (used >= max ? 14 : 13) : pv ? (blink ? 13 : 3) : 3]; c.fillRect(x + 9 + i * (pw + 1), y + 1, pw, 5);
    }
    G.text(c, used + '/' + max, x + 12 + max * (pw + 1), y + 1, over && preview ? 10 : used >= max ? 14 : 9);
  }
  // 小兵頭像（右上 × = 點一下移除）
  function chip(c, id, x, y, sz, name, fn, hot) {
    const o = pr(id) ? 1 : 0, rc = G.RARITY[G.rarityOf(name)].c;
    H().key(c, x, y + o, sz, sz, hot, hot ? 13 : rc);
    c.save(); c.beginPath(); c.rect(x + 1, y + 1 + o, sz - 2, sz - 2); c.clip(); sprFit(c, name, x + sz / 2, y + sz - 2 + o, sz - 3, sz - 4); c.restore();
    if (fn) {
      c.fillStyle = P[0]; c.fillRect(x + sz - 5, y - 1 + o, 6, 6); c.fillStyle = P[10]; c.fillRect(x + sz - 4, y + o, 4, 4);
      c.fillStyle = P[9]; c.fillRect(x + sz - 4, y + o, 1, 1); c.fillRect(x + sz - 1, y + o, 1, 1); c.fillRect(x + sz - 3, y + 1 + o, 2, 2); c.fillRect(x + sz - 4, y + 3 + o, 1, 1); c.fillRect(x + sz - 1, y + 3 + o, 1, 1);
      tap(id, x, y, sz, sz, fn);
    }
  }
  // 三路陣容：三欄並排（上／中／下），選中的那欄亮黃；虛線格＝下一隻會放的位置
  // lists：[[name...]×3]；onLane/onRemove 省略 = 純展示（教學用）
  function laneCols(c, x, y, w, lists, sel, onLane, onRemove, hotIdx) {
    const gap = 3, cw = Math.floor((w - gap * 2) / 3), sz = 16, per = Math.max(1, Math.floor((cw - 4) / (sz + 2)));
    const rows = Math.max(1, ...lists.map((l, i) => Math.ceil((l.length + (i === sel ? 1 : 0)) / per))), hh = 15 + rows * (sz + 2) + 3;
    for (let l = 0; l < 3; l++) {
      const on = sel === l, xx = x + l * (cw + gap);
      H().box(c, xx, y, cw, hh, on ? 1 : 0, on ? 13 : 3, false);
      c.fillStyle = P[on ? 13 : 2]; c.fillRect(xx + 1, y + 1, cw - 2, 13);
      G.cn(c, LANES[l], xx + cw / 2, y + 1, on ? 0 : 6, 0.5);
      if (onLane) tap('ln' + l, xx, y, cw, hh, () => onLane(l));
      const ox = xx + Math.round((cw - per * (sz + 2) + 2) / 2);
      lists[l].forEach((e, k) => {
        const cx = ox + (k % per) * (sz + 2), cy = y + 15 + ((k / per) | 0) * (sz + 2);
        chip(c, 'ch' + l + '_' + k, cx, cy, sz, e.n || e, onRemove ? () => onRemove(e) : null, hotIdx && hotIdx(e));
      });
      if (on) {                                                  // 下一個位置（虛線）
        const k = lists[l].length, cx = ox + (k % per) * (sz + 2), cy = y + 15 + ((k / per) | 0) * (sz + 2);
        c.fillStyle = P[((gt * 3) | 0) % 2 ? 13 : 6];
        for (let q = 0; q < sz; q += 2) { c.fillRect(cx + q, cy, 1, 1); c.fillRect(cx + q, cy + sz - 1, 1, 1); c.fillRect(cx, cy + q, 1, 1); c.fillRect(cx + sz - 1, cy + q, 1, 1); }
        c.fillRect(cx + 7, cy + 5, 2, 6); c.fillRect(cx + 5, cy + 7, 6, 2);
      }
    }
    return y + hh;
  }
  function lineup(c, x, y, w, preview) {
    const T = G.Team.get();
    pips(c, x, y, w, preview); y += 11;
    const lists = [0, 1, 2].map(l => T.loadout.filter(e => e.l === l));
    return laneCols(c, x, y, w, lists, G.Team.lane, l => { G.Team.lane = l; G.Audio.play('tick'); },
      e => { const i = T.loadout.indexOf(e); if (i >= 0) { T.loadout.splice(i, 1); G.Team.save(); G.Audio.play('click'); } },
      e => flash.t > 0 && e === T.loadout[T.loadout.length - 1] && flash.k === e.n) + 4;
  }
  const addMinion = (n) => { if (G.Team.add(n)) { flash = { k: n, t: 0.5 }; G.Audio.play('spawn'); return true; } G.Audio.play('deny'); return false; };
  const setHero = (n) => { const T = G.Team.get(); T.hero = G.HEROES.findIndex(h => h.name === n); G.Team.save(); flash = { k: n, t: 0.5 }; G.Audio.play('level'); };

  // ----- 轉盤狀態（隊伍、圖鑑各一組）-----
  const mkCar = () => ({ pos: 0, tgt: 0, vel: 0, drag: false, last: 0, region: null, sp: 50, n: 1, settled: true, list: [] });
  const cars = { team: mkCar(), book: mkCar() };
  let car = cars.team;
  const carIdx = () => G.clamp(Math.round(car.pos), 0, car.n - 1);
  M.inCar = (ux, uy) => { const c2 = cars[U().screen]; if (!c2 || demo) return false; car = c2; const r = c2.region; return r && ux >= r[0] && ux <= r[0] + r[2] && uy >= r[1] && uy <= r[1] + r[3]; };
  M.carGrab = () => { car.drag = true; car.vel = 0; car.tgt = car.pos; };
  M.carDrag = dx => {
    const before = carIdx(), now = performance.now(), dt = Math.max(8, now - (car.lt || now)) / 1000; car.lt = now;
    let d = -dx / car.sp;
    if (car.pos + d < -0.4 || car.pos + d > car.n - 0.6) d *= 0.35;           // 兩端阻尼
    car.pos += d; car.vel = G.lerp(car.vel, d / dt, 0.5);
    if (carIdx() !== before) { G.Audio.play('tick', 1, 0.02); car.bump = 1; }
  };
  M.carRelease = () => { car.drag = false; car.tgt = G.clamp(Math.round(car.pos + G.clamp(car.vel * 0.18, -3, 3)), 0, car.n - 1); car.settled = false; };
  M.carStep = k => { car.tgt = G.clamp(car.tgt + k, 0, car.n - 1); car.settled = false; };
  function carUpdate(dt) {
    if (car.drag) return;
    const before = carIdx();
    const k = 1 - Math.exp(-dt * 11); car.pos += (car.tgt - car.pos) * k;
    if (carIdx() !== before) { G.Audio.play('tick', 1, 0.02); car.bump = 1; }
    if (!car.settled && Math.abs(car.tgt - car.pos) < 0.02) { car.pos = car.tgt; car.settled = true; G.Audio.play('snap'); sbKey = ''; skillSel = -1; }
  }
  // 位置：中央 → 第一格較寬，之後較密；尺寸：中央放大（整數倍，像素清晰），兩側 1 倍
  const carX = (d, sp) => { const a = Math.abs(d); return Math.sign(d) * (a < 1 ? a * sp : sp + (a - 1) * sp * 0.62); };
  const carS = (d, S) => 1 + (S - 1) * Math.pow(Math.max(0, 1 - Math.abs(d)), 1.4);
  // 圖鑑外框色：首領藍、野怪依營地色、其他灰
  const WILD_OF = n => { for (const k in G.WILD) if (G.WILD[k].unit === n) return G.WILD[k]; return null; };
  const bookCol = n => { const wd = WILD_OF(n); return wd ? wd.col : G.BOSS_SKILL[n] ? 12 : (G.ORIG.units[n] || {}).jungler ? 14 : 6; };
  function carousel(c, x, y, w, h, list, mode) {
    car.n = list.length; car.list = list; car.region = [x, y, w, h];
    if (car.tgt > car.n - 1) { car.tgt = car.pos = car.n - 1; }
    carUpdate(M.dt); car.bump = Math.max(0, (car.bump || 0) - M.dt * 6);
    const cx = x + w / 2, floor = y + h - 12, S = h >= 96 ? 3 : 2, sp = Math.max(40, Math.min(64, w / 5)); car.sp = sp;
    // 背景：暗場 + 聚光燈錐 + 地面光圈
    H().box(c, x, y, w, h, 0, 2, false);
    c.save(); c.beginPath(); c.rect(x + 1, y + 1, w - 2, h - 2); c.clip();
    c.fillStyle = P[9]; for (let k = 0; k < h; k++) { const t = k / h, hw = Math.round(8 + t * 36); c.globalAlpha = 0.025 + t * 0.06; c.fillRect(Math.round(cx - hw), y + k, hw * 2, 1); } c.globalAlpha = 1;
    G.pxDisc(c, cx, floor, 38, 9, 4, 0.9); G.pxDisc(c, cx, floor, 28, 6, 6, 0.6); G.pxEllipse(c, cx, floor, 38, 9, 7);
    // 由遠到近繪製
    const order = list.map((nm, i) => [nm, i]).sort((A, B) => Math.abs(B[1] - car.pos) - Math.abs(A[1] - car.pos));
    for (const [nm, i] of order) {
      const d = i - car.pos; if (Math.abs(d) > 3.2) continue;
      const frames = G.SPR[G.VIS[nm].spr], centre = Math.abs(d) < 0.5;
      const f = frames[centre ? ((gt * 4) | 0) % frames.length : 0], img = G.foeImg(nm, f.n);
      const Si = Math.max(1, Math.min(S, Math.floor((h - 28) / f.h), Math.floor(sp * 1.7 / f.w)));          // 大型角色自動縮小倍率
      const side1 = Math.max(0.55, Math.min(1, (h - 40) / 2 / f.h, sp * 0.8 / f.w));                          // 兩側最小縮放
      const sc = Si > 1 ? carS(d, Si) : side1 + (1 - side1) * Math.max(0, 1 - Math.abs(d)), px = cx + carX(d, sp), dark = G.clamp(Math.abs(d), 0, 1) * 0.72 + G.clamp(Math.abs(d) - 1, 0, 1) * 0.15;
      const fw = Math.round(f.w * sc), fh = Math.round(f.h * sc), bob = centre ? Math.round(Math.sin(gt * 3) * 1.5) - Math.round((car.bump || 0) * 2) : 0;
      const fly = G.VIS[nm].fly ? Math.round(10 * sc / S) : 0;
      const dx = Math.round(px - fw / 2), dy = Math.round(floor - fh + 2 - fly + bob - (1 - G.clamp(Math.abs(d), 0, 1)) * 4);
      G.pxDisc(c, px, floor, f.w * sc * 0.35, f.w * sc * 0.1 + 1, 0, 0.6);
      // 外框光暈（隊伍＝稀有度色；圖鑑＝類別色）
      const gcol = mode === 'book' ? bookCol(nm) : G.RARITY[G.rarityOf(nm)].c, locked = mode !== 'book' && !G.Team.owns(nm);
      const kk = Math.max(1, Math.round(sc)), rr = G.rarityOf(nm), gl = mode !== 'book' && rr === 4 ? G.mythGlow(G.scaled(img, kk), 1, kk >= 2 ? 3 : 2) : G.glowOf(G.scaled(img, kk), gcol, 1, kk >= 2 ? 3 : 2), q = sc / kk;
      if (!locked) {
        c.globalAlpha = (1 - dark) * (0.75 + Math.sin(gt * 4 + i) * 0.25);
        c.drawImage(gl.c, Math.round(dx - gl.p * q), Math.round(dy - gl.p * q), Math.round(gl.c.width * q), Math.round(gl.c.height * q));
        c.globalAlpha = 1;
      }
      c.drawImage(img, dx, dy, fw, fh);
      if (mode !== 'book' && G.Team.isNew(nm) && Math.abs(d) < 2.5) {     // v2.6 NEW 標記（右上角，中央那隻會輕輕彈跳）
        const nb = 'NEW', bw2 = G.textW(nb) + 4, bx2 = Math.min(dx + fw - 2, x + w - bw2 - 4), by2 = Math.max(y + 3, dy - 4 - (centre ? Math.round(Math.abs(Math.sin(gt * 5)) * 2) : 0));
        c.globalAlpha = 1 - dark * 0.6; c.fillStyle = P[0]; c.fillRect(bx2 - 1, by2 - 1, bw2 + 2, 9); c.fillStyle = P[13]; c.fillRect(bx2, by2, bw2, 7); G.text(c, nb, bx2 + 2, by2 + 1, 0); c.globalAlpha = 1;
      }
      const dk2 = locked ? Math.max(0.88, dark) : dark;          // 未擁有：黑色剪影 + 鎖
      if (dk2 > 0.02) { c.globalAlpha = dk2; c.drawImage(G.glowOf(img, 0, 1, 2).tint, dx, dy, fw, fh); c.globalAlpha = 1; }
      if (locked && Math.abs(d) < 0.5) { const lk = G.SPR.i_lock; c.fillStyle = P[0]; c.fillRect(Math.round(px - lk.w / 2) - 2, Math.round(dy + fh / 2 - lk.h / 2) - 2, lk.w + 4, lk.h + 4); H().icon(c, 'i_lock', px, dy + fh / 2); }
      // 標記：出戰中 / 隊伍數量
      if (mode !== 'book' && !locked) {
        const T = G.Team.get(), inTeam = mode === 'hero' ? G.HEROES[T.hero].name === nm : T.loadout.filter(e => e.n === nm).length;
        if (inTeam && Math.abs(d) < 2.5) {
          const lab = mode === 'hero' ? 'GO' : 'X' + inTeam, bw2 = G.textW(lab) + 4, bx = Math.round(px - bw2 / 2), by = Math.max(y + 3, dy - 10);
          c.globalAlpha = 1 - dark * 0.6; c.fillStyle = P[0]; c.fillRect(bx - 1, by - 1, bw2 + 2, 9); c.fillStyle = P[13]; c.fillRect(bx, by, bw2, 7); G.text(c, lab, bx + 2, by + 1, 0); c.globalAlpha = 1;
        }
      }
      if (!centre && Math.abs(d) < 2.6) tap('car' + i, Math.round(px - 14), y + 8, 28, h - 12, () => { car.tgt = i; car.settled = false; });
    }
    // 兩側暗角
    for (let k = 0; k < 26; k += 2) { const a = (1 - k / 26) * 0.55; c.fillStyle = G.pat(c, 0, a); c.fillRect(x + k, y, 2, h); c.fillRect(x + w - k - 2, y, 2, h); }
    c.restore();
    // 刻度（目前位置）
    const dots = Math.min(list.length, 24), dw = 4, dx0 = Math.round(cx - dots * dw / 2);
    for (let k = 0; k < dots; k++) { const on = Math.round(car.pos * (dots - 1) / Math.max(1, list.length - 1)) === k; c.fillStyle = P[on ? 13 : 3]; c.fillRect(dx0 + k * dw, y + h - 4, on ? 3 : 2, 1); }
    // 左右箭頭
    const arrow = (id, ax, dir, en) => {
      const o = pr(id) ? 1 : 0, cy = Math.round(y + h / 2 - 8);
      H().key(c, ax, cy + o, 12, 16, o, en ? 6 : 3);
      c.fillStyle = P[en ? 9 : 4]; for (let k = 0; k < 4; k++) { const xx = dir < 0 ? ax + 7 - k : ax + 4 + k; c.fillRect(xx, cy + 4 + k + o, 1, 8 - k * 2); }
      if (en) tap(id, ax - 2, cy - 4, 16, 24, () => M.carStep(dir));
    };
    arrow('carL', x + 3, -1, car.tgt > 0); arrow('carR', x + w - 15, 1, car.tgt < car.n - 1);
  }
  // 名牌：名稱 + 稀有度（或類別）+ 類型 +（小兵）點數
  // 名牌高度（不畫），讓橫屏版面先算好、按鈕永遠不被切到
  function nameplateH(w, nm, mode) { const hasParts = mode !== 'book' || !!WILD_OF(nm); return tagChips(null, 0, 14 + (hasParts ? 15 : 0), w, G.tagsOf(nm)) + 3; }
  function nameplate(c, x, y, w, nm, mode) {
    G.cn(c, G.nameOf(nm), x + w / 2, y, 9, 0.5);
    const parts = [];                                   // [文字, 顏色, 前置圖]
    if (mode === 'book') {
      const wd = WILD_OF(nm);
      if (wd) parts.push([wd.kind === 'wboss' ? '野生首領' : '野區小怪', wd.col]);
    } else { const rr = G.rarityOf(nm), r = G.RARITY[rr]; parts.push([r.n, r.c, 'dia', rr]); }
    if (mode === 'minion') parts.push([String(G.Team.cost(nm)) + '點', 13, 'leaf']);
    const pw = p => G.cnW(p[0]) + (p[2] ? 9 : 0);
    const tot = parts.reduce((a, p) => a + pw(p), 0) + (parts.length - 1) * 11;
    let sx = Math.round(x + w / 2 - tot / 2); const ly = y + 14;
    parts.forEach((p, i) => {
      if (i) { c.fillStyle = P[3]; c.fillRect(sx - 6, ly + 3, 1, 8); }
      if (p[2] === 'dia') { const cx = sx + 3, cy = ly + 6; c.fillStyle = P[0]; c.fillRect(cx - 4, cy - 4, 9, 9); const rb = p[3] === 4, t6 = (performance.now() / 120) | 0; for (let k = 0; k < 4; k++) { c.fillStyle = P[rb ? G.RB[(k + t6) % 7] : p[1]]; c.fillRect(cx - k, cy - 3 + k, k * 2 + 1, 1); c.fillStyle = P[rb ? G.RB[(7 - k + t6) % 7] : p[1]]; c.fillRect(cx - k, cy + 3 - k, k * 2 + 1, 1); } }
      if (p[2] === 'leaf') c.drawImage(G.SPR.leaf_pt.n, sx, ly + 3);
      if (p[3] === 4) G.cnRb(c, p[0], sx + 9, ly); else G.cn(c, p[0], sx + (p[2] ? 9 : 0), ly, p[1]);
      sx += pw(p) + 11;
    });
    return tagChips(c, x, parts.length ? ly + 15 : ly, w, G.tagsOf(nm)) + 3;
  }
  // 標籤小卡：置中排列，放不下自動換行
  function tagChips(c, x, y, w, tags) {
    const gap = 3, cw = q => G.cnW(q[0]) + 6, rows = [[]]; let rw = 0;
    for (const q of tags) { const ww = cw(q); if (rows[rows.length - 1].length && rw + gap + ww > w - 4) { rows.push([]); rw = 0; } rw += (rows[rows.length - 1].length ? gap : 0) + ww; rows[rows.length - 1].push(q); }
    if (!c) return y + rows.length * 15;                // 只量高度
    rows.forEach((row, ri) => {
      const tot = row.reduce((a, q) => a + cw(q), 0) + gap * (row.length - 1); let sx = Math.round(x + w / 2 - tot / 2); const yy = y + ri * 15;
      row.forEach(q => { const ww = cw(q); c.fillStyle = P[0]; c.fillRect(sx, yy, ww, 13); c.fillStyle = P[q[1] === 9 ? 3 : q[1]]; c.fillRect(sx, yy, ww, 1); c.fillRect(sx, yy + 12, ww, 1); c.fillRect(sx, yy, 1, 13); c.fillRect(sx + ww - 1, yy, 1, 13); G.cn(c, q[0], sx + 3, yy, q[1]); sx += ww + gap; });
    });
    return y + rows.length * 15;
  }
  // 小圖示按鈕（示範 ▶）
  function btnIcon(c, id, x, y, w, h, ic, fn) {
    const o = pr(id) ? 1 : 0;
    H().key(c, x, y + o, w, h, o, 7); H().icon(c, ic, x + w / 2, y + h / 2 + o);
    tap(id, x, y, w, h, fn);
  }

  // v2.6 寶箱開到新角色 →「前往隊伍」：切到對應分頁，角色直接站在聚光燈下
  let nwSpot = null;
  M.focusTeam = nm => {
    const isH = G.HEROES.some(h => h.name === nm), list = isH ? G.HEROES.map(h => h.name) : G.ROSTER.minions, i = list.indexOf(nm); if (i < 0) return;
    ttab = isH ? 0 : 1; if (!isH) sel.minion = nm;
    const cr = cars.team; cr.inited = true; cr.pos = cr.tgt = i; cr.vel = 0; cr.settled = true; cr.bump = 1; nwSpot = null;
    go('team');
  };
  M.team = c => {
    tick(); bg(c); flash.t -= M.dt; car = cars.team;
    const y0 = header(c, '隊伍'), I = R.ins, L = I.l, Rr = R.uw - I.r, uh = R.uh, B = uh - I.b, T = G.Team.get(), LD = land();
    const lists = [G.HEROES.map(h => h.name), G.ROSTER.minions], list = lists[ttab], isHero = ttab === 0, mode = isHero ? 'hero' : 'minion';
    const leftW = LD ? Math.min(200, Math.round((Rr - L) * 0.52)) : Rr - L;
    tabs(c, L + 64, R.ins.t, Math.min(120, Rr - L - 70), ['英雄', '小兵'], ttab, i => {
      if (i === ttab) return; ttab = i; G.Audio.play('tick');
      const sel2 = i === 0 ? G.HEROES[T.hero].name : (sel.minion || list[0]); car.pos = car.tgt = Math.max(0, lists[i].indexOf(sel2)); car.settled = true; sbKey = ''; skillSel = -1;
    });
    { const tw2 = Math.min(120, Rr - L - 70) / 2; [0, 1].forEach(i => { if (i !== ttab && G.Team.newIn(lists[i])) { const nx = Math.round(L + 64 + tw2 * (i + 1) - 6), ny = R.ins.t + 2; c.fillStyle = P[0]; c.fillRect(nx - 1, ny - 1, 6, 6); c.fillStyle = P[13]; c.fillRect(nx, ny, 4, 4); } }); }   // 另一個分頁有 NEW → 黃點
    if (car.inited !== true) { car.inited = true; car.pos = car.tgt = T.hero; }
    const nm0 = list[G.clamp(Math.round(car.pos), 0, list.length - 1)];
    const ch = LD ? G.clamp(B - y0 - 3 - nameplateH(leftW, nm0, mode) - 18, 60, 118) : G.clamp(Math.round(uh * 0.27), 88, 124);
    carousel(c, L, y0, leftW, ch, list, mode);
    const nm = list[carIdx()]; if (!isHero) sel.minion = nm;
    if (nwSpot && nwSpot !== nm) { G.Team.clearNew(nwSpot); nwSpot = null; }     // v2.6 看過的 NEW 角色滾走 → 標記消失
    if (car.settled && G.Team.isNew(nm)) nwSpot = nm;
    const own = G.Team.ownedCount(list); G.cn(c, '擁有 ' + own + '/' + list.length, L + 5, y0 + 2, own === list.length ? 13 : 6);
    if (G.Team.dev) G.text(c, 'DEV', L + leftW - 6, y0 + 5, 13, 1, 0, 1);
    let y = nameplate(c, L, y0 + ch + 3, leftW, nm, mode);
    // 行動按鈕（主要）＋ 技能展示
    const bw = Math.min(leftW - 12, 176), dbw = 60, mw = bw - dbw - 4, bx = Math.round(L + leftW / 2 - bw / 2);
    const cost = isHero ? 0 : G.Team.cost(nm), can = isHero || G.Team.used() + cost <= G.TUNE.plantPoints;
    if (!G.Team.owns(nm)) btnSecondary(c, 'toStore', bx, y, mw, 16, '開寶箱取得', () => go('store'));
    else if (isHero) {
      if (G.HEROES[T.hero].name === nm) btnFlat(c, bx, y, mw, 16, '出戰中', 13);
      else btnPrimary(c, 'pick', bx, y, mw, 16, '設為出戰英雄', () => setHero(nm));
    } else {
      if (can) btnPrimary(c, 'add', bx, y, mw, 16, '＋ 加入' + LANES[G.Team.lane], () => addMinion(nm));
      else btnFlat(c, bx, y, mw, 16, '點數不足', 10);
    }
    btnSecondary(c, 'demo', bx + mw + 4, y, dbw, 16, '技能展示', () => openDemo(nm, 0, null));
    y += 22;
    // 右欄（橫屏）／下方（直屏）：陣容 + 詳細
    let dx = L, dy = y, dw = Rr - L - 6;
    if (LD) { dx = L + leftW + 10; dy = y0; dw = Rr - dx - 6; }
    if (!isHero) dy = lineup(c, dx, dy, dw + 6, can && G.Team.owns(nm) ? cost : 0) + 2;
    scrollDetail(c, dx, dy, dw, B - dy, 'tm' + nm, yy => detail(c, dx, yy, dw, nm, 0, null));
    demoPanel(c);
  };

  // ---------- 圖鑑：同樣的舞台轉盤 ----------
  let btab = 0;
  let bpot = 0;                                          // v2.5 圖鑑上方切換：0 敵人／1 藥水
  M._btab = i => { if (i === 5) bpot = 1; else { bpot = 0; btab = i; } };   // 測試用
  M.book = c => {
    tick(); bg(c); car = cars.book;
    const y0 = header(c, '圖鑑'), I = R.ins, L = I.l, Rr = R.uw - I.r, B = R.uh - I.b, LD = land();
    const WK = Object.keys(G.WILD);
    const lists = [G.ROSTER.bosses, G.ROSTER.smalls, G.ROSTER.towers, WK.map(k => G.WILD[k].unit), G.ROSTER.hunters], list = lists[btab];
    const colW = LD ? Math.min(200, Math.round((Rr - L) * 0.52)) : Rr - L;
    tabs(c, L + 64, R.ins.t, Math.min(120, Rr - L - 70), ['敵人', '藥水'], bpot, i => { if (i === bpot) return; bpot = i; G.Audio.play('tick'); }, 'bk');   // 標題列：敵人／藥水
    let y = bpot ? y0 : tabs(c, L, y0, LD ? colW : Math.min(colW, 220), ['BOSS', '小怪', '塔', '野怪', '獵手'], btab, i => { if (i === btab) return; btab = i; sel.enemy = lists[i][0]; car.pos = car.tgt = 0; car.settled = true; sbKey = ''; skillSel = -1; G.Audio.play('tick'); });
    if (bpot) {                                         // v2.5 藥水一覽：圖示、名稱、價格、效果（可捲動）
      const w = Math.min(Rr - L, LD ? 420 : 300), x = Math.round(L + (Rr - L) / 2 - w / 2), cols = LD && w >= 360 ? 2 : 1, cw = Math.floor((w - (cols - 1) * 6) / cols);
      scrollDetail(c, x, y + 2, w, B - y - 4, 'potions', top => {
        const rows = G.SHOP.map(it => ({ it, ls: G.cnWrap(it.d, cw - 30) })), hs = rows.map(r => 18 + r.ls.length * 13 + 3);
        let yy = top;
        for (let i = 0; i < rows.length; i += cols) {
          const rh = Math.max(...hs.slice(i, i + cols)), vis = yy + rh > y + 2 && yy < B - 2;   // 只畫看得到的列
          for (let j = 0; j < cols && i + j < rows.length && vis; j++) {
            const { it, ls } = rows[i + j], bx = x + j * (cw + 6);
            H().box(c, bx, yy, cw, rh, 0, 4, false); H().icon(c, it.ic, bx + 12, yy + 12);
            const inV = ty => ty >= y + 1 && ty + 12 <= B - 2;   // 捲到一半被裁掉的字不畫
            if (inV(yy + 3)) { G.cn(c, it.n, bx + 24, yy + 3, 9); H().icon(c, 'i_gold', bx + cw - 30, yy + 9); G.text(c, it.cost, bx + cw - 25, yy + 7, 13, 1); }
            ls.forEach((l, k) => { if (inV(yy + 17 + k * 13)) G.cn(c, l, bx + 24, yy + 17 + k * 13, 6); });
          }
          yy += rh + 4;
        }
        return yy;
      });
      return;
    }
    if (!list.includes(sel.enemy)) sel.enemy = list[0];
    if (car.inited !== true) { car.inited = true; car.pos = car.tgt = Math.max(0, list.indexOf(sel.enemy)); }
    const ch = LD ? G.clamp(B - y - 3 - nameplateH(colW, list[G.clamp(Math.round(car.pos), 0, list.length - 1)], 'book') - 18, 60, 118) : G.clamp(Math.round(R.uh * 0.27), 88, 124);
    carousel(c, L, y, colW, ch, list, 'book');
    sel.enemy = list[carIdx()];
    if (car.settled && G.Ach) G.Ach.on('book', sel.enemy);
    const nm = sel.enemy, side = G.ORIG.towers[nm] && /player|mushroom/.test(nm) ? 0 : 1;
    y = nameplate(c, L, y + ch + 3, colW, nm, 'book');
    const bw = Math.min(colW - 16, 110), bx = Math.round(L + colW / 2 - bw / 2), o = pr('demo') ? 1 : 0;
    H().key(c, bx, y + o, bw, 16, o, 7); G.cn(c, '技能展示', bx + bw / 2, y + 2 + o, 9, 0.5);
    tap('demo', bx, y, bw, 16, () => openDemo(nm, side, null));
    y += 22;
    let dx = L, dy = y, dw = Rr - L;
    if (LD) { dx = L + colW + 10; dy = y0; dw = Rr - dx; }
    const wd = btab === 3 ? WILD_OF(nm) : btab === 4 ? { n: '敵方獵手', d: G.HUNTER_INFO, ic: 'i_attack', col: 14, kind: 'hunter', respawn: G.TUNE.jungle.respawn } : null;
    // 野怪：獎勵說明卡
    const cta = wd ? (x, cy, w) => {
      const kind = wd.kind === 'wboss' ? '野生首領' : wd.kind === 'hunter' ? '打野' : '野區小怪', two = G.cnW(wd.n) + G.cnW(kind) + 32 > w, ex = two ? 13 : 0;   // 名稱與類別放不下 → 類別換到下一行
      const lines = G.cnWrap(wd.d, w - 26), hh = 18 + ex + lines.length * 13 + (wd.kind === 'hunter' ? 4 : 15);
      H().box(c, x, cy, w, hh, 0, wd.col, false);
      H().icon(c, wd.ic, x + 10, cy + 10);
      G.cn(c, wd.n, x + 21, cy + 3, 9); if (two) G.cn(c, kind, x + 21, cy + 16, wd.col); else G.cn(c, kind, x + w - 5, cy + 3, wd.col, 1);
      lines.forEach((l, i) => G.cn(c, l, x + 21, cy + 18 + ex + i * 13, 7));
      if (wd.kind !== 'hunter') G.cn(c, '重生 ' + wd.respawn + ' 秒', x + 21, cy + 18 + ex + lines.length * 13 + 1, 4);
      return cy + hh + 6;
    } : null;
    scrollDetail(c, dx, dy, dw - 6, B - dy, btab + nm, yy => detail(c, dx, yy, dw - 6, nm, side, cta, btab === 3 ? 'wild' : 'book'));
    demoPanel(c);
  };

  // ---------- 教學 ----------
  const PADS = {};
  let zoomC = null, gvC = null;
  const GV_W = 168, GV_H = 160, GV_A = 96;   // GV_H：框（正方形）；GV_A：動畫本身的高度（寬螢幕）          // 示範動畫的固定畫布大小
  // 示範場景的背景：上緣一排樹、中間一條小路、散落的草叢（固定位置，不閃動）
  G.stageDeco = (...a) => stage(...a);
  function stage(c, x, y, w, h, z) {
    const tr = G.SPR.trees, hs = (i, k) => G.hash(i * 13 + k, 77);
    c.fillStyle = G.NAT.grL; for (let i = 0; i < Math.round(w * h / (z ? 260 : 520)); i++) { const gx = Math.round(x + hs(i, 1) * w), gy = Math.round(y + h * 0.3 + hs(i, 2) * h * 0.7); c.fillRect(gx, gy, 1, 1); c.fillRect(gx - 1, gy - 1, 1, 1); c.fillRect(gx + 1, gy - 1, 1, 1); }
    c.fillStyle = G.NAT.stD; for (let i = 0; i < Math.round(w / 14); i++) { const gx = Math.round(x + hs(i, 5) * w), gy = Math.round(y + h * 0.35 + hs(i, 6) * h * 0.6); c.fillRect(gx, gy, 2, 1); }
    if (!z) return;
    let tx = x - 6, i = 0; while (tx < x + w + 6) { const s2 = tr[i % tr.length]; c.drawImage(s2.n, Math.round(tx), Math.round(y - s2.h * 0.55 + hs(i, 9) * 3)); tx += s2.w * 0.7 + hs(i, 3) * 6; i++; }
  }
  // 四周壓暗，讓視線集中在中間
  function vign(c, x, y, w, h) { H().dither(c, x, y, w, 3, 0, 0.5); H().dither(c, x, y + h - 4, w, 4, 0, 0.45); H().dither(c, x, y, 3, h, 0, 0.35); H().dither(c, x + w - 3, y, 3, h, 0, 0.35); }
  function key(c, k, x, y, on) { H().box(c, x, y + (on ? 1 : 0), 13, 13, on ? 13 : 1, on ? 13 : 6); G.text(c, k, x + 7, y + 4 + (on ? 1 : 0), on ? 0 : 9, 1, null, 0.5); }
  function hand(c, x, y, down) { if (down) G.pxEllipse(c, x, y, 6, 3, 13); c.drawImage(G.SPR.hand.n, x - 4, y - 1 + (down ? 1 : 0)); }
  function cursor(c, x, y, down) { if (down) G.pxEllipse(c, x, y, 5, 2, 13); c.drawImage(G.SPR.cursor.n, x - 1, y - 1); }
  function shadow(c, x, y, r) { G.pxDisc(c, x, y, r, r * 0.42, 0, 0.55); }
  function unit(c, name, x, y, moving, face = 1, flash) {
    shadow(c, x, y, G.VIS[name].shadow * 0.5);
    const s = G.SPR[G.VIS[name].spr], f = s[moving ? ((gt * 6) | 0) % s.length : 0], z = G.VIS[name].fly ? 13 : 0;
    const img = flash ? (face < 0 ? f.fm : f.f) : G.foeImg(name, face < 0 ? f.m : f.n);
    c.drawImage(img, Math.round(x - f.w / 2), Math.round(y - f.h + 1 - z - (moving && ((gt * 6) | 0) % 2 ? 1 : 0)));
  }
  function moveMark(c, x, y, t) {
    const pr2 = (t * 2.2) % 1;
    G.pxEllipse(c, x, y, 18 * (1 - pr2) + 2, 7 * (1 - pr2) + 1, pr2 > 0.6 ? 15 : 13); G.pxEllipse(c, x, y, 7, 3, 13);
    const ay = Math.round(y - 8 - (t < 0.18 ? (1 - t / 0.18) * 20 : Math.abs(Math.sin((t - 0.18) * 7)) * 3));
    c.fillStyle = P[0]; c.fillRect(x - 2, ay - 9, 5, 6); c.fillRect(x - 5, ay - 4, 11, 2); c.fillRect(x - 4, ay - 2, 9, 1); c.fillRect(x - 3, ay - 1, 7, 1); c.fillRect(x - 2, ay, 5, 1); c.fillRect(x - 1, ay + 1, 3, 1);
    c.fillStyle = P[13]; c.fillRect(x - 1, ay - 8, 3, 5); c.fillRect(x - 4, ay - 3, 9, 1); c.fillRect(x - 3, ay - 2, 7, 1); c.fillRect(x - 2, ay - 1, 5, 1); c.fillRect(x - 1, ay, 3, 1);
  }
  // v2.7 英雄分類：召喚物（紫色外框；look＝'necro' 受控的敵人、'clone' 複製體）
  function sumU(c, name, x, gy, look, mv, face = 1, a = 1) {
    const S = G.SPR[G.VIS[name].spr], f = S[mv ? ((gt * 6) | 0) % S.length : 0], s0 = face < 0 ? f.m : f.n, src = look ? G.rampOf(s0, look) : s0;
    const gl = G.glowOf(src, 17, 1, 2), px = Math.round(x - f.w / 2), py = Math.round(gy - f.h + 1 - (G.VIS[name].fly ? 13 : 0) - (mv && ((gt * 6) | 0) % 2 ? 1 : 0));
    c.globalAlpha = a; shadow(c, x, gy, G.VIS[name].shadow * 0.5);
    c.globalAlpha = a * (0.6 + Math.sin(gt * 5) * 0.25); c.drawImage(gl.c, px - gl.p, py - gl.p);
    c.globalAlpha = a; c.drawImage(src, px, py); c.globalAlpha = 1;
  }
  function unitA(c, name, x, gy, a, mv, face) { c.globalAlpha = a; unit(c, name, x, gy, mv, face); c.globalAlpha = 1; }
  function skBtn(c, x, y, w, ic, cdF, cdN, on) {
    H().key(c, x, y + (on ? 1 : 0), w, w, on, 5); H().icon(c, ic, x + w / 2, y + w / 2 + (on ? 1 : 0), cdF > 0);
    if (cdF > 0) { H().dither(c, x + 1, y + 1 + Math.round((w - 2) * (1 - cdF)), w - 2, Math.round((w - 2) * cdF), 0, 0.7); G.text(c, cdN, x + w / 2, y + w / 2 - 2, 9, 1, 0, 0.5); }
  }
  const lerp = G.lerp, ss = t => t * t * (3 - 2 * t), seg = (t, a, b) => G.clamp((t - a) / (b - a), 0, 1);

  // ---------- 教學內容：分類 × 每頁一個重點 ----------
  // 每頁：t 標題、m 手機說明、d 電腦說明（省略則同 m）、only 只在某平台顯示、draw 示範動畫
  const yBtn = (c, x, y, w, h, label) => { const glow = Math.sin(gt * 6) > 0; c.fillStyle = P[glow ? 13 : 14]; c.fillRect(x - 1, y - 1, w + 2, h + 2); H().box(c, x, y, w, h, 13, 0); G.cn(c, label, x + w / 2, y + Math.round((h - 12) / 2), 0, 0.5); };
  const mCard = (c, x, y, sz, name, on, badge) => { H().key(c, x, y, sz, sz, on, on ? 9 : 4); c.save(); c.beginPath(); c.rect(x + 1, y + 1, sz - 2, sz - 2); c.clip(); sprFit(c, name, x + sz / 2, y + sz - 3, sz - 4, sz - 5); c.restore(); if (badge) { c.fillStyle = P[13]; c.fillRect(x + sz - 7, y + 1, 6, 6); G.text(c, badge, x + sz - 6, y + 1, 0); } };
  const tower = (c, name, x, by, shield, flash) => {
    const s = G.SPR[G.VIS[name].spr][0], ax = Math.round(x - s.w / 2), ay = by - s.h + 1; shadow(c, x, by, 8);
    if (shield) { const gl = G.glowOf(s.n, 12, 1, 5); c.globalAlpha = 0.6 + Math.sin(gt * 3) * 0.25; c.drawImage(gl.c, ax - gl.p, ay - gl.p); c.globalAlpha = 1; }
    c.drawImage(flash ? s.f : s.n, ax, ay);
    if (shield) { c.globalAlpha = 0.15; c.drawImage(G.glowOf(s.n, 12, 1, 5).tint, ax, ay); c.globalAlpha = 1; }
  };
  // 場景頁（z:1）是先畫一半大小再放大 2 倍；文字和介面框若直接畫會跟著變 2 倍、擋住重點
  // → 改用 zcn/ztext/zdraw：先記下來，等放大後再以原尺寸畫在大畫布上（座標 ×2）
  let zL = null;
  const zdraw = (c, fn) => { if (zL) zL.push(fn); else fn(c); };
  const zcn = (c, s2, x, y, col, align = 0) => zdraw(c, g => G.cn(g, s2, Math.round(x * 2), Math.round(y * 2), col, align));
  const ztext = (c, s2, x, y, col, sc = 1, ol = null, align = 0) => zdraw(c, g => G.text(g, s2, Math.round(x * 2), Math.round(y * 2), col, sc, ol, align));
  // 鎖定標示（和戰鬥中相同）：目標腳下的紅色虛線圈＋四個轉動小刻度
  const lockRing = (c, cx, gy, rx0, t) => {
    const k = Math.min(1, t / 0.22), rx = rx0 + (1 - k) * 10, ry = rx * 0.38;
    G.pxEllipse(c, cx, gy, rx, ry, 10, 3, gt * 10);
    for (let i = 0; i < 4; i++) { const a = gt * 1.6 + i * Math.PI / 2, px = Math.round(cx + Math.cos(a) * (rx + 2)), py = Math.round(gy + Math.sin(a) * (ry + 1)); c.fillStyle = P[0]; c.fillRect(px - 1, py - 1, 3, 3); c.fillStyle = P[10]; c.fillRect(px, py, 1, 1); }
  };
  const reticle = (c, cx, cy, r0, t) => {
    const k = Math.min(1, t / 0.25), r = Math.round(r0 + (1 - k) * 16);
    G.pxEllipse(c, cx, cy, r, r, 0); G.pxEllipse(c, cx, cy, r - 1, r - 1, 10);
    for (let i = 0; i < 4; i++) { const a = gt * 1.5 + i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); c.fillStyle = P[0]; G.pxLine(c, cx + ca * (r - 4), cy + sa * (r - 4), cx + ca * (r + 4), cy + sa * (r + 4), 3); c.fillStyle = P[10]; G.pxLine(c, cx + ca * (r - 3), cy + sa * (r - 3), cx + ca * (r + 3), cy + sa * (r + 3), 1); }
  };
  const hpBar = (c, x, y, w, f, col = 9) => { c.fillStyle = P[0]; c.fillRect(x - 1, y - 1, w + 2, 3); c.fillStyle = P[col]; c.fillRect(x, y, Math.round(w * f), 1); };
  const ptr = (dk) => dk ? cursor : hand;
  // 小地圖示意
  function miniMap(c, x, y, w, h, hl) {
    const md = G.MAPS.lanes5, sx = w / md.w, sy = h / md.h, P2 = p => [x + p[0] * sx, y + p[1] * sy];
    H().box(c, x - 2, y - 2, w + 4, h + 4, 1, 4, false);
    md.lanes.forEach((l, i) => { const lit = hl === i || (hl === 'path' && i >= 3); c.fillStyle = P[lit ? 13 : i >= 3 ? 4 : 6]; for (let k = 0; k < l.pts.length - 1; k++) { const a = P2(l.pts[k]), b = P2(l.pts[k + 1]); G.pxLine(c, a[0], a[1], b[0], b[1], i >= 3 ? 1 : 3); } });
    if (md.river) { c.fillStyle = P[hl === 'river' ? 12 : 2]; for (let k = 0; k < md.river.pts.length - 1; k++) { const a = P2(md.river.pts[k]), b = P2(md.river.pts[k + 1]); G.pxLine(c, a[0], a[1], b[0], b[1], hl === 'river' ? 3 : 2); } }
    if (md.wild && (hl === 'wild' || hl === 'river')) md.wild.forEach(([k2, p]) => { const q = P2(p), d = G.WILD[k2], big = d.kind === 'wboss'; c.fillStyle = P[0]; c.fillRect(q[0] - (big ? 3 : 2), q[1] - (big ? 3 : 2), big ? 6 : 4, big ? 6 : 4); c.fillStyle = P[d.col]; c.fillRect(q[0] - (big ? 2 : 1), q[1] - (big ? 2 : 1), big ? 4 : 2, big ? 4 : 2); });
    const ph = P2(md.holy.player), eh = P2(md.holy.enemy);
    c.fillStyle = P[0]; c.fillRect(ph[0] - 3, ph[1] - 3, 7, 7); c.fillRect(eh[0] - 3, eh[1] - 3, 7, 7); c.fillStyle = P[9]; c.fillRect(ph[0] - 2, ph[1] - 2, 5, 5); c.fillStyle = P[2]; c.fillRect(eh[0] - 2, eh[1] - 2, 5, 5);
    if (hl === 'tower') { md.towers3.player.forEach(([p]) => { const q = P2(p); c.fillStyle = P[0]; c.fillRect(q[0] - 2, q[1] - 2, 4, 4); c.fillStyle = P[9]; c.fillRect(q[0] - 1, q[1] - 1, 2, 2); }); md.towers3.enemy.forEach(([p]) => { const q = P2(p); c.fillStyle = P[0]; c.fillRect(q[0] - 2, q[1] - 2, 4, 4); c.fillStyle = P[4]; c.fillRect(q[0] - 1, q[1] - 1, 2, 2); }); }
    return { P2 };
  }
  const CATS = [
    {
      name: '操作', pages: [
        {
          z: 1, t: '移動', m: '{點一下地面}，英雄就會走過去', d: '滑鼠{左鍵點一下地面}，英雄就會走過去',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.4, gy = y + Math.round(h * 0.7), x0 = x + w * 0.24, x1 = x + w * 0.7, k = ss(seg(T, 0.95, 2.4)), hx = lerp(x0, x1, k);
            if (T > 0.8 && T < 2.6) moveMark(c, Math.round(x1), gy, T - 0.8);
            unit(c, 'leafy', hx, gy, k > 0 && k < 1);
            const pk = ss(seg(T, 0.15, 0.7));
            if (T < 1.4) ptr(dk)(c, Math.round(lerp(x + w * 0.92, x1, pk)), Math.round(lerp(y + h * 0.98, gy, pk)), T > 0.7 && T < 0.9);
          }
        },
        {
          t: '鍵盤移動', only: 'd', d: '也可以用 {W A S D} 直接控制移動',
          draw(c, x, y, w, h, t) {
            const T = t % 4, dir = [[0, -1], [-1, 0], [0, 1], [1, 0]][(T | 0)], f = T % 1, gy = y + h * 0.62, cx = x + w * 0.62;
            unit(c, 'leafy', cx + dir[0] * f * 26, gy + dir[1] * f * 14, true, dir[0] < 0 ? -1 : 1);
            const on = (T | 0); key(c, 'W', x + 24, y + 8, on === 0); key(c, 'A', x + 9, y + 23, on === 1); key(c, 'S', x + 24, y + 23, on === 2); key(c, 'D', x + 39, y + 23, on === 3);
          }
        },
        {
          z: 1, t: '移動視角', m: '{單指}在畫面上{滑動}，可以查看地圖其他地方', d: '{按住滑鼠左鍵拖曳}，可以移動視角',
          // 整個場景（地面、樹叢、塔）一起平移：左邊是英雄，滑過去看到右邊的敵塔
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.4, k = ss(seg(T, 0.4, 1.7)) - ss(seg(T, 2.4, 3.2)), off = Math.round(k * w * 0.5), W2 = Math.ceil(w * 1.6);
            c.drawImage(G.groundStrip(W2, h), Math.round(x - off), y); stage(c, x - off, y, W2, h, true);
            unit(c, 'leafy', Math.round(x + w * 0.3 - off), Math.round(y + h * 0.8), false);
            tower(c, 'enemy_tower', Math.round(x + w * 1.22 - off), Math.round(y + h * 0.84));
            const px = x + w * 0.78 - k * w * 0.5, py = Math.round(y + h * 0.5);
            if (T > 0.2 && T < 1.9) { ptr(dk)(c, Math.round(px), py, true); c.fillStyle = P[13]; for (let i = 1; i < 4; i++) c.fillRect(Math.round(px + 3 + i * 4), py + 2, 2, 1); }
          }
        },
        {
          t: '縮放畫面', m: '{雙指撥開}放大，{捏合}縮小', d: '{滾動滑鼠滾輪}，放大或縮小畫面',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4, z = T < 2 ? ss(seg(T, 0.3, 1.6)) : 1 - ss(seg(T, 2.2, 3.5)), sc = 1 + z, cx = x + w / 2, gy = y + h * 0.5 + h * 0.2 * sc;
            const s = G.SPR.leafy[0], dw = s.w * Math.round(sc), dh = s.h * Math.round(sc);
            c.drawImage(s.n, Math.round(cx - dw / 2), Math.round(gy - dh), dw, dh);
            if (dk) { cursor(c, Math.round(x + w * 0.72), Math.round(y + h * 0.4), false); c.fillStyle = P[13]; const up = T < 2, ax = Math.round(x + w * 0.72 + 12), ay = Math.round(y + h * 0.4); for (let i = 0; i < 4; i++) c.fillRect(ax - i, ay + (up ? i : 3 - i), i * 2 + 1, 1); }
            else { const d = 10 + z * 22; hand(c, Math.round(cx - d), Math.round(y + h * 0.55 + d * 0.4), false); hand(c, Math.round(cx + d - 6), Math.round(y + h * 0.55 - d * 0.4), false); }
          }
        },
        {
          t: '回到英雄', m: '按右下大招上方的{準心按鈕}，鏡頭回到英雄', d: '按 {C} 鍵，或按右下大招上方的{準心按鈕}，鏡頭回到英雄',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3, k = T < 1.2 ? 1 : 1 - ss(seg(T, 1.2, 1.7)), hx = x + w / 2 - k * w * 0.45;
            unit(c, 'leafy', hx, y + h * 0.55, false);
            const press = T > 0.9 && T < 1.2, bw = 18, ux = x + w - bw - 4, uy = y + h - bw - 4;
            for (let i = 0; i < 3; i++) skBtn(c, ux - i * (bw + 3), uy, bw, ['i_meteor', 'i_bolt', 'i_mistic'][i], 0, 0, false);
            const cx2 = ux + 1, cy2 = uy - 20;
            H().key(c, cx2, cy2 + (press ? 1 : 0), 16, 16, press, 9); H().icon(c, 'i_center', cx2 + 8, cy2 + 8 + (press ? 1 : 0));
            if (dk) key(c, 'C', x + 8, y + h - 20, press);
            else if (T < 1.4) hand(c, cx2 + 8, Math.round(lerp(y + h * 0.6, cy2 + 8, ss(seg(T, 0.3, 0.9)))), press);
          }
        },
        {
          z: 1, t: '傳送', m: '{連點我方的塔兩下}就傳送（3 秒）；跟隨的小兵也會一起，{每 30 秒一次}', d: '{左鍵連點我方的塔兩下}就傳送（3 秒）；跟隨的小兵也會一起，{每 30 秒一次}',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 5, gy = y + Math.round(h * 0.78), tx = x + w * 0.78, done = T > 3.6;
            if (T > 0.55 && T < 0.95) { const pr2 = (T * 2) % 1; G.pxEllipse(c, tx, gy - 6, 12 + pr2 * 5, 4 + pr2 * 2, 13); }   // 第一下：提示再點一下
            tower(c, 'player_tower', tx, gy - 6, false);
            const hx = done ? tx - 22 : x + w * 0.2, mx = done ? tx - 36 : x + w * 0.12;
            if (T > 0.8 && T < 3.6) { const k = (T - 0.8) / 2.8; G.pxEllipse(c, tx, gy - 6, 20 - k * 10, 7 - k * 3, 13); for (let i2 = 0; i2 < 4; i2++) { c.fillStyle = P[13]; c.fillRect(Math.round(hx - 6 + ((t * 40 + i2 * 9) % 12)), Math.round(gy - 4 - ((t * 30 + i2 * 7) % 16)), 1, 1); } zdraw(c, g => { const X = Math.round((x + w / 2) * 2); H().box(g, X - 30, y * 2 + 4, 60, 14, 0, 13); G.cn(g, '傳送中', X - 25, y * 2 + 4, 13); hpBar(g, X + 12, y * 2 + 10, 14, k, 9); }); }
            if (T > 3.6 && T < 4.1) G.pxEllipse(c, hx, gy, 6 + (T - 3.6) * 40, 3 + (T - 3.6) * 14, 13);
            unit(c, 'leafy', hx, gy, false); unit(c, 'leafblower', mx, gy + 4, false);
            const fx = Math.round(mx), fy = Math.round(gy + 4 - 22); c.fillStyle = P[0]; c.fillRect(fx - 2, fy - 8, 7, 5); c.fillRect(fx - 2, fy - 8, 3, 10); c.fillStyle = P[9]; c.fillRect(fx - 1, fy - 7, 1, 8); c.fillStyle = P[13]; c.fillRect(fx, fy - 7, 4, 3);
            if (T < 1) ptr(dk)(c, Math.round(lerp(x + w * 0.5, tx, ss(seg(T, 0.1, 0.45)))), Math.round(lerp(y + h, gy - 18, ss(seg(T, 0.1, 0.45)))), (T > 0.45 && T < 0.55) || (T > 0.75 && T < 0.85));
            if (done) ztext(c, '30', x + 6, y + 4, 13, 1, 0);
          }
        },
        {
          t: '暫停', m: '按右上角的{暫停按鈕}，可以繼續、看教學、重新開始、調整音量或回首頁', d: '按 {Esc} 或右上角的{暫停按鈕}，可以繼續、看教學、重新開始、調整音量或回首頁',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.6, on = T > 1;
            unit(c, 'leafy', x + w * 0.3, y + h * 0.8, !on); unit(c, 'babybear', x + w * 0.62, y + h * 0.8, !on, -1);
            if (on) {
              H().dither(c, x, y, w, h, 0, 0.6);
              const items = [['i_play', '繼續'], ['i_guide', '教學'], ['i_retry', '重新開始'], ['i_tree', '回首頁'], ['i_music', '音量']], bw = Math.max(...items.map(q => G.cnW(q[1]))) + 30;
              const n = h < 110 ? 3 : 5, bh = 16, bx = Math.round(x + w / 2 - bw / 2), by0 = Math.round(y + h / 2 - n * (bh + 3) / 2);
              items.slice(0, n).forEach(([ic, lab], i) => { const yy = by0 + i * (bh + 3); H().box(c, bx, yy, bw, bh, 1, i ? 7 : 13); H().icon(c, ic, bx + 9, yy + 8); G.cn(c, lab, bx + 19, yy + 2, i ? 9 : 13); });
            }
            if (dk) { const on2 = T > 0.8 && T < 1.1; H().box(c, x + w - 30, y + 6 + (on2 ? 1 : 0), 23, 13, on2 ? 13 : 1, on2 ? 13 : 6); G.text(c, 'ESC', x + w - 18.5, y + 10 + (on2 ? 1 : 0), on2 ? 0 : 9, 1, null, 0.5); }
            else if (!on) { H().box(c, x + w - 20, y + 6, 14, 12, 1, 5); H().icon(c, 'i_pause', x + w - 13, y + 12); hand(c, x + w - 13, Math.round(lerp(y + h * 0.6, y + 12, ss(seg(T, 0.2, 0.8)))), T > 0.8); }
          }
        },
        {
          t: '音量', m: '首頁「{設定}」或戰鬥中{暫停}，左右拖動滑桿就能{分別調整音樂和音效}的音量',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4, sw = Math.min(w - 24, 130), sx = Math.round(x + w / 2 - sw / 2), y0 = Math.round(y + h / 2 - 20);
            const vm = T < 1 ? 1 : T < 2 ? 1 - (T - 1) * 0.6 : 0.4, vs = T < 2.2 ? 0.8 : T < 3 ? 0.8 - (T - 2.2) * 0.5 : 0.4;
            H().box(c, sx - 4, y0 - 4, sw + 8, 46, 1, 4, false);
            [['i_music', '音樂', vm], ['i_sound', '音效', vs]].forEach(([ic, lab, v], i) => {
              const yy = y0 + i * 20, lw = 18 + G.cnW(lab) + 6, tx = sx + lw, tw = sw - lw - 26;
              H().icon(c, ic, sx + 6, yy + 9); G.cn(c, lab, sx + 14, yy + 3, 9);
              G.bar3d(c, tx, yy + 7, tw, 4, v, 13); H().key(c, Math.round(tx + tw * v - 3), yy + 3, 7, 11, false, 13, 13, G.tint(14, -0.5));
              G.text(c, Math.round(v * 100) + '%', sx + sw, yy + 7, 9, 1, null, 1);
              const act = i === 0 ? T > 0.8 && T < 2.1 : T > 2.0 && T < 3.1;
              if (act) ptr(dk)(c, Math.round(tx + tw * v), yy + 9, true);
            });
          }
        },
        {
          t: '大地圖', m: '按小地圖下方的{展開按鈕}打開大地圖；{點地圖上任一處}，鏡頭就移過去',
          d: '按小地圖下方的{展開按鈕}打開大地圖；{點地圖上任一處}，鏡頭就移過去',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4.2, open = T > 1.1 && T < 3.6;
            const mw = 40, mh = 30, mx = x + w - mw - 4, my = y + 4;
            H().box(c, mx - 2, my - 2, mw + 4, mh + 4, 1, 6); miniMap(c, mx, my, mw, mh);
            const ex = mx + mw - 14, ey = my + mh + 4; H().key(c, ex, ey, 14, 12, open, open ? 13 : 5);
            c.fillStyle = P[open ? 13 : 8]; for (const [ax, ay, sx2, sy2] of [[ex + 3, ey + 2, 1, 1], [ex + 10, ey + 2, -1, 1], [ex + 3, ey + 9, 1, -1], [ex + 10, ey + 9, -1, -1]]) { c.fillRect(Math.min(ax, ax + sx2 * 2), ay, 3, 1); c.fillRect(ax, Math.min(ay, ay + sy2 * 2), 1, 3); }
            if (open) {
              H().dither(c, x, y, w, h, 0, 0.7);
              const bw = Math.min(w - 16, Math.round((h - 20) * 4 / 3)), bh = Math.round(bw * 3 / 4), bx = Math.round(x + w / 2 - bw / 2), by = Math.round(y + h / 2 - bh / 2);
              H().box(c, bx - 2, by - 2, bw + 4, bh + 4, 1, 7); miniMap(c, bx, by, bw, bh, 'path');
              if (T > 2.4 && T < 3.6) hand(c, Math.round(bx + bw * 0.62), Math.round(by + bh * 0.4), T > 3.0 && T < 3.3);
            }
            if (T < 1.2) ptr(dk)(c, ex + 7, Math.round(lerp(y + h, ey + 6, ss(seg(T, 0.2, 0.8)))), T > 0.85 && T < 1.1);
          }
        }
      ]
    },
    {
      name: '戰鬥', pages: [
        {
          z: 1, t: '自動攻擊', m: '敵人進入{w:白色圈圈}，英雄會{自動攻擊}',
          draw(c, x, y, w, h, t) {
            const T = t % 4.2, gy = y + Math.round(h * 0.68), hx = x + w * 0.3, rw = Math.min(w * 0.36, 74);
            const bx = lerp(x + w + 12, x + w * 0.3 + rw * 0.8, ss(seg(T, 0, 1.6))), inside = bx - hx < rw + 2;
            G.pxEllipse(c, hx, gy, rw, rw * 0.42, inside ? 9 : 6, inside ? 0 : 6, t * 6);
            unit(c, 'leafy', hx, gy, false);
            const shot = inside ? ((T - 1.3) % 0.8) : -1;
            unit(c, 'babybear', bx, gy, T < 1.6, -1, shot >= 0 && shot < 0.08);
            if (inside && shot >= 0.4) { const k = (shot - 0.4) / 0.4, s = G.SPR.magicball; c.drawImage(s.n, Math.round(lerp(hx + 6, bx, k) - 3), Math.round(gy - 8 - Math.sin(k * Math.PI) * 6 - 3)); }
          }
        },
        {
          z: 1, t: '攻擊順序', m: '自動攻擊會優先打{血量最少}的敵人',
          draw(c, x, y, w, h, t) {
            const gy = y + h * 0.68, hx = x + w * 0.25, e1 = x + w * 0.62, e2 = x + w * 0.78, T = t % 0.9;
            unit(c, 'leafy', hx, gy, false);
            unit(c, 'bear', e1, gy - 12, false, -1); hpBar(c, e1 - 6, gy - 30, 12, 0.9, 7);
            unit(c, 'babybear', e2, gy + 10, false, -1, T < 0.08); hpBar(c, e2 - 5, gy - 2, 10, 0.25, 7);
            c.fillStyle = P[9]; const ax = Math.round(e2), ay = Math.round(gy - 10 - Math.abs(Math.sin(t * 6)) * 2); c.fillRect(ax - 3, ay, 7, 1); c.fillRect(ax - 2, ay + 1, 5, 1); c.fillRect(ax - 1, ay + 2, 3, 1); c.fillRect(ax, ay + 3, 1, 1);
            if (T > 0.4) { const k = (T - 0.4) / 0.5, s = G.SPR.magicball; c.drawImage(s.n, Math.round(lerp(hx + 6, e2, k) - 3), Math.round(lerp(gy - 8, gy + 4, k) - Math.sin(k * Math.PI) * 6)); }
          }
        },
        {
          z: 1, t: '鎖定目標', m: '{點一下敵人或塔}就會鎖定，英雄會一直追打；右上角會顯示{r:目標血量}', d: '{左鍵點敵人或塔}就會鎖定，英雄會一直追打；右上角會顯示{r:目標血量}',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4, gy = y + h * 0.8, tx = x + w * 0.72, k = ss(seg(T, 1.0, 2.0)), hx = lerp(x + w * 0.15, x + w * 0.42, k);
            if (T > 0.75) lockRing(c, Math.round(tx), Math.round(gy), 12, T - 0.75);
            tower(c, 'enemy_tower', tx, gy, false, T > 2.2 && ((T * 10) | 0) % 4 === 0);
            unit(c, 'leafy', hx, y + h * 0.75, k > 0 && k < 1);
            if (T > 0.75) zdraw(c, g => { const px2 = (x + w) * 2 - 50, Y = y * 2; H().box(g, px2, Y + 4, 46, 16, 0, 10); const ts = G.SPR.etower[0]; g.save(); g.beginPath(); g.rect(px2 + 1, Y + 5, 14, 14); g.clip(); g.drawImage(ts.n, px2 + 1, Y + 5, Math.round(ts.w * 14 / ts.h), 14); g.restore(); hpBar(g, px2 + 18, Y + 11, 24, T > 2.2 ? 1 - (T - 2.2) * 0.3 : 1, 10); });
            if (T < 1.1) ptr(dk)(c, Math.round(lerp(x + w * 0.95, tx, ss(seg(T, 0.1, 0.6)))), Math.round(lerp(y + h, gy - 18, ss(seg(T, 0.1, 0.6)))), T > 0.6 && T < 0.8);
            if (T > 2.2 && ((T - 2.2) % 0.7) > 0.3) { const q = ((T - 2.2) % 0.7 - 0.3) / 0.4, s = G.SPR.magicball; c.drawImage(s.n, Math.round(lerp(hx + 6, tx, q) - 3), Math.round(lerp(y + h * 0.75 - 8, gy - 20, q) - Math.sin(q * Math.PI) * 8)); }
          }
        },
        {
          z: 1, t: '解除鎖定', m: '{點一下地面}改為移動，鎖定就會{解除}',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.4, gy = y + h * 0.75, tx = x + w * 0.75;
            if (T < 0.9) lockRing(c, Math.round(tx), Math.round(y + h * 0.8), 12, 1);
            tower(c, 'enemy_tower', tx, y + h * 0.8);
            const k = ss(seg(T, 1.1, 2.5)), hx = lerp(x + w * 0.4, x + w * 0.15, k);
            if (T > 0.9 && T < 2.6) moveMark(c, Math.round(x + w * 0.15), gy, T - 0.9);
            unit(c, 'leafy', hx, gy, k > 0 && k < 1, -1);
            if (T < 1.2) ptr(dk)(c, Math.round(lerp(x + w * 0.5, x + w * 0.15, ss(seg(T, 0.2, 0.8)))), Math.round(lerp(y + h, gy, ss(seg(T, 0.2, 0.8)))), T > 0.8 && T < 1.0);
          }
        },
        {
          z: 1, t: '召集小兵', m: '{點我方小兵}，牠會跟在英雄後方、打同一個目標；{再點一次解除}，右下{黃旗鈕}可一次全部解散', d: '{左鍵點我方小兵}，牠會跟著英雄打同一個目標；{再點一次解除}',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 5, gy = y + Math.round(h * 0.68), on = T > 0.9 && T < 4.3, k = ss(seg(T, 1.4, 2.6));
            const hx = lerp(x + w * 0.22, x + w * 0.5, k), mx = lerp(x + w * 0.34, x + w * 0.62, ss(seg(T, 1.55, 2.8))) - (T < 0.9 ? 0 : 0), ex = x + w * 0.86;
            unit(c, 'babybear', ex, gy, false, -1, T > 3 && ((t * 10) | 0) % 3 === 0);
            unit(c, 'leafy', hx, gy - 6, k > 0 && k < 1);
            unit(c, 'leafblower', mx, gy + 6, T > 1.55 && T < 2.8);
            if (on) { const fx = Math.round(mx), fy = Math.round(gy + 6 - 22 - (((t * 3) | 0) % 2)); c.fillStyle = P[0]; c.fillRect(fx - 2, fy - 8, 7, 5); c.fillRect(fx - 2, fy - 8, 3, 10); c.fillStyle = P[9]; c.fillRect(fx - 1, fy - 7, 1, 8); c.fillStyle = P[13]; c.fillRect(fx, fy - 7, 4, 3); }
            if (T > 0.9 && T < 1.3) G.pxEllipse(c, mx, gy + 6, 6 + (T - 0.9) * 30, 3 + (T - 0.9) * 12, 13);
            if (T > 3 && T < 4.3 && ((T * 3) % 1) > 0.4) { const q = ((T * 3) % 1 - 0.4) / 0.6, s2 = G.SPR.magicball; c.drawImage(s2.n, Math.round(lerp(hx + 6, ex, q) - 3), Math.round(gy - 14 - Math.sin(q * Math.PI) * 6)); c.fillStyle = P[9]; c.fillRect(Math.round(lerp(mx + 6, ex - 6, q)), gy, 2, 1); }
            zcn(c, T > 4.3 ? '解除跟隨' : on ? '跟隨中' : '', x + w / 2, y + 2, on ? 13 : 7, 0.5);
            const tp = T < 0.9 ? [lerp(x + w * 0.5, mx, ss(seg(T, 0.1, 0.7))), lerp(y + h, gy + 2, ss(seg(T, 0.1, 0.7)))] : T > 3.7 && T < 4.4 ? [mx, gy + 2] : null;
            if (tp) ptr(dk)(c, Math.round(tp[0]), Math.round(tp[1]), (T > 0.7 && T < 0.9) || (T > 4.1 && T < 4.3));
          }
        },
        {
          t: '施放技能', m: '右下角一排技能按鈕，{點一下施放}；{最右邊是大招}', d: '按 {Q／E／R} 施放技能',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.6, gy = y + Math.round(h * 0.68), hx = x + w * 0.16, bx = x + w * 0.52;
            unit(c, 'leafy', hx, gy, false);
            const f = seg(T, 1.0, 1.45), hit = T > 1.45 && T < 1.8;
            unit(c, 'babybear', bx, gy, false, -1, hit);
            if (f > 0 && f < 1) { const s = G.SPR.mistic[0]; c.drawImage(s.n, Math.round(lerp(hx + 8, bx, f) - s.w / 2), gy - 12); }
            if (hit) { const k = (T - 1.45) / 0.35; G.pxEllipse(c, bx, gy - 6, 4 + k * 16, 4 + k * 16, 9); }
            const bw = 22, gap = 5, bx0 = x + w - 6 - 3 * bw - 2 * gap, by = y + h - bw - 6, press = T > 0.75 && T < 0.95;
            ['i_mistic', 'i_slam', 'i_meteor'].forEach((ic, i) => { skBtn(c, bx0 + i * (bw + gap), by, bw, ic, 0, 0, i === 0 && press); if (dk) key(c, 'QER'[i], bx0 + i * (bw + gap) + 5, by - 17, i === 0 && press); });
            if (!dk && T < 1.2) hand(c, bx0 + bw / 2, Math.round(lerp(y + h + 6, by + bw / 2, ss(seg(T, 0.2, 0.75)))), press);
          }
        },
        {
          t: '技能冷卻', m: '施放後按鈕會變暗，中間數字是{剩餘秒數}',
          draw(c, x, y, w, h, t) {
            const T = t % 4.4, cd = T < 0.4 ? 0 : Math.max(0, 1 - (T - 0.4) / 4), bw = 34, bx = Math.round(x + w / 2 - bw / 2), by = Math.round(y + h / 2 - bw / 2);
            skBtn(c, bx, by, bw, 'i_mistic', cd, Math.ceil(cd * 4), false);
            if (cd <= 0 && T > 1) { G.pxEllipse(c, bx + bw / 2, by + bw / 2, bw / 2 + 3, bw / 2 + 3, 9); }
          }
        },
        {
          t: '魔力 MP', m: '按鈕右下的數字是 {g:MP 消耗}，{g:MP} 不夠時按鈕會變暗',
          draw(c, x, y, w, h, t) {
            const T = t % 4, mp = T < 2 ? 0.25 : Math.min(1, 0.25 + (T - 2) * 0.5), ok = mp * 150 >= 120, bw = 30, bx = Math.round(x + w / 2 + 10), by = Math.round(y + h / 2 - bw / 2);
            G.cn(c, 'MP', x + w * 0.12, y + h / 2 - 6, 11); c.fillStyle = P[0]; c.fillRect(Math.round(x + w * 0.12) + 22, Math.round(y + h / 2 - 2), 52, 5); c.fillStyle = P[11]; c.fillRect(Math.round(x + w * 0.12) + 23, Math.round(y + h / 2 - 1), Math.round(50 * mp), 3);
            H().box(c, bx, by, bw, bw, 1, ok ? 9 : 5); H().icon(c, 'i_meteor', bx + bw / 2, by + bw / 2, !ok); G.text(c, '120', bx + bw - 2, by + bw - 7, ok ? 11 : 4, 1, 0, 1);
          }
        },
        {
          t: '金幣與商店', m: '戰鬥中會持續得到金幣，{擊殺與推塔得更多}；點左下{商店}購買藥水', d: '戰鬥中會持續得到金幣，{擊殺與推塔得更多}；按 {B} 開商店購買藥水',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4.4, bx = x + 8, by = y + h - 28, gold = Math.floor(120 + T * 30), open = T > 1 && T < 2.6, bought = T > 2.2;
            H().box(c, bx, by + (T > 0.8 && T < 1 ? 1 : 0), 24, 22, 1, open ? 13 : 5); H().icon(c, 'i_shop', bx + 12, by + 8); G.text(c, bought ? gold - 150 : gold, bx + 12, by + 15, 13, 1, null, 0.5);
            if (bought) { H().box(c, bx + 27, by + 2, 18, 18, 1, 4); H().icon(c, 'p_pow', bx + 36, by + 10); }
            if (open) {
              const pw = Math.min(w - 16, 130), px = Math.round(x + w - pw - 8), py = y + 6, iz = Math.min(26, Math.floor((pw - 10 - 9) / 4));   // 格子大小依面板寬度
              H().box(c, px, py, pw, iz + 24, 1, 7); G.cn(c, '商店', px + 5, py + 3, 9);
              ['i_hp', 'i_mp', 'p_spd', 'p_pow'].forEach((ic, i) => { const on = i === 3, xx = px + 5 + i * (iz + 3); H().box(c, xx, py + 18, iz, iz, on ? 2 : 1, on ? 13 : 4); H().icon(c, ic, xx + iz / 2, py + 18 + iz / 2); });
            }
            if (dk) key(c, 'B', bx + 6, by - 16, T > 0.8 && T < 1);
            else if (T < 1.1) hand(c, bx + 12, Math.round(lerp(y + h + 8, by + 11, ss(seg(T, 0.1, 0.7)))), T > 0.8 && T < 1);
          }
        },
        {
          t: '使用道具', m: '藥水排在{左側滾輪}，滑動切換、{點中間亮黃那格}使用；閒置會自動縮小', d: '用滾輪或拖曳切換{左側藥水}，{點中間亮黃那格}使用；閒置會自動縮小',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4, gy = y + Math.round(h * 0.62), hx = x + w * 0.7, used = T > 2.3, f = !used ? 0.3 : lerp(0.3, 1, ss(seg(T, 2.3, 2.7)));
            unit(c, 'leafy', hx, gy, false); hpBar(c, hx - 12, gy - 23, 24, f, 10);
            const items = [['i_mp', '+MP'], ['i_hp', '+HP'], ['p_spd', '+攻速']], pos = ss(seg(T, 0.6, 1.4)), bx = x + 8, cy = y + h / 2 - 2, pw = 52;
            c.save(); c.beginPath(); c.rect(bx - 3, cy - 28, pw + 10, 56); c.clip();
            items.forEach(([ic, n], i) => {
              const d = i - pos, ad = Math.abs(d); if (ad > 1.6) return;
              const ctr = ad < 0.5, yy = Math.round(cy - 8 + d * 18), o = ctr && T > 2.1 && T < 2.3 ? 1 : 0, xx = bx + Math.round(Math.min(1, ad) * 3);
              H().box(c, xx, yy + o, pw - Math.round(Math.min(1, ad) * 3), 16, ctr ? 1 : 0, ctr ? 13 : 3, ctr); H().icon(c, ic, xx + 8, yy + 7 + o); G.cn(c, n, xx + 18, yy + 2 + o, ctr ? 9 : 7);
              if (!ctr) { c.fillStyle = 'rgba(12,12,12,' + Math.min(0.42, ad * 0.3).toFixed(3) + ')'; c.fillRect(xx, yy, pw, 16); }
            });
            c.restore();
            c.fillStyle = P[13]; for (let k = 0; k < 3; k++) c.fillRect(bx + pw + 2 + k, cy - 3 + k, 1, 5 - k * 2);
            if (T > 0.3 && T < 1.5) { const fy = Math.round(lerp(cy + 18, cy - 8, ss(seg(T, 0.6, 1.4)))); dk ? cursor(c, bx + 30, fy, true) : hand(c, bx + 30, fy, true); }
            else if (T > 1.7 && T < 2.4) ptr(dk)(c, bx + 22, Math.round(cy + 2), T > 2.1 && T < 2.3);
          }
        },
        {
          z: 1, t: '鑰匙掉落', m: '擊倒敵人、塔或野怪{有機率掉鑰匙}，自動飛進左上角；{小兵擊倒的機率減半}',
          draw(c, x, y, w, h, t) {
            const T = t % 3.2, gy = y + h * 0.72, ex = x + w * 0.66, kx = x + 14, ky = y + 10;
            unit(c, 'leafy', x + w * 0.3, gy, false);
            if (T < 0.8) unit(c, 'babybear', ex, gy, false, -1, ((t * 12) | 0) % 2 === 0);
            const s = G.SPR.i_key; zdraw(c, g => { const KX = kx * 2, KY = ky * 2; g.fillStyle = P[0]; g.fillRect(KX - 8, KY - 5, 34, 10); H().icon(g, 'i_key', KX, KY); G.text(g, 'X' + (T > 2.1 ? 1 : 0), KX + 8, KY - 3, T > 2.1 && T < 2.4 ? 9 : 13, 1); });
            if (T > 0.8 && T < 2.1) {
              let px, py, sc = 2;
              if (T < 1.35) { const e = (T - 0.8) / 0.55; px = ex; py = gy - 12 - e * 18; G.pxEllipse(c, ex, gy, 4 + e * 10, 2 + e * 3, 13); }
              else { const f = (T - 1.35) / 0.75, e = f * f; px = lerp(ex, kx, e); py = lerp(gy - 30, ky, e) - Math.sin(f * Math.PI) * 20; sc = 2 - f; }
              const sp = Math.abs(Math.cos(T * 9)) * 0.8 + 0.2; c.save(); c.translate(Math.round(px), Math.round(py)); c.scale(sc * sp, sc); c.drawImage(s.n, -s.w / 2, -s.h / 2); c.restore();
            }
          }
        },
        {
          t: '技能升級', m: '升級得到{技能點}，點技能上方的{黃色＋}升級（{最高 3 級}），畫面會顯示變強多少', d: '升級得到{技能點}，點技能上方的{黃色＋}升級（{最高 3 級}），畫面會顯示這一級變強多少；按 {U} 自動配點',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.6, bw = 30, bx = Math.round(x + w / 2 - bw / 2), by = Math.round(y + h / 2 - bw / 2 + 6), lv = T > 1.4 ? 2 : 1;
            H().box(c, bx, by, bw, bw, 1, 5); H().icon(c, 'i_mistic', bx + bw / 2, by + bw / 2);
            for (let k = 0; k < 3; k++) { c.fillStyle = P[0]; c.fillRect(bx + 2 + k * 3, by + 2, 3, 3); c.fillStyle = P[k < lv ? 13 : 3]; c.fillRect(bx + 3 + k * 3, by + 3, 2, 1); }
            if (T < 1.4) { const ux = bx + bw / 2 - 5, uy = by - 13 + Math.round(Math.sin(gt * 6)); c.fillStyle = P[0]; c.fillRect(ux - 1, uy - 1, 12, 12); c.fillStyle = P[13]; c.fillRect(ux, uy, 10, 10); c.fillStyle = P[0]; c.fillRect(ux + 4, uy + 2, 2, 6); c.fillRect(ux + 2, uy + 4, 6, 2); }
            else G.cn(c, '傷害 70 → 95', x + w / 2, by + bw + 6, 13, 0.5);
            if (!dk && T < 1.5) ptr(dk)(c, bx + bw / 2, Math.round(lerp(y + h + 6, by - 8, ss(seg(T, 0.2, 1)))), T > 1.1 && T < 1.4);
            if (dk) key(c, 'U', bx - 22, by + 8, T > 1.1 && T < 1.4);
          }
        },
        {
          t: '技能說明', m: '{長按}任何技能（被動技也是長按）會跳出{資訊卡}，用動畫示範效果並列出數值；放開就關閉', d: '{按住}技能按鈕不放（被動技也是），會跳出{資訊卡}，用動畫示範效果並列出數值',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.6, bw = 22, bx = Math.round(x + w - bw - 8), by = Math.round(y + h - bw - 6), hold = T > 0.6 && T < 3.0;
            H().box(c, bx, by + (hold ? 1 : 0), bw, bw, 0, 5); H().icon(c, 'i_mistic', bx + bw / 2, by + bw / 2 + (hold ? 1 : 0));
            if (hold && T > 0.95) {
              const cw = Math.min(w - 20, 110), ch = 72, cx = Math.max(x + 4, bx - cw + 12), cy = Math.max(y + 2, by - ch - 4);
              H().dither(c, x, y, w, h, 0, 0.5);
              H().box(c, cx, cy, cw, ch, 1, 7); H().icon(c, 'i_mistic', cx + 9, cy + 9); G.cn(c, '秘術射擊', cx + 18, cy + 3, 9);
              const ax = cx + 4, ay = cy + 18, aw = cw - 8, ah = 26; c.fillStyle = P[0]; c.fillRect(ax - 1, ay - 1, aw + 2, ah + 2); c.drawImage(G.groundStrip(aw, ah), ax, ay);
              const p = ((T - 0.95) * 1.4) % 1, ux = ax + 12, ex = ax + aw - 12;
              unit(c, 'leafy', ux, ay + ah - 4, false); unit(c, 'babybear', ex, ay + ah - 4, false, -1, p > 0.85);
              if (p < 0.85) { const px = lerp(ux + 5, ex - 3, p / 0.85); G.pxDisc(c, px, ay + ah - 11, 2, 2, 17, 1); G.pxDisc(c, px, ay + ah - 11, 1, 1, 9, 1); }
              else G.pxEllipse(c, ex, ay + ah - 9, 5 + (p - 0.85) * 40, 3 + (p - 0.85) * 20, 17);
              G.cn(c, '傷害', cx + 5, ay + ah + 3, 6); G.cn(c, '70 →100', cx + cw - 5, ay + ah + 3, 13, 1);
              G.cn(c, '冷卻', cx + 5, ay + ah + 15, 6); G.cn(c, '4秒', cx + cw - 5, ay + ah + 15, 9, 1);
            }
            if (T < 2.8) ptr(dk)(c, bx + bw / 2, Math.round(lerp(y + h + 6, by + bw / 2, ss(seg(T, 0.1, 0.55)))), hold);
          }
        },
        {
          t: '施法前搖', m: '放技能前會先{蓄力}，大招更久、畫面變暗；首領放招前腳下也會出現{法陣}，{快閃開}',
          draw(c, x, y, w, h, t) {
            const T = t % 2.6, gy = Math.round(y + h * 0.72), hx = Math.round(x + w * 0.3), ex = Math.round(x + w * 0.72), ch = T < 1.1, cp = Math.min(1, T / 1.1);
            if (ch) { c.globalAlpha = 0.35 * cp; c.fillStyle = P[0]; c.fillRect(x, y, w, h); c.globalAlpha = 1; G.pxEllipse(c, hx, gy, 6 + cp * 10, 3 + cp * 4, 11, 3, t * 10); G.pxEllipse(c, hx, gy, 4 + cp * 6, 2 + cp * 2, 13, 2, -t * 14);
              for (let k = 0; k < 6; k++) { const a = k + t * 3, r = 22 * (1 - ((t * 2 + k / 6) % 1)); c.fillStyle = P[k % 2 ? 11 : 13]; c.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(gy - 8 + Math.sin(a) * r * 0.6), 1, 1); } }
            unit(c, 'leafy', hx + (ch ? Math.round(Math.sin(t * 60) * cp) : 0), gy, false);
            unit(c, 'bear', ex, gy, false, -1, T > 1.15 && T < 1.3);
            if (!ch && T < 1.7) { const f = (T - 1.1) / 0.6, r = 4 + f * 16; G.pxEllipse(c, ex, gy - 2, r, r * 0.45, 11); G.pxDisc(c, ex, gy - 10 - (1 - f) * 30, 4 * (1 - f) + 1, 4 * (1 - f) + 1, 13, 1 - f); }
            G.cn(c, ch ? '蓄力中…' : '放招！', x + w / 2, y + 4, ch ? 6 : 13, 0.5);
          }
        },
        // v2.4 技能瞄準／取消施放／塔的警戒／特殊藥水
        {
          t: '技能瞄準', m: '{按住技能往外拖}，可以自己選落點，地上會畫出作用範圍；放開就施放。{點一下則自動瞄準}',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.6, gy = Math.round(y + h * 0.6), hx = Math.round(x + w * 0.22), bx = Math.round(x + w - 26), by = Math.round(y + h - 24);
            const k = ss(seg(T, 0.5, 1.7)), ax = Math.round(lerp(hx + 14, x + w * 0.66, k)), ay = Math.round(lerp(gy, gy - 4, k)), aiming = T > 0.5 && T < 1.9, boom = T >= 1.9 && T < 2.5;
            if (aiming) { c.globalAlpha = 0.08; c.fillStyle = P[13]; c.beginPath(); c.ellipse(hx, gy, 62, 26, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1; G.pxEllipse(c, hx, gy, 62, 26, 13, 4, t * 6); c.globalAlpha = 0.22; c.beginPath(); c.ellipse(ax, ay, 16, 7, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1; G.pxEllipse(c, ax, ay, 16, 7, 13); }
            unit(c, 'leafy', hx, gy, false);
            [[0.62, -6], [0.72, 4], [0.66, 10]].forEach(([fx, dy], i) => unit(c, i ? 'babybear' : 'bear', Math.round(x + w * fx), gy + dy - 4, false, -1, boom));
            if (boom) { const f = (T - 1.9) / 0.6; G.pxEllipse(c, ax, ay, 4 + f * 18, 2 + f * 8, f < 0.3 ? 9 : 14); G.pxDisc(c, ax, ay - 2, 10 * (1 - f) + 2, 5 * (1 - f) + 1, 14, 1 - f); }
            H().key(c, bx, by, 20, 20, aiming, aiming ? 13 : 5); H().icon(c, 'i_fire', bx + 10, by + 10);
            const hxp = aiming ? Math.round(bx + 10 + (ax - (hx + 14)) * 0.25) : bx + 10, hyp = aiming ? Math.round(by + 10 - k * 10) : by + 10;
            if (T < 2.2) ptr(dk)(c, hxp, hyp, aiming);
            G.cn(c, aiming ? '拖曳選落點' : boom ? '放開＝施放' : '按住技能', x + w / 2, y + 4, aiming ? 13 : 9, 0.5);
          }
        },
        {
          t: '取消施放', m: '瞄準時把手指拖到上方的「{取消}」再放開，就不會施放。電腦版按 {Esc} 或{滑鼠右鍵}',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.2, gy = Math.round(y + h * 0.58), hx = Math.round(x + w * 0.25), bx = Math.round(x + w - 26), by = Math.round(y + h - 24), cx0 = bx - 8, cy0 = by - 30;
            const k = ss(seg(T, 0.9, 1.6)), on = T > 0.4 && T < 2.0, hot = T > 1.5 && T < 2.0;
            if (on) { c.globalAlpha = 0.18; c.fillStyle = P[hot ? 10 : 13]; c.beginPath(); c.ellipse(hx + 40, gy, 16, 7, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1; G.pxEllipse(c, hx + 40, gy, 16, 7, hot ? 10 : 13);
              c.fillStyle = P[hot ? 10 : 2]; c.beginPath(); c.arc(cx0, cy0, 9, 0, 6.2832); c.fill(); c.fillStyle = P[9]; for (let q = -3; q <= 3; q++) { c.fillRect(cx0 + q, cy0 + q, 1, 1); c.fillRect(cx0 + q, cy0 - q, 1, 1); } G.cn(c, '取消', cx0, cy0 + 11, hot ? 10 : 7, 0.5); }
            unit(c, 'leafy', hx, gy, false);
            H().key(c, bx, by, 20, 20, on, 5); H().icon(c, 'i_fire', bx + 10, by + 10);
            if (T < 2.3) ptr(dk)(c, Math.round(lerp(bx + 6, cx0, k)), Math.round(lerp(by + 6, cy0, k)), on);
            G.cn(c, T >= 2.0 ? '已取消' : hot ? '放開＝取消' : '拖到「取消」', x + w / 2, y + 4, hot || T >= 2.0 ? 10 : 9, 0.5);
          }
        },
        {
          t: '塔的警戒', m: '走進敵塔範圍時，地上會出現{r:粉紅色的圈}。被塔鎖定時會響警示音，英雄頭上冒出{r:紅色驚嘆號}',
          draw(c, x, y, w, h, t) {
            const T = t % 3.6, gy = Math.round(y + h * 0.78), tx = Math.round(x + w * 0.74), hx = Math.round(lerp(x + 14, x + w * 0.42, ss(seg(T, 0, 1.2)))), lk = T > 1.2;
            const rx = 58, ry = 24; c.globalAlpha = lk ? 0.18 : 0.12; c.fillStyle = P[lk ? 10 : 19]; c.beginPath(); c.ellipse(tx, gy - 4, rx, ry, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1; G.pxEllipse(c, tx, gy - 4, rx, ry, lk ? 10 : 19, lk ? 0 : 4, t * 6);
            tower(c, 'enemy_tower', tx, gy);
            unit(c, 'leafy', hx, gy - 2, T < 1.2, 1, lk && ((T * 3) | 0) % 2 === 0);
            if (lk) { const by = gy - 30 + Math.round(Math.abs(Math.sin(t * 7)) * -2); c.fillStyle = P[0]; c.fillRect(hx - 2, by - 1, 5, 11); c.fillStyle = P[10]; c.fillRect(hx - 1, by, 3, 6); c.fillRect(hx - 1, by + 7, 3, 2);
              const f = ((T - 1.2) * 1.5) % 1; G.pxDisc(c, Math.round(lerp(tx - 4, hx, f)), Math.round(lerp(gy - 40, gy - 10, f)), 2, 2, 10, 1); }
            G.cn(c, lk ? '被鎖定了！' : '進入塔的範圍', x + w / 2, y + 4, lk ? 10 : 19, 0.5);
          }
        },
        {
          t: '特殊藥水', m: '{無敵藥水} 2.5 秒內不受傷害；{復活藥水}放在背包，陣亡時會{自動原地復活}',
          draw(c, x, y, w, h, t) {
            const T = t % 4, gy = Math.round(y + h * 0.72), hx = Math.round(x + w * 0.4), inv = T < 2;
            unit(c, 'leafy', hx, gy, false);
            if (inv) { G.pxEllipse(c, hx, gy - 8, 10, 11, 13, 5, t * 14); const f = (T * 2) % 1; G.pxDisc(c, Math.round(lerp(x + w - 10, hx + 10, f)), gy - 10, 2, 2, 10, 1); if (f > 0.85) G.pxEllipse(c, hx + 9, gy - 10, 3, 3, 13); H().icon(c, 'p_inv', x + 14, y + 22); G.cn(c, '無敵藥水', x + 24, y + 16, 13); }
            else { const f = (T - 2) / 2; H().icon(c, 'p_rev', x + 14, y + 22); G.cn(c, '復活藥水', x + 24, y + 16, 19); c.fillStyle = P[9]; c.globalAlpha = Math.max(0, 1 - f * 2); c.fillRect(hx - 1, y, 3, gy - y); c.globalAlpha = 1; G.pxEllipse(c, hx, gy, 6 + f * 26, 3 + f * 10, 19); }
            G.cn(c, inv ? '不受傷害' : '原地復活！', x + w - 6, y + 4, inv ? 13 : 19, 1);
          }
        },
        {
          t: '戰鬥數據', m: '左上角鑰匙旁邊的 {K/D/A} 顯示擊殺／陣亡／助攻；{點開}可以看野怪、推塔、金幣、傷害等即時數據',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4, open = T > 1.1 && T < 3.6, kda = '3/0/2', kw = G.textW(kda) + 8, kx = x + 30, ky = y + 6;
            c.fillStyle = P[0]; c.fillRect(x + 6, ky, 21, 8); H().icon(c, 'i_key', x + 12, ky + 4); G.text(c, 'X2', x + 19, ky + 1, 13);
            c.fillStyle = P[0]; c.fillRect(kx, ky, kw, 8); c.fillStyle = P[open ? 13 : 4]; c.fillRect(kx, ky + 7, kw, 1); G.text(c, kda, kx + kw / 2, ky + 1, open ? 13 : 9, 1, null, 0.5);
            if (open) {
              H().dither(c, x, y, w, h, 0, 0.7);
              const pw = Math.min(w - 12, 150), px = Math.round(x + w / 2 - pw / 2), py = Math.round(y + Math.max(4, h / 2 - 50)), kw2 = Math.floor((pw - 16) / 3);
              H().box(c, px, py, pw, Math.min(h - 8, 100), 1, 7); G.cn(c, '戰鬥數據', px + 5, py + 3, 9);
              [['擊殺', 3, 13], ['陣亡', 0, 10], ['助攻', 2, 18]].forEach(([lab, v, col], i) => { const bx = px + 5 + i * (kw2 + 3); H().box(c, bx, py + 18, kw2, 28, 0, 4, false); G.text(c, v, bx + kw2 / 2, py + 21, col, 2, null, 0.5); G.cn(c, lab, bx + kw2 / 2, py + 32, 6, 0.5); });
              [['擊殺野怪', 4], ['累積金幣', 1260], ['造成傷害', 5321]].forEach(([lab, v], i) => { const yy = py + 50 + i * 13; if (yy + 14 > py + Math.min(h - 8, 100)) return; G.cn(c, lab, px + 5, yy, 6); G.cn(c, String(v), px + pw - 5, yy, 9, 1); });
            }
            if (T < 1.2) ptr(dk)(c, kx + kw / 2, Math.round(lerp(y + h, ky + 6, ss(seg(T, 0.2, 0.8)))), T > 0.85 && T < 1.1);
          }
        },
        {
          t: '增益狀態', m: '左上角的增益圖示，{長按}可看效果與剩餘秒數', d: '左上角的增益圖示，{按住不放}可看效果與剩餘秒數',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.6, bx = x + 10, by = y + 10, hold = T > 0.7 && T < 3, left = Math.max(0, 62 - Math.floor(T * 3));
            H().box(c, bx, by, 13, 13, hold ? 3 : 0, 10, false); H().icon(c, 'i_rage', bx + 6.5, by + 6.5);
            H().box(c, bx + 15, by, 13, 13, 0, 12, false); H().icon(c, 'i_mp', bx + 21.5, by + 6.5);
            if (hold && T > 1.05) { const cw = Math.min(w - 24, 120), sm = h < 90, cy = sm ? by - 4 : by + 20, bx2 = bx; { const bx = sm ? bx2 + 34 : bx2; H().box(c, bx, cy, cw, 50, 1, 10); H().icon(c, 'i_rage', bx + 11, cy + 10); G.cn(c, '狂暴之力', bx + 22, cy + 3, 9); G.cn(c, '攻擊力 +25%', bx + 6, cy + 20, 7); c.fillStyle = P[0]; c.fillRect(bx + 6, cy + 38, cw - 60, 3); c.fillStyle = P[9]; c.fillRect(bx + 6, cy + 39, Math.round((cw - 60) * left / 90), 1); G.cn(c, '剩 ' + left + ' 秒', bx + cw - 6, cy + 33, 13, 1); } }
            if (T < 3.1) ptr(dk)(c, bx + 7, Math.round(lerp(y + h + 6, by + 7, ss(seg(T, 0.1, 0.6)))), hold);
          }
        },
        {
          z: 1, t: '升級', m: '打倒敵人得到經驗，升級後 {r:HP} 與 {g:MP} {全滿}',
          draw(c, x, y, w, h, t) {
            const T = t % 3, gy = y + h * 0.72, hx = x + w / 2;
            if (T > 0.6 && T < 2.2) { const p = (T - 0.6) / 1.6, bw2 = Math.round(10 * (1 - p)) + 1; H().dither(c, Math.round(hx - bw2), Math.round(gy - 60), bw2 * 2, 60, 13, (1 - p) * 0.9); ztext(c, 'LV UP', hx, gy - 34 - p * 10, 13, 1, 0, 0.5); }
            unit(c, 'leafy', hx, gy, false);
            hpBar(c, hx - 12, gy - 20, 24, T > 0.6 ? 1 : 0.35, 10); hpBar(c, hx - 12, gy - 17, 24, T > 0.6 ? 1 : 0.2, 11);
          }
        },
        {
          t: '英雄資訊', m: '{點左上角的英雄頭像}，可以看目前的能力值；{黃色代表增益中}', d: '{點左上角的英雄頭像}，可以看目前的能力值；{黃色代表增益中}',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4, open = T > 0.9 && T < 3.6;
            H().box(c, x + 6, y + 6, 20, 20, 2, 6); c.drawImage(G.SPR.leafy[0].n, x + 16 - G.SPR.leafy[0].w / 2, y + 16 - G.SPR.leafy[0].h / 2);
            if (open) {
              const pw = Math.min(w - 16, 150), py = y + Math.min(30, h - 4 * 13 - 10); H().box(c, x + 6, py, pw, 4 * 13 + 6, 1, 7);
              [['生命', 0.55, 10, 0], ['攻擊', 0.35, 9, 0.12], ['爆擊', 0.2, 14, 0], ['跑速', 0.5, 9, 0]].forEach(([lab, f, col, extra], i2) => {
                const yy = py + 4 + i2 * 13, bx = x + 34, bw = pw - 36; G.cn(c, lab, x + 10, yy - 1, 5); c.fillStyle = P[2]; c.fillRect(bx, yy + 3, bw, 4); c.fillStyle = P[col]; c.fillRect(bx, yy + 3, Math.round(bw * f), 4); if (extra) { c.fillStyle = P[13]; c.fillRect(bx + Math.round(bw * f), yy + 3, Math.round(bw * extra), 4); }
              });
            }
            if (T < 1.1) ptr(dk)(c, Math.round(lerp(x + w * 0.6, x + 16, ss(seg(T, 0.1, 0.7)))), Math.round(lerp(y + h, y + 16, ss(seg(T, 0.1, 0.7)))), T > 0.7 && T < 0.9);
          }
        },
        {
          z: 1, t: '復活', m: '英雄倒下後，倒數結束會在{聖樹旁復活}',
          draw(c, x, y, w, h, t) {
            const T = t % 4, ph = G.SPR.pholy[0], gy = y + h * 0.85;
            c.drawImage(ph.n, Math.round(x + w * 0.3 - ph.w / 2), Math.round(gy - ph.h));
            if (T < 3) { H().dither(c, x, y, w, h, 0, 0.35); ztext(c, 3 - (T | 0), x + w * 0.65, y + h * 0.3 - 4, 9, 3, 0, 0.5); }
            else unit(c, 'leafy', x + w * 0.5, gy - 4, false);
          }
        }
      ]
    },
    {
      name: '英雄', pages: [
        {
          t: '召喚物', m: '{死靈召喚力夫}的技能會產生{p:召喚物}（紫色外框），會自動{跟著他}一起戰鬥',
          draw(c, x, y, w, h, t) {
            const T = t % 4, gy = Math.round(y + h * 0.64), mv = T > 0.4 && T < 3.3, X = k => lerp(x + w * 0.34, x + w * 0.74, k);
            const sm = [['leafblower', -24, -9, 0.12], ['peasniper', -34, 6, 0.24], ['leafmuscle', -15, 11, 0.36]];
            const one = ([n, dx, dy, d]) => sumU(c, n, X(ss(seg(T, 0.4 + d, 3.3 + d))) + dx, gy + dy, null, T > 0.4 + d && T < 3.3 + d);
            sm.filter(e => e[2] < 0).forEach(one); unit(c, 'necroleafy', X(ss(seg(T, 0.4, 3.3))), gy, mv); sm.filter(e => e[2] >= 0).forEach(one);
            G.cn(c, '紫色外框＝召喚物', x + w / 2, y + 2, 17, 0.5);
          }
        },
        {
          t: '犧牲召喚', m: '獻祭身邊的{我方小兵}，換成同樣數量的{隨機小兵}（{含還沒解鎖的角色}）',
          draw(c, x, y, w, h, t) {
            const T = t % 5, gy = Math.round(y + h * 0.64), hx = x + w * 0.28, cast = T > 0.9 && T < 1.5;
            const pos = [[0.52, -8], [0.66, 7], [0.8, -6]], olds = ['leafblower', 'potatoblower', 'seedshooter'];
            const NEW = [['iceshooter', 'flametree', 'vampireflower'], ['sunshooter', 'treestun', 'leaftanker'], ['poisonshooter', 'elitepeasniper', 'fruitpult']][((t / 5) | 0) % 3];
            if (cast) { const k = seg(T, 0.9, 1.5); G.pxEllipse(c, hx, gy, 12 + k * 70, (12 + k * 70) * 0.36, 17); }
            unit(c, 'necroleafy', hx, gy, false, 1, cast && ((t * 12) | 0) % 2 === 0);
            pos.forEach(([fx, dy], i) => {
              const px = x + w * fx, py = gy + dy, out = 1 - seg(T, 1.2, 1.6), inn = seg(T, 1.7, 2.2);
              if (out > 0) unitA(c, olds[i], px, py, out, false, -1);
              if (T > 1.2 && T < 2.0) G.glow(c, px, py - 8, 7 + Math.sin(T * 20) * 2, 17, 0.8 * (1 - Math.abs(T - 1.6) / 0.4));
              if (inn > 0) sumU(c, NEW[i], px, py, null, false, -1, inn);
            });
            G.cn(c, T < 1.5 ? '獻祭身邊的小兵' : '換成隨機小兵', x + w / 2, y + 2, 17, 0.5);
          }
        },
        {
          t: '血祭控制', m: '犧牲{r:目前一半的血量}，把身邊的{敵人變成召喚物}；{塔與獵手除外}',
          draw(c, x, y, w, h, t) {
            const T = t % 5, gy = Math.round(y + h * 0.64), hx = x + w * 0.28, hp = 1 - 0.5 * ss(seg(T, 1.0, 1.4)), on = T > 1.5;
            const foes = [['bear', 0.58, -7], ['boar', 0.7, 8], ['babybear', 0.82, -4]];
            unit(c, 'necroleafy', hx, gy, false, 1, T > 1.0 && T < 1.4 && ((t * 12) | 0) % 2 === 0);
            hpBar(c, Math.round(hx - 9), gy - 26, 18, hp, 10);
            if (T > 1.0 && T < 1.6) for (let i = 0; i < 4; i++) { const q = (T * 3 + i * 0.27) % 1; c.fillStyle = P[10]; c.fillRect(Math.round(hx - 6 + i * 4), Math.round(gy - 18 + q * 14), 1, 2); }
            foes.forEach(([n, fx, dy]) => {
              const px = x + w * fx - (on ? ss(seg(T, 2.0, 3.2)) * 16 : 0), py = gy + dy;
              if (T > 1.3 && T < 1.8) { c.fillStyle = P[17]; G.pxLine(c, hx + 4, gy - 10, px, py - 8, 1); G.glow(c, px, py - 8, 6, 17, 0.7); }
              if (on) sumU(c, n, px, py, 'necro', T > 2.0 && T < 3.2, -1); else unit(c, n, px, py, false, -1);
            });
            G.cn(c, T < 1.5 ? (T > 0.9 ? '犧牲一半血量' : '') : '敵人變成召喚物', x + w / 2, y + 2, T < 1.5 ? 10 : 17, 0.5);
          }
        },
        {
          t: '複製法術', m: '每隻召喚物{各複製一隻}；複製體{只有 1 點血}，但{攻擊力一樣}',
          draw(c, x, y, w, h, t) {
            const T = t % 5, gy = Math.round(y + h * 0.62), hx = x + w * 0.24, k = seg(T, 1.1, 1.7);
            const sm = [['leafblower', 0.46, -8], ['peasniper', 0.6, 6], ['leafmuscle', 0.74, -6]];
            unit(c, 'necroleafy', hx, gy, false, 1, T > 0.9 && T < 1.2 && ((t * 12) | 0) % 2 === 0);
            if (T > 0.9 && T < 1.5) { const r = 8 + seg(T, 0.9, 1.5) * 26; G.pxEllipse(c, hx, gy, r, r * 0.36, 12); }
            sm.forEach(([n, fx, dy]) => {
              const px = x + w * fx, py = gy + dy;
              sumU(c, n, px, py, null, false);
              if (k > 0) { const cx2 = px + 9 * ss(k), cy2 = py + 9 * ss(k); sumU(c, n, cx2, cy2, 'clone', false, 1, Math.min(1, k * 1.5)); if (k >= 1) { c.fillStyle = P[0]; c.fillRect(Math.round(cx2 - 6), cy2 + 3, 12, 3); c.fillStyle = P[10]; c.fillRect(Math.round(cx2 - 5), cy2 + 4, 1, 1); } }
              if (T > 1.0 && T < 1.8) G.glow(c, px + 5, py - 8, 6, 12, 0.6 * (1 - seg(T, 1.0, 1.8)));
            });
            G.cn(c, T < 1.1 ? '' : '複製體：1 點血、攻擊一樣', x + w / 2, y + 2, 12, 0.5);
          }
        },
        {
          t: '替罪', m: '{p:被動}：身邊有召喚物時，一部分傷害改由{血最多的那隻}召喚物承受',
          draw(c, x, y, w, h, t) {
            const T = t % 4, gy = Math.round(y + h * 0.66), hx = x + w * 0.42, ex = x + w * 0.84;
            const sm = [['leafblower', -22, -8, 0.5], ['peasniper', -30, 8, 1], ['leafmuscle', -14, 12, 0.7]];
            unit(c, 'bear', ex, gy, false, -1, T > 1 && ((t * 8) | 0) % 4 === 0);
            const hit = T > 1 && ((T * 2) % 1) < 0.4;
            sm.filter(e => e[2] < 0).forEach(([n, dx, dy]) => sumU(c, n, hx + dx, gy + dy, null, false));
            unit(c, 'necroleafy', hx, gy, false);
            sm.filter(e => e[2] >= 0).forEach(([n, dx, dy]) => sumU(c, n, hx + dx, gy + dy, null, false));
            sm.forEach(([, dx, dy, f], i) => hpBar(c, Math.round(hx + dx - 6), gy + dy - 20, 12, i === 1 && T > 1 ? Math.max(0.3, f - (T - 1) * 0.2) : f, 9));
            if (hit) { const [, dx, dy] = sm[1]; c.fillStyle = P[17]; G.pxLine(c, hx, gy - 10, hx + dx, gy + dy - 6, 1); G.glow(c, hx + dx, gy + dy - 6, 5, 17, 0.7); }
            G.cn(c, T > 1 ? '傷害轉給血最多的召喚物' : '身邊有召喚物時', x + w / 2, y + 2, 17, 0.5);
          }
        }
      ]
    },
    {
      name: '地圖', pages: [
        {
          t: '三條路', m: '地圖有{上路、中路、下路}三條路',
          draw(c, x, y, w, h, t) { const mw = Math.min(w - 20, (h - 12) * 1.33), mh = mw * 0.75, L = ((t / 1.2) | 0) % 3; miniMap(c, Math.round(x + w / 2 - mw / 2), Math.round(y + h / 2 - mh / 2), Math.round(mw), Math.round(mh), L); G.cn(c, ['上路', '中路', '下路'][L], x + w - 6, y + 4, 13, 1); }
        },
        {
          z: 1, t: '兵線', m: '雙方{每 20 秒}從聖所派出小兵，沿著三條路前進',
          draw(c, x, y, w, h, t) {
            const gy = y + h * 0.7, T = t % 4, k = Math.min(1, T / 2.2);
            for (let i = 0; i < 3; i++) { unit(c, ['leafblower', 'seedshooter', 'treeprotector'][i], lerp(x + 10 - i * 14, x + w * 0.42 - i * 14, k), gy + (i % 2) * 6, k < 1); unit(c, ['babybear', 'bear', 'babybear'][i], lerp(x + w - 10 + i * 14, x + w * 0.58 + i * 14, k), gy + (i % 2) * 6, k < 1, -1); }
            if (k >= 1 && ((t * 8) | 0) % 2) { c.fillStyle = P[9]; c.fillRect(Math.round(x + w / 2), Math.round(gy - 8), 2, 2); }
          }
        },
        {
          t: '防禦塔', m: '每條路有{外、中、內}三層塔，基地前還有{主塔}；塔會隨時間變強，{連續打同一個英雄會越打越痛}',
          draw(c, x, y, w, h, t) {
            const gy = y + h * 0.84, L = ((t / 0.9) | 0) % 4;
            [['enemy_tower', '外塔'], ['enemy_tower2', '中塔'], ['enemy_tower3', '內塔'], ['enemy_tower4', '主塔']].forEach(([n, lab], i) => { const tx = x + w * (0.13 + i * 0.25); tower(c, n, tx, gy); G.cn(c, lab, tx, y + 4, i === L ? 13 : 6, 0.5); });
          }
        },
        {
          z: 1, t: '推塔順序', m: '同一路要{先拆外塔}，中塔、內塔的{b:藍色護盾}才會依序消失',
          draw(c, x, y, w, h, t) {
            const T = t % 4.4, gy = y + h * 0.82, broke = T > 1.8;
            if (!broke) tower(c, 'enemy_tower', x + w * 0.35, gy, false, ((T * 10) | 0) % 3 === 0);
            else if (T < 2.4) { const k = (T - 1.8) / 0.6; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; c.fillStyle = P[i % 3 ? 2 : 9]; c.fillRect(Math.round(x + w * 0.35 + Math.cos(a) * k * 24), Math.round(gy - 14 + Math.sin(a) * k * 14 + k * k * 10), 2, 2); } }
            tower(c, 'enemy_tower2', x + w * 0.7, gy, !broke);
            if (!broke) { c.fillStyle = P[7]; for (let i = 0; i < 4; i++) c.fillRect(Math.round(x + w * 0.12 + i * 6 + (t * 12) % 6), Math.round(gy - 14), 3, 1); }
          }
        },
        {
          z: 1, t: '摧毀聖所', m: '{任一路內塔}倒了才能打主塔；主塔倒了才能打聖所，{摧毀即獲勝}',
          draw(c, x, y, w, h, t) {
            const T = t % 4.2, gy = y + Math.round(h * 0.86), eh = G.SPR.eholy[0], ex = x + w * 0.62;
            const boom = T > 2.2 && T < 3.4;
            if (!boom) { c.drawImage(T > 1.2 && ((t * 20) | 0) % 3 === 0 ? eh.f : eh.n, Math.round(ex - eh.w / 2), gy - eh.h); if (T < 0.8) { const gl = G.glowOf(eh.n, 12, 1, 5); c.globalAlpha = 0.7; c.drawImage(gl.c, Math.round(ex - eh.w / 2) - gl.p, gy - eh.h - gl.p); c.globalAlpha = 1; } }
            else { const k = (T - 2.2) / 1.2; G.pxEllipse(c, ex, gy - 6, 6 + k * 40, 3 + k * 16, k > 0.6 ? 6 : 9); for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28, r = k * (20 + (i % 5) * 6); c.fillStyle = P[i % 3 ? 2 : 9]; c.fillRect(Math.round(ex + Math.cos(a) * r), Math.round(gy - 20 + Math.sin(a) * r * 0.7 + k * k * 20), 2, 2); } G.text(c, 'VICTORY', x + w / 2, y + 8, 13, 2, 0, 0.5); }
          }
        },
        {
          t: '河道與野區', m: '河道分開雙方；{野怪}住在森林裡的凹槽營地，{野生首領}待在河道旁的坑裡',
          draw(c, x, y, w, h, t) { const mw = Math.min(w - 20, (h - 12) * 1.33), mh = mw * 0.75; miniMap(c, Math.round(x + w / 2 - mw / 2), Math.round(y + h / 2 - mh / 2), Math.round(mw), Math.round(mh), ((t * 1.2) | 0) % 2 ? 'river' : 'wild'); }
        },
        {
          t: '視野與迷霧', m: '我方單位看不到的地方會蓋上{迷霧}，裡面的敵人不會顯示；{森林會擋住視線}',
          draw(c, x, y, w, h, t) {
            const T = t % 4.4, gy = y + h * 0.68, hx = x + w * 0.3, ex = lerp(x + w + 10, x + w * 0.56, ss(seg(T, 0.2, 2.4))), R0 = Math.min(w * 0.3, 64);
            unit(c, 'leafy', hx, gy, false);
            const inside = ex - hx < R0;
            if (inside) unit(c, 'bear', ex, gy, T < 2.4, -1);
            // 迷霧：視野圈外蓋暗
            c.save(); c.beginPath(); c.rect(x, y, w, h); c.ellipse(hx, gy - 4, R0, R0 * 0.62, 0, 0, Math.PI * 2, true); c.clip('evenodd');
            c.fillStyle = 'rgba(8,10,18,0.72)'; c.fillRect(x, y, w, h); c.restore();
            G.pxEllipse(c, hx, gy - 4, R0, R0 * 0.62, 6, 4, t * 6);
            if (!inside) G.cn(c, '？', Math.min(ex, x + w - 8), gy - 26, 5, 0.5);
            else G.cn(c, '看到了！', ex, gy - 32, 10, 0.5);
          }
        },
        {
          z: 1, t: '野怪增益', m: '打倒{r:紅色營}得攻擊增益，{b:藍色營}得 MP 與冷卻增益，{鱷魚營}給大量經驗',
          draw(c, x, y, w, h, t) {
            const k = ((t / 2.2) | 0) % 3, T = t % 2.2, gy = y + h * 0.7, d = G.WILD[['red', 'blue', 'exp'][k]];
            if (T < 1.2) { unit(c, d.unit, x + w * 0.65, gy, false, -1, ((t * 12) | 0) % 3 === 0); hpBar(c, x + w * 0.65 - 10, gy - 26, 20, 1 - T / 1.2, 13); }
            else { const ic = d.ic; H().box(c, Math.round(x + w * 0.65 - 8), Math.round(gy - 28 - (T - 1.2) * 8), 16, 16, 0, d.col); H().icon(c, ic, x + w * 0.65, gy - 20 - (T - 1.2) * 8); }
            unit(c, 'leafy', x + w * 0.3, gy, false);
            zcn(c, d.n, x + 3, y + 2, d.col);
          }
        },
        {
          z: 1, t: '野生首領', m: '河道上的野生首領很強，{打倒後會加入我方}，幫忙推塔',
          draw(c, x, y, w, h, t) {
            const T = t % 4, gy = y + h * 0.72, ally = T > 1.6, bx = ally ? lerp(x + w * 0.55, x + w + 30, ss(seg(T, 2.2, 4))) : x + w * 0.6;
            if (ally) { const s = G.SPR[G.VIS.polarbear.spr][((gt * 6) | 0) % 2], gl = G.glowOf(s.n, 13, 1, 3); c.drawImage(gl.c, Math.round(bx - s.w / 2 - gl.p), Math.round(gy - s.h + 1 - gl.p)); }
            unit(c, 'polarbear', bx, gy, ally, ally ? 1 : -1, !ally && ((t * 12) | 0) % 3 === 0);
            ztext(c, 'BOSS', Math.min(bx, x + w - 12), gy - 27, 13, 1, 0, 0.5);
            if (!ally) hpBar(c, bx - 12, gy - 24, 24, 1 - T / 1.6, 13); else zcn(c, '加入我方', x + 3, y + 2, 13);
            unit(c, 'leafy', x + w * 0.25, gy, false);
          }
        },
        {
          z: 1, t: '敵方獵手', m: '敵方的{獵手}（頭上 HUNTER）會來野區清怪變強，還會{搶走野生首領}，記得去阻止牠',
          draw(c, x, y, w, h, t) {
            const T = t % 4.4, gy = y + h * 0.72, wx = x + w * 0.62, hx = lerp(x + w * 0.2, x + w * 0.45, ss(seg(T, 0, 1.2))), dead = T > 2.4;
            if (!dead) { unit(c, 'gorilla', wx, gy, false, -1, ((t * 10) | 0) % 3 === 0 && T > 1.2); hpBar(c, wx - 10, gy - 26, 20, 1 - G.clamp((T - 1.2) / 1.2, 0, 1), 13); }
            unit(c, 'hunter', hx, gy + 2, T < 1.2);
            ztext(c, 'HUNTER', hx, gy - 20, 14, 1, 0, 0.5);
            if (dead) { H().box(c, Math.round(hx - 8), Math.round(gy - 44 - (T - 2.4) * 5), 16, 16, 0, 10); H().icon(c, 'i_rage', hx, gy - 36 - (T - 2.4) * 5); zcn(c, '變強了！', x + 3, y + 2, 10); }
          }
        },
        {
          z: 1, t: '首領', m: '{每 3 波}敵人會出現一隻首領，頭上有{b:藍色 BOSS}',
          draw(c, x, y, w, h, t) {
            const gy = y + h * 0.75, bx = lerp(x + w + 20, x + w * 0.55, ss(seg(t % 4, 0, 2)));
            unit(c, 'tiger', bx, gy, (t % 4) < 2, -1); hpBar(c, bx - 12, gy - 22, 24, 1, 7); ztext(c, 'BOSS', Math.min(bx, x + w - 12), gy - 27, 12, 1, 0, 0.5);
            unit(c, 'leafy', x + w * 0.2, gy, false);
          }
        },
        {
          z: 1, t: '聖樹回復', m: '待在{我方聖樹旁邊}，會快速回復 {r:HP} 與 {g:MP}',
          draw(c, x, y, w, h, t) {
            const ph = G.SPR.pholy[0], gy = y + h * 0.86, f = 0.3 + ((t % 3) / 3) * 0.7;
            c.drawImage(ph.n, Math.round(x + w * 0.35 - ph.w / 2), Math.round(gy - ph.h));
            const hx = x + w * 0.65; unit(c, 'leafy', hx, gy - 4, false); hpBar(c, hx - 12, gy - 26, 24, f, 10); hpBar(c, hx - 12, gy - 23, 24, f, 11);
            for (let i = 0; i < 6; i++) { c.fillStyle = P[i % 2 ? 10 : 11]; c.fillRect(Math.round(hx - 10 + i * 4), Math.round(gy - 8 - ((t * 20 + i * 7) % 18)), 1, 1); }
          }
        }
      ]
    },
    {
      name: '隊伍', pages: [
        {
          t: '選擇角色', m: '在「隊伍」{左右滑動}角色，{轉到中間}的角色會顯示詳細資料', d: '在「隊伍」用{滑鼠拖曳、滾輪或左右鍵}轉動角色',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3, pos = 1 + ss(seg(T, 0.4, 1.2)), cx = x + w / 2, fl = y + h * 0.7;
            const names = G.HEROES.slice(0, 5).map(hd => hd.name);
            names.map((n, i) => [n, i]).sort((A, B) => Math.abs(B[1] - pos) - Math.abs(A[1] - pos)).forEach(([n, i]) => {
              const d = i - pos, sc = 1 + Math.pow(Math.max(0, 1 - Math.abs(d)), 1.4), s = G.SPR[n][0], fw = Math.round(s.w * sc), fh = Math.round(s.h * sc), px = cx + Math.sign(d) * Math.min(Math.abs(d), 1) * 34 + Math.sign(d) * Math.max(0, Math.abs(d) - 1) * 22;
              c.drawImage(s.n, Math.round(px - fw / 2), Math.round(fl - fh), fw, fh);
              const dk2 = Math.min(1, Math.abs(d)) * 0.7; if (dk2 > 0.02) { c.globalAlpha = dk2; c.drawImage(G.glowOf(s.n, 0, 1, 2).tint, Math.round(px - fw / 2), Math.round(fl - fh), fw, fh); c.globalAlpha = 1; }
            });
            G.pxEllipse(c, cx, fl + 1, 18, 4, 6);
            if (T > 1.2) yBtn(c, Math.round(cx - 40), Math.round(fl + 8), 80, 14, '設為出戰英雄');
            ptr(dk)(c, Math.round(lerp(cx + 30, cx - 20, ss(seg(T, 0.3, 1.1)))), Math.round(fl - 10), T > 0.3 && T < 1.1);
          }
        },
        {
          t: '解鎖角色', m: '開局只有「普通」角色；{黑色剪影}代表還沒擁有，到首頁「{商店}」開寶箱取得',
          draw(c, x, y, w, h, t) {
            const T = t % 4, gy = y + h * 0.78, cx = x + w * 0.62, got = T > 2.2, sp = G.SPR.spearleafy[0];
            const sx = Math.round(x + w * 0.24 - sp.w), sy = Math.round(gy - sp.h * 2);
            c.drawImage(sp.n, sx, sy, sp.w * 2, sp.h * 2);
            if (!got) { c.globalAlpha = 0.9; c.drawImage(G.glowOf(sp.n, 0, 1, 2).tint, sx, sy, sp.w * 2, sp.h * 2); c.globalAlpha = 1; H().icon(c, 'i_lock', sx + sp.w, sy + sp.h); }
            else { const gl = G.glowOf(G.scaled(sp.n, 2), 11, 1, 3); c.globalAlpha = 0.7; c.drawImage(gl.c, sx - gl.p, sy - gl.p); c.globalAlpha = 1; c.drawImage(sp.n, sx, sy, sp.w * 2, sp.h * 2); G.cn(c, '稀有！', x + w * 0.24, y + 4, 11, 0.5); }
            const shake = T > 0.6 && T < 1.8 ? Math.round(Math.sin(T * 40) * (T - 0.6) * 2) : 0;
            G.Store.drawChest(c, 'hero', cx + shake, gy, 2, T > 1.8, T > 1.2 ? 11 : null, 0.6);
          }
        },
        {
          t: '寶箱', m: '賭徒 {1 把}、英雄 {5 把}、小兵 {3 把}鑰匙；機率看「說明」，{不會開到已擁有的角色}',
          draw(c, x, y, w, h, t) {
            const gy = y + h * 0.66, ids = [['gamble', 1], ['hero', 5], ['minion', 3]], sel = ((t / 1.3) | 0) % 3;
            ids.forEach(([id, cost], i) => { const cx = x + w * (0.2 + i * 0.3), on = i === sel; G.Store.drawChest(c, id, cx, gy - (on ? Math.round(Math.abs(Math.sin(t * 6)) * 3) : 0), on ? 2 : 1, false, on ? 13 : null, 0.6); H().icon(c, 'i_key', cx - 6, gy + 8); G.text(c, 'X' + cost, cx + 2, gy + 6, 13, 1); });
          }
        },
        {
          t: '新角色', m: '開到新角色時按「{前往隊伍}」，牠會直接站在聚光燈下；新角色標著 {NEW}，看過再滑走就消失',
          draw(c, x, y, w, h, t) {
            const T = t % 5, gy = Math.round(y + h * 0.7), cx = x + w / 2, sp = 34, k = ss(seg(T, 2.4, 3.0)), names = ['leafy', 'stemskewer', 'peasniper', 'leafblower'];
            G.pxDisc(c, cx, gy, 20, 5, 4, 0.9); G.pxEllipse(c, cx, gy, 20, 5, 7);
            names.forEach((n, i) => {
              const d = i - 1 - k, px = cx + d * sp, sc = Math.abs(d) < 0.5 ? 1 : 0.8; if (Math.abs(d) > 2.2) return;
              const s = G.SPR[G.VIS[n].spr][Math.abs(d) < 0.5 ? ((gt * 4) | 0) % 2 : 0], iw = Math.round(s.w * sc), ih = Math.round(s.h * sc), ix = Math.round(px - iw / 2), iy = Math.round(gy - ih + 1);
              c.globalAlpha = Math.abs(d) < 0.5 ? 1 : 0.45; c.drawImage(s.n, ix, iy, iw, ih); c.globalAlpha = 1;
              if (i === 1 && T < 3.0) { const bw2 = G.textW('NEW') + 4, by = iy - 9 - (Math.abs(d) < 0.5 ? Math.round(Math.abs(Math.sin(gt * 5)) * 2) : 0); c.fillStyle = P[0]; c.fillRect(ix + iw - 3, by - 1, bw2 + 2, 9); c.fillStyle = P[13]; c.fillRect(ix + iw - 2, by, bw2, 7); G.text(c, 'NEW', ix + iw, by + 1, 0); }
            });
            G.cn(c, T < 2.4 ? '看到新角色' : T < 3.0 ? '滑走…' : 'NEW 消失了', x + w / 2, y + 2, T < 2.4 ? 13 : 7, 0.5);
          }
        },
        {
          t: '免費寶箱', m: '賭徒寶箱{每 5 分鐘可以免費開一次}；時間一到會跳出通知，商店也會亮{g:綠色按鈕}',
          draw(c, x, y, w, h, t) {
            const T = t % 4, gy = Math.round(y + h * 0.62), cx = Math.round(x + w * 0.32), on = T > 1.6, bw = 52, bx = Math.round(x + w * 0.58), by = gy - 22;
            G.Store.drawChest(c, 'gamble', cx, gy - (on ? Math.round(Math.abs(Math.sin(t * 6)) * 3) : 0), 2, false, on ? 11 : null, 0.7);
            if (!on) { const L = Math.max(0, Math.ceil(3 - T * 1.9)); H().icon(c, 'i_key', bx + 6, by + 6); G.cn(c, '0:0' + L + ' 後免費', bx + 14, by, 5); H().box(c, bx, by + 16, bw, 15, 1, 3, false); G.cn(c, '開啟', bx + bw / 2, by + 17, 4, 0.5); }
            else { H().icon(c, 'i_key', bx + 6, by + 6); G.cn(c, '免費', bx + 14, by, 11); const gl = Math.sin(t * 6) > 0; c.fillStyle = P[gl ? 11 : 16]; c.fillRect(bx - 1, by + 15, bw + 2, 17); H().key(c, bx, by + 16, bw, 15, false, 16, 11, G.tint(16, -0.4)); G.cn(c, '免費開啟', bx + bw / 2, by + 17, 0, 0.5); }
            if (on && T < 3.2) { const k = Math.min(1, (T - 1.6) / 0.25), bh = 14, yy = Math.round(y - bh + k * (bh + 2)); H().box(c, x + 2, yy, w - 4, bh, 1, 11, false); H().icon(c, 'i_key', x + 10, yy + 7); const bt = G.cnW('賭徒寶箱可以免費開了') <= w - 24 ? '賭徒寶箱可以免費開了' : '免費寶箱來了'; G.cn(c, bt, x + 18, yy + 1, 11); }
          }
        },
        {
          t: '稀有度', m: '角色外框顏色代表稀有度：{w:白 普通}、{g:綠 稀有}、{p:紫 史詩}、{o:橘 傳說}、{m:七彩 神話}',
          draw(c, x, y, w, h, t) {
            const ex = ['leafblower', 'stemskewer', 'peasniper', 'iceshooter', 'necroleafy'], gw = Math.min(40, (w - 6) / 5), x0 = Math.round(x + w / 2 - gw * 2.5), gy = y + h * 0.62;
            ex.forEach((n, i) => {
              const s = G.SPR[G.VIS[n].spr][((gt * 3) | 0) % 2], r = G.RARITY[i], gl = G.rarGlow(s.n, i, 1, 2), px = Math.round(x0 + gw * i + gw / 2 - s.w / 2), py = Math.round(gy - s.h);
              c.globalAlpha = 0.75 + Math.sin(gt * 4 + i) * 0.25; c.drawImage(gl.c, px - gl.p, py - gl.p); c.globalAlpha = 1; c.drawImage(s.n, px, py);
              G.cnRar(c, r.n, x0 + gw * i + gw / 2, gy + 6, i, 0.5);
            });
          }
        },
        {
          // v2.8 開箱光色：箱縫的光一階一階升級，停在哪個顏色就是開到的稀有度
          t: '開箱光色', m: '箱縫的光會{升級}：白→{g:綠}→{p:紫}→{o:橘}→{m:七彩}，停在哪色就開到哪個稀有度',
          draw(c, x, y, w, h, t) {
            const T = t % 5.5, st = T < 1.2 ? 0 : Math.min(4, 1 + (((T - 1.2) / 0.8) | 0)), col = [9, 11, 17, 14, -1][st], cx = Math.round(x + w / 2), gy = Math.round(y + h * 0.72);
            const sx = Math.round(Math.sin(gt * 48) * (0.5 + st * 0.5));
            G.Store.drawChest(c, 'hero', cx + sx, gy, 2, false, col, 0.5 + st * 0.12);
            c.fillStyle = col < 0 ? P[[10, 14, 13, 11, 12, 17][((gt * 8) | 0) % 6]] : P[col]; c.globalAlpha = 0.9;
            for (let q = -3; q <= 3; q++) { const hh = Math.round((4 + st * 2) * (1 - Math.abs(q) * 0.2) * (0.8 + Math.sin(gt * 30 + q) * 0.2)); c.fillRect(cx + sx + q * 6, gy - 22 - hh, 1, hh); }
            c.globalAlpha = 1;
            if (st) G.cnRar(c, G.RARITY[st].n, cx, y + 2, st, 0.5); else G.cn(c, '白光：還看不出來', cx, y + 2, 7, 0.5);
          }
        },
        {
          t: '植物點數', m: '每隻小兵要花點數，隊伍{上限 12 點}',
          draw(c, x, y, w, h, t) {
            const used = 2 + ((t * 1.5) | 0) % 11, max = 12, pw = 8, x0 = Math.round(x + w / 2 - max * (pw + 1) / 2), y0 = Math.round(y + h / 2 - 4);
            for (let i = 0; i < max; i++) { c.fillStyle = P[0]; c.fillRect(x0 + i * (pw + 1), y0, pw, 8); c.fillStyle = P[i < used ? (used >= max ? 14 : 13) : 3]; c.fillRect(x0 + i * (pw + 1), y0 + 1, pw, 6); }
            G.text(c, used + '/' + max, x + w / 2, y0 + 14, used >= max ? 14 : 9, 2, 0, 0.5);
          }
        },
        {
          t: '選擇路線', m: '小兵頁的陣容分成上、中、下三欄，{點一欄}就會亮黃色',
          draw(c, x, y, w, h, t, dk) {
            const L = ((t / 1.3) | 0) % 3, rw = Math.min(w - 16, 190), x0 = Math.round(x + w / 2 - rw / 2), y0 = Math.round(y + h / 2 - 20);
            laneCols(c, x0, y0, rw, [['leafblower'], ['seedshooter'], ['treeprotector', 'leafblower']], L);
            const cw = Math.floor((rw - 6) / 3); ptr(dk)(c, x0 + L * (cw + 3) + cw / 2, y0 + 7, (t % 1.3) < 0.2);
          }
        },
        {
          t: '加入小兵', m: '小兵轉到中間，按「{加入}」就放進亮黃色那路；{花費點數}寫在名字下方',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.6, rw = Math.min(w - 16, 190), x0 = Math.round(x + w / 2 - rw / 2), y0 = y + 4, added = T > 2, sm = h < 100, by = y0 + (sm ? 14 : 29);
            const nw = G.cnW(G.nameOf('fruitpult')), nx = sm ? x0 + rw / 2 - (nw + 30) / 2 : x0 + rw / 2 - nw / 2;
            G.cn(c, G.nameOf('fruitpult'), nx, y0, 9); if (sm) { c.drawImage(G.SPR.leaf_pt.n, nx + nw + 6, y0 + 3); G.cn(c, '4點', nx + nw + 15, y0, 13); } else { c.drawImage(G.SPR.leaf_pt.n, x0 + rw / 2 - 12, y0 + 16); G.cn(c, '4點', x0 + rw / 2 - 3, y0 + 13, 13); }
            yBtn(c, Math.round(x0 + rw / 2 - 40), by, 80, 15, '＋ 加入中路');
            laneCols(c, x0, by + 20, rw, [['leafblower'], added ? ['seedshooter', 'fruitpult'] : ['seedshooter'], []], 1);
            if (T < 2.4) ptr(dk)(c, Math.round(lerp(x + w, x0 + rw / 2, ss(seg(T, 0.2, 1.4)))), by + 8, T > 1.8 && T < 2.0);
          }
        },
        {
          t: '移出小兵', m: '{點一下陣容裡小兵頭像}（右上{r:紅色 ×}），就能移出隊伍',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3, rw = Math.min(w - 16, 190), x0 = Math.round(x + w / 2 - rw / 2), y0 = Math.round(y + h / 2 - 20);
            laneCols(c, x0, y0, rw, [T < 1.2 ? ['leafblower', 'seedshooter'] : ['leafblower'], ['seedshooter'], []], 0);
            const cw = Math.floor((rw - 6) / 3), per = Math.max(1, Math.floor((cw - 4) / 18)), ox = x0 + Math.round((cw - per * 18 + 2) / 2);
            if (T < 1.5) ptr(dk)(c, Math.round(lerp(x + w, ox + 18 + 14, ss(seg(T, 0.1, 0.8)))), y0 + 17, T > 0.9 && T < 1.2);
          }
        },
        {
          t: '技能展示', m: '按「{技能展示}」或點技能按鈕，會跳出展示視窗；{切換下方圖示}看每招的動畫與數值',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4, open = T > 0.9, pw = Math.min(w - 20, 150), px = Math.round(x + w / 2 - pw / 2);
            if (!open) { H().key(c, px + pw / 2 - 30, y + h / 2 - 8 + (T > 0.7 ? 1 : 0), 60, 16, T > 0.7, 7); G.cn(c, '技能展示', px + pw / 2, y + h / 2 - 6 + (T > 0.7 ? 1 : 0), 9, 0.5); ptr(dk)(c, Math.round(lerp(x + w, px + pw / 2, ss(seg(T, 0.1, 0.6)))), Math.round(y + h / 2), T > 0.7); return; }
            const ph = Math.min(h - 8, 74), py = Math.round(y + h / 2 - ph / 2), sh = ph - 32, si = T > 2.3 ? 1 : 0;
            H().box(c, px, py, pw, ph, 1, 7); G.cn(c, '力夫', px + 5, py + 2, 9); G.cn(c, '技能展示', px + pw - 5, py + 2, 13, 1);
            c.drawImage(G.groundStrip(pw - 10, sh), px + 5, py + 15);
            unit(c, 'leafy', px + pw * 0.3, py + 15 + sh * 0.8, false); unit(c, 'bear', px + pw * 0.75, py + 15 + sh * 0.8, false, -1);
            const q = (T * 1.4) % 1, s2 = si ? G.SPR.mistic[0] : G.SPR.magicball; c.drawImage(s2.n, Math.round(lerp(px + pw * 0.3 + 6, px + pw * 0.72, q) - s2.w / 2), Math.round(py + 15 + sh * 0.8 - 10 - s2.h / 2));
            ['i_attack', 'i_mistic', 'i_slam'].forEach((ic, k) => { const bx = px + pw / 2 - 31 + k * 22; H().key(c, bx, py + ph - 16, 18, 14, k === si, k === si ? 13 : 6); H().icon(c, ic, bx + 9, py + ph - 9); });
            if (T > 1.8 && T < 2.5) ptr(dk)(c, px + pw / 2 - 31 + 22 + 9, py + ph - 8, T > 2.1 && T < 2.3);
          }
        },
        {
          t: '圖鑑', m: '{左右滑動}查看首領、小怪、塔、野怪與獵手；上方切到「{藥水}」可以看全部藥水的效果和價格',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.2, cat = ((t / 3.2) | 0) % 3, names = [['tiger', 'lion', 'cat'], ['babybear', 'eagle', 'boar'], ['gorilla', 'hippo', 'polarbear']][cat];
            const tw = Math.min(42, (w - 12) / 4), x0 = Math.round(x + w / 2 - tw * 2);
            ['BOSS', '小怪', '塔', '野怪'].forEach((s2, i) => { const on = i === [0, 1, 3][cat]; H().key(c, x0 + i * tw, y + 4, tw - 2, 13, on, on ? 9 : 4); G.cn(c, s2, x0 + i * tw + (tw - 2) / 2, y + 4, on ? 9 : 5, 0.5); });
            const pos = ss(seg(T, 0.6, 1.4)), cx = x + w / 2, fl = y + h - 8;
            names.map((n, i) => [n, i]).sort((A, B) => Math.abs(B[1] - pos) - Math.abs(A[1] - pos)).forEach(([n, i]) => {
              const d = i - pos, s2 = G.SPR[G.VIS[n].spr][0], sc = Math.abs(d) < 0.5 ? 2 : 1, fw = s2.w * sc, fh = s2.h * sc, px = cx + d * 40;
              if (fh > h - 30) return unit(c, n, px, fl, false);
              c.drawImage(s2.n, Math.round(px - fw / 2), Math.round(fl - fh), fw, fh);
              if (Math.abs(d) > 0.3) { c.globalAlpha = 0.6; c.drawImage(G.glowOf(s2.n, 0, 1, 2).tint, Math.round(px - fw / 2), Math.round(fl - fh), fw, fh); c.globalAlpha = 1; }
            });
            if (T > 0.3 && T < 1.5) ptr(dk)(c, Math.round(lerp(cx + 30, cx - 20, ss(seg(T, 0.5, 1.4)))), Math.round(fl - 12), T > 0.5 && T < 1.4);
          }
        }
      ]
    },
    {
      name: '系統', pages: [
        {
          t: '首頁選單', m: '首頁選單可以{上下滑動}，轉到中間{亮黃色的按鈕}，再點一下進入', d: '用{滑鼠滾輪、拖曳或上下鍵}轉動選單，點中間{亮黃色的按鈕}進入',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4.2, items = [['i_play', '單人'], ['i_users', '多人'], ['i_tree', '隊伍'], ['i_key', '商店'], ['i_trophy', '成就']];
            const pos = 2 * ss(seg(T, 0.5, 1.4)) - 2 * ss(seg(T, 3.3, 4.0)), cx = Math.round(x + w / 2), cy = Math.round(y + h / 2), bw = 86, bh = 14, step = 18, press = T > 2.1 && T < 2.3;
            c.fillStyle = P[9]; c.globalAlpha = 0.06; c.fillRect(cx - 56, cy - 10, 112, 20); c.globalAlpha = 1;
            c.save(); c.beginPath(); c.rect(x, y + 4, w, h - 8); c.clip();
            items.forEach(([ic, n], i) => {
              const d = i - pos, ad = Math.abs(d); if (ad > 2.6) return;
              const ctr = ad < 0.5, w2 = bw - Math.round(Math.min(ad, 2) * 8), xx = Math.round(cx - w2 / 2), yy = Math.round(cy - bh / 2 + d * step) + (ctr && press ? 1 : 0);
              if (ctr) { c.fillStyle = P[Math.sin(gt * 4) > 0 ? 13 : 14]; c.fillRect(xx - 1, yy - 1, w2 + 2, bh + 2); }
              H().box(c, xx, yy, w2, bh, ctr ? 2 : 1, ctr ? 13 : 5); H().icon(c, ic, xx + 9, yy + 7); G.cn(c, n, xx + 19, yy + 1, ctr ? 9 : 7);
              if (!ctr) { c.fillStyle = 'rgba(12,12,12,' + Math.min(0.5, ad * 0.24).toFixed(3) + ')'; c.fillRect(xx, yy, w2, bh); }
            });
            c.restore();
            c.fillStyle = P[13]; for (let k = 0; k < 4; k++) { c.fillRect(cx - bw / 2 - 8 + k, cy - 3 + k, 1, 7 - k * 2); c.fillRect(cx + bw / 2 + 7 - k, cy - 3 + k, 1, 7 - k * 2); }
            if (T > 0.3 && T < 1.5) { const fy = Math.round(lerp(cy + 26, cy - 10, ss(seg(T, 0.5, 1.4)))); dk ? cursor(c, cx + 30, fy, true) : hand(c, cx + 30, fy, true); }
            else if (T > 1.8 && T < 2.5) ptr(dk)(c, cx + 20, cy + 2, press);
          }
        },
        {
          t: '成就', m: '完成挑戰就會{解鎖成就}；{累計遊玩、擊倒首領、推塔}都算進度',
          draw(c, x, y, w, h, t) {
            const T = t % 3.6, f = ss(seg(T, 0.3, 1.6)), done = T > 1.6, cw = w - 16, cx = x + 8;
            achCard(c, cx, y + 10, cw, '首領獵人', '累計擊倒 10 隻首領', done ? 1 : 0, Math.round(lerp(4, 10, f)), 10, 2);
            achCard(c, cx, y + 50, cw, '拆遷大隊', '累計推倒 20 座敵塔', 0, 7, 20, 2);
            if (done && T < 2.6) { const k = seg(T, 1.6, 2.6); c.globalAlpha = 1 - k; G.cn(c, '成就達成！', x + w / 2, y + 2 - Math.round(k * 4), 13, 0.5); c.globalAlpha = 1; for (let i = 0; i < 6; i++) { const a = i * 1.05 + T, r = 10 + k * 26; c.fillStyle = P[13]; c.fillRect(Math.round(cx + 12 + Math.cos(a) * r), Math.round(y + 22 + Math.sin(a) * r * 0.6), 1, 1); } }
          }
        },
        {
          t: '領取鑰匙', m: '達成的成就按「{領取}」拿鑰匙：銅 {1}、銀 {2}、金 {3}、傳說 {5} 把',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 3.4, got = T > 1.2, cw = w - 16, cx = x + 8, keys = got && T > 1.8 ? 7 : 4, kx = x + w - 30, ky = y + 4;
            H().box(c, kx, ky, 26, 12, 0, 13); H().icon(c, 'i_key', kx + 7, ky + 6); G.text(c, keys, kx + 22, ky + 4, 13, 1, null, 1);
            achCard(c, cx, y + 26, cw, '千人斬', '累計擊倒 1000 個敵人', got ? 2 : 1, 1000, 1000, 3, T > 1.0 && T < 1.2);
            if (!got) ptr(dk)(c, cx + cw - 20, y + 34, T > 0.9 && T < 1.2);
            for (let i = 0; i < 3; i++) { const k = seg(T, 1.2 + i * 0.1, 1.8 + i * 0.1); if (k <= 0 || k >= 1) continue; const e = ss(k); H().icon(c, 'i_key', Math.round(lerp(cx + cw - 20, kx + 7, e)), Math.round(lerp(y + 33, ky + 6, e) - Math.sin(k * Math.PI) * 14)); }
          }
        },
        {
          t: '隱藏成就', m: '顯示「{？？？}」的是{隱藏成就}，只給一句提示，達成後才揭曉',
          draw(c, x, y, w, h, t) {
            const T = t % 3.6, rev = T > 1.8, cw = w - 16, cx = x + 8;
            achCard(c, cx, y + 26, cw, rev ? '絕地大反攻' : '？？？', rev ? '聖樹快倒時逆轉勝' : '最危險時別放棄。', rev ? 1 : 0, 0, 1, 3, false, !rev);
            if (T > 1.6 && T < 2.4) { const k = seg(T, 1.6, 2.4); c.globalAlpha = 1 - k; c.fillStyle = P[9]; c.fillRect(cx, y + 26, cw, 30); c.globalAlpha = 1; }
          }
        },
        {
          t: '存檔碼', m: '首頁「{存檔}」→「{產生存檔碼}」，取個名字後按「{複製}」保存',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4.4, cx = x + 10, cw = w - 20;
            if (T < 1.8) {
              G.cn(c, '幫存檔取個名字', x + w / 2, y + 8, 13, 0.5);
              const nm = 'Pai'.slice(0, Math.floor(seg(T, 0.2, 0.9) * 3.99)); H().box(c, cx, y + 26, cw, 18, 0, 13, false); G.cn(c, nm + (((gt * 3) | 0) % 2 ? '|' : ''), cx + 5, y + 29, 9);
              yBtn(c, x + w / 2 - 30, y + 54, 60, 16, '下一步'); if (T > 1.0) ptr(dk)(c, x + w / 2, y + 62, T > 1.3 && T < 1.6);
            } else {
              G.cn(c, '存檔碼', x + w / 2, y + 6, 13, 0.5);
              H().box(c, cx, y + 22, cw, 30, 0, 13, false); G.text(c, 'LW1Z-K7Q2X9VMA3R8TW5', cx + 4, y + 27, 13); G.text(c, 'NB4C6YHD2PE8QJ-9FA2', cx + 4, y + 35, 13); G.text(c, 'ZMXK3...', cx + 4, y + 43, 13);
              const cp = T > 3.0; if (cp) { H().box(c, x + w / 2 - 30, y + 60, 60, 16, 11, 0); G.cn(c, '已複製！', x + w / 2, y + 62, 0, 0.5); } else yBtn(c, x + w / 2 - 30, y + 60, 60, 16, '複製');
              if (T > 2.4 && T < 3.3) ptr(dk)(c, x + w / 2, y + 68, T > 2.8 && T < 3.0);
            }
          }
        },
        {
          t: '讀取存檔', m: '在「讀取存檔碼」按「{貼上}」，就會自動讀取', d: '在「讀取存檔碼」直接按 {Cmd+V} 或 {Ctrl+V}，會自動讀取',
          draw(c, x, y, w, h, t, dk) {
            const T = t % 4.4, cx = x + 10, cw = w - 20;
            if (T < 2.4) {
              const pasted = T > 0.9; H().box(c, cx, y + 8, cw, 30, 0, 13, false);
              if (pasted) { G.text(c, 'LW1Z-K7Q2X9VMA3R8TW5', cx + 4, y + 13, 9); G.text(c, 'NB4C6YHD2PE8QJ-9FA2', cx + 4, y + 21, 9); } else G.cn(c, '在這裡貼上存檔碼', cx + 4, y + 13, 4);
              const bw = 56; H().box(c, x + w / 2 - bw - 4, y + 48 + (T > 0.7 && T < 0.9 ? 1 : 0), bw, 16, 1, 7); G.cn(c, '貼上', x + w / 2 - bw / 2 - 4, y + 50, 9, 0.5);
              yBtn(c, x + w / 2 + 4, y + 48, bw, 16, '讀取');
              if (T < 1.1) ptr(dk)(c, x + w / 2 - bw / 2 - 4, y + 56, T > 0.7 && T < 0.9); else if (T < 2.3) ptr(dk)(c, x + w / 2 + 4 + bw / 2, y + 56, T > 1.9 && T < 2.1);
            } else {
              const k = seg(T, 2.4, 2.8); c.fillStyle = P[0]; c.fillRect(x, y, w, h);
              const fr = G.SPR.leafy, f = fr[((gt * 6) | 0) % fr.length], img = G.scaled(f.n, 2); c.drawImage(img, Math.round(x + w / 2 - img.width / 2), Math.round(y + 40 - img.height - Math.abs(Math.sin(gt * 5)) * 4));
              G.pxEllipse(c, x + w / 2, y + 38, Math.round(8 + k * 26), Math.round(3 + k * 9), 13);
              G.cn(c, '歡迎回來', x + w / 2, y + 48, 13, 0.5); G.cn(c, 'Pai', x + w / 2, y + 63, 9, 0.5);
            }
          }
        },
        {
          t: '戰鬥結算', m: '戰鬥結束會顯示{評價（S～D）}、擊殺數據、{拿到的鑰匙與新成就}',
          draw(c, x, y, w, h, t) {
            const T = t % 4.4, cx = x + w / 2;
            const rw = 96, rx = Math.round(cx - rw / 2), k0 = ss(seg(T, 0.1, 0.4)), ry = y + 4 + Math.round((1 - k0) * -20);
            c.fillStyle = P[0]; c.fillRect(rx - 1, ry - 1, rw + 2, 17); c.fillStyle = P[13]; c.fillRect(rx, ry, rw, 15); c.fillStyle = P[14]; c.fillRect(rx, ry + 13, rw, 2);
            G.text(c, 'VICTORY', cx, ry + 4, 0, 2, null, 0.5);
            const cnt = (v, t0) => Math.round(v * ss(seg(T, t0, t0 + 0.5)));
            [['擊殺', 34, 13], ['陣亡', 1, 10], ['助攻', 12, 18]].forEach(([lab, v, col], i) => { if (T < 0.6 + i * 0.12) return; const bx = x + 8 + i * 38; H().box(c, bx, y + 28, 35, 26, 0, 4, false); G.text(c, cnt(v, 0.6 + i * 0.12), bx + 17, y + 31, col, 2, null, 0.5); G.cn(c, lab, bx + 17, y + 41, 6, 0.5); });
            const gk = seg(T, 1.6, 1.8);
            if (gk > 0) { const gs = Math.round(3 + (1 - gk) * 3), gx = x + w - 24, gy2 = y + 41, rr = 12 + Math.round((1 - gk) * 5); c.fillStyle = P[0]; c.fillRect(gx - rr - 1, gy2 - rr - 1, rr * 2 + 2, rr * 2 + 2); c.fillStyle = P[14]; c.fillRect(gx - rr, gy2 - rr, rr * 2, rr * 2); c.fillStyle = P[1]; c.fillRect(gx - rr + 2, gy2 - rr + 2, rr * 2 - 4, rr * 2 - 4); G.text(c, 'S', gx, gy2 - Math.round(gs * 2.5), 14, gs, null, 0.5); }
            if (T > 2.0) { H().icon(c, 'i_key', x + 14, y + 66); G.cn(c, '鑰匙 +3', x + 22, y + 60, 13); H().icon(c, 'i_trophy', x + 14, y + 80); G.cn(c, '成就達成 ×2', x + 22, y + 74, 13); }
          }
        }
      ]
    }
  ];
  // 教學用的成就卡（st：0 未達成、1 可領取、2 已領取）
  function achCard(c, x, y, w, name, desc, st, cur, goal, tier, press, hid) {
    const bar = st === 0 && goal > 1, hh = bar ? 36 : 30; H().box(c, x, y, w, hh, st === 1 ? 2 : 1, st === 1 ? 13 : st === 2 ? 4 : 3, false);
    const col = st ? G.ACH_TIER[tier].c : 3; const my = y + Math.round(hh / 2) - 10; c.fillStyle = P[0]; c.fillRect(x + 3, my, 20, 20); c.fillStyle = P[col]; c.fillRect(x + 4, my + 1, 18, 18); c.fillStyle = P[st ? 1 : 2]; c.fillRect(x + 6, my + 3, 14, 14); H().icon(c, 'i_trophy', x + 13, my + 10, !st);
    G.cn(c, name, x + 27, y + 2, st ? 9 : 7); G.cn(c, G.cnWrap(desc, w - 32)[0], x + 27, y + 15, hid ? 4 : 6);
    if (st === 1) { const bx = x + w - 34, o = press ? 1 : 0; c.fillStyle = P[13]; c.fillRect(bx - 1, y + 2 + o, 32, 14); H().box(c, bx, y + 3 + o, 30, 12, 13, 0, false); G.cn(c, '領取', bx + 15, y + 3 + o, 0, 0.5); }
    else if (st === 2) { H().icon(c, 'i_check', x + w - 38, y + 9); G.cn(c, '已領取', x + w - 4, y + 3, 11, 1); }
    else if (bar) { const ct = cur + '/' + goal; H().bar(c, x + 27, y + hh - 6, w - 35 - G.textW(ct) - 4, 2, cur / goal, 'w'); G.text(c, ct, x + w - 4, y + hh - 8, 6, 1, null, 1); }
    if (st !== 2 && st !== 1) { H().icon(c, 'i_key', x + w - 24, y + 8, true); G.text(c, 'X' + G.ACH_TIER[tier].k, x + w - 17, y + 6, 5); }
  }
  let cat = 0;
  const pagesOf = (ci) => CATS[ci].pages.filter(p => !p.only || (p.only === 'd') === desk);
  M._gt = v => { gt = v; };
  M._guideGo = (ci, pi) => { cat = ci; page = pi; gt = 0; };   // 測試用
  M._guideList = () => CATS.map((k, i) => pagesOf(i).map(p => p.t));
  M.guideTurn = d => {
    const ps = pagesOf(cat);
    page += d;
    if (page >= ps.length) { cat = (cat + 1) % CATS.length; page = 0; }
    else if (page < 0) { cat = (cat + CATS.length - 1) % CATS.length; page = pagesOf(cat).length - 1; }
    gt = 0; G.Audio.play('click');
  };
  // 戰鬥中從暫停選單開教學：返回鍵回到暫停中的戰鬥
  M.openGuide = (fromBattle) => { page = 0; cat = 0; gt = 0; U().guideBack = fromBattle ? () => { U().guideBack = null; U().screen = 'battle'; U().paused = true; } : null; U().screen = 'guide'; };
  M.guide = c => {
    tick(); bg(c);
    const y0 = header(c, '教學'), I = R.ins, L = I.l, Rr = R.uw - I.r, uw = R.uw, uh = R.uh;
    [['手機', false], ['電腦', true]].forEach(([t, v], i) => {
      const x = Rr - 70 + i * 36, on = desk === v;
      H().key(c, x, I.t, 34, 14, on, on ? 9 : 4); G.cn(c, t, x + 17, I.t + 1, on ? 9 : 5, 0.5);
      H().btn('dev' + i, x, I.t, 34, 14, null, () => { desk = v; page = 0; gt = 0; G.Audio.play('click'); });
    });
    // 分類頁籤
    const land = uw > uh * 1.15, tbw = Math.min(Rr - L, 240);
    const ty = tabs(c, Math.round(uw / 2 - tbw / 2), y0, tbw, CATS.map(k => k.name), cat, i => { cat = i; page = 0; gt = 0; });
    const ps = pagesOf(cat); page = Math.min(page, ps.length - 1);
    const sl = ps[page];
    if (G.Ach) G.Ach.on('guide', CATS[cat].name + '/' + sl.t);
    // 直屏：示範框在上、文字在下；橫屏：示範框在左、文字在右（示範框比例與直屏相同，約 1.05:1）
    let iw, ih, ix, iy = ty, tx, tw;
    if (land) {
      ih = uh - ty - I.b - 2; iw = Math.round((ih - 2) * GV_W / GV_H) + 2;
      if (!(R.uiS % 1)) { const f = Math.max(1, Math.floor((ih - 2) * R.uiS / GV_H)), h0 = ih; ih = Math.ceil(GV_H * f / R.uiS) + 2; iw = Math.ceil(GV_W * f / R.uiS) + 2; iy = ty + Math.floor((h0 - ih) / 2); }   // 電腦：框貼合整數倍放大的動畫
      tw = Math.min(180, Rr - L - iw - 10); const tot = iw + 10 + tw; ix = Math.round(uw / 2 - tot / 2); tx = ix + iw + 10; }
    else {                          // 直屏：示範框固定比例（同動畫畫布），太高時整個等比例縮小
      iw = Math.min(Rr - L, 400); ih = Math.round((iw - 2) * GV_H / GV_W) + 2;
      if (ih > uh * 0.45) { ih = Math.round(uh * 0.45); iw = Math.round((ih - 2) * GV_W / GV_H) + 2; }
      ix = Math.round(uw / 2 - iw / 2); tx = L; tw = Rr - L;
    }
    const tl = G.cnWrapRich(desk ? (sl.d || sl.m) : sl.m, tw - 8), textH = 20 + tl.length * 13, navH = 18;   // 文字幾行就留幾行的高度
    // 示範動畫一律畫在固定大小的畫布（= 直屏示範框 168×159），再等比例縮放到示範框：
    // 不論直屏、橫屏或視窗大小，畫面構圖與物件比例都一樣；實際以螢幕原生解析度貼上，保持清晰
    H().box(c, ix, iy, iw, ih, 0, 5, false);
    // 電影格式：動畫本身是寬螢幕（GV_W×GV_A），放在正方形的框裡，上下黑邊
    if (!gvC) gvC = G.canvas(GV_W, GV_A);
    const gc = gvC.getContext('2d'); gc.imageSmoothingEnabled = false; gc.clearRect(0, 0, GV_W, GV_A);
    H().layer && H().layer();
    if (sl.z) {                     // 場景頁：以一半大小繪製後放大 2 倍，角色更大更清楚
      const zw = GV_W / 2, zh = GV_A / 2;
      if (!zoomC) zoomC = G.canvas(zw, zh);
      const zc = zoomC.getContext('2d'); zc.imageSmoothingEnabled = false; zc.clearRect(0, 0, zw, zh);
      zc.drawImage(G.groundStrip(zw, zh), 0, 0); stage(zc, 0, 0, zw, zh, true);
      zL = []; sl.draw(zc, 0, 0, zw, zh, gt, desk);
      gc.drawImage(zoomC, 0, 0, zw * 2, zh * 2);
      const zl = zL; zL = null; zl.forEach(f => f(gc));          // 文字／介面框以原尺寸畫在放大後的畫布上
    } else {
      gc.drawImage(G.groundStrip(GV_W, GV_A), 0, 0); if (!sl.bare) stage(gc, 0, 0, GV_W, GV_A, false);
      sl.draw(gc, 0, 0, GV_W, GV_A, gt, desk);
    }
    vign(gc, 0, 0, GV_W, GV_A);
    H().layer && H().layer();
    // UI 畫布上的備援：黑框＋置中的寬螢幕畫面
    { const k = (iw - 2) / GV_W, ah = Math.round(GV_A * k); c.fillStyle = P[0]; c.fillRect(ix + 1, iy + 1, iw - 2, ih - 2); c.drawImage(gvC, ix + 1, Math.round(iy + 1 + (ih - 2 - ah) / 2), iw - 2, ah); }
    // 原生解析度：以「整數倍」放大（每個像素一樣大，不會粗細不均），置中於示範框
    R.hiQ(ctx => {
      ctx.imageSmoothingEnabled = false;
      const S = R.uiS, bw = (iw - 2) * S, bh = (ih - 2) * S, fr = Math.min(bw / GV_W, bh / GV_H), f = R.uiS % 1 ? fr : Math.max(1, Math.floor(fr)), dw = Math.round(GV_W * f), dh = Math.round(GV_A * f);   // 手機像素很密：直接填滿
      const dx = Math.round((ix + 1) * S + (bw - dw) / 2), dy = Math.round((iy + 1) * S + (bh - dh) / 2);
      ctx.fillStyle = G.PAL[0]; ctx.fillRect(Math.round((ix + 1) * S), Math.round((iy + 1) * S), Math.round(bw), Math.round(bh));
      ctx.drawImage(gvC, dx, dy, dw, dh);
      ctx.fillStyle = G.PAL[3]; ctx.fillRect(dx, dy - Math.max(1, f >> 1), dw, Math.max(1, f >> 1)); ctx.fillRect(dx, dy + dh, dw, Math.max(1, f >> 1));   // 黑邊與畫面的細分隔線
    });
    const tcx = tx + tw / 2, tty = land ? iy + 4 : iy + ih + 5;
    G.cn(c, sl.t, tcx, tty, 13, 0.5);
    tl.forEach((l, i) => G.cnRich(c, l, tcx, tty + 15 + i * 13, 8, 0.5));   // v2.7 {重點} 上色
    // 換頁（橫屏：放在文字欄底部；直屏：文字下方）
    const ny = land ? iy + ih - 16 : tty + textH + 2, n = ps.length, nx0 = land ? tx : ix, nw = land ? tw : iw;
    const st = Math.max(4, Math.min(8, Math.floor((nw - 60) / n)));   // 頁點間距：放不下就縮小，不壓到左右按鈕
    for (let i = 0; i < n; i++) { c.fillStyle = P[i === page ? 9 : 4]; c.fillRect(Math.round(nx0 + nw / 2 - n * st / 2 + i * st), ny + 6, i === page ? Math.min(5, st - 1) : Math.min(3, st - 1), 3); }
    G.text(c, (page + 1) + '/' + n, nx0 + nw / 2, ny - 2, 4, 1, null, 0.5);
    [['<', -1, nx0], ['>', 1, nx0 + nw - 24]].forEach(([s, d, x]) => {
      const id = 'pg' + d, p = pr(id) ? 1 : 0;
      H().key(c, x, ny + p, 24, 16, p, 6); G.text(c, s, x + 12, ny + 5 + p, 9, 1, null, 0.5);
      H().btn(id, x, ny, 24, 16, () => { U().press[id] = 0.12; }, () => M.guideTurn(d));
    });
  };

  M.key = k => {
    const s = U().screen;
    if ((k === 'escape' || k === 'backspace') && s === 'store' && G.Store.esc()) return;
    if (s === 'menu' && devAsk) { if (/^[0-9]$/.test(k)) devInput(k); else if (k === 'backspace') devInput('del'); else if (k === 'escape') devAsk = null; return; }
    if (s === 'menu' && setOpen) { if (k === 'escape' || k === 'enter' || k === 'backspace') setOpen = false; return; }
    if (s === 'tap') { G.Intro.start(); return; }
    if (s === 'intro') { if (k === 'escape' || k === 'enter' || k === ' ') G.Intro.skip(); return; }
    if ((k === 'escape' || k === 'backspace') && s === 'save' && G.SaveUI.esc()) return;
    if ((k === 'escape' || k === 'backspace') && s === 'ach' && G.AchUI.esc()) return;
    if (k === 'escape' || k === 'backspace') { if (demo) { demo = null; sbKey = ''; } else if (info) info = null; else if (picker) picker = null; else if (s === 'guide' && U().guideBack) U().guideBack(); else if (s !== 'menu') U().goMenu(); return; }
    if ((s === 'team' || s === 'book') && !demo) { car = cars[s]; if (k === 'arrowright' || k === 'd') M.carStep(1); if (k === 'arrowleft' || k === 'a') M.carStep(-1); }
    if (s === 'menu' && !resetAsk && !setOpen && modal <= 0 && !(G.SaveUI && G.SaveUI.welcome)) { if (k === 'arrowdown' || k === 's') mw.step(1); if (k === 'arrowup' || k === 'w') mw.step(-1); if (k === 'enter' || k === ' ') runItem(mw.idx()); if (k === '1') U().start(); }
    if (s === 'guide') { if (k === 'arrowright') M.guideTurn(1); if (k === 'arrowleft') M.guideTurn(-1); }
  };
  M.covers = s => s === 'team' || s === 'book' || s === 'guide' || s === 'store' || s === 'ach' || s === 'save' || s === 'intro' || s === 'tap';
  // 給其他模組（成就、存檔、開場動畫）共用的元件
  M.ui = { resetCars: () => { cars.team.inited = false; cars.book.inited = false; }, tick: () => tick(), pr, tap, bg, header, btnPrimary, btnSecondary, tabs, scrollDetail, SM, gt: () => gt, land, sprFit, go: s2 => go(s2) };
  M.guidePageCount = () => CATS.reduce((a, k, i) => a + pagesOf(i).length, 0);
  M.store = c => { tick(); bg(c); const y0 = header(c, '商店'); G.Store.draw(c, y0, M.dt, gt); };
  return M;
})();
