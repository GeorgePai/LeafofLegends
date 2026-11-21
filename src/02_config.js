'use strict';
/* =========================================================
   設定 / 內容資料（擴充主要改這裡）
   - 角色數值全部取自 G.ORIG（原著資料表）
   - 這裡只補：外觀、碰撞半徑、技能表現、地圖、關卡
   ========================================================= */

// ---------- 原著未在資料表中的值（標記為暫定） ----------
G.TUNE = {
  foeMul: 3, foeGap: 0.25, foeCap: 60, towerOne: 2,   // v3.7 單路：三路的敵兵併成一路（×2→×3）、出兵間隔 0.25 秒、單路地圖塔血 ×2（塔從 10 座變 4 座）
    // v3.4 Pai：敵方每波數量 ×2（小兵點數上限 24 之後敵方太弱）、同一路出兵間隔 0.45→0.3 秒、場上敵兵上限 40→60 — 暫定
  heroScale: 1.25,         // v3.9 英雄本體放大倍率 1.5→1.25（Pai：太大隻）
  waveInterval: 20,        // 兵線間隔（秒）— 暫定
  firstAllyWave: 2,
  firstEnemyWave: 6,
  towerGrow: { from: 2, to: 14, hp: 0.4, pow: 0.5, heat: 0.25, heatMax: 3 },   // v2.5 塔成長：2→14 分鐘 HP +40%、攻擊 +50% 封頂；連續打同一個英雄每發 +25%（最多 +75%）— 暫定
  heroRespawnBase: 5,      // v2.5 英雄復活秒數 = base + 等級×per + (分鐘−5)×min，上限 max（Lv1 7 秒、Lv10 約 25 秒、20 分鐘 Lv12 約 41 秒）— 暫定
  heroRespawnPer: 2,
  heroRespawnMin: 0.8,
  heroRespawnMax: 50,
  sanctuaryHeal: 0.06,     // 在己方聖所旁每秒回復 6% HP/MP — 暫定
  sanctuaryRange: 130,
  levelUpEvery: 3,         // 敵方每 N 波升 1 級 — 暫定
  holy: { player: { hp: 2000, armor: 5, heal_hp: 2 }, enemy: { hp: 2000, armor: 5, heal_hp: 2 } }, // 暫定
  aggro: 170,              // 小兵索敵距離
  heroAggro: 60,           // 英雄自動攻擊的額外追擊距離
  moveMul: 0.82,           // 全體移動速度倍率（v1.3 放慢）
  followLeash: 260,        // 召集：跟隨小兵只打離英雄這麼近的目標
  followAssist: 140,       // 召集：英雄沒在打時，協助攻擊英雄附近多遠內的敵人
  followSpeed: 2,          // 召集：趕路時移速倍率下限（且至少為英雄移速 ×1.1）
  potionCd: 15,            // 藥水冷卻（秒），無數量限制 — 暫定
  creepSpeedMul: 0.5,      // 小兵移動速度倍率（原著數值 ×0.5）— 依手感調整
  chgSkill: 0.28,          // v2.3 英雄一般技能前搖（蓄力）秒數
  chgUlt: 0.9,             // v2.3 英雄大招前搖秒數（v3.8 0.5→0.9：大招儀式）
  chgBoss: 0.45,           // v2.3 首領技能前搖秒數（讓玩家看得出來要放招）
  skFx: 1.35               // v2.3 技能特效持續時間倍率
};

