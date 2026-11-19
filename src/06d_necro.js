'use strict';
/* =========================================================
   v2.6 死靈召喚力夫（神話英雄）
   - 召喚物：由他的技能生出來的單位（u.summoner = 英雄），預設跟隨英雄
   - 被動「替罪」：身邊有召喚物時，受到的傷害按比例改由召喚物承受（找身邊血最多的那隻）
   - 主動「犧牲召喚」「血祭控制」「複製法術」
   世界與技能展示沙盒共用（掛在 G.Combat 上）
   ========================================================= */
G.NECRO = { R: 80, guard: 120, cap: 12 };          // 暫定：技能半徑、替罪的「身邊」範圍、召喚物上限

// ---------- 文字 ----------
Object.assign(G.TXT.unit, { necroleafy: '死靈召喚力夫' });
Object.assign(G.TXT.uinfo, { necroleafy: '從枯萎森林深處回來的死靈法師。本體很脆弱，靠召喚物替他擋刀、替他作戰；召喚物越多越強。' });
Object.assign(G.TXT.skill, { 4001: '犧牲召喚', 4002: '血祭控制', 4003: '複製法術', 4004: '替罪' });
Object.assign(G.TXT.sinfo, {
  4001: '獻祭身邊的我方小兵，換成等量的隨機小兵（含未解鎖），會跟著你。',
  4002: '犧牲目前一半的血量，把身邊的敵人變成你的召喚物（塔與獵手除外）。',
  4003: '把所有召喚物各複製一隻。複製體只有 1 點血，攻擊力一樣。',
  4004: '身邊有召喚物時，一部分傷害改由召喚物承受（找血最多的那隻）。'
});

// ---------- 元素、配色 ----------
G.ELEM.necro = { c: 17, c2: 27, cd: 28 };
G.ELEM.clone = { c: 18, c2: 25, cd: 12 };
G.RES_VIS.bullet_darkspike = 'darkspike';
// 受控的敵人＝幽魂紫；複製體＝半透明冰青（參考皇室戰爭的複製法術）
G.RAMPS = {
  necro: ['#140720', '#2c0f3d', '#40175a', '#552276', '#6b3190', '#8345ab', '#9d61c4', '#b986dc', '#d6b4ff', '#f0e2ff'],
  clone: ['#06222b', '#0f4152', '#175a6e', '#1f7489', '#2a8fa4', '#3eaabd', '#5fc3d3', '#8cdbe6', '#bdeef4', '#e9fcff']
};
G._rampCache = {};
G.rampOf = function (src, key) {
  const C = G._rampCache[key] || (G._rampCache[key] = new WeakMap()); let r = C.get(src); if (r) return r;
  const w = src.width, h = src.height, c = G.canvas(w, h), x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, w, h), a = d.data, RR = G.RAMPS[key].map(G.hexRGB);
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue; const R0 = a[i], G0 = a[i + 1], B0 = a[i + 2]; if (Math.abs(R0 - G0) > 6 || Math.abs(G0 - B0) > 6) continue;
    let k = 0, bd = 1e9; for (let j = 0; j < 10; j++) { const dd = Math.abs(G.PAL_RGB[j][0] - R0); if (dd < bd) { bd = dd; k = j; } }
    a[i] = RR[k][0]; a[i + 1] = RR[k][1]; a[i + 2] = RR[k][2];
  }
  x.putImageData(d, 0, 0); C.set(src, c); return c;
};
// 單位外觀（世界、沙盒共用）：複製體 → 冰青；受控 → 幽魂紫；敵方 → 赤紅
G.lookOf = (u, src) => u.clone ? G.rampOf(src, 'clone') : u.charm ? G.rampOf(src, 'necro') : (u.side === 1 && !u.static) ? G.redOf(src) : src;

