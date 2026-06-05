// REPLACED: Supabase auth middleware diganti dengan JWT dari Node.js backend
// File ini di-mock agar tidak error saat build

export const requireSupabaseAuth = {
  server: (fn: any) => fn,
};
