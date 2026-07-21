"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, TicketPercent, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { MANAGEMENT_ROLES } from "@/lib/roles";

const emptyForm = { code: "", description: "", discount_type: "FIXED", value: "", minimum_purchase: "0", maximum_discount: "", valid_from: "", valid_until: "", is_active: true };
const asList = (value) => Array.isArray(value) ? value : value?.results || [];

export default function DiscountsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [vouchers, setVouchers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadVouchers = async (id) => {
    if (!id) return setVouchers([]);
    const response = await api.get(`/sales/business/${id}/vouchers/`);
    setVouchers(asList(response.data));
  };

  useEffect(() => {
    if (!loading && !user) return router.replace("/login");
    if (user) {
      api.get("/businesses/my-businesses/").then(async (response) => {
        const list = asList(response.data).filter((business) => user.business_memberships?.some((membership) => membership.business_id === business.id && MANAGEMENT_ROLES.includes(membership.role) && membership.status === "ACTIVE"));
        setBusinesses(list);
        const id = list[0]?.id ? String(list[0].id) : "";
        setBusinessId(id);
        await loadVouchers(id);
      }).catch(() => toast.error("Failed to load discounts")).finally(() => setLoadingPage(false));
    }
  }, [loading, user, router]);

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const reset = () => { setForm(emptyForm); setEditingId(null); };
  const edit = (voucher) => {
    setEditingId(voucher.id);
    setForm({ ...emptyForm, ...voucher, valid_from: toLocalInput(voucher.valid_from), valid_until: toLocalInput(voucher.valid_until), maximum_discount: voucher.maximum_discount || "" });
  };

  const submit = async (event) => {
    event.preventDefault();
    const payload = { ...form, maximum_discount: form.maximum_discount || null, valid_from: form.valid_from || null, valid_until: form.valid_until || null };
    try {
      setSaving(true);
      if (editingId) await api.patch(`/sales/vouchers/${editingId}/`, payload);
      else await api.post(`/sales/business/${businessId}/vouchers/`, payload);
      toast.success(editingId ? "Voucher updated" : "Voucher created");
      reset();
      await loadVouchers(businessId);
    } catch (error) { showError(error, "Failed to save voucher"); }
    finally { setSaving(false); }
  };

  const remove = async (voucher) => {
    if (!window.confirm(`Delete voucher ${voucher.code}?`)) return;
    try { await api.delete(`/sales/vouchers/${voucher.id}/`); await loadVouchers(businessId); toast.success("Voucher deleted"); }
    catch (error) { showError(error, "Failed to delete voucher"); }
  };

  if (loading || loadingPage) return <main className="flex min-h-dvh items-center justify-center"><Loader2 className="animate-spin" /></main>;

  return (
    <DashboardLayout title="Discounts" subtitle="Create owner-approved vouchers for sales.">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold uppercase text-blue-600">Owner only</p><h1 className="mt-2 text-3xl font-black">Discount Vouchers</h1><p className="mt-2 text-slate-600">Employees can apply active codes but cannot create or edit them.</p></div><select className="input sm:max-w-80" value={businessId} onChange={async (event) => { setBusinessId(event.target.value); reset(); await loadVouchers(event.target.value); }}>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></div>
      <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
        <section className="grid min-w-0 gap-5 md:grid-cols-2">{vouchers.map((voucher) => <article key={voucher.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`rounded-full px-3 py-1 text-xs font-black ${voucher.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{voucher.is_active ? "ACTIVE" : "INACTIVE"}</span><h2 className="text-wrap-safe mt-3 text-2xl font-black">{voucher.code}</h2><p className="mt-1 text-sm text-slate-500">{voucher.description || "No description"}</p></div><TicketPercent className="shrink-0 text-blue-600" /></div><div className="mt-4 grid grid-cols-2 gap-3"><Value label="Discount" value={voucher.discount_type === "PERCENT" ? `${voucher.value}%` : `৳ ${voucher.value}`} /><Value label="Minimum sale" value={`৳ ${voucher.minimum_purchase}`} /><Value label="Valid from" value={formatDate(voucher.valid_from)} /><Value label="Valid until" value={formatDate(voucher.valid_until)} /></div><div className="action-row mt-5"><button onClick={() => edit(voucher)} className="btn-secondary flex-1"><Pencil size={16} /> Edit</button><button onClick={() => remove(voucher)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-100 px-4 font-black text-red-700"><Trash2 size={16} /> Delete</button></div></article>)}{!vouchers.length && <div className="card col-span-full p-8 text-center text-slate-500">No vouchers created.</div>}</section>
        <form onSubmit={submit} className="card h-fit p-5 sm:p-6 xl:sticky xl:top-24"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">{editingId ? "Edit Voucher" : "New Voucher"}</h2><p className="text-sm text-slate-500">Configure an approved discount.</p></div>{editingId && <button type="button" onClick={reset} className="rounded-xl bg-slate-100 p-2"><X /></button>}</div><div className="mt-5 space-y-4"><input className="input uppercase" name="code" value={form.code} onChange={change} placeholder="Code, e.g. EID10" required /><input className="input" name="description" value={form.description} onChange={change} placeholder="Description" /><div className="grid gap-4 sm:grid-cols-2"><select className="input" name="discount_type" value={form.discount_type} onChange={change}><option value="FIXED">Fixed amount</option><option value="PERCENT">Percentage</option></select><input className="input" type="number" min="0.01" step="0.01" name="value" value={form.value} onChange={change} placeholder="Value" required /><input className="input" type="number" min="0" step="0.01" name="minimum_purchase" value={form.minimum_purchase} onChange={change} placeholder="Minimum purchase" /><input className="input" type="number" min="0" step="0.01" name="maximum_discount" value={form.maximum_discount} onChange={change} placeholder="Maximum discount" /><input className="input" type="datetime-local" name="valid_from" value={form.valid_from} onChange={change} /><input className="input" type="datetime-local" name="valid_until" value={form.valid_until} onChange={change} /></div><label className="flex items-center justify-between rounded-xl bg-slate-50 p-3 font-bold"><span>Active voucher</span><input type="checkbox" name="is_active" checked={form.is_active} onChange={change} className="h-5 w-5" /></label><button className="btn-primary w-full" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={17} /> : editingId ? <Pencil size={17} /> : <Plus size={17} />}{editingId ? "Update Voucher" : "Create Voucher"}</button></div></form>
      </div>
    </DashboardLayout>
  );
}

function Value({ label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="text-wrap-safe mt-1 text-sm font-black">{value}</p></div>; }
function formatDate(value) { return value ? new Date(value).toLocaleString() : "No limit"; }
function toLocalInput(value) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16); }
function showError(error, fallback) { const data = error.response?.data; const first = data && typeof data === "object" ? Object.values(data)[0] : null; toast.error(Array.isArray(first) ? first[0] : typeof first === "string" ? first : fallback); }
