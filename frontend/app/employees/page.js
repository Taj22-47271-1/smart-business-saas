"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { BUSINESS_ROLES } from "@/lib/roles";

const asList = (value) => (Array.isArray(value) ? value : value?.results || []);
const ASSIGNABLE_ROLES = [
  { value: BUSINESS_ROLES.MANAGER, label: "Manager" },
  { value: BUSINESS_ROLES.ACCOUNTANT, label: "Accountant" },
  { value: BUSINESS_ROLES.STAFF, label: "Staff" },
];

export default function EmployeesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const ownerBusinesses = useMemo(
    () =>
      (user?.business_memberships || []).filter(
        (item) =>
          item.status === "ACTIVE" && item.role === BUSINESS_ROLES.OWNER
      ),
    [user]
  );

  const [businessId, setBusinessId] = useState("");
  const [members, setMembers] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState(null);
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    temporary_password: "",
    role: BUSINESS_ROLES.STAFF,
  });

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (ownerBusinesses[0] && !businessId) {
      setBusinessId(String(ownerBusinesses[0].business_id));
    }
    if (!loading) setLoadingPage(false);
  }, [loading, user, ownerBusinesses, businessId, router]);

  const loadMembers = async (id = businessId) => {
    if (!id) return setMembers([]);
    try {
      const response = await api.get(`/businesses/${id}/members/`);
      setMembers(asList(response.data));
    } catch {
      toast.error("Failed to load team members");
    }
  };

  useEffect(() => {
    loadMembers();
  }, [businessId]);

  const change = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

  const addMember = async (event) => {
    event.preventDefault();
    if (!businessId) return toast.error("Select a business");

    try {
      setSubmitting(true);
      await api.post(`/businesses/${businessId}/members/`, form);
      setForm({
        email: "",
        first_name: "",
        last_name: "",
        temporary_password: "",
        role: BUSINESS_ROLES.STAFF,
      });
      await loadMembers();
      toast.success("Team member added successfully");
    } catch (error) {
      const data = error.response?.data;
      const first = data && typeof data === "object" ? Object.values(data)[0] : null;
      toast.error(
        Array.isArray(first)
          ? first[0]
          : first?.[0] || first || "Failed to add team member"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateMember = async (member, changes, successMessage) => {
    try {
      setUpdatingMemberId(member.id);
      await api.patch(
        `/businesses/${businessId}/members/${member.id}/`,
        changes
      );
      await loadMembers();
      toast.success(successMessage);
    } catch (error) {
      const message =
        error.response?.data?.role?.[0] ||
        error.response?.data?.detail ||
        "Failed to update team member";
      toast.error(message);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const toggleStatus = (member) => {
    const status = member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    return updateMember(
      member,
      { status },
      `Member marked ${status.toLowerCase()}`
    );
  };

  const changeRole = (member, role) =>
    updateMember(member, { role }, "Member role updated");

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.name || member.email} from this business?`)) {
      return;
    }
    try {
      await api.delete(`/businesses/${businessId}/members/${member.id}/`);
      await loadMembers();
      toast.success("Team member removed from business");
    } catch {
      toast.error("Failed to remove team member");
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </main>
    );
  }
  if (!user) return null;

  const teamMembers = members.filter(
    (member) => member.role !== BUSINESS_ROLES.OWNER
  );

  return (
    <DashboardLayout
      title="Team Members"
      subtitle="Assign Manager, Accountant, or Staff access to each user."
    >
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase text-blue-600">Role Access</p>
          <h1 className="mt-2 text-3xl font-black">Team Management</h1>
        </div>
        <button onClick={() => loadMembers()} className="btn-secondary">
          <RefreshCw size={17} /> Refresh
        </button>
      </div>

      {ownerBusinesses.length === 0 ? (
        <div className="card p-8 text-center text-slate-600">
          Create or own a business before adding team members.
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-200 p-5">
              <select
                className="input max-w-sm"
                value={businessId}
                onChange={(event) => setBusinessId(event.target.value)}
              >
                {ownerBusinesses.map((item) => (
                  <option key={item.business_id} value={item.business_id}>
                    {item.business_name}
                  </option>
                ))}
              </select>
            </div>

            {teamMembers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Users className="mx-auto mb-3" /> No team members yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">
                        {member.name || member.email}
                      </p>
                      <p className="truncate text-sm text-slate-500">{member.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            member.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {member.status}
                        </span>
                        {member.must_change_password && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
                            PASSWORD CHANGE REQUIRED
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        className="input min-w-40"
                        value={member.role}
                        disabled={updatingMemberId === member.id}
                        onChange={(event) => changeRole(member, event.target.value)}
                      >
                        {ASSIGNABLE_ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => toggleStatus(member)}
                        disabled={updatingMemberId === member.id}
                        className="btn-secondary"
                      >
                        {member.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => removeMember(member)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-100 px-4 font-black text-red-700 hover:bg-red-200"
                      >
                        <Trash2 size={17} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={addMember} className="card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-600 p-3 text-white">
                <UserPlus />
              </div>
              <div>
                <h2 className="text-xl font-black">Add Team Member</h2>
                <p className="text-sm text-slate-500">
                  Create an account or attach an existing user.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <select className="input" name="role" value={form.role} onChange={change}>
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="email"
                name="email"
                value={form.email}
                onChange={change}
                placeholder="Team member email"
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className="input"
                  name="first_name"
                  value={form.first_name}
                  onChange={change}
                  placeholder="First name"
                />
                <input
                  className="input"
                  name="last_name"
                  value={form.last_name}
                  onChange={change}
                  placeholder="Last name"
                />
              </div>
              <div className="relative">
                <input
                  className="input pr-12"
                  type={visible ? "text" : "password"}
                  name="temporary_password"
                  value={form.temporary_password}
                  onChange={change}
                  placeholder="Temporary password (new user)"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                A temporary password is required only for a new email. Existing
                users keep their current password.
              </p>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <UserPlus size={18} />
                )}
                Add Team Member
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
