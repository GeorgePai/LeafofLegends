# Leaf of Legends（原名 LEAF WAR）— 交接筆記

> 新 session 只要讀這份。**做任何新設計前，先對照第 8 節「設計守則」**。
> 各版完成內容在 `CHANGELOG.md`、暫定數值在 `VALUES.md`，需要時用 grep 找到段落再讀，不要整份讀。
> 最後更新：2026-11-18，版本 **v2.3**

## 1. 專案是什麼
- Pai 的 HTML5 瀏覽器遊戲，仿 Gamevil《Plants War》（三路推塔＋英雄操作＋小兵兵線）
- 美術：極簡黑白灰像素風，少量色彩點綴（紅 HP、綠 MP、黃 互動／金幣、藍 BOSS／護盾、橘 爆擊；v2.3 起敵方用赤紅色階）
- 原著數值（英雄 10、小兵 19、敵人 35、塔 6、技能 60）已從 APK 解出，在 `src/01_data_orig.js`；平衡覆寫在 `src/02c_balance.js`
- 和 Pai 溝通：**繁體中文、結論先講、精簡**；每次回覆都要附 **作品連結**

## 2. 位置
| 項目 | 位置 |
|---|---|
| 作品（artifact） | https://claude.ai/artifact/8vvJWeebvgfkNQDrYWXHAB（slug `40373d28-c6d4-4204-8c2a-1435ff571374`） |
| 遊戲（GitHub Pages） | https://georgepai.github.io/LeafofLegends/ ← repo `GeorgePai/LeafofLegends` 的 **main** 分支（根目錄 `index.html`＋`.nojekyll`＋`audio/`） |
| **原始碼（雲端接手來源）** | 同一個 repo 的 **source** 分支：`src/`、`assets/`、`audio/`、`build.py`、`shell.html`、`tools/`、`setup.sh`、本檔、`CHANGELOG.md`、`VALUES.md`。注意：repo 是公開的（遊戲本身已經包含全部 JS，所以沒有多公開什麼） |
| Mac 備份 | `/Users/paiju/Desktop/Claude/LeafofLegends/`：`LeafofLegends.html`（可直接玩，旁邊的 `audio/` 是音樂）、`source/`、`versions/LeafofLegends_v*.zip`（舊版 `LeafWar_v*.zip`）、`bgm/`（Pai 給的原始 BGM）、本檔 |
| 測試工具 | `tools/`：`tc_all.sh`（平行文字檢查＋摘要）、`textcheck.py`＋`tc_scenes.py`、`shot.py`（截圖）、`sheet.py`（多張截圖拼成一張）、`vfxsheet.py`（技能特效總覽）、`guideshot.py`（教學頁截圖） |

## 3. 接手步驟（約 2 分鐘，不需要 Mac）
1. `add_repo(GeorgePai, LeafofLegends, push)`
2. `git clone -q -b source --depth 1 https://github.com/GeorgePai/LeafofLegends /home/claude/leafwar && bash /home/claude/leafwar/setup.sh`
   - setup.sh 會：複製工具到 `/home/claude/tools/`、建 `/tmp/s`、需要時裝 fonttools/brotli、build、印出版本號、和 main 線上版比對（排除字型那行）
   - 顯示「與線上版一致 ✔」就代表接手完成；**交接時不用跑完整文字檢查**（程式沒變）
