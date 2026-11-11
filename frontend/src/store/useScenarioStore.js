import { create } from 'zustand';

export const SCENARIO_CONFIGS = {
  NORMAL: {
    id: 'NORMAL',
    label: 'Ngày thường (Thời tiết ổn định)',
    shortLabel: 'Thời tiết ổn định',
    icon: 'Sun',
    desc: 'Vận hành tiêu chuẩn theo định mức ROP & FEFO. Thời tiết thuận lợi.',
    weatherBriefing: 'Khu vực Nam Bộ và các tuyến hành lang logistics thời tiết thuận lợi, không có cảnh báo triều cường hay mưa dông lớn. Tuyến vận chuyển từ các nhà cung ứng lưu thông đúng lịch trình.',
    leadTimeMultiplier: 1.0,
    demandMultiplier: 1.0,
    safetyStockMultiplier: 1.0,
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    accentColor: 'emerald',
    bannerText: 'Vận hành tiêu chuẩn. Thời tiết ổn định, các tuyến vận tải và nhà cung cấp hoạt động bình thường.',
    suggestedQuestions: [
      'Báo cáo nhanh tồn kho hôm nay',
      'Lô hàng nào sắp hết hạn trong 30 ngày?',
      'Kiểm tra tồn kho bia Tiger & thịt heo CP',
    ],
  },
  STORM_CENTRAL: {
    id: 'STORM_CENTRAL',
    label: 'Thời tiết xấu, Mưa bão & Ngập lụt (Nam Bộ & Toàn quốc)',
    shortLabel: 'Mưa bão & Ngập lụt',
    icon: 'CloudRain',
    desc: 'Mưa lớn, triều cường ngập úng tại TP.HCM/Miền Tây và nguy cơ sạt lở đèo Bảo Lộc. Nguồn cung liên tỉnh trễ 2-3 ngày.',
    weatherBriefing: 'Cảnh báo thời tiết xấu: Khu vực đang có mưa lớn diện rộng và triều cường ngập úng tại TP.HCM/Miền Tây; các tuyến đèo Lâm Đồng tiềm ẩn nguy cơ sạt lở. Lead time giao hàng trễ 2-3 ngày, cần ưu tiên nhập dự phòng.',
    leadTimeMultiplier: 1.6,
    demandMultiplier: 1.25,
    safetyStockMultiplier: 1.5,
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    accentColor: 'amber',
    bannerText: '⚠️ CẢNH BÁO THỜI TIẾT: Mưa lớn, triều cường ngập úng tại Nam Bộ và sạt lở tuyến đèo Đà Lạt. Hệ số an toàn đã nâng x1.5.',
    suggestedQuestions: [
      'Thời tiết mưa ngập hiện tại ảnh hưởng thế nào đến các tuyến giao hàng?',
      'Cần nhập dự phòng gấp những mặt hàng nào trước khi ngập úng kéo dài?',
      'Các lô hàng tươi sống có nguy cơ bị đứt gãy trong 3 ngày tới không?',
    ],
  },
  WEEKEND_PEAK: {
    id: 'WEEKEND_PEAK',
    label: 'Cao điểm Cuối tuần & Lễ hội',
    shortLabel: 'Cuối tuần / Lễ',
    icon: 'Sparkles',
    desc: 'Sức mua bia, nước ngọt, thực phẩm tươi sống dự kiến tăng vọt +35% đến +50%.',
    weatherBriefing: 'Dự báo cuối tuần thời tiết đẹp, thuận lợi cho hoạt động dã ngoại và mua sắm gia đình. Nhu cầu tiêu thụ bia, nước giải khát và thực phẩm tiệc tươi sống dự kiến tăng đột biến +35% - 50%.',
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

