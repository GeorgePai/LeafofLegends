-- Leaf of Legends 排行榜資料表（重複執行也安全）
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY, tok TEXT NOT NULL, name TEXT NOT NULL, ip TEXT,
  heroes INTEGER DEFAULT 0, minions INTEGER DEFAULT 0, games INTEGER DEFAULT 0, wins INTEGER DEFAULT 0,
  kills INTEGER DEFAULT 0, deaths INTEGER DEFAULT 0, assists INTEGER DEFAULT 0,
  keys INTEGER DEFAULT 0, dmg INTEGER DEFAULT 0, time INTEGER DEFAULT 0, ach INTEGER DEFAULT 0,
  wr REAL DEFAULT 0, kda REAL DEFAULT 0, created INTEGER, updated INTEGER, hidden INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS i_heroes ON players (heroes DESC, created);
CREATE INDEX IF NOT EXISTS i_minions ON players (minions DESC, created);
CREATE INDEX IF NOT EXISTS i_games ON players (games DESC, created);
CREATE INDEX IF NOT EXISTS i_wr ON players (wr DESC, created);
CREATE INDEX IF NOT EXISTS i_kda ON players (kda DESC, created);
CREATE INDEX IF NOT EXISTS i_keys ON players (keys DESC, created);
CREATE INDEX IF NOT EXISTS i_dmg ON players (dmg DESC, created);
CREATE INDEX IF NOT EXISTS i_time ON players (time DESC, created);
CREATE INDEX IF NOT EXISTS i_ach ON players (ach DESC, created);
CREATE INDEX IF NOT EXISTS i_ip ON players (ip, created);
CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, pid TEXT, name TEXT, cat TEXT);
