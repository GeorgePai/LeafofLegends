'use strict';
/* =========================================================
   戰鬥系統擴充：技能升級、金錢與商店、野區（中立怪 / 野生首領）
   ========================================================= */

// ---------- 技能升級 ----------
// 每升 1 級得 1 點技能點；技能 0~3 級；升到 n 級需英雄等級 ≥ 原著 lv1/lv2/lv3
// 數值 = value + grow ×（技能等級 − 1）；冷卻每級 −10%（雛形設計）；MP 不變
G.SKILL_MAX = 3;
G.skillVal = (sd, lv) => {
  const L = Math.max(1, lv) - 1;
  return { v1: sd.value_1 + sd.grow_value_1 * L, v2: sd.value_2 + sd.grow_value_2 * L, cd: sd.cds ? sd.cds[Math.min(L, sd.cds.length - 1)] : +(sd.delay * (1 - 0.1 * L)).toFixed(1), mp: sd.mp, req: sd['lv' + Math.max(1, lv)] || 1 };
};
G.skillReq = (sd, lv) => sd['lv' + lv] || 1;

// ---------- 商店 ----------
// k：效果種類；v：數值；t：持續秒數（0 = 立即）
G.SHOP = [
  // e：道具欄顯示的效果短標（比名稱直覺）
  { id: 'hp', n: 'HP藥水', e: '+HP', ic: 'i_hp', cost: 60, k: 'hp', v: 150, t: 0, d: '立即回復 {r:150 HP}' },
  { id: 'mp', n: 'MP藥水', e: '+MP', ic: 'i_mp', cost: 60, k: 'mp', v: 150, t: 0, d: '立即回復 {g:150 MP}' },
  { id: 'spd', n: '攻速藥水', e: '+攻速', ic: 'p_spd', cost: 150, k: 'del', v: 30, t: 60, d: '{攻速 +30%}，60 秒' },
  { id: 'crit', n: '爆擊藥水', e: '+爆擊', ic: 'p_crit', cost: 150, k: 'crit', v: 15, t: 60, d: '{o:爆擊率 +15%}，60 秒' },
  { id: 'arm', n: '防禦藥水', e: '+防禦', ic: 'p_arm', cost: 150, k: 'arm', v: 6, t: 60, d: '{防禦 +6}，60 秒' },
  { id: 'pow', n: '攻擊藥水', e: '+攻擊', ic: 'p_pow', cost: 180, k: 'pow', v: 25, t: 60, d: '{攻擊力 +25%}，60 秒' },
  { id: 'move', n: '跑速藥水', e: '+跑速', ic: 'p_move', cost: 100, k: 'spd', v: 25, t: 60, d: '{跑速 +25%}，60 秒' },
  // v2.4 新藥水（暫定數值）
  { id: 'cdr', n: '冷卻藥水', e: '−冷卻', ic: 'p_cdr', cost: 160, k: 'cdr', v: 20, t: 60, d: '{技能冷卻 −20%}，60 秒' },
  { id: 'xp', n: '經驗藥水', e: '+經驗', ic: 'p_xp', cost: 120, k: 'xp', v: 50, t: 60, d: '{獲得經驗 +50%}，60 秒' },
  { id: 'wave', n: '小兵藥水', e: '+出兵', ic: 'p_wave', cost: 200, k: 'wave', v: 50, t: 60, d: '我方{出兵速度 +50%}，60 秒' },
  { id: 'inv', n: '無敵藥水', e: '無敵', ic: 'p_inv', cost: 280, k: 'inv', v: 0, t: 2.5, d: '{無敵 2.5 秒}：不受傷害與控制' },
  { id: 'rev', n: '復活藥水', e: '復活', ic: 'p_rev', cost: 350, k: 'rev', v: 50, t: 0, d: '先買好放在背包，陣亡時{自動使用}：原地復活並{r:回復 50% HP}（陣亡後才買，要等下次陣亡）' }
];
G.SHOP_BY = Object.fromEntries(G.SHOP.map(s => [s.id, s]));
G.TUNE.gold = { start: 150, perSec: 2, last: 16, near: 5, boss: 120, tower: 150, camp: 60, wild: 250 };
G.TUNE.bagMax = 6;
G.TUNE.bagIdle = 1.5;                               // 道具欄沒碰幾秒後自動縮小

