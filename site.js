// ChessFX website: the live hero board (the extension's real shaders and pieces, playing the Opera Game), the look
// switcher, Original vs ChessFX, the board gallery, and the store links. No framework, no build step.
(() => {
  // An email link that landed on the home page (no redirect page set): hand it to the confirm page.
  if (/access_token=|error_description=/.test(location.hash)) { location.replace('confirm.html' + location.hash); return; }
  // Store pages: fill in once the listings are live. Until then the page shows its built-in "Coming soon" wording.
  const STORE = { chrome: '', edge: '' };
  const D = window.SITE;
  const $ = (id) => document.getElementById(id);
  const rm = matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- store buttons: Chrome (also Brave and other Chromium browsers) or Edge ----------
  const isEdge = /\bEdg\//.test(navigator.userAgent);
  const store = isEdge ? STORE.edge || STORE.chrome : STORE.chrome;
  // Once listed: each "Coming soon" pill becomes the store button, and the launch FAQ entry goes.
  if (store) {
    for (const p of document.querySelectorAll('[data-soon]')) {
      const a = document.createElement('a');
      a.className = `btn btn-${p.dataset.soon} btn-lg`;
      a.href = store; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = `Add to ${isEdge ? 'Edge' : 'Chrome'}, it's free`;
      p.replaceWith(a);
    }
    $('getNote').textContent = 'Free and cosmetic only. Works in Chrome, Edge and Brave.';
    $('faqWhen').remove();
  }

  // The header gains a solid edge once the page scrolls under it.
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- board: pieces ----------
  const board = $('board'), layer = $('pieces');
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  let look = D.looks[0], at = new Map(), pieceSet = { w: look.white, b: look.black }, original = false, pieceOverride = null;
  const SETS = [...new Set(D.looks.map((l) => l.white))];
  const setName = (id) => id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  // What the board shows, in words: the look (or gallery board), plus the piece set when it was picked separately.
  const title = () => (look.label || look.name) + (pieceOverride ? ` · ${setName(pieceOverride)} pieces` : '');
  const src = (c, p) => `assets/pieces/${original ? 'cburnett' : pieceSet[c]}/${c}${p.toUpperCase()}.png`;
  const place = (img, sq) => { const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; img.style.transform = `translate(${f * 100}%, ${(7 - r) * 100}%)`; img.style.setProperty('--k', f + 7 - r); img.dataset.sq = sq; };
  const setup = (intro) => {
    layer.textContent = '';
    marks.hidden = true;
    at = new Map();
    START.split('/').forEach((row, ri) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += +ch; continue; }
        const img = document.createElement('img');
        const c = ch === ch.toUpperCase() ? 'w' : 'b';
        img.alt = '';
        img.className = c;
        img.dataset.p = ch.toLowerCase();
        img.src = src(c, img.dataset.p);
        img.draggable = false;
        if (intro) { img.classList.add('set'); img.style.setProperty('--d', `${0.55 + (c === 'w' ? 7 - ri : ri) * 0.09 + Math.abs(f - 3.5) * 0.03}s`); img.addEventListener('animationend', () => img.classList.remove('set'), { once: true }); }
        const sq = String.fromCharCode(97 + f) + (8 - ri);
        place(img, sq);
        layer.append(img);
        at.set(sq, img);
        f++;
      }
    });
  };
  // Last move: its two squares light up under the pieces.
  const marks = $('marks');
  const mark = (from, to) => { marks.hidden = original; [from, to].forEach((sq, i) => { marks.children[i].style.transform = `translate(${(sq.charCodeAt(0) - 97) * 100}%, ${(8 - +sq[1]) * 100}%)`; }); };
  const repaintPieces = () => { for (const img of layer.children) img.src = src(img.className.includes('w') ? 'w' : 'b', img.dataset.p); };

  // ---------- board: the shader (the extension's own GLSL from assets/shaders.js) ----------
  const cv = $('shader');
  let gl = null, progs = {}, simT = 37, lastDraw = 0, raf = 0, visible = true, paused = false;
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
  // The preview plays on its own, also with reduced motion (which only drops the intro, bursts and ripples);
  // the pause button stops it. It animates only while on screen, the tab is visible and nobody pressed pause.
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
  };
  const sync = () => { if (running() && !raf) { lastDraw = 0; raf = requestAnimationFrame(tick); } else if (!running()) draw(); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(board);
  document.addEventListener('visibilitychange', sync);

  // ---------- effects: capture bursts, a check ring, a mate shower (drawn on the fx canvas) ----------
  const fx = $('fx'), g = fx.getContext('2d');
  let parts = [], rings = [];
  const centre = (sq) => { const s = fx.width / 8; return [(sq.charCodeAt(0) - 97 + 0.5) * s, (8 - +sq[1] + 0.5) * s, s]; };
  const burst = (sq, n, spread) => {
    if (rm.matches || original) return;
    const [x, y, s] = centre(sq);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * s * spread;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - s * 0.6, r: s * (0.04 + Math.random() * 0.05), c: look.palette[i % look.palette.length], life: 1 });
    }
  };
  const ring = (sq, color) => { if (!rm.matches && !original) rings.push({ sq, c: color, life: 1 }); };
  let lastFx = 0;
  const fxTick = (now) => {
    const dt = Math.min((now - (lastFx || now)) / 1000, 0.05); lastFx = now;
    const w = Math.round(board.clientWidth * Math.min(devicePixelRatio || 1, 2));
    if (fx.width !== w) fx.width = fx.height = w;
    g.clearRect(0, 0, fx.width, fx.height);
    parts = parts.filter((p) => (p.life -= dt * 1.3) > 0);
    for (const p of parts) { p.vy += fx.width * 0.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = p.life; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
    rings = rings.filter((r) => (r.life -= dt * 1.1) > 0);
    for (const r of rings) { const [x, y, s] = centre(r.sq); g.globalAlpha = r.life; g.strokeStyle = r.c; g.lineWidth = s * 0.08; g.beginPath(); g.arc(x, y, s * (0.55 + (1 - r.life) * 0.5), 0, 7); g.stroke(); }
    g.globalAlpha = 1;
  };

  // ---------- the demo game (Morphy's Opera Game), looped ----------
  const cap = $('moveCap');
  let step = 0, timer = 0;
  const kingOf = (color) => [...at].find(([, img]) => img.dataset.p === 'k' && img.classList.contains(color))?.[0];
  const play = () => {
    timer = 0;
    if (paused) return;
    if (!visible || document.hidden) { timer = setTimeout(play, 700); return; }
    if (step >= D.demo.length) { timer = setTimeout(() => { step = 0; cap.textContent = 'Opera Game, Paris 1858'; setup(!rm.matches); timer = setTimeout(play, rm.matches ? 0 : 1700); }, 3500); return; }
    const m = D.demo[step++];
    cap.textContent = `Move ${Math.ceil(step / 2)} of ${Math.ceil(D.demo.length / 2)} · Opera Game`;
    if (m.captured && at.has(m.to)) { const v = at.get(m.to); v.classList.add('gone'); setTimeout(() => v.remove(), 300); burst(m.to, 26, 1.4); }
    const img = at.get(m.from);
    at.delete(m.from);
    place(img, m.to);
    mark(m.from, m.to);
    at.set(m.to, img);
    if (m.rook) { const r = at.get(m.rook[0]); at.delete(m.rook[0]); place(r, m.rook[1]); at.set(m.rook[1], r); }
    if (m.promo) { img.dataset.p = m.promo; img.src = src(m.color, m.promo); }
    if (m.check) { const k = kingOf(m.color === 'w' ? 'b' : 'w'); if (k) ring(k, m.mate ? look.palette[0] : '#ff5a4f'); }
    if (m.mate) setTimeout(() => { const k = kingOf(m.color === 'w' ? 'b' : 'w'); if (k) { burst(k, 60, 2.2); ring(k, look.palette[1]); } }, 350);
    if (!running() && !rm.matches) fxTick(performance.now());
    timer = setTimeout(play, m.mate ? 1800 : 1050);
  };

  // ---------- gallery: the pointed-at tile plays its board live ----------
  const tcv = document.createElement('canvas');
  tcv.className = 'tile-live';
  tcv.setAttribute('aria-hidden', 'true');
  let tgl = null, tprogs = {}, tRaf = 0, tBoard = null, tT = 0, tLast = 0;
  const tileGL = () => {
    if (tgl) return tgl;
    try { tgl = tcv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); } catch (e) { tgl = null; }
    if (!tgl) return null;
    const b = tgl.createBuffer();
    tgl.bindBuffer(tgl.ARRAY_BUFFER, b);
    tgl.bufferData(tgl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), tgl.STATIC_DRAW);
    tgl.enableVertexAttribArray(0);
    tgl.vertexAttribPointer(0, 2, tgl.FLOAT, false, 0, 0);
    tcv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); tgl = null; tprogs = {}; });
    return tgl;
  };
  const tprog = (name) => {
    if (name in tprogs) return tprogs[name];
    const sh = (type, src0) => { const x = tgl.createShader(type); tgl.shaderSource(x, src0); tgl.compileShader(x); return x; };
    const p = tgl.createProgram();
    tgl.attachShader(p, sh(tgl.VERTEX_SHADER, VS));
    tgl.attachShader(p, sh(tgl.FRAGMENT_SHADER, CX.SHADERS.common + CX.SHADERS[name]));
    tgl.bindAttribLocation(p, 0, 'p');
    tgl.linkProgram(p);
    if (!tgl.getProgramParameter(p, tgl.LINK_STATUS)) return (tprogs[name] = null);
    const u = {};
    for (const k of ['t', 'res', 'flip', 'cL', 'cD']) u[k] = tgl.getUniformLocation(p, k);
    return (tprogs[name] = { p, u });
  };
  const tileFrame = (now) => {
    tRaf = 0;
    if (!tBoard || !tgl) return;
    const pr = tprog(tBoard.id);
    if (!pr) return;
    tT += Math.min(now - (tLast || now), 100) / 1000; tLast = now;
    tgl.viewport(0, 0, tcv.width, tcv.height);
    tgl.useProgram(pr.p);
    tgl.uniform1f(pr.u.t, tT); tgl.uniform2f(pr.u.res, tcv.width, tcv.height); tgl.uniform1f(pr.u.flip, 0);
    tgl.uniform3fv(pr.u.cL, rgb(tBoard.L)); tgl.uniform3fv(pr.u.cD, rgb(tBoard.D));
    tgl.drawArrays(tgl.TRIANGLES, 0, 3);
    tcv.classList.add('on');
    tRaf = requestAnimationFrame(tileFrame);
  };
  const tileLive = (tile, bd) => {
    cancelAnimationFrame(tRaf); tRaf = 0; tBoard = null; tcv.classList.remove('on');
    if (!tile || rm.matches || !tileGL()) { tcv.remove(); return; }
    const img = tile.querySelector('img'), px = Math.round(img.clientWidth * Math.min(devicePixelRatio || 1, 1.5));
    if (tcv.width !== px) tcv.width = tcv.height = px;
    tile.prepend(tcv);
    tBoard = bd; tT = 37; tLast = 0;
    tRaf = requestAnimationFrame(tileFrame);
  };

  // ---------- looks: chips under the board, and the full gallery ----------
  const applyLook = (l, label) => {
    look = { ...l, label: label || l.name };
    if (pieceOverride === l.white) pieceOverride = null;
    pieceSet = pieceOverride ? { w: pieceOverride, b: pieceOverride } : { w: l.white, b: l.black };
    board.style.setProperty('--glow-w', l.glowW);
    board.style.setProperty('--glow-b', l.glowB);
    $('poster').src = `assets/boards/${l.board}.jpg`;
    $('lookName').textContent = title();
    $('heroPiece').src = `assets/pieces/${pieceSet.w}/wN.png`;
    $('applyMsg').textContent = '';
    board.setAttribute('aria-label', `Live preview of the ${title()} look playing the Opera Game`);
    cmpPaint();
    for (const c of $('sets').children) c.setAttribute('aria-pressed', String(c.dataset.set === pieceSet.w));
    if (original) setOriginal(false); else { repaintPieces(); draw(); }
    if (!rm.matches) {
      for (const i of layer.children) i.classList.remove('set');
      for (const el of [board, $('heroPiece')]) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); }
    }
  };
  board.addEventListener('animationend', (e) => { if (e.target === board && e.animationName === 'sweep') board.classList.remove('swap'); });
  $('heroPiece').addEventListener('animationend', (e) => { if (e.animationName === 'pop') e.target.classList.remove('swap'); });
  // After picking a board or piece set further down: bring the board itself into view (on phones the hero's top is
  // the headline, far above the board).
  const showBoard = () => $('board').scrollIntoView({ behavior: rm.matches ? 'auto' : 'smooth', block: 'center' });
  const share = () => {
    const base = D.looks.find((x) => x.id === look.id) || D.looks[0];
    const u = new URL(location.href);
    u.searchParams.set('look', base.id);
    if (look.board !== base.board) u.searchParams.set('board', look.board); else u.searchParams.delete('board');
    if (pieceOverride) u.searchParams.set('pieces', pieceOverride); else u.searchParams.delete('pieces');
    u.hash = '';
    history.replaceState(history.state, '', u);
  };
  const chips = $('chips');
  for (const l of D.looks) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = `<img src="assets/boards/${l.board}.jpg" alt="" loading="lazy" width="30" height="30"><span></span>`;
    b.querySelector('span').textContent = l.name;
    b.setAttribute('aria-pressed', String(l === look));
    b.addEventListener('click', () => { for (const c of chips.children) c.setAttribute('aria-pressed', String(c === b)); pieceOverride = null; applyLook(l); share(); });
    chips.append(b);
  }
  const gal = $('gallery');
  for (const bd of D.boards) {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'tile';
    t.innerHTML = `<img src="assets/boards/${bd.id}.jpg" alt="" loading="lazy" width="400" height="400"><span></span>`;
    t.querySelector('span').textContent = bd.name;
    t.setAttribute('aria-label', `Try the ${bd.name} board on the preview`);
    t.addEventListener('click', () => {
      for (const c of chips.children) c.setAttribute('aria-pressed', 'false');
      applyLook({ ...look, board: bd.id, L: bd.L, D: bd.D }, bd.name);
      share();
      showBoard();
    });
    t.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') tileLive(t, bd); });
    t.addEventListener('pointerleave', () => tileLive(null));
    t.addEventListener('focus', () => tileLive(t, bd));
    t.addEventListener('blur', () => tileLive(null));
    gal.append(t);
  }

  // ---------- piece sets: try any of them on the hero board ----------
  const setsBox = $('sets');
  for (const id of SETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'set';
    b.dataset.set = id;
    b.innerHTML = '<span class="set-row" aria-hidden="true">' + ['wK', 'wQ', 'wN', 'bN', 'bQ', 'bK'].map((p) => `<img src="assets/pieces/${id}/${p}.png" alt="" loading="lazy" width="64" height="64">`).join('') + '</span><b></b>';
    b.querySelector('b').textContent = setName(id);
    b.setAttribute('aria-label', `Try the ${setName(id)} pieces on the preview`);
    b.addEventListener('click', () => {
      pieceOverride = id;
      applyLook(look, look.label);
      share();
      showBoard();
    });
    setsBox.append(b);
  }

  // ---------- before and after: the Opera Game after 13 moves, on Chess.com's board and on the chosen look ----------
  const cmp = $('cmp'), cmpRange = $('cmpRange');
  const cmpPos = (() => {
    const m = new Map();
    START.split('/').forEach((row, ri) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) { f += +ch; continue; } m.set(String.fromCharCode(97 + f) + (8 - ri), ch); f++; } });
    for (const mv of D.demo.slice(0, 26)) {
      m.set(mv.to, mv.promo ? (mv.color === 'w' ? mv.promo.toUpperCase() : mv.promo) : m.get(mv.from)); m.delete(mv.from);
      if (mv.rook) { m.set(mv.rook[1], m.get(mv.rook[0])); m.delete(mv.rook[0]); }
    }
    return m;
  })();
  const cmpFill = (box, set) => {
    box.textContent = '';
    for (const [sq, ch] of cmpPos) {
      const c = ch === ch.toUpperCase() ? 'w' : 'b', img = document.createElement('img');
      img.alt = ''; img.className = c; img.draggable = false; img.loading = 'lazy';
      img.src = `assets/pieces/${set[c]}/${c}${ch.toUpperCase()}.png`;
      img.style.transform = `translate(${(sq.charCodeAt(0) - 97) * 100}%, ${(8 - +sq[1]) * 100}%)`;
      box.append(img);
    }
  };
  cmpFill($('cmpOrig'), { w: 'cburnett', b: 'cburnett' });
  function cmpPaint() {
    $('cmpPoster').src = `assets/boards/${look.board}.jpg`;
    $('cmpTag').textContent = look.label || look.name;
    cmp.style.setProperty('--glow-w', look.glowW); cmp.style.setProperty('--glow-b', look.glowB);
    cmpFill($('cmpFx'), pieceSet);
  }
  let cmpTouched = false;
  const cmpSet = (v) => { cmp.style.setProperty('--pos', v + '%'); cmpRange.value = v; };
  cmpRange.addEventListener('input', () => { cmpTouched = true; cmpSet(+cmpRange.value); });
  // One reveal when it first scrolls into view: the divider sweeps across and settles in the middle.
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return;
    o.disconnect();
    if (rm.matches || cmpTouched) return;
    const t0 = performance.now();
    const step = (now) => { if (cmpTouched) return; const k = Math.min(1, (now - t0) / 1400), ease = 1 - Math.pow(1 - k, 3); cmpSet(Math.round(88 - 38 * ease)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, { threshold: 0.6 }).observe(cmp);

  // ---------- Original vs ChessFX, and pause ----------
  const setOriginal = (on) => {
    original = on;
    $('lookName').textContent = on ? 'Without ChessFX' : title();
    board.classList.toggle('original', on);
    $('mOriginal').setAttribute('aria-pressed', String(on));
    $('mFx').setAttribute('aria-pressed', String(!on));
    parts = []; rings = []; g.clearRect(0, 0, fx.width, fx.height);
    if (on) marks.hidden = true;
    repaintPieces();
    sync();
  };
  $('mOriginal').addEventListener('click', () => setOriginal(true));
  $('mFx').addEventListener('click', () => setOriginal(false));
  const setPaused = (p) => {
    paused = p;
    $('pause').setAttribute('aria-pressed', String(p));
    $('pause').setAttribute('aria-label', p ? 'Play the preview' : 'Pause the preview');
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
        await CX_WEB.applyLook(base.id, look.board !== base.board ? look.board : null, pieceOverride);
        const live = await CX_WEB.syncExtension();
        $('applyMsg').textContent = `${title()} is now your look.` + (live ? ' ChessFX in this browser has switched to it.' : ' Open the ChessFX toolbar popup to sync it now.');
      } catch (e) { $('applyMsg').textContent = e.message; }
    });
  });

  // ---------- credits ----------
  for (const c of D.credits) { const li = document.createElement('li'); li.textContent = `${c.set}: ${c.licence}`; $('creditList').append(li); }

  // ---------- start: poster first, shader when the page is idle ----------
  // A shared link (?look=inferno, optionally &board=lava) opens on that look.
  const q = new URLSearchParams(location.search);
  const qLook = D.looks.find((l) => l.id === q.get('look')), qBoard = D.boards.find((bd) => bd.id === q.get('board'));
  if (SETS.includes(q.get('pieces'))) pieceOverride = q.get('pieces');
  if (qLook) { look = qLook; pieceSet = pieceOverride ? { w: pieceOverride, b: pieceOverride } : { w: look.white, b: look.black }; for (const [i, c] of [...chips.children].entries()) c.setAttribute('aria-pressed', String(D.looks[i] === look && !qBoard)); }
  if (pieceOverride && !qLook) pieceSet = { w: pieceOverride, b: pieceOverride };
  setup(!rm.matches);
  if (qBoard) for (const c of chips.children) c.setAttribute('aria-pressed', 'false');
  if (qBoard) applyLook({ ...look, board: qBoard.id, L: qBoard.L, D: qBoard.D }, qBoard.name); else applyLook(look);
  board.classList.remove('swap'); $('heroPiece').classList.remove('swap');
  const start = () => { if (initGL()) draw(); clearTimeout(timer); if (paused) setPaused(true); else { sync(); timer = setTimeout(play, 1600); } };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 }); else setTimeout(start, 300);
})();
