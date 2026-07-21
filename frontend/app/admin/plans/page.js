"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  interval: "MONTHLY",
  duration_count: "1",
  max_products: "100",
  max_staff: "3",
  has_reports: true,
  has_online_shop: false,
  has_pdf_invoice: true,
  features_text: "",
  is_active: true,
};

const asList = (value) => (Array.isArray(value) ? value : value?.results || []);

export default function AdminPlansPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedPlans, setSelectedPlans] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingSubscriptionId, setUpdatingSubscriptionId] = useState(null);

  const loadData = async () => {
    try {
      setLoadingPage(true);
      const [planResponse, subscriptionResponse] = await Promise.all([
        api.get("/subscriptions/plans/admin/"),
        api.get("/subscriptions/admin/"),
      ]);
      const planList = asList(planResponse.data);
      const subscriptionList = asList(subscriptionResponse.data);
      setPlans(planList);
      setSubscriptions(subscriptionList);
      setSelectedPlans(
        Object.fromEntries(
          subscriptionList.map((subscription) => [
            subscription.id,
            subscription.plan ? String(subscription.plan) : "",
          ])
        )
      );
    } catch {
      toast.error("Failed to load subscription management data");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) return router.replace("/login");
    if (!loading && user?.role !== "SUPER_ADMIN") {
      return router.replace("/dashboard");
    }
    if (user?.role === "SUPER_ADMIN") loadData();
  }, [loading, user, router]);

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const edit = (plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      interval: plan.interval,
      duration_count: String(plan.duration_count || 1),
      max_products: String(plan.max_products),
      max_staff: String(plan.max_staff),
      has_reports: plan.has_reports,
      has_online_shop: plan.has_online_shop,
      has_pdf_invoice: plan.has_pdf_invoice,
      features_text: asList(plan.features).join("\n"),
      is_active: plan.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      max_products: Number(form.max_products),
      max_staff: Number(form.max_staff),
      duration_count: Number(form.duration_count),
      features: form.features_text
        .split("\n")
        .map((feature) => feature.trim())
        .filter(Boolean),
    };
    delete payload.features_text;

    try {
      setSubmitting(true);
      if (editingId) {
        await api.patch(`/subscriptions/plans/admin/${editingId}/`, payload);
      } else {
        await api.post("/subscriptions/plans/admin/", payload);
      }
      toast.success(editingId ? "Plan updated successfully" : "Plan created successfully");
      reset();
      await loadData();
    } catch (error) {
      showApiError(error, "Failed to save plan");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (plan) => {
    try {
      await api.patch(`/subscriptions/plans/admin/${plan.id}/`, {
        is_active: !plan.is_active,
      });
      await loadData();
      toast.success(`Plan ${plan.is_active ? "deactivated" : "activated"}`);
    } catch {
      toast.error("Failed to update plan status");
    }
  };

  const updateBusinessPlan = async (subscription) => {
    const planId = selectedPlans[subscription.id];
    if (!planId) {
      toast.error("Select a plan first");
      return;
    }

    try {
      setUpdatingSubscriptionId(subscription.id);
      await api.patch(`/subscriptions/admin/${subscription.id}/`, {
        plan_id: Number(planId),
      });
      toast.success(`${subscription.business_name} package updated`);
      await loadData();
    } catch (error) {
      showApiError(error, "Failed to update business package");
    } finally {
      setUpdatingSubscriptionId(null);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </main>
    );
  }
  if (!user || user.role !== "SUPER_ADMIN") return null;

  return (
    <DashboardLayout
      title="Subscription Plans"
      subtitle="Manage packages, benefits and business subscriptions."
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-blue-600">SuperAdmin</p>
          <h1 className="mt-2 text-3xl font-black">Subscription Management</h1>
          <p className="mt-2 text-slate-600">
            Update prices, benefits and the package assigned to each business.
          </p>
        </div>
        <button onClick={loadData} className="btn-secondary">
          <RefreshCw size={17} /> Refresh
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_430px]">
        <section className="grid min-w-0 gap-5 md:grid-cols-2">
          {plans.length === 0 ? (
            <div className="card col-span-full p-8 text-center text-slate-500">
              No subscription plans found.
            </div>
          ) : (
            plans.map((plan) => (
              <article key={plan.id} className="card p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${plan.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {plan.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <h2 className="mt-3 break-words text-2xl font-black">{plan.name}</h2>
                    {plan.description && <p className="mt-2 break-words text-sm text-slate-500">{plan.description}</p>}
                    <p className="mt-1 text-3xl font-black text-blue-600">
                      ৳ {Number(plan.price).toFixed(2)}
                    </p>
                    <p className="mt-1 font-bold text-slate-500">{formatDuration(plan)}</p>
                  </div>
                  <BadgeDollarSign className="shrink-0 text-blue-600" size={30} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <PlanValue label="Products" value={plan.max_products} />
                  <PlanValue label="Employees" value={plan.max_staff} />
                  <PlanValue label="Reports" value={plan.has_reports ? "Yes" : "No"} />
                  <PlanValue label="PDF Invoice" value={plan.has_pdf_invoice ? "Yes" : "No"} />
                  <PlanValue label="Online Shop" value={plan.has_online_shop ? "Yes" : "No"} />
                </div>

                {asList(plan.features).length > 0 && (
                  <div className="mt-5 rounded-2xl bg-blue-50 p-4">
                    <p className="text-sm font-black text-blue-900">Additional benefits</p>
                    <ul className="mt-2 space-y-2 text-sm font-semibold text-blue-800">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check size={16} className="mt-0.5 shrink-0" />
                          <span className="break-words">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => edit(plan)} className="btn-secondary flex-1">
                    <Pencil size={16} /> Edit
                  </button>
                  <button
                    onClick={() => toggleActive(plan)}
                    className={`flex-1 rounded-xl px-4 py-3 font-black ${plan.is_active ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                  >
                    {plan.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>

        <form onSubmit={submit} className="card h-fit p-5 sm:p-6 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{editingId ? "Edit Plan" : "Add New Plan"}</h2>
              <p className="text-sm text-slate-500">Configure pricing, limits and benefits.</p>
            </div>
            {editingId && (
              <button type="button" onClick={reset} className="rounded-xl bg-slate-100 p-2">
                <X />
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <input className="input" name="name" value={form.name} onChange={change} placeholder="Plan name" required />
            <textarea className="input min-h-24 resize-y" name="description" value={form.description} onChange={change} placeholder="Plan description" />
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="input" type="number" min="0.01" step="0.01" name="price" value={form.price} onChange={change} placeholder="Price" required />
              <select className="input" name="interval" value={form.interval} onChange={change}>
                <option value="MONTHLY">Month(s)</option>
                <option value="YEARLY">Year(s)</option>
                <option value="LIFETIME">Lifetime</option>
              </select>
              {form.interval !== "LIFETIME" && (
                <input className="input" type="number" min="1" name="duration_count" value={form.duration_count} onChange={change} placeholder="Duration count" />
              )}
              <input className="input" type="number" min="1" name="max_products" value={form.max_products} onChange={change} placeholder="Max products" />
              <input className="input" type="number" min="0" name="max_staff" value={form.max_staff} onChange={change} placeholder="Max employees" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black">Additional benefits</label>
              <textarea
                className="input min-h-32 resize-y"
                name="features_text"
                value={form.features_text}
                onChange={change}
                placeholder={"Priority support\nDaily backup\nCustom branding"}
              />
              <p className="mt-1 text-xs text-slate-500">Write one benefit per line.</p>
            </div>

            {[
              ["has_reports", "Reports"],
              ["has_pdf_invoice", "PDF invoice"],
              ["has_online_shop", "Online shop"],
              ["is_active", "Active plan"],
            ].map(([name, label]) => (
              <label key={name} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 font-bold">
                <span>{label}</span>
                <input type="checkbox" name={name} checked={form[name]} onChange={change} className="h-5 w-5" />
              </label>
            ))}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : editingId ? <Pencil size={18} /> : <Plus size={18} />}
              {editingId ? "Update Plan" : "Create Plan"}
            </button>
          </div>
        </form>
      </div>

      <section className="card mt-8 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-200 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black">Business Packages</h2>
            <p className="text-sm text-slate-500">See and update the package used by every business.</p>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No business subscriptions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr>
                  <th className="p-4">Business</th>
                  <th className="p-4">Owner</th>
                  <th className="p-4">Current Package</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Access Ends</th>
                  <th className="p-4">Change Package</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className="p-4">
                      <p className="font-black">{subscription.business_name}</p>
                      <p className="text-xs text-slate-500">ID: {subscription.business}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold">{subscription.owner_name || "Owner"}</p>
                      <p className="text-xs text-slate-500">{subscription.owner_email}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-black text-blue-600">{subscription.plan_name || "Trial / No package"}</p>
                      {asList(subscription.plan_features).length > 0 && (
                        <p className="mt-1 max-w-xs text-xs text-slate-500">
                          {subscription.plan_features.join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${subscription.has_access ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {subscription.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {formatDate(subscription.subscription_end_date || subscription.trial_end_date)}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <select
                          className="input min-w-48"
                          value={selectedPlans[subscription.id] || ""}
                          onChange={(event) => setSelectedPlans((current) => ({
                            ...current,
                            [subscription.id]: event.target.value,
                          }))}
                        >
                          <option value="">Select package</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>{plan.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => updateBusinessPlan(subscription)}
                          disabled={updatingSubscriptionId === subscription.id}
                          className="btn-primary shrink-0"
                        >
                          {updatingSubscriptionId === subscription.id ? <Loader2 size={17} className="animate-spin" /> : <Pencil size={17} />}
                          Update
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

function PlanValue({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 break-words font-black">{value}</p>
    </div>
  );
}

function formatDuration(plan) {
  if (plan.interval === "LIFETIME") return "Lifetime access";
  const unit = plan.interval === "YEARLY" ? "year" : "month";
  return `${plan.duration_count} ${unit}${Number(plan.duration_count) === 1 ? "" : "s"}`;
}

function formatDate(value) {
  if (!value) return "Lifetime / Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
}

function showApiError(error, fallback) {
  const data = error.response?.data;
  const first = data && typeof data === "object" ? Object.values(data)[0] : null;
  toast.error(Array.isArray(first) ? first[0] : first || fallback);
}
