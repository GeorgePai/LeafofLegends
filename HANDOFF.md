# Leaf of Legends（原名 LEAF WAR）— 交接筆記

> 新 session 只要讀這份。排行榜相關再看 `LEADERBOARD.md`。**做任何新設計前，先對照第 8 節「設計守則」**。
> 各版完成內容在 `CHANGELOG.md`、暫定數值在 `VALUES.md`，需要時用 grep 找到段落再讀，不要整份讀。
> 最後更新：2026-11-20，版本 **v3.2.5**

## 1. 專案是什麼
- Pai 的 HTML5 瀏覽器遊戲，仿 Gamevil《Plants War》（三路推塔＋英雄操作＋小兵兵線）
- 美術：極簡黑白灰像素風，少量色彩點綴（紅 HP、綠 MP、黃 互動／金幣、藍 BOSS／護盾、橘 爆擊；敵方 v2.3～v3.0 赤紅、v3.1 起暗黑＋細紅邊）
- 原著數值（英雄 10、小兵 19、敵人 35、塔 6、技能 60）已從 APK 解出，在 `src/01_data_orig.js`；平衡覆寫在 `src/02c_balance.js`
- 和 Pai 溝通：**繁體中文、結論先講、精簡**；每次回覆都要附 **作品連結**

## 2. 位置
| 項目 | 位置 |
|---|---|
| 作品（artifact） | https://claude.ai/artifact/8vvJWeebvgfkNQDrYWXHAB（slug `40373d28-c6d4-4204-8c2a-1435ff571374`） |
| 遊戲（GitHub Pages） | https://georgepai.github.io/LeafofLegends/ ← repo `GeorgePai/LeafofLegends` 的 **main** 分支（根目錄 `index.html`＋`.nojekyll`＋`audio/`） |
| **原始碼（雲端接手來源）** | 同一個 repo 的 **source** 分支：`src/`、`assets/`、`audio/`、`build.py`、`shell.html`、`tools/`、`setup.sh`、本檔、`CHANGELOG.md`、`VALUES.md`。注意：repo 是公開的（遊戲本身已經包含全部 JS，所以沒有多公開什麼） |
| Mac 備份 | `/Users/paiju/Desktop/Claude/LeafofLegends/`：`LeafofLegends.html`（可直接玩，旁邊的 `audio/` 是音樂）、`source/`、`versions/LeafofLegends_v*.zip`（舊版 `LeafWar_v*.zip`）、`bgm/`（Pai 給的原始 BGM）、本檔 |
| **排行榜伺服器** | https://lol-rank.leafoflegends.workers.dev（Cloudflare Worker `lol-rank`＋D1 `lol-rank`，帳號用 Apple ID 登入）。程式在 source 分支的 `leaderboard/`；**推 source 就會由 Cloudflare Workers Builds 自動部署**（根目錄 /leaderboard、`npx wrangler deploy`），資料表由 Worker 自己建立／升級。細節見 `LEADERBOARD.md` |
| 測試工具 | `tools/`：`tc_all.sh`（平行文字檢查＋摘要）、`textcheck.py`＋`tc_scenes.py`、`shot.py`（截圖）、`sheet.py`（多張截圖拼成一張）、`vfxsheet.py`（技能特效總覽）、`guideshot.py`（教學頁截圖） |

## 3. 接手步驟（約 2 分鐘，不需要 Mac）
1. `add_repo(GeorgePai, LeafofLegends, push)`
2. `git clone -q -b source --depth 1 https://github.com/GeorgePai/LeafofLegends /home/claude/leafwar && bash /home/claude/leafwar/setup.sh`
   - setup.sh 會：複製工具到 `/home/claude/tools/`、建 `/tmp/s`、需要時裝 fonttools/brotli、build、印出版本號、和 main 線上版比對（排除字型那行）
   - 顯示「與線上版一致 ✔」就代表接手完成；**交接時不用跑完整文字檢查**（程式沒變）
3. 部署用的 main 分支等要發佈時再 clone：`git clone -q --depth 1 https://github.com/GeorgePai/LeafofLegends /home/claude/leafoflegends`
4. **Mac 資料夾**：每個新對話一開始都沒連 Mac 資料夾，Claude 自己請求權限可能被自動模式擋下（v3.1 發生過）。所以接手指令第二行請 Pai 先在桌面 App 這個對話的「+」→「加入資料夾」選 `Desktop/Claude/LeafofLegends`；接手時用 `get_device_info` 確認 connectedFolders 有它，沒有就在回報裡提醒一次
5. 備援（GitHub 連不上時）：用 device 工具從 Mac 的 `source/` stage 進 `/home/claude/leafwar/`，再 `bash setup.sh`

