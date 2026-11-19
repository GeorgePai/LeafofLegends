'use strict';
/* =========================================================
   玩家檔案與成就
   - 存在 G.Team.v：name（存檔名稱）、p（累計數據）、ach（成就狀態 1＝達成未領取、2＝已領取）
   - 戰鬥中每 2 秒把本場數據累加進檔案（關掉分頁最多損失 2 秒）；打完一場才算「完成場次」
   - 開發者模式不記錄
   ========================================================= */
G.ACH_TIER = [null, { k: 1, c: 9, n: '銅' }, { k: 2, c: 11, n: '銀' }, { k: 3, c: 17, n: '金' }, { k: 5, c: 14, n: '傳說' }];   // 獎勵鑰匙數與顏色
G.ACH_CATS = ['成長', '戰鬥', '收藏', '探索'];
// 數值（v）：P＝累計檔案；B＝單場最佳；M＝本場（只有打完的那一刻才有 fin/win）
G.ACH = [
  // ----- 成長：累計 -----
  { id: 'games1', c: 0, t: 1, n: '初次出征', d: '完成 1 場戰鬥', g: 1, v: P => P.games },
  { id: 'games20', c: 0, t: 2, n: '身經百戰', d: '完成 20 場戰鬥', g: 20, v: P => P.games },
  { id: 'games50', c: 0, t: 3, n: '老兵不死', d: '完成 50 場戰鬥', g: 50, v: P => P.games },
  { id: 'wins10', c: 0, t: 2, n: '常勝軍', d: '累計贏得 10 場勝利', g: 10, v: P => P.wins },
  { id: 'time30', c: 0, t: 1, n: '小試身手', d: '累計戰鬥 30 分鐘', g: 30, u: '分', v: P => Math.floor(P.time / 60) },
  { id: 'time180', c: 0, t: 2, n: '樂此不疲', d: '累計戰鬥 3 小時', g: 180, u: '分', v: P => Math.floor(P.time / 60) },
  { id: 'time600', c: 0, t: 4, n: '森林守護者', d: '累計戰鬥 10 小時', g: 600, u: '分', v: P => Math.floor(P.time / 60) },
  { id: 'kill100', c: 0, t: 1, n: '百人斬', d: '英雄累計擊倒 100 個敵人', g: 100, v: P => P.kills },
  { id: 'kill1000', c: 0, t: 3, n: '千人斬', d: '英雄累計擊倒 1000 個敵人', g: 1000, v: P => P.kills },
  { id: 'boss10', c: 0, t: 2, n: '首領獵人', d: '累計擊倒 10 隻敵方首領', g: 10, v: P => P.bosses },
  { id: 'boss50', c: 0, t: 4, n: '屠龍者', d: '累計擊倒 50 隻敵方首領', g: 50, v: P => P.bosses },
  { id: 'tower20', c: 0, t: 2, n: '拆遷大隊', d: '累計推倒 20 座敵塔', g: 20, v: P => P.towers },
  { id: 'tower100', c: 0, t: 3, n: '城牆粉碎機', d: '累計推倒 100 座敵塔', g: 100, v: P => P.towers },
  { id: 'gold', c: 0, t: 3, n: '富可敵國', d: '累計賺到 10 萬金幣', g: 100000, v: P => Math.floor(P.gold) },
  // v2.6 新增
  { id: 'wins50', c: 0, t: 3, n: '百戰百勝', d: '累計贏得 50 場勝利', g: 50, v: P => P.wins },
  { id: 'camp100', c: 0, t: 2, n: '野區常客', d: '累計清掉 100 個野怪營地', g: 100, v: P => P.camps },
  { id: 'dmg', c: 0, t: 3, n: '毀天滅地', d: '英雄累計造成 50 萬點傷害', g: 500000, v: P => Math.floor(P.dmg) },
  { id: 'tp50', c: 0, t: 2, n: '傳送大師', d: '累計用我方塔傳送 50 次', g: 50, v: P => P.tps },
  // ----- 戰鬥：單場挑戰 -----
  { id: 'win1', c: 1, t: 1, n: '首勝', d: '贏得第一場勝利', g: 1, v: P => P.wins },
  { id: 'flawless', c: 1, t: 3, n: '毫髮無傷', d: '一次都沒倒下就獲勝', g: 1, v: (P, B, M) => M && M.win && M.st.deaths === 0 ? 1 : 0 },
  { id: 'speed', c: 1, t: 3, n: '速戰速決', d: '15 分鐘內獲勝', g: 1, v: (P, B, M) => M && M.win && M.st.time <= 900 ? 1 : 0 },
  { id: 'comeback', c: 1, t: 3, n: '絕地大反攻', d: '聖樹剩不到 25% 血量時仍然獲勝', hint: '最危險的時候，千萬別放棄。', g: 1, v: (P, B, M) => M && M.win && M.st.minHoly < 0.25 ? 1 : 0 },
  { id: 'phoenix', c: 1, t: 2, n: '打不死的小強', d: '一場倒下 5 次以上仍然獲勝', hint: '倒下幾次都沒關係。', g: 1, v: (P, B, M) => M && M.win && M.st.deaths >= 5 ? 1 : 0 },
  { id: 'few', c: 1, t: 3, n: '以少勝多', d: '出戰小兵總共 4 點以內，仍然獲勝', hint: '兵不在多。', g: 1, v: (P, B, M) => M && M.win && M.pts <= 4 ? 1 : 0 },
  { id: 'streak', c: 1, t: 2, n: '一騎當千', d: '4 秒內連續擊倒 5 個敵人', g: 5, v: (P, B) => B.streak },
  { id: 'demolish', c: 1, t: 3, n: '拆家專家', d: '單場推倒 8 座敵塔', g: 8, v: (P, B) => B.towers },
  { id: 'rich', c: 1, t: 2, n: '小富翁', d: '單場累積 3000 金幣', g: 3000, v: (P, B) => Math.floor(B.gold) },
  { id: 'assist', c: 1, t: 2, n: '最佳助攻', d: '單場 20 次助攻', g: 20, v: (P, B) => B.assists },
  { id: 'lv10', c: 1, t: 2, n: '登峰造極', d: '單場把英雄升到 Lv10', g: 10, v: (P, B) => B.level },
  { id: 'tame', c: 1, t: 1, n: '馴獸師', d: '收服一隻野生首領', g: 1, v: P => P.wboss },
  { id: 'tame2', c: 1, t: 3, n: '雙霸主', d: '同一場收服兩隻野生首領', g: 2, v: (P, B) => B.wboss },
  { id: 'hunter', c: 1, t: 1, n: '反獵殺', d: '擊倒敵方獵手', g: 1, v: P => P.hunters },
  { id: 'army', c: 1, t: 1, n: '召集令', d: '同時讓 6 隻小兵跟隨英雄', g: 6, v: (P, B) => B.follow },
  { id: 'potion', c: 1, t: 1, n: '藥罐子', d: '單場喝掉 10 瓶藥水', g: 10, v: (P, B) => B.potions },
  { id: 'fullbag', c: 1, t: 1, n: '全副武裝', d: '背包同時裝滿 6 種藥水', g: 6, v: (P, B) => B.bag },
  // v2.6 新增
  { id: 'pacifist', c: 1, t: 3, n: '不戰而勝', d: '英雄擊倒不超過 5 個敵人，仍然獲勝', hint: '讓小兵們去打吧。', g: 1, v: (P, B, M) => M && M.win && M.st.kills <= 5 ? 1 : 0 },
  { id: 'marathon', c: 1, t: 2, n: '持久戰', d: '打超過 30 分鐘才獲勝', g: 1, v: (P, B, M) => M && M.win && M.st.time >= 1800 ? 1 : 0 },
  { id: 'tank', c: 1, t: 2, n: '銅牆鐵壁', d: '單場承受 5000 點傷害，仍然獲勝', g: 1, v: (P, B, M) => M && M.win && M.st.taken >= 5000 ? 1 : 0 },
  { id: 'jungle12', c: 1, t: 2, n: '野區霸主', d: '單場清掉 12 個野怪營地', g: 12, v: (P, B) => B.camps },
  { id: 'allmax', c: 1, t: 2, n: '技藝精通', d: '單場把英雄所有技能都升到 LV3', g: 1, v: (P, B) => B.allmax },
  { id: 'spend', c: 1, t: 1, n: '揮金如土', d: '單場在商店花掉 2000 金幣', g: 2000, v: (P, B) => B.spent },
  { id: 'streak10', c: 1, t: 4, n: '殺神降臨', d: '4 秒內連續擊倒 10 個敵人', g: 10, v: (P, B) => B.streak },
  // ----- 收藏 -----
  { id: 'chest1', c: 2, t: 1, n: '開箱初體驗', d: '第一次開寶箱', g: 1, v: P => P.chests },
  { id: 'gamble5', c: 2, t: 3, n: '賭神降臨', d: '賭徒寶箱一次開出 5 把鑰匙', hint: '運氣好到不行。', g: 1, v: P => P.gamble5 },
  { id: 'hero5', c: 2, t: 2, n: '英雄集結', d: '擁有 5 位英雄', g: 5, v: () => G.Team.get().owned.h.length },
  { id: 'heroAll', c: 2, t: 4, n: '群英薈萃', d: '擁有全部英雄', g: () => G.HEROES.length, v: () => G.Team.get().owned.h.length },
  { id: 'minion10', c: 2, t: 2, n: '植物園長', d: '擁有 10 隻小兵', g: 10, v: () => G.Team.get().owned.m.length },
  { id: 'minionAll', c: 2, t: 4, n: '森羅萬象', d: '擁有全部小兵', g: () => G.ROSTER.minions.length, v: () => G.Team.get().owned.m.length },
  { id: 'ach15', c: 2, t: 3, n: '成就獵人', d: '完成 15 個成就', g: 15, v: () => G.Ach.doneCount('ach15') },
  // v2.6 新增
  { id: 'chest30', c: 2, t: 2, n: '開箱成癮', d: '累計開 30 次寶箱', g: 30, v: P => P.chests },
  { id: 'legend3', c: 2, t: 3, n: '傳說收藏家', d: '擁有 3 個傳說以上稀有度的角色', g: 3, v: () => { const o = G.Team.get().owned; return [...o.h, ...o.m].filter(n => G.rarityOf(n) >= 3).length; } },
  { id: 'mythic', c: 2, t: 4, n: '神話降臨', d: '擁有一位神話英雄', hint: '傳說之上，還有傳說。', g: 1, v: () => G.Team.get().owned.h.filter(n => G.rarityOf(n) === 4).length },
  // ----- 探索 -----
  { id: 'guide', c: 3, t: 1, n: '好學生', d: '看過教學的每一頁', g: () => G.Ach.guideTotal(), v: P => { const ks = G.Menus && G.Menus.guideKeys ? G.Menus.guideKeys() : null; return ks ? P.guide.filter(k => ks.includes(k)).length : P.guide.length; } },
  { id: 'book', c: 3, t: 2, n: '博物學家', d: '在圖鑑看過每一種角色', g: () => G.Ach.bookTotal(), v: P => P.book.length },
  { id: 'demo', c: 3, t: 1, n: '招式研究員', d: '看過 20 種不同的技能展示', g: 20, v: P => P.demo.length },
  { id: 'save', c: 3, t: 1, n: '未雨綢繆', d: '第一次產生存檔碼', g: 1, v: P => P.codes },
  { id: 'night', c: 3, t: 1, n: '夜貓子', d: '在凌晨 0～5 點打完一場戰鬥', hint: '月亮出來的時候……', g: 1, v: P => P.night },
  // v2.6 新增
  { id: 'early', c: 3, t: 1, n: '早起的鳥兒', d: '在早上 5～8 點打完一場戰鬥', hint: '太陽剛升起的時候……', g: 1, v: P => P.morning },
  { id: 'demoAll', c: 3, t: 3, n: '武學大全', d: '看過每位英雄每一招的技能展示', g: () => G.Ach.heroSkillIds().size, v: P => { const S = G.Ach.heroSkillIds(); return P.demo.filter(x => S.has(x)).length; } },
  { id: 'scout', c: 3, t: 1, n: '戰場觀察家', d: '在戰鬥中打開大地圖 10 次', g: 10, v: P => P.maps },
  // v3.0 單人關卡
  { id: 'stg1', c: 1, t: 1, n: '森林新兵', d: '通關「翠葉森林」', g: 1, v: P => P.stg && P.stg[1] ? 1 : 0 },
  { id: 'stg2', c: 1, t: 2, n: '楓葉獵人', d: '通關「楓紅山谷」', g: 1, v: P => P.stg && P.stg[2] ? 1 : 0 },
  { id: 'stg3', c: 1, t: 2, n: '破冰者', d: '通關「霜雪凍原」', g: 1, v: P => P.stg && P.stg[3] ? 1 : 0 },
  { id: 'stg4', c: 1, t: 3, n: '浴火重生', d: '通關「熔岩火山」', g: 1, v: P => P.stg && P.stg[4] ? 1 : 0 },
  { id: 'stg5', c: 1, t: 4, n: '深淵征服者', d: '通關「幽冥深淵」', g: 1, v: P => P.stg && P.stg[5] ? 1 : 0 },
  { id: 'star3', c: 1, t: 2, n: '完美演出', d: '任一關拿到三顆星', g: 1, v: P => P.stg && Object.values(P.stg).some(q => q.s >= 3) ? 1 : 0 },
  { id: 'starAll', c: 1, t: 4, n: '五星傳說', d: '五個關卡全部三顆星', g: 5, v: P => P.stg ? Object.values(P.stg).filter(q => q.s >= 3).length : 0 },
  { id: 'huntKill', c: 1, t: 3, n: '獵人剋星', d: '在熔岩火山或幽冥深淵，一場擊倒 3 隻獵手並獲勝', g: 3, v: (P, B, M) => M && M.win && M.stage >= 4 ? M.st.hunters : 0 },
];
G.ACH_BY = Object.fromEntries(G.ACH.map(a => [a.id, a]));