// ---------- 外觀與體型 ----------
// spr: 精靈名；r: 碰撞半徑（世界單位）；fly: 飛行高度；scale 用不到時省略
G.VIS = {
  leafy: { spr: 'leafy', r: 10, shadow: 9 },
  quickleafy: { spr: 'quickleafy', r: 10, shadow: 9 },
  leafblower: { spr: 'leafblower', r: 8, shadow: 7 },
  seedshooter: { spr: 'seedshooter', r: 8, shadow: 7 },
  treeprotector: { spr: 'treeprotector', r: 11, shadow: 10 },
  babybear: { spr: 'babybear', r: 9, shadow: 8 },
  bear: { spr: 'bear', r: 11, shadow: 10 },
  bigbear: { spr: 'bigbear', r: 16, shadow: 14 },
  eagle: { spr: 'eagle', r: 8, shadow: 6, fly: 26 },
  player_tower: { spr: 'ptower', r: 16, shadow: 13 },
  enemy_tower: { spr: 'etower', r: 16, shadow: 13 },
  player_holy: { spr: 'pholy', r: 30, shadow: 28 },
  enemy_holy: { spr: 'eholy', r: 30, shadow: 28 }
};

// 英雄：原著 hero_skill_list 全 10 位（主動技能依序，被動另列）
G.HEROES = Object.keys(G.ORIG.heroSkills).map(Number).sort((a, b) => a - b).map(id => {
  const name = Object.keys(G.ORIG.units).find(n => G.ORIG.units[n].id === id), ids = G.ORIG.heroSkills[id];
  return { name, id, skills: ids.filter(k => G.ORIG.skills[k].active), passives: ids.filter(k => !G.ORIG.skills[k].active) };
});

// ---------- 地圖（以格為單位，程序化生成邊界） ----------
G.MAPS = {
  valley: {
    w: 40, h: 30, seed: 7,
    holy: { player: [5, 24.5], enemy: [34.5, 5] },
    towers: { player: [[11.6, 20.4]], enemy: [[28.6, 9.2]] },
    bossHome: [31.2, 7.6],
    lanes: [
      { r: 2.3, pts: [[5, 24.5], [11, 21], [16, 18.3], [20, 15], [24, 12], [29, 8.8], [34.5, 5]] },
      { r: 1.45, pts: [[6, 21.5], [6.8, 14], [10.5, 9.2], [17, 6.4], [24, 5], [30, 4.4], [34.5, 5]] },
      { r: 1.45, pts: [[8.5, 25.6], [16, 26], [23.5, 23.5], [27.5, 18.5], [30.5, 12.5], [33.5, 8]] }
    ],
    clear: [[5, 24.5, 4.3], [34.5, 5, 4.3], [20, 15, 3.3], [10.5, 9.2, 2.3], [23.5, 23.5, 2.5], [16.5, 21.5, 1.6]]
  }
};

// 地圖縮放（整張圖等比縮小，路寬不變）
G.scaleMap = (m, k) => {
  const f = p => [+(p[0] * k).toFixed(2), +(p[1] * k).toFixed(2)];
  m.w = Math.round(m.w * k); m.h = Math.round(m.h * k);
  m.holy = { player: f(m.holy.player), enemy: f(m.holy.enemy) };
  m.towers = { player: m.towers.player.map(f), enemy: m.towers.enemy.map(f) };
  m.bossHome = f(m.bossHome);
  m.lanes.forEach(l => l.pts = l.pts.map(f));
  m.clear = m.clear.map(c => [...f(c), c[2]]);
  return m;
};
G.scaleMap(G.MAPS.valley, 0.84);

