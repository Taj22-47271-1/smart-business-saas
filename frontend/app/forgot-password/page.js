"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);

      await api.post("/accounts/forgot-password/", {
        email,
      });

      toast.success("OTP sent successfully");

      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to send OTP");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 font-bold text-slate-700 hover:text-blue-600"
          >
            <ArrowLeft size={18} />
            Back to Login
          </Link>
        </div>

        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-black text-slate-950">
            Smart Business
          </Link>

          <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-100 text-blue-600">
            <ShieldCheck size={30} />
          </div>

          <h1 className="mt-6 text-3xl font-black text-slate-950">
            Forgot Password?
          </h1>

          <p className="mt-2 text-slate-600">
            Enter your account email. We will send a 6 digit OTP.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5 p-6">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Email Address
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                className="input pl-11"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending OTP...
              </>
            ) : (
              "Send OTP"
            )}
          </button>

          <p className="text-center text-sm text-slate-600">
            Remember your password?{" "}
            <Link href="/login" className="font-bold text-blue-600">
              Login
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}