## 4. 架構重點
- 單檔 HTML：`build.py` 依**檔名排序**串接 `src/*.js`（排序很重要，例如 `06b_combat.js` 必須在 `07_world.js` 前）
- 全域命名空間 `G`；世界座標 1 格 = 32；美術縮放 AX=0.5 / AY=0.375 / AZ=0.5
- 固定 60Hz 更新 + 插值繪製；低解析度緩衝 + 最近鄰放大
- **固定畫面比例（v1.6.1）**：橫屏邏輯解析度固定 320×180、直屏寬 180 高 320~400；多的視窗空間留黑邊，canvas 用 CSS 置中（`R.cssX/cssY`）。電腦用整數倍放大（`kInt`），手機填滿。`R.uiS`＝每 UI px 的實體像素
- **原生解析度圖層 `R.hiQ(fn)`**：小地圖、大地圖、技能資訊卡、教學動畫在 UI 畫完後直接畫到螢幕；之後若有遮罩（`U.h.dim`）就自動不畫
- 教學動畫畫在固定畫布 168×96（`GV_W×GV_A`），放進 168×160 正方形框（電影格式上下黑邊）；`z:1` 頁先畫一半再放大 2 倍
- 中文字：Cubic 11 像素字型（build 時自動子集化內嵌），用 `G.cn()`；英數用 3×5 像素字 `G.text()`（可變字寬）
- 色盤 `G.PAL` 0–9 灰階、10 紅、11 綠、12 藍、13 黃、14 橘、15 暗紅、16 暗綠、17 紫；精靈 ASCII 用 `0-9 a-h`

