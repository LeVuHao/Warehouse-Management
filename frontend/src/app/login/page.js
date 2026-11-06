'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, Eye, EyeOff, Lock, LogIn, Moon, Package, Sun, User } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

const loginSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải chứa ít nhất 3 ký tự'),
  password: z.string().min(5, 'Mật khẩu phải chứa ít nhất 5 ký tự'),
});

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  // Không dùng useEffect redirect ở đây vì Zustand chưa kịp sync cookie
  // khi middleware check → gây race condition. Redirect được xử lý trong onSubmit.

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg('');

    try {
      const result = await login(data.username, data.password);
      if (result.success) {
        // Dùng window.location.href thay vì router.push để buộc browser
        // thực hiện full page reload kèm cookie → middleware đọc được ngay,
        // tránh race condition "cookie set xong nhưng middleware chưa thấy".
        window.location.href = '/dashboard';
      } else {
        setErrorMsg(result.message);
        setLoading(false);
      }
    } catch {
      setErrorMsg('Đăng nhập thất bại. Vui lòng kiểm tra lại kết nối mạng.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <button
        onClick={toggleTheme}
        className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        title="Chuyển đổi giao diện"
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5 text-amber-400" />
        ) : (
          <Moon className="h-5 w-5 text-slate-500" />
        )}
      </button>

      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-24 items-center justify-center bg-slate-600 px-8 text-white">
          <div className="flex items-center gap-3">
            <Package className="h-12 w-12" strokeWidth={2} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Quản lý kho hàng</h1>
              <p className="text-sm text-white/70">WMS Logistics</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Đăng nhập hệ thống</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sử dụng tài khoản quản trị hoặc nhân viên kho để tiếp tục.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="font-medium leading-5">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tên đăng nhập
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="h-4 w-4" />
                </span>
                <input
                  {...register('username')}
                  type="text"
                  autoComplete="username"
                  placeholder="Ví dụ: admin"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
              </div>
              {errors.username && (
                <p className="text-xs font-medium text-red-500">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Mật khẩu
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Ví dụ: admin123"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-red-500">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || authLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-200 transition hover:bg-cyan-600 disabled:pointer-events-none disabled:opacity-60 dark:shadow-none"
            >
              {loading || authLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang kiểm tra...
                </>
              ) : (
                <>
                  Đăng nhập
                  <LogIn className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="mb-1.5 font-semibold text-slate-600 dark:text-slate-300">Tài khoản demo kiểm thử:</p>
            <p>Admin: <span className="font-mono font-semibold text-cyan-700">admin</span> / <span className="font-mono">admin123</span></p>
            <p>Staff: <span className="font-mono font-semibold text-cyan-700">nhanvien1</span> / <span className="font-mono">nhanvien123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
