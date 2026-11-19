// ============================================================
// v3.0 單人關卡：5 個主題戰場（翠葉森林 → 楓紅山谷 → 霜雪凍原 → 熔岩火山 → 幽冥深淵）
// - 每關：場景配色 THEMES（地面色盤、樹木換色、河流、天氣粒子、整體調色）＋ 難度 dif ＋ 敵人名單 roster ＋ 特殊規則 hz
// - G.STAGES[0] 是原本的「經典戰場」，1～5 是新關卡；World 依 stage 讀這裡的設定
// - 新敵人 9 隻（每關有自己的場景生物＋首領），一起進圖鑑、有專屬叫聲
// ============================================================

// ---------- 場景配色 ----------
// nat：覆寫 G.NAT（地面、河流、花草）；tree：樹木／裝飾換色（rgb → rgb）；flow：河面流光；leaf：落葉粒子色；
// wx：天氣（snow 雪、ember 火星、mote 幽光、petal 花瓣、maple 楓葉）；grade：整體調色 [混合模式, 顏色, 透明度]；vis：我方視野倍率
const lum = (r, g, b) => (r * 0.3 + g * 0.59 + b * 0.11) / 255;
G.THEMES = {
  forest: {
    n: '翠葉森林', nat: { grM: '#5a7a4e', grL: '#86a964', fl3: '#e6a8b8', fl2: '#e8d47a' },
    tree: null, flow: '#bcd8dc', leaf: [22, 23, 22, 19, 23], wx: 'petal', grade: null, sky: '#1c2a1e'
  },
  autumn: {
    n: '楓紅山谷',
    nat: { fSh: '#1a120c', fD: '#24180f', fM: '#2e1f13', fHi: '#4a2e18', cl0: '#1e150e', cl1: '#2c1e13', cl2: '#3b2818',
      grD: '#7a5a2e', grM: '#8c6a34', grL: '#b8843c', grDk: '#5e4424', shD: '#3a2a18', shM: '#4a3620', bkD: '#4d3a22', bkM: '#5c4628',
      fl1: '#e2b54c', fl2: '#c4532c', fl3: '#e07a3a', wDeep: '#1d3440', wD: '#25424f', wM: '#2f5160' },
    tree: (r, g, b) => { if (g > r * 1.05 && g >= b) { const L = lum(r, g, b); return L > 0.42 ? [240, 160, 60] : L > 0.28 ? [214, 96, 40] : L > 0.17 ? [160, 52, 30] : [96, 34, 22]; } return [r, g, b]; },
    flow: '#c8d6d0', leaf: [14, 24, 10, 14, 15], wx: 'maple', grade: ['soft-light', '#ff9a40', 0.18], sky: '#2a1a10'
  },
  snow: {
    n: '霜雪凍原',
    nat: { fSh: '#2a3440', fD: '#344150', fM: '#3e4d5e', fHi: '#5a6c80', cl0: '#2e3540', cl1: '#3c4552', cl2: '#4c5664',
      grD: '#c3cdd8', grM: '#d6dee7', grL: '#f2f6fa', grDk: '#aebbc8', rdD: '#8f9aa6', rdM: '#a3aeb9', rdL: '#b6c0ca', rdPb: '#c7d0d8',
      shD: '#98a5b3', shM: '#a9b5c2', wDeep: '#6d93ad', wD: '#7fa6bf', wM: '#93b8cf', wHi: '#c4dcea', sD: '#a9c6d8', sM: '#bcd4e2', sL: '#d4e5ef', foam: '#eef6fb',
      bkD: '#aab7c3', bkM: '#bcc8d3', fl1: '#ffffff', fl2: '#cfe3f0', fl3: '#e8eef4', stD: '#7d8894', stL: '#c9d2db' },
    tree: (r, g, b) => { if (g > r * 1.05 && g >= b) { const L = lum(r, g, b); return L > 0.36 ? [236, 244, 250] : L > 0.24 ? [176, 196, 212] : L > 0.15 ? [96, 122, 140] : [52, 70, 86]; } return [r, g, b]; },
    flow: '#ffffff', leaf: [9, 8, 9], wx: 'snow', grade: ['soft-light', '#9cc8ff', 0.16], sky: '#1a2230'
  },
  lava: {
    n: '熔岩火山',
    nat: { fSh: '#0e0b0a', fD: '#161110', fM: '#1e1715', fHi: '#3a1d12', cl0: '#1a1210', cl1: '#261a15', cl2: '#33231c',
      grD: '#2b2522', grM: '#352d29', grL: '#4a3d36', grDk: '#211c1a', rdD: '#4a3a30', rdM: '#5a4638', rdL: '#6b5444', rdPb: '#7d6250',
      shD: '#191412', shM: '#221b18', wDeep: '#8a1c06', wD: '#b8320a', wM: '#d9500f', wHi: '#ff9a2e', sD: '#7a2a10', sM: '#9a3a14', sL: '#c25a1e', foam: '#ffd166',
      bkD: '#3d1d12', bkM: '#4d2516', fl1: '#ff8a3d', fl2: '#ffcf5a', fl3: '#c4421a', stD: '#3a3330', stL: '#5e5450' },
    tree: (r, g, b) => { if (g > r * 1.05 && g >= b) { const L = lum(r, g, b); return L > 0.4 ? [255, 120, 40] : L > 0.26 ? [70, 48, 40] : L > 0.15 ? [46, 32, 28] : [26, 18, 16]; } return [r, g, b]; },
    flow: '#ffd27a', leaf: [14, 13, 10], wx: 'ember', grade: ['soft-light', '#ff5a1e', 0.22], sky: '#1a0c08'
  },
  abyss: {
    n: '幽冥深淵',
    nat: { fSh: '#0b0810', fD: '#110d18', fM: '#181220', fHi: '#2e1f40', cl0: '#130f19', cl1: '#1d1726', cl2: '#2a2135',
      grD: '#2a2236', grM: '#332940', grL: '#4a3a5e', grDk: '#211b2b', rdD: '#3a3044', rdM: '#463a52', rdL: '#544660', rdPb: '#64566f',
      shD: '#17121e', shM: '#1f1928', wDeep: '#120d24', wD: '#1b1433', wM: '#261c45', wHi: '#5b3fa0', sD: '#2a2148', sM: '#352a58', sL: '#4a3b75', foam: '#9d7cff',
      bkD: '#1f1a2a', bkM: '#282134', fl1: '#9dffb0', fl2: '#b98cff', fl3: '#ff6a8a', stD: '#2e2838', stL: '#4c4458' },
    tree: (r, g, b) => { if (g > r * 1.05 && g >= b) { const L = lum(r, g, b); return L > 0.4 ? [150, 255, 180] : L > 0.26 ? [74, 52, 104] : L > 0.15 ? [48, 34, 70] : [26, 18, 38]; } return [r, g, b]; },
    flow: '#b89cff', leaf: [27, 17, 11], wx: 'mote', grade: ['multiply', '#8a78b8', 0.35], vis: 0.75, sky: '#0c0814'
  }
};
// 暫時換成某個主題的地面色盤（地面、小地圖、預覽小圖共用）
G.withTheme = (id, fn) => {
  const th = G.THEMES[id]; if (!th || !th.nat) return fn();
  const o = G.NAT, r = G.NATRGB, s = G._strip;
  G.NAT = Object.assign({}, o, th.nat); G.NATRGB = null; G._strip = th._strip || (th._strip = {});
  try { return fn(); } finally { G.NAT = o; G.NATRGB = r; G._strip = s; }
};
// 樹木／裝飾換色（每張圖每個主題只算一次）
G._themeImg = {};
G.themeImg = (img, id) => {
  const th = G.THEMES[id]; if (!th || !th.tree || !img) return img;
  const m = G._themeImg[id] || (G._themeImg[id] = new WeakMap()); let o = m.get(img); if (o) return o;
  o = G.canvas(img.width, img.height); const x = o.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, o.width, o.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue; const q = th.tree(a[i], a[i + 1], a[i + 2]); a[i] = q[0]; a[i + 1] = q[1]; a[i + 2] = q[2]; }
  x.putImageData(d, 0, 0); m.set(img, o); return o;
};

