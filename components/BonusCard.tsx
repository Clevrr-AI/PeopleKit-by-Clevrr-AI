
import React from 'react';

interface BonusCardProps {
  total: number;
}

const BonusCard: React.FC<BonusCardProps> = ({ total }) => {
  return (
    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-2xl shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <svg className="h-24 w-24 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10v2a2 2 0 002 2h2a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 012-2h2zm2 4v2h2v-2H8zm2-4a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2a2 2 0 012-2h2z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="relative z-10">
        <h3 className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-2">Total Accumulated Bonus</h3>
        <div className="flex items-baseline text-white">
          <span className="text-xl font-medium">₹</span>
          <span className="text-4xl font-extrabold ml-1 tracking-tight">
            {total.toLocaleString('en-IN')}
          </span>
        </div>
        <p className="mt-4 text-indigo-200 text-xs font-medium bg-white/10 inline-block px-3 py-1 rounded-full backdrop-blur-sm">
          Payable: December 2024
        </p>
      </div>
    </div>
  );
};

export default BonusCard;