// ---------- 美術 ----------
// 死神造型：深色連帽斗篷（下襬破碎、走路時飄動）、帽兜裡兩顆紅眼、枯萎的嫩芽、右手暗黑法杖（頂端紫色魂晶）
G.BESTIARY.necroleafy = {
  w: 20, h: 21, ol: 0, draw(P, f) {
    // 斗篷後襬（隨步伐擺動）
    P.e(7, 13, 6, 6.5, 2); P.r(2, 13, 11, 5, 2);
    for (let x = 2; x <= 12; x++) { const d = ((x + f) % 3 === 0) ? 2 : ((x + f) % 3 === 1 ? 1 : 0); P.px(x, 18 + d, 2); if (d === 2) P.px(x, 19, 1); }
    P.shade(2, 3, 1);
    P.l(4, 11, 3, 17, 1); P.l(9, 12, 10, 17, 1);                        // 斗篷皺褶
    // 帽兜
    P.e(8, 6.5, 5, 5, 2); P.shade(2, 4, null);
    P.e(9.5, 7.5, 3, 3, 0);                                              // 帽兜裡的黑暗
    P.px(9, 7, 10); P.px(11, 7, 10); P.px(9, 8, 15); P.px(11, 8, 15);     // 紅眼
    // 枯萎的嫩芽（力夫家族的記號）
    P.px(7, 1, 4); P.px(6, 0, 4); P.px(8, 0, 5);
    // 法杖：杖身＋手＋魂晶
    P.l(16, 20, 16, 4, 5); P.px(16, 20, 4);
    P.r(14, 11, 2, 2, 7);                                                // 手（露出一點骨白）
    P.e(16, 3, 2.2, 2.2, 17); P.px(16, 2, 27); P.px(15, 3, 27); P.px(17, 4, 28);
    P.px(14, 2, 5); P.px(18, 2, 5); P.px(16, 0, 5);                      // 杖頭爪
  }
};
G.ART_SMALL.darkspike = ['..1h.....', '1hhhhhhh9', '..1h.....'];

// ---------- 技能形狀、圖示、冷卻 ----------
{
  const _shape = G.skillShape;
  G.skillShape = sd => sd.type === 'necro' ? (sd.attribute === 'clone' ? { k: 'buff', r: 0, cast: 0 } : { k: 'self', r: sd.range || G.NECRO.R, cast: 0 }) : _shape(sd);
  const _icon = G.skillIcon;
  G.skillIcon = sd => sd.type === 'necro' ? ({ sac: 'i_sac', ctrl: 'i_blood', clone: 'i_clone', scape: 'i_scape' })[sd.attribute] : _icon(sd);
  const _slot = G.skillSlot;
  G.skillSlot = id => { const s = _slot(id); if (s.s.type === 'necro') { s.needT = false; s.shape = G.skillShape(s.s); s.range = s.s.range || G.NECRO.R; } return s; };
}
// 技能圖示（8×8 左右，和其他技能圖示同風格）
Object.assign(G.ART_SMALL, {
  i_sac: ['...hh...', '..h99h..', '..h00h..', '...hh...', '.h.hh.h.', 'hh9hh9hh', '.hhhhhh.', '..h..h..'],
  i_blood: ['...a....', '..aaa...', '.aaaaa..', '.aa9aa..', '.aaaaa..', '..aaa...', '.h...h..', 'hhh.hhh.'],
  i_clone: ['.ii..ii.', 'i99ii99i', 'i00ii00i', 'iiiiiiii', '.iiiiii.', '.i.ii.i.', '........', '.i.i.i.i'],
  i_scape: ['..hhhh..', '.h9999h.', '.h9009h.', '.h9999h.', '..h99h..', '...hh...', '.hhhhhh.', 'h......h']
});