| 檔案 | 內容 |
|---|---|
| 00_core | 色盤、工具、精靈生成、像素字、`G.glowOf`（剪影外框光暈）、`G.RARITY` 稀有度、`G.scaled` |
| 01_data_orig | 原著資料 `G.ORIG`（units/towers/skills/weapons/items/heroSkills/stages） |
| 02_config | `G.TUNE` 調整值、`G.HEROES`、地圖 `G.MAPS.lanes5`（104×78，現用；每路 3 層塔＋主塔、凹槽營地、河道旁首領坑；舊的 lanes4 保留）、`G.STAGES` |
| 02b_text | 原著中文文字（已轉繁體，立斐→力夫） |
| 02c_balance | **平衡調整層（v2.2）**：`G.BAL` 覆寫 G.ORIG 技能／英雄成長欄位（原值在註解）、狂戰士倍率 `G.RAGE` |
| 03_sprites / 03b_bestiary | 手繪與程序生成的全部角色/圖示精靈 |
| 04_audio | Web Audio 合成音效（含 tick/snap/coin/open）與 BGM；`G.Audio.raw()`／`cry()` |
| 04b_cry | **角色專屬叫聲（v2.9）**：`G.Cry`（`BASE` 37 種基底、`ADD` 加料、`V` 每隻角色 [基底, 音高, 長度, 回聲, 加料]、`add` 登記新角色） |
| 05_map | 地圖場域、可走網格、導航 Dijkstra 流場、河道渲染、小地圖 |
| 01b_necro / 06d_necro | **v2.6 死靈召喚力夫**：資料（技能 type 'necro'、`cds` 每級冷卻）；召喚物 `u.summoner`、`makeSummon`、`necroWhy`、`necroSkill`、`scapeHit`、特效、`G.lookOf/rampOf`、神話外框在 00_core（`G.mythGlow/rarGlow`）|
| 06_fx / 06b_combat | 特效粒子；資料驅動戰鬥引擎（武器、傷害、狀態、技能） |
| 06c_vfx | **技能特效（v1.5）**：加色光暈 `G.glow`、元素分類 `G.elemOf/G.ELEM`、`G.VFX`（施法法陣 `cast`、增益 `buffCast`、投射物外觀 `drawProj`＋殘影 `p.hist`＋拖尾 `trail`、命中 `impact/hitSpark`、星芒 `spark`、光源 `light/groundLight`、電弧 `arc`、落雷 `bolt`、光束 `beam`、隕石 `meteor/meteorImpact`、大地 `quake`、地刺 `spikes`、裂痕 `cracks`、身上狀態 `auraBack/auraFront`）。技能投射物帶 `fx`（元素）與 `fxS`（進階版）；延遲事件一律用 `G.VFX.later`，不用 setTimeout |
| 06e_stages | **單人關卡（v3.0）**：`G.THEMES` 場景、`G.withTheme`／`G.themeImg`、9 個新敵人、`G.SOLO` 五關設定、`G.SOLO_HZ` 規則數值、`G.SoloW`（wave/tick/erupt/died/weather/finish/best/open） |
| 07_world | 單位、AI、兵線、英雄指令、經驗升級、召集跟隨 `toggleFollow/followAI`、獵手 AI 分派 |
| 07b_systems | 技能升級、金幣/商店/背包、計時增益、野區、技能數值表 `G.skillRows`、**敵方獵手 `hunter`（`spawnHunter/junglerAI/hunterReward`）、塔傳送 `startTeleport/updateTeleport`** |
| 08b_hd | **HD-2D 鏡頭後製（v3.2.2）**：`G.HD`（WebGL 著色器：透視、景深、柔光、調色、光束；光塵），`on/P/active/over/render` |
| 08_render | `R.resize`（固定比例＋整數倍）、`R.zoomMin`（可縮到全圖）、`R.hiQ/blitUI`、世界繪製（護盾光殼、稀有度外框、血條、準心、迷霧） |
| 09_ui | 戰鬥 HUD：HP/MP/XP 三條等粗、鑰匙＋K/D/A 列、小地圖 `mapDraw`＋展開大地圖 `bigMap`、戰鬥數據 `statPanel`、廣播 `drawNotices`、技能水平列＋置中鈕（大招上方）、長按技能卡（動畫，`cardC`）、增益卡、商店、左側道具欄（效果短標）、暫停選單（有名稱）；所有輸入（`evXY` 已扣黑邊）|
| 10_sandbox | 中文字工具 `G.cn/cnWrap`、標籤 `tagOf`、**技能展示沙盒 `G.Sandbox`（依技能類型的情境：`scBasic/scActive/scBuff/scPassive`，被動用對照演出）** |
| 11_menus | 首頁（大標題 5×7 字形 `TITLE_GLYPH`）、隊伍／圖鑑（共用轉盤 `cars.team/book`，橫屏轉盤高度依 `nameplateH`）、技能展示彈窗 `demoPanel`（動畫＋數值表 `lvTable`：每列同一行，放不下就數值欄左右滑動 `TS`）、數值條 `G.statBars/G.statMax`、三欄陣容 `laneCols`、教學（5 類（v2.8.4 拿掉英雄），說明文字用 `{重點}` 上色；`G.Menus.openGuide(fromBattle)`、`M._gt(t)` 測試用跳時間）；捲動狀態 `SM`/`SD` 分開 |
| 12_store | **商店／寶箱**：`G.CHESTS`（機率表）、`G.Store`（畫面、說明視窗、開箱動畫、寶箱像素圖 `drawChest`） |
| 13_ach | **成就（v1.7）**：`G.ACH`（43 個定義：c 分類、t 等級 1～4、g 目標、v 取值、hint 隱藏提示）、`G.Ach`（`P()` 檔案、`check/commit/tick/final/on/claim`、`recent`、`banner`）、`G.AchUI` 成就畫面、`G.Ach.drawBanner` |
| 14_save | **存檔碼（v1.7）**：`G.SaveCode`（`make/read/clean/apply/summary`）、`G.Dom`（疊在 canvas 上的 input/textarea，每幀 `place`，沒用到自動隱藏）、`G.SaveUI`（存檔畫面 home/name/code/load/confirm、`drawWelcome` 歡迎回來、`drawGreet` 開啟問候） |
| 15_intro | **開場動畫（v1.7）**：`G.Intro`（`draw/skip/reset/drawFlash`），約 2.45 秒＋白光淡出 |
| 16_rank | **線上排行榜（v3.2 玩家動態 `K.state`、管理玩家詳細 `det`／`_det`）（v2.8；v2.8.4 強制參加、跳至自己 `jmp`、`remove/forget/uid`、幽靈清除 `admPurge`）**：`G.RANK_URL`、`G.RANK_CATS`（9 分類）、`G.Rank`（poll/submit/join/leave/autoJoin、通知 diff/news、管理 admLoad/admAct、測試 `_mock/_set`）、`G.RankUI`（分類滾輪 `cw`、清單、底部名次列、管理玩家 `admin()`）。身分 `P.rk={id,tok}`、累積鑰匙 `P.keysTot` |
| 17_update | **版本更新通知（v2.8.5）**：`G.Update`（check/tick/corner/card、`show(mode,from)`：'new' 有新版／'done' 已更新的內容卡，內容可捲動；`_set/_open/_show/_sc/force` 測試用）、讀 `version.json`，離線用 build 打包的 `G.RELEASE`；更新後通知條 `G.Ach.drawUpd` |
| 18_feedback | **反饋信箱（v2.8.6）**：`G.FbUI`（玩家寫信／看回覆；開發者模式＝玩家信箱）；連線在 16_rank 的 `K.fb*` |
| 19_about | **關於（v2.8.6）**：`G.About` 片尾名單＋櫻花、結尾淡出回首頁（`post` 在首頁最後畫淡入）|
| 20_solo | **選關畫面（v3.0）**：`G.Solo`（open/draw/key/stars、`_go` 測試用），畫面 `stages`；v3.1 甩動換關 |
| 21_stagego | **出發過場（v3.1）**：`G.StageGo`（go/draw/hold/skip、`_t(階段,秒)` 測試用） |
| 22_mail | **系統公告＋信箱（v3.2）**：`G.Mail`（seen/load/unread/drawCast/draw、畫面 `mail`；測試 `_set/_sel/_comp/_cast`） |
| 99_main | 啟動與主迴圈（啟動後先進 `intro` 畫面） |

