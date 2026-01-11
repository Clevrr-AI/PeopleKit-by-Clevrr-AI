import React from 'react';
import { useHR } from '../App';
import { Users, Banknote, AlertTriangle, Clock } from 'lucide-react';
import { LeaveStatus } from '../types';

const Dashboard: React.FC = () => {
  const { employees, leaves, payrollData } = useHR();

  const activeEmployees = employees.filter(e => e.isActive).length;
  const pendingLeaves = leaves.filter(l => l.status === LeaveStatus.ESCALATED).length;
  const totalPayroll = payrollData.reduce((acc, curr) => acc + curr.netSalary, 0);

  const stats = [
    { 
      label: 'Active Employees', 
      value: activeEmployees, 
      icon: Users, 
      color: 'bg-blue-500', 
      desc: 'Across 4 departments' 
    },
    { 
      label: 'Pending Escalations', 
      value: pendingLeaves, 
      icon: AlertTriangle, 
      color: 'bg-amber-500', 
      desc: 'Requires founder review' 
    },
    { 
      label: 'Last Payroll Processed', 
      value: `$${totalPayroll.toLocaleString()}`, 
      icon: Banknote, 
      color: 'bg-emerald-500', 
      desc: 'For current month' 
    },
    { 
      label: 'Attendance Issues', 
      value: '3', 
      icon: Clock, 
      color: 'bg-rose-500', 
      desc: 'Employees > 3 late marks' 
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Founder Dashboard</h1>
        <p className="text-slate-500">Overview of company health and pending actions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
              </div>
              <div className={`${stat.color} p-3 rounded-lg text-white`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50">
                <span className="text-xs text-slate-400">{stat.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Recent Employee Additions</h2>
          <div className="space-y-4">
            {employees.slice(-3).reverse().map(emp => (
              <div key={emp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{emp.name}</p>
                    <p className="text-xs text-slate-500">{emp.department} • {emp.role}</p>
                  </div>
                </div>
                <div className="text-sm text-slate-500">Joined {emp.joiningDate}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
           <h2 className="text-lg font-semibold mb-4 text-slate-800">System Alerts</h2>
           <div className="space-y-3">
             {pendingLeaves > 0 ? (
               <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-r-lg">
                 <strong>Action Required:</strong> {pendingLeaves} leave request(s) escalated to you.
               </div>
             ) : (
               <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-900 rounded-r-lg">
                 All leave requests handled.
               </div>
             )}
             <div className="p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-900 rounded-r-lg">
                <strong>December Bonus:</strong> Retention bonus calculation is active for this month's payroll.
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;