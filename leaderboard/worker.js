// Leaf of Legends 線上排行榜（Cloudflare Worker＋D1）
// GET  /board              → 9 個分類前 20 名＋最近的「登上第 1 名」消息（30 秒快取）
// POST /submit {id,tok,name,s} → 更新自己的數據，回傳自己在各分類的名次
// POST /leave  {id,tok}    → 退出排行（刪除自己的資料）
// 管理（需要 ADMIN_KEY）：GET /admin/list?key=…、POST /admin/hide {key,id,h}（隱藏／復原）、POST /admin/del {key,id}（永久刪除）
// v2.8.1：players.hidden＝1 的玩家不出現在排行（可復原）
const CATS = ['heroes', 'minions', 'games', 'wr', 'kda', 'keys', 'dmg', 'time', 'ach'];
const QUAL = { wr: 'games >= 10', kda: 'games >= 10' };          // 勝率、KDA 至少 10 場才上榜
const FIELDS = ['heroes', 'minions', 'games', 'wins', 'kills', 'deaths', 'assists', 'keys', 'dmg', 'time', 'ach'];
const MAX = { heroes: 40, minions: 80, ach: 200, games: 1e6, wins: 1e6, kills: 1e8, deaths: 1e8, assists: 1e8, keys: 1e7, dmg: 1e12, time: 1e9 };
const TOP = 20, CACHE_MS = 30000, GAP_S = 30, NEW_PER_IP_H = 3, DMG_PS = 1000;
const BAD = ['幹你', '操你', '靠北', '靠杯', '雞掰', '機掰', '去死', '智障', '白痴', '白癡', '屌', 'fuck', 'shit', 'bitch', 'cnm', 'nmsl', 'admin', '管理員', '官方'];
let cache = null, cacheT = 0;

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
async function auth(env, id, tok) {
  if (!/^[0-9a-f]{16}$/.test(id) || !/^[0-9a-f]{32}$/.test(tok)) return [null, J({ err: 'bad' }, 400)];
  const old = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (old && old.tok !== await sha(tok + id)) return [null, J({ err: 'auth' }, 403)];
  return [old, null];
}
async function submit(req, env) {
  let b; try { b = await req.json(); } catch (e) { return J({ err: 'bad' }, 400); }
  const id = String(b.id || ''), tok = String(b.tok || ''), name = cleanName(b.name);
  if (!name) return J({ err: 'name' }, 422);
  const s = b.s || {}, v = {}, now = Math.floor(Date.now() / 1000);
  for (const f of FIELDS) { const x = Number(s[f]); if (!isInt(x, MAX[f])) return J({ err: 'value', f }, 422); v[f] = x; }
  if (v.wins > v.games) return J({ err: 'value', f: 'wins' }, 422);
  if (v.dmg > (v.time + 60) * DMG_PS) return J({ err: 'value', f: 'dmg' }, 422);
  const [old, bad] = await auth(env, id, tok); if (bad) return bad;
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
  await env.DB.prepare(`INSERT INTO players (id, tok, name, ip, ${FIELDS.join(', ')}, wr, kda, created, updated) VALUES (?1, ?2, ?3, ?4, ${FIELDS.map((_, i) => '?' + (i + 5)).join(', ')}, ?16, ?17, ?18, ?19)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, ${FIELDS.map(f => f + ' = excluded.' + f).join(', ')}, wr = excluded.wr, kda = excluded.kda, updated = excluded.updated`)
    .bind(id, await sha(tok + id), name, ih, ...FIELDS.map(f => p[f]), p.wr, p.kda, p.created, now).run();
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
  const [old, bad] = await auth(env, String(b.id || ''), String(b.tok || '')); if (bad) return bad;
  if (old) { await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(old.id).run(); cache = null; }
  return J({ ok: 1 });
}
async function admin(req, env, url) {
  const isPost = req.method === 'POST', b = isPost ? await req.json().catch(() => ({})) : {}, key = isPost ? b.key : url.searchParams.get('key');
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return J({ err: 'auth' }, 403);
  if (url.pathname === '/admin/list') { const r = await env.DB.prepare('SELECT id, name, hidden, heroes, minions, games, wins, kills, deaths, assists, keys, dmg, time, ach, wr, kda, created, updated FROM players ORDER BY updated DESC LIMIT 300').all(); return J(r.results); }
  if (url.pathname === '/admin/hide' && isPost) { const r = await env.DB.prepare('UPDATE players SET hidden = ? WHERE id = ?').bind(b.h ? 1 : 0, String(b.id || '')).run(); cache = null; return J({ ok: 1, changed: r.meta.changes }); }
  if (url.pathname === '/admin/del' && isPost) { const r = await env.DB.prepare('DELETE FROM players WHERE id = ? OR name = ?').bind(String(b.id || ''), String(b.name || '\u0000')).run(); await env.DB.prepare('DELETE FROM news WHERE pid = ?').bind(String(b.id || '')).run(); cache = null; return J({ ok: 1, deleted: r.meta.changes }); }
  return J({ err: 'nf' }, 404);
}
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/board' && req.method === 'GET') return J(await board(env));
      if (url.pathname === '/submit' && req.method === 'POST') return await submit(req, env);
      if (url.pathname === '/leave' && req.method === 'POST') return await leave(req, env);
      if (url.pathname.startsWith('/admin/')) return await admin(req, env, url);
      if (url.pathname === '/') return J({ ok: 1, app: 'Leaf of Legends leaderboard' });
      return J({ err: 'nf' }, 404);
    } catch (e) { return J({ err: isQuota(e) ? 'quota' : 'server' }, isQuota(e) ? 503 : 500); }
  }
};
