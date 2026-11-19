'use strict';
/* =========================================================
   世界：單位、戰鬥、技能、兵線、勝負
   ========================================================= */

// 依原著成長公式算出某等級的數值
// v2.7 站位：同一邊單位以圖片大小分開（SEP_X／SEP_Y＝兩隻寬／高總和的比例，0.375 ≈ 左右重疊 25%）；跟隨隊形相鄰間距
G.SEP_X = 0.45; G.SEP_Y = 0.5; G.FOLLOW_GAP = 38;
G.stats = function (name, lv, side, kind) {
  if (kind === 'holy') { const h = G.TUNE.holy[side === 0 ? 'player' : 'enemy']; return { hp: h.hp, mp: 0, power: 0, armor: h.armor, crit: 0, delay: 9, range: 0, speed: 0, hpReg: h.heal_hp, mpReg: 0, weapon: null, exp: 600 }; }
  const o = G.ORIG.units[name] || G.ORIG.towers[name], L = lv - 1;
  // v2.2 敵方成長加成（配合技能升級變強）：敵方兵線／首領／獵手每級額外 HP、攻擊 %
  const E = G.BAL && G.BAL.enemy, eg = E && side === 1 && (kind === 'creep' || kind === 'boss' || kind === 'jungler') ? L : 0, hm = 1 + (E ? E.hp : 0) / 100 * eg, pm = 1 + (E ? E.pow : 0) / 100 * eg;
  return {
    hp: Math.round((o.hp + (o.grow_hp || 0) * L) * hm), mp: (o.mp || 0) + (o.grow_mp || 0) * L,
    power: Math.round((o.power + (o.grow_power || 0) * L) * pm), armor: o.armor + (o.grow_armor || 0) * L,
    crit: (o.critical || 0) + (o.grow_critical || 0) * L,
    delay: Math.max(300, (o.delay || 1000) + (o.grow_delay || 0) * L) / 1000,
    range: o.range + (o.grow_range || 0) * L, speed: (o.speed || 0) + (o.grow_speed || 0) * L,
    hpReg: (o.heal_hp || 0) + (o.grow_heal_hp || 0) * L, mpReg: (o.heal_mp || 0) + (o.grow_heal_mp || 0) * L,
    weapon: o.weapon_name, wopt: (o.weapon_option || 0) + (o.weapon_grow_option || 0) * L, exp: o.exp
  };
};

let UID = 1;
G.Unit = class {
  constructor(W, name, side, x, y, level, kind) {
    this.id = UID++; this.W = W; this.name = name; this.side = side; this.kind = kind; this.level = level;
    this.vis = G.VIS[name]; this.spr = G.SPR[this.vis.spr];
    this.x = this.px = x; this.y = this.py = y; this.z = this.vis.fly || 0; this.vx = this.vy = 0;
    this.rar = side === 0 && (kind === 'hero' || kind === 'creep') ? G.rarityOf(name) : null;
    this.face = side === 0 ? 1 : -1; this.alive = true; this.static = kind === 'tower' || kind === 'holy';
    this.atkT = Math.random() * 0.3; this.windup = 0; this.target = null; this.retarget = Math.random() * 0.3;
    this.anim = Math.random() * 10; this.flash = 0; this.lunge = 0; this.cast = 0; this.stun = 0; this.slow = 0; this.spawnT = kind === 'creep' || kind === 'hero' ? 0.3 : 0;
    this.calc(); this.hp = this.st.hp; this.mp = this.st.mp;
  }
  calc() {
    this.st = G.stats(this.name, this.level, this.side, this.kind);
    this.aura = null; this.lifesteal = 0; this.mpDisc = 0; this.scape = 0;
    const ps = this.pskills || (this.passives || []).map(id => ({ s: G.ORIG.skills[id], lv: 1 }));
    for (const sl of ps) {                          // 被動技能（原著 attribute；依技能等級成長，0 級不生效）
      if (!sl.lv) continue;
      const p = sl.s, v = p.value_1 + p.grow_value_1 * (sl.lv - 1), st = this.st;
      switch (p.attribute) {
        case 'hp_sec': st.hpReg += v; break;
        case 'mp_sec': st.mpReg += v / 10; break;
        case 'delay': st.delay = Math.max(0.3, st.delay + v / 1000); break;
        case 'speed': st.speed += v; break;
        case 'critical': st.crit += v; break;
        case 'range': st.range += v; break;
        case 'return': this.lifesteal += v; break;
        case 'mp_discount': this.mpDisc += v; break;
        case 'scape': this.scape = v; break;                 // v2.6 替罪（%）
        case 'power': st.power += v; if (p.type === 'multi_buff') this.aura = Object.assign(this.aura || {}, { pow: v }); break;
        case 'armor': st.armor += v; if (p.type === 'multi_buff') this.aura = Object.assign(this.aura || {}, { arm: v }); break;
      }
    }
    if (this.kind === 'creep') this.st.speed *= G.TUNE.creepSpeedMul;
    const D = this.W && this.W.dif; if (D && this.side === 1 && !this.static) { this.st.hp = Math.round(this.st.hp * D.hp); this.st.power = Math.round(this.st.power * D.pow); }   // v3.0 關卡難度
    this.melee = this.st.range <= 40;
  }
  get r() { return this.vis.r; }
};