## 5. 版本摘要（細節見 CHANGELOG.md）
- v0.9～v1.2：地圖／河道／野區／首領、商店與道具、技能升級、隊伍與圖鑑轉盤、技能展示、召集、傳送、敵方獵手、寶箱與鑰匙、角色解鎖
- v1.3～v1.6.4：lanes5 地圖＋外中內主塔、視野迷霧、標籤系統、技能特效（06c_vfx）、固定畫面比例＋整數倍放大、小地圖／大地圖、戰鬥數據、廣播系統、教學電影格式
- v1.7～v1.9：開場動畫、首頁滾輪選單、成就 43 個、存檔碼、戰鬥結算、道具滾輪、改名 Leaf of Legends＋新 LOGO、GitHub Pages 部署
- v2.0～v2.1.3：中文字對齊像素格、mp3 BGM（−18 LUFS）、「點一下開始」、iPhone 加入主畫面提示、備份提醒、首頁曲預載修正（**v2.1.3 待 Pai 在 iPhone 確認**）
- v2.2：技能平衡層 `02c_balance.js`、升級廣播、敵方成長加強
- v2.3：立體按鈕／數值條、音量設定、首頁轉場、寶箱與開箱演出、免費賭徒寶箱、紅色敵人、地面層次、攻擊動作、技能前搖、特效延長
- v2.5：開場 5 秒兩軍對陣、存檔碼不再刷免費寶箱、戰場動態（樹擺、落葉、河流、石像／燈籠／斷柱）、野怪不再來回跑、重生變長、圖鑑藥水、解散跟隨＋扇形隊形、塔隨時間成長＋升溫、瞄準靠邊補償
- v2.6：數值條補間、戰場自然配色（G.NAT）＋聖樹上色、寶箱「前往隊伍」＋NEW、17 個新成就、神話稀有度（七彩）、DEV 開局滿級、新英雄死靈召喚力夫（召喚物系統）
- v2.6.1：聲音加固（iPhone 靜音開關／中斷後恢復／被擋的音樂在下一次點擊補播），**待 Pai 在 iPhone 確認**
- v2.7：初始鑰匙 8、教學重點上色＋「英雄」分類、技能數值表左右滑動、同陣營站開、道路再 ×1.5（聖所附近維持原寬）
- v2.8：開寶箱演出重做（敲擊→光一階一階升級→分級爆開、剪影揭曉、11 個新音效）＋教學「開箱光色」；**線上排行榜**（9 分類、存檔自動參加、每 30 秒刷新、前三名通知、全服第 1 名跑馬燈）
- v2.8.1～2.8.2：排行分類改上下滾輪、名字「…」截斷（Pai 指定例外）、開發者模式「管理玩家」（隱藏／復原／刪除，權限＝開發者密碼，猜錯 5 次鎖 1 小時）；伺服器改 Cloudflare 連 GitHub 自動部署
- v2.8.3：排行畫面 10 秒刷新＋倒數、數據有變自動上傳、前三名獎盃＋光暈、首頁左上「嗨！名字」
- v2.8.4：排行強制參加＋跳至自己、金銀銅外框固定、帳號管理（改名／登出／刪除）、存檔碼提醒、管理玩家幽靈帳號清除、教學拿掉英雄分類、圖鑑藥水併入分類條＋分頁式分類條＋資訊小按鈕
- v2.8.6：反饋信箱（玩家↔開發者）、關於（片尾名單＋櫻花）、即時在線人數、商店橫屏不切、柔和選中光、App 圖示
- v2.8.5：版本更新通知（version.json＋首頁右下「點擊更新」＋更新內容卡＋立即更新重新載入）
- v2.8.7：首頁聚光改橢圓、存檔→帳號／玩家名稱、說明文字重點上色、一帳號同時一台（/claim、moved）
- v2.9：全部 71 個角色的專屬叫聲（轉盤停下／點中間角色）
- v3.0：單人五關（場景、難度、特殊規則、9 個新敵人、選關畫面、星等獎勵、8 個成就；成就共 68 個）
- v3.2.5：小兵橫向分散（`u.lo`、`W.nextLo`、`M.laneNear`，沿路中線走）、三路欄位改兩列 13px（橫屏數值條不用捲動）
- v3.2.4：拿掉上下景深模糊（`G.HD.dof=0`、`G.VOL=0`）、戰場放大／縮小鈕（`R.zoomBy`，平滑 `cam.zt`）、小兵點數 24、三路欄位固定三列＋同種合併數量、公告即時送達（/ann?a=、重試、戰鬥外 ping 30 秒）、更新通知條「查看更新內容」＋更新內容卡可捲動（build 打包 `G.RELEASE`）
- v3.2.3：HD-2D 效能（半解析預先模糊、像素預算、掉幀自動降解析度 `G.HD.q`）
- v3.2.2：WebGL HD-2D 鏡頭後製（透視傾斜＋景深＋柔光＋調色＋光束＋光塵，`08b_hd.js`）、光暈改平滑微透、復活藥水倒地 2 秒
- v3.2.1：拿掉側面厚度，改成 HD-2D 微縮景深＋柔光（`G.VOL`，現在只當不支援 WebGL 時的退路）
- v3.2：等級數字改白字細黑邊、復活無敵 2 秒、2.5D 立體感（側面厚度，v3.2.1 已拿掉）、系統公告＋信箱、管理玩家動態
- v3.1：出發過場動畫＋進關卡卡頓修正（地面色名快取）、等級徽章、敵人改回暗黑色調（場景生物各有色調＋細紅邊）、選關滑動重做、教學 72→51 頁全面改寫、爐石式文字守則
- v2.4：敵塔範圍＋鎖定警示、道路 ×1.5、結算放慢＋鎖值＋音效、新藥水 5 種＋全部藥水特效、DEV 密碼、技能範圍顯示＋指定施放（拖曳／取消）、LOGO 改版、塔射程 190/210

