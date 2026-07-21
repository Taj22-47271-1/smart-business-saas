"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Download,
  FileText,
  Loader2,
  PackageSearch,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SubscriptionAccessCard from "@/components/SubscriptionAccessCard";
import { exportToCsv, formatDateForFilename } from "@/lib/exportCsv";

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessFromUrl = searchParams.get("business");

  const { user, loading } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    businessFromUrl || ""
  );

  const [report, setReport] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);

  const selectedBusiness = useMemo(() => {
    return businesses.find(
      (business) => String(business.id) === String(selectedBusinessId)
    );
  }, [businesses, selectedBusinessId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadReport = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/reports/business/${businessId}/dashboard/`);
    setReport(response.data);
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
          loadReport(activeBusinessId),
          loadSubscription(activeBusinessId),
        ]);
      }
    } catch (error) {
      toast.error("Failed to load reports");
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
      setReport(null);
      setSubscription(null);
      return;
    }

    try {
      setLoadingPage(true);

      await Promise.all([loadReport(businessId), loadSubscription(businessId)]);
    } catch (error) {
      toast.error("Failed to switch business report");
    } finally {
      setLoadingPage(false);
    }
  };

  const handleExportSummaryCsv = () => {
    if (!selectedBusiness || !report) {
      toast.error("No report data available to export");
      return;
    }

    const rows = [
      {
        Business: report.business?.name || selectedBusiness.name,
        Total_Products: report.total_products || 0,
        Total_Customers: report.total_customers || 0,
        Low_Stock_Products: report.low_stock_products_count || 0,
        Total_Stock_Value: report.total_stock_value || "0.00",

        Today_Sales: report.today_sales || "0.00",
        Today_Expenses: report.today_expenses || "0.00",
        Today_Profit: report.today_profit || "0.00",

        Monthly_Sales: report.monthly_sales || "0.00",
        Monthly_Expenses: report.monthly_expenses || "0.00",
        Monthly_Profit: report.monthly_profit || "0.00",

        Total_Sales_Amount: report.total_sales_amount || "0.00",
        Total_Paid_Amount: report.total_paid_amount || "0.00",
        Total_Due_Amount: report.total_due_amount || "0.00",
        Total_Expenses_Amount: report.total_expenses_amount || "0.00",
        Total_Profit: report.total_profit || "0.00",
        Total_Customer_Due: report.total_customer_due || "0.00",

        Active_Sales_Count: report.total_sales_count || 0,
        Cancelled_Sales_Count: report.cancelled_sales_count || 0,
        Active_Expenses_Count: report.total_expenses_count || 0,
        Inactive_Expenses_Count: report.inactive_expenses_count || 0,
      },
    ];

    exportToCsv(
      `report_summary_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Report summary CSV exported successfully");
  };

  const handleExportRecentSalesCsv = () => {
    const rows = safeArray(report?.recent_sales).map((sale) => ({
      Invoice: sale.invoice_number || "N/A",
      Customer: sale.customer_name || "Walk-in Customer",
      Total: sale.total_amount || "0.00",
      Paid: sale.paid_amount || "0.00",
      Due: sale.due_amount || "0.00",
      Payment_Status: sale.payment_status || "N/A",
      Sale_Status: sale.status || "N/A",
      Created_At: sale.created_at
        ? new Date(sale.created_at).toLocaleString()
        : "N/A",
    }));

    if (rows.length === 0) {
      toast.error("No recent sales available to export");
      return;
    }

    exportToCsv(
      `recent_sales_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Recent sales CSV exported successfully");
  };

  const handleExportRecentExpensesCsv = () => {
    const rows = safeArray(report?.recent_expenses).map((expense) => ({
      Title: expense.title || "N/A",
      Category: expense.category_name || "Uncategorized",
      Amount: expense.amount || "0.00",
      Expense_Date: expense.expense_date || "N/A",
      Payment_Method: expense.payment_method || "N/A",
      Status: expense.is_active ? "ACTIVE" : "INACTIVE",
      Created_At: expense.created_at
        ? new Date(expense.created_at).toLocaleString()
        : "N/A",
    }));

    if (rows.length === 0) {
      toast.error("No recent expenses available to export");
      return;
    }

    exportToCsv(
      `recent_expenses_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Recent expenses CSV exported successfully");
  };

  const handleExportLowStockCsv = () => {
    const rows = safeArray(report?.low_stock_products).map((product) => ({
      Product: product.name || "N/A",
      SKU: product.sku || "N/A",
      Category: product.category_name || "Uncategorized",
      Stock_Quantity: product.stock_quantity || "0",
      Low_Stock_Limit: product.low_stock_limit || "0",
      Unit: product.unit || "pcs",
      Purchase_Price: product.purchase_price || "0.00",
      Selling_Price: product.selling_price || "0.00",
      Stock_Value: product.stock_value || "0.00",
    }));

    if (rows.length === 0) {
      toast.error("No low stock products available to export");
      return;
    }

    exportToCsv(
      `low_stock_products_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Low stock CSV exported successfully");
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading reports...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Reports"
      subtitle="View accurate sales, profit, expense, stock and due reports."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Business Reports
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Reports Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            Cancelled sales and inactive expenses are excluded from active
            financial totals.
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
            onClick={handleExportSummaryCsv}
            disabled={!selectedBusiness || !report}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={17} />
            Export Summary
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

          {!report ? (
            <div className="card p-8 text-center">
              <h2 className="text-xl font-black text-slate-950">
                No report data found
              </h2>
              <p className="mt-2 text-slate-600">
                Please create sales, expenses, products and customers first.
              </p>
            </div>
          ) : (
            <>
              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <ReportCard
                  icon={TrendingUp}
                  title="Today Sales"
                  value={`৳ ${money(report.today_sales)}`}
                  subtitle={`Today profit: ৳ ${money(report.today_profit)}`}
                />

                <ReportCard
                  icon={Wallet}
                  title="Today Expenses"
                  value={`৳ ${money(report.today_expenses)}`}
                  subtitle="Only active expenses counted"
                />

                <ReportCard
                  icon={BarChart3}
                  title="Monthly Sales"
                  value={`৳ ${money(report.monthly_sales)}`}
                  subtitle={`Monthly profit: ৳ ${money(report.monthly_profit)}`}
                />

                <ReportCard
                  icon={Receipt}
                  title="Monthly Expenses"
                  value={`৳ ${money(report.monthly_expenses)}`}
                  subtitle="Inactive expenses excluded"
                />
              </section>

              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <ReportCard
                  icon={FileText}
                  title="Total Sales"
                  value={`৳ ${money(report.total_sales_amount)}`}
                  subtitle={`${report.total_sales_count || 0} active invoices`}
                />

                <ReportCard
                  icon={Wallet}
                  title="Total Paid"
                  value={`৳ ${money(report.total_paid_amount)}`}
                  subtitle={`Due from sales: ৳ ${money(report.total_due_amount)}`}
                />

                <ReportCard
                  icon={TrendingUp}
                  title="Total Profit"
                  value={`৳ ${money(report.total_profit)}`}
                  subtitle="Sales profit minus active expenses"
                />

                <ReportCard
                  icon={Users}
                  title="Customer Due"
                  value={`৳ ${money(report.total_customer_due)}`}
                  subtitle={`${report.total_customers || 0} active customers`}
                />
              </section>

              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <ReportCard
                  icon={Boxes}
                  title="Products"
                  value={report.total_products || 0}
                  subtitle={`Stock value: ৳ ${money(report.total_stock_value)}`}
                />

                <ReportCard
                  icon={AlertTriangle}
                  title="Low Stock"
                  value={report.low_stock_products_count || 0}
                  subtitle="Products below low stock limit"
                />

                <ReportCard
                  icon={BanIcon}
                  title="Cancelled Sales"
                  value={report.cancelled_sales_count || 0}
                  subtitle="Excluded from active totals"
                />

                <ReportCard
                  icon={PackageSearch}
                  title="Inactive Expenses"
                  value={report.inactive_expenses_count || 0}
                  subtitle="Excluded from expense totals"
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 p-5">
                    <div>
                      <h2 className="text-xl font-black text-slate-950">
                        Recent Active Sales
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Cancelled sales are excluded.
                      </p>
                    </div>

                    <button
                      onClick={handleExportRecentSalesCsv}
                      className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-black text-green-700 hover:bg-green-200"
                    >
                      <Download size={16} />
                      CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Invoice</th>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Total</th>
                          <th className="p-4">Due</th>
                          <th className="p-4">Status</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {safeArray(report.recent_sales).length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-6 text-center text-slate-600">
                              No recent sales found.
                            </td>
                          </tr>
                        ) : (
                          safeArray(report.recent_sales).map((sale) => (
                            <tr key={sale.id} className="bg-white">
                              <td className="p-4">
                                <Link
                                  href={`/sales/${sale.id}`}
                                  className="font-black text-blue-600 hover:underline"
                                >
                                  {sale.invoice_number}
                                </Link>
                                <p className="mt-1 text-xs text-slate-500">
                                  {sale.created_at
                                    ? new Date(sale.created_at).toLocaleString()
                                    : "N/A"}
                                </p>
                              </td>

                              <td className="p-4 font-bold text-slate-700">
                                {sale.customer_name}
                              </td>

                              <td className="p-4 font-black text-slate-950">
                                ৳ {money(sale.total_amount)}
                              </td>

                              <td className="p-4 font-black text-red-600">
                                ৳ {money(sale.due_amount)}
                              </td>

                              <td className="p-4">
                                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                                  {sale.payment_status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 p-5">
                    <div>
                      <h2 className="text-xl font-black text-slate-950">
                        Recent Active Expenses
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Inactive expenses are excluded.
                      </p>
                    </div>

                    <button
                      onClick={handleExportRecentExpensesCsv}
                      className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-black text-green-700 hover:bg-green-200"
                    >
                      <Download size={16} />
                      CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Expense</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Method</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {safeArray(report.recent_expenses).length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-6 text-center text-slate-600">
                              No recent expenses found.
                            </td>
                          </tr>
                        ) : (
                          safeArray(report.recent_expenses).map((expense) => (
                            <tr key={expense.id} className="bg-white">
                              <td className="p-4">
                                <Link
                                  href={`/expenses/${expense.id}`}
                                  className="font-black text-blue-600 hover:underline"
                                >
                                  {expense.title}
                                </Link>
                              </td>

                              <td className="p-4 font-bold text-slate-700">
                                {expense.category_name}
                              </td>

                              <td className="p-4 font-black text-red-600">
                                ৳ {money(expense.amount)}
                              </td>

                              <td className="p-4 text-sm text-slate-600">
                                {expense.expense_date}
                              </td>

                              <td className="p-4 font-bold text-slate-700">
                                {expense.payment_method}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 p-5">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Low Stock Products
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Products with stock quantity lower than or equal to low
                      stock limit.
                    </p>
                  </div>

                  <button
                    onClick={handleExportLowStockCsv}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-3 py-2 text-sm font-black text-green-700 hover:bg-green-200"
                  >
                    <Download size={16} />
                    CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px] text-left">
                    <thead className="bg-slate-100 text-sm text-slate-600">
                      <tr>
                        <th className="p-4">Product</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Current Stock</th>
                        <th className="p-4">Low Limit</th>
                        <th className="p-4">Selling Price</th>
                        <th className="p-4">Stock Value</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {safeArray(report.low_stock_products).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-6 text-center text-slate-600">
                            No low stock products found.
                          </td>
                        </tr>
                      ) : (
                        safeArray(report.low_stock_products).map((product) => (
                          <tr key={product.id} className="bg-white">
                            <td className="p-4">
                              <Link
                                href={`/products/${product.id}`}
                                className="font-black text-blue-600 hover:underline"
                              >
                                {product.name}
                              </Link>
                              <p className="mt-1 text-xs text-slate-500">
                                SKU: {product.sku || "N/A"}
                              </p>
                            </td>

                            <td className="p-4 font-bold text-slate-700">
                              {product.category_name}
                            </td>

                            <td className="p-4 font-black text-red-600">
                              {product.stock_quantity} {product.unit}
                            </td>

                            <td className="p-4 font-bold text-slate-700">
                              {product.low_stock_limit}
                            </td>

                            <td className="p-4 font-bold text-green-600">
                              ৳ {money(product.selling_price)}
                            </td>

                            <td className="p-4 font-black text-slate-950">
                              ৳ {money(product.stock_value)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

function ReportCard({ icon: Icon, title, value, subtitle }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{value}</h3>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function BanIcon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

function money(value) {
  const number = Number(value || 0);

  return number.toFixed(2);
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

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading reports...
          </div>
        </main>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}