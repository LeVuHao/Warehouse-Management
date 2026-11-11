'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Minimize2,
  Trash2,
  Loader2,
  Package,
  AlertTriangle,
  TrendingUp,
  CloudRain,
  ChevronRight,
  HelpCircle,
  Zap,
  ArrowRight,
  Sun,
  CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import { useScenarioStore, SCENARIO_CONFIGS } from '@/store/useScenarioStore';

export default function AICopilotWidget() {
  const router = useRouter();
  const { currentScenario, config } = useScenarioStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: `👋 **Xin chào! Tôi là Trợ lý AI Thủ kho (WMS Copilot).**\n\nTôi được kết nối trực tiếp với **Cơ sở dữ liệu kho hàng thời gian thực** và **Bộ giả lập bối cảnh Logistics Việt Nam**.\n\nBạn có thể hỏi tôi bất kỳ điều gì: tra cứu tồn kho, tìm số lô hạn dùng FEFO, hoặc tư vấn kịch bản rủi ro mưa bão, mùa vụ!`,
      time: 'Vừa xong',
      suggestions: [
        'Báo cáo nhanh tồn kho hôm nay',
        'Lô hàng nào sắp hết hạn trong 30 ngày?',
        'Tồn kho bia Tiger và thịt CP thế nào?',
        'Tư vấn rủi ro chuỗi cung ứng',
      ],
      actions: [],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (messageToSend) => {
    const text = (messageToSend || inputText).trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${prev.length + 1}`,
        sender: 'user',
        text,
        time: 'Vừa xong',
      },
    ]);
    setInputText('');
    setLoading(true);

    try {
      // Chuẩn bị lịch sử trò chuyện gần nhất
      const historyPayload = messages.slice(-6).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const res = await api.post('/chat', {
        message: text,
        history: historyPayload,
        scenario: currentScenario,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${prev.length + 1}`,
          sender: 'bot',
          text: res.data?.reply || 'Tôi đã tiếp nhận thông tin.',
          time: 'Vừa xong',
          suggestions: res.data?.suggestions || [],
          actions: res.data?.actions || [],
        },
      ]);
    } catch (error) {
      console.error('AICopilot error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${prev.length + 1}`,
          sender: 'bot',
          text: '⚠️ Không thể kết nối với máy chủ AI. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau giây lát.',
          time: 'Vừa xong',
          suggestions: ['Báo cáo nhanh tồn kho hôm nay'],
          actions: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'reset-msg',
        sender: 'bot',
        text: `Cuộc trò chuyện đã được làm mới. Hệ thống hiện đang chạy theo kịch bản: **${config.label}**. Bạn cần tra cứu điều gì tiếp theo?`,
        time: 'Vừa xong',
        suggestions: config.suggestedQuestions || [
          'Báo cáo nhanh tồn kho hôm nay',
          'Lô hàng nào sắp hết hạn trong 30 ngày?',
          'Tư vấn rủi ro chuỗi cung ứng',
        ],
        actions: [],
      },
    ]);
  };

  // Xử lý Hành động 1-Click (1-Click Actionable Execution)
  const handleExecuteAction = (action) => {
    if (!action || !action.draftData) return;

    if (action.type === 'create_import') {
      localStorage.setItem('replenishmentDraft', JSON.stringify(action.draftData));
      setIsOpen(false);
      router.push('/dashboard/imports/new?draft=replenishment');
    } else if (action.type === 'create_export') {
      localStorage.setItem('liquidationDraft', JSON.stringify(action.draftData));
      setIsOpen(false);
      router.push('/dashboard/exports/new?draft=liquidation');
    }
  };

  // Helper format text markdown cơ bản
  const renderFormattedText = (raw) => {
    if (!raw) return null;
    return raw.split('\n').map((line, idx) => {
      let content = line;
      // In đậm **text**
      const boldParts = content.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={idx} className="min-h-[1.25rem] leading-relaxed">
          {boldParts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-slate-900 dark:text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code key={pIdx} className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[11px] text-purple-700 dark:bg-slate-800 dark:text-purple-300">
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end print:hidden">
      {/* Cửa sổ chat AI */}
      {isOpen && (
        <div className="mb-4 flex h-[620px] max-h-[85vh] w-[92vw] max-w-[440px] flex-col overflow-hidden rounded-3xl border border-purple-500/30 bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-purple-500/30 dark:bg-slate-900/95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-purple-500/20 bg-gradient-to-r from-purple-700 via-indigo-700 to-cyan-700 px-4 py-3.5 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 shadow-inner ring-1 ring-white/30 backdrop-blur-md">
                <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-purple-900"></span>
                </span>
              </div>
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
                  Trợ lý AI Thủ kho (Copilot)
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-purple-100/90">
                  <span>Gemini 2.0</span>
                  <span>•</span>
                  <span className="rounded bg-white/20 px-1.5 py-0.2 font-medium">
                    {config.shortLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearChat}
                title="Làm mới cuộc trò chuyện"
                className="rounded-lg p-1.5 text-purple-100/80 transition hover:bg-white/10 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Thu nhỏ"
                className="rounded-lg p-1.5 text-purple-100/80 transition hover:bg-white/10 hover:text-white"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng"
                className="rounded-lg p-1.5 text-purple-100/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Context Banner */}
          <div className="border-b border-purple-500/10 bg-purple-50/50 px-3.5 py-1.5 text-[11px] text-purple-900 dark:bg-purple-950/30 dark:text-purple-200 flex items-center justify-between">
            <span className="truncate max-w-[280px]">
              🌐 Ngữ cảnh: <strong>{config.label}</strong>
            </span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
              Lead time x{config.leadTimeMultiplier}
            </span>
          </div>

          {/* Quick Prompts Bar */}
          <div className="border-b border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Gợi ý hỏi nhanh:
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              {(config.suggestedQuestions || [
                'Báo cáo nhanh tồn kho hôm nay',
                'Lô hàng nào sắp hết hạn trong 30 ngày?',
                'Tư vấn rủi ro chuỗi cung ứng',
              ]).map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(promptText)}
                  disabled={loading}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-purple-200/60 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-900/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-purple-950/40"
                >
                  <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span className="truncate max-w-[210px]">{promptText}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 shadow-sm ${
                    m.sender === 'user'
                      ? 'rounded-br-none bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                      : 'rounded-bl-none border border-slate-100 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100'
                  }`}
                >
                  {m.sender === 'bot' && (
                    <div className="mb-1.5 flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
                      <Bot className="h-3.5 w-3.5" />
                      <span>Thủ kho AI</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    {renderFormattedText(m.text)}
                  </div>

                  <span
                    className={`mt-1.5 block text-right text-[10px] ${
                      m.sender === 'user' ? 'text-purple-200' : 'text-slate-400'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>

                {/* Khối Hành Động 1-Click (1-Click Action Cards) */}
                {m.sender === 'bot' && m.actions && m.actions.length > 0 && (
                  <div className="mt-2.5 w-full max-w-[88%] space-y-2">
                    {m.actions.map((act) => (
                      <div
                        key={act.id}
                        className="rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-900 to-slate-950 p-3.5 text-white shadow-xl ring-1 ring-cyan-500/20"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                          <Zap className="h-4 w-4 animate-bounce text-amber-400" />
                          <span>{act.title}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                          {act.description}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleExecuteAction(act)}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-md transition hover:from-cyan-400 hover:to-indigo-500 active:scale-[0.98]"
                        >
                          <span>Bấm để tạo ngay phiếu này</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestion Chips */}
                {m.sender === 'bot' && m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                    {m.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => handleSend(sug)}
                        disabled={loading}
                        className="flex items-center gap-1 rounded-lg border border-purple-200/80 bg-purple-50/70 px-2 py-1 text-[11px] text-purple-700 transition hover:bg-purple-100 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/40"
                      >
                        <ChevronRight className="h-2.5 w-2.5" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-none border border-purple-200 bg-purple-50/80 px-4 py-3 text-purple-700 shadow-sm dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-300">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span className="text-xs font-medium">Đang truy vấn CSDL & phân tích bối cảnh...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800/80">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi về tồn kho, hạn dùng, bão lũ..."
                disabled={loading}
                className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputText.trim() || loading}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              AI tra cứu trực tiếp PostgreSQL & Thuật toán FEFO
            </p>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 text-white shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-purple-500/30 active:scale-95"
        title="Mở Trợ lý AI Thủ kho (WMS Copilot)"
      >
        <Sparkles className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex h-4 w-4 rounded-full bg-cyan-500 ring-2 ring-white dark:ring-slate-900"></span>
        </span>
      </button>
    </div>
  );
}
