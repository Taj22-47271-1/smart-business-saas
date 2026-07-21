"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Boxes,
  Download,
  Filter,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SubscriptionAccessCard from "@/components/SubscriptionAccessCard";
import { exportToCsv, formatDateForFilename } from "@/lib/exportCsv";
import { FINANCE_ROLES, MANAGEMENT_ROLES, hasActiveBusinessRole } from "@/lib/roles";

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessFromUrl = searchParams.get("business");

  const { user, loading } = useAuth();

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    businessFromUrl || ""
  );

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    category: "ALL",
    stock_status: "ALL",
    active_status: "ALL",
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });

  const [editCategoryForm, setEditCategoryForm] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const [productForm, setProductForm] = useState({
    category: "",
    name: "",
    sku: "",
    description: "",
    unit: "pcs",
    size: "",
    color: "",
    purchase_price: "",
    selling_price: "",
    initial_stock: "",
    low_stock_limit: "5",
  });

  const selectedBusiness = useMemo(() => {
    return businesses.find(
      (business) => String(business.id) === String(selectedBusinessId)
    );
  }, [businesses, selectedBusinessId]);

  const canViewProductCosts = hasActiveBusinessRole(
    user,
    selectedBusinessId,
    FINANCE_ROLES
  );
  const canManageProducts = hasActiveBusinessRole(
    user,
    selectedBusinessId,
    MANAGEMENT_ROLES
  );

  const filteredProducts = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    return products.filter((product) => {
      const productName = String(product.name || "").toLowerCase();
      const productSku = String(product.sku || "").toLowerCase();
      const categoryName = String(product.category_name || "").toLowerCase();
      const productSize = String(product.size || "").toLowerCase();
      const productColor = String(product.color || "").toLowerCase();

      const matchesSearch =
        !searchValue ||
        productName.includes(searchValue) ||
        productSku.includes(searchValue) ||
        categoryName.includes(searchValue) ||
        productSize.includes(searchValue) ||
        productColor.includes(searchValue);

      const matchesCategory =
        filters.category === "ALL" ||
        String(product.category) === String(filters.category) ||
        String(product.category_id) === String(filters.category);

      const isLowStock =
        Number(product.stock_quantity || 0) <=
        Number(product.low_stock_limit || 0);

      const matchesStockStatus =
        filters.stock_status === "ALL" ||
        (filters.stock_status === "LOW_STOCK" && isLowStock) ||
        (filters.stock_status === "IN_STOCK" && !isLowStock);

      const matchesActiveStatus =
        filters.active_status === "ALL" ||
        (filters.active_status === "ACTIVE" && product.is_active) ||
        (filters.active_status === "INACTIVE" && !product.is_active);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStockStatus &&
        matchesActiveStatus
      );
    });
  }, [products, filters]);

  const lowStockCount = products.filter((product) => {
    return (
      Number(product.stock_quantity || 0) <=
      Number(product.low_stock_limit || 0)
    );
  }).length;

  const filteredStockValue = filteredProducts.reduce((sum, product) => {
    return sum + Number(product.stock_value || 0);
  }, 0);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadCategories = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(
      `/products/business/${businessId}/categories/`
    );

    setCategories(safeArray(response.data));
  };

  const loadProducts = async (businessId) => {
    if (!businessId) return;

    const response = await api.get(`/products/business/${businessId}/`);
    setProducts(safeArray(response.data));
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
          loadCategories(activeBusinessId),
          loadProducts(activeBusinessId),
          loadSubscription(activeBusinessId),
        ]);
      }
    } catch (error) {
      toast.error("Failed to load products page");
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
      setCategories([]);
      setProducts([]);
      setSubscription(null);
      return;
    }

    try {
      setLoadingPage(true);

      await Promise.all([
        loadCategories(businessId),
        loadProducts(businessId),
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
      category: "ALL",
      stock_status: "ALL",
      active_status: "ALL",
    });
  };

  const handleExportCsv = () => {
    if (!selectedBusiness) {
      toast.error("Please select a business first");
      return;
    }

    if (filteredProducts.length === 0) {
      toast.error("No products available to export");
      return;
    }

    const rows = filteredProducts.map((product) => ({
      Name: product.name || "N/A",
      SKU: product.sku || "N/A",
      Category: product.category_name || "Uncategorized",
      Unit: product.unit || "pcs",
      Size: product.size || "N/A",
      Color: product.color || "N/A",
      Stock_Quantity: product.stock_quantity || "0",
      Low_Stock_Limit: product.low_stock_limit || "0",
      Selling_Price: product.selling_price || "0.00",
      ...(canViewProductCosts
        ? {
            Purchase_Price: product.purchase_price || "0.00",
            Stock_Value: product.stock_value || "0.00",
          }
        : {}),
      Status: product.is_active ? "ACTIVE" : "INACTIVE",
      Description: product.description || "",
      Created_At: product.created_at
        ? new Date(product.created_at).toLocaleString()
        : "N/A",
    }));

    exportToCsv(
      `products_${selectedBusiness.name}_${formatDateForFilename()}.csv`,
      rows
    );

    toast.success("Products CSV exported successfully");
  };

  const handleCategoryChange = (event) => {
    const { name, value } = event.target;

    setCategoryForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleEditCategoryChange = (event) => {
    const { name, value, type, checked } = event.target;

    setEditCategoryForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const startEditCategory = (category) => {
    setEditingCategoryId(category.id);

    setEditCategoryForm({
      name: category.name || "",
      description: category.description || "",
      is_active: Boolean(category.is_active),
    });
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);

    setEditCategoryForm({
      name: "",
      description: "",
      is_active: true,
    });
  };

  const handleCategoryUpdate = async (categoryId) => {
    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to update category");
      return;
    }

    try {
      setUpdatingCategory(true);

      await api.patch(`/products/categories/${categoryId}/update/`, {
        business_id: Number(selectedBusinessId),
        name: editCategoryForm.name,
        description: editCategoryForm.description || null,
        is_active: editCategoryForm.is_active,
      });

      toast.success("Category updated successfully");

      cancelEditCategory();

      await Promise.all([
        loadCategories(selectedBusinessId),
        loadProducts(selectedBusinessId),
      ]);
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to update category");
      }
    } finally {
      setUpdatingCategory(false);
    }
  };

  const handleCategoryDelete = async (category) => {
    if (!subscription?.has_access) {
      toast.error("Subscription access is required to delete category");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"? Products under this category will become Uncategorized.`
    );

    if (!confirmed) return;

    try {
      setDeletingCategoryId(category.id);

      await api.delete(`/products/categories/${category.id}/delete/`);

      toast.success("Category deleted successfully");

      if (filters.category === String(category.id)) {
        setFilters((previous) => ({
          ...previous,
          category: "ALL",
        }));
      }

      await Promise.all([
        loadCategories(selectedBusinessId),
        loadProducts(selectedBusinessId),
      ]);
    } catch (error) {
      toast.error("Failed to delete category");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleProductChange = (event) => {
    const { name, value } = event.target;

    setProductForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to add product categories");
      return;
    }

    try {
      setSubmittingCategory(true);

      await api.post("/products/categories/create/", {
        business_id: Number(selectedBusinessId),
        name: categoryForm.name,
        description: categoryForm.description || null,
        is_active: true,
      });

      toast.success("Product category created successfully");

      setCategoryForm({
        name: "",
        description: "",
      });

      await loadCategories(selectedBusinessId);
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to create product category");
      }
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }

    if (!subscription?.has_access) {
      toast.error("Subscription access is required to add products");
      return;
    }

    try {
      setSubmittingProduct(true);

      await api.post("/products/create/", {
        business_id: Number(selectedBusinessId),
        category: productForm.category ? Number(productForm.category) : null,
        name: productForm.name,
        sku: productForm.sku || null,
        description: productForm.description || null,
        unit: productForm.unit,
        size: productForm.size || "",
        color: productForm.color || "",
        purchase_price: productForm.purchase_price || "0",
        selling_price: productForm.selling_price || "0",
        initial_stock: productForm.initial_stock || "0",
        low_stock_limit: productForm.low_stock_limit || "0",
        is_active: true,
      });

      toast.success("Product created successfully");

      setProductForm({
        category: "",
        name: "",
        sku: "",
        description: "",
        unit: "pcs",
        size: "",
        color: "",
        purchase_price: "",
        selling_price: "",
        initial_stock: "",
        low_stock_limit: "5",
      });

      await loadProducts(selectedBusinessId);
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to create product");
      }
    } finally {
      setSubmittingProduct(false);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading products...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Products"
      subtitle="Manage product categories, prices, stock value and QR labels."
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Product Management
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Products & Categories
          </h1>

          <p className="mt-2 text-slate-600">
            Create products, edit categories, export CSV and print QR labels.
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
            onClick={handleExportCsv}
            disabled={!selectedBusiness || filteredProducts.length === 0}
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

          <div className="product-management-grid">
            <div className="space-y-6">
              <div className="product-stats-grid">
                <StatCard title="Products" value={products.length} />
                <StatCard title="Filtered" value={filteredProducts.length} />
                <StatCard title="Categories" value={categories.length} />
                <StatCard title="Low Stock" value={lowStockCount} />
                {canViewProductCosts && <StatCard
                  title="Filtered Value"
                  value={`৳ ${filteredStockValue.toFixed(2)}`}
                />}
              </div>

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
                      Find products by name, SKU, size, color, category or stock status.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Search Product
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
                        placeholder="Search name, SKU, size, color or category"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Category
                    </label>

                    <select
                      className="input"
                      name="category"
                      value={filters.category}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Stock Status
                    </label>

                    <select
                      className="input"
                      name="stock_status"
                      value={filters.stock_status}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Stock</option>
                      <option value="LOW_STOCK">Low Stock</option>
                      <option value="IN_STOCK">In Stock</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Active Status
                    </label>

                    <select
                      className="input"
                      name="active_status"
                      value={filters.active_status}
                      onChange={handleFilterChange}
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
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
                    disabled={filteredProducts.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-4 py-2 text-sm font-black text-green-700 hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={16} />
                    Export Filtered Products
                  </button>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-xl font-black text-slate-950">
                    Product List
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Showing {filteredProducts.length} of {products.length}{" "}
                    products for {selectedBusiness.name}.
                  </p>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-slate-600">
                    No products matched your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-left">
                      <thead className="bg-slate-100 text-sm text-slate-600">
                        <tr>
                          <th className="p-4">Product</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Size / Color</th>
                          <th className="p-4">Stock</th>
                          {canViewProductCosts && <th className="p-4">Purchase</th>}
                          <th className="p-4">Selling</th>
                          {canViewProductCosts && <th className="p-4">Stock Value</th>}
                          <th className="p-4">Status</th>
                          <th className="p-4">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {filteredProducts.map((product) => {
                          const isLowStock =
                            Number(product.stock_quantity || 0) <=
                            Number(product.low_stock_limit || 0);

                          return (
                            <tr key={product.id} className="product-table-row">
                              <td className="p-4">
                                <p className="font-black text-slate-950">
                                  {product.name}
                                </p>

                                <p className="text-xs text-slate-500">
                                  SKU: {product.sku || "N/A"}
                                </p>
                              </td>

                              <td className="p-4 text-sm text-slate-700">
                                {product.category_name || "Uncategorized"}
                              </td>

                              <td className="p-4">
                                <div className="flex flex-wrap gap-2">
                                  <span className="variant-chip">
                                    Size: {product.size || "N/A"}
                                  </span>
                                  <span className="variant-chip color-chip">
                                    Color: {product.color || "N/A"}
                                  </span>
                                </div>
                              </td>

                              <td className="p-4">
                                <p
                                  className={
                                    isLowStock
                                      ? "font-black text-red-600"
                                      : "font-black text-slate-950"
                                  }
                                >
                                  {product.stock_quantity} {product.unit}
                                </p>

                                <p className="text-xs text-slate-500">
                                  Low limit: {product.low_stock_limit}
                                </p>
                              </td>

                              {canViewProductCosts && <td className="p-4 font-bold text-slate-700">
                                ৳ {product.purchase_price}
                              </td>}

                              <td className="p-4 font-bold text-green-600">
                                ৳ {product.selling_price}
                              </td>

                              {canViewProductCosts && <td className="p-4 font-black text-slate-950">
                                ৳ {product.stock_value}
                              </td>}

                              <td className="p-4">
                                <span
                                  className={
                                    product.is_active
                                      ? "rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700"
                                      : "rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700"
                                  }
                                >
                                  {product.is_active ? "ACTIVE" : "INACTIVE"}
                                </span>
                              </td>

                              <td className="p-4">
                                <Link
                                  href={`/products/${product.id}`}
                                  className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-200"
                                >
                                  <QrCode size={16} />
                                  Details
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {canManageProducts && <aside className="min-w-0 space-y-6">
              <div className="card p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Tag size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Category List
                    </h2>
                    <p className="text-sm text-slate-600">
                      Edit or delete categories.
                    </p>
                  </div>
                </div>

                {categories.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
                    No categories found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="interactive-panel rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        {editingCategoryId === category.id ? (
                          <div className="space-y-3">
                            <input
                              className="input"
                              name="name"
                              value={editCategoryForm.name}
                              onChange={handleEditCategoryChange}
                              placeholder="Category name"
                            />

                            <textarea
                              className="input min-h-20"
                              name="description"
                              value={editCategoryForm.description}
                              onChange={handleEditCategoryChange}
                              placeholder="Description"
                            />

                            <label className="flex items-center gap-3 text-sm font-black text-slate-700">
                              <input
                                type="checkbox"
                                name="is_active"
                                checked={editCategoryForm.is_active}
                                onChange={handleEditCategoryChange}
                                className="h-5 w-5"
                              />
                              Active category
                            </label>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCategoryUpdate(category.id)
                                }
                                disabled={updatingCategory}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-70"
                              >
                                {updatingCategory ? (
                                  <Loader2
                                    size={16}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Pencil size={16} />
                                )}
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditCategory}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-300"
                              >
                                <X size={16} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-slate-950">
                                  {category.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {category.description || "No description"}
                                </p>
                                <span
                                  className={
                                    category.is_active
                                      ? "mt-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700"
                                      : "mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700"
                                  }
                                >
                                  {category.is_active ? "ACTIVE" : "INACTIVE"}
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditCategory(category)}
                                  className="rounded-xl bg-blue-100 p-2 text-blue-700 hover:bg-blue-200"
                                >
                                  <Pencil size={16} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCategoryDelete(category)
                                  }
                                  disabled={
                                    deletingCategoryId === category.id
                                  }
                                  className="rounded-xl bg-red-100 p-2 text-red-700 hover:bg-red-200 disabled:opacity-60"
                                >
                                  {deletingCategoryId === category.id ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash2 size={16} />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleCategorySubmit} className="card card-hover p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <Tag size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Add Category
                    </h2>
                    <p className="text-sm text-slate-600">
                      Example: Grocery, Electronics, Fashion
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    className="input"
                    name="name"
                    value={categoryForm.name}
                    onChange={handleCategoryChange}
                    placeholder="Category name"
                    required
                  />

                  <textarea
                    className="input min-h-20"
                    name="description"
                    value={categoryForm.description}
                    onChange={handleCategoryChange}
                    placeholder="Optional description"
                  />

                  <button
                    type="submit"
                    disabled={submittingCategory || !subscription?.has_access}
                    className="btn-secondary flex w-full items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {submittingCategory ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Add Category
                      </>
                    )}
                  </button>
                </div>
              </form>

              <form onSubmit={handleProductSubmit} className="card card-hover p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Boxes size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Add Product
                    </h2>
                    <p className="text-sm text-slate-600">
                      Create sellable product
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    className="input"
                    name="name"
                    value={productForm.name}
                    onChange={handleProductChange}
                    placeholder="Product name"
                    required
                  />

                  <select
                    className="input"
                    name="category"
                    value={productForm.category}
                    onChange={handleProductChange}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>

                  <input
                    className="input"
                    name="sku"
                    value={productForm.sku}
                    onChange={handleProductChange}
                    placeholder="Optional SKU"
                  />

                  <input
                    className="input"
                    name="unit"
                    value={productForm.unit}
                    onChange={handleProductChange}
                    placeholder="pcs / kg / box"
                    required
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      className="input"
                      name="size"
                      value={productForm.size}
                      onChange={handleProductChange}
                      placeholder="Size (S, M, L, 42, 1L)"
                    />

                    <input
                      className="input"
                      name="color"
                      value={productForm.color}
                      onChange={handleProductChange}
                      placeholder="Color (Black, Red, Blue)"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      name="purchase_price"
                      value={productForm.purchase_price}
                      onChange={handleProductChange}
                      placeholder="Purchase price"
                    />

                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      name="selling_price"
                      value={productForm.selling_price}
                      onChange={handleProductChange}
                      placeholder="Selling price"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      name="initial_stock"
                      value={productForm.initial_stock}
                      onChange={handleProductChange}
                      placeholder="Initial stock (optional)"
                    />

                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      name="low_stock_limit"
                      value={productForm.low_stock_limit}
                      onChange={handleProductChange}
                      placeholder="Low stock limit"
                    />
                  </div>

                  <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-700">
                    You can enter opening stock now. It will also appear in Stock History automatically.
                  </p>

                  <textarea
                    className="input min-h-20"
                    name="description"
                    value={productForm.description}
                    onChange={handleProductChange}
                    placeholder="Optional product description"
                  />

                  <button
                    type="submit"
                    disabled={submittingProduct || !subscription?.has_access}
                    className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {submittingProduct ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Add Product
                      </>
                    )}
                  </button>
                </div>
              </form>
            </aside>}
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

function safeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && Array.isArray(value.results)) {
    return value.results;
  }

  return [];
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin" />
            Loading products...
          </div>
        </main>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