G.Ach = (() => {
  const A = {};
  const ADD = ['kills', 'deaths', 'assists', 'camps', 'towers', 'gold', 'time', 'bosses', 'hunters', 'wboss', 'potions', 'dmg', 'tps'];
  const BEST = ['streak', 'towers', 'gold', 'assists', 'level', 'wboss', 'follow', 'potions', 'bag', 'camps', 'allmax', 'spent'];
  A.recent = [];                                     // 本場新達成（結算畫面用）
  A.banner = null;                                   // 選單畫面的成就通知
  // 檔案：缺的欄位自動補上（舊存檔相容）
  A.P = () => {
    const v = G.Team.get();
    if (!v.p) v.p = {};
    const p = v.p;
    for (const k of [...ADD, 'games', 'wins', 'chests', 'gamble5', 'codes', 'night', 'morning', 'maps']) if (typeof p[k] !== 'number') p[k] = 0;
    for (const k of ['guide', 'book', 'demo']) if (!Array.isArray(p[k])) p[k] = [];
    if (!p.stg || typeof p.stg !== 'object' || Array.isArray(p.stg)) p.stg = {};   // v3.0 關卡紀錄 {關卡: {c 通關次數, s 最佳星數, t 最快秒數}}
    if (!p.best) p.best = {}; for (const k of BEST) if (typeof p.best[k] !== 'number') p.best[k] = 0;
    if (!v.ach) v.ach = {};
    return p;
  };
  A.off = () => G.Team.dev;
  A.goal = a => typeof a.g === 'function' ? a.g() : a.g;
  A.state = id => (G.Team.get().ach || {})[id] || 0;          // 0 未達成、1 達成未領取、2 已領取
  A.doneCount = except => G.ACH.filter(a => a.id !== except && A.state(a.id) > 0).length;
  A.unclaimed = () => G.ACH.filter(a => A.state(a.id) === 1).length;
  A.value = (a, M) => { const P = A.P(); return a.v(P, P.best, M) || 0; };
  A.heroSkillIds = () => new Set(G.HEROES.flatMap(h => [...h.skills, ...h.passives]).map(String));
  A.guideTotal = () => (G.Menus && G.Menus.guidePageCount ? G.Menus.guidePageCount() : 50);
  A.bookTotal = () => new Set([...G.ROSTER.bosses, ...G.ROSTER.smalls, ...G.ROSTER.towers, ...Object.keys(G.WILD).map(k => G.WILD[k].unit), ...G.ROSTER.hunters]).size;
  // 檢查所有未達成的成就（M＝本場打完的情境）
  A.check = (M, W) => {
    if (A.off()) return;
    const v = G.Team.get(); A.P(); let any = false;
    for (let pass = 0; pass < 2; pass++)            // 第二輪：讓「完成 15 個成就」能在同一次檢查中達成
      for (const a of G.ACH) {
        if (v.ach[a.id]) continue;
        if (A.value(a, M) >= A.goal(a)) { v.ach[a.id] = 1; any = true; A.recent.push(a.id); A.notify(a, W); if (G.SaveUI) G.SaveUI.bump(); }
      }
    if (any) G.Team.save();
  };
  A.notify = (a, W) => {
    G.Audio.play('level');
    if (W && !W.attract && G.UI.screen === 'battle') W.say({ s: '成就達成：' + a.n, ic: 'i_trophy', col: 13, t: 2.8 });
    else if (G.Ach.queueBanner) G.Ach.queueBanner({ a, t: 0 }); else A.banner = { a, t: 0 };
  };
  A.claim = id => {
    const v = G.Team.get(); if (v.ach[id] !== 1) return 0;
    const k = G.ACH_TIER[G.ACH_BY[id].t].k; v.ach[id] = 2; G.Team.addKeys(k); G.Team.save(); return k;
  };
  // 其他畫面的事件：開寶箱、看教學、看圖鑑、技能展示、產生存檔碼
  A.on = (ev, x) => {
    if (A.off()) return;
    const P = A.P();
    if (ev === 'chest') { P.chests++; if (x && x.keys === 5) P.gamble5++; }
    else if (ev === 'guide' || ev === 'book' || ev === 'demo') { if (P[ev].includes(x)) return; P[ev].push(x); }
    else if (ev === 'map') P.maps++;
    else if (ev === 'code') { P.codes++; const v = G.Team.get(); v.bk = { n: 0, t: Date.now() }; }
    G.Team.save(); A.check(null, null);
  };
  // ----- 戰鬥中 -----
  A.begin = W => { W._cm = {}; for (const k of ADD) W._cm[k] = 0; W._achT = 0; A.recent = []; };
  A.commit = W => {
    if (A.off() || !W || W.attract || !W._cm) return;
    const P = A.P(), st = W.stats;
    for (const k of ADD) { const d = (st[k] || 0) - W._cm[k]; if (d) { P[k] += d; W._cm[k] = st[k] || 0; } }
    const live = { streak: st.streak, towers: st.towers, gold: st.gold, assists: st.assists, level: W.hero ? W.hero.level : 0, wboss: st.wboss, follow: st.maxFollow, potions: st.potions, bag: W.bag.length, camps: st.camps, spent: st.spent || 0,
      allmax: W.hero && [...W.hero.skills, ...W.hero.pskills].every(q => q.lv >= G.SKILL_MAX) ? 1 : 0 };
    for (const k of BEST) P.best[k] = Math.max(P.best[k], live[k] || 0);
    G.Team.save();
  };
  A.tick = (W, dt) => {
    if (A.off() || W.attract || !W.hero || W._fin) return;
    const ho = W.holy[0]; if (ho && ho.st) W.stats.minHoly = Math.min(W.stats.minHoly, Math.max(0, ho.hp / ho.st.hp));
    W._achT += dt; if (W._achT < 2) return; W._achT = 0;
    A.commit(W); A.check(null, W);
  };
  A.final = W => {
    if (W._fin || W.attract) return; W._fin = true;
    if (G.SoloW) G.SoloW.finish(W, !!W.over.win);        // v3.0 關卡星等、獎勵（開發者模式也算星，但不給獎勵）
    if (A.off()) return;
    A.commit(W);
    const P = A.P(), win = !!W.over.win; P.games++; if (win) P.wins++;
    const hr = new Date().getHours(); if (hr < 5) P.night++; if (hr >= 5 && hr < 8) P.morning++;
    G.Team.save();
    A.check({ win, st: W.stats, pts: W.loadPts, stage: W.stageI || 0 }, W);
    if (G.Rank) G.Rank.submit();                     // v2.8 戰鬥結束上傳排行
  };
  return A;
})();