3. 部署用的 main 分支等要發佈時再 clone：`git clone -q --depth 1 https://github.com/GeorgePai/LeafofLegends /home/claude/leafoflegends`
4. 備援（GitHub 連不上時）：用 device 工具從 Mac 的 `source/` stage 進 `/home/claude/leafwar/`，再 `bash setup.sh`

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
| 04_audio | Web Audio 合成音效（含 tick/snap/coin/open）與 BGM |
| 05_map | 地圖場域、可走網格、導航 Dijkstra 流場、河道渲染、小地圖 |
| 06_fx / 06b_combat | 特效粒子；資料驅動戰鬥引擎（武器、傷害、狀態、技能） |
| 06c_vfx | **技能特效（v1.5）**：加色光暈 `G.glow`、元素分類 `G.elemOf/G.ELEM`、`G.VFX`（施法法陣 `cast`、增益 `buffCast`、投射物外觀 `drawProj`＋殘影 `p.hist`＋拖尾 `trail`、命中 `impact/hitSpark`、星芒 `spark`、光源 `light/groundLight`、電弧 `arc`、落雷 `bolt`、光束 `beam`、隕石 `meteor/meteorImpact`、大地 `quake`、地刺 `spikes`、裂痕 `cracks`、身上狀態 `auraBack/auraFront`）。技能投射物帶 `fx`（元素）與 `fxS`（進階版）；延遲事件一律用 `G.VFX.later`，不用 setTimeout |
| 07_world | 單位、AI、兵線、英雄指令、經驗升級、召集跟隨 `toggleFollow/followAI`、獵手 AI 分派 |
| 07b_systems | 技能升級、金幣/商店/背包、計時增益、野區、技能數值表 `G.skillRows`、**敵方獵手 `hunter`（`spawnHunter/junglerAI/hunterReward`）、塔傳送 `startTeleport/updateTeleport`** |
| 08_render | `R.resize`（固定比例＋整數倍）、`R.zoomMin`（可縮到全圖）、`R.hiQ/blitUI`、世界繪製（護盾光殼、稀有度外框、血條、準心、迷霧） |
| 09_ui | 戰鬥 HUD：HP/MP/XP 三條等粗、鑰匙＋K/D/A 列、小地圖 `mapDraw`＋展開大地圖 `bigMap`、戰鬥數據 `statPanel`、廣播 `drawNotices`、技能水平列＋置中鈕（大招上方）、長按技能卡（動畫，`cardC`）、增益卡、商店、左側道具欄（效果短標）、暫停選單（有名稱）；所有輸入（`evXY` 已扣黑邊）|
| 10_sandbox | 中文字工具 `G.cn/cnWrap`、標籤 `tagOf`、**技能展示沙盒 `G.Sandbox`（依技能類型的情境：`scBasic/scActive/scBuff/scPassive`，被動用對照演出）** |
| 11_menus | 首頁（大標題 5×7 字形 `TITLE_GLYPH`）、隊伍／圖鑑（共用轉盤 `cars.team/book`，橫屏轉盤高度依 `nameplateH`）、技能展示彈窗 `demoPanel`（動畫＋數值表 `lvTable`：整張一種版型、欄位對齊）、數值條 `G.statBars/G.statMax`、三欄陣容 `laneCols`、教學（4 類約 50 頁；`G.Menus.openGuide(fromBattle)`、`M._gt(t)` 測試用跳時間）；捲動狀態 `SM`/`SD` 分開 |
| 12_store | **商店／寶箱**：`G.CHESTS`（機率表）、`G.Store`（畫面、說明視窗、開箱動畫、寶箱像素圖 `drawChest`） |
| 13_ach | **成就（v1.7）**：`G.ACH`（43 個定義：c 分類、t 等級 1～4、g 目標、v 取值、hint 隱藏提示）、`G.Ach`（`P()` 檔案、`check/commit/tick/final/on/claim`、`recent`、`banner`）、`G.AchUI` 成就畫面、`G.Ach.drawBanner` |
| 14_save | **存檔碼（v1.7）**：`G.SaveCode`（`make/read/clean/apply/summary`）、`G.Dom`（疊在 canvas 上的 input/textarea，每幀 `place`，沒用到自動隱藏）、`G.SaveUI`（存檔畫面 home/name/code/load/confirm、`drawWelcome` 歡迎回來、`drawGreet` 開啟問候） |
| 15_intro | **開場動畫（v1.7）**：`G.Intro`（`draw/skip/reset/drawFlash`），約 2.45 秒＋白光淡出 |
| 99_main | 啟動與主迴圈（啟動後先進 `intro` 畫面） |

## 5. 版本摘要（細節見 CHANGELOG.md）
- v0.9～v1.2：地圖／河道／野區／首領、商店與道具、技能升級、隊伍與圖鑑轉盤、技能展示、召集、傳送、敵方獵手、寶箱與鑰匙、角色解鎖
- v1.3～v1.6.4：lanes5 地圖＋外中內主塔、視野迷霧、標籤系統、技能特效（06c_vfx）、固定畫面比例＋整數倍放大、小地圖／大地圖、戰鬥數據、廣播系統、教學電影格式
- v1.7～v1.9：開場動畫、首頁滾輪選單、成就 43 個、存檔碼、戰鬥結算、道具滾輪、改名 Leaf of Legends＋新 LOGO、GitHub Pages 部署
- v2.0～v2.1.3：中文字對齊像素格、mp3 BGM（−18 LUFS）、「點一下開始」、iPhone 加入主畫面提示、備份提醒、首頁曲預載修正（**v2.1.3 待 Pai 在 iPhone 確認**）
- v2.2：技能平衡層 `02c_balance.js`、升級廣播、敵方成長加強
- v2.3：立體按鈕／數值條、音量設定、首頁轉場、寶箱與開箱演出、免費賭徒寶箱、紅色敵人、地面層次、攻擊動作、技能前搖、特效延長

