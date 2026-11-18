'use strict';
/* =========================================================
   通用戰鬥引擎：普攻 / 技能 / 投射物 / 狀態
   全部依原著 weapon_list 的 type / attack_type / attribute 驅動
   World 與預覽沙盒共用（以 mixin 方式掛上）
   ========================================================= */
G.WEAPONS_BY_ID = {};
for (const k in G.ORIG.weapons) G.WEAPONS_BY_ID[G.ORIG.weapons[k].id] = G.ORIG.weapons[k];
G.BOSS_SKILL = { bigbear: 2000, tiger: 2001, penguin: 2002, polarbear: 2003, turtle: 2004, gnome: 2005, buffalo: 2006, cat: 3021, lion: 3022, smartmonkey: 2007, madwolf: 2008, firebear: 2009, firegnome: 2010 };
// 原著資源名 → 本作投射物圖
G.RES_VIS = {
  bullet_magicball: 'magicball', bullet_misticshot: 'magicball', bullet_holy: 'magicball', bullet_seed: 'seed', bullet_sniper: 'sniperb', bullet_spear: 'spearb',
  bullet_fruit: 'tomato', bullet_tomato: 'tomato', bullet_enemytower: 'darkball', bullet_enemytower2: 'tomato', bullet_gnome: 'gnomeb', bullet_mud: 'stone',
  bullet_turtle: 'stone', bullet_stone: 'stone', bullet_stone2: 'stone', bullet_icespike: 'ice', bullet_iceblast: 'ice2', bullet_misticflux: 'mistic',
  bullet_misticball: 'mistic', bullet_misticbomb: 'mistic', bullet_counterpunch: 'punch', bullet_counterstrike: 'punch', fireball: 'fireb', fireblast: 'fireb2',
  flameball: 'fireb', airstrike: 'waveb', wave: 'waveb', sonicwave: 'waveb2', bullet_cannon: 'tomato', bullet_tomatowave: 'tomato2', bullet_lightning: 'magicball'
};
// 技能圖示
G.skillIcon = (sd) => {
  if (sd.type === 'buff' || sd.type === 'multi_buff') {
    return { armor_per: 'i_hold', berserker: 'i_rage', berserker2: 'i_rage', weapon: 'i_bolt', power: 'i_attack', armor: 'i_hold', critical: 'i_crit', hp_sec: 'i_heart', speed: 'i_wind', delay: 'i_wave', return: 'i_fang', range: 'i_range', mp_sec: 'i_drop', mp_discount: 'i_mp' }[sd.attribute] || 'i_wave';
  }
  const w = G.WEAPONS_BY_ID[sd.weapon_id] || {}, n = (w.name || '').toLowerCase();
  if (/meteor/.test(n)) return 'i_meteor'; if (/thunder|tunder/.test(n)) return 'i_bolt'; if (/punch|strike/.test(n) && w.type === '2d_bullet_effect') return 'i_punch';
  if (/ice/.test(n)) return 'i_ice'; if (/sun|solar/.test(n)) return 'i_sun'; if (/tomato/.test(n)) return 'i_tomato'; if (/flux|misticball/.test(n)) return 'i_flux';
  if (/air|sonic|wave/.test(n) && w.type === 'effect_bullet') return 'i_wind'; if (/root|spear/.test(n)) return 'i_root'; if (/fire/.test(n)) return 'i_fire';
  if (w.type === 'effect' && w.attack_type === 'round') return 'i_slam'; if (/stone/.test(n)) return 'i_meteor';
  return 'i_mistic';
};
const SFX_OF = w => {
  const n = (w.name || '').toLowerCase();
  if (w.type === 'line') return 'magic2'; if (/seed|sniper/.test(n)) return 'seed'; if (/tower/.test(n)) return 'tower';
  if (/fruit|cannon|stone|tomato|mud|turtle/.test(n)) return 'lob'; if (/fire|flame/.test(n)) return 'fire'; if (/spear|wave|air|sonic/.test(n)) return 'punch';
  if (/ice/.test(n)) return 'ice'; if (/punch|strike/.test(n)) return 'punch'; if (/thunder|tunder/.test(n)) return 'thunder'; if (/meteor/.test(n)) return 'meteor';
  if (/round/.test(w.attack_type) || /ground|earth|slam/.test(n)) return 'slam'; return 'magic';
};
G.skillSfx = SFX_OF;

