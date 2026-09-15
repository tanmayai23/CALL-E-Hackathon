"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, ArrowRight, AlertCircle, Lock, Mail, Shield, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { BrandMark } from "@/components/ui/BrandMark";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, switchRole } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error);
      } else {
        router.push("/ops");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const fillQuickDemo = (demoEmail: string, demoRole: "ADMIN" | "DISTRIBUTOR") => {
    setEmail(demoEmail);
    setPassword("admin123");
    switchRole(demoRole);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl border border-line shadow-sm">
        <div className="flex flex-col items-center text-center space-y-2">
          <BrandMark />
          <h1 className="text-2xl font-serif font-semibold text-ink mt-3">Welcome Back</h1>
          <p className="text-sm text-ink-dim">
            Sign in to Market Buddy Wholesale Coordination Desk
          </p>
        </div>

        {/* Quick Test Fill Buttons (Development Only) */}
        {process.env.NODE_ENV === "development" && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-ink-dim uppercase tracking-wider block text-center">Development Test Accounts</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillQuickDemo("admin@marketbuddy.ai", "ADMIN")}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Admin Test</span>
              </button>
              <button
                type="button"
                onClick={() => fillQuickDemo("wholesaler@northgate-dist.com", "DISTRIBUTOR")}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg border border-blue-500/20 bg-blue-50/50 text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Wholesaler Test</span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-ink-dim" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@distributor.com"
                className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-canvas"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-ink-dim" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-canvas"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-ink text-white font-medium text-sm rounded-lg hover:bg-ink/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-line text-center text-xs text-ink-dim">
          Don't have an account?{" "}
          <Link href="/register" className="font-semibold text-amber-700 hover:underline inline-flex items-center gap-0.5">
            Register for RBAC Access <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
