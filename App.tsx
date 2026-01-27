
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
import CheckIn from './components/CheckIn';
import Layout from './components/Layout';
import AttendanceManager from './components/AttendanceManager';
import { auth, db, doc, getDoc, onAuthStateChanged, signInWithEmailAndPassword, signOut, onSnapshot } from './firebase';

const CURRENT_APP_VERSION = '1.0.13';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [view, setView] = useState<ViewType>('dashboard');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalances | null>(null);
  const [retentionBonus, setRetentionBonus] = useState<RetentionBonus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // PWA & Remote Update State
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [showVersionBanner, setShowVersionBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

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

  const handleUpdateApp = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  };

  const handleHardRefresh = async () => {
    setLoading(true);
    // 1. Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    // 2. Clear all browser caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    // 3. Forced reload from server
    window.location.reload();
  };

  // Handle initial routing and back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      const validViews: ViewType[] = ['dashboard', 'apply-leave', 'profile', 'salaries', 'payslips', 'reimbursements', 'team', 'check-in', 'attendance'];
      if (validViews.includes(hash as ViewType)) {
        setView(hash as ViewType);
      } else if (!hash) {
        setView('dashboard');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when view state changes programmatically
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
              if (typeof userData.joiningDate.toDate === 'function') {
                joiningDateStr = userData.joiningDate.toDate().toISOString().split('T')[0];
              } else {
                joiningDateStr = String(userData.joiningDate);
              }
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
          } else {
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              title: 'New Employee',
              role: 'Employee',
              department: 'Unassigned',
              joiningDate: new Date().toISOString().split('T')[0],
              managerId: '',
              email: firebaseUser.email || ''
            } as UserProfile);
          }

          if (leaveSnap.exists()) {
            const data = leaveSnap.data();
            setLeaveBalances({
              ...data,
              lateWarningLeft: data.lateWarningLeft !== undefined ? data.lateWarningLeft : 3
            } as LeaveBalances);
          } else {
            setLeaveBalances({
              clTotal: 24,
              clBalance: 24,
              currentMonthClUsed: 0,
              slTotal: 12,
              slBalance: 12,
              currentMonthSlUsed: 0,
              hdlCount: 0,
              lateWarningLeft: 3
            });
          }

          if (bonusSnap.exists()) {
            setRetentionBonus(bonusSnap.data() as RetentionBonus);
          } else {
            setRetentionBonus({
              totalBonus: 0,
              bonusMonths: []
            });
          }

          setIsAuthenticated(true);
        } catch (err: any) {
          console.error("Error fetching user data:", err);
          setError("Failed to load HR data. Please check your connection.");
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setLeaveBalances(null);
        setRetentionBonus(null);
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
      setError(err.message || "Invalid credentials. Please try again.");
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
    return (
      <div className="relative">
        {showVersionBanner && (
          <div className="bg-indigo-600 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left gap-3 animate-in slide-in-from-top duration-500 sticky top-0 z-[300]">
            <p className="text-xs font-black uppercase tracking-widest flex items-center">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-ping"></span>
              A new update is available
            </p>
            <button 
              onClick={handleHardRefresh}
              className="bg-white text-indigo-600 px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 shadow-sm active:scale-95 transition-all"
            >
              Sync & Refresh
            </button>
          </div>
        )}
        <Login onLogin={handleLogin} isLoading={loading} error={error} />
      </div>
    );
  }

  return (
    <div className="relative">
      {showVersionBanner && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left gap-3 animate-in slide-in-from-top duration-500 sticky top-0 z-[300]">
          <p className="text-xs font-black uppercase tracking-widest flex items-center">
            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-ping"></span>
            A newer version of Clevrr HR is available
          </p>
          <button 
            onClick={handleHardRefresh}
            className="bg-white text-indigo-600 px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 shadow-sm active:scale-95 transition-all"
          >
            Update Now
          </button>
        </div>
      )}

      <Layout 
        user={user!} 
        onLogout={handleLogout} 
        activeView={view} 
        setView={setView}
        onHardRefresh={handleHardRefresh}
      >
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* SW Waiting Toast (Legacy) */}
        {showUpdateToast && !showVersionBanner && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-md">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-indigo-500 rounded-2xl flex items-center justify-center animate-bounce">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight">System Update</p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">PWA version is outdated</p>
                </div>
              </div>
              <button 
                onClick={handleUpdateApp}
                className="bg-white text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black hover:bg-indigo-50 transition-all active:scale-95 whitespace-nowrap"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <Dashboard 
            user={user!}
            leaveBalances={leaveBalances!} 
            retentionBonus={retentionBonus!} 
          />
        )}
        {view === 'profile' && (
          <Profile user={user!} />
        )}
        {view === 'apply-leave' && (
          <ApplyLeave user={user!} onSuccess={() => setView('dashboard')} />
        )}
        {view === 'salaries' && (
          <SalaryProcessing />
        )}
        {view === 'payslips' && (
          <Payslips user={user!} />
        )}
        {view === 'reimbursements' && (
          <Reimbursements user={user!} />
        )}
        {view === 'team' && (
          <Team user={user!} />
        )}
        {view === 'check-in' && (
          <CheckIn user={user!} />
        )}
        {view === 'attendance' && (
          <AttendanceManager user={user!} />
        )}
      </Layout>
    </div>
  );
};

export default App;
