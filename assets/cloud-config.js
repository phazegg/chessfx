// ChessFX accounts: the Supabase project to sync with. Empty = accounts off, everyone is a guest (everything stays local).
// The anon key is meant to be public; Row Level Security on the server keeps each user's data to themselves
// (cloud/schema.sql). Setup steps: docs/ACCOUNTS.md.
self.CX_CLOUD_CONFIG = {
  url: 'https://hzvqhsjakrygkkhwrfjz.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnFoc2pha3J5Z2traHdyZmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MTk1ODMsImV4cCI6MjEwODM5NTU4M30.9qWTuJ8l_xIRCZlFUW_1YFmxCCBNUrd7inrYPrvxZmc', // the project's anon (public) key
  // Where the confirmation and password-reset email links open (the website's confirm page, in the project's allow list).
  linkPage: 'https://phazegg.github.io/chessfx/confirm.html',
  // The ChessFX website (linked from Settings), and the extension ids it may talk to for one shared sign-in (unpacked;
  // add the Chrome Web Store id when there is one, plus the redirect allow list in docs/ACCOUNTS.md).
  site: 'https://phazegg.github.io/chessfx/',
  extensionIds: ['hacojikbbakjgmpfonibgengbimgbicd'],
};
