
import React from 'react';

interface LateWarningWidgetProps {
  warningsLeft: number;
}

const LateWarningWidget: React.FC<LateWarningWidgetProps> = ({ warningsLeft }) => {
  const isExhausted = warningsLeft <= 0;
  
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 ${
      isExhausted 
        ? 'bg-rose-50 border-rose-200 shadow-rose-100 shadow-lg' 
        : warningsLeft === 1 
          ? 'bg-amber-50 border-amber-200' 
          : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className={`text-xs font-black uppercase tracking-widest ${isExhausted ? 'text-rose-600' : 'text-slate-400'}`}>
            Late Check-in Warnings
          </h3>
          <p className={`text-3xl font-black ${isExhausted ? 'text-rose-700' : 'text-slate-900'}`}>
            {isExhausted ? 'EXHAUSTED' : `${warningsLeft} Remaining`}
          </p>
        </div>
        <div className={`p-2 rounded-xl ${isExhausted ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      </div>

      <div className="mt-4">
        {isExhausted ? (
          <div className="flex items-center space-x-2 text-rose-700 font-bold text-xs animate-pulse">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>Future late check-ins will lead to unpaid leave.</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  i < warningsLeft ? 'bg-indigo-500' : 'bg-slate-100'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      
      {!isExhausted && (
        <p className="mt-3 text-[10px] text-slate-400 font-medium">
          You get 3 free passes per month for arriving after 10:15 AM.
        </p>
      )}
    </div>
  );
};

export default LateWarningWidget;
