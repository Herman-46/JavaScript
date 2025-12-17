import React, { useState, useEffect, Suspense } from 'react';
import { Calendar as CalendarIcon, User, Sparkles, Instagram, ChevronLeft, ChevronRight, Image as ImageIcon, Heart, Lock, LogOut, X, AlertCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';

// --- 1. Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyAZTqe0LbWUoqFDHPQ7JK9BckI5tJEJr9A",
  authDomain: "jm-nail-booking.firebaseapp.com",
  projectId: "jm-nail-booking",
  storageBucket: "jm-nail-booking.firebasestorage.app",
  messagingSenderId: "704128488448",
  appId: "1:704128488448:web:1759bde47b2fae188d74e5",
  measurementId: "G-GW0J0BQCWY"
};

let auth, db;
let initError = null;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  initError = error.message;
}

const appId = "jm-nail-prod";

// --- 2. 資料設定 ---
const SERVICES = [
  { id: 'support', title: '專屬應援甲 Design', price: 1000, duration: 240, icon: Heart, desc: '依照偶像/角色風格設計。不複製他人作品，滿$1350含設計圖討論。', isStartPrice: true },
  { id: 'custom_pic', title: '帶圖造型 (客製化)', price: 890, duration: 180, icon: ImageIcon, desc: '傳圖報價。依複雜度調整 ($890-1200 up)。', isStartPrice: true },
  { id: 'blind_box', title: '不挑款 (驚喜包)', price: 1050, duration: 150, icon: Sparkles, desc: '可指定色系與避開元素，其餘交給我發揮。', isStartPrice: false },
  { id: 'cat_eye', title: '貓眼 / 單色', price: 850, duration: 120, icon: User, desc: '跳一色免費，多跳每色+$50。', isStartPrice: false },
];

const ADDONS = [
  { id: 'remove_our', title: '本店卸甲續作', price: 150 },
  { id: 'remove_other', title: '他店卸甲續作', price: 250 },
  { id: 'extension', title: '延甲 (每指 $80)', price: 80, isCount: true },
];

const FIXED_SLOTS = ['10:00', '14:00', '18:00'];

// --- 3. 日期邏輯 (20號規則) ---
const getMaxAllowedDate = () => {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth(); 
  const currentYear = now.getFullYear();

  let targetYear = currentYear;
  let targetMonth = currentMonth; 

  // 若今日 >= 20 號，則開放到「下個月底」
  if (currentDay >= 20) {
    targetMonth = currentMonth + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }
  // 回傳該月最後一天的 Date 物件
  return new Date(targetYear, targetMonth + 1, 0); 
};

// --- 4. 共用元件 ---

