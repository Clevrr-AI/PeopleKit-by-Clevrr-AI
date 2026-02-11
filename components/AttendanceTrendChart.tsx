
import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';

interface AttendanceTrendChartProps {
  data: {
    date: string;
    dayNumber: number;
    timeValue: number | null;
    label: string;
  }[];
}

const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({ data }) => {
  const hasData = data.some(d => d.timeValue !== null);

  const formatTime = (value: number) => {
    if (value === null) return 'No Data';
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes < 10 ? `0${minutes}` : minutes;
    return `${h}:${m} ${ampm}`;
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-slate-800 font-bold">Monthly Check-in Trend</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Arrival Times (Current Month)</p>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-bold">
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5"></span>
            <span className="text-slate-500">Actual</span>
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-rose-400 mr-1.5"></span>
            <span className="text-slate-500">Cutoff (10:15)</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full relative">
        {!hasData && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
             <p className="text-slate-400 font-bold text-xs bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
               No check-ins recorded for this month
             </p>
          </div>
        )}
        
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 600 }}
              dy={10}
              interval="preserveStartEnd"
              minTickGap={10}
            />
            <YAxis 
              domain={[6, 22]} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
              ticks={[6, 8, 10, 12, 14, 16, 18, 20, 22]}
              tickFormatter={(val) => `${val > 12 ? val - 12 : val}${val >= 12 ? 'PM' : 'AM'}`}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              formatter={(value: number) => [formatTime(value), 'Check-in']}
              labelStyle={{ color: '#64748b', marginBottom: '4px' }}
            />
            <ReferenceLine y={10.5} stroke="#fb7185" strokeDasharray="4 4" strokeWidth={1.5} />
            <Line 
              type="monotone" 
              dataKey="timeValue" 
              stroke="#6366f1" 
              strokeWidth={3} 
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.timeValue === null) return <circle />; // Recharts hack for empty dots
                return <circle cx={cx} cy={cy} r={4} fill="#6366f1" stroke="#fff" strokeWidth={2} />;
              }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              animationDuration={1000}
              connectNulls={true} // Bridge gaps for continuous trend line
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AttendanceTrendChart;
