import { Employee, AttendanceRecord, PayrollEntry, LeaveRequest, LeaveStatus } from '../types';

export const calculateDailyRate = (baseSalary: number): number => {
  return baseSalary / 30; // Standard 30-day calculation
};

export const getMonthName = (monthIndex: number) => {
  const date = new Date();
  date.setMonth(monthIndex);
  return date.toLocaleString('default', { month: 'long' });
};

// Simulate Retention Bonus: 2 days salary per qualifying month (0 leaves)
// Max 24 days.
export const calculateRetentionBonus = (
  employee: Employee,
  year: number,
  allLeaves: LeaveRequest[]
): { qualifiedMonths: number; amount: number } => {
  let qualifiedMonths = 0;
  const dailyRate = calculateDailyRate(employee.baseSalary);

  for (let m = 0; m < 12; m++) {
    const startOfMonth = new Date(year, m, 1);
    const endOfMonth = new Date(year, m + 1, 0);

    const leavesInMonth = allLeaves.filter(
      (l) =>
        l.employeeId === employee.id &&
        l.status === LeaveStatus.APPROVED &&
        new Date(l.startDate) >= startOfMonth &&
        new Date(l.endDate) <= endOfMonth
    );

    if (leavesInMonth.length === 0) {
      qualifiedMonths++;
    }
  }

  return {
    qualifiedMonths,
    amount: qualifiedMonths * 2 * dailyRate,
  };
};

export const processPayroll = (
  employees: Employee[],
  attendance: AttendanceRecord[],
  leaves: LeaveRequest[],
  month: number,
  year: number
): PayrollEntry[] => {
  return employees.map((emp) => {
    // 1. Basic Stats
    const dailyRate = calculateDailyRate(emp.baseSalary);
    const grossSalary = emp.baseSalary + emp.allowances.hra + emp.allowances.travel + emp.allowances.other;

    // 2. Attendance & Penalties (Current Month)
    const monthAttendance = attendance.filter((a) => {
      const d = new Date(a.date);
      return d.getMonth() === month && d.getFullYear() === year && a.employeeId === emp.id;
    });

    const latePenaltiesDays = monthAttendance.reduce((acc, curr) => acc + curr.penaltyApplied, 0);

    // 3. Leaves (Unpaid logic simplified for demo: If leaves > 2, deduct. Real world is complex)
    const monthLeaves = leaves.filter((l) => {
        const d = new Date(l.startDate);
        return l.employeeId === emp.id && l.status === LeaveStatus.APPROVED && d.getMonth() === month && d.getFullYear() === year;
    });
    
    // Simplified: Calculate duration of leaves in days
    const leaveDaysTaken = monthLeaves.reduce((acc, l) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return acc + diff;
    }, 0);

    // Assume 2 days paid leave allowed per month for demo
    const excessLeaveDays = Math.max(0, leaveDaysTaken - 2); 
    const totalUnpaidDays = latePenaltiesDays + excessLeaveDays;

    const leaveDeductionAmount = totalUnpaidDays * dailyRate;

    // 4. Retention Bonus (Only applied in December)
    let retention = { qualifiedMonths: 0, amount: 0 };
    if (month === 11) { // December
        retention = calculateRetentionBonus(emp, year, leaves);
    }

    const totalDeductions = emp.taxDeduction + leaveDeductionAmount;
    const net = grossSalary + retention.amount - totalDeductions;

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      month,
      year,
      workingDays: 30, // simplified
      presentDays: 30 - leaveDaysTaken, // simplified
      leavesTaken: leaveDaysTaken,
      unpaidLeaves: totalUnpaidDays,
      dailyRate,
      grossSalary,
      deductions: {
        tax: emp.taxDeduction,
        leaveDeduction: leaveDeductionAmount,
      },
      retentionBonus: retention,
      netSalary: Math.max(0, Math.floor(net)),
      isProcessed: false,
    };
  });
};