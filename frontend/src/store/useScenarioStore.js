import { create } from 'zustand';

export const SCENARIO_CONFIGS = {
  NORMAL: {
    id: 'NORMAL',
    label: 'Ngày thường (Chuẩn)',
    shortLabel: 'Bình thường',
    icon: 'Sun',
    desc: 'Vận hành tiêu chuẩn theo định mức ROP & FEFO.',
    leadTimeMultiplier: 1.0,
    demandMultiplier: 1.0,
    safetyStockMultiplier: 1.0,
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    accentColor: 'emerald',
    bannerText: 'Vận hành tiêu chuẩn. Các tuyến vận tải và nhà cung cấp hoạt động bình thường.',
    suggestedQuestions: [
      'Báo cáo nhanh tồn kho hôm nay',
      'Lô hàng nào sắp hết hạn trong 30 ngày?',
      'Kiểm tra tồn kho bia Tiger & thịt heo CP',
    ],
  },
  STORM_CENTRAL: {
    id: 'STORM_CENTRAL',
    label: 'Mưa bão miền Trung & Sạt lở đèo',
    shortLabel: 'Bão miền Trung',
    icon: 'CloudRain',
    desc: 'Bão số 3 gây sạt lở đèo Bảo Lộc / QL1A. Tuyến giao hàng từ Lâm Đồng trễ 3 ngày.',
    leadTimeMultiplier: 1.6,
    demandMultiplier: 1.25,
    safetyStockMultiplier: 1.5,
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    accentColor: 'amber',
    bannerText: '⚠️ CẢNH BÁO BÃO: Sạt lở đèo Bảo Lộc / QL20 gây gián đoạn vận chuyển từ Đà Lạt. Hệ số an toàn đã nâng x1.5.',
    suggestedQuestions: [
      'Bão số 3 ảnh hưởng thế nào đến các nhà cung cấp ở Lâm Đồng?',
      'Cần nhập dự phòng gấp những mặt hàng nào trước khi bão đổ bộ?',
      'Các lô hàng tươi sống có nguy cơ bị đứt gãy trong 3 ngày tới không?',
    ],
  },
  WEEKEND_PEAK: {
    id: 'WEEKEND_PEAK',
    label: 'Cao điểm Cuối tuần & Lễ hội',
    shortLabel: 'Cuối tuần / Lễ',
    icon: 'Sparkles',
    desc: 'Sức mua bia, nước ngọt, thực phẩm tươi sống dự kiến tăng vọt +35% đến +50%.',
    leadTimeMultiplier: 1.1,
    demandMultiplier: 1.35,
    safetyStockMultiplier: 1.3,
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    accentColor: 'purple',
    bannerText: '🎉 CAO ĐIỂM CUỐI TUẦN: Sức mua đồ uống & thực phẩm tươi tăng mạnh. Hệ thống tự động đẩy ROP lên +35%.',
    suggestedQuestions: [
      'Tồn kho bia Tiger và nước ngọt có đủ bán cho 2 ngày cuối tuần không?',
      'Dự báo số lượng thịt heo CP cần nhập bổ sung cho đợt cao điểm?',
      'Mặt hàng nào có nguy cơ cháy kho vào tối thứ Bảy?',
    ],
  },
};

export const useScenarioStore = create((set, get) => ({
  currentScenario: 'NORMAL',
  config: SCENARIO_CONFIGS.NORMAL,

  setScenario: (scenarioKey) => {
    const validKey = SCENARIO_CONFIGS[scenarioKey] ? scenarioKey : 'NORMAL';
    if (typeof window !== 'undefined') {
      localStorage.setItem('wms_active_scenario', validKey);
      // Dispatch custom event to let components react immediately
      window.dispatchEvent(new CustomEvent('wms:scenario_changed', { detail: { scenario: validKey } }));
    }
    set({
      currentScenario: validKey,
      config: SCENARIO_CONFIGS[validKey],
    });
  },

  initFromStorage: () => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('wms_active_scenario');
    if (saved && SCENARIO_CONFIGS[saved]) {
      set({
        currentScenario: saved,
        config: SCENARIO_CONFIGS[saved],
      });
    }
  },
}));
