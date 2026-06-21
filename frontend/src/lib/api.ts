import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// ✅ Request interceptor with logging
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    console.log("📤 [API Request]", config.url);
    console.log("   Token exists:", !!token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("   Token sent:", token.substring(0, 50) + "...");
    } else {
      console.log("   ⚠️ NO TOKEN IN LOCALSTORAGE!");
    }
  }
  return config;
});

// ✅ Response interceptor with logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("📥 [API Error]", error.response?.status, error.config?.url);

    // ⏸️ TEMPORARILY DISABLED FOR DEBUGGING
    if (error.response?.status === 401 && typeof window !== "undefined") {
      console.log("❌ [401 ERROR] - Logging out");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("profile");
      localStorage.removeItem("role");
      window.location.href = "/login";
    }

    if (error.response?.status === 401) {
      console.log("⚠️  [401 ERROR] - NOT LOGGING OUT (disabled for debugging)");
    }

    return Promise.reject(error);
  },
);

export default api;
