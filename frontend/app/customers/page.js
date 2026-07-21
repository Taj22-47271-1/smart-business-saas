"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Eye,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SubscriptionAccessCard from "@/components/SubscriptionAccessCard";
import { exportToCsv, formatDateForFilename } from "@/lib/exportCsv";

function CustomersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessFromUrl = searchParams.get("business");

  const { user, loading } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    businessFromUrl || ""
  );

  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [updatingCustomer, setUpdatingCustomer] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    due_status: "ALL",
    active_status: "ALL",
  });

  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    opening_due: "",
  });

  const [editCustomerForm, setEditCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    opening_due: "",
    is_active: true,
  });

  const [paymentForm, setPaymentForm] = useState({
    customer_id: "",
    amount: "",
    payment_method: "Cash",
    note: "",
  });

  const selectedBusiness = useMemo(() => {
    return businesses.find(
      (business) => String(business.id) === String(selectedBusinessId)
    );
  }, [businesses, selectedBusinessId]);

  const filteredCustomers = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    return customers.filter((customer) => {
      const name = String(customer.name || "").toLowerCase();
      const phone = String(customer.phone || "").toLowerCase();
      const email = String(customer.email || "").toLowerCase();

      const matchesSearch =
        !searchValue ||
        name.includes(searchValue) ||
        phone.includes(searchValue) ||
        email.includes(searchValue);

      const currentDue = Number(customer.current_due || 0);

      const matchesDueStatus =
        filters.due_status === "ALL" ||
        (filters.due_status === "HAS_DUE" && currentDue > 0) ||
        (filters.due_status === "NO_DUE" && currentDue <= 0);

      const matchesActiveStatus =
        filters.active_status === "ALL" ||
        (filters.active_status === "ACTIVE" && customer.is_active) ||
        (filters.active_status === "INACTIVE" && !customer.is_active);

      return matchesSearch && matchesDueStatus && matchesActiveStatus;
    });
  }, [customers, filters]);

  const totalCustomers = customers.length;

  const activeCustomers = customers.filter((customer) => customer.is_active).length;

  const totalDue = customers.reduce((sum, customer) => {
    return sum + Number(customer.current_due || 0);
  }, 0);

  const filteredDue = filteredCustomers.reduce((sum, customer) => {
    return sum + Number(customer.current_due || 0);
  }, 0);

  const totalReceived = payments.reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadCustomers = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/customers/business/${businessId}/`);
    setCustomers(safeArray(response.data));
  };

  const loadPayments = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/customers/business/${businessId}/payments/`);
    setPayments(safeArray(response.data));
  };

  const loadSubscription = async (businessId) => {
    if (!businessId) return;

    try {
      const response = await api.get(`/subscriptions/business/${businessId}/`);
      setSubscription(response.data);
    } catch (error) {
      setSubscription(null);
    }
  };

  const loadPageData = async () => {
    try {
      setLoadingPage(true);

      const businessResponse = await api.get("/businesses/my-businesses/");
      const businessList = safeArray(businessResponse.data);

      setBusinesses(businessList);

      const activeBusinessId =
        selectedBusinessId || businessFromUrl || businessList[0]?.id || "";

      if (activeBusinessId) {
        setSelectedBusinessId(String(activeBusinessId));

        await Promise.all([
          loadCustomers(activeBusinessId),
          loadPayments(activeBusinessId),
          loadSubscription(activeBusinessId),
        ]);
      }
    } catch (error) {
      toast.error("Failed to load customers page");
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
      setCustomers([]);
      setPayments([]);
      setSubscription(null);
      return;
    }

    try {
      setLoadingPage(true);

      await Promise.all([
        loadCustomers(businessId),
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
      due_status: "ALL",
      active_status: "ALL",
    });
  };

  const handleExportCsv = () => {
    if (!selectedBusiness) {
      toast.error("Please select a business first");
      return;
    }

    if (filteredCustomers.length === 0) {
      toast.error("No customers available to export");
      return;
    }

    const rows = filteredCustomers.map((customer) => ({
      Name: customer.name || "N/A",
      Phone: customer.phone || "N/A",
      Email: customer.email || "N/A",
      Address: customer.address || "",
      Opening_Due: customer.opening_due || "0.00",
      Current_Due: customer.current_due || "0.00",
      Status: customer.is_active ? "ACTIVE" : "INACTIVE",
      Created_At: customer.created_at
        ? new Date(customer.created_at).toLocaleString()
        : "N/A",
    }));

    exportToCsv(
      `customers_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Customers CSV exported successfully");
  };

  const handleCustomerChange = (event) => {
    const { name, value } = event.target;

    setCustomerForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleEditCustomerChange = (event) => {
    const { name, value, type, checked } = event.target;

    setEditCustomerForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePaymentChange = (event) => {
    const { name, value } = event.target;

    setPaymentForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const startEditCustomer = (customer) => {
    setEditingCustomerId(customer.id);

    setEditCustomerForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      opening_due: customer.opening_due || "0",
      is_active: Boolean(customer.is_active),
    });
  };

  const cancelEditCustomer = () => {
    setEditingCustomerId(null);

    setEditCustomerForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      opening_due: "",
      is_active: true,
    });
  };

  const handleCustomerSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to add customers");
      return;
    }

    try {
      setSubmittingCustomer(true);

      await api.post("/customers/create/", {
        business_id: Number(selectedBusinessId),
        name: customerForm.name,
        phone: customerForm.phone || null,
        email: customerForm.email || null,
        address: customerForm.address || null,
        opening_due: customerForm.opening_due || "0",
        is_active: true,
      });

      toast.success("Customer created successfully");

      setCustomerForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        opening_due: "",
      });

      await loadCustomers(selectedBusinessId);
    } catch (error) {
      showApiError(error, "Failed to create customer");
    } finally {
      setSubmittingCustomer(false);
    }
  };

  const handleCustomerUpdate = async (customerId) => {
    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to update customer");
      return;
    }

    try {
      setUpdatingCustomer(true);

      await api.patch(`/customers/${customerId}/update/`, {
        business_id: Number(selectedBusinessId),
        name: editCustomerForm.name,
        phone: editCustomerForm.phone || null,
        email: editCustomerForm.email || null,
        address: editCustomerForm.address || null,
        opening_due: editCustomerForm.opening_due || "0",
        is_active: editCustomerForm.is_active,
      });

      toast.success("Customer updated successfully");

      cancelEditCustomer();

      await loadCustomers(selectedBusinessId);
    } catch (error) {
      showApiError(error, "Failed to update customer");
    } finally {
      setUpdatingCustomer(false);
    }
  };

  const handleCustomerDelete = async (customer) => {
    if (!subscription?.has_access) {
      toast.error("Subscription access is required to delete customer");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${customer.name}"? Payment and sales history will remain safe.`
    );

    if (!confirmed) return;

    try {
      setDeletingCustomerId(customer.id);

      await api.delete(`/customers/${customer.id}/delete/`);

      toast.success("Customer deactivated successfully");

      await loadCustomers(selectedBusinessId);
    } catch (error) {
      toast.error("Failed to deactivate customer");
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to receive payments");
      return;
    }

    try {
      setSubmittingPayment(true);

      const response = await api.post("/customers/payments/create/", {
        business_id: Number(selectedBusinessId),
        customer_id: Number(paymentForm.customer_id),
        amount: paymentForm.amount,
        payment_method: paymentForm.payment_method,
        note: paymentForm.note || null,
      });

      toast.success("Payment received successfully");

      setPaymentForm({
        customer_id: "",
        amount: "",
        payment_method: "Cash",
        note: "",
      });

      await Promise.all([
        loadCustomers(selectedBusinessId),
        loadPayments(selectedBusinessId),
      ]);

      if (response.data?.id) {
        router.push(`/customers/payments/${response.data.id}`);
      }
    } catch (error) {
      showApiError(error, "Failed to receive payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading customers...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Customers"
      subtitle="Manage customers, due balances and received payments."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Customer Management
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Customers & Due Payments
          </h1>

          <p className="mt-2 text-slate-600">
            Create customers, edit customer info, receive payments and export
            customer reports.
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
            disabled={!selectedBusiness || filteredCustomers.length === 0}
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
        <div className="space-y-6">
          <SubscriptionAccessCard
            subscription={subscription}
            businessId={selectedBusinessId}
          />

          <div className="grid gap-5 md:grid-cols-5">
            <StatCard title="Customers" value={totalCustomers} />
            <StatCard title="Active" value={activeCustomers} />
            <StatCard title="Filtered" value={filteredCustomers.length} />
            <StatCard title="Total Due" value={`৳ ${totalDue.toFixed(2)}`} />
            <StatCard title="Received" value={`৳ ${totalReceived.toFixed(2)}`} />
          </div>

          <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
            <div className="space-y-6">
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
                      Find customers by name, phone, email, due and active
                      status.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Search Customer
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
                        placeholder="Search name, phone or email"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Due Status
                    </label>

                    <select
                      className="input"
                      name="due_status"
                      value={filters.due_status}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Due</option>
                      <option value="HAS_DUE">Has Due</option>
                      <option value="NO_DUE">No Due</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Active Status
                    </label>

                    <select
                      className="input"
                      name="active_status"
                      value={filters.active_status}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
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
                    disabled={filteredCustomers.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-4 py-2 text-sm font-black text-green-700 hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={16} />
                    Export Filtered Customers
                  </button>

                  <span className="text-sm font-black text-slate-500">
                    Filtered Due: ৳ {filteredDue.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-xl font-black text-slate-950">
                    Customer List
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Showing {filteredCustomers.length} of {customers.length}{" "}
                    customers for {selectedBusiness.name}.
                  </p>
                </div>

                {filteredCustomers.length === 0 ? (
                  <div className="p-8 text-center text-slate-600">
                    No customers matched your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1150px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Contact</th>
                          <th className="p-4">Opening Due</th>
                          <th className="p-4">Current Due</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {filteredCustomers.map((customer) => (
                          <tr key={customer.id} className="bg-white align-top">
                            <td className="p-4">
                              {editingCustomerId === customer.id ? (
                                <div className="space-y-3">
                                  <input
                                    className="input"
                                    name="name"
                                    value={editCustomerForm.name}
                                    onChange={handleEditCustomerChange}
                                    placeholder="Customer name"
                                    required
                                  />

                                  <textarea
                                    className="input min-h-20"
                                    name="address"
                                    value={editCustomerForm.address}
                                    onChange={handleEditCustomerChange}
                                    placeholder="Address"
                                  />
                                </div>
                              ) : (
                                <>
                                  <p className="font-black text-slate-950">
                                    {customer.name}
                                  </p>

                                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                                    {customer.address || "No address"}
                                  </p>
                                </>
                              )}
                            </td>

                            <td className="p-4">
                              {editingCustomerId === customer.id ? (
                                <div className="space-y-3">
                                  <input
                                    className="input"
                                    name="phone"
                                    value={editCustomerForm.phone}
                                    onChange={handleEditCustomerChange}
                                    placeholder="Phone"
                                  />

                                  <input
                                    className="input"
                                    type="email"
                                    name="email"
                                    value={editCustomerForm.email}
                                    onChange={handleEditCustomerChange}
                                    placeholder="Email"
                                  />
                                </div>
                              ) : (
                                <>
                                  <p className="font-bold text-slate-700">
                                    {customer.phone || "N/A"}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {customer.email || "No email"}
                                  </p>
                                </>
                              )}
                            </td>

                            <td className="p-4">
                              {editingCustomerId === customer.id ? (
                                <input
                                  className="input"
                                  type="number"
                                  step="0.01"
                                  name="opening_due"
                                  value={editCustomerForm.opening_due}
                                  onChange={handleEditCustomerChange}
                                  placeholder="Opening due"
                                />
                              ) : (
                                <p className="font-bold text-slate-700">
                                  ৳ {customer.opening_due}
                                </p>
                              )}
                            </td>

                            <td className="p-4">
                              <p
                                className={
                                  Number(customer.current_due || 0) > 0
                                    ? "font-black text-red-600"
                                    : "font-black text-green-600"
                                }
                              >
                                ৳ {customer.current_due}
                              </p>
                            </td>

                            <td className="p-4">
                              {editingCustomerId === customer.id ? (
                                <label className="flex items-center gap-3 text-sm font-black text-slate-700">
                                  <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={editCustomerForm.is_active}
                                    onChange={handleEditCustomerChange}
                                    className="h-5 w-5"
                                  />
                                  Active
                                </label>
                              ) : (
                                <span
                                  className={
                                    customer.is_active
                                      ? "rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700"
                                      : "rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700"
                                  }
                                >
                                  {customer.is_active ? "ACTIVE" : "INACTIVE"}
                                </span>
                              )}
                            </td>

                            <td className="p-4">
                              {editingCustomerId === customer.id ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCustomerUpdate(customer.id)
                                    }
                                    disabled={updatingCustomer}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-70"
                                  >
                                    {updatingCustomer ? (
                                      <Loader2
                                        size={16}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Pencil size={16} />
                                    )}
                                    Save
                                  </button>

                                  <button
                                    type="button"
                                    onClick={cancelEditCustomer}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-300"
                                  >
                                    <X size={16} />
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditCustomer(customer)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                                  >
                                    <Pencil size={16} />
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCustomerDelete(customer)
                                    }
                                    disabled={
                                      deletingCustomerId === customer.id ||
                                      !customer.is_active
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {deletingCustomerId === customer.id ? (
                                      <Loader2
                                        size={16}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Trash2 size={16} />
                                    )}
                                    Deactivate
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-xl font-black text-slate-950">
                    Recent Customer Payments
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Latest received due payments.
                  </p>
                </div>

                {payments.length === 0 ? (
                  <div className="p-8 text-center text-slate-600">
                    No customer payments found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Method</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {payments.slice(0, 10).map((payment) => (
                          <tr key={payment.id} className="bg-white">
                            <td className="p-4">
                              <p className="font-black text-slate-950">
                                {payment.customer_name}
                              </p>

                              <p className="text-xs text-slate-500">
                                {payment.customer_phone || "N/A"}
                              </p>
                            </td>

                            <td className="p-4 font-black text-green-600">
                              ৳ {payment.amount}
                            </td>

                            <td className="p-4 font-bold text-slate-700">
                              {payment.payment_method}
                            </td>

                            <td className="p-4 text-sm text-slate-600">
                              {payment.created_at
                                ? new Date(payment.created_at).toLocaleString()
                                : "N/A"}
                            </td>

                            <td className="p-4">
                              <Link
                                href={`/customers/payments/${payment.id}`}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                              >
                                <Eye size={16} />
                                Receipt
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-6">
              <form onSubmit={handleCustomerSubmit} className="card p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <UserRound size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Add Customer
                    </h2>

                    <p className="text-sm text-slate-600">
                      Create customer with optional opening due.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    className="input"
                    name="name"
                    value={customerForm.name}
                    onChange={handleCustomerChange}
                    placeholder="Customer name"
                    required
                  />

                  <input
                    className="input"
                    name="phone"
                    value={customerForm.phone}
                    onChange={handleCustomerChange}
                    placeholder="Phone number"
                  />

                  <input
                    className="input"
                    type="email"
                    name="email"
                    value={customerForm.email}
                    onChange={handleCustomerChange}
                    placeholder="Email address"
                  />

                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    name="opening_due"
                    value={customerForm.opening_due}
                    onChange={handleCustomerChange}
                    placeholder="Opening due"
                  />

                  <textarea
                    className="input min-h-20"
                    name="address"
                    value={customerForm.address}
                    onChange={handleCustomerChange}
                    placeholder="Customer address"
                  />

                  <button
                    type="submit"
                    disabled={submittingCustomer || !subscription?.has_access}
                    className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {submittingCustomer ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Add Customer
                      </>
                    )}
                  </button>
                </div>
              </form>

              <form onSubmit={handlePaymentSubmit} className="card p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-600 text-white">
                    <Wallet size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Receive Due Payment
                    </h2>

                    <p className="text-sm text-slate-600">
                      Receive payment from customers with due balance. Oldest due invoices are updated first.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <select
                    className="input"
                    name="customer_id"
                    value={paymentForm.customer_id}
                    onChange={handlePaymentChange}
                    required
                  >
                    <option value="">Select customer</option>
                    {customers
                      .filter(
                        (customer) =>
                          customer.is_active &&
                          Number(customer.current_due || 0) > 0
                      )
                      .map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - Due ৳ {customer.current_due}
                        </option>
                      ))}
                  </select>

                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    name="amount"
                    value={paymentForm.amount}
                    onChange={handlePaymentChange}
                    placeholder="Payment amount"
                    required
                  />

                  <select
                    className="input"
                    name="payment_method"
                    value={paymentForm.payment_method}
                    onChange={handlePaymentChange}
                  >
                    <option value="Cash">Cash</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Rocket">Rocket</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Other">Other</option>
                  </select>

                  <textarea
                    className="input min-h-20"
                    name="note"
                    value={paymentForm.note}
                    onChange={handlePaymentChange}
                    placeholder="Optional note"
                  />

                  <div className="rounded-2xl bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
                    The payment is automatically applied to the customer&apos;s oldest due invoice. Invoice status changes from DUE to PARTIAL or PAID.
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPayment || !subscription?.has_access}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-black text-white hover:bg-green-700 disabled:opacity-70"
                  >
                    {submittingPayment ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Receiving...
                      </>
                    ) : (
                      <>
                        <Receipt size={18} />
                        Receive Payment
                      </>
                    )}
                  </button>
                </div>
              </form>
            </aside>
          </div>
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

function showApiError(error, fallbackMessage) {
  const data = error.response?.data;

  if (data && typeof data === "object") {
    const firstError = Object.values(data)[0];

    if (Array.isArray(firstError)) {
      toast.error(firstError[0]);
      return;
    }

    if (typeof firstError === "string") {
      toast.error(firstError);
      return;
    }
  }

  toast.error(fallbackMessage);
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

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading customers...
          </div>
        </main>
      }
    >
      <CustomersContent />
    </Suspense>
  );
}