// 三路大地圖（點對稱：我方左下、敵方右上）。lanes 依序為 上 / 中 / 下 路，方向由我方往敵方
G.MAPS.lanes3 = (() => {
  const W = 64, H = 48, mir = p => [+(W - p[0]).toFixed(2), +(H - p[1]).toFixed(2)];
  const lanes = [
    { r: 2.1, pts: [[7, 41], [6.5, 33], [6.5, 14], [9, 8], [16, 6.5], [48, 6.5], [57, 7]] },          // 上路
    { r: 2.3, pts: [[7, 41], [14, 35.5], [24, 29.5], [32, 24], [40, 18.5], [50, 12.5], [57, 7]] },    // 中路
    { r: 2.1, pts: [[7, 41], [16, 41.5], [48, 41.5], [55, 40], [57.5, 34], [57.5, 14], [57, 7]] }     // 下路
  ];
  // 野區小徑（讓英雄換路）
  const paths = [
    { r: 1.25, pts: [[6.5, 22], [14, 23], [24, 29.5]] }, { r: 1.25, pts: mir([6.5, 22]).length ? [mir([6.5, 22]), mir([14, 23]), mir([24, 29.5])] : [] },
    { r: 1.25, pts: [[24, 29.5], [26, 38], [30, 41.5]] }, { r: 1.25, pts: [mir([24, 29.5]), mir([26, 38]), mir([30, 41.5])] }
  ];
  // 塔：每路 外塔(0) / 內塔(1)，敵方為點對稱位置
  const pt = [[[6.5, 21], 0, 0], [[6.5, 31.5], 0, 1], [[25.5, 28.5], 1, 0], [[16.5, 34], 1, 1], [[29, 41.5], 2, 0], [[18, 41.5], 2, 1]];
  const et = pt.map(([p, lane, tier]) => [mir(p), 2 - lane, tier]);
  return {
    w: W, h: H, seed: 11,
    holy: { player: [7, 41], enemy: mir([7, 41]) },
    towers3: { player: pt, enemy: et },
    bossHome: mir([10.5, 37.5]),
    lanes: lanes.concat(paths),
    laneCount: 3,
    clear: [[7, 41, 6.2], [...mir([7, 41]), 6.2], [32, 24, 4], [14, 23, 2.2], [...mir([14, 23]), 2.2], [26, 38, 2], [...mir([26, 38]), 2]]
  };
})();

// 大地圖（80×60，點對稱）：中央河道（楚河漢界）+ 野區（6 營小怪 + 2 野生首領）
G.MAPS.lanes4 = (() => {
  const W = 80, H = 60, mir = p => [+(W - p[0]).toFixed(2), +(H - p[1]).toFixed(2)], mp = a => a.map(mir);
  const k = 1.25, sc = a => a.map(p => [+(p[0] * k).toFixed(2), +(p[1] * k).toFixed(2)]);
  const top = sc([[7, 41], [6.5, 33], [6.5, 14], [9, 8], [16, 6.5], [48, 6.5], [57, 7]]);
  const midL = sc([[7, 41], [14, 35.5], [24, 29.5], [32, 24], [40, 18.5], [50, 12.5], [57, 7]]);
  const bot = mp(top).reverse();
  const lanes = [{ r: 2.1, pts: top }, { r: 2.3, pts: midL }, { r: 2.1, pts: bot }];
  // 野區小徑（我方側；敵方側點對稱）
  const jp = [
    [[8.12, 31], [17, 31], [24, 40.6]], [[17, 31], [21, 19.5]],
    [[28.5, 45.5], [45, 45], [51.5, 36.2]], [[24, 40.6], [28.5, 45.5], [33, 51.88]]
  ];
  const paths = []; for (const a of jp) { paths.push({ r: 1.3, pts: a }); paths.push({ r: 1.3, pts: mp(a) }); }
  const pt = [[[8.12, 26.25], 0, 0], [[8.12, 39.38], 0, 1], [[31.88, 35.62], 1, 0], [[20.62, 42.5], 1, 1], [[36.25, 51.88], 2, 0], [[22.5, 51.88], 2, 1]];
  const et = pt.map(([p, lane, tier]) => [mir(p), 2 - lane, tier]);
  // 野怪位置：每方 紅/藍/經驗 各一營；野生首領在河道上，一上一下
  const camps = [['red', [17, 31]], ['blue', [45, 45]], ['exp', [28.5, 45.5]]];
  const wild = [...camps, ...camps.map(([k2, p]) => [k2, mir(p)]), ['frost', [21, 19.5]], ['blaze', mir([21, 19.5])]];
  return {
    w: W, h: H, seed: 11,
    holy: { player: top[0], enemy: mir(top[0]) },
    towers3: { player: pt, enemy: et },
    bossHome: mir([13.1, 46.9]),
    lanes: lanes.concat(paths),
    laneCount: 3,
    river: { r: 2.3, pts: [[0, 9], [14, 16], [27, 23], [40, 30], [53, 37], [66, 44], [80, 51]] },
    wild,
    clear: [[...top[0], 7.75], [...mir(top[0]), 7.75], [40, 30, 5], ...wild.map(([k2, p]) => [...p, k2 === 'frost' || k2 === 'blaze' ? 3.8 : 2.7])]
  };
})();

