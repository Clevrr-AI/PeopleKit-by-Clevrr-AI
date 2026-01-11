export enum Role {
  EMPLOYEE = 'Employee',
  MANAGER = 'Manager',
  FOUNDER = 'Founder',
}

export enum Department {
  ENGINEERING = 'Engineering',
  GTM = 'GTM',
  DESIGN = 'Design',
  FINANCE = 'Finance',
  ADMIN = 'Admin',
  SALES = 'Sales',
}

export enum LeaveStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  ESCALATED = 'Escalated',
}

export enum LeaveType {
  CL = 'Casual Leave',
  SL = 'Sick Leave',
  PL = 'Privilege Leave',
}

export interface Allowances {
  hra: number;
  travel: number;
  other: number;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department;
  title: string;
  managerId?: string;
  joiningDate: string;
  baseSalary: number;
  allowances: Allowances;
  taxDeduction: number;
  isActive: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  managerComment?: string;
  documents?: boolean; // simulating attached docs
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string; // HH:mm
  checkOut: string; // HH:mm
  status: 'Present' | 'Absent' | 'Late' | 'Very Late' | 'Half Day';
  penaltyApplied: number; // In days (e.g., 0.5, 1)
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'Public' | 'Company Event';
}

export interface PayrollEntry {
  employeeId: string;
  employeeName: string;
  month: number; // 0-11
  year: number;
  workingDays: number;
  presentDays: number;
  leavesTaken: number;
  unpaidLeaves: number; // From late penalties or LWP
  dailyRate: number;
  grossSalary: number; // Base + Allowances
  deductions: {
    tax: number;
    leaveDeduction: number;
  };
  retentionBonus: {
    qualifiedMonths: number;
    amount: number;
  };
  netSalary: number;
  isProcessed: boolean;
}

// --- Firestore Schemas ---

export interface FirestoreUser {
  name: string;
  email: string;
  role: string;
  title: string;
  managerId: string;
  department: string;
  joiningDate: Date;
  employmentActive: boolean;
  createdAt: Date;
}

export interface FirestoreSalaryConfig {
  userId: string;
  employeeName: string;
  baseSalary: number;
  allowances: {
    hra: number;
    travel: number;
    other: number;
  };
  taxDeduction: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface FirestoreLeaveBalance {
  userId: string;
  employeeName: string;
  year: number;
  clBalance: number;
  clTotal: number;
  slBalance: number;
  slTotal: number;
  hdlCount: number;
  currentMonthClUsed: number;
  currentMonthSlUsed: number;
  currentMonth: number;
  lastMonthlyReset: Date;
  createdAt: Date;
}

export interface RetentionMonthData {
  month: string;
  bonus: number;
  leaves: number;
}

export interface FirestoreRetentionBonus {
  userId: string;
  employeeName: string;
  year: number;
  bonusMonths: RetentionMonthData[];
  totalBonus: number;
}