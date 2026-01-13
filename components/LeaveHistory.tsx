
import React, { useState, useEffect } from 'react';
import { LeaveRequest, UserProfile } from '../types';
import { db, collection, query, where, orderBy, onSnapshot } from '../firebase';

interface LeaveHistoryProps {
  user: UserProfile;
}

const LeaveHistory: React.FC<LeaveHistoryProps> = ({ user }) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', user.uid),
      orderBy('requestedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leaves: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        leaves.push({ id: doc.id, ...doc.data() } as any);
      });
      setRequests(leaves);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leave history:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Pending':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Cancelled':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '...';
    try {
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-100 rounded w-1/4 mx-auto"></div>
          <div className="h-10 bg-slate-50 rounded"></div>
          <div className="h-10 bg-slate-50 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Leave History</h3>
        <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-full">
          {requests.length} total requests
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">No leave applications found.</p>
          <p className="text-slate-400 text-sm mt-1">Applied leaves will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Days</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested On</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {requests.map((req: any) => (
                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${req.leaveType === 'CL' ? 'bg-blue-500' : req.leaveType === 'SL' ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                      <span className="text-sm font-semibold text-slate-900">{req.leaveType}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600">
                      {formatDate(req.startDate)}
                      {req.totalDays > 1 && ` - ${formatDate(req.endDate)}`}
                      {req.isHalfDay && <span className="ml-2 text-[10px] font-bold text-indigo-500 uppercase">({req.halfDayType})</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-900">{req.totalDays}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusStyles(req.status)}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-400">
                    {formatDate(req.requestedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaveHistory;