## 6. 待 Pai 決定
- 畫質再提升：A＝高解析文字（像素角色＋平滑字體），B＝提高像素解析度（480×270，整套美術重畫）。尚未選擇
- 圖鑑動畫重畫：Pai 說「有些動畫可以描繪得更好」，等他指定哪幾隻
- 暫定數值全部在 `VALUES.md`（最新：6v v3.2.2 段）
- （v2.7）成就鑰匙過剩：全收集只要 90 把，成就給 138 把；「群英薈萃／森羅萬象」較晚完成的那個獎勵用不到。Pai 決定先保留，等鑰匙有新用途再說
- （v2.4）首頁 RESET 要不要也加密碼鎖？隕石等範圍技仍可在塔射程外打到塔（目前視為合理技能消耗），要不要禁止？
- （v2.5）重生時間、塔成長／升溫、野怪脫戰規則等暫定數值待確認（VALUES.md 6h）
- （v2.6）死靈召喚力夫的 MP、成長、解鎖等級、召喚上限 12、血祭可控對象、神話機率 3% 等待確認（VALUES.md 6i）。犧牲召喚可獻祭 1 血複製體換滿血小兵的連招：Pai 決定先保留試強度（2026-11-19），太強再平衡
- （v2.8）開箱節奏與排行榜暫定數值（VALUES.md 6k、6l、6m）待確認；排行榜還沒經過 Pai 實機完整測試「管理玩家」（測試存檔「GM」等他自己處理）
- （v2.8）排行榜可考慮第二階段：本週榜、好友榜（LEADERBOARD.md）
- （v2.8.3～2.8.6）新暫定數值待確認：VALUES.md 6l、6m、6n、6o（排行刷新、幽靈帳號 30 天、獎盃光暈、更新檢查 5 分鐘、反饋字數／頻率、在線回報 60 秒、片尾速度、選中光暈）
- （v2.8.4）**刪除帳號後舊存檔碼**：目前讀回舊存檔碼＝進度和排行回來（當成備份還原）；要不要讓伺服器記住已刪除帳號、讓舊碼失效？待 Pai 決定
- （v2.8.6）排行榜伺服器 11/20 凌晨顯示 0 人（11/19 晚上還有 3 人）；這版只新增資料表沒動玩家資料，請 Pai 確認是不是自己清掉測試帳號
- （v2.8.6）App 圖示（Leafy＋光芒＋草丘，`assets/icon-*.png`、`tools/icon_make.js`）與主畫面名稱「Leaf Legends」：Pai 可再要求改
- （v3.0）單人關卡數值全部暫定（VALUES.md 6r）；只用「英雄不動」模擬過，需要 Pai 實際打打看調整難度。另外聖樹、塔、野區營地沒有跟著主題換造型
- （v2.8.7）一帳號同時一台：被別台登入的裝置會被登出，登出前顯示這台的存檔碼可複製；沒帶工作階段的舊版用戶端不擋。等 Pai 實機兩台測試
- （v2.9）角色叫聲：Pai 聽過後可指定哪幾隻要改（`04b_cry.js` 的 `V` 表調音高／長度／基底）
- （v3.1）出發過場長度、選關甩動手感、敵人暗色調與細紅邊、等級徽章配色（VALUES.md 6s）待 Pai 實機確認
- （v3.2.5）小兵分散強度 `G.TUNE.laneSpread` 0.85、路邊保留 `laneEdge` 1 格（VALUES 6y），待 Pai 實機看
- （v3.2.4）新暫定數值見 VALUES 6x（縮放每步 ×1.35、點數 24、欄位三列、ping 30 秒、通知條 10 秒）；點數 24 會讓我方兵線變多、遊戲變簡單（敵方波次不跟著加），等 Pai 實際玩再決定要不要調敵方
- （v3.2.3）HD-2D 強度 Pai 已認可；效能優化後請 Pai 再實機確認縮小視角是否還卡、會不會發燙（VALUES 6w）；仍不行再加「省電畫面」開關（`G.HD.on`／降 `BUDGET`）
- （v3.2）公告與動態數值（VALUES.md 6t）待 Pai 實機確認；公告／動態的伺服器功能要等 Cloudflare 自動部署完才會生效
- （v3.2.2）「死亡後 2 秒才復活」目前做成：有復活藥水時倒地 2 秒再原地站起來；若 Pai 指的是一般回聖樹重生，要再改 `G.TUNE.heroRespawn*`
- （v3.2.2）公告／信箱、管理玩家動態已上線但還沒實際用過：請 Pai 開發者模式發一則測試公告確認
- DEV 密碼只有 Pai 知道（程式內只有雜湊）；要改密碼請 Pai 提供新密碼，重算 `DEV_H`

