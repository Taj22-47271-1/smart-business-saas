"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Loader2, Mail } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";

export default function SoldSubscriptionDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (!loading && !user) return router.replace("/login");
    if (!loading && user?.role !== "SUPER_ADMIN") return router.replace("/dashboard");
    if (user?.role === "SUPER_ADMIN") {
      api.get(`/subscriptions/admin/sold/${id}/`)
        .then((response) => setSubscription(response.data))
        .catch(() => toast.error("Failed to load subscription details"))
        .finally(() => setLoadingPage(false));
    }
  }, [loading, user, router, id]);

  if (loading || loadingPage) return <main className="flex min-h-dvh items-center justify-center"><Loader2 className="animate-spin" /></main>;
  if (!subscription) return null;
  const benefits = [...new Set([
    subscription.plan_max_products != null ? `Up to ${subscription.plan_max_products} products` : null,
    subscription.plan_max_staff != null ? `Up to ${subscription.plan_max_staff} employees` : null,
    subscription.plan_has_reports ? "Business reports" : null,
    subscription.plan_has_pdf_invoice ? "PDF invoices" : null,
    subscription.plan_has_online_shop ? "Online shop" : null,
    ...(subscription.plan_features || []),
  ].filter(Boolean))];

  return (
    <DashboardLayout title="Subscription Details" subtitle="Limited SaaS billing and package information.">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/subscriptions" className="btn-secondary"><ArrowLeft size={17} /> Back</Link>
        <a href={`mailto:${subscription.owner_email}?subject=Subscription renewal reminder for ${subscription.business_name}`} className="btn-primary"><Mail size={17} /> Send Renewal Email</a>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6"><h2 className="text-xl font-black">Owner & Business</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Business" value={subscription.business_name} /><Info label="Business ID" value={subscription.business} /><Info label="Owner" value={subscription.owner_name} /><Info label="Owner ID" value={subscription.owner_id} /><Info label="Email" value={subscription.owner_email} /><Info label="Phone" value={subscription.owner_phone || "Not provided"} /></div></section>
        <section className="card p-5 sm:p-6"><h2 className="text-xl font-black">Package</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Plan" value={subscription.plan_name || "Trial / None"} /><Info label="Price" value={subscription.plan_price ? `৳ ${subscription.plan_price}` : "—"} /><Info label="Duration" value={formatDuration(subscription)} /><Info label="Status" value={subscription.status} /><Info label="Start" value={formatDate(subscription.subscription_start_date || subscription.trial_start_date)} /><Info label="End" value={formatDate(subscription.subscription_end_date || subscription.trial_end_date)} /><Info label="Days remaining" value={subscription.days_remaining == null ? "Lifetime / unset" : subscription.days_remaining} /></div>{benefits.length > 0 && <ul className="mt-5 grid gap-2 sm:grid-cols-2">{benefits.map((feature) => <li key={feature} className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800"><Check size={16} className="mt-0.5 shrink-0" /><span className="text-wrap-safe">{feature}</span></li>)}</ul>}</section>
      </div>

      <section className="card mt-6 overflow-hidden"><div className="border-b border-slate-200 p-5 sm:p-6"><h2 className="text-xl font-black">Payment & Renewal History</h2></div><div className="table-wrap rounded-none"><table className="min-w-[950px] text-left"><thead><tr><th className="p-4">Date</th><th className="p-4">Package</th><th className="p-4">Amount</th><th className="p-4">Method</th><th className="p-4">Transaction</th><th className="p-4">Status</th><th className="p-4">Proof</th></tr></thead><tbody className="divide-y divide-slate-200">{(subscription.payment_history || []).map((payment) => <tr key={payment.id}><td className="p-4 text-sm">{formatDate(payment.created_at)}</td><td className="p-4 font-bold">{payment.plan_name}</td><td className="p-4">৳ {payment.amount}</td><td className="p-4">{payment.payment_method}</td><td className="p-4 text-wrap-safe">{payment.transaction_id}</td><td className="p-4 font-black">{payment.status}</td><td className="p-4">{payment.screenshot ? <a href={payment.screenshot} target="_blank" rel="noreferrer" className="btn-secondary"><ExternalLink size={15} /> View</a> : "—"}</td></tr>)}</tbody></table>{!(subscription.payment_history || []).length && <div className="p-8 text-center text-slate-500">No payments yet.</div>}</div></section>
    </DashboardLayout>
  );
}

function Info({ label, value }) { return <div className="safe-card bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="text-wrap-safe mt-1 font-black">{String(value ?? "—")}</p></div>; }
function formatDate(value) { if (!value) return "Not set"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString(); }
function formatDuration(item) { if (item.plan_interval === "LIFETIME") return "Lifetime"; if (!item.plan_interval) return "Trial"; return `${item.plan_duration_count} ${item.plan_interval === "YEARLY" ? "year(s)" : "month(s)"}`; }
