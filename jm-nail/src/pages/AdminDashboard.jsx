import React, { useState, useEffect } from 'react';
import { Calendar, Lock, LogOut } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { signOut, signInAnonymously } from 'firebase/auth';
import { db, auth, APP_ID } from '../services/firebase'; // 引用我們剛剛建立的 service
import { FIXED_SLOTS } from '../data/constants';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminDashboard({ onBack }) {
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState([]);
  const [blockedDates, setBlockedDates] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [targetApptId, setTargetApptId] = useState(null);

  useEffect(() => {
    if (!db) return;
    const qAppt = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jm_appointments'));
    const unsubAppt = onSnapshot(qAppt, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Snapshot Error:", err));
    
    const qBlock = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jm_blocks'));
    const unsubBlock = onSnapshot(qBlock, (snap) => {
      const b = {};
      snap.docs.forEach(d => b[d.id] = d.data().slots);
      setBlockedDates(b);
    });
    return () => { unsubAppt(); unsubBlock(); };
  }, []);

  const toggleBlock = async (d, t = null) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'jm_blocks', d);
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
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'jm_appointments', targetApptId), { status: 'cancelled' });
      setModalOpen(false);
      setTargetApptId(null);
    }
  };

  const handleLogout = async () => {
    try {
        await signOut(auth);
        await signInAnonymously(auth);
        onBack();
    } catch (e) {
        console.error(e);
        onBack();
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
        message="取消後，該時段將釋出給其他客人預約。"
      />

      <div className="bg-stone-800 text-stone-200 p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <span className="font-bold tracking-widest flex items-center gap-2"><Lock size={16}/> JM ADMIN</span>
        <button onClick={handleLogout} className="text-xs border border-stone-600 px-3 py-1 rounded hover:bg-stone-700 flex items-center gap-1">
          <LogOut size={12}/> 登出
        </button>
      </div>

      <div className="p-6 max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
        {/* 排班管理區塊 */}
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

        {/* 預約列表區塊 */}
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
              {app.status !== 'cancelled' && (
                <div className="mt-3 text-right">
                  <button onClick={() => initiateCancel(app.id)} className="text-xs text-red-400 border border-red-200 px-3 py-1 rounded-full hover:bg-red-50 transition-colors">
                    取消預約
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}