## 7. 工作規則
**每次更新流程**：改 src → build → `bash /home/claude/tools/tc_all.sh`（背景跑，0 筆才可交付）→ 只截有改到的畫面，用 `sheet.py` 拼成一張看 → 發佈 artifact（先 `get_artifact` 取 version，再 `publish_files`，index.html＝dist/index.html）→ 推 GitHub main（遊戲）＋ source（原始碼）→ 備份 Mac（`LeafofLegends.html`、`versions/LeafofLegends_v版本.zip`、有改到的 `source/` 檔案）→ 升版號
- 版本號在 `src/11_menus.js` 第 2 行 `G.VERSION = 'V3.2.2'`
- **更新內容（玩家看得到）**：每次發佈前在 `release.json` 的 list 最前面加一筆 `{v, d, n:[…]}`（短句、玩家口吻、不寫技術細節），版本號要和 G.VERSION 一樣
- 推 main：clone 到 `/home/claude/leafoflegends` → `python3 /home/claude/leafwar/tools/release.py`（複製 index.html＋產生 version.json；保留 `.nojekyll`；音樂有改才更新 `audio/`）→ commit → `git -c push.negotiate=true push origin HEAD:main`，約 1～2 分鐘生效。備援：Pai 在 Mac Terminal 執行 `bash ~/Desktop/Claude/LeafofLegends/deploy_github.sh`
- 推 source：在 `/home/claude/leafwar` commit（dist/ 已在 .gitignore）→ `git -c push.negotiate=true push origin HEAD:source`
- **排行榜伺服器**（Pai 要求全自動，不要叫他跑指令）：改 `leaderboard/worker.js` → 本機先測（`cd leaderboard && npm i wrangler@4`，用 `wrangler dev --local` 加假的 database_id 設定檔，curl 測 /board /submit /admin）→ 推 source 即自動部署。新欄位加在 worker.js 的 `SCHEMA`／`UPGRADES`。雲端 shell 連不到 Cloudflare 和 workers.dev：要確認部署就用桌面 App 內建瀏覽器（`mcp__remote-devices__Claude_Browser__*`，已登入 Cloudflare）開 lol-rank → Deployments，或開 /board。**不要用錯的密碼測管理 API**（猜錯 5 次會把 Pai 家的 IP 鎖 1 小時；全部合計 30 次會鎖住所有人）。測試場景裡設 `leafwar_adm` 時，一定要同時設 `G.Rank.adm.t=Date.now()+9e9` 並用 `G.RankUI.adm(true,1)`，避免自動去打正式伺服器
- 長時間指令（文字檢查等）一律用 Bash 的 `run_in_background`，不要用 nohup／`&` 丟著（回合結束會被砍掉），也不要用長 sleep 輪詢；文字檢查（4 支 Chrome 平行）跑的時候不要同時截圖，會逾時
- 測試：Playwright＋`/usr/bin/google-chrome`；裝置 n（360 寬手機）、m（390 手機）、L（手機橫屏）、d（1280×720）、w/u/t（大視窗／超寬／偏方）。可直接 `G.UI.screen='team'/'book'/'guide'`、`G.UI.start()` 進各畫面；`localStorage.clear()` 模擬新玩家；新增畫面時把場景加進 `tools/tc_scenes.py`（加在最後一行 `json.dump` **之前**，再複製到 /home/claude/tools/），只想重測新場景可把那幾個場景存成小 json 直接跑 `textcheck.py 小.json 裝置`
- 快速驗證：`python3 /home/claude/tools/probe.py "JS"`（在遊戲裡執行並印出結果，比截圖省很多）。數值平衡可在 probe 裡 `G.UI.start(i)` 後跑 `G.W.update(1/60)` 迴圈模擬幾分鐘（英雄不動）
- 測試輔助：`G.Team.setDev(true)`（開發者模式，五關全解鎖）、`G.Solo.open()`／`G.Solo._go(卡片序)`、`G.UI.start(關卡 0～5)`、`G.W.hzT=0`（立刻觸發關卡規則）、`G.SaveUI.go('kick')`、`G.Rank.moved=true`、`G.Menus.devAsk(true)`、`G.UI.aim={...}`、`G.Menus._guideGo(分類, 頁)`、`G.Menus.menuWheel.go(i)`、`G.Menus._mt(秒)`、`G.Intro.t=秒數`、`G.Dom.el('name'|'code'|'load')`、`G.SaveUI.forceIos=true`
- 技能特效總覽：`python3 /home/claude/tools/vfxsheet.py "技能id,...|b=普攻" "時間點,..." out.png [角色名]`
- 角色介紹與技能說明在 `02b_text.js` 的 `G.TXT.uinfo / sinfo`（JSON，用 Python 讀寫最安全）
- 修改大檔用精準字串替換；**不要**用空字串當替換目標（曾把檔案炸成 18 萬行）

