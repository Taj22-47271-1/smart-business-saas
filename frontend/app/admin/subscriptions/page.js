"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, RefreshCw, Search } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";

const asList = (value) => (Array.isArray(value) ? value : value?.results || []);

export default function SoldSubscriptionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [search, setSearch] = useState("");

  const loadSubscriptions = async () => {
    try {
      setLoadingPage(true);
      const response = await api.get("/subscriptions/admin/sold/");
      setSubscriptions(asList(response.data));
    } catch {
      toast.error("Failed to load sold subscriptions");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) return router.replace("/login");
    if (!loading && user?.role !== "SUPER_ADMIN") return router.replace("/dashboard");
    if (user?.role === "SUPER_ADMIN") loadSubscriptions();
  }, [loading, user, router]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return subscriptions;
    return subscriptions.filter((item) =>
      [item.business_name, item.owner_name, item.owner_email, item.plan_name, item.status]
        .some((field) => String(field || "").toLowerCase().includes(value))
    );
  }, [subscriptions, search]);

  if (loading || loadingPage) {
    return <main className="flex min-h-dvh items-center justify-center"><Loader2 className="animate-spin" /></main>;
  }
  if (!user || user.role !== "SUPER_ADMIN") return null;

  return (
    <DashboardLayout title="Sold Subscriptions" subtitle="View package sales, owners, expiry and renewal history.">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-blue-600">SuperAdmin</p>
          <h1 className="mt-2 text-3xl font-black">Sold Subscriptions</h1>
          <p className="mt-2 text-slate-600">Only subscription and limited owner/business information is shown.</p>
        </div>
        <button onClick={loadSubscriptions} className="btn-secondary"><RefreshCw size={17} /> Refresh</button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="All" value={subscriptions.length} />
        <Stat label="Active" value={subscriptions.filter((item) => item.status === "ACTIVE").length} />
        <Stat label="Trial" value={subscriptions.filter((item) => item.status === "TRIAL").length} />
        <Stat label="Expired" value={subscriptions.filter((item) => !item.has_access).length} />
      </div>

      <div className="card mb-6 p-4 sm:p-5">
        <label className="relative block">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business, owner, email or package" />
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrap rounded-none">
          <table className="min-w-[1050px] text-left">
            <thead><tr><th className="p-4">Business</th><th className="p-4">Owner</th><th className="p-4">Package</th><th className="p-4">Status</th><th className="p-4">Period</th><th className="p-4">Latest Payment</th><th className="p-4">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td className="p-4"><p className="font-black">{item.business_name}</p><p className="text-xs text-slate-500">Business #{item.business}</p></td>
                  <td className="p-4"><p className="font-bold">{item.owner_name}</p><p className="text-wrap-safe text-xs text-slate-500">{item.owner_email}</p><p className="text-xs text-slate-500">{item.owner_phone || "No phone"}</p></td>
                  <td className="p-4"><p className="font-black text-blue-600">{item.plan_name || "Trial / None"}</p><p className="text-sm">{item.plan_price ? `৳ ${item.plan_price}` : "—"}</p></td>
                  <td className="p-4"><Status value={item.expiry_status || item.status} active={item.has_access} /><p className="mt-2 text-xs text-slate-500">{item.days_remaining == null ? "Lifetime / unset" : `${item.days_remaining} days left`}</p></td>
                  <td className="p-4 text-sm"><p>{formatDate(item.subscription_start_date || item.trial_start_date)}</p><p className="mt-1 text-slate-500">to {formatDate(item.subscription_end_date || item.trial_end_date)}</p></td>
                  <td className="p-4"><p className="font-bold">{item.latest_payment_status || "No payment"}</p><p className="text-sm text-slate-500">{item.latest_payment_amount ? `৳ ${item.latest_payment_amount}` : "—"}</p></td>
                  <td className="p-4"><Link href={`/admin/subscriptions/${item.id}`} className="btn-secondary"><Eye size={16} /> Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-8 text-center text-slate-500">No subscriptions matched.</div>}
        </div>
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value }) { return <div className="card p-5"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Status({ value, active }) { return <span className={`rounded-full px-3 py-1 text-xs font-black ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{value}</span>; }
function formatDate(value) { if (!value) return "Not set"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString(); }
