// Every piece / board / sound source ChessFX offers. chess.com assets are referenced from their CDN, never bundled.
var CX_CATALOG = (() => {
  const CC = 'https://images.chesscomfiles.com/chess-themes/';
  const nice = (s) => s.replace(/^3d_/, '3D ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  // Lichess file names as display names: "wood4" -> "Wood 4", "kiwen-suwi" -> "Kiwen Suwi", plus a few proper spellings.
  const LI_NAME = { ic: 'IC', icpieces: 'IC Pieces', 'ncf-board': 'NCF', mpchess: 'MP Chess', xkcd: 'xkcd', rhosgfx: 'Rhos GFX', chess7: 'Chess7', 'purple-diag': 'Purple Diagonal' };
  const liName = (k) => LI_NAME[k] || nice(k.replace(/-/g, ' ').replace(/([a-z])(\d)$/, '$1 $2'));
  const lichessPieces = {
    cburnett: 'GPLv2+', merida: 'GPLv2+', fantasy: 'MIT', spatial: 'MIT', celtic: 'MIT', chessnut: 'Apache-2.0',
    rhosgfx: 'CC0', 'kiwen-suwi': 'CC BY 4.0', firi: 'CC BY 4.0', papercut: 'CC BY 4.0', pixel: 'AGPLv3+',
    staunty: 'CC BY-NC-SA 4.0', cardinal: 'CC BY-NC-SA 4.0', maestro: 'CC BY-NC-SA 4.0',
    california: 'CC BY-NC-SA 4.0', tatiana: 'CC BY-NC-SA 4.0',
    // Added 1.11 (licences from lila's COPYING.md).
    horsey: 'CC BY-NC-SA 4.0', caliente: 'CC BY-NC-SA 4.0', fresca: 'CC BY-NC-SA 4.0', icpieces: 'CC BY-NC-SA 4.0', gioco: 'CC BY-NC-SA 4.0',
    dubrovny: 'CC BY-NC-SA 4.0', anarcandy: 'CC BY-NC-SA 4.0', cooke: 'CC BY-NC-SA 4.0', xkcd: 'CC BY-NC-SA 2.5', mpchess: 'GPLv3+',
    letter: 'AGPLv3+', pirouetti: 'AGPLv3+', shapes: 'CC BY-SA 4.0', totoy: 'CC BY 4.0',
    alpha: 'free for personal non-commercial use', chess7: 'freeware', companion: 'freeware', leipzig: 'freeware',
    // The rest of lichess's sets (1.11). Licences as lila states them; blank there = not stated.
    governor: 'lichess (not listed in COPYING.md)', kosal: 'lichess (not listed in COPYING.md)', mono: 'GPLv2+', monarchy: 'CC BY-NC-SA 4.0',
    disguised: 'CC BY-NC-SA 4.0', 'minimal-warmth': 'CC BY-NC-SA 4.0', reillycraig: 'licence not stated', riohacha: 'licence not stated',
    'shahi-ivory-brown': 'Şahî font licence: free for personal use, no modification',
  };
  const ccPieces = ('neo classic alpha wood glass gothic metal bases book bubblegum cases club condal dash graffiti icy_sea ' +
    'light lolz marble maya modern nature neon newspaper ocean sky space tigers tournament vintage 3d_wood 3d_staunton ' +
    '3d_plastic 3d_chesskid game_room neo_wood 8_bit blindfold luca chesskid').split(' ');
  const ccBoards = ('green dark_wood glass brown icy_sea newspaper walnut sky lolz stone bases 8_bit marble purple ' +
    'translucent metal tournament dash burled_wood blue bubblegum checkers graffiti light neon orange overlay parchment ' +
    'red sand tan').split(' ');
  const lichessBoards = ('blue-marble.jpg blue2.jpg blue3.jpg canvas2.jpg green-plastic.png grey.jpg horsey.jpg leather.jpg ' +
    'maple.jpg maple2.jpg marble.jpg metal.jpg olive.jpg pink-pyramid.png purple-diag.png wood.jpg wood2.jpg wood3.jpg wood4.jpg ' +
    'blue.png brown.png green.png purple.png ic.png ncf-board.png newspaper.png').split(' ');
  const TOKENS = ['wp', 'wn', 'wb', 'wr', 'wq', 'wk', 'bp', 'bn', 'bb', 'br', 'bq', 'bk'];

  const pieces = [{ id: 'default', name: 'Default', group: 'chess.com' }, { id: 'custom:mine', name: 'My pieces', group: 'Yours' }];
  for (const [k, lic] of Object.entries(lichessPieces)) pieces.push({ id: 'lichess:' + k, name: liName(k), group: 'Lichess', license: lic });
  for (const k of ccPieces) pieces.push({ id: 'chesscom:' + k, name: nice(k), group: 'chess.com', is3d: k.startsWith('3d_') });

  const fxBoards = {
    galaxy: 'Galaxy', aurora: 'Aurora', lava: 'Lava', ocean: 'Ocean Caustics', synthwave: 'Synthwave',
    plasma: 'Neon Plasma', matrix: 'Matrix Rain', sakura: 'Sakura', marble: 'Royal Marble', wood: 'Fine Wood', glass: 'Frosted Glass',
    ember: 'Ember Drift', ice: 'Glacier', cyber: 'Circuit', prism: 'Prism', storm: 'Thunderstorm', gold: 'Liquid Gold', forest: 'Forest Glade', deepsea: 'Deep Sea', rain: 'Rainy Window', sunset: 'Desert Sunset',
  };
  const boards = [{ id: 'default', name: 'Default', group: 'chess.com' }, { id: 'custom:board', name: 'My image', group: 'Yours' }];
  for (const [k, n] of Object.entries(fxBoards)) boards.push({ id: 'fx:' + k, name: n, group: 'Animated' });
  for (const f of lichessBoards) boards.push({ id: 'lichess:' + f, name: liName(f.replace(/\.\w+$/, '')), group: 'Lichess', license: 'AGPLv3+' });
  for (const k of ccBoards) boards.push({ id: 'chesscom:' + k, name: nice(k), group: 'chess.com' });

  const sounds = [
    { id: 'chesscom', name: 'Default', group: 'chess.com' },
    ...['standard', 'robot', 'woodland', 'futuristic', 'nes', 'piano', 'sfx', 'lisp'].map((k) => ({ id: 'lichess:' + k, name: nice(k === 'nes' ? 'NES' : k), group: 'Lichess' })),
    ...Object.entries({ soft: 'Soft Wood', arcade: 'Arcade', scifi: 'Sci-Fi', crystal: 'Crystal', bubble: 'Bubbles', cinematic: 'Cinematic', zen: 'Zen Bowls' })
      .map(([k, n]) => ({ id: 'synth:' + k, name: n + ' (synth)', group: 'Synth' })),
    { id: 'custom:mine', name: 'My sounds', group: 'Yours' },
  ];
  // Your own sounds, in the order Settings lists them ('s:<name>' in cfxMedia).
  const SOUND_SLOTS = ['move', 'capture', 'check', 'castle', 'promote', 'win', 'loss', 'draw'];

  // ---------- your own images ----------
  // Uploaded in Settings and kept in chrome.storage.local.cfxMedia as data URLs ({ board, 'p:wn', … }). Pages use them
  // as blob URLs: short in CSS (a multi-MB data URL would be re-parsed on every style change), page-origin on chess.com.
  const DATA = /^data:(image\/(?:png|jpeg|gif|webp));base64,([a-z0-9+/=]+)$/i;
  const AUDIO = /^data:(audio\/(?:mpeg|mp3|wav|x-wav|wave|ogg|webm|mp4|aac|x-m4a));base64,([a-z0-9+/=]+)$/i;
  const formatOf = (k) => (String(k).startsWith('s:') ? AUDIO : DATA); // sounds: audio only; board/pieces: images only
  let media = {};
  const blobs = new Map(); // data URL -> blob URL
  const setMedia = (m) => {
    media = m && typeof m === 'object' ? m : {};
    const keep = new Set(Object.values(media));
    for (const [d, u] of blobs) if (!keep.has(d)) { URL.revokeObjectURL(u); blobs.delete(d); }
  };
  const mediaUrl = (k) => {
    const d = media[k], m = typeof d === 'string' && formatOf(k).exec(d);
    if (!m) return null; // only images ChessFX stored itself, in the formats it accepts
    if (!blobs.has(d)) {
      const bin = atob(m[2]), a = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      blobs.set(d, URL.createObjectURL(new Blob([a], { type: m[1] })));
    }
    return blobs.get(d);
  };
  const hasMedia = (kind) => Object.keys(media).some((k) => (kind === 'board' ? k === 'board' : kind === 'sounds' ? k.startsWith('s:') : k.startsWith('p:')) && formatOf(k).test(media[k]));

  // url(token) for a piece source; null = leave chess.com's own.
  const pieceUrl = (src, tok, px = 150, getURL = (p) => p) => {
    if (!src || src === 'default') return null;
    const [kind, name] = src.split(':');
    if (kind === 'lichess') return getURL(`pieces/${name}/${tok[0]}${tok[1].toUpperCase()}.svg`);
    if (kind === 'chesscom') return `${CC}pieces/${name}/${px >= 200 ? 300 : 150}/${tok}.png`;
    // Your own set: an empty slot falls back to cburnett, so a half-finished set still plays.
    if (kind === 'custom') return mediaUrl('p:' + tok) || getURL(`pieces/cburnett/${tok[0]}${tok[1].toUpperCase()}.svg`);
    return null;
  };
  const boardUrl = (src, getURL = (p) => p) => {
    if (!src) return null;
    const [kind, name] = src.split(':');
    if (kind === 'lichess') return getURL(`boards/lichess/${name}`);
    if (kind === 'chesscom') return `${CC}boards/${name}/150.png`;
    if (kind === 'custom') return mediaUrl('board');
    return null;
  };
  // chess.com has no board thumbnails; textured boards are up to 2.4 MB, so UIs must lazy-load these.
  // Effect choices shared by Settings and the popup ([value, label]).
  const captures = [['none', 'Off'], ['ghost', 'Ghost'], ['burst', 'Burst'], ['shatter', 'Shatter'], ['ring', 'Ring'], ['vortex', 'Vortex'], ['lightning', 'Lightning'], ['pixel', 'Pixels'], ['firework', 'Firework']];
  const trails = [['none', 'Off'], ['ribbon', 'Ribbon'], ['sparks', 'Sparks'], ['comet', 'Comet'], ['fire', 'Flames'], ['stars', 'Stardust']];
  return { CC, TOKENS, captures, trails, pieces, boards, sounds, fxBoards, pieceUrl, boardUrl, setMedia, mediaUrl, hasMedia, DATA, AUDIO, SOUND_SLOTS };
})();
