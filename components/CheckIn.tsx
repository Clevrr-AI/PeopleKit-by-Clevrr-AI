
import React, { useState, useEffect } from 'react';
import { UserProfile, LeaveBalances } from '../types';
// Added missing serverTimestamp import
import { db, collection, addDoc, Timestamp, GeoPoint, doc, getDoc, runTransaction, increment, query, where, orderBy, onSnapshot, updateDoc, serverTimestamp } from '../firebase';

interface CheckInProps {
  user: UserProfile;
}

// Office Coordinates
const OFFICE_LAT = 12.910490;
const OFFICE_LNG = 77.635276;
const MAX_DISTANCE_METERS = 200;

const CheckIn: React.FC<CheckInProps> = ({ user }) => {
  const [status, setStatus] = useState<'idle' | 'locating' | 'processing' | 'success' | 'error' | 'out-of-range'>('idle');
  const [message, setMessage] = useState<string>('');
  const [lateDetail, setLateDetail] = useState<string | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  
  // Daily log state for all users
  const [dailyCheckins, setDailyCheckins] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [rejectionAction, setRejectionAction] = useState<{ id: string; reason: string } | null>(null);
  const isFounder = user.role === 'Founder';

  // Check if current user has already checked in today
  const hasCheckedInToday = dailyCheckins.some(record => record.userId === user.uid);

  // Fetch daily log for everyone
  useEffect(() => {
    setLoadingLog(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'attendance'),
      where('checkinAt', '>=', Timestamp.fromDate(todayStart)),
      where('checkinAt', '<=', Timestamp.fromDate(todayEnd)),
      orderBy('checkinAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const records = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        records.push({ id: docSnap.id, ...data });
      }
      
      const recordsWithNames = await Promise.all(records.map(async (r) => {
        if (r.userName) return r;
        const userSnap = await getDoc(doc(db, 'users', r.userId));
        return { ...r, userName: userSnap.exists() ? userSnap.data().name : 'Unknown User' };
      }));

      setDailyCheckins(recordsWithNames);
      setLoadingLog(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApproveRemote = async (id: string) => {
    try {
      await updateDoc(doc(db, 'attendance', id), {
        status: 'approved',
        processedBy: user.name,
        processedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error approving remote checkin:", err);
    }
  };

  const handleRejectRemote = async () => {
    if (!rejectionAction || !rejectionAction.reason.trim()) return;
    try {
      await updateDoc(doc(db, 'attendance', rejectionAction.id), {
        status: 'rejected',
        comment: rejectionAction.reason,
        processedBy: user.name,
        processedAt: serverTimestamp()
      });
      setRejectionAction(null);
    } catch (err) {
      console.error("Error rejecting remote checkin:", err);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleCheckIn = () => {
    if (hasCheckedInToday) return;

    setStatus('locating');
    setMessage('Acquiring your location...');
    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
        setDistanceInfo(Math.round(distance));
        setCurrentCoords({ lat: latitude, lng: longitude });
        if (distance > MAX_DISTANCE_METERS) {
          setStatus('out-of-range');
          setMessage(`You are ${Math.round(distance)}m away from the office.`);
          return;
        }
        await submitAttendance(latitude, longitude, false, false);
      },
      (error) => {
        setStatus('error');
        setMessage('Unable to retrieve your location.');
      },
      { enableHighAccuracy: true }
    );
  };

  const submitAttendance = async (lat: number, lng: number, isWfh: boolean, isOoo: boolean) => {
    setStatus('processing');
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTimeInMinutes = hours * 60 + minutes;
      const LATE_START_MINUTES = 10 * 60 + 30;
      const FULL_DAY_LATE_MINUTES = 12 * 60 + 30;
      const isActuallyLate = currentTimeInMinutes > LATE_START_MINUTES;
      
      let finalIsLate = false;
      let finalLateType: number | null = null;
      let lateMsg: string | null = null;

      await runTransaction(db, async (transaction) => {
        const balanceRef = doc(db, 'leaveBalances', user.uid);
        const balanceSnap = await transaction.get(balanceRef);
        const balances = balanceSnap.exists() ? (balanceSnap.data() as LeaveBalances) : { lateWarningLeft: 3 };
        const warningsLeft = balances.lateWarningLeft !== undefined ? balances.lateWarningLeft : 3;

        if (isActuallyLate) {
          if (warningsLeft > 0) {
            transaction.update(balanceRef, { lateWarningLeft: increment(-1) });
            finalIsLate = false;
            lateMsg = `Late arrival warning used. ${warningsLeft - 1} left.`;
          } else {
            finalIsLate = true;
            finalLateType = currentTimeInMinutes >= FULL_DAY_LATE_MINUTES ? 1 : 0.5;
            lateMsg = `Warnings exhausted. Marked as ${finalLateType === 1 ? 'Full' : 'Half'} Day Late.`;
          }
        }

        const attendanceData: any = {
          checkinAt: Timestamp.now(),
          userId: user.uid,
          userName: user.name,
          latLong: new GeoPoint(lat, lng),
          isHalfDay: false,
          isWfh: isWfh,
          isOutOfOffice: isOoo,
          isLate: finalIsLate,
          lateType: finalLateType,
        };

        if (isWfh || isOoo) {
          attendanceData.status = 'pending';
          attendanceData.managerId = user.managerId || '';
        }

        const attendanceRef = doc(collection(db, 'attendance'));
        transaction.set(attendanceRef, attendanceData);
      });

      setStatus('success');
      setLateDetail(lateMsg);
      setMessage(isWfh ? "WFH submitted." : isOoo ? "OOO submitted." : "Successfully checked in!");
    } catch (error: any) {
      setStatus('error');
      setMessage('Failed to save attendance.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
      {/* Check In Widget */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden text-center relative max-w-xl mx-auto">
        <div className={`h-2 transition-all duration-500 ${hasCheckedInToday ? 'bg-emerald-200' : status === 'out-of-range' ? 'bg-amber-400' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}></div>
        <div className="p-10 space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Daily Attendance</h1>
            <p className="text-slate-500 font-medium">
              {hasCheckedInToday ? "You have already marked your attendance for today." : "Please confirm your presence at the office."}
            </p>
          </div>
          <div className="relative">
            {status === 'success' ? (
              <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7" strokeWidth={3} /></svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Success!</h3>
                <p className="text-emerald-600 font-medium mt-4">{message}</p>
                <button onClick={() => setStatus('idle')} className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 underline">Done</button>
              </div>
            ) : status === 'out-of-range' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] text-left">
                  <h3 className="font-black text-lg text-amber-700 mb-1">Location Warning</h3>
                  <p className="text-amber-800 text-sm font-medium">You are <strong>{distanceInfo}m</strong> away. Office check-in radius is <strong>{MAX_DISTANCE_METERS}m</strong>.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => submitAttendance(currentCoords!.lat, currentCoords!.lng, true, false)} className="flex flex-col items-center p-6 bg-white border-2 border-indigo-100 hover:border-indigo-600 rounded-3xl transition-all">
                    <span className="text-sm font-black text-slate-900">Mark as WFH</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Pending Approval</span>
                  </button>
                  <button onClick={() => submitAttendance(currentCoords!.lat, currentCoords!.lng, false, true)} className="flex flex-col items-center p-6 bg-white border-2 border-slate-100 hover:border-slate-800 rounded-3xl transition-all">
                    <span className="text-sm font-black text-slate-900">Mark as OOO</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Pending Approval</span>
                  </button>
                </div>
                <button onClick={() => setStatus('idle')} className="text-sm font-bold text-slate-400 underline">Try again</button>
              </div>
            ) : (
              <button 
                onClick={handleCheckIn} 
                disabled={status === 'locating' || status === 'processing' || hasCheckedInToday} 
                className={`group relative w-64 h-64 rounded-full flex flex-col items-center justify-center mx-auto transition-all duration-300 shadow-xl ${
                  hasCheckedInToday 
                    ? 'bg-slate-100 cursor-not-allowed scale-95 border-4 border-emerald-100' 
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-105 active:scale-95'
                }`}
              >
                {status === 'locating' || status === 'processing' ? (
                  <span className="text-white font-bold animate-pulse">Processing...</span>
                ) : hasCheckedInToday ? (
                  <>
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-2xl font-black text-emerald-600 tracking-tight">CHECKED IN</span>
                    <span className="text-slate-400 text-[10px] mt-1 font-bold uppercase">Attendance Recorded</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-white tracking-tight">CHECK IN</span>
                    <span className="text-emerald-100 text-sm mt-1 font-medium">Tap to mark attendance</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Daily Attendance Log - Visible to all */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-700">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Daily Attendance Log</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Live Feed - {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
            {dailyCheckins.length} Checked In
          </div>
        </div>
        
        {loadingLog ? (
          <div className="p-20 text-center"><p className="text-slate-400 font-bold text-sm">Synchronizing log...</p></div>
        ) : dailyCheckins.length === 0 ? (
          <div className="p-20 text-center"><p className="text-slate-400 font-black text-lg">No check-ins yet today</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/30">
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dailyCheckins.map((record) => (
                  <tr key={record.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-9 w-9 rounded-2xl mr-3 border border-slate-100" src={`https://picsum.photos/seed/${record.userId}/100`} alt="" />
                        <div>
                          <div className={`text-sm font-black ${record.userId === user.uid ? 'text-indigo-600' : 'text-slate-900'}`}>
                            {record.userName || 'Loading...'} {record.userId === user.uid && '(You)'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{record.userId.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <span className="text-sm font-black text-slate-700">
                        {record.checkinAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {record.isWfh ? (
                          <span className="flex items-center text-[10px] font-black text-indigo-500 uppercase">WFH</span>
                        ) : record.isOutOfOffice ? (
                          <span className="flex items-center text-[10px] font-black text-slate-500 uppercase">OOO</span>
                        ) : (
                          <span className="flex items-center text-[10px] font-black text-emerald-500 uppercase">In Office</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        {/* Attendance State Pills */}
                        {record.isLate ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${record.lateType === 1 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                            {record.lateType === 1 ? 'Full Day Late' : 'Half Day Late'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-md text-[10px] font-black uppercase tracking-wider">
                            On Time
                          </span>
                        )}

                        {/* Remote Status Handling */}
                        {(record.isWfh || record.isOutOfOffice) && (
                          <div className="flex items-center space-x-2">
                            {record.status === 'pending' ? (
                              isFounder ? (
                                <div className="flex space-x-1">
                                  <button 
                                    onClick={() => handleApproveRemote(record.id)}
                                    className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-emerald-700 shadow-sm"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    onClick={() => setRejectionAction({ id: record.id, reason: '' })}
                                    className="px-3 py-1 bg-rose-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-rose-700 shadow-sm"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-black uppercase border border-slate-200">
                                  Pending
                                </span>
                              )
                            ) : record.status === 'approved' ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[10px] font-black uppercase">
                                Remote Approved
                              </span>
                            ) : record.status === 'rejected' ? (
                              <div className="group relative flex items-center">
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-md text-[10px] font-black uppercase">
                                  Remote Rejected
                                </span>
                                {record.comment && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                    Reason: {record.comment}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectionAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRejectionAction(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 space-y-6">
            <h3 className="text-xl font-black text-slate-900">Reject Request</h3>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Rejection</label>
              <textarea 
                autoFocus
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none font-bold text-slate-900 text-sm resize-none"
                rows={3}
                placeholder="Brief reason..."
                value={rejectionAction.reason}
                onChange={e => setRejectionAction({...rejectionAction, reason: e.target.value})}
              />
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setRejectionAction(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
              <button 
                onClick={handleRejectRemote}
                disabled={!rejectionAction.reason.trim()}
                className="flex-1 py-3 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 shadow-xl shadow-rose-100 disabled:opacity-50 transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckIn;
