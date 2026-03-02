
import React, { useState, useEffect } from 'react';
import { UserProfile, LeaveBalances, RetentionBonus } from '../types';
import LeaveBalanceCard from './LeaveBalanceCard';
import BonusCard from './BonusCard';
import LeaveHistory from './LeaveHistory';
import PendingRequests from './PendingRequests';
import EscalatedRequests from './EscalatedRequests';
import LateWarningWidget from './LateWarningWidget';
import AttendanceTrendChart from './AttendanceTrendChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { db, collection, query, where, orderBy, onSnapshot, Timestamp, getDocs } from '../firebase';

interface DashboardProps {
  user: UserProfile;
  leaveBalances: LeaveBalances | null;
  retentionBonus: RetentionBonus | null;
  isFounder?: boolean;
  onImpersonate?: (uid: string | null) => void;
  impersonatedUid?: string | null;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  leaveBalances, 
  retentionBonus, 
  isFounder, 
  onImpersonate,
  impersonatedUid 
}) => {
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);
  const [employees, setEmployees] = useState<{uid: string, name: string}[]>([]);

  // Fetch all employees for Founder's impersonation dropdown
  useEffect(() => {
    if (!isFounder) return;
    const fetchEmployees = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => ({ uid: d.id, name: d.data().name }));
      setEmployees(list.sort((a, b) => a.name.localeCompare(b.name)));
    };
    fetchEmployees();
  }, [isFounder]);

  useEffect(() => {
    if (!user.uid) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthShort = now.toLocaleString('default', { month: 'short' });
    
    const initialArray = Array.from({ length: daysInMonth }, (_, i) => ({
      date: `${i + 1} ${monthShort}`,
      dayNumber: i + 1,
      timeValue: null,
      label: 'No Data'
    }));
    setAttendanceTrend(initialArray);

    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid),
      where('checkinAt', '>=', Timestamp.fromDate(startOfMonth)),
      where('checkinAt', '<=', Timestamp.fromDate(endOfMonth)),
      orderBy('checkinAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attendanceMap = new Map();
      snapshot.docs.forEach(doc => {
        const attendance = doc.data();
        const checkinDate = attendance.checkinAt.toDate();
        const day = checkinDate.getDate();
        const hours = checkinDate.getHours();
        const minutes = checkinDate.getMinutes();
        
        attendanceMap.set(day, {
          timeValue: hours + (minutes / 60),
          label: checkinDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      });
      
      const fullMonthArray = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const record = attendanceMap.get(day);
        return {
          date: `${day} ${monthShort}`,
          dayNumber: day,
          timeValue: record ? record.timeValue : null,
          label: record ? record.label : 'No Data'
        };
      });
      setAttendanceTrend(fullMonthArray);
    });

    return () => unsubscribe();
  }, [user.uid]);

  if (!leaveBalances || !retentionBonus) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-2">
          <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="text-slate-500 text-sm font-medium">Initializing data streams...</p>
        </div>
      </div>
    );
  }

  const bonusChartData = (retentionBonus.bonusMonths || []).map(m => ({
    name: m.month.substring(0, 3),
    bonus: m.bonus,
    leaves: m.leaves
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            {impersonatedUid && (
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-200">Acting View</span>
            )}
          </div>
          <p className="text-slate-500 text-sm">Reviewing metrics for <span className="font-bold text-slate-900">{user.name}</span></p>
        </div>

        {isFounder && (
          <div className="flex items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm space-x-3">
             <div className="px-3 border-r border-slate-100">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Founder View Mode</span>
             </div>
             <div className="flex items-center space-x-2">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <select 
                  className="bg-transparent text-sm font-bold text-indigo-600 outline-none pr-4"
                  value={impersonatedUid || ''}
                  onChange={(e) => onImpersonate?.(e.target.value || null)}
                >
                  <option value="">My Own Data</option>
                  {employees.map(emp => (
                    <option key={emp.uid} value={emp.uid}>View as {emp.name}</option>
                  ))}
                </select>
             </div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <LateWarningWidget warningsLeft={leaveBalances.lateWarningLeft} />
        </div>
        <div className="lg:col-span-2">
          <AttendanceTrendChart data={attendanceTrend} />
        </div>
      </div>

      {(user.role === 'Manager' || user.role === 'Founder') && !impersonatedUid && (
        <PendingRequests manager={user} />
      )}

      {user.role === 'Founder' && !impersonatedUid && (
        <EscalatedRequests founder={user} />
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center">
            <svg className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Leave Balances
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <LeaveBalanceCard title="Casual Leave (CL)" used={leaveBalances.currentMonthClUsed} maxPerMonth={4} balance={leaveBalances.clBalance} total={leaveBalances.clTotal} accentColor="bg-blue-600" ringColor="text-blue-600" />
          <LeaveBalanceCard title="Sick Leave (SL)" used={leaveBalances.currentMonthSlUsed} maxPerMonth={2} balance={leaveBalances.slBalance} total={leaveBalances.slTotal} accentColor="bg-emerald-600" ringColor="text-emerald-600" />
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
            <div className="p-3 bg-orange-50 rounded-full mb-3"><svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Half Days Taken</h3>
            <p className="text-5xl font-black text-slate-900 mt-2">{leaveBalances.hdlCount}</p>
          </div>
        </div>
      </section>

      <section>
        <LeaveHistory user={user} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center">
            <svg className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Retention Bonus
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
             <BonusCard total={retentionBonus.totalBonus} />
             <div className="mt-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <h4 className="text-indigo-800 font-semibold text-sm mb-2 uppercase tracking-wide">Eligibility</h4>
                <p className="text-indigo-700 text-xs">Maintain 2 or fewer monthly leaves to earn a 2-day salary equivalent bonus!</p>
             </div>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-800 font-semibold mb-6">Trend</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bonusChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="bonus" radius={[4, 4, 0, 0]}>
                    {bonusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.bonus > 0 ? '#4f46e5' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