// ---------- 成就畫面 ----------
G.AchUI = (() => {
  const S = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, U = () => G.UI, ui = () => G.Menus.ui;
  let tab = 0, fly = [];
  S.reset = () => { fly = []; };
  S.esc = () => false;
  // 獎章：底色＝等級色，未達成＝暗灰
  function medal(c, x, y, a, st) {
    const col = st ? G.ACH_TIER[a.t].c : 3;
    c.fillStyle = P[0]; c.fillRect(x + 2, y, 16, 20); c.fillRect(x, y + 2, 20, 16);
    c.fillStyle = P[col]; c.fillRect(x + 3, y + 1, 14, 18); c.fillRect(x + 1, y + 3, 18, 14);
    c.fillStyle = P[st ? 1 : 2]; c.fillRect(x + 3, y + 3, 14, 14);
    H().icon(c, 'i_trophy', x + 10, y + 10, !st);
  }
  const keyCounter = (c) => {
    const I = R.ins, Rr = R.uw - I.r, kt = G.Team.dev ? '∞' : String(G.Team.keys()), kw = 22 + G.cnW(kt);
    H().box(c, Rr - kw, I.t, kw, 14, 0, 13); H().icon(c, 'i_key', Rr - kw + 9, I.t + 7); G.cn(c, kt, Rr - 4, I.t + 1, 13, 1);
    return [Rr - kw + 9, I.t + 7];
  };
  function claim(id, fx, fy) {
    const k = G.Ach.claim(id); if (!k) return;
    G.Audio.play('coin');
    for (let i = 0; i < Math.min(k, 6); i++) fly.push({ x: fx, y: fy, t: -i * 0.08, s: Math.random() * 6 });
  }
  S.draw = c => {
    const M = ui(); M.tick(); M.bg(c);
    const y0 = M.header(c, '成就'), I = R.ins, L = I.l, Rr = R.uw - I.r, B = R.uh - I.b, dt = G.Menus.dt || 1 / 60, gt = M.gt();
    const [kx, ky] = keyCounter(c);
    if (G.Team.dev) G.cn(c, '開發者模式不記錄成就', L + 24 + G.cnW('成就') + 8, I.t + 1, 13);
    const W = Math.min(Rr - L, 420), x = Math.round((L + Rr) / 2 - W / 2);
    // 總進度
    const done = G.Ach.doneCount(), N = G.ACH.length, unc = G.Ach.unclaimed();
    let y = y0;
    G.cn(c, '完成 ' + done + '/' + N, x, y, 9);
    const cbw = unc ? 62 : 0, bx0 = x + G.cnW('完成 ' + N + '/' + N) + 8, bw0 = W - (bx0 - x) - (cbw ? cbw + 6 : 0);
    H().bar(c, bx0, y + 5, bw0, 3, done / N, 'xp');
    if (unc) M.btnPrimary(c, 'achAll', x + W - cbw, y - 1, cbw, 15, '全部領取', () => { G.ACH.filter(a => G.Ach.state(a.id) === 1).forEach((a, i) => claim(a.id, x + W - cbw / 2, y + 7)); });
    y += 18;
    // 分類頁籤（有可領取的分類：右上紅點）
    const ty = y; y = M.tabs(c, x, y, W, G.ACH_CATS, tab, i => { tab = i; G.Audio.play('tick'); });
    const tw = Math.floor(W / 4);
    G.ACH_CATS.forEach((n, i) => { if (G.ACH.some(a => a.c === i && G.Ach.state(a.id) === 1)) { c.fillStyle = P[0]; c.fillRect(x + (i + 1) * tw - 7, ty + 1, 5, 5); c.fillStyle = P[10]; c.fillRect(x + (i + 1) * tw - 6, ty + 2, 3, 3); } });
    // 清單：可領取 → 未完成 → 已領取
    const list = G.ACH.filter(a => a.c === tab).sort((a, b) => { const r = s => s === 1 ? 0 : s === 0 ? 1 : 2; return r(G.Ach.state(a.id)) - r(G.Ach.state(b.id)); });
    M.scrollDetail(c, x, y, W - 6, B - y - 2, 'ach' + tab, yy => {
      for (const a of list) {
        const st = G.Ach.state(a.id), hid = a.hint && !st, tx = x + 27, tw2 = W - 6 - 27 - 5, k = G.ACH_TIER[a.t].k;
        const g = G.Ach.goal(a), cur = Math.min(g, G.Ach.value(a, null)), showBar = g > 1 && st === 0;
        // 右上：獎勵（鑰匙 ×N）／領取鈕／已領取
        const RW = st === 1 ? 36 : st === 2 ? G.cnW('已領取') + 10 : 24, nmW = tw2 - RW - 4;
        const desc = hid ? a.hint : a.d, lines = G.cnWrap(desc, tw2), hh = Math.max(30, 3 + 15 + lines.length * 12 + (showBar ? 8 : 0) + 4);
        H().box(c, x, yy, W - 6, hh, st === 1 ? 2 : 1, st === 1 ? 13 : st === 2 ? 4 : 3, false);
        medal(c, x + 3, yy + Math.round((hh - 20) / 2), a, st);
        G.cn(c, G.cnWrap(hid ? '？？？' : a.n, nmW)[0], tx, yy + 3, st ? 9 : 7);
        lines.forEach((l, i) => G.cn(c, l, tx, yy + 18 + i * 12, hid ? 4 : 6));
        if (showBar) {
          const ct = cur + '/' + g, cw = G.textW(ct), by = yy + 18 + lines.length * 12 + 3;
          H().bar(c, tx, by, tw2 - cw - 4, 2, cur / g, 'w'); G.text(c, ct, tx + tw2, by - 1, 6, 1, null, 1);
        }
        const rx = x + W - 6 - 4 - RW;
        if (st === 1) M.btnPrimary(c, 'ac_' + a.id, rx, yy + 3, RW, 13, '領取', () => claim(a.id, rx + RW / 2, yy + 9));
        else if (st === 2) { H().icon(c, 'i_check', rx + 3, yy + 9); G.cn(c, '已領取', rx + RW, yy + 3, 11, 1); }
        if (st !== 2) { const kx2 = st === 1 ? rx - G.textW('X' + k) - 19 : rx; H().icon(c, 'i_key', kx2 + 6, yy + 9, st === 0); G.text(c, 'X' + k, kx2 + 13, yy + 7, st === 1 ? 13 : 5); }
        yy += hh + 3;
      }
      return yy;
    }, M.SM);
    // 飛向右上的鑰匙
    for (let i = fly.length - 1; i >= 0; i--) {
      const f = fly[i]; f.t += dt; if (f.t < 0) continue;
      const k = Math.min(1, f.t / 0.55), e = k * k * (3 - 2 * k), px = G.lerp(f.x, kx, e), py = G.lerp(f.y, ky, e) - Math.sin(k * Math.PI) * 22;
      H().icon(c, 'i_key', px, py);
      if (k >= 1) { fly.splice(i, 1); G.Audio.play('tick'); }
    }
  };
  return S;
})();
G.Menus.ach = c => G.AchUI.draw(c);

