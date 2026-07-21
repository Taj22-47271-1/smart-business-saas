"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Download,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SubscriptionAccessCard from "@/components/SubscriptionAccessCard";
import { exportToCsv, formatDateForFilename } from "@/lib/exportCsv";

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessFromUrl = searchParams.get("business");

  const { user, loading } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [selectedBusinessId, setSelectedBusinessId] = useState(
    businessFromUrl || ""
  );

  const [loadingPage, setLoadingPage] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    date_from: "",
    date_to: "",
  });

  const [form, setForm] = useState({
    plan: "",
    amount: "",
    payment_method: "BKASH",
    transaction_id: "",
    sender_number: "",
    payment_screenshot: null,
    note: "",
  });

  const selectedBusiness = useMemo(() => {
    return businesses.find(
      (business) => String(business.id) === String(selectedBusinessId)
    );
  }, [businesses, selectedBusinessId]);

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => String(plan.id) === String(form.plan));
  }, [plans, form.plan]);

  const filteredPayments = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    return payments.filter((payment) => {
      const method = String(payment.payment_method || "").toLowerCase();
      const transactionId = String(payment.transaction_id || "").toLowerCase();
      const senderNumber = String(payment.sender_number || "").toLowerCase();
      const note = String(payment.note || "").toLowerCase();
      const status = String(payment.status || "").toLowerCase();

      const matchesSearch =
        !searchValue ||
        method.includes(searchValue) ||
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
        !filters.date_from ||
        (paymentDate && paymentDate >= filters.date_from);

      const matchesDateTo =
        !filters.date_to || (paymentDate && paymentDate <= filters.date_to);

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [payments, filters]);

  const totalFilteredAmount = filteredPayments.reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadBusinesses = async () => {
    const response = await api.get("/businesses/my-businesses/");
    const businessList = safeArray(response.data);

    setBusinesses(businessList);

    const activeBusinessId =
      selectedBusinessId || businessFromUrl || businessList[0]?.id || "";

    if (activeBusinessId) {
      setSelectedBusinessId(String(activeBusinessId));
      await Promise.all([
        loadPayments(activeBusinessId),
        loadSubscription(activeBusinessId),
      ]);
    }
  };

  const loadPlans = async () => {
    const response = await api.get("/subscriptions/plans/");
    setPlans(safeArray(response.data));
  };

  const loadPayments = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/payments/business/${businessId}/`);
    setPayments(safeArray(response.data));
  };

  const loadSubscription = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/subscriptions/business/${businessId}/`);
    setSubscription(response.data);
  };

  const loadPageData = async () => {
    try {
      setLoadingPage(true);

      await Promise.all([loadBusinesses(), loadPlans()]);
    } catch (error) {
      toast.error("Failed to load payments page");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPageData();
    }
  }, [user]);

  const handleBusinessChange = async (event) => {
    const businessId = event.target.value;
    setSelectedBusinessId(businessId);

    if (!businessId) {
      setPayments([]);
      setSubscription(null);
      return;
    }

    try {
      setLoadingPage(true);
      await Promise.all([
        loadPayments(businessId),
        loadSubscription(businessId),
      ]);
    } catch (error) {
      toast.error("Failed to switch business");
    } finally {
      setLoadingPage(false);
    }
  };

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

  const handleExportCsv = () => {
    if (!selectedBusiness) {
      toast.error("Please select a business first");
      return;
    }

    if (filteredPayments.length === 0) {
      toast.error("No payments available to export");
      return;
    }

    const rows = filteredPayments.map((payment) => ({
      Business: selectedBusiness.name,
      Plan: payment.plan_name || payment.plan || "N/A",
      Amount: payment.amount || "0.00",
      Payment_Method: payment.payment_method || "N/A",
      Transaction_ID: payment.transaction_id || "N/A",
      Sender_Number: payment.sender_number || "N/A",
      Status: payment.status || "N/A",
      Note: payment.note || "",
      Rejection_Reason: payment.rejection_reason || "",
      Created_At: payment.created_at
        ? new Date(payment.created_at).toLocaleString()
        : "N/A",
      Approved_At: payment.approved_at
        ? new Date(payment.approved_at).toLocaleString()
        : "",
    }));

    exportToCsv(
      `payments_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Payments CSV exported successfully");
  };

  const handleFormChange = (event) => {
    const { name, value, files } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: files ? files[0] : value,
    }));

    if (name === "plan") {
      const selectedPlan = plans.find(
        (plan) => String(plan.id) === String(value)
      );

      if (selectedPlan) {
        setForm((previous) => ({
          ...previous,
          plan: value,
          amount: selectedPlan.price || "",
        }));
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!form.plan) {
      toast.error("Please select a subscription plan");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("business_id", selectedBusinessId);
      formData.append("plan_id", form.plan);
      formData.append("amount", form.amount);
      formData.append("payment_method", form.payment_method);
      formData.append("transaction_id", form.transaction_id);
      formData.append("sender_number", form.sender_number);
      formData.append("note", form.note || "");

      if (form.payment_screenshot) {
        formData.append("screenshot", form.payment_screenshot);
      }

      await api.post("/payments/create/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Payment request submitted successfully");

      setForm({
        plan: "",
        amount: "",
        payment_method: "BKASH",
        transaction_id: "",
        sender_number: "",
        payment_screenshot: null,
        note: "",
      });

      await loadPayments(selectedBusinessId);
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to submit payment request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading payments...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Payments"
      subtitle="Submit subscription payments and track approval status."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Subscription Payment
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Manual Payment Requests
          </h1>

          <p className="mt-2 text-slate-600">
            Submit payment proof, track approval status and export payment
            history.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:w-80">
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Select Business
            </label>

            <select
              className="input"
              value={selectedBusinessId}
              onChange={handleBusinessChange}
            >
              <option value="">Select business</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={!selectedBusiness || filteredPayments.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={17} />
            Export CSV
          </button>

          <button
            onClick={loadPageData}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </div>

      {!selectedBusiness ? (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-black text-slate-950">
            No business found
          </h2>

          <p className="mt-2 text-slate-600">
            Please create a business first.
          </p>

          <Link href="/business" className="btn-primary mt-5 inline-flex">
            Create Business
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1fr_430px]">
          <div className="space-y-6">
            <SubscriptionAccessCard
              subscription={subscription}
              businessId={selectedBusinessId}
              showAction={false}
            />

            <div className="grid gap-5 md:grid-cols-3">
              <StatCard title="All Payments" value={payments.length} />
              <StatCard title="Filtered" value={filteredPayments.length} />
              <StatCard
                title="Filtered Amount"
                value={`৳ ${totalFilteredAmount.toFixed(2)}`}
              />
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
                    Find payments by status, method, transaction ID, sender
                    number or note.
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
                      placeholder="Method, transaction ID, number or note"
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

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200"
                >
                  <X size={16} />
                  Clear Filters
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredPayments.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-4 py-2 text-sm font-black text-green-700 hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={16} />
                  Export Filtered Payments
                </button>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-xl font-black text-slate-950">
                  Payment History
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Showing {filteredPayments.length} of {payments.length}{" "}
                  payments for {selectedBusiness.name}.
                </p>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-8 text-center text-slate-600">
                  No payments matched your filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left">
                    <thead className="bg-slate-100 text-sm text-slate-600">
                      <tr>
                        <th className="p-4">Plan</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Method</th>
                        <th className="p-4">Transaction</th>
                        <th className="p-4">Sender</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Proof</th>
                        <th className="p-4">Date</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {filteredPayments.map((payment) => (
                        <tr key={payment.id} className="bg-white">
                          <td className="p-4 font-black text-slate-950">
                            {payment.plan_name || payment.plan || "Plan"}
                          </td>

                          <td className="p-4 font-black text-green-600">
                            ৳ {payment.amount}
                          </td>

                          <td className="p-4 text-sm font-bold text-slate-700">
                            {payment.payment_method}
                          </td>

                          <td className="p-4 text-sm text-slate-700">
                            {payment.transaction_id || "N/A"}
                          </td>

                          <td className="p-4 text-sm text-slate-700">
                            {payment.sender_number || "N/A"}
                          </td>

                          <td className="p-4">
                            <span className={getStatusBadge(payment.status)}>
                              {payment.status}
                            </span>
                          </td>

                          <td className="p-4">
                            {payment.screenshot ? (
                              <a
                                href={payment.screenshot}
                                target="_blank"
                                className="font-black text-blue-600 hover:underline"
                              >
                                View Proof
                              </a>
                            ) : (
                              <span className="text-sm text-slate-500">
                                No proof
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-sm text-slate-600">
                            {payment.created_at
                              ? new Date(payment.created_at).toLocaleString()
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="card h-fit p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <CreditCard size={22} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Submit Payment
                </h2>

                <p className="text-sm text-slate-600">
                  SuperAdmin will approve manually
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Plan
                </label>

                <select
                  className="input"
                  name="plan"
                  value={form.plan}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — ৳ {plan.price} — {plan.interval === "LIFETIME" ? "Lifetime" : `${plan.duration_count} ${plan.interval === "YEARLY" ? "year(s)" : "month(s)"}`}
                    </option>
                  ))}
                </select>

                {selectedPlan && (
                  <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                    <p className="font-black">Package benefits</p>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      <li>✓ Up to {selectedPlan.max_products} products</li>
                      <li>✓ Up to {selectedPlan.max_staff} employees</li>
                      {selectedPlan.has_reports && <li>✓ Business reports</li>}
                      {selectedPlan.has_pdf_invoice && <li>✓ PDF invoices</li>}
                      {selectedPlan.has_online_shop && <li>✓ Online shop</li>}
                      {(selectedPlan.features || []).map((feature) => (
                        <li key={feature} className="break-words">✓ {feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Amount
                </label>

                <input
                  className="input"
                  type="number"
                  step="0.01"
                  name="amount"
                  value={form.amount}
                  onChange={handleFormChange}
                  placeholder="Amount"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Payment Method
                </label>

                <select
                  className="input"
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleFormChange}
                >
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="ROCKET">Rocket</option>
                  <option value="BANK">Bank</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Transaction ID
                </label>

                <input
                  className="input"
                  name="transaction_id"
                  value={form.transaction_id}
                  onChange={handleFormChange}
                  placeholder="Transaction ID"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Sender Number
                </label>

                <input
                  className="input"
                  name="sender_number"
                  value={form.sender_number}
                  onChange={handleFormChange}
                  placeholder="01XXXXXXXXX"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Payment Screenshot
                </label>

                <input
                  className="input"
                  type="file"
                  name="payment_screenshot"
                  accept="image/*"
                  onChange={handleFormChange}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Note
                </label>

                <textarea
                  className="input min-h-20"
                  name="note"
                  value={form.note}
                  onChange={handleFormChange}
                  placeholder="Optional note"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Submit Payment
                  </>
                )}
              </button>
            </form>
          </aside>
        </div>
      )}
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

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading payments...
          </div>
        </main>
      }
    >
      <PaymentsContent />
    </Suspense>
  );
}
