'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Bell,
  ChevronDown,
  Clock,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Maximize,
  Menu,
  Moon,
  Package,
  Sun,
  Truck,
  User,
  UserCheck,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { io } from 'socket.io-client';
import GlobalDialog from '@/components/GlobalDialog';

export default function DashboardLayout({ children }) {
  const { isAuthenticated, isLoading, user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [notificationData, setNotificationData] = useState({ alerts_count: 0, alerts: [], activities: [] });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchNotifications = async () => {
      try {
        const { default: api } = await import('@/lib/api');
        const res = await api.get('/inventory/bell-notifications');
        const data = res.data || { alerts_count: 0, alerts: [], activities: [] };
        setNotificationData(data);
        setAlertCount(data.alerts_count || 0);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
    // Connect to Socket.io for realtime updates
    const getSocketUrl = () => {
      const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      return api.replace(/\/api\/?$/, '');
    };
    const socket = io(getSocketUrl());
    socket.on('new_notification', (data) => {
      fetchNotifications(); // Re-fetch the full list when a new notification arrives
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleNotificationNavigate = (path) => {
    setIsNotificationsOpen(false);
    router.push(path);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm font-medium tracking-wide text-slate-500">Đang xác thực quyền truy cập...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Sản phẩm', href: '/dashboard/products', icon: Package },
    { name: 'Nhà cung cấp', href: '/dashboard/suppliers', icon: Truck },
    { name: 'Phiếu nhập', href: '/dashboard/imports', icon: ArrowDownToLine },
    { name: 'Phiếu xuất', href: '/dashboard/exports', icon: ArrowUpFromLine },
    { name: 'Tồn kho', href: '/dashboard/inventory', icon: Warehouse },
  ];

  if (user?.role === 'admin') {
    menuItems.splice(3, 0, {
      name: 'Người dùng',
      href: '/dashboard/users',
      icon: UserCheck,
    });
    menuItems.push(
      { name: 'Cảnh báo', href: '/dashboard/alerts', icon: Bell },
      { name: 'Đề xuất bổ sung hàng', href: '/dashboard/replenishments', icon: Lightbulb },
    );
  }

  const Sidebar = ({ mobile = false }) => (
    <aside
      className={`bg-gray-50 text-gray-700 shadow-xl dark:bg-slate-950 dark:text-slate-200 print:hidden ${
        mobile
          ? 'h-screen w-64'
          : 'fixed left-0 top-0 z-40 hidden h-screen w-64 md:block'
      }`}
    >
      <div className="flex h-20 items-center justify-center border-b border-gray-200 bg-slate-600 px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Package className="h-11 w-11 text-white" strokeWidth={2} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-white/90">Quản lý kho hàng</p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-white/60">
              Bách Hóa Xanh WMS
            </p>
          </div>
        </div>
      </div>

      <nav className="h-[calc(100vh-5rem)] space-y-1 overflow-y-auto px-3 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === '/dashboard'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => mobile && setIsSidebarOpen(false)}
              className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gray-200 text-cyan-600 shadow-md dark:bg-slate-800 dark:text-cyan-300'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen wms-shell text-slate-900 dark:text-slate-100">
      <Sidebar />

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden print:hidden">
          {/* Backdrop overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Sidebar Drawer */}
          <div className="relative z-50 flex h-full">
            <Sidebar mobile />
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="m-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white"
              aria-label="Đóng menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-30 h-20 border-b border-slate-700 bg-slate-800 text-white no-print">
          <div className="flex h-full items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white md:hidden"
                title="Mở sidebar"
              >
                <Menu className="h-6 w-6" strokeWidth={2} />
              </button>

              <div className="hidden items-center gap-2 rounded-full bg-slate-900/60 px-4 py-2 text-sm text-white/75 ring-1 ring-slate-600 sm:flex">
                <Warehouse className="h-4 w-4 text-cyan-300" />
                <span>Tổng kho Bách Hóa Xanh</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullscreen}
                className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                title="Toàn màn hình"
              >
                <Maximize className="h-5 w-5" strokeWidth={2} />
              </button>

              <div ref={notificationRef} className="relative">
                <button
                  onClick={() => setIsNotificationsOpen((prev) => !prev)}
                  className="relative rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                  title="Thông báo"
                >
                  <Bell className={`h-5 w-5 ${alertCount > 0 ? 'animate-pulse text-red-400' : ''}`} strokeWidth={2} />
                  {alertCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-slate-800">
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="fixed left-4 right-4 top-20 z-50 w-auto overflow-hidden rounded-xl border border-gray-100 bg-white text-slate-700 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-80">
                    <div className="border-b border-gray-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Thông báo hệ thống</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notificationData.alerts?.length > 0 && (
                        <div className="p-2">
                          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Cảnh báo</div>
                          {notificationData.alerts.map((item, index) => {
                            const isImport = ['arrival_confirmation', 'pending_approval'].includes(item.type);
                            const isReturn = item.type === 'pending_return';
                            const target = isImport ? '/dashboard/imports' : isReturn ? '/dashboard/exports' : '/dashboard/alerts';

                            return (
                              <button
                                key={`${item.type}-${index}`}
                                type="button"
                                onClick={() => handleNotificationNavigate(target)}
                                className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition hover:bg-red-50 dark:hover:bg-slate-800"
                              >
                                <div className={`mt-0.5 rounded-full p-1.5 ${isImport ? 'bg-cyan-100 text-cyan-600' : isReturn ? 'bg-rose-100 text-rose-600' : 'bg-red-100 text-red-600'}`}>
                                  <AlertTriangle className="h-4 w-4" />
                                </div>
                                <p className="text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">{item.message}</p>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {notificationData.activities?.length > 0 && (
                        <div className="border-t border-gray-50 p-2 dark:border-slate-800">
                          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Hoạt động gần đây</div>
                          {notificationData.activities.map((item, index) => (
                            <button
                              key={`${item.type}-${index}`}
                              type="button"
                              onClick={() => handleNotificationNavigate(item.type === 'import' ? '/dashboard/imports' : '/dashboard/exports')}
                              className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition hover:bg-cyan-50 dark:hover:bg-slate-800"
                            >
                              <div className={`mt-0.5 rounded-full p-1.5 ${item.type === 'import' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                {item.type === 'import' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                              </div>
                              <p className="text-sm leading-snug text-slate-600 dark:text-slate-300">{item.message}</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {!(notificationData.alerts?.length || notificationData.activities?.length) && (
                        <div className="p-6 text-center text-slate-500">
                          <Clock className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                          <p className="text-sm">Không có thông báo mới</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={toggleTheme}
                className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                title="Chuyển đổi giao diện"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-amber-300" strokeWidth={2} />
                ) : (
                  <Moon className="h-5 w-5" strokeWidth={2} />
                )}
              </button>

              <div ref={dropdownRef} className="relative ml-2">
                <button
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500 text-sm font-bold text-white">
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden max-w-40 truncate text-sm font-semibold text-white md:block">
                    {user?.full_name}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-white/70 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    strokeWidth={2}
                  />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-gray-100 bg-white py-2 text-gray-700 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    <div className="border-b border-gray-100 px-4 py-3 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Đang đăng nhập</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-800 dark:text-slate-50">{user?.full_name}</p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-200">
                        <User className="h-3 w-3" />
                        {user?.role}
                      </span>
                    </div>

                    <Link
                      href="/dashboard/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <User className="h-4 w-4" strokeWidth={2} />
                      Hồ sơ cá nhân
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-gray-50 dark:text-red-300 dark:hover:bg-slate-800"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={2} />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <GlobalDialog />
          {children}
        </main>
      </div>
    </div>
  );
}
