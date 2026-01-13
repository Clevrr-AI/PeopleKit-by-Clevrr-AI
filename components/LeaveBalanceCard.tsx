
import React from 'react';

interface LeaveBalanceCardProps {
  title: string;
  used: number;
  maxPerMonth: number;
  balance: number;
  total: number;
  accentColor: string;
  ringColor: string;
}

const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({ 
  title, used, maxPerMonth, balance, total, accentColor, ringColor 
}) => {
  const monthPercentage = (used / maxPerMonth) * 100;
  const yearlyPercentage = (balance / total) * 100;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-800 font-bold">{title}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-bold uppercase tracking-wider ${accentColor}`}>
          Active
        </span>
      </div>

      <div className="space-y-6">
        {/* Monthly Usage */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs text-slate-500 font-medium">This Month</span>
            <span className="text-sm font-bold text-slate-900">{used} / {maxPerMonth}</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${accentColor} transition-all duration-500`} 
              style={{ width: `${Math.min(monthPercentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Maximum {maxPerMonth} allowed per month</p>
        </div>

        {/* Yearly Balance */}
        <div className="flex items-center space-x-4 pt-2 border-t border-slate-50">
           <div className="relative inline-flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                className="text-slate-100"
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
                r="26"
                cx="32"
                cy="32"
              />
              <circle
                className={ringColor}
                strokeWidth="6"
                strokeDasharray={163.36}
                strokeDashoffset={163.36 - (163.36 * yearlyPercentage) / 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="26"
                cx="32"
                cy="32"
              />
            </svg>
            <span className="absolute text-sm font-bold text-slate-900">{balance}</span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Remaining Balance</p>
            <p className="text-sm font-bold text-slate-900">{balance} / {total} Days</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveBalanceCard;
