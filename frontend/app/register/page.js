"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    first_name: "",
    last_name: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    localStorage.setItem("smart-business-theme", nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      await register(formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page min-h-dvh overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <section className="hidden lg:block">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <BarChart3 size={26} />
              </div>

              <div>
                <p className="text-2xl font-black text-[var(--text-main)]">
                  Smart Business
                </p>
                <p className="text-sm font-bold text-[var(--text-muted)]">
                  SaaS Management Platform
                </p>
              </div>
            </Link>

            <h1 className="mt-10 max-w-xl text-5xl font-black leading-tight text-[var(--text-main)]">
              Start your business dashboard today.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--text-muted)]">
              Create an account, add your business, manage products, stock,
              sales, expenses and customer dues from one system.
            </p>

            <div className="mt-8 grid max-w-xl gap-4">
              <FeatureCard title="5 days free trial" />
              <FeatureCard title="Role-based business management" />
              <FeatureCard title="Invoices, vouchers and reports" />
            </div>
          </section>

          <section className="w-full">
            <div className="mx-auto w-full max-w-2xl">
              <div className="mb-6 flex items-center justify-between gap-4">
                <Link href="/" className="flex items-center gap-3 lg:hidden">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                    <BarChart3 size={23} />
                  </div>

                  <div>
                    <p className="text-lg font-black text-[var(--text-main)]">
                      Smart Business
                    </p>
                    <p className="text-xs font-bold text-[var(--text-muted)]">
                      SaaS Platform
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition hover:scale-105"
                  style={{
                    borderColor: "var(--border-main)",
                    background: "var(--bg-surface)",
                    color: "var(--text-main)",
                  }}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
                </button>
              </div>

              <div className="auth-card card p-6 md:p-8">
                <div className="mb-7">
                  <p className="inline-flex rounded-full px-3 py-1 text-xs font-black"
                    style={{
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                    }}
                  >
                    Free trial
                  </p>

                  <h1 className="mt-4 text-3xl font-black text-[var(--text-main)]">
                    Create your account
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Start your 5 days free trial. After registration, you can
                    create and manage your business.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <AuthInput
                      label="First Name"
                      icon={User}
                      type="text"
                      name="first_name"
                      placeholder="First name"
                      value={formData.first_name}
                      onChange={handleChange}
                      required
                    />

                    <AuthInput
                      label="Last Name"
                      icon={User}
                      type="text"
                      name="last_name"
                      placeholder="Last name"
                      value={formData.last_name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <AuthInput
                      label="Username"
                      icon={User}
                      type="text"
                      name="username"
                      placeholder="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                    />

                    <AuthInput
                      label="Phone"
                      icon={Phone}
                      type="text"
                      name="phone"
                      placeholder="01XXXXXXXXX"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>

                  <AuthInput
                    label="Email Address"
                    icon={Mail}
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />

                  <div className="grid gap-5 md:grid-cols-2">
                    <PasswordInput
                      label="Password"
                      name="password"
                      placeholder="Minimum 8 characters"
                      value={formData.password}
                      onChange={handleChange}
                      showPassword={showPassword}
                      onToggle={() =>
                        setShowPassword((previous) => !previous)
                      }
                    />

                    <PasswordInput
                      label="Confirm Password"
                      name="confirm_password"
                      placeholder="Confirm password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      showPassword={showConfirmPassword}
                      onToggle={() =>
                        setShowConfirmPassword((previous) => !previous)
                      }
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm text-[var(--text-muted)]">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="font-black text-[var(--primary)] hover:underline"
                    >
                      Login
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function AuthInput({
  label,
  icon: Icon,
  type,
  name,
  placeholder,
  value,
  onChange,
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
        {label}
      </label>

      <div className="relative">
        <Icon
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
        />

        <input
          className="input pl-11"
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
        />
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  name,
  placeholder,
  value,
  onChange,
  showPassword,
  onToggle,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
        {label}
      </label>

      <div className="relative">
        <Lock
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
        />

        <input
          className="input pl-11 pr-12"
          type={showPassword ? "text" : "password"}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition hover:text-[var(--primary)]"
          aria-label="Toggle password visibility"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function FeatureCard({ title }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
        <ShieldCheck size={20} />
      </div>

      <p className="font-bold text-[var(--text-main)]">{title}</p>
    </div>
  );
}