// ---------- 野區 ----------
// kind: 'camp'（小怪，打死給增益/經驗）或 'wboss'（野生首領，打死變成我方戰友去推塔）
G.WILD = {
  red: { unit: 'gorilla', kind: 'camp', lv: 3, hpMul: 0.65, pMul: 0.4, aMul: 0.5, respawn: 60, buff: 'red', n: '紅莓猩猩', d: '擊敗獲得「狂暴之力」：{攻擊力 +25%}，90 秒', ic: 'i_rage', col: 10 },
  blue: { unit: 'hippo', kind: 'camp', lv: 3, hpMul: 0.65, pMul: 0.4, aMul: 0.5, respawn: 60, buff: 'blue', n: '藍泉河馬', d: '擊敗獲得「智慧之泉」：{g:MP 回復 +5/秒}、{冷卻 −20%}，90 秒', ic: 'i_mp', col: 12 },
  exp: { unit: 'crocodile', kind: 'camp', lv: 3, hpMul: 0.6, pMul: 0.4, aMul: 0.5, respawn: 50, buff: 'exp', n: '沼澤鱷魚', d: '擊敗獲得{大量經驗值}與 {60 金幣}', ic: 'i_book', col: 13 },
  frost: { unit: 'polarbear', kind: 'wboss', lv: 6, hpMul: 2, pMul: 0.7, aMul: 0.6, respawn: 150, n: '冰原霸主', d: '野生首領。擊敗後{加入我方}，沿最近的路線推塔', ic: 'i_ice', col: 12 },
  blaze: { unit: 'firebear', kind: 'wboss', lv: 6, hpMul: 2, pMul: 0.7, aMul: 0.6, respawn: 150, n: '熔岩霸主', d: '野生首領。擊敗後{加入我方}，沿最近的路線推塔', ic: 'i_fire', col: 14 }
};
// ---------- 敵方獵手（打野）----------
// 新角色「獵狼」：開場 90 秒從敵方聖所出發，專門清我方野區的怪變強；附近有我方單位就先打
G.ORIG.units.hunter = Object.assign({}, G.ORIG.units.madwolf, { id: 9001, type: 'enemy', jungler: true, hp: 280, grow_hp: 30, power: 24, grow_power: 3, armor: 3, grow_armor: 0.6, speed: 95, delay: 700, critical: 8, exp: 300, weapon_name: 'return_body', weapon_option: 10 });
G.BESTIARY.hunter = { w: 19, h: 14, draw(P, f) { G.quad(P, f, { bx: 8, by: 8, brx: 6.5, bry: 3.5, hx: 14, hy: 6, hr: 3, legs: [4, 11, 5, 12], ly: 10, ll: 4, ear: 'p', snout: 3, tail: [4, 4], eye: 14 }); P.l(11, 8, 13, 10, 10); P.px(12, 11, 10); P.px(13, 11, 15); P.l(13, 3, 15, 5, 6); for (let x = 4; x < 11; x += 3) P.px(x, 5, 3); } };
G.TUNE.jungle = { first: 90, respawn: 75, bossLv: 7, bossTime: 300, maxLv: 10, gold: 100 };
G.HUNTER_INFO = '・開場 {90 秒}出動，倒下 {75 秒}後再來\n・清野怪變強：紅營{加攻擊}、藍營{回血加防禦}、鱷魚營{升級}\n・開場 {5 分鐘}後、{Lv7} 以上會搶野生首領\n・擊倒可得 {100 金幣}';
// ---------- 鑰匙掉落（%：英雄親手擊倒；友軍擊倒減半）----------
G.KEY_RATE = { creep: 2, camp: 8, boss: 15, hunter: 25, towerOut: 30, wboss: 35, towerMid: 40, towerIn: 50, towerMain: 60, holy: 100 };
// 主塔數值（原著要塞太強，改成合理值；雙方共用）
Object.assign(G.ORIG.towers.enemy_tower4, { hp: 1800, power: 55, armor: 8, range: 210, delay: 1500 });   // v2.4 射程 190 → 210
G.keyCat = u => u.kind === 'holy' ? 'holy' : u.static ? ['towerOut', 'towerMid', 'towerIn'][u.tier] || 'towerMain' : u.wild ? (u.wild.kind === 'wboss' ? 'wboss' : 'camp') : u.kind === 'jungler' ? 'hunter' : u.kind === 'boss' ? 'boss' : 'creep';
// 圖鑑用：依分頁決定類別
G.keyRateOf = (name, tab) => {
  if (G.ORIG.towers[name]) return /player|mushroom/.test(name) ? 0 : { enemy_tower: G.KEY_RATE.towerOut, enemy_tower2: G.KEY_RATE.towerMid, enemy_tower3: G.KEY_RATE.towerIn }[name] || G.KEY_RATE.towerMain;
  if (tab === 'wild') { for (const k in G.WILD) if (G.WILD[k].unit === name) return G.WILD[k].kind === 'wboss' ? G.KEY_RATE.wboss : G.KEY_RATE.camp; }
  if ((G.ORIG.units[name] || {}).jungler) return G.KEY_RATE.hunter;
  if (G.BOSS_SKILL[name]) return G.KEY_RATE.boss;
  return ['npc', 'mercenary', 'player'].includes((G.ORIG.units[name] || {}).type) ? 0 : G.KEY_RATE.creep;
};
// ---------- 視野與迷霧（參考英雄聯盟）：雙方各自計算看得到的範圍；森林會擋視線 ----------
G.TUNE.vision = { hero: 290, creep: 190, boss: 220, jungler: 220, tower: 300, holy: 360, cell: 48, every: 0.2 };
// ---------- 友方塔傳送 ----------
G.TUNE.tp = { channel: 3, cd: 30, minDist: 110, ask: 2.2 };   // ask：第一下之後幾秒內再點一下才傳送
G.JBUFF = {
  red: { n: '狂暴之力', d: '{攻擊力 +25%}', ic: 'i_rage', col: 10, t: 90, fx: { pow: 25 } },
  blue: { n: '智慧之泉', d: '{g:MP 回復 +5/秒}、{技能冷卻 −20%}', ic: 'i_mp', col: 12, t: 90, fx: { mpReg: 5, cdr: 20 } }
};

