import { Eye, EyeOff, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import NotificationDialog from "../components/common/NotificationDialog";
import httpClient from "../api/httpClient";
import { useAuth } from "../stores/AuthContext";
import { isPasswordValid } from "../utils/authSession";
import { buildFullName, mapUserToAccountForm } from "../utils/accountSettingsMapper";
import { getLocalUsers, upsertLocalUser } from "../utils/localDataStore";

function AccountSettingsPage() {
  const { user, updateCurrentUser } = useAuth();

  const currentSeedUser = useMemo(() => {
    const allUsers = getLocalUsers();
    if (!allUsers.length) {
      return null;
    }

    if (!user?.email) {
      return allUsers[0];
    }

    return allUsers.find((item) => item.email?.toLowerCase() === user.email.toLowerCase()) || allUsers[0];
  }, [user]);

  const initialForm = useMemo(
    () =>
      mapUserToAccountForm(currentSeedUser || {}, {
        id: user?.id,
        email: user?.email,
        full_name: user?.full_name,
      }),
    [currentSeedUser, user]
  );

  const [lastName, setLastName] = useState(initialForm.lastName);
  const [firstName, setFirstName] = useState(initialForm.firstName);
  const [labelName, setLabelName] = useState(initialForm.labelName);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const validate = () => {
    const nextErrors = {};

    if (!lastName.trim()) {
      nextErrors.lastName = "Họ là bắt buộc.";
    }

    if (!firstName.trim()) {
      nextErrors.firstName = "Tên là bắt buộc.";
    }

    if (newPassword && !oldPassword.trim()) {
      nextErrors.oldPassword = "Vui lòng nhập mật khẩu cũ để cập nhật mật khẩu mới.";
    }

    if (newPassword && !isPasswordValid(newPassword)) {
      nextErrors.newPassword = "Mật khẩu mới phải dài hơn 8 ký tự, gồm chữ hoa, chữ thường và số.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    const payload = {
      full_name: buildFullName(lastName, firstName),
      email: labelName.trim(),
      ...(newPassword
        ? {
            old_password: oldPassword,
            new_password: newPassword,
          }
        : {}),
    };

    const targetUserId = initialForm.id || "me";
    const currentLocalUser = getLocalUsers().find(
      (item) => item.id === targetUserId || item.email?.toLowerCase() === (user?.email || "").toLowerCase()
    );

    try {
      setSaving(true);
      await httpClient.put(`/api/users/${targetUserId}`, payload);
      updateCurrentUser({ full_name: payload.full_name, email: payload.email });
      setToast({ type: "success", message: "Đã lưu thông tin tài khoản thành công." });
    } catch (error) {
      if (error?.response?.status === 404) {
        if (newPassword && currentLocalUser?.password && currentLocalUser.password !== oldPassword) {
          setErrors((current) => ({
            ...current,
            oldPassword: "Mật khẩu cũ không chính xác.",
          }));
          return;
        }

        upsertLocalUser({
          ...(currentLocalUser || {}),
          id: currentLocalUser?.id || targetUserId,
          email: payload.email,
          full_name: payload.full_name,
          ...(newPassword ? { password: newPassword } : {}),
        });

        updateCurrentUser({
          id: currentLocalUser?.id || targetUserId,
          email: payload.email,
          full_name: payload.full_name,
        });
        setToast({ type: "success", message: "Đã lưu thông tin tài khoản (local mode)." });
      } else {
        setToast({ type: "error", message: error?.response?.data?.detail || "Không thể lưu thông tin tài khoản." });
        return;
      }
    } finally {
      setSaving(false);
    }

    setOldPassword("");
    setNewPassword("");
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Cài đặt tài khoản</h1>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
            <UserRound className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Thông tin tài khoản</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Họ</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
                placeholder="Nhập họ"
              />
              {errors.lastName ? <p className="mt-1 text-xs text-rose-600">{errors.lastName}</p> : null}
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Tên</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
                placeholder="Nhập tên"
              />
              {errors.firstName ? <p className="mt-1 text-xs text-rose-600">{errors.firstName}</p> : null}
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email/Label Name</span>
            <input
              value={labelName}
              onChange={(event) => setLabelName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
              placeholder="name@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Mật khẩu cũ</span>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-11 text-sm text-slate-800 outline-none transition focus:border-blue-500"
                placeholder="Nhập mật khẩu cũ"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Ẩn/hiện mật khẩu cũ"
              >
                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.oldPassword ? <p className="mt-1 text-xs text-rose-600">{errors.oldPassword}</p> : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Mật khẩu mới</span>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-11 text-sm text-slate-800 outline-none transition focus:border-blue-500"
                placeholder="Nhập mật khẩu mới"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Ẩn/hiện mật khẩu mới"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword ? <p className="mt-1 text-xs text-rose-600">{errors.newPassword}</p> : null}
            <p className="mt-1 text-xs text-slate-500">Mật khẩu mới phải dài hơn 8 ký tự, gồm chữ hoa, chữ thường và số.</p>
          </label>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      </section>

      <NotificationDialog
        open={Boolean(toast)}
        type={toast?.type || "success"}
        title={toast?.type === "error" ? "Không thể lưu" : "Lưu thành công"}
        message={toast?.message || ""}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

export default AccountSettingsPage;
