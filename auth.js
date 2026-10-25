// ChessFX website accounts: the same Supabase project and account as the extension (src/cloud.js), over plain fetch.
// The session lives in this site's localStorage. The account row is shared with the extension: applying a look here
// writes it to the account, and the extension picks it up the next time it syncs (on start, or when its popup opens).
window.CX_WEB = (() => {
  const C = window.CX_CLOUD_CONFIG || {};
  const enabled = () => !!(C.url && C.anonKey);
  const KEY = 'cfxWebAuth';
  const fail = (code, msg) => Object.assign(new Error(msg), { code });
  const call = async (path, { method = 'POST', body, token, headers = {} } = {}) => {
    if (!enabled()) throw fail('off', 'Accounts are coming soon.');
    let r;
    try {
      r = await fetch(C.url.replace(/\/$/, '') + path, { method, headers: { apikey: C.anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { throw fail('offline', "Can't reach ChessFX. Check your connection and try again."); }
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch (e) { j = null; }
    if (r.ok) return j;
    const raw = String((j && (j.error_code || j.code || j.error)) || '') + ' ' + String((j && (j.msg || j.message || j.error_description)) || '');
    if (r.status === 429 || /rate limit|too many/i.test(raw)) throw fail('rate', 'Too many tries. Wait a minute and try again.');
    if (/invalid_credentials|invalid login|invalid_grant/i.test(raw)) throw fail('bad', 'Email or password is incorrect.');
    if (/email_not_confirmed|not confirmed/i.test(raw)) throw fail('unconfirmed', 'Confirm your email first: click the link we sent you, then sign in.');
    if (/user_already_exists|already registered|already exists/i.test(raw)) throw fail('exists', 'An account with this email already exists. Sign in instead?');
    if (/otp_expired|token has expired|invalid.*(otp|token)/i.test(raw)) throw fail('code', 'That code is wrong or has expired. Request a new one.');
    if (/weak_password|password should/i.test(raw)) throw fail('weak', 'Choose a stronger password: at least 8 characters.');
    if (r.status === 401) { localStorage.removeItem(KEY); throw fail('auth', 'Your session has ended. Sign in again.'); }
    throw fail('server', 'Something went wrong on our side. Try again in a moment.');
  };
  // `name` is what the pages show: the Lichess username for Lichess accounts (their email is a placeholder), else the email.
  const who = (u) => ({ id: u && u.id, email: u && u.email, name: (u && u.user_metadata && u.user_metadata.lichess_username) || (u && u.email) });
  const keep = (s) => {
    if (!s || !s.access_token) return null;
    const v = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: who(s.user) };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode: session lasts for this page only */ }
    return v;
  };
  const session = async () => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !enabled()) return null;
    if (s.expires_at - 60 < Date.now() / 1000) {
      try { s = keep(await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } })); } catch (e) { if (e.code !== 'offline') localStorage.removeItem(KEY); return null; }
    }
    return s;
  };
  const user = async () => (await session())?.user || null;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Email links (confirm, reset) open this site's confirm page.
  const linkTo = () => '?redirect_to=' + encodeURIComponent(C.linkPage || new URL('confirm.html', location.href).href);
  const check = (email, pw) => {
    if (!EMAIL.test(String(email || '').trim())) throw fail('email', "That email doesn't look right.");
    if (pw !== undefined && String(pw).length < 8) throw fail('weak', 'Use at least 8 characters.');
  };
  const signUp = async (email, pw) => {
    check(email, pw);
    const r = await call('/auth/v1/signup' + linkTo(), { body: { email: email.trim(), password: pw } });
    if (r && r.access_token) { keep(r); return { session: true }; }
    if (r && Array.isArray(r.identities) && r.identities.length === 0) throw fail('exists', 'An account with this email already exists. Sign in instead?');
    return { confirm: true };
  };
  // An explicit sign-in here: hand it to the ChessFX extension on the next page (see the nav below); sign-out stops the
  // website from signing itself back in from the extension.
  const NO_AUTO = 'cfxNoAuto';
  const signedIn = () => { try { localStorage.removeItem(NO_AUTO); sessionStorage.setItem('cfxHandOff', '1'); } catch (e) { /* storage off: no hand-off */ } };
  const signIn = async (email, pw) => { check(email); signedIn(); keep(await call('/auth/v1/token?grant_type=password', { body: { email: email.trim(), password: pw } })); return user(); };
  const verify = async (email, token, type) => { check(email); signedIn(); keep(await call('/auth/v1/verify', { body: { email: email.trim(), token: String(token).trim(), type } })); return user(); };
  const resend = (email) => call('/auth/v1/resend', { body: { type: 'signup', email: String(email).trim() } });
  const recover = (email) => { check(email); return call('/auth/v1/recover' + linkTo(), { body: { email: email.trim() } }); };
  const setPassword = async (pw) => { check('a@b.co', pw); const s = await session(); if (!s) throw fail('auth', 'Sign in again.'); await call('/auth/v1/user', { method: 'PUT', token: s.access_token, body: { password: pw } }); };
  const signOut = async () => { const s = await session(); if (s) await call('/auth/v1/logout', { token: s.access_token }).catch(() => {}); localStorage.removeItem(KEY); localStorage.setItem(NO_AUTO, '1'); };
  const deleteAccount = async () => { const s = await session(); if (!s) throw fail('auth', 'Sign in again.'); await call('/rest/v1/rpc/delete_me', { token: s.access_token, body: {} }); localStorage.removeItem(KEY); localStorage.setItem(NO_AUTO, '1'); };
  // The account's synced data (the same row the extension syncs).
  const row = async () => {
    const s = await session();
    if (!s) throw fail('auth', 'Sign in again.');
    const rows = await call(`/rest/v1/user_state?select=data,updated_at&user_id=eq.${encodeURIComponent(s.user.id)}`, { method: 'GET', token: s.access_token });
    return rows && rows[0] ? rows[0] : null;
  };
  // Apply a look to the account: the newest stamp wins in the extension's merge (src/cloud.js), so it takes this one.
  const applyLook = async (presetId, board) => {
    const s = await session();
    if (!s) throw fail('auth', 'Sign in again.');
    const cur = await row();
    const data = (cur && cur.data) || {};
    let settings = CX_SETTINGS.presetSettings(presetId, CX_SETTINGS.sanitize(data.cfx));
    // A board picked from the gallery on top of a look: that look, with this board (a Custom mix, like in Settings).
    if (board && 'fx:' + board !== settings.board.src) settings = CX_SETTINGS.sanitize({ ...settings, preset: 'custom', board: { ...settings.board, src: 'fx:' + board } });
    const next = { ...data, cfx: settings, stamps: { ...(data.stamps || {}), cfx: Date.now() } };
    await call('/rest/v1/user_state?on_conflict=user_id', { token: s.access_token, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { user_id: s.user.id, data: next, updated_at: new Date().toISOString() } });
    return settings;
  };
  // The confirm page: an email link arrives with the session in the URL fragment (#access_token=…&type=signup|recovery).
  const fromLink = (hash) => {
    const h = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    if (h.get('error_description')) throw fail('link', h.get('error_description').replace(/\+/g, ' '));
    if (!h.get('access_token')) return null;
    keep({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600, user: {} });
    signedIn();
    return h.get('type') || 'oauth'; // Google/Discord come back with no type
  };
  // ---------- Continue with Lichess / Google / Discord ----------
  // Lichess is always offered (our "lichess-auth" server function); Google and Discord once switched on in Supabase.
  const providers = async () => {
    const s = await call('/auth/v1/settings', { method: 'GET' }).catch(() => null);
    return ['lichess', ...['google', 'discord'].filter((p) => s && s.external && s.external[p])];
  };
  const back = () => new URL('confirm.html', location.href).href;
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // Leaves the page: the provider sends the visitor back to confirm.html, which finishes the sign-in.
  const withProvider = async (p) => {
    if (!enabled()) throw fail('off', 'Accounts are coming soon.');
    if (p !== 'lichess') { location.href = `${C.url.replace(/\/$/, '')}/auth/v1/authorize?provider=${p}&redirect_to=${encodeURIComponent(back())}`; return; }
    const v = b64u(crypto.getRandomValues(new Uint8Array(32))), state = b64u(crypto.getRandomValues(new Uint8Array(16)));
    const c = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
    sessionStorage.setItem('cfxLichess', JSON.stringify({ v, state, back: back() }));
    location.href = 'https://lichess.org/oauth?' + new URLSearchParams({ response_type: 'code', client_id: 'chessfx', redirect_uri: back(), code_challenge_method: 'S256', code_challenge: c, state });
  };
  // confirm.html?code=…&state=… after Lichess: false when the URL isn't a Lichess return.
  const fromLichess = async (search) => {
    const q = new URLSearchParams(search);
    if (!q.get('code') && !q.get('error')) return false;
    let st = null;
    try { st = JSON.parse(sessionStorage.getItem('cfxLichess') || 'null'); } catch (e) { st = null; }
    sessionStorage.removeItem('cfxLichess');
    if (q.get('error') || !st || st.state !== q.get('state')) throw fail('cancel', "Lichess sign-in was cancelled or didn't finish. Try again.");
    let r;
    try { r = await fetch(C.url.replace(/\/$/, '') + '/functions/v1/lichess-auth', { method: 'POST', headers: { apikey: C.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: q.get('code'), verifier: st.v, redirect_uri: st.back }) }); } catch (e) { throw fail('offline', "Can't reach ChessFX. Check your connection and try again."); }
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) throw fail('provider', (j && j.error) || 'Lichess sign-in failed. Try again.');
    signedIn();
    keep(j);
    return true;
  };
  const me = async () => { const s = await session(); if (!s) return null; const u = await call('/auth/v1/user', { method: 'GET', token: s.access_token }); keep({ ...s, expires_in: s.expires_at - Math.floor(Date.now() / 1000), user: u }); return u; };
  // ---------- the ChessFX extension in this browser ----------
  // It accepts messages from this site only (its manifest's externally_connectable). Extension ids: CX_CLOUD_CONFIG.
  let found = null;
  const send = (id, msg) => new Promise((res) => { try { chrome.runtime.sendMessage(id, msg, (r) => { void chrome.runtime.lastError; res(r || null); }); } catch (e) { res(null); } });
  const extension = async () => {
    if (found !== null) return found;
    const ids = (window.chrome && chrome.runtime && chrome.runtime.sendMessage && C.extensionIds) || [];
    for (const id of ids) { const r = await send(id, { t: 'cfx:hello' }); if (r && r.version) return (found = { id, ...r }); }
    return (found = false);
  };
  const toExtension = async (msg) => { const e = await extension(); return e ? send(e.id, msg) : null; };
  // Signed out here, signed in there: take a session of our own from the extension (unless you signed out here).
  const fromExtension = async () => {
    if (!enabled() || (await session()) || localStorage.getItem(NO_AUTO)) return null;
    const r = await toExtension({ t: 'cfx:session' });
    if (!r || !r.session || !r.session.access_token) return null;
    keep(r.session);
    return user();
  };
  // Just signed in here: sign the extension in too, if it is signed out (it never switches accounts).
  const handOff = async () => {
    if (sessionStorage.getItem('cfxHandOff') !== '1') return null;
    sessionStorage.removeItem('cfxHandOff');
    const s = await session();
    return s ? toExtension({ t: 'cfx:adopt', token: s.access_token }) : null;
  };
  // After a change to the account (e.g. Apply): the extension in this browser syncs now. true when it did.
  const syncExtension = async () => !!((await toExtension({ t: 'cfx:sync' })) || {}).ok;
  return { enabled, session, user, extension, toExtension, syncExtension, fromExtension, handOff, providers, withProvider, fromLichess, fromLink, me, signUp, signIn, verify, resend, recover, setPassword, signOut, deleteAccount, row, applyLook };
})();

