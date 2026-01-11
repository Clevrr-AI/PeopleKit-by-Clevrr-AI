import React, { useState } from 'react';
import { useHR } from '../App';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { AttendanceRecord } from '../types';

const Attendance: React.FC = () => {
  const { employees, attendance, setAttendance } = useHR();
  const [csvInput, setCsvInput] = useState('');
  const [parsedData, setParsedData] = useState<AttendanceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'view'>('view');

  // Simple CSV Simulation: EmployeeName, Date(YYYY-MM-DD), In(HH:mm), Out(HH:mm)
  const handleParse = () => {
    const lines = csvInput.trim().split('\n');
    const newRecords: AttendanceRecord[] = [];
    
    // Warning Counter cache for the month logic (simulated for this batch)
    // In a real app, we'd fetch existing monthly counts from DB.
    const lateCounter: Record<string, number> = {};

    lines.forEach((line) => {
      const [name, date, checkIn, checkOut] = line.split(',').map(s => s.trim());
      const emp = employees.find(e => e.name.toLowerCase() === name.toLowerCase());
      
      if (emp) {
        let status: AttendanceRecord['status'] = 'Present';
        let penaltyApplied = 0;
        
        // Late Logic
        const [inHour, inMin] = checkIn.split(':').map(Number);
        const timeVal = inHour * 60 + inMin;
        const limitLate = 10 * 60 + 15; // 10:15
        const limitVeryLate = 12 * 60 + 15; // 12:15

        if (timeVal > limitVeryLate) {
            status = 'Very Late';
        } else if (timeVal > limitLate) {
            status = 'Late';
        }

        // Penalty Logic
        if (status === 'Late' || status === 'Very Late') {
            lateCounter[emp.id] = (lateCounter[emp.id] || 0) + 1;
            // 4th occurrence
            if (lateCounter[emp.id] === 4) {
                if (status === 'Late') penaltyApplied = 0.5;
                if (status === 'Very Late') penaltyApplied = 1.0;
            }
        }

        newRecords.push({
          id: `ATT-${Math.random().toString(36).substr(2, 9)}`,
          employeeId: emp.id,
          date,
          checkIn,
          checkOut,
          status,
          penaltyApplied
        });
      }
    });
    setParsedData(newRecords);
  };

  const confirmUpload = () => {
    setAttendance([...attendance, ...parsedData]);
    setParsedData([]);
    setCsvInput('');
    setActiveTab('view');
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4 border-b border-slate-200 pb-2">
         <button 
            onClick={() => setActiveTab('view')}
            className={`px-4 py-2 font-medium ${activeTab === 'view' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
         >
             Attendance Log
         </button>
         <button 
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium ${activeTab === 'upload' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
         >
             Upload CSV
         </button>
       </div>

       {activeTab === 'upload' && (
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
               <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                   <Upload className="w-5 h-5" /> Upload Weekly Attendance
               </h2>
               <p className="text-sm text-slate-500 mb-4">
                   Paste CSV content (Format: Employee Name, YYYY-MM-DD, HH:mm, HH:mm).<br/>
                   Logic: &gt;10:15 Late, &gt;12:15 Very Late. 4th occurrence triggers penalty.
               </p>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div>
                       <textarea 
                           className="w-full h-64 p-4 border border-slate-300 rounded-lg font-mono text-sm"
                           placeholder="Alice Founder, 2023-11-20, 09:00, 18:00&#10;Bob Manager, 2023-11-20, 10:20, 18:00"
                           value={csvInput}
                           onChange={e => setCsvInput(e.target.value)}
                       />
                       <button 
                           onClick={handleParse}
                           className="mt-4 w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900"
                       >
                           Preview Data
                       </button>
                   </div>
                   
                   <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 overflow-y-auto h-64">
                       <h3 className="font-semibold text-slate-700 mb-2">Preview ({parsedData.length} records)</h3>
                       {parsedData.length === 0 ? (
                           <p className="text-slate-400 italic">No data parsed yet.</p>
                       ) : (
                           <div className="space-y-2">
                               {parsedData.map((rec, i) => {
                                   const empName = employees.find(e => e.id === rec.employeeId)?.name;
                                   return (
                                       <div key={i} className="flex justify-between items-center bg-white p-2 rounded shadow-sm text-sm">
                                           <span>{empName} - {rec.date}</span>
                                           <div className="flex items-center gap-2">
                                               <span className={`px-2 py-0.5 rounded text-xs ${
                                                   rec.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                               }`}>
                                                   {rec.status}
                                               </span>
                                               {rec.penaltyApplied > 0 && (
                                                   <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded border border-amber-200">
                                                       -{rec.penaltyApplied} Day(s)
                                                   </span>
                                               )}
                                           </div>
                                       </div>
                                   );
                               })}
                           </div>
                       )}
                   </div>
               </div>
               
               {parsedData.length > 0 && (
                   <div className="mt-6 flex justify-end">
                       <button onClick={confirmUpload} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                           <CheckCircle className="w-4 h-4" /> Confirm & Save
                       </button>
                   </div>
               )}
           </div>
       )}

       {activeTab === 'view' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-sm uppercase">
                        <tr>
                            <th className="p-4">Employee</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">In / Out</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Penalty</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {attendance.length === 0 ? (
                             <tr><td colSpan={5} className="p-8 text-center text-slate-400">No attendance records found. Upload data to begin.</td></tr>
                        ) : (
                            attendance.map((att) => {
                                const emp = employees.find(e => e.id === att.employeeId);
                                return (
                                    <tr key={att.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-medium text-slate-900">{emp?.name || 'Unknown'}</td>
                                        <td className="p-4 text-slate-600">{att.date}</td>
                                        <td className="p-4 font-mono text-sm text-slate-700">{att.checkIn} - {att.checkOut}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                att.status === 'Present' ? 'bg-green-50 text-green-700' :
                                                att.status === 'Late' ? 'bg-orange-50 text-orange-700' :
                                                'bg-red-50 text-red-700'
                                            }`}>
                                                {att.status === 'Very Late' && <AlertCircle className="w-3 h-3"/>}
                                                {att.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {att.penaltyApplied > 0 ? (
                                                <span className="font-bold text-red-600">-{att.penaltyApplied} Days</span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
           </div>
       )}
    </div>
  );
};

export default Attendance;