// ============================================================
// v3.2.2 HD-2D 戰場（參考《歧路旅人》）：像素世界照常畫在低解析緩衝，最後用 WebGL 做一次「鏡頭後製」
//   1. 透視傾斜：地面像一張往遠處傾斜的桌面——上方（遠處）變小、下方（近處）變大，角色也跟著遠小近大
//   2. 景深：畫面上緣（遠景）與下緣（前景）模糊，中間清楚（微縮模型感）
//   3. 柔光：亮的地方（光暈、水面、岩漿、法術）向外暈開
//   4. 調色：亮部偏暖、暗部偏冷，稍微提高飽和與對比
//   5. 光束：從左上斜照下來的幾道淡淡光柱，緩慢飄移；再加上漂浮的光塵（2D 畫在最上面）
// 不支援 WebGL 的裝置自動退回原本的 2D 畫法（08_render 的 tilt）
// 座標換算：R.scrToBuf／R.bufToScr（點擊、瞄準、頭上 UI 都走這兩個），公式和著色器完全一樣
// ============================================================
G.HD = (() => {
  // v3.2.3 效能：模糊／柔光改成「半解析預先模糊」兩小張貼圖，主畫面每點只取 5～9 次；
  //   輸出像素有預算（手機 100 萬、電腦 220 萬），掉幀時自動降解析度 H.q（0.55～1），順了再慢慢升回來
  const H = { on: true, P: 0.16, ok: null, q: 1, slow: 0, fast: 0, dof: 0, bloom: 0.45 };   // v3.5 Pai：柔光太強、白色角色看不清 → 0.45   // v3.2.4 Pai：拿掉上下緣景深模糊（dof 0；要找回來設 1）
  const RAY = { forest: [1.0, 0.88, 0.62, 0.11], autumn: [1.0, 0.72, 0.42, 0.12], snow: [0.82, 0.92, 1.0, 0.1], lava: [1.0, 0.55, 0.3, 0.1], abyss: [0.66, 0.56, 1.0, 0.08] };
  const TOUCH = matchMedia('(pointer: coarse)').matches, BUDGET = TOUCH ? 3.2e6 : 4.2e6;   // v3.4 原生解析度（手機 1170×2532≈300 萬也放得下）；掉幀才降
  let gl = null, cv = null, prog = null, lowP = null, tex = null, L = {}, LL = {}, motes = [], dot = null;
  const low = [null, null];   // [模糊色, 亮部]：{ t 貼圖, f 畫框 }
  let lw = 0, lh = 0;
  const VS = 'attribute vec2 p; varying vec2 vUV; void main(){ vUV = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  const PRE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
  // 半解析預先模糊：每格取 4 次（線性取樣＝4×4 像素平均）；uMode 1＝只留亮部（柔光用）
  const FS_LOW = PRE + `
uniform sampler2D uTex; uniform vec2 uBuf; uniform float uMode;
vec3 t(vec2 b) { vec3 c = texture2D(uTex, b / uBuf).rgb; return uMode > 0.5 ? max(c - vec3(0.7), vec3(0.0)) : c; }
void main() { vec2 b = gl_FragCoord.xy * 2.0; gl_FragColor = vec4((t(b + vec2(-1.0, -1.0)) + t(b + vec2(1.0, -1.0)) + t(b + vec2(-1.0, 1.0)) + t(b + vec2(1.0, 1.0))) * 0.25, 1.0); }`;
  const FS = PRE + `
uniform sampler2D uTex; uniform sampler2D uLC; uniform sampler2D uLB; uniform vec2 uScr; uniform float uSc; uniform float uP; uniform vec2 uCB; uniform vec2 uBuf; uniform vec2 uLow; uniform float uSS; uniform float uOut; uniform float uT; uniform vec4 uRay; uniform vec3 uFx;
varying vec2 vUV;
vec2 src(vec2 sp) {
  float s = 1.0 + uP * (2.0 * sp.y / uScr.y - 1.0);
  return vec2(uCB.x + (sp.x - uScr.x * 0.5) / (uSc * s), uCB.y + uScr.y / (2.0 * uP * uSc) * log(s));
}
vec3 lc(vec2 b) { return texture2D(uLC, b / uLow).rgb; }
vec3 lb(vec2 b) { return texture2D(uLB, b / uLow).rgb; }
void main() {
  vec2 sp = vec2(vUV.x * uScr.x, (1.0 - vUV.y) * uScr.y);
  vec2 b = src(sp);
  // v3.4 銳利雙線性：像素中間是純色、只有交界那半個輸出像素做混合 → 每顆像素一樣大、移動時邊緣不閃（貼圖要用線性取樣）
  float s = 1.0 + uP * (2.0 * sp.y / uScr.y - 1.0);
  vec2 tp = b * uSS; float dd = uSS / (uSc * s * uOut);
  vec2 seam = floor(tp + 0.5); tp = seam + clamp((tp - seam) / dd, -0.5, 0.5);
  vec3 c = texture2D(uTex, tp / (uBuf * uSS)).rgb;
  float v = sp.y / uScr.y;
  float r = uFx.x * (3.2 * smoothstep(0.36, 0.0, v) + 2.4 * smoothstep(0.72, 1.0, v));
  if (r > 0.02) {
    float k = r * 0.6;
    vec3 bl = (lc(b + vec2(k, k * 0.4)) + lc(b + vec2(-k * 0.4, k)) + lc(b + vec2(-k, -k * 0.4)) + lc(b + vec2(k * 0.4, -k))) * 0.25;
    c = mix(c, bl, clamp(r / 1.1, 0.0, 1.0));
  }
  vec3 bo = (lb(b + vec2(1.5, 1.5)) + lb(b + vec2(-1.5, 1.5)) + lb(b + vec2(1.5, -1.5)) + lb(b + vec2(-1.5, -1.5))) * 0.25;
  c += bo * 2.2 * uFx.y;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.0 + 0.14 * uFx.z);
  c *= mix(vec3(0.92, 0.98, 1.08), vec3(1.07, 1.0, 0.9), smoothstep(0.12, 0.72, l)) * uFx.z + vec3(1.0 - uFx.z);
  c = (c - 0.5) * (1.0 + 0.08 * uFx.z) + 0.5;
  float d = (sp.x * 0.55 + sp.y * 0.84) / max(uScr.x, uScr.y);
  float beam = pow(0.5 + 0.5 * sin(d * 7.0 + 1.4 * sin(uT * 0.17)), 7.0) + 0.7 * pow(0.5 + 0.5 * sin(d * 12.0 - uT * 0.11 + 2.1), 11.0);
  c += uRay.rgb * (beam * uRay.a * (1.0 - v * 0.85) + 0.05 * uRay.a * 4.0 * (1.0 - v));
  gl_FragColor = vec4(c, 1.0);
}`;
  const mkTex = (filt) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const filt = (f) => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); };
  function init() {
    try {
      cv = document.createElement('canvas'); cv.width = cv.height = 4;
      gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }) || cv.getContext('experimental-webgl');
      if (!gl) return false;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const mk = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
      prog = mk(FS); lowP = mk(FS_LOW);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      tex = mkTex(gl.NEAREST);
      for (let i = 0; i < 2; i++) { const t = mkTex(gl.LINEAR), f = gl.createFramebuffer(); low[i] = { t, f }; }
      for (const k of ['uTex', 'uLC', 'uLB', 'uScr', 'uSc', 'uP', 'uCB', 'uBuf', 'uLow', 'uSS', 'uOut', 'uT', 'uRay', 'uFx']) L[k] = gl.getUniformLocation(prog, k);
      for (const k of ['uTex', 'uBuf', 'uMode']) LL[k] = gl.getUniformLocation(lowP, k);
      gl.useProgram(prog); gl.uniform1i(L.uTex, 0); gl.uniform1i(L.uLC, 1); gl.uniform1i(L.uLB, 2);
      gl.useProgram(lowP); gl.uniform1i(LL.uTex, 0);
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); H.ok = false; });
      return true;
    } catch (e) { console.warn('HD-2D off', e); return false; }
  }
  // 半解析貼圖大小（取 32 的倍數，縮放時不用每幀重建）
  function lowSize(bw, bh) {
    const w = Math.ceil(bw / 64) * 32, h = Math.ceil(bh / 64) * 32;
    if (w === lw && h === lh) return;
    lw = w; lh = h;
    for (const o of low) {
      gl.bindTexture(gl.TEXTURE_2D, o.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lw, lh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, o.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, o.t, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  // 掉幀自動降解析度：連續 1.5 秒低於 ~48fps 降一階；連續 5 秒高於 ~57fps 升一階
  function adapt() {
    const dt = G.Render.dtF || 0.016;
    if (dt > 0.1) return;
    if (dt > 1 / 48) { H.slow += dt; H.fast = 0; } else if (dt < 1 / 57) { H.fast += dt; H.slow = Math.max(0, H.slow - dt * 0.5); }
    if (H.slow > 1.5) { const R = G.Render; if (H.q > 0.75 || R.ssOff) H.q = Math.max(0.55, H.q * 0.85); else { R.ssOff = true; H.q = 0.85; } H.slow = 0; }   // v3.4 先降解析度，再關掉 2 倍細緻（關了就不再開，避免來回切）
    if (H.fast > 5) { H.q = Math.min(1, H.q * 1.08); H.fast = 0; }
  }
  H.active = () => { if (!H.on) return false; if (H.ok == null) H.ok = init(); return H.ok; };
  // 透視用的緩衝外擴倍率（上方遠處要看到更寬的世界）
  H.over = () => [1 + H.P * 1.7, 1 + H.P * 0.85];
  // 世界畫面 → 螢幕：在 GL 畫好再整張貼到主畫布
  H.render = (ctx, buf, bw, bh, sc, rt, themeId) => {
    const R = G.Render, SW = R.sw, SH = R.sh, VW = SW / sc, VH = SH / sc;
    adapt();
    let gw = SW, gh = SH;
    const k = Math.min(1, H.q, Math.sqrt(BUDGET * H.q * H.q / (gw * gh)));
    gw = Math.max(64, Math.round(gw * k)); gh = Math.max(64, Math.round(gh * k));
    if (cv.width !== gw || cv.height !== gh) { cv.width = gw; cv.height = gh; }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // 1. 半解析預先模糊（模糊色＋亮部）
    lowSize(bw, bh); filt(gl.LINEAR);
    gl.useProgram(lowP); gl.uniform2f(LL.uBuf, bw, bh); gl.viewport(0, 0, lw, lh);
    for (let i = H.dof ? 0 : 1; i < 2; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, low[i].f); gl.uniform1f(LL.uMode, i); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // 2. 主畫面：透視＋景深＋柔光＋調色＋光束
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, low[0].t);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, low[1].t);
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(prog); gl.viewport(0, 0, gw, gh);
    const ry = RAY[themeId] || RAY.forest;
    gl.uniform2f(L.uScr, SW, SH); gl.uniform1f(L.uSc, sc); gl.uniform1f(L.uP, R.ps); gl.uniform2f(L.uCB, R.cbx, R.cby); gl.uniform2f(L.uBuf, bw, bh);
    gl.uniform2f(L.uLow, lw * 2, lh * 2); gl.uniform1f(L.uSS, R.SS || 1); gl.uniform1f(L.uOut, gw / SW);
    gl.uniform1f(L.uT, rt); gl.uniform4f(L.uRay, ry[0], ry[1], ry[2], ry[3]); gl.uniform3f(L.uFx, H.dof, H.bloom, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.imageSmoothingEnabled = gw !== SW; ctx.drawImage(cv, 0, 0, gw, gh, 0, 0, SW, SH); ctx.imageSmoothingEnabled = false;   // 原生解析度 1:1；降解析度時平滑放大（內容已經是銳利雙線性）
    drawMotes(ctx, SW, SH, rt, ry);
  };
  // 漂浮的光塵：慢慢往上飄、忽明忽暗（畫在螢幕上，不跟著世界移動）
  function drawMotes(ctx, SW, SH, rt, ry) {
    const k = SW / G.Render.uw;
    if (!dot) { dot = G.canvas(16, 16); const x = dot.getContext('2d'), g = x.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 16, 16); }
    while (motes.length < 26) motes.push({ x: Math.random(), y: Math.random(), v: 0.006 + Math.random() * 0.012, s: 0.6 + Math.random() * 1.4, ph: Math.random() * 6.28, w: Math.random() * 6.28 });
    const dt = Math.min(0.05, G.Render.dtF || 0.016);
    ctx.globalCompositeOperation = 'screen';
    for (const m of motes) {
      m.y -= m.v * dt; m.x += Math.sin(rt * 0.6 + m.w) * 0.004 * dt; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
      const a = (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(rt * 1.7 + m.ph))) * (m.y < 0.5 ? 1 : 0.6), sz = m.s * k * 3;
      ctx.globalAlpha = a; ctx.drawImage(dot, m.x * SW - sz / 2, m.y * SH - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  return H;
})();
