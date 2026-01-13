
import React from 'react';
import { UserProfile, ViewType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile;
  onLogout: () => void;
  activeView: ViewType;
  setView: (view: ViewType) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeView, setView }) => {
  const isFounder = user.role === 'Founder';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-slate-200 bg-white">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-6 space-x-3">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Clevrr HR</span>
            </div>
            <nav className="mt-8 flex-1 px-4 space-y-1">
              <button 
                onClick={() => setView('dashboard')}
                className={`${activeView === 'dashboard' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
              >
                <svg className={`${activeView === 'dashboard' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </button>
              <button 
                onClick={() => setView('profile')}
                className={`${activeView === 'profile' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
              >
                <svg className={`${activeView === 'profile' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </button>

              <button 
                onClick={() => setView('payslips')}
                className={`${activeView === 'payslips' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
              >
                <svg className={`${activeView === 'payslips' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                My Payslips
              </button>

              <button 
                onClick={() => setView('reimbursements')}
                className={`${activeView === 'reimbursements' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
              >
                <svg className={`${activeView === 'reimbursements' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Reimbursements
              </button>

              {isFounder && (
                <button 
                  onClick={() => setView('salaries')}
                  className={`${activeView === 'salaries' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
                >
                  <svg className={`${activeView === 'salaries' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Salaries
                </button>
              )}

              <button 
                onClick={() => setView('apply-leave')}
                className={`${activeView === 'apply-leave' ? 'bg-slate-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} group w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors`}
              >
                <svg className={`${activeView === 'apply-leave' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} mr-3 h-5 w-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Apply for Leave
              </button>
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-slate-200 p-4">
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div onClick={() => setView('profile')} className="cursor-pointer">
                  <img className="inline-block h-10 w-10 rounded-full hover:ring-2 hover:ring-indigo-500 transition-all" src={`https://picsum.photos/seed/${user.uid}/100`} alt="" />
                </div>
                <div className="ml-3">
                  <p 
                    onClick={() => setView('profile')}
                    className="text-sm font-medium text-slate-700 group-hover:text-slate-900 cursor-pointer"
                  >
                    {user.name}
                  </p>
                  <button onClick={onLogout} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Sign out</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
           <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1 rounded-md">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">Clevrr HR</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setView('profile')} className="p-2 text-slate-500">
               <img className="h-8 w-8 rounded-full" src={`https://picsum.photos/seed/${user.uid}/100`} alt="" />
            </button>
            <button onClick={onLogout} className="p-2 rounded-md text-slate-500 hover:text-slate-600 focus:outline-none">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
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