// ---------- 新敵人（場景生物＋關卡首領） ----------
(() => {
  const U = G.ORIG.units, base = n => Object.assign({}, U[n]);
  const add = (n, from, o, nm, info, spr, cry, bossSk) => {
    U[n] = Object.assign(base(from), { name: n, type: 'enemy', jungler: false }, o);
    G.TXT.unit[n] = nm; G.TXT.uinfo[n] = info; G.BESTIARY[n] = spr; if (G.Cry) G.Cry.add(n, cry); if (bossSk) G.BOSS_SKILL[n] = bossSk;
  };
  // 1 森林：蘑菇仔（慢、耐打）
  add('shroom', 'mouse', { id: 9101, hp: 220, grow_hp: 7, power: 14, armor: 3, speed: 60, delay: 1100, exp: 160 }, '蘑菇仔', '森林裡搖搖晃晃的小蘑菇，走得慢但很耐打。',
    { w: 13, h: 14, draw(P, f) { P.r(4 + f, 12, 2, 2, 1); P.r(7 - f, 12, 2, 2, 1); P.e(6.5, 9.5, 3, 3.2, 4); P.e(6.5, 5, 6, 3.8, 1); P.r(1, 6, 11, 1, 2); P.px(4, 3, 7); P.px(8, 2, 7); P.px(10, 5, 7); P.px(3, 6, 7); P.px(5, 9, 0); P.px(8, 9, 0); } },
    ['goo', 1.6, 0.7]);
  // 2 秋楓：松果刺蝟（遠程丟松果）、楓角鹿王（首領）
  add('hedgehog', 'monkey', { id: 9102, hp: 180, grow_hp: 6, power: 18, armor: 4, speed: 75, delay: 1300, range: 120, exp: 220, weapon_name: 'stone', weapon_option: 0 }, '松果刺蝟', '背著一身尖刺，會從遠處丟松果砸人。',
    { w: 15, h: 11, draw(P, f) { G.quad(P, f, { bx: 7, by: 6.5, brx: 5.5, bry: 3.5, hx: 12, hy: 7, hr: 2.2, legs: [4, 9], ly: 9, ll: 2, snout: 1 }); for (let x = 3; x <= 10; x += 2) { P.l(x, 4, x - 1, 0, 2); P.px(x - 1, 0, 4); } } },
    ['oink', 1.6, 0.7, 0, 'giggle']);
  add('stagking', 'bigbear', { id: 9103, hp: 520, grow_hp: 8, power: 40, armor: 6, speed: 90, delay: 1100, critical: 10, exp: 500 }, '楓角鹿王', '楓紅山谷的守護者，頭上的大角像燃燒的楓枝，衝撞時能貫穿一整排敵人。',
    { w: 22, h: 20, boss: 1, draw(P, f) { G.quad(P, f, { bx: 9, by: 12, brx: 7, bry: 4, hx: 16, hy: 8, hr: 2.8, hry: 2.4, legs: [4, 13, 5, 14], ly: 15, ll: 5, snout: 2, ear: 'p', tail: [2, 2] }); P.l(15, 5, 13, 0, 14); P.l(14, 3, 11, 2, 14); P.l(17, 5, 19, 0, 14); P.l(18, 3, 21, 2, 14); P.px(12, 0, 13); P.px(20, 0, 13); P.px(9, 10, 7); P.px(6, 11, 7); } },
    ['moo', 1.4, 0.9, 1, 'zing'], 2007);
  // 3 霜雪：雪兔（快）、雪怪（首領）
  add('snowhare', 'mouse', { id: 9104, hp: 140, grow_hp: 5, power: 20, armor: 1, speed: 125, delay: 650, critical: 8, exp: 180 }, '雪兔', '在雪地上跳得飛快的白兔，常常一眨眼就衝到面前。',
    { w: 12, h: 12, draw(P, f) { P.r(3 + f, 10, 2, 2, 4); P.r(7 - f, 10, 2, 2, 4); P.e(5.5, 8, 4, 2.8, 5); P.e(9, 5.5, 2.4, 2.2, 5); P.l(8, 3, 7, 0, 5); P.l(10, 3, 10, 0, 5); P.px(7, 1, 7); P.px(10, 1, 7); P.e(1.5, 7, 1.3, 1.3, 8); P.px(10, 5, 9); P.shade(5, 7, 4); } },
    ['squeak', 1.4, 0.8, 0, 'ice']);
  add('yeti', 'polarbear', { id: 9105, hp: 650, grow_hp: 9, power: 45, armor: 8, speed: 70, delay: 1200, critical: 8, exp: 550, weapon_name: 'enemy_body' }, '雪怪', '凍原深處的巨大雪怪，吐出的寒冰能讓整片敵人凍得動彈不得。',
    { w: 19, h: 22, boss: 1, draw(P, f) { G.biped(P, f, { c: 5, x: 9, y: 11, bw: 6, bh: 8, hr: 4, ll: 3 }); P.l(6, 4, 4, 1, 7); P.l(12, 4, 14, 1, 7); P.r(9, 7, 4, 2, 2); P.px(11, 7, 9); P.px(9, 7, 9); P.px(10, 9, 9); P.shade(5, 7, 3); for (let i = 0; i < 4; i++) P.px(5 + i * 3, 14 + (i % 2), 7); } },
    ['growl', 0.55, 1.5, 1, 'ice'], 3002);
  // 4 熔岩：熔岩蜥（遠程火球）、熔岩巨像（首領）
  add('salamander', 'monkey', { id: 9106, hp: 230, grow_hp: 7, power: 26, armor: 4, speed: 85, delay: 1200, range: 120, critical: 6, exp: 260, weapon_name: 'Fireball', weapon_option: 0 }, '熔岩蜥', '在岩漿裡游泳的蜥蜴，會從遠處吐出火球。',
    { w: 17, h: 9, draw(P, f) { G.quad(P, f, { bx: 8, by: 5, brx: 5.5, bry: 2.5, hx: 14, hy: 5, hr: 2.2, hry: 1.8, legs: [5, 10, 6, 11], ly: 7, ll: 2, snout: 2, tail: [5, -1], eye: 13 }); P.px(6, 3, 14); P.px(9, 3, 14); P.px(11, 4, 14); P.px(3, 5, 14); } },
    ['hiss', 1.3, 0.7, 0, 'fire']);
  add('magmagolem', 'turtle', { id: 9107, hp: 900, grow_hp: 12, power: 55, armor: 12, speed: 55, delay: 1500, critical: 5, range: 30, exp: 650, weapon_name: 'enemy_body', weapon_option: 0 }, '熔岩巨像', '岩漿凝成的石巨人，一拳砸地就能震暈周圍的敵人。',
    { w: 20, h: 22, boss: 1, draw(P, f) { P.r(5 + f, 17, 4, 5, 2); P.r(11 - f, 17, 4, 5, 2); P.r(3, 7, 14, 11, 2); P.r(5, 1, 9, 7, 3); P.r(0, 8, 3, 8, 2); P.r(17, 8, 3, 8, 2); P.l(5, 9, 9, 14, 14); P.l(13, 8, 11, 13, 14); P.px(10, 15, 13); P.px(7, 4, 13); P.px(11, 4, 13); P.r(7, 6, 5, 1, 14); P.px(1, 15, 14); P.px(18, 15, 14); } },
    ['honk', 0.55, 1.4, 1, 'boom'], 3003);
  // 5 深淵：幽魂（飛行、穿透）、三頭地獄犬（首領）
  add('wraith', 'bat', { id: 9108, hp: 160, grow_hp: 5, power: 22, armor: 0, speed: 95, delay: 1100, range: 130, exp: 200 }, '幽魂', '從深淵飄出的亡魂，叫聲能穿透一整排敵人。倒下的敵兵有時會化成牠再站起來。',
    { w: 13, h: 15, fly: 1, draw(P, f) { P.e(6.5, 5, 4.5, 4.5, 3); P.r(2, 5, 9, 6, 3); for (let i = 0; i < 4; i++) P.r(2 + i * 2 + (f && i % 2 ? 1 : 0), 11, 1, 2 + (i % 2), 3); P.px(5, 4, 11); P.px(8, 4, 11); P.l(5, 7, 8, 7, 1); P.shade(3, 5, 2); } },
    ['wraith', 1.4, 0.7]);
  add('cerberus', 'madwolf', { id: 9109, hp: 800, grow_hp: 10, power: 50, armor: 7, speed: 105, delay: 900, critical: 15, exp: 650 }, '三頭地獄犬', '守在深淵大門的三頭巨犬，咬人會吸血，還會噴出地獄火球。',
    { w: 24, h: 16, boss: 1, draw(P, f) { G.quad(P, f, { bx: 9, by: 10, brx: 7.5, bry: 4, hx: 18, hy: 7, hr: 3, legs: [4, 13, 5, 14], ly: 13, ll: 3, snout: 2, ear: 'p', tail: [4, 3], eye: 14 }); P.e(15, 4, 2.4, 2.2, 1); P.r(17, 4, 2, 1, 3); P.px(16, 3, 14); P.e(21, 10, 2.4, 2.2, 1); P.r(23, 10, 1, 1, 3); P.px(22, 9, 14); P.px(7, 7, 14); P.px(11, 7, 14); } },
    ['bark', 0.6, 1.3, 1, 'fire'], 2009);
})();

