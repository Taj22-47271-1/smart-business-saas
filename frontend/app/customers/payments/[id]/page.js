"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function CustomerPaymentReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const paymentId = params.id;

  const { user, loading } = useAuth();

  const [payment, setPayment] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadPayment = async () => {
    if (!paymentId) return;

    try {
      setLoadingPage(true);

      const response = await api.get(`/customers/payments/${paymentId}/`);
      setPayment(response.data);
    } catch (error) {
      toast.error("Failed to load customer payment receipt");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (user && paymentId) {
      loadPayment();
    }
  }, [user, paymentId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading payment receipt...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!payment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">
            Receipt not found
          </h1>

          <p className="mt-2 text-slate-600">
            The requested customer payment receipt could not be loaded.
          </p>

          <Link href="/customers" className="btn-primary mt-5 inline-flex">
            Back to Customers
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 font-bold text-slate-700 hover:text-blue-600"
          >
            <ArrowLeft size={18} />
            Back to Customers
          </Link>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadPayment}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={17} />
              Refresh
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-black text-white hover:bg-blue-700"
            >
              <Printer size={18} />
              Print Receipt
            </button>
          </div>
        </div>

        <section className="bg-white p-8 shadow-sm print:shadow-none md:p-10">
          <div className="mb-10 flex flex-col gap-6 border-b border-slate-200 pb-8 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-white print:bg-slate-900">
                <ReceiptText size={28} />
              </div>

              <h1 className="text-3xl font-black text-slate-950">
                Smart Business
              </h1>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Customer payment receipt generated from Smart Business SaaS.
              </p>
            </div>

            <div className="text-left md:text-right">
              <p className="text-sm font-bold uppercase tracking-wide text-green-600 print:text-slate-600">
                Payment Receipt
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Receipt #{payment.id}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Date:{" "}
                <span className="font-bold">
                  {payment.created_at
                    ? new Date(payment.created_at).toLocaleString()
                    : "N/A"}
                </span>
              </p>
            </div>
          </div>

          <div className="mb-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                Customer
              </p>

              <h3 className="mt-3 text-xl font-black text-slate-950">
                {payment.customer_name || "Customer"}
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                This payment was received from the selected customer.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                Business
              </p>

              <h3 className="mt-3 text-xl font-black text-slate-950">
                {payment.business_name || "Business"}
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Receipt created by:{" "}
                <span className="font-bold">
                  {payment.created_by_email || user.email || "N/A"}
                </span>
              </p>
            </div>
          </div>

          <div className="mb-10 rounded-3xl border border-green-200 bg-green-50 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600 text-white">
                <CreditCard size={24} />
              </div>

              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-green-700">
                  Received Amount
                </p>

                <h2 className="mt-1 text-4xl font-black text-slate-950">
                  ৳ {payment.amount}
                </h2>
              </div>
            </div>
          </div>

          <div className="mb-10 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-200">
                <ReceiptRow
                  label="Payment Method"
                  value={payment.payment_method || "N/A"}
                />

                <ReceiptRow
                  label="Payment Note"
                  value={payment.note || "No note"}
                />

                <ReceiptRow
                  label="Created At"
                  value={
                    payment.created_at
                      ? new Date(payment.created_at).toLocaleString()
                      : "N/A"
                  }
                />
              </tbody>
            </table>
          </div>

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            <div>
              <div className="h-16 border-b border-slate-300"></div>
              <p className="mt-3 text-center text-sm font-bold text-slate-600">
                Customer Signature
              </p>
            </div>

            <div>
              <div className="h-16 border-b border-slate-300"></div>
              <p className="mt-3 text-center text-sm font-bold text-slate-600">
                Authorized Signature
              </p>
            </div>
          </div>

          <div className="mt-12 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
            <p>Thank you for your payment.</p>
            <p className="mt-1">Generated by Smart Business SaaS</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReceiptRow({ label, value }) {
  return (
    <tr>
      <td className="w-1/3 bg-slate-50 p-4 text-sm font-black text-slate-600">
        {label}
      </td>

      <td className="p-4 font-bold text-slate-950">{value}</td>
    </tr>
  );
}