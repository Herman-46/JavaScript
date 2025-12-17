import React from 'react';

export default function ServiceCard({ item, isSelected, onClick }) {
  const Icon = item.icon;
  return (
    <div 
      onClick={onClick}
      className={`p-5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
        isSelected 
          ? 'border-rose-400 bg-rose-50 shadow-md' 
          : 'border-stone-200 bg-white hover:border-rose-200'
      }`}
    >
      {item.id === 'support' && (
        <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold">
          主打推薦
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full shrink-0 ${isSelected ? 'bg-rose-200 text-rose-700' : 'bg-stone-100 text-stone-500 group-hover:bg-rose-50 group-hover:text-rose-400'}`}>
          <Icon size={24} />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-stone-800 text-lg">{item.title}</h3>
            <div className="text-right">
              <span className="block font-bold text-rose-600 text-lg">
                ${item.price}{item.isStartPrice && <span className="text-xs text-rose-400">+</span>}
              </span>
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">{item.desc}</p>
        </div>
      </div>
    </div>
  );
}