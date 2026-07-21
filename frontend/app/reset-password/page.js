"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromUrl = searchParams.get("email") || "";

  const [formData, setFormData] = useState({
    email: emailFromUrl,
    otp: "",
    new_password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formData.new_password !== formData.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/accounts/reset-password/", formData);

      toast.success("Password reset successfully. Please login.");

      router.push("/login");
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to reset password");
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
            href="/forgot-password"
            className="inline-flex items-center gap-2 font-bold text-slate-700 hover:text-blue-600"
          >
            <ArrowLeft size={18} />
            Back
          </Link>
        </div>

        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-black text-slate-950">
            Smart Business
          </Link>

          <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-100 text-blue-600">
            <KeyRound size={30} />
          </div>

          <h1 className="mt-6 text-3xl font-black text-slate-950">
            Reset Password
          </h1>

          <p className="mt-2 text-slate-600">
            Enter OTP and set your new password.
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
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              OTP Code
            </label>

            <div className="relative">
              <KeyRound
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                className="input pl-11"
                type="text"
                name="otp"
                placeholder="Enter 6 digit OTP"
                value={formData.otp}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              New Password
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                className="input pl-11 pr-11"
                type={showPassword ? "text" : "password"}
                name="new_password"
                placeholder="New password"
                value={formData.new_password}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Confirm Password
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                className="input pl-11 pr-11"
                type={showConfirmPassword ? "text" : "password"}
                name="confirm_password"
                placeholder="Confirm new password"
                value={formData.confirm_password}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((previous) => !previous)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
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
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already reset?{" "}
            <Link href="/login" className="font-bold text-blue-600">
              Login
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading reset form...
          </div>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
