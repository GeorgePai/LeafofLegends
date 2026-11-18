'use strict';
/* =========================================================
   商店：花鑰匙開寶箱取得角色
   - 賭徒寶箱（1 把）：開出 0～5 把鑰匙
   - 英雄寶箱（5 把）／小兵寶箱（3 把）：抽一隻「還沒擁有」的角色
   - 某稀有度全部擁有後，該機率按比例分給其他稀有度
   ========================================================= */
G.CHESTS = [
  { id: 'gamble', n: '賭徒寶箱', cost: 1, col: 10, d: '碰碰運氣，可能開出 0～5 把鑰匙。', keys: [44, 26, 15, 9, 4, 2] },   // 平均拿回約 1.09 把（玩家福利，不寫進說明）
  { id: 'hero', n: '英雄寶箱', cost: 5, col: 13, d: '獲得一位還沒擁有的英雄。', pool: 'h', rates: [0, 60, 30, 10] },
  { id: 'minion', n: '小兵寶箱', cost: 3, col: 11, d: '獲得一隻還沒擁有的小兵。', pool: 'm', rates: [0, 50, 35, 15] }
];
// ---------- 賭徒寶箱：每 5 分鐘免費開一次（v2.3）----------
// 以真實時間計算（關掉遊戲也會計時）；免費時間一到就廣播（首頁頂端橫幅／戰鬥中廣播）
G.FREE_GAP = 300;
G.FreeChest = {
  // v2.5：免費時間另外存在 leafwar_fc（不跟存檔碼、RESET 走），讀存檔碼不會再把免費寶箱刷新
  last() { let l = 0; try { l = +localStorage.getItem('leafwar_fc') || 0; } catch (e) { } return Math.max(l, G.Team.get().fc || 0); },
  left() { return Math.max(0, G.FREE_GAP - (Date.now() - this.last()) / 1000); },
  ready() { return this.left() <= 0; },
  use() { const n = Date.now(); G.Team.get().fc = n; try { localStorage.setItem('leafwar_fc', String(n)); } catch (e) { } G.Team.save(); this.was = false; },
  tick() {
    const r = this.ready();
    if (this.was === false && r) {                    // 這次遊玩中「剛好到時間」才廣播（開遊戲時已經可以開就不洗版，商店選項有紅點）
      const W = G.W;
      if (G.UI.screen === 'battle' && W && !W.attract) W.say({ s: '賭徒寶箱可以免費開了', ic: 'i_key', col: 11, t: 3 });
      else if (G.Ach) G.Ach.queueBanner({ free: true, t: 0 });
      G.Audio.play('keyGet');
    }
    this.was = r;
  }
};
G.Store = (() => {
  const S = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, U = () => G.UI;
  let info = null, op = null, gt = 0;
  const pr = id => U().press[id] > 0;
  const tap = (id, x, y, w, h, fn) => H().btn(id, x, y, w, h, () => { U().press[id] = 0.12; G.Audio.play('click'); }, fn);

  // ---------- 機率 ----------
  const all = ch => ch.pool === 'h' ? G.HEROES.map(h => h.name) : G.ROSTER.minions;
  const realOwns = n => { const v = G.Team.get(); return v.owned.h.includes(n) || v.owned.m.includes(n); };
  const left = ch => all(ch).filter(n => !realOwns(n));
  // 目前實際機率（扣掉已全部擁有的稀有度後重新分配）
  S.effRates = ch => {
    const L = left(ch), cnt = [0, 1, 2, 3].map(r => L.filter(n => G.rarityOf(n) === r).length);
    const w = ch.rates.map((p, r) => cnt[r] ? p : 0), sum = w.reduce((a, b) => a + b, 0);
    return { pct: w.map(v => sum ? v / sum * 100 : 0), cnt };
  };
  const roll = ws => { const s = ws.reduce((a, b) => a + b, 0); let r = Math.random() * s; for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) return i; } return ws.length - 1; };
  const canOpen = ch => G.Team.keys() >= ch.cost && (!ch.pool || left(ch).length > 0);
  function open(ch, free) {
    if (free && !(ch.id === 'gamble' && G.FreeChest.ready())) free = false;
    if (!free && !canOpen(ch)) { G.Audio.play('deny'); return; }
    const k0 = G.Team.keys();
    if (free) G.FreeChest.use(); else G.Team.spend(ch.cost);
    let res;
    if (!ch.pool) { const n = roll(ch.keys); res = { keys: n }; G.Team.addKeys(n); }
    else {
      const e = S.effRates(ch), tier = roll(e.pct), cand = left(ch).filter(n => G.rarityOf(n) === tier), name = G.pick(cand);
      res = { name, tier }; G.Team.grant(name);
    }
    op = { ch, res, t: 0, pt: 0, ps: [], shake: 0, k0, got: 0, free: !!free };
    if (G.Ach) G.Ach.on('chest', res);
  }
  S.esc = () => { if (op) { if (op.t < 2.75) op.t = 2.75; else op = null; return true; } if (info) { info = null; return true; } return false; };

  // ---------- 寶箱美術（程序像素圖，關 / 開兩種）----------
  const CHEST_COL = { gamble: { b: 15, l: 10, k: 1, t: 13 }, hero: { b: 14, l: 13, k: 15, t: 9 }, minion: { b: 16, l: 11, k: 2, t: 7 } };
  const _spr = {};
  function chestSpr(id, opened) {
    const key = id + opened; if (_spr[key]) return _spr[key];
    const c = CHEST_COL[id], W = 26, Hh = 22, Pn = G.Painter(W, Hh);
    if (!opened) {
      Pn.r(2, 4, 22, 7, c.l); Pn.r(4, 3, 18, 1, c.l); Pn.r(2, 9, 22, 2, c.b);
      Pn.r(2, 11, 22, 10, c.b); Pn.r(2, 19, 22, 2, c.k);
      Pn.r(5, 3, 2, 18, c.t); Pn.r(19, 3, 2, 18, c.t); Pn.r(2, 10, 22, 1, c.t);
      Pn.r(11, 9, 4, 5, c.t); Pn.px(12, 11, 0); Pn.px(13, 11, 0); Pn.px(12, 12, 0);
      if (id === 'gamble') { Pn.r(10, 4, 6, 5, 9); Pn.px(11, 5, 0); Pn.px(14, 7, 0); Pn.px(12, 6, 0); Pn.px(13, 6, 0); }
      if (id === 'hero') { Pn.r(10, 6, 6, 2, 13); Pn.px(10, 5, 13); Pn.px(12, 4, 13); Pn.px(13, 4, 13); Pn.px(15, 5, 13); Pn.px(11, 6, 10); Pn.px(14, 6, 12); }
      if (id === 'minion') { Pn.e(13, 6, 3, 2, 11); Pn.l(10, 8, 15, 4, 16); }
    } else {
      Pn.r(2, 0, 22, 5, c.k); Pn.r(5, 0, 2, 5, c.t); Pn.r(19, 0, 2, 5, c.t); Pn.r(3, 5, 20, 6, 0);
      Pn.r(2, 11, 22, 10, c.b); Pn.r(2, 19, 22, 2, c.k); Pn.r(5, 11, 2, 10, c.t); Pn.r(19, 11, 2, 10, c.t); Pn.r(2, 11, 22, 1, c.t);
      Pn.r(11, 11, 4, 4, c.t); Pn.px(12, 12, 0); Pn.px(13, 12, 0);
    }
    const sp = G.spriteFromGrid(Pn.g, W, Hh, { outline: 0 }); shade(sp.n, opened);
    return (_spr[key] = sp);
  }
  // 立體光影（v2.3）：左上受光、右側背光；依像素分帶（保持像素感），黑色外框不動
  function shade(cv, opened) {
    const x = cv.getContext('2d'), W = cv.width, Hh = cv.height, d = x.getImageData(0, 0, W, Hh), a = d.data;
    for (let yy = 0; yy < Hh; yy++) for (let xx = 0; xx < W; xx++) {
      const o = (yy * W + xx) * 4; if (!a[o + 3]) continue;
      const r = a[o], g = a[o + 1], b = a[o + 2]; if (r + g + b < 40) continue;          // 外框、鎖孔
      let f = 1;
      if (xx <= 4) f = 1.28; else if (xx <= 7) f = 1.1; else if (xx >= W - 4) f = 0.62; else if (xx >= W - 7) f = 0.8;
      if (!opened && yy <= 4) f *= 1.22;                                                   // 箱蓋頂面受光
      if (yy >= Hh - 4) f *= 0.82;                                                         // 底部接地暗
      a[o] = Math.min(255, r * f); a[o + 1] = Math.min(255, g * f); a[o + 2] = Math.min(255, b * f);
    }
    // 金屬亮點（左上角邊條各一顆白點）
    x.putImageData(d, 0, 0);
  }
  // 箱蓋（開箱時飛走用）：關閉圖的上半部
  const _lid = {};
  function lidImg(id, k) {
    const key = id + k; if (_lid[key]) return _lid[key];
    const s = chestSpr(id, false), cv = G.canvas(s.w, 12); cv.getContext('2d').drawImage(s.n, 0, 0);
    return (_lid[key] = G.scaled(cv, k));
  }
  // sq：垂直縮放（擠壓／伸展，以底部為支點）
  function drawChest(c, id, cx, by, k, opened, glowCol, glowA, sq = 1, noLid) {
    const s = chestSpr(id, opened), img0 = G.scaled(s.n, k), cut = noLid ? 6 * k : 0, img = cut ? cropTop(img0, cut) : img0, w = img.width, h = img.height, x = Math.round(cx - w / 2), y = Math.round(by - h);
    if (glowCol != null && glowA > 0) { const gl = G.glowOf(img, glowCol, 1, 3); c.globalAlpha = Math.min(1, glowA); c.drawImage(gl.c, x - gl.p, y - gl.p); c.globalAlpha = 1; }
    if (sq !== 1) { const sw = Math.round(w * (2 - sq) * 0.5 + w * 0.5), sh = Math.round(h * sq); c.drawImage(img, Math.round(cx - sw / 2), by - sh, sw, sh); }
    else c.drawImage(img, x, y);
    return [x, y, w, h];
  }
  // 去掉上面幾列（開箱後箱蓋已經飛走）
  const _crop = new Map();
  function cropTop(img, n) { let m = _crop.get(img); if (!m) _crop.set(img, m = {}); if (m[n]) return m[n]; const cv = G.canvas(img.width, img.height - n); cv.getContext('2d').drawImage(img, 0, -n); return (m[n] = cv); }
  // 地面影子（寶箱跳起來時變小變淡）
  function groundShadow(c, cx, by, w, lift) { const k = 1 / (1 + lift / 14); G.pxDisc(c, cx, by + 1, w * 0.46 * k, 3 * k, 0, 0.55 * k); }
  // 四角星
  function star(c, x, y, r, col) { x = Math.round(x); y = Math.round(y); c.fillStyle = P[col]; c.fillRect(x, y - r, 1, r * 2 + 1); c.fillRect(x - r, y, r * 2 + 1, 1); if (r >= 2) { c.fillStyle = P[9]; c.fillRect(x, y, 1, 1); } }
  // 商店待機特效：環繞星光、上飄光點、每隔幾秒跳一下並從箱縫漏光
  const idle = {};
  function idleFx(c, i, ch, cx, by, k, ok, dt) {
    const st = idle[i] = idle[i] || { ps: [], hop: 1.2 + i * 1.1 };
    st.hop -= dt; let lift = 0, sq = 1, leak = 0;
    if (ok) {
      if (st.hop < 0) { const t = -st.hop;
        if (t < 0.12) { sq = 1 - t / 0.12 * 0.18; }                                        // 蹲
        else if (t < 0.5) { const f = (t - 0.12) / 0.38; lift = Math.sin(f * Math.PI) * 7; sq = 1.08 - f * 0.08; leak = Math.sin(f * Math.PI); }   // 跳＋漏光
        else if (t < 0.62) { sq = 1 - Math.sin((t - 0.5) / 0.12 * Math.PI) * 0.12; }      // 落地壓扁
        else { st.hop = 3.2 + Math.random() * 1.5; for (let q = 0; q < 6; q++) st.ps.push({ x: cx + G.rr(-14, 14), y: by - 2, vx: G.rr(-25, 25), vy: G.rr(-30, -10), l: 0.5, m: 0.5, col: 6, dust: 1 }); }
      }
      if (Math.random() < dt * 5) st.ps.push({ x: cx + G.rr(-16, 16) * k / 2, y: by - G.rr(4, 20) * k / 2, vx: 0, vy: G.rr(-14, -6), l: G.rr(0.8, 1.5), m: 1.5, col: Math.random() < 0.4 ? 9 : ch.col });
    }
    const bob = ok ? Math.sin(gt * 2.4 + i) * 1.2 : 0;
    groundShadow(c, cx, by, 26 * k, lift);
    const orb = ok ? 0.45 + Math.sin(gt * 3 + i) * 0.25 + leak * 0.5 : 0;
    drawChest(c, ch.id, cx, Math.round(by - lift + bob), k, false, ch.col, orb, sq);
    if (leak > 0.05) {                                                                     // 箱縫漏光：幾道細光往上
      const sy = Math.round(by - lift + bob - 11 * k); c.globalAlpha = leak * 0.8; c.fillStyle = P[9];
      for (let q = -2; q <= 2; q++) c.fillRect(Math.round(cx + q * 7 - 1 + q * leak * 2), Math.round(sy - leak * 10 * (1 - Math.abs(q) * 0.2)), 1, Math.round(leak * 10 * (1 - Math.abs(q) * 0.2)));
      c.globalAlpha = 1;
    }
    // 環繞星光（兩顆，繞著寶箱轉，後半圈較暗）
    if (ok) for (let q = 0; q < 2; q++) { const a = gt * 1.6 + q * Math.PI + i, ex = cx + Math.cos(a) * 15 * k, ey = by - 10 * k + Math.sin(a) * 4 * k, tw = (Math.sin(gt * 9 + q * 3) + 1) / 2; c.globalAlpha = Math.sin(a) > 0 ? 1 : 0.45; star(c, ex, ey, tw > 0.5 ? 2 : 1, q ? 9 : ch.col); c.globalAlpha = 1; }
    for (let q = st.ps.length - 1; q >= 0; q--) { const p = st.ps[q]; p.l -= dt; if (p.l <= 0) { st.ps.splice(q, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; if (p.dust) p.vy += 60 * dt; c.globalAlpha = Math.min(1, p.l / p.m * 2) * (p.dust ? 0.6 : 0.9); c.fillStyle = P[p.col]; c.fillRect(Math.round(p.x), Math.round(p.y), p.dust ? 2 : 1, p.dust ? 1 : 1); c.globalAlpha = 1; }
  }
  // ---------- 主畫面 ----------
  S.draw = (c, y0, dt, t) => {
    gt = t;
    const uw = R.uw, uh = R.uh, I = R.ins, L = I.l, Rr = uw - I.r, B = uh - I.b, LD = uw > uh * 1.15;
    // 右上：鑰匙數
    const kt = G.Team.dev ? '∞' : String(G.Team.keys()), kw = 22 + G.cnW(kt);
    H().box(c, Rr - kw, I.t, kw, 14, 0, 13); H().icon(c, 'i_key', Rr - kw + 9, I.t + 7); G.cn(c, kt, Rr - 4, I.t + 1, 13, 1);
    if (G.Team.dev) G.text(c, 'DEV', Rr - kw - 4, I.t + 5, 13, 1, 0, 1);
    // 寶箱卡片
    const n = G.CHESTS.length, gap = 4, foot = 14;
    G.CHESTS.forEach((ch, i) => {
      let x, y, w, h;
      if (LD) { w = Math.floor((Rr - L - gap * (n - 1)) / n); h = B - y0 - foot; x = L + i * (w + gap); y = y0; }
      else { w = Rr - L; h = Math.min(98, Math.floor((B - y0 - foot - gap * (n - 1)) / n)); x = L; y = y0 + i * (h + gap); }
      H().box(c, x, y, w, h, 1, ch.col);
      const k = 2, free = ch.id === 'gamble' && G.FreeChest.ready(), ok = canOpen(ch) || free, full = ch.pool && !left(ch).length;
      let tx, ty, tw;
      if (LD) { const cy = y + 8 + 22 * k; idleFx(c, i, ch, x + w / 2, cy, k, ok, dt); tx = x + 6; ty = cy + 6; tw = w - 12; }
      else { const cx = x + 32, cy = y + Math.round(h / 2 + 22 * k / 2) - 2; idleFx(c, i, ch, cx, cy, k, ok, dt); tx = x + 64; ty = y + 5; tw = w - 70; }
      // 偶爾閃一下星光
      G.cn(c, ch.n, tx, ty, ch.col);
      let yy = ty + 15;
      if (!LD) { G.cnWrap(ch.d, tw).slice(0, 2).forEach(l => { G.cn(c, l, tx, yy, 7); yy += 13; }); }
      // 花費
      const cy2 = LD ? yy : y + h - 34;
      if (free) { H().icon(c, 'i_key', tx + 6, cy2 + 6); G.cn(c, '免費', tx + 14, cy2, 11); }
      else {
        H().icon(c, 'i_key', tx + 6, cy2 + 6); G.cn(c, '× ' + ch.cost, tx + 14, cy2, 13);
        if (ch.id === 'gamble') { const L2 = G.FreeChest.left(), mm = (L2 / 60) | 0, ss = Math.ceil(L2 % 60) % 60, tt = (ss === 0 && L2 % 60 > 59 ? mm + 1 : mm) + ':' + String(ss).padStart(2, '0'), lab = '免費 ' + tt;
          const fx = tx + 14 + G.cnW('× ' + ch.cost) + 6; if (fx + G.cnW(lab) <= tx + tw) G.cn(c, lab, fx, cy2, 5); else G.cn(c, tt, tx + tw, cy2, 5, 1); }
      }
      // 按鈕：說明 / 開啟
      const by = y + h - 19, iw = 34, bw = LD ? w - 12 - iw - 4 : Math.min(70, tw - iw - 4), bx = LD ? x + 6 + iw + 4 : x + w - 6 - bw;
      const io = pr('ci' + i) ? 1 : 0; H().key(c, bx - iw - 4, by + io, iw, 15, io, 6); G.cn(c, '說明', bx - iw - 4 + iw / 2, by + 1 + io, 8, 0.5);
      tap('ci' + i, bx - iw - 4, by, iw, 15, () => { info = ch; });
      if (free) { const o = pr('co' + i) ? 1 : 0; c.fillStyle = P[(Math.sin(gt * 6) > 0) ? 11 : 16]; c.fillRect(bx - 1, by - 1 + o, bw + 2, 17); H().key(c, bx, by + o, bw, 15, o, 16, 11, G.tint(16, -0.4)); const fl = G.cnW('免費開啟') <= bw - 4 ? '免費開啟' : '免費'; G.cn(c, fl, bx + bw / 2, by + 1 + o, 0, 0.5); tap('co' + i, bx, by, bw, 15, () => open(ch, true)); }
      else if (ok) { const o = pr('co' + i) ? 1 : 0; c.fillStyle = P[(Math.sin(gt * 6) > 0) ? 13 : 14]; c.fillRect(bx - 1, by - 1 + o, bw + 2, 17); H().key(c, bx, by + o, bw, 15, o, 14, 13, G.tint(14, -0.5)); G.cn(c, '開啟', bx + bw / 2, by + 1 + o, 0, 0.5); tap('co' + i, bx, by, bw, 15, () => open(ch)); }
      else { H().box(c, bx, by, bw, 15, 1, 3, false); const lab0 = full ? '已全部擁有' : '鑰匙不足', lab = G.cnW(lab0) <= bw - 4 ? lab0 : (full ? '已擁有' : '不足'); G.cn(c, lab, bx + bw / 2, by + 1, 4, 0.5); }   // 按鈕太窄時改用短字
    });
    G.cn(c, '※ 不會開到已擁有的角色', uw / 2, B - 12, 5, 0.5);
    if (info) infoPanel(c);
    if (op) openAnim(c, dt);
  };

  // ---------- 機率說明 ----------
  function infoPanel(c) {
    const uw = R.uw, uh = R.uh, I = R.ins, ch = info;
    H().btn('ipBg', 0, 0, uw, uh, null, () => { info = null; });
    H().dim(c, 0.7);
    const w = Math.min(uw - I.l - I.r - 8, 220);
    const rows = ch.pool ? (() => { const e = S.effRates(ch); return [1, 2, 3].map(r => [G.RARITY[r].n, G.RARITY[r].c, e.cnt[r] ? e.pct[r].toFixed(1).replace(/\.0$/, '') + '%' : '已全部擁有', ch.rates[r] + '%', e.cnt[r]]); })()
      : ch.keys.map((p, i) => [i + ' 把鑰匙', i ? 13 : 5, p + '%']);
    const notes = ch.pool ? ['不會開到已擁有的角色。', '某稀有度全部擁有後，它的機率會按比例分給其他稀有度。']
      : [];                                             // 賭徒寶箱：不顯示期望值
    const nl = notes.map(n => G.cnWrap(n, w - 16)), nh = nl.reduce((a, l) => a + l.length * 13, 0);
    const h = 27 + G.cnWrap(ch.d, w - 16).length * 13 + 14 + rows.length * 13 + (nh ? 8 + nh : 0) + 8, x = Math.round(uw / 2 - w / 2), y = Math.round(G.clamp(uh / 2 - h / 2, I.t + 2, uh - h - 2));
    H().box(c, x, y, w, h, 1, ch.col);
    G.cn(c, ch.n, x + 8, y + 4, ch.col); H().icon(c, 'i_key', x + w - 36, y + 10); G.cn(c, '× ' + ch.cost, x + w - 8, y + 4, 13, 1);
    const dl = G.cnWrap(ch.d, w - 16);                // 說明一定要換行（不能超出視窗）
    dl.forEach((l, i) => G.cn(c, l, x + 8, y + 20 + i * 13, 7));
    let yy = y + 27 + dl.length * 13;
    G.cn(c, ch.pool ? '稀有度' : '開出', x + 8, yy, 5); G.cn(c, '機率', x + w - 8, yy, 5, 1); if (ch.pool) G.cn(c, '剩餘', x + w / 2 + 6, yy, 5, 0.5);
    yy += 14;
    rows.forEach((r, i) => {
      if (i % 2 === 0) { c.fillStyle = P[2]; c.fillRect(x + 4, yy - 1, w - 8, 13); }
      G.cn(c, r[0], x + 8, yy - 1, r[1]);
      if (ch.pool) { G.cn(c, r[4] + ' 隻', x + w / 2 + 6, yy - 1, r[4] ? 8 : 4, 0.5); G.cn(c, r[2], x + w - 8, yy - 1, r[4] ? 9 : 4, 1); }
      else G.cn(c, r[2], x + w - 8, yy - 1, 9, 1);
      yy += 13;
    });
    yy += 6;
    nl.forEach(ls => ls.forEach(l => { G.cn(c, l, x + 8, yy, 6); yy += 13; }));
  }

  // ---------- 開箱動畫（v2.3，參考皇室戰爭的節奏）----------
  // 掉落落地（壓扁＋揚塵）→ 蓄力（越搖越大、箱縫漏光、光點往箱子吸）→ 爆開（白閃、箱蓋飛走、衝擊波、光柱、彩紙）→ 獎勵彈出
  const TD = 0.42, TO = 1.45, TB = { name: 2.3, keys: 2.75 };
  function burst(o, cx, cy, col, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = G.rr(sp * 0.3, sp); o.ps.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.4, l: G.rr(0.6, 1.4), m: 1.4, col: Math.random() < 0.3 ? 9 : col }); } }
  function confetti(o, cx, cy, col, n) { const cs = [col, 9, 13, col, 12, 10]; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + G.rr(-1.2, 1.2), v = G.rr(90, 230); o.cf.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: G.rr(-12, 12), l: G.rr(1.2, 2.2), col: cs[i % cs.length] }); } }
  const backOut = f => { const k = 1.9; f = G.clamp(f, 0, 1) - 1; return 1 + (k + 1) * f * f * f + k * f * f; };
  function openAnim(c, dt) {
    const o = op, uw = R.uw, uh = R.uh, I = R.ins, LD = uw > uh * 1.15, k = LD ? 2 : 3, cx = Math.round(uw / 2);
    const by = Math.round(uh - I.b - (LD ? 10 : 40));                // 寶箱放在畫面下方
    const midY = Math.round(LD ? uh * 0.42 : uh * 0.44);             // 開出的東西停在畫面中間
    const pt = o.t; o.t += dt; const T = o.t, cross = th => pt < th && T >= th;
    o.cf = o.cf || []; o.ch2 = o.ch2 || [];
    const tier = o.res.name ? o.res.tier : null, col = o.res.name ? G.RARITY[tier].c : o.res.keys >= 3 ? 13 : o.res.keys ? 9 : 5;
    const nk = o.res.keys || 0, kOut = i => TO + 0.12 + i * 0.1, kArrive = i => 2.05 + i * 0.14, tBtn = o.res.name ? TB.name : TB.keys;
    H().btn('opBg', 0, 0, uw, uh, null, () => { if (o.t < TO) o.t = TO - 0.001; else if (o.t < tBtn) o.t = tBtn; });
    H().dim(c, 1);                                                  // 全黑底
    const rc = by - 20 * k;                                         // 箱口高度
    // ---- 音效與事件 ----
    if (cross(TD)) { G.Audio.play('chestShake', 1, 0); o.land = 1; for (let q = 0; q < 14; q++) o.ps.push({ x: cx + G.rr(-13, 13) * k, y: by - 1, vx: G.rr(-70, 70), vy: G.rr(-40, -8), l: G.rr(0.35, 0.6), m: 0.6, col: 5, dust: 1 }); }
    [0.72, 0.98, 1.2].forEach((th, n) => { if (cross(th)) { G.Audio.play('chestShake', 1, 0); o.shake = 0.6 + n * 0.35; } });
    if (cross(TO)) {
      G.Audio.play('chestOpen', 1, 0); o.flash = 1; const sd = Math.random() < 0.5 ? -1 : 1; o.lid = { x: cx, y: rc + 4 * k, vx: sd * G.rr(110, 160), vy: -300, r: 0, vr: sd * G.rr(7, 11) };
      burst(o, cx, rc, col, tier === 3 ? 90 : 55, tier === 3 ? 180 : 130); confetti(o, cx, rc, col, tier === 3 ? 70 : 40);
      if (o.res.name) setTimeout(() => G.Audio.play('fanfare' + tier, 1, 0), 160); else if (!nk) setTimeout(() => G.Audio.play('dud', 1, 0), 160);
    }
    for (let i = 0; i < nk; i++) { if (cross(kOut(i))) G.Audio.play('coin', 1, 0); if (cross(kArrive(i))) { o.got++; o.bump = 0.25; G.Audio.play('keyGet', 1, 0); } }
    o.shake = Math.max(0, o.shake - dt * 3); o.bump = Math.max(0, (o.bump || 0) - dt); o.land = Math.max(0, (o.land || 0) - dt * 4);
    // ---- 打開後：旋轉光芒＋光柱＋衝擊波 ----
    if (T > TO) {
      const a0 = T * 0.5, rr = Math.max(uw, uh), fin = Math.min(1, (T - TO) * 3);
      c.fillStyle = P[col]; c.globalAlpha = fin * (tier === 3 ? 0.35 : 0.22);
      for (let i = 0; i < 12; i++) { const a = a0 + i * Math.PI / 6; G.pxLine(c, cx, rc, cx + Math.cos(a) * rr, rc + Math.sin(a) * rr, 3); }
      const pl = Math.max(0, 1 - (T - TO) / 0.9);                                   // 光柱：一開箱就往上衝，慢慢收窄淡出
      if (pl > 0) { const pw = Math.round(18 * k * pl + 4); c.globalAlpha = pl * 0.55; c.fillStyle = P[col]; c.fillRect(cx - pw, 0, pw * 2, rc); c.globalAlpha = pl * 0.8; c.fillStyle = P[9]; c.fillRect(cx - Math.round(pw / 3), 0, Math.round(pw * 2 / 3), rc); }
      const sw = (T - TO) / 0.45;                                                   // 衝擊波
      if (sw < 1) { c.globalAlpha = 1 - sw; c.strokeStyle = P[9]; c.lineWidth = Math.max(1, Math.round(4 * (1 - sw))); c.beginPath(); c.ellipse(cx, rc, 8 + sw * uw * 0.55, (8 + sw * uw * 0.55) * 0.45, 0, 0, Math.PI * 2); c.stroke(); }
      c.globalAlpha = 1;
    }
    // ---- 寶箱 ----
    let yy = by, sq = 1, sx = 0, ga = 0;
    if (T < TD) { const f = T / TD; yy = by - (1 - f * f) * (uh * 0.7); sq = 1.12; }   // 掉落（伸長）
    else if (T < TD + 0.16) sq = 1 - Math.sin((T - TD) / 0.16 * Math.PI) * 0.22;        // 落地壓扁
    if (T >= TD && T < TO) {
      const ch = (T - TD) / (TO - TD), amp = (0.5 + ch * 2.5) * (0.4 + o.shake);
      sx = Math.round(Math.sin(T * 48) * amp); ga = ch * (0.55 + Math.sin(T * 22) * 0.3);
      if (Math.random() < dt * (10 + ch * 40)) { const a = Math.random() * 6.28, r = G.rr(40, 80); o.ch2.push({ a, r, l: 0.45 }); }   // 光點往箱子吸
    }
    if (T >= TO && T < TO + 0.4) { const f = (T - TO) / 0.4; sq = f < 0.25 ? 1 - f / 0.25 * 0.28 : 0.72 + backOut((f - 0.25) / 0.75) * 0.28; }   // 爆開：壓扁再彈起
    if (T >= TO) ga = 0.8;
    groundShadow(c, cx, by, 26 * k, Math.max(0, by - yy));
    drawChest(c, o.ch.id, cx + sx, Math.round(yy), k, T >= TO, col, ga, sq, T >= TO);
    if (T >= TD && T < TO) {                                                         // 箱縫漏光（越來越亮）
      const ch = (T - TD) / (TO - TD), sy = by - 11 * k; c.fillStyle = P[9]; c.globalAlpha = 0.3 + ch * 0.7;
      c.fillRect(cx + sx - 10 * k, sy, 20 * k, 1);
      for (let q = -3; q <= 3; q++) { const hh = Math.round(ch * (18 - Math.abs(q) * 4) * k / 2 * (0.8 + Math.sin(T * 30 + q) * 0.2)); if (hh > 0) c.fillRect(cx + sx + q * 3 * k, sy - hh, 1, hh); }
      c.globalAlpha = 1;
    }
    for (let i = o.ch2.length - 1; i >= 0; i--) { const q = o.ch2[i]; q.l -= dt; if (q.l <= 0 || T >= TO) { o.ch2.splice(i, 1); continue; } const r = q.r * (q.l / 0.45); star(c, cx + Math.cos(q.a) * r, rc + 6 + Math.sin(q.a) * r * 0.6, q.l > 0.3 ? 1 : 0, Math.random() < 0.5 ? 9 : col); }
    // ---- 箱蓋飛走 ----
    if (o.lid && T >= TO) { const L = o.lid; L.vy += 520 * dt; L.x += L.vx * dt; L.y += L.vy * dt; L.r += L.vr * dt; if (L.y < uh + 60) { const im = lidImg(o.ch.id, k); c.save(); c.translate(Math.round(L.x), Math.round(L.y)); c.rotate(L.r); c.drawImage(im, -im.width / 2, -im.height / 2); c.restore(); } }
    // ---- 粒子與彩紙 ----
    for (let i = o.ps.length - 1; i >= 0; i--) { const q = o.ps[i]; q.l -= dt; if (q.l <= 0) { o.ps.splice(i, 1); continue; } q.vy += (q.dust ? 90 : 220) * dt; q.x += q.vx * dt; q.y += q.vy * dt; c.globalAlpha = q.dust ? Math.min(1, q.l / q.m * 2) * 0.7 : 1; c.fillStyle = P[q.col]; c.fillRect(Math.round(q.x), Math.round(q.y), 2, q.dust ? 1 : 2); c.globalAlpha = 1; }
    for (let i = o.cf.length - 1; i >= 0; i--) { const q = o.cf[i]; q.l -= dt; if (q.l <= 0) { o.cf.splice(i, 1); continue; } q.vy += 260 * dt; q.vx *= 1 - dt * 1.5; q.vy = Math.min(q.vy, 70); q.x += q.vx * dt + Math.sin(q.r) * 0.4; q.y += q.vy * dt; q.r += q.vr * dt; const wv = Math.abs(Math.cos(q.r)) > 0.5 ? 3 : 1; c.globalAlpha = Math.min(1, q.l * 2); c.fillStyle = P[q.col]; c.fillRect(Math.round(q.x), Math.round(q.y), wv, 4 - wv); c.globalAlpha = 1; }
    if (T > TO && Math.random() < dt * 20) burst(o, cx + G.rr(-20, 20), rc, col, 1, 60);
    // ---- 右上：鑰匙計數（先扣掉花費，開出的鑰匙飛進來再加回去）----
    const dev = G.Team.dev, cost = o.free ? 0 : o.ch.cost, cur = dev ? '∞' : String(o.k0 - (T > TD ? cost : 0) + o.got), kw = 22 + G.cnW(cur), kx = uw - I.r - kw, ky = I.t, kb = o.bump > 0 ? 1 : 0;
    H().box(c, kx, ky - kb, kw, 14, 0, 13); H().icon(c, 'i_key', kx + 9, ky + 7 - kb); G.cn(c, cur, uw - I.r - 4, ky + 1 - kb, o.bump > 0 ? 9 : 13, 1);
    if (T > TD && T < TD + 0.95) G.cn(c, cost ? '-' + cost : '免費', kx - 4, ky + 1 - Math.round((T - TD) * 10), cost ? 10 : 11, 1);
    if (dev && T > TO + 0.4) G.cn(c, '開發者模式：鑰匙不增減', uw / 2, ky + 18, 6, 0.5);
    // ---- 結果 ----
    if (T > TO + 0.1) {
      const e = 1 - Math.pow(1 - Math.min(1, (T - TO - 0.1) / 0.5), 3), pop = backOut((T - TO - 0.1) / 0.45);
      if (o.res.name) {
        const nm = o.res.name, fr = G.SPR[G.VIS[nm].spr][((T * 4) | 0) % 2], sk = LD ? 2 : 3, img = G.scaled(fr.n, sk), gl = G.glowOf(img, col, 1, 3);
        const cy = G.lerp(rc, midY, e), iw = Math.max(1, Math.round(img.width * pop)), ih = Math.max(1, Math.round(img.height * pop)), ix = Math.round(cx - iw / 2), iy = Math.round(cy - ih / 2 + Math.sin(T * 3) * 2);
        c.globalAlpha = 0.7 + Math.sin(T * 5) * 0.3; c.drawImage(gl.c, ix - gl.p, iy - gl.p, iw + gl.p * 2 * pop, ih + gl.p * 2 * pop); c.globalAlpha = 1; c.drawImage(img, ix, iy, iw, ih);
        if (T > TO + 0.5) {                                         // 稀有度在上、名字在下，與角色圖分開
          const isH = G.HEROES.some(h => h.name === nm);
          G.cn(c, G.RARITY[tier].n + (tier === 3 ? '！！' : tier === 2 ? '！' : ''), cx, Math.max(I.t + 18, iy - gl.p - 16), col, 0.5, 0);
          G.cn(c, (isH ? '英雄　' : '小兵　') + G.nameOf(nm), cx, iy + ih + gl.p + 4, 9, 0.5, 0);
          const nb = 'NEW', bw2 = G.textW(nb) + 4; c.fillStyle = P[0]; c.fillRect(ix + iw - 2, iy - 3, bw2 + 2, 9); c.fillStyle = P[13]; c.fillRect(ix + iw - 1, iy - 2, bw2, 7); G.text(c, nb, ix + iw + 1, iy - 1, 0);
        }
      } else {
        const s = G.SPR.i_key, tx = kx + 9, ty = ky + 7;
        for (let i = 0; i < nk; i++) {
          if (T >= kArrive(i) || T < kOut(i)) continue;
          const a = -Math.PI / 2 + (i - (nk - 1) / 2) * 0.5, r = LD ? 30 : 46, hx = cx + Math.cos(a) * r, hy = midY + 10 + Math.sin(a) * r, e2 = 1 - Math.pow(1 - Math.min(1, (T - kOut(i)) / 0.35), 3);
          let x, y, sc = 3 * backOut((T - kOut(i)) / 0.3);
          if (T < kArrive(i) - 0.4) { x = G.lerp(cx, hx, e2); y = G.lerp(rc, hy, e2); }
          else { const f = 1 - (kArrive(i) - T) / 0.4, f2 = f * f; x = G.lerp(hx, tx, f2); y = G.lerp(hy, ty, f2) - Math.sin(f * Math.PI) * 30; sc = 3 - f * 2; }
          const sp = Math.abs(Math.cos(T * 6 + i)) * 0.8 + 0.2; c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(sc * sp, sc); c.drawImage(s.n, -s.w / 2, -s.h / 2); c.restore();
        }
        if (!nk && T < TO + 0.8) for (let i = 0; i < 6; i++) { const r = (T - TO - 0.1) * 30; G.pxDisc(c, cx + Math.cos(i) * r, rc - (T - TO - 0.1) * 20 + Math.sin(i) * r * 0.4, 6 - (T - TO - 0.1) * 6, 4, 4, 0.7); }
        if (T > TO + 0.4) { const shown = nk ? Math.min(nk, Math.floor((T - TO - 0.12) / 0.1) + 1) : 0; G.cn(c, nk ? '+' + shown + ' 把鑰匙' : '銘謝惠顧', cx, midY - 6, nk ? 13 : 6, 0.5, 0); }   // 數字往上數
        if (T > TO + 0.4 && !nk) G.cn(c, '這次沒開到鑰匙', cx, midY + 9, 5, 0.5, 0);
      }
    }
    if (o.flash > 0) { c.fillStyle = P[9]; c.globalAlpha = o.flash * 0.85; c.fillRect(0, 0, uw, uh); c.globalAlpha = 1; o.flash -= dt * 3; }
    // ---- 按鈕 ----
    if (T >= tBtn) {
      const bw = 70, again = canOpen(o.ch);
      const y = LD ? by - 40 : Math.round(uh - I.b - 20), x1 = LD ? cx + 44 : again ? Math.round(cx - bw - 4) : Math.round(cx - bw / 2), y2 = LD ? y + 20 : y, x2 = LD ? x1 : Math.round(cx + 4);
      const oo = pr('opOk') ? 1 : 0; c.fillStyle = P[(Math.sin(gt * 6) > 0) ? 13 : 14]; c.fillRect(x1 - 1, y - 1 + oo, bw + 2, 18); H().key(c, x1, y + oo, bw, 16, oo, 14, 13, G.tint(14, -0.5)); G.cn(c, '收下', x1 + bw / 2, y + 2 + oo, 0, 0.5);
      tap('opOk', x1, y, bw, 16, () => { op = null; });
      if (again) { const ao = pr('opAg') ? 1 : 0; H().key(c, x2, y2 + ao, bw, 16, ao, 7); G.cn(c, '再開一次', x2 + bw / 2, y2 + 2 + ao, 9, 0.5); tap('opAg', x2, y2, bw, 16, () => { const ch = o.ch; op = null; open(ch); }); }
    }
  }
  S.drawChest = drawChest;
  return S;
})();