## 6. 待 Pai 決定
- 畫質再提升：A＝高解析文字（像素角色＋平滑字體），B＝提高像素解析度（480×270，整套美術重畫）。尚未選擇
- 圖鑑動畫重畫：Pai 說「有些動畫可以描繪得更好」，等他指定哪幾隻
- 暫定數值全部在 `VALUES.md`（最新：v2.3 段、v2.2 技能平衡段）

## 7. 工作規則
**每次更新流程**：改 src → build → `bash /home/claude/tools/tc_all.sh`（背景跑，0 筆才可交付）→ 只截有改到的畫面，用 `sheet.py` 拼成一張看 → 發佈 artifact（先 `get_artifact` 取 version，再 `publish_files`，index.html＝dist/index.html）→ 推 GitHub main（遊戲）＋ source（原始碼）→ 備份 Mac（`LeafofLegends.html`、`versions/LeafofLegends_v版本.zip`、有改到的 `source/` 檔案）→ 升版號
- 版本號在 `src/11_menus.js`（`'V2.3'`）
- 推 main：clone 到 `/home/claude/leafoflegends` → 複製 `dist/index.html` 成根目錄 `index.html`（保留 `.nojekyll`；音樂有改才更新 `audio/`）→ commit → `git -c push.negotiate=true push origin HEAD:main`，約 1～2 分鐘生效。備援：Pai 在 Mac Terminal 執行 `bash ~/Desktop/Claude/LeafofLegends/deploy_github.sh`
- 推 source：在 `/home/claude/leafwar` commit（dist/ 已在 .gitignore）→ `git -c push.negotiate=true push origin HEAD:source`
- 長時間指令（文字檢查等）一律用 Bash 的 `run_in_background`，不要用 nohup／`&` 丟著（回合結束會被砍掉），也不要用長 sleep 輪詢
- 測試：Playwright＋`/usr/bin/google-chrome`；裝置 n（360 寬手機）、m（390 手機）、L（手機橫屏）、d（1280×720）、w/u/t（大視窗／超寬／偏方）。可直接 `G.UI.screen='team'/'book'/'guide'`、`G.UI.start()` 進各畫面；`localStorage.clear()` 模擬新玩家；新增畫面時把場景加進 `tc_scenes.py`
- 測試輔助：`G.Menus._guideGo(分類, 頁)`、`G.Menus.menuWheel.go(i)`、`G.Menus._mt(秒)`、`G.Intro.t=秒數`、`G.Dom.el('name'|'code'|'load')`、`G.SaveUI.forceIos=true`
- 技能特效總覽：`python3 /home/claude/tools/vfxsheet.py "技能id,...|b=普攻" "時間點,..." out.png [角色名]`
- 角色介紹與技能說明在 `02b_text.js` 的 `G.TXT.uinfo / sinfo`（JSON，用 Python 讀寫最安全）
- 修改大檔用精準字串替換；**不要**用空字串當替換目標（曾把檔案炸成 18 萬行）

**省 token 守則**
- 讀程式先 `grep -n` 定位，再用 Read 的 offset/limit 只讀那幾十行；不要整份讀大檔（`11_menus.js` 143KB、`09_ui.js` 70KB）
- 工具輸出一律接 `tail`／`grep`／`head`，只看摘要
- 截圖只截改到的畫面，拼成一張再看；不要每個裝置每個畫面都單獨看
- 一個對話大約 2～3 個版本就建議 Pai「交接」，避免對話太長、每一輪越來越貴
- 回覆 Pai：繁中、結論先講、附作品連結、列出暫定數值

## 8. 設計守則（Pai 的要求，所有新設計都要遵守）
> 從 v0.9～v1.1 的回饋整理而來。做完新東西，先用這份逐條自我檢查再交付。

