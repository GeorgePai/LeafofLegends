'use strict';
/* =========================================================
   中文像素字（俐方體11號）、隊伍存檔、角色預覽沙盒
   ========================================================= */

// ---------- 中文像素字 ----------
G.CN_FONT = '12px Cubic11, monospace';
G._cn = new Map();
G._mc = G.canvas(4, 4).getContext('2d');
G.cnW = s => { G._mc.font = G.CN_FONT; return Math.ceil(G._mc.measureText(s).width); };
G.cnImg = function (s, col, ol) {
  const key = s + '|' + col + '|' + ol;
  let e = G._cn.get(key); if (e) return e;
  if (G._cn.size > 800) G._cn.clear();
  const w = G.cnW(s) + 2, h = 15, c = G.canvas(w + 2, h), x = c.getContext('2d');
  // 先以 4 倍大小畫字，再把每個 4×4 區塊取平均（過半才算有點）→ 對齊字型本身的像素格。
  // 直接用 12px 畫時，各平台（特別是桌機 Mac）的反鋸齒/微調不同，門檻化後筆畫會糊成一團。
  const K = 4, hc = G._cnHi || (G._cnHi = G.canvas(8, 8)), hx = hc.getContext('2d', { willReadFrequently: true }), CW = c.width * K, CH = h * K;
  if (hc.width < CW || hc.height < CH) { hc.width = Math.max(hc.width, CW); hc.height = Math.max(hc.height, CH); }
  hx.clearRect(0, 0, CW, CH); hx.font = (12 * K) + 'px Cubic11, monospace'; hx.textBaseline = 'alphabetic'; hx.fillStyle = '#fff'; hx.fillText(s, 2 * K, 11 * K);
  const hd = hx.getImageData(0, 0, CW, CH).data, id = x.createImageData(c.width, h), d = id.data, rgb = G.PAL_RGB[col], orgb = ol != null ? G.PAL_RGB[ol] : null;
  const on = new Uint8Array(c.width * h);
  for (let Y = 0; Y < h; Y++) for (let X = 0; X < c.width; X++) {
    let sum = 0; for (let yy = 0; yy < K; yy++) { const r = ((Y * K + yy) * CW + X * K) * 4 + 3; for (let xx = 0; xx < K; xx++) sum += hd[r + xx * 4]; }
    on[Y * c.width + X] = sum > K * K * 127 ? 1 : 0;
  }
  for (let i = 0; i < on.length; i++) {
    let r = null;
    if (on[i]) r = rgb;
    else if (orgb) { const X = i % c.width, Y = (i / c.width) | 0; if ((X > 0 && on[i - 1]) || (X < c.width - 1 && on[i + 1]) || (Y > 0 && on[i - c.width]) || (Y < h - 1 && on[i + c.width])) r = orgb; }
    d[i * 4 + 3] = r ? 255 : 0; if (r) { d[i * 4] = r[0]; d[i * 4 + 1] = r[1]; d[i * 4 + 2] = r[2]; }
  }
  x.putImageData(id, 0, 0);
  e = { c, w: w - 2 }; G._cn.set(key, e); return e;
};
// 畫中文（y 為字的頂端；行高 13）
G.cn = (ctx, s, x, y, col = 9, align = 0, ol = null) => { const e = G.cnImg(String(s), col, ol); ctx.drawImage(e.c, Math.round(x - e.w * align) - 2, Math.round(y) - 1); return e.w; };
// v2.6 七彩文字（神話）：逐字換色、隨時間流動
G.RB = [10, 14, 13, 11, 18, 12, 17];
G.cnRb = (ctx, s, x, y, align = 0, ol = null) => {
  s = String(s); const w = G.cnW(s), x0 = x - w * align, t = (performance.now() / 120) | 0;
  [...s].forEach((ch, i) => G.cn(ctx, ch, x0 + G.cnW(s.slice(0, i)), y, G.RB[(i + t) % G.RB.length], 0, ol)); return w;
};
// 依稀有度畫文字（神話＝七彩）
G.cnRar = (ctx, s, x, y, rar, align = 0, ol = null) => rar === 4 ? G.cnRb(ctx, s, x, y, align, ol) : G.cn(ctx, s, x, y, G.RARITY[rar].c, align, ol);
G.cnLines = (ctx, s, x, y, col = 9, align = 0, lh = 14) => String(s).split('\n').forEach((l, i) => G.cn(ctx, l, x, y + i * lh, col, align));

