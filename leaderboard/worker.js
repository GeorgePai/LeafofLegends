// Leaf of Legends 線上排行榜（Cloudflare Worker＋D1）
// GET  /board              → 9 個分類前 20 名＋最近的「登上第 1 名」消息（10 秒快取；v2.8.3 排行畫面每 10 秒刷新）
// POST /submit {id,tok,name,s} → 更新自己的數據，回傳自己在各分類的名次
// POST /leave  {id,tok}    → 退出排行（刪除自己的資料）
// 管理（需要 ADMIN_KEY）：GET /admin/list?key=…、POST /admin/hide {key,id,h}（隱藏／復原）、POST /admin/del {key,id}（永久刪除）
// v2.8.1：players.hidden＝1 的玩家不出現在排行（可復原）
// v2.8.4：POST /admin/purge {key, days} 清除 days 天沒上線的帳號（至少 7 天）
// v2.8.7：一帳號同時一台裝置。players.sess＝目前登入那台的工作階段；POST /claim {id,tok,ss} 換成這台，其他台下次連線收到 err:'moved'（/ping 帶 id+ss 時回 moved:1）
// v3.2 系統公告：GET /ann → 有效中的公告（記憶體快取 30 秒）；/ping 回傳 a＝最新公告 id，用戶端發現比自己知道的新才來拿
//      管理：POST /admin/ann {key,title,body,keys,days,live}、/admin/anndel {key,id}
// v3.2 玩家動態：/ping 多帶 st（目前畫面／戰鬥狀態，短字串）、v（版本）、m（1＝手機）；同一台 50 秒內只寫一次，狀態變了最快 10 秒寫一次
//      /admin/list 每位玩家附上最近一次的 pres（t、st、v、m、t0＝這次上線開始時間）
// v2.8.2：管理權限＝遊戲的開發者密碼（key 傳 8 位數密碼，和遊戲用同一個雜湊檢查）；猜錯會被擋：同一個 IP 每小時 5 次、全部合計每小時 30 次
const CATS = ['heroes', 'minions', 'games', 'wr', 'kda', 'keys', 'dmg', 'time', 'ach'];
const QUAL = { wr: 'games >= 10', kda: 'games >= 10' };          // 勝率、KDA 至少 10 場才上榜
const FIELDS = ['heroes', 'minions', 'games', 'wins', 'kills', 'deaths', 'assists', 'keys', 'dmg', 'time', 'ach'];
const MAX = { heroes: 40, minions: 80, ach: 200, games: 1e6, wins: 1e6, kills: 1e8, deaths: 1e8, assists: 1e8, keys: 1e7, dmg: 1e12, time: 1e9 };
const TOP = 20, CACHE_MS = 10000, GAP_S = 30, NEW_PER_IP_H = 3, DMG_PS = 1000;
const BAD = ['幹你', '操你', '靠北', '靠杯', '雞掰', '機掰', '去死', '智障', '白痴', '白癡', '屌', 'fuck', 'shit', 'bitch', 'cnm', 'nmsl', 'admin', '管理員', '官方'];
let cache = null, cacheT = 0;
const DEV_H = 3224873579, devHash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function cleanName(n) {
  n = String(n || '').replace(/[\u0000-\u001f\u007f<>&"']/g, '').trim(); const a = [...n];
  if (!a.length || a.length > 8) return null;
  const low = n.toLowerCase().replace(/\s/g, ''); if (BAD.some(w => low.includes(w))) return null;
  return n;
}
const isInt = (v, max) => Number.isFinite(v) && v >= 0 && v <= max && Math.floor(v) === v;
const isQuota = e => /limit|exceed|quota/i.test(String((e && e.message) || e));

async function board(env) {
  if (cache && Date.now() - cacheT < CACHE_MS) return cache;
  const qs = CATS.map(k => env.DB.prepare(`SELECT id, name, ${k} AS v FROM players WHERE hidden = 0 AND ${QUAL[k] || k + ' > 0'} ORDER BY ${k} DESC, created ASC LIMIT ${TOP}`));
  qs.push(env.DB.prepare('SELECT id, t, pid, name, cat FROM news ORDER BY id DESC LIMIT 20'));
  qs.push(env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE hidden = 0'));
  const rs = await env.DB.batch(qs), cats = {};
  CATS.forEach((k, i) => { cats[k] = rs[i].results.map(r => [r.id, r.name, r.v]); });
  cache = { t: Date.now(), cats, news: rs[CATS.length].results, n: rs[CATS.length + 1].results[0].n }; cacheT = Date.now();
  return cache;
}
async function ranks(env, p) {
  const qs = CATS.map(k => (p.hidden || (QUAL[k] ? p.games < 10 : !(p[k] > 0))) ? null
    : env.DB.prepare(`SELECT COUNT(*) AS n FROM players WHERE hidden = 0 AND ${QUAL[k] ? QUAL[k] + ' AND ' : ''}(${k} > ?1 OR (${k} = ?1 AND created < ?2))`).bind(p[k], p.created));
  const live = qs.filter(Boolean), rs = live.length ? await env.DB.batch(live) : [], out = {}; let j = 0;
  CATS.forEach((k, i) => { out[k] = qs[i] ? rs[j++].results[0].n + 1 : 0; });
  return out;
}
const okSS = ss => /^[0-9a-f]{16}$/.test(ss);
async function auth(env, id, tok, ss) {
  if (!/^[0-9a-f]{16}$/.test(id) || !/^[0-9a-f]{32}$/.test(tok)) return [null, J({ err: 'bad' }, 400)];
  const old = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (old && old.tok !== await sha(tok + id)) return [null, J({ err: 'auth' }, 403)];
  if (old && old.sess && okSS(ss) && ss !== old.sess) return [null, J({ err: 'moved' }, 409)];   // v2.8.7 另一台登入了（沒帶 ss 的舊版不擋）
  return [old, null];
}
// v2.8.7 這台登入：把帳號的工作階段換成這台（讀存檔碼、第一次更新到新版時）
async function claim(req, env) {
  let b; try { b = await req.json(); } catch (e) { return J({ err: 'bad' }, 400); }
  const id = String(b.id || ''), ss = String(b.ss || ''); if (!okSS(ss)) return J({ err: 'bad' }, 400);
  const [old, bad] = await auth(env, id, String(b.tok || '')); if (bad) return bad;
  if (old) await env.DB.prepare('UPDATE players SET sess = ? WHERE id = ?').bind(ss, id).run();
  return J({ ok: 1 });
}
async function submit(req, env) {
  let b; try { b = await req.json(); } catch (e) { return J({ err: 'bad' }, 400); }
  const id = String(b.id || ''), tok = String(b.tok || ''), name = cleanName(b.name);
  if (!name) return J({ err: 'name' }, 422);
  const s = b.s || {}, v = {}, now = Math.floor(Date.now() / 1000);
  for (const f of FIELDS) { const x = Number(s[f]); if (!isInt(x, MAX[f])) return J({ err: 'value', f }, 422); v[f] = x; }
  if (v.wins > v.games) return J({ err: 'value', f: 'wins' }, 422);
  if (v.dmg > (v.time + 60) * DMG_PS) return J({ err: 'value', f: 'dmg' }, 422);
  const [old, bad] = await auth(env, id, tok, String(b.ss || '')); if (bad) return bad;
  const ih = (await sha((req.headers.get('cf-connecting-ip') || '') + '|lol')).slice(0, 16);
  if (old) {
    if (now - old.updated < GAP_S) return J({ err: 'wait', wait: GAP_S - (now - old.updated) }, 429);
    if (v.time > old.time && v.time - old.time > now - old.updated + 120) return J({ err: 'value', f: 'time' }, 422);   // 不可能比真實經過的時間玩得更久
    for (const f of FIELDS) v[f] = Math.max(v[f], old[f]);                                                             // 累積數值只增不減
  } else {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE ip = ? AND created > ?').bind(ih, now - 3600).first();
    if (c.n >= NEW_PER_IP_H) return J({ err: 'busy' }, 429);
  }
  const p = { ...v, wr: v.games ? Math.round(v.wins / v.games * 1000) / 10 : 0, kda: Math.round((v.kills + v.assists) / Math.max(1, v.deaths) * 100) / 100, created: old ? old.created : now, hidden: old ? old.hidden : 0 };
  const before = await board(env);
  await env.DB.prepare(`INSERT INTO players (id, tok, name, ip, ${FIELDS.join(', ')}, wr, kda, created, updated, sess) VALUES (?1, ?2, ?3, ?4, ${FIELDS.map((_, i) => '?' + (i + 5)).join(', ')}, ?16, ?17, ?18, ?19, ?20)
    ON CONFLICT(id) DO UPDATE SET sess = COALESCE(players.sess, excluded.sess), name = excluded.name, ${FIELDS.map(f => f + ' = excluded.' + f).join(', ')}, wr = excluded.wr, kda = excluded.kda, updated = excluded.updated`)
    .bind(id, await sha(tok + id), name, ih, ...FIELDS.map(f => p[f]), p.wr, p.kda, p.created, now, okSS(b.ss) ? b.ss : null).run();
  const rk = await ranks(env, p), news = CATS.filter(k => rk[k] === 1 && !(before.cats[k][0] && before.cats[k][0][0] === id));
  if (news.length) {
    await env.DB.batch(news.map(k => env.DB.prepare('INSERT INTO news (t, pid, name, cat) VALUES (?, ?, ?, ?)').bind(now, id, name, k))
      .concat([env.DB.prepare('DELETE FROM news WHERE id < (SELECT MAX(id) - 50 FROM news)')]));
  }
  if (news.length || !old) cache = null;
  return J({ ok: 1, ranks: rk, n: before.n + (old ? 0 : 1) });
}
async function leave(req, env) {
  let b; try { b = await req.json(); } catch (e) { return J({ err: 'bad' }, 400); }
  const [old, bad] = await auth(env, String(b.id || ''), String(b.tok || ''), String(b.ss || '')); if (bad) return bad;
  if (old) { await env.DB.batch([env.DB.prepare('DELETE FROM players WHERE id = ?').bind(old.id), env.DB.prepare('DELETE FROM fb WHERE pid = ?').bind(old.id)]); cache = null; }
  return J({ ok: 1 });
}
// ---- v2.8.6 即時在線人數：POST /ping {sid} → {n}；同一台 50 秒內只寫一次（記憶體擋），人數快取 15 秒 ----
const seenW = new Map(); let onN = 0, onT = 0, annMax = 0, annT = 0, annList = null, annLT = 0;
const cleanSt = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 160);
async function ping(req, env) {
  let b; try { b = await req.json(); } catch (e) { return J({ err: 'bad' }, 400); }
  const sid = String(b.sid || ''); if (!/^[0-9a-f]{16}$/.test(sid)) return J({ err: 'bad' }, 400);
  const now = Math.floor(Date.now() / 1000), st = cleanSt(b.st), ver = cleanSt(b.v).slice(0, 12), mob = b.m ? 1 : 0;
  const pid = /^[0-9a-f]{16}$/.test(String(b.id || '')) ? String(b.id) : null, last = seenW.get(sid);
  if (!last || now - last.t >= 50 || (st !== last.st && now - last.t >= 10)) {
    if (seenW.size > 5000) seenW.clear(); seenW.set(sid, { t: now, st });
    const qs = [env.DB.prepare('INSERT INTO pres (sid, t, pid, st, v, m, t0) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sid) DO UPDATE SET t = excluded.t, pid = COALESCE(excluded.pid, pres.pid), st = excluded.st, v = excluded.v, m = excluded.m, t0 = CASE WHEN pres.t < excluded.t - 180 OR pres.t0 IS NULL THEN excluded.t ELSE pres.t0 END').bind(sid, now, pid, st, ver, mob, now)];
    if (Math.random() < 0.02) qs.push(env.DB.prepare('DELETE FROM pres WHERE t < ?').bind(now - 86400 * 3));   // 保留 3 天（管理玩家看「最後在做什麼」）
    await env.DB.batch(qs);
  }
  if (Date.now() - onT > 15000) { const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM pres WHERE t > ?').bind(now - 120).first(); onN = r.n; onT = Date.now(); }
  if (Date.now() - annT > 10000) { const r = await env.DB.prepare('SELECT MAX(id) AS a FROM ann WHERE exp > ?').bind(now).first(); annMax = (r && r.a) || 0; annT = Date.now(); }
  let moved = 0;                                                                     // v2.8.7 帶了帳號：順便看是不是被別台登入了（1 列讀取）
  if (pid && okSS(String(b.ss || ''))) { const r = await env.DB.prepare('SELECT sess FROM players WHERE id = ?').bind(pid).first(); moved = r && r.sess && r.sess !== b.ss ? 1 : 0; }
  return J({ ok: 1, n: Math.max(1, onN), moved, a: annMax });
}
// ---- v3.2 系統公告 ----
async function annGet(env, want = 0) {
  // v3.2.4 用戶端帶 a＝它從 /ping 知道的最新公告 id；快取裡沒有那麼新的就重新查（避免別台節點的舊快取讓新公告晚 1～2 分鐘才播）
  if (annList && Date.now() - annLT < 30000 && !(want > annList.list.reduce((a, m) => Math.max(a, m.id), 0))) return annList;
  const now = Math.floor(Date.now() / 1000), r = await env.DB.prepare('SELECT id, t, title, body, keys, live, exp FROM ann WHERE exp > ? ORDER BY id DESC LIMIT 30').bind(now).all();
  annList = { ok: 1, list: r.results }; annLT = Date.now(); return annList;
}
// ---- v2.8.6 反饋信箱：玩家寫信給開發者、開發者回信 ----
// 玩家：POST /fb/send {id,tok,body}（1～300 字；同一人 60 秒 1 封、未回覆最多 5 封；同 IP 每天 30 封）
//       POST /fb/mine {id,tok,seen}（自己最近 20 封＋回覆；seen=1 把回覆標成已讀）
// 開發者：POST /admin/fb {key}（最近 200 封）、/admin/fbreply {key,mid,reply}、/admin/fbdel {key,mid}
const cleanBody = (s, max) => { const t = String(s || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim(); const a = [...t]; return a.length && a.length <= max ? t : null; };
async function fb(req, env, url) {
  let b; try { b = await req.json(); } catch (e) { return J({ err: 'bad' }, 400); }
  const [old, bad] = await auth(env, String(b.id || ''), String(b.tok || ''), String(b.ss || '')); if (bad) return bad;
  if (!old) return J({ err: 'nouser' }, 403);                                         // 要先上榜（有存檔名稱）才能寫信
  const now = Math.floor(Date.now() / 1000);
  if (url.pathname === '/fb/send') {
    const body = cleanBody(b.body, 300); if (!body) return J({ err: 'len' }, 422);
    const ih = (await sha((req.headers.get('cf-connecting-ip') || '') + '|lol')).slice(0, 16);
    const rs = await env.DB.batch([
      env.DB.prepare('SELECT MAX(t) AS t, SUM(CASE WHEN reply IS NULL THEN 1 ELSE 0 END) AS open FROM fb WHERE pid = ?').bind(old.id),
      env.DB.prepare('SELECT COUNT(*) AS n FROM fb WHERE ip = ? AND t > ?').bind(ih, now - 86400)]);
    const me = rs[0].results[0] || {};
    if (me.t && now - me.t < 60) return J({ err: 'wait', s: 60 - (now - me.t) }, 429);
    if ((me.open || 0) >= 5) return J({ err: 'many' }, 429);
    if (rs[1].results[0].n >= 30) return J({ err: 'busy' }, 429);
    await env.DB.prepare('INSERT INTO fb (pid, name, ip, body, t) VALUES (?, ?, ?, ?, ?)').bind(old.id, old.name, ih, body, now).run();
    return J({ ok: 1 });
  }
  if (url.pathname === '/fb/mine') {
    if (b.seen) await env.DB.prepare('UPDATE fb SET seen = 1 WHERE pid = ? AND reply IS NOT NULL AND seen = 0').bind(old.id).run();
    const r = await env.DB.prepare('SELECT id, body, t, reply, rt, seen FROM fb WHERE pid = ? ORDER BY id DESC LIMIT 20').bind(old.id).all();
    return J({ ok: 1, list: r.results });
  }
  return J({ err: 'nf' }, 404);
}
async function admin(req, env, url) {
  const isPost = req.method === 'POST', b = isPost ? await req.json().catch(() => ({})) : {}, key = isPost ? b.key : url.searchParams.get('key');
  const ih = (await sha((req.headers.get('cf-connecting-ip') || '') + '|lol')).slice(0, 16), hr = Math.floor(Date.now() / 1000) - 3600;
  const f = await env.DB.batch([env.DB.prepare('SELECT COUNT(*) AS n FROM fails WHERE ip = ? AND t > ?').bind(ih, hr), env.DB.prepare('SELECT COUNT(*) AS n FROM fails WHERE t > ?').bind(hr)]);
  if (f[0].results[0].n >= 5 || f[1].results[0].n >= 30) return J({ err: 'locked' }, 429);
  const k = String(key || ''), ok = (env.ADMIN_KEY && k === env.ADMIN_KEY) || (/^[0-9]{8}$/.test(k) && devHash(k) === DEV_H);
  if (!ok) { await env.DB.batch([env.DB.prepare('INSERT INTO fails (ip, t) VALUES (?, ?)').bind(ih, hr + 3600), env.DB.prepare('DELETE FROM fails WHERE t < ?').bind(hr)]); return J({ err: 'auth' }, 403); }
  if (url.pathname === '/admin/list') {
    const [r, q] = await env.DB.batch([env.DB.prepare('SELECT id, name, hidden, heroes, minions, games, wins, kills, deaths, assists, keys, dmg, time, ach, wr, kda, created, updated FROM players ORDER BY updated DESC LIMIT 500'),
      env.DB.prepare('SELECT pid, MAX(t) AS t, st, v, m, t0 FROM pres WHERE pid IS NOT NULL GROUP BY pid')]);   // v3.2 每位玩家最近一次的動態
    const pm = new Map(q.results.map(x => [x.pid, x])); return J(r.results.map(p => { const x = pm.get(p.id); return x ? Object.assign(p, { pt: x.t, st: x.st, v: x.v, m: x.m, t0: x.t0 }) : p; }));
  }
  if (url.pathname === '/admin/ann' && isPost) {                                       // v3.2 發布系統公告
    const title = cleanBody(b.title, 20), body = cleanBody(b.body, 300); if (!title || !body) return J({ err: 'len' }, 422);
    const now = Math.floor(Date.now() / 1000), days = Math.min(30, Math.max(1, Math.floor(Number(b.days) || 7))), keys = Math.min(50, Math.max(0, Math.floor(Number(b.keys) || 0)));
    const r = await env.DB.prepare('INSERT INTO ann (t, title, body, keys, live, exp) VALUES (?, ?, ?, ?, ?, ?)').bind(now, title, body, keys, b.live ? 1 : 0, now + days * 86400).run();
    annList = null; annT = 0; return J({ ok: 1, id: r.meta.last_row_id });
  }
  if (url.pathname === '/admin/anndel' && isPost) { const r = await env.DB.prepare('DELETE FROM ann WHERE id = ?').bind(Number(b.id) || 0).run(); annList = null; annT = 0; return J({ ok: 1, changed: r.meta.changes }); }
  if (url.pathname === '/admin/purge' && isPost) {                                    // v2.8.4 清除 N 天（至少 7 天）沒上線的幽靈帳號
    const days = Math.max(7, Math.floor(Number(b.days) || 30)), cut = Math.floor(Date.now() / 1000) - days * 86400;
    await env.DB.prepare('DELETE FROM news WHERE pid IN (SELECT id FROM players WHERE updated < ?)').bind(cut).run();
    const r = await env.DB.prepare('DELETE FROM players WHERE updated < ?').bind(cut).run(); cache = null; return J({ ok: 1, deleted: r.meta.changes });
  }
  if (url.pathname === '/admin/fb' && isPost) { const r = await env.DB.prepare('SELECT id, pid, name, body, t, reply, rt, seen FROM fb ORDER BY id DESC LIMIT 200').all(); return J({ ok: 1, list: r.results }); }
  if (url.pathname === '/admin/fbreply' && isPost) { const rp = cleanBody(b.reply, 500); if (!rp) return J({ err: 'len' }, 422); const r = await env.DB.prepare('UPDATE fb SET reply = ?, rt = ?, seen = 0 WHERE id = ?').bind(rp, Math.floor(Date.now() / 1000), Number(b.mid) || 0).run(); return J({ ok: 1, changed: r.meta.changes }); }
  if (url.pathname === '/admin/fbdel' && isPost) { const r = await env.DB.prepare('DELETE FROM fb WHERE id = ?').bind(Number(b.mid) || 0).run(); return J({ ok: 1, changed: r.meta.changes }); }
  if (url.pathname === '/admin/hide' && isPost) { const r = await env.DB.prepare('UPDATE players SET hidden = ? WHERE id = ?').bind(b.h ? 1 : 0, String(b.id || '')).run(); cache = null; return J({ ok: 1, changed: r.meta.changes }); }
  if (url.pathname === '/admin/del' && isPost) { const r = await env.DB.prepare('DELETE FROM players WHERE id = ? OR name = ?').bind(String(b.id || ''), String(b.name || '\u0000')).run(); await env.DB.prepare('DELETE FROM news WHERE pid = ?').bind(String(b.id || '')).run(); cache = null; return J({ ok: 1, deleted: r.meta.changes }); }
  return J({ err: 'nf' }, 404);
}
// 資料表自動建立／升級（每個執行個體第一次收到請求時跑一次；部署不用另外執行 SQL）
let migrated = false;
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, tok TEXT NOT NULL, name TEXT NOT NULL, ip TEXT, heroes INTEGER DEFAULT 0, minions INTEGER DEFAULT 0, games INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, kills INTEGER DEFAULT 0, deaths INTEGER DEFAULT 0, assists INTEGER DEFAULT 0, keys INTEGER DEFAULT 0, dmg INTEGER DEFAULT 0, time INTEGER DEFAULT 0, ach INTEGER DEFAULT 0, wr REAL DEFAULT 0, kda REAL DEFAULT 0, created INTEGER, updated INTEGER, hidden INTEGER DEFAULT 0)`,
  ...['heroes', 'minions', 'games', 'wr', 'kda', 'keys', 'dmg', 'time', 'ach'].map(k => `CREATE INDEX IF NOT EXISTS i_${k} ON players (${k} DESC, created)`),
  'CREATE INDEX IF NOT EXISTS i_ip ON players (ip, created)',
  'CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, pid TEXT, name TEXT, cat TEXT)',
  'CREATE TABLE IF NOT EXISTS fails (ip TEXT, t INTEGER)',
  'CREATE TABLE IF NOT EXISTS fb (id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, name TEXT, ip TEXT, body TEXT, t INTEGER, reply TEXT, rt INTEGER, seen INTEGER DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS i_fb_pid ON fb (pid, id)',
  'CREATE INDEX IF NOT EXISTS i_fb_ip ON fb (ip, t)',
  'CREATE TABLE IF NOT EXISTS pres (sid TEXT PRIMARY KEY, t INTEGER)',
  'CREATE INDEX IF NOT EXISTS i_pres_t ON pres (t)',
  'CREATE TABLE IF NOT EXISTS ann (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, title TEXT, body TEXT, keys INTEGER DEFAULT 0, live INTEGER DEFAULT 1, exp INTEGER)'
];
const UPGRADES = ['ALTER TABLE players ADD COLUMN hidden INTEGER DEFAULT 0', 'ALTER TABLE players ADD COLUMN sess TEXT', 'ALTER TABLE pres ADD COLUMN pid TEXT', 'ALTER TABLE pres ADD COLUMN st TEXT', 'ALTER TABLE pres ADD COLUMN v TEXT', 'ALTER TABLE pres ADD COLUMN m INTEGER', 'ALTER TABLE pres ADD COLUMN t0 INTEGER', 'CREATE INDEX IF NOT EXISTS i_pres_pid ON pres (pid, t)'];   // 已經有這欄就會報錯，略過即可
async function migrate(env) {
  if (migrated) return;
  await env.DB.batch(SCHEMA.map(q => env.DB.prepare(q)));
  for (const q of UPGRADES) { try { await env.DB.prepare(q).run(); } catch (e) { } }
  migrated = true;
}
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    try {
      await migrate(env);
      if (url.pathname === '/board' && req.method === 'GET') return J(await board(env));
      if (url.pathname === '/submit' && req.method === 'POST') return await submit(req, env);
      if (url.pathname === '/leave' && req.method === 'POST') return await leave(req, env);
      if (url.pathname === '/ping' && req.method === 'POST') return await ping(req, env);
      if (url.pathname === '/ann' && req.method === 'GET') return J(await annGet(env, Number(url.searchParams.get('a')) || 0));
      if (url.pathname === '/claim' && req.method === 'POST') return await claim(req, env);
      if (url.pathname.startsWith('/fb/') && req.method === 'POST') return await fb(req, env, url);
      if (url.pathname.startsWith('/admin/')) return await admin(req, env, url);
      if (url.pathname === '/') return J({ ok: 1, app: 'Leaf of Legends leaderboard' });
      return J({ err: 'nf' }, 404);
    } catch (e) { return J({ err: isQuota(e) ? 'quota' : 'server' }, isQuota(e) ? 503 : 500); }
  }
};
