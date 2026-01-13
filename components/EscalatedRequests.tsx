
import React, { useState, useEffect } from 'react';
import { LeaveRequest, UserProfile } from '../types';
import { db, collection, query, where, onSnapshot, doc, runTransaction, serverTimestamp, increment } from '../firebase';

interface EscalatedRequestsProps {
  founder: UserProfile;
}

const EscalatedRequests: React.FC<EscalatedRequestsProps> = ({ founder }) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionData, setRejectionData] = useState<{ id: string; reason: string } | null>(null);

  useEffect(() => {
    // Founders see ALL escalated requests in the company
    const q = query(
      collection(db, 'leaveRequests'),
      where('status', '==', 'Escalated')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const escalated: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        escalated.push({ id: doc.id, ...doc.data() } as any);
      });
      setRequests(escalated);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching escalated requests:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (request: LeaveRequest & { id: string }) => {
    setProcessingId(request.id);
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'leaveRequests', request.id);
        const balanceRef = doc(db, 'leaveBalances', request.userId);

        transaction.update(requestRef, {
          status: 'Approved',
          approvedBy: `Founder (${founder.name})`,
          approvedAt: serverTimestamp(),
          comments: 'Final approval by Founder after escalation'
        });

        const balanceUpdate: any = {};
        if (request.leaveType === 'CL') {
          balanceUpdate.clBalance = increment(-request.totalDays);
          balanceUpdate.currentMonthClUsed = increment(request.totalDays);
        } else if (request.leaveType === 'SL') {
          balanceUpdate.slBalance = increment(-request.totalDays);
          balanceUpdate.currentMonthSlUsed = increment(request.totalDays);
        } else if (request.leaveType === 'HDL') {
           balanceUpdate.hdlCount = increment(1);
        }

        transaction.update(balanceRef, balanceUpdate);
      });
    } catch (err) {
      console.error("Escalated approval error:", err);
      alert("Failed to approve escalated leave. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionData || !rejectionData.reason.trim()) return;
    
    setProcessingId(rejectionData.id);
    try {
      const requestRef = doc(db, 'leaveRequests', rejectionData.id);
      await runTransaction(db, async (transaction) => {
        transaction.update(requestRef, {
          status: 'Rejected',
          approvedBy: `Founder (${founder.name})`,
          approvedAt: serverTimestamp(),
          rejectionReason: rejectionData.reason,
          comments: 'Rejected by Founder after escalation'
        });
      });
      setRejectionData(null);
    } catch (err) {
      console.error("Escalated rejection error:", err);
      alert("Failed to reject leave.");
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '...';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-rose-200 overflow-hidden mb-8">
      <div className="px-6 py-5 border-b border-rose-100 bg-rose-50/30 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Escalated Requests</h3>
        </div>
        <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
          {requests.length} HIGH PRIORITY
        </span>
      </div>

      <div className="divide-y divide-rose-50">
        {requests.map((req: any) => (
          <div key={req.id} className="p-6 hover:bg-rose-50/20 transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <img className="h-12 w-12 rounded-full border-2 border-white shadow-sm" src={`https://picsum.photos/seed/${req.userId}/100`} alt="" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-slate-900">{req.employeeName}</h4>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Escalated</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      {req.leaveType}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center">
                      <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatDate(req.startDate)} - {formatDate(req.endDate)}
                    </span>
                    <span className="text-xs font-bold text-indigo-600">{req.totalDays} Day(s)</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100">
                      Reason: "{req.reason}"
                    </p>
                    {req.comments && (
                      <p className="text-[11px] text-rose-600 font-medium bg-rose-50 p-2 rounded-lg border border-rose-100">
                        Manager Comment: {req.comments}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {rejectionData?.id === req.id ? (
                  <div className="w-full lg:w-80 space-y-3">
                    <textarea
                      placeholder="Explain the rejection decision..."
                      className="w-full text-sm p-3 border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                      rows={2}
                      value={rejectionData.reason}
                      onChange={(e) => setRejectionData({ ...rejectionData, reason: e.target.value })}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleReject}
                        disabled={!rejectionData.reason.trim() || processingId === req.id}
                        className="flex-1 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 disabled:opacity-50 shadow-sm"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => setRejectionData(null)}
                        className="px-4 py-2 text-slate-500 text-xs font-bold hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={processingId !== null}
                      className="flex-1 lg:flex-none px-8 py-3 bg-emerald-600 text-white text-sm font-black rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-100 transition-all flex items-center justify-center uppercase tracking-wider"
                    >
                      {processingId === req.id ? 'Processing...' : 'Approve Final'}
                    </button>
                    <button
                      onClick={() => setRejectionData({ id: req.id, reason: '' })}
                      disabled={processingId !== null}
                      className="flex-1 lg:flex-none px-6 py-3 bg-white text-rose-600 border-2 border-rose-200 text-sm font-bold rounded-xl hover:bg-rose-50 transition-all"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EscalatedRequests;
