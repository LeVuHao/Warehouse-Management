'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

export default function AuthProvider({ children }) {
  const initialize = useAuthStore((state) => state.initialize);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initialize();
    setMounted(true);
  }, [initialize]);

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 text-slate-700">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm font-medium tracking-wide text-slate-500">Đang tải cấu hình...</p>
        </div>
      </div>
    );
  }

  return children;
}
