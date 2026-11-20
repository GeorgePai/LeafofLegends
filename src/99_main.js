'use strict';
/* =========================================================
   主迴圈：固定 60Hz 邏輯 + 插值繪製（高刷新率螢幕也順）
   ========================================================= */
G.newWorld = function (opt) {
  G.W = new G.World(opt);
  const R = G.Render;
  if (G.W.hero) { R.cam.x = G.W.hero.x; R.cam.y = G.W.hero.y; }
  else { R.cam.x = G.W.M.ww / 2; R.cam.y = G.W.M.wh / 2; }
  R.cam.follow = true;
};

G.boot = function () {
  const cv = document.getElementById('game');
  G.buildSprites(); G.buildBestiary();
  G.Render.init(cv);
  G.UI.bind(cv);
  addEventListener('resize', () => G.Render.resize());
  G.UI.goTitle(); G.UI.screen = 'tap'; G.Intro.reset(); G.Audio.init();   // 點一下開始（解鎖聲音）→ 開場動畫 → 標題
  const STEP = 1 / 60;
  let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    fpsT += dt; fpsN++; if (fpsT >= 0.5) { G.UI.fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
    const W = G.W, U = G.UI;
    if (!U.paused && !(G.Menus && G.Menus.covers(U.screen)) && !(G.StageGo && G.StageGo.hold())) {
      W.keyDir = U.screen === 'battle' ? U.keyDir() : null;
      if (W.keyDir) G.Render.cam.follow = true;
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) { W.update(STEP); acc -= STEP; n++; }
      if (n >= 6) acc = 0;
    }
    G.Render.updateCam(W, dt);
    if (!(G.Menus && G.Menus.covers(U.screen))) G.Render.draw(W, U.paused ? 1 : acc / STEP, now / 1000);
    // 背景音樂：依目前畫面選曲（開場動畫無音樂；多人、存檔、教學沿用首頁曲；從戰鬥暫停打開教學則維持戰場曲；結算時戰場曲降低音量）
    { const sc = U.screen, M = sc === 'intro' || sc === 'tap' ? null : sc === 'battle' ? 'battle' : (sc === 'team' || sc === 'book') ? 'team' : sc === 'store' ? 'shop' : sc === 'ach' || sc === 'rank' ? 'ach' : sc === 'guide' && U.guideBack ? 'battle' : 'menu';
      G.Audio.music(M, sc === 'battle' && W.over ? 0.45 : 1); G.Audio.musicUpdate(dt); }
    if (G.FreeChest && U.screen !== 'intro' && U.screen !== 'tap') G.FreeChest.tick();
    if (G.Rank) G.Rank.tick();
    if (G.Update) G.Update.tick();
    U.draw(dt);
    G.Render.blitUI();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};
window.addEventListener('load', async () => {
  // 載入中文像素字（俐方體11號，已依使用到的字做子集化）
  try { if (G.FONT_DATA) { const ff = new FontFace('Cubic11', 'url(data:font/woff2;base64,' + G.FONT_DATA + ')'); await ff.load(); document.fonts.add(ff); } } catch (e) { console.warn('font', e); }
  try { G.boot(); }
  catch (e) { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#fff;position:fixed;top:0;left:0;padding:12px;white-space:pre-wrap">' + e.stack + '</pre>'); throw e; }
});
