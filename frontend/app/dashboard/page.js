"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  FileText,
  Loader2,
  PackageSearch,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SubscriptionAccessCard from "@/components/SubscriptionAccessCard";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
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

  const loadDashboard = async () => {
    try {
      setLoadingPage(true);

      const businessResponse = await api.get("/businesses/my-businesses/");
      const businessList = safeArray(businessResponse.data);

      setBusinesses(businessList);

      const activeBusinessId = selectedBusinessId || businessList[0]?.id || "";

      if (activeBusinessId) {
        setSelectedBusinessId(String(activeBusinessId));

        await Promise.all([
          loadReport(activeBusinessId),
          loadSubscription(activeBusinessId),
        ]);
      }
    } catch (error) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const initializeDashboard = async () => {
      try {
        const businessResponse = await api.get("/businesses/my-businesses/");
        const businessList = safeArray(businessResponse.data);

        if (cancelled) return;

        const activeBusinessId = businessList[0]?.id || "";
        let nextReport = null;
        let nextSubscription = null;

        if (activeBusinessId) {
          const [reportResponse, subscriptionResponse] = await Promise.all([
            api.get(`/reports/business/${activeBusinessId}/dashboard/`),
            api
              .get(`/subscriptions/business/${activeBusinessId}/`)
              .catch(() => null),
          ]);

          if (cancelled) return;

          nextReport = reportResponse.data;
          nextSubscription = subscriptionResponse?.data || null;
        }

        setBusinesses(businessList);
        setSelectedBusinessId(String(activeBusinessId));
        setReport(nextReport);
        setSubscription(nextSubscription);
      } catch (error) {
        if (!cancelled) {
          toast.error("Failed to load dashboard");
        }
      } finally {
        if (!cancelled) {
          setLoadingPage(false);
        }
      }
    };

    initializeDashboard();

    return () => {
      cancelled = true;
    };
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
      toast.error("Failed to switch business");
    } finally {
      setLoadingPage(false);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading dashboard...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Business overview, sales, profit, stock and due summary."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Welcome Back
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {user?.full_name || user?.email || "Dashboard"}
          </h1>

          <p className="mt-2 text-slate-600">
            Monitor your business performance with accurate active sales,
            expense and stock data.
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
            onClick={loadDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </div>

      {!selectedBusiness ? (
        <div className="card p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-100 text-blue-700">
            <Building2 size={32} />
          </div>

          <h2 className="mt-5 text-xl font-black text-slate-950">
            No business found
          </h2>

          <p className="mt-2 text-slate-600">
            Create your first business to start using the system.
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
                No dashboard data found
              </h2>

              <p className="mt-2 text-slate-600">
                Add products, sales, customers and expenses to see dashboard
                summary.
              </p>
            </div>
          ) : (
            <>
              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <DashboardCard
                  icon={TrendingUp}
                  title="Today Sales"
                  value={`৳ ${money(report.today_sales)}`}
                  subtitle={`Today profit: ৳ ${money(report.today_profit)}`}
                />

                <DashboardCard
                  icon={Wallet}
                  title="Today Expenses"
                  value={`৳ ${money(report.today_expenses)}`}
                  subtitle="Only active expenses counted"
                />

                <DashboardCard
                  icon={BarChart3}
                  title="Monthly Sales"
                  value={`৳ ${money(report.monthly_sales)}`}
                  subtitle={`Monthly profit: ৳ ${money(report.monthly_profit)}`}
                />

                <DashboardCard
                  icon={Receipt}
                  title="Monthly Expenses"
                  value={`৳ ${money(report.monthly_expenses)}`}
                  subtitle="Inactive expenses excluded"
                />
              </section>

              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <DashboardCard
                  icon={FileText}
                  title="Total Sales"
                  value={`৳ ${money(report.total_sales_amount)}`}
                  subtitle={`${report.total_sales_count || 0} active invoices`}
                />

                <DashboardCard
                  icon={Wallet}
                  title="Total Paid"
                  value={`৳ ${money(report.total_paid_amount)}`}
                  subtitle={`Sales due: ৳ ${money(report.total_due_amount)}`}
                />

                <DashboardCard
                  icon={TrendingUp}
                  title="Total Profit"
                  value={`৳ ${money(report.total_profit)}`}
                  subtitle="Profit after active expenses"
                />

                <DashboardCard
                  icon={Users}
                  title="Customer Due"
                  value={`৳ ${money(report.total_customer_due)}`}
                  subtitle={`${report.total_customers || 0} active customers`}
                />
              </section>

              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <DashboardCard
                  icon={Boxes}
                  title="Products"
                  value={report.total_products || 0}
                  subtitle={`Stock value: ৳ ${money(report.total_stock_value)}`}
                />

                <DashboardCard
                  icon={AlertTriangle}
                  title="Low Stock"
                  value={report.low_stock_products_count || 0}
                  subtitle="Need attention"
                />

                <DashboardCard
                  icon={PackageSearch}
                  title="Cancelled Sales"
                  value={report.cancelled_sales_count || 0}
                  subtitle="Excluded from totals"
                />

                <DashboardCard
                  icon={PackageSearch}
                  title="Inactive Expenses"
                  value={report.inactive_expenses_count || 0}
                  subtitle="Excluded from totals"
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-3">
                <QuickActionCard
                  title="Create Sale"
                  description="Create a new invoice and reduce stock automatically."
                  href={`/sales?business=${selectedBusinessId}`}
                  icon={ShoppingCart}
                />

                <QuickActionCard
                  title="Add Product"
                  description="Create products, categories and QR labels."
                  href={`/products?business=${selectedBusinessId}`}
                  icon={Boxes}
                />

                <QuickActionCard
                  title="Receive Payment"
                  description="Receive customer due payments and print receipt."
                  href={`/customers?business=${selectedBusinessId}`}
                  icon={Wallet}
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

                    <Link
                      href={`/sales?business=${selectedBusinessId}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                    >
                      View All
                      <ArrowRight size={16} />
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
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
                            <td
                              colSpan="5"
                              className="p-6 text-center text-slate-600"
                            >
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

                    <Link
                      href={`/expenses?business=${selectedBusinessId}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                    >
                      View All
                      <ArrowRight size={16} />
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Expense</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Date</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {safeArray(report.recent_expenses).length === 0 ? (
                          <tr>
                            <td
                              colSpan="4"
                              className="p-6 text-center text-slate-600"
                            >
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

                  <Link
                    href={`/products?business=${selectedBusinessId}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                  >
                    View Products
                    <ArrowRight size={16} />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left">
                    <thead className="bg-slate-100 text-sm text-slate-600">
                      <tr>
                        <th className="p-4">Product</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Current Stock</th>
                        <th className="p-4">Low Limit</th>
                        <th className="p-4">Stock Value</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {safeArray(report.low_stock_products).length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="p-6 text-center text-slate-600"
                          >
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

function DashboardCard({ icon: Icon, title, value, subtitle }) {
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

function QuickActionCard({ title, description, href, icon: Icon }) {
  return (
    <Link href={href} className="card block p-5 hover:border-blue-300">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <Icon size={24} />
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
      </div>
    </Link>
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
