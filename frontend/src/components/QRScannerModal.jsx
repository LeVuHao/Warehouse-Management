'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const scannerRef = useRef(null);
  const isStartedRef = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    isStartedRef.current = false;

    // Use a small timeout to ensure the DOM element "qr-reader" is rendered
    const timer = setTimeout(() => {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        },
        (decodedText) => {
          if (isStartedRef.current) {
            isStartedRef.current = false;
            scanner.stop().then(() => {
              onScanSuccess(decodedText);
            }).catch(console.error);
          }
        },
        (errorMessage) => {
          // Ignore frequent scan failures
        }
      ).then(() => {
        isStartedRef.current = true;
      }).catch((err) => {
        console.error("Camera error:", err);
        setError('Không thể kết nối với Camera. Vui lòng cấp quyền hoặc kiểm tra thiết bị của bạn.');
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current && isStartedRef.current) {
        isStartedRef.current = false;
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [isOpen, onScanSuccess]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (scannerRef.current && isStartedRef.current) {
      isStartedRef.current = false;
      scannerRef.current.stop().then(onClose).catch(() => onClose());
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Camera className="h-5 w-5 text-indigo-500" />
            <h3 className="font-bold">Quét mã QR Sản phẩm</h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {error}
            </div>
          )}
          
          <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 relative">
            {!error && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 animate-pulse">Đang tải Camera...</div>}
            <div id="qr-reader" className="w-full relative z-10 min-h-[250px]"></div>
          </div>
          
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Đưa mã QR của sản phẩm vào khung hình để quét tự động.
          </p>
        </div>
      </div>
    </div>
  );
}