**省 token 守則**
- 讀程式先 `grep -n` 定位，再用 Read 的 offset/limit 只讀那幾十行；不要整份讀大檔（`11_menus.js` 143KB、`09_ui.js` 70KB）
- 工具輸出一律接 `tail`／`grep`／`head`，只看摘要
- 截圖只截改到的畫面，拼成一張再看；不要每個裝置每個畫面都單獨看
- 一個對話大約 2～3 個版本就建議 Pai「交接」，避免對話太長、每一輪越來越貴
- 回覆 Pai：繁中、結論先講、附作品連結、列出暫定數值
- 給 Pai 的東西要簡單：能自動就自動；真的需要他動手時只給「一個步驟」，不要設計需要他複製金鑰之類的流程（v2.8.2 教訓）

## 8. 設計守則（Pai 的要求，所有新設計都要遵守）
> 從 v0.9～v1.1 的回饋整理而來。做完新東西，先用這份逐條自我檢查再交付。

### A. 版面與排版
1. **手機直屏優先**：每個畫面都要在 390×844、360×780（窄手機）與桌機 1280×720 檢查；面板依螢幕寬度縮放並**置中**，絕不超出畫面。
2. **文字絕不重疊、擠壓、被遮住或被截斷**（Pai 的排版大忌）：所有可能變長的文字一律用 `G.cnWrap` / `G.cnBlock` 依容器寬度換行，容器高度跟著行數算，不可寫死單行；並以自動文字檢查工具驗證 0 筆。標籤與數值要分開；放不下就換行或改兩行排；說明文字不可被按鈕擋住；教學說明最多 3 行。
3. **對齊與一致**：同類元件大小一致（例：技能格統一大小）；小元件要置中（等級條、升級＋、點數條）；同一功能在各畫面用**同一個名稱**（例：「技能展示」）。
   - **表格欄位一定上下對齊**：整張表只用一種版型，不可以某一列單獨換版；放不下就整張改版（v1.5.1，Pai 列為大忌）
   - **彈出面板／資訊卡一律加黑色遮罩**，內容完整顯示在畫面內，不截斷行數（v1.5.1）
   - **分類條放不下就用整格分頁**（`tabsS`：左右箭頭／左右滑），不可以露出半個分頁；換行不拆英數字（50%、HP）（v2.8.4～2.8.6）
   - 畫面不夠高時改左右排（例：商店說明放右邊），不要讓下半部被切掉（v2.8.6）
4. **重要內容不被擠壓或捲走**：動畫或預覽不放在會被捲動蓋掉的地方，改用點擊後彈出的視窗。
5. **漸進揭露**：不要把所有資訊攤在同一頁；細節（技能說明、數值表）在選到那一項時才顯示。

### B. 互動
6. **極簡、直覺、按鈕不雜亂**（戰鬥右上只留「展開地圖」「暫停」；音效在暫停選單裡；項目變多就用**滾輪**收起來，像首頁、道具欄）：新機制優先用「點既有物件」觸發（點小兵＝召集、點我方塔＝傳送），盡量不加新按鈕。
7. **按鈕文字要短**：花費等附帶資訊另外顯示（名牌、點數條預覽），不要塞進按鈕裡。
8. **操作一致**：單點＝執行動作；長按＝看資訊卡（主動技、被動技、增益圖示都一樣）。單點只能看的東西時，提示「長按查看說明」。
9. **狀態要看得見**：玩家正在做什麼要清楚顯示（鎖定目標的圖示＋血條、傳送進度與冷卻、跟隨中的黃旗）。

### C. 視覺
10. 遵守色盤語意：紅＝HP、綠＝MP、黃＝互動／金幣／增益、藍＝BOSS／護盾、橘＝爆擊；**被動＝紫**。
11. **對比要夠**：深色角色圖示要放在較亮的底上；敵我血條都要清楚（敵兵用亮白帶刻痕）。
12. 喜歡的效果要保留並沿用到同類畫面（例：舞台聚光燈轉盤 → 隊伍與圖鑑共用）。
13. **不接受不對稱的視覺瑕疵**：並排的條／按鈕要等粗、等距、等高、邊緣對齊（v1.6）
    - **光暈要柔和、薄**：排行 `honor` 用多圈半透明＋圓角＋慢呼吸，不要把外框變粗（v2.8.3）。**首頁選中按鈕維持原本黃橘交替外框**（v2.8.7 Pai 指定）；按鈕後面的背景光要像橢圓漸層，不可以看出長方形邊框
    - **首頁要乾淨**：新增資訊用最輕的樣式（例：「嗨！名字」只要白字、無框）（v2.8.3）
    - 名次外框固定金／銀／銅，「自己」用別的方式標示，不可以搶掉名次顏色（v2.8.4）
13b. **美術方向：Pai 很喜歡《歧路旅人》（Octopath Traveler）的 HD-2D 美術**（v3.2.1）：像素角色不動，用景深、柔光、光線氣氛做出立體感；不要硬改角色剪影（例：加側面厚度，Pai 覺得不自然）
14. **畫面比例固定**：不論視窗大小，物件比例都一樣；電腦用整數倍放大保持像素清楚（v1.6.1～1.6.3）
15. **數值用數值條呈現**，和同類角色比較，讓強弱一眼看得出來；數字只當輔助。

