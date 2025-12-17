import React, { useState, useEffect, Suspense } from 'react';
import { Calendar, User, Sparkles, Instagram, ChevronLeft, Heart, Lock, AlertCircle } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, query, onSnapshot } from 'firebase/firestore';

// 1. 引入設定檔與元件
import { auth, db, initError, APP_ID } from './services/firebase';
import { SERVICES, ADDONS, FIXED_SLOTS } from './data/constants';
import ServiceCard from './components/ServiceCard';

// 2. (Lazy Loading) 後台頁面
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [step, setStep] = useState(1);
  
  // 登入相關狀態
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 預約資料狀態
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

  // --- 初始化與監聽 ---
  useEffect(() => {
    if (!auth) return;
    const init = async () => {
      // 訪客自動匿名登入 (確保能讀取被預約的時段)
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch (e) { console.error(e); }
      }
    };
    init();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    // 這裡只監聽「公開資料」，就算駭客看得到這段，也只能看到哪些時段滿了，看不到客人個資
    const qAppt = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jm_appointments'));
    const unsubAppt = onSnapshot(qAppt, (snap) => setAppointments(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    const qBlock = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jm_blocks'));
    const unsubBlock = onSnapshot(qBlock, (snap) => {
        const blocks = {};
        snap.docs.forEach(d => blocks[d.id] = d.data().slots);
        setBlockedDates(blocks);
    });
    return () => { unsubAppt(); unsubBlock(); };
  }, [user]);

  // --- 邏輯輔助函式 ---
  const isBooked = (d, t) => {
    const isAppt = appointments.some(a => a.date === d && a.time === t && a.status !== 'cancelled');
    const blockType = blockedDates[d];
    return isAppt || blockType === 'ALL' || (Array.isArray(blockType) && blockType.includes(t));
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
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jm_appointments'), {
        serviceName: selectedService.title,
        price: calcTotal(),
        isStartPrice: selectedService.isStartPrice,
        addons: selectedAddons,
        extensionCount,
        date, time,
        client: info, // 這裡包含姓名電話，因為 Firestore 規則設定了 create: true，所以客人寫入沒問題
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setView('success');
    } catch(e) { 
        console.error(e);
        alert('預約失敗，請稍後再試。'); 
    }
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    setLoginError('');
    setIsLoggingIn(true);
    try {
      // 這裡會使用你在 Firebase 設定的 Email 和 940314 進行驗證
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      setView('admin');
    } catch (error) {
      console.error(error);
      setLoginError('登入失敗：請確認信箱與密碼');
    }
    setIsLoggingIn(false);
  };

  // --- 畫面渲染 ---

  if (initError) return <div className="min-h-screen flex items-center justify-center text-red-500">系統初始化錯誤</div>;

  // ★ 這裡就是安全性最高的地方
  // Suspense 是一個「等待中」的畫面，當 AdminDashboard 還在下載時顯示
  if (view === 'admin') {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-stone-500">正在載入後台安全模組...</div>}>
        <AdminDashboard onBack={() => setView('home')} />
      </Suspense>
    );
  }

  // 管理員登入頁面
  if (view === 'adminLogin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="mb-6 mx-auto w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center text-white"><Lock size={24}/></div>
          <h2 className="text-xl font-serif text-stone-800 mb-6">JM Studio Access</h2>
          
          <input 
            type="email" 
            value={adminEmail} 
            onChange={e=>setAdminEmail(e.target.value)} 
            className="w-full p-3 bg-stone-50 rounded mb-2 text-center border border-stone-200 outline-none focus:border-rose-300" 
            placeholder="Email" 
          />
          <input 
            type="password" 
            value={adminPassword} 
            onChange={e=>setAdminPassword(e.target.value)} 
            className="w-full p-3 bg-stone-50 rounded mb-4 text-center border border-stone-200 outline-none focus:border-rose-300" 
            placeholder="Password" 
          />
          
          {loginError && <p className="text-red-500 text-xs mb-3">{loginError}</p>}
          
          <button onClick={handleAdminLogin} disabled={isLoggingIn} className="w-full py-3 bg-stone-800 text-white rounded font-bold hover:bg-stone-700 transition-all">
            {isLoggingIn ? '驗證中...' : 'LOGIN'}
          </button>
          <button onClick={() => setView('home')} className="mt-4 text-xs text-stone-400 hover:text-stone-600">返回首頁</button>
        </div>
      </div>
    );
  }

  // 預約成功頁面
  if (view === 'success') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6 text-rose-500 animate-pulse"><Heart fill="currentColor" size={40} /></div>
        <h2 className="text-3xl font-serif text-stone-800 mb-4">預約申請已送出</h2>
        <p className="text-stone-500 mb-8 max-w-xs leading-relaxed">請記得至官方 Line 確認最終報價，才算完成預約喔！</p>
        <button onClick={() => window.location.reload()} className="text-stone-400 hover:text-stone-800 underline underline-offset-4">返回首頁</button>
      </div>
    );
  }

  // 預約流程頁面 (Booking)
  if (view === 'booking') {
    return (
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
                  {ADDONS.filter(a => !a.isCount).map(addon => {
                      const active = selectedAddons.includes(addon.id);
                      return (<div key={addon.id} onClick={() => { const other = addon.id === 'remove_our' ? 'remove_other' : 'remove_our'; let next = selectedAddons.filter(x => x !== other); if (active) next = next.filter(x => x !== addon.id); else next.push(addon.id); setSelectedAddons(next); }} className={`p-4 rounded-lg border flex justify-between items-center cursor-pointer transition ${active ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200 text-stone-600'}`}><span>{addon.title}</span><span>+${addon.price}</span></div>)
                  })}
                  <div className={`p-4 rounded-lg border flex justify-between items-center ${extensionCount > 0 ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200'}`}><span>延甲 (每指 $80)</span><div className="flex items-center gap-3 bg-white/10 rounded-lg p-1"><button onClick={() => setExtensionCount(Math.max(0, extensionCount - 1))} className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-800">-</button><span className="w-4 text-center">{extensionCount}</span><button onClick={() => setExtensionCount(Math.min(10, extensionCount + 1))} className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-800">+</button></div></div>
                </div>
              )}
               <button disabled={!selectedService} onClick={() => setStep(3)} className={`w-full mt-6 py-4 rounded-full font-bold text-white transition-all ${selectedService ? 'bg-stone-800 shadow-lg' : 'bg-stone-200 cursor-not-allowed'}`}>下一步</button>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
               <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100"><input type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={e => { setDate(e.target.value); setTime(''); }} className="w-full p-3 bg-stone-50 border-none rounded-lg outline-none text-stone-700"/></div>
               {date && (
                 <div className="grid grid-cols-1 gap-3">{FIXED_SLOTS.map(s => { const disabled = isBooked(date, s); return <button key={s} disabled={disabled} onClick={() => setTime(s)} className={`p-4 rounded-xl border flex justify-between items-center transition-all ${disabled ? 'bg-stone-50 text-stone-300 cursor-not-allowed' : time === s ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300'}`}><span className="text-lg font-serif">{s}</span><span className="text-xs">{disabled ? 'Full' : time === s ? 'Selected' : 'Available'}</span></button> })}</div>
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
                  <div className="border-t border-stone-200 pt-3 mt-2 flex justify-between items-center"><span className="font-bold text-stone-800">總金額</span><span className="font-serif text-2xl text-rose-600 font-bold">${calcTotal()}</span></div>
               </div>
               <button disabled={!info.name || !info.phone || !info.line || loading} onClick={submitBooking} className={`w-full py-4 rounded-full font-bold text-white transition-all shadow-xl ${loading ? 'bg-stone-400' : 'bg-stone-800 hover:bg-stone-700'}`}> {loading ? '送出中...' : '確認預約'}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 首頁 (Home)
  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-rose-100 rounded-full blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-stone-200 rounded-full blur-3xl opacity-30 translate-x-1/3 translate-y-1/3"></div>
      <div className="relative z-10 animate-fade-in-up w-full max-w-md flex flex-col items-center">
        
        {/* LOGO */}
        <div className="mb-6 w-48 h-48 rounded-full bg-cream-100 shadow-sm overflow-hidden border-4 border-white relative flex items-center justify-center">
          <img src="/logo.png" alt="JM Nail Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}/>
          <div className="absolute inset-0 bg-stone-100 hidden flex-col items-center justify-center text-stone-400"><span className="text-4xl">🐹</span><span className="text-xs font-bold mt-2">JM NAIL</span></div>
        </div>

        <h1 className="text-5xl font-serif text-stone-800 mb-2 tracking-wide">JM Nail</h1>
        <p className="text-stone-500 font-light tracking-[0.2em] mb-4 text-sm uppercase">Support Nails & Design</p>
        
        {/* Info */}
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
}