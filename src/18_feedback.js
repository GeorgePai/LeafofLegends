// ============================================================
// v2.8.6 反饋信箱（首頁「反饋」）
// 玩家：有存檔名稱（已上榜）就能寫信給開發者（1～300 字），看到自己寫過的信和開發者的回覆；有新回覆時首頁「反饋」出現紅點
// 開發者（開發者模式）：同一個畫面變成「玩家信箱」，點一封信 → 下方寫回覆／刪除（刪除要按兩下）
// 伺服器：16_rank 的 K.fb*（/fb/send、/fb/mine、/admin/fb…），沒有新的伺服器或網址
// ============================================================
G.FbUI = (() => {
  const S = {}, P = G.PAL, R = G.Render, H = () => G.UI.h, ui = () => G.Menus.ui, K = () => G.Rank;
  let msg = null, sending = false, sel = null, askDel = 0, enterT = 0;
  const MAX = 300, RMAX = 500;
  const say = (s, col = 6) => { msg = { s, col, t: 0 }; };
  const when = t => { const d = new Date(t * 1000), z = n => String(n).padStart(2, '0'); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };
  const len = s => [...String(s || '').trim()].length;
  S.reset = () => {
    msg = null; sending = false; sel = null; askDel = 0; enterT = Date.now();
    const Kk = K(); if (G.Team.dev) Kk.fbAdmLoad(); else if (Kk.joined()) Kk.fbLoad(true);
    const e = G.Dom.get('fb', 'textarea'); e.value = '';
  };
  S._sel = id => { sel = id; };                                                       // 測試用
  S._say = (s, col) => say(s, col);                                                   // 測試用
  // 一封信的卡片（玩家：自己的信＋回覆；開發者：多一行名字）→ 回傳下一張卡片的 y
  function card(c, x, y, w, m, adm, on, draw, cT = -1e9, cB = 1e9) {
    const T = (s, xx, yy, col, al = 0) => { if (yy >= cT - 3 && yy + 12 <= cB + 3) G.cn(c, s, xx, yy, col, al); };   // 只畫清單可見範圍內的字
    const iw = w - 12, bl = G.cnWrap(m.body, iw), rl = m.reply ? G.cnWrap(m.reply, iw) : [];
    const hh = 4 + 13 + bl.length * 13 + (m.reply ? 5 + 13 + rl.length * 13 : 13) + 4;   // 沒回覆：最下面一行狀態
    if (!draw) return y + hh + 4;
    H().box(c, x, y, w, hh, on ? 2 : 1, on ? 13 : m.reply ? 3 : adm ? 10 : 4, false);
    const dt = when(m.t), nm = adm ? m.name : '';                               // 標題：名字（開發者才有）＋時間；放不下時名字用「…」
    if (adm) { const room = w - 12 - G.cnW('・' + dt); let s = nm; while (s.length > 1 && G.cnW(s) > room) s = s.slice(0, -1); if (s !== nm) s = s.slice(0, -1) + '…'; T(s, x + 6, y + 3, 9); T('・' + dt, x + 6 + G.cnW(s), y + 3, 5); }
    else T(dt, x + 6, y + 3, 5);
    let yy = y + 17;
    bl.forEach(l => { T(l, x + 6, yy, 9); yy += 13; });
    if (!m.reply) T(adm ? '● 未回覆' : '等待開發者回覆…', x + 6, yy, adm ? 10 : 4);
    if (m.reply) {
      c.fillStyle = P[3]; c.fillRect(x + 6, yy + 2, w - 12, 1); yy += 5;
      T('開發者回覆・' + when(m.rt), x + 6, yy, 13); yy += 13;
      rl.forEach(l => { T(l, x + 6, yy, 11); yy += 13; });
    }
    return y + hh + 4;
  }
  S.draw = c => {
    const M = ui(); M.tick(); M.bg(c);
    const Kk = K(), dev = G.Team.dev, y0 = M.header(c, dev ? '玩家信箱' : '反饋'), I = R.ins, L = I.l, Rr = R.uw - I.r, B = R.uh - I.b, LD = R.uw > R.uh * 1.15;
    const W = Math.min(Rr - L, LD ? 560 : 420), x = Math.round((L + Rr) / 2 - W / 2);
    if (msg) msg.t += G.Menus.dt || 1 / 60;
    if (!Kk.on()) { G.cn(c, '伺服器準備中，敬請期待', x + W / 2, y0 + 20, 6, 0.5); return; }
    // ---- 玩家還沒上榜：先去存檔 ----
    if (!dev && !Kk.joined()) {
      const ls = G.cnWrap('先取個玩家名稱，就能寫信給開發者', W - 20); ls.forEach((l, i) => G.cn(c, l, x + W / 2, y0 + 16 + i * 13, 9, 0.5));
      M.btnPrimary(c, 'fbSave', Math.round(x + W / 2 - 40), y0 + 24 + ls.length * 13, 80, 18, '前往帳號', () => M.go('save'));
      return;
    }
    if (dev && !Kk.admKey()) { G.cnWrap('請重新開啟開發者模式（輸入密碼）才能讀信', W - 20).forEach((l, i) => G.cn(c, l, x + W / 2, y0 + 16 + i * 13, 10, 0.5)); return; }
    // 自動更新：玩家 60 秒、開發者 30 秒
    if (dev) { if (!Kk.fbA.busy && Date.now() - (Kk.fbA.t || 0) > 30000) { Kk.fbA.t = Date.now(); Kk.fbAdmLoad(); } }
    else if (!Kk.fb.busy && Date.now() - Kk.fb.t > 60000) Kk.fbLoad(true);
    const A = dev ? Kk.fbA : Kk.fb, list = A.list || [];
    if (dev && sel != null && !list.some(m => m.id === sel)) sel = null;
    const cur = dev ? list.find(m => m.id === sel) : null;
    // ---- 版面：直屏上下（清單在上、寫信在下）；橫屏左右（清單在左、寫信在右）----
    const showBox = !dev || cur, cw = LD ? Math.round(W * 0.42) : W, lw = LD && showBox ? W - cw - 8 : W;
    const th = LD ? Math.max(40, B - y0 - 56) : 44, compH = 14 + th + 5 + 20 + 26;                   // 標題列＋輸入框＋按鈕列＋訊息兩行
    const lx = x, ly = y0, lh = LD || !showBox ? B - ly : B - ly - compH - 10;
    const cx = LD ? x + W - cw : x, cy = LD ? y0 : B - compH;
    // 標題列右邊：未回覆數（開發者）
    if (dev) { const n = list.filter(m => !m.reply).length; G.cn(c, A.busy && !A.list ? '讀取中' : '未回覆 ' + n, Rr, I.t + 1, n ? 10 : 6, 1); }
    // ---- 清單 ----
    if (!A.list) G.cn(c, A.err || '讀取中…', lx + lw / 2, ly + 16, A.err ? 10 : 6, 0.5);
    else if (!list.length) G.cnWrap(dev ? '還沒有玩家來信' : '還沒有寫過信。有任何建議、發現 bug 或想說的話，都歡迎寫給開發者！', lw - 16).forEach((l, i) => G.cn(c, l, lx + lw / 2, ly + 16 + i * 13, 6, 0.5));
    else M.scrollDetail(c, lx, ly, lw - 6, lh, dev ? 'fbA' : 'fbP', yy => {
      list.forEach(m => {
        const ny = card(c, lx, yy, lw - 6, m, dev, dev && m.id === sel, false);
        if (ny > ly && yy < ly + lh) { card(c, lx, yy, lw - 6, m, dev, dev && m.id === sel, true, ly, ly + lh); if (dev) M.tap('fbm' + m.id, lx, yy, lw - 6, ny - yy - 4, () => { sel = m.id; askDel = 0; const e = G.Dom.get('fb', 'textarea'); e.value = m.reply || ''; G.Audio.play('tick'); }); }
        yy = ny;
      });
      return yy;
    }, M.SM);
    // ---- 寫信／回覆 ----
    if (!showBox) { if (LD) G.cnWrap('點左邊一封信來回覆', cw - 10).forEach((l, i) => G.cn(c, l, cx + cw / 2, y0 + 30 + i * 13, 5, 0.5)); else; return; }
    if (!LD) { c.fillStyle = P[3]; c.fillRect(cx, cy - 3, W, 1); }
    const lim = dev ? RMAX : MAX, e = G.Dom.place('fb', 'textarea', cx + 1, cy + 15, cw - 8, th, { ph: dev ? '寫給這位玩家的回覆…' : '寫給開發者：建議、bug、心得都可以', max: lim });
    const n = len(e.value), cnt = n + '/' + lim, room = cw - 6 - G.cnW(cnt) - 10;
    let ttl = dev ? '回覆 ' + cur.name : '寫給開發者'; while ([...ttl].length > 3 && G.cnW(ttl) > room) ttl = [...ttl].slice(0, -2).join('') + '…';   // 名字太長用「…」
    G.cn(c, ttl, cx, cy, 9); G.cn(c, cnt, cx + cw - 6, cy, n > lim ? 10 : 5, 1);
    H().box(c, cx, cy + 14, cw - 6, th + 2, 0, 13, false);
    const by = cy + 15 + th + 5, bw = 64, hw = cw - 6 - bw * (dev ? 2 : 1) - 12;
    if (msg && msg.t < 4) G.cnWrap(msg.s, cw - 6).slice(0, 2).forEach((l, i) => G.cn(c, l, cx, by + 20 + i * 13, msg.col));   // 訊息放在按鈕下面（整行寬）
    if (!dev) G.cnWrap('回覆後會通知你', hw).slice(0, 1).forEach(l => G.cn(c, l, cx, by + 2, 4));
    if (dev) {
      const ask = askDel && Date.now() - askDel < 3000;
      M.btnSecondary(c, 'fbDel', cx + cw - 6 - bw * 2 - 6, by, bw, 16, ask ? '確定刪除' : '刪除', async () => { if (!ask) { askDel = Date.now(); G.Audio.play('tick'); return; } askDel = 0; const j = await Kk.fbAdmAct('fbdel', cur.id); if (j.ok) { sel = null; say('已刪除', 6); G.Audio.play('deny'); } else say('刪除失敗', 10); });
    }
    M.btnPrimary(c, 'fbSend', cx + cw - 6 - bw, by, bw, 16, sending ? '送出中' : dev ? '回覆' : '送出', async () => {
      if (sending) return; const body = e.value.trim(), k = len(body);
      if (!k) { say(dev ? '請先寫回覆內容' : '請先寫點內容', 10); G.UI.h.deny('fbSend'); return; }
      if (k > lim) { say('最多 ' + lim + ' 字', 10); G.UI.h.deny('fbSend'); return; }
      sending = true; say('送出中…', 13);
      const j = dev ? await Kk.fbAdmAct('fbreply', cur.id, body) : await Kk.fbSend(body); sending = false;
      if (j.ok) { if (!dev) e.value = ''; say(dev ? '已回覆' : '已送出！開發者回覆後會通知你', 11); G.Audio.play('coin'); return; }
      G.Audio.play('deny');
      say(j.err === 'wait' ? '太快了，請 ' + (j.s || 60) + ' 秒後再送' : j.err === 'many' ? '還有 5 封等待回覆，請等開發者回覆後再寫' : j.err === 'len' ? '內容太長或是空的' : j.err === 'busy' ? '今天送太多封了，明天再試' : j.err === 'nouser' ? '請先取玩家名稱' : j.err === 'quota' ? '今天的額度用完了' : '連不上伺服器，請稍後再試', 10);
    });
  };
  return S;
})();
G.Menus.fb = c => G.FbUI.draw(c);
