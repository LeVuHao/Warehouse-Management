'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CloudRain,
  Sun,
  Sparkles,
  ChevronDown,
  AlertTriangle,
  Zap,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { useScenarioStore, SCENARIO_CONFIGS } from '@/store/useScenarioStore';

const ICONS = {
  Sun: Sun,
  CloudRain: CloudRain,
  Sparkles: Sparkles,
};

export default function ContextSimulatorBar() {
  const { currentScenario, config, setScenario, initFromStorage } = useScenarioStore();
  const [isOpen, setIsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectScenario = (key) => {
    if (key === currentScenario) {
      setIsOpen(false);
      return;
    }
    setScenario(key);
    setIsOpen(false);
    const newConfig = SCENARIO_CONFIGS[key];
    setToastMsg(`Đã kích hoạt kịch bản: ${newConfig.label}!`);
    setTimeout(() => {
      setToastMsg('');
    }, 4000);
  };

  const CurrentIcon = ICONS[config.icon] || Sun;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:border-cyan-400 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
        title="Bấm để chuyển kịch bản giả lập ngữ cảnh"
      >
        <span className="flex items-center gap-1.5 text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Giả lập ngữ cảnh:</span>
        </span>

        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-semibold ${config.badgeColor} border`}>
          <CurrentIcon className="h-3.5 w-3.5 animate-pulse" />
          <span>{config.shortLabel}</span>
        </span>

        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 text-slate-200 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Bộ Giả Lập Ngữ Cảnh AI
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Chọn ngữ cảnh môi trường để kiểm thử phản ứng tính toán tồn kho và khuyến nghị tức thì của AI.
            </p>
          </div>

          <div className="p-2 space-y-1.5">
            {Object.values(SCENARIO_CONFIGS).map((item) => {
              const ItemIcon = ICONS[item.icon] || Sun;
              const isSelected = item.id === currentScenario;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectScenario(item.id)}
                  className={`w-full flex items-start gap-3 rounded-xl p-3 text-left transition ${
                    isSelected
                      ? 'bg-cyan-500/15 border border-cyan-500/40 text-white'
                      : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className={`mt-0.5 rounded-lg p-2 ${item.badgeColor} border flex-shrink-0`}>
                    <ItemIcon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{item.label}</span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-cyan-400" />}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono">
                        Lead time: x{item.leadTimeMultiplier}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono">
                        Sức mua: x{item.demandMultiplier}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-800 bg-slate-950/40 p-2.5 text-center">
            <span className="text-[10px] text-slate-500">
              Dữ liệu được tiêm trực tiếp vào thuật toán ROP và Trợ lý AI Copilot
            </span>
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-cyan-500/40 bg-slate-900/95 px-5 py-2.5 text-xs font-semibold text-cyan-300 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
          <Zap className="h-4 w-4 text-cyan-400 animate-bounce" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
