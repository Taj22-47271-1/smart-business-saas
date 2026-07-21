"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BadgeDollarSign,
  Boxes,
  Building2,
  CreditCard,
  Home,
  Loader2,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PackagePlus,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sun,
  TicketPercent,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import {
  ALL_BUSINESS_ROLES,
  BUSINESS_ROLES,
  FINANCE_ROLES,
  MANAGEMENT_ROLES,
  PLATFORM_ROLES,
  getLandingRoute,
} from "@/lib/roles";

const menuItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
    businessRoles: FINANCE_ROLES,
    allowWithoutMembership: true,
  },
  {
    title: "Business",
    href: "/business",
    icon: Building2,
    businessRoles: [BUSINESS_ROLES.OWNER],
    allowWithoutMembership: true,
  },
  {
    title: "Employees",
    href: "/employees",
    icon: UserPlus,
    businessRoles: [BUSINESS_ROLES.OWNER],
  },
  {
    title: "Products",
    href: "/products",
    icon: Boxes,
    businessRoles: ALL_BUSINESS_ROLES,
  },
  {
    title: "Stock",
    href: "/stock",
    icon: PackagePlus,
    businessRoles: ALL_BUSINESS_ROLES,
  },
  {
    title: "Sales",
    href: "/sales",
    icon: ShoppingCart,
    businessRoles: ALL_BUSINESS_ROLES,
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    businessRoles: ALL_BUSINESS_ROLES,
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: ReceiptText,
    businessRoles: ALL_BUSINESS_ROLES,
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    businessRoles: [BUSINESS_ROLES.OWNER],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    businessRoles: FINANCE_ROLES,
  },
  {
    title: "Chat",
    href: "/chat",
    icon: MessageCircle,
    businessRoles: ALL_BUSINESS_ROLES,
    platformRoles: [PLATFORM_ROLES.SUPER_ADMIN],
  },
  {
    title: "Discounts",
    href: "/discounts",
    icon: TicketPercent,
    businessRoles: MANAGEMENT_ROLES,
  },
  {
    title: "Payment Approval",
    href: "/admin/payments",
    icon: ShieldCheck,
    platformRoles: [PLATFORM_ROLES.SUPER_ADMIN],
  },
  {
    title: "Subscription Plans",
    href: "/admin/subscription-plans",
    icon: BadgeDollarSign,
    platformRoles: [PLATFORM_ROLES.SUPER_ADMIN],
  },
  {
    title: "Sold Subscriptions",
    href: "/admin/subscriptions",
    icon: ListChecks,
    platformRoles: [PLATFORM_ROLES.SUPER_ADMIN],
  },
  {
    title: "Profile",
    href: "/profile",
    icon: User,
    allowAuthenticated: true,
  },
];

