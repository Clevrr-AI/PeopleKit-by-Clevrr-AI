
import React, { useState, useEffect } from 'react';
import { UserProfile, LeaveBalances } from '../types';
import { db, collection, addDoc, Timestamp, GeoPoint, doc, getDoc, runTransaction, increment, query, where, orderBy, onSnapshot } from '../firebase';

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
  
  // Founder state for daily log
  const [dailyCheckins, setDailyCheckins] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const isFounder = user.role === 'Founder';

  // Fetch daily log for founders
  useEffect(() => {
    if (!isFounder) return;
    
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
        // We might want to fetch user names if they aren't in the attendance record
        // For simplicity, we'll assume we might need a lookup if name isn't present
        records.push({ id: docSnap.id, ...data });
      }
      
      // Resolve names if they aren't stored in attendance (assuming they might not be for now)
      // Optimally, store 'userName' in attendance record at check-in time
      const recordsWithNames = await Promise.all(records.map(async (r) => {
        if (r.userName) return r;
        const userSnap = await getDoc(doc(db, 'users', r.userId));
        return { ...r, userName: userSnap.exists() ? userSnap.data().name : 'Unknown User' };
      }));

      setDailyCheckins(recordsWithNames);
      setLoadingLog(false);
    });

    return () => unsubscribe();
  }, [isFounder]);

  // Haversine formula to calculate distance in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleCheckIn = () => {
    setStatus('locating');
    setMessage('Acquiring your location...');
    setDistanceInfo(null);
    setCurrentCoords(null);
    setLateDetail(null);

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
        console.error("Geolocation error", error);
        setStatus('error');
        setMessage('Unable to retrieve your location. Please ensure location services are enabled.');
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
      
      const LATE_START_MINUTES = 10 * 60 + 30; // 10:30 AM
      const FULL_DAY_LATE_MINUTES = 12 * 60 + 30; // 12:30 PM
      
      const isActuallyLate = currentTimeInMinutes > LATE_START_MINUTES;
      
      let finalIsLate = false;
      let finalLateType: number | null = null;
      let lateMsg: string | null = null;

      // Run as a transaction to handle warning count decrement
      await runTransaction(db, async (transaction) => {
        const balanceRef = doc(db, 'leaveBalances', user.uid);
        const balanceSnap = await transaction.get(balanceRef);
        
        const balances = balanceSnap.exists() ? (balanceSnap.data() as LeaveBalances) : { lateWarningLeft: 3 };
        const warningsLeft = balances.lateWarningLeft !== undefined ? balances.lateWarningLeft : 3;

        if (isActuallyLate) {
          if (warningsLeft > 0) {
            // Option A: Consume a warning
            const newWarningCount = warningsLeft - 1;
            transaction.update(balanceRef, { lateWarningLeft: increment(-1) });
            finalIsLate = false;
            finalLateType = null;
            lateMsg = `Late arrival warning used. ${newWarningCount} warnings remaining.`;
          } else {
            // Option B: All warnings exhausted, mark as late
            finalIsLate = true;
            finalLateType = currentTimeInMinutes >= FULL_DAY_LATE_MINUTES ? 1 : 0.5;
            lateMsg = `Warnings exhausted. Marked as ${finalLateType === 1 ? 'Full' : 'Half'} Day Late.`;
          }
        } else {
          // On time
          finalIsLate = false;
          finalLateType = null;
        }

        const attendanceData: any = {
          checkinAt: Timestamp.now(),
          userId: user.uid,
          userName: user.name, // Storing name directly for easier log access
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
      if (isWfh) setMessage(`WFH request submitted for ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`);
      else if (isOoo) setMessage(`OOO request submitted for ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`);
      else setMessage(`Successfully checked in at ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}!`);
    } catch (error: any) {
      console.error("Check-in error", error);
      setStatus('error');
      setMessage('Failed to save attendance. Please try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden text-center relative max-w-xl mx-auto">
        <div className={`h-2 transition-all duration-500 ${status === 'out-of-range' ? 'bg-amber-400' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}></div>
        
        <div className="p-10 space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Daily Attendance</h1>
            <p className="text-slate-500 font-medium">Please confirm your presence at the office.</p>
          </div>

          <div className="relative">
            {status === 'success' ? (
              <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Success!</h3>
                <div className="mt-4 space-y-2">
                  <p className="text-emerald-600 font-medium max-w-xs mx-auto">{message}</p>
                  {lateDetail && (
                    <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold border border-indigo-100 inline-block">
                      {lateDetail}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setStatus('idle')}
                  className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 underline"
                >
                  Done
                </button>
              </div>
            ) : status === 'out-of-range' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] text-left">
                  <div className="flex items-center space-x-3 mb-3 text-amber-700">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="font-black text-lg">Location Warning</h3>
                  </div>
                  <p className="text-amber-800 text-sm font-medium leading-relaxed">
                    You are currently <strong>{distanceInfo}m</strong> away. Office check-in is restricted to a <strong>{MAX_DISTANCE_METERS}m</strong> radius.
                  </p>
                  <p className="text-amber-700 text-xs mt-2 italic font-medium">Please select a remote check-in option below:</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => submitAttendance(currentCoords!.lat, currentCoords!.lng, true, false)}
                    className="flex flex-col items-center justify-center p-6 bg-white border-2 border-indigo-100 hover:border-indigo-600 rounded-3xl group transition-all"
                  >
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <span className="text-sm font-black text-slate-900">Mark as WFH</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Pending Approval</span>
                  </button>

                  <button 
                    onClick={() => submitAttendance(currentCoords!.lat, currentCoords!.lng, false, true)}
                    className="flex flex-col items-center justify-center p-6 bg-white border-2 border-slate-100 hover:border-slate-800 rounded-3xl group transition-all"
                  >
                    <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-black text-slate-900">Mark as OOO</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Pending Approval</span>
                  </button>
                </div>
                
                <button 
                  onClick={() => setStatus('idle')}
                  className="text-sm font-bold text-slate-400 hover:text-slate-600"
                >
                  Try location again
                </button>
              </div>
            ) : (
              <button
                onClick={handleCheckIn}
                disabled={status === 'locating' || status === 'processing'}
                className={`
                  group relative w-64 h-64 rounded-full flex flex-col items-center justify-center mx-auto transition-all duration-300
                  ${status === 'locating' || status === 'processing' 
                    ? 'bg-slate-100 cursor-wait scale-95' 
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-105 hover:shadow-2xl shadow-emerald-200/50 shadow-xl cursor-pointer'
                  }
                `}
              >
                {status === 'locating' || status === 'processing' ? (
                  <>
                     <svg className="animate-spin h-12 w-12 text-slate-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-slate-500 font-bold animate-pulse">
                      {status === 'locating' ? 'Locating...' : 'Saving...'}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-20 h-20 text-white mb-2 transform group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-2xl font-black text-white tracking-tight">CHECK IN</span>
                    <span className="text-emerald-100 text-sm mt-1 font-medium">Tap to mark attendance</span>
                  </>
                )}
              </button>
            )}
          </div>

          {status === 'error' && (
             <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
               {message}
             </div>
          )}
          
          {distanceInfo !== null && status !== 'success' && status !== 'out-of-range' && (
            <p className="text-xs text-slate-400 font-medium">
              Distance to office: <span className={distanceInfo > MAX_DISTANCE_METERS ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>{distanceInfo}m</span>
            </p>
          )}

          <div className="pt-8 border-t border-slate-100">
             <div className="flex justify-center items-center space-x-6 text-xs text-slate-400">
               <div className="flex items-center">
                 <div className="w-2 h-2 bg-slate-300 rounded-full mr-2"></div>
                 Reporting time: 10:30 AM
               </div>
               <div className="flex items-center">
                 <div className="w-2 h-2 bg-slate-300 rounded-full mr-2"></div>
                 Radius: {MAX_DISTANCE_METERS}m
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Founder View - Daily Log */}
      {isFounder && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Daily Attendance Log</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Live Feed - {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              {dailyCheckins.length} Checked In
            </div>
          </div>
          
          {loadingLog ? (
            <div className="p-20 text-center">
              <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-4 text-slate-400 font-bold text-sm">Synchronizing log...</p>
            </div>
          ) : dailyCheckins.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-400 font-black text-lg">No check-ins yet today</p>
              <p className="text-slate-400 text-sm font-medium">Data will appear as employees mark their presence.</p>
            </div>
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
                          <img className="h-9 w-9 rounded-2xl mr-3 border border-slate-100 group-hover:border-indigo-200 transition-colors" src={`https://picsum.photos/seed/${record.userId}/100`} alt="" />
                          <div>
                            <div className="text-sm font-black text-slate-900">{record.userName || 'Loading...'}</div>
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
                            <span className="flex items-center text-[10px] font-black text-indigo-500 uppercase">
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              WFH
                            </span>
                          ) : record.isOutOfOffice ? (
                            <span className="flex items-center text-[10px] font-black text-slate-500 uppercase">
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              OOO
                            </span>
                          ) : (
                            <span className="flex items-center text-[10px] font-black text-emerald-500 uppercase">
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              In Office
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-4 whitespace-nowrap">
                        {record.isLate ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${record.lateType === 1 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                            {record.lateType === 1 ? 'Full Day Late' : 'Half Day Late'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-md text-[10px] font-black uppercase tracking-wider">
                            On Time
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckIn;