// ---------- 戰鬥（G.Combat mixin）----------
Object.assign(G.Combat, {
  necroAdd(u) { if (this.add) this.add(u); else this.units.push(u); return u; },
  necroDrop(u) { u.alive = false; u.follow = false; if (!this.add) this.units = this.units.filter(q => q !== u); },
  summonsOf(h) { return this.units.filter(u => u.alive && u.summoner === h); },
  // 召喚物：安靜地加入跟隨（世界才有跟隨；沙盒不需要）
  makeSummon(h, u) {
    u.summoner = h; u.noRe = false;
    if (this.followSlots && this.hero === h && h.alive && !this.attract) { u.follow = true; u.path = null; u.target = null; u.repath = 0; this.fSlotT = null; this.stats.maxFollow = Math.max(this.stats.maxFollow, this.followCount()); }
    return u;
  },
  // 不能施放的原因（沒有就回傳 null）
  necroWhy(h, sd) {
    const R = sd.range || G.NECRO.R, near = (u) => Math.hypot(u.x - h.x, u.y - h.y) - (u.r || 0) * 0.5 <= R;
    if (sd.attribute === 'sac') return this.units.some(u => u.alive && u !== h && u.side === h.side && u.kind === 'creep' && !u.static && near(u)) ? null : '身邊沒有我方小兵';
    if (sd.attribute === 'ctrl') return this.units.some(u => this.necroCtrlOk(h, u) && near(u)) ? null : '身邊沒有可以控制的敵人';
    if (sd.attribute === 'clone') { const n = this.summonsOf(h).length; return !n ? '還沒有召喚物' : n >= G.NECRO.cap ? '召喚物已達上限 ' + G.NECRO.cap : null; }
    return null;
  },
  necroCtrlOk(h, u) { return u.alive && u.side !== h.side && u.side !== 2 && !u.static && (u.kind === 'creep' || u.kind === 'boss'); },
  // 替罪：身邊（guard 範圍）血最多的召喚物
  scapeOf(t) {
    let best = null; const R = G.NECRO.guard;
    for (const u of this.units) if (u.alive && u.summoner === t && u.hp > 0 && Math.hypot(u.x - t.x, u.y - t.y) <= R && (!best || u.hp > best.hp)) best = u;
    return best;
  },
  // 傷害轉移（damage() 呼叫）：回傳本體實際要扣的傷害
  scapeHit(src, t, dmg) {
    const s = this.scapeOf(t); if (!s) return dmg;
    const tr = Math.min(Math.ceil(s.hp), Math.round(dmg * t.scape / 100)); if (tr <= 0) return dmg;
    s.hp -= tr; s.flash = 0.09;
    if ((this.frame + t.id) % 4 === 0 || tr >= 20) G.VFX.tether(this, t, s, 0.22);
    if (s.hp <= 0) { if (this.add) this.kill(s, src); else s.hp = s.st.hp; }
    return dmg - tr;
  },
  // ----- 主動技 -----
  necroSkill(u, sd, lv) {
    const R = sd.range || G.NECRO.R, cap = G.NECRO.cap, near = q => Math.hypot(q.x - u.x, q.y - u.y) - (q.r || 0) * 0.5 <= R;
    if (sd.attribute === 'sac') {
      const own = this.summonsOf(u);
      let vs = this.units.filter(q => q.alive && q !== u && q.side === u.side && q.kind === 'creep' && !q.static && near(q)).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y));
      const room = cap - own.filter(q => !vs.includes(q)).length; vs = vs.slice(0, Math.max(0, room));
      G.VFX.necroCircle(this, u.x, u.y, R, 0.9, 17);
      this.sfx('sac', u.x, u.y); this.shake(0.25);
      vs.forEach((v, i) => {
        const x = v.x, y = v.y, lane = v.lane, lv2 = v.level, side = v.side;
        G.VFX.soulOut(this, v, u, i * 0.05);
        this.necroDrop(v);
        G.VFX.later(this, 0.38 + i * 0.06, () => {
          const name = G.pick(G.ROSTER.minions), nu = new G.Unit(this, name, side, x, y, lv2, 'creep');
          nu.lane = lane; nu.home = [x, y]; nu.knock = 0; if (!this.add) { nu.spawnT = 0; nu.face = 1; }
          this.necroAdd(nu); this.makeSummon(u, nu); G.VFX.summonRise(this, nu, 17);
          if (i === 0) this.sfx('summon', x, y);
        });
      });
      return true;
    }
    if (sd.attribute === 'ctrl') {
      const pay = Math.floor(u.hp * (sd.value_1 || 50) / 100); u.hp = Math.max(1, u.hp - pay);
      G.FX.popText(this, u.x, u.y, (u.vis.fly || 0) + 30, '-' + pay, 10);
      const room = Math.max(0, cap - this.summonsOf(u).length);
      const ts = this.units.filter(q => this.necroCtrlOk(u, q) && near(q)).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y)).slice(0, room);
      G.VFX.necroCircle(this, u.x, u.y, R, 1.0, 10);
      this.sfx('blood', u.x, u.y); this.shake(0.4); this.hitstop = Math.max(this.hitstop || 0, 0.06);
      for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28; this.parts.add(u.x, u.y, G.rr(8, 22), Math.cos(a) * G.rr(30, 80), Math.sin(a) * G.rr(20, 50), G.rr(30, 90), G.rr(0.4, 0.7), 10, 15, 1, 260, 1); }
      ts.forEach((t, i) => G.VFX.later(this, 0.08 + i * 0.07, () => {
        if (!t.alive) return;
        G.VFX.bloodChain(this, u, t, 0.45);
        t.side = u.side; t.charm = true; t.target = null; t.path = null; t.wTarget = null; t.windup = 0; t.aggro = null; t.chg = null; t.face = -t.face; t.home = [t.x, t.y];
        t.heatT = null; t.zoneA = 0;
        this.makeSummon(u, t); G.VFX.summonRise(this, t, 10);
      }));
      return true;
    }
    if (sd.attribute === 'clone') {
      const own = this.summonsOf(u).sort((a, b) => (a.clone ? 1 : 0) - (b.clone ? 1 : 0) || b.hp - a.hp), n = Math.min(own.length, Math.max(0, cap - own.length));
      G.VFX.cloneWave(this, u, own);
      this.sfx('clone', u.x, u.y);
      own.slice(0, n).forEach((s, i) => G.VFX.later(this, 0.25 + i * 0.04, () => {
        if (!s.alive) return;
        const a = (s.id * 2.399) % 6.283, ox = Math.cos(a) * 26, oy = Math.sin(a) * 14;   // v2.7 複製體一出生就站開一點
        let x = s.x + ox, y = s.y + oy; if (this.M && !this.M.isWalk(x, y)) { x = s.x - ox; y = s.y - oy; if (!this.M.isWalk(x, y)) { x = s.x; y = s.y; } }
        const c = new G.Unit(this, s.name, s.side, x, y, s.level, s.kind);
        c.st = Object.assign({}, s.st); c.hp = sd.value_1 || 1; c.clone = true; c.charm = s.charm; c.lane = s.lane; c.home = [x, y]; c.knock = 0; c.face = s.face; c.rar = s.rar;
        if (s.allyBoss) c.allyBoss = true;
        if (!this.add) c.spawnT = 0;
        this.necroAdd(c); this.makeSummon(u, c); G.VFX.cloneSplit(this, s, c);
      }));
      return true;
    }
    return false;
  }
});

