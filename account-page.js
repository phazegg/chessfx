// ChessFX website sign-in page: sign up, sign in, email code, forgot password (the extension's account.js, on the
// website's client CX_WEB). After signing in you land on My Account. Modes by hash: #signup (default), #signin, #code, #forgot.
(() => {
  const $ = (id) => document.getElementById(id);
  const settings = () => { location.href = 'me.html'; };
  const guest = () => { location.href = 'index.html'; };
  for (const b of document.querySelectorAll('.a-guest')) b.addEventListener('click', guest);

  let codeFor = 'signup'; // what the emailed code is for: 'signup' | 'recovery'
  const COPY = {
    signup: ['Create your account', 'Keep your settings and looks on every browser. Your games can follow too, if you choose.', 'Create account', 'Already have one?', 'Sign in'],
    signin: ['Welcome back', 'Sign in to sync this device.', 'Sign in', 'New here?', 'Create an account'],
  };
  const forms = ['fAuth', 'fCode', 'fForgot', 'fOff'];
  const show = (id, title, lede) => {
    for (const f of forms) $(f).hidden = f !== id;
    $('aTitle').textContent = title;
    $('aLede').textContent = lede;
    alert('');
    $('aTitle').focus();
  };
  const alert = (msg) => { $('aAlert').textContent = msg; $('aAlert').hidden = !msg; };
  const status = (msg) => { $('aStatus').textContent = msg; };
  const fieldErr = (input, errId, msg) => { $(errId).textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
  // Run an action with the button busy and errors shown; returns true when it succeeded.
  const busy = async (btn, label, fn) => {
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = label; alert('');
    try { await fn(); return true; } catch (e) { alert(e.message || 'Something went wrong. Try again.'); return false; } finally { btn.disabled = false; btn.textContent = old; }
  };

  // ---------- sign up / sign in ----------
  let mode = 'signup';
  const authMode = (m) => {
    mode = m;
    const [t, l, btn, sw, swBtn] = COPY[m];
    show('fAuth', t, l);
    $('submit').textContent = btn;
    $('switchText').textContent = sw;
    $('switchMode').textContent = swBtn;
    $('password').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    for (const id of ['pwRules', 'ageRow', 'legal']) $(id).hidden = m !== 'signup';
    $('toForgot').hidden = m !== 'signin';
    rules();
  };
  const rules = () => {
    const pw = $('password').value, mail = $('email').value.trim().toLowerCase();
    const met = { len: pw.length >= 8, mail: !!pw && pw.toLowerCase() !== mail };
    for (const li of $('pwRules').children) { li.dataset.met = met[li.dataset.rule]; li.setAttribute('aria-label', li.textContent + (met[li.dataset.rule] ? ', met' : ', not met yet')); }
    return met.len && met.mail;
  };
  $('password').addEventListener('input', rules);
  $('email').addEventListener('input', rules);
  $('showPw').addEventListener('click', () => {
    const on = $('password').type === 'password';
    $('password').type = on ? 'text' : 'password';
    $('showPw').textContent = on ? 'Hide' : 'Show';
    $('showPw').setAttribute('aria-pressed', String(on));
  });
  $('switchMode').addEventListener('click', () => { location.hash = mode === 'signup' ? 'signin' : 'signup'; });
  $('toForgot').addEventListener('click', () => { location.hash = 'forgot'; });
  $('fAuth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim(), pw = $('password').value;
    fieldErr($('email'), 'emailErr', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : email ? "That email doesn't look right." : 'Enter your email.');
    fieldErr($('password'), 'pwErr', !pw ? 'Enter a password.' : mode === 'signup' && !rules() ? 'Use at least 8 characters, and not your email.' : '');
    const bad = [$('email'), $('password')].find((i) => i.getAttribute('aria-invalid') === 'true');
    if (bad) return bad.focus();
    if (mode === 'signup' && !$('age').checked) { alert("You need to be 13 or older to create an account. You can keep using ChessFX as a guest."); return $('age').focus(); }
    if (mode === 'signup') {
      await busy($('submit'), 'Creating account…', async () => {
        const r = await CX_WEB.signUp(email, pw);
        if (r.session) return done(true);
        codeFor = 'signup'; sessionStorage.setItem('cfxEmail', email); location.hash = 'code';
      });
    } else {
      await busy($('submit'), 'Signing in…', async () => {
        try { await CX_WEB.signIn(email, pw); } catch (err) {
          if (err.code === 'unconfirmed') { codeFor = 'signup'; sessionStorage.setItem('cfxEmail', email); location.hash = 'code'; return; }
          throw err;
        }
        await afterSignIn();
      });
    }
  });

  // ---------- email code ----------
  const codeMode = () => {
    const email = sessionStorage.getItem('cfxEmail') || '';
    if (!email) { location.hash = 'signin'; return; }
    const reset = codeFor === 'recovery';
    show('fCode', reset ? 'Reset your password' : 'Check your email', `We sent a code to ${email}. It expires in 1 hour.`);
    $('newPwRow').hidden = !reset;
    $('codeSubmit').textContent = reset ? 'Set new password' : 'Confirm email';
    $('code').value = '';
  };
  let cool = 0;
  $('resend').addEventListener('click', async () => {
    if (Date.now() < cool) return;
    const email = sessionStorage.getItem('cfxEmail') || '';
    const ok = await busy($('resend'), 'Sending…', () => (codeFor === 'recovery' ? CX_WEB.recover(email) : CX_WEB.resend(email)));
    if (!ok) return;
    status('Sent again. Check your inbox and spam folder.');
    cool = Date.now() + 30e3;
    $('resend').disabled = true;
    setTimeout(() => { $('resend').disabled = false; }, 30e3);
  });
  $('otherEmail').addEventListener('click', () => { sessionStorage.removeItem('cfxEmail'); location.hash = codeFor === 'recovery' ? 'forgot' : 'signup'; });
  $('fCode').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = sessionStorage.getItem('cfxEmail') || '', reset = codeFor === 'recovery';
    fieldErr($('code'), 'codeErr', /^\d{6,10}$/.test($('code').value.trim()) ? '' : 'Enter the code from the email.');
    if (reset) fieldErr($('newPassword'), 'newPwErr', $('newPassword').value.length >= 8 ? '' : 'Use at least 8 characters.');
    const bad = [$('code'), $('newPassword')].find((i) => i.getAttribute('aria-invalid') === 'true');
    if (bad) return bad.focus();
    await busy($('codeSubmit'), reset ? 'Saving…' : 'Confirming…', async () => {
      await CX_WEB.verify(email, $('code').value, reset ? 'recovery' : 'signup');
      if (reset) await CX_WEB.setPassword($('newPassword').value);
      sessionStorage.removeItem('cfxEmail');
      if (reset) await afterSignIn(); else await done(true);
    });
  });

  // ---------- forgot password ----------
  $('fForgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('forgotEmail').value.trim();
    fieldErr($('forgotEmail'), 'forgotErr', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter your email.');
    if (!email || $('forgotEmail').getAttribute('aria-invalid') === 'true') return $('forgotEmail').focus();
    await busy(e.submitter || $('fForgot').querySelector('button[type=submit]'), 'Sending…', async () => {
      await CX_WEB.recover(email);
      codeFor = 'recovery'; sessionStorage.setItem('cfxEmail', email); sessionStorage.setItem('cfxCodeFor', 'recovery'); location.hash = 'code';
    });
  });
  $('backToSignin').addEventListener('click', () => { location.hash = 'signin'; });

  // ---------- after sign-in: My Account ----------
  const afterSignIn = async () => settings();
  const done = async () => settings();

  // ---------- routing ----------
  const route = async () => {
    if (!CX_WEB.enabled()) return show('fOff', 'Accounts are coming soon', 'ChessFX works fully without one: your settings, looks and games are saved on this device.');
    const h = location.hash.slice(1) || 'signup';
    if ((h === 'signup' || h === 'signin') && await CX_WEB.user()) return settings('account'); // already signed in
    if (sessionStorage.getItem('cfxCodeFor') === 'recovery' && h === 'code') codeFor = 'recovery';
    if (h === 'signup' || h === 'signin') authMode(h);
    else if (h === 'code') codeMode();
    else if (h === 'forgot') { show('fForgot', 'Reset your password', "We'll email you a code."); $('forgotEmail').value = $('email').value; }
    else authMode('signup');
    if (h !== 'code') sessionStorage.removeItem('cfxCodeFor');
  };
  addEventListener('hashchange', route);
  route();
})();
