import { create } from 'zustand';

export const useDialogStore = create((set) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'alert', // 'alert' | 'confirm'
  confirmText: 'OK',
  cancelText: 'Hủy',
  onConfirm: null,
  onCancel: null,

  // Simple Alert (Only OK button)
  showAlert: (title, message, confirmText = 'OK') => set({
    isOpen: true,
    title,
    message,
    type: 'alert',
    confirmText,
    onConfirm: null,
    onCancel: null
  }),

  // Confirmation Box (Confirm and Cancel buttons)
  showConfirm: (title, message, onConfirm, confirmText = 'Xác nhận', cancelText = 'Hủy', onCancel = null) => set({
    isOpen: true,
    title,
    message,
    type: 'confirm',
    confirmText,
    cancelText,
    onConfirm,
    onCancel
  }),

  closeDialog: () => set({ isOpen: false })
}));