// ---------- 選單畫面上的成就通知（戰鬥中改用廣播） ----------
G.Ach.bq = [];
G.Ach.queueBanner = b => { if (G.Ach.banner) G.Ach.bq.push(b); else G.Ach.banner = b; };
G.Ach.drawBanner = c => {
  const b = G.Ach.banner; if (!b || G.UI.screen === 'battle' || G.UI.screen === 'intro' || G.UI.screen === 'tap') return;
  const dt = G.Menus.dt || 1 / 60; b.t += dt;
  const nL = b.rk ? G.cnWrap(b.rk.s, G.Render.uw - 32).length : 1;
  const T = b.rk ? 2.2 * nL : b.free ? 3.5 : 2.8, inK = Math.min(1, b.t / 0.25), outK = Math.max(0, (b.t - T) / 0.3); if (outK >= 1) { G.Ach.banner = G.Ach.bq.shift() || null; return; }
  // 整條橫跨畫面頂端（蓋住標題列，不和下面的文字交錯）
  // v2.7：底框一出現就整條蓋住標題列（不再從上方滑下，避免滑動途中和標題文字交錯），裡面的字淡入淡出
  // v2.8 排行通知（b.rk）：一行放不下就分段輪流顯示（底框維持一行高，不蓋到下面的字）
  const R = G.Render, P = G.PAL, rk = b.rk, s = rk ? rk.s : b.free ? '賭徒寶箱可以免費開了！' : '成就達成：' + b.a.n, col = rk ? rk.col : b.free ? 11 : 13, ic = rk ? 'i_rank' : b.free ? 'i_key' : 'i_trophy';
  const ls = G.cnWrap(s, R.uw - 32), h = R.ins.t + 17, y = 0, li = Math.min(ls.length - 1, Math.floor(b.t / (T / ls.length))), w = R.uw, x = 0;
  G.UI.h.box(c, -2, y - 2, R.uw + 4, h + 2, 1, col, false);
  const al = Math.min(inK, 1 - outK), dy = Math.round((1 - inK) * -4 + outK * -4);
  c.globalAlpha = al;
  { const l = ls[li], tw = G.cnW(l) + 16, tx = Math.round(R.uw / 2 - tw / 2); G.UI.h.icon(c, ic, tx + 5, y + R.ins.t + 8 + dy); G.cn(c, l, tx + 16, y + R.ins.t + 2 + dy, col); }
  c.globalAlpha = 1;
  G.UI.h.btn('achBn', x, y, w, h, null, () => { G.Ach.banner = G.Ach.bq.shift() || null; G.Menus.ui.go(rk ? 'rank' : b.free ? 'store' : 'ach'); });
};
