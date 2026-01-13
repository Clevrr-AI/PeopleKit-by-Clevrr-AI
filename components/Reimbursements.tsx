
import React, { useState, useEffect } from 'react';
import { UserProfile, Reimbursement } from '../types';
import { db, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from '../firebase';

interface ReimbursementsProps {
  user: UserProfile;
}

const Reimbursements: React.FC<ReimbursementsProps> = ({ user }) => {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-claims' | 'approvals'>(user.role === 'Founder' ? 'approvals' : 'my-claims');
  
  const [formData, setFormData] = useState({
    dateOfPayment: '',
    amount: '',
    reason: '',
    receiptDriveLink: '',
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Rejection handling state
  const [rejectionData, setRejectionData] = useState<{ id: string; reason: string } | null>(null);

  const isFounder = user.role === 'Founder';

  useEffect(() => {
    // Current user's claims
    const qMy = query(
      collection(db, 'reimbursements'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeMy = onSnapshot(qMy, (snapshot) => {
      const list: Reimbursement[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Reimbursement);
      });
      setReimbursements(list);
      if (!isFounder) setLoading(false);
    });

    // Founder approvals
    let unsubscribeApprovals = () => {};
    if (isFounder) {
      const qApp = query(
        collection(db, 'reimbursements'),
        where('status', '==', 'Pending'),
        orderBy('createdAt', 'desc')
      );

      unsubscribeApprovals = onSnapshot(qApp, (snapshot) => {
        const list: Reimbursement[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Reimbursement);
        });
        setPendingApprovals(list);
        setLoading(false);
      });
    }

    return () => {
      unsubscribeMy();
      unsubscribeApprovals();
    };
  }, [user.uid, isFounder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reimbursements'), {
        userId: user.uid,
        employeeName: user.name,
        dateOfPayment: formData.dateOfPayment,
        amount: parseFloat(formData.amount),
        reason: formData.reason,
        receiptDriveLink: formData.receiptDriveLink || null,
        status: 'Pending',
        createdAt: serverTimestamp(),
        approvedAt: null,
      });
      setFormData({ dateOfPayment: '', amount: '', reason: '', receiptDriveLink: '' });
      setShowForm(false);
    } catch (err) {
      console.error("Error adding reimbursement:", err);
      alert("Failed to submit reimbursement request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (claimId: string) => {
    try {
      await updateDoc(doc(db, 'reimbursements', claimId), {
        status: 'Approved',
        approvedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error approving claim:", err);
      alert("Failed to approve reimbursement.");
    }
  };

  const handleReject = async () => {
    if (!rejectionData || !rejectionData.reason.trim()) return;
    try {
      await updateDoc(doc(db, 'reimbursements', rejectionData.id), {
        status: 'Rejected',
        rejectionReason: rejectionData.reason,
        approvedAt: serverTimestamp(), 
      });
      setRejectionData(null);
    } catch (err) {
      console.error("Error rejecting claim:", err);
      alert("Failed to reject reimbursement.");
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Cancelled': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const openLink = (url: string | null) => {
    if (url) {
      window.open(url, '_blank');
    } else {
      alert("No link provided for this claim.");
    }
  };

  const renderTable = (list: Reimbursement[], showEmployeeName: boolean = false) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50/50">
          <tr>
            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
            {showEmployeeName && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Employee</th>}
            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</th>
            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reason</th>
            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
            <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {list.map((claim) => (
            <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                {claim.dateOfPayment}
              </td>
              {showEmployeeName && (
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-bold">
                  {claim.employeeName}
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-bold">
                ₹{claim.amount.toLocaleString('en-IN')}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                {claim.reason}
                {claim.rejectionReason && (
                  <p className="text-[10px] text-rose-500 mt-1 font-bold">Note: {claim.rejectionReason}</p>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusStyle(claim.status)}`}>
                  {claim.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                {activeTab === 'approvals' && claim.status === 'Pending' ? (
                  <>
                    <button 
                      onClick={() => openLink(claim.receiptDriveLink)}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors mr-2"
                    >
                      View Link
                    </button>
                    <button 
                      onClick={() => handleApprove(claim.id!)}
                      className="text-emerald-600 hover:text-emerald-800 text-xs font-bold transition-colors mr-2"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => setRejectionData({ id: claim.id!, reason: '' })}
                      className="text-rose-600 hover:text-rose-800 text-xs font-bold transition-colors"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => openLink(claim.receiptDriveLink)}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors"
                  >
                    View Link
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reimbursements</h1>
          <p className="text-slate-500 text-sm">Track and claim your business expenses.</p>
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
          {isFounder && (
            <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
              <button 
                onClick={() => setActiveTab('approvals')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'approvals' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Approvals ({pendingApprovals.length})
              </button>
              <button 
                onClick={() => setActiveTab('my-claims')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'my-claims' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                My Claims
              </button>
            </div>
          )}
          <button 
            onClick={() => setShowForm(true)}
            className="flex-1 md:flex-none bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center space-x-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Claim</span>
          </button>
        </div>
      </header>

      {/* Main List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium animate-pulse">Loading claims...</div>
        ) : (
          <>
            {activeTab === 'my-claims' ? (
              reimbursements.length === 0 ? (
                <div className="p-16 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                    <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">You haven't made any claims yet.</p>
                </div>
              ) : renderTable(reimbursements)
            ) : (
              pendingApprovals.length === 0 ? (
                <div className="p-16 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                    <svg className="h-8 w-8 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">No pending approvals! All caught up.</p>
                </div>
              ) : renderTable(pendingApprovals, true)
            )}
          </>
        )}
      </div>

      {/* New Claim Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowForm(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="relative w-screen max-w-md">
              <form onSubmit={handleSubmit} className="h-full flex flex-col bg-white shadow-2xl">
                <div className="px-6 py-8 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-900">New Reimbursement</h2>
                  <button type="button" onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Date of Payment</label>
                    <input 
                      type="date" 
                      required
                      value={formData.dateOfPayment}
                      onChange={(e) => setFormData({...formData, dateOfPayment: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Amount (INR)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2 text-slate-400 font-bold">₹</span>
                      <input 
                        type="number" 
                        required
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Reason</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder="What was this expense for?"
                      value={formData.reason}
                      onChange={(e) => setFormData({...formData, reason: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    ></textarea>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Google Drive Link (Proof)</label>
                    <input 
                      type="url" 
                      required
                      placeholder="https://drive.google.com/..."
                      value={formData.receiptDriveLink}
                      onChange={(e) => setFormData({...formData, receiptDriveLink: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Please ensure the link sharing permissions are set correctly.</p>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Claim'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRejectionData(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Reject Claim</h3>
            <p className="text-sm text-slate-500 mb-4">Please provide a reason for rejecting this reimbursement claim.</p>
            <textarea 
              autoFocus
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none resize-none text-sm mb-4"
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectionData.reason}
              onChange={(e) => setRejectionData({...rejectionData, reason: e.target.value})}
            />
            <div className="flex space-x-3">
              <button 
                onClick={() => setRejectionData(null)}
                className="flex-1 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleReject}
                disabled={!rejectionData.reason.trim()}
                className="flex-1 py-2 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reimbursements;
