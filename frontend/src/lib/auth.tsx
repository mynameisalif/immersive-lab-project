// ============================================================
// lib/auth.ts — FIXED: tambah role & is_kaprodi ke profileData
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import api from "./api";

// ── Types ─────────────────────────────────────────────────────
export type AppRole = "student" | "dosen" | "admin" | "staff";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "dosen" | "student" | "staff";
  is_kaprodi: boolean;
  nim_nip?: string | null;
  phone: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
}

interface AuthState {
  session: { access_token: string } | null;
  user: { id: string; email: string } | null;
  profile: Profile | null;
  role: AppRole | null;
  isKaprodi: boolean; // ← tambah helper langsung
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    nimNip: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ── Helper localStorage ───────────────────────────────────────
const ls = {
  get: (key: string) => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, val: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, val);
    } catch {}
  },
  remove: (key: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

// ── Context ───────────────────────────────────────────────────
const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Ambil profile lengkap dari backend
  const loadProfile = async (token: string) => {
    try {
      const res = await api.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data.data;

      // ✅ FIX: include role & is_kaprodi
      const profileData: Profile = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        is_kaprodi: data.is_kaprodi ?? false,
        nim_nip: data.nim_nip ?? null,
        phone: data.phone ?? null,
        is_blocked: data.is_blocked ?? false,
        blocked_reason: data.blocked_reason ?? null,
      };

      setProfile(profileData);
      setRole((data.role as AppRole) ?? null);

      ls.set("profile", JSON.stringify(profileData));
      ls.set("role", data.role ?? "");
    } catch {
      setProfile(null);
      setRole(null);
    }
  };

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);

    const token = ls.get("token");
    const savedUser = ls.get("user");
    const savedProfile = ls.get("profile");
    const savedRole = ls.get("role");

    if (token && savedUser) {
      try {
        setSession({ access_token: token });

        if (savedProfile) {
          setProfile(JSON.parse(savedProfile));
          setRole((savedRole as AppRole) ?? null);
          setLoading(false);
          void loadProfile(token); // refresh background
        } else {
          void loadProfile(token).finally(() => setLoading(false));
        }
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // ── signIn ────────────────────────────────────────────────
  const signIn: AuthState["signIn"] = async (email, password) => {
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { token, data: userData } = res.data;

      ls.set("token", token);
      ls.set("user", JSON.stringify(userData));
      setSession({ access_token: token });
      await loadProfile(token);

      return { error: null };
    } catch (err: any) {
      return {
        error: err.response?.data?.message ?? "Email atau password salah",
      };
    }
  };

  // ── signUp ────────────────────────────────────────────────
  const signUp: AuthState["signUp"] = async (
    email,
    password,
    full_name,
    nim_nip,
  ) => {
    const validEmail =
      email.endsWith("@student.mnp.ac.id") ||
      email.endsWith("@mnp.ac.id") ||
      email === "admin@mnp.ac.id";

    if (!validEmail)
      return { error: "Email harus @student.mnp.ac.id atau @mnp.ac.id" };

    let role: AppRole = "student";
    if (email.endsWith("@mnp.ac.id") && !email.startsWith("admin"))
      role = "dosen";
    if (email === "admin@mnp.ac.id") role = "admin";

    try {
      await api.post("/api/auth/register", {
        email,
        password,
        full_name,
        nim_nip,
        role,
      });
      return { error: null };
    } catch (err: any) {
      return { error: err.response?.data?.message ?? "Registrasi gagal" };
    }
  };

  // ── signOut ───────────────────────────────────────────────
  const signOut = async () => {
    ls.remove("token");
    ls.remove("user");
    ls.remove("profile");
    ls.remove("role");
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  // ── refresh ───────────────────────────────────────────────
  const refresh = async () => {
    const token = ls.get("token");
    if (token) await loadProfile(token);
  };

  if (!mounted) return null;

  // ✅ isKaprodi helper — dosen dengan is_kaprodi = true
  const isKaprodi = profile?.role === "dosen" && (profile?.is_kaprodi ?? false);

  return (
    <Ctx.Provider
      value={{
        session,
        user: profile ? { id: profile.id, email: profile.email } : null,
        profile,
        role,
        isKaprodi,
        loading,
        signIn,
        signUp,
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
