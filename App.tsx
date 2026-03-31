
import React, { useState, useEffect } from 'react';
import { UserProfile, LeaveBalances, RetentionBonus, ViewType } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ApplyLeave from './components/ApplyLeave';
import Profile from './components/Profile';
import SalaryProcessing from './components/SalaryProcessing';
import Payslips from './components/Payslips';
import Reimbursements from './components/Reimbursements';
import Team from './components/Team';
import Analytics from './components/Analytics';
import CheckIn from './components/CheckIn';
import Layout from './components/Layout';
import AttendanceManager from './components/AttendanceManager';
import { auth, db, doc, getDoc, onAuthStateChanged, signInWithEmailAndPassword, signOut, onSnapshot } from './firebase';

const CURRENT_APP_VERSION = '1.0.24';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [view, setView] = useState<ViewType>('dashboard');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalances | null>(null);
  const [retentionBonus, setRetentionBonus] = useState<RetentionBonus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Impersonation State
  const [impersonatedUid, setImpersonatedUid] = useState<string | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);
  const [impersonatedBalances, setImpersonatedBalances] = useState<LeaveBalances | null>(null);
  const [impersonatedBonus, setImpersonatedBonus] = useState<RetentionBonus | null>(null);
  const [loadingImpersonation, setLoadingImpersonation] = useState(false);

  // PWA & Remote Update State
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [showVersionBanner, setShowVersionBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  // Active Context computed properties
  const activeUser = impersonatedProfile || user;
  const activeBalances = impersonatedBalances || leaveBalances;
  const activeBonus = impersonatedBonus || retentionBonus;
  const isImpersonating = !!impersonatedUid;

  // 1. Remote Firestore Version Check
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'appData', 'latest'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.appVersion && data.appVersion !== CURRENT_APP_VERSION) {
          setShowVersionBanner(true);
        } else {
          setShowVersionBanner(false);
        }
      }
    });
    return () => unsub();
  }, []);

  // 2. Service Worker Lifecycle Management
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg?.waiting) {
          setWaitingWorker(reg.waiting);
          setShowUpdateToast(true);
        }

        reg?.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowUpdateToast(true);
              }
            });
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }
  }, []);

  // Impersonation Data Fetcher
  useEffect(() => {
    if (!impersonatedUid) {
      setImpersonatedProfile(null);
      setImpersonatedBalances(null);
      setImpersonatedBonus(null);
      return;
    }

    const fetchImpersonatedData = async () => {
      setLoadingImpersonation(true);
      try {
        const [uSnap, lSnap, bSnap] = await Promise.all([
          getDoc(doc(db, 'users', impersonatedUid)),
          getDoc(doc(db, 'leaveBalances', impersonatedUid)),
          getDoc(doc(db, 'retentionBonus', impersonatedUid))
        ]);

        if (uSnap.exists()) {
          const data = uSnap.data();
          setImpersonatedProfile({ uid: uSnap.id, ...data } as UserProfile);
        }
        
        if (lSnap.exists()) {
          setImpersonatedBalances(lSnap.data() as LeaveBalances);
        } else {
          setImpersonatedBalances({
            clTotal: 24, clBalance: 24, currentMonthClUsed: 0,
            slTotal: 12, slBalance: 12, currentMonthSlUsed: 0,
            hdlCount: 0, lateWarningLeft: 3
          });
        }

        if (bSnap.exists()) {
          setImpersonatedBonus(bSnap.data() as RetentionBonus);
        } else {
          setImpersonatedBonus({ totalBonus: 0, bonusMonths: [] });
        }
      } catch (err) {
        console.error("Failed to impersonate:", err);
      } finally {
        setLoadingImpersonation(false);
      }
    };

    fetchImpersonatedData();
  }, [impersonatedUid]);

  const handleUpdateApp = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  };

  const handleHardRefresh = async () => {
    setLoading(true);
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    window.location.reload();
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      const validViews: ViewType[] = ['dashboard', 'apply-leave', 'profile', 'salaries', 'payslips', 'reimbursements', 'team', 'check-in', 'attendance', 'analytics'];
      if (validViews.includes(hash as ViewType)) {
        setView(hash as ViewType);
      } else if (!hash) {
        setView('dashboard');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.hash = `#/${view}`;
    }
  }, [view, isAuthenticated]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);
      if (firebaseUser) {
        try {
          const [userSnap, leaveSnap, bonusSnap] = await Promise.all([
            getDoc(doc(db, 'users', firebaseUser.uid)),
            getDoc(doc(db, 'leaveBalances', firebaseUser.uid)),
            getDoc(doc(db, 'retentionBonus', firebaseUser.uid))
          ]);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            let joiningDateStr = 'Unknown';
            if (userData.joiningDate) {
              joiningDateStr = typeof userData.joiningDate.toDate === 'function' 
                ? userData.joiningDate.toDate().toISOString().split('T')[0] 
                : String(userData.joiningDate);
            }
            setUser({ 
              uid: firebaseUser.uid, 
              name: userData.name || userData.displayName || firebaseUser.displayName || 'No Name',
              title: userData.title || userData.role || 'No Title',
              role: userData.role || 'Employee',
              department: userData.department || 'General',
              joiningDate: joiningDateStr,
              managerId: userData.managerId || '',
              email: firebaseUser.email || ''
            } as UserProfile);
          }

          if (leaveSnap.exists()) {
            const data = leaveSnap.data();
            setLeaveBalances({
              ...data,
              lateWarningLeft: data.lateWarningLeft !== undefined ? data.lateWarningLeft : 3,
            } as LeaveBalances);
          } else {
            setLeaveBalances({ clTotal: 24, clBalance: 24, currentMonthClUsed: 0, slTotal: 12, slBalance: 12, currentMonthSlUsed: 0, hdlCount: 0, lateWarningLeft: 3 });
          }

          if (bonusSnap.exists()) {
            setRetentionBonus(bonusSnap.data() as RetentionBonus);
          } else {
            setRetentionBonus({ totalBonus: 0, bonusMonths: [] });
          }
          setIsAuthenticated(true);
        } catch (err: any) {
          console.error("Error fetching user data:", err);
          setError("Failed to load HR data.");
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setLeaveBalances(null);
        setRetentionBonus(null);
        setImpersonatedUid(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (email: string, password?: string) => {
    setError(null);
    setLoading(true);
    try {
      if (!password) throw new Error("Password is required");
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Invalid credentials.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.hash = '';
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-slate-500 font-medium">Loading your HR portal...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} isLoading={loading} error={error} />;
  }

  return (
    <div className="relative">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-4 sticky top-0 z-[400] shadow-md">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            <span className="text-xs font-black uppercase tracking-widest">
              Viewing as: <span className="underline">{activeUser?.name}</span>
            </span>
          </div>
          <button 
            onClick={() => setImpersonatedUid(null)}
            className="bg-white text-amber-600 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider hover:bg-amber-50 transition-all active:scale-95"
          >
            Reset View
          </button>
        </div>
      )}

      {showVersionBanner && !isImpersonating && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left gap-3 animate-in slide-in-from-top duration-500 sticky top-0 z-[300]">
          <p className="text-xs font-black uppercase tracking-widest flex items-center">
            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-ping"></span>
            A newer version of Clevrr HR is available
          </p>
          <button onClick={handleHardRefresh} className="bg-white text-indigo-600 px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 shadow-sm active:scale-95 transition-all">Update Now</button>
        </div>
      )}

      <Layout 
        user={user!} 
        onLogout={handleLogout} 
        activeView={view} 
        setView={setView}
        onHardRefresh={handleHardRefresh}
      >
        {loadingImpersonation ? (
           <div className="flex flex-col items-center justify-center py-20">
              <svg className="animate-spin h-8 w-8 text-amber-500 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Transforming Reality...</p>
           </div>
        ) : (
          <>
            {view === 'dashboard' && (
              <Dashboard 
                user={activeUser!}
                leaveBalances={activeBalances!} 
                retentionBonus={activeBonus!} 
                isFounder={user?.role === 'Founder'}
                onImpersonate={setImpersonatedUid}
                impersonatedUid={impersonatedUid}
              />
            )}
            {view === 'profile' && <Profile user={activeUser!} />}
            {view === 'apply-leave' && <ApplyLeave user={activeUser!} onSuccess={() => setView('dashboard')} />}
            {view === 'salaries' && <SalaryProcessing />}
            {view === 'payslips' && <Payslips user={activeUser!} />}
            {view === 'reimbursements' && <Reimbursements user={activeUser!} />}
            {view === 'team' && <Team user={activeUser!} />}
            {view === 'check-in' && <CheckIn user={activeUser!} />}
            {view === 'attendance' && <AttendanceManager user={activeUser!} />}
            {view === 'analytics' && <Analytics user={activeUser!} />}
          </>
        )}
      </Layout>
    </div>
  );
};

export default App;
