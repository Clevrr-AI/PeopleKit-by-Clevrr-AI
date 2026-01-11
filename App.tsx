import React, { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import EmployeeList from './pages/EmployeeList';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Analytics from './pages/Analytics';
import Leaves from './pages/Leaves';
import { Employee, LeaveRequest, AttendanceRecord, PayrollEntry } from './types';
import { fetchEmployees, fetchLeaves, fetchAttendance } from './services/firebase';
import { Loader2 } from 'lucide-react';

// --- Context ---
interface HRContextType {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  leaves: LeaveRequest[];
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  payrollData: PayrollEntry[];
  setPayrollData: React.Dispatch<React.SetStateAction<PayrollEntry[]>>;
  isLoading: boolean;
}

const HRContext = createContext<HRContextType | undefined>(undefined);

export const useHR = () => {
  const context = useContext(HRContext);
  if (!context) throw new Error('useHR must be used within HRProvider');
  return context;
};

// --- Layout ---
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [empData, leaveData, attData] = await Promise.all([
          fetchEmployees(),
          fetchLeaves(),
          fetchAttendance()
        ]);
        setEmployees(empData);
        setLeaves(leaveData);
        setAttendance(attData);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-medium">Loading Apex HRMS...</p>
        </div>
      </div>
    );
  }

  return (
    <HRContext.Provider
      value={{
        employees,
        setEmployees,
        leaves,
        setLeaves,
        attendance,
        setAttendance,
        payrollData,
        setPayrollData,
        isLoading
      }}
    >
      <HashRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </HashRouter>
    </HRContext.Provider>
  );
};

export default App;