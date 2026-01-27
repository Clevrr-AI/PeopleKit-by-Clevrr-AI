
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
  
  // Editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<any>(null);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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
        const configSnap = await getDoc(doc(db, 'salaryConfig', user.uid));
        if (!configSnap.exists()) continue;

        const config = configSnap.data() as SalaryConfig;
        const baseSalary = config.baseSalary;
        const tax = config.taxDeduction;
        const payPerDay = baseSalary / 30;

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
      setEditingIndex(null);
    } catch (err) {
      console.error("Processing error:", err);
      alert("Failed to process some payslips.");
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
    // Recalculate net salary based on potentially changed fields
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
    
    // Auto-update net salary preview in edit state
    const base = parseFloat(field === 'baseSalary' ? value : updatedValues.baseSalary) || 0;
    const tax = parseFloat(field === 'tax' ? value : updatedValues.tax) || 0;
    const lDed = parseFloat(field === 'leaveDeductions' ? value : updatedValues.leaveDeductions) || 0;
    const ltDed = parseFloat(field === 'lateDeductions' ? value : updatedValues.lateDeductions) || 0;
    const reim = parseFloat(field === 'reimbursements' ? value : updatedValues.reimbursements) || 0;
    
    const totalDeductions = tax + lDed + ltDed;
    const netSalary = base - totalDeductions + reim;
    
    setEditValues({ ...updatedValues, totalDeductions, netSalary });
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
                disabled={processing || editingIndex !== null}
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
                  <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">Actions</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-rose-500">
                        {isEditing ? (
                          <div className="flex items-center">
                            <span className="mr-1">-</span>
                            <input 
                              type="number" 
                              className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500 text-rose-500"
                              value={rowData.tax}
                              onChange={(e) => handleEditChange('tax', e.target.value)}
                            />
                          </div>
                        ) : (
                          `-₹${c.tax.toLocaleString('en-IN')}`
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex items-center text-xs text-rose-500">
                              <span className="w-12 text-[10px] text-slate-400">Leave:</span>
                              <input 
                                type="number" 
                                className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                                value={rowData.leaveDeductions}
                                onChange={(e) => handleEditChange('leaveDeductions', e.target.value)}
                              />
                            </div>
                            <div className="flex items-center text-xs text-amber-600">
                              <span className="w-12 text-[10px] text-slate-400">Late:</span>
                              <input 
                                type="number" 
                                className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                                value={rowData.lateDeductions}
                                onChange={(e) => handleEditChange('lateDeductions', e.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
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
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold">
                        {isEditing ? (
                          <div className="flex items-center">
                            <span className="mr-1">+</span>
                            <input 
                              type="number" 
                              className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500 text-emerald-600"
                              value={rowData.reimbursements}
                              onChange={(e) => handleEditChange('reimbursements', e.target.value)}
                            />
                          </div>
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
                          <div className="flex items-center justify-center space-x-2">
                            <button 
                              onClick={saveEdit}
                              className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                              title="Save Changes"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            </button>
                            <button 
                              onClick={cancelEditing}
                              className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-colors"
                              title="Cancel"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => startEditing(i)}
                            disabled={editingIndex !== null}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30"
                            title="Edit this record"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