G.World = class {
  constructor(opt) {
    this.stageI = opt.stage || 0; this.stage = G.STAGES[this.stageI] || G.STAGES[0];
    this.dif = this.stage.dif || null; this.themeId = this.stage.theme || 'forest'; this.theme = this.stageI ? G.THEMES[this.themeId] : null;   // v3.0 關卡難度與場景
    const md = G.MAPS[this.stage.map], T = G.TILE;
    G.mapCache = G.mapCache || {};
    if (!G.mapCache[this.stage.map]) { const M = G.buildMap(md); G.mapCache[this.stage.map] = { M, ground: G.renderGround(M) }; }
    this.M = G.mapCache[this.stage.map].M; this.ground = G.mapCache[this.stage.map].ground;
    if (this.theme && this.theme.nat) { const gk = this.stage.map + '|' + this.themeId; if (!G.mapCache[gk]) G.mapCache[gk] = G.withTheme(this.themeId, () => G.renderGround(this.M)); this.ground = G.mapCache[gk]; }
    this.units = []; this.projs = []; this.effects = []; this.decals = []; this.parts = new G.Particles(2600);
    this.spawnQ = []; this.time = 0; this.trauma = 0; this.flashScreen = 0; this.hitstop = 0; this.timeScale = 1;
    this.notices = []; this.stats = { kills: 0, time: 0, deaths: 0, assists: 0, camps: 0, towers: 0, gold: 0, dmg: 0, taken: 0, tower: 0, bosses: 0, hunters: 0, wboss: 0, potions: 0, tps: 0, maxFollow: 0, streak: 0, minHoly: 1, spent: 0 }; this.killT = [];   // 即時戰鬥數據
    this.over = null; this.attract = !!opt.attract; this.frame = 0;
    // 聖所與塔
    this.holy = [
      this.add(new G.Unit(this, 'player_holy', 0, md.holy.player[0] * T, md.holy.player[1] * T, 1, 'holy')),
      this.add(new G.Unit(this, 'enemy_holy', 1, md.holy.enemy[0] * T, md.holy.enemy[1] * T, 1, 'holy'))
    ];
    // 塔：每路外塔/內塔；內塔受外塔保護，聖所受內塔保護（任一路內塔被破才可攻擊聖所）
    this.towers = [[], []];
    const tw = md.towers3 || { player: (md.towers.player || []).map(p => [p, 1, 0]), enemy: (md.towers.enemy || []).map(p => [p, 1, 0]) };
    [['player', 0], ['enemy', 1]].forEach(([k, side]) => tw[k].forEach(([p, lane, tier]) => {
      // 外塔(0) → 中塔(1) → 內塔(2) → 主塔(9)
      const name = side === 0 ? 'player_tower' : ['enemy_tower', 'enemy_tower2', 'enemy_tower3'][tier] || 'enemy_tower4';
      const u = this.add(new G.Unit(this, name, side, p[0] * T, p[1] * T, 1, 'tower')); u.lane = lane; u.tier = tier; this.towers[side].push(u);
      if (tier === 9) { const m = G.ORIG.towers.enemy_tower4; Object.assign(u.st, { hp: m.hp, power: m.power, armor: m.armor, range: m.range, delay: m.delay / 1000 }); u.hp = u.st.hp; u.main = true; }
      if (side === 1 && this.dif) { u.st.hp = Math.round(u.st.hp * this.dif.tower); u.hp = u.st.hp; }   // v3.0 敵塔血量倍率
    }));
    // 保護鏈：同一路前一層塔沒倒，後一層有護盾；任一路內塔倒了才能打主塔；主塔倒了才能打聖所
    for (let side = 0; side < 2; side++) {
      const tw = this.towers[side];
      for (const u of tw) if (u.tier === 1 || u.tier === 2) { const o = tw.find(v => v.lane === u.lane && v.tier === u.tier - 1); if (o) u.protectors = [o]; }
      const inner = tw.filter(v => v.tier === 2), main = tw.filter(v => v.tier === 9);
      if (main.length) { main.forEach(m => { if (inner.length) { m.protectors = inner; m.protectAll = true; } }); this.holy[side].protectors = main; }
      else if (inner.length) { this.holy[side].protectors = inner; this.holy[side].protectAll = true; }
    }
    // 流場：每一路、每一方各一張（離開該路的格子成本 ×15，所以小兵會沿著自己的路走）
    const nl = md.laneCount || 1, M = this.M;
    const seeds = h => { const s = []; for (let i = 0; i < M.nav.length; i++) { if (!M.nav[i]) continue; const [x, y] = M.cellXY(i); if (G.d2(x, y, h.x, h.y) < 60 * 60) s.push(i); } return s; };
    G.flowCache = G.flowCache || {};
    const fk = this.stage.map;
    if (!G.flowCache[fk]) {
      const fl = [[], []];
      for (let li = 0; li < nl; li++) {
        let wt = null;
        if (nl > 1) { wt = new Float32Array(M.nav.length); for (let i = 0; i < M.nav.length; i++) { const [x, y] = M.cellXY(i); wt[i] = M.laneIn(li, x / T, y / T) <= 1.2 ? 1 : 15; } }
        fl[0][li] = M.dijkstra(seeds(this.holy[1]), wt); fl[1][li] = M.dijkstra(seeds(this.holy[0]), wt);
      }
      G.flowCache[fk] = fl;
    }
    this.flow = G.flowCache[fk];
    this.nLanes = nl;
    // 各路出生點：沿該路流場從聖所走出一段
    this.laneSpawn = [0, 1].map(s => this.flow[s].map(f => { let x = this.holy[s].x, y = this.holy[s].y; for (let i = 0; i < 10; i++) { const d = M.flowDir(f, x, y); if (!d) break; x += d[0] * 16; y += d[1] * 16; } return [x, y]; }));
    this.spawnPt = [0, 1].map(s => { const f = this.flow[s][Math.min(1, nl - 1)]; let x = this.holy[s].x, y = this.holy[s].y; for (let i = 0; i < 4; i++) { const d = M.flowDir(f, x, y); if (!d) break; x += d[0] * 16; y += d[1] * 16; } return [x, y]; });
    // Boss
    if (this.stage.boss) { const b = md.bossHome; this.boss = this.add(new G.Unit(this, this.stage.boss, 1, b[0] * T, b[1] * T, this.stage.bossLevel, 'boss')); this.boss.home = [b[0] * T, b[1] * T]; this.boss.skillCd = 3; }
    // 英雄
    this.hero = null;
    this.loadout = (opt.loadout && opt.loadout.length ? opt.loadout : this.stage.loadout).map(e => typeof e === 'string' ? { n: e, l: 1 } : e);
    this.loadPts = this.loadout.reduce((a, e) => a + G.Team.cost(e.n), 0);
    if (!this.attract && G.Ach) G.Ach.begin(this);
    if (!this.attract) this.spawnHero(G.HEROES[opt.hero || 0]);
    this.waveT = [G.TUNE.firstAllyWave, G.TUNE.firstEnemyWave]; this.waveN = [0, 0];
    if (this.attract) this.waveT = [0.5, 0.5];
    this.initSystems();
  }
  add(u) { this.units.push(u); return u; }

  spawnHero(hd) {
    const [x, y] = this.spawnPt[0];
    const h = new G.Unit(this, hd.name, 0, x, y, 1, 'hero');
    h.hd = hd; h.passives = hd.passives; h.calc(); h.hp = h.st.hp; h.mp = h.st.mp; h.exp = 0;
    h.skills = hd.skills.map(id => G.skillSlot(id));
    h.pskills = hd.passives.map(id => Object.assign(G.skillSlot(id), { passive: true }));
    h.passives = null; h.calc(); h.hp = h.st.hp; h.mp = h.st.mp;
    h.cmd = null; h.path = null; h.pending = null; h.hold = false; h.repath = 0; h.dead = 0; h.sp = 0;
    this.hero = this.add(h);
    G.FX.spawn(this, h);
  }

  // ---------- 音效（只播放鏡頭附近） ----------
  sfx(name, x, y) {
    if (this.attract) return;
    if (x != null && this.cam && G.d2(x, y, this.cam.x, this.cam.y) > 520 * 520) return;
    G.Audio.play(name);
  }
  shake(v) { this.trauma = Math.min(1, this.trauma + v); }

  // ---------- 主更新 ----------
  update(dt) {
    this.frame++;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    dt *= this.timeScale;
    this.time += dt; if (!this.over) this.stats.time += dt;
    if (!this.attract && ((this.tgT = (this.tgT || 0) - dt) <= 0)) { this.tgT = 1; this.towerGrow(); }
    if ((this.leafT = (this.leafT || 0) - dt) <= 0) {   // v2.5 落葉：每 0.22 秒從鏡頭附近的一棵樹飄下一片
      this.leafT = 0.22; const cam = G.Render.cam;
      if (!this.leafPool || this.time - (this.leafPoolT || -9) > 1) { this.leafPoolT = this.time; this.leafPool = this.M.props.filter(p => p.tree && Math.abs(p.x - cam.x) < 420 && Math.abs(p.y - cam.y) < 320); }
      const tr = this.leafPool.length && this.leafPool[(Math.random() * this.leafPool.length) | 0];
      if (tr) this.parts.add(tr.x + G.rr(-8, 8), tr.y + G.rr(-2, 2), G.rr(30, 46), G.rr(10, 22), G.rr(-3, 3), G.rr(-4, 2), G.rr(2.8, 3.6), G.pick(this.theme ? this.theme.leaf : [22, 23, 22, 24, 16]), 3, 1, 9, 0, 2);
    }
    this.updateWaves(dt); this.updateSystems(dt);
    if (this.stageI && !this.attract) { G.SoloW.tick(this, dt); G.SoloW.weather(this, dt); }   // v3.0 關卡特殊規則＋天氣
    if (G.Ach && !this.attract) G.Ach.tick(this, dt);
    // 廣播：最多同時顯示 4 則（上下堆疊），其餘排隊；顯示中的才計時
    if (this.notices.length) { for (let i = 0; i < Math.min(4, this.notices.length); i++) this.notices[i].age += dt; this.notices = this.notices.filter(n => n.age < n.t + G.NOTICE_OUT); }
    for (const u of this.units) { u.px = u.x; u.py = u.y; }
    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    this.separate();
    for (const p of this.projs) this.updateProj(p, dt);
    this.projs = this.projs.filter(p => !p.done);
    for (const e of this.effects) { e.t += dt; if (e.update) e.update(dt); }
    this.effects = this.effects.filter(e => e.t < e.dur);
    for (const d of this.decals) d.t += dt;
    if (this.mark) { this.mark.t += dt; const h = this.hero; if (!h || !h.alive || !h.cmd || h.cmd.type !== 'move') { this.mark.out = (this.mark.out || 0) + dt; if (this.mark.out > 0.2) this.mark = null; } else this.mark.out = 0; }
    this.decals = this.decals.filter(d => d.t < d.dur);
    this.parts.update(dt);
    this.units = this.units.filter(u => u.alive || (u === this.hero));
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.flashScreen = Math.max(0, this.flashScreen - dt);
    // 英雄復活
    const h = this.hero;
    if (h && !h.alive && !this.over) {
      h.dead -= dt;
      if (h.dead <= 0) { const [x, y] = this.spawnPt[0]; h.x = h.px = x; h.y = h.py = y; h.alive = true; h.hp = h.st.hp; h.mp = h.st.mp; h.cmd = null; h.target = null; h.pending = null; G.FX.respawn(this, h); this.sfx('shield'); }   // 重生特效（不是升級）
    }
    if (this.over) { this.over.t += dt / Math.max(0.1, this.timeScale); if (this.over.t > 1.4) this.timeScale = 1; }
    // BGM 強度
    if (h && h.alive && !this.attract) {
      let n = 0; for (const u of this.units) if (u.alive && u.side === 1 && G.d2(u.x, u.y, h.x, h.y) < 300 * 300) n += u.kind === 'boss' ? 4 : 1;
      G.Audio.setIntensity(G.clamp(n / 5, 0, 1));
    }
  }

  // ---------- 兵線 ----------
  updateWaves(dt) {
    if (this.over) return;
    for (let s = 0; s < 2; s++) {
      this.waveT[s] -= dt * (s === 0 && this.hero ? 1 + (this.hero.iWave || 0) / 100 : 1);   // 小兵藥水：我方出兵加速
      if (this.waveT[s] <= 0) { this.waveT[s] = G.TUNE.waveInterval * (this.attract ? 0.5 : 1) * (s === 1 && this.dif ? this.dif.wave : 1); this.spawnWave(s); }
    }
    for (const q of this.spawnQ) q.t -= dt;
    for (const q of this.spawnQ.filter(q => q.t <= 0)) {
      const lane = Math.min(q.lane ?? 1, this.nLanes - 1), [x, y] = q.at || this.laneSpawn[q.side][lane];
      // 雙生花：兩隻同時、左右並排出生（各自獨立行動）
      let sx = x + G.rr(-10, 10), sy = y + G.rr(-10, 10);
      if (q.twin != null) { const ox = x + (q.twin ? 8 : -8), oy = y + (q.twin ? 14 : -14); if (this.M.isWalk(ox, oy)) { sx = ox; sy = oy; } }
      const u = this.add(new G.Unit(this, q.name, q.side, sx, sy, q.level, q.kind || 'creep')); u.lane = lane;
      if (q.ghost) { u.ghost = 1; u.hp = Math.max(1, Math.round(u.st.hp * q.ghost / 100)); }   // v3.0 亡者復甦：幽魂只剩部分血量
      G.FX.spawn(this, u); this.sfx('spawn', x, y);
    }
    this.spawnQ = this.spawnQ.filter(q => q.t > 0);
  }
  spawnWave(s) {
    const n = this.waveN[s]++;
    if (this.units.filter(u => u.alive && u.side === s && u.kind !== 'holy' && !u.static).length > 40) return;
    if (s === 0) {
      let k = 0;
      this.loadout.forEach(({ n: name, l }) => {
        if (name === 'twinflower') { const t = (k++) * 0.4; for (let j = 0; j < 2; j++) this.spawnQ.push({ t, name, side: 0, level: this.stage.allyLevel, lane: l, twin: j }); }
        else this.spawnQ.push({ t: (k++) * 0.4, name, side: 0, level: this.stage.allyLevel, lane: l });
      });
    } else if (this.stage.roster) { G.SoloW.wave(this, n); return; }   // v3.0 關卡：自訂敵人名單
    else {
      // 依原著關卡順序逐波升級（第 n 波 = 原著第 n+1 關的敵人與等級）
      const st = G.ORIG.stages[Math.min(99, 1 + n)] || G.ORIG.stages[1], m = st.missions[0];
      for (let lane = 0; lane < this.nLanes; lane++) m.enemies.forEach((name, i) => this.spawnQ.push({ t: i * 0.45, name, side: 1, level: st.start_level, lane }));
      if (m.boss && n % 3 === 2) { this.spawnQ.push({ t: m.enemies.length * 0.45 + 0.5, name: m.boss, side: 1, level: st.start_level + 1, kind: 'boss', lane: n % this.nLanes }); this.sfx('warn'); }
      this.stageNow = 1 + n;
    }
  }
  // ---------- 搜尋 ----------
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) - b.r; }
  inRange(a, b, extra = 0) { return this.dist(a, b) - a.r * 0.4 <= a.st.range + extra; }
  nearestEnemy(u, range, fromX = u.x, fromY = u.y) {
    let best = null, bd = 1e9;
    for (const t of this.units) {
      if (!t.alive || t.side === u.side || (t.protectors && this.isProtected(t))) continue;
      if (t.side === 2 && u.kind !== 'hero' && t.aggro !== u) continue;   // 中立怪：只有英雄（或被牠盯上的）會打
      if (!this.seen(u.side, t)) continue;                                // 迷霧裡的看不到
      let d = Math.hypot(t.x - fromX, t.y - fromY) - t.r;
      if (d > range) continue;
      if (t.static) d += 40;                // 優先打單位
      if (t.side === 2) d += 60;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  valid(u, t) { return t && t.alive && t.side !== u.side && !this.isProtected(t) && (u.side === 2 || this.seen(u.side, t)); }
  isProtected(t) { const p = t.protectors; if (!p || !p.length) return false; return t.protectAll ? p.every(v => v.alive) : p.some(v => v.alive); }

  // ---------- 移動 ----------
  moveDir(u, dx, dy, dt, mul = 1) {
    const sp = u.st.speed * mul * (u.slow > 0 ? 0.5 : 1) * (u.iSpd || 1) * G.TUNE.moveMul * (this.wind > 0 ? G.SOLO_HZ.wind.k : 1) * (this.bliz > 0 ? G.SOLO_HZ.blizzard.k : 1);
    const k = G.damp(u.kind === 'hero' ? 20 : 9, dt);
    u.vx += (dx * sp - u.vx) * k; u.vy += (dy * sp - u.vy) * k;
    this.step(u, dt);
  }
  brake(u, dt) { const k = G.damp(16, dt); u.vx -= u.vx * k; u.vy -= u.vy * k; this.step(u, dt); }
  step(u, dt) {
    const M = this.M, nx = u.x + u.vx * dt, ny = u.y + u.vy * dt;
    if (M.isWalk(nx, ny)) { u.x = nx; u.y = ny; }
    else if (M.isWalk(nx, u.y)) { u.x = nx; u.vy *= 0.5; }
    else if (M.isWalk(u.x, ny)) { u.y = ny; u.vx *= 0.5; }
    else { u.vx *= 0.3; u.vy *= 0.3; }
    if (Math.abs(u.vx) > 6) u.face = u.vx > 0 ? 1 : -1;
    const sp = Math.hypot(u.vx, u.vy);
    u.anim += dt * (sp > 8 ? sp / 9 : 1);
    if (u.kind === 'hero' && sp > 20 && ((u.anim * 2) | 0) !== u._step) { u._step = (u.anim * 2) | 0; if (Math.random() < 0.6) this.parts.add(u.x - u.vx * 0.05, u.y + 2, 0, G.rr(-10, 10), G.rr(-5, 5), G.rr(10, 25), 0.35, 6, 4, 1, 60, 3, 0); }
  }
  moveTo(u, x, y, dt, mul = 1) {
    const dx = x - u.x, dy = y - u.y, l = Math.hypot(dx, dy);
    if (l < 2) { this.brake(u, dt); return true; }
    this.moveDir(u, dx / l, dy / l, dt, mul); return false;
  }
  flowMove(u, dt) {
    const d = this.M.flowDir(this.flow[u.side][u.lane ?? Math.min(1, this.nLanes - 1)], u.x, u.y);
    if (d) this.moveDir(u, d[0], d[1], dt); else this.brake(u, dt);
  }
  // 分離（避免重疊）
  separate() {
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i]; if (!a.alive) continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j]; if (!b.alive || (a.static && b.static) || (!!a.vis.fly !== !!b.vis.fly)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 < 0.0001) continue;
        let ov;
        if (a.side === b.side && !a.static && !b.static) {
          // v2.7 同一邊的單位：用「畫面上的圖片大小」分開，左右只容許約 10% 重疊、上下不重疊，每一隻都點得到
          const sa = a.spr[0], sb = b.spr[0], hx = (sa.w + sb.w) * G.SEP_X / G.AX, hy = (sa.h + sb.h) * G.SEP_Y / G.AY;
          const q = (dx * dx) / (hx * hx) + (dy * dy) / (hy * hy); if (q >= 1) continue;
          ov = (1 / Math.sqrt(q) - 1);
        } else {
          const rr = (a.r + b.r) * 0.85; if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2); ov = (rr - d) / d;
        }
        let wa = a.static ? 0 : a.kind === 'hero' || a.kind === 'boss' ? 0.3 : 1, wb = b.static ? 0 : b.kind === 'hero' || b.kind === 'boss' ? 0.3 : 1;
        if (a.side === b.side) { if (a.kind === 'hero') wa = 0; if (b.kind === 'hero') wb = 0; }   // v2.5 英雄不被自己人擠，小兵讓路
        const s = wa + wb; if (!s) continue; wa /= s; wb /= s;
        const k = 0.5;
        const ax = a.x - dx * ov * wa * k, ay = a.y - dy * ov * wa * k, bx = b.x + dx * ov * wb * k, by = b.y + dy * ov * wb * k;
        if (wa && this.M.isWalk(ax, ay)) { a.x = ax; a.y = ay; }
        if (wb && this.M.isWalk(bx, by)) { b.x = bx; b.y = by; }
      }
    }
  }

  // ---------- 單位 AI ----------
  updateUnit(u, dt) {
    u.flash -= dt; u.lunge = Math.max(0, u.lunge - dt * 6); if (u.recoil > 0) u.recoil = Math.max(0, u.recoil - dt * 7); u.cast = Math.max(0, u.cast - dt); u.spawnT = Math.max(0, u.spawnT - dt);
    u.atkT -= dt; u.slow -= dt;
    if (u.hp < u.st.hp) u.hp = Math.min(u.st.hp, u.hp + u.st.hpReg * dt);
    this.tickStatus(u, dt); if (!u.alive) return;
    if (u.tb) this.tickBuffs(u, dt);
    if (u.st.mp) u.mp = Math.min(u.st.mp, u.mp + (u.st.mpReg + (u.iMp || 0)) * dt);
    if (u.chg) { this.tickCharge(u, dt); return this.brake(u, dt); }
    if (u.windup > 0) { u.windup -= dt; if (u.windup <= 0) this.fire(u, u.wTarget); return this.brake(u, dt); }
    if (u.stun > 0) { u.stun -= dt; return this.brake(u, dt); }
    if (u.kind === 'holy') return;
    if (u.kind === 'tower') return this.towerAI(u, dt);
    if (u.kind === 'hero') return this.heroAI(u, dt);
    if (u.side === 2) return this.wildAI(u, dt);
    if (u.kind === 'jungler') return this.junglerAI(u, dt);
    if (u.kind === 'boss') return this.bossAI(u, dt);
    this.creepAI(u, dt);
  }
  tryAttack(u, t) {
    u.face = t.x > u.x ? 1 : -1;
    if (u.atkT <= 0) { u.windup = u.melee ? 0.13 : 0.09; u.wTarget = t; u.atkT = 9; }
  }
  creepAI(u, dt) {
    if (u.summoner && !u.follow && !u.noRe && u.summoner === this.hero && u.summoner.alive) this.makeSummon(u.summoner, u);   // v2.6 召喚物：英雄復活後自動回到身邊
    if (u.follow && this.followAI(u, dt)) return;
    u.retarget -= dt;
    if (!this.valid(u, u.target) || u.retarget <= 0) { u.retarget = 0.35; u.target = this.nearestEnemy(u, Math.max(G.TUNE.aggro, u.st.range + 20)); }
    const t = u.target;
    if (t) {
      if (this.inRange(u, t)) { this.brake(u, dt); this.tryAttack(u, t); }
      else this.moveTo(u, t.x, t.y, dt);
    } else this.flowMove(u, dt);
  }
  bossAI(u, dt) {
    if (u.summoner && !u.follow && !u.noRe && u.summoner === this.hero && u.summoner.alive) this.makeSummon(u.summoner, u);
    if (u.follow && this.followAI(u, dt)) return;
    u.retarget -= dt; u.skillCd = (u.skillCd ?? 3) - dt;
    const home = u.home;
    if (!this.valid(u, u.target) || u.retarget <= 0) { u.retarget = 0.4; u.target = home ? this.nearestEnemy(u, 210, home[0], home[1]) : this.nearestEnemy(u, Math.max(G.TUNE.aggro, u.st.range + 20)); }
    const t = u.target, sid = G.BOSS_SKILL[u.name];
    if (t) {
      if (sid && u.skillCd <= 0) {
        const sd = G.ORIG.skills[sid], d = this.dist(u, t), round = (G.WEAPONS_BY_ID[sd.weapon_id] || {}).attack_type === 'round';
        if (d < sd.range && (round || d > 30)) { u.skillCd = Math.max(3, sd.delay); this.beginCharge(u, sd, t, sd.lv1 || 1, G.TUNE.chgBoss); }
      }
      if (this.inRange(u, t)) { this.brake(u, dt); this.tryAttack(u, t); }
      else this.moveTo(u, t.x, t.y, dt);
    } else if (home) { if (G.d2(u.x, u.y, home[0], home[1]) > 100) this.moveTo(u, home[0], home[1], dt); else this.brake(u, dt); }
    else this.flowMove(u, dt);
  }
  // v2.5 塔隨時間變強（參考 LoL：塔的攻擊隨時間成長、到中期封頂）：第 2 分鐘起線性成長、第 14 分鐘封頂；雙方相同
  towerGrow() {
    const TG = G.TUNE.towerGrow, k = G.clamp((this.time / 60 - TG.from) / (TG.to - TG.from), 0, 1);
    for (const u of this.units) {
      if (!u.alive || u.kind !== 'tower') continue;
      if (!u.st0) u.st0 = { hp: u.st.hp, power: u.st.power };
      const nh = Math.round(u.st0.hp * (1 + TG.hp * k)); if (nh !== u.st.hp) { u.hp = u.hp * nh / u.st.hp; u.st.hp = nh; }
      u.st.power = Math.round(u.st0.power * (1 + TG.pow * k));
    }
  }
  towerAI(u, dt) {
    u.retarget -= dt;
    if (!this.valid(u, u.target) || !this.inRange(u, u.target) || u.retarget <= 0) { u.retarget = 0.5; u.target = this.nearestEnemy(u, u.st.range); }
    if (u.target) this.tryAttack(u, u.target);
  }

  // ---------- 英雄 ----------
  heroAI(h, dt) {
    const T = G.TUNE;
    let nd = 1e9; for (const t of this.units) if (t.alive && t.side !== h.side) { const d = Math.hypot(t.x - h.x, t.y - h.y) - t.r - h.r * 0.4; if (d < nd) nd = d; }
    if (h.inv > 0) h.inv = Math.max(0, h.inv - dt);
    if (h.hot) { const d = Math.min(h.hot.left, h.hot.rate * dt), k = h.hot.k; if (k === 'hp') h.hp = Math.min(h.st.hp, h.hp + d); else h.mp = Math.min(h.st.mp, h.mp + d); h.hot.left -= d; if (h.hot.left <= 0.01 || (k === 'hp' ? h.hp >= h.st.hp : h.mp >= h.st.mp)) h.hot = null; }
    { let lk = false; for (const t of this.units) if (t.alive && t.kind === 'tower' && t.side !== h.side && t.target === h) { lk = true; break; }
      if (lk && !h.tLock && !this.attract && this.time - (h.lockSnd || -9) > 1.5) { h.lockSnd = this.time; h.lockT = 0; this.sfx('alarm'); } if (lk) h.lockT = (h.lockT || 0) + dt; h.tLock = lk; }   // 被敵塔鎖定：頭上紅色驚嘆號＋警示音
    h.nearD = nd; h.rangeA = G.clamp((h.rangeA || 0) + (nd < h.st.range + 110 ? 4 : -3) * dt, 0, 1);
    const cdr = 1 / (1 - Math.min(60, h.iCdr || 0) / 100);
    for (const s of h.skills) { if (s.cd > 0) { s.cd -= dt * cdr; if (s.cd <= 0) { s.ready = 0.4; this.sfx('ready'); } } s.ready = Math.max(0, s.ready - dt); }
    // 聖所回復
    if (G.d2(h.x, h.y, this.holy[0].x, this.holy[0].y) < T.sanctuaryRange * T.sanctuaryRange) {
      h.hp = Math.min(h.st.hp, h.hp + h.st.hp * T.sanctuaryHeal * dt); h.mp = Math.min(h.st.mp, h.mp + h.st.mp * T.sanctuaryHeal * dt);
      if (Math.random() < dt * 8) this.parts.add(h.x + G.rr(-10, 10), h.y, 2, 0, 0, 40, 0.6, 9, 7, 1, -10, 0);
    }
    // 鍵盤直接移動
    const kd = this.keyDir;
    if (kd) { this.cancelTeleport(true); h.cmd = null; h.pending = null; h.path = null; return this.moveDir(h, kd[0], kd[1], dt); }
    if (this.tp && this.tp.ch) { h.target = null; return this.brake(h, dt); }   // 傳送引導中：原地不動
    // 待施放技能：走到射程內再放
    if (h.pending) {
      const p = h.pending, s = h.skills[p.i];
      if (!this.valid(h, p.t)) h.pending = null;
      else if (this.dist(h, p.t) <= s.range) { h.pending = null; this.castSkill(h, p.i, p.t); return this.brake(h, dt); }
      else return this.chase(h, p.t, dt);
    }
    const c = h.cmd;
    if (c && c.type === 'move') {
      if (!h.path || !h.path.length) { h.cmd = null; return this.brake(h, dt); }
      const wp = h.path[0];
      if (G.d2(h.x, h.y, wp[0], wp[1]) < 36) { h.path.shift(); if (!h.path.length) { h.cmd = null; } }
      if (h.path && h.path.length) {
        const w = h.path[0], dx = w[0] - h.x, dy = w[1] - h.y, l = Math.hypot(dx, dy) || 1; this.moveDir(h, dx / l, dy / l, dt);
        // 卡住偵測：0.5 秒內幾乎沒有接近終點就停下（例如點在塔上走不到）
        const end = h.path[h.path.length - 1], dd = Math.hypot(end[0] - h.x, end[1] - h.y);
        if (dd < (c.best ?? 1e9) - 3) { c.best = dd; c.stall = 0; } else if ((c.stall = (c.stall || 0) + dt) > 0.5) { h.cmd = null; h.path = null; h.retarget = 0; }
      }
      else { this.brake(h, dt); h.retarget = 0; }
      return;
    }
    if (c && c.type === 'attack') {
      if (c.auto) { h.retarget -= dt; if (h.retarget <= 0) { h.retarget = 0.2; const nt = this.autoTarget(h, h.st.range + (h.hold ? 0 : T.heroAggro)); if (nt) c.t = nt; } }
      const t = c.t;
      if (!this.valid(h, t) || (c.auto && this.dist(h, t) > h.st.range + T.heroAggro * 2.2)) { h.cmd = null; return this.brake(h, dt); }
      h.target = t;
      if (this.inRange(h, t)) { this.brake(h, dt); this.tryAttack(h, t); }
      else if (h.hold) { h.cmd = null; this.brake(h, dt); }
      else this.chase(h, t, dt);
      return;
    }
    // 閒置：自動攻擊附近敵人
    this.brake(h, dt);
    h.retarget -= dt;
    if (h.retarget <= 0) {
      h.retarget = 0.2;
      const t = this.autoTarget(h, h.st.range + (h.hold ? 0 : T.heroAggro));
      if (t) { h.cmd = { type: 'attack', t, auto: true }; h.target = t; } else h.target = null;
    }
  }
  // 自動選目標：射程內優先「血量最低的單位」，其次最近的單位，最後才是建築
  autoTarget(h, reach) {
    let best = null, bs = 1e9;
    for (const t of this.units) {
      if (!t.alive || t.side === h.side || (t.protectors && this.isProtected(t)) || !this.seen(h.side, t)) continue;
      const d = Math.hypot(t.x - h.x, t.y - h.y) - t.r - h.r * 0.4;
      if (d > reach) continue;
      const inR = d <= h.st.range;
      let sc = inR ? t.hp : 10000 + d;          // 射程內比血量，射程外比距離
      if (t.static) sc += 100000;               // 建築最後
      if (t.side === 2 && t.aggro !== h) sc += 50000;   // 沒在打的野怪排後面
      if (t === h.target) sc -= inR ? 15 : 0;   // 稍微黏住目前目標，避免來回切換
      if (sc < bs) { bs = sc; best = t; }
    }
    return best;
  }
  chase(h, t, dt, mul = 1) {
    if (this.M.los(h.x, h.y, t.x, t.y)) { h.path = null; return this.moveTo(h, t.x, t.y, dt, mul); }
    h.repath -= dt;
    if (!h.path || h.repath <= 0) { h.repath = 0.4; h.path = this.M.path(h.x, h.y, t.x, t.y); }
    if (h.path && h.path.length) { const w = h.path[0]; if (G.d2(h.x, h.y, w[0], w[1]) < 64) h.path.shift(); if (h.path.length) return this.moveTo(h, h.path[0][0], h.path[0][1], dt, mul); }
    this.brake(h, dt);
  }
  // 指令
  cmdMove(x, y, quiet) {
    const h = this.hero; if (!h || !h.alive) return;
    this.cancelTeleport(true);
    h.pending = null; h.cmd = { type: 'move' }; h.path = this.M.path(h.x, h.y, x, y); h.target = null;
    const e = h.path.length ? h.path[h.path.length - 1] : [x, y];
    if (!quiet || !this.mark) this.mark = { x: e[0], y: e[1], t: 0 };
    else { this.mark.x = e[0]; this.mark.y = e[1]; }
  }
  // 鎖定目標：英雄會一直追打直到目標死亡或玩家下新的移動指令
  cmdLock(t) {
    const h = this.hero; if (!h || !h.alive) return false;
    if (!this.valid(h, t)) { G.FX.ring(this, t.x, t.y, t.r + 10, t.r + 12, 0.35, 12, 2); G.Audio.play('deny'); return false; }
    this.cancelTeleport(true);
    h.pending = null; h.cmd = { type: 'attack', t, lock: true }; h.target = t; h.path = null; this.mark = null;
    t.lockT = 0; G.Audio.play('lock'); return true;
  }
  cmdAttack(t) {
    const h = this.hero; if (!h || !h.alive || !this.valid(h, t)) return;
    h.pending = null; h.cmd = { type: 'attack', t }; h.target = t; h.path = null;
  }
  cmdAttackNearest() {
    const h = this.hero; if (!h || !h.alive) return false;
    const t = this.nearestEnemy(h, 360); if (!t) return false;
    this.cmdAttack(t); return true;
  }
  usePotion(i) { return this.useItem(i ? 'mp' : 'hp'); }

  // ---------- 召集：點友方小兵 → 跟隨英雄（一起移動、打同一個目標）；再點一次解除 ----------
  toggleFollow(u) {
    const h = this.hero; if (!h || !h.alive || !u.alive) return;
    u.follow = !u.follow; u.path = null; u.target = null; u.repath = 0; if (u.summoner) u.noRe = !u.follow;   // 玩家親手解除的召喚物不會自動跟回來
    if (u.follow) {
      const n = this.units.filter(v => v.follow && v.alive).length, a = n * 2.4;
      this.stats.maxFollow = Math.max(this.stats.maxFollow, n);
      u.fOff = [Math.cos(a) * (18 + (n % 3) * 8), Math.sin(a) * (12 + (n % 3) * 5)];
      G.FX.ring(this, u.x, u.y, 3, u.r + 14, 0.4, 13, 2); G.Audio.play('lock');
      if (G.UI) G.UI.toastMsg('跟隨英雄（' + n + '）', 13);
    } else {
      G.FX.ring(this, u.x, u.y, u.r + 14, 3, 0.3, 6, 1); G.Audio.play('click');
      if (G.UI) G.UI.toastMsg('解除跟隨，回到兵線', 7);
    }
  }
  clearFollow(msg = '英雄倒下，跟隨解除') { let n = 0; for (const u of this.units) if (u.follow) { u.follow = false; if (u.summoner && !msg.includes('倒下')) u.noRe = true; u.path = null; u.target = null; G.FX.ring(this, u.x, u.y, u.r + 12, 3, 0.3, 6, 1); n++; } if (n && G.UI && msg) G.UI.toastMsg(msg, n && msg.includes('倒下') ? 10 : 7); return n; }
  followCount() { let n = 0; for (const u of this.units) if (u.follow && u.alive) n++; return n; }
  // v2.5 傘型隊形：跟隨的小兵依射程分三圈（近戰內圈、中距離、遠程外圈），在英雄行進方向的後方展開成扇形，不擋路也不擠成一團
  followSlots() {
    const h = this.hero; if (this.fSlotT != null && this.time - this.fSlotT < 0.3) return; this.fSlotT = this.time;
    const sp = Math.hypot(h.vx, h.vy), dir = sp > 10 ? Math.atan2(h.vy / 0.7, h.vx) : (h.face > 0 ? 0 : Math.PI), back = dir + Math.PI;
    const fs = this.units.filter(u => u.follow && u.alive).sort((a, b) => a.st.range - b.st.range || a.id - b.id), rings = [[], [], []];
    for (const u of fs) rings[u.st.range <= 45 ? 0 : u.st.range <= 110 ? 1 : 2].push(u);
    // v2.7 站開：同一排相鄰間距固定 G.FOLLOW_GAP（約一隻小兵寬），一排排不下就往外再排一排
    let nextR = 0;
    rings.forEach((rg, ri) => {
      let R0 = Math.max([42, 80, 118][ri], nextR), i0 = 0;
      while (i0 < rg.length) {
        const cap = Math.floor(Math.PI * 0.95 * R0 / G.FOLLOW_GAP) + 1, row = rg.slice(i0, i0 + cap), n = row.length, step = G.FOLLOW_GAP / R0, span = (n - 1) * step;
        row.forEach((u, i) => { const a = back + (n > 1 ? -span / 2 + step * i : 0); u.fOff = [Math.cos(a) * R0, Math.sin(a) * R0]; });   // 畫面本身已經上下壓扁（AY），隊形不再額外壓扁
        i0 += cap; nextR = R0 + 38; if (i0 < rg.length) R0 += 38;
      }
    });
  }
  // 回傳 true = 本幀已處理
  followAI(u, dt) {
    const h = this.hero, T = G.TUNE;
    if (!h || !h.alive) { u.follow = false; return false; }
    const cm = Math.max(T.followSpeed, h.st.speed * (h.iSpd || 1) * 1.1 / Math.max(1, u.st.speed));   // 趕路倍率：至少跟得上英雄
    u.retarget -= dt;
    if (u.retarget <= 0) {
      u.retarget = 0.25;
      const ht = h.pending ? h.pending.t : (h.cmd && h.cmd.type === 'attack' ? h.cmd.t : null);
      if (ht && this.valid(u, ht)) u.target = ht;                       // 英雄在打誰就打誰
      else if (!this.valid(u, u.target) || Math.hypot(u.target.x - h.x, u.target.y - h.y) > T.followLeash) u.target = this.nearestEnemy(u, T.followAssist, h.x, h.y);
    }
    const t = u.target;
    if (t && this.valid(u, t) && Math.hypot(t.x - h.x, t.y - h.y) < T.followLeash) {
      if (t.side === 2 && !t.aggro) t.aggro = u;
      if (this.inRange(u, t)) { this.brake(u, dt); this.tryAttack(u, t); }
      else this.chase(u, t, dt, cm);
      return true;
    }
    // 沒有目標：在英雄後方排成扇形
    this.followSlots();
    let fx = h.x + (u.fOff ? u.fOff[0] : 0), fy = h.y + (u.fOff ? u.fOff[1] : 0);
    if (!this.M.isWalk(fx, fy)) { fx = G.lerp(h.x, fx, 0.4); fy = G.lerp(h.y, fy, 0.4); }   // 隊形位置在牆裡：收靠英雄
    const d = Math.hypot(fx - u.x, fy - u.y);
    if (d < 8) this.brake(u, dt); else this.chase(u, { x: fx, y: fy }, dt, d > 40 ? cm : 1);
    return true;
  }

  // ---------- 技能 ----------
  // 回傳：'ok' / 'queued' / 'cd' / 'mp' / 'none'
  trySkill(i) {
    const h = this.hero; if (!h || !h.alive) return 'none';
    const s = h.skills[i]; if (!s) return 'none';
    if (!s.lv) return 'lock';
    if (h.chg) return 'busy';
    if (s.cd > 0) return 'cd';
    if (h.mp < Math.round(s.mp * (1 - (h.mpDisc || 0) / 100))) return 'mp';
    if (s.s.type === 'necro') { const why = this.necroWhy(h, s.s); if (why) { if (G.UI && G.UI.toastMsg) G.UI.toastMsg(why, 17); return 'necro'; } }
    this.cancelTeleport(true);
    if (!s.needT) { this.castSkill(h, i, null); return 'ok'; }
    let t = this.valid(h, h.target) && this.dist(h, h.target) <= s.range + 10 ? h.target : this.nearestEnemy(h, s.range + 10);
    if (t) { this.castSkill(h, i, t); return 'ok'; }
    t = this.valid(h, h.target) ? h.target : this.nearestEnemy(h, s.range * 2.2);
    if (t) { h.pending = { i, t }; h.cmd = null; return 'queued'; }
    return 'none';
  }
  // v2.4 指定施放（拖曳瞄準放開／按住快捷鍵放開）：A = { x, y, t }
  castAim(i, A) {
    const h = this.hero; if (!h || !h.alive) return 'none';
    const s = h.skills[i]; if (!s) return 'none';
    if (!s.lv) return 'lock'; if (h.chg) return 'busy'; if (s.cd > 0) return 'cd';
    if (h.mp < Math.round(s.mp * (1 - (h.mpDisc || 0) / 100))) return 'mp';
    if (s.s.type === 'necro') { const why = this.necroWhy(h, s.s); if (why) { if (G.UI && G.UI.toastMsg) G.UI.toastMsg(why, 17); return 'necro'; } }
    this.cancelTeleport(true); h.pending = null;
    const k = s.shape.k;
    if (k === 'self' || k === 'buff') { this.castSkill(h, i, null); return 'ok'; }
    if (k === 'area' || k === 'line') { this.castSkill(h, i, { x: A.x, y: A.y, r: 0, alive: true, vis: { fly: 0 }, static: false, pt: true }); return 'ok'; }
    if (A.t && this.valid(h, A.t) && this.dist(h, A.t) <= s.range + 10) { this.castSkill(h, i, A.t); return 'ok'; }
    return 'none';
  }
  castSkill(h, i, t) {
    const s = h.skills[i], cost = Math.round(s.mp * (1 - (h.mpDisc || 0) / 100));
    if (h.mp < cost || s.cd > 0) { G.Audio.play('deny'); return false; }
    if (h.chg) return false;
    h.mp -= cost; s.cd = s.cdMax; h.atkT = Math.max(h.atkT, 0.25);
    const ult = i === h.skills.length - 1 && s.s.lv1 >= 5;
    return this.beginCharge(h, s.s, t, s.lv, ult ? G.TUNE.chgUlt : G.TUNE.chgSkill, () => { s.cd = 0; h.mp = Math.min(h.st.mp, h.mp + cost); });
  }
  say(n) { if (this.attract) return; n.age = 0; n.t = Math.max(2.2, n.t || 2.4); this.notices.push(n); }
  kill(t, src) {
    if (t === this.hero && this.tryRevive(t)) return;
    t.alive = false; t.hp = 0;
    G.FX.shatter(this, t);
    if (t.static) {
      this.shake(0.8); this.hitstop = 0.1; this.sfx('building', t.x, t.y);
      for (let k = 0; k < 4; k++) G.FX.smoke(this, t.x + G.rr(-16, 16), t.y + G.rr(-6, 6), G.rr(0, 30), 8, 6);
      G.FX.scorch(this, t.x, t.y, 30, 30);
    } else this.sfx('die', t.x, t.y);
    const h = this.hero;
    if (t.side === 1 && h && h.alive && (src === h || G.d2(h.x, h.y, t.x, t.y) < 480 * 480)) this.gainExp(h, t.st.exp);
    // 戰鬥數據：最後一擊＝擊殺；英雄 8 秒內打過、但由別人收尾＝助攻
    const helped = h && t.heroHitT != null && this.time - t.heroHitT < 8;
    if (t.side === 1 && src === h) { this.stats.kills++; if (t.static && t.kind === 'tower') this.stats.towers++; }
    else if (t.side === 1 && helped && !t.static) this.stats.assists++;
    if (t.side === 1 && t.kind === 'tower' && src !== h && helped) this.stats.towers++;
    if (t.side === 2 && (src === h || helped)) this.stats.camps++;
    if (t === h) this.stats.deaths++;
    if ((t.side === 1 || t.side === 2) && (src === h || helped)) { const kc = G.keyCat(t); if (kc === 'boss') this.stats.bosses++; else if (kc === 'hunter') this.stats.hunters++; }
    if (t.side === 1 && src === h) { this.killT.push(this.time); this.killT = this.killT.filter(v => this.time - v <= 4); this.stats.streak = Math.max(this.stats.streak, this.killT.length); }   // 4 秒內連續擊倒
    this.tryKey(t, src);
    if (this.stageI) G.SoloW.died(this, t);
    if (t.side === 1) this.killGold(t, src);
    if (t.side === 2) { if (h && h.alive && src && src.side === 0) this.gainExp(h, t.st.exp); this.wildReward(t, src); }
    if (t === h) { h.dead = Math.min(G.TUNE.heroRespawnMax, G.TUNE.heroRespawnBase + G.TUNE.heroRespawnPer * h.level + G.TUNE.heroRespawnMin * Math.max(0, this.time / 60 - 5)); h.cmd = null; h.pending = null; this.shake(0.5); this.clearFollow(); }
    if (t.kind === 'holy' && !this.over) {
      this.over = { win: t.side === 1, t: 0 }; this.timeScale = 0.3; this.shake(1);
      this.overSt = Object.assign({}, this.stats, { lv: this.hero ? this.hero.level : 1, keys: this.keysGot || 0 });   // v2.4 結算數值在這一刻鎖住（背景戰鬥還會繼續）
      for (let k = 0; k < 6; k++) setTimeout(() => this.impactFx(t.x + G.rr(-30, 30), t.y + G.rr(-20, 20)), k * 120);
      if (!this.attract) { G.Audio.play(this.over.win ? 'win' : 'lose'); G.Audio.setMode('menu'); }
      if (!this.attract && G.Ach) G.Ach.final(this);
    }
  }
  impactFx(x, y) { G.FX.ring(this, x, y, 6, 70, 0.6, 9, 2); G.FX.hit(this, x, y, 10, true); for (let k = 0; k < 30; k++) { const a = Math.random() * 6.28, s = G.rr(60, 200); this.parts.add(x, y, 10, Math.cos(a) * s, Math.sin(a) * s * 0.7, G.rr(80, 260), G.rr(0.5, 1), 9, 4, 2, 500, 1.5); } }
  gainExp(h, n) {
    h.exp += Math.round(n * (1 + (h.iXp || 0) / 100));   // 經驗藥水
    const need = () => G.ORIG.units[h.name].exp * h.level;
    while (h.exp >= need()) {
      h.exp -= need(); h.level++; h.sp = (h.sp || 0) + 1; h.calc();
      h.hp = h.st.hp; h.mp = h.st.mp;
      G.FX.levelUp(this, h); this.sfx('level'); this.hitstop = 0.05;
    }
  }
  expNeed(h) { return G.ORIG.units[h.name].exp * h.level; }
};
Object.assign(G.World.prototype, G.Combat);
