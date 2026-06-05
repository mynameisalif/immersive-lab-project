// REPLACED: Supabase client → Node.js backend via axios
// Fix hydration error: semua localStorage access dibungkus typeof window check

import api from "../../lib/api";

// Helper aman untuk akses localStorage (avoid SSR error)
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

export const supabase = {
  auth: {
    getSession: async () => {
      const token = safeLocalStorage.getItem("token");
      const user = safeLocalStorage.getItem("user");
      if (!token || !user) return { data: { session: null }, error: null };
      try {
        return {
          data: {
            session: {
              access_token: token,
              user: JSON.parse(user),
            },
          },
          error: null,
        };
      } catch {
        return { data: { session: null }, error: null };
      }
    },

    getUser: async () => {
      const user = safeLocalStorage.getItem("user");
      if (!user) return { data: { user: null }, error: null };
      try {
        return { data: { user: JSON.parse(user) }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    },

    signInWithPassword: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      try {
        const res = await api.post("/api/auth/login", { email, password });
        safeLocalStorage.setItem("token", res.data.token);
        safeLocalStorage.setItem("user", JSON.stringify(res.data.data));
        return {
          data: {
            session: { access_token: res.data.token },
            user: res.data.data,
          },
          error: null,
        };
      } catch (err: any) {
        return {
          data: { session: null, user: null },
          error: { message: err.response?.data?.message || "Login gagal" },
        };
      }
    },

    signUp: async ({ email, password, options }: any) => {
      try {
        const res = await api.post("/api/auth/register", {
          email,
          password,
          full_name: options?.data?.full_name || "",
          nim_nip: options?.data?.nim_nip || "",
          phone: options?.data?.phone || "",
          role: options?.data?.role || "student",
        });
        return { data: { user: res.data.data }, error: null };
      } catch (err: any) {
        return {
          data: { user: null },
          error: { message: err.response?.data?.message || "Register gagal" },
        };
      }
    },

    signOut: async () => {
      safeLocalStorage.removeItem("token");
      safeLocalStorage.removeItem("user");
      return { error: null };
    },

    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      // Hanya jalan di client
      if (typeof window !== "undefined") {
        const token = safeLocalStorage.getItem("token");
        const user = safeLocalStorage.getItem("user");
        if (token && user) {
          try {
            callback("SIGNED_IN", {
              access_token: token,
              user: JSON.parse(user),
            });
          } catch {
            callback("SIGNED_OUT", null);
          }
        } else {
          callback("SIGNED_OUT", null);
        }
      }
      return {
        data: {
          subscription: { unsubscribe: () => {} },
        },
      };
    },
  },

  // Mock from() — komponen yang masih pakai supabase.from() tidak akan crash
  from: (_table: string) => ({
    select: (_columns?: string) => ({
      eq: (_col: string, _val: any) => ({
        single: async () => ({ data: null, error: null }),
        order: () => ({ data: [], error: null }),
        data: [],
        error: null,
      }),
      order: (_col: string, _opts?: any) => ({ data: [], error: null }),
      single: async () => ({ data: null, error: null }),
      data: [],
      error: null,
    }),
    insert: (_data: any) => ({
      select: () => ({
        single: async () => ({ data: null, error: null }),
      }),
    }),
    update: (_data: any) => ({
      eq: (_col: string, _val: any) => ({
        select: () => ({ single: async () => ({ data: null, error: null }) }),
      }),
    }),
    delete: () => ({
      eq: (_col: string, _val: any) => ({ data: null, error: null }),
    }),
  }),
};

export default supabase;
