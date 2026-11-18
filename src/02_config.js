'use strict';
/* =========================================================
   設定 / 內容資料（擴充主要改這裡）
   - 角色數值全部取自 G.ORIG（原著資料表）
   - 這裡只補：外觀、碰撞半徑、技能表現、地圖、關卡
   ========================================================= */

// ---------- 原著未在資料表中的值（標記為暫定） ----------
G.TUNE = {
  waveInterval: 20,        // 兵線間隔（秒）— 暫定
  firstAllyWave: 2,
  firstEnemyWave: 6,
  heroRespawnBase: 8,      // 英雄復活秒數 = base + 等級*per — 暫定
  heroRespawnPer: 1,
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
  chgUlt: 0.5,             // v2.3 英雄大招前搖秒數
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
  const lanes = [{ r: 2.2, pts: top }, { r: 2.4, pts: mid }, { r: 2.2, pts: bot }];
  // 我方野區小徑（敵方點對稱）
  const jp = [
    [[10.6, 44], [22, 44], [30, 53]],                 // 西野區：上路 → 中路
    [[22, 44], [27, 36.5], [32.5, 28.4]],             // 西野區 → 河道
    [[44.5, 44.4], [48, 57], [62, 57], [70, 48.6]],   // 南野區：中路 → 下路側 → 河道
    [[55, 57], [55, 67.4]]                            // 南野區 → 下路
  ];
  const paths = []; for (const a of jp) { paths.push({ r: 1.5, pts: a }); paths.push({ r: 1.5, pts: mp(a) }); }
  // 凹槽營地：營地中心 + 一條窄入口（接到小徑或河道）
  const pockets = [
    { k: 'red', c: [18, 51.5], r: 3.1, e: [18, 44] },
    { k: 'exp', c: [34, 40.5], r: 3.0, e: [27, 36.5] },
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

// ---------- 關卡 ----------
// enemies 取原著 stage_001 第 3 難度；boss 為雛形展示用（原著第 1 關沒有）
G.STAGES = [
  {
    map: 'lanes5', name: '1-1',
    allyLevel: 1, enemyLevel: G.ORIG.stages[1].start_level,
    loadout: ['leafblower', 'seedshooter', 'treeprotector'],     // 植物點數 2+2+2
    waves: [G.ORIG.stages[1].missions[2].enemies, ['babybear', 'babybear', 'eagle', 'bear']],
    boss: 'bigbear', bossLevel: 2
  }
];