// ---------- 關卡 ----------
// dif：lv 敵人等級加成、hp／pow 敵人血量／攻擊倍率、tower 敵塔血量倍率、wave 出兵間隔倍率、boss 每幾波來一隻首領、cnt [起始, 上限] 每路每波隻數
// hunt：n 獵手數、first 第一次出動（秒）、re 倒下後再來（秒）；hz 特殊規則；rew 首次通關鑰匙；roster [前期, 中期, 後期] 敵人
G.SOLO = [
  { theme: 'forest', n: '翠葉森林', en: 'SPRING WOODS', d: 1, rule: '新手關：敵人比較弱，也{沒有敵方獵手}', hz: null, rew: 10,
    dif: { lv: 0, hp: 0.75, pow: 0.75, tower: 0.8, wave: 1.2, boss: 4, cnt: [1, 4] }, hunt: { n: 0 },
    roster: [['babybear', 'mouse', 'shroom'], ['babybear', 'chipmunk', 'boar', 'shroom'], ['bear', 'eagle', 'boar', 'shroom', 'chipmunk']], boss: 'bigbear', fresh: ['shroom'] },
  { theme: 'autumn', n: '楓紅山谷', en: 'MAPLE VALLEY', d: 2, rule: '{秋風}：每 50 秒吹起，全場跑速 {+30%}（8 秒）', hz: 'wind', rew: 15,
    dif: { lv: 0, hp: 1, pow: 1, tower: 1, wave: 1, boss: 3, cnt: [2, 5] }, hunt: { n: 1, first: 90, re: 75 },
    roster: [['boar', 'monkey', 'hedgehog'], ['hedgehog', 'raven', 'smartmonkey', 'boar'], ['kangaroo', 'buffalo', 'hedgehog', 'smartmonkey', 'raven']], boss: 'stagking', fresh: ['hedgehog', 'stagking'] },
  { theme: 'snow', n: '霜雪凍原', en: 'FROST TUNDRA', d: 3, rule: '{暴風雪}：每 60 秒颳起，全場跑速和攻速 {−25%}（10 秒）', hz: 'blizzard', rew: 25,
    dif: { lv: 1, hp: 1.1, pow: 1.05, tower: 1.15, wave: 1, boss: 3, cnt: [2, 5] }, hunt: { n: 2, first: 90, re: 70 },
    roster: [['snowhare', 'whitemouse', 'penguin'], ['snowhare', 'penguin', 'madwolf', 'turtle'], ['snowhare', 'madwolf', 'polarbear', 'penguin', 'turtle']], boss: 'yeti', fresh: ['snowhare', 'yeti'] },
  { theme: 'lava', n: '熔岩火山', en: 'MOLTEN PEAK', d: 4, rule: '{火山噴發}：每 35 秒落下熔岩彈，{紅圈}裡敵我都會受傷', hz: 'lava', rew: 40,
    dif: { lv: 2, hp: 1.25, pow: 1.15, tower: 1.3, wave: 0.95, boss: 2, cnt: [2, 6] }, hunt: { n: 2, first: 75, re: 60 },
    roster: [['salamander', 'firegnome', 'crocodile'], ['salamander', 'firebear', 'splashbuffalo', 'crocodile'], ['salamander', 'firebear', 'firegnome', 'splashbuffalo', 'smartmonkey']], boss: 'magmagolem', fresh: ['salamander', 'magmagolem'] },
  { theme: 'abyss', n: '幽冥深淵', en: 'THE ABYSS', d: 5, rule: '{亡者復甦}：敵兵倒下有 {25%} 會變成幽魂再站起來，視野也變小', hz: 'revive', rew: 60,
    dif: { lv: 3, hp: 1.4, pow: 1.25, tower: 1.5, wave: 0.9, boss: 2, cnt: [3, 6] }, hunt: { n: 3, first: 70, re: 55 },
    roster: [['wraith', 'vampirebat', 'blackvulture'], ['wraith', 'madwolf', 'vampirebat', 'gnome'], ['wraith', 'lion', 'madwolf', 'blackvulture', 'gnome']], boss: 'cerberus', fresh: ['wraith', 'cerberus'] }
];
G.STAGES[0].n = '經典戰場'; G.STAGES[0].theme = 'forest';
G.SOLO.forEach(s => G.STAGES.push(Object.assign({ map: 'lanes5', allyLevel: 1, loadout: G.STAGES[0].loadout, bossLevel: 2 + s.dif.lv }, s)));
G.SOLO_STAR = 5;                                 // 每多拿一顆星的鑰匙
G.SOLO_HZ = { wind: { every: 50, dur: 8, k: 1.3 }, blizzard: { every: 60, dur: 10, k: 0.75, atk: 1.25 }, lava: { every: 35, n: 5, r: 36, pct: 18, warn: 1.1 }, revive: { p: 25, hp: 40 } };