// ---------- 文字資料（取自 G.TXT：原著字串轉繁中） ----------
const UINFO_EXTRA = {
  gorilla: '力大無窮的近戰野獸。', hippo: '從遠處噴射水果彈的巨獸。', raven: '高速飛行的遠程狙擊手。', crocodile: '咬合力驚人，爆擊率高。',
  kangaroo: '攻擊速度極快的拳擊手。', monkey: '會投擲石頭的頑皮猴子。', spearbear: '手持長矛，可穿透攻擊。', bigboar: '體型巨大的野豬。',
  madbuffalo: '暴怒衝撞的野牛。', splashbuffalo: '從背上噴出火球，造成範圍傷害。', cat: '[首領] 敏捷的山貓，會施放秘術流。',
  lion: '[首領] 百獸之王，會發射神秘爆彈。', madwolf: '[首領] 狂暴的狼，攻擊可以吸血。', smartmonkey: '[首領] 會投擲燃燒的石頭。',
  firebear: '[首領] 全身燃燒的熊，會發射火球。', firegnome: '[首領] 火焰格羅姆，能召喚流星。',
  elitepeasniper: '傭兵：超遠距離的精英狙擊手。', leaftanker: '傭兵：最強的近戰坦克。', treestun: '傭兵：高防禦的守衛者。',
  player_tower: '守護我方陣地的砲塔。', enemy_tower: '敵方最前線的外塔。', enemy_tower2: '敵方中塔，發射水果彈造成範圍傷害。',
  enemy_tower3: '敵方內塔，用陽光光束持續攻擊。', enemy_tower4: '守在聖所前的主塔，比所有外塔都堅固。', mushroom_tower: '可建造的我方蘑菇砲塔。'
};
const TOWER_NAMES = { player_tower: '我方砲塔', enemy_tower: '敵方外塔', enemy_tower2: '敵方中塔', enemy_tower3: '敵方內塔', enemy_tower4: '敵方主塔', mushroom_tower: '蘑菇砲塔' };
G.nameOf = n => TOWER_NAMES[n] || G.TXT.unit[n] || n;
G.infoOf = n => (G.TXT.uinfo[n] || UINFO_EXTRA[n] || '').replace(/^\[首領\]\s*/, '').trim();
G.kindOf = n => G.ORIG.towers[n] ? 'tower' : G.HEROES.some(h => h.name === n) ? 'hero' : G.BOSS_SKILL[n] ? 'boss' : 'creep';
// ---------- 角色標籤（取代角色描述）----------
// 身分（灰）→ 攻擊方式（白）→ 攻擊效果（白）→ 強項（同數值條顏色），強項以「同類角色」比較
G.tagsOf = n => {
  const k = G.kindOf(n), st = G.stats(n, 1, 0, k === 'boss' ? 'creep' : k), w = G.ORIG.weapons[st.weapon] || {}, u = G.ORIG.units[n] || {}, t = [];
  if (k === 'boss') t.push(['首領', 12]); if (k === 'tower') t.push(['建築', 7]);
  if (u.jungler) t.push(['打野', 14]);
  if (G.VIS[n] && G.VIS[n].fly) t.push(['飛行', 7]);
  if (n === 'twinflower') t.push(['一次兩隻', 7]);
  if (n === 'necroleafy') t.push(['召喚', 17]);
  // 攻擊方式
  const grpMax = G.statMax ? G.statMax(G.groupOf(n)) : null;
  t.push([st.range <= 40 ? '近戰' : grpMax && st.range >= grpMax.range * 0.8 && st.range >= 180 ? '狙擊' : '遠程', 9]);
  if (w.type === 'line') t.push(['光束', 9]);
  if (w.attack_type === 'splash') t.push(['範圍', 9]); if (w.attack_type === 'piercing') t.push(['穿透', 9]);
  if (w.attribute === 'slow') t.push(['減速', 9]); if (w.attribute === 'poison') t.push(['中毒', 9]); if (w.attribute === 'return') t.push(['吸血', 9]); if (w.attribute === 'stun') t.push(['暈眩', 9]);
  // 強項
  // 強項：和同類角色比，取最突出的 2 項（門檻以上才算）
  if (grpMax) {
    const gp = G.groupOf(n), s2 = G.statOf(n), md = G.statMed(gp, gp === 'minion' ? G.rarityOf(n) : null), f = q => s2[q] / (md[q] || 1);
    const cand = [['hp', '血量高', 10, 1.35], ['armor', '防禦高', 12, 1.6], ['power', '攻擊高', 14, 1.35], ['aspd', '攻速快', 18, 1.25], ['crit', '爆擊高', 19, 1.8], ['speed', '移動快', 20, 1.25]]
      .filter(([q, , , th]) => f(q) >= th && !(q === 'armor' && s2.armor < 4) && !(q === 'crit' && s2.crit < 8) && !(q === 'speed' && k === 'tower'))
      .sort((A, B) => f(B[0]) / B[3] - f(A[0]) / A[3]).slice(0, 2);
    const labs = cand.map(q => q[1]);
    if (!labs.length && (gp === 'hero' || gp === 'minion') && t.every(q => q[1] !== 9 || ['近戰', '遠程', '狙擊'].includes(q[0]))) t.push(['均衡', 7]);
    if (labs.includes('血量高') && labs.includes('防禦高')) t.push(['坦克', 12]);           // 又硬又厚 → 坦克
    else cand.forEach(([, lab, col]) => t.push([lab, col]));
  }
  return t;
};
G.tagOf = n => G.tagsOf(n).map(q => q[0]).slice(0, 3).join('．');
G.skillName = id => G.TXT.skill[id] || '';
G.skillInfo = id => G.TXT.sinfo[id] || '';
// 中文自動換行
const NO_START = '，。、！？：；）」』,.!?:;)';
G.cnWrap = (s, maxW) => {
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = ''; const p0 = out.length;
    for (const ch of para) {
      if (G.cnW(line + ch) > maxW && line) {
        if (NO_START.includes(ch)) { const a = [...line]; let carry = ch; do { carry = a.pop() + carry; } while (a.length > 1 && NO_START.includes([...carry][0])); if (a.length) { out.push(a.join('')); line = carry; } else line += ch; }   // v2.8.7 連續標點（」：）也不放行首   // 標點不放行首，也不超出寬度：把前一個字一起帶下去
        else {
          const m = /[A-Za-z0-9%.+\-]$/.test(ch) && line.match(/[A-Za-z0-9%.+\-]+$/);       // v2.8.6 英數字（50%、HP、V2.8）不從中間拆開
          if (m && m[0].length < [...line].length) { out.push(line.slice(0, -m[0].length)); line = m[0] + ch; }
          else { out.push(line); line = ch.trim() ? ch : ''; }
        }
      } else line += ch;
    }
    // v3.1 最後一行只剩一個字：從上一行借一個字下來（不借標點）
    const la = [...line], st = out.length;
    if (la.length === 1 && st > p0 && !NO_START.includes(la[0])) { const pa = [...out[st - 1]]; if (pa.length >= 4 && !NO_START.includes(pa[pa.length - 1]) && !/[A-Za-z0-9%.+\-]/.test(pa[pa.length - 1])) { line = pa.pop() + line; out[st - 1] = pa.join(''); } }
    out.push(line);
  }
  return out;
};
// v2.7 重點標示：{詞}＝黃色重點；{r:詞} 紅、{g:詞} 綠、{b:詞} 藍、{p:詞} 紫、{o:詞} 橘、{w:詞} 白、{m:詞} 七彩
const HI_COL = { r: 10, g: 11, b: 12, p: 17, o: 14, w: 9 }, RAINBOW = [10, 14, 13, 11, 12, 17];
G.cnStrip = s => String(s).replace(/\{(?:[rgbpowm]:)?([^}]*)\}/g, '$1');
G.cnParse = (s, hi = 13) => {           // → [[字, 顏色或 null]...]（\n 保留）
  const out = []; String(s).replace(/\{(?:([rgbpowm]):)?([^}]*)\}|([^{]+|\{)/g, (all, k, inner, plain) => {
    if (plain != null) { for (const ch of plain) out.push([ch, null]); return ''; }
    let i = 0; for (const ch of inner) out.push([ch, k === 'm' ? RAINBOW[i++ % RAINBOW.length] : k ? HI_COL[k] : hi]); return '';
  });
  return out;
};
// 有重點的換行：寬度只算字本身；回傳每行 [[文字, 顏色或 null]...] 片段
G.cnWrapRich = (s, maxW, hi = 13) => {     // v2.8.7 換行規則和 G.cnWrap 完全一樣（標點不放行首、英數字不拆），再把顏色對回去
  const ent = G.cnParse(s, hi), lines = G.cnWrap(ent.map(e => e[0]).join(''), maxW), out = []; let k = 0;
  for (const ln of lines) {
    const seg = [];
    for (const ch of ln) {
      while (k < ent.length && ent[k][0] !== ch) k++;     // 換行時被丟掉的空白／換行字元
      const c = k < ent.length ? ent[k][1] : null; k++;
      const t = seg[seg.length - 1]; if (t && t[1] === c) t[0] += ch; else seg.push([ch, c]);
    }
    out.push(seg);
  }
  return out;
};
// 畫一行有重點的字（align 0 靠左、0.5 置中）；回傳寬度
G.cnRich = (ctx, seg, x, y, col = 8, align = 0) => {
  const ws = seg.map(s => G.cnW(s[0])), W = ws.reduce((a, b) => a + b, 0); let xx = x - W * align;
  seg.forEach((s, i) => { G.cn(ctx, s[0], xx, y, s[1] == null ? col : s[1]); xx += ws[i]; });
  return W;
};
G.cnBlock = (ctx, s, x, y, maxW, col = 7, lh = 13, maxLines = 9) => {   // v2.8.7 支援 {重點} 上色
  if (String(s).includes('{')) { const ls = G.cnWrapRich(s, maxW).slice(0, maxLines); ls.forEach((l, i) => G.cnRich(ctx, l, x, y + i * lh, col)); return ls.length * lh; }
  const ls = G.cnWrap(s, maxW).slice(0, maxLines); ls.forEach((l, i) => G.cn(ctx, l, x, y + i * lh, col)); return ls.length * lh; };

// ---------- 隊伍（存在瀏覽器本機） ----------
G.TUNE.laneSpread = 0.85;          // v3.2.5 小兵橫向分散：最外側到路寬的幾成
G.TUNE.laneEdge = 1.0;             // v3.2.5 路邊保留幾格（不貼著樹）
G.TUNE.plantPoints = 24;            // 隊伍點數上限（v3.2.4 Pai：12 → 24）
G.ROSTER = {
  minions: Object.keys(G.ORIG.units).filter(n => ['npc', 'mercenary'].includes(G.ORIG.units[n].type)),
  bosses: Object.keys(G.BOSS_SKILL),
  smalls: Object.keys(G.ORIG.units).filter(n => G.ORIG.units[n].type === 'enemy' && !G.BOSS_SKILL[n] && !G.ORIG.units[n].jungler),
  hunters: Object.keys(G.ORIG.units).filter(n => G.ORIG.units[n].jungler),
  towers: Object.keys(G.ORIG.towers)
};
G.Team = {
  get() {
    if (!this.v) {
      try { this.v = JSON.parse(localStorage.getItem('leafwar_team')); } catch (e) { }
      if (!this.v || !G.HEROES[this.v.hero] || !Array.isArray(this.v.loadout)) this.v = { hero: 0, loadout: G.STAGES[0].loadout.map((n, i) => ({ n, l: i % 3 })) };
      this.v.loadout = this.v.loadout.map(e => typeof e === 'string' ? { n: e, l: 1 } : e).filter(e => G.ORIG.units[e.n]);
      // v1.2 起：角色要開寶箱取得；開局只有「普通」稀有度。鑰匙 v2.7 開局 8 把；v3.3 改成 0 把，建立帳號才送 8 把（G.SaveUI 的 grant）
      if (!this.v.owned) { this.v.owned = { h: G.HEROES.map(h => h.name).filter(n => G.rarityOf(n) === 0), m: G.ROSTER.minions.filter(n => G.rarityOf(n) === 0) }; this.v.keys = 0; this.sanitize(true); }
      if (this.v.keys == null) this.v.keys = 8;
      try { this.dev = localStorage.getItem('leafwar_dev') === '1'; } catch (e) { }
    }
    return this.v;
  },
  dev: false,
  setDev(on) { this.dev = on; try { localStorage.setItem('leafwar_dev', on ? '1' : '0'); } catch (e) { } if (!on) this.sanitize(); },
  owns(n) { const v = this.get(); return this.dev || v.owned.h.includes(n) || v.owned.m.includes(n); },
  ownedCount(list) { return list.filter(n => this.owns(n)).length; },
  keys() { return this.dev ? Infinity : this.get().keys; },
  spend(k) { if (this.dev) return true; const v = this.get(); if (v.keys < k) return false; v.keys -= k; this.save(); return true; },
  // keysTot：累積取得的鑰匙（排行用）。gb＝賭徒寶箱這次的淨賺（可為負）：只有累計淨賺創新高的部分才算，反覆開不能灌數字（v3.2.6）
  addKeys(k, gb) {
    if (this.dev) return; this.get().keys += k;
    if (G.Ach) { const p = G.Ach.P(); if (gb == null) p.keysTot = (p.keysTot || 0) + k; else { const d = (p.gbD || 0) - gb; p.gbD = Math.max(0, d); if (d < 0) p.keysTot = (p.keysTot || 0) - d; } }   // gbD＝離賭徒淨賺最高點還差幾把（≥0，存檔碼安全）
    this.save();
  },
  // 累積鑰匙下限＝目前持有＋買角色花掉的（角色只能從寶箱來：英雄 5、小兵 3；含開局 8 把）。補舊存檔與 v3.2.6 前漏算的（信箱、開局）
  keysFloor() { const v = this.get(), r = n => G.rarityOf(n) > 0 ? 1 : 0; return (v.keys | 0) + 5 * v.owned.h.reduce((a, n) => a + r(n), 0) + 3 * v.owned.m.reduce((a, n) => a + r(n), 0); },
  grant(n) { if (this.dev) return; const v = this.get(), arr = G.HEROES.some(h => h.name === n) ? v.owned.h : v.owned.m; if (!arr.includes(n)) { arr.push(n); (v.nw = v.nw || []).push(n); if (G.SaveUI) G.SaveUI.bump(); } this.save(); },
  // v2.6 NEW 標記：寶箱新拿到的角色在隊伍轉盤上標 NEW；在聚光燈下看過、再滾走後消失
  isNew(n) { const v = this.get(); return !!(v.nw && v.nw.includes(n)); },
  clearNew(n) { const v = this.get(); if (v.nw && v.nw.includes(n)) { v.nw = v.nw.filter(q => q !== n); this.save(); } },
  newIn(list) { const v = this.get(); return !!(v.nw && v.nw.some(n => list.includes(n))); },
  // 出戰英雄／陣容裡若有未擁有的角色就移除（關閉開發者模式、舊存檔升級時）
  sanitize(silent) { const v = this.v; if (!v || !v.owned) return; if (!this.owns(G.HEROES[v.hero].name)) v.hero = Math.max(0, G.HEROES.findIndex(h => this.owns(h.name))); v.loadout = v.loadout.filter(e => this.owns(e.n)); if (!silent) this.save(); else this.save(); },
  save() { try { localStorage.setItem('leafwar_team', JSON.stringify(this.v)); } catch (e) { } },
  cost: n => G.ORIG.units[n].unit_point || 4,         // 傭兵原著無點數，暫定 4
  used() { return this.get().loadout.reduce((a, e) => a + this.cost(e.n), 0); },
  count(n, l) { return this.get().loadout.filter(e => e.n === n && (l == null || e.l === l)).length; },
  add(n) { if (!this.owns(n)) return false; if (this.used() + this.cost(n) > G.TUNE.plantPoints) return false; this.get().loadout.push({ n, l: 0 }); this.save(); return true; },   // v3.7 單路地圖：不再分路（l 欄位保留給舊存檔）
  remove(n) { const L = this.get().loadout; let i = -1; for (let k = L.length - 1; k >= 0; k--) if (L[k].n === n) { i = k; break; } if (i < 0) return false; L.splice(i, 1); this.save(); return true; }
};

// ---------- 地面小圖（預覽/教學共用） ----------
G._strip = {};
G.groundStrip = (w, h) => {
  if (!G.NATRGB) { G.NATRGB = {}; for (const k in G.NAT) G.NATRGB[k] = G.hexRGB(G.NAT[k]); }
  const k = w + 'x' + h; if (G._strip[k]) return G._strip[k];
  const c = G.canvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const n = G.fbm(xx * 0.05, yy * 0.08), b = G.bayer(xx, yy), band = Math.abs(yy / h - 0.66) < 0.2 + (n - 0.5) * 0.12;
    // v2.6 和戰場同一套自然色：上緣森林、中間泥土路、其餘草地
    let v = band ? (n + (b - 0.5) * 0.35 > 0.5 ? 'rdL' : 'rdM') : (n + (b - 0.5) * 0.3 > 0.55 ? 'grM' : 'grD');
    if (yy < h * 0.18) v = yy < h * 0.12 ? (b < 0.5 ? 'fSh' : 'fD') : (b < 0.6 ? 'shD' : 'shM');
    if (!band && G.hash(xx * 5, yy * 3) > 0.985) v = 'fl1';
    const rgb = G.NATRGB[v], o = (yy * w + xx) * 4; id.data[o] = rgb[0]; id.data[o + 1] = rgb[1]; id.data[o + 2] = rgb[2]; id.data[o + 3] = 255;
  }
  x.putImageData(id, 0, 0); return (G._strip[k] = c);
};

