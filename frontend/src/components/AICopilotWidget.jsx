'use client';

import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import api from '@/lib/api';

const QUICK_PROMPTS = [
  { icon: Package, text: 'Kiểm tra tồn kho bia Tiger & thịt heo CP' },
  { icon: AlertTriangle, text: 'Lô hàng nào sắp hết hạn trong 30 ngày?' },
  { icon: CloudRain, text: 'Phân tích rủi ro thời tiết & chuỗi cung ứng' },
  { icon: TrendingUp, text: 'Báo cáo tổng quan tình trạng kho hôm nay' },
];

export default function AICopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: `👋 **Xin chào! Tôi là Trợ lý AI Thủ kho (WMS Copilot).**\n\nTôi được kết nối trực tiếp với **Cơ sở dữ liệu kho hàng thời gian thực** và **Tri thức chuỗi cung ứng Việt Nam**.\n\nBạn có thể hỏi tôi bất kỳ điều gì: tra cứu tồn kho, tìm số lô hạn dùng FEFO, hoặc tư vấn rủi ro bão lũ, mùa vụ!`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Báo cáo nhanh tồn kho hôm nay',
        'Lô hàng nào sắp hết hạn trong 30 ngày?',
        'Tồn kho bia Tiger và thịt CP thế nào?',
        'Tư vấn rủi ro chuỗi cung ứng cuối tuần',
      ],
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
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${prev.length + 1}`,
          sender: 'bot',
          text: res.data?.reply || 'Tôi đã tiếp nhận thông tin.',
          time: 'Vừa xong',
          suggestions: res.data?.suggestions || [],
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
        text: 'Cuộc trò chuyện đã được làm mới. Bạn cần hỗ trợ tra cứu dữ liệu kho nào tiếp theo?',
        time: 'Vừa xong',
        suggestions: [
          'Báo cáo nhanh tồn kho hôm nay',
          'Lô hàng nào sắp hết hạn trong 30 ngày?',
          'Tư vấn rủi ro chuỗi cung ứng cuối tuần',
        ],
      },
    ]);
  };

  // Helper render markdown đơn giản: bold (**text**), code (`text`), list (* item)
  const renderFormattedText = (raw) => {
    if (!raw) return '';
    const lines = raw.split('\n');

    return lines.map((line, lIdx) => {
      // Parse inline formatting: **bold** and `code`
      const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);

      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-semibold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={pIdx} className="rounded bg-purple-100 px-1 py-0.5 font-mono text-xs text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

      return (
        <span key={lIdx} className="block leading-relaxed">
          {formattedLine}
        </span>
      );
    });
  };

  return (
    <>
      {/* ── Nút nổi mở Chatbot (Góc dưới bên phải) ── */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 p-3.5 text-white shadow-2xl shadow-purple-500/40 transition-all duration-300 hover:scale-105 hover:shadow-purple-500/60 active:scale-95"
            aria-label="Mở Trợ lý AI Thủ kho"
          >
            <div className="relative">
              <Bot className="h-6 w-6" />
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
            </div>
            <span className="hidden pr-2 text-sm font-bold md:inline">Trợ lý AI Thủ kho</span>
          </button>
        </div>
      )}

      {/* ── Cửa sổ Chatbot nổi ── */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[600px] max-h-[85vh] w-[95vw] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-purple-200/80 bg-white shadow-2xl ring-1 ring-black/5 dark:border-purple-900/60 dark:bg-slate-900 dark:ring-white/10">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-700 to-cyan-600 p-4 text-white dark:border-purple-900">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
                <Sparkles className="h-5 w-5 text-cyan-200" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-purple-800" />
              </div>
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
                  Trợ lý AI Thủ kho (Copilot)
                </h3>
                <p className="text-[11px] text-purple-100/80">
                  Gemini 2.0 • Database Realtime
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                title="Làm mới cuộc trò chuyện"
                className="rounded-lg p-1.5 text-purple-100/80 transition hover:bg-white/10 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Thu nhỏ"
                className="rounded-lg p-1.5 text-purple-100/80 transition hover:bg-white/10 hover:text-white"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Đóng"
                className="rounded-lg p-1.5 text-purple-100/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar (Hiển thị khi mới mở) */}
          <div className="border-b border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Gợi ý hỏi nhanh:
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              {QUICK_PROMPTS.map((prompt, i) => {
                const IconComponent = prompt.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt.text)}
                    disabled={loading}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-purple-200/60 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-900/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-purple-950/40"
                  >
                    <IconComponent className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                    <span className="truncate max-w-[170px]">{prompt.text}</span>
                  </button>
                );
              })}
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

                {/* Suggestion Chips đính kèm dưới tin nhắn của Bot */}
                {m.sender === 'bot' && m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                    {m.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
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
                  <span className="text-xs font-medium">Đang tra cứu dữ liệu kho & phân tích...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi về tồn kho, hạn dùng, rủi ro bão lũ..."
                disabled={loading}
                className="flex-1 bg-transparent px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100"
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputText.trim() || loading}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500">
              AI tra cứu trực tiếp dữ liệu PostgreSQL & Thuật toán FEFO
            </p>
          </div>
        </div>
      )}
    </>
  );
}

