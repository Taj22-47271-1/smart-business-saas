"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, loadUser } = useAuth();

  const [loadingPage, setLoadingPage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }

    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
      });
    }
  }, [loading, user, router]);

  const refreshProfile = async () => {
    try {
      setLoadingPage(true);
      await loadUser();
      toast.success("Profile refreshed");
    } catch (error) {
      toast.error("Failed to refresh profile");
    } finally {
      setLoadingPage(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);

      await api.patch("/accounts/profile/update/", {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
      });

      await loadUser();

      toast.success("Profile updated successfully");
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswordData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New password and confirmation do not match");
      return;
    }

    try {
      setChangingPassword(true);
      await api.post("/accounts/change-password/", passwordData);

      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setShowPasswords(false);
      toast.success("Password changed successfully");
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        const firstError = Object.values(data)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" />
          Loading profile...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Profile"
      subtitle="Manage your account information."
    >
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Account Settings
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            My Profile
          </h1>

          <p className="mt-2 text-slate-600">
            View and update your account information.
          </p>
        </div>

        <button
          onClick={refreshProfile}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
        <div className="space-y-8">
        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <User size={24} />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-950">
                Edit Profile
              </h2>
              <p className="text-sm text-slate-600">
                Update your personal details.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                First Name
              </label>

              <input
                className="input"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="First name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Last Name
              </label>

              <input
                className="input"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Last name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Phone
              </label>

              <input
                className="input"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="01XXXXXXXXX"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Email
              </label>

              <input
                className="input bg-slate-100"
                value={user.email || ""}
                disabled
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary mt-6 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="card p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white">
                <KeyRound size={24} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Change Password
                </h2>
                <p className="text-sm text-slate-600">
                  Use a strong password you do not use elsewhere.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords((previous) => !previous)}
              className="rounded-xl bg-slate-100 p-3 text-slate-600 hover:bg-slate-200"
              aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
            >
              {showPasswords ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          <div className="space-y-5">
            <PasswordInput
              label="Current Password"
              name="current_password"
              value={passwordData.current_password}
              onChange={handlePasswordChange}
              visible={showPasswords}
              autoComplete="current-password"
            />

            <div className="grid gap-5 md:grid-cols-2">
              <PasswordInput
                label="New Password"
                name="new_password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                visible={showPasswords}
                autoComplete="new-password"
              />

              <PasswordInput
                label="Confirm New Password"
                name="confirm_password"
                value={passwordData.confirm_password}
                onChange={handlePasswordChange}
                visible={showPasswords}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-black text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {changingPassword ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Changing...
              </>
            ) : (
              <>
                <Lock size={18} />
                Change Password
              </>
            )}
          </button>
        </form>
        </div>

        <aside className="space-y-6">
          <div className="card p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <ShieldCheck size={24} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Account Info
                </h2>
                <p className="text-sm text-slate-600">
                  Your current login details.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <InfoRow label="Username" value={user.username || "N/A"} />
              <InfoRow label="Email" value={user.email || "N/A"} />
              <InfoRow label="Platform Role" value={user.role || "N/A"} />
              {(user.business_memberships || []).map((membership) => (
                <InfoRow
                  key={membership.business_id}
                  label={`${membership.business_name} Role`}
                  value={`${membership.role} (${membership.status})`}
                />
              ))}
              <InfoRow
                label="Full Name"
                value={`${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A"}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-start gap-3">
              <Mail className="mt-1 text-blue-700" size={22} />

              <div>
                <h3 className="font-black text-slate-950">
                  Email cannot be changed here
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  For security, email update is disabled from this page. Later
                  we can add an email verification flow if needed.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 break-words font-black text-slate-950">{value}</p>
    </div>
  );
}

function PasswordInput({ label, name, value, onChange, visible, autoComplete }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>
      <input
        className="input"
        type={visible ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        minLength={8}
        required
      />
    </div>
  );
}
