(() => {
  const P = G.PAL, S = 180, L = 60, k = S / L;               // 60×60 的像素格，放大 3 倍 → 180
  const cv = document.createElement('canvas'); cv.width = L; cv.height = L; const g = cv.getContext('2d');
  // 夜空綠底：上深、下亮一點
  const gr = g.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, '#0b1d17'); gr.addColorStop(0.55, '#123326'); gr.addColorStop(1, '#0a1712'); g.fillStyle = gr; g.fillRect(0, 0, L, L);
  // 背後的光：金色圓暈（一圈一圈）
  for (let r = 26; r > 0; r -= 2) { g.globalAlpha = 0.05; g.fillStyle = '#f7d23c'; g.beginPath(); g.arc(30, 29, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // 光芒：八道細光
  g.save(); g.translate(30, 29); g.fillStyle = '#f7d23c';
  for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.globalAlpha = i % 2 ? 0.10 : 0.16; g.beginPath(); g.moveTo(0, 0); g.lineTo(-2, -30); g.lineTo(2, -30); g.fill(); }
  g.restore(); g.globalAlpha = 1;
  // 草地小丘
  g.fillStyle = '#1f6a35'; g.beginPath(); g.ellipse(30, 58, 30, 12, 0, 0, 7); g.fill();
  g.fillStyle = '#43c466'; g.beginPath(); g.ellipse(30, 57, 26, 9, 0, Math.PI, 2 * Math.PI); g.fill();
  g.fillStyle = '#1f6a35'; g.beginPath(); g.ellipse(30, 59, 26, 9, 0, Math.PI, 2 * Math.PI); g.fill();
  // 草叢點綴
  g.fillStyle = '#7fe08f'; [[10, 49], [14, 48], [44, 48], [49, 49], [22, 47], [38, 47]].forEach(([x, y]) => g.fillRect(x, y, 1, 2));
  // Leafy（遊戲本人）×2.5 → 用最近鄰放大
  g.imageSmoothingEnabled = false;
  const s = G.SPR.leafy[0], sc = 2.5, w = s.w * sc, h = s.h * sc;
  g.globalAlpha = 0.35; g.fillStyle = '#000'; g.beginPath(); g.ellipse(30, 48, 9, 2, 0, 0, 7); g.fill(); g.globalAlpha = 1;   // 影子
  g.drawImage(s.n, Math.round(30 - w / 2), Math.round(48 - h), w, h);
  // 星光
  const star = (x, y, n) => { g.fillStyle = '#fff7c2'; g.fillRect(x, y - n, 1, n * 2 + 1); g.fillRect(x - n, y, n * 2 + 1, 1); };
  star(12, 12, 2); star(48, 9, 1); star(51, 22, 1); star(8, 26, 1);
  // 飄葉
  g.fillStyle = '#9be36b'; g.fillRect(47, 33, 2, 1); g.fillRect(48, 34, 2, 1); g.fillStyle = '#43c466'; g.fillRect(13, 37, 2, 1); g.fillRect(12, 38, 2, 1);
  const out = sz => { const o = document.createElement('canvas'); o.width = o.height = sz; const og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(cv, 0, 0, sz, sz); return o.toDataURL('image/png'); };
  return JSON.stringify({ i180: out(180), i512: out(540), i32: out(60) });
})()