// ---------- 戰場掛勾（World 會呼叫） ----------
G.SoloW = {
  // 敵方每一波（自訂名單）
  wave(W, n) {
    const S = W.stage, D = S.dif, tier = S.roster[n < 6 ? 0 : n < 15 ? 1 : 2], cnt = Math.min(D.cnt[1], D.cnt[0] + Math.floor(n / 6)), lv = 1 + D.lv + Math.floor(n / 3);
    const rng = G.mulberry(n * 977 + S.d * 31);
    for (let lane = 0; lane < W.nLanes; lane++) for (let i = 0; i < cnt; i++) W.spawnQ.push({ t: i * 0.45, name: tier[(rng() * tier.length) | 0], side: 1, level: lv, lane });
    if (n % D.boss === D.boss - 1) { W.spawnQ.push({ t: cnt * 0.45 + 0.5, name: S.boss, side: 1, level: lv + 1, kind: 'boss', lane: n % W.nLanes }); W.sfx('warn'); }
    W.stageNow = 1 + n + D.lv * 3;
  },
  // 每一幀：特殊規則
  tick(W, dt) {
    if (!W.introSaid && !W.attract) { W.introSaid = 1; W.say({ s: '第 ' + W.stageI + ' 關：' + W.stage.n, ic: 'i_play', col: G.THEMES[W.themeId] ? 13 : 9, t: 3 }); }   // 開場：關卡名稱
    const hz = W.stage.hz; if (!hz || W.attract || W.over) return;
    const C = G.SOLO_HZ[hz];
    W.hzT = (W.hzT == null ? (C.every || 1e9) : W.hzT) - dt;
    if (W.wind > 0) W.wind -= dt; if (W.bliz > 0) W.bliz -= dt;
    if (hz === 'wind' && W.hzT <= 0) { W.hzT = C.every; W.wind = C.dur; W.say({ s: '秋風吹起：全場跑速 +30%', ic: 'p_move', col: 14, t: 2.6 }); G.Audio.play('meteor'); }
    if (hz === 'blizzard' && W.hzT <= 0) { W.hzT = C.every; W.bliz = C.dur; W.say({ s: '暴風雪來了：全場變慢', ic: 'i_ice', col: 12, t: 2.6 }); G.Audio.play('warn'); }
    if (hz === 'lava' && (W.hzT == null || W.hzT <= 0)) { W.hzT = C.every; G.SoloW.erupt(W); }
  },
  // 火山噴發：英雄附近 2 顆＋戰場上隨機 3 顆，紅圈預警後落下
  erupt(W) {
    const C = G.SOLO_HZ.lava, pts = [], h = W.hero;
    if (h && h.alive) for (let i = 0; i < 2; i++) { const a = Math.random() * 6.283, d = G.rr(30, 110); pts.push([h.x + Math.cos(a) * d, h.y + Math.sin(a) * d]); }
    const mob = W.units.filter(u => u.alive && !u.static && u.side !== 2);
    while (pts.length < C.n && mob.length) { const u = mob[(Math.random() * mob.length) | 0]; pts.push([u.x + G.rr(-30, 30), u.y + G.rr(-20, 20)]); }
    if (!pts.length) return;
    W.say({ s: '火山噴發！避開紅圈', ic: 'i_fire', col: 10, t: 2.4 }); G.Audio.play('warn');
    const src = { side: -1, kind: 'hazard', name: 'lava', x: 0, y: 0, alive: false, st: { crit: 0 }, melee: false };
    pts.forEach(([x, y], i) => setTimeout(() => { if (G.W !== W || W.over) return;
      G.VFX.meteor(W, x, y, C.r, () => {
        src.x = x; src.y = y - 1;
        for (const u of W.units) if (u.alive && !u.static && u.side !== 2 && Math.hypot(u.x - x, (u.y - y) * 1.3) < C.r + u.r * 0.5) W.damage(src, u, u.st.hp * C.pct / 100 + u.st.armor * (u.bArm || 1), { fire: 1, big: 1, skill: true });
        W.shake(0.35);
      }, 'fire', C.warn);
    }, i * 220));
  },
  // 亡者復甦：敵兵倒下 → 有機會變成幽魂
  died(W, t) {
    if (W.stage.hz !== 'revive' || t.side !== 1 || t.kind !== 'creep' || t.ghost || W.over) return;
    const C = G.SOLO_HZ.revive; if (Math.random() * 100 >= C.p) return;
    W.spawnQ.push({ t: 0.9, name: 'wraith', side: 1, level: t.level, lane: t.lane, at: [t.x, t.y], ghost: C.hp });
  },
  // 天氣粒子（鏡頭附近）
  weather(W, dt) {
    const th = W.theme; if (!th || !th.wx) return;
    const cam = G.Render.cam, R0 = G.Render, sc = R0.scale || 1, vw = (R0.sw || 800) / sc / G.AX, vh = (R0.sh || 450) / sc / G.AY;
    const rate = { snow: W.bliz > 0 ? 90 : 28, ember: 14, mote: 10, petal: 3, maple: W.wind > 0 ? 20 : 4 }[th.wx] || 0;
    W.wxAcc = (W.wxAcc || 0) + rate * dt;
    while (W.wxAcc >= 1) {
      W.wxAcc--;
      const x = cam.x + G.rr(-0.6, 0.6) * vw, y = cam.y + G.rr(-0.6, 0.6) * vh, wnd = W.wind > 0 ? 50 : W.bliz > 0 ? -40 : 0;
      if (th.wx === 'snow') W.parts.add(x, y, G.rr(50, 90), G.rr(-6, 6) + wnd, G.rr(-2, 2), G.rr(-18, -10), G.rr(3, 5), 9, 8, 1, 0, 0, 2);
      else if (th.wx === 'ember') W.parts.add(x, y, G.rr(0, 4), G.rr(-5, 5), G.rr(-2, 2), G.rr(18, 36), G.rr(1.4, 2.4), G.pick([14, 13, 14]), 10, 1, 0, 0, 0);
      else if (th.wx === 'mote') W.parts.add(x, y, G.rr(4, 30), G.rr(-4, 4), G.rr(-3, 3), G.rr(-3, 6), G.rr(2.4, 3.6), G.pick([27, 17, 11]), 28, 1, 0, 0, 0);
      else W.parts.add(x, y, G.rr(40, 70), G.rr(8, 20) + wnd, G.rr(-3, 3), G.rr(-10, -4), G.rr(3, 4.5), G.pick(th.leaf), 3, 1, 0, 0, 2);
    }
  },
  // 打完：星等與獎勵（存在玩家檔案 P.stg）
  finish(W, win) {
    const si = W.stageI; if (!si || W.attract) return null;
    const ho = W.holy[0], hk = W.stats.minHoly != null ? W.stats.minHoly : (ho && ho.st ? ho.hp / ho.st.hp : 0);
    const stars = win ? 1 + (hk >= 0.5 ? 1 : 0) + ((W.overSt || W.stats).deaths === 0 ? 1 : 0) : 0;
    const res = { win, stars, rew: 0, first: false, newStars: 0, si };
    if (!G.Team.dev && win) {
      const P = G.Ach.P(); P.stg = P.stg || {}; const old = P.stg[si] || { c: 0, s: 0 };
      if (!old.c) { res.first = true; res.rew += G.SOLO[si - 1].rew; }
      res.newStars = Math.max(0, stars - old.s); res.rew += res.newStars * G.SOLO_STAR;
      P.stg[si] = { c: (old.c || 0) + 1, s: Math.max(old.s, stars), t: Math.min(old.t || 1e9, Math.round(W.stats.time)) };
      if (res.rew) G.Team.addKeys(res.rew);
      G.Team.save();
    }
    W.soloRes = res; return res;
  },
  best: si => { const P = G.Ach.P(); return (P.stg && P.stg[si]) || { c: 0, s: 0 }; },
  open: si => G.Team.dev || si <= 1 || G.SoloW.best(si - 1).c > 0
};
