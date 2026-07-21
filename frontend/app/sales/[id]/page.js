"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CreditCard,
  History,
  Loader2,
  Printer,
  Receipt,
  ShoppingCart,
  UserRound,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function SaleInvoicePage() {
  const params = useParams();
  const router = useRouter();

  const { user, loading } = useAuth();

  const saleId = params.id;

  const [sale, setSale] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "Cash",
    note: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadSale = async () => {
    try {
      setLoadingPage(true);

      const response = await api.get(`/sales/${saleId}/`);
      setSale(response.data);
    } catch (error) {
      toast.error("Failed to load invoice");
      router.push("/sales");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (user && saleId) {
      loadSale();
    }
  }, [user, saleId]);

  useEffect(() => {
    if (loadingPage || typeof window === "undefined") return;
    if (window.location.hash !== "#receive-payment") return;

    const timer = window.setTimeout(() => {
      document.getElementById("receive-payment")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [loadingPage, sale?.due_amount]);

  const handlePaymentChange = (event) => {
    const { name, value } = event.target;
    setPaymentForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleReceivePayment = async (event) => {
    event.preventDefault();

    const amount = Number(paymentForm.amount || 0);
    const due = Number(sale?.due_amount || 0);

    if (amount <= 0) {
      toast.error("Enter a payment amount greater than zero");
      return;
    }

    if (amount > due) {
      toast.error(`Payment cannot exceed remaining due of ৳ ${due.toFixed(2)}`);
      return;
    }

    try {
      setSubmittingPayment(true);
      await api.post(`/sales/business/${sale.business}/${sale.id}/payments/`, {
        amount: paymentForm.amount,
        payment_method: paymentForm.payment_method,
        note: paymentForm.note || null,
      });

      toast.success("Due payment received and invoice status updated");
      setPaymentForm({ amount: "", payment_method: "Cash", note: "" });
      await loadSale();
    } catch (error) {
      showApiError(error, "Failed to receive due payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading invoice...
        </div>
      </main>
    );
  }

  if (!user || !sale) {
    return null;
  }

  const isCancelled = sale.status === "CANCELLED";

  return (
    <main className="min-h-screen bg-slate-50 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl print:max-w-full">
        <div className="mb-6 flex flex-col gap-4 print:hidden lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/sales?business=${sale.business}`}
              className="mb-3 inline-flex items-center gap-2 text-sm font-black text-blue-600 hover:underline"
            >
              <ArrowLeft size={17} />
              Back to Sales
            </Link>

            <h1 className="text-3xl font-black text-slate-950">
              Sale Invoice
            </h1>

            <p className="mt-2 text-slate-600">
              View, print or save this invoice as PDF.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/sales?business=${sale.business}#create-sale`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-700"
            >
              <ShoppingCart size={18} />
              Create Another Sale
            </Link>

            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-800"
            >
              <Printer size={18} />
              Print / Save PDF
            </button>
          </div>
        </div>

        {!isCancelled && Number(sale.due_amount || 0) > 0 && (
          <section
            id="receive-payment"
            className="card card-hover mb-6 scroll-mt-24 p-6 print:hidden"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <Wallet size={23} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Receive Due Payment</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Reopen this invoice anytime, add a partial or full payment, and the status will update automatically.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                      Remaining Due: ৳ {money(sale.due_amount)}
                    </span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                      Current Status: {sale.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleReceivePayment} className="grid w-full gap-3 lg:max-w-xl sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">Amount</label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    max={sale.due_amount}
                    step="0.01"
                    name="amount"
                    value={paymentForm.amount}
                    onChange={handlePaymentChange}
                    placeholder={`Maximum ৳ ${money(sale.due_amount)}`}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">Method</label>
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
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-black text-slate-700">Note</label>
                  <input
                    className="input"
                    name="note"
                    value={paymentForm.note}
                    onChange={handlePaymentChange}
                    placeholder="Optional payment note or transaction ID"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="btn-primary flex items-center justify-center gap-2 sm:col-span-2 disabled:opacity-70"
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Receiving...
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} />
                      Add Payment
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>
        )}

        {!isCancelled && Number(sale.due_amount || 0) === 0 && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700 print:hidden">
            <CreditCard size={22} />
            <p className="font-black">This invoice is fully paid. Payment status: PAID.</p>
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
          {isCancelled && (
            <div className="mb-6 rounded-2xl border-2 border-red-300 bg-red-50 p-5 text-red-700 print:border-red-700">
              <div className="flex items-start gap-3">
                <Ban size={28} className="shrink-0" />

                <div>
                  <h2 className="text-xl font-black">CANCELLED INVOICE</h2>

                  <p className="mt-2 text-sm font-semibold leading-6">
                    This sale has been cancelled. Product stock and customer due
                    were adjusted by the system.
                  </p>

                  {sale.cancel_reason && (
                    <p className="mt-2 text-sm">
                      <span className="font-black">Reason:</span>{" "}
                      {sale.cancel_reason}
                    </p>
                  )}

                  <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                    <p>
                      <span className="font-black">Cancelled By:</span>{" "}
                      {sale.cancelled_by_email || "N/A"}
                    </p>

                    <p>
                      <span className="font-black">Cancelled At:</span>{" "}
                      {sale.cancelled_at
                        ? new Date(sale.cancelled_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white print:bg-slate-900">
                <Receipt size={30} />
              </div>

              <h2 className="text-3xl font-black text-slate-950">
                INVOICE
              </h2>

              <p className="mt-2 text-lg font-black text-blue-600">
                {sale.invoice_number}
              </p>

              <span
                className={
                  isCancelled
                    ? "mt-3 inline-flex rounded-full bg-red-100 px-4 py-2 text-xs font-black text-red-700"
                    : "mt-3 inline-flex rounded-full bg-green-100 px-4 py-2 text-xs font-black text-green-700"
                }
              >
                {isCancelled ? "CANCELLED" : "ACTIVE"}
              </span>
            </div>

            <div className="grid gap-4 text-sm md:grid-cols-2 lg:w-[520px]">
              <InfoBox
                icon={Building2}
                label="Business"
                value={sale.business_name || "N/A"}
              />

              <InfoBox
                icon={UserRound}
                label="Customer"
                value={sale.customer_name || "Walk-in Customer"}
                subValue={sale.customer_phone || ""}
              />

              <InfoBox
                icon={CalendarDays}
                label="Invoice Date"
                value={
                  sale.created_at
                    ? new Date(sale.created_at).toLocaleString()
                    : "N/A"
                }
              />

              <InfoBox
                icon={Receipt}
                label="Payment"
                value={sale.payment_status || "N/A"}
                subValue={sale.payment_method || ""}
              />
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-100 text-sm text-slate-600">
                <tr>
                  <th className="p-4">#</th>
                  <th className="p-4">Product</th>
                  <th className="p-4">Qty</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Line Total</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {safeArray(sale.items).map((item, index) => (
                  <tr key={item.id} className="bg-white">
                    <td className="p-4 font-bold text-slate-600">
                      {index + 1}
                    </td>

                    <td className="p-4">
                      <p className="font-black text-slate-950">
                        {item.product_name}
                      </p>
                      {(item.product_size || item.product_color) && (
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Size: {item.product_size || "N/A"} · Color: {item.product_color || "N/A"}
                        </p>
                      )}
                    </td>

                    <td className="p-4 font-bold text-slate-700">
                      {item.quantity}
                    </td>

                    <td className="p-4 font-bold text-slate-700">
                      ৳ {money(item.selling_price)}
                    </td>

                    <td className="p-4 font-black text-slate-950">
                      ৳ {money(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-black text-slate-700">Note</p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {sale.note || "No note available."}
              </p>

              <p className="mt-5 text-sm font-black text-slate-700">
                Sold By
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {sale.sold_by_email || "N/A"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <SummaryRow label="Subtotal" value={`৳ ${money(sale.subtotal)}`} />
              <SummaryRow label="Discount" value={`৳ ${money(sale.discount)}`} />
              {sale.voucher_code && <SummaryRow label="Voucher" value={sale.voucher_code} />}
              <SummaryRow label="Tax" value={`৳ ${money(sale.tax)}`} />
              <SummaryRow
                label="Total"
                value={`৳ ${money(sale.total_amount)}`}
                strong
              />
              <SummaryRow label="Paid" value={`৳ ${money(sale.paid_amount)}`} />
              <SummaryRow label="Due" value={`৳ ${money(sale.due_amount)}`} due />
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
            <p>
              This invoice was generated by Smart Business SaaS. Please keep it
              for your records.
            </p>
          </div>
        </section>

        <section className="card mt-6 p-6 print:hidden">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <History size={21} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Additional Payment History</h2>
              <p className="text-sm text-slate-600">
                Payments received after the invoice was created.
              </p>
            </div>
          </div>

          {safeArray(sale.payment_history).length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">
              No later payments have been added yet.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="text-left">
                <thead className="bg-slate-100 text-sm text-slate-600">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Received By</th>
                    <th className="p-4">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {safeArray(sale.payment_history).map((payment) => (
                    <tr key={payment.id} className="product-table-row">
                      <td className="p-4 text-sm font-bold text-slate-700">
                        {payment.created_at ? new Date(payment.created_at).toLocaleString() : "N/A"}
                      </td>
                      <td className="p-4 font-black text-green-600">৳ {money(payment.amount)}</td>
                      <td className="p-4 font-bold text-slate-700">{payment.payment_method}</td>
                      <td className="p-4 text-sm text-slate-600">{payment.received_by_email || "N/A"}</td>
                      <td className="p-4 text-sm text-slate-600">{payment.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoBox({ icon: Icon, label, value, subValue }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        <Icon size={17} />
        <span className="text-xs font-black uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="font-black text-slate-950">{value}</p>

      {subValue && <p className="mt-1 text-xs text-slate-500">{subValue}</p>}
    </div>
  );
}

function SummaryRow({ label, value, strong = false, due = false }) {
  return (
    <div className="flex justify-between border-b border-slate-200 py-3 last:border-b-0">
      <span className="font-bold text-slate-600">{label}</span>

      <span
        className={
          due
            ? "font-black text-red-600"
            : strong
              ? "text-lg font-black text-slate-950"
              : "font-black text-slate-950"
        }
      >
        {value}
      </span>
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
