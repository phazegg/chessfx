// My Account (website): what the account holds, change your look (applied through the account to the extension),
// export, sign out, delete. Signed-out visitors go to the sign-in page.
(async () => {
  const $ = (id) => document.getElementById(id);
  const W = window.CX_WEB, D = window.SITE;
  if (!W.enabled()) { $('meStatus').textContent = 'Accounts are coming soon. ChessFX works fully without one.'; return; }
  const u = await W.user();
  if (!u) { location.replace('account.html#signin'); return; }
  const ago = (iso) => { if (!iso) return 'Never'; const m = Math.round((Date.now() - Date.parse(iso)) / 60e3); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString(); };
  const lookOf = (cfx) => {
    const s = CX_SETTINGS.sanitize(cfx);
    const p = CX_PRESETS[s.preset], fx = String(s.board.src).startsWith('fx:') ? s.board.src.slice(3) : null;
    return { name: p ? p.name : 'Custom', board: fx, meta: p ? p.blurb : 'Your own mix of board and pieces.', preset: s.preset };
  };
  let row = null;
  const paint = () => {
    const d = (row && row.data) || {};
    const l = lookOf(d.cfx);
    $('meEmail').textContent = u.email;
    $('curName').textContent = l.name;
    $('curMeta').textContent = l.meta;
    $('curImg').src = `assets/boards/${l.board || 'galaxy'}.jpg`;
    $('nLooks').textContent = (Array.isArray(d.cfxLooks) ? d.cfxLooks.length : 0);
    $('nGames').textContent = (Array.isArray(d.cfxGames) ? d.cfxGames.length : 0);
    $('lastSync').textContent = ago(row && row.updated_at);
    for (const b of $('apply').children) b.setAttribute('aria-pressed', String(b.dataset.id === l.preset));
  };
  try {
    row = await W.row();
  } catch (e) { $('meStatus').textContent = e.message; return; }
  // Looks you can apply (the same presets as the extension's welcome page and hero).
  for (const l of D.looks) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.dataset.id = l.id;
    b.innerHTML = `<img src="assets/boards/${l.board}.jpg" alt="" loading="lazy" width="400" height="400"><span></span><em>Apply</em>`;
    b.querySelector('span').textContent = l.name;
    b.setAttribute('aria-label', `Apply the ${l.name} look to your ChessFX`);
    b.addEventListener('click', async () => {
      $('applyMsg').textContent = `Applying ${l.name}…`;
      try {
        await W.applyLook(l.id);
        row = await W.row();
        paint();
        $('applyMsg').textContent = `${l.name} is now your look. ChessFX switches to it the next time it syncs: open its toolbar popup to sync now.`;
      } catch (e) { $('applyMsg').textContent = e.message; }
    });
    $('apply').append(b);
  }
  paint();
  $('meStatus').hidden = true;
  $('meBody').hidden = false;

  $('export').addEventListener('click', async () => {
    const r = await W.row();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'ChessFX', account: u.email, exported: new Date().toISOString(), data: (r && r.data) || {} }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `chessfx-account-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('signOutMe').addEventListener('click', async () => { await W.signOut(); location.href = 'index.html'; });
  const dlg = $('delDlg');
  $('del').addEventListener('click', () => { $('delEmail').value = ''; $('delGo').disabled = true; $('delErr').textContent = ''; dlg.showModal(); });
  $('delCancel').addEventListener('click', () => dlg.close());
  $('delEmail').addEventListener('input', () => { $('delGo').disabled = $('delEmail').value.trim().toLowerCase() !== u.email.toLowerCase(); });
  $('delGo').addEventListener('click', async () => {
    $('delGo').disabled = true; $('delGo').textContent = 'Deleting…';
    try { await W.deleteAccount(); location.href = 'index.html'; } catch (e) { $('delErr').textContent = e.message; $('delGo').disabled = false; $('delGo').textContent = 'Delete account'; }
  });
})();