// 更大的地圖（104×78，點對稱）：每路 3 層外塔＋基地主塔；野怪住在森林裡的「凹槽營地」，野生首領在河道旁的坑
G.MAPS.lanes5 = (() => {
  const W = 104, H = 78, mir = p => [+(W - p[0]).toFixed(2), +(H - p[1]).toFixed(2)], mp = a => a.map(mir);
  const k = 1.3, sc = a => a.map(p => [+(p[0] * k).toFixed(2), +(p[1] * k).toFixed(2)]);
  const top = sc([[8.75, 51.25], [8.12, 41.25], [8.12, 17.5], [11.25, 10], [20, 8.12], [60, 8.12], [71.25, 8.75]]);
  const mid = sc([[8.75, 51.25], [17.5, 44.4], [30, 36.9], [40, 30], [50, 23.1], [62.5, 15.6], [71.25, 8.75]]);
  const bot = mp(top).reverse();
  const LW = 1.5, LW2 = 2.25;                        // v2.4 道路加寬 1.5 倍；v2.7 再 ×1.5（LW2）
  // v2.7：路寬改成「每一段各自的寬度」（rs）。靠近聖所、紅營旁邊那一段維持 v2.4 寬度（不然會把紅營吃掉），
  //       其餘加寬 1.5 倍，中間用 3 格過渡。a／b＝起點／終點那端維持原寬的長度（格）
  const widen = (pts, r0, a, b) => {
    const rN = r0 * LW, rW = r0 * LW2, rT = (rN + rW) / 2, segL = [], L = pts.slice(1).reduce((s2, p, i) => { const l = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]); segL.push(l); return s2 + l; }, 0);
    const at = d => { let acc = 0; for (let i = 0; i < segL.length; i++) { if (d <= acc + segL[i]) { const t = (d - acc) / segL[i]; return [+(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t).toFixed(2), +(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t).toFixed(2)]; } acc += segL[i]; } return pts[pts.length - 1]; };
    const cuts = [a - 3, a, L - b, L - b + 3].filter(d => d > 0.5 && d < L - 0.5);
    const ds = []; let acc = 0; pts.forEach((p, i) => { ds.push(acc); if (i < segL.length) acc += segL[i]; });
    const all = [...ds.map((d, i) => [d, pts[i]]), ...cuts.map(d => [d, at(d)])].sort((x, y) => x[0] - y[0]).filter((e, i, arr) => !i || e[0] - arr[i - 1][0] > 0.01);
    const rs = all.slice(1).map((e, i) => { const m = (all[i][0] + e[0]) / 2; return (a > 0 && m < a - 3) || (b > 0 && m > L - b + 3) ? rN : (a > 0 && m < a) || (b > 0 && m > L - b) ? rT : rW; });
    return { r: rW, rs, pts: all.map(e => e[1]) };
  };
  const lanes = [widen(top, 2.2, 22.6, 0), widen(mid, 2.4, 23, 23), widen(bot, 2.2, 0, 22.6)];
  // 我方野區小徑（敵方點對稱）
  const jp = [
    [[10.6, 44], [22, 44], [30, 53]],                 // 西野區：上路 → 中路
    [[22, 44], [27, 36.5], [32.5, 28.4]],             // 西野區 → 河道
    [[44.5, 44.4], [48, 57], [62, 57], [70, 48.6]],   // 南野區：中路 → 下路側 → 河道
    [[55, 57], [55, 67.4]]                            // 南野區 → 下路
  ];
  const paths = []; for (const a of jp) { paths.push({ r: 1.5 * LW, pts: a }); paths.push({ r: 1.5 * LW, pts: mp(a) }); }
  // 凹槽營地：營地中心 + 一條窄入口（接到小徑或河道）
  const pockets = [
    { k: 'red', c: [18, 51.5], r: 3.1, e: [18, 44] },
    { k: 'exp', c: [33.2, 38.6], r: 3.0, e: [27, 36.5] },     // v2.7 路加寬：往小徑挪一點（原 [34, 40.5]），和中路保持距離
    { k: 'blue', c: [56, 49.5], r: 3.1, e: [56, 57] },
    { k: 'frost', c: [20.6, 30.6], r: 3.9, e: [24.2, 24.4], w: 2.0 }   // 河道旁的首領坑（入口較寬）
  ];
  const wild = [], necks = [], clears = [];
  for (const q of pockets) {
    const isB = q.k === 'frost';
    [[q.c, q.e, q.k], [mir(q.c), mir(q.e), isB ? 'blaze' : q.k]].forEach(([c, e, key]) => { wild.push([key, c]); necks.push({ r: q.w || 1.25, pts: [e, c] }); clears.push([...c, q.r]); });
  }
  // 塔：沿每條路從我方聖所量距離，在半路的 30% / 58% / 86% 放內／中／外塔；主塔在聖所前方
  const along = (pts, d) => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= L) return [+(a[0] + (b[0] - a[0]) * d / L).toFixed(2), +(a[1] + (b[1] - a[1]) * d / L).toFixed(2)]; d -= L; } return pts[pts.length - 1]; };
  const len = pts => pts.slice(1).reduce((s2, p, i) => s2 + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const pt = [];
  [top, mid, bot].forEach((pts, lane) => { const half = len(pts) / 2; [[0.86, 0], [0.58, 1], [0.3, 2]].forEach(([f, tier]) => pt.push([along(pts, half * f), lane, tier])); });
  const hp = top[0], cdir = [W / 2 - hp[0], H / 2 - hp[1]], cl = Math.hypot(...cdir);
  pt.push([[+(hp[0] + cdir[0] / cl * 6.5).toFixed(2), +(hp[1] + cdir[1] / cl * 6.5).toFixed(2)], 1, 9]);      // tier 9 = 主塔
  const et = pt.map(([p, lane, tier]) => [mir(p), tier === 9 ? 1 : 2 - lane, tier]);
  return {
    w: W, h: H, seed: 23,
    holy: { player: hp, enemy: mir(hp) },
    towers3: { player: pt, enemy: et },
    bossHome: mir([16, 60]),
    lanes: lanes.concat(paths, necks),
    laneCount: 3,
    river: { r: 2.8, pts: [[0, 11.7], [18.2, 20.8], [35.1, 29.9], [52, 39], [68.9, 48.1], [85.8, 57.2], [104, 66.3]] },
    wild,
    clear: [[...hp, 9.5], [...mir(hp), 9.5], [52, 39, 6], ...clears]
  };
})();

