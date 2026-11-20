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
  const H = { on: true, P: 0.16, ok: null };
  const RAY = { forest: [1.0, 0.88, 0.62, 0.11], autumn: [1.0, 0.72, 0.42, 0.12], snow: [0.82, 0.92, 1.0, 0.1], lava: [1.0, 0.55, 0.3, 0.1], abyss: [0.66, 0.56, 1.0, 0.08] };
  let gl = null, cv = null, prog = null, tex = null, L = {}, motes = [], dot = null;
  const VS = 'attribute vec2 p; varying vec2 vUV; void main(){ vUV = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex; uniform vec2 uScr; uniform float uSc; uniform float uP; uniform vec2 uCB; uniform vec2 uBuf; uniform float uT; uniform vec4 uRay; uniform vec3 uFx;
varying vec2 vUV;
vec2 src(vec2 sp) {
  float s = 1.0 + uP * (2.0 * sp.y / uScr.y - 1.0);
  return vec2(uCB.x + (sp.x - uScr.x * 0.5) / (uSc * s), uCB.y + uScr.y / (2.0 * uP * uSc) * log(s));
}
vec3 tap(vec2 b) { return texture2D(uTex, b / uBuf).rgb; }
void main() {
  vec2 sp = vec2(vUV.x * uScr.x, (1.0 - vUV.y) * uScr.y);
  vec2 b = src(sp);
  vec3 c = tap(floor(b) + 0.5);
  float v = sp.y / uScr.y;
  float r = uFx.x * (3.2 * smoothstep(0.36, 0.0, v) + 2.4 * smoothstep(0.72, 1.0, v));
  vec3 acc = vec3(0.0), blo = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996, rr = sqrt((float(i) + 0.5) / 12.0);
    vec2 o = vec2(cos(a), sin(a)) * rr;
    acc += tap(b + o * r);
    vec3 t = tap(b + o * 3.0);
    blo += max(t - vec3(0.7), vec3(0.0));
  }
  c = mix(c, acc / 12.0, clamp(r / 1.1, 0.0, 1.0));
  c += blo / 12.0 * 2.2 * uFx.y;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.0 + 0.14 * uFx.z);
  c *= mix(vec3(0.92, 0.98, 1.08), vec3(1.07, 1.0, 0.9), smoothstep(0.12, 0.72, l)) * uFx.z + vec3(1.0 - uFx.z);
  c = (c - 0.5) * (1.0 + 0.08 * uFx.z) + 0.5;
  float d = (sp.x * 0.55 + sp.y * 0.84) / max(uScr.x, uScr.y);
  float beam = pow(0.5 + 0.5 * sin(d * 7.0 + 1.4 * sin(uT * 0.17)), 7.0) + 0.7 * pow(0.5 + 0.5 * sin(d * 12.0 - uT * 0.11 + 2.1), 11.0);
  c += uRay.rgb * (beam * uRay.a * (1.0 - v * 0.85) + 0.05 * uRay.a * 4.0 * (1.0 - v));
  gl_FragColor = vec4(c, 1.0);
}`;
  function init() {
    try {
      cv = document.createElement('canvas'); cv.width = cv.height = 4;
      gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true }) || cv.getContext('experimental-webgl');
      if (!gl) return false;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const ap = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      for (const k of ['uTex', 'uScr', 'uSc', 'uP', 'uCB', 'uBuf', 'uT', 'uRay', 'uFx']) L[k] = gl.getUniformLocation(prog, k);
      gl.uniform1i(L.uTex, 0);
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); H.ok = false; });
      return true;
    } catch (e) { console.warn('HD-2D off', e); return false; }
  }
  H.active = () => { if (!H.on) return false; if (H.ok == null) H.ok = init(); return H.ok; };
  // 透視用的緩衝外擴倍率（上方遠處要看到更寬的世界）
  H.over = () => [1 + H.P * 1.7, 1 + H.P * 0.85];
  // 世界畫面 → 螢幕：在 GL 畫好再整張貼到主畫布
  H.render = (ctx, buf, bw, bh, sc, rt, themeId) => {
    const R = G.Render, SW = R.sw, SH = R.sh, VW = SW / sc, VH = SH / sc;
    const gw = Math.max(64, Math.min(SW, Math.ceil(VW * 3))), gh = Math.max(64, Math.min(SH, Math.ceil(VH * 3)));
    if (cv.width !== gw || cv.height !== gh) { cv.width = gw; cv.height = gh; }
    gl.viewport(0, 0, gw, gh);
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const ry = RAY[themeId] || RAY.forest;
    gl.uniform2f(L.uScr, SW, SH); gl.uniform1f(L.uSc, sc); gl.uniform1f(L.uP, R.ps); gl.uniform2f(L.uCB, R.cbx, R.cby); gl.uniform2f(L.uBuf, bw, bh);
    gl.uniform1f(L.uT, rt); gl.uniform4f(L.uRay, ry[0], ry[1], ry[2], ry[3]); gl.uniform3f(L.uFx, 1, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.imageSmoothingEnabled = gw < SW * 0.6; ctx.drawImage(cv, 0, 0, gw, gh, 0, 0, SW, SH); ctx.imageSmoothingEnabled = false;
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