// ---------- 技能展示沙盒：重用遊戲內戰鬥引擎與特效，依技能類型安排情境 ----------
// sid = null → 普通攻擊；主動技 → 只施放該技能（不混普攻）；被動技 → 用對照情境把效果演出來
G.Sandbox = class {
  constructor() { this.parts = new G.Particles(1800); this.trauma = 0; this.effects = []; this.decals = []; this.projs = []; this.units = []; this.flashScreen = 0; this.frame = 0; this.t = 0; this.w = 0; this.hitstop = 0; this.soundT = 0; }
  size(w, h) { if (w === this.w && h === this.h) return; this.w = w; this.h = h; this.c = G.canvas(w, h); this.x = this.c.getContext('2d'); if (this.name) this.setup(this.name, this.side, this.sid); }
  sfx(name) { if (this.soundT > 0 && !this.mute) G.Audio.play(name); }
  shake(v) { this.trauma = Math.min(1, (this.trauma || 0) + v); }
  kill(t) { t.hp = t.st.hp; t.alive = true; }      // 展示用：誰都不會死
  mk(name, side, x, y, kind, passives) {
    const u = new G.Unit(this, name, side, x, y, 1, kind || 'creep');
    if (passives) { u.passives = passives; u.calc(); u.hp = u.st.hp; u.mp = u.st.mp; }
    u.face = side === 0 ? 1 : -1; u.spawnT = 0; u.knock = 0; u.home = [x, y]; return u;
  }
  setup(name, side, sid) {
    this.name = name; this.side = side; this.sid = sid == null ? null : sid;
    const kind = G.kindOf(name), hd = G.HEROES.find(h => h.name === name);
    const W = this.w / G.AX, H = this.h / G.AY; this.W = W; this.H = H;
    this.effects = []; this.decals = []; this.projs = []; this.parts.c = 0; this.trauma = 0; this.hitstop = 0; this.flashScreen = 0;
    this.cap = null; this.bars = null; this.rows = null; this.rings = null; this.t = 0; this.n = 0; this.soundT = 0.3;
    this.hd = hd; this.kind = kind;
    this.A = this.mk(name, side, W * 0.3, H * 0.72, kind === 'boss' ? 'boss' : kind, hd ? hd.passives : null);
    this.dname = side === 0 ? (G.VIS[name].fly ? 'eagle' : 'bear') : (kind === 'tower' ? 'leafblower' : 'treeprotector');
    this.units = [this.A];
    const sd = this.sid != null ? G.ORIG.skills[this.sid] : null;
    this.run = !sd ? this.scBasic() : sd.type === 'necro' ? this.scNecro(sd) : !sd.active ? this.scPassive(sd) : sd.type === 'buff' ? this.scBuff(sd) : this.scActive(sd);
    // 面向：攻擊者面對敵人（敵方角色在展示時也面向右邊的目標，不會背對背）
    for (const u of this.units) { if (u === this.A || u.ghost) u.face = 1; else u.face = u.x >= this.A.x ? -1 : 1; }
  }
  // 小工具
  dummy(x, y, name, side) { const D = this.mk(name || this.dname, side == null ? 1 - this.side : side, x, y); this.units.push(D); return D; }
  atk(u, t) { if (u.atkT <= 0 && u.windup <= 0) { u.face = t.x >= u.x ? 1 : -1; u.windup = u.st.range <= 40 ? 0.13 : 0.09; u.wTarget = t; u.atkT = 9; if (u.onAtk) u.onAtk(); return true; } return false; }
  gap(A, D) { return G.clamp(A.st.range + A.r * 0.4 + D.r - 2, 34, this.W * 0.62); }
  pop(u, s, col) { G.FX.popText(this, u.x + G.rr(-4, 4), u.y, (u.vis.fly || 0) + 30, s, col); }
  firstActive() { const hd = this.hd; return hd ? G.ORIG.skills[hd.skills[0]] : null; }
  // ----- 普通攻擊 -----
  scBasic() {
    const A = this.A, W = this.W, H = this.H, gy = H * 0.72, wp = G.ORIG.weapons[A.st.weapon] || {}, at = wp.attack_type, attr = wp.attribute;
    let D;
    if (at === 'splash') {                               // 範圍普攻：擺一群
      A.x = this.kind === 'tower' ? W * 0.2 : W * 0.3; const cx = Math.min(W * 0.82, A.x + Math.max(60, A.st.range * 0.9));
      [[0, 0], [-16, -12], [14, 12]].forEach(([dx, dy]) => this.dummy(cx + dx, gy + dy)); D = this.units[1];
      this.cap = ['範圍攻擊：波及周圍敵人', 14];
    } else if (at === 'piercing') {                      // 穿透普攻：排一列
      A.x = W * 0.16; [0.45, 0.6, 0.75].forEach(f => this.dummy(W * f, gy)); D = this.units[1];
      this.cap = ['穿透攻擊：打穿一整排', 9];
    } else {
      D = this.dummy(0, gy); const dist = this.gap(A, D); A.x = W / 2 - dist / 2 - 6; D.x = W / 2 + dist / 2 - 6;
      if (this.kind === 'tower') { A.x = W * 0.22; D.x = W * 0.75; }
    }
    if (attr === 'slow') this.cap = ['打中會減速', 12];
    if (attr === 'poison') this.cap = ['打中會中毒，持續掉血', 11];
    if (attr === 'stun') this.cap = ['打中會暈眩', 13];
    A.home = [A.x, A.y];
    if (attr === 'return') {                              // 吸血普攻：從半血開始，打人時回血
      this.bars = 'hp'; this.cap = ['打人會回血', 10]; let last = 0, acc = 0;
      return () => { if (this.t % 6 < 0.05) A.hp = A.st.hp * 0.4; const g = A.hp - (last || A.hp); last = A.hp; if (g > 0) { acc += g; if (acc >= 2) { this.pop(A, '+' + Math.round(acc), 10); acc = 0; } } if (this.t > 0.35) this.atk(A, D); };
    }
    if (this.name === 'twinflower') {                     // 雙生花：兩隻獨立個體並排
      A.y -= 13; A.home = [A.x, A.y]; const B = this.mk(this.name, this.side, A.x - 12, A.y + 26); B.atkT = 0.4; this.units.push(B);
      return () => { if (this.t > 0.35) { this.atk(A, D); this.atk(B, D); } };
    }
    return () => { if (this.t > 0.35) this.atk(A, D); };
  }
  // ----- 主動攻擊技：依範圍型態擺敵人，只施放技能 -----
  scActive(sd) {
    const A = this.A, W = this.W, H = this.H, gy = H * 0.72, w = G.WEAPONS_BY_ID[sd.weapon_id] || {}, at = w.attack_type, n = (w.name || '').toLowerCase();
    let tgt;
    if (w.type === 'effect' && at === 'round') {
      A.x = W * 0.5; const R = Math.min(sd.range || 80, W * 0.4);
      [[-0.75, -0.25], [0.7, -0.3], [-0.45, 0.35], [0.5, 0.3]].forEach(([dx, dy]) => this.dummy(A.x + dx * R, gy + dy * R * 0.55));
      tgt = this.units[1];
      this.rings = [[A, R, 6]];
    } else if (at === 'piercing') {
      A.x = W * 0.14; [0.46, 0.63, 0.8].forEach(f => this.dummy(W * f, gy)); tgt = this.units[1];
    } else if (at === 'jump') {
      A.x = W * 0.14; [[0.46, -16], [0.6, 14], [0.74, -12], [0.88, 12]].forEach(([f, dy]) => this.dummy(W * f, gy + dy)); tgt = this.units[1];
    } else if (at === 'splash' || w.type === '2d_drop' || /storm/.test(n)) {
      A.x = W * 0.18; const cx = W * 0.68; [[-22, -12], [22, -8], [0, 14]].forEach(([dx, dy]) => this.dummy(cx + dx, gy + dy)); tgt = this.units[3];
    } else {
      const D = this.dummy(0, gy), dist = G.clamp(Math.min(sd.range || 160, 220), 50, W * 0.6); A.x = W / 2 - dist / 2; D.x = W / 2 + dist / 2; tgt = D;
    }
    A.home = [A.x, A.y];
    const P = w.type === '2d_drop' ? 3.4 : 2.8; let next = 0.45;
    return () => { if (this.t >= next) { next += P; this.soundT = 1; this.useSkill(A, sd, tgt, 1); } };
  }
  // ----- v2.6 死靈技能：每一輪重擺場景再施放一次 -----
  scNecro(sd) {
    const A = this.A, W = this.W, H = this.H, gy = H * 0.72, at = sd.attribute, R = sd.range || G.NECRO.R;
    const keep = new Set([A]), reset = () => { this.units = this.units.filter(u => keep.has(u)); for (const u of this.units) { u.hp = u.st.hp; u.side = u.home0 != null ? u.home0 : u.side; } this.effects = []; this.projs = []; };
    const ring = (n, f, side, names) => Array.from({ length: n }, (_, i) => { const a = -2.4 + i * (4.8 / Math.max(1, n - 1)), d = this.dummy(A.x + Math.cos(a) * R * f, gy + Math.sin(a) * R * f * 0.55, names[i % names.length], side); d.home0 = side; return d; });
    if (at === 'sac') {                                     // 身邊的小兵 → 換成隨機小兵（會出現各種稀有度）
      A.x = W * 0.5; A.home = [A.x, A.y]; this.rings = [[A, R, 17]];
      let next = 0.9, T0 = 0, mins = [];
      return () => {
        if (this.t >= T0) { T0 += 4.2; next = T0 - 3.3; reset(); mins = ring(4, 0.62, 0, ['leafblower', 'potatoblower', 'stemskewer', 'leafblower']); this.cap = ['身邊的我方小兵', 9]; }
        if (this.t >= next) { next = 1e9; this.soundT = 1; this.useSkill(A, sd, null, 1); this.cap = ['換成隨機小兵', 17]; }
      };
    }
    if (at === 'ctrl') {                                    // 身邊的敵人 → 變成召喚物，回頭打其他敵人
      A.x = W * 0.36; A.home = [A.x, A.y]; this.rings = [[A, R, 10]]; this.bars = 'hp';
      const far = this.dummy(W * 0.88, gy, 'bear', 1); far.home0 = 1; keep.add(far);
      let T0 = 0, next = 0, foes = [];
      return () => {
        if (this.t >= T0) { T0 += 6; next = T0 - 5.2; reset(); A.hp = A.st.hp; foes = ring(4, 0.6, 1, ['bear', 'bear', 'eagle', 'bear']); this.cap = ['身邊的敵人', 10]; }
        if (this.t >= next) { next = 1e9; this.soundT = 1; this.useSkill(A, sd, null, 1); this.cap = ['敵人變成召喚物', 10]; }
        for (const f of foes) if (f.charm) { f.face = 1; this.atk(f, far); }
      };
    }
    if (at === 'clone') {                                   // 每隻召喚物複製一隻（冰青色、1 點血）
      A.x = W * 0.22; A.home = [A.x, A.y];
      const D = this.dummy(W * 0.86, gy, 'bear', 1); D.home0 = 1; keep.add(D);
      const S = [[0.36, -34], [0.44, 0], [0.36, 34]].map(([fx, dy], i) => { const s = this.dummy(W * fx, gy + dy, ['leafmuscle', 'peasniper', 'bear'][i], 0); s.summoner = A; if (i === 2) s.charm = true; s.home0 = 0; keep.add(s); return s; });
      let T0 = 0, next = 0;
      return () => {
        if (this.t >= T0) { T0 += 5.5; next = T0 - 4.6; reset(); this.cap = ['你的召喚物', 17]; }
        if (this.t >= next) { next = 1e9; this.soundT = 1; this.useSkill(A, sd, null, 1); this.cap = ['各複製一隻', 18]; }
        for (const u of this.units) if (u.summoner === A) { u.face = 1; if (Math.abs(u.x - D.x) < u.st.range + 30 || u.st.range >= 100) this.atk(u, D); }
      };
    }
    // 被動「替罪」：上排沒有召喚物、下排有召喚物站在身邊 → 同樣挨打，下排本體掉血少一半
    const g = this.mk(this.name, this.side, 0, H * 0.46, 'hero', []); g.ghost = true; this.units.push(g);
    A.y = H * 0.86; this.rows = [['沒有召喚物', H * 0.46, 5], [G.skillName(this.sid), H * 0.86, 17]];
    g.x = A.x = W * 0.58; A.home = [A.x, A.y];
    const Dg = this.dummy(A.x + 34, H * 0.46, 'bear'), D = this.dummy(A.x + 34, H * 0.86, 'bear'), S = this.dummy(A.x - 24, H * 0.86 - 6, 'leafmuscle', 0);
    S.summoner = A; Dg.st.power *= 2; D.st.power *= 2;
    let lg = g.hp, la = A.hp, ls = S.hp;
    const pop = (u, last, col) => { if (u.hp < last - 0.5) this.pop(u, '-' + Math.round(last - u.hp), col); return u.hp; };
    return () => {
      if (this.t % 6 < 0.05) { A.hp = A.st.hp; g.hp = g.st.hp; S.hp = S.st.hp; lg = g.hp; la = A.hp; ls = S.hp; }
      this.atk(Dg, g); this.atk(D, A);
      lg = pop(g, lg, 10); la = pop(A, la, 10); ls = S.hp > ls + 1 ? S.hp : pop(S, ls, 17);
      this.cap = ['召喚物替你扛 ' + G.skillVal(sd, 1).v1 + '%', 17];
    };
  }
  // ----- 主動增益技 -----
  scBuff(sd) {
    const A = this.A, W = this.W, H = this.H, gy = H * 0.72, v = G.skillVal(sd, 1);
    if (sd.attribute === 'armor_per') {                     // 護盾：敵人打你 → 開盾後傷害變小
      const D = this.dummy(0, gy, 'bear'); A.x = W * 0.42; D.x = A.x + 34; D.st.power *= 2; this.bars = 'hp';
      let cast = false;
      return () => {
        const T = this.t % 7; if (T < 0.05) { cast = false; A.bRed = 0; A.buffT = {}; A.hp = A.st.hp; }
        this.atk(D, A);
        if (!cast && T > 2.2) { cast = true; this.soundT = 1; this.useSkill(A, sd, null, 1); }
        this.cap = cast ? ['護盾中：受到傷害 −' + v.v1 + '%', 12] : ['沒開護盾', 6];
      };
    }
    if (sd.attribute === 'weapon') {                        // 放電：身邊敵人自動被電
      A.x = W * 0.5; [[-40, -10], [42, -6], [-14, 18], [24, 20]].forEach(([dx, dy]) => this.dummy(A.x + dx, gy + dy, 'bear'));
      let next = 0.5;
      return () => { if (this.t >= next) { next += v.v2 + 1.5; this.soundT = 1; this.useSkill(A, sd, null, 1); } this.cap = A.zap ? ['放電中：自動電擊身邊敵人', 12] : null; };
    }
    // 狂戰士：同一個敵人，開技能前後的傷害對比
    const D = this.dummy(0, gy), dist = this.gap(A, D); A.x = W / 2 - dist / 2 - 6; D.x = W / 2 + dist / 2 - 6;
    let cast = false;
    return () => {
      const T = this.t % 7.5; if (T < 0.05) { cast = false; A.bPow = 1; A.bArm = 1; A.bDel = 1; A.buffT = {}; }
      this.atk(A, D);
      if (!cast && T > 2.2) { cast = true; this.soundT = 1; this.useSkill(A, sd, null, 1); }
      this.cap = cast ? [sd.attribute === 'berserker2' ? '狂暴：攻擊 ×2、攻速 +50%' : '狂暴：攻擊 ×2', 10] : ['一般攻擊', 6];
    };
  }
  // ----- 被動技：把「差在哪」演出來 -----
  scPassive(sd) {
    const A = this.A, W = this.W, H = this.H, gy = H * 0.72, v = G.skillVal(sd, 1).v1, at = sd.attribute, name = this.name;
    const base = () => this.mk(name, this.side, 0, 0, 'hero', (this.hd ? this.hd.passives : []).filter(id => id !== this.sid));
    const ghostRow = (y) => { const g = base(); g.ghost = true; g.y = y; this.units.push(g); return g; };
    const per = (fn, P) => { let nx = 0; return () => { if (this.t >= nx) { nx += P; fn(); } }; };
    if (at === 'hp_sec') {                                  // 被打掉血 → 每秒自己補回來
      const D = this.dummy(A.x + 34, gy, 'bear'); D.st.power *= 3; this.bars = 'hp'; let acc = 0;
      return () => {
        const T = this.t % 8; if (T < 0.05) A.hp = A.st.hp;
        if (T < 1.6) { this.atk(D, A); this.cap = ['受到攻擊', 6]; return; }
        A.hp = Math.min(A.st.hp, A.hp + v * _sbDt); acc += _sbDt; if (acc >= 1) { acc -= 1; this.pop(A, '+' + v, 10); this.parts.add(A.x, A.y, 16, 0, 0, 30, 0.6, 10, 15, 1, -10, 0); }
        this.cap = ['每秒回復 ' + v + ' HP', 10];
      };
    }
    if (at === 'mp_sec' || at === 'mp_discount') {         // 施法花 MP
      const sk = this.firstActive(), D = this.dummy(0, gy), dist = G.clamp(Math.min(sk.range || 160, 200), 50, W * 0.6); A.x = W / 2 - dist / 2; D.x = W / 2 + dist / 2; this.bars = 'mp';
      const cost = Math.round(sk.mp * (1 - (at === 'mp_discount' ? v : 0) / 100)); let acc = 0;
      if (at === 'mp_discount') return per(() => { A.mp = A.st.mp; this.soundT = 1; this.useSkill(A, sk, D, 1); A.mp -= cost; this.pop(A, '-' + cost, 11); this.cap = ['技能 MP ' + sk.mp + ' → ' + cost, 11]; }, 2.6);
      const rg = v / 10;
      return () => {
        const T = this.t % 7; if (T < 0.05) A.mp = A.st.mp;
        if (T > 0.4 && !this.cast1) { this.cast1 = true; this.soundT = 1; this.useSkill(A, sk, D, 1); A.mp -= sk.mp * 2; this.pop(A, '-' + sk.mp * 2, 11); }
        if (T < 0.3) this.cast1 = false;
        if (T > 1.2) { A.mp = Math.min(A.st.mp, A.mp + rg * _sbDt); acc += _sbDt; if (acc >= 1) { acc -= 1; this.pop(A, '+' + rg, 11); } }
        this.cap = ['每秒額外回復 ' + rg + ' MP', 11];
      };
    }
    if (at === 'speed') {                                   // 賽跑：上排沒被動、下排有被動
      const g = ghostRow(H * 0.46); A.y = H * 0.86; this.rows = [['原本', H * 0.46, 5], [G.skillName(this.sid), H * 0.86, 13]];
      const x0 = W * 0.16, x1 = W * 0.94;
      return () => {
        for (const u of [g, A]) { if (this.t % 6 < 0.05) u.x = x0; u.walk = u.x < x1; if (u.walk) { u.x += u.st.speed * _sbDt; u.anim += _sbDt * 3; } }
        this.cap = ['跑速 +' + v, 13];
      };
    }
    if (at === 'delay' || at === 'critical' || at === 'power' || at === 'armor' || at === 'return' || at === 'range') {
      if (at === 'delay' || at === 'armor') {               // 對照兩排
        const g = ghostRow(H * 0.46); A.y = H * 0.86; this.rows = [['原本', H * 0.46, 5], [G.skillName(this.sid), H * 0.86, 13]];
        const Dg = this.dummy(0, H * 0.46, at === 'armor' ? 'bear' : null), D = this.dummy(0, H * 0.86, at === 'armor' ? 'bear' : null), dist = at === 'armor' ? 34 : this.gap(A, D);
        g.x = A.x = W * 0.5 - dist / 2; Dg.x = D.x = W * 0.5 + dist / 2;
        if (at === 'armor') return () => { this.atk(Dg, g); this.atk(D, A); this.cap = ['防禦 +' + v + '：每次受傷少 ' + v, 12]; };
        return () => { this.atk(g, Dg); this.atk(A, D); this.cap = ['攻擊間隔 ' + v + 'ms：出手更快', 13]; };
      }
      const D = this.dummy(0, gy), dist = this.gap(A, D); A.x = W / 2 - dist / 2 - 6; D.x = W / 2 + dist / 2 - 6;
      if (at === 'critical') { A.onAtk = () => { A.iCrit = (++this.n % 3 === 0) ? 100 : -100; }; this.cap = ['爆擊率 +' + v + '%，爆擊傷害 ×2', 14]; }
      if (at === 'return') {
        this.bars = 'hp'; let last = A.hp, acc = 0;
        return () => { if (this.t % 7 < 0.05) A.hp = A.st.hp * 0.45; const gain = A.hp - last; last = A.hp; if (gain > 0) { acc += gain; if (acc >= 3) { this.pop(A, '+' + Math.round(acc), 10); acc = 0; } } this.atk(A, D); this.cap = ['吸血 ' + v + '%：打人同時回血', 10]; };
      }
      if (at === 'range') {
        const r0 = A.st.range - v; D.x = A.x + A.st.range * 0.9; this.rings = [[A, r0, 4], [A, A.st.range, 13]];
        this.cap = ['射程 +' + v, 13];
      }
      if (at === 'power' || at === 'armor') this.cap = ['周圍友軍也一起強化', 13];
      return () => this.atk(A, D);
    }
    return () => { };
  }
  update(dt) {
    if (!this.A) return;
    dt = Math.min(dt, 0.05); _sbDt = dt;
    this.trauma = Math.max(0, (this.trauma || 0) - dt * 1.6); this.flashScreen = Math.max(0, this.flashScreen - dt);
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt; this.frame++; this.soundT -= dt; this.parts.update(dt);
    for (const e of this.effects) { e.t += dt; if (e.update) e.update(dt); }
    this.effects = this.effects.filter(e => e.t < e.dur);
    for (const d of this.decals) d.t += dt; this.decals = this.decals.filter(d => d.t < d.dur);
    for (const u of this.units) {
      u.anim += dt; u.lunge = Math.max(0, u.lunge - dt * 7); u.flash -= dt; u.cast = Math.max(0, u.cast - dt); u.knock = Math.max(0, (u.knock || 0) - dt * 20); u.slow -= dt; u.stun = Math.max(0, (u.stun || 0) - dt); u.atkT -= dt;
      this.tickStatus(u, dt);
      if (u.windup > 0) { u.windup -= dt; if (u.windup <= 0) this.fire(u, u.wTarget); }
    }
    for (const p of this.projs) this.updateProj(p, dt);
    this.projs = this.projs.filter(p => !p.done);
    if (this.run) this.run(dt);
  }
  drawUnit(b, u) {
    const s = u.spr[u.vis.fly ? ((u.anim * 1.4) | 0) % u.spr.length : u.walk ? ((u.anim * 2) | 0) % u.spr.length : 0];
    const gx = u.x * G.AX, gy = u.y * G.AY, shR = u.vis.shadow * G.AX * (u.vis.fly ? 0.7 : 1);
    G.pxDisc(b, gx, gy, shR, Math.max(1.5, shR * 0.42), 0, 0.55);
    let dx = 0, dy = 0;
    if (u.windup > 0) dx = -u.face;
    if (u.lunge > 0) dx = Math.round(Math.sin(u.lunge * Math.PI) * 3) * u.face;
    if (u.knock > 0) dx += Math.round(u.knock * 2) * -u.face;
    if (!u.static && Math.sin(u.anim * 3) > 0.7) dy = -1;
    if (u.cast > 0.12) dy -= 2;
    const z = u.z + (u.vis.fly ? Math.sin(u.anim * 2.5) * 3 : 0);
    const img = u.flash > 0 ? (u.face < 0 ? s.fm : s.f) : G.lookOf(u, u.face < 0 ? s.m : s.n);
    const ax = Math.round(gx - s.w / 2 + dx), ay = Math.round(gy - z * G.AZ - s.h + 1 + dy);
    if (!u.ghost) G.VFX.auraBack(b, u, ax, ay, u.face < 0 ? s.m : s.n, gx, gy, this.t, this);
    if (u.ghost) b.globalAlpha = 0.55;
    if (u.charm || u.clone) { const gl = G.glowOf(G.lookOf(u, u.face < 0 ? s.m : s.n), u.clone ? 25 : 17, 1, 2); b.globalAlpha = 0.7; b.drawImage(gl.c, ax - gl.p, ay - gl.p); b.globalAlpha = u.clone ? 0.7 : 1; }
    b.drawImage(img, ax, ay);
    if (!u.ghost) G.VFX.auraFront(b, u, ax, ay, s, gx, gy, this.t, this);
    b.globalAlpha = 1;
    if (u === this.A && this.bars) {
      const bw = 18, x = Math.round(gx - bw / 2), y = Math.round(gy - z * G.AZ - s.h - 5), f = this.bars === 'mp' ? u.mp / u.st.mp : u.hp / u.st.hp;
      b.fillStyle = G.PAL[0]; b.fillRect(x - 1, y - 1, bw + 2, 4); b.fillStyle = G.PAL[2]; b.fillRect(x, y, bw, 2);
      b.fillStyle = G.PAL[this.bars === 'mp' ? 11 : 10]; b.fillRect(x, y, Math.max(0, Math.round(bw * f)), 2);
    }
  }
  draw() {
    if (!this.A) return this.c;
    const b = this.x, o = { x: 0, y: 0 };
    G.setPatOffset(0, 0);
    const tr = this.trauma * this.trauma, shx = Math.round(G.rr(-1, 1) * 3 * tr), shy = Math.round(G.rr(-1, 1) * 2 * tr);
    b.fillStyle = G.PAL[1]; b.fillRect(0, 0, this.w, this.h); b.save(); b.translate(shx, shy);
    b.drawImage(G.groundStrip(this.w, this.h), 0, 0);
    if (G.stageDeco) G.stageDeco(b, 0, 0, this.w, this.h, false);  // 場景點綴：草叢（上緣留給說明文字）
    for (const d of this.decals) G.pxDisc(b, d.x * G.AX, d.y * G.AY, d.r * G.AX, d.r * G.AY, d.col ?? 2, (1 - d.t / d.dur) * 0.75);
    if (this.rings) for (const [u, r, col] of this.rings) G.pxEllipse(b, u.x * G.AX, u.y * G.AY, r * G.AX, r * G.AY, col, col === 4 ? 2 : 0, this.t * 6);
    if (this.rows) for (const [s, y, col] of this.rows) G.cn(b, s, 3, Math.round(y * G.AY) - 12, col, 0, 0);
    for (const e of this.effects) if (e.layer === 0 && e.draw) e.draw(b, o);
    this.parts.draw(b, 0, 0, this.frame, true);
    for (const u of [...this.units].sort((a, c) => a.y - c.y)) this.drawUnit(b, u);
    for (const p of this.projs) {
      const s = G.SPR[p.o.vis], sp = Array.isArray(s) ? s[0] : s; if (!sp) continue;
      const gx = p.x * G.AX, gy = p.y * G.AY;
      if (p.z > 3) G.pxDisc(b, gx, gy, p.o.big ? 3 : 1.5, 1, 0, 0.5);
      if (!(p.o.fx && G.VFX.drawProj(b, p, o, sp, this.t))) b.drawImage(p.dir < 0 || p.tx < p.x0 ? sp.m : sp.n, Math.round(gx - sp.w / 2), Math.round(gy - p.z * G.AZ - sp.h / 2));
    }
    this.parts.draw(b, 0, 0, this.frame, false);
    for (const e of this.effects) if (e.layer === 1 && e.draw) e.draw(b, o);
    for (const e of this.effects) if (e.layer === 2 && e.draw) e.draw(b, o);
    b.restore();
    if (this.flashScreen > 0) { b.fillStyle = `rgba(255,255,255,${Math.min(0.35, this.flashScreen * 2.5)})`; b.fillRect(0, 0, this.w, this.h); }
    if (this.cap) G.cn(b, this.cap[0], Math.round(this.w / 2), 2, this.cap[1], 0.5, 0);
    return this.c;
  }
};
let _sbDt = 1 / 60;
Object.assign(G.Sandbox.prototype, G.Combat);
