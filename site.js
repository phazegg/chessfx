// ChessFX website: the live 3D hero board (the extension's real shaders and pieces, playing the Opera Game, turning
// toward the pointer), the look switcher, Original vs ChessFX, the board gallery, scroll reveals and the store links.
// No framework, no build step.
(() => {
  // An email link that landed on the home page (no redirect page set): hand it to the confirm page.
  if (/access_token=|error_description=/.test(location.hash)) { location.replace('confirm.html' + location.hash); return; }
  // Store pages: fill in once the listings are live. Until then the buttons scroll to the closing section, which says so.
  const STORE = { chrome: '', edge: '' };
  // ---------- scroll reveals (set up first: html.js hides [data-reveal] until it scrolls in, so nothing below may stop it) ----------
  const reveal = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); } }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el, i) => { el.style.setProperty('--rd', `${(i % 6) * 0.06}s`); reveal.observe(el); });

  // Tiles are added later; they register themselves.
  const revealLater = (el) => reveal.observe(el);
  const D = window.SITE;
  const $ = (id) => document.getElementById(id);
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  // ---------- store buttons: Chrome (also Brave and other Chromium browsers) or Edge ----------
  const isEdge = /\bEdg\//.test(navigator.userAgent);
  const store = isEdge ? STORE.edge || STORE.chrome : STORE.chrome;
  for (const a of document.querySelectorAll('[data-store]')) {
    if (store) { a.href = store; a.target = '_blank'; a.rel = 'noopener'; if (isEdge) a.textContent = a.textContent.replace('Chrome', 'Edge'); }
  }
  if (!store) {
    $('getNote').textContent = 'ChessFX is launching soon on the Chrome Web Store. Free, cosmetic only, and ready in one click.';
    const fin = document.querySelector('#get [data-store]');
    fin.textContent = 'Coming soon to Chrome'; fin.classList.replace('btn-go', 'btn-ghost'); fin.removeAttribute('href'); fin.setAttribute('aria-disabled', 'true');
  }

  // ---------- board: pieces stand on the 3D board (span = square position, img = the upright piece) ----------
  const board = $('board'), layer = $('pieces'), stage = $('stage');
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  let look = D.looks[0], at = new Map(), pieceSet = { w: look.white, b: look.black }, original = false;
  const src = (c, p) => `assets/pieces/${original ? 'cburnett' : pieceSet[c]}/${c}${p.toUpperCase()}.png`;
  const fr = (sq) => [sq.charCodeAt(0) - 97, 8 - +sq[1]];
  const place = (pc, sq) => { const [f, r] = fr(sq); pc.style.transform = `translate(${f * 100}%, ${r * 100}%)`; pc.style.setProperty('--dim', (0.8 + r * 0.03).toFixed(2)); pc.dataset.sq = sq; };
  const colorOf = (pc) => (pc.classList.contains('w') ? 'w' : 'b');
  const setup = (intro) => {
    layer.textContent = '';
    at = new Map();
    let i = 0;
    START.split('/').forEach((row, ri) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += +ch; continue; }
        const c = ch === ch.toUpperCase() ? 'w' : 'b';
        const pc = document.createElement('span');
        pc.className = 'pc ' + c + (intro ? ' drop' : '');
        pc.dataset.p = ch.toLowerCase();
        // Staggered drop-in, and each piece breathes on its own beat.
        pc.style.setProperty('--d', `${(intro ? 0.9 : 0) + (c === 'w' ? 7 - ri : ri) * 0.06 + f * 0.025}s`);
        pc.style.setProperty('--bd', `${-((f * 7 + ri * 3) % 11) * 0.31}s`);
        const img = document.createElement('img');
        img.alt = '';
        img.src = src(c, pc.dataset.p);
        img.draggable = false;
        pc.append(img);
        const sq = String.fromCharCode(97 + f) + (8 - ri);
        place(pc, sq);
        layer.append(pc);
        at.set(sq, pc);
        f++; i++;
      }
    });
    marks.hidden = true;
  };
  const repaintPieces = () => { for (const pc of layer.children) pc.firstChild.src = src(colorOf(pc), pc.dataset.p); };
  // A move hops: up off the board along its normal (the span's own translate, separate from its square transform).
  const hop = (pc, big) => {
    if (rm.matches || !pc.animate) return;
    const h = board.clientWidth * (big ? 0.11 : 0.06);
    pc.animate([{ translate: '0 0 0' }, { translate: `0 0 ${h}px`, offset: 0.42 }, { translate: '0 0 0' }], { duration: 420, easing: 'cubic-bezier(.3,.7,.4,1)' });
  };
  // Last move: the two squares light up on the board surface.
  const marks = $('marks');
  const mark = (from, to) => { marks.hidden = original; [from, to].forEach((sq, i) => { const [f, r] = fr(sq); marks.children[i].style.cssText = `left:${f * 12.5}%;top:${r * 12.5}%`; }); };

  // ---------- board: the shader (the extension's own GLSL from assets/shaders.js) ----------
  const cv = $('shader');
  let gl = null, progs = {}, simT = 37, lastDraw = 0, raf = 0, visible = true, paused = rm.matches;
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const initGL = () => {
    try { gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return false;
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; board.classList.remove('live'); });
    return true;
  };
  const prog = (name) => {
    if (name in progs) return progs[name];
    const sh = (type, s) => { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, CX.SHADERS.common + CX.SHADERS[name]));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return (progs[name] = null);
    const u = {};
    for (const k of ['t', 'res', 'flip', 'cL', 'cD']) u[k] = gl.getUniformLocation(p, k);
    return (progs[name] = { p, u });
  };
  const size = () => {
    const px = Math.max(8, Math.round(board.clientWidth * Math.min(devicePixelRatio || 1, 1.5) / 8) * 8);
    if (cv.width !== px) cv.width = cv.height = px;
  };
  const draw = () => {
    if (!gl || original) return;
    const pr = prog(look.board);
    if (!pr) return;
    size();
    gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(pr.p);
    gl.uniform1f(pr.u.t, simT);
    gl.uniform2f(pr.u.res, cv.width, cv.height);
    gl.uniform1f(pr.u.flip, 0);
    gl.uniform3fv(pr.u.cL, rgb(look.L));
    gl.uniform3fv(pr.u.cD, rgb(look.D));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    board.classList.add('live');
  };
  // Animate only while on screen, the tab is visible and nobody pressed pause (reduced motion starts paused).
  const running = () => !paused && visible && !document.hidden && !original;
  const tick = (now) => {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(tick);
    if (now - lastDraw < 1000 / 30 - 2) return;
    simT += Math.min(now - (lastDraw || now), 100) / 1000;
    lastDraw = now;
    draw();
    fxTick(now);
    if (!fine.matches) drift();
  };
  const sync = () => {
    stage.classList.toggle('paused', !running());
    document.documentElement.classList.toggle('hero-off', !visible || document.hidden);
    if (!paused && !timer && visible && !document.hidden && played) timer = setTimeout(play, 500);
    if (running() && !raf) { lastDraw = 0; raf = requestAnimationFrame(tick); } else if (!running()) draw();
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(board);
  document.addEventListener('visibilitychange', sync);

  // ---------- effects on the board surface: move trails, capture bursts, check rings, the mate shower ----------
  const fx = $('fx'), g = fx.getContext('2d');
  let parts = [], rings = [], trails = [];
  const centre = (sq) => { const s = fx.width / 8, [f, r] = fr(sq); return [(f + 0.5) * s, (r + 0.5) * s, s]; };
  const burst = (sq, n, spread) => {
    if (rm.matches || original) return;
    const [x, y, s] = centre(sq);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * s * spread;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - s * 0.6, r: s * (0.04 + Math.random() * 0.05), c: look.palette[i % look.palette.length], life: 1 });
    }
  };
  const ring = (sq, color) => { if (!rm.matches && !original) rings.push({ sq, c: color, life: 1 }); };
  const trail = (from, to) => { if (!rm.matches && !original) trails.push({ from, to, c: look.palette[0], life: 1 }); };
  let lastFx = 0;
  const fxTick = (now) => {
    const dt = Math.min((now - (lastFx || now)) / 1000, 0.05); lastFx = now;
    const w = Math.round(board.clientWidth * Math.min(devicePixelRatio || 1, 2));
    if (fx.width !== w) fx.width = fx.height = w;
    g.clearRect(0, 0, fx.width, fx.height);
    g.globalCompositeOperation = 'lighter';
    trails = trails.filter((t) => (t.life -= dt * 1.6) > 0);
    for (const t of trails) {
      const [x1, y1, s] = centre(t.from), [x2, y2] = centre(t.to);
      const grad = g.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, 'transparent'); grad.addColorStop(1, t.c);
      g.globalAlpha = t.life * 0.7; g.strokeStyle = grad; g.lineWidth = s * 0.16 * t.life; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    parts = parts.filter((p) => (p.life -= dt * 1.3) > 0);
    for (const p of parts) { p.vy += fx.width * 0.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = p.life; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
    rings = rings.filter((r) => (r.life -= dt * 1.1) > 0);
    for (const r of rings) { const [x, y, s] = centre(r.sq); g.globalAlpha = r.life; g.strokeStyle = r.c; g.lineWidth = s * 0.08; g.beginPath(); g.arc(x, y, s * (0.55 + (1 - r.life) * 0.5), 0, 7); g.stroke(); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  };

  // ---------- the demo game (Morphy's Opera Game), looped ----------
  let step = 0, timer = 0, played = false;
  const kingOf = (color) => [...at].find(([, pc]) => pc.dataset.p === 'k' && pc.classList.contains(color))?.[0];
  const play = () => {
    timer = 0;
    played = true;
    if (paused) return;
    // The demo plays only while the board is on screen and the tab is visible (sync() resumes it).
    if (!visible || document.hidden) return;
    if (step >= D.demo.length) { timer = setTimeout(() => { step = 0; setup(true); timer = setTimeout(play, 2400); }, 3600); return; }
    const m = D.demo[step++];
    if (m.captured && at.has(m.to)) { const v = at.get(m.to); v.classList.add('gone'); setTimeout(() => v.remove(), 420); burst(m.to, 26, 1.4); }
    const pc = at.get(m.from);
    at.delete(m.from);
    place(pc, m.to);
    hop(pc, pc.dataset.p === 'n' || m.captured);
    trail(m.from, m.to);
    mark(m.from, m.to);
    at.set(m.to, pc);
    if (m.rook) { const r = at.get(m.rook[0]); at.delete(m.rook[0]); place(r, m.rook[1]); hop(r); at.set(m.rook[1], r); }
    if (m.promo) { pc.dataset.p = m.promo; pc.firstChild.src = src(m.color, m.promo); }
    if (m.check) { const k = kingOf(m.color === 'w' ? 'b' : 'w'); if (k) ring(k, m.mate ? look.palette[0] : '#ff5a4f'); }
    // Mate: the shower, and the beaten king topples.
    if (m.mate) setTimeout(() => { const k = kingOf(m.color === 'w' ? 'b' : 'w'); if (k) { burst(k, 60, 2.2); ring(k, look.palette[1]); at.get(k).classList.add('fall'); } }, 350);
    if (!running() && !rm.matches) fxTick(performance.now());
    timer = setTimeout(play, m.mate ? 1800 : 1050);
  };

  // ---------- 3D: the board turns to face the pointer, with a light glint that follows it ----------
  const rig = $('rig'), scene = rig.parentElement;
  const aim = { rx: 0, ry: 0, lx: 30, ly: 20 }, cur = { rx: 0, ry: 0, lx: 30, ly: 20 };
  let tiltRaf = 0;
  const apply = () => {
    rig.style.setProperty('--rx', cur.rx.toFixed(2) + 'deg');
    rig.style.setProperty('--ry', cur.ry.toFixed(2) + 'deg');
    board.style.setProperty('--lx', cur.lx.toFixed(1) + '%');
    board.style.setProperty('--ly', cur.ly.toFixed(1) + '%');
  };
  // Eased toward the aim; the loop stops once it has arrived.
  const ease = () => {
    tiltRaf = 0;
    let moving = false;
    for (const k of ['rx', 'ry', 'lx', 'ly']) { const d = aim[k] - cur[k]; if (Math.abs(d) > 0.02) { cur[k] += d * 0.12; moving = true; } else cur[k] = aim[k]; }
    apply();
    if (moving) tiltRaf = requestAnimationFrame(ease);
  };
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  addEventListener('pointermove', (e) => {
    if (rm.matches || !fine.matches || e.pointerType === 'touch' || !visible) return;
    const r = scene.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // Face the pointer: right of the board turns it right, above leans it back toward you.
    aim.ry = clamp((e.clientX - cx) / (innerWidth * 0.5)) * 20;
    // It leans back freely but tips forward only a little, so its front edge never swings over the controls.
    aim.rx = Math.max(-4, clamp((cy - e.clientY) / (innerHeight * 0.5)) * 14);
    aim.lx = 50 + clamp((e.clientX - cx) / r.width) * 60;
    aim.ly = 50 + clamp((e.clientY - cy) / r.height) * 60;
    if (!tiltRaf) tiltRaf = requestAnimationFrame(ease);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { aim.rx = aim.ry = 0; aim.lx = 30; aim.ly = 20; if (!tiltRaf) tiltRaf = requestAnimationFrame(ease); });
  // Touch screens: a slow drift instead (runs with the board's own animation, so it stops when that does).
  const drift = () => { if (rm.matches) return; cur.ry = Math.sin(simT * 0.35) * 10; cur.rx = Math.sin(simT * 0.27) * 4; cur.lx = 50 + Math.sin(simT * 0.35) * 30; apply(); };

  // ---------- looks: chips under the board, and the full gallery ----------
  const root = document.documentElement.style;
  const applyLook = (l, label) => {
    look = { ...l, label: label || l.name };
    pieceSet = { w: l.white, b: l.black };
    stage.style.setProperty('--glow-w', l.glowW);
    stage.style.setProperty('--glow-b', l.glowB);
    // The page's light takes the look's colours.
    root.setProperty('--a1', l.palette[0]);
    root.setProperty('--a2', l.palette[1]);
    $('poster').src = `assets/boards/${l.board}.jpg`;
    $('lookName').textContent = label || l.name;
    $('applyMsg').textContent = '';
    board.setAttribute('aria-label', `Live preview of the ${label || l.name} look playing the Opera Game`);
    if (original) setOriginal(false); else { repaintPieces(); draw(); }
  };
  const chips = $('chips');
  for (const l of D.looks) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = `<img src="assets/boards/${l.board}.jpg" alt="" loading="lazy" width="30" height="30"><span></span>`;
    b.querySelector('span').textContent = l.name;
    b.setAttribute('aria-pressed', String(l === look));
    b.addEventListener('click', () => { for (const c of chips.children) c.setAttribute('aria-pressed', String(c === b)); applyLook(l); });
    chips.append(b);
  }
  const gal = $('gallery');
  for (const bd of D.boards) {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'tile';
    t.dataset.reveal = '';
    t.innerHTML = `<img src="assets/boards/${bd.id}.jpg" alt="" loading="lazy" width="400" height="400"><span></span>`;
    t.querySelector('span').textContent = bd.name;
    t.setAttribute('aria-label', `Try the ${bd.name} board on the preview`);
    t.addEventListener('click', () => {
      for (const c of chips.children) c.setAttribute('aria-pressed', 'false');
      applyLook({ ...look, board: bd.id, L: bd.L, D: bd.D }, bd.name);
      $('top').scrollIntoView({ behavior: rm.matches ? 'auto' : 'smooth' });
    });
    gal.append(t);
    revealLater(t);
  }

  // ---------- Original vs ChessFX, and pause ----------
  const setOriginal = (on) => {
    original = on;
    $('lookName').textContent = on ? 'Without ChessFX' : look.label || look.name;
    board.classList.toggle('original', on);
    stage.classList.toggle('original', on);
    $('mOriginal').setAttribute('aria-pressed', String(on));
    $('mFx').setAttribute('aria-pressed', String(!on));
    parts = []; rings = []; trails = []; g.clearRect(0, 0, fx.width, fx.height);
    if (on) marks.hidden = true;
    repaintPieces();
    sync();
  };
  $('mOriginal').addEventListener('click', () => setOriginal(true));
  $('mFx').addEventListener('click', () => setOriginal(false));
  const setPaused = (p) => {
    paused = p;
    $('pause').setAttribute('aria-pressed', String(p));
    $('pause').textContent = p ? '▶' : '❚❚';
    clearTimeout(timer);
    if (!p) play();
    sync();
  };
  $('pause').addEventListener('click', () => setPaused(!paused));

  // ---------- signed in: apply the look on the board to your ChessFX (through your account) ----------
  if (window.CX_WEB && CX_WEB.enabled()) CX_WEB.ready.then((u) => {
    if (!u) return;
    $('applyRow').hidden = false;
    $('applyBtn').addEventListener('click', async () => {
      const base = D.looks.find((x) => x.id === look.id) || D.looks[0];
      $('applyMsg').textContent = 'Applying…';
      try {
        await CX_WEB.applyLook(base.id, look.board !== base.board ? look.board : null);
        const live = await CX_WEB.syncExtension();
        $('applyMsg').textContent = `${look.label || look.name} is now your look.` + (live ? ' ChessFX in this browser has switched to it.' : ' Open the ChessFX toolbar popup to sync it now.');
      } catch (e) { $('applyMsg').textContent = e.message; }
    });
  });

  // ---------- credits ----------
  for (const c of D.credits) { const li = document.createElement('li'); li.textContent = `${c.set}: ${c.licence}`; $('creditList').append(li); }

  // ---------- start: poster first, the table arrives, pieces drop in, then the game and the shader ----------
  setup(!rm.matches);
  applyLook(look);
  apply();
  const start = () => { if (initGL()) draw(); if (paused) setPaused(true); else { sync(); timer = setTimeout(play, rm.matches ? 0 : 2400); } };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 }); else setTimeout(start, 300);
})();