Object.assign(G.World.prototype, {
  // ----- 初始化（建構完成後呼叫） -----
  initSystems() {
    this.gold = G.TUNE.gold.start; this.bag = [];
    this.camps = [];
    const md = G.MAPS[this.stage.map], T = G.TILE;
    if (md.wild && !this.attract) for (const [key, p] of md.wild) this.camps.push({ key, def: G.WILD[key], x: p[0] * T, y: p[1] * T, u: null, t: 1.5 });
    if (md.wild && this.attract) for (const [key, p] of md.wild) this.camps.push({ key, def: G.WILD[key], x: p[0] * T, y: p[1] * T, u: null, t: 0.2 });
    this.jg = { t: G.TUNE.jungle.first, u: null };
    this.keysGot = 0; this.keyFx = [];
    // 視野網格（每格 48 單位）：v[side][cell] = 1 看得到
    const cs = G.TUNE.vision.cell, gw = Math.ceil(this.M.ww / cs), gh = Math.ceil(this.M.wh / cs);
    this.vis = { cs, gw, gh, v: [new Uint8Array(gw * gh), new Uint8Array(gw * gh)], t: 0, fog: new Float32Array(gw * gh).fill(1) };
    if (!this.attract) this.updateVision(1);
    this.tp = { cd: 0, ch: null };
    const h = this.hero;
    if (h) {
      const all = [...h.skills, ...h.pskills];
      if (G.Team.dev && !this.attract) {          // v2.6 開發者模式：開局直接滿級（所有技能都能升到 LV3 的等級），全部技能點自己分配
        h.level = Math.max(1, ...all.flatMap(s => [1, 2, 3].map(k => G.skillReq(s.s, k)))); h.exp = 0; h.calc(); h.hp = h.st.hp; h.mp = h.st.mp;
        h.sp = all.length * G.SKILL_MAX;
      } else {
        h.sp = 1;                                  // 1 級時有 1 點，自動學第一個可學技能
        const first = all.find(s => G.skillReq(s.s, 1) <= 1);
        if (first) this.levelSkill(first, true);
      }
    }
  },
  // ----- 每幀 -----
  updateSystems(dt) {
    if (this.over) return;
    if (this.hero && !this.attract) { this.gold += G.TUNE.gold.perSec * dt; this.stats.gold += G.TUNE.gold.perSec * dt; }
    // 敵方獵手：同時最多 1 隻，死亡後倒數再出動
    if (!this.attract && this.camps.length && !(this.jg.u && this.jg.u.alive)) { if (this.jg.u) { this.jg.u = null; this.jg.t = G.TUNE.jungle.respawn; } this.jg.t -= dt; if (this.jg.t <= 0) this.spawnHunter(); }
    this.updateTeleport(dt);
    if (!this.attract) this.updateVision(dt);
    for (const c of this.camps) {
      if (c.u && c.u.alive) continue;
      if (c.u && !c.u.alive) { c.u = null; c.t = c.def.respawn; }
      c.t -= dt;
      if (c.t <= 0) this.spawnCamp(c);
    }
  },
  spawnCamp(c) {
    const d = c.def, u = this.add(new G.Unit(this, d.unit, 2, c.x, c.y, d.lv, d.kind === 'wboss' ? 'boss' : 'wild'));
    u.st.hp = Math.round(u.st.hp * d.hpMul); u.hp = u.st.hp; u.st.power = Math.round(u.st.power * (d.pMul || 1)); u.st.armor = Math.round(u.st.armor * (d.aMul || 1));
    u.home = [c.x, c.y]; u.camp = c; u.wild = d; u.skillCd = 4; u.face = c.x > this.M.ww / 2 ? -1 : 1;
    c.u = u; G.FX.spawn(this, u);
  },
  // 中立怪 AI：被打才反擊；離開巢穴太遠就回家並回滿血
  // v2.5 修正來回跑＋回血：不追出巢穴範圍（停在邊界、打得到就打）；只有攻擊者真的跑遠、或 4 秒沒被打才回家；被打的 2.5 秒內不回血
  wildAI(u, dt) {
    const home = u.home, dh = Math.hypot(u.x - home[0], u.y - home[1]), leash = u.kind === 'boss' ? 190 : 150, quiet = this.time - (u.lastHurt ?? -99);
    if (u.aggro && (!u.aggro.alive || Math.hypot(u.aggro.x - home[0], u.aggro.y - home[1]) > leash + 220 || (quiet > 4 && dh > leash * 0.5))) { u.aggro = null; u.resetting = true; }
    if (u.resetting) {
      if (quiet > 2.5) u.hp = Math.min(u.st.hp, u.hp + u.st.hp * 0.5 * dt);
      if (this.moveTo(u, home[0], home[1], dt) || dh < 6) { u.resetting = false; u.face = home[0] > this.M.ww / 2 ? -1 : 1; }
      return;
    }
    const t = u.aggro;
    if (!t) { if (dh > 8) this.moveTo(u, home[0], home[1], dt); else this.brake(u, dt); if (u.hp < u.st.hp) u.hp = Math.min(u.st.hp, u.hp + u.st.hp * 0.05 * dt); return; }
    u.target = t; u.skillCd = (u.skillCd ?? 3) - dt;
    const sid = u.kind === 'boss' && G.BOSS_SKILL[u.name];
    if (sid && u.skillCd <= 0) { const sd = G.ORIG.skills[sid]; if (this.dist(u, t) < sd.range) { u.skillCd = Math.max(4, sd.delay); this.beginCharge(u, sd, t, sd.lv1 || 1, G.TUNE.chgBoss); } }
    if (this.inRange(u, t)) { this.brake(u, dt); this.tryAttack(u, t); }
    else { const tx = t.x - home[0], ty = t.y - home[1], td = Math.hypot(tx, ty) || 1;             // 目標在巢穴外：只追到邊界
      if (td > leash) { const ex = home[0] + tx / td * leash, ey = home[1] + ty / td * leash; if (Math.hypot(ex - u.x, ey - u.y) > 6) this.moveTo(u, ex, ey, dt); else this.brake(u, dt); }
      else this.moveTo(u, t.x, t.y, dt); }
  },
  // ----- 鑰匙：擊倒時依機率掉落，自動收進背包（飛向畫面上的鑰匙計數）-----
  tryKey(t, src) {
    if (this.attract || !src || src.side !== 0 || t.side === 0) return;
    const p = G.KEY_RATE[G.keyCat(t)] / (src.kind === 'hero' ? 1 : 2);
    if (Math.random() * 100 >= p) return;
    this.keysGot++; G.Team.addKeys(1);
    this.keyFx.push({ x: t.x, y: t.y, z: (t.static ? 40 : 20) + (t.vis.fly || 0), t: 0 });
    G.FX.ring(this, t.x, t.y, 4, 34, 0.5, 13, 2); G.FX.ring(this, t.x, t.y, 2, 22, 0.7, 9, 1);
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, sp = G.rr(40, 140); this.parts.add(t.x, t.y, 20, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, G.rr(60, 160), G.rr(0.5, 1), i % 3 ? 13 : 9, 14, 1, 200, 1); }
    G.Audio.play('keyDrop', 1, 0);
  },
  // ----- 敵方獵手 -----
  spawnHunter() {
    const [x, y] = this.spawnPt[1], st = G.ORIG.stages[Math.min(99, this.stageNow || 1)] || G.ORIG.stages[1];
    const lv = G.clamp(st.start_level || 1, 3, G.TUNE.jungle.maxLv);
    const u = this.add(new G.Unit(this, 'hunter', 1, x, y, lv, 'jungler')); u.jHome = [x, y];
    this.jg.u = u; G.FX.spawn(this, u);
    this.say({ s: '敵方獵手出動了', ic: 'i_attack', col: 14, t: 2.4 });
  },
  junglerAI(u, dt) {
    u.retarget -= dt;
    if (u.retarget <= 0) {
      u.retarget = 0.4;
      let foe = null, fd = 1e9;
      if (u.lastHit && u.lastHit.alive && u.lastHit.side === 0 && Math.hypot(u.lastHit.x - u.x, u.lastHit.y - u.y) < 240) foe = u.lastHit;
      else for (const t of this.units) { if (!t.alive || t.side !== 0 || t.static || !this.seen(1, t)) continue; const d = Math.hypot(t.x - u.x, t.y - u.y); if (d < 120 && d < fd) { fd = d; foe = t; } }
      if (foe) u.target = foe;
      else {
        let best = null, bd = 1e9;
        for (const c of this.camps) {
          if (!c.u || !c.u.alive || (c.def.kind === 'wboss' && (u.level < G.TUNE.jungle.bossLv || this.time < G.TUNE.jungle.bossTime))) continue;
          if (c.u.aggro && c.u.aggro.alive && c.u.aggro.side === 0) continue;          // 我方正在打的不搶
          const d = Math.hypot(c.x - u.x, c.y - u.y); if (d < bd) { bd = d; best = c.u; }
        }
        u.target = best;
      }
    }
    const t = u.target;
    if (t && t.alive) {
      if (t.side === 2 && !(t.aggro && t.aggro.alive)) { t.aggro = u; t.resetting = false; }
      if (this.inRange(u, t)) { this.brake(u, dt); this.tryAttack(u, t); } else this.chase(u, t, dt);
      return;
    }
    const hm = u.jHome; if (Math.hypot(hm[0] - u.x, hm[1] - u.y) > 30) this.chase(u, { x: hm[0], y: hm[1] }, dt); else this.brake(u, dt);
  },
  hunterReward(u, t) {
    const d = t.wild, L = G.TUNE.jungle.maxLv;
    const lvUp = n => { const f = u.hp / u.st.hp; u.level = Math.min(L, u.level + n); u.calc(); u.hp = u.st.hp * f; G.FX.levelUp(this, u); };
    if (d.kind === 'wboss') {
      const b = this.add(new G.Unit(this, t.name, 1, t.x, t.y, d.lv, 'boss'));
      b.st.hp = Math.round(b.st.hp * 2); b.hp = b.st.hp; b.skillCd = 3;
      let bl = 1, bd = 1e9; for (let li = 0; li < this.nLanes; li++) { const v = this.M.laneDist(li, t.x / G.TILE, t.y / G.TILE); if (v < bd) { bd = v; bl = li; } }
      b.lane = bl; G.FX.spawn(this, b); this.say({ s: '敵方獵手收服了' + d.n, ic: d.ic, col: 10, t: 2.8 }); this.sfx('warn');
      return;
    }
    if (d.buff === 'red') this.addBuff(u, 'j_red', G.JBUFF.red.fx, 90, 'i_rage', 10);
    else if (d.buff === 'blue') { this.addBuff(u, 'j_blue', { arm: 3 }, 90, 'i_hold', 12); u.hp = u.st.hp; }
    else lvUp(1);
    const ours = G.d2(t.x, t.y, this.holy[0].x, this.holy[0].y) < G.d2(t.x, t.y, this.holy[1].x, this.holy[1].y);   // 只在偷我方野區時提醒
    if (ours) this.say({ s: '敵方獵手搶走了' + d.n, ic: d.ic, col: 10, t: 2.2 });
  },
  // ----- 視野 -----
  updateVision(dt) {
    const V = this.vis, VT = G.TUNE.vision; V.t -= dt; if (V.t > 0) return; V.t = VT.every;
    const M = this.M, cs = V.cs;
    // 視線：每 12 單位取樣，連續 3 個樣本在森林裡就算被擋住（細的樹邊不擋）
    const sight = (x0, y0, x1, y1) => { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 12); let run = 0; for (let i = 1; i < n; i++) { const t = i / n; if (!M.isWalk(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) { if (++run >= 3) return false; } else run = 0; } return true; };
    for (let side = 0; side < 2; side++) {
      const v = V.v[side]; v.fill(0);
      for (const u of this.units) {
        if (!u.alive || u.side !== side) continue;
        const R = u.kind === 'holy' ? VT.holy : u.static ? VT.tower : u.kind === 'hero' ? VT.hero : u.kind === 'boss' ? VT.boss : u.kind === 'jungler' ? VT.jungler : VT.creep;
        const c0 = Math.max(0, ((u.x - R) / cs) | 0), c1 = Math.min(V.gw - 1, ((u.x + R) / cs) | 0), r0 = Math.max(0, ((u.y - R) / cs) | 0), r1 = Math.min(V.gh - 1, ((u.y + R) / cs) | 0);
        for (let gy = r0; gy <= r1; gy++) for (let gx = c0; gx <= c1; gx++) {
          const i = gy * V.gw + gx; if (v[i]) continue;
          const cx = (gx + 0.5) * cs, cy = (gy + 0.5) * cs; if (G.d2(cx, cy, u.x, u.y) > R * R) continue;
          if (u.static || sight(u.x, u.y, cx, cy)) v[i] = 1;
        }
      }
    }
  },
  // side 方看不看得到 t（建築永遠看得到；自己人永遠看得到）
  seen(side, t) {
    if (this.attract || side === 2 || !t || t.static || t.side === side) return true;
    const V = this.vis; if (!V) return true;
    return V.v[side][G.clamp((t.y / V.cs) | 0, 0, V.gh - 1) * V.gw + G.clamp((t.x / V.cs) | 0, 0, V.gw - 1)] === 1;
  },
  seenXY(side, x, y) { const V = this.vis; if (this.attract || !V) return true; return V.v[side][G.clamp((y / V.cs) | 0, 0, V.gh - 1) * V.gw + G.clamp((x / V.cs) | 0, 0, V.gw - 1)] === 1; },
  // ----- 友方塔傳送：點我方塔 → 引導 3 秒 → 英雄與跟隨的小兵一起傳過去；冷卻 30 秒 -----
  startTeleport(tw) {
    const h = this.hero, T = G.TUNE.tp; if (!h || !h.alive) return false;
    if (Math.hypot(tw.x - h.x, tw.y - h.y) < T.minDist) return false;              // 就在旁邊 → 當成一般移動
    if (this.tp.cd > 0) { if (G.UI) G.UI.toastMsg('傳送冷卻中 ' + Math.ceil(this.tp.cd) + ' 秒', 10); G.Audio.play('deny'); return true; }
    h.cmd = null; h.pending = null; h.path = null; h.target = null; this.mark = null;
    this.tp.ch = { t: T.channel, max: T.channel, to: tw };
    G.FX.ring(this, tw.x, tw.y, 40, 6, 0.5, 13, 2); G.Audio.play('open');
    return true;
  },
  cancelTeleport(msg) { if (!this.tp || !this.tp.ch) return; this.tp.ch = null; if (msg && G.UI) G.UI.toastMsg('傳送取消', 7); },
  updateTeleport(dt) {
    const tp = this.tp, h = this.hero; if (!tp) return;
    if (tp.cd > 0) tp.cd -= dt;
    const ch = tp.ch; if (!ch) return;
    if (!h || !h.alive || !ch.to.alive) { tp.ch = null; return; }
    ch.t -= dt;
    if (Math.random() < dt * 30) this.parts.add(h.x + G.rr(-10, 10), h.y + G.rr(-4, 4), 0, 0, 0, G.rr(40, 90), 0.6, 13, 9, 1, -10, 0);
    if (((ch.t * 2) | 0) !== ch.k) { ch.k = (ch.t * 2) | 0; G.FX.ring(this, ch.to.x, ch.to.y, 34, 8, 0.45, 13, 1); }
    if (ch.t > 0) return;
    tp.ch = null; tp.cd = G.TUNE.tp.cd;
    this.stats.tps++;
    const tw = ch.to, M = this.M, spot = (ox, oy) => { for (let r = 0; r < 60; r += 8) for (let a = 0; a < 6.28; a += 0.8) { const x = tw.x + ox + Math.cos(a) * r, y = tw.y + oy + Math.sin(a) * r * 0.7; if (M.isWalk(x, y)) return [x, y]; } return [tw.x, tw.y + 30]; };
    G.FX.ring(this, h.x, h.y, 4, 40, 0.5, 13, 2);
    const [hx, hy] = spot(0, 34); h.x = h.px = hx; h.y = h.py = hy; h.vx = h.vy = 0;
    for (const u of this.units) if (u.alive && u.follow) { const [x, y] = spot((u.fOff ? u.fOff[0] : 0), 34 + (u.fOff ? u.fOff[1] : 0)); G.FX.ring(this, u.x, u.y, 3, 20, 0.4, 13, 1); u.x = u.px = x; u.y = u.py = y; u.vx = u.vy = 0; u.path = null; G.FX.spawn(this, u); }
    G.FX.spawn(this, h); G.FX.ring(this, hx, hy, 4, 50, 0.6, 13, 2); this.sfx('level');
    const R = G.Render; if (R && !this.attract) { R.cam.x = hx; R.cam.y = hy; R.cam.follow = true; }
  },
  // 野怪被擊殺 → 獎勵
  wildReward(t, src) {
    const d = t.wild, h = this.hero, G0 = G.TUNE.gold;
    if (src && src.kind === 'jungler') return this.hunterReward(src, t);
    if (!src || src.side !== 0 || !h) return;
    if (d.kind === 'wboss') {
      this.addGold(G0.wild, t.x, t.y);
      // 轉生為我方首領：沿最近的路線推塔
      const ally = this.add(new G.Unit(this, t.name, 0, t.x, t.y, d.lv, 'boss'));
      ally.st.hp = Math.round(ally.st.hp * 2); ally.hp = ally.st.hp; ally.skillCd = 3; ally.allyBoss = true;
      let bl = 1, bd = 1e9; for (let li = 0; li < this.nLanes; li++) { const v = this.M.laneDist(li, t.x / G.TILE, t.y / G.TILE); if (v < bd) { bd = v; bl = li; } }
      ally.lane = bl; G.FX.spawn(this, ally); G.FX.levelUp(this, ally);
      this.stats.wboss++;
      G.FX.ring(this, t.x, t.y, 6, 80, 0.7, 13, 2); this.shake(0.5); this.sfx('level', t.x, t.y);
      this.say({ s: d.n + ' 加入我方', ic: d.ic, col: 13, t: 2.6 });
    } else {
      this.addGold(G0.camp, t.x, t.y);
      if (d.buff === 'exp') { this.gainExp(h, Math.round(this.expNeed(h) * 0.55)); this.say({ s: '經驗大幅提升', ic: 'i_book', col: 13, t: 2 }); }
      else { const b = G.JBUFF[d.buff]; this.addBuff(h, 'j_' + d.buff, b.fx, b.t, b.ic, b.col); this.say({ s: '獲得 ' + b.n, ic: b.ic, col: b.col, t: 2.2 }); G.FX.ring(this, h.x, h.y, 4, 40, 0.6, b.col, 2); }
      this.sfx('level', t.x, t.y);
    }
  },

  // ----- 金錢 -----
  addGold(n, x, y) {
    n = Math.round(n); if (n <= 0 || this.attract) return;
    this.gold += n; this.stats.gold += n;
    if (x != null) G.FX.popText(this, x, y, 30, '+' + n, 13);
  },
  killGold(t, src) {
    const h = this.hero, G0 = G.TUNE.gold; if (!h || t.side !== 1) return;
    if (t.static) { this.addGold(G0.tower, t.x, t.y); return; }
    if (t.kind === 'jungler') { if (src === h) this.addGold(G.TUNE.jungle.gold, t.x, t.y); else if (h.alive && G.d2(h.x, h.y, t.x, t.y) < 300 * 300) this.addGold(G.TUNE.jungle.gold / 2, t.x, t.y); return; }
    if (src === h) this.addGold(t.kind === 'boss' ? G0.boss : G0.last, t.x, t.y);
    else if (h.alive && G.d2(h.x, h.y, t.x, t.y) < 300 * 300) this.addGold(G0.near);
  },
  buy(id) {
    const it = G.SHOP_BY[id]; if (!it || this.gold < it.cost) return 'gold';
    const slot = this.bag.find(b => b.id === id);
    if (!slot && this.bag.length >= G.TUNE.bagMax) return 'full';
    this.gold -= it.cost; if (this.stats) this.stats.spent = (this.stats.spent || 0) + it.cost;
    if (slot) slot.n++; else this.bag.push({ id, n: 1 });
    if (id === 'rev' && this.hero && !this.hero.alive && G.UI) G.UI.toastMsg('復活藥水要先放在背包，下次陣亡才會自動使用', 19);   // v2.5
    G.Audio.play('coin'); return 'ok';
  },
  useItem(id) {
    const h = this.hero, slot = this.bag.find(b => b.id === id), it = G.SHOP_BY[id];
    if (!h || !h.alive || !slot || !it) return false;
    if (it.k === 'rev') return 'rev';                    // 復活藥水：陣亡時自動使用
    if (it.k === 'hp') { if (h.hp >= h.st.hp) return false; h.hot = { k: 'hp', left: it.v, rate: it.v / 0.6 }; }   // v2.4 0.6 秒內補滿（看得到血條往上長）
    else if (it.k === 'mp') { if (h.mp >= h.st.mp) return false; h.hot = { k: 'mp', left: it.v, rate: it.v / 0.6 }; }
    else if (it.k === 'inv') { if (h.inv > 0) return false; h.inv = it.t; h.stun = 0; h.slow = 0; this.addBuff(h, 'i_' + id, {}, it.t, it.ic, null); }
    else this.addBuff(h, 'i_' + id, { [it.k]: it.v }, it.t, it.ic, null);
    if (--slot.n <= 0) this.bag.splice(this.bag.indexOf(slot), 1);
    G.VFX.potion(this, h, it);
    this.stats.potions++; return true;
  },

  // 復活藥水（v2.4）：英雄陣亡瞬間自動使用 → 原地復活、回復 50% HP/MP、無敵 1.5 秒
  tryRevive(h) {
    const slot = this.bag.find(b => b.id === 'rev'); if (!slot || this.over || this.attract) return false;
    if (--slot.n <= 0) this.bag.splice(this.bag.indexOf(slot), 1);
    const it = G.SHOP_BY.rev; h.alive = true; h.hp = Math.round(h.st.hp * it.v / 100); h.mp = Math.max(h.mp, Math.round(h.st.mp * it.v / 100)); h.inv = 1.5; h.stun = 0; h.slow = 0; h.poison = null;
    G.VFX.potion(this, h, it); this.say({ s: '復活藥水生效！', ic: 'p_rev', col: 19, t: 2.2 }); this.stats.potions++;
    return true;
  },
  // ----- 計時增益（藥水、野怪 buff）-----
  // fx：pow(%) del(攻速%) crit(%) arm(+) spd(移速%) mpReg(+/秒) cdr(冷卻%)
  addBuff(u, key, fx, t, ic, col) {
    u.tb = u.tb || {};
    u.tb[key] = { fx, t, max: t, ic, col };
    this.applyBuffs(u);
  },
  applyBuffs(u) {
    const a = { pow: 0, del: 0, crit: 0, arm: 0, spd: 0, mpReg: 0, cdr: 0, xp: 0, wave: 0 };
    for (const k in u.tb || {}) for (const f in u.tb[k].fx) a[f] += u.tb[k].fx[f];
    u.iPow = 1 + a.pow / 100; u.iDel = 1 / (1 + a.del / 100); u.iCrit = a.crit; u.iArm = a.arm; u.iSpd = 1 + a.spd / 100; u.iMp = a.mpReg; u.iCdr = a.cdr; u.iXp = a.xp; u.iWave = a.wave;
  },
  tickBuffs(u, dt) {
    let ch = false;
    for (const k in u.tb) { u.tb[k].t -= dt; if (u.tb[k].t <= 0) { delete u.tb[k]; ch = true; } }
    if (ch) this.applyBuffs(u);
  },

  // ----- 技能升級 -----
  canLevel(s) {
    const h = this.hero; if (!h || !s || s.lv >= G.SKILL_MAX || (h.sp || 0) <= 0) return false;
    return h.level >= G.skillReq(s.s, s.lv + 1);
  },
  levelSkill(s, quiet) {
    const h = this.hero; if (!this.canLevel(s)) return false;
    h.sp--; s.lv++;
    if (s.passive) { const hp = h.hp / h.st.hp, mp = h.mp / h.st.mp; h.calc(); h.hp = h.st.hp * hp; h.mp = h.st.mp * mp; }
    else { const v = G.skillVal(s.s, s.lv); s.cdMax = v.cd; }
    if (!quiet) this.skillNotice(s);
    if (!quiet) { this.sfx('level'); G.FX.ring(this, h.x, h.y, 3, 22, 0.35, 13); for (let k = 0; k < 10; k++) this.parts.add(h.x + G.rr(-8, 8), h.y, G.rr(4, 20), 0, 0, G.rr(40, 80), 0.6, 13, 9, 1, -10, 0); }
    return true;
  },
  // 升級回饋：廣播這一級多了什麼（例：火球 Lv2　傷害 100→140）
  skillNotice(s) {
    const nm = (G.TXT.skill || {})[s.id] || '', r = G.skillRows(s.s)[0], R = G.Render;
    let msg = '學會 ' + nm;
    if (s.lv >= 2 && r) {
      const unit = r.f(s.lv).slice(String(r.g(s.lv)).length), ch = r.k + ' ' + r.g(s.lv - 1) + '→' + r.g(s.lv) + unit;
      const maxW = (R && R.uw ? R.uw - (R.ins ? R.ins.l + R.ins.r : 0) : 320) - 30, fit = t => !G.cnW || G.cnW(t) <= maxW, val = r.g(s.lv - 1) + '→' + r.g(s.lv) + unit;
      // 放得下就完整顯示；窄螢幕依序省略：標籤 → 等級 → 技能名（左邊有技能圖示可認）
      msg = [nm + ' Lv' + s.lv + ' ' + ch, nm + ' Lv' + s.lv + ' ' + val, nm + ' ' + val, ch].find(fit) || val;
    }
    this.say({ s: msg, ic: s.icon, col: s.passive ? 17 : 13, t: 2.4 });
  },
  // 自動配點（鍵盤 U 或示範）：大招 > 主動 > 被動
  autoLevel() {
    const h = this.hero; if (!h) return false;
    const order = [h.skills[h.skills.length - 1], ...h.skills.slice(0, -1), ...h.pskills].filter(Boolean).sort((a, b) => a.lv - b.lv);
    for (const s of order) if (this.canLevel(s)) return this.levelSkill(s);
    return false;
  }
});