const ServiceCard = ({ item, isSelected, onClick }) => (
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
        <item.icon size={24} />
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

// --- 5. 全新客製化日曆元件 (給客人用的) ---
const BookingCalendar = ({ selectedDate, onDateSelect, blockedDates, appointments }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const maxDate = getMaxAllowedDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const renderDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // 空格填補
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-12 w-full"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      // 檢查是否過期或超過預約期限
      const isPast = dateObj < today;
      const isTooFar = dateObj > maxDate;
      
      // 檢查是否被後台封鎖 (公休)
      const blockStatus = blockedDates[dateStr];
      const isFullDayOff = blockStatus === 'ALL';
      
      // 檢查是否已滿
      const dayAppts = appointments.filter(a => a.date === dateStr && a.status !== 'cancelled');
      const isFullyBooked = dayAppts.length >= FIXED_SLOTS.length;

      // 檢查特定時段是否全部被封鎖
      const isPartialOff = Array.isArray(blockStatus) && blockStatus.length === FIXED_SLOTS.length;

      const isUnselectable = isPast || isTooFar || isFullDayOff || isFullyBooked || isPartialOff;
      const isSelected = selectedDate === dateStr;

      let className = "h-12 w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all relative ";
      
      if (isUnselectable) {
        className += "text-stone-300 bg-stone-50 cursor-not-allowed";
      } else if (isSelected) {
        className += "bg-stone-800 text-white shadow-md transform scale-105 z-10";
      } else {
        className += "bg-white border border-stone-100 text-stone-600 hover:border-rose-300 hover:text-rose-500 cursor-pointer";
      }

      days.push(
        <button 
          key={d} 
          disabled={isUnselectable}
          onClick={() => onDateSelect(dateStr)}
          className={className}
        >
          {d}
          {(isFullDayOff || isFullyBooked || isPartialOff) && !isPast && !isTooFar && (
            <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-red-400 rounded-full"></span>
          )}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeMonth(-1)} disabled={currentDate <= today} className="p-2 hover:bg-stone-100 rounded-full disabled:opacity-30"><ChevronLeft size={20}/></button>
        <h3 className="font-bold text-stone-800 text-lg">
          {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月
        </h3>
        <button onClick={() => changeMonth(1)} disabled={currentDate >= maxDate} className="p-2 hover:bg-stone-100 rounded-full disabled:opacity-30"><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 text-center mb-2 text-xs font-bold text-stone-400">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {renderDays()}
      </div>
      <div className="mt-4 flex justify-center gap-4 text-xs text-stone-400">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-800"></span> 選擇</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-stone-300 bg-white"></span> 可預約</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-200"></span> 額滿/公休</div>
      </div>
    </div>
  );
};

// --- 6. Admin Dashboard (後台) ---
const AdminView = ({ onBack }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState([]);
  const [blockedDates, setBlockedDates] = useState({});
  const [targetApptId, setTargetApptId] = useState(null);

  useEffect(() => {
    if (!db) return;
    const unsubAppt = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'jm_appointments')), (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubBlock = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'jm_blocks')), (snap) => {
      const b = {};
      snap.docs.forEach(d => b[d.id] = d.data().slots);
      setBlockedDates(b);
    });
    return () => { unsubAppt(); unsubBlock(); };
  }, []);

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const toggleBlock = async (d, t = null) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'jm_blocks', d);
    const curr = blockedDates[d];
    if (t) {
      let newSlots = [];
      if (curr === 'ALL') newSlots = []; 
      else if (Array.isArray(curr)) newSlots = curr.includes(t) ? curr.filter(x => x !== t) : [...curr, t];
      else newSlots = [t];
      if (newSlots.length === 0) await deleteDoc(ref);
      else await setDoc(ref, { slots: newSlots });
    } else {
      if (curr === 'ALL') await deleteDoc(ref);
      else await setDoc(ref, { slots: 'ALL' });
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} className="h-14 bg-stone-50/50 border border-stone-100"></div>);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = selectedDate === dateStr;
      const blockStatus = blockedDates[dateStr];
      const dayAppts = appointments.filter(a => a.date === dateStr && a.status !== 'cancelled');
      
      let bg = 'bg-white';
      if (blockStatus === 'ALL') bg = 'bg-red-50';
      else if (dayAppts.length >= FIXED_SLOTS.length) bg = 'bg-stone-100';
      else if (Array.isArray(blockStatus) && blockStatus.length > 0) bg = 'bg-orange-50';

      days.push(
        <div key={d} onClick={() => setSelectedDate(dateStr)} className={`h-14 border border-stone-100 p-1 cursor-pointer flex flex-col justify-between ${bg} ${isSelected ? 'ring-2 ring-rose-400 z-10' : ''}`}>
          <div className="flex justify-between"><span className={`text-sm ml-1 ${isSelected ? 'text-rose-600 font-bold' : 'text-stone-600'}`}>{d}</span></div>
          <div className="text-[10px] text-center text-stone-400">{dayAppts.length > 0 && `${dayAppts.length} 預約`}</div>
        </div>
      );
    }
    return days;
  };

  const selectedDateAppts = appointments.filter(a => a.date === selectedDate).sort((a,b) => a.time.localeCompare(b.time));

  return (
    <div className="min-h-screen bg-stone-100 pb-20">
      <div className="bg-stone-800 text-stone-200 p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg"><span className="font-bold tracking-widest flex items-center gap-2"><Lock size={16}/> 後台管理</span><button onClick={async()=>{await signOut(auth);await signInAnonymously(auth);onBack()}} className="text-xs border border-stone-600 px-3 py-1 rounded hover:bg-stone-700 flex items-center gap-1"><LogOut size={12}/> 登出</button></div>
      <div className="max-w-5xl mx-auto p-4 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex justify-between items-center mb-4 px-2"><button onClick={() => changeMonth(-1)}><ChevronLeft/></button><h2 className="font-bold">{currentDate.getFullYear()} / {currentDate.getMonth()+1}</h2><button onClick={() => changeMonth(1)}><ChevronRight/></button></div>
            <div className="grid grid-cols-7 text-center mb-2 text-xs font-bold text-stone-400">{['日','一','二','三','四','五','六'].map(d=><div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 bg-stone-100 gap-[1px] border border-stone-200">{renderCalendar()}</div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <h3 className="font-bold mb-3 border-b pb-2">{selectedDate} 設定</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-stone-50 p-3 rounded-lg"><span className="text-sm">全日狀態</span><button onClick={() => toggleBlock(selectedDate)} className={`px-4 py-1 rounded-full text-xs font-bold ${blockedDates[selectedDate]==='ALL'?'bg-red-500 text-white':'bg-green-100 text-green-700'}`}>{blockedDates[selectedDate]==='ALL'?'⛔ 已設公休':'✅ 營業中'}</button></div>
              {blockedDates[selectedDate]!=='ALL' && <div className="grid grid-cols-3 gap-2">{FIXED_SLOTS.map(slot => { const isBlocked = Array.isArray(blockedDates[selectedDate]) && blockedDates[selectedDate].includes(slot); return (<button key={slot} onClick={()=>toggleBlock(selectedDate, slot)} className={`py-2 rounded text-xs border ${isBlocked?'bg-stone-200 line-through text-stone-400':'bg-white hover:border-rose-300'}`}>{slot}</button>) })}</div>}
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm min-h-[200px]">
            <h3 className="font-bold mb-4">預約清單 ({selectedDateAppts.length})</h3>
            <div className="space-y-2">{selectedDateAppts.map(app=>(<div key={app.id} className="border p-3 rounded-xl bg-stone-50/50"><div className="flex justify-between mb-1"><span className="font-bold">{app.time}</span><span className={`text-[10px] px-2 rounded ${app.status==='cancelled'?'bg-red-100 text-red-600':'bg-green-100 text-green-600'}`}>{app.status}</span></div><div className="text-sm">{app.client.name} <span className="text-xs text-stone-400">({app.serviceName})</span></div>{app.status!=='cancelled' && <button onClick={async()=>{if(confirm('取消?'))await updateDoc(doc(db,'artifacts',appId,'public','data','jm_appointments',app.id),{status:'cancelled'})}} className="text-xs text-red-400 mt-2 hover:underline">取消預約</button>}</div>))}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 7. Main App ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [step, setStep] = useState(1);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [blockedDates, setBlockedDates] = useState({});
  const [selectedService, setSelectedService] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [extensionCount, setExtensionCount] = useState(0);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [info, setInfo] = useState({ name: '', phone: '', line: '', note: '' });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => { if (auth && !auth.currentUser) await signInAnonymously(auth); };
    init();
    if(auth) onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const q1 = query(collection(db, 'artifacts', appId, 'public', 'data', 'jm_appointments'));
    const unsub1 = onSnapshot(q1, (snap) => setAppointments(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const q2 = query(collection(db, 'artifacts', appId, 'public', 'data', 'jm_blocks'));
    const unsub2 = onSnapshot(q2, (snap) => setBlockedDates(snap.docs.reduce((acc, d) => ({...acc, [d.id]: d.data().slots}), {})));
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const isBooked = (d, t) => {
    const isAppt = appointments.some(a => a.date === d && a.time === t && a.status !== 'cancelled');
    const blockType = blockedDates[d];
    return isAppt || blockType === 'ALL' || (Array.isArray(blockType) && blockType.includes(t));
  };

  const submitBooking = async () => {
    if (!user || !db) return;
    setLoading(true);
    let total = selectedService.price;
    if (selectedAddons.includes('remove_our')) total += 150;
    if (selectedAddons.includes('remove_other')) total += 250;
    total += (extensionCount * 80);

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jm_appointments'), {
        serviceName: selectedService.title,
        price: total,
        isStartPrice: selectedService.isStartPrice,
        addons: selectedAddons,
        extensionCount,
        date, time, client: info,
        status: 'pending', createdAt: new Date().toISOString()
      });
      setView('success');
    } catch(e) { alert('預約失敗'); }
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    try { await signInWithEmailAndPassword(auth, adminEmail, adminPassword); setView('admin'); } catch (e) { alert('登入失敗'); }
  };

  if (view === 'admin') return <AdminView onBack={() => setView('home')} />;
  if (view === 'adminLogin') return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
        <h2 className="text-xl font-serif text-stone-800 mb-6">JM Studio Access</h2>
        <input type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} className="w-full p-3 bg-stone-50 rounded mb-2 text-center border outline-none" placeholder="Email" />
        <input type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} className="w-full p-3 bg-stone-50 rounded mb-4 text-center border outline-none" placeholder="Password" />
        <button onClick={handleAdminLogin} className="w-full py-3 bg-stone-800 text-white rounded font-bold">LOGIN</button>
        <button onClick={() => setView('home')} className="mt-4 text-xs text-stone-400">Back Home</button>
      </div>
    </div>
  );
  if (view === 'success') return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6 text-rose-500 animate-pulse"><Heart fill="currentColor" size={40} /></div>
      <h2 className="text-3xl font-serif text-stone-800 mb-4">預約申請已送出</h2>
      <p className="text-stone-500 mb-8 max-w-xs leading-relaxed">請記得至官方 Line 確認最終報價，才算完成預約喔！</p>
      <button onClick={() => window.location.reload()} className="text-stone-400 hover:text-stone-800 underline underline-offset-4">返回首頁</button>
    </div>
  );

  // Booking Flow
  if (view === 'booking') return (
    <div className="min-h-screen bg-[#FDFCF8] pb-24">
      <div className="sticky top-0 bg-white/80 backdrop-blur-md p-4 flex justify-between items-center z-20 border-b border-stone-100">
        <button onClick={() => step > 1 ? setStep(step-1) : setView('home')} className="p-2 text-stone-500 hover:bg-stone-50 rounded-full"><ChevronLeft /></button>
        <div className="text-sm font-bold text-stone-800 tracking-widest">{step === 1 ? '預約須知' : step === 2 ? '選擇服務' : step === 3 ? '選擇時間' : '資料確認'}</div>
        <div className="w-10"></div>
      </div>
      <div className="max-w-md mx-auto p-6">
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 space-y-4 text-sm text-stone-600 leading-relaxed">
                <h3 className="font-bold text-lg mb-2 text-stone-800">JM Nail 預約須知</h3>
                <p>1. 完美主義者請繞道，請勿拿他店作品要求完全複製。</p>
                <p>2. 操作時間約 3-4 小時，趕時間者請斟酌。</p>
                <p>3. 取消請於 2 天前告知。當天取消或無故未到將列入黑名單。</p>
                <p>4. 不接待病甲，若現場發現需卸甲，將加收清潔費 $650。</p>
             </div>
             <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-xl cursor-pointer hover:bg-stone-100 transition"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="accent-rose-500 w-5 h-5"/><span className="text-stone-600 font-medium text-sm">我已詳閱並同意以上規則</span></label>
             <button disabled={!agreed} onClick={() => setStep(2)} className={`w-full py-4 rounded-full font-bold text-white transition-all ${agreed ? 'bg-stone-800 shadow-lg' : 'bg-stone-200 cursor-not-allowed'}`}>開始預約</button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid gap-4">{SERVICES.map(s => <ServiceCard key={s.id} item={s} isSelected={selectedService?.id === s.id} onClick={() => setSelectedService(s)} />)}</div>
            {selectedService && (
              <div className="mt-8 pt-8 border-t border-stone-100 space-y-3">
                <h3 className="font-bold text-stone-700 mb-2 flex items-center gap-2"><Sparkles size={16}/> 加購項目</h3>
                {ADDONS.filter(a => !a.isCount).map(addon => { const active = selectedAddons.includes(addon.id); return (<div key={addon.id} onClick={() => { const other = addon.id === 'remove_our' ? 'remove_other' : 'remove_our'; let next = selectedAddons.filter(x => x !== other); if (active) next = next.filter(x => x !== addon.id); else next.push(addon.id); setSelectedAddons(next); }} className={`p-4 rounded-lg border flex justify-between items-center cursor-pointer transition ${active ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200 text-stone-600'}`}><span>{addon.title}</span><span>+${addon.price}</span></div>) })}
                <div className={`p-4 rounded-lg border flex justify-between items-center ${extensionCount > 0 ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200'}`}><span>延甲 (每指 $80)</span><div className="flex items-center gap-3 bg-white/10 rounded-lg p-1"><button onClick={() => setExtensionCount(Math.max(0, extensionCount - 1))} className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-800">-</button><span className="w-4 text-center">{extensionCount}</span><button onClick={() => setExtensionCount(Math.min(10, extensionCount + 1))} className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-800">+</button></div></div>
              </div>
            )}
             <button disabled={!selectedService} onClick={() => setStep(3)} className={`w-full mt-6 py-4 rounded-full font-bold text-white transition-all ${selectedService ? 'bg-stone-800 shadow-lg' : 'bg-stone-200 cursor-not-allowed'}`}>下一步</button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
             <div className="text-center mb-4 text-stone-500 text-sm">
               請選擇預約日期
               <div className="text-xs text-stone-400 mt-1">(每月 20 號開放下月時段)</div>
             </div>
             
             {/* ★ 全新改版：客人端日曆 ★ */}
             <BookingCalendar 
               selectedDate={date}
               onDateSelect={(d) => { setDate(d); setTime(''); }}
               blockedDates={blockedDates}
               appointments={appointments}
             />

             {date && (
               <div className="mt-6 animate-fade-in">
                 <h4 className="font-bold text-stone-700 mb-3 text-center">選擇 {date} 時段</h4>
                 <div className="grid grid-cols-3 gap-3">
                   {FIXED_SLOTS.map(s => {
                     const disabled = isBooked(date, s);
                     return (
                       <button 
                         key={s} 
                         disabled={disabled} 
                         onClick={() => setTime(s)} 
                         className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                           disabled 
                             ? 'bg-stone-50 text-stone-300 cursor-not-allowed border-transparent' 
                             : time === s 
                               ? 'bg-stone-800 text-white shadow-lg border-stone-800 transform scale-105' 
                               : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300 hover:text-rose-500'
                         }`}
                       >
                         <span className="text-lg font-serif font-bold">{s}</span>
                         <span className="text-[10px] mt-1">{disabled ? '額滿' : '可預約'}</span>
                       </button>
                     )
                   })}
                 </div>
               </div>
             )}
             
             <button disabled={!date || !time} onClick={() => setStep(4)} className={`w-full mt-8 py-4 rounded-full font-bold text-white transition-all ${date && time ? 'bg-stone-800 shadow-lg' : 'bg-stone-200 cursor-not-allowed'}`}>下一步</button>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 space-y-4">
                <input placeholder="真實姓名" value={info.name} onChange={e => setInfo({...info, name: e.target.value})} className="w-full p-3 bg-stone-50 rounded-lg outline-none"/>
                <input placeholder="聯絡電話" type="tel" value={info.phone} onChange={e => setInfo({...info, phone: e.target.value})} className="w-full p-3 bg-stone-50 rounded-lg outline-none"/>
                <input placeholder="Line ID (傳圖用)" value={info.line} onChange={e => setInfo({...info, line: e.target.value})} className="w-full p-3 bg-stone-50 rounded-lg outline-none"/>
                <textarea placeholder="備註..." value={info.note} onChange={e => setInfo({...info, note: e.target.value})} className="w-full p-3 bg-stone-50 rounded-lg outline-none h-24"/>
             </div>
             <div className="bg-stone-100 p-6 rounded-2xl space-y-2 text-stone-600 text-sm">
                <div className="flex justify-between"><span>{selectedService.title}</span><span>${selectedService.price}</span></div>
                {selectedAddons.includes('remove_our') && <div className="flex justify-between"><span>本店卸甲</span><span>+150</span></div>}
                {selectedAddons.includes('remove_other') && <div className="flex justify-between"><span>他店卸甲</span><span>+250</span></div>}
                {extensionCount > 0 && <div className="flex justify-between"><span>延甲 x{extensionCount}</span><span>+{extensionCount*80}</span></div>}
                <div className="border-t border-stone-200 pt-3 mt-2 flex justify-between items-center"><span className="font-bold text-stone-800">總金額</span><span className="font-serif text-2xl text-rose-600 font-bold">${selectedService.price + (selectedAddons.includes('remove_our')?150:0) + (selectedAddons.includes('remove_other')?250:0) + (extensionCount*80)}</span></div>
             </div>
             <button disabled={!info.name || !info.phone || !info.line || loading} onClick={submitBooking} className={`w-full py-4 rounded-full font-bold text-white transition-all shadow-xl ${loading ? 'bg-stone-400' : 'bg-stone-800 hover:bg-stone-700'}`}> {loading ? '送出中...' : '確認預約'}</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-rose-100 rounded-full blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-stone-200 rounded-full blur-3xl opacity-30 translate-x-1/3 translate-y-1/3"></div>
      <div className="relative z-10 animate-fade-in-up w-full max-w-md flex flex-col items-center">
        <div className="mb-6 w-48 h-48 rounded-full bg-cream-100 shadow-sm overflow-hidden border-4 border-white relative flex items-center justify-center">
          <img src="/logo.jpg" alt="JM Nail Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}/>
          <div className="absolute inset-0 bg-stone-100 hidden flex-col items-center justify-center text-stone-400"><span className="text-4xl">🐹</span><span className="text-xs font-bold mt-2">JM NAIL</span></div>
        </div>
        <h1 className="text-5xl font-serif text-stone-800 mb-2 tracking-wide">JM Nail</h1>
        <p className="text-stone-500 font-light tracking-[0.2em] mb-4 text-sm uppercase">Support Nails & Design</p>
        <div className="text-center text-stone-500 text-sm mb-6 space-y-1"><p className="font-medium text-stone-700">台北萬隆 · 獨立工作室</p><p>每一副指甲都是專屬的紀念品</p><p>我們提供客製化設計、舒適的環境</p><p className="text-xs mt-2 text-stone-400">目前為一人工作室，請提前預約</p></div>
        <button onClick={() => { setStep(1); setView('booking'); }} className="w-4/5 py-4 bg-stone-800 text-white rounded-full text-lg shadow-xl hover:bg-stone-700 transition-all transform hover:-translate-y-1 tracking-widest mb-8">立即預約</button>
        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-rose-100 w-full mb-8 text-left"><h3 className="text-rose-500 font-bold mb-3 flex items-center gap-2 text-sm"><Sparkles size={16}/> 近期優惠</h3><ul className="text-sm text-stone-600 space-y-2 list-disc pl-4 marker:text-rose-300"><li>新客優惠 95 折 / 學生 9 折</li><li>當月壽星折抵 $50</li><li>社群分享標記再折 $50</li></ul></div>
        <div className="flex gap-6 justify-center text-stone-400"><a href="https://www.instagram.com/jmmm_nail?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener noreferrer" className="hover:text-rose-500 transition"><Instagram size={20} /></a><button onClick={() => setView('adminLogin')} className="hover:text-rose-500 transition"><Lock size={20} /></button></div>
      </div>
    </div>
  );
}