"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Loader2,
  Plus,
  RefreshCw,
  Store,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";

export default function BusinessPage() {
  const router = useRouter();
  const { user, loading, loadUser } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    phone: "",
    email: "",
    address: "",
    currency: "BDT",
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadBusinesses = async () => {
    try {
      setLoadingBusinesses(true);
      const response = await api.get("/businesses/my-businesses/");
      setBusinesses(response.data || []);
    } catch (error) {
      toast.error("Failed to load businesses");
    } finally {
      setLoadingBusinesses(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadBusinesses();
    }
  }, [user]);

  const createSlug = (value) => {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => {
      const updated = {
        ...previous,
        [name]: value,
      };

      if (name === "name") {
        updated.slug = createSlug(value);
      }

      return updated;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);

      await api.post("/businesses/create/", formData);

      toast.success("Business created successfully. Free trial started.");

      setFormData({
        name: "",
        slug: "",
        phone: "",
        email: "",
        address: "",
        currency: "BDT",
      });

      // The new OWNER membership is part of the authenticated profile.
      // Refresh it immediately so sidebar links and route guards work without
      // requiring a manual browser refresh or another login.
      await loadUser();
      await loadBusinesses();
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to create business");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingBusinesses) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading business...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Business Setup"
      subtitle="Create and manage your business/shop profile."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Business Setup
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Your businesses
          </h1>
          <p className="mt-2 text-slate-600">
            Create your shop/business profile. A 5 days free trial will start
            automatically.
          </p>
        </div>

        <button
          onClick={loadBusinesses}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          {businesses.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Store size={28} />
              </div>
              <h2 className="text-xl font-black text-slate-950">
                No business created yet
              </h2>
              <p className="mt-2 text-slate-600">
                Create your first business to start using products, stock,
                sales and reports.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {businesses.map((business) => (
                <div key={business.id} className="card p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                        {business.subscription_status || "NO SUBSCRIPTION"}
                      </div>

                      <h2 className="text-2xl font-black text-slate-950">
                        {business.name}
                      </h2>

                      <p className="mt-2 text-sm text-slate-600">
                        Slug: <span className="font-bold">{business.slug}</span>
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Trial ends:{" "}
                        <span className="font-bold">
                          {business.trial_end_date
                            ? new Date(business.trial_end_date).toLocaleString()
                            : "N/A"}
                        </span>
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Access:{" "}
                        <span
                          className={
                            business.has_access
                              ? "font-black text-green-600"
                              : "font-black text-red-600"
                          }
                        >
                          {business.has_access ? "Allowed" : "Blocked"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/products?business=${business.id}`}
                        className="btn-secondary"
                      >
                        Products
                      </Link>
                      <Link
                        href={`/payments?business=${business.id}`}
                        className="btn-primary"
                      >
                        Payment
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="card h-fit p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Create Business
              </h2>
              <p className="text-sm text-slate-600">5 days free trial</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Business Name
              </label>
              <input
                className="input"
                type="text"
                name="name"
                placeholder="Example: Nahar IT World"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Business Slug
              </label>
              <input
                className="input"
                type="text"
                name="slug"
                placeholder="nahar-it-world"
                value={formData.slug}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Phone
              </label>
              <input
                className="input"
                type="text"
                name="phone"
                placeholder="01XXXXXXXXX"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Email
              </label>
              <input
                className="input"
                type="email"
                name="email"
                placeholder="business@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Address
              </label>
              <textarea
                className="input min-h-24"
                name="address"
                placeholder="Business address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Create Business
                </>
              )}
            </button>
          </form>
        </aside>
      </div>
    </DashboardLayout>
  );
}