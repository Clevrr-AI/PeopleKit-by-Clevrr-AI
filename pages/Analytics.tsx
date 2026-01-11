import React, { useState } from 'react';
import { useHR } from '../App';
import { generateExecutiveReport } from '../services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Sparkles, Loader2 } from 'lucide-react';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

const Analytics: React.FC = () => {
  const { employees, payrollData } = useHR();
  const [report, setReport] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Department Data
  const deptData = Object.values(employees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)).map((val, idx) => ({
    name: Object.keys(employees.reduce((acc, emp) => { acc[emp.department] = 0; return acc; }, {} as Record<string, number>))[idx],
    value: val
  }));

  // Salary Range Data (Mock)
  const salaryData = [
    { name: 'Engineering', salary: 120000 },
    { name: 'Sales', salary: 85000 },
    { name: 'Marketing', salary: 70000 },
    { name: 'HR', salary: 65000 },
  ];

  const handleGenerateReport = async () => {
    setIsLoading(true);
    const result = await generateExecutiveReport(employees, payrollData, 'Current Month');
    setReport(result);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Company Analytics</h1>
          <p className="text-slate-500">Visual insights and AI-driven strategic reporting.</p>
        </div>
        <button 
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 font-medium disabled:opacity-70"
        >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {report ? 'Refresh Insights' : 'Generate AI Executive Summary'}
        </button>
      </div>

      {report && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-4">
            <h3 className="text-indigo-900 font-bold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Gemini Executive Insights
            </h3>
            <div className="prose prose-sm text-slate-700 max-w-none whitespace-pre-line">
                {report}
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Headcount Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
          <h3 className="font-semibold text-slate-800 mb-4">Headcount by Department</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={deptData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {deptData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Salary Spend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
          <h3 className="font-semibold text-slate-800 mb-4">Avg Salary by Dept (Projected)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salaryData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{fontSize: 12}} />
              <YAxis tick={{fontSize: 12}} />
              <Tooltip formatter={(val) => `$${val}`} />
              <Bar dataKey="salary" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
};

export default Analytics;