// One sign-in for the website and the extension, settled before any page asks who is signed in (CX_WEB.ready -> user).
// Not on the page an email link or sign-in service returns to: that page signs you in itself.
window.CX_WEB.ready = /[#?&](access_token|code|error)=/.test(location.href) ? Promise.resolve(null)
  : (async () => { await window.CX_WEB.handOff(); return (await window.CX_WEB.user()) || (await window.CX_WEB.fromExtension()); })().catch(() => null);

// Header: "Sign in · Create account" or your initial + "My Account" + "Sign out", on every page; "Settings" opens the
// extension's settings when it is installed in this browser.
(async () => {
  const box = document.getElementById('acct');
  if (!box) return;
  if (!window.CX_WEB.enabled()) { box.innerHTML = '<a class="btn btn-go nav-cta" href="index.html#get">Get ChessFX</a>'; return; }
  const u = await window.CX_WEB.ready;
  if (await window.CX_WEB.extension()) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'nav-link linkbtn'; b.id = 'openSettings'; b.textContent = 'Settings';
    b.title = 'Open ChessFX settings';
    b.addEventListener('click', () => window.CX_WEB.toExtension({ t: 'cfx:options' }));
    box.before(b);
  }
  if (!u) { box.innerHTML = '<a class="nav-link" href="account.html#signin">Sign in</a><a class="btn btn-go nav-cta" href="account.html#signup">Create account</a>'; return; }
  box.innerHTML = '<a class="me" href="me.html"><i aria-hidden="true"></i><span>My Account</span></a><button type="button" class="nav-link linkbtn" id="signOut">Sign out</button>';
  box.querySelector('i').textContent = (u.name || u.email || '?')[0].toUpperCase();
  box.querySelector('.me').title = u.name || u.email;
  document.getElementById('signOut').addEventListener('click', async () => { await window.CX_WEB.signOut(); location.href = 'index.html'; });
})();
