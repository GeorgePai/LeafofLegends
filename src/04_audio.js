'use strict';
/* =========================================================
   音效 & 背景音樂：全部 Web Audio 即時合成（無外部檔案）
   新增音效：在 SFX 物件加一個函式即可
   ========================================================= */
G.Audio = (() => {
  let ac = null, master, sfxBus, bgmBus, comp, noiseBuf, pulse25, musicBus;
  const MUSIC_VOL = 0.5;                          // 所有 BGM 共用同一個音量（檔案已統一響度 −18 LUFS）
  let muted = false;
  // 玩家音量（0～1，v2.3）：音樂、音效分開調；存在 localStorage
  const VOL = { music: 1, sfx: 1 };
  try { const v = JSON.parse(localStorage.getItem('leafwar_vol') || 'null'); if (v) { if (v.music >= 0) VOL.music = Math.min(1, v.music); if (v.sfx >= 0) VOL.sfx = Math.min(1, v.sfx); } } catch (e) { }
  const last = {}; let voices = 0;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55 * VOL.sfx;
    bgmBus = ac.createGain(); bgmBus.gain.value = 0.32;
    sfxBus.connect(comp); bgmBus.connect(comp); comp.connect(master); master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = MUSIC_VOL * VOL.music; musicBus.connect(master);   // 背景音樂（mp3）不經過壓縮器，音量固定
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 25% 方波（8-bit 主旋律）
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    pulse25 = ac.createPeriodicWave(re, im);
    // v2.0 起背景音樂改用 mp3（見下方 Music），合成 BGM 不再啟動
  }
  const now = () => ac.currentTime;

  // 基本元件
  function osc(type, f0, f1, t0, dur, vol, bus = sfxBus, opt = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (type === 'pulse') o.setPeriodicWave(pulse25); else o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opt.atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (opt.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.lp; o.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    o.start(t0); o.stop(t0 + dur + 0.05);
    voices++; o.onended = () => voices--;
  }
  function noise(t0, dur, vol, ftype, f0, f1, q = 1, bus = sfxBus) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
    voices++; s.onended = () => voices--;
  }

  const SFX = {
    magic: t => { osc('sine', 1100, 420, t, 0.13, 0.22); osc('triangle', 2200, 900, t, 0.06, 0.06); },
    magic2: t => { osc('sine', 600, 1400, t, 0.18, 0.25); osc('square', 300, 700, t, 0.12, 0.05, sfxBus, { lp: 2000 }); noise(t, 0.2, 0.08, 'bandpass', 3000, 6000, 3); },
    seed: t => { osc('square', 1400, 500, t, 0.05, 0.08, sfxBus, { lp: 3000 }); },
    tower: t => { osc('square', 240, 90, t, 0.16, 0.12, sfxBus, { lp: 900 }); noise(t, 0.12, 0.1, 'lowpass', 1200, 300); },
    lob: t => { osc('triangle', 300, 520, t, 0.15, 0.15); noise(t, 0.1, 0.05, 'bandpass', 1500, 800, 2); },
    hit: t => { noise(t, 0.07, 0.25, 'bandpass', 1800, 700, 1.2); osc('sine', 180, 70, t, 0.07, 0.18); },
    blow: t => { noise(t, 0.09, 0.3, 'lowpass', 2200, 400); osc('sine', 140, 50, t, 0.1, 0.3); },
    crit: t => { noise(t, 0.12, 0.35, 'bandpass', 3500, 900, 0.8); osc('square', 900, 200, t, 0.1, 0.08, sfxBus, { lp: 2500 }); osc('sine', 120, 40, t, 0.15, 0.35); },
    boom: t => { noise(t, 0.6, 0.5, 'lowpass', 2500, 120); osc('sine', 110, 30, t, 0.5, 0.6); osc('square', 70, 30, t, 0.25, 0.1, sfxBus, { lp: 400 }); },
    slam: t => { osc('sine', 140, 35, t, 0.45, 0.6); noise(t, 0.5, 0.35, 'lowpass', 900, 80); noise(t, 0.2, 0.15, 'bandpass', 2400, 600, 1); },
    meteor: t => { noise(t, 0.75, 0.22, 'bandpass', 300, 2600, 2); osc('sawtooth', 120, 260, t, 0.7, 0.04, sfxBus, { lp: 700, atk: 0.4 }); },
    thunder: t => {
      for (let i = 0; i < 5; i++) noise(t + i * 0.035, 0.05, 0.35 - i * 0.05, 'highpass', 2500, 900, 0.7);
      noise(t + 0.05, 0.7, 0.35, 'lowpass', 1400, 80); osc('sine', 90, 35, t + 0.04, 0.5, 0.4);
    },
    punch: t => { noise(t, 0.12, 0.2, 'bandpass', 900, 2500, 1.5); osc('square', 200, 400, t, 0.1, 0.08, sfxBus, { lp: 1500 }); },
    die: t => { noise(t, 0.18, 0.2, 'lowpass', 1600, 150); osc('square', 400, 90, t, 0.15, 0.05, sfxBus, { lp: 1200 }); },
    building: t => { noise(t, 0.9, 0.45, 'lowpass', 1800, 60); osc('sine', 80, 25, t, 0.9, 0.6); },
    spawn: t => { osc('sine', 320, 720, t, 0.09, 0.1); },
    level: t => { [523, 659, 784, 1047, 1319].forEach((f, i) => osc('pulse', f, f, t + i * 0.07, 0.16, 0.12, sfxBus, { lp: 4000 })); osc('triangle', 262, 262, t, 0.5, 0.15); },
    ready: t => { osc('sine', 1568, 1568, t, 0.12, 0.08); osc('sine', 2093, 2093, t + 0.06, 0.15, 0.07); },
    click: t => { osc('square', 900, 700, t, 0.03, 0.05, sfxBus, { lp: 3000 }); },
    deny: t => { osc('square', 160, 120, t, 0.12, 0.08, sfxBus, { lp: 900 }); },
    coin: t => { osc('square', 1318, 1318, t, 0.05, 0.06, sfxBus, { lp: 5000 }); osc('square', 1760, 1760, t + 0.05, 0.12, 0.06, sfxBus, { lp: 5000 }); },
    tick: t => { noise(t, 0.012, 0.35, 'highpass', 4200, 3800, 0.8); osc('square', 2400, 1800, t, 0.012, 0.05, sfxBus, { lp: 6000 }); osc('sine', 180, 120, t, 0.03, 0.12); },
    snap: t => { noise(t, 0.02, 0.4, 'bandpass', 2600, 2000, 2); osc('sine', 320, 160, t, 0.06, 0.2); },
    open: t => { osc('triangle', 520, 780, t, 0.08, 0.12); osc('triangle', 780, 1040, t + 0.06, 0.08, 0.1); },
    potion: t => { [700, 900, 1200].forEach((f, i) => osc('sine', f, f * 1.2, t + i * 0.05, 0.1, 0.1)); },
    warn: t => { osc('square', 440, 440, t, 0.12, 0.06, sfxBus, { lp: 1500 }); osc('square', 440, 440, t + 0.2, 0.12, 0.06, sfxBus, { lp: 1500 }); },
    win: t => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => osc('pulse', f, f, t + i * 0.11, 0.25, 0.12, sfxBus, { lp: 4000 })); },
    lose: t => { [392, 370, 349, 262].forEach((f, i) => osc('triangle', f, f * 0.98, t + i * 0.22, 0.4, 0.18)); },
    lock: t => { osc('square', 1800, 1800, t, 0.05, 0.05, sfxBus, { lp: 4000 }); osc('square', 2400, 2400, t + 0.07, 0.07, 0.05, sfxBus, { lp: 4000 }); },
    step: t => { noise(t, 0.03, 0.03, 'bandpass', 900, 600, 2); },
    fire: t => { noise(t, 0.3, 0.25, 'bandpass', 600, 2400, 1.2); osc('sawtooth', 180, 90, t, 0.25, 0.05, sfxBus, { lp: 900 }); },
    ice: t => { osc('sine', 2400, 1800, t, 0.12, 0.08); osc('triangle', 3200, 2600, t + 0.03, 0.1, 0.05); noise(t, 0.1, 0.06, 'highpass', 5000, 5000, 1); },
    shield: t => { osc('sine', 440, 880, t, 0.3, 0.12); osc('sine', 660, 1320, t + 0.05, 0.3, 0.08); },
    // 寶箱與鑰匙
    chestShake: t => { noise(t, 0.07, 0.3, 'bandpass', 700, 450, 2.5); osc('square', 140, 110, t, 0.06, 0.06, sfxBus, { lp: 600 }); noise(t + 0.05, 0.04, 0.15, 'highpass', 3000, 2500, 1); },
    chestOpen: t => { noise(t, 0.45, 0.35, 'bandpass', 300, 5000, 0.9); osc('triangle', 392, 1568, t, 0.35, 0.18); osc('sine', 98, 49, t, 0.4, 0.4); },
    fanfare0: t => { [659, 784].forEach((f, i) => osc('pulse', f, f, t + i * 0.09, 0.18, 0.1, sfxBus, { lp: 4000 })); },
    fanfare1: t => { [784, 988, 1175, 1568].forEach((f, i) => osc('pulse', f, f, t + i * 0.08, 0.2, 0.11, sfxBus, { lp: 4500 })); },
    fanfare2: t => { [659, 831, 988, 1319, 1661, 1976].forEach((f, i) => osc('pulse', f, f, t + i * 0.075, 0.24, 0.11, sfxBus, { lp: 5000 })); osc('triangle', 330, 330, t, 0.7, 0.14); },
    fanfare3: t => { [523, 659, 784, 1047, 1319, 1568, 2093, 2637].forEach((f, i) => osc('pulse', f, f, t + i * 0.07, 0.3, 0.12, sfxBus, { lp: 6000 })); osc('triangle', 262, 262, t, 1.1, 0.18); osc('triangle', 392, 392, t + 0.3, 0.9, 0.12); for (let i = 0; i < 6; i++) noise(t + 0.5 + i * 0.09, 0.08, 0.08, 'highpass', 7000, 9000, 1); },
    dud: t => { osc('triangle', 392, 370, t, 0.25, 0.16); osc('triangle', 330, 300, t + 0.25, 0.25, 0.16); osc('triangle', 262, 220, t + 0.5, 0.45, 0.16); },
    keyDrop: t => { osc('sine', 2637, 2637, t, 0.08, 0.12); osc('sine', 3520, 3520, t + 0.07, 0.12, 0.1); noise(t, 0.25, 0.08, 'highpass', 6000, 9000, 1); osc('triangle', 1319, 2637, t, 0.18, 0.06); },
    keyGet: t => { [1568, 2093, 2637, 3136].forEach((f, i) => osc('sine', f, f, t + i * 0.045, 0.14, 0.11)); osc('square', 1047, 1047, t, 0.06, 0.04, sfxBus, { lp: 5000 }); },
    // 開場動畫：柔和的鈴聲與光點聲（參考 GBA 時代開場的閃光、精靈出場聲）
    opTwinkle: t => { const f = [1568, 1760, 2093, 2349, 2637, 3136][(Math.random() * 6) | 0]; osc('sine', f, f, t, 0.5, 0.045, sfxBus, { atk: 0.006 }); osc('sine', f * 2, f * 2, t, 0.25, 0.012, sfxBus, { atk: 0.006 }); },
    opLand: t => { osc('sine', 1046, 1046, t, 0.9, 0.06, sfxBus, { atk: 0.01 }); osc('sine', 1568, 1568, t + 0.06, 0.9, 0.05, sfxBus, { atk: 0.01 }); osc('sine', 2093, 2093, t + 0.12, 1.0, 0.04, sfxBus, { atk: 0.01 }); noise(t, 0.6, 0.03, 'bandpass', 2500, 6000, 1.5); },
    opSwell: t => { noise(t, 0.6, 0.035, 'bandpass', 400, 2200, 0.9); osc('triangle', 262, 392, t, 0.6, 0.04, sfxBus, { atk: 0.25 }); },
    opPop: t => { osc('sine', 660, 1320, t, 0.18, 0.08, sfxBus, { atk: 0.005 }); osc('sine', 1760, 2637, t + 0.08, 0.35, 0.05, sfxBus, { atk: 0.005 }); noise(t, 0.25, 0.04, 'highpass', 4000, 8000, 1); },
    opStep: t => { osc('triangle', 220, 160, t, 0.06, 0.035, sfxBus, { atk: 0.004 }); },
    opClash: t => { [523, 659, 784, 1047].forEach((f, i) => osc('sine', f, f, t + i * 0.025, 1.4, 0.06, sfxBus, { atk: 0.008 })); osc('sine', 110, 70, t, 0.5, 0.18, sfxBus, { atk: 0.01 }); noise(t, 1.0, 0.04, 'highpass', 5000, 9000, 1); },
    // v2.5 開場：戰鼓、首領咆哮、衝鋒
    opDrum: t => { osc('sine', 90, 50, t, 0.25, 0.22); noise(t, 0.12, 0.12, 'lowpass', 600, 150); osc('sine', 90, 50, t + 0.18, 0.18, 0.12); },
    opStomp: t => { osc('sine', 120, 35, t, 0.35, 0.45); noise(t, 0.25, 0.3, 'lowpass', 1200, 80); noise(t, 0.04, 0.15, 'bandpass', 2500, 1500, 2); },
    opRoar: t => { noise(t, 0.7, 0.3, 'bandpass', 250, 120, 1.5); osc('sawtooth', 110, 60, t, 0.7, 0.08, sfxBus, { lp: 500, atk: 0.05 }); osc('sine', 55, 40, t, 0.7, 0.2); },
    opCharge: t => { noise(t, 0.45, 0.12, 'bandpass', 400, 3000, 1); osc('sawtooth', 110, 330, t, 0.45, 0.05, sfxBus, { lp: 1600, atk: 0.3 }); for (let i = 0; i < 6; i++) noise(t + i * 0.07, 0.05, 0.06, 'bandpass', 900, 600, 2); },
    swoosh: t => { noise(t, 0.32, 0.12, 'bandpass', 600, 3200, 1.2); noise(t + 0.05, 0.25, 0.05, 'highpass', 2500, 6000, 0.8); },
    charge: t => { osc('sine', 330, 990, t, 0.26, 0.07, sfxBus, { atk: 0.2 }); noise(t, 0.26, 0.05, 'bandpass', 1500, 5000, 2); },
    chargeBig: t => { osc('sine', 220, 880, t, 0.48, 0.09, sfxBus, { atk: 0.4 }); osc('triangle', 110, 220, t, 0.48, 0.08, sfxBus, { atk: 0.35 }); noise(t, 0.48, 0.07, 'bandpass', 800, 6000, 1.5); },
    // v2.4 藥水：喝下（咕嚕）＋各自的效果音
    gulp: t => { osc('sine', 300, 520, t, 0.07, 0.12); osc('sine', 360, 640, t + 0.08, 0.08, 0.1); noise(t, 0.05, 0.05, 'bandpass', 900, 1400, 3); },
    pot_hp: t => { [523, 659, 784].forEach((f, i) => osc('sine', f, f * 1.01, t + i * 0.06, 0.35, 0.08, sfxBus, { atk: 0.02 })); osc('triangle', 262, 262, t, 0.4, 0.08); },
    pot_mp: t => { [1047, 1319, 1568, 2093].forEach((f, i) => osc('sine', f, f, t + i * 0.05, 0.25, 0.06, sfxBus, { atk: 0.01 })); noise(t, 0.3, 0.04, 'highpass', 5000, 8000, 1); },
    pot_del: t => { [880, 1109, 1319, 1760].forEach((f, i) => osc('square', f, f, t + i * 0.035, 0.06, 0.04, sfxBus, { lp: 5000 })); },
    pot_crit: t => { osc('sine', 2637, 2637, t, 0.35, 0.08); osc('sine', 3951, 3951, t + 0.02, 0.25, 0.04); noise(t, 0.08, 0.15, 'highpass', 6000, 9000, 1); },
    pot_arm: t => { osc('triangle', 196, 196, t, 0.5, 0.12, sfxBus, { atk: 0.05 }); osc('sine', 784, 523, t + 0.3, 0.3, 0.07); noise(t + 0.3, 0.06, 0.12, 'bandpass', 2500, 1500, 3); },
    pot_pow: t => { osc('sine', 110, 55, t, 0.3, 0.3); noise(t, 0.4, 0.15, 'bandpass', 400, 2000, 1); osc('sawtooth', 110, 220, t + 0.05, 0.35, 0.04, sfxBus, { lp: 900, atk: 0.2 }); },
    pot_spd: t => { noise(t, 0.3, 0.14, 'bandpass', 800, 4000, 1.2); osc('sine', 600, 1400, t, 0.2, 0.04); },
    pot_cdr: t => { for (let i = 0; i < 4; i++) osc('square', i % 2 ? 1800 : 2400, i % 2 ? 1800 : 2400, t + i * 0.12, 0.02, 0.04, sfxBus, { lp: 6000 }); osc('sine', 1568, 1568, t + 0.5, 0.4, 0.07); osc('sine', 2093, 2093, t + 0.55, 0.4, 0.05); },
    pot_xp: t => { [784, 880, 1047, 1175, 1319, 1568].forEach((f, i) => osc('triangle', f, f, t + i * 0.05, 0.14, 0.08)); },
    pot_wave: t => { osc('sawtooth', 196, 196, t, 0.35, 0.05, sfxBus, { lp: 1200, atk: 0.05 }); osc('sawtooth', 294, 294, t + 0.3, 0.5, 0.05, sfxBus, { lp: 1400, atk: 0.05 }); osc('triangle', 98, 98, t, 0.8, 0.08); },
    pot_inv: t => { [1047, 1319, 1568, 2093].forEach(f => osc('sine', f, f, t, 1.0, 0.05, sfxBus, { atk: 0.005 })); osc('sine', 262, 262, t, 0.6, 0.1); noise(t, 0.6, 0.05, 'highpass', 6000, 9000, 1); },
    pot_rev: t => { [523, 659, 784, 1047, 1319].forEach((f, i) => osc('sine', f, f, t + i * 0.08, 1.0, 0.06, sfxBus, { atk: 0.01 })); osc('triangle', 131, 262, t, 0.8, 0.12, sfxBus, { atk: 0.2 }); noise(t, 1.0, 0.04, 'highpass', 5000, 9000, 1); },
    // v2.4 被敵塔鎖定的警示音（兩聲急促的高音）
    alarm: t => { for (let i = 0; i < 2; i++) { osc('square', 1320, 1320, t + i * 0.13, 0.08, 0.07, sfxBus, { lp: 3000 }); osc('square', 990, 990, t + i * 0.13 + 0.04, 0.05, 0.05, sfxBus, { lp: 3000 }); } },
    // v2.4 結算：數字跳動（越跳越高）、一組完成、評價蓋章、勝利／失敗的開場和弦
    cnt: t => { const f = 1400 + Math.random() * 200; osc('square', f, f, t, 0.015, 0.025, sfxBus, { lp: 5000 }); },
    cntDone: t => { osc('sine', 1568, 1568, t, 0.18, 0.08); osc('sine', 2349, 2349, t + 0.03, 0.2, 0.05); noise(t, 0.04, 0.1, 'bandpass', 3000, 2000, 2); },
    rowIn: t => { noise(t, 0.08, 0.06, 'bandpass', 1500, 4000, 1.2); osc('triangle', 660, 880, t, 0.06, 0.05); },
    stamp: t => { osc('sine', 120, 40, t, 0.4, 0.5); noise(t, 0.3, 0.4, 'lowpass', 1500, 100); noise(t, 0.05, 0.25, 'bandpass', 3000, 1500, 1); [1047, 1319, 1568, 2093].forEach((f, i) => osc('pulse', f, f, t + 0.12 + i * 0.06, 0.3, 0.07, sfxBus, { lp: 5000 })); },
    endWin: t => { [392, 523, 659, 784].forEach((f, i) => osc('pulse', f, f, t + i * 0.09, 0.3, 0.09, sfxBus, { lp: 4000 })); [523, 659, 784, 1047].forEach(f => osc('triangle', f, f, t + 0.4, 1.4, 0.07, sfxBus, { atk: 0.02 })); osc('triangle', 131, 131, t + 0.4, 1.4, 0.12); noise(t + 0.4, 1.0, 0.05, 'highpass', 6000, 9000, 1); },
    endLose: t => { [330, 311, 294].forEach((f, i) => osc('triangle', f, f * 0.99, t + i * 0.3, 0.5, 0.12)); [220, 262, 330].forEach(f => osc('triangle', f, f, t + 0.9, 1.4, 0.06, sfxBus, { atk: 0.05 })); osc('sine', 110, 82, t + 0.9, 1.4, 0.12); },
    rage: t => { osc('sawtooth', 110, 70, t, 0.5, 0.1, sfxBus, { lp: 700 }); noise(t, 0.4, 0.2, 'lowpass', 800, 200); }
  };

  function play(name, vol = 1, minGap = 0.035) {
    if (!ac || muted || VOL.sfx <= 0.001) return;
    const t = now();
    if (last[name] && t - last[name] < minGap) return;
    if (voices > 60) return;
    last[name] = t;
    const f = SFX[name]; if (!f) return;
    if (vol !== 1) { const keep = sfxBus.gain.value; } // 預留
    f(t + 0.005);
  }

  // ---------- 背景音樂：A 小調 8 小節循環，戰況激烈時加入鼓組 ----------
  const BGM = (() => {
    const bpm = 76, s16 = 60 / bpm / 4;
    const chords = [[45, [69, 72, 76]], [41, [65, 69, 72]], [48, [64, 67, 72]], [43, [62, 67, 71]], [45, [69, 72, 76]], [41, [65, 69, 72]], [40, [64, 68, 71]], [40, [64, 68, 71]]];
    const mel = [
      76, 0, 74, 76, 72, 0, 69, 0, 72, 74, 76, 0, 77, 76, 74, 72, 76, 0, 79, 0, 76, 74, 72, 0, 74, 0, 71, 72, 74, 0, 0, 0,
      81, 0, 79, 76, 77, 76, 74, 0, 72, 0, 74, 76, 77, 0, 76, 74, 76, 0, 80, 0, 83, 0, 80, 0, 76, 0, 74, 0, 71, 0, 68, 0];
    let step = 0, nextT = 0, timer = null, mode = 'menu', intensity = 0, inten = 0;
    const mf = m => 440 * Math.pow(2, (m - 69) / 12);
    const drumGain = () => G.clamp(inten, 0, 1);
    // 首頁曲：明亮的 8-bit 主旋律＋柔和琶音＋貝斯（不加大鼓，避免規律的悶響）
    const mChords = [[45, [69, 72, 76]], [41, [69, 72, 77]], [48, [67, 72, 76]], [43, [67, 71, 74]], [45, [69, 72, 76]], [41, [69, 72, 77]], [43, [67, 71, 74]], [40, [68, 71, 76]]];
    const mMel = [76, 0, 72, 74, 76, 0, 79, 0, 77, 76, 72, 0, 69, 0, 72, 0, 76, 0, 74, 72, 67, 0, 72, 0, 74, 0, 71, 72, 74, 76, 74, 0,
      76, 0, 72, 74, 76, 0, 81, 0, 79, 77, 76, 0, 72, 0, 77, 0, 76, 74, 71, 0, 74, 0, 72, 71, 68, 0, 71, 0, 76, 0, 0, 0];
    function schedMenu(t, i) {
      const bar = (i >> 4) % 8, s = i & 15, [root, ch] = mChords[bar];
      if (s % 4 === 0) osc('triangle', mf(root), mf(root), t, s16 * 3.6, 0.26, bgmBus, { atk: 0.012 });                         // 貝斯（4 分音符）
      if ((s & 1) === 0) { const an = ch[(s >> 1) % 3] + 12; osc('triangle', mf(an), mf(an), t, s16 * 1.5, 0.07, bgmBus, { atk: 0.008 }); }   // 琶音（高八度、三角波，清亮不刺耳）
      if ((s & 1) === 0) { const m = mMel[(bar * 8 + (s >> 1)) % mMel.length]; if (m) { osc('pulse', mf(m), mf(m), t, s16 * 1.7, 0.085, bgmBus, { lp: 4200, atk: 0.008 }); osc('sine', mf(m + 12), mf(m + 12), t, s16 * 1.2, 0.025, bgmBus, { atk: 0.008 }); } }
    }
    function sched(t, i) {
      if (mode === 'menu') return schedMenu(t, i);
      const bar = (i >> 4) % 8, s = i & 15, [root, ch] = chords[bar];
      // 貝斯（8 分音符）
      if ((s & 1) === 0) { const n = (s === 6 || s === 14) ? root + 7 : (s === 10 ? root + 12 : root); osc('triangle', mf(n), mf(n), t, s16 * 1.8, 0.32, bgmBus); }
      // 琶音
      if ((s & 1) === 0) { const an = ch[((s >> 1) + (s >> 3)) % 3] + ((s & 8) ? 12 : 0); osc('square', mf(an), mf(an), t, s16 * 1.6, mode === 'menu' ? 0.03 : 0.035, bgmBus, { lp: 1300 }); }
      // 主旋律（戰鬥中）
      if (mode === 'battle' && (s & 1) === 0) {
        const m = mel[(bar * 8 + (s >> 1)) % mel.length];
        if (m) osc('pulse', mf(m), mf(m), t, s16 * 1.9, 0.07, bgmBus, { lp: 3200 });
      }
      // 鼓
      const dg = mode === 'battle' ? 0.35 + drumGain() * 0.65 : 0.15;
      if (s === 0 || s === 8 || (inten > 0.5 && s === 10)) { osc('sine', 130, 40, t, 0.18, 0.5 * dg, bgmBus); }
      if ((s === 4 || s === 12) && mode === 'battle') noise(t, 0.12, 0.18 * dg, 'bandpass', 1800, 900, 0.8, bgmBus);
      if (mode === 'battle' && inten > 0.25 && (s & 3) === 2) noise(t, 0.03, 0.05 * dg, 'highpass', 7000, 7000, 1, bgmBus);
    }
    // 排程：每幀（requestAnimationFrame）＋ 計時器雙保險；預排 0.3 秒
    // 計時器被瀏覽器節流（例如在桌機的 Claude 視窗裡）時，錯過的音符直接跳過，不會一次全部擠在一起播出（規律雜音的來源）
    function tick() {
      if (!ac || ac.state !== 'running') return;
      inten += (intensity - inten) * 0.05;
      const now2 = ac.currentTime;
      if (nextT < now2 + 0.01) { const miss = Math.ceil((now2 + 0.03 - nextT) / s16); step += miss; nextT += miss * s16; }
      while (nextT < now2 + 0.3) { sched(nextT, step); step++; nextT += s16; }
    }
    return {
      start() { nextT = ac.currentTime + 0.1; if (!timer) timer = setInterval(tick, 25); },
      pump: () => tick(),
      setMode(m) { if (m !== mode) { mode = m; step = 0; } },
      setIntensity(v) { intensity = v; }
    };
  })();

  // ---------- 背景音樂（mp3）：每個場景一首，切換時 0.7 秒交叉淡入淡出；全部同一個音量 ----------
  // 網址（https）走 Web Audio（iOS 也能調音量）；本機 file:// 直接調 <audio> 音量（file:// 無法接進 Web Audio）
  const Music = (() => {
    const SRC = { menu: 'audio/menu.mp3', battle: 'audio/battle.mp3', team: 'audio/team.mp3', shop: 'audio/shop.mp3', ach: 'audio/ach.mp3' };
    const T = {}, useWA = location.protocol !== 'file:';
    let want = null, wantV = 1;
    function get(n) {
      if (T[n]) return T[n];
      const a = new Audio(SRC[n]); a.loop = true; a.preload = 'auto';
      const t = { a, v: 0, g: null };
      if (useWA && ac) { try { const src = ac.createMediaElementSource(a); t.g = ac.createGain(); t.g.gain.value = 0; src.connect(t.g); t.g.connect(musicBus); } catch (e) { t.g = null; } }
      if (!t.g) a.volume = 0;
      return (T[n] = t);
    }
    return {
      set(n, v = 1) { want = n; wantV = v; },
      restart(n) { const t = T[n]; if (t) { if (t.a.paused) { try { t.a.currentTime = 0; } catch (e) { } } else t.rs = true; } },   // 正在播（淡出中）→ 等下次開始時才回到開頭
      // 預備（在「點一下開始」那一下手勢裡呼叫）：建立曲子並「播一下立刻暫停」——音量是 0、聽不到，
      // 但 iPhone 會因此允許之後直接播放並開始緩衝。不呼叫 load()（iPhone 上 load 可能在播放後才完成，把曲子重設回開頭）。
      prime(n) { if (!ac) return; const t = get(n); if (!t.a.paused || t.ok) return; t.a.preload = 'auto'; try { const pp = t.a.play(); t.a.pause(); if (pp && pp.catch) pp.catch(() => { }); t.ok = true; } catch (e) { } },
      update(dt) {
        if (!ac) return;                                   // 使用者第一次點擊前不能播
        if (want && !T[want]) get(want);
        let others = 0; for (const n in T) if (n !== want) others = Math.max(others, T[n].v);
        for (const n in T) {
          const t = T[n], tgt = n === want ? wantV : 0;
          const up = tgt > t.v && others < 0.05 ? 0.15 : 0.7;    // 前面沒有別的音樂（例如開場動畫後）→ 0.15 秒快速淡入；切換場景 → 0.7 秒交叉淡入淡出
          t.v += G.clamp(tgt - t.v, -dt / 0.7, dt / up);
          const lv = t.v * t.v;
          if (t.g) t.g.gain.value = lv; else { t.a.volume = G.clamp(lv * MUSIC_VOL * VOL.music, 0, 1); t.a.muted = muted; }
          if (tgt > 0 && t.a.paused && ac.state === 'running') { if (t.rs) { t.rs = false; try { t.a.currentTime = 0; } catch (e) { } } t.a.play().catch(() => { }); }
          if (t.v <= 0.001 && !t.a.paused) t.a.pause();
        }
      }
    };
  })();

  return {
    init, play,
    running: () => !!ac && ac.state === 'running',      // 瀏覽器是否已允許出聲
    music: (n, v) => Music.set(n, v), musicRestart: n => Music.restart(n), musicPrime: n => Music.prime(n), musicUpdate: dt => Music.update(dt),
    setMode: m => BGM.setMode(m),
    pump: () => { },                  // 合成 BGM 已停用
    setIntensity: v => BGM.setIntensity(v),
    toggleMute() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.02); return muted; },
    get muted() { return muted; },
    vol: k => VOL[k],
    setVol(k, v) {
      VOL[k] = G.clamp(Math.round(v * 20) / 20, 0, 1);     // 5% 一格
      if (ac) { if (k === 'music' && musicBus) musicBus.gain.setTargetAtTime(MUSIC_VOL * VOL.music, ac.currentTime, 0.03); if (k === 'sfx' && sfxBus) sfxBus.gain.setTargetAtTime(0.55 * VOL.sfx, ac.currentTime, 0.03); }
      try { localStorage.setItem('leafwar_vol', JSON.stringify(VOL)); } catch (e) { }
      return VOL[k];
    }
  };
})();
