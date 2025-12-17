import React, { useState, useEffect } from 'react';
import { Lock, LogOut, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { signOut, signInAnonymously } from 'firebase/auth';
import { db, auth, APP_ID } from '../services/firebase';
import { FIXED_SLOTS } from '../data/constants';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminDashboard({ onBack }) {
  // 日曆狀態
  const [currentDate, setCurrentDate] = useState(new Date()); // 控制目前顯示的月份
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // 控制目前選中的日期
  
  // 資料狀態
  const [appointments, setAppointments] = useState([]);
  const [blockedDates, setBlockedDates] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [targetApptId, setTargetApptId] = useState(null);

  // --- 資料監聽 ---
  useEffect(() => {
    if (!db) return;
    const qAppt = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jm_appointments'));
    const unsubAppt = onSnapshot(qAppt, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const qBlock = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jm_blocks'));
    const unsubBlock = onSnapshot(qBlock, (snap) => {
      const b = {};
      snap.docs.forEach(d => b[d.id] = d.data().slots);
      setBlockedDates(b);
    });
    return () => { unsubAppt(); unsubBlock(); };
  }, []);

  // --- 日曆邏輯 ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // 空白補位 (上個月)
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 sm:h-20 border border-stone-100 bg-stone-50/50"></div>);
    }

    // 日期格子
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = selectedDate === dateStr;
      
      // 狀態判斷
      const blockStatus = blockedDates[dateStr];
      const isFullDayOff = blockStatus === 'ALL';
      const isPartialOff = Array.isArray(blockStatus) && blockStatus.length > 0;
      
      // 計算當日預約數
      const dayAppts = appointments.filter(a => a.date === dateStr && a.status !== 'cancelled');
      const isFullyBooked = dayAppts.length >= FIXED_SLOTS.length;

      let statusColor = 'bg-white';
      let statusText = '';
      
      if (isFullDayOff) {
        statusColor = 'bg-red-50 hover:bg-red-100';
        statusText = '🔴';
      } else if (isFullyBooked) {
        statusColor = 'bg-stone-100';
        statusText = '🈵';
      } else if (isPartialOff) {
        statusColor = 'bg-orange-50 hover:bg-orange-100';
        statusText = '🟡';
      } else {
        statusColor = 'bg-white hover:bg-green-50';
      }

      days.push(
        <div 
          key={d}
          onClick={() => setSelectedDate(dateStr)}
          className={`h-14 sm:h-20 border border-stone-100 p-1 cursor-pointer transition-all flex flex-col justify-between ${statusColor} ${isSelected ? 'ring-2 ring-rose-400 z-10' : ''}`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-sm font-medium ml-1 ${isSelected ? 'text-rose-600' : 'text-stone-600'}`}>{d}</span>
            <span className="text-xs mr-1">{statusText}</span>
          </div>
          <div className="text-[10px] text-stone-400 text-center">
            {dayAppts.length > 0 && `${dayAppts.length} 個預約`}
          </div>
        </div>
      );
    }
    return days;
  };

  // --- 操作邏輯 ---
  const toggleBlock = async (d, t = null) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'jm_blocks', d);
    const curr = blockedDates[d];
    if (t) {
      // 關閉特定時段
      let newSlots = [];
      if (curr === 'ALL') newSlots = []; 
      else if (Array.isArray(curr)) newSlots = curr.includes(t) ? curr.filter(x => x !== t) : [...curr, t];
      else newSlots = [t];
      if (newSlots.length === 0) await deleteDoc(ref);
      else await setDoc(ref, { slots: newSlots });
    } else {
      // 全日公休切換
      if (curr === 'ALL') await deleteDoc(ref);
      else await setDoc(ref, { slots: 'ALL' });
    }
  };

  const handleLogout = async () => {
    try {
        await signOut(auth);
        await signInAnonymously(auth);
        onBack();
    } catch (e) {
        onBack();
    }
  };

  // 該日期的預約列表
  const selectedDateAppts = appointments
    .filter(a => a.date === selectedDate)
    .sort((a,b) => a.time.localeCompare(b.time));

  return (
    <div className="min-h-screen bg-stone-100 pb-20 font-sans">
      <ConfirmModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onConfirm={async () => {
          if (targetApptId && db) {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'jm_appointments', targetApptId), { status: 'cancelled' });
            setModalOpen(false);
          }
        }}
        title="確定取消預約？"
        message="取消後，該時段將釋出給其他客人預約。"
      />

      {/* Header */}
      <div className="bg-stone-800 text-stone-200 p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <span className="font-bold tracking-widest flex items-center gap-2"><Lock size={16}/> 後台管理</span>
        <button onClick={handleLogout} className="text-xs border border-stone-600 px-3 py-1 rounded hover:bg-stone-700 flex items-center gap-1">
          <LogOut size={12}/> 登出
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 grid lg:grid-cols-5 gap-6">
        
        {/* 左側：日曆 (佔 3/5) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex justify-between items-center mb-4 px-2">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronLeft size={20}/></button>
              <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <CalendarIcon size={18} className="text-rose-400"/>
                {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月
              </h2>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronRight size={20}/></button>
            </div>
            
            <div className="grid grid-cols-7 text-center mb-2">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="text-xs font-bold text-stone-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 bg-stone-100 gap-[1px] border border-stone-200">
              {renderCalendar()}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-stone-500 justify-center">
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-stone-200"></div> 公休</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-100 border border-stone-200"></div> 部分時段</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-stone-100 border border-stone-200"></div> 客滿</span>
            </div>
          </div>
        </div>

        {/* 右側：詳細設定 (佔 2/5) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* 1. 當日排班開關 */}
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <h3 className="font-bold text-stone-700 mb-3 text-lg border-b pb-2">
              {selectedDate} 設定
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-stone-50 p-3 rounded-lg">
                <span className="text-sm font-medium text-stone-600">全日狀態</span>
                <button 
                  onClick={() => toggleBlock(selectedDate)} 
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${blockedDates[selectedDate] === 'ALL' ? 'bg-red-500 text-white shadow-md' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                >
                  {blockedDates[selectedDate] === 'ALL' ? '⛔ 已設公休 (點擊開啟)' : '✅ 營業中 (點擊公休)'}
                </button>
              </div>

              {blockedDates[selectedDate] !== 'ALL' && (
                <div>
                  <p className="text-xs text-stone-400 mb-2">單獨關閉特定時段：</p>
                  <div className="grid grid-cols-3 gap-2">
                    {FIXED_SLOTS.map(slot => {
                      const isBlocked = Array.isArray(blockedDates[selectedDate]) && blockedDates[selectedDate].includes(slot);
                      return (
                        <button 
                          key={slot} 
                          onClick={() => toggleBlock(selectedDate, slot)} 
                          className={`py-2 rounded-lg text-xs font-medium border transition-all ${isBlocked ? 'bg-stone-200 text-stone-400 line-through border-transparent' : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300 hover:text-rose-500'}`}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. 當日預約列表 */}
          <div className="bg-white p-5 rounded-2xl shadow-sm min-h-[300px]">
            <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2">
              📋 當日預約 
              <span className="bg-rose-100 text-rose-600 text-xs px-2 py-0.5 rounded-full">{selectedDateAppts.length}</span>
            </h3>
            
            <div className="space-y-3">
              {selectedDateAppts.length === 0 ? (
                <div className="text-center py-10 text-stone-300 text-sm">
                  今日尚無預約
                </div>
              ) : (
                selectedDateAppts.map(app => (
                  <div key={app.id} className="border border-stone-100 rounded-xl p-3 hover:shadow-sm transition bg-stone-50/50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-lg text-stone-700">{app.time}</span>
                      <span className={`text-[10px] px-2 py-1 rounded-full ${app.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {app.status === 'cancelled' ? '已取消' : '已預約'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-stone-800">{app.client.name}</div>
                    <div className="text-xs text-stone-500 mb-2">{app.serviceName}</div>
                    
                    {app.status !== 'cancelled' && (
                      <div className="border-t border-stone-200 pt-2 mt-2 flex justify-between items-center">
                        <span className="text-xs text-stone-400">Line: {app.client.line}</span>
                        <button 
                          onClick={() => { setTargetApptId(app.id); setModalOpen(true); }}
                          className="text-xs text-red-400 hover:text-red-600 hover:underline"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}