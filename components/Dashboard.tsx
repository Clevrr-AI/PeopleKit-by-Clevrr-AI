
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
import { db, collection, query, where, orderBy, limit, onSnapshot } from '../firebase';

interface DashboardProps {
  user: UserProfile;
  leaveBalances: LeaveBalances | null;
  retentionBonus: RetentionBonus | null;
}

const Dashboard: React.FC<DashboardProps> = ({ user, leaveBalances, retentionBonus }) => {
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);

  useEffect(() => {
    if (!user.uid) return;

    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid),
      orderBy('checkinAt', 'desc'),
      limit(14)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const attendance = doc.data();
        const checkinDate = attendance.checkinAt.toDate();
        const hours = checkinDate.getHours();
        const minutes = checkinDate.getMinutes();
        
        return {
          date: checkinDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          timeValue: hours + (minutes / 60),
          timestamp: checkinDate.getTime(),
          label: checkinDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });
      
      // Sort chronologically for the line chart
      setAttendanceTrend(data.sort((a, b) => a.timestamp - b.timestamp));
    });

    return () => unsubscribe();
  }, [user.uid]);

  if (!leaveBalances || !retentionBonus) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-2">
          <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
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

  const isManager = user.role === 'Manager' || user.role === 'Founder';
  const isFounder = user.role === 'Founder';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm">Welcome back, {user.name || 'User'}! Review your personal and team metrics.</p>
        </div>
        {isManager && (
          <div className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm ring-1 ring-indigo-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>{isFounder ? 'Founder Access' : 'Manager Access'}</span>
          </div>
        )}
      </header>

      {/* Top Row: Important Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <LateWarningWidget warningsLeft={leaveBalances.lateWarningLeft} />
        </div>
        <div className="lg:col-span-2">
          <AttendanceTrendChart data={attendanceTrend} />
        </div>
      </div>

      {/* Manager Specific Section */}
      {isManager && <PendingRequests manager={user} />}

      {/* Founder Specific Section: Escalated Requests */}
      {isFounder && <EscalatedRequests founder={user} />}

      {/* Leave Balances Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center">
            <svg className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            My Leave Balances
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <LeaveBalanceCard 
            title="Casual Leave (CL)" 
            used={leaveBalances.currentMonthClUsed} 
            maxPerMonth={4} 
            balance={leaveBalances.clBalance} 
            total={leaveBalances.clTotal}
            accentColor="bg-blue-600"
            ringColor="text-blue-600"
          />
          <LeaveBalanceCard 
            title="Sick Leave (SL)" 
            used={leaveBalances.currentMonthSlUsed} 
            maxPerMonth={2} 
            balance={leaveBalances.slBalance} 
            total={leaveBalances.slTotal}
            accentColor="bg-emerald-600"
            ringColor="text-emerald-600"
          />
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
            <div className="p-3 bg-orange-50 rounded-full mb-3">
              <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Half Days Taken</h3>
            <p className="text-5xl font-black text-slate-900 mt-2">{leaveBalances.hdlCount}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">Total accumulated count</p>
          </div>
        </div>
      </section>

      {/* History Section */}
      <section>
        <LeaveHistory user={user} />
      </section>

      {/* Retention Bonus Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center">
            <svg className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            My Retention Bonus
          </h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
             <BonusCard total={retentionBonus.totalBonus} />
             <div className="mt-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <h4 className="text-indigo-800 font-semibold text-sm mb-2 uppercase tracking-wide">Eligibility Rule</h4>
                <p className="text-indigo-700 text-xs leading-relaxed">
                  Take <span className="font-bold underline">2 or fewer</span> leaves in a month to earn a 2-day salary equivalent bonus! 
                  Bonuses are credited annually in December.
                </p>
             </div>
          </div>
          
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-800 font-semibold mb-6">Bonus Accumulation Trend</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bonusChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
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
