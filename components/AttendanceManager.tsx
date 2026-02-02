
import React, { useState, useEffect } from 'react';
import { UserProfile, LeaveRequest } from '../types';
import { db, collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp } from '../firebase';

interface AttendanceManagerProps {
  user: UserProfile;
}

const AttendanceManager: React.FC<AttendanceManagerProps> = ({ user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isMarking, setIsMarking] = useState<string | null>(null);

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all users
      const usersSnap = await getDocs(collection(db, 'users'));
      setEmployees(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));

      // 2. Fetch all attendance for the month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const qAttendance = query(
        collection(db, 'attendance'),
        where('checkinAt', '>=', Timestamp.fromDate(startOfMonth)),
        where('checkinAt', '<=', Timestamp.fromDate(endOfMonth))
      );

      const snapshotAttendance = await getDocs(qAttendance);
      setAttendanceData(snapshotAttendance.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // 3. Fetch all approved leaves for the month
      const qLeaves = query(
        collection(db, 'leaveRequests'),
        where('status', '==', 'Approved')
      );
      const snapshotLeaves = await getDocs(qLeaves);
      const allApprovedLeaves = snapshotLeaves.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Filter leaves that overlap with this month locally to avoid complex Firestore inequality queries
      const filteredLeaves = allApprovedLeaves.filter((l: any) => {
        const start = l.startDate.toDate();
        const end = l.endDate.toDate();
        return (start <= endOfMonth && end >= startOfMonth);
      });
      
      setLeaveData(filteredLeaves);

    } catch (err) {
      console.error("Error fetching attendance manager data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData();
  }, [currentDate]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const markUnpaidLeave = async (targetUser: UserProfile, day: number) => {
    setIsMarking(targetUser.uid);
    try {
      const recordDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 22, 0, 0);
      
      await addDoc(collection(db, 'attendance'), {
        isHalfDay: false,
        isOutOfOffice: false,
        isWfh: false,
        managerId: user.uid,
        processedAt: serverTimestamp(),
        processedBy: user.name,
        userId: targetUser.uid,
        userName: targetUser.name,
        checkinAt: Timestamp.fromDate(recordDate),
        isLate: true,
        lateType: 1, // Full day deduction
        status: 'approved',
        comment: "No Show unpaid leave marked by HR."
      });
      
      await fetchMonthData();
    } catch (err) {
      console.error("Failed to mark unpaid leave:", err);
      alert("Error marking unpaid leave.");
    } finally {
      setIsMarking(null);
    }
  };

  const getAttendanceCountForDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return attendanceData.filter(a => {
      const aDate = a.checkinAt.toDate();
      return aDate.getDate() === dayDate.getDate() && 
             aDate.getMonth() === dayDate.getMonth() && 
             aDate.getFullYear() === dayDate.getFullYear();
    }).length;
  };

  const getEmployeesForDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    dayDate.setHours(12, 0, 0, 0); // Mid-day for comparison

    return employees.map(emp => {
      // Check for attendance record first
      const attendanceRecord = attendanceData.find(a => {
        const aDate = a.checkinAt.toDate();
        return a.userId === emp.uid &&
               aDate.getDate() === dayDate.getDate() && 
               aDate.getMonth() === dayDate.getMonth() && 
               aDate.getFullYear() === dayDate.getFullYear();
      });

      // Check for approved leave if no attendance
      let leaveRecord = null;
      if (!attendanceRecord) {
        leaveRecord = leaveData.find(l => {
          if (l.userId !== emp.uid) return false;
          const start = l.startDate.toDate();
          const end = l.endDate.toDate();
          start.setHours(0,0,0,0);
          end.setHours(23,59,59,999);
          return dayDate >= start && dayDate <= end;
        });
      }

      return { ...emp, attendance: attendanceRecord, leave: leaveRecord };
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-black tracking-tight uppercase">Attendance Management</h1>
          <p className="text-slate-500 text-sm font-medium">Full calendar review and absence tracking.</p>
        </div>
        <div className="flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="px-6 text-sm font-black text-slate-900 min-w-[140px] text-center uppercase tracking-widest">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="h-32 border-b border-r border-slate-50 bg-slate-50/20"></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const count = getAttendanceCountForDay(day);
            const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
            
            return (
              <button 
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`h-32 border-b border-r border-slate-50 p-3 text-left transition-all hover:bg-indigo-50/30 group relative flex flex-col justify-between ${isToday ? 'bg-indigo-50/20' : ''}`}
              >
                <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-900'}`}>{day}</span>
                {count > 0 && (
                  <div className="mt-2 flex flex-col space-y-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${(count / employees.length) * 100}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600">{count}/{employees.length} PRESENT</span>
                  </div>
                )}
                {count === 0 && day <= (isToday ? day : daysInMonth) && (
                   <span className="text-[10px] font-bold text-rose-300">NO RECORDS</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedDay(null)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Staff Status</h2>
                <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest">{selectedDay} {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-10 py-6 space-y-4 no-scrollbar">
              {getEmployeesForDay(selectedDay).map(emp => (
                <div key={emp.uid} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-3xl hover:bg-white hover:border-indigo-100 transition-all">
                  <div className="flex items-center space-x-4">
                    <img className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white shadow-sm" src={`https://picsum.photos/seed/${emp.uid}/100`} alt="" />
                    <div>
                      <h4 className="font-black text-slate-900">{emp.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.title}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    {emp.attendance ? (
                      <div className="flex flex-col items-end">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          emp.attendance.status === 'unpaid_leave' || (emp.attendance.isLate && emp.attendance.lateType === 1)
                            ? 'bg-rose-50 text-rose-600 border-rose-100' 
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                          {emp.attendance.status === 'unpaid_leave' || (emp.attendance.isLate && emp.attendance.lateType === 1) ? 'Unpaid Leave' : 'Checked In'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase">
                          {emp.attendance.checkinAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : emp.leave ? (
                      <div className="flex flex-col items-end">
                        <span className="px-4 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[10px] font-black uppercase tracking-widest">
                          On Leave
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase">
                          {emp.leave.leaveType} Approved
                        </span>
                      </div>
                    ) : (
                      <button 
                        disabled={isMarking === emp.uid}
                        onClick={() => markUnpaidLeave(emp, selectedDay)}
                        className="bg-white border border-slate-200 text-slate-900 px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all flex items-center space-x-2 disabled:opacity-50"
                      >
                        {isMarking === emp.uid ? (
                           <svg className="animate-spin h-3 w-3 text-current" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : null}
                        <span>Mark Unpaid</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManager;
