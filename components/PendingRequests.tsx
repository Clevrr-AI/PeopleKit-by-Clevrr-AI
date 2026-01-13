
import React, { useState, useEffect } from 'react';
import { LeaveRequest, UserProfile } from '../types';
import { db, collection, query, where, onSnapshot, doc, runTransaction, serverTimestamp, increment } from '../firebase';

interface PendingRequestsProps {
  manager: UserProfile;
}

const PendingRequests: React.FC<PendingRequestsProps> = ({ manager }) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionData, setActionData] = useState<{ id: string; type: 'reject' | 'escalate'; reason: string } | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'leaveRequests'),
      where('managerId', '==', manager.uid),
      where('status', '==', 'Pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        pending.push({ id: doc.id, ...doc.data() } as any);
      });
      setRequests(pending);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching pending requests:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [manager.uid]);

  const handleApprove = async (request: LeaveRequest & { id: string }) => {
    setProcessingId(request.id);
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'leaveRequests', request.id);
        const balanceRef = doc(db, 'leaveBalances', request.userId);

        transaction.update(requestRef, {
          status: 'Approved',
          approvedBy: manager.name || manager.email,
          approvedAt: serverTimestamp(),
          comments: 'Approved by manager'
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
      console.error("Approval error:", err);
      alert("Failed to approve leave. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectOrEscalate = async () => {
    if (!actionData || !actionData.reason.trim()) return;
    
    setProcessingId(actionData.id);
    const { id, type, reason } = actionData;

    try {
      const requestRef = doc(db, 'leaveRequests', id);
      const updates: any = {
        approvedAt: serverTimestamp(),
        approvedBy: manager.name || manager.email,
      };

      if (type === 'reject') {
        updates.status = 'Rejected';
        updates.rejectionReason = reason;
      } else {
        updates.status = 'Escalated';
        updates.isEscalated = true;
        updates.comments = reason;
      }

      await runTransaction(db, async (transaction) => {
        transaction.update(requestRef, updates);
      });
      setActionData(null);
    } catch (err) {
      console.error(`${type} error:`, err);
      alert(`Failed to ${type} leave.`);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '...';
    try {
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }
      return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch (e) {
      return 'Inv';
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="px-6 py-5 border-b border-slate-100 bg-indigo-50/30 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Pending Approvals</h3>
        </div>
        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
          {requests.length} ACTION REQUIRED
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {requests.map((req: any) => (
          <div key={req.id} className="p-6 hover:bg-slate-50/50 transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <img className="h-12 w-12 rounded-full border-2 border-white shadow-sm" src={`https://picsum.photos/seed/${req.userId}/100`} alt="" />
                <div>
                  <h4 className="font-bold text-slate-900">{req.employeeName}</h4>
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
                  <p className="text-sm text-slate-600 mt-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    "{req.reason}"
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {actionData?.id === req.id ? (
                  <div className="w-full lg:w-80 space-y-3">
                    <textarea
                      placeholder={actionData.type === 'reject' ? "Reason for rejection..." : "Reason for escalation..."}
                      className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      rows={2}
                      value={actionData.reason}
                      onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleRejectOrEscalate}
                        disabled={!actionData.reason.trim() || processingId === req.id}
                        className="flex-1 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black disabled:opacity-50"
                      >
                        Confirm {actionData.type === 'reject' ? 'Reject' : 'Escalate'}
                      </button>
                      <button
                        onClick={() => setActionData(null)}
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
                      className="flex-1 lg:flex-none px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-sm shadow-emerald-100 transition-all flex items-center justify-center"
                    >
                      {processingId === req.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setActionData({ id: req.id, type: 'reject', reason: '' })}
                      disabled={processingId !== null}
                      className="flex-1 lg:flex-none px-6 py-2.5 bg-white text-rose-600 border border-rose-200 text-xs font-bold rounded-xl hover:bg-rose-50 transition-all"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => setActionData({ id: req.id, type: 'escalate', reason: '' })}
                      disabled={processingId !== null}
                      className="flex-1 lg:flex-none px-6 py-2.5 bg-white text-amber-600 border border-amber-200 text-xs font-bold rounded-xl hover:bg-amber-50 transition-all"
                    >
                      Escalate
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

export default PendingRequests;