G.Combat = {
  // ---------- 普攻 ----------
  fire(u, t) {
    u.atkT = u.st.delay * (u.bDel || 1) * (u.iDel || 1);
    if (!t || !t.alive) { u.atkT = 0.15; return; }
    const w = G.ORIG.weapons[u.st.weapon] || { type: 'body', attack_type: 'single' }, opt = u.st.wopt || 0, pow = u.st.power;
    if (w.type !== 'body' && !u.static) u.recoil = 1;                   // 遠程：後座力（畫面用）
    if (w.type === 'body') {
      u.lunge = 1;
      if (w.attack_type === 'splash') {
        const R = opt || 40;
        for (const e of this.units) if (e.alive && e.side !== u.side && Math.hypot(e.x - t.x, e.y - t.y) - e.r <= R) this.damage(u, e, pow, { crit: true });
        G.FX.ring(this, t.x, t.y, 4, R, 0.3, 14, 1); for (let i = 0; i < 8; i++) this.parts.add(t.x, t.y, 6, G.rr(-60, 60), G.rr(-40, 40), G.rr(30, 90), 0.4, 14, 13, 1, 200, 2);
      } else this.damage(u, t, pow, { crit: true, life: w.attribute === 'return' ? opt : 0 });
      G.FX.slash(this, t.x, t.y, t.z + 10, u.face, u.side === 1);
    } else if (w.type === 'line') {
      this.beam(u, t, 0.18, u.side === 0 ? 13 : 3);
      this.damage(u, t, pow, { crit: true });
      this.sfx('magic', u.x, u.y);
    } else {
      this.shoot(u, t, {
        vis: G.RES_VIS[w.resource] || 'magicball', speed: w.speed || 400, arc: w.curve ? w.height_rate : 0, power: pow, crit: true,
        splash: w.attack_type === 'splash' ? (opt || 40) : 0, pierce: w.attack_type === 'piercing' ? u.st.range + (opt || 20) : 0,
        slow: w.attribute === 'slow' ? (opt || 2) : 0, poison: w.attribute === 'poison' ? (opt || 10) : 0, stun: w.attribute === 'stun' ? 1 : 0
      });
      if (u.kind === 'tower') G.FX.smoke(this, u.x, u.y, 44, 4, u.side === 0 ? 7 : 3);
      this.sfx(SFX_OF(w), u.x, u.y);
    }
  },
  // 光束（陽光類）
  beam(u, t, dur, col) {
    const W = this;
    this.effects.push({
      t: 0, dur, layer: 1, draw(ctx, o) {
        if (!t.alive && this.t > 0.05) return;
        ctx.fillStyle = G.PAL[(((this.t * 30) | 0) & 1) ? 9 : col];
        const x0 = u.x * G.AX - o.x, y0 = u.y * G.AY - (u.z + 14) * G.AZ - o.y, x1 = t.x * G.AX - o.x, y1 = t.y * G.AY - (t.z + 8) * G.AZ - o.y;
        G.pxLine(ctx, x0, y0, x1, y1, this.t < dur * 0.5 ? 2 : 1);
        G.pxDisc(ctx, x1, y1, 3, 3, 9, 1);
      }
    });
    for (let i = 0; i < 4; i++) W.parts.add(t.x, t.y, t.z + 8, G.rr(-40, 40), G.rr(-30, 30), G.rr(20, 80), 0.3, col, 9, 1, 200, 2);
  },
  shoot(src, t, o) {
    const sz = (src.vis.fly || 0) + (src.kind === 'tower' ? 44 : src.kind === 'boss' ? 26 : 12);
    const tz = (t.vis.fly || 0) + (t.static ? 20 : 8);
    if (o.pierce) {
      const dx = t.x - src.x, dy = t.y - src.y, l = Math.hypot(dx, dy) || 1, L = Math.max(o.pierce, l + 20);
      this.projs.push({ x0: src.x, y0: src.y, z0: sz, x: src.x, y: src.y, z: sz, tx: src.x + dx / l * L, ty: src.y + dy / l * L, tz: sz, t: 0, dur: L / (o.speed || 400), D: L, src, tgt: null, o, side: src.side, hit: new Set(), done: false, pierce: true, dir: dx >= 0 ? 1 : -1 });
      return;
    }
    const D = Math.hypot(t.x - src.x, t.y - src.y);
    this.projs.push({ x0: src.x + src.face * 6, y0: src.y, z0: sz, x: src.x, y: src.y, z: sz, tx: t.x, ty: t.y, tz, t: 0, dur: Math.max(0.08, D / (o.speed || 400)), D, src, tgt: t, o, side: src.side, done: false });
  },
  updateProj(p, dt) {
    p.t += dt;
    if (p.tgt && p.tgt.alive) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    const k = Math.min(1, p.t / p.dur);
    const nx = G.lerp(p.x0, p.tx, k), ny = G.lerp(p.y0, p.ty, k), nz = G.lerp(p.z0, p.tz, k) + (p.o.arc || 0) * p.D * 2 * k * (1 - k);
    if (p.o.fx) { (p.hist = p.hist || []).push([p.x, p.y, p.z]); if (p.hist.length > 6) p.hist.shift(); G.VFX.trail(this, p, nx, ny, nz); }
    const tr = p.o.fx ? 0 : p.o.trail || (p.o.vis === 'seed' || p.o.vis === 'sniperb' ? 0 : 1), tc = p.o.tcol || (p.side === 0 ? 9 : 2);
    for (let i = 0; i < tr; i++) this.parts.add(G.lerp(p.x, nx, i / Math.max(1, tr)), G.lerp(p.y, ny, i / Math.max(1, tr)), nz, G.rr(-10, 10), G.rr(-6, 6), G.rr(-5, 10), G.rr(0.15, 0.35), tc, p.side === 0 ? 6 : 1, p.o.big ? 2 : 1, 0, 3);
    p.x = nx; p.y = ny; p.z = nz;
    if (p.pierce) {
      for (const u of this.units) {
        if (!u.alive || u.side === p.side || p.hit.has(u)) continue;
        if (Math.hypot(u.x - p.x, u.y - p.y) - u.r <= (p.o.width || 10)) { p.hit.add(u); if (p.o.skill && !G.VFX._sk) this.skFx(() => this.damage(p.src, u, p.o.power, p.o)); else this.damage(p.src, u, p.o.power, p.o); }
      }
      if (k >= 1) p.done = true;
      return;
    }
    if (k < 1) return;
    p.done = true;
    if (p.o.skill && !G.VFX._sk) return this.skFx(() => this.projEnd(p));
    this.projEnd(p);
  },
  projEnd(p) {
    if (p.o.splash) {
      if (p.o.fx) G.VFX.impact(this, p.o.fx, p.x, p.y, Math.max(4, p.z), p.o, p.o.splash);
      else { G.FX.ring(this, p.x, p.y, 4, p.o.splash, 0.3, p.o.fire ? 14 : 9, 2); G.FX.hit(this, p.x, p.y, 4, true); G.FX.smoke(this, p.x, p.y, 2, 6, 6); G.FX.scorch(this, p.x, p.y, p.o.splash * 0.5, 3); }
      for (const u of this.units) if (u.alive && u.side !== p.side && Math.hypot(u.x - p.x, u.y - p.y) - u.r <= p.o.splash) this.damage(p.src, u, p.o.power, p.o);
      this.sfx('boom', p.x, p.y); if (p.o.big) this.shake(0.3);
    } else if (p.tgt && p.tgt.alive) {
      if (p.o.fx) G.VFX.impact(this, p.o.fx, p.x, p.y, p.z, p.o);
      this.damage(p.src, p.tgt, p.o.power, p.o);
      if (p.o.big) { if (!p.o.fx) G.FX.ring(this, p.x, p.y, 4, 34, 0.3, 9, 2); this.shake(0.2); this.hitstop = Math.max(this.hitstop || 0, 0.035); }
      // 彈跳（秘術流）
      if (p.o.jumps > 0) {
        p.hitSet = p.hitSet || new Set(); p.hitSet.add(p.tgt);
        let best = null, bd = 150;
        for (const u of this.units) { if (!u.alive || u.side === p.side || p.hitSet.has(u)) continue; const d = Math.hypot(u.x - p.tgt.x, u.y - p.tgt.y); if (d < bd) { bd = d; best = u; } }
        if (best) { if (p.o.fx) G.VFX.arc(this, p.tgt, best, 0.22, 17, 6); const o2 = Object.assign({}, p.o, { jumps: p.o.jumps - 1 }); const fake = { x: p.tgt.x, y: p.tgt.y, vis: { fly: 0 }, kind: 'creep', face: 1, side: p.side }; this.shoot(fake, best, o2); const q = this.projs[this.projs.length - 1]; q.src = p.src; q.hitSet = p.hitSet; }
      }
    }
  },
  // ---------- 傷害與狀態 ----------
  damage(src, t, power, o = {}) {
    if (!t.alive) return;
    if (t.protectors && this.isProtected && this.isProtected(t)) { if (Math.random() < 0.3) G.FX.ring(this, t.x, t.y, t.r + 8, t.r + 10, 0.25, 12, 1); return; }
    const h = this.hero;
    if (h && h.alive && h.aura && src.side === h.side && src !== h && G.d2(src.x, src.y, h.x, h.y) < 160 * 160) power += h.aura.pow || 0;
    if (t.side === 2 && src.side !== 2 && (!t.aggro || !t.aggro.alive || src.kind === 'hero')) { t.aggro = src; t.resetting = false; }
    let arm = t.st.armor * (t.bArm || 1) + (t.iArm || 0);
    if (h && h.alive && h.aura && t.side === h.side && t !== h && G.d2(t.x, t.y, h.x, h.y) < 160 * 160) arm += h.aura.arm || 0;
    let dmg = power * (src.bPow || 1) * (src.iPow || 1) * G.rr(0.9, 1.1), crit = false;
    if (o.crit && Math.random() * 100 < src.st.crit + (src.iCrit || 0)) { crit = true; dmg *= 2; }
    dmg = Math.max(1, Math.round((dmg - arm) * (1 - (t.bRed || 0))));
    if (this.stats && h) { const real = Math.min(dmg, Math.max(0, t.hp)); if (src === h) { this.stats.dmg += real; t.heroHitT = this.time; if (t.static) this.stats.tower += real; } if (t === h) this.stats.taken += real; }
    t.hp -= dmg; t.flash = 0.09; t.lastHit = src;
    // 吸血
    const ls = (o.life || 0) + (src.lifesteal || 0);
    if (ls && src.alive && src.hp != null) { src.hp = Math.min(src.st.hp, src.hp + dmg * ls / 100); if (Math.random() < 0.5) this.parts.add(src.x, src.y, 14, 0, 0, 30, 0.5, 10, 15, 1, -10, 0); }
    // 狀態
    if (o.slow) { t.slow = Math.max(t.slow || 0, o.slow); for (let i = 0; i < 5; i++) this.parts.add(t.x + G.rr(-6, 6), t.y, G.rr(4, 16), 0, 0, 10, 0.6, 12, 9, 1, 0, 0); }
    if (o.stun && !t.static) { t.stun = Math.max(t.stun || 0, o.stun); t.stunFx = 1; }
    if (o.poison) t.poison = { dps: o.poison / 3, t: 3 };
    if (!t.static) {
      const dx = t.x - src.x, dy = t.y - src.y, l = Math.hypot(dx, dy) || 1, kb = o.big ? 7 : crit ? 4 : 1.5, nx = t.x + dx / l * kb, ny = t.y + dy / l * kb;
      if (!this.M || this.M.isWalk(nx, ny)) { if (this.M) { t.x = nx; t.y = ny; } else t.knock = o.big ? 1 : 0.4; }
    }
    if (t.bRed > 0) t.shieldHit = typeof performance !== 'undefined' ? performance.now() : 0;
    if (o.fx) G.VFX.hitSpark(this, o.fx, t.x, t.y, t.z + (t.vis.fly || 0) + (t.static ? 20 : 8), crit);
    else G.FX.hit(this, t.x, t.y, t.z + (t.static ? 20 : 8), crit || o.big, o.fire ? 14 : src.side === 0 ? 9 : 2);
    if (!this.attract) G.FX.num(this, t.x, t.y, t.z + (t.static ? 40 : 22), dmg, crit, t.side === 1 ? 1 : 0);
    if (crit) { this.shake(0.18); this.hitstop = Math.max(this.hitstop || 0, 0.04); this.sfx('crit', t.x, t.y); }
    else if (!o.skill) this.sfx(t.static ? 'hit' : (src.melee ? 'blow' : 'hit'), t.x, t.y);
    if (t === this.hero) this.shake(0.12);
    if (t.hp <= 0) this.kill(t, src);
  },
  // 持續狀態（每個單位每 tick 呼叫）
  tickStatus(u, dt) {
    if (u.poison) { u.poison.t -= dt; u.hp -= u.poison.dps * dt; if (Math.random() < dt * 8) this.parts.add(u.x + G.rr(-5, 5), u.y, G.rr(6, 16), 0, 0, 20, 0.5, 11, 16, 1, 0, 0); if (u.poison.t <= 0) u.poison = null; if (u.hp <= 0 && u.alive) this.kill(u, u); }
    if (u.buffT) for (const k in u.buffT) { u.buffT[k] -= dt; if (u.buffT[k] <= 0) { delete u.buffT[k]; if (k === 'red') u.bRed = 0; if (k === 'rage') { u.bPow = 1; u.bArm = 1; u.bDel = 1; } } }
    if (u.zap) {
      u.zap.t -= dt; u.zap.cd -= dt;
      if (u.zap.cd <= 0) {
        u.zap.cd = 0.55;
        let best = null, bd = u.zap.range; for (const e of this.units) { if (!e.alive || e.side === u.side) continue; const d = Math.hypot(e.x - u.x, e.y - u.y) - e.r; if (d < bd) { bd = d; best = e; } }
        if (best) { G.VFX.arc(this, u, best, 0.16, 18, 6); this.damage(u, best, u.zap.dmg, { skill: true, fx: 'thunder' }); }
      }
      if (Math.random() < dt * 10) this.parts.add(u.x + G.rr(-8, 8), u.y, G.rr(6, 20), 0, 0, 30, 0.3, 12, 9, 1, 0, 0);
      if (u.zap.t <= 0) u.zap = null;
    }
  },
  // 技能特效延長（v2.3）：fn 期間新產生的純視覺特效，持續時間 ×G.TUNE.skFx（讓玩家看得到技能的震撼）
  skFx(fn) {
    const n = this.effects.length, was = G.VFX._sk; G.VFX._sk = true;
    try { fn(); } finally { G.VFX._sk = was; }
    for (let i = n; i < this.effects.length; i++) { const e = this.effects[i]; if (e.dur && !e.update && !e._sk) { e._sk = 1; e.dur *= G.TUNE.skFx; } }
  },
  // 施放前搖（v2.3）：先蓄力 dur 秒（站定、腳下法陣、光點往身上聚、身體發光），時間到才真的放出技能
  beginCharge(u, sd, t, lv, dur, refund) {
    const w0 = G.WEAPONS_BY_ID[sd.weapon_id];
    const el = sd.type === 'buff' ? (sd.attribute === 'armor_per' ? 'shield' : sd.attribute === 'weapon' ? 'zap' : 'rage') : G.elemOf(w0);
    u.chg = { sd, t, lv, T: 0, dur, el, refund, big: dur >= 0.45 };
    if (t) u.face = t.x > u.x ? 1 : -1;
    this.sfx(dur >= 0.45 ? 'chargeBig' : 'charge', u.x, u.y);
    return true;
  },
  tickCharge(u, dt) {
    const c = u.chg; c.T += dt;
    if (!u.alive || u.stun > 0) { u.chg = null; if (c.refund) c.refund(); return; }
    if (c.t && !c.t.alive) { const n = this.nearestEnemy(u, (c.sd.range || 180) + 20); if (n) c.t = n; }
    if (c.t) u.face = c.t.x > u.x ? 1 : -1;
    const E = G.ELEM[c.el] || G.ELEM.arcane;
    if (Math.random() < dt * (c.big ? 40 : 24)) { const a = Math.random() * 6.28, r = G.rr(22, 40); this.parts.add(u.x + Math.cos(a) * r, u.y + Math.sin(a) * r * 0.6, G.rr(4, 24), -Math.cos(a) * r * 3, -Math.sin(a) * r * 1.8, 0, 0.32, Math.random() < 0.5 ? E.c : E.c2, E.c, 1, 0, 0); }
    if (c.T >= c.dur) {
      u.chg = null;
      const needT = c.sd.type !== 'buff' && !(G.WEAPONS_BY_ID[c.sd.weapon_id] && G.WEAPONS_BY_ID[c.sd.weapon_id].type === 'effect' && G.WEAPONS_BY_ID[c.sd.weapon_id].attack_type === 'round');
      if (needT && !(c.t && c.t.alive)) { if (c.refund) c.refund(); return; }
      this.skFx(() => this.useSkill(u, c.sd, c.t, c.lv));
    }
  },
  // ---------- 技能（英雄與首領共用） ----------
  useSkill(u, sd, t, lv = 1) {
    const dmg = sd.value_1 + sd.grow_value_1 * (lv - 1), v2 = sd.value_2 + sd.grow_value_2 * (lv - 1);
    u.cast = 0.3;
    if (t) u.face = t.x > u.x ? 1 : -1;
    const w0 = G.WEAPONS_BY_ID[sd.weapon_id];
    const el = sd.type === 'buff' ? (sd.attribute === 'armor_per' ? 'shield' : sd.attribute === 'weapon' ? 'zap' : 'rage') : G.elemOf(w0), S = G.elemStrong(w0);
    if (sd.type === 'buff') G.VFX.buffCast(this, u, el); else G.VFX.cast(this, u, el);
    // 主動增益
    if (sd.type === 'buff') {
      u.buffT = u.buffT || {};
      if (sd.attribute === 'armor_per') { u.bRed = dmg / 100; u.buffT.red = v2; this.sfx('shield', u.x, u.y); }
      else if (sd.attribute === 'berserker' || sd.attribute === 'berserker2') { const rg = G.rageOf(lv); u.bPow = rg.pow; u.bArm = rg.arm; u.bDel = sd.attribute === 'berserker2' ? 1 / (1 + rg.spd / 100) : 1; u.buffT.rage = v2; this.sfx('rage', u.x, u.y); this.shake(0.3); }
      else if (sd.attribute === 'weapon') { u.zap = { t: v2, dmg, range: sd.range, cd: 0 }; this.sfx('thunder', u.x, u.y); }
      return true;
    }
    const w = w0; if (!w) return false;
    const n = (w.name || '').toLowerCase(), fire = /fire|flame/.test(n), vis = G.RES_VIS[w.resource] || 'mistic';
    this.sfx(SFX_OF(w), u.x, u.y);
    switch (w.type) {
      case '2d_bullet': case '2d_bullet_effect': case 'effect_bullet':
        if (w.attack_type === 'piercing') this.shoot(u, t, { vis, speed: w.speed || 400, power: dmg, skill: true, big: true, pierce: sd.range + 80, width: 18, trail: 2, fx: el, fxS: S });
        else if (w.attack_type === 'jump') this.shoot(u, t, { vis, speed: w.speed || 500, power: dmg, skill: true, big: true, jumps: Math.max(1, v2), trail: 2, fx: el, fxS: S });
        else this.shoot(u, t, { vis, speed: w.speed || 400, arc: w.curve ? w.height_rate : 0, power: dmg, skill: true, big: true, trail: 3, fire, tcol: fire ? 14 : /ice/.test(n) ? 12 : null, splash: w.attack_type === 'splash' ? (v2 || 40) : 0, slow: w.attribute === 'slow' ? v2 : 0, stun: w.attribute === 'stun' ? 1.5 : 0, fx: el, fxS: S });
        break;
      case '2d_drop': {
        const tx = t.x, ty = t.y, R = v2 || 60;
        G.VFX.meteor(this, tx, ty, R, () => {
          G.VFX.meteorImpact(this, tx, ty, R, el);
          for (const e of this.units) if (e.alive && e.side !== u.side && Math.hypot(e.x - tx, e.y - ty) - e.r <= R) this.damage(u, e, dmg, { skill: true, big: true, fire: true, fx: 'fire' });
          this.shake(0.9); this.hitstop = 0.08; this.sfx('boom', tx, ty);
        }, el);
        break;
      }
      case 'effect':
        if (w.attack_type === 'round') {
          const R = sd.range, stun = w.attribute === 'stun' ? Math.max(0.6, v2) : 0;
          G.VFX.quake(this, u.x, u.y, R, stun > 0, S);
          for (const e of this.units) if (e.alive && e.side !== u.side && Math.hypot(e.x - u.x, e.y - u.y) - e.r <= R) { this.damage(u, e, dmg, { skill: true, stun, fx: 'earth' }); if (!stun) e.slow = Math.max(e.slow || 0, 1.2); }
          this.shake(0.55); this.hitstop = 0.06;
        } else if (w.attack_type === 'splash') {
          const R = v2 || 50; G.VFX.spikes(this, t.x, t.y, R, el);
          for (const e of this.units) if (e.alive && e.side !== u.side && Math.hypot(e.x - t.x, e.y - t.y) - e.r <= R) this.damage(u, e, dmg, { skill: true, stun: 0.4, fx: el });
          this.shake(0.4);
        } else {
          const targets = [t];
          if (/storm/.test(n)) for (const e of this.units) { if (targets.length >= 3) break; if (e.alive && e !== t && e.side !== u.side && Math.hypot(e.x - t.x, e.y - t.y) < 110) targets.push(e); }
          targets.forEach((e, i) => G.VFX.later(this, i * 0.09, () => { if (!e.alive) return; G.VFX.bolt(this, e.x, e.y, S); if (i) G.VFX.arc(this, targets[i - 1], e, 0.25, 18, 7); this.damage(u, e, dmg, { skill: true, big: true, fx: 'thunder' }); }));
          this.shake(0.35); this.hitstop = 0.05;
        }
        break;
      case 'line': {
        const ticks = Math.max(1, v2), col = /solar/.test(n) ? 10 : 13;
        G.VFX.beam(this, u, t, ticks * 0.1 + 0.1, el);
        for (let i = 0; i < ticks; i++) G.VFX.later(this, i * 0.1, () => { if (t.alive && u.alive !== false) this.damage(u, t, dmg, { skill: true, fx: el }); });
        break;
      }
    }
    return true;
  }
};
// 英雄技能欄位
G.skillSlot = id => {
  const sd = G.ORIG.skills[id], w = G.WEAPONS_BY_ID[sd.weapon_id] || {};
  const needT = sd.type !== 'buff' && !(w.type === 'effect' && w.attack_type === 'round');
  return { id, s: sd, icon: G.skillIcon(sd), cd: 0, cdMax: sd.delay, mp: sd.mp, range: sd.range || 180, ready: 0, needT, lv: 0 };
};
