"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, loading, loadUser, logout } = useAuth();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm_password: "" });

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (form.new_password !== form.confirm_password) return toast.error("Passwords do not match");
    try {
      setSubmitting(true);
      await api.post("/accounts/change-password/", form);
      await loadUser();
      toast.success("Password changed successfully");
      router.replace("/products");
    } catch (error) {
      const data = error.response?.data;
      const first = data && typeof data === "object" ? Object.values(data)[0] : null;
      toast.error(Array.isArray(first) ? first[0] : first || "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return <main className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></main>;

  return (
    <main className="auth-page flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="card w-full max-w-lg p-7">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-500 p-3 text-white"><KeyRound /></div><div><h1 className="text-2xl font-black">Change Your Password</h1><p className="text-sm text-slate-600">Replace the temporary password before continuing.</p></div></div>
        <div className="mt-7 space-y-4">
          {[['current_password','Current password'],['new_password','New password'],['confirm_password','Confirm new password']].map(([name,label]) => <div key={name}><label className="mb-2 block text-sm font-bold">{label}</label><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="input pl-11 pr-12" type={visible ? "text" : "password"} name={name} value={form[name]} onChange={change} minLength={8} required /></div></div>)}
        </div>
        <button type="button" onClick={() => setVisible((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600">{visible ? <EyeOff size={17} /> : <Eye size={17} />} {visible ? "Hide" : "Show"} passwords</button>
        <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">{submitting ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Change Password</button>
        <button type="button" onClick={logout} className="mt-3 w-full rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-600">Logout</button>
      </form>
    </main>
  );
}
