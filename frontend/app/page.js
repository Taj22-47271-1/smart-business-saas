"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getLandingRoute } from "@/lib/roles";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    router.replace(getLandingRoute(user));
  }, [loading, user, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 text-slate-600">
        <Loader2 className="animate-spin" />
        Opening workspace...
      </div>
    </main>
  );
}
