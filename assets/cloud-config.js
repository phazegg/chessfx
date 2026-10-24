// ChessFX accounts: the Supabase project to sync with. Empty = accounts off, everyone is a guest (everything stays local).
// The anon key is meant to be public; Row Level Security on the server keeps each user's data to themselves
// (cloud/schema.sql). Setup steps: docs/ACCOUNTS.md.
self.CX_CLOUD_CONFIG = {
  url: '',     // e.g. 'https://abcdefgh.supabase.co'
  anonKey: '', // the project's anon (public) key
};
