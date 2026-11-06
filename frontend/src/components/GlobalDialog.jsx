'use client';

import { useDialogStore } from '@/store/useDialogStore';
import { AlertCircle, Info, X } from 'lucide-react';

export default function GlobalDialog() {
  const { isOpen, title, message, type, confirmText, cancelText, onConfirm, onCancel, closeDialog } = useDialogStore();

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeDialog();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeDialog();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl relative text-slate-800 dark:text-slate-200 transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          {type === 'confirm' ? (
            <div className="mb-4 rounded-full bg-amber-100 p-3 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <AlertCircle className="h-8 w-8" />
            </div>
          ) : (
            <div className="mb-4 rounded-full bg-indigo-100 p-3 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Info className="h-8 w-8" />
            </div>
          )}
          
          <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            {message}
          </p>

          <div className="flex w-full gap-3">
            {type === 'confirm' && (
              <button
                onClick={handleCancel}
                className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer ${
                type === 'confirm' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