// ---------- 特效 ----------
{
  const SX = (x, o) => x * G.AX - o.x, SY = (y, z, o) => y * G.AY - z * G.AZ - o.y;
  const zOf = q => (q.z || 0) + (q.vis && q.vis.fly || 0) + 10;
  Object.assign(G.VFX, {
    // 地面法陣：外圈＋旋轉符文點＋內圈，col 主色（紫 17／紅 10）
    necroCircle(W, x, y, R, dur, col) {
      W.effects.push({ t: 0, dur, layer: 0, draw(ctx, o) {
        const p = this.t / this.dur, e = Math.min(1, p * 4), fade = p > 0.7 ? (1 - p) / 0.3 : 1, cx = SX(x, o), cy = SY(y, 0, o);
        ctx.globalAlpha = 0.18 * fade; G.pxDisc(ctx, cx, cy, R * G.AX * e, R * G.AY * e, col === 10 ? 15 : 28, 1); ctx.globalAlpha = fade;
        G.pxEllipse(ctx, cx, cy, R * G.AX * e, R * G.AY * e, col, 0, 0); G.pxEllipse(ctx, cx, cy, R * G.AX * e * 0.72, R * G.AY * e * 0.72, col === 10 ? 15 : 28, 3, this.t * 8);
        ctx.fillStyle = G.PAL[col === 10 ? 14 : 27];
        for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + this.t * 1.6; ctx.fillRect(Math.round(cx + Math.cos(a) * R * G.AX * e * 0.86), Math.round(cy + Math.sin(a) * R * G.AY * e * 0.86), 1, 1); }
        ctx.globalAlpha = 1; G.glow(ctx, cx, cy, R * G.AX * 0.6 * e, col, 0.25 * fade, 0.5);
      } });
    },
    // 靈魂從獻祭的小兵身上飄出、飛向施法者
    soulOut(W, v, to, d) {
      const x0 = v.x, y0 = v.y, z0 = zOf(v);
      for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28; W.parts.add(x0, y0, z0, Math.cos(a) * 40, Math.sin(a) * 26, G.rr(30, 80), G.rr(0.3, 0.6), 27, 17, 1, -20, 2); }
      G.FX.ring(W, x0, y0, 2, (v.r || 8) + 10, 0.35, 17, 1);
      W.effects.push({ t: -d, dur: 0.45, layer: 2, draw(ctx, o) {
        if (this.t < 0) return; const p = this.t / this.dur, e = p * p * (3 - 2 * p), x = x0 + (to.x - x0) * e, y = y0 + (to.y - y0) * e, z = z0 + Math.sin(p * Math.PI) * 26 + (zOf(to) - z0) * e;
        G.glow(ctx, SX(x, o), SY(y, z, o), 6, 17, 0.7 * (1 - p * 0.5)); ctx.fillStyle = G.PAL[27]; ctx.fillRect(Math.round(SX(x, o)) - 1, Math.round(SY(y, z, o)) - 1, 2, 2);
      } });
    },
    // 召喚物從地面升起：地面紫圈＋上升光柱＋粒子
    summonRise(W, u, col) {
      G.FX.ring(W, u.x, u.y, (u.r || 8) + 14, 2, 0.4, col, 2);
      G.VFX.groundLight(W, u.x, u.y, 18, col, 0.5, 0.5);
      W.effects.push({ t: 0, dur: 0.5, layer: 1, draw(ctx, o) { const p = this.t / this.dur, cx = SX(u.x, o), cy = SY(u.y, 0, o), hh = 34 * (1 - p); ctx.globalAlpha = 0.45 * (1 - p); ctx.fillStyle = G.PAL[col === 10 ? 10 : 27]; ctx.fillRect(Math.round(cx - 2), Math.round(cy - hh), 4, Math.round(hh)); ctx.globalAlpha = 1; } });
      for (let k = 0; k < 12; k++) W.parts.add(u.x + G.rr(-8, 8), u.y + G.rr(-4, 4), 2, 0, 0, G.rr(40, 110), G.rr(0.35, 0.7), col === 10 ? 10 : 27, col === 10 ? 15 : 17, 1, -30, 0);
    },
    // 血祭鎖鏈：施法者 → 目標的暗紅鎖鏈（鏈節交錯閃動）
    bloodChain(W, a, b, dur) {
      W.effects.push({ t: 0, dur, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, x0 = SX(a.x, o), y0 = SY(a.y, zOf(a), o), x1 = SX(b.x, o), y1 = SY(b.y, zOf(b), o), L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / 3));
        const reach = Math.min(1, p * 3);
        for (let i = 0; i <= n * reach; i++) { const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * -4; ctx.fillStyle = G.PAL[(i + ((this.t * 20) | 0)) % 2 ? 10 : 15]; ctx.fillRect(Math.round(x), Math.round(y), 2, 1); }
        if (reach >= 1) G.glow(ctx, x1, y1, 9, 10, 0.6 * (1 - p));
      } });
    },
    // 替罪：英雄 → 召喚物的紫色細線（傷害被拉走）
    tether(W, a, b, dur) {
      W.effects.push({ t: 0, dur, layer: 1, draw(ctx, o) {
        const p = this.t / this.dur, x0 = SX(a.x, o), y0 = SY(a.y, zOf(a), o), x1 = SX(b.x, o), y1 = SY(b.y, zOf(b), o);
        ctx.globalAlpha = 0.85 * (1 - p); ctx.fillStyle = G.PAL[17]; G.pxLine(ctx, x0, y0, x1, y1, 1); ctx.globalAlpha = 1;
        const k = Math.min(1, p * 1.6); G.glow(ctx, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 4, 17, 0.8 * (1 - p));
      } });
    },
    // 複製法術（參考皇室戰爭）：以施法者為中心擴散的藍色水波泡泡，掃過每隻召喚物時亮一下
    cloneWave(W, u, list) {
      let R = 40; for (const s of list) R = Math.max(R, Math.hypot(s.x - u.x, s.y - u.y) + 20);
      W.effects.push({ t: 0, dur: 0.7, layer: 0, draw(ctx, o) {
        const p = this.t / this.dur, e = 1 - (1 - p) * (1 - p), cx = SX(u.x, o), cy = SY(u.y, 0, o);
        ctx.globalAlpha = 0.22 * (1 - p); G.pxDisc(ctx, cx, cy, R * G.AX * e, R * G.AY * e, 18, 1); ctx.globalAlpha = 1 - p * 0.6;
        G.pxEllipse(ctx, cx, cy, R * G.AX * e, R * G.AY * e, 25, 0, 0); G.pxEllipse(ctx, cx, cy, R * G.AX * e - 2, R * G.AY * e - 1, 18, 2, this.t * 10); ctx.globalAlpha = 1;
      } });
      G.VFX.light(W, u.x, u.y, 20, 26, 18, 0.5, 0.5);
      for (const s of list) G.VFX.later(W, Math.min(0.24, Math.hypot(s.x - u.x, s.y - u.y) / Math.max(1, R) * 0.3), () => { if (!s.alive) return; G.FX.ring(W, s.x, s.y, 2, (s.r || 8) + 8, 0.3, 25, 1); for (let k = 0; k < 6; k++) W.parts.add(s.x + G.rr(-6, 6), s.y, G.rr(4, 20), 0, 0, G.rr(40, 80), 0.4, 25, 18, 1, -10, 0); });
    },
    // 分身出現：從本體位置往旁邊滑出的殘影＋星芒
    cloneSplit(W, s, c) {
      const x0 = s.x, y0 = s.y;
      W.effects.push({ t: 0, dur: 0.3, layer: 1, draw(ctx, o) { const p = this.t / this.dur, x = x0 + (c.x - x0) * p, y = y0 + (c.y - y0) * p; G.glow(ctx, SX(x, o), SY(y, zOf(c), o), 8, 18, 0.6 * (1 - p)); } });
      G.VFX.spark(W, c.x, c.y, zOf(c) + 6, 5, 25, 0.25);
      for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28; W.parts.add(c.x, c.y, zOf(c), Math.cos(a) * 50, Math.sin(a) * 30, G.rr(20, 60), 0.4, 25, 18, 1, 0, 2); }
    }
  });
  // 暗黑尖刺（普攻）：細長的黑紫尖刺＋淡紫殘影煙
  const _dp = G.VFX.drawProj;
  G.VFX.drawProj = function (ctx, p, o, s, rt) {
    if (p.o.fx !== 'necro') return _dp.call(this, ctx, p, o, s, rt);
    const sx = SX(p.x, o), sy = SY(p.y, p.z, o), H = p.hist || [];
    let dx = (p.tx - p.x0) * G.AX, dy = (p.ty - p.y0) * G.AY; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    for (let i = 0; i < H.length; i++) { const k = (i + 1) / (H.length + 1); ctx.globalAlpha = 0.35 * k; ctx.fillStyle = G.PAL[i % 2 ? 17 : 28]; ctx.fillRect(Math.round(SX(H[i][0], o)), Math.round(SY(H[i][1], H[i][2], o)), 2, 1); }
    ctx.globalAlpha = 1; G.glow(ctx, sx, sy, 7, 17, 0.5);
    ctx.fillStyle = G.PAL[28]; G.pxLine(ctx, sx - dx * 6, sy - dy * 6, sx + dx * 3, sy + dy * 3, 3);
    ctx.fillStyle = G.PAL[17]; G.pxLine(ctx, sx - dx * 5, sy - dy * 5, sx + dx * 5, sy + dy * 5, 1);
    ctx.fillStyle = G.PAL[27]; ctx.fillRect(Math.round(sx + dx * 5), Math.round(sy + dy * 5), 1, 1);
    return true;
  };
}
