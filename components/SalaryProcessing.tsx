
import React, { useState, useEffect } from 'react';
import { UserProfile, SalaryConfig, LeaveRequest, Payslip, Reimbursement } from '../types';
import { db, collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc } from '../firebase';

const SalaryProcessing: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [calculations, setCalculations] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalNet: 0, totalDeductions: 0, totalReimbursements: 0 });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const calculateSalaries = async () => {
    setLoading(true);
    try {
      // 1. Fetch all users
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));

      const calcs = [];
      let totalNet = 0;
      let totalDed = 0;
      let totalReim = 0;

      const startOfMonth = new Date(selectedYear, selectedMonth, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);

      for (const user of allUsers) {
        // 2. Fetch Salary Config
        const configSnap = await getDoc(doc(db, 'salaryConfig', user.uid));
        if (!configSnap.exists()) continue;

        const config = configSnap.data() as SalaryConfig;
        const baseSalary = config.baseSalary;
        const tax = config.taxDeduction;
        const payPerDay = baseSalary / 30;

        // 3. Fetch Approved Leaves for the selected period
        const leaveQ = query(
          collection(db, 'leaveRequests'),
          where('userId', '==', user.uid),
          where('status', '==', 'Approved')
        );

        const leaveSnap = await getDocs(leaveQ);
        const leaves = leaveSnap.docs.map(d => d.data() as LeaveRequest)
          .filter(l => {
            const lDate = l.startDate.toDate();
            return lDate >= startOfMonth && lDate <= endOfMonth;
          });

        const actualCL = leaves.filter(l => l.leaveType === 'CL').reduce((acc, curr) => acc + curr.totalDays, 0);
        const actualSL = leaves.filter(l => l.leaveType === 'SL').reduce((acc, curr) => acc + curr.totalDays, 0);

        const extraCL = Math.max(0, actualCL - 4);
        const extraSL = Math.max(0, actualSL - 2);
        const unpaidLeaveDays = extraCL + extraSL;
        const leaveDeductionAmount = unpaidLeaveDays * payPerDay;

        // 4. Fetch Late Check-ins for the selected month
        const attendanceQ = query(
          collection(db, 'attendance'),
          where('userId', '==', user.uid),
          where('isLate', '==', true)
        );
        const attendanceSnap = await getDocs(attendanceQ);
        const lateAttendances = attendanceSnap.docs.map(d => d.data())
          .filter(a => {
            const aDate = a.checkinAt.toDate();
            return aDate >= startOfMonth && aDate <= endOfMonth;
          });
        
        // Sum the lateType (0.5 or 1)
        const lateDays = lateAttendances.reduce((acc, curr) => acc + (curr.lateType || 0), 0);
        const lateDeductionAmount = lateDays * payPerDay;

        // 5. Fetch Approved Reimbursements for the selected month
        const reimQ = query(
          collection(db, 'reimbursements'),
          where('userId', '==', user.uid),
          where('status', '==', 'Approved')
        );
        const reimSnap = await getDocs(reimQ);
        const reimbursements = reimSnap.docs.map(d => d.data() as Reimbursement)
          .filter(r => {
            const rDate = new Date(r.dateOfPayment);
            return rDate.getMonth() === selectedMonth && rDate.getFullYear() === selectedYear;
          });
        
        const totalReimbursementsForUser = reimbursements.reduce((acc, curr) => acc + curr.amount, 0);

        const totalDeductions = tax + leaveDeductionAmount + lateDeductionAmount;
        // Final Salary = Base - Tax - Leaves - Late + Reimbursements
        const netSalary = baseSalary - totalDeductions + totalReimbursementsForUser;

        calcs.push({
          user,
          configId: configSnap.id,
          baseSalary,
          tax,
          leaveDeductions: leaveDeductionAmount,
          lateDeductions: lateDeductionAmount,
          reimbursements: totalReimbursementsForUser,
          slCount: actualSL,
          clCount: actualCL,
          lateDays,
          unpaidLeaveDays,
          netSalary,
          totalDeductions
        });

        totalNet += netSalary;
        totalDed += totalDeductions;
        totalReim += totalReimbursementsForUser;
      }

      setCalculations(calcs);
      setSummary({ totalNet, totalDeductions: totalDed, totalReimbursements: totalReim });
    } catch (err) {
      console.error("Calculation error:", err);
      alert("Error calculating salaries. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (calculations.length === 0) return;
    setProcessing(true);
    try {
      for (const calc of calculations) {
        const payslip: Payslip = {
          userId: calc.user.uid,
          employeeName: calc.user.name,
          month: selectedMonth,
          monthName: months[selectedMonth],
          year: selectedYear,
          salaryConfigId: calc.configId,
          totalDeductions: calc.totalDeductions,
          deductions: {
            tax: calc.tax,
            leaveDeductions: calc.leaveDeductions,
            lateDeductions: calc.lateDeductions,
            sl: calc.slCount,
            cl: calc.clCount,
            lateDays: calc.lateDays
          },
          reimbursements: calc.reimbursements,
          netSalary: calc.netSalary,
          processedDate: serverTimestamp(),
        };

        await addDoc(collection(db, 'payslips'), payslip);
      }
      alert(`Processed ${calculations.length} payslips successfully!`);
      setCalculations([]);
    } catch (err) {
      console.error("Processing error:", err);
      alert("Failed to process some payslips.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salary Management</h1>
          <p className="text-slate-500 text-sm">Calculate and process monthly employee payroll.</p>
        </div>
        <div className="flex items-center space-x-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="text-sm font-semibold text-slate-700 outline-none bg-transparent px-2"
          >
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="text-sm font-semibold text-slate-700 outline-none bg-transparent px-2 border-l border-slate-100"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button 
            onClick={calculateSalaries}
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Crunching...' : 'Calculate'}
          </button>
        </div>
      </header>

      {calculations.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Payout</p>
              <p className="text-3xl font-black text-slate-900">₹{summary.totalNet.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Reimbursements</p>
              <p className="text-3xl font-black text-indigo-600">₹{summary.totalReimbursements.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Deductions</p>
              <p className="text-3xl font-black text-rose-600">₹{summary.totalDeductions.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-100 uppercase mb-1">Status</p>
                <p className="text-xl font-bold text-white">Ready</p>
              </div>
              <button 
                onClick={handleProcess}
                disabled={processing}
                className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 shadow-sm transition-all disabled:opacity-50"
              >
                {processing ? '...' : 'Process'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Base Salary</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Tax</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Reimb.</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Net Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {calculations.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-8 w-8 rounded-full mr-3" src={`https://picsum.photos/seed/${c.user.uid}/100`} alt="" />
                        <div>
                          <div className="text-sm font-bold text-slate-900">{c.user.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{c.user.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">₹{c.baseSalary.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-rose-500">-₹{c.tax.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {c.leaveDeductions > 0 && (
                          <div className="text-sm text-rose-500">-₹{c.leaveDeductions.toLocaleString('en-IN')} <span className="text-[10px] text-slate-400 font-bold ml-1">({c.unpaidLeaveDays} Unpaid Leaves)</span></div>
                        )}
                        {c.lateDeductions > 0 && (
                          <div className="text-sm text-amber-600">-₹{c.lateDeductions.toLocaleString('en-IN')} <span className="text-[10px] text-slate-400 font-bold ml-1">({c.lateDays} Late Days)</span></div>
                        )}
                        {c.leaveDeductions === 0 && c.lateDeductions === 0 && (
                          <span className="text-xs text-slate-400 italic">No deductions</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold">+₹{c.reimbursements.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-black text-slate-900">₹{c.netSalary.toLocaleString('en-IN')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {calculations.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Run Payroll</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Select the period and click calculate to preview the payout for {months[selectedMonth]} {selectedYear}. Late check-ins and extra leaves are calculated as deductions.</p>
        </div>
      )}
    </div>
  );
};

export default SalaryProcessing;
