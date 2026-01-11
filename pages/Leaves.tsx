import React from 'react';
import { useHR } from '../App';
import { LeaveStatus } from '../types';
import { CheckCircle, XCircle, FileText, AlertTriangle } from 'lucide-react';

const Leaves: React.FC = () => {
  const { leaves, employees, setLeaves } = useHR();

  const escalatedLeaves = leaves.filter(l => l.status === LeaveStatus.ESCALATED);

  const handleAction = (id: string, newStatus: LeaveStatus) => {
    setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Approvals Queue</h1>
        <p className="text-slate-500">Review escalated leave requests requiring founder decision.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Escalated Requests ({escalatedLeaves.length})</h2>
        </div>

        {escalatedLeaves.length === 0 ? (
            <div className="p-12 text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-slate-900 font-medium">All clear!</h3>
                <p className="text-slate-500">No pending escalations at the moment.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {escalatedLeaves.map(leave => {
                    const emp = employees.find(e => e.id === leave.employeeId);
                    return (
                        <div key={leave.id} className="p-6 hover:bg-slate-50 transition">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-lg text-slate-800">{emp?.name}</span>
                                        <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded uppercase font-bold tracking-wider">{leave.type}</span>
                                        {leave.documents && (
                                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                <FileText className="w-3 h-3" /> Docs Attached
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        Requested: <span className="font-mono text-slate-700">{leave.startDate}</span> to <span className="font-mono text-slate-700">{leave.endDate}</span>
                                    </div>
                                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-amber-900 text-sm max-w-2xl">
                                        <span className="font-semibold block mb-1">Manager Escalation Note:</span>
                                        "{leave.managerComment}"
                                    </div>
                                </div>
                                
                                <div className="flex items-start gap-3">
                                    <button 
                                        onClick={() => handleAction(leave.id, LeaveStatus.REJECTED)}
                                        className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg transition"
                                    >
                                        <XCircle className="w-4 h-4" /> Reject
                                    </button>
                                    <button 
                                        onClick={() => handleAction(leave.id, LeaveStatus.APPROVED)}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
};

export default Leaves;