// ---------- v3.7 單路地圖（72×54，點對稱）----------
// 只寫「我方聖所 → 地圖中心」的半條路（控制點），自動：平滑成彎路、點對稱補出敵方半條、沿路放塔（外／中／內）、
// 中心垂直穿過一條河、河邊兩個野生首領坑、路旁凹槽營地（紅／藍／鱷魚，敵方點對稱）
// v3.7 Pai：中立資源全部放在雙方外塔之間的交戰區（半路的 55%～95%），搶野怪就會碰到對方、容易打起團戰
// camps：[種類, 沿半路的位置 0~1, 在路的哪一側 ±1, 離路中心幾格]；boss：[離路中心幾格, 沿路方向偏移]
G.laneMap = spec => {
  const W = 72, H = 54, C = [W / 2, H / 2], mir = p => [+(W - p[0]).toFixed(2), +(H - p[1]).toFixed(2)], R = spec.r || 7.5;   // v3.8 路寬 ×1.5（半徑 5→7.5 格）
  // Catmull-Rom 平滑：控制點之間各插 4 點
  const cr = (pts, n = 4) => { const o = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3); o.push([+f(p0[0], p1[0], p2[0], p3[0]).toFixed(2), +f(p0[1], p1[1], p2[1], p3[1]).toFixed(2)]); } }
    o.push(pts[pts.length - 1]); return o; };
  const ctl = spec.half.concat([C]), full = ctl.concat(ctl.slice(0, -1).reverse().map(mir)), lane = cr(full);
  const len = pts => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const along = (pts, d) => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= L) { const t = d / L; return { p: [+(a[0] + (b[0] - a[0]) * t).toFixed(2), +(a[1] + (b[1] - a[1]) * t).toFixed(2)], u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] }; } d -= L; }
    const a = pts[pts.length - 2], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return { p: b, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] }; };
  const Lh = len(lane) / 2, hp = lane[0];
  // v3.9 拿掉主塔（Pai：城堡主塔太突兀）→ 只剩內／中／外三座，等距排在半路的 28%／53%／78%（聖所→內塔、塔與塔之間都差不多遠，外塔之間留中立區）
  const pt = [[along(lane, Lh * 0.28).p, 0, 2], [along(lane, Lh * 0.53).p, 0, 1], [along(lane, Lh * 0.78).p, 0, 0]];
  const et = pt.map(([p, l, t]) => [mir(p), l, t]);
  // 河：在中心垂直穿過路，一路延伸到地圖邊
  const cu = along(lane, Lh).u, n = [-cu[1], cu[0]], rv = [];
  for (let t = -60; t <= 60; t += 6) { const w = Math.sin(t * 0.13 + spec.seed) * 1.6; const q = [C[0] + n[0] * t + cu[0] * w, C[1] + n[1] * t + cu[1] * w]; rv.push([+q[0].toFixed(2), +q[1].toFixed(2)]); }
  const inMap = p => p[0] > -2 && p[1] > -2 && p[0] < W + 2 && p[1] < H + 2, river = { r: 2.4, pts: rv.filter((p, i) => inMap(p) || (rv[i - 1] && inMap(rv[i - 1])) || (rv[i + 1] && inMap(rv[i + 1]))) };
  // 野生首領坑：河邊、路兩側（點對稱）
  const [bd, bo] = spec.boss || [R + 7, 4.5];
  const bp = [C[0] + n[0] * bd + cu[0] * bo, C[1] + n[1] * bd + cu[1] * bo], be = [C[0] + n[0] * bd, C[1] + n[1] * bd];
  const wild = [['frost', bp.map(v => +v.toFixed(2))], ['blaze', mir(bp)]], necks = [{ r: 2.0, pts: [be, bp] }, { r: 2.0, pts: [mir(be), mir(bp)] }], clears = [[...bp, 3.9], [...mir(bp), 3.9]];
  // 凹槽營地：從指定位置附近找一個合法的點（離路、離河、離邊界、彼此都留空間；敵方點對稱的那個也要合法）
  const sdist = (p, pts) => { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; m = Math.min(m, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t)); } return m; };
  const ok = (c, r) => { if (Math.min(c[0], c[1], W - c[0], H - c[1]) < r + 1.5) return false; if (sdist(c, lane) < R + r + 1.5) return false; if (sdist(c, river.pts) < 2.4 + r + 0.8) return false;
    const m = mir(c); if (Math.hypot(c[0] - m[0], c[1] - m[1]) < 2 * r + 2) return false; return clears.every(q => Math.hypot(c[0] - q[0], c[1] - q[1]) >= r + q[2] + 2 && Math.hypot(m[0] - q[0], m[1] - q[1]) >= r + q[2] + 2); };
  for (const [k, f, sd, d] of spec.camps) {
    let pick = null, best = 1e9;                                     // 交戰區（半路 55%～100%）網格搜尋，挑最接近指定位置的合法點
    for (const lo of [0.55, 0.4, 0.25]) { if (pick) break; for (let ff = lo; ff <= 1.0001; ff += 0.02) for (let dd = 8.5; dd <= 21; dd += 0.5) for (const side of [1, -1]) {
      const sc = Math.abs(ff - f) * 30 + Math.abs(dd - d) + (side !== sd ? 3 : 0); if (sc >= best) continue;
      const a = along(lane, Lh * ff), c = [+(a.p[0] - a.u[1] * side * dd).toFixed(2), +(a.p[1] + a.u[0] * side * dd).toFixed(2)];
      if (ok(c, 3.1)) { best = sc; pick = [a.p, c]; }
    } }
    if (!pick) { console.warn('laneMap: 營地放不下', spec.seed, k); continue; }
    const [e, c] = pick; wild.push([k, c], [k, mir(c)]); necks.push({ r: 1.25, pts: [e, c] }, { r: 1.25, pts: [mir(e), mir(c)] }); clears.push([...c, 3.1], [...mir(c), 3.1]);
  }
  return { w: W, h: H, seed: spec.seed, holy: { player: hp, enemy: mir(hp) }, towers3: { player: pt, enemy: et }, bossHome: mir(along(lane, 12).p),
    lanes: [{ r: R, pts: lane }].concat(necks), laneCount: 1, river, wild, clear: [[...hp, 8], [...mir(hp), 8], [...C, 4], ...clears], one: 1 };
};
G.MAPS.l1 = G.laneMap({ seed: 31, half: [[10, 44], [17, 40.5], [22.5, 35], [29, 31.5]], camps: [['red', 0.84, 1, 11], ['blue', 0.76, -1, 12], ['exp', 0.68, 1, 11]] });   // 翠葉森林：左下 → 右上，緩 S 彎
G.MAPS.l2 = G.laneMap({ seed: 37, half: [[10, 10], [18.5, 10.5], [24, 16], [28, 23.5]], camps: [['red', 0.84, 1, 11], ['blue', 0.76, -1, 12], ['exp', 0.68, 1, 11]] });         // 楓紅山谷：左上 → 右下，長長的山谷彎
G.MAPS.l3 = G.laneMap({ seed: 41, half: [[62, 10], [57.5, 16], [50.5, 18], [43, 20.5]], camps: [['red', 0.84, 1, 11], ['blue', 0.76, -1, 12], ['exp', 0.68, 1, 11]] });       // 霜雪凍原：右上 → 左下，冰原上的折線
G.MAPS.l4 = G.laneMap({ seed: 43, half: [[62, 44], [61, 36], [55, 31], [46, 30]], camps: [['red', 0.84, 1, 11], ['blue', 0.76, -1, 12], ['exp', 0.68, 1, 11]] });        // 熔岩火山：右下 → 左上，繞過火山口的大弧
G.MAPS.l5 = G.laneMap({ seed: 47, half: [[10, 44], [19, 44.5], [26.5, 40], [29.5, 33]], camps: [['red', 0.84, 1, 11], ['blue', 0.76, -1, 12], ['exp', 0.68, 1, 11]] });          // 幽冥深淵：左下 → 右上，Z 字折返

// ---------- 關卡 ----------
// enemies 取原著 stage_001 第 3 難度；boss 為雛形展示用（原著第 1 關沒有）
G.STAGES = [
  {
    map: 'l1', name: '1-1',   // v3.7 首頁背景演示也改用單路地圖
    allyLevel: 1, enemyLevel: G.ORIG.stages[1].start_level,
    loadout: ['leafblower', 'seedshooter', 'treeprotector'],     // 植物點數 2+2+2
    waves: [G.ORIG.stages[1].missions[2].enemies, ['babybear', 'babybear', 'eagle', 'bear']],
    boss: 'bigbear', bossLevel: 2
  }
];
