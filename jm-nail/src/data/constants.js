import { User, Sparkles, Image as ImageIcon, Heart } from 'lucide-react';

export const SERVICES = [
  { id: 'support', title: '專屬應援甲 Design', price: 1000, duration: 240, icon: Heart, desc: '依照偶像/角色風格設計。不複製他人作品，滿$1350含設計圖討論。', isStartPrice: true },
  { id: 'custom_pic', title: '帶圖造型 (客製化)', price: 890, duration: 180, icon: ImageIcon, desc: '傳圖報價。依複雜度調整 ($890-1200 up)。', isStartPrice: true },
  { id: 'blind_box', title: '不挑款 (驚喜包)', price: 1050, duration: 150, icon: Sparkles, desc: '可指定色系與避開元素，其餘交給我發揮。', isStartPrice: false },
  { id: 'cat_eye', title: '貓眼 / 單色', price: 850, duration: 120, icon: User, desc: '跳一色免費，多跳每色+$50。', isStartPrice: false },
];

export const ADDONS = [
  { id: 'remove_our', title: '本店卸甲續作', price: 150 },
  { id: 'remove_other', title: '他店卸甲續作', price: 250 },
  { id: 'extension', title: '延甲 (每指 $80)', price: 80, isCount: true },
];

export const FIXED_SLOTS = ['10:00', '14:00', '18:00'];