'use client';

import { useEffect, useState } from 'react';
import { Edit3, Lock, Mail, Save, ShieldCheck, User } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

const emptyPasswordForm = {
  old_password: '',
  new_password: '',
  confirm_password: '',
};

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [profileData, setProfileData] = useState({ full_name: '', email: '' });
  const [passwordData, setPasswordData] = useState(emptyPasswordForm);
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;

    setProfileData({
      full_name: user.full_name || '',
      email: user.email || '',
    });
  }, [user]);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);
    setLoadingProfile(true);

    try {
      const res = await api.put('/auth/update-profile', profileData);
      updateUser(res.data.user);
      setProfileMessage(res.data.message || 'Cập nhật thông tin thành công.');
    } catch (error) {
      setProfileError(error.response?.data?.message || 'Không thể cập nhật thông tin cá nhân.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoadingPassword(true);

    try {
      const res = await api.post('/auth/change-password', {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
      });
      setPasswordData(emptyPasswordForm);
      setPasswordMessage(res.data.message || 'Đổi mật khẩu thành công.');
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Hồ sơ cá nhân</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Quản lý thông tin tài khoản và bảo mật đăng nhập.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-cyan-500 text-3xl font-bold text-white shadow-md shadow-cyan-500/20">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{user?.full_name}</h2>
            <p className="mb-3 text-sm text-slate-400">@{user?.username}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              {user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên kho'}
            </span>
          </div>

          <div className="mt-8 space-y-4 border-t border-slate-100 pt-6 text-sm dark:border-slate-800">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Trạng thái:</span>
              <span className="font-semibold text-emerald-600">Hoạt động</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Mã nhân viên:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">#{String(user?.id || '').padStart(3, '0')}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Ngày tham gia:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : 'N/A'}
              </span>
            </div>
          </div>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-bold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              <Edit3 className="h-5 w-5 text-cyan-500" />
              Thông tin cá nhân
            </h3>

            {profileMessage && (
              <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                {profileMessage}
              </div>
            )}

            {profileError && (
              <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-200">
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Họ và tên
                <span className="ml-1 text-red-500">*</span>
                <span className="relative mt-1.5 block">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="full_name"
                    value={profileData.full_name}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-12 pr-4 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    required
                  />
                </span>
              </label>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Email
                <span className="relative mt-1.5 block">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-12 pr-4 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </span>
              </label>

              <div className="flex justify-end md:col-span-2">
                <button
                  type="submit"
                  disabled={loadingProfile}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 font-semibold text-white shadow-md shadow-cyan-500/20 transition hover:bg-cyan-600 disabled:opacity-60"
                >
                  {loadingProfile ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Lưu thông tin
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-bold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              <Lock className="h-5 w-5 text-cyan-500" />
              Đổi mật khẩu
            </h3>

            {passwordMessage && (
              <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                {passwordMessage}
              </div>
            )}

            {passwordError && (
              <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-200">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="max-w-2xl space-y-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Mật khẩu hiện tại
                <input
                  type="password"
                  name="old_password"
                  value={passwordData.old_password}
                  onChange={handlePasswordChange}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  required
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Mật khẩu mới
                  <input
                    type="password"
                    name="new_password"
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    minLength={6}
                    required
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Nhập lại mật khẩu mới
                  <input
                    type="password"
                    name="confirm_password"
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    minLength={6}
                    required
                  />
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loadingPassword}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                >
                  {loadingPassword ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Cập nhật mật khẩu'
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
