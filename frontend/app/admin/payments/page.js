"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";

function AdminPaymentsContent() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [payments, setPayments] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    date_from: "",
    date_to: "",
  });

  const filteredPayments = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    return payments.filter((payment) => {
      const businessName = String(payment.business_name || "").toLowerCase();
      const ownerEmail = String(payment.owner_email || "").toLowerCase();
      const ownerName = String(payment.owner_name || "").toLowerCase();
      const planName = String(payment.plan_name || "").toLowerCase();
      const paymentMethod = String(payment.payment_method || "").toLowerCase();
      const transactionId = String(payment.transaction_id || "").toLowerCase();
      const senderNumber = String(payment.sender_number || "").toLowerCase();
      const note = String(payment.note || "").toLowerCase();
      const status = String(payment.status || "").toLowerCase();

      const matchesSearch =
        !searchValue ||
        businessName.includes(searchValue) ||
        ownerEmail.includes(searchValue) ||
        ownerName.includes(searchValue) ||
        planName.includes(searchValue) ||
        paymentMethod.includes(searchValue) ||
        transactionId.includes(searchValue) ||
        senderNumber.includes(searchValue) ||
        note.includes(searchValue) ||
        status.includes(searchValue);

      const matchesStatus =
        filters.status === "ALL" ||
        String(payment.status) === String(filters.status);

      const paymentDate = payment.created_at
        ? new Date(payment.created_at).toISOString().split("T")[0]
        : "";

      const matchesDateFrom =
        !filters.date_from || (paymentDate && paymentDate >= filters.date_from);

      const matchesDateTo =
        !filters.date_to || (paymentDate && paymentDate <= filters.date_to);

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [payments, filters]);

  const pendingCount = payments.filter(
    (payment) => payment.status === "PENDING"
  ).length;

  const approvedCount = payments.filter(
    (payment) => payment.status === "APPROVED"
  ).length;

  const rejectedCount = payments.filter(
    (payment) => payment.status === "REJECTED"
  ).length;

  const approvedAmount = payments
    .filter((payment) => payment.status === "APPROVED")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (!loading && user && user.role !== "SUPER_ADMIN") {
      toast.error("Only SuperAdmin can access this page");
      router.push("/dashboard");
    }
  }, [loading, user, router]);

  const loadPayments = async () => {
    try {
      setLoadingPage(true);
      const response = await api.get("/payments/admin/all/");
      setPayments(safeArray(response.data));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load admin payments"));
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      loadPayments();
    }
  }, [user]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "ALL",
      date_from: "",
      date_to: "",
    });
  };

  const handleApprove = async (paymentId) => {
    const confirmApprove = window.confirm(
      "Are you sure you want to approve this payment?"
    );

    if (!confirmApprove) return;

    try {
      setProcessingId(paymentId);

      await api.post(`/payments/admin/${paymentId}/approve/`, {});

      toast.success("Payment approved successfully");
      await loadPayments();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to approve payment"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (paymentId) => {
    const reason = window.prompt("Write rejection reason:");

    if (reason === null) return;

    if (!reason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    try {
      setProcessingId(paymentId);

      await api.post(`/payments/admin/${paymentId}/reject/`, {
        rejection_reason: reason,
      });

      toast.success("Payment rejected successfully");
      await loadPayments();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to reject payment"));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading admin payments...
        </div>
      </main>
    );
  }

  if (!user || user.role !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <DashboardLayout
      title="Payment Approval"
      subtitle="Review manual subscription payments and approve or reject requests."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            SuperAdmin Panel
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Payment Approval
          </h1>

          <p className="mt-2 text-slate-600">
            Search payment requests, check proof and approve subscriptions.
          </p>
        </div>

        <button
          onClick={loadPayments}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <ShieldCheck size={28} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-950">
                SuperAdmin Payment Control
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Approving a payment should activate or extend the business
                subscription based on the selected plan.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-5">
          <StatCard title="All Payments" value={payments.length} />
          <StatCard title="Filtered" value={filteredPayments.length} />
          <StatCard title="Pending" value={pendingCount} />
          <StatCard title="Approved" value={approvedCount} />
          <StatCard title="Rejected" value={rejectedCount} />
        </div>

        <div className="card p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Filter size={20} />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-950">
                Search & Filter
              </h2>
              <p className="text-sm text-slate-600">
                Find payments by business, owner, plan, method, transaction ID,
                sender number, status or date.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Search Payment
              </label>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  className="input pl-10"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Business, owner, transaction ID"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Status
              </label>

              <select
                className="input"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Date From
              </label>

              <input
                className="input"
                type="date"
                name="date_from"
                value={filters.date_from}
                onChange={handleFilterChange}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Date To
              </label>

              <input
                className="input"
                type="date"
                name="date_to"
                value={filters.date_to}
                onChange={handleFilterChange}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200"
          >
            <X size={16} />
            Clear Filters
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-black text-slate-950">
              Payment Requests
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Showing {filteredPayments.length} of {payments.length} payment
              requests.
            </p>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
              No payment requests matched your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] text-left">
                <thead className="bg-slate-100 text-sm text-slate-600">
                  <tr>
                    <th className="p-4">Business</th>
                    <th className="p-4">Owner</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Transaction</th>
                    <th className="p-4">Proof</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="bg-white">
                      <td className="p-4">
                        <p className="font-black text-slate-950">
                          {payment.business_name || "Business"}
                        </p>
                        <p className="text-xs text-slate-500">
                          ID: {payment.business || "N/A"}
                        </p>
                      </td>

                      <td className="p-4">
                        <p className="font-bold text-slate-700">
                          {payment.owner_name || "Owner"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {payment.owner_email || "No email"}
                        </p>
                      </td>

                      <td className="p-4 text-sm text-slate-700">
                        <p className="font-black text-slate-950">
                          {payment.plan_name || "Plan"}
                        </p>
                        {payment.plan_interval && (
                          <p className="mt-1 text-xs text-slate-500">
                            {payment.plan_interval === "LIFETIME"
                              ? "Lifetime"
                              : `${payment.plan_duration_count} ${payment.plan_interval === "YEARLY" ? "year(s)" : "month(s)"}`}
                          </p>
                        )}
                        {Array.isArray(payment.plan_features) &&
                          payment.plan_features.length > 0 && (
                            <ul className="mt-2 max-w-xs space-y-1 text-xs text-blue-700">
                              {payment.plan_features.map((feature) => (
                                <li key={feature} className="break-words">
                                  ✓ {feature}
                                </li>
                              ))}
                            </ul>
                          )}
                      </td>

                      <td className="p-4 font-black text-slate-950">
                        ৳ {payment.amount}
                      </td>

                      <td className="p-4 text-sm text-slate-700">
                        {payment.payment_method || "N/A"}
                        <p className="text-xs text-slate-500">
                          {payment.sender_number || "No sender"}
                        </p>
                      </td>

                      <td className="p-4 text-sm font-black text-slate-950">
                        {payment.transaction_id || "N/A"}
                      </td>

                      <td className="p-4">
                        {payment.screenshot ? (
                          <a
                            href={payment.screenshot}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                          >
                            View Proof
                          </a>
                        ) : (
                          <span className="text-sm text-slate-500">
                            No proof
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <span className={getStatusBadge(payment.status)}>
                          {payment.status || "PENDING"}
                        </span>
                      </td>

                      <td className="p-4 text-sm text-slate-600">
                        {payment.created_at
                          ? new Date(payment.created_at).toLocaleString()
                          : "N/A"}
                      </td>

                      <td className="p-4">
                        {payment.status === "PENDING" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(payment.id)}
                              disabled={processingId === payment.id}
                              className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-black text-green-700 hover:bg-green-200 disabled:opacity-60"
                            >
                              {processingId === payment.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={16} />
                              )}
                              Approve
                            </button>

                            <button
                              onClick={() => handleReject(payment.id)}
                              disabled={processingId === payment.id}
                              className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-200 disabled:opacity-60"
                            >
                              <XCircle size={16} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-slate-500">
                            Completed
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-green-200 bg-green-50 p-6">
          <p className="text-sm font-bold text-green-700">
            Total Approved Revenue
          </p>
          <h2 className="mt-2 text-3xl font-black text-green-700">
            ৳ {approvedAmount.toFixed(2)}
          </h2>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <h3 className="mt-2 text-2xl font-black text-slate-950">{value}</h3>
    </div>
  );
}

function getApiErrorMessage(error, fallback) {
  const data = error.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return String(data.non_field_errors[0]);
  }

  const firstError = Object.values(data)[0];
  if (Array.isArray(firstError) && firstError[0]) return String(firstError[0]);
  if (typeof firstError === "string") return firstError;
  return fallback;
}

function safeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && Array.isArray(value.results)) {
    return value.results;
  }

  return [];
}

function getStatusBadge(status) {
  const base = "rounded-full px-3 py-1 text-xs font-black ";

  if (status === "APPROVED") {
    return base + "bg-green-100 text-green-700";
  }

  if (status === "REJECTED") {
    return base + "bg-red-100 text-red-700";
  }

  return base + "bg-amber-100 text-amber-700";
}

export default function AdminPaymentsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading admin payments...
          </div>
        </main>
      }
    >
      <AdminPaymentsContent />
    </Suspense>
  );
}
