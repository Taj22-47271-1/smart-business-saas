"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState("light");
  const [plans, setPlans] = useState([]);
  const [activePlanIndex, setActivePlanIndex] = useState(0);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get("/subscriptions/plans/")
      .then((response) => {
        if (!cancelled) setPlans(safeArray(response.data));
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (plans.length < 2) return;
    const timer = window.setInterval(() => {
      setActivePlanIndex((current) => (current + 1) % plans.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [plans.length]);

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

      await login({
        email: formData.email.trim(),
        password: formData.password,
      });
    } catch {
      // AuthContext displays the appropriate error message.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page min-h-dvh overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
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
              Manage your business with confidence.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--text-muted)]">
              Control products, stock, sales, customer dues, expenses and
              reports from one clean dashboard.
            </p>

            <div className="mt-7 max-w-xl">
              <PlanSlider
                plans={plans}
                activeIndex={activePlanIndex}
                setActiveIndex={setActivePlanIndex}
              />
            </div>

            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
              <FeatureCard title="Secure role-based access" />
              <FeatureCard title="Inventory, sales and due tracking" />
              <FeatureCard title="Accurate reports and CSV export" />
            </div>
          </section>

          <section className="w-full">
            <div className="mx-auto w-full max-w-md">
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
                    Welcome back
                  </p>

                  <h1 className="mt-4 text-3xl font-black text-[var(--text-main)]">
                    Login to your account
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Enter your email and password to access your business
                    dashboard.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
                      Email Address
                    </label>

                    <div className="relative">
                      <Mail
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
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
                    <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
                      Password
                    </label>

                    <div className="relative">
                      <Lock
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
                      />

                      <input
                        className="input pl-11 pr-12"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((previous) => !previous)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition hover:text-[var(--primary)]"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-sm font-black text-[var(--primary)] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      <>
                        Login
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm text-[var(--text-muted)]">
                    Don&apos;t have an account?{" "}
                    <Link
                      href="/register"
                      className="font-black text-[var(--primary)] hover:underline"
                    >
                      Start free trial
                    </Link>
                  </p>
                </form>
              </div>

              <div className="mt-6 lg:hidden">
                <PlanSlider
                  plans={plans}
                  activeIndex={activePlanIndex}
                  setActiveIndex={setActivePlanIndex}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
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

function PlanSlider({ plans, activeIndex, setActiveIndex }) {
  if (plans.length === 0) return null;
  const index = Math.min(activeIndex, plans.length - 1);
  const plan = plans[index];
  const move = (direction) => {
    setActiveIndex((current) => (current + direction + plans.length) % plans.length);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-xl shadow-blue-600/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">
            Subscription Plan
          </p>
          <h2 className="mt-2 text-2xl font-black">{plan.name}</h2>
          <p className="mt-2 text-3xl font-black">
            ৳ {Number(plan.price || 0).toFixed(2)}
          </p>
          <p className="mt-1 text-sm font-bold text-blue-100">
            {formatPlanDuration(plan)}
          </p>
        </div>
        <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
          <BadgeDollarSign size={28} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white/15 px-3 py-1.5">
          {plan.max_products} products
        </span>
        <span className="rounded-full bg-white/15 px-3 py-1.5">
          {plan.max_staff} employees
        </span>
        {plan.has_reports && (
          <span className="rounded-full bg-white/15 px-3 py-1.5">Reports</span>
        )}
        {(plan.features || []).slice(0, 3).map((feature) => (
          <span key={feature} className="rounded-full bg-white/15 px-3 py-1.5">
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          className="rounded-xl bg-white/15 p-2 hover:bg-white/25"
          aria-label="Previous subscription plan"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex gap-2">
          {plans.map((item, planIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(planIndex)}
              className={`h-2.5 rounded-full transition-all ${
                planIndex === index ? "w-7 bg-white" : "w-2.5 bg-white/40"
              }`}
              aria-label={`Show ${item.name} plan`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => move(1)}
          className="rounded-xl bg-white/15 p-2 hover:bg-white/25"
          aria-label="Next subscription plan"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function formatPlanDuration(plan) {
  if (plan.interval === "LIFETIME") return "Lifetime access";
  const count = Number(plan.duration_count || 1);
  const unit = plan.interval === "YEARLY" ? "year" : "month";
  return `${count} ${unit}${count === 1 ? "" : "s"} access`;
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.results)) return value.results;
  return [];
}
