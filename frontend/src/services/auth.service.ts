import api from "@/lib/api";

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  nim_nip?: string | null;
  phone?: string | null;
  role?: "student" | "dosen" | "admin";
}

export const login = (email: string, password: string) =>
  api.post("/api/auth/login", { email, password });

export const register = (data: RegisterPayload) =>
  api.post("/api/auth/register", data);

export const getProfile = () => api.get("/api/auth/me");

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("profile");
  localStorage.removeItem("role");
  window.location.href = "/login";
};

export const getToken = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

export const getUser = () => {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("user");
  try {
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
};

export const isLoggedIn = (): boolean =>
  typeof window !== "undefined" && !!localStorage.getItem("token");
