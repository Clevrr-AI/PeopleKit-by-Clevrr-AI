import React, { useState } from 'react';
import { useHR } from '../App';
import { processPayroll, getMonthName } from '../services/payrollService';
import { PayrollEntry } from '../types';
import { Download, RefreshCw, CheckCircle, Lock } from 'lucide-react';

const Payroll: React.FC = () => {
  const { employees, attendance, leaves, payrollData, setPayrollData } = useHR();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const handleRunPayroll = () => {
    const data = processPayroll(employees, attendance, leaves, selectedMonth, selectedYear);
    setPayrollData(data);
  };

  const markAsProcessed = () => {
    setPayrollData(prev => prev.map(p => ({ ...p, isProcessed: true })));
    alert('Payroll processed! Payslips generated and available to employees in 2 days.');
  };

  const isDecember = selectedMonth === 11;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payroll Processing</h1>
          <p className="text-slate-500">Calculate net salary, retention bonuses, and tax.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
            <select 
                className="bg-transparent font-medium text-slate-700 outline-none"
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
            >
                {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{getMonthName(i)}</option>
                ))}
            </select>
            <select 
                className="bg-transparent font-medium text-slate-700 outline-none border-l pl-4 border-slate-200"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
            >
                <option value={2022}>2022</option>
                <option value={2023}>2023</option>
                <option value={2024}>2024</option>
            </select>
            <button 
                onClick={handleRunPayroll}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition"
            >
                <RefreshCw className="w-4 h-4" /> Calculate
            </button>
        </div>
      </div>

      {payrollData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="font-semibold text-slate-700">Preview: {getMonthName(selectedMonth)} {selectedYear}</h3>
                 <div className="flex gap-2">
                     <button className="flex items-center gap-2 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded text-sm transition">
                         <Download className="w-4 h-4" /> Export CSV
                     </button>
                     <button 
                        onClick={markAsProcessed}
                        className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded text-sm shadow-sm transition"
                     >
                         <Lock className="w-4 h-4" /> Process & Lock
                     </button>
                 </div>
             </div>

             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                     <thead className="bg-slate-50 text-slate-500 uppercase font-medium">
                         <tr>
                             <th className="p-4 sticky left-0 bg-slate-50">Employee</th>
                             <th className="p-4">Gross</th>
                             <th className="p-4 text-red-600">Tax</th>
                             <th className="p-4 text-red-600">Leave Ded.</th>
                             {isDecember && <th className="p-4 text-indigo-600">Ret. Bonus</th>}
                             <th className="p-4">Unpaid Days</th>
                             <th className="p-4 font-bold text-slate-900">Net Salary</th>
                             <th className="p-4">Status</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {payrollData.map((record) => (
                             <tr key={record.employeeId} className="hover:bg-slate-50">
                                 <td className="p-4 font-medium text-slate-900 sticky left-0 bg-white">
                                     {record.employeeName}
                                 </td>
                                 <td className="p-4 text-slate-600">${record.grossSalary.toLocaleString()}</td>
                                 <td className="p-4 text-red-500">-${record.deductions.tax.toLocaleString()}</td>
                                 <td className="p-4 text-red-500">-${record.deductions.leaveDeduction.toLocaleString()}</td>
                                 
                                 {isDecember && (
                                     <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-indigo-600 font-medium">+${Math.floor(record.retentionBonus.amount).toLocaleString()}</span>
                                            <span className="text-[10px] text-slate-400">{record.retentionBonus.qualifiedMonths} Qualified Mos</span>
                                        </div>
                                     </td>
                                 )}

                                 <td className="p-4 text-slate-500">
                                     {record.unpaidLeaves} Days
                                 </td>

                                 <td className="p-4 font-bold text-slate-900 text-lg">
                                     ${record.netSalary.toLocaleString()}
                                 </td>
                                 <td className="p-4">
                                     {record.isProcessed ? (
                                         <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs">
                                             <CheckCircle className="w-3 h-3" /> Processed
                                         </span>
                                     ) : (
                                         <span className="text-slate-400 italic text-xs">Draft</span>
                                     )}
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
          </div>
      )}

      {payrollData.length === 0 && (
          <div className="text-center py-20 bg-slate-100 rounded-xl border border-dashed border-slate-300">
              <Banknote className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Select a month and click "Calculate" to preview payroll.</p>
          </div>
      )}
    </div>
  );
};

// Simple Icon component for the empty state
import { Banknote } from 'lucide-react';

export default Payroll;