export default function DashboardLayout({ children, title, subtitle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [theme, setTheme] = useState("light");

  const activeBusinessRoles = useMemo(
    () => new Set(
      (user?.business_memberships || [])
        .filter((membership) => membership.status === "ACTIVE")
        .map((membership) => membership.role)
    ),
    [user]
  );

  const canAccessItem = (item) => {
    if (!user) return false;
    if (user.role === PLATFORM_ROLES.SUPER_ADMIN) {
      return item.platformRoles?.includes(PLATFORM_ROLES.SUPER_ADMIN) || item.href === "/profile";
    }
    if (item.allowAuthenticated) return true;
    if (
      item.allowWithoutMembership &&
      user.role !== PLATFORM_ROLES.SUPER_ADMIN &&
      activeBusinessRoles.size === 0
    ) return true;
    if (item.platformRoles?.includes(user.role)) return true;
    return item.businessRoles?.some((role) => activeBusinessRoles.has(role)) || false;
  };

  const visibleMenuItems = useMemo(() => {
    return menuItems.filter(canAccessItem);
  }, [user, activeBusinessRoles]);

  const currentPagePermission = useMemo(() => {
    if (!pathname) return null;

    const matchedMenu = menuItems
      .filter((item) => pathname === item.href || pathname.startsWith(item.href))
      .sort((a, b) => b.href.length - a.href.length)[0];

    return matchedMenu || null;
  }, [pathname]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (user?.must_change_password) {
      router.replace("/change-password");
      return;
    }
    if (!user?.role) {
      setCheckingAccess(false);
      return;
    }

    if (!currentPagePermission) {
      setCheckingAccess(false);
      return;
    }

    const hasAccess = canAccessItem(currentPagePermission);

    if (!hasAccess) {
      toast.error("You do not have permission to access this page");
      router.push(getLandingRoute(user));
      return;
    }

    setCheckingAccess(false);
  }, [user, currentPagePermission, router]);

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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (checkingAccess) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="animate-spin" />
          Checking permission...
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`app-sidebar fixed left-0 top-0 z-50 h-dvh w-72 max-w-[86vw] border-r transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className="flex h-[72px] items-center justify-between border-b px-5"
          style={{ borderColor: "var(--border-main)" }}
        >
          <Link href="/dashboard" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <BarChart3 size={22} />
            </div>

            <div>
              <p className="text-lg font-black" style={{ color: "var(--text-main)" }}>
                Smart Business
              </p>
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                SaaS Dashboard
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl p-2 lg:hidden"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex h-[calc(100dvh-72px)] min-h-0 flex-col justify-between p-4">
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "hover:bg-blue-50"
                  }`}
                  style={
                    isActive
                      ? {}
                      : {
                          color: "var(--text-muted)",
                        }
                  }
                >
                  <Icon size={19} className="shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 space-y-4 pt-4">
            <div className="card-soft p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white">
                  {getInitial(user)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black" style={{ color: "var(--text-main)" }}>
                    {user?.first_name || user?.username || "User"}
                  </p>

                  <p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    {user?.email}
                  </p>
                </div>
              </div>

              <p className="mt-3 inline-flex max-w-full rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: "var(--primary-soft)",
                  color: "var(--primary)",
                }}
              >
                <span className="truncate">
                  {user?.role === PLATFORM_ROLES.SUPER_ADMIN
                    ? "SUPER ADMIN"
                    : formatRole([...activeBusinessRoles].join(" / ") || "USER")}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition"
              style={{
                background: "var(--danger-soft)",
                color: "var(--danger)",
              }}
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <section className="app-main-with-sidebar min-w-0 max-w-full">
        <header className="app-header sticky top-0 z-30 border-b">
          <div className="flex h-full min-w-0 items-center justify-between gap-3 px-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="shrink-0 rounded-xl p-2 transition hover:bg-blue-50 lg:hidden"
                style={{ color: "var(--text-muted)" }}
                aria-label="Open sidebar"
              >
                <Menu size={22} />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-lg font-black md:text-xl" style={{ color: "var(--text-main)" }}>
                  {title || "Dashboard"}
                </h1>

                {subtitle && (
                  <p className="hidden truncate text-sm md:block" style={{ color: "var(--text-muted)" }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition hover:scale-105"
                style={{
                  borderColor: "var(--border-main)",
                  background: "var(--bg-surface)",
                  color: "var(--text-main)",
                }}
                aria-label="Toggle theme"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <Link
                href="/profile"
                className="hidden rounded-xl px-4 py-2 text-sm font-black text-white transition hover:scale-105 md:inline-flex"
                style={{ background: "var(--primary)" }}
              >
                My Profile
              </Link>
            </div>
          </div>
        </header>

        <div className="app-content">{children}</div>
      </section>
    </main>
  );
}

function formatRole(role) {
  if (!role) return "USER";

  return role.replaceAll("_", " ");
}

function getInitial(user) {
  const name = user?.first_name || user?.username || user?.email || "U";

  return name.charAt(0).toUpperCase();
}
