
import React, { useState } from 'react';
import { UserProfile, ViewType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile;
  onLogout: () => void;
  activeView: ViewType;
  setView: (view: ViewType) => void;
  onHardRefresh: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeView, setView, onHardRefresh }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isFounder = user.role === 'Founder';

  const handleNavClick = (view: ViewType) => {
    setView(view);
    window.location.hash = `#/${view}`;
    setIsMobileMenuOpen(false);
  };

  const NavContent = () => (
    <>
      <div className="mb-6">
        <button 
          onClick={() => handleNavClick('check-in')}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02] active:scale-95 group flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200"
        >
          <svg className="mr-3 h-5 w-5 text-emerald-100 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Check In
        </button>
      </div>

      <button 
        onClick={() => handleNavClick('dashboard')}
        className={`${activeView === 'dashboard' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
      >
        <svg className={`${activeView === 'dashboard' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Dashboard
      </button>

      {isFounder && (
        <button 
          onClick={() => handleNavClick('attendance')}
          className={`${activeView === 'attendance' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
        >
          <svg className={`${activeView === 'attendance' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Attendance
        </button>
      )}

      <button 
        onClick={() => handleNavClick('team')}
        className={`${activeView === 'team' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
      >
        <svg className={`${activeView === 'team' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        Team
      </button>

      <button 
        onClick={() => handleNavClick('payslips')}
        className={`${activeView === 'payslips' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
      >
        <svg className={`${activeView === 'payslips' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        My Payslips
      </button>

      <button 
        onClick={() => handleNavClick('reimbursements')}
        className={`${activeView === 'reimbursements' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
      >
        <svg className={`${activeView === 'reimbursements' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Reimbursements
      </button>

      {isFounder && (
        <button 
          onClick={() => handleNavClick('salaries')}
          className={`${activeView === 'salaries' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
        >
          <svg className={`${activeView === 'salaries' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Salaries
        </button>
      )}

      <button 
        onClick={() => handleNavClick('apply-leave')}
        className={`${activeView === 'apply-leave' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
      >
        <svg className={`${activeView === 'apply-leave' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Apply for Leave
      </button>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div 
            className="fixed inset-0 bg-slate-600 bg-opacity-75 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white transition-all transform duration-300">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4 space-x-3">
                <div className="5 rounded-lg">
                  <img className="h-10 w-10 text-white" src="https://getclevrr.com/logos/favicon.png" alt="Clevrr HR Logo" />
                </div>
                <span className="text-xl font-bold text-slate-900 tracking-tight">Clevrr HR</span>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                <NavContent />
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-slate-200 p-4 flex-col space-y-2">
              <div className="flex-shrink-0 group block w-full">
                <div className="flex items-center">
                  <div className="cursor-pointer" onClick={() => handleNavClick('profile')}>
                    <img className="inline-block h-10 w-10 rounded-full" src={`https://picsum.photos/seed/${user.uid}/100`} alt="" />
                  </div>
                  <div className="ml-3">
                    <p className="text-base font-medium text-slate-700 group-hover:text-slate-900 cursor-pointer" onClick={() => handleNavClick('profile')}>
                      {user.name}
                    </p>
                    <button onClick={onLogout} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Sign out</button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-2 pt-2">
                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">v1.0.14</span>
                <button 
                  onClick={onHardRefresh}
                  className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  title="Force Update App"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 w-14"></div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-slate-200 bg-white">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-6 space-x-3">
              <div className="5 rounded-lg">
                <img className="h-10 w-10 text-white" src="https://getclevrr.com/logos/favicon.png" alt="Clevrr HR Logo" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Clevrr HR</span>
            </div>
            <nav className="mt-8 flex-1 px-4 space-y-1">
              <NavContent />
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-slate-200 p-4 flex-col space-y-2">
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div onClick={() => handleNavClick('profile')} className="cursor-pointer">
                  <img className="inline-block h-10 w-10 rounded-full hover:ring-2 hover:ring-indigo-500 transition-all" src={`https://picsum.photos/seed/${user.uid}/100`} alt="" />
                </div>
                <div className="ml-3">
                  <p 
                    onClick={() => handleNavClick('profile')}
                    className="text-sm font-medium text-slate-700 group-hover:text-slate-900 cursor-pointer"
                  >
                    {user.name}
                  </p>
                  <button onClick={onLogout} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Sign out</button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">v1.0.14</span>
              <button 
                onClick={onHardRefresh}
                className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Force Update App"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
           <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="-ml-2 p-2 rounded-md text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-2">
              <div className="rounded-md">
                <img className="h-10 w-10 text-white" src="https://getclevrr.com/logos/favicon.png" alt="Clevrr HR Logo" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">Clevrr HR</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setView('profile')} className="p-2 text-slate-500">
               <img className="h-8 w-8 rounded-full" src={`https://picsum.photos/seed/${user.uid}/100`} alt="" />
            </button>
          </div>
        </div>

        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none py-8 px-4 sm:px-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
