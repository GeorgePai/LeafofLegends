// ============================================================
// v2.9 角色專屬叫聲（仿 GB／GBA 寶可夢叫聲的做法）
// - 不用錄音檔：少數「基底叫聲」＋每隻角色自己的音高 p、長度 l、回聲 e、加料 add
//   （同一家族共用基底：力夫→精英力夫音比較低、比較長，一聽就知道是進化型）
// - 全部用 Web Audio 即時合成：脈衝波（8-bit 主音）、三角波、鋸齒波、濾波噪音
// - 圖鑑／隊伍轉盤停在某隻角色、或點中間那隻時播放；新的叫聲會把上一聲淡掉，不會疊成一團
// ============================================================
G.Cry = (() => {
  let A = null, bus = null, noiseBuf = null, duty = {}, cur = null;
  const wave = (d) => {                        // 脈衝波（d＝工作週期 0.125／0.25／0.5）
    if (duty[d]) return duty[d];
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
    return (duty[d] = A.createPeriodicWave(re, im));
  };
  function ensure() {
    const r = G.Audio.raw && G.Audio.raw(); if (!r) return false;
    if (A !== r.ac) { A = r.ac; duty = {}; noiseBuf = A.createBuffer(1, A.sampleRate, A.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    bus = r.bus; return true;
  }
  // 一個音：w 波形（p8/p4/p2＝脈衝、tri、saw、sin、sq、noise）、f 音高點（平均分布在 d 秒內）、v 音量
  // vib [速率, 深度比例]、lp 低通、bp 帶通中心（像母音的共鳴）、atk 起音
  function note(out, t0, n, P, L) {
    const d = n.d * L, at = t0 + (n.at || 0) * L, fs = n.f.map(f => Math.max(25, f * P)), g = A.createGain();
    let src, fNode;
    if (n.w === 'noise') {
      src = A.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      fNode = A.createBiquadFilter(); fNode.type = n.ft || 'bandpass'; fNode.Q.value = n.q || 2;
      fs.forEach((f, i) => i ? fNode.frequency.linearRampToValueAtTime(f, at + d * i / (fs.length - 1)) : fNode.frequency.setValueAtTime(f, at));
      src.connect(fNode); fNode.connect(g);
    } else {
      src = A.createOscillator();
      const W = { p8: 0.125, p4: 0.25, p2: 0.5 }[n.w];
      if (W) src.setPeriodicWave(wave(W)); else src.type = { tri: 'triangle', saw: 'sawtooth', sin: 'sine', sq: 'square' }[n.w] || 'square';
      fs.forEach((f, i) => i ? src.frequency[n.lin ? 'linearRampToValueAtTime' : 'exponentialRampToValueAtTime'](f, at + d * i / (fs.length - 1)) : src.frequency.setValueAtTime(f, at));
      if (n.vib) { const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = n.vib[0]; lg.gain.value = fs[0] * n.vib[1]; lfo.connect(lg); lg.connect(src.frequency); lfo.start(at); lfo.stop(at + d + 0.05); }
      let node = src;
      if (n.bp) { const b = A.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = n.bp * (n.bpFix ? 1 : P); b.Q.value = n.q || 1.4; node.connect(b); node = b; }
      if (n.lp) { const b = A.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = n.lp; node.connect(b); node = b; }
      node.connect(g);
    }
    const v = n.v || 0.14, atk = Math.min((n.atk || 0.012) * L, d * 0.5);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + atk);
    if (n.hold) g.gain.setValueAtTime(v, at + d * n.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    g.connect(out); src.start(at); src.stop(at + d + 0.05);
  }
  const N = (w, f, d, at, v, o) => Object.assign({ w, f, d, at, v }, o || {});
  // ---------- 基底叫聲 ----------
  const BASE = {
    // 植物英雄：開朗的「噗咿～！」（上揚→小小落下）
    sprout: [N('p4', [520, 880, 760], 0.11, 0, 0.13), N('p4', [690, 1180, 1050, 1110], 0.22, 0.12, 0.13, { vib: [16, 0.025], hold: 0.5 }), N('tri', [260, 440, 520], 0.32, 0, 0.09)],
    // 快速：兩聲短促的「啾啾！」
    zip: [N('p8', [900, 1500], 0.06, 0, 0.12), N('p8', [1000, 1700, 1500], 0.1, 0.08, 0.12), N('noise', [5000, 8000], 0.06, 0.07, 0.05, { ft: 'highpass' })],
    // 刺擊：銳利的吆喝「呀！」
    yah: [N('saw', [330, 620, 560], 0.2, 0, 0.1, { bp: 900, q: 1.2, hold: 0.4 }), N('p4', [660, 1240, 1100], 0.16, 0.02, 0.07), N('noise', [3000, 1500], 0.08, 0, 0.06)],
    // 調皮：彈跳的三連音「嘻嘻嘻」
    giggle: [N('p4', [880, 1100], 0.06, 0, 0.11), N('p4', [990, 1320], 0.06, 0.08, 0.11), N('p4', [1100, 1480, 1320], 0.12, 0.16, 0.12), N('tri', [440, 660], 0.26, 0, 0.06)],
    // 力量：低沉的「哼－哈！」
    hup: [N('sq', [180, 150], 0.1, 0, 0.12, { lp: 900 }), N('sq', [200, 330, 260], 0.2, 0.13, 0.15, { lp: 1200, hold: 0.4 }), N('noise', [600, 200], 0.12, 0.13, 0.12, { ft: 'lowpass' })],
    // 死靈：飄忽、下沉、帶顫音的低語
    wraith: [N('saw', [520, 470, 300, 220], 0.7, 0, 0.07, { vib: [6, 0.04], lp: 1400, atk: 0.12 }), N('saw', [523, 468, 303, 218], 0.7, 0, 0.06, { vib: [5.3, 0.05], lp: 1400, atk: 0.12 }), N('noise', [2500, 900], 0.6, 0.05, 0.05, { q: 6 }), N('sin', [1040, 880], 0.4, 0.15, 0.04, { vib: [9, 0.02] })],
    // 風扇：嗡嗡轉起來
    whirr: [N('sq', [140, 260, 240], 0.32, 0, 0.08, { vib: [32, 0.12], lp: 1600, atk: 0.08 }), N('noise', [900, 2600, 2200], 0.32, 0, 0.08, { q: 3, atk: 0.08 })],
    // 射手：「啵」＋短啾
    pop: [N('sin', [500, 160], 0.06, 0, 0.22), N('noise', [1800, 600], 0.04, 0, 0.1), N('p4', [1200, 1800], 0.08, 0.07, 0.09)],
    // 雙生花：兩個聲音一起唱（三度和聲）
    twin: [N('p4', [660, 990, 880], 0.24, 0, 0.1, { vib: [12, 0.02] }), N('p4', [830, 1245, 1110], 0.24, 0.03, 0.08, { vib: [12, 0.02] })],
    // 樹木：空心木頭的叩叩聲＋低沉嘎吱
    wood: [N('sin', [300, 260], 0.07, 0, 0.2, { bp: 320, q: 6 }), N('sin', [240, 200], 0.08, 0.11, 0.2, { bp: 260, q: 6 }), N('saw', [90, 110, 80], 0.38, 0.05, 0.06, { lp: 500, vib: [7, 0.06] })],
    // 穿刺：金屬「鏘～」
    zing: [N('tri', [1500, 1500], 0.3, 0, 0.1, { vib: [24, 0.008] }), N('sin', [2260, 2240], 0.28, 0, 0.05), N('noise', [6000, 3000], 0.05, 0, 0.08, { ft: 'highpass' })],
    // 彈簧：「啵嚶～」
    boing: [N('tri', [200, 600, 300, 450, 360], 0.36, 0, 0.16, { lin: 1 }), N('sin', [100, 70], 0.08, 0, 0.18)],
    // 火：劈啪＋往上竄
    fire: [N('noise', [500, 3000, 1200], 0.4, 0, 0.12, { q: 1.5 }), N('saw', [220, 520, 380], 0.3, 0.04, 0.06, { lp: 2000 }), N('noise', [7000], 0.03, 0.06, 0.07, { ft: 'highpass' }), N('noise', [7000], 0.03, 0.17, 0.06, { ft: 'highpass' })],
    // 陽光：明亮的琶音
    shine: [N('p8', [1047], 0.07, 0, 0.09), N('p8', [1319], 0.07, 0.05, 0.09), N('p8', [1568], 0.07, 0.1, 0.09), N('sin', [2093, 2093], 0.3, 0.15, 0.06, { vib: [8, 0.01] })],
    // 冰：清脆的鈴聲
    frost: [N('sin', [1760, 1760], 0.4, 0, 0.09), N('sin', [2637, 2637], 0.32, 0.03, 0.05), N('tri', [3520, 3400], 0.25, 0.06, 0.03), N('noise', [8000, 6000], 0.2, 0, 0.03, { ft: 'highpass' })],
    // 毒／吸血：黏答答、晃來晃去
    goo: [N('sq', [220, 160, 200, 140], 0.42, 0, 0.09, { vib: [7, 0.1], lp: 800, lin: 1 }), N('sin', [110, 80], 0.42, 0, 0.12, { vib: [7, 0.1] })],
    // 熊：喉嚨低吼
    growl: [N('saw', [120, 170, 140, 100], 0.5, 0, 0.13, { lp: 700, vib: [28, 0.05], atk: 0.05 }), N('noise', [400, 600, 300], 0.5, 0, 0.12, { q: 2, atk: 0.05 }), N('sq', [60, 85, 50], 0.5, 0, 0.06, { lp: 300 })],
    // 鼠：短促吱吱
    squeak: [N('sin', [2200, 2900, 2500], 0.06, 0, 0.12), N('sin', [2400, 3200, 2600], 0.07, 0.09, 0.12)],
    // 猛禽：尖銳長嘯（下滑）
    screech: [N('saw', [1800, 2400, 1500], 0.38, 0, 0.07, { bp: 2400, q: 2, vib: [30, 0.02] }), N('noise', [3500, 2000], 0.3, 0, 0.06, { q: 4 })],
    // 烏鴉：沙啞的「嘎！嘎！」
    caw: [N('saw', [700, 560], 0.13, 0, 0.11, { bp: 1100, q: 1.5, vib: [55, 0.05] }), N('saw', [680, 520], 0.15, 0.18, 0.11, { bp: 1100, q: 1.5, vib: [55, 0.05] }), N('noise', [1500, 900], 0.3, 0, 0.05)],
    // 蝙蝠：超音波滴滴
    sonar: [N('sin', [3800, 4600], 0.03, 0, 0.09), N('sin', [3800, 4600], 0.03, 0.06, 0.08), N('sin', [3800, 4600], 0.03, 0.12, 0.07), N('p8', [1600, 900], 0.15, 0.17, 0.05)],
    // 豬：鼻音「噗嚕」
    oink: [N('sq', [260, 330, 220], 0.12, 0, 0.12, { lp: 1100, vib: [40, 0.08] }), N('sq', [240, 300, 200], 0.14, 0.15, 0.12, { lp: 1000, vib: [40, 0.08] }), N('noise', [800, 400], 0.25, 0, 0.06, { q: 3 })],
    // 狗：「汪汪！」
    bark: [N('sq', [500, 380], 0.08, 0, 0.13, { bp: 800, q: 1.2 }), N('noise', [1200, 500], 0.07, 0, 0.09), N('sq', [520, 400], 0.09, 0.14, 0.13, { bp: 800, q: 1.2 }), N('noise', [1200, 500], 0.07, 0.14, 0.09)],
    // 狼：仰天長嚎
    howl: [N('tri', [330, 560, 600, 520, 380], 0.8, 0, 0.13, { vib: [5.5, 0.02], atk: 0.12, hold: 0.6 }), N('sin', [660, 1120, 1200, 1040, 760], 0.8, 0, 0.04, { vib: [5.5, 0.02], atk: 0.12 })],
    // 格羅姆：聽不懂的咕嚕咒語（音高跳來跳去）
    gibber: [N('p4', [500, 700], 0.06, 0, 0.1, { bp: 900 }), N('p4', [420, 300], 0.06, 0.08, 0.1, { bp: 700 }), N('p4', [760, 900], 0.06, 0.16, 0.1, { bp: 1100 }), N('p4', [600, 380], 0.1, 0.24, 0.1, { bp: 800 }), N('sin', [1200, 2400], 0.12, 0.3, 0.04)],
    // 猩猩：「嗚嗚！」＋捶胸
    chest: [N('tri', [240, 300], 0.12, 0, 0.14), N('tri', [270, 340], 0.14, 0.14, 0.14), N('sin', [90, 50], 0.07, 0.3, 0.3), N('sin', [90, 50], 0.07, 0.38, 0.3), N('sin', [90, 50], 0.07, 0.46, 0.3)],
    // 猴子：「嗚嗚啊啊！」往上爬
    monkey: [N('p4', [500, 600], 0.07, 0, 0.1), N('p4', [600, 720], 0.07, 0.08, 0.1), N('p4', [720, 900], 0.07, 0.16, 0.1), N('p4', [900, 1300, 1100], 0.16, 0.24, 0.11, { vib: [20, 0.03] })],
    // 河馬：低沉的「噗哦～」
    honk: [N('sq', [110, 140, 120], 0.45, 0, 0.13, { lp: 600, atk: 0.04, hold: 0.5 }), N('sq', [220, 280, 240], 0.45, 0, 0.05, { bp: 500, q: 2 })],
    // 牛：「哞～」
    moo: [N('saw', [140, 170, 150, 120], 0.6, 0, 0.11, { bp: 420, q: 2, atk: 0.08, hold: 0.6 }), N('saw', [141, 171, 151, 121], 0.6, 0, 0.06, { lp: 400, atk: 0.08 })],
    // 大貓：咆哮
    roar: [N('noise', [500, 1600, 700], 0.55, 0, 0.17, { q: 1.2, atk: 0.04 }), N('saw', [130, 240, 160, 110], 0.55, 0, 0.12, { lp: 900, vib: [22, 0.04], atk: 0.04 }), N('sq', [65, 95, 55], 0.55, 0, 0.07, { lp: 250 })],
    // 山貓：「喵嗚～」
    meow: [N('saw', [600, 900, 700, 520], 0.38, 0, 0.09, { bp: 1300, q: 1.8, atk: 0.04, vib: [6, 0.015] }), N('tri', [600, 900, 700, 520], 0.38, 0, 0.05)],
    // 企鵝：鼻音「嘎嘎」
    squawk: [N('p8', [700, 900, 760], 0.1, 0, 0.11, { bp: 1300 }), N('p8', [760, 960, 800], 0.12, 0.13, 0.11, { bp: 1300 }), N('noise', [2500, 1800], 0.05, 0, 0.05)],
    // 烏龜：慢吞吞的「啵～嚕」
    blub: [N('sin', [180, 300], 0.12, 0, 0.16), N('sin', [160, 280], 0.14, 0.2, 0.15), N('tri', [90, 70], 0.4, 0, 0.08, { lp: 300 })],
    // 鱷魚：嘶～＋喀嚓
    hiss: [N('noise', [5000, 3000], 0.45, 0, 0.1, { ft: 'highpass', atk: 0.05, hold: 0.6 }), N('noise', [800, 300], 0.06, 0.42, 0.25, { q: 1 }), N('sin', [160, 60], 0.08, 0.42, 0.2)],
    // 塔：機械嗶嗶＋低頻嗡
    mech: [N('sq', [880, 880], 0.06, 0, 0.08, { lp: 3000 }), N('sq', [660, 660], 0.06, 0.09, 0.08, { lp: 3000 }), N('sq', [110, 110], 0.35, 0, 0.06, { lp: 400, vib: [12, 0.01] }), N('noise', [300, 200], 0.35, 0, 0.05, { ft: 'lowpass' })]
  };
  // 加料：在基底上再疊一點特色
  const ADD = {
    boom: [N('noise', [1600, 150], 0.4, 0.22, 0.16, { ft: 'lowpass' }), N('sin', [110, 40], 0.35, 0.22, 0.2)],
    roar: [N('noise', [600, 300], 0.3, 0.1, 0.1, { q: 1.5 })],
    fire: [N('noise', [7000], 0.03, 0.05, 0.06, { ft: 'highpass' }), N('noise', [600, 2400], 0.3, 0.1, 0.07, { q: 1.5 })],
    ice: [N('sin', [2637, 2637], 0.3, 0.12, 0.04), N('sin', [3520, 3500], 0.25, 0.16, 0.025)],
    zing: [N('tri', [1800, 1800], 0.2, 0.15, 0.05)],
    snort: [N('noise', [1200, 400], 0.15, 0.32, 0.12, { q: 2 })],
    thump: [N('sin', [90, 45], 0.08, 0.3, 0.25)],
    sparkle: [N('sin', [2093, 2093], 0.15, 0.2, 0.04), N('sin', [2637, 2637], 0.15, 0.26, 0.035)],
    giggle: [N('p4', [1100, 1400], 0.05, 0.3, 0.06), N('p4', [1200, 1500], 0.05, 0.37, 0.06)]
  };
  // ---------- 每隻角色：[基底, 音高 p, 長度 l, 回聲, 加料] ----------
  const V = {
    // 英雄（同家族共用基底；進化型音更低、更長、有回聲）
    leafy: ['sprout', 1, 1], eliteleafy: ['sprout', 0.84, 1.15, 1, 'sparkle'],
    quickleafy: ['zip', 1, 0.9], elitequickleafy: ['zip', 0.86, 1.05, 1],
    spearleafy: ['yah', 1, 1], elitespearleafy: ['yah', 0.84, 1.15, 1, 'zing'],
    splashleafy: ['giggle', 1, 1], cannonleafy: ['giggle', 0.78, 1.2, 0, 'boom'],
    muscleleafy: ['hup', 1, 1], berserkerleafy: ['hup', 0.8, 1.15, 1, 'roar'],
    necroleafy: ['wraith', 1, 1, 1],
    // 小兵與傭兵
    leafblower: ['whirr', 1.1, 0.9], potatoblower: ['whirr', 0.72, 1, 0, 'thump'],
    seedshooter: ['pop', 1, 1], peasniper: ['pop', 1.3, 0.8, 1], elitepeasniper: ['pop', 1.05, 1, 1, 'zing'],
    twinflower: ['twin', 1, 1],
    treeprotector: ['wood', 1, 1], leafmuscle: ['wood', 0.85, 0.9, 0, 'thump'], leaftanker: ['wood', 0.62, 1.35], treestun: ['wood', 0.72, 1.2, 1],
    stemskewer: ['zing', 1, 1], fruitpult: ['boing', 1, 1],
    flame: ['fire', 1.25, 0.9], flametree: ['fire', 0.72, 1.25, 0, 'thump'],
    sunshooter: ['shine', 1, 1], iceshooter: ['frost', 1, 1], poisonshooter: ['goo', 1.3, 0.85], vampireflower: ['goo', 0.85, 1.1, 1],
    // 敵人（小怪與首領）
    babybear: ['growl', 1.7, 0.55], bear: ['growl', 1, 1], bigbear: ['growl', 0.74, 1.35, 1], polarbear: ['growl', 0.66, 1.4, 1, 'ice'],
    firebear: ['growl', 0.88, 1.1, 0, 'fire'], spearbear: ['growl', 0.95, 1, 0, 'zing'],
    mouse: ['squeak', 1, 1], whitemouse: ['squeak', 1.25, 0.8], chipmunk: ['squeak', 0.9, 0.7, 0, 'giggle'],
    eagle: ['screech', 1, 1], raven: ['caw', 1, 1], blackvulture: ['caw', 0.75, 1.2, 1],
    bat: ['sonar', 1, 1], vampirebat: ['sonar', 0.8, 1.1, 1],
    boar: ['oink', 1, 1], bigboar: ['oink', 0.72, 1.3, 0, 'snort'],
    dog: ['bark', 1.15, 0.9], madwolf: ['howl', 1, 1], hunter: ['howl', 0.84, 1.15, 1, 'roar'],
    gnomebaby: ['gibber', 1.35, 0.8], gnome: ['gibber', 1, 1, 1], firegnome: ['gibber', 0.85, 1.05, 1, 'fire'],
    gorilla: ['chest', 1, 1], monkey: ['monkey', 1.1, 0.9], smartmonkey: ['monkey', 0.95, 1, 0, 'giggle'],
    hippo: ['honk', 1, 1], buffalo: ['moo', 1, 1], madbuffalo: ['moo', 0.85, 0.9, 0, 'snort'], splashbuffalo: ['moo', 0.92, 1, 0, 'fire'],
    tiger: ['roar', 1.1, 0.9], lion: ['roar', 0.8, 1.3, 1],
    cat: ['meow', 1, 1], penguin: ['squawk', 1, 1], turtle: ['blub', 1, 1], crocodile: ['hiss', 1, 1], kangaroo: ['boing', 0.8, 0.9, 0, 'thump'],
    // 塔（越內層越低沉）
    player_tower: ['mech', 1.1, 1], mushroom_tower: ['mech', 1.3, 0.8], enemy_tower: ['mech', 0.95, 1], enemy_tower2: ['mech', 0.85, 1.1], enemy_tower3: ['mech', 0.75, 1.2], enemy_tower4: ['mech', 0.62, 1.35, 1]
  };
  // 整體拉長（寶可夢叫聲約 0.5～1 秒）、濾波後比較小聲的基底補音量（用離線算圖量過峰值，對齊到約 0.15～0.25）
  const LEN = 1.5, BGAIN = { whirr: 1.6, moo: 1.5, bark: 1.3, squeak: 1.3, squawk: 3.5, gibber: 3.5, meow: 3, screech: 3.5, caw: 2.5, sonar: 2, shine: 2.2, fire: 2, twin: 2, zip: 1.8, monkey: 1.8, wraith: 2, giggle: 1.3, frost: 1.3, yah: 1.4 };
  const EXTRA = {};                            // 之後新增的角色（關卡新敵人等）用 G.Cry.add 登記
  const spec = n => V[n] || EXTRA[n] || null;
  function play(name, vol = 1) {
    const s = spec(name); if (!s || !ensure()) return false;
    const [b, P, L0, echo, add] = s, L = L0 * LEN, t0 = A.currentTime + 0.01;
    if (cur) { try { cur.gain.cancelScheduledValues(t0); cur.gain.setTargetAtTime(0.0001, t0, 0.025); } catch (e) { } }
    const out = A.createGain(); out.gain.value = 0.9 * vol * (BGAIN[b] || 1); out.connect(bus); cur = out;
    const notes = BASE[b].concat(add ? ADD[add] : []);
    notes.forEach(n => note(out, t0, n, P, L));
    if (echo) { const eg = A.createGain(); eg.gain.value = 0.32; eg.connect(out); notes.forEach(n => note(eg, t0 + 0.11 * L, n, P, L)); }   // 回聲：同一聲晚一點、小聲一點
    return true;
  }
  return { play, has: n => !!spec(n), add: (n, s) => { EXTRA[n] = s; }, BASE, V };
})();
