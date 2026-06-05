import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Mail,
  Lock,
  ArrowRight,
  GraduationCap,
  Briefcase,
  User,
  IdCard,
  Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { BrandLogo } from "../components/common/BrandLogo";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Masuk · MNP Lab Loan" },
      {
        name: "description",
        content: "Masuk ke sistem peminjaman aset lab MNP dengan email kampus.",
      },
    ],
  }),
});

function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nimNip, setNimNip] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateEmail = (val: string) => {
    if (!val) return setDomainError(null);
    const ok = val.endsWith("@student.mnp.ac.id") || val.endsWith("@mnp.ac.id");
    setDomainError(
      ok ? null : "Gunakan email kampus @student.mnp.ac.id atau @mnp.ac.id",
    );
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (domainError) return;
    setLoading(true);
    if (mode === "signin") {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) return toast.error(error);
      toast.success("Berhasil masuk");
      navigate({ to: "/dashboard" });
    } else {
      if (!fullName || !nimNip) {
        setLoading(false);
        return toast.error("Nama dan NIM/NIP wajib diisi");
      }
      const { error } = await signUp(email, password, fullName, nimNip);
      setLoading(false);
      if (error) return toast.error(error);
      toast.success("Akun dibuat. Silakan cek email untuk verifikasi.");
      setMode("signin");
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden overflow-hidden lg:block"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, rgba(255,200,37,0.5), transparent 45%), radial-gradient(circle at 75% 75%, rgba(30,95,217,0.6), transparent 50%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <BrandLogo variant="light" />
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-bold leading-tight text-primary-foreground">
              Pinjam Aset Lab. <br />
              <span className="text-brand">Cepat, Tertib, Terdata.</span>
            </h2>
            <p className="mt-4 text-primary-foreground/80">
              Sistem peminjaman aset laboratorium MNP. Akses dengan email
              kampusmu.
            </p>
            <div className="mt-8 grid gap-3">
              <div className="flex items-start gap-3 rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-3 backdrop-blur">
                <GraduationCap className="size-5 shrink-0 text-brand" />
                <div className="text-sm text-primary-foreground/85">
                  <span className="font-semibold text-primary-foreground">
                    Mahasiswa
                  </span>{" "}
                  —{" "}
                  <span className="font-mono text-brand">
                    @student.mnp.ac.id
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-3 backdrop-blur">
                <Briefcase className="size-5 shrink-0 text-brand" />
                <div className="text-sm text-primary-foreground/85">
                  <span className="font-semibold text-primary-foreground">
                    Dosen / Admin
                  </span>{" "}
                  — <span className="font-mono text-brand">@mnp.ac.id</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-primary-foreground/60">
            © {new Date().getFullYear()} Multimedia Nusantara Polytechnic
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandLogo variant="dark" />
          </div>

          <div className="rounded-2xl border bg-card p-8 shadow-(--shadow-card)">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {mode === "signin" ? "Selamat datang kembali" : "Buat akun baru"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Masuk untuk mengelola peminjaman aset lab Anda."
                : "Daftar memakai email kampus MNP."}
            </p>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nama Lengkap</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="fullName"
                        className="h-11 pl-9"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nimNip">NIM / NIP</Label>
                    <div className="relative">
                      <IdCard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="nimNip"
                        className="h-11 pl-9 font-mono"
                        value={nimNip}
                        onChange={(e) => setNimNip(e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Akan diverifikasi manual oleh admin lab.
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Kampus</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@student.mnp.ac.id"
                    className="h-11 pl-9"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      validateEmail(e.target.value);
                    }}
                    required
                  />
                </div>
                {domainError ? (
                  <p className="text-xs text-destructive">{domainError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">@student.mnp.ac.id</span> atau{" "}
                    <span className="font-mono">@mnp.ac.id</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-11 pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    {mode === "signin" ? "Masuk" : "Daftar"}{" "}
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Belum punya akun?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="font-semibold text-accent hover:underline"
                  >
                    Daftar di sini
                  </button>
                </>
              ) : (
                <>
                  Sudah punya akun?{" "}
                  <button
                    onClick={() => setMode("signin")}
                    className="font-semibold text-accent hover:underline"
                  >
                    Masuk
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Dengan masuk, Anda menyetujui ketentuan penggunaan & kebijakan
            privasi MNP.
          </p>
        </div>
      </div>
    </div>
  );
}
