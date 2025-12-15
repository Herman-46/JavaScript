import React, { useState, useEffect } from 'react';
import { Calendar, User, Sparkles, Instagram, ChevronLeft, Image as ImageIcon, Heart, Lock, LogOut, X, AlertCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAZTqe0LbWUoqFDHPQ7JK9BckI5tJEJr9A",
  authDomain: "jm-nail-booking.firebaseapp.com",
  projectId: "jm-nail-booking",
  storageBucket: "jm-nail-booking.firebasestorage.app",
  messagingSenderId: "704128488448",
  appId: "1:704128488448:web:1759bde47b2fae188d74e5",
  measurementId: "G-GW0J0BQCWY"
};

// --- Initialize Firebase (Safe Mode) ---
// 使用 try-catch 避免因 Analytics 未啟用導致網頁白屏
let auth, db;
let initError = null;

try {
  const app = initializeApp(firebaseConfig);
  // 注意：這裡移除了 getAnalytics，因為如果後台沒開通，會導致網頁當機
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Init Error:", error);
  initError = error.message;
}

const appId = "jm-nail-prod";

// --- Data ---
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

// --- Components ---

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

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
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
};

// Admin View
const AdminView = ({ onBack }) => {
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState([]);
  const [blockedDates, setBlockedDates] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [targetApptId, setTargetApptId] = useState(null);

  useEffect(() => {
    if (!db) return;
    const qAppt = query(collection(db, 'artifacts', appId, 'public', 'data', 'jm_appointments'));
    const unsubAppt = onSnapshot(qAppt, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Snapshot Error:", err));
    
    const qBlock = query(collection(db, 'artifacts', appId, 'public', 'data', 'jm_blocks'));
    const unsubBlock = onSnapshot(qBlock, (snap) => {
      const b = {};
      snap.docs.forEach(d => b[d.id] = d.data().slots);
      setBlockedDates(b);
    });
    return () => { unsubAppt(); unsubBlock(); };
  }, []);

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

  const initiateCancel = (id) => {
    setTargetApptId(id);
    setModalOpen(true);
  };

  const executeCancel = async () => {
    if (targetApptId && db) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jm_appointments', targetApptId), { status: 'cancelled' });
      setModalOpen(false);
      setTargetApptId(null);
    }
  };

  const sortedApps = [...appointments].sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="min-h-screen bg-stone-100 pb-20">
      <ConfirmModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onConfirm={executeCancel}
        title="確定取消預約？"
        message="取消後，該時段將釋出給其他客人預約。此操作無法復原。"
      />

      <div className="bg-stone-800 text-stone-200 p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <span className="font-bold tracking-widest flex items-center gap-2"><Lock size={16}/> JM ADMIN</span>
        <button onClick={onBack} className="text-xs border border-stone-600 px-3 py-1 rounded hover:bg-stone-700 flex items-center gap-1">
          <LogOut size={12}/> 登出
        </button>
      </div>

      <div className="p-6 max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Calendar size={18}/> 排班設定</h3>
          <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="w-full p-2 border rounded mb-4"/>
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-stone-50 p-3 rounded-lg">
              <span className="text-sm font-medium">整日狀態</span>
              <button onClick={() => toggleBlock(viewDate)} className={`px-3 py-1 rounded text-xs font-bold transition-all ${blockedDates[viewDate] === 'ALL' ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>
                {blockedDates[viewDate] === 'ALL' ? '🔴 已設公休' : '🟢 營業中'}
              </button>
            </div>
            {blockedDates[viewDate] !== 'ALL' && (
              <div className="grid grid-cols-3 gap-2">
                {FIXED_SLOTS.map(s => {
                  const isB = Array.isArray(blockedDates[viewDate]) && blockedDates[viewDate].includes(s);
                  return (
                    <button key={s} onClick={() => toggleBlock(viewDate, s)} className={`p-2 rounded text-xs border transition-all ${isB ? 'bg-stone-200 text-stone-400 line-through' : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300'}`}>
                      {s}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-stone-800 ml-1">預約列表</h3>
          {sortedApps.length === 0 ? <p className="text-stone-400 text-sm text-center py-4">目前無預約</p> : 
           sortedApps.map(app => (
            <div key={app.id} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 relative overflow-hidden">
              <div className="flex justify-between mb-2">
                <span className="text-xs bg-stone-100 px-2 py-1 rounded font-serif text-stone-600">{app.date} {app.time}</span>
                <span className={`text-xs px-2 py-1 rounded font-bold ${app.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                  {app.status === 'cancelled' ? 'CANCELLED' : 'ACTIVE'}
                </span>
              </div>
              <div className="font-bold text-stone-800 text-lg">{app.client.name}</div>
              <div className="text-sm text-stone-500 mb-2 flex flex-col gap-1">
                <span>Tel: {app.client.phone}</span>
                <span className="text-rose-500 font-medium">Line: {app.client.line}</span>
              </div>
              <div className="text-sm bg-stone-50 p-3 rounded text-stone-600">
                <p className="font-bold">{app.serviceName}</p>
                {app.addons && app.addons.includes('remove_our') && <p>+ 本店卸甲</p>}
                {app.addons && app.addons.includes('remove_other') && <p>+ 他店卸甲</p>}
                {app.extensionCount > 0 && <p>+ 延甲 x{app.extensionCount}</p>}
                <p className="mt-2 pt-2 border-t border-stone-200 text-stone-400 text-xs">{app.client.note || '無備註'}</p>
              </div>
              <div className="mt-3 text-right">
                {app.status !== 'cancelled' && (
                  <button 
                    onClick={() => initiateCancel(app.id)}
                    className="text-xs text-red-400 border border-red-200 px-3 py-1 rounded-full hover:bg-red-50 transition-colors"
                  >
                    取消預約
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [step, setStep] = useState(1);
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
    if (!auth) return;
    const init = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    init();
    const unsubAuth = onAuthStateChanged(auth, setUser);
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsubAppts = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'jm_appointments')), (snap) => {
      setAppointments(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }, (err) => console.error("Data Fetch Error:", err));
    
    const unsubBlocks = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'jm_blocks')), (snap) => {
      const b = {};
      snap.docs.forEach(d => b[d.id] = d.data().slots);
      setBlockedDates(b);
    });
    return () => { unsubAppts(); unsubBlocks(); };
  }, [user]);

  const isBooked = (d, t) => {
    const isAppt = appointments.some(a => a.date === d && a.time === t && a.status !== 'cancelled');
    const blockType = blockedDates[d];
    const isBlocked = blockType === 'ALL' || (Array.isArray(blockType) && blockType.includes(t));
    return isAppt || isBlocked;
  };

  const calcTotal = () => {
    if (!selectedService) return 0;
    let total = selectedService.price;
    if (selectedAddons.includes('remove_our')) total += 150;
    if (selectedAddons.includes('remove_other')) total += 250;
    if (extensionCount > 0) total += (80 * extensionCount);
    return total;
  };

  const submitBooking = async () => {
    if (!user || !db) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jm_appointments'), {
        serviceName: selectedService.title,
        price: calcTotal(),
        isStartPrice: selectedService.isStartPrice,
        addons: selectedAddons,
        extensionCount,
        date, time,
        client: info,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setView('success');
    } catch(e) { 
      console.error(e);
      alert('預約失敗，請稍後再試: ' + e.message); 
    }
    setLoading(false);
  };

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-red-50 text-red-800">
        <div className="max-w-md text-center">
          <AlertCircle size={48} className="mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">系統初始化失敗</h2>
          <p className="mb-4">請確認 Firebase 設定檔是否正確。</p>
          <pre className="text-left bg-white p-4 rounded text-xs overflow-auto border border-red-200">
            {initError}
          </pre>
        </div>
      </div>
    );
  }

  const renderHome = () => (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-rose-100 rounded-full blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-stone-200 rounded-full blur-3xl opacity-30 translate-x-1/3 translate-y-1/3"></div>
      <div className="relative z-10 animate-fade-in-up w-full max-w-md flex flex-col items-center">
        
        {/* LOGO */}
        <div className="mb-6 w-48 h-48 rounded-full bg-cream-100 shadow-sm overflow-hidden border-4 border-white relative flex items-center justify-center">
          <img 
            src="/logo.jpg"
            alt="JM Nail Logo" 
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
          />
          <div className="absolute inset-0 bg-stone-100 hidden flex-col items-center justify-center text-stone-400">
            <span className="text-4xl">🐹</span><span className="text-xs font-bold mt-2">JM NAIL</span>
          </div>
        </div>

        <h1 className="text-5xl font-serif text-stone-800 mb-2 tracking-wide">JM Nail</h1>
        <p className="text-stone-500 font-light tracking-[0.2em] mb-4 text-sm uppercase">Support Nails & Design</p>
        
        {/* Studio Info */}
        <div className="text-center text-stone-500 text-sm mb-6 space-y-1">
          <p className="font-medium text-stone-700">台北萬隆 · 獨立工作室</p>
          <p>每一副指甲都是專屬的紀念品</p>
          <p>我們提供客製化設計、舒適的環境</p>
          <p className="text-xs mt-2 text-stone-400">目前為一人工作室，請提前預約</p>
        </div>
        
        <button onClick={() => { setStep(1); setView('booking'); }} className="w-4/5 py-4 bg-stone-800 text-white rounded-full text-lg shadow-xl hover:bg-stone-700 transition-all transform hover:-translate-y-1 tracking-widest mb-8">
          立即預約
        </button>

        {/* Promotions */}
        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-rose-100 w-full mb-8 text-left">
           <h3 className="text-rose-500 font-bold mb-3 flex items-center gap-2 text-sm"><Sparkles size={16}/> 近期優惠</h3>
           <ul className="text-sm text-stone-600 space-y-2 list-disc pl-4 marker:text-rose-300">
             <li>新客優惠 95 折 / 學生 9 折</li>
             <li>當月壽星折抵 $50</li>
             <li>社群分享標記再折 $50</li>
           </ul>
        </div>

        <div className="flex gap-6 justify-center text-stone-400">
          <a href="https://www.instagram.com/jmmm_nail?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener noreferrer" className="hover:text-rose-500 transition"><Instagram size={20} /></a>
          <button onClick={() => setView('adminLogin')} className="hover:text-rose-500 transition"><Lock size={20} /></button>
        </div>
      </div>
    </div>
  );

  const renderBooking = () => (
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
             <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-xl cursor-pointer hover:bg-stone-100 transition">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="accent-rose-500 w-5 h-5"/>
                <span className="text-stone-600 font-medium text-sm">我已詳閱並同意以上規則</span>
             </label>
             <button disabled={!agreed} onClick={() => setStep(2)} className={`w-full py-4 rounded-full font-bold text-white transition-all ${agreed ? 'bg-stone-800 shadow-lg' : 'bg-stone-200 cursor-not-allowed'}`}>開始預約</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid gap-4">
              {SERVICES.map(s => <ServiceCard key={s.id} item={s} isSelected={selectedService?.id === s.id} onClick={() => setSelectedService(s)} />)}
            </div>
            {selectedService && (
              <div className="mt-8 pt-8 border-t border-stone-100 space-y-3">
                <h3 className="font-bold text-stone-700 mb-2 flex items-center gap-2"><Sparkles size={16}/> 加購項目</h3>
                {ADDONS.filter(a => !a.isCount).map(addon => {
                    const active = selectedAddons.includes(addon.id);
                    return (
                      <div key={addon.id} onClick={() => {
                          const other = addon.id === 'remove_our' ? 'remove_other' : 'remove_our';
                          let next = selectedAddons.filter(x => x !== other);
                          if (active) next = next.filter(x => x !== addon.id); else next.push(addon.id);
                          setSelectedAddons(next);
                        }} className={`p-4 rounded-lg border flex justify-between items-center cursor-pointer transition ${active ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200 text-stone-600'}`}>
                        <span>{addon.title}</span><span>+${addon.price}</span>
                      </div>
                    )
                })}
                <div className={`p-4 rounded-lg border flex justify-between items-center ${extensionCount > 0 ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200'}`}>
                    <span>延甲 (每指 $80)</span>
                    <div className="flex items-center gap-3 bg-white/10 rounded-lg p-1">
                      <button onClick={() => setExtensionCount(Math.max(0, extensionCount - 1))} className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-800">-</button>
                      <span className="w-4 text-center">{extensionCount}</span>
                      <button onClick={() => setExtensionCount(Math.min(10, extensionCount + 1))} className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-800">+</button>
                    </div>
                  </div>
              </div>
            )}
             <button disabled={!selectedService} onClick={() => setStep(3)} className={`w-full mt-6 py-4 rounded-full font-bold text-white transition-all ${selectedService ? 'bg-stone-800 shadow-lg' : 'bg-stone-200 cursor-not-allowed'}`}>下一步</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
               <input type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={e => { setDate(e.target.value); setTime(''); }} className="w-full p-3 bg-stone-50 border-none rounded-lg outline-none text-stone-700"/>
             </div>
             {date && (
               <div className="grid grid-cols-1 gap-3">
                 {FIXED_SLOTS.map(s => {
                   const disabled = isBooked(date, s);
                   return <button key={s} disabled={disabled} onClick={() => setTime(s)} className={`p-4 rounded-xl border flex justify-between items-center transition-all ${disabled ? 'bg-stone-50 text-stone-300 cursor-not-allowed' : time === s ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300'}`}>
                       <span className="text-lg font-serif">{s}</span><span className="text-xs">{disabled ? 'Full' : time === s ? 'Selected' : 'Available'}</span>
                     </button>
                 })}
               </div>
             )}
             <button disabled={!date || !time} onClick={() => setStep(4)} className={`w-full mt-6 py-4 rounded-full font-bold text-white transition-all ${date && time ? 'bg-stone-800 shadow-lg' : 'bg-stone-200 cursor-not-allowed'}`}>下一步</button>
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
                <div className="border-t border-stone-200 pt-3 mt-2 flex justify-between items-center">
                  <span className="font-bold text-stone-800">總金額</span><span className="font-serif text-2xl text-rose-600 font-bold">${calcTotal()}</span>
                </div>
             </div>
             <button disabled={!info.name || !info.phone || !info.line || loading} onClick={submitBooking} className={`w-full py-4 rounded-full font-bold text-white transition-all shadow-xl ${loading ? 'bg-stone-400' : 'bg-stone-800 hover:bg-stone-700'}`}>
               {loading ? '送出中...' : '確認預約'}
             </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6 text-rose-500 animate-pulse"><Heart fill="currentColor" size={40} /></div>
      <h2 className="text-3xl font-serif text-stone-800 mb-4">預約申請已送出</h2>
      <p className="text-stone-500 mb-8 max-w-xs leading-relaxed">請記得至官方 Line 確認最終報價，才算完成預約喔！</p>
      <button onClick={() => window.location.reload()} className="text-stone-400 hover:text-stone-800 underline underline-offset-4">返回首頁</button>
    </div>
  );

  const renderAdminLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
        <h2 className="text-xl font-serif text-stone-800 mb-6">JM Studio Access</h2>
        <input type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} className="w-full p-3 bg-stone-50 rounded mb-4 text-center tracking-widest outline-none" placeholder="••••" />
        <button onClick={() => adminPassword === '0314' ? setView('admin') : alert('密碼錯誤')} className="w-full py-3 bg-stone-800 text-white rounded font-bold">LOGIN</button>
        <button onClick={() => setView('home')} className="mt-4 text-xs text-stone-400 hover:text-stone-600">Back Home</button>
      </div>
    </div>
  );

  if (view === 'admin') return <AdminView onBack={() => setView('home')} />;
  if (view === 'adminLogin') return renderAdminLogin();
  if (view === 'success') return renderSuccess();
  if (view === 'booking') return renderBooking();
  return renderHome();
}