### D. 內容與文字
16. **文字要像真人寫的**：台灣繁中、口語順暢、短句好懂；避免翻譯腔與拗口的 AI 文風；用台灣用語（例：馬鈴薯而非土豆）。
16b. **文字學爐石傳說：簡潔但清楚**（v3.1 Pai 指定）：
    - 一句話只講一件事；先講「做什麼」，再講「結果」（例：「{點地面}，英雄就走過去」）
    - 能刪的字就刪：「就會」「可以」「的話」「也」「一下」這類填充詞、重複畫面上已經看得到的資訊（難度、獎勵已經有圖示，就不要再用字說一次）
    - 數字寫清楚、放在最後或用重點色：「10 秒內全場跑速 {−25%}」；條件用「並」：「單場倒下 5 次以上並獲勝」
    - 同一個概念全遊戲只用一個詞（獲勝、擊倒、冷卻、跑速、攻速、星等…）；不用括號補充一長串例外，例外交給教學或提示
    - 寫完唸一遍：像真人講話、不拗口、沒有翻譯腔；說明不超過 2～3 行
16c. **教學只放玩家自己摸不出來的東西**（v3.1）：操作手勢、隱藏規則、數值門檻、容易錯過的功能。看到就懂的（暫停、音量、選角轉盤、新角色 NEW、叫聲、結算畫面）不放
17. **標籤要有意義**：沒有資訊量的分類就拿掉，改用實際特性（近戰、遠程、範圍、吸血…）。
18. **展示要真的解釋到含義**：技能展示只放該招，不混普攻；範圍技要擺多個敵人呈現範圍；被動技用「原本 vs 有被動」對照，或用血條、魔力條加回復數字演出效果。

### E. 系統設計
19. 新機制要**簡單易懂、規則一句話講得完**；設計時直接給出合理的完整方案（機制、數量、數值、出現時機），不要只丟選項。
20. 自訂數值一律列為**暫定數值**，回覆時列出來請 Pai 確認，並寫進 `VALUES.md`。
21. 會連伺服器的新功能，要**評估免費額度負擔**（請求數、D1 讀寫列數）並告訴 Pai；能用快取、記憶體擋重複寫入就用（v2.8.3～2.8.6）。
    會影響平衡的新角色或系統，先用模擬跑幾分鐘遊戲驗證強度與頻率（例：獵手第一版太強，已調弱）；通知不可洗版。
22. 新的單位或分類要**同步加進圖鑑**；每個新功能都要**同步更新教學**。

### F. 交付
23. 照第 7 節流程：build → 測試（桌機＋直屏＋窄手機＋手機橫屏）→ 發佈 → 備份 Mac → 升版號。
24. 回覆用繁中、結論先講、精簡，附作品連結，列出暫定數值；我自己多做或改名的地方要說明，讓 Pai 決定要不要保留。

## 9. 交接 SOP（Pai 說「交接」時）
1. 更新本檔（版本、第 5 節摘要加一行、第 6 節待決、規則有變就改）；把該版細節寫進 `CHANGELOG.md`、新暫定數值寫進 `VALUES.md`。
2. 推 GitHub：source 分支（原始碼＋三份文件）、main 分支（遊戲）都確認是最新。
3. 備份到 Mac 的 `/Users/paiju/Desktop/Claude/LeafofLegends/`：`LeafofLegends.html`、`audio/`、`source/`（含三份文件＋LEADERBOARD.md）、`versions/LeafofLegends_v版本.zip`、本檔；`leaderboard/` 資料夾（worker.js 等；裡面的 admin_key.txt 是 Pai 的，不要動）。
4. 回覆 Pai 一段「可直接貼上」的接手指令給下一個 session（範本如下）。
5. **Session 命名**：Claude 沒有改對話標題的工具，請 Pai 手動改（對話標題旁的選單 → 重新命名）：目前這個 → `LeafofLegends (retired)`；下一個 → `LeafofLegends (on-going)`（接手指令第一行寫明；接手的 session 回報就緒時再提醒一次）。

接手指令範本：
```
請把這個對話命名為「LeafofLegends (on-going)」。
（我會先在桌面 App 這個對話的「+」→「加入資料夾」連上 Desktop/Claude/LeafofLegends）
繼續 Leaf of Legends 專案。照 HANDOFF.md 第 3 節接手：
add_repo(GeorgePai, LeafofLegends, push) →
git clone -q -b source --depth 1 https://github.com/GeorgePai/LeafofLegends /home/claude/leafwar && bash /home/claude/leafwar/setup.sh
讀 /home/claude/leafwar/HANDOFF.md（只讀這份；CHANGELOG.md、VALUES.md 需要時再查）。
作品：https://claude.ai/artifact/8vvJWeebvgfkNQDrYWXHAB（目前 V○○）；排行榜伺服器：https://lol-rank.leafoflegends.workers.dev；遊戲：https://georgepai.github.io/LeafofLegends/
設計前對照第 8 節；更新照第 7 節；我說「交接」照第 9 節。
準備好後用一句話回報版本與狀態（含 Mac 資料夾是否已連上），提醒我改名，然後等我的新需求。
```
