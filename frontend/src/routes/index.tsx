import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "../lib/auth";
import { Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/login"} replace />;
}
