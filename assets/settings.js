// Settings schema helpers shared by content scripts, popup and options (pure functions, no DOM).
// CX_DEFAULTS (presets.js) is the schema: every stored value is coerced to its default's type; unknown keys are dropped.
var CX_SETTINGS = (() => {
  const VERSION = 2;
  // The groups a "look" (preset or saved look) consists of.
  const GROUPS = ['board', 'pieces', 'motion', 'fx', 'sound', 'page'];
  // Personal choices inside look groups: they survive look changes and never turn a preset into "Custom"
  // (the sound pack also needs a page reload, so a look must not switch it).
  const GLOBAL = [['sound', 'volume'], ['sound', 'pack'], ['fx', 'intensity']];
  const LOOK_ID = /^my:[a-z0-9]{1,16}$/;
  const lookExists = (id) => !!CX_PRESETS[id] || LOOK_ID.test(id);
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

  const merge = (a, b) => {
    const out = Array.isArray(a) ? a.slice() : { ...a };
    if (!isObj(b)) return out;
    for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a?.[k]) ? merge(a[k], v) : v;
    return out;
  };

  const HEX = /^#[0-9a-f]{3,8}$/i;
  const coerce = (def, v) => {
    if (isObj(def)) {
      const src = isObj(v) ? v : {};
      const out = {};
      for (const k of Object.keys(def)) out[k] = coerce(def[k], src[k]);
      return out;
    }
    if (Array.isArray(def)) { // only fx.palette today: a list of colours
      return Array.isArray(v) && v.length && v.every((c) => typeof c === 'string' && HEX.test(c)) ? v.slice(0, 8) : def.slice();
    }
    switch (typeof def) {
      case 'number': { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof n === 'number' && isFinite(n) ? n : def; }
      case 'boolean': return typeof v === 'boolean' ? v : def;
      case 'string': return typeof v === 'string' ? v.slice(0, 200) : def;
      default: return def;
    }
  };

  // Version steps keyed by the version they upgrade FROM; add one when a key is renamed or its meaning changes.
  const MIGRATIONS = {
    // 1 -> 2: idle animation everywhere by default, your own games included (the user asked for it to work everywhere).
    1: (r) => ({ ...r, pieces: { ...(isObj(r.pieces) ? r.pieces : {}), idleLive: true } }),
  };
  const migrate = (raw) => {
    let r = isObj(raw) ? raw : {};
    for (let v = Number(r.v) || 1; v < VERSION; v++) if (MIGRATIONS[v]) r = MIGRATIONS[v](r);
    return r;
  };

  // Any stored value (missing, outdated, corrupted) -> a complete, valid settings object.
  const sanitize = (raw) => {
    const s = coerce(CX_DEFAULTS, migrate(raw));
    s.v = VERSION;
    if (s.preset !== 'custom' && !lookExists(s.preset)) s.preset = 'custom';
    if (s.basePreset && !lookExists(s.basePreset)) s.basePreset = '';
    // Only sources ChessFX has: an unknown one (damaged storage, or removed in an update) would show missing images.
    if (typeof CX_CATALOG !== 'undefined') {
      const known = (list, v) => list.some((x) => x.id === v);
      for (const k of ['white', 'black']) if (!known(CX_CATALOG.pieces, s.pieces[k])) s.pieces[k] = CX_DEFAULTS.pieces[k];
      if (!known(CX_CATALOG.boards, s.board.src)) s.board.src = CX_DEFAULTS.board.src;
      if (!known(CX_CATALOG.sounds, s.sound.pack)) s.sound.pack = CX_DEFAULTS.sound.pack;
    }
    return s;
  };

  // Apply a look's groups over `base`, keeping the personal levels (volume, intensity) from `base`.
  const withLook = (base, look, id) => {
    const s = merge(base, {});
    for (const g of GROUPS) s[g] = merge(CX_DEFAULTS[g], (look && look[g]) || {});
    for (const [g, k] of GLOBAL) if (base[g] && k in base[g]) s[g][k] = base[g][k];
    s.preset = id;
    s.basePreset = '';
    return s;
  };
  const presetSettings = (id, base) => (CX_PRESETS[id] ? withLook(base, CX_PRESETS[id], id) : base);

  // Does a settings patch change the look (as opposed to personal levels or other groups)?
  const touchesLook = (patch) => GROUPS.some((g) => patch[g] && Object.keys(patch[g]).some((k) => !GLOBAL.some(([gg, kk]) => gg === g && kk === k)));

  // A saved look: the look groups of the current settings, without the personal levels.
  const lookOf = (S) => {
    const look = {};
    for (const g of GROUPS) look[g] = merge(S[g], {});
    for (const [g, k] of GLOBAL) delete look[g][k];
    return look;
  };
  // Saved looks list (chrome.storage.sync 'cfxLooks'): each entry sanitized against the schema.
  const MAX_LOOKS = 8;
  const cleanLooks = (raw) => (Array.isArray(raw) ? raw : []).filter((l) => l && LOOK_ID.test(l.id)).slice(0, MAX_LOOKS).map((l) => {
    const s = coerce(CX_DEFAULTS, { ...l.look });
    const look = {};
    for (const g of GROUPS) look[g] = s[g];
    for (const [g, k] of GLOBAL) delete look[g][k];
    return { id: l.id, name: typeof l.name === 'string' && l.name.trim() ? l.name.trim().slice(0, 32) : 'My look', look };
  });

  // Settings for a fresh install (or a full reset): the default preset over the defaults.
  const fresh = () => presetSettings(CX_DEFAULTS.preset, sanitize({}));

  // Stored value -> settings to use (fresh install when nothing is stored yet).
  const load = (raw) => (isObj(raw) ? sanitize(raw) : fresh());

  // Text colour for content drawn on the accent: whichever of ink / white has the higher WCAG contrast.
  const onAccent = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16);
    if (!isFinite(n)) return '#0a0c17';
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    const ink = (L + 0.05) / (0.0055 + 0.05); // vs #0a0c17 (L ~= .0055)
    const white = 1.05 / (L + 0.05);
    return ink >= white ? '#0a0c17' : '#ffffff';
  };

  return { VERSION, GROUPS, GLOBAL, MAX_LOOKS, isObj, merge, sanitize, presetSettings, withLook, touchesLook, lookOf, cleanLooks, lookExists, fresh, load, onAccent };
})();
