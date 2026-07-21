"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  Download,
  Eye,
  Filter,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SubscriptionAccessCard from "@/components/SubscriptionAccessCard";
import { exportToCsv, formatDateForFilename } from "@/lib/exportCsv";
import { BUSINESS_ROLES, FINANCE_ROLES, MANAGEMENT_ROLES, hasActiveBusinessRole } from "@/lib/roles";

function StockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessFromUrl = searchParams.get("business");

  const { user, loading } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    businessFromUrl || ""
  );

  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [submittingStock, setSubmittingStock] = useState(false);
  const [reversingTransactionId, setReversingTransactionId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    transaction_type: "ALL",
    status: "ALL",
  });

  const [stockForm, setStockForm] = useState({
    product_id: "",
    transaction_type: "STOCK_IN",
    quantity: "",
    unit_cost: "",
    note: "",
  });

  const selectedBusiness = useMemo(() => {
    return businesses.find(
      (business) => String(business.id) === String(selectedBusinessId)
    );
  }, [businesses, selectedBusinessId]);

  const canManageStock = hasActiveBusinessRole(
    user,
    selectedBusinessId,
    MANAGEMENT_ROLES
  );
  const canViewStockCosts = hasActiveBusinessRole(
    user,
    selectedBusinessId,
    FINANCE_ROLES
  );
  const canRecordStock = hasActiveBusinessRole(
    user,
    selectedBusinessId,
    [...MANAGEMENT_ROLES, BUSINESS_ROLES.STAFF]
  );

  useEffect(() => {
    if (
      selectedBusinessId &&
      !canManageStock &&
      ["STOCK_IN", "ADJUSTMENT"].includes(stockForm.transaction_type)
    ) {
      setStockForm((previous) => ({
        ...previous,
        transaction_type: "STOCK_OUT",
        unit_cost: "",
      }));
    }
  }, [selectedBusinessId, canManageStock, stockForm.transaction_type]);

  const filteredTransactions = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const productName = String(transaction.product_name || "").toLowerCase();
      const transactionType = String(
        transaction.transaction_type || ""
      ).toLowerCase();
      const note = String(transaction.note || "").toLowerCase();

      const matchesSearch =
        !searchValue ||
        productName.includes(searchValue) ||
        transactionType.includes(searchValue) ||
        note.includes(searchValue);

      const matchesType =
        filters.transaction_type === "ALL" ||
        transaction.transaction_type === filters.transaction_type;

      const matchesStatus =
        filters.status === "ALL" ||
        (filters.status === "NORMAL" &&
          !transaction.is_reversed &&
          !transaction.is_reversal) ||
        (filters.status === "REVERSED" && transaction.is_reversed) ||
        (filters.status === "REVERSAL" && transaction.is_reversal);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [transactions, filters]);

  const stockInTotal = transactions.reduce((sum, transaction) => {
    if (transaction.transaction_type === "STOCK_IN") {
      return sum + Number(transaction.quantity || 0);
    }

    return sum;
  }, 0);

  const stockOutTotal = transactions.reduce((sum, transaction) => {
    if (transaction.transaction_type === "STOCK_OUT") {
      return sum + Number(transaction.quantity || 0);
    }

    return sum;
  }, 0);

  const damagedTotal = transactions.reduce((sum, transaction) => {
    if (transaction.transaction_type === "DAMAGED") {
      return sum + Number(transaction.quantity || 0);
    }

    return sum;
  }, 0);

  const totalCost = transactions.reduce((sum, transaction) => {
    return sum + Number(transaction.total_cost || 0);
  }, 0);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadProducts = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/products/business/${businessId}/`);
    setProducts(safeArray(response.data));
  };

  const loadTransactions = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/inventory/business/${businessId}/`);
    setTransactions(safeArray(response.data));
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
          loadProducts(activeBusinessId),
          loadTransactions(activeBusinessId),
          loadSubscription(activeBusinessId),
        ]);
      }
    } catch (error) {
      toast.error("Failed to load stock page");
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
      setProducts([]);
      setTransactions([]);
      setSubscription(null);
      return;
    }

    try {
      setLoadingPage(true);

      await Promise.all([
        loadProducts(businessId),
        loadTransactions(businessId),
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
      transaction_type: "ALL",
      status: "ALL",
    });
  };

  const handleStockChange = (event) => {
    const { name, value } = event.target;

    setStockForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openStockTransaction = (productId = "", transactionType = null) => {
    const defaultType = transactionType || (canManageStock ? "STOCK_IN" : "STOCK_OUT");
    setStockForm((previous) => ({
      ...previous,
      product_id: productId ? String(productId) : previous.product_id,
      transaction_type: defaultType,
      unit_cost: defaultType === "STOCK_IN" ? previous.unit_cost : "",
    }));

    window.setTimeout(() => {
      document.getElementById("stock-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const handleExportCsv = () => {
    if (!selectedBusiness) {
      toast.error("Please select a business first");
      return;
    }

    if (filteredTransactions.length === 0) {
      toast.error("No stock transactions available to export");
      return;
    }

    const rows = filteredTransactions.map((transaction) => ({
      Product: transaction.product_name || "N/A",
      Type: formatTransactionType(transaction.transaction_type),
      Quantity: transaction.quantity || "0",
      Previous_Quantity: transaction.previous_quantity || "0",
      New_Quantity: transaction.new_quantity || "0",
      ...(canViewStockCosts ? {
        Unit_Cost: transaction.unit_cost || "0.00",
        Total_Cost: transaction.total_cost || "0.00",
      } : {}),
      Status: getTransactionStatus(transaction),
      Note: transaction.note || "",
      Created_By: transaction.created_by_email || "N/A",
      Created_At: transaction.created_at
        ? new Date(transaction.created_at).toLocaleString()
        : "N/A",
    }));

    exportToCsv(
      `stock_transactions_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Stock CSV exported successfully");
  };

  const handleStockSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to create stock transaction");
      return;
    }

    try {
      setSubmittingStock(true);

      await api.post("/inventory/create/", {
        business_id: Number(selectedBusinessId),
        product_id: Number(stockForm.product_id),
        transaction_type: stockForm.transaction_type,
        quantity: stockForm.quantity,
        unit_cost: stockForm.unit_cost || "0",
        note: stockForm.note || null,
      });

      toast.success("Stock transaction created successfully");

      setStockForm({
        product_id: "",
        transaction_type: "STOCK_IN",
        quantity: "",
        unit_cost: "",
        note: "",
      });

      await Promise.all([
        loadProducts(selectedBusinessId),
        loadTransactions(selectedBusinessId),
      ]);
    } catch (error) {
      showApiError(error, "Failed to create stock transaction");
    } finally {
      setSubmittingStock(false);
    }
  };

  const handleReverseTransaction = async (transaction) => {
    if (!subscription?.has_access) {
      toast.error("Subscription access is required to reverse transaction");
      return;
    }

    if (transaction.is_reversed) {
      toast.error("This transaction has already been reversed");
      return;
    }

    if (transaction.is_reversal) {
      toast.error("A reversal transaction cannot be reversed again");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to reverse this ${formatTransactionType(
        transaction.transaction_type
      )} transaction for "${transaction.product_name}"? Product stock balance will be corrected automatically.`
    );

    if (!confirmed) return;

    try {
      setReversingTransactionId(transaction.id);

      await api.post(`/inventory/${transaction.id}/reverse/`, {
        note: `Reversal from frontend for transaction #${transaction.id}`,
      });

      toast.success("Stock transaction reversed successfully");

      await Promise.all([
        loadProducts(selectedBusinessId),
        loadTransactions(selectedBusinessId),
      ]);
    } catch (error) {
      showApiError(error, "Failed to reverse stock transaction");
    } finally {
      setReversingTransactionId(null);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading stock...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Stock"
      subtitle="Manage stock in, stock out, damaged, returned and adjustment transactions."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Inventory Management
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Stock Transactions
          </h1>

          <p className="mt-2 text-slate-600">
            Create stock transactions, print vouchers and reverse wrong entries
            safely.
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

          {canRecordStock && (
            <button
              type="button"
              onClick={() => openStockTransaction()}
              disabled={!selectedBusiness}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={17} />
              New Transaction
            </button>
          )}

          <button
            onClick={handleExportCsv}
            disabled={!selectedBusiness || filteredTransactions.length === 0}
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

          <div className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">Product Stock Overview</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Every product appears here, including newly created products with zero stock.
                </p>
              </div>
              {canRecordStock && (
                <button
                  type="button"
                  onClick={() => openStockTransaction()}
                  className="btn-primary"
                >
                  <Plus size={17} />
                  Add Stock Transaction
                </button>
              )}
            </div>

            {products.length === 0 ? (
              <div className="p-8 text-center text-slate-600">
                No products found. Create a product first from the Products page.
              </div>
            ) : (
              <div className="table-wrap rounded-none">
                <table className="min-w-[900px] text-left">
                  <thead>
                    <tr>
                      <th className="p-4">Product</th>
                      <th className="p-4">Variant</th>
                      <th className="p-4">Current Stock</th>
                      <th className="p-4">Low Stock Limit</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {products.map((product) => {
                      const isLow = Number(product.stock_quantity || 0) <= Number(product.low_stock_limit || 0);
                      return (
                        <tr key={product.id}>
                          <td className="p-4">
                            <p className="font-black text-slate-950">{product.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{product.sku || "No SKU"}</p>
                          </td>
                          <td className="p-4 text-sm font-bold text-slate-700">
                            {product.size || "N/A"} / {product.color || "N/A"}
                          </td>
                          <td className="p-4">
                            <p className={`font-black ${isLow ? "text-red-600" : "text-green-600"}`}>
                              {product.stock_quantity} {product.unit}
                            </p>
                            {isLow && <p className="mt-1 text-xs font-bold text-red-500">Needs attention</p>}
                          </td>
                          <td className="p-4 font-bold text-slate-700">
                            {product.low_stock_limit} {product.unit}
                          </td>
                          <td className="p-4">
                            <span className={product.is_active ? "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700" : "inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700"}>
                              {product.is_active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="p-4">
                            {canRecordStock ? (
                              <button
                                type="button"
                                disabled={!product.is_active}
                                onClick={() => openStockTransaction(product.id, canManageStock ? "STOCK_IN" : "STOCK_OUT")}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Plus size={16} />
                                {canManageStock ? "Add Stock" : "Record Stock Out"}
                              </button>
                            ) : (
                              <span className="text-sm font-semibold text-slate-500">Read only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-5">
            <StatCard title="Transactions" value={transactions.length} />
            <StatCard title="Stock In" value={stockInTotal.toFixed(2)} />
            <StatCard title="Stock Out" value={stockOutTotal.toFixed(2)} />
            <StatCard title="Damaged" value={damagedTotal.toFixed(2)} />
            {canViewStockCosts && <StatCard title="Total Cost" value={`৳ ${totalCost.toFixed(2)}`} />}
          </div>

          <div className="stock-workspace-grid">
            <div className="min-w-0 space-y-6">
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
                      Find stock transactions by product, type, note and
                      reversal status.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Search Transaction
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
                        placeholder="Search product, type or note"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Transaction Type
                    </label>

                    <select
                      className="input"
                      name="transaction_type"
                      value={filters.transaction_type}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Types</option>
                      <option value="STOCK_IN">Stock In</option>
                      <option value="STOCK_OUT">Stock Out</option>
                      <option value="ADJUSTMENT">Adjustment</option>
                      <option value="DAMAGED">Damaged</option>
                      <option value="RETURNED">Returned</option>
                    </select>
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
                      <option value="NORMAL">Normal</option>
                      <option value="REVERSED">Reversed</option>
                      <option value="REVERSAL">Reversal Entry</option>
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
                    disabled={filteredTransactions.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-4 py-2 text-sm font-black text-green-700 hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={16} />
                    Export Filtered Stock
                  </button>
                </div>
              </div>

              <div className="card min-w-0 overflow-hidden">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-xl font-black text-slate-950">
                    Stock Transaction List
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Showing {filteredTransactions.length} of{" "}
                    {transactions.length} transactions for{" "}
                    {selectedBusiness.name}.
                  </p>
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-600">
                    No stock transactions matched your filters.
                  </div>
                ) : (
                  <div className="table-wrap rounded-none">
                    <table className="w-full min-w-[1050px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Product</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Quantity</th>
                          <th className="p-4">Previous</th>
                          <th className="p-4">New</th>
                          {canViewStockCosts && <th className="p-4">Cost</th>}
                          <th className="p-4">Status</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {filteredTransactions.map((transaction) => (
                          <tr key={transaction.id} className="bg-white align-top">
                            <td className="p-4">
                              <p className="font-black text-slate-950">
                                {transaction.product_name}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {transaction.created_at
                                  ? new Date(
                                      transaction.created_at
                                    ).toLocaleString()
                                  : "N/A"}
                              </p>

                              {transaction.note && (
                                <p className="mt-1 max-w-xs text-slate-500">
                                  Note: {transaction.note}
                                </p>
                              )}
                            </td>

                            <td className="p-4">
                              <TransactionTypeBadge
                                type={transaction.transaction_type}
                              />
                            </td>

                            <td className="p-4 font-black text-slate-950">
                              {transaction.quantity}
                            </td>

                            <td className="p-4 font-bold text-slate-700">
                              {transaction.previous_quantity}
                            </td>

                            <td className="p-4 font-bold text-slate-700">
                              {transaction.new_quantity}
                            </td>

                            {canViewStockCosts && (
                              <td className="p-4">
                                <p className="font-black text-slate-950">
                                  ৳ {transaction.total_cost}
                                </p>

                                <p className="text-xs text-slate-500">
                                  Unit: ৳ {transaction.unit_cost}
                                </p>
                              </td>
                            )}

                            <td className="p-4">
                              <StatusBadge transaction={transaction} />
                            </td>

                            <td className="p-4">
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/stock/${transaction.id}`}
                                  className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-black text-green-700 hover:bg-green-200"
                                >
                                  <Eye size={16} />
                                  Voucher
                                </Link>

                                {canManageStock && <button
                                  type="button"
                                  onClick={() =>
                                    handleReverseTransaction(transaction)
                                  }
                                  disabled={
                                    reversingTransactionId === transaction.id ||
                                    transaction.is_reversed ||
                                    transaction.is_reversal
                                  }
                                  className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {reversingTransactionId === transaction.id ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <RotateCcw size={16} />
                                  )}
                                  Reverse
                                </button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <aside className="stock-form-panel">
              {canRecordStock ? <form id="stock-form" onSubmit={handleStockSubmit} className="card w-full min-w-0 scroll-mt-24 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <PackageCheck size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Add Stock Transaction
                    </h2>

                    <p className="text-sm text-slate-600">
                      Create stock in, out, damaged, returned or adjustment.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <select
                    className="input"
                    name="product_id"
                    value={stockForm.product_id}
                    onChange={handleStockChange}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}{product.size ? ` / ${product.size}` : ""}{product.color ? ` / ${product.color}` : ""} - Stock {product.stock_quantity} {product.unit}
                      </option>
                    ))}
                  </select>

                  <select
                    className="input"
                    name="transaction_type"
                    value={stockForm.transaction_type}
                    onChange={handleStockChange}
                    required
                  >
                    {canManageStock && <option value="STOCK_IN">Stock In</option>}
                    <option value="STOCK_OUT">Stock Out</option>
                    {canManageStock && <option value="ADJUSTMENT">Adjustment</option>}
                    <option value="DAMAGED">Damaged</option>
                    <option value="RETURNED">Returned</option>
                  </select>

                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    name="quantity"
                    value={stockForm.quantity}
                    onChange={handleStockChange}
                    placeholder={
                      stockForm.transaction_type === "ADJUSTMENT"
                        ? "New final stock quantity"
                        : "Quantity"
                    }
                    required
                  />

                  {canManageStock && <input
                    className="input"
                    type="number"
                    step="0.01"
                    name="unit_cost"
                    value={stockForm.unit_cost}
                    onChange={handleStockChange}
                    placeholder="Unit cost"
                  />}

                  <textarea
                    className="input min-h-24"
                    name="note"
                    value={stockForm.note}
                    onChange={handleStockChange}
                    placeholder="Optional note"
                  />

                  <div className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-700">
                    <p className="font-black">Stock Rule:</p>
                    <p>
                      Stock In / Returned increases stock. Stock Out / Damaged
                      decreases stock. Adjustment sets final stock quantity.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingStock || !subscription?.has_access}
                    className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {submittingStock ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Add Transaction
                      </>
                    )}
                  </button>
                </div>
              </form> : <div className="card p-6 text-sm font-semibold text-slate-600">Your role has read-only stock access.</div>}
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

function TransactionTypeBadge({ type }) {
  const label = formatTransactionType(type);

  let className =
    "inline-flex rounded-full px-3 py-1 text-xs font-black bg-slate-100 text-slate-700";

  if (type === "STOCK_IN" || type === "RETURNED") {
    className =
      "inline-flex rounded-full px-3 py-1 text-xs font-black bg-green-100 text-green-700";
  }

  if (type === "STOCK_OUT" || type === "DAMAGED") {
    className =
      "inline-flex rounded-full px-3 py-1 text-xs font-black bg-red-100 text-red-700";
  }

  if (type === "ADJUSTMENT") {
    className =
      "inline-flex rounded-full px-3 py-1 text-xs font-black bg-blue-100 text-blue-700";
  }

  return <span className={className}>{label}</span>;
}

function StatusBadge({ transaction }) {
  if (transaction.is_reversal) {
    return (
      <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">
        REVERSAL ENTRY
      </span>
    );
  }

  if (transaction.is_reversed) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
        REVERSED
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
      NORMAL
    </span>
  );
}

function formatTransactionType(type) {
  if (type === "STOCK_IN") return "Stock In";
  if (type === "STOCK_OUT") return "Stock Out";
  if (type === "ADJUSTMENT") return "Adjustment";
  if (type === "DAMAGED") return "Damaged";
  if (type === "RETURNED") return "Returned";

  return type || "N/A";
}

function getTransactionStatus(transaction) {
  if (transaction.is_reversal) return "REVERSAL ENTRY";
  if (transaction.is_reversed) return "REVERSED";
  return "NORMAL";
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

export default function StockPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading stock...
          </div>
        </main>
      }
    >
      <StockContent />
    </Suspense>
  );
}
