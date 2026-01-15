
import React, { useState, useEffect } from 'react';
import { UserProfile, Payslip } from '../types';
import { db, collection, query, where, orderBy, getDocs } from '../firebase';

interface PayslipsProps {
  user: UserProfile;
}

const Payslips: React.FC<PayslipsProps> = ({ user }) => {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchPayslips = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'payslips'),
          where('userId', '==', user.uid),
          orderBy('month', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedPayslips = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payslip));
        setPayslips(fetchedPayslips);
      } catch (err) {
        console.error("Error fetching payslips:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPayslips();
  }, [user.uid]);

  const openPayslipDetail = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedPayslip(null), 300); // Wait for transition
  };

  const handleDownload = () => {
    if (!selectedPayslip) return;
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Payslips</h1>
        <p className="text-slate-500 text-sm">Download and review your monthly earnings records.</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-50 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : payslips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Payslips Yet</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Once the HR processes payroll, your monthly payslips will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {payslips.map((payslip) => (
            <button
              key={payslip.id}
              onClick={() => openPayslipDetail(payslip)}
              className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:ring-4 hover:ring-indigo-50 transition-all text-left"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{payslip.year}</span>
                <svg className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">{payslip.monthName}</h3>
              <p className="text-sm font-bold text-slate-500 mb-4">Net: ₹{payslip.netSalary.toLocaleString('en-IN')}</p>
              <div className="flex items-center text-xs font-semibold text-indigo-600">
                View Breakdown
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Side Drawer Panel */}
      <div className={`fixed inset-0 z-50 overflow-hidden ${isDrawerOpen ? 'visible' : 'invisible'}`}>
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          ></div>
          
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className={`relative w-screen max-w-md transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="h-full flex flex-col bg-white shadow-2xl">
                {selectedPayslip && (
                  <>
                    <div className="px-6 py-8 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-900">Payslip Breakdown</h2>
                        <p className="text-sm font-bold text-indigo-600">{selectedPayslip.monthName} {selectedPayslip.year}</p>
                      </div>
                      <button onClick={closeDrawer} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
                      {/* Summary Section */}
                      <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Net Payout</p>
                        <p className="text-4xl font-black">₹{selectedPayslip.netSalary.toLocaleString('en-IN')}</p>
                        <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center text-xs font-bold">
                          <span>Status: Processed</span>
                          <span>ID: {selectedPayslip.id?.slice(0, 8).toUpperCase()}</span>
                        </div>
                      </div>

                      {/* Detail Breakdown */}
                      <section className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Earnings</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2">
                            <span className="text-sm font-bold text-slate-600">Basic Salary</span>
                            <span className="text-sm font-black text-slate-900">₹{(selectedPayslip.netSalary - (selectedPayslip.reimbursements || 0) + selectedPayslip.totalDeductions).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </section>

                      {selectedPayslip.reimbursements > 0 && (
                        <section className="space-y-4">
                          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Additions</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                              <div>
                                <p className="text-sm font-bold text-slate-600">Reimbursements</p>
                                <p className="text-[10px] text-slate-400">Approved business expenses</p>
                              </div>
                              <span className="text-sm font-bold text-indigo-500">+₹{selectedPayslip.reimbursements.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </section>
                      )}

                      <section className="space-y-4">
                        <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest">Deductions</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <div>
                              <p className="text-sm font-bold text-slate-600">Income Tax</p>
                              <p className="text-[10px] text-slate-400">Professional Tax + TDS</p>
                            </div>
                            <span className="text-sm font-bold text-rose-500">-₹{selectedPayslip.deductions.tax.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <div>
                              <p className="text-sm font-bold text-slate-600">Leave Deductions</p>
                              <p className="text-[10px] text-slate-400">
                                {selectedPayslip.deductions.cl > 4 && `${selectedPayslip.deductions.cl - 4} Extra CL `}
                                {selectedPayslip.deductions.sl > 2 && `${selectedPayslip.deductions.sl - 2} Extra SL`}
                                {!(selectedPayslip.deductions.cl > 4) && !(selectedPayslip.deductions.sl > 2) && "No extra unpaid leaves"}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-rose-500">-₹{selectedPayslip.deductions.leaveDeductions.toLocaleString('en-IN')}</span>
                          </div>
                          {selectedPayslip.deductions.lateDays > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                              <div>
                                <p className="text-sm font-bold text-slate-600">Late Deductions</p>
                                <p className="text-[10px] text-slate-400">{selectedPayslip.deductions.lateDays} Unpaid Late Pass(es)</p>
                              </div>
                              <span className="text-sm font-bold text-rose-500">-₹{selectedPayslip.deductions.lateDeductions.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50">
                      <button 
                        onClick={handleDownload}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-sm hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-xl shadow-slate-200"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .fixed.inset-0.z-50, .fixed.inset-0.z-50 * { visibility: visible; }
          .fixed.inset-0.z-50 { position: absolute; left: 0; top: 0; width: 100%; height: auto; }
          button, .bg-slate-900\\/40 { display: none !important; }
        }
      `}} />
    </div>
  );
};

export default Payslips;