// ---------- 技能數值表（戰鬥資訊卡與隊伍頁共用）----------
// 回傳 [{k: 標籤, f: lv => 顯示字串}]
G.skillRows = function (sd) {
  const rows = [], V = lv => G.skillVal(sd, lv), w = G.WEAPONS_BY_ID[sd.weapon_id] || {};
  // u：單位（表格放不下時可移到標籤上，例如「冷卻(秒)」）；g：不含單位的數值
  const add = (k, g, u = '', ul = u) => rows.push({ k, u: ul, g, f: lv => String(g(lv)) + u });
  if (!sd.active) {
    const v = lv => V(lv).v1;
    const P = {
      hp_sec: ['HP 回復', lv => '+' + v(lv), '/秒', '每秒'], mp_sec: ['MP 回復', lv => '+' + (v(lv) / 10), '/秒', '每秒'],
      delay: ['攻擊間隔', lv => v(lv), 'ms'], speed: ['跑速', lv => '+' + v(lv)], critical: ['爆擊率', lv => '+' + v(lv), '%'],
      range: ['射程', lv => '+' + v(lv)], return: ['吸血', lv => v(lv), '%'], mp_discount: ['MP 消耗', lv => '−' + v(lv), '%'],
      power: [sd.type === 'multi_buff' ? '攻擊（含周圍友軍）' : '攻擊力', lv => '+' + v(lv)], armor: [sd.type === 'multi_buff' ? '防禦（含周圍友軍）' : '防禦', lv => '+' + v(lv)]
      , scape: ['承受比例', lv => v(lv), '%']
    }[sd.attribute];
    if (P) add(P[0], P[1], P[2] || '', P[3] || P[2] || '');
    if (sd.attribute === 'scape') add('範圍', () => sd.range);
    return rows;
  }
  if (sd.type === 'necro') {                              // v2.6 死靈技能
    if (sd.attribute === 'ctrl') add('消耗 HP', lv => V(lv).v1, '%');
    if (sd.attribute === 'clone') add('複製體血量', lv => V(lv).v1);
    if (sd.attribute !== 'clone') add('範圍', () => sd.range);
    add('召喚上限', () => G.NECRO.cap);
  } else
  if (sd.type === 'buff') {
    if (sd.attribute === 'armor_per') add('減傷', lv => V(lv).v1, '%');
    else if (sd.attribute === 'berserker' || sd.attribute === 'berserker2') { add('攻擊', lv => '×' + G.rageOf(lv).pow); if (sd.attribute === 'berserker2') add('攻速', lv => '+' + G.rageOf(lv).spd + '%'); add('防禦', lv => '×' + G.rageOf(lv).arm); }
    else if (sd.attribute === 'weapon') add('放電傷害', lv => V(lv).v1);
    add('持續', lv => V(lv).v2, '秒');
  } else {
    add('傷害', lv => V(lv).v1);
    const v2 = lv => V(lv).v2;
    if (w.type === '2d_drop') add('範圍', lv => v2(lv) || 60);
    else if (w.type === 'line') add('連擊', lv => Math.max(1, v2(lv)), '次');
    else if (w.type === 'effect' && w.attack_type === 'round' && w.attribute === 'stun') add('暈眩', lv => Math.max(0.6, v2(lv)), '秒');
    else if (w.type === 'effect' && w.attack_type === 'splash') add('範圍', lv => v2(lv) || 50);
    else if (w.attack_type === 'jump') add('彈跳', lv => Math.max(1, v2(lv)), '次');
    else if (w.attribute === 'slow' && sd.value_2) add('減速', lv => v2(lv), '秒');
    else if (w.attack_type === 'splash' && sd.value_2) add('範圍', lv => v2(lv));
  }
  add('冷卻', lv => V(lv).cd, '秒');
  add('MP', lv => V(lv).mp);
  return rows;
};
