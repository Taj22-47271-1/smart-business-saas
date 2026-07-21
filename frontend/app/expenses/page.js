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
  Tag,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SubscriptionAccessCard from "@/components/SubscriptionAccessCard";
import { exportToCsv, formatDateForFilename } from "@/lib/exportCsv";
import { FINANCE_ROLES, hasActiveBusinessRole } from "@/lib/roles";

function ExpensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessFromUrl = searchParams.get("business");

  const { user, loading } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    businessFromUrl || ""
  );

  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [updatingExpense, setUpdatingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    category: "ALL",
    payment_method: "ALL",
    active_status: "ALL",
    from_date: "",
    to_date: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });

  const [editCategoryForm, setEditCategoryForm] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const [expenseForm, setExpenseForm] = useState({
    category: "",
    title: "",
    amount: "",
    expense_date: getTodayDate(),
    payment_method: "Cash",
    note: "",
  });

  const [editExpenseForm, setEditExpenseForm] = useState({
    category: "",
    title: "",
    amount: "",
    expense_date: getTodayDate(),
    payment_method: "Cash",
    note: "",
    is_active: true,
  });

  const selectedBusiness = useMemo(() => {
    return businesses.find(
      (business) => String(business.id) === String(selectedBusinessId)
    );
  }, [businesses, selectedBusinessId]);

  const canManageExpenses = hasActiveBusinessRole(
    user,
    selectedBusinessId,
    FINANCE_ROLES
  );

  const paymentMethods = useMemo(() => {
    const uniqueMethods = new Set();

    expenses.forEach((expense) => {
      if (expense.payment_method) {
        uniqueMethods.add(expense.payment_method);
      }
    });

    return Array.from(uniqueMethods);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const title = String(expense.title || "").toLowerCase();
      const method = String(expense.payment_method || "").toLowerCase();
      const note = String(expense.note || "").toLowerCase();
      const categoryName = String(expense.category_name || "").toLowerCase();

      const matchesSearch =
        !searchValue ||
        title.includes(searchValue) ||
        method.includes(searchValue) ||
        note.includes(searchValue) ||
        categoryName.includes(searchValue);

      const matchesCategory =
        filters.category === "ALL" ||
        String(expense.category) === String(filters.category);

      const matchesPaymentMethod =
        filters.payment_method === "ALL" ||
        String(expense.payment_method) === String(filters.payment_method);

      const matchesActiveStatus =
        filters.active_status === "ALL" ||
        (filters.active_status === "ACTIVE" && expense.is_active) ||
        (filters.active_status === "INACTIVE" && !expense.is_active);

      const expenseDate = expense.expense_date || "";

      const matchesFromDate =
        !filters.from_date || expenseDate >= filters.from_date;

      const matchesToDate = !filters.to_date || expenseDate <= filters.to_date;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesPaymentMethod &&
        matchesActiveStatus &&
        matchesFromDate &&
        matchesToDate
      );
    });
  }, [expenses, filters]);

  const totalExpense = expenses.reduce((sum, expense) => {
    if (!expense.is_active) return sum;
    return sum + Number(expense.amount || 0);
  }, 0);

  const filteredExpense = filteredExpenses.reduce((sum, expense) => {
    if (!expense.is_active) return sum;
    return sum + Number(expense.amount || 0);
  }, 0);

  const activeExpenses = expenses.filter((expense) => expense.is_active).length;

  const inactiveExpenses = expenses.filter((expense) => !expense.is_active).length;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadCategories = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(
      `/expenses/business/${businessId}/categories/`
    );

    setCategories(safeArray(response.data));
  };

  const loadExpenses = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/expenses/business/${businessId}/`);
    setExpenses(safeArray(response.data));
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
          loadCategories(activeBusinessId),
          loadExpenses(activeBusinessId),
          loadSubscription(activeBusinessId),
        ]);
      }
    } catch (error) {
      toast.error("Failed to load expenses page");
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
      setCategories([]);
      setExpenses([]);
      setSubscription(null);
      return;
    }

    try {
      setLoadingPage(true);

      await Promise.all([
        loadCategories(businessId),
        loadExpenses(businessId),
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
      category: "ALL",
      payment_method: "ALL",
      active_status: "ALL",
      from_date: "",
      to_date: "",
    });
  };

  const handleExportCsv = () => {
    if (!selectedBusiness) {
      toast.error("Please select a business first");
      return;
    }

    if (filteredExpenses.length === 0) {
      toast.error("No expenses available to export");
      return;
    }

    const rows = filteredExpenses.map((expense) => ({
      Title: expense.title || "N/A",
      Category: expense.category_name || "Uncategorized",
      Amount: expense.amount || "0.00",
      Expense_Date: expense.expense_date || "N/A",
      Payment_Method: expense.payment_method || "N/A",
      Note: expense.note || "",
      Created_By: expense.created_by_email || "N/A",
      Status: expense.is_active ? "ACTIVE" : "INACTIVE",
      Created_At: expense.created_at
        ? new Date(expense.created_at).toLocaleString()
        : "N/A",
    }));

    exportToCsv(
      `expenses_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Expenses CSV exported successfully");
  };

  const handleCategoryChange = (event) => {
    const { name, value } = event.target;

    setCategoryForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleEditCategoryChange = (event) => {
    const { name, value, type, checked } = event.target;

    setEditCategoryForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const startEditCategory = (category) => {
    setEditingCategoryId(category.id);

    setEditCategoryForm({
      name: category.name || "",
      description: category.description || "",
      is_active: Boolean(category.is_active),
    });
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);

    setEditCategoryForm({
      name: "",
      description: "",
      is_active: true,
    });
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to add expense categories");
      return;
    }

    try {
      setSubmittingCategory(true);

      await api.post("/expenses/categories/create/", {
        business_id: Number(selectedBusinessId),
        name: categoryForm.name,
        description: categoryForm.description || null,
        is_active: true,
      });

      toast.success("Expense category created successfully");

      setCategoryForm({
        name: "",
        description: "",
      });

      await loadCategories(selectedBusinessId);
    } catch (error) {
      showApiError(error, "Failed to create expense category");
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleCategoryUpdate = async (categoryId) => {
    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to update category");
      return;
    }

    try {
      setUpdatingCategory(true);

      await api.patch(`/expenses/categories/${categoryId}/update/`, {
        business_id: Number(selectedBusinessId),
        name: editCategoryForm.name,
        description: editCategoryForm.description || null,
        is_active: editCategoryForm.is_active,
      });

      toast.success("Expense category updated successfully");

      cancelEditCategory();

      await Promise.all([
        loadCategories(selectedBusinessId),
        loadExpenses(selectedBusinessId),
      ]);
    } catch (error) {
      showApiError(error, "Failed to update expense category");
    } finally {
      setUpdatingCategory(false);
    }
  };

  const handleCategoryDelete = async (category) => {
    if (!subscription?.has_access) {
      toast.error("Subscription access is required to delete category");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"? Related expenses will become Uncategorized.`
    );

    if (!confirmed) return;

    try {
      setDeletingCategoryId(category.id);

      await api.delete(`/expenses/categories/${category.id}/delete/`);

      toast.success("Expense category deleted successfully");

      if (filters.category === String(category.id)) {
        setFilters((previous) => ({
          ...previous,
          category: "ALL",
        }));
      }

      await Promise.all([
        loadCategories(selectedBusinessId),
        loadExpenses(selectedBusinessId),
      ]);
    } catch (error) {
      toast.error("Failed to delete expense category");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleExpenseChange = (event) => {
    const { name, value } = event.target;

    setExpenseForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleEditExpenseChange = (event) => {
    const { name, value, type, checked } = event.target;

    setEditExpenseForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const startEditExpense = (expense) => {
    setEditingExpenseId(expense.id);

    setEditExpenseForm({
      category: expense.category || "",
      title: expense.title || "",
      amount: expense.amount || "",
      expense_date: expense.expense_date || getTodayDate(),
      payment_method: expense.payment_method || "Cash",
      note: expense.note || "",
      is_active: Boolean(expense.is_active),
    });
  };

  const cancelEditExpense = () => {
    setEditingExpenseId(null);

    setEditExpenseForm({
      category: "",
      title: "",
      amount: "",
      expense_date: getTodayDate(),
      payment_method: "Cash",
      note: "",
      is_active: true,
    });
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to add expenses");
      return;
    }

    try {
      setSubmittingExpense(true);

      await api.post("/expenses/create/", {
        business_id: Number(selectedBusinessId),
        category: expenseForm.category ? Number(expenseForm.category) : null,
        title: expenseForm.title,
        amount: expenseForm.amount,
        expense_date: expenseForm.expense_date,
        payment_method: expenseForm.payment_method,
        note: expenseForm.note || null,
        is_active: true,
      });

      toast.success("Expense created successfully");

      setExpenseForm({
        category: "",
        title: "",
        amount: "",
        expense_date: getTodayDate(),
        payment_method: "Cash",
        note: "",
      });

      await loadExpenses(selectedBusinessId);
    } catch (error) {
      showApiError(error, "Failed to create expense");
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleExpenseUpdate = async (expenseId) => {
    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to update expense");
      return;
    }

    try {
      setUpdatingExpense(true);

      await api.patch(`/expenses/${expenseId}/update/`, {
        business_id: Number(selectedBusinessId),
        category: editExpenseForm.category
          ? Number(editExpenseForm.category)
          : null,
        title: editExpenseForm.title,
        amount: editExpenseForm.amount,
        expense_date: editExpenseForm.expense_date,
        payment_method: editExpenseForm.payment_method,
        note: editExpenseForm.note || null,
        is_active: editExpenseForm.is_active,
      });

      toast.success("Expense updated successfully");

      cancelEditExpense();

      await loadExpenses(selectedBusinessId);
    } catch (error) {
      showApiError(error, "Failed to update expense");
    } finally {
      setUpdatingExpense(false);
    }
  };

  const handleExpenseDelete = async (expense) => {
    if (!subscription?.has_access) {
      toast.error("Subscription access is required to delete expense");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${expense.title}"? Voucher/report history will remain safe.`
    );

    if (!confirmed) return;

    try {
      setDeletingExpenseId(expense.id);

      await api.delete(`/expenses/${expense.id}/delete/`);

      toast.success("Expense deactivated successfully");

      await loadExpenses(selectedBusinessId);
    } catch (error) {
      toast.error("Failed to deactivate expense");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading expenses...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Expenses"
      subtitle="Manage business expenses, expense categories and vouchers."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Expense Management
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Expenses & Categories
          </h1>

          <p className="mt-2 text-slate-600">
            Add expenses, edit records, manage categories and export expense
            reports.
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
            disabled={!selectedBusiness || filteredExpenses.length === 0}
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
            <StatCard title="Expenses" value={expenses.length} />
            <StatCard title="Active" value={activeExpenses} />
            <StatCard title="Inactive" value={inactiveExpenses} />
            <StatCard title="Total Expense" value={`৳ ${totalExpense.toFixed(2)}`} />
            <StatCard
              title="Filtered Expense"
              value={`৳ ${filteredExpense.toFixed(2)}`}
            />
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
                      Find expenses by title, category, method, date and status.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Search Expense
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
                        placeholder="Search title, category, note"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Category
                    </label>

                    <select
                      className="input"
                      name="category"
                      value={filters.category}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Method
                    </label>

                    <select
                      className="input"
                      name="payment_method"
                      value={filters.payment_method}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Methods</option>
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      From Date
                    </label>

                    <input
                      className="input"
                      type="date"
                      name="from_date"
                      value={filters.from_date}
                      onChange={handleFilterChange}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      To Date
                    </label>

                    <input
                      className="input"
                      type="date"
                      name="to_date"
                      value={filters.to_date}
                      onChange={handleFilterChange}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Status
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
                    disabled={filteredExpenses.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-4 py-2 text-sm font-black text-green-700 hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={16} />
                    Export Filtered Expenses
                  </button>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-xl font-black text-slate-950">
                    Expense List
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Showing {filteredExpenses.length} of {expenses.length}{" "}
                    expenses for {selectedBusiness.name}.
                  </p>
                </div>

                {filteredExpenses.length === 0 ? (
                  <div className="p-8 text-center text-slate-600">
                    No expenses matched your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1250px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Expense</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Method</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className="bg-white align-top">
                            <td className="p-4">
                              {editingExpenseId === expense.id ? (
                                <div className="space-y-3">
                                  <input
                                    className="input"
                                    name="title"
                                    value={editExpenseForm.title}
                                    onChange={handleEditExpenseChange}
                                    placeholder="Expense title"
                                    required
                                  />

                                  <textarea
                                    className="input min-h-20"
                                    name="note"
                                    value={editExpenseForm.note}
                                    onChange={handleEditExpenseChange}
                                    placeholder="Note"
                                  />
                                </div>
                              ) : (
                                <>
                                  <p className="font-black text-slate-950">
                                    {expense.title}
                                  </p>

                                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                                    {expense.note || "No note"}
                                  </p>
                                </>
                              )}
                            </td>

                            <td className="p-4">
                              {editingExpenseId === expense.id ? (
                                <select
                                  className="input"
                                  name="category"
                                  value={editExpenseForm.category}
                                  onChange={handleEditExpenseChange}
                                >
                                  <option value="">Uncategorized</option>
                                  {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="font-bold text-slate-700">
                                  {expense.category_name || "Uncategorized"}
                                </p>
                              )}
                            </td>

                            <td className="p-4">
                              {editingExpenseId === expense.id ? (
                                <input
                                  className="input"
                                  type="number"
                                  step="0.01"
                                  name="amount"
                                  value={editExpenseForm.amount}
                                  onChange={handleEditExpenseChange}
                                  placeholder="Amount"
                                  required
                                />
                              ) : (
                                <p className="font-black text-red-600">
                                  ৳ {expense.amount}
                                </p>
                              )}
                            </td>

                            <td className="p-4">
                              {editingExpenseId === expense.id ? (
                                <input
                                  className="input"
                                  type="date"
                                  name="expense_date"
                                  value={editExpenseForm.expense_date}
                                  onChange={handleEditExpenseChange}
                                  required
                                />
                              ) : (
                                <p className="font-bold text-slate-700">
                                  {expense.expense_date}
                                </p>
                              )}
                            </td>

                            <td className="p-4">
                              {editingExpenseId === expense.id ? (
                                <select
                                  className="input"
                                  name="payment_method"
                                  value={editExpenseForm.payment_method}
                                  onChange={handleEditExpenseChange}
                                >
                                  <option value="Cash">Cash</option>
                                  <option value="bKash">bKash</option>
                                  <option value="Nagad">Nagad</option>
                                  <option value="Rocket">Rocket</option>
                                  <option value="Bank Transfer">Bank Transfer</option>
                                  <option value="Card">Card</option>
                                  <option value="Other">Other</option>
                                </select>
                              ) : (
                                <p className="font-bold text-slate-700">
                                  {expense.payment_method}
                                </p>
                              )}
                            </td>

                            <td className="p-4">
                              {editingExpenseId === expense.id ? (
                                <label className="flex items-center gap-3 text-sm font-black text-slate-700">
                                  <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={editExpenseForm.is_active}
                                    onChange={handleEditExpenseChange}
                                    className="h-5 w-5"
                                  />
                                  Active
                                </label>
                              ) : (
                                <span
                                  className={
                                    expense.is_active
                                      ? "rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700"
                                      : "rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700"
                                  }
                                >
                                  {expense.is_active ? "ACTIVE" : "INACTIVE"}
                                </span>
                              )}
                            </td>

                            <td className="p-4">
                              {editingExpenseId === expense.id ? (
                                <div className="flex flex-wrap gap-2">
                                  {canManageExpenses && <button
                                    type="button"
                                    onClick={() => handleExpenseUpdate(expense.id)}
                                    disabled={updatingExpense}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-70"
                                  >
                                    {updatingExpense ? (
                                      <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                      <Pencil size={16} />
                                    )}
                                    Save
                                  </button>}

                                  {canManageExpenses && <button
                                    type="button"
                                    onClick={cancelEditExpense}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-300"
                                  >
                                    <X size={16} />
                                    Cancel
                                  </button>}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  <Link
                                    href={`/expenses/${expense.id}`}
                                    className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-black text-green-700 hover:bg-green-200"
                                  >
                                    <Eye size={16} />
                                    Voucher
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() => startEditExpense(expense)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                                  >
                                    <Pencil size={16} />
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleExpenseDelete(expense)}
                                    disabled={
                                      deletingExpenseId === expense.id ||
                                      !expense.is_active
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {deletingExpenseId === expense.id ? (
                                      <Loader2 size={16} className="animate-spin" />
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
            </div>

            <aside className="space-y-6">
              {canManageExpenses && <div className="card p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Tag size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Category List
                    </h2>
                    <p className="text-sm text-slate-600">
                      Edit or delete expense categories.
                    </p>
                  </div>
                </div>

                {categories.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
                    No categories found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        {editingCategoryId === category.id ? (
                          <div className="space-y-3">
                            <input
                              className="input"
                              name="name"
                              value={editCategoryForm.name}
                              onChange={handleEditCategoryChange}
                              placeholder="Category name"
                            />

                            <textarea
                              className="input min-h-20"
                              name="description"
                              value={editCategoryForm.description}
                              onChange={handleEditCategoryChange}
                              placeholder="Description"
                            />

                            <label className="flex items-center gap-3 text-sm font-black text-slate-700">
                              <input
                                type="checkbox"
                                name="is_active"
                                checked={editCategoryForm.is_active}
                                onChange={handleEditCategoryChange}
                                className="h-5 w-5"
                              />
                              Active category
                            </label>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleCategoryUpdate(category.id)}
                                disabled={updatingCategory}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-70"
                              >
                                {updatingCategory ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Pencil size={16} />
                                )}
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditCategory}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-300"
                              >
                                <X size={16} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black text-slate-950">
                                {category.name}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {category.description || "No description"}
                              </p>

                              <span
                                className={
                                  category.is_active
                                    ? "mt-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700"
                                    : "mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700"
                                }
                              >
                                {category.is_active ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEditCategory(category)}
                                className="rounded-xl bg-blue-100 p-2 text-blue-700 hover:bg-blue-200"
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCategoryDelete(category)}
                                disabled={deletingCategoryId === category.id}
                                className="rounded-xl bg-red-100 p-2 text-red-700 hover:bg-red-200 disabled:opacity-60"
                              >
                                {deletingCategoryId === category.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>}

              {canManageExpenses && <form onSubmit={handleCategorySubmit} className="card p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <Tag size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Add Category
                    </h2>
                    <p className="text-sm text-slate-600">
                      Example: Rent, Salary, Utilities
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    className="input"
                    name="name"
                    value={categoryForm.name}
                    onChange={handleCategoryChange}
                    placeholder="Category name"
                    required
                  />

                  <textarea
                    className="input min-h-20"
                    name="description"
                    value={categoryForm.description}
                    onChange={handleCategoryChange}
                    placeholder="Optional description"
                  />

                  <button
                    type="submit"
                    disabled={submittingCategory || !subscription?.has_access}
                    className="btn-secondary flex w-full items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {submittingCategory ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Add Category
                      </>
                    )}
                  </button>
                </div>
              </form>}

              <form onSubmit={handleExpenseSubmit} className="card p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white">
                    <WalletCards size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Add Expense
                    </h2>
                    <p className="text-sm text-slate-600">
                      Record a business expense.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    className="input"
                    name="title"
                    value={expenseForm.title}
                    onChange={handleExpenseChange}
                    placeholder="Expense title"
                    required
                  />

                  <select
                    className="input"
                    name="category"
                    value={expenseForm.category}
                    onChange={handleExpenseChange}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>

                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    name="amount"
                    value={expenseForm.amount}
                    onChange={handleExpenseChange}
                    placeholder="Amount"
                    required
                  />

                  <input
                    className="input"
                    type="date"
                    name="expense_date"
                    value={expenseForm.expense_date}
                    onChange={handleExpenseChange}
                    required
                  />

                  <select
                    className="input"
                    name="payment_method"
                    value={expenseForm.payment_method}
                    onChange={handleExpenseChange}
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
                    value={expenseForm.note}
                    onChange={handleExpenseChange}
                    placeholder="Optional note"
                  />

                  <button
                    type="submit"
                    disabled={submittingExpense || !subscription?.has_access}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-black text-white hover:bg-red-700 disabled:opacity-70"
                  >
                    {submittingExpense ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Receipt size={18} />
                        Add Expense
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

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

export default function ExpensesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading expenses...
          </div>
        </main>
      }
    >
      <ExpensesContent />
    </Suspense>
  );
}
