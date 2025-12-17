import React from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
        <h3 className="text-lg font-bold text-stone-800 mb-2">{title}</h3>
        <p className="text-stone-500 mb-6 text-sm">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50">取消</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600">確定執行</button>
        </div>
      </div>
    </div>
  );
}