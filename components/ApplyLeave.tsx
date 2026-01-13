
import React, { useState, useEffect } from 'react';
import { UserProfile, LeaveRequest, LeaveBalances } from '../types';
import { db, collection, addDoc, serverTimestamp, Timestamp, doc, getDoc, runTransaction, increment } from '../firebase';

interface ApplyLeaveProps {
  user: UserProfile;
  onSuccess: () => void;
}

const ApplyLeave: React.FC<ApplyLeaveProps> = ({ user, onSuccess }) => {
  const [leaveType, setLeaveType] = useState<'CL' | 'SL' | 'HDL'>('CL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<'Morning' | 'Afternoon' | null>(null);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<File | null>(null);
  const [balances, setBalances] = useState<LeaveBalances | null>(null);

  useEffect(() => {
    const fetchBalances = async () => {
      const balanceSnap = await getDoc(doc(db, 'leaveBalances', user.uid));
      if (balanceSnap.exists()) {
        setBalances(balanceSnap.data() as LeaveBalances);
      }
    };
    fetchBalances();
  }, [user.uid]);

  const getMinDate = () => {
    const today = new Date();
    if (leaveType === 'CL') {
      today.setDate(today.getDate() + 2);
    } else if (leaveType === 'SL') {
      // Retrospective up to 7 days
      today.setDate(today.getDate() - 7);
    }
    return today.toISOString().split('T')[0];
  };

  const calculateTotalDays = () => {
    if (isHalfDay) return 0.5;
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const totalDays = calculateTotalDays();

  // SL Logic Helpers
  const needsPrescription = leaveType === 'SL' && totalDays > 3;
  const isOverQuota = leaveType === 'SL' && balances && (balances.currentMonthSlUsed + totalDays > 2);
  const canAutoApproveSL = leaveType === 'SL' && totalDays <= 2 && !isOverQuota;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (leaveType === 'CL' && totalDays > 4) {
      setError("Maximum 4 casual leaves can be requested in a single application.");
      setIsLoading(false);
      return;
    }

    if (needsPrescription && !prescription) {
      setError("Doctor's prescription is required for sick leave exceeding 3 days.");
      setIsLoading(false);
      return;
    }

    if (totalDays <= 0) {
      setError("Please select valid dates.");
      setIsLoading(false);
      return;
    }

    if (!user.managerId) {
       setError("No manager assigned to your profile. Please contact HR.");
       setIsLoading(false);
       return;
    }

    try {
      const isAutoApproved = canAutoApproveSL;
      
      const leaveRequestData: any = {
        userId: user.uid,
        employeeName: user.name || user.email || 'Unknown Employee',
        managerId: user.managerId,
        leaveType,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(isHalfDay ? startDate : endDate)),
        totalDays,
        isHalfDay,
        halfDayType: isHalfDay ? (halfDayType || 'Morning') : null,
        reason: reason || '',
        status: isAutoApproved ? 'Approved' : 'Pending',
        isEscalated: false,
        escalationReason: null,
        requestedAt: serverTimestamp(),
        approvedBy: isAutoApproved ? 'System' : null,
        approvedAt: isAutoApproved ? serverTimestamp() : null,
        rejectionReason: null,
        comments: isAutoApproved ? 'Auto-approved by platform' : null,
        cancelledAt: null,
        cancelledBy: null,
        prescriptionUrl: prescription ? 'pending_upload_mock' : null
      };

      if (isAutoApproved) {
        // Atomic Transaction for Auto-approval
        await runTransaction(db, async (transaction) => {
          const balanceRef = doc(db, 'leaveBalances', user.uid);
          const requestRef = doc(collection(db, 'leaveRequests'));
          
          transaction.set(requestRef, leaveRequestData);
          transaction.update(balanceRef, {
            slBalance: increment(-totalDays),
            currentMonthSlUsed: increment(totalDays)
          });
        });
      } else {
        // Normal submission
        await addDoc(collection(db, 'leaveRequests'), leaveRequestData);
      }

      onSuccess();
    } catch (err: any) {
      console.error("Error submitting leave request:", err);
      setError("Failed to submit request: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const minDate = getMinDate();

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Apply for Leave</h1>
        <p className="text-slate-500 text-sm">Submit your time-off request. Some sick leaves may be auto-approved.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Branch Logic Status Indicator */}
        {leaveType === 'SL' && !isLoading && (
          <div className="px-8 py-4 border-b border-slate-100">
            {canAutoApproveSL ? (
              <div className="flex items-center text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium">Eligible for Instant Auto-Approval!</span>
              </div>
            ) : isOverQuota ? (
              <div className="flex items-center text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100">
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-medium">Monthly quota exceeded. Requires manager review.</span>
              </div>
            ) : needsPrescription ? (
              <div className="flex items-center text-indigo-700 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium">Request &gt; 3 days. Prescription required.</span>
              </div>
            ) : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center">
              <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Leave Type</label>
              <select 
                value={leaveType}
                onChange={(e) => {
                  setLeaveType(e.target.value as any);
                  setStartDate('');
                  setEndDate('');
                }}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="CL">Casual Leave (CL)</option>
                <option value="SL">Sick Leave (SL)</option>
                <option value="HDL">Half Day (HDL)</option>
              </select>
            </div>

            <div className="space-y-2">
               <label className="block text-sm font-semibold text-slate-700">Calculated Days</label>
               <div className={`px-4 py-2 font-bold rounded-lg border transition-colors ${totalDays > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                 {totalDays} Day(s)
               </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                {leaveType === 'SL' ? 'Start Date (Backdated OK)' : 'Start Date'}
              </label>
              <input 
                type="date"
                required
                min={minDate}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (isHalfDay || !endDate) setEndDate(e.target.value);
                }}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1 italic">
                {leaveType === 'CL' ? 'Min 2 days notice required' : 'Retrospective up to 7 days allowed'}
              </p>
            </div>

            {!isHalfDay && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">End Date</label>
                <input 
                  type="date"
                  required
                  min={startDate || minDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            )}
          </div>

          {/* Prescription Upload */}
          {needsPrescription && (
            <div className="space-y-2 p-4 bg-indigo-50 rounded-xl border-2 border-dashed border-indigo-200">
              <label className="block text-sm font-bold text-indigo-900">Medical Prescription (Required)</label>
              <p className="text-xs text-indigo-600 mb-3">Upload a copy of your doctor's note for leaves exceeding 3 days.</p>
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={(e) => setPrescription(e.target.files ? e.target.files[0] : null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
            </div>
          )}

          <div className="flex items-center space-x-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <input 
              type="checkbox" 
              id="halfday"
              checked={isHalfDay}
              onChange={(e) => {
                setIsHalfDay(e.target.checked);
                if (e.target.checked) setEndDate(startDate);
              }}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
            />
            <label htmlFor="halfday" className="text-sm font-medium text-slate-700 select-none">This is a half-day leave</label>
          </div>

          {isHalfDay && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Session</label>
              <div className="flex space-x-4">
                {['Morning', 'Afternoon'].map((type) => (
                  <button 
                    key={type}
                    type="button"
                    onClick={() => setHalfDayType(type as any)}
                    className={`flex-1 py-2 px-4 rounded-lg border ${halfDayType === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'} transition-all text-sm font-medium`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Reason for Leave</label>
            <textarea 
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly explain your absence..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
            ></textarea>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-4">
             <button type="button" onClick={onSuccess} className="px-6 py-2 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors">
               Cancel
             </button>
             <button 
              type="submit"
              disabled={isLoading}
              className={`px-8 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
             >
               {isLoading ? (
                 <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
               ) : null}
               {canAutoApproveSL ? 'Submit & Auto-Approve' : 'Submit for Review'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyLeave;
