
import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, SalaryConfig, LeaveRequest, Payslip, Reimbursement } from '../types';
import { db, collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, arrayUnion, orderBy } from '../firebase';

const SalaryProcessing: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [calculations, setCalculations] = useState<any[]>([]);
  const [history, setHistory] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState({ totalNet: 0, totalDeductions: 0, totalReimbursements: 0 });
  
  // Editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<any>(null);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'payslips'),
        where('month', '==', selectedMonth),
        where('year', '==', selectedYear),
        orderBy('employeeName', 'asc')
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as Payslip));
      setHistory(records);
    } catch (err) {
      console.error("Error fetching payroll history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const updateSummary = (calcs: any[]) => {
    const totalNet = calcs.reduce((acc, curr) => acc + curr.netSalary, 0);
    const totalDed = calcs.reduce((acc, curr) => acc + curr.totalDeductions, 0);
    const totalReim = calcs.reduce((acc, curr) => acc + curr.reimbursements, 0);
    setSummary({ totalNet, totalDeductions: totalDed, totalReimbursements: totalReim });
  };

  const calculateSalaries = async () => {
    setLoading(true);
    setEditingIndex(null);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));

      const calcs = [];
      const startOfMonth = new Date(selectedYear, selectedMonth, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);

      for (const user of allUsers) {
        // Skip users who already have a payslip for this month
        if (history.some(p => p.userId === user.uid)) continue;

        const configSnap = await getDoc(doc(db, 'salaryConfig', user.uid));
        if (!configSnap.exists()) continue;

        const config = configSnap.data() as SalaryConfig;
        const baseSalary = config.baseSalary;
        const tax = config.taxDeduction;
        const payPerDay = baseSalary / 30;

        // Query for leaves (Approved + Pending)
        const leaveQ = query(
          collection(db, 'leaveRequests'),
          where('userId', '==', user.uid)
        );

        const leaveSnap = await getDocs(leaveQ);
        const allLeaves = leaveSnap.docs.map(d => d.data() as LeaveRequest)
          .filter(l => {
            const lDate = l.startDate.toDate();
            return lDate >= startOfMonth && lDate <= endOfMonth && (l.status === 'Approved' || l.status === 'Pending');
          });

        const approvedCL = allLeaves.filter(l => l.leaveType === 'CL' && l.status === 'Approved').reduce((acc, curr) => acc + curr.totalDays, 0);
        const approvedSL = allLeaves.filter(l => l.leaveType === 'SL' && l.status === 'Approved').reduce((acc, curr) => acc + curr.totalDays, 0);
        const approvedHDLCount = allLeaves.filter(l => l.leaveType === 'HDL' && l.status === 'Approved').length;

        const pendingCL = allLeaves.filter(l => l.leaveType === 'CL' && l.status === 'Pending').reduce((acc, curr) => acc + curr.totalDays, 0);
        const pendingSL = allLeaves.filter(l => l.leaveType === 'SL' && l.status === 'Pending').reduce((acc, curr) => acc + curr.totalDays, 0);
        const pendingHDLCount = allLeaves.filter(l => l.leaveType === 'HDL' && l.status === 'Pending').length;

        // Deductions logic
        const extraCL = Math.max(0, approvedCL - 4);
        const extraSL = Math.max(0, approvedSL - 2);
        const unpaidLeaveDays = extraCL + extraSL;
        const leaveDeductionAmount = unpaidLeaveDays * payPerDay;

        // Attendance (Late tracking)
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
        
        const lateDays = lateAttendances.reduce((acc, curr) => acc + (curr.lateType || 0), 0);
        const lateDeductionAmount = lateDays * payPerDay;

        // Approved Reimbursements
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

        // Retention Bonus Calculation
        const totalLeavesForBonus = approvedCL + approvedSL + pendingCL + pendingSL + lateDays + (approvedHDLCount * 0.5) + (pendingHDLCount * 0.5);
        const eligibleForBonus = totalLeavesForBonus < 2;
        const bonusAmount = eligibleForBonus ? payPerDay * 2 : 0;

        const totalDeductions = tax + leaveDeductionAmount + lateDeductionAmount;
        const netSalary = baseSalary - totalDeductions + totalReimbursementsForUser;

        calcs.push({
          user,
          configId: configSnap.id,
          baseSalary,
          tax,
          leaveDeductions: leaveDeductionAmount,
          lateDeductions: lateDeductionAmount,
          reimbursements: totalReimbursementsForUser,
          slCount: approvedSL,
          clCount: approvedCL,
          lateDays,
          unpaidLeaveDays,
          netSalary,
          totalDeductions,
          totalLeavesForBonus,
          bonusAmount,
          eligibleForBonus
        });
      }

      if (calcs.length === 0) {
        alert("No additional employees to process for this month.");
      }
      setCalculations(calcs);
      updateSummary(calcs);
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
        const userId = calc.user.uid;

        // 1. Add Payslip
        const payslip: Payslip = {
          userId: userId,
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

        // 2. Reset Leave Balances
        await updateDoc(doc(db, 'leaveBalances', userId), {
          currentMonthClUsed: 0,
          currentMonthSlUsed: 0,
          lastMonthlyReset: serverTimestamp(),
          lateWarningLeft: 3
        });

        // 3. Update Retention Bonus
        const bonusRef = doc(db, 'retentionBonus', userId);
        const bonusSnap = await getDoc(bonusRef);
        
        const bonusEntry = {
          month: months[selectedMonth],
          leaves: calc.totalLeavesForBonus,
          bonus: calc.bonusAmount
        };

        if (bonusSnap.exists()) {
          await updateDoc(bonusRef, {
            totalBonus: increment(calc.bonusAmount),
            bonusMonths: arrayUnion(bonusEntry)
          });
        } else {
          await addDoc(collection(db, 'retentionBonus'), {
            userId: userId,
            employeeName: calc.user.name,
            totalBonus: calc.bonusAmount,
            bonusMonths: [bonusEntry],
            year: selectedYear
          });
        }
      }
      alert(`Processed ${calculations.length} payroll records successfully!`);
      setCalculations([]);
      fetchHistory();
    } catch (err) {
      console.error("Processing error:", err);
      alert("Failed to process some records.");
    } finally {
      setProcessing(false);
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditValues({ ...calculations[index] });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditValues(null);
  };

  const saveEdit = () => {
    if (editingIndex === null || !editValues) return;
    
    const newCalcs = [...calculations];
    const updatedBase = parseFloat(editValues.baseSalary) || 0;
    const updatedTax = parseFloat(editValues.tax) || 0;
    const updatedLeaveDed = parseFloat(editValues.leaveDeductions) || 0;
    const updatedLateDed = parseFloat(editValues.lateDeductions) || 0;
    const updatedReimb = parseFloat(editValues.reimbursements) || 0;
    
    const totalDeductions = updatedTax + updatedLeaveDed + updatedLateDed;
    const netSalary = updatedBase - totalDeductions + updatedReimb;

    newCalcs[editingIndex] = {
      ...editValues,
      baseSalary: updatedBase,
      tax: updatedTax,
      leaveDeductions: updatedLeaveDed,
      lateDeductions: updatedLateDed,
      reimbursements: updatedReimb,
      totalDeductions,
      netSalary
    };

    setCalculations(newCalcs);
    updateSummary(newCalcs);
    setEditingIndex(null);
    setEditValues(null);
  };

  const handleEditChange = (field: string, value: string) => {
    const numericValue = value === '' ? '' : parseFloat(value);
    const updatedValues = { ...editValues, [field]: numericValue };
    
    const base = parseFloat(field === 'baseSalary' ? value : updatedValues.baseSalary) || 0;
    const tax = parseFloat(field === 'tax' ? value : updatedValues.tax) || 0;
    const lDed = parseFloat(field === 'leaveDeductions' ? value : updatedValues.leaveDeductions) || 0;
    const ltDed = parseFloat(field === 'lateDeductions' ? value : updatedValues.lateDeductions) || 0;
    const reim = parseFloat(field === 'reimbursements' ? value : updatedValues.reimbursements) || 0;
    
    const totalDeductions = tax + lDed + ltDed;
    const netSalary = base - totalDeductions + reim;
    
    setEditValues({ ...updatedValues, totalDeductions, netSalary });
  };

  const totalHistoryPayout = history.reduce((acc, curr) => acc + curr.netSalary, 0);

  return (
    <div className="space-y-12 max-w-7xl mx-auto pb-12">
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

      {/* 1. New Calculations Section */}
      {calculations.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">New Payroll Preview</h2>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500">Total New Payout:</span>
              <span className="text-lg font-black text-slate-900">₹{summary.totalNet.toLocaleString('en-IN')}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg flex items-center justify-between col-span-1 md:col-span-4">
              <div>
                <p className="text-xs font-bold text-indigo-100 uppercase mb-1">Status</p>
                <p className="text-xl font-bold text-white">Pending Finalization ({calculations.length} Records)</p>
              </div>
              <button 
                onClick={handleProcess}
                disabled={processing || editingIndex !== null}
                className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-black text-sm hover:bg-indigo-50 shadow-sm transition-all disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Finalize & Update Records'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Base Salary</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Leaves / Bonus</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Tax / Ded.</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Reimb.</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Net Salary</th>
                  <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {calculations.map((c, i) => {
                  const isEditing = editingIndex === i;
                  const rowData = isEditing ? editValues : c;
                  return (
                    <tr key={i} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img className="h-8 w-8 rounded-full mr-3" src={`https://picsum.photos/seed/${c.user.uid}/100`} alt="" />
                          <div>
                            <div className="text-sm font-bold text-slate-900">{c.user.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{c.user.title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {isEditing ? (
                          <input 
                            type="number" 
                            className="w-24 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                            value={rowData.baseSalary}
                            onChange={(e) => handleEditChange('baseSalary', e.target.value)}
                          />
                        ) : (
                          `₹${c.baseSalary.toLocaleString('en-IN')}`
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center text-[10px] font-bold">
                            <span className="text-slate-400 uppercase mr-1">Days:</span>
                            <span className={c.totalLeavesForBonus >= 2 ? 'text-rose-500' : 'text-emerald-500'}>{c.totalLeavesForBonus.toFixed(1)}</span>
                          </div>
                          {c.eligibleForBonus ? (
                            <div className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-1.5 py-0.5 rounded inline-block">
                              +₹{c.bonusAmount.toLocaleString('en-IN')} Bonus
                            </div>
                          ) : (
                            <div className="text-[10px] font-bold text-slate-400 uppercase italic">No Bonus</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <div className="space-y-2">
                             <div className="flex items-center text-xs text-rose-500">
                              <span className="w-12 text-[10px] text-slate-400">Tax:</span>
                              <input type="number" className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold" value={rowData.tax} onChange={(e) => handleEditChange('tax', e.target.value)} />
                            </div>
                            <div className="flex items-center text-xs text-rose-500">
                              <span className="w-12 text-[10px] text-slate-400">Leave:</span>
                              <input type="number" className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold" value={rowData.leaveDeductions} onChange={(e) => handleEditChange('leaveDeductions', e.target.value)} />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-[11px] text-rose-500 font-bold">-₹{c.tax.toLocaleString('en-IN')} Tax</div>
                            {c.leaveDeductions > 0 && <div className="text-[11px] text-rose-500">-₹{c.leaveDeductions.toLocaleString('en-IN')} Leave</div>}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold">
                        {isEditing ? (
                          <input type="number" className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold" value={rowData.reimbursements} onChange={(e) => handleEditChange('reimbursements', e.target.value)} />
                        ) : (
                          `+₹${c.reimbursements.toLocaleString('en-IN')}`
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-black ${isEditing ? 'text-indigo-600' : 'text-slate-900'}`}>
                          ₹{rowData.netSalary.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <button onClick={saveEdit} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg mr-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg></button>
                        ) : (
                          <button onClick={() => startEditing(i)} className="p-1.5 text-slate-400 hover:text-indigo-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 2. Payroll History Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Payroll History</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{months[selectedMonth]} {selectedYear}</p>
          </div>
          {history.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Processed Total</p>
              <p className="text-xl font-black text-indigo-700">₹{totalHistoryPayout.toLocaleString('en-IN')}</p>
            </div>
          )}
        </div>

        {loadingHistory ? (
          <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 animate-pulse">
            <span className="text-slate-400 font-bold text-sm">Synchronizing history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Records Found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Click calculate to see a preview of {months[selectedMonth]} {selectedYear} payroll before processing.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Reimb.</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Net Payout</th>
                  <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-8 w-8 rounded-full mr-3" src={`https://picsum.photos/seed/${p.userId}/100`} alt="" />
                        <div className="text-sm font-bold text-slate-900">{p.employeeName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[9px] font-black rounded border border-rose-100">TAX ₹{p.deductions.tax}</span>
                        {p.deductions.leaveDeductions > 0 && <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[9px] font-black rounded border border-rose-100">LEAVE ₹{p.deductions.leaveDeductions}</span>}
                        {p.deductions.lateDeductions > 0 && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-black rounded border border-amber-100">LATE ₹{p.deductions.lateDeductions}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`text-sm font-bold ${p.reimbursements > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                         ₹{p.reimbursements.toLocaleString('en-IN')}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-black text-slate-900">₹{p.netSalary.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 bg-emerald-500 text-white text-[9px] font-black rounded uppercase tracking-widest">Processed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SalaryProcessing;
