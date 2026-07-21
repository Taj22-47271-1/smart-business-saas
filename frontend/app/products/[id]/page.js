"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  Boxes,
  Loader2,
  Pencil,
  Printer,
  Save,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { FINANCE_ROLES, MANAGEMENT_ROLES, hasActiveBusinessRole } from "@/lib/roles";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qrPrintRef = useRef(null);

  const { user, loading } = useAuth();

  const productId = params.id;

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);

  const [loadingPage, setLoadingPage] = useState(true);
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManageProduct = hasActiveBusinessRole(
    user,
    product?.business,
    MANAGEMENT_ROLES
  );
  const canViewProductCosts = hasActiveBusinessRole(
    user,
    product?.business,
    FINANCE_ROLES
  );

  const [form, setForm] = useState({
    category: "",
    name: "",
    sku: "",
    barcode: "",
    description: "",
    unit: "pcs",
    size: "",
    color: "",
    purchase_price: "",
    selling_price: "",
    low_stock_limit: "",
    status: "ACTIVE",
    is_active: true,
  });

  const qrValue = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/products/${productId}`;
  }, [productId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadProduct = async () => {
    try {
      setLoadingPage(true);

      const response = await api.get(`/products/${productId}/`);
      const productData = response.data;

      setProduct(productData);

      setForm({
        category: productData.category || "",
        name: productData.name || "",
        sku: productData.sku || "",
        barcode: productData.barcode || "",
        description: productData.description || "",
        unit: productData.unit || "pcs",
        size: productData.size || "",
        color: productData.color || "",
        purchase_price: productData.purchase_price || "",
        selling_price: productData.selling_price || "",
        low_stock_limit: productData.low_stock_limit || "",
        status: productData.status || "ACTIVE",
        is_active: Boolean(productData.is_active),
      });

      if (productData.business) {
        await loadCategories(productData.business);
      }
    } catch (error) {
      toast.error("Failed to load product details");
      router.push("/products");
    } finally {
      setLoadingPage(false);
    }
  };

  const loadCategories = async (businessId) => {
    try {
      const response = await api.get(`/products/business/${businessId}/categories/`);
      setCategories(safeArray(response.data));
    } catch (error) {
      setCategories([]);
    }
  };

  useEffect(() => {
    if (user && productId) {
      loadProduct();
    }
  }, [user, productId]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (!product) {
      toast.error("Product not found");
      return;
    }

    try {
      setUpdating(true);

      const payload = {
        business_id: product.business,
        category: form.category ? Number(form.category) : null,
        name: form.name,
        sku: form.sku || null,
        barcode: form.barcode || null,
        description: form.description || null,
        unit: form.unit,
        size: form.size || "",
        color: form.color || "",
        purchase_price: form.purchase_price || "0",
        selling_price: form.selling_price || "0",
        low_stock_limit: form.low_stock_limit || "0",
        status: form.status,
        is_active: form.is_active,
      };

      const response = await api.patch(`/products/${productId}/update/`, payload);

      toast.success("Product updated successfully");

      setProduct(response.data);
      setEditing(false);

      await loadProduct();
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to update product");
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!product) {
      toast.error("Product not found");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      await api.delete(`/products/${productId}/delete/`);

      toast.success("Product deleted successfully");

      router.push(`/products?business=${product.business}`);
    } catch (error) {
      toast.error("Failed to delete product");
    } finally {
      setDeleting(false);
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
          Loading product...
        </div>
      </main>
    );
  }

  if (!user || !product) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl print:max-w-full">
        <div className="mb-6 flex flex-col gap-4 print:hidden lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/products?business=${product.business}`}
              className="mb-3 inline-flex items-center gap-2 text-sm font-black text-blue-600 hover:underline"
            >
              <ArrowLeft size={17} />
              Back to Products
            </Link>

            <h1 className="text-3xl font-black text-slate-950">
              Product Details
            </h1>

            <p className="mt-2 text-slate-600">
              View QR label, edit product information or delete product.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-black text-white hover:bg-slate-800"
            >
              <Printer size={18} />
              Print QR
            </button>

            {canManageProduct && <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-black text-white hover:bg-blue-700"
            >
              <Pencil size={18} />
              Edit
            </button>}

            {canManageProduct && <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-black text-white hover:bg-red-700 disabled:opacity-70"
            >
              {deleting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Delete
                </>
              )}
            </button>}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr] print:block">
          <section
            ref={qrPrintRef}
            className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none"
          >
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white print:hidden">
                <Boxes size={28} />
              </div>

              <h2 className="text-2xl font-black text-slate-950">
                {product.name}
              </h2>

              <p className="mt-1 text-sm font-bold text-slate-500">
                SKU: {product.sku || "N/A"}
              </p>

              <div className="mx-auto my-8 flex w-fit justify-center rounded-3xl border border-slate-200 bg-white p-5">
                <QRCodeCanvas value={qrValue} size={220} includeMargin />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                <InfoRow label="Business" value={product.business_name || "N/A"} />
                <InfoRow label="Category" value={product.category_name || "Uncategorized"} />
                <InfoRow label="Unit" value={product.unit || "pcs"} />
                <InfoRow label="Size" value={product.size || "N/A"} />
                <InfoRow label="Color" value={product.color || "N/A"} />
                <InfoRow label="Stock" value={`${product.stock_quantity} ${product.unit}`} />
                <InfoRow label="Selling Price" value={`৳ ${product.selling_price}`} />
              </div>

              <p className="mt-6 text-xs text-slate-500">
                Scan this QR to open product details.
              </p>
            </div>
          </section>

          <section className="space-y-6 print:hidden">
            <div className="card card-hover rounded-3xl p-6">
              <h2 className="mb-5 text-xl font-black text-slate-950">
                Product Information
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailCard label="Product Name" value={product.name} />
                <DetailCard label="Category" value={product.category_name || "Uncategorized"} />
                <DetailCard label="SKU" value={product.sku || "N/A"} />
                <DetailCard label="Barcode" value={product.barcode || "N/A"} />
                <DetailCard label="Unit" value={product.unit || "pcs"} />
                <DetailCard label="Size" value={product.size || "N/A"} />
                <DetailCard label="Color" value={product.color || "N/A"} />
                <DetailCard label="Current Stock" value={`${product.stock_quantity} ${product.unit}`} />
                <DetailCard label="Low Stock Limit" value={product.low_stock_limit} />
                {canViewProductCosts && <DetailCard label="Purchase Price" value={`৳ ${product.purchase_price}`} />}
                <DetailCard label="Selling Price" value={`৳ ${product.selling_price}`} />
                {canViewProductCosts && <DetailCard label="Stock Value" value={`৳ ${product.stock_value}`} />}
                {canViewProductCosts && <DetailCard label="Profit Per Unit" value={`৳ ${product.profit_per_unit}`} />}
                <DetailCard label="Status" value={product.is_active ? "ACTIVE" : "INACTIVE"} />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-700">Description</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {product.description || "No description available."}
                </p>
              </div>
            </div>

            {canManageProduct && editing && (
              <form
                onSubmit={handleUpdate}
                className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Edit Product
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Update product details.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-xl bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Product Name
                    </label>
                    <input
                      className="input"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Category
                    </label>
                    <select
                      className="input"
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      SKU
                    </label>
                    <input
                      className="input"
                      name="sku"
                      value={form.sku}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Barcode
                    </label>
                    <input
                      className="input"
                      name="barcode"
                      value={form.barcode}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Unit
                    </label>
                    <input
                      className="input"
                      name="unit"
                      value={form.unit}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Size
                    </label>
                    <input
                      className="input"
                      name="size"
                      value={form.size}
                      onChange={handleChange}
                      placeholder="S, M, L, 42, 1L"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Color
                    </label>
                    <input
                      className="input"
                      name="color"
                      value={form.color}
                      onChange={handleChange}
                      placeholder="Black, Red, Blue"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Low Stock Limit
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      name="low_stock_limit"
                      value={form.low_stock_limit}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Purchase Price
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      name="purchase_price"
                      value={form.purchase_price}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Selling Price
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      name="selling_price"
                      value={form.selling_price}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Status
                    </label>
                    <select
                      className="input"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={form.is_active}
                      onChange={handleChange}
                      className="h-5 w-5"
                    />
                    <span className="text-sm font-black text-slate-700">
                      Product is active
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Description
                  </label>
                  <textarea
                    className="input min-h-24"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                  />
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="btn-primary mt-5 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {updating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="interactive-panel rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-black text-slate-950">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-200 py-2 last:border-b-0">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-900">{value}</span>
    </div>
  );
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
