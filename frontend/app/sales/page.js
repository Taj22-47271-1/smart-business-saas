"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Download,
  Eye,
  Filter,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SubscriptionAccessCard from "@/components/SubscriptionAccessCard";
import { exportToCsv, formatDateForFilename } from "@/lib/exportCsv";
import { FINANCE_ROLES, hasActiveBusinessRole } from "@/lib/roles";

function SalesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessFromUrl = searchParams.get("business");

  const { user, loading } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    businessFromUrl || ""
  );

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [sales, setSales] = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [saleComposerOpen, setSaleComposerOpen] = useState(false);
  const [submittingSale, setSubmittingSale] = useState(false);
  const [cancellingSaleId, setCancellingSaleId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    payment_status: "ALL",
    sale_status: "ALL",
    payment_method: "ALL",
  });

  const [saleForm, setSaleForm] = useState({
    customer_id: "",
    discount: "",
    tax: "",
    paid_amount: "",
    payment_method: "Cash",
    voucher_code: "",
    note: "",
  });

  const [saleItems, setSaleItems] = useState([
    {
      product_id: "",
      quantity: "1",
      selling_price: "",
    },
  ]);

  const selectedBusiness = useMemo(() => {
    return businesses.find(
      (business) => String(business.id) === String(selectedBusinessId)
    );
  }, [businesses, selectedBusinessId]);

  const canViewSalesFinancials = hasActiveBusinessRole(
    user,
    selectedBusinessId,
    FINANCE_ROLES
  );

  const paymentMethods = useMemo(() => {
    const uniqueMethods = new Set();

    sales.forEach((sale) => {
      if (sale.payment_method) {
        uniqueMethods.add(sale.payment_method);
      }
    });

    return Array.from(uniqueMethods);
  }, [sales]);

  const filteredSales = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    return sales.filter((sale) => {
      const invoice = String(sale.invoice_number || "").toLowerCase();
      const customerName = String(sale.customer_name || "").toLowerCase();
      const customerPhone = String(sale.customer_phone || "").toLowerCase();

      const matchesSearch =
        !searchValue ||
        invoice.includes(searchValue) ||
        customerName.includes(searchValue) ||
        customerPhone.includes(searchValue);

      const matchesPaymentStatus =
        filters.payment_status === "ALL" ||
        sale.payment_status === filters.payment_status;

      const matchesSaleStatus =
        filters.sale_status === "ALL" || sale.status === filters.sale_status;

      const matchesPaymentMethod =
        filters.payment_method === "ALL" ||
        sale.payment_method === filters.payment_method;

      return (
        matchesSearch &&
        matchesPaymentStatus &&
        matchesSaleStatus &&
        matchesPaymentMethod
      );
    });
  }, [sales, filters]);

  const activeSales = sales.filter((sale) => sale.status !== "CANCELLED");

  const totalSalesAmount = activeSales.reduce((sum, sale) => {
    return sum + Number(sale.total_amount || 0);
  }, 0);

  const totalPaidAmount = activeSales.reduce((sum, sale) => {
    return sum + Number(sale.paid_amount || 0);
  }, 0);

  const totalDueAmount = activeSales.reduce((sum, sale) => {
    return sum + Number(sale.due_amount || 0);
  }, 0);

  const cancelledSalesCount = sales.filter(
    (sale) => sale.status === "CANCELLED"
  ).length;

  const saleSubtotal = useMemo(() => {
    return saleItems.reduce((sum, item) => {
      return (
        sum +
        Number(item.quantity || 0) * Number(item.selling_price || 0)
      );
    }, 0);
  }, [saleItems]);

  const voucherPreview = useMemo(() => {
    const normalizedCode = saleForm.voucher_code.trim().toUpperCase();

    if (!normalizedCode) {
      return {
        code: "",
        discount: 0,
        isValid: false,
        message: "",
      };
    }

    const voucher = vouchers.find(
      (item) => String(item.code || "").trim().toUpperCase() === normalizedCode
    );

    if (!voucher) {
      return {
        code: normalizedCode,
        discount: 0,
        isValid: false,
        message: "Voucher code not found.",
      };
    }

    if (!voucher.is_active) {
      return {
        code: normalizedCode,
        discount: 0,
        isValid: false,
        message: "This voucher is inactive.",
      };
    }

    const now = new Date();
    const validFrom = voucher.valid_from ? new Date(voucher.valid_from) : null;
    const validUntil = voucher.valid_until ? new Date(voucher.valid_until) : null;

    if (validFrom && validFrom > now) {
      return {
        code: normalizedCode,
        discount: 0,
        isValid: false,
        message: "This voucher is not active yet.",
      };
    }

    if (validUntil && validUntil < now) {
      return {
        code: normalizedCode,
        discount: 0,
        isValid: false,
        message: "This voucher has expired.",
      };
    }

    const minimumPurchase = Number(voucher.minimum_purchase || 0);

    if (saleSubtotal < minimumPurchase) {
      return {
        code: normalizedCode,
        discount: 0,
        isValid: false,
        message: `Minimum purchase for this voucher is ৳ ${minimumPurchase.toFixed(2)}.`,
      };
    }

    let discount = Number(voucher.value || 0);

    if (voucher.discount_type === "PERCENT") {
      discount = (saleSubtotal * discount) / 100;

      if (voucher.maximum_discount !== null && voucher.maximum_discount !== "") {
        discount = Math.min(discount, Number(voucher.maximum_discount || 0));
      }
    }

    const tax = Number(saleForm.tax || 0);
    discount = Math.min(discount, saleSubtotal + tax);

    return {
      code: normalizedCode,
      discount: Math.max(0, discount),
      isValid: true,
      message: `Voucher ${normalizedCode} applied successfully.`,
    };
  }, [saleForm.voucher_code, saleForm.tax, saleSubtotal, vouchers]);

  const effectiveDiscount = saleForm.voucher_code.trim()
    ? voucherPreview.discount
    : Number(saleForm.discount || 0);

  const saleTotal = useMemo(() => {
    const tax = Number(saleForm.tax || 0);
    const total = saleSubtotal - effectiveDiscount + tax;

    return total < 0 ? 0 : total;
  }, [saleSubtotal, effectiveDiscount, saleForm.tax]);

  const saleDue = useMemo(() => {
    const due = saleTotal - Number(saleForm.paid_amount || 0);

    return due < 0 ? 0 : due;
  }, [saleTotal, saleForm.paid_amount]);

  useEffect(() => {
    if (!voucherPreview.isValid || saleSubtotal <= 0) return;

    const discountedTotal = saleTotal.toFixed(2);

    setSaleForm((previous) => {
      if (previous.paid_amount === discountedTotal) {
        return previous;
      }

      return {
        ...previous,
        paid_amount: discountedTotal,
      };
    });
  }, [voucherPreview.code, voucherPreview.isValid, saleSubtotal, saleTotal]);

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

  const loadProducts = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/products/business/${businessId}/`);
    setProducts(safeArray(response.data));
  };

  const loadVouchers = async (businessId) => {
    if (!businessId) return;

    try {
      const response = await api.get(`/sales/business/${businessId}/vouchers/`);
      setVouchers(safeArray(response.data));
    } catch (error) {
      setVouchers([]);
    }
  };

  const loadSales = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/sales/business/${businessId}/`);
    setSales(safeArray(response.data));
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
          loadProducts(activeBusinessId),
          loadVouchers(activeBusinessId),
          loadSales(activeBusinessId),
          loadSubscription(activeBusinessId),
        ]);
      }
    } catch (error) {
      toast.error("Failed to load sales page");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPageData();
    }
  }, [user]);

  useEffect(() => {
    if (loadingPage || typeof window === "undefined") return;
    const shouldOpen =
      window.location.hash === "#create-sale" || searchParams.get("new") === "1";
    if (shouldOpen) {
      setSaleComposerOpen(true);
    }
  }, [loadingPage, selectedBusinessId, searchParams]);

  const handleBusinessChange = async (event) => {
    const businessId = event.target.value;

    setSelectedBusinessId(businessId);

    if (!businessId) {
      setCustomers([]);
      setProducts([]);
      setVouchers([]);
      setSales([]);
      setSubscription(null);
      return;
    }

    try {
      setLoadingPage(true);

      await Promise.all([
        loadCustomers(businessId),
        loadProducts(businessId),
        loadVouchers(businessId),
        loadSales(businessId),
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
      payment_status: "ALL",
      sale_status: "ALL",
      payment_method: "ALL",
    });
  };

  const handleSaleFormChange = (event) => {
    const { name, value } = event.target;

    setSaleForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleItemChange = (index, event) => {
    const { name, value } = event.target;

    setSaleItems((previous) => {
      const updatedItems = [...previous];

      updatedItems[index] = {
        ...updatedItems[index],
        [name]: value,
      };

      if (name === "product_id") {
        const selectedProduct = products.find(
          (product) => String(product.id) === String(value)
        );

        updatedItems[index].selling_price =
          selectedProduct?.selling_price || "";
      }

      return updatedItems;
    });
  };

  const addSaleItem = () => {
    setSaleItems((previous) => [
      ...previous,
      {
        product_id: "",
        quantity: "1",
        selling_price: "",
      },
    ]);
  };

  const removeSaleItem = (index) => {
    if (saleItems.length === 1) {
      toast.error("At least one sale item is required");
      return;
    }

    setSaleItems((previous) => {
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const handleExportCsv = () => {
    if (!selectedBusiness) {
      toast.error("Please select a business first");
      return;
    }

    if (filteredSales.length === 0) {
      toast.error("No sales available to export");
      return;
    }

    const rows = filteredSales.map((sale) => ({
      Invoice: sale.invoice_number || "N/A",
      Customer: sale.customer_name || "Walk-in Customer",
      Customer_Phone: sale.customer_phone || "N/A",
      Subtotal: sale.subtotal || "0.00",
      Discount: sale.discount || "0.00",
      Tax: sale.tax || "0.00",
      Total: sale.total_amount || "0.00",
      Paid: sale.paid_amount || "0.00",
      Due: sale.due_amount || "0.00",
      Payment_Method: sale.payment_method || "N/A",
      Payment_Status: sale.payment_status || "N/A",
      Sale_Status: sale.status || "ACTIVE",
      Sold_By: sale.sold_by_email || "N/A",
      Cancel_Reason: sale.cancel_reason || "",
      Cancelled_By: sale.cancelled_by_email || "",
      Created_At: sale.created_at
        ? new Date(sale.created_at).toLocaleString()
        : "N/A",
    }));

    exportToCsv(
      `sales_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Sales CSV exported successfully");
  };

  const handleSaleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to create sale");
      return;
    }

    const validItems = saleItems.filter((item) => {
      return item.product_id && Number(item.quantity || 0) > 0;
    });

    if (validItems.length === 0) {
      toast.error("Please add at least one valid sale item");
      return;
    }

    const selectedProductIds = validItems.map((item) => String(item.product_id));
    if (new Set(selectedProductIds).size !== selectedProductIds.length) {
      toast.error("The same product cannot be added more than once");
      return;
    }

    const insufficientStockItem = validItems.find((item) => {
      const product = products.find(
        (candidate) => String(candidate.id) === String(item.product_id)
      );
      return !product || Number(item.quantity) > Number(product.stock_quantity);
    });

    if (insufficientStockItem) {
      toast.error("Not enough stock for one of the selected products");
      return;
    }

    if (saleForm.voucher_code.trim() && !voucherPreview.isValid) {
      toast.error(voucherPreview.message || "Please enter a valid voucher code");
      return;
    }

    if (Number(saleForm.paid_amount || 0) > saleTotal) {
      toast.error("Paid amount cannot be greater than total amount");
      return;
    }

    try {
      setSubmittingSale(true);

      const response = await api.post("/sales/create/", {
        business_id: Number(selectedBusinessId),
        customer_id: saleForm.customer_id
          ? Number(saleForm.customer_id)
          : null,
        discount: saleForm.voucher_code.trim() ? "0" : saleForm.discount || "0",
        tax: saleForm.tax || "0",
        paid_amount: voucherPreview.isValid
          ? saleTotal.toFixed(2)
          : saleForm.paid_amount || "0",
        payment_method: saleForm.payment_method,
        voucher_code: saleForm.voucher_code || null,
        note: saleForm.note || null,
        items: validItems.map((item) => ({
          product_id: Number(item.product_id),
          quantity: item.quantity,
          selling_price: item.selling_price || "0",
        })),
      });

      toast.success("Sale created successfully");
      setSaleComposerOpen(false);

      setSaleForm({
        customer_id: "",
        discount: "",
        tax: "",
        paid_amount: "",
        payment_method: "Cash",
        voucher_code: "",
        note: "",
      });

      setSaleItems([
        {
          product_id: "",
          quantity: "1",
          selling_price: "",
        },
      ]);

      await Promise.all([
        loadSales(selectedBusinessId),
        loadProducts(selectedBusinessId),
        loadCustomers(selectedBusinessId),
      ]);

      if (response.data?.id) {
        router.push(`/sales/${response.data.id}`);
      }
    } catch (error) {
      showApiError(error, "Failed to create sale");
    } finally {
      setSubmittingSale(false);
    }
  };

  const handleCancelSale = async (sale) => {
    if (!subscription?.has_access) {
      toast.error("Subscription access is required to cancel sale");
      return;
    }

    if (sale.status === "CANCELLED") {
      toast.error("This sale is already cancelled");
      return;
    }

    const reason = window.prompt(
      `Write cancel reason for invoice ${sale.invoice_number}:`,
      "Wrong invoice created"
    );

    if (reason === null) return;

    const confirmed = window.confirm(
      `Are you sure you want to cancel invoice ${sale.invoice_number}? Product stock and customer due will be adjusted automatically.`
    );

    if (!confirmed) return;

    try {
      setCancellingSaleId(sale.id);

      await api.post(`/sales/${sale.id}/cancel/`, {
        reason: reason || "Sale cancelled from frontend.",
      });

      toast.success("Sale cancelled successfully");

      await Promise.all([
        loadSales(selectedBusinessId),
        loadProducts(selectedBusinessId),
        loadCustomers(selectedBusinessId),
      ]);
    } catch (error) {
      showApiError(error, "Failed to cancel sale");
    } finally {
      setCancellingSaleId(null);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading sales...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Sales"
      subtitle="Create invoices, track payments and cancel wrong invoices safely."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Sales Management
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Sales & Invoices
          </h1>

          <p className="mt-2 text-slate-600">
            Create sales, print invoices, track due and cancel wrong invoices
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

          <button
            type="button"
            onClick={() => setSaleComposerOpen(true)}
            disabled={!selectedBusiness}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={17} />
            New Sale
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!selectedBusiness || filteredSales.length === 0}
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
            <StatCard title="Invoices" value={sales.length} />
            <StatCard title="Active Sales" value={activeSales.length} />
            <StatCard title="Cancelled" value={cancelledSalesCount} />
            <StatCard
              title="Total Sales"
              value={`৳ ${totalSalesAmount.toFixed(2)}`}
            />
            <StatCard title="Total Due" value={`৳ ${totalDueAmount.toFixed(2)}`} />
          </div>

          <div className="grid grid-cols-1 gap-8">
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
                      Find invoices by invoice number, customer, payment status,
                      sale status and method.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Search Invoice
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
                        placeholder="Search invoice, customer or phone"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Payment Status
                    </label>

                    <select
                      className="input"
                      name="payment_status"
                      value={filters.payment_status}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Payment</option>
                      <option value="PAID">Paid</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="DUE">Due</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Sale Status
                    </label>

                    <select
                      className="input"
                      name="sale_status"
                      value={filters.sale_status}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Sales</option>
                      <option value="ACTIVE">Active</option>
                      <option value="CANCELLED">Cancelled</option>
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
                    disabled={filteredSales.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-4 py-2 text-sm font-black text-green-700 hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={16} />
                    Export Filtered Sales
                  </button>

                  <span className="text-sm font-black text-slate-500">
                    Paid: ৳ {totalPaidAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-xl font-black text-slate-950">
                    Invoice List
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Showing {filteredSales.length} of {sales.length} invoices
                    for {selectedBusiness.name}.
                  </p>
                </div>

                {filteredSales.length === 0 ? (
                  <div className="p-8 text-center text-slate-600">
                    No invoices matched your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1250px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Invoice</th>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Total</th>
                          <th className="p-4">Paid</th>
                          <th className="p-4">Due</th>
                          <th className="p-4">Payment</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {filteredSales.map((sale) => (
                          <tr key={sale.id} className="bg-white align-top">
                            <td className="p-4">
                              <p className="font-black text-slate-950">
                                {sale.invoice_number}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {sale.created_at
                                  ? new Date(sale.created_at).toLocaleString()
                                  : "N/A"}
                              </p>

                              {sale.cancel_reason && (
                                <p className="mt-1 max-w-xs text-xs text-red-500">
                                  Cancel reason: {sale.cancel_reason}
                                </p>
                              )}
                            </td>

                            <td className="p-4">
                              <p className="font-bold text-slate-700">
                                {sale.customer_name || "Walk-in Customer"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {sale.customer_phone || "N/A"}
                              </p>
                            </td>

                            <td className="p-4 font-black text-slate-950">
                              ৳ {sale.total_amount}
                            </td>

                            <td className="p-4 font-black text-green-600">
                              ৳ {sale.paid_amount}
                            </td>

                            <td className="p-4 font-black text-red-600">
                              ৳ {sale.due_amount}
                            </td>

                            <td className="p-4">
                              <PaymentStatusBadge status={sale.payment_status} />

                              <p className="mt-2 text-xs font-bold text-slate-500">
                                {sale.payment_method}
                              </p>
                            </td>

                            <td className="p-4">
                              <SaleStatusBadge status={sale.status} />
                            </td>

                            <td className="p-4">
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/sales/${sale.id}`}
                                  className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-black text-green-700 hover:bg-green-200"
                                >
                                  <Eye size={16} />
                                  Invoice
                                </Link>

                                {sale.status === "ACTIVE" && Number(sale.due_amount || 0) > 0 && (
                                  <Link
                                    href={`/sales/${sale.id}#receive-payment`}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                                  >
                                    <Wallet size={16} />
                                    Receive Due
                                  </Link>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleCancelSale(sale)}
                                  disabled={
                                    cancellingSaleId === sale.id ||
                                    sale.status === "CANCELLED"
                                  }
                                  className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {cancellingSaleId === sale.id ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Ban size={16} />
                                  )}
                                  Cancel
                                </button>
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

            {saleComposerOpen && (
            <aside
              id="create-sale"
              className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Create sale"
            >
              <button
                type="button"
                className="fixed inset-0 cursor-default"
                onClick={() => setSaleComposerOpen(false)}
                aria-label="Close create sale form"
              />
              <form onSubmit={handleSaleSubmit} className="card relative z-10 my-auto w-full max-w-2xl overflow-visible p-5 sm:p-7">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                      <ShoppingCart size={22} />
                    </div>

                    <div>
                      <h2 className="text-xl font-black text-slate-950">Create Sale</h2>
                      <p className="text-sm text-slate-600">
                        Staff and owners can create a new invoice from this form.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSaleComposerOpen(false)}
                    className="shrink-0 rounded-xl bg-slate-100 p-2 text-slate-700 transition hover:bg-red-100 hover:text-red-700"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <select
                    className="input"
                    name="customer_id"
                    value={saleForm.customer_id}
                    onChange={handleSaleFormChange}
                  >
                    <option value="">Walk-in Customer</option>
                    {customers
                      .filter((customer) => customer.is_active)
                      .map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.phone || "No phone"}
                        </option>
                      ))}
                  </select>

                  {products.filter((product) => product.is_active && Number(product.stock_quantity || 0) > 0).length === 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
                      No product currently has available stock. Add stock first from the Stock page, then return here.
                      <Link href={`/stock?business=${selectedBusinessId}`} className="ml-2 underline">
                        Open Stock
                      </Link>
                    </div>
                  )}

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-950">Sale Items</p>

                      <button
                        type="button"
                        onClick={addSaleItem}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                      >
                        <Plus size={16} />
                        Add Item
                      </button>
                    </div>

                    {saleItems.map((item, index) => {
                      const selectedProduct = products.find(
                        (product) =>
                          String(product.id) === String(item.product_id)
                      );

                      const lineTotal =
                        Number(item.quantity || 0) *
                        Number(item.selling_price || 0);

                      return (
                        <div
                          key={index}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-black text-slate-700">
                              Item #{index + 1}
                            </p>

                            <button
                              type="button"
                              onClick={() => removeSaleItem(index)}
                              className="rounded-xl bg-red-100 p-2 text-red-700 hover:bg-red-200"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="space-y-3">
                            <select
                              className="input"
                              name="product_id"
                              value={item.product_id}
                              onChange={(event) =>
                                handleItemChange(index, event)
                              }
                              required
                            >
                              <option value="">Select product</option>
                              {products
                                .filter((product) => product.is_active && Number(product.stock_quantity || 0) > 0)
                                .map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                    {product.size ? ` / ${product.size}` : ""}
                                    {product.color ? ` / ${product.color}` : ""}
                                    {` - Stock ${product.stock_quantity} ${product.unit}`}
                                  </option>
                                ))}
                            </select>

                            <div className="grid gap-3 md:grid-cols-2">
                              <input
                                className="input"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={selectedProduct?.stock_quantity || undefined}
                                name="quantity"
                                value={item.quantity}
                                onChange={(event) =>
                                  handleItemChange(index, event)
                                }
                                placeholder="Quantity"
                                required
                              />

                              <input
                                className="input"
                                type="number"
                                step="0.01"
                                min="0"
                                name="selling_price"
                                value={item.selling_price}
                                onChange={(event) =>
                                  handleItemChange(index, event)
                                }
                                placeholder="Selling price"
                                readOnly={!canViewSalesFinancials}
                                required
                              />
                            </div>

                            {selectedProduct && (
                              <div className="rounded-xl bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
                                Variant: {selectedProduct.size || "N/A"} / {selectedProduct.color || "N/A"}.{" "}
                                Current stock: {selectedProduct.stock_quantity}{" "}
                                {selectedProduct.unit}. Line total: ৳{" "}
                                {lineTotal.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <input
                        className="input uppercase"
                        name="voucher_code"
                        value={saleForm.voucher_code}
                        onChange={handleSaleFormChange}
                        placeholder="Approved voucher code (optional)"
                        list="available-sale-vouchers"
                      />
                      <datalist id="available-sale-vouchers">
                        {vouchers.map((voucher) => (
                          <option key={voucher.id} value={voucher.code}>
                            {voucher.discount_type === "PERCENT"
                              ? `${voucher.value}% discount`
                              : `৳ ${voucher.value} discount`}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      name="discount"
                      value={
                        saleForm.voucher_code.trim()
                          ? voucherPreview.isValid
                            ? voucherPreview.discount.toFixed(2)
                            : ""
                          : saleForm.discount
                      }
                      onChange={handleSaleFormChange}
                      placeholder="Discount"
                      readOnly={
                        Boolean(saleForm.voucher_code.trim()) ||
                        !canViewSalesFinancials
                      }
                    />

                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      name="tax"
                      value={saleForm.tax}
                      onChange={handleSaleFormChange}
                      placeholder="Tax"
                    />
                  </div>

                  {saleForm.voucher_code.trim() && (
                    <div
                      className={`rounded-xl px-4 py-3 text-sm font-bold ${
                        voucherPreview.isValid
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {voucherPreview.isValid
                        ? `${voucherPreview.message} Discount: ৳ ${voucherPreview.discount.toFixed(2)}. Payable total: ৳ ${saleTotal.toFixed(2)}.`
                        : voucherPreview.message}
                    </div>
                  )}

                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    name="paid_amount"
                    value={saleForm.paid_amount}
                    onChange={handleSaleFormChange}
                    placeholder="Paid amount"
                    readOnly={voucherPreview.isValid}
                  />

                  <select
                    className="input"
                    name="payment_method"
                    value={saleForm.payment_method}
                    onChange={handleSaleFormChange}
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
                    value={saleForm.note}
                    onChange={handleSaleFormChange}
                    placeholder="Optional note"
                  />

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <SummaryRow label="Subtotal" value={`৳ ${saleSubtotal.toFixed(2)}`} />
                    <SummaryRow
                      label="Discount"
                      value={`৳ ${effectiveDiscount.toFixed(2)}`}
                    />
                    <SummaryRow
                      label="Tax"
                      value={`৳ ${Number(saleForm.tax || 0).toFixed(2)}`}
                    />
                    <SummaryRow label="Total" value={`৳ ${saleTotal.toFixed(2)}`} />
                    <SummaryRow
                      label="Paid"
                      value={`৳ ${Number(saleForm.paid_amount || 0).toFixed(2)}`}
                    />
                    <SummaryRow label="Due" value={`৳ ${saleDue.toFixed(2)}`} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setSaleComposerOpen(false)}
                      className="btn-secondary w-full"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        submittingSale ||
                        !subscription?.has_access ||
                        products.filter((product) => product.is_active && Number(product.stock_quantity || 0) > 0).length === 0
                      }
                      className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {submittingSale ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Receipt size={18} />
                          Create Invoice
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </aside>
            )}
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

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-200 py-2 last:border-b-0">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}

function PaymentStatusBadge({ status }) {
  let className =
    "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700";

  if (status === "PAID") {
    className =
      "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700";
  }

  if (status === "PARTIAL") {
    className =
      "inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700";
  }

  if (status === "DUE") {
    className =
      "inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700";
  }

  return <span className={className}>{status || "N/A"}</span>;
}

function SaleStatusBadge({ status }) {
  if (status === "CANCELLED") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
        CANCELLED
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
      ACTIVE
    </span>
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

export default function SalesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading sales...
          </div>
        </main>
      }
    >
      <SalesContent />
    </Suspense>
  );
}
