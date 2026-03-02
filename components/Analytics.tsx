
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, LeaveRequest } from '../types';
import { db, collection, getDocs, query, where, Timestamp } from '../firebase';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface AnalyticsProps {
  user: UserProfile;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Analytics: React.FC<AnalyticsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveRequest[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedEmployees = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setEmployees(fetchedEmployees);

      const now = new Date();
      const startDate = new Date();
      if (timeRange === '7d') startDate.setDate(now.getDate() - 7);
      else if (timeRange === '30d') startDate.setDate(now.getDate() - 30);
      else startDate.setDate(now.getDate() - 90);

      const qAttendance = query(
        collection(db, 'attendance'),
        where('checkinAt', '>=', Timestamp.fromDate(startDate))
      );
      const snapshotAttendance = await getDocs(qAttendance);
      setAttendanceData(snapshotAttendance.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const qLeaves = query(
        collection(db, 'leaveRequests'),
        where('status', '==', 'Approved')
      );
      const snapshotLeaves = await getDocs(qLeaves);
      setLeaveData(snapshotLeaves.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

    } catch (err) {
      console.error("Error fetching analytics data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  // Process data for charts
  const stats = useMemo(() => {
    if (loading || employees.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayAttendance = attendanceData.filter(a => {
      const d = a.checkinAt.toDate();
      return d >= today && d < tomorrow;
    });

    const presentToday = todayAttendance.length;
    const lateToday = todayAttendance.filter(a => a.isLate).length;
    const wfhToday = todayAttendance.filter(a => a.isWfh).length;
    const latePassesUsedToday = todayAttendance.filter(a => a.latePassUsed).length;

    // Daily Attendance Trend
    const dailyTrend: any[] = [];
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);

      const dayAttendance = attendanceData.filter(a => {
        const ad = a.checkinAt.toDate();
        return ad >= d && ad < nextD;
      });

      dailyTrend.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        present: dayAttendance.length,
        late: dayAttendance.filter(a => a.isLate).length,
        latePassUsed: dayAttendance.filter(a => a.latePassUsed).length,
        wfh: dayAttendance.filter(a => a.isWfh).length,
        total: employees.length
      });
    }

    // Status Distribution
    const statusDist = [
      { name: 'On Time', value: attendanceData.filter(a => !a.isLate && !a.latePassUsed).length },
      { name: 'Late Pass Used', value: attendanceData.filter(a => a.latePassUsed).length },
      { name: 'Late', value: attendanceData.filter(a => a.isLate).length },
      { name: 'WFH', value: attendanceData.filter(a => a.isWfh).length },
    ];

    // Check-in Time Distribution
    const timeDist: { [key: string]: number } = {
      'Before 9 AM': 0,
      '9 AM - 10 AM': 0,
      '10 AM - 11 AM': 0,
      'After 11 AM': 0
    };

    attendanceData.forEach(a => {
      const hour = a.checkinAt.toDate().getHours();
      if (hour < 9) timeDist['Before 9 AM']++;
      else if (hour < 10) timeDist['9 AM - 10 AM']++;
      else if (hour < 11) timeDist['10 AM - 11 AM']++;
      else timeDist['After 11 AM']++;
    });

    const timeDistData = Object.keys(timeDist).map(key => ({ name: key, value: timeDist[key] }));

    // Department Performance
    const deptStats: { [key: string]: { present: number, total: number } } = {};
    employees.forEach(e => {
      if (!deptStats[e.department]) deptStats[e.department] = { present: 0, total: 0 };
      deptStats[e.department].total += days; // Total possible attendance days for this employee in the range
      
      const empAttendance = attendanceData.filter(a => a.userId === e.uid);
      deptStats[e.department].present += empAttendance.length;
    });

    const deptData = Object.keys(deptStats).map(key => ({
      name: key,
      rate: Math.round((deptStats[key].present / deptStats[key].total) * 100)
    })).sort((a, b) => b.rate - a.rate);

    // Day of Week Analysis
    const dowStats: { [key: string]: { present: number, count: number } } = {
      'Mon': { present: 0, count: 0 },
      'Tue': { present: 0, count: 0 },
      'Wed': { present: 0, count: 0 },
      'Thu': { present: 0, count: 0 },
      'Fri': { present: 0, count: 0 }
    };

    attendanceData.forEach(a => {
      const day = a.checkinAt.toDate().toLocaleDateString('en-US', { weekday: 'short' });
      if (dowStats[day]) {
        dowStats[day].present++;
      }
    });

    const dowData = Object.keys(dowStats).map(key => ({
      name: key,
      present: dowStats[key].present
    }));

    return {
      presentToday,
      lateToday,
      wfhToday,
      latePassesUsedToday,
      dailyTrend,
      statusDist,
      timeDistData,
      deptData,
      dowData
    };
  }, [loading, employees, attendanceData, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-black tracking-tight uppercase">Attendance Analytics</h1>
          <p className="text-slate-500 text-sm font-medium">Deep insights into workforce presence and patterns.</p>
        </div>
        <div className="flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm p-1">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                timeRange === range ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Present Today</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-slate-900">{stats?.presentToday}</h3>
            <span className="text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">
              {Math.round((stats?.presentToday || 0) / employees.length * 100)}%
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Late Arrivals</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-slate-900">{stats?.lateToday}</h3>
            <span className="text-rose-500 text-xs font-bold bg-rose-50 px-2 py-1 rounded-lg">
              Today
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">WFH Active</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-slate-900">{stats?.wfhToday}</h3>
            <span className="text-blue-500 text-xs font-bold bg-blue-50 px-2 py-1 rounded-lg">
              Remote
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Late Passes Used</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-slate-900">{stats?.latePassesUsedToday}</h3>
            <span className="text-indigo-500 text-xs font-bold bg-indigo-50 px-2 py-1 rounded-lg">
              Today
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Workforce</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-slate-900">{employees.length}</h3>
            <span className="text-slate-500 text-xs font-bold bg-slate-50 px-2 py-1 rounded-lg">
              Active
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="mb-8">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Attendance Trend</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daily presence over time</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.dailyTrend}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 900, color: '#1e293b', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorPresent)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="late" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  fill="transparent" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="mb-8">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Status Mix</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Overall distribution</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.statusDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats?.statusDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {stats?.statusDist.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-xs font-bold text-slate-600">{item.name}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Check-in Time Distribution */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="mb-8">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Arrival Times</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">When people usually check in</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.timeDistData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Performance */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="mb-8">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Department Leaderboard</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attendance rate by team</p>
          </div>
          <div className="space-y-6">
            {stats?.deptData.map((dept, index) => (
              <div key={dept.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{dept.name}</span>
                  <span className="text-xs font-black text-indigo-600">{dept.rate}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${index === 0 ? 'bg-indigo-600' : 'bg-slate-400'}`} 
                    style={{ width: `${dept.rate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day of Week Analysis */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="mb-8">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Weekly Patterns</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attendance volume by day of week</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.dowData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
              />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="present" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