### A. 版面與排版
1. **手機直屏優先**：每個畫面都要在 390×844、360×780（窄手機）與桌機 1280×720 檢查；面板依螢幕寬度縮放並**置中**，絕不超出畫面。
2. **文字絕不重疊、擠壓、被遮住或被截斷**（Pai 的排版大忌）：所有可能變長的文字一律用 `G.cnWrap` / `G.cnBlock` 依容器寬度換行，容器高度跟著行數算，不可寫死單行；並以自動文字檢查工具驗證 0 筆。標籤與數值要分開；放不下就換行或改兩行排；說明文字不可被按鈕擋住；教學說明最多 3 行。
3. **對齊與一致**：同類元件大小一致（例：技能格統一大小）；小元件要置中（等級條、升級＋、點數條）；同一功能在各畫面用**同一個名稱**（例：「技能展示」）。
   - **表格欄位一定上下對齊**：整張表只用一種版型，不可以某一列單獨換版；放不下就整張改版（v1.5.1，Pai 列為大忌）
   - **彈出面板／資訊卡一律加黑色遮罩**，內容完整顯示在畫面內，不截斷行數（v1.5.1）
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
14. **畫面比例固定**：不論視窗大小，物件比例都一樣；電腦用整數倍放大保持像素清楚（v1.6.1～1.6.3）
15. **數值用數值條呈現**，和同類角色比較，讓強弱一眼看得出來；數字只當輔助。

### D. 內容與文字
16. **文字要像真人寫的**：台灣繁中、口語順暢、短句好懂；避免翻譯腔與拗口的 AI 文風；用台灣用語（例：馬鈴薯而非土豆）。
17. **標籤要有意義**：沒有資訊量的分類就拿掉，改用實際特性（近戰、遠程、範圍、吸血…）。
18. **展示要真的解釋到含義**：技能展示只放該招，不混普攻；範圍技要擺多個敵人呈現範圍；被動技用「原本 vs 有被動」對照，或用血條、魔力條加回復數字演出效果。

### E. 系統設計
19. 新機制要**簡單易懂、規則一句話講得完**；設計時直接給出合理的完整方案（機制、數量、數值、出現時機），不要只丟選項。
20. 自訂數值一律列為**暫定數值**，回覆時列出來請 Pai 確認，並寫進 `VALUES.md`。
21. 會影響平衡的新角色或系統，先用模擬跑幾分鐘遊戲驗證強度與頻率（例：獵手第一版太強，已調弱）；通知不可洗版。
22. 新的單位或分類要**同步加進圖鑑**；每個新功能都要**同步更新教學**。

### F. 交付
23. 照第 7 節流程：build → 測試（桌機＋直屏＋窄手機＋手機橫屏）→ 發佈 → 備份 Mac → 升版號。
24. 回覆用繁中、結論先講、精簡，附作品連結，列出暫定數值；我自己多做或改名的地方要說明，讓 Pai 決定要不要保留。

## 9. 交接 SOP（Pai 說「交接」時）
1. 更新本檔（版本、第 5 節摘要加一行、第 6 節待決、規則有變就改）；把該版細節寫進 `CHANGELOG.md`、新暫定數值寫進 `VALUES.md`。
2. 推 GitHub：source 分支（原始碼＋三份文件）、main 分支（遊戲）都確認是最新。
3. 備份到 Mac 的 `/Users/paiju/Desktop/Claude/LeafofLegends/`：`LeafofLegends.html`、`audio/`、`source/`（含三份文件）、`versions/LeafofLegends_v版本.zip`、本檔。
4. 回覆 Pai 一段「可直接貼上」的接手指令給下一個 session（範本如下）。
5. **Session 命名**：Claude 沒有改對話標題的工具，請 Pai 手動改（對話標題旁的選單 → 重新命名）：目前這個 → `LeafofLegends (retired)`；下一個 → `LeafofLegends (on-going)`（接手指令第一行寫明；接手的 session 回報就緒時再提醒一次）。

接手指令範本：
```
請把這個對話命名為「LeafofLegends (on-going)」。
繼續 Leaf of Legends 專案。照 HANDOFF.md 第 3 節接手：
add_repo(GeorgePai, LeafofLegends, push) →
git clone -q -b source --depth 1 https://github.com/GeorgePai/LeafofLegends /home/claude/leafwar && bash /home/claude/leafwar/setup.sh
讀 /home/claude/leafwar/HANDOFF.md（只讀這份；CHANGELOG.md、VALUES.md 需要時再查）。
作品：https://claude.ai/artifact/8vvJWeebvgfkNQDrYWXHAB（目前 V○○）；遊戲：https://georgepai.github.io/LeafofLegends/
設計前對照第 8 節；更新照第 7 節；我說「交接」照第 9 節。
準備好後用一句話回報版本與狀態，提醒我改名，然後等我的新需求。
```
