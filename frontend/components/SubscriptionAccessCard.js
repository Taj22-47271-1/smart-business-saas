import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function formatDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export default function SubscriptionAccessCard({
  subscription,
  businessId,
  showAction = true,
}) {
  const { user } = useAuth();
  const canManageSubscription = user?.business_memberships?.some(
    (membership) =>
      membership.status === "ACTIVE" &&
      membership.role === "OWNER" &&
      String(membership.business_id) === String(businessId)
  );
  const hasAccess = Boolean(subscription?.has_access);
  const status = subscription?.expiry_status || subscription?.status || "UNAVAILABLE";
  const expiresAt =
    status === "TRIAL"
      ? subscription?.trial_end_date
      : subscription?.subscription_end_date;
  const formattedExpiry = formatDate(expiresAt);
  const features = Array.isArray(subscription?.plan_features)
    ? subscription.plan_features
    : [];
  const standardFeatures = [
    subscription?.plan_max_products != null
      ? `Up to ${subscription.plan_max_products} products`
      : null,
    subscription?.plan_max_staff != null
      ? `Up to ${subscription.plan_max_staff} employees`
      : null,
    subscription?.plan_has_reports ? "Business reports" : null,
    subscription?.plan_has_pdf_invoice ? "PDF invoices" : null,
    subscription?.plan_has_online_shop ? "Online shop" : null,
  ].filter(Boolean);
  const allFeatures = [...new Set([...standardFeatures, ...features])];
  const paymentHref = businessId
    ? `/payments?business=${encodeURIComponent(businessId)}`
    : "/payments";

  if (!canManageSubscription) return null;

  return (
    <div
      className={`w-full min-w-0 rounded-2xl border p-4 sm:p-5 ${
        hasAccess
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              hasAccess
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {hasAccess ? <CheckCircle2 size={21} /> : <XCircle size={21} />}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`font-black ${
                hasAccess ? "text-green-900" : "text-red-900"
              }`}
            >
              {hasAccess ? "Subscription access enabled" : "Subscription access required"}
            </p>

            <p className="mt-1 break-words text-sm text-slate-700">
              Status: <span className="font-bold">{status}</span>
            </p>

            {subscription?.plan_name && (
              <p className="mt-1 flex items-center gap-1.5 break-words text-sm text-slate-700">
                <PackageCheck size={15} className="shrink-0" />
                Package: <span className="font-black">{subscription.plan_name}</span>
                {subscription.plan_price != null && (
                  <span>— ৳ {Number(subscription.plan_price).toFixed(2)}</span>
                )}
              </p>
            )}

            {formattedExpiry && (
              <p className="mt-1 flex min-w-0 items-start gap-1.5 text-sm text-slate-600">
                <Clock3 size={15} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">
                  {status === "TRIAL" ? "Trial ends" : "Access ends"}: {formattedExpiry}
                </span>
              </p>
            )}
          </div>
        </div>

        {showAction && canManageSubscription && (
          <Link
            href={paymentHref}
            className={`inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-black text-white sm:w-auto ${
              hasAccess
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            <CreditCard size={18} />
            {subscription?.plan ? "Renew / Change Package" : "Choose Package"}
          </Link>
        )}
      </div>

      {allFeatures.length > 0 && (
        <div className="mt-4 border-t border-current/10 pt-4">
          <p className="text-sm font-black text-slate-800">Package benefits</p>
          <ul className="mt-2 grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
            {allFeatures.map((feature) => (
              <li key={feature} className="flex min-w-0 items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-green-600" />
                <span className="break-words">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
