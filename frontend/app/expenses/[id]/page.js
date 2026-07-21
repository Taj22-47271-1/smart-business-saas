"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ExpenseVoucherPage() {
  const router = useRouter();
  const params = useParams();
  const expenseId = params.id;

  const { user, loading } = useAuth();

  const [expense, setExpense] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadExpense = async () => {
    if (!expenseId) return;

    try {
      setLoadingPage(true);

      const response = await api.get(`/expenses/${expenseId}/`);
      setExpense(response.data);
    } catch (error) {
      toast.error("Failed to load expense voucher");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (user && expenseId) {
      loadExpense();
    }
  }, [user, expenseId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading expense voucher...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!expense) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">
            Voucher not found
          </h1>

          <p className="mt-2 text-slate-600">
            The requested expense voucher could not be loaded.
          </p>

          <Link href="/expenses" className="btn-primary mt-5 inline-flex">
            Back to Expenses
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
            href="/expenses"
            className="inline-flex items-center gap-2 font-bold text-slate-700 hover:text-blue-600"
          >
            <ArrowLeft size={18} />
            Back to Expenses
          </Link>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadExpense}
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
              Print Voucher
            </button>
          </div>
        </div>

        <section className="bg-white p-8 shadow-sm print:shadow-none md:p-10">
          <div className="mb-10 flex flex-col gap-6 border-b border-slate-200 pb-8 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-white print:bg-slate-900">
                <ReceiptText size={28} />
              </div>

              <h1 className="text-3xl font-black text-slate-950">
                Smart Business
              </h1>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Expense voucher generated from Smart Business SaaS.
              </p>
            </div>

            <div className="text-left md:text-right">
              <p className="text-sm font-bold uppercase tracking-wide text-red-600 print:text-slate-600">
                Expense Voucher
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Voucher #{expense.id}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Expense Date:{" "}
                <span className="font-bold">
                  {expense.expense_date || "N/A"}
                </span>
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Created At:{" "}
                <span className="font-bold">
                  {expense.created_at
                    ? new Date(expense.created_at).toLocaleString()
                    : "N/A"}
                </span>
              </p>
            </div>
          </div>

          <div className="mb-10 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-red-700">
              Expense Amount
            </p>

            <h2 className="mt-2 text-4xl font-black text-slate-950">
              ৳ {expense.amount}
            </h2>
          </div>

          <div className="mb-10 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-200">
                <VoucherRow label="Title" value={expense.title || "N/A"} />

                <VoucherRow
                  label="Category"
                  value={expense.category_name || "Uncategorized"}
                />

                <VoucherRow
                  label="Payment Method"
                  value={expense.payment_method || "N/A"}
                />

                <VoucherRow
                  label="Business"
                  value={expense.business_name || "Business"}
                />

                <VoucherRow
                  label="Created By"
                  value={expense.created_by_email || user.email || "N/A"}
                />

                <VoucherRow label="Note" value={expense.note || "No note"} />
              </tbody>
            </table>
          </div>

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            <div>
              <div className="h-16 border-b border-slate-300"></div>
              <p className="mt-3 text-center text-sm font-bold text-slate-600">
                Received By
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
            <p>This is a system generated expense voucher.</p>
            <p className="mt-1">Generated by Smart Business SaaS</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function VoucherRow({ label, value }) {
  return (
    <tr>
      <td className="w-1/3 bg-slate-50 p-4 text-sm font-black text-slate-600">
        {label}
      </td>

      <td className="p-4 font-bold text-slate-950">{value}</td>
    </tr>
  );
}