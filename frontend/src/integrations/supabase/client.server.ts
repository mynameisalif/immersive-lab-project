// REPLACED: Supabase admin client diganti dengan Node.js backend
// File ini di-mock agar tidak error saat build

export const supabaseAdmin = {
  from: (table: string) => ({
    select: () => ({ data: [], error: null }),
    insert: (data: any) => ({ data: null, error: null }),
    update: (data: any) => ({ eq: () => ({ data: null, error: null }) }),
    delete: () => ({ eq: () => ({ data: null, error: null }) }),
  }),
};
