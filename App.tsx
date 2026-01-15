
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
import { auth, db, doc, getDoc, onAuthStateChanged, signInWithEmailAndPassword, signOut } from './firebase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [view, setView] = useState<ViewType>('dashboard');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalances | null>(null);
  const [retentionBonus, setRetentionBonus] = useState<RetentionBonus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
            
            // Helper to handle Timestamp or String for joiningDate
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
        setView('dashboard');
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
    <Layout user={user!} onLogout={handleLogout} activeView={view} setView={setView}>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
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
    </Layout>
  );